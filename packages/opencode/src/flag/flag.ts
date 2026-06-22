import { Config } from "effect"

function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

function falsy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "false" || value === "0"
}

function number(key: string) {
  const value = process.env[key]
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

const MTYCODER_EXPERIMENTAL = truthy("MTYCODER_EXPERIMENTAL")

// Defaults to false. When enabled, mtycoder runs in pure-mty mode:
//   — does NOT inherit Claude Code's settings (CLAUDE.md, ~/.claude/skills, etc.)
//   — does NOT pick up provider API keys from environment variables
//   — falls back to the mty-auto model as the default
// Set MTYCODER_MIMO_ONLY=true to disable .claude inheritance and env-based
// provider auto-detection.
const MTYCODER_MIMO_ONLY = truthy("MTYCODER_MIMO_ONLY")
const MTYCODER_DISABLE_CLAUDE_CODE_ENV = truthy("MTYCODER_DISABLE_CLAUDE_CODE")
const MTYCODER_DISABLE_CLAUDE_CODE = MTYCODER_MIMO_ONLY || MTYCODER_DISABLE_CLAUDE_CODE_ENV

const MTYCODER_DISABLE_EXTERNAL_SKILLS = truthy("MTYCODER_DISABLE_EXTERNAL_SKILLS")
const MTYCODER_DISABLE_CLAUDE_CODE_SKILLS =
  MTYCODER_DISABLE_EXTERNAL_SKILLS || MTYCODER_DISABLE_CLAUDE_CODE || truthy("MTYCODER_DISABLE_CLAUDE_CODE_SKILLS")
const copy = process.env["MTYCODER_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"]

export const Flag = {
  OTEL_EXPORTER_OTLP_ENDPOINT: process.env["OTEL_EXPORTER_OTLP_ENDPOINT"],
  OTEL_EXPORTER_OTLP_HEADERS: process.env["OTEL_EXPORTER_OTLP_HEADERS"],

  MTYCODER_AUTO_SHARE: truthy("MTYCODER_AUTO_SHARE"),
  MTYCODER_AUTO_HEAP_SNAPSHOT: truthy("MTYCODER_AUTO_HEAP_SNAPSHOT"),
  MTYCODER_GIT_BASH_PATH: process.env["MTYCODER_GIT_BASH_PATH"],
  MTYCODER_CONFIG: process.env["MTYCODER_CONFIG"],
  MTYCODER_CONFIG_CONTENT: process.env["MTYCODER_CONFIG_CONTENT"],

  MTYCODER_DISABLE_AUTOUPDATE: truthy("MTYCODER_DISABLE_AUTOUPDATE"),

  // Defaults to true (analytics enabled). Set MTYCODER_ENABLE_ANALYSIS=false
  // to opt out of POSTing model_call/tool_call/agent_request metrics.
  MTYCODER_ENABLE_ANALYSIS: !falsy("MTYCODER_ENABLE_ANALYSIS"),
  MTYCODER_ALWAYS_NOTIFY_UPDATE: truthy("MTYCODER_ALWAYS_NOTIFY_UPDATE"),
  MTYCODER_DISABLE_PRUNE: truthy("MTYCODER_DISABLE_PRUNE"),
  MTYCODER_DISABLE_TERMINAL_TITLE: truthy("MTYCODER_DISABLE_TERMINAL_TITLE"),
  MTYCODER_SHOW_TTFD: truthy("MTYCODER_SHOW_TTFD"),
  MTYCODER_PERMISSION: process.env["MTYCODER_PERMISSION"],
  MTYCODER_DISABLE_DEFAULT_PLUGINS: truthy("MTYCODER_DISABLE_DEFAULT_PLUGINS"),
  MTYCODER_DISABLE_LSP_DOWNLOAD: truthy("MTYCODER_DISABLE_LSP_DOWNLOAD"),
  MTYCODER_ENABLE_EXPERIMENTAL_MODELS: truthy("MTYCODER_ENABLE_EXPERIMENTAL_MODELS"),
  MTYCODER_DISABLE_AUTOCOMPACT: truthy("MTYCODER_DISABLE_AUTOCOMPACT"),
  MTYCODER_DISABLE_MODELS_FETCH: truthy("MTYCODER_DISABLE_MODELS_FETCH"),
  MTYCODER_DISABLE_MOUSE: truthy("MTYCODER_DISABLE_MOUSE"),
  MTYCODER_OUTPUT_LENGTH_CONTINUATION_LIMIT: number("MTYCODER_OUTPUT_LENGTH_CONTINUATION_LIMIT") ?? 3,
  MTYCODER_INVALID_OUTPUT_CONTINUATION_LIMIT: number("MTYCODER_INVALID_OUTPUT_CONTINUATION_LIMIT") ?? 2,

  // Caps applied to image attachments before a prompt is sent. Both default to
  // undefined (no limit). MTYCODER_MAX_PROMPT_IMAGES bounds how many images may
  // be sent per request (oldest excess images are dropped); MTYCODER_MAX_PROMPT_IMAGE_SIZE
  // bounds the decoded byte size of a single image. Values must be positive integers.
  MTYCODER_MAX_PROMPT_IMAGES: number("MTYCODER_MAX_PROMPT_IMAGES"),
  MTYCODER_MAX_PROMPT_IMAGE_SIZE: number("MTYCODER_MAX_PROMPT_IMAGE_SIZE"),
  MTYCODER_MIMO_ONLY,
  MTYCODER_DISABLE_PROVIDER_ENV: MTYCODER_MIMO_ONLY || truthy("MTYCODER_DISABLE_PROVIDER_ENV"),
  MTYCODER_DISABLE_CLAUDE_CODE,
  get MTYCODER_DISABLE_CLAUDE_CODE_MCP() {
    // MCP compatibility stays on in mty-only mode so users can reuse Claude Code
    // MCP servers without inheriting prompts, skills, or provider env keys.
    return MTYCODER_DISABLE_CLAUDE_CODE_ENV || truthy("MTYCODER_DISABLE_CLAUDE_CODE_MCP")
  },
  MTYCODER_DISABLE_CLAUDE_CODE_PROMPT: MTYCODER_DISABLE_CLAUDE_CODE || truthy("MTYCODER_DISABLE_CLAUDE_CODE_PROMPT"),
  // Defaults to false (enabled): markdown commands under ~/.claude/commands and
  // {project}/.claude/commands load as slash commands. Independent of the
  // mty-only master switch. Set MTYCODER_DISABLE_CLAUDE_CODE_COMMANDS=true to disable.
  MTYCODER_DISABLE_CLAUDE_CODE_COMMANDS: truthy("MTYCODER_DISABLE_CLAUDE_CODE_COMMANDS"),
  MTYCODER_DISABLE_CLAUDE_CODE_SKILLS,
  MTYCODER_DISABLE_EXTERNAL_SKILLS,
  MTYCODER_DISABLE_CODEX_SKILLS: MTYCODER_DISABLE_EXTERNAL_SKILLS || truthy("MTYCODER_DISABLE_CODEX_SKILLS"),
  MTYCODER_DISABLE_OPENCODE_SKILLS: MTYCODER_DISABLE_EXTERNAL_SKILLS || truthy("MTYCODER_DISABLE_OPENCODE_SKILLS"),
  MTYCODER_FAKE_VCS: process.env["MTYCODER_FAKE_VCS"],

  // When enabled, skips all git subprocess calls during project discovery
  // (which git, rev-parse --git-common-dir, rev-parse --show-toplevel) and
  // branch detection. The project is treated as a non-git directory rooted at
  // the working directory. Use to avoid touching git in restricted/sandboxed
  // environments or where git startup probing is undesirable.
  MTYCODER_DISABLE_GIT: truthy("MTYCODER_DISABLE_GIT"),
  MTYCODER_SERVER_PASSWORD: process.env["MTYCODER_SERVER_PASSWORD"],
  MTYCODER_SERVER_USERNAME: process.env["MTYCODER_SERVER_USERNAME"],
  MTYCODER_ENABLE_QUESTION_TOOL: truthy("MTYCODER_ENABLE_QUESTION_TOOL"),

  // Experimental
  MTYCODER_EXPERIMENTAL,
  MTYCODER_EXPERIMENTAL_FILEWATCHER: Config.boolean("MTYCODER_EXPERIMENTAL_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  MTYCODER_EXPERIMENTAL_DISABLE_FILEWATCHER: Config.boolean("MTYCODER_EXPERIMENTAL_DISABLE_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  MTYCODER_EXPERIMENTAL_ICON_DISCOVERY: MTYCODER_EXPERIMENTAL || truthy("MTYCODER_EXPERIMENTAL_ICON_DISCOVERY"),
  MTYCODER_EXPERIMENTAL_DISABLE_COPY_ON_SELECT:
    copy === undefined ? process.platform === "win32" : truthy("MTYCODER_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"),
  MTYCODER_ENABLE_EXA: truthy("MTYCODER_ENABLE_EXA") || MTYCODER_EXPERIMENTAL || truthy("MTYCODER_EXPERIMENTAL_EXA"),
  MTYCODER_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS: number("MTYCODER_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS"),
  MTYCODER_EXPERIMENTAL_OUTPUT_TOKEN_MAX: number("MTYCODER_EXPERIMENTAL_OUTPUT_TOKEN_MAX"),
  MTYCODER_EXPERIMENTAL_OXFMT: MTYCODER_EXPERIMENTAL || truthy("MTYCODER_EXPERIMENTAL_OXFMT"),
  MTYCODER_EXPERIMENTAL_LSP_TY: truthy("MTYCODER_EXPERIMENTAL_LSP_TY"),
  MTYCODER_EXPERIMENTAL_LSP_TOOL: MTYCODER_EXPERIMENTAL || truthy("MTYCODER_EXPERIMENTAL_LSP_TOOL"),
  // Defaults to true: dynamic workflow + built-in deep-research are on by default.
  // Set MTYCODER_EXPERIMENTAL_WORKFLOW_TOOL=false to opt out. The env-var name is
  // kept for backwards compat (long-running experiments still pass it as `1`).
  MTYCODER_EXPERIMENTAL_WORKFLOW_TOOL: !falsy("MTYCODER_EXPERIMENTAL_WORKFLOW_TOOL"),
  MTYCODER_EXPERIMENTAL_MARKDOWN: !falsy("MTYCODER_EXPERIMENTAL_MARKDOWN"),
  MTYCODER_MODELS_URL: process.env["MTYCODER_MODELS_URL"],
  MTYCODER_MODELS_PATH: process.env["MTYCODER_MODELS_PATH"],
  MTYCODER_DISABLE_EMBEDDED_WEB_UI: truthy("MTYCODER_DISABLE_EMBEDDED_WEB_UI"),
  MTYCODER_DB: process.env["MTYCODER_DB"],

  // Defaults to true — all channels share a single mtycoder.db. The per-channel
  // DB isolation (mtycoder-{channel}.db) is unnecessary for mtycoder since we
  // don't ship multiple release channels yet. Use MTYCODER_HOME to isolate dev
  // environments instead. Set MTYCODER_DISABLE_CHANNEL_DB=false to restore
  // per-channel isolation.
  MTYCODER_DISABLE_CHANNEL_DB: !falsy("MTYCODER_DISABLE_CHANNEL_DB"),
  MTYCODER_SKIP_MIGRATIONS: truthy("MTYCODER_SKIP_MIGRATIONS"),
  MTYCODER_STRICT_CONFIG_DEPS: truthy("MTYCODER_STRICT_CONFIG_DEPS"),

  MTYCODER_WORKSPACE_ID: process.env["MTYCODER_WORKSPACE_ID"],
  MTYCODER_EXPERIMENTAL_HTTPAPI: truthy("MTYCODER_EXPERIMENTAL_HTTPAPI"),
  MTYCODER_EXPERIMENTAL_WORKSPACES: MTYCODER_EXPERIMENTAL || truthy("MTYCODER_EXPERIMENTAL_WORKSPACES"),

  // Evaluated at access time (not module load) because tests, the CLI, and
  // external tooling set these env vars at runtime.
  get MTYCODER_DISABLE_COMPOSE_SKILLS() {
    return truthy("MTYCODER_DISABLE_COMPOSE_SKILLS")
  },
  get MTYCODER_DISABLE_PROJECT_CONFIG() {
    return truthy("MTYCODER_DISABLE_PROJECT_CONFIG")
  },
  get MTYCODER_TUI_CONFIG() {
    return process.env["MTYCODER_TUI_CONFIG"]
  },
  get MTYCODER_CONFIG_DIR() {
    return process.env["MTYCODER_CONFIG_DIR"]
  },
  get MTYCODER_HOME() {
    return process.env["MTYCODER_HOME"]
  },
  get MTYCODER_PURE() {
    return truthy("MTYCODER_PURE")
  },
  get MTYCODER_PLUGIN_META_FILE() {
    return process.env["MTYCODER_PLUGIN_META_FILE"]
  },
  get MTYCODER_CLIENT() {
    return process.env["MTYCODER_CLIENT"] ?? "cli"
  },
}
