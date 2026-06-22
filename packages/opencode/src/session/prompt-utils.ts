import { MessageV2 } from "./message-v2"
import type { ToolStyleConfig } from "../tool/invocation-style"
import { resolveInvocationStyle } from "../tool/invocation-style"

// Recall-reminder hints, rendered in each tool's configured invocation style so
// shell-mode sessions never see a JSON-shaped example.
export function recallHintLines(toolCfg: ToolStyleConfig | undefined): string[] {
  const taskHint =
    resolveInvocationStyle(toolCfg, "task") === "shell" ? "- task list" : `- task({ operation: "list" })`
  const actorHint =
    resolveInvocationStyle(toolCfg, "actor") === "shell"
      ? "- actor status <actor_id>"
      : `- actor({ operation: "status", actor_id: "<id>" })`
  const memoryHint = `- memory({ operation: "search", query: "<keywords>" })`

  return [
    "If you are unsure what has been done so far or what remains, check task progress before starting new work:",
    taskHint,
    "Never redo work a task already records as done; if the list shows it, read it first.",
    "",
    "If a previous turn spawned background actors, check their status before assuming they finished:",
    actorHint,
    "",
    "For durable cross-session knowledge, query memory before acting on assumptions:",
    memoryHint,
  ]
}

// Stable JSON stringify (sorted keys) for consistent comparison
export function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "null"
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort()
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(",")}}`
  }
  return String(value)
}

// Generate a signature for a set of parts to detect repeated patterns
export function stepSignature(parts: MessageV2.Part[]): string | undefined {
  const tools = parts.filter((p) => p.type === "tool" && p.state.status !== "pending")
  if (tools.length === 0) return undefined
  return tools
    .map((p) => {
      if (p.type !== "tool") return ""
      const input = stableStringify(p.state.input)
      return `${p.tool}:${input}`
    })
    .join("|")
}

// Check if a file path is an extension/plugin file
export function isExtensionPath(filePath: string): boolean {
  return filePath.includes(".mtycoder/") || filePath.includes(".claude/") || filePath.includes(".opencode/")
}
