import * as fs from "fs/promises"
import * as fsSync from "fs"
import path from "path"
import { Database, eq } from "../storage"
import { Log } from "../util"
import { MemoryFtsTable } from "./fts.sql"
import { parsePath, parseCcPath, parseCcFrontmatterType, type MemoryLocator } from "./paths"

const log = Log.create({ service: "memory.reconcile" })

// Incremental update watcher
let watcher: fsSync.FSWatcher | null = null
let pendingUpdates = new Set<string>()
let updateTimer: ReturnType<typeof setTimeout> | null = null
const DEBOUNCE_MS = 500

function scheduleUpdate(filePath: string, roots: { mty: string; cc?: string }) {
  pendingUpdates.add(filePath)
  if (updateTimer) clearTimeout(updateTimer)
  updateTimer = setTimeout(() => processUpdates(roots), DEBOUNCE_MS)
}

async function processUpdates(roots: { mty: string; cc?: string }) {
  const files = Array.from(pendingUpdates)
  pendingUpdates.clear()
  updateTimer = null

  for (const filePath of files) {
    try {
      const exists = await fs.access(filePath).then(() => true).catch(() => false)
      if (!exists) {
        // File deleted - remove from index
        Database.use((db) => db.delete(MemoryFtsTable).where(eq(MemoryFtsTable.path, filePath)).run())
        log.info("incremental: removed deleted file", { path: filePath })
        continue
      }

      // Determine if mty or cc path
      const isMty = filePath.startsWith(roots.mty)
      const isCc = roots.cc && filePath.startsWith(roots.cc)

      if (isMty) {
        const loc = parsePath(filePath)
        if (loc) {
          const result = await indexFromDisk(filePath, loc, "mty")
          if (result === "updated") log.info("incremental: updated mty file", { path: filePath })
        }
      } else if (isCc && roots.cc) {
        const loc = parseCcPath(filePath)
        if (loc) {
          const result = await indexFromDisk(filePath, loc, "cc")
          if (result === "updated") log.info("incremental: updated cc file", { path: filePath })
        }
      }
    } catch (e) {
      log.warn("incremental update failed", { path: filePath, error: e })
    }
  }
}

export function startWatching(roots: { mty: string; cc?: string }) {
  if (watcher) return

  const dirs = [roots.mty]
  if (roots.cc) dirs.push(roots.cc)

  for (const dir of dirs) {
    try {
      const w = fsSync.watch(dir, { recursive: true }, (event, filename) => {
        if (!filename || !filename.endsWith(".md")) return
        const fullPath = path.join(dir, filename)
        scheduleUpdate(fullPath, roots)
      })
      w.on("error", (e) => log.warn("watcher error", { dir, error: e }))
      log.info("started watching for incremental updates", { dir })
    } catch (e) {
      log.warn("failed to start watcher", { dir, error: e })
    }
  }

  log.info("memory incremental watcher started", { dirs })
}

export function stopWatching() {
  if (watcher) {
    watcher.close()
    watcher = null
  }
  if (updateTimer) {
    clearTimeout(updateTimer)
    updateTimer = null
  }
  pendingUpdates.clear()
  log.info("memory incremental watcher stopped")
}

export async function walkMemoryDir(root: string): Promise<string[]> {
  const out: string[] = []
  async function recurse(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch((e: NodeJS.ErrnoException) => {
      if (e.code === "ENOENT") return [] as import("fs").Dirent[]
      throw e
    })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) await recurse(full)
      else if (entry.isFile() && full.endsWith(".md")) out.push(full)
    }
  }
  await recurse(root)
  return out
}

// Walk <base>/<slug>/memory/**/*.md across every slug under <base>.
// ENOENT on <base> returns []; missing memory subdirs are silently skipped.
export async function walkCcRoot(base: string): Promise<string[]> {
  const slugs = await fs.readdir(base, { withFileTypes: true }).catch((e: NodeJS.ErrnoException) => {
    if (e.code === "ENOENT") return [] as import("fs").Dirent[]
    throw e
  })
  const out: string[] = []
  for (const entry of slugs) {
    if (!entry.isDirectory()) continue
    const memoryDir = path.join(base, entry.name, "memory")
    const exists = await fs.stat(memoryDir).then(() => true).catch(() => false)
    if (!exists) continue
    const files = await walkMemoryDir(memoryDir)
    for (const f of files) out.push(f)
  }
  return out
}

export async function indexFromDisk(
  absPath: string,
  loc: MemoryLocator,
  bodyType: "mty" | "cc",
  oldFingerprint?: string,
): Promise<"hit" | "updated" | "skipped"> {
  const stat = await fs.stat(absPath).catch((e: NodeJS.ErrnoException) => {
    if (e.code === "ENOENT") return null
    throw e
  })
  if (!stat) return "skipped"
  const fingerprint = `${stat.size}-${stat.mtimeMs}`
  if (oldFingerprint === fingerprint) return "hit"

  const body = await Bun.file(absPath).text()

  // For CC files, derive type from frontmatter; mty files keep loc.type from path.
  const finalType =
    bodyType === "cc" ? (parseCcFrontmatterType(body) ?? "free") : loc.type

  Database.use((db) =>
    db
      .insert(MemoryFtsTable)
      .values({
        path: absPath,
        scope: loc.scope,
        scope_id: loc.scope_id,
        type: finalType,
        body,
        fingerprint,
        last_indexed_at: Date.now(),
      })
      .onConflictDoUpdate({
        target: MemoryFtsTable.path,
        set: {
          scope: loc.scope,
          scope_id: loc.scope_id,
          type: finalType,
          body,
          fingerprint,
          last_indexed_at: Date.now(),
        },
      })
      .run(),
  )
  return "updated"
}

export async function reconcileMemory(
  roots: { mty: string; cc?: string },
): Promise<{ indexed: number; pruned: number }> {
  // Collect disk paths from BOTH roots before pruning. If we pruned per-root,
  // enabling CC indexing on a fresh run would prune all mty rows (and vice
  // versa) because each walk's set is missing the other root's paths.
  const mtyFiles = new Set(await walkMemoryDir(roots.mty))
  const ccFiles = roots.cc ? new Set(await walkCcRoot(roots.cc)) : new Set<string>()
  const diskPaths = new Set<string>([...mtyFiles, ...ccFiles])

  const indexed = new Map<string, string>(
    Database.use((db) =>
      db
        .select({ path: MemoryFtsTable.path, fingerprint: MemoryFtsTable.fingerprint })
        .from(MemoryFtsTable)
        .all(),
    ).map((r) => [r.path, r.fingerprint]),
  )

  // Direction B: prune dead FTS rows (any path not in either walk).
  let pruned = 0
  for (const p of indexed.keys()) {
    if (!diskPaths.has(p)) {
      Database.use((db) => db.delete(MemoryFtsTable).where(eq(MemoryFtsTable.path, p)).run())
      pruned++
    }
  }

  // Direction A: index disk files. Pick parser by which walk produced the path.
  let indexedCount = 0
  for (const p of mtyFiles) {
    const loc = parsePath(p)
    if (!loc) {
      log.warn("path outside memory layout, skipping", { path: p })
      continue
    }
    const result = await indexFromDisk(p, loc, "mty", indexed.get(p))
    if (result === "updated") indexedCount++
  }
  for (const p of ccFiles) {
    const loc = parseCcPath(p)
    if (!loc) {
      log.warn("CC path failed to parse, skipping", { path: p })
      continue
    }
    const result = await indexFromDisk(p, loc, "cc", indexed.get(p))
    if (result === "updated") indexedCount++
  }

  return { indexed: indexedCount, pruned }
}
