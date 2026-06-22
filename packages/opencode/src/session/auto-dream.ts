import { Effect } from "effect"
import { Database, eq, desc, asc, isNull } from "@/storage"
import { SessionTable } from "./session.sql"
import { Log } from "@/util"
import type { Config } from "@/config"
import fs from "fs/promises"
import path from "path"
import { Global } from "@/global"

const log = Log.create({ service: "auto-dream" })

const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_DREAM_INTERVAL_DAYS = 7
const DEFAULT_DISTILL_INTERVAL_DAYS = 14 // More frequent than original 30 days
const MIN_SPAWN_GAP_MS = 10_000

export const AUTO_DREAM_TITLE = "Auto Dream"
export const AUTO_DISTILL_TITLE = "Auto Distill"

let lastDreamSpawnTime = 0
let lastDistillSpawnTime = 0

// Skill scoring system
interface SkillScore {
  name: string
  occurrences: number
  firstSeen: number
  lastSeen: number
  avgTimeSaved: number // estimated seconds saved per use
  confidence: number // 0-1 score
  recommended: boolean
}

const SKILL_SCORES_FILE = "skill-scores.json"

async function loadSkillScores(): Promise<Record<string, SkillScore>> {
  try {
    const filePath = path.join(Global.Path.data, SKILL_SCORES_FILE)
    const content = await fs.readFile(filePath, "utf-8")
    return JSON.parse(content)
  } catch {
    return {}
  }
}

async function saveSkillScores(scores: Record<string, SkillScore>): Promise<void> {
  const filePath = path.join(Global.Path.data, SKILL_SCORES_FILE)
  await fs.writeFile(filePath, JSON.stringify(scores, null, 2), "utf-8")
}

export async function recordSkillCandidate(name: string, timeSaved: number): Promise<void> {
  const scores = await loadSkillScores()
  const now = Date.now()

  if (!scores[name]) {
    scores[name] = {
      name,
      occurrences: 1,
      firstSeen: now,
      lastSeen: now,
      avgTimeSaved: timeSaved,
      confidence: 0.3, // Low initial confidence
      recommended: false,
    }
  } else {
    const existing = scores[name]
    existing.occurrences++
    existing.lastSeen = now
    existing.avgTimeSaved = (existing.avgTimeSaved * (existing.occurrences - 1) + timeSaved) / existing.occurrences
    // Confidence increases with occurrences, max 0.95
    existing.confidence = Math.min(0.95, 0.3 + (existing.occurrences * 0.15))
    // Recommend when confidence > 0.7 and occurred 3+ times
    existing.recommended = existing.confidence >= 0.7 && existing.occurrences >= 3
  }

  await saveSkillScores(scores)

  if (scores[name].recommended) {
    log.info(`skill candidate recommended`, { name, confidence: scores[name].confidence, occurrences: scores[name].occurrences })
  }
}

export async function getRecommendedSkills(): Promise<SkillScore[]> {
  const scores = await loadSkillScores()
  return Object.values(scores)
    .filter((s) => s.recommended)
    .sort((a, b) => b.confidence - a.confidence)
}

export const DREAM_TASK = [
  "Run one automatic dream memory consolidation pass for the current project.",
  "",
  "Use the memory files as the working index and the raw mtycoder trajectory database as the source of truth.",
  "Use bash for read-only SQLite and filesystem inspection. Do not modify the database.",
  "Consolidate only durable, verified information into project memory.",
].join("\n")

export const DISTILL_TASK = [
  "Run one automatic distill pass for the current project.",
  "",
  "Review the past 2 weeks of sessions and identify repeated manual workflows worth packaging.",
  "Use the raw mtycoder trajectory database as the source of truth and memory files to spot cross-session patterns.",
  "Inventory existing skills, agents, and commands first so you reuse or extend instead of duplicating.",
  "Use bash for read-only SQLite and filesystem inspection. Do not modify the database.",
  "",
  "For each candidate workflow found:",
  "1. Count how many times it occurred (minimum 2 to qualify)",
  "2. Estimate time saved per occurrence (in seconds)",
  "3. Assess confidence (0-1) based on pattern stability",
  "4. Record the candidate using the skill scoring system",
  "",
  "If any candidate has confidence >= 0.7 and occurred 3+ times,",
  "create the corresponding skill file under .mtycoder/skills/<name>/SKILL.md",
  "with proper YAML frontmatter (name, description, category).",
  "",
  "Produce a compact summary of findings and any skills created.",
].join("\n")

function shouldAutoRun(input: {
  enabled: boolean
  intervalDays: number
  title: string
  label: string
}) {
  return Effect.gen(function* () {
    if (!input.enabled) return false

    const intervalMs = input.intervalDays * DAY_MS

    const lastRun = yield* Effect.sync(() =>
      Database.use((db) =>
        db
          .select({ time_created: SessionTable.time_created })
          .from(SessionTable)
          .where(eq(SessionTable.title, input.title))
          .orderBy(desc(SessionTable.time_created))
          .limit(1)
          .get(),
      ),
    )

    const now = Date.now()
    const elapsed = lastRun ? now - lastRun.time_created : Infinity

    // First time ever: check if the project is old enough to have anything worth consolidating.
    // Look at the earliest top-level session (no parent) as the project start time.
    if (!lastRun) {
      const earliest = yield* Effect.sync(() =>
        Database.use((db) =>
          db
            .select({ time_created: SessionTable.time_created })
            .from(SessionTable)
            .where(isNull(SessionTable.parent_id))
            .orderBy(asc(SessionTable.time_created))
            .limit(1)
            .get(),
        ),
      )
      if (!earliest || now - earliest.time_created < intervalMs) {
        log.info(`auto-${input.label} skipped — project too young`, {
          projectAge: earliest ? Math.round((now - earliest.time_created) / DAY_MS) + "d" : "empty",
          interval: input.intervalDays + "d",
        })
        return false
      }
    }

    if (elapsed < intervalMs) {
      log.info(`auto-${input.label} skipped — last run too recent`, {
        lastRunAgo: Math.round(elapsed / DAY_MS) + "d",
        interval: input.intervalDays + "d",
      })
      return false
    }

    log.info(`auto-${input.label} triggering`, {
      lastRun: lastRun ? new Date(lastRun.time_created).toISOString() : "never",
      interval: input.intervalDays + "d",
    })
    return true
  })
}

export function shouldAutoDream(cfg: Config.Info) {
  const enabled = cfg.dream?.auto !== false
  if (!enabled) return Effect.succeed(false)
  const now = Date.now()
  if (now - lastDreamSpawnTime < MIN_SPAWN_GAP_MS) return Effect.succeed(false)
  lastDreamSpawnTime = now
  const intervalDays = cfg.dream?.interval_days ?? DEFAULT_DREAM_INTERVAL_DAYS
  return shouldAutoRun({ enabled, intervalDays, title: AUTO_DREAM_TITLE, label: "dream" })
}

export function shouldAutoDistill(cfg: Config.Info) {
  const enabled = cfg.distill?.auto !== false
  if (!enabled) return Effect.succeed(false)
  const now = Date.now()
  if (now - lastDistillSpawnTime < MIN_SPAWN_GAP_MS) return Effect.succeed(false)
  lastDistillSpawnTime = now
  const intervalDays = cfg.distill?.interval_days ?? DEFAULT_DISTILL_INTERVAL_DAYS
  return shouldAutoRun({ enabled, intervalDays, title: AUTO_DISTILL_TITLE, label: "distill" })
}

export * as AutoDream from "./auto-dream"
