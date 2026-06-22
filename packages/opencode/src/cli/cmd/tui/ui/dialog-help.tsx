import { TextAttributes } from "@opentui/core"
import { useTheme } from "@tui/context/theme"
import { useDialog } from "./dialog"
import { useKeyboard } from "@opentui/solid"
import { useKeybind } from "@tui/context/keybind"
import { useLanguage } from "@tui/context/language"
import { For } from "solid-js"

const SECTIONS = [
  {
    titleKey: "Getting Started",
    items: [
      { label: "/connect", desc: "Set up an AI provider (OpenAI, Claude, etc.)" },
      { label: "/init", desc: "Auto-generate project rules for your codebase" },
      { label: "/model", desc: "Switch the active AI model" },
      { label: "Ctrl+P", desc: "Open command palette — see all commands" },
    ],
  },
  {
    titleKey: "Key Shortcuts",
    items: [
      { label: "Tab", desc: "Switch between agents (build / plan / compose)" },
      { label: "Ctrl+C", desc: "Cancel current generation" },
      { label: "Ctrl+X H", desc: "Show this help dialog" },
      { label: "Ctrl+L", desc: "Clear screen" },
      { label: "Ctrl+T", desc: "Toggle thinking mode" },
      { label: "/goal", desc: "Set a stop condition for autonomous work" },
    ],
  },
  {
    titleKey: "Common Commands",
    items: [
      { label: "/session", desc: "List and switch sessions" },
      { label: "/agent", desc: "Manage agents" },
      { label: "/mcp", desc: "Manage MCP servers" },
      { label: "/skill", desc: "Load a skill for specialized workflows" },
      { label: "/doc", desc: "Open documentation in browser" },
      { label: "/compact", desc: "Manually compress conversation context" },
    ],
  },
] as const

export function DialogHelp() {
  const dialog = useDialog()
  const { theme } = useTheme()
  const keybind = useKeybind()
  const t = useLanguage().t

  useKeyboard((evt) => {
    if (evt.name === "return" || evt.name === "escape") {
      dialog.clear()
    }
  })

  return (
    <box paddingLeft={2} paddingRight={2} gap={1} maxHeight={35}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme.text}>
          {t("tui.command.help.show.title")}
        </text>
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
          {t("tui.dialog.help.close_hint")}
        </text>
      </box>

      <box flexDirection="row" justifyContent="space-between" paddingBottom={1}>
        <text fg={theme.textMuted}>
          {t("tui.dialog.help.command_list", { keybind: keybind.print("command_list") })}
        </text>
      </box>

      <For each={SECTIONS}>
        {(section) => (
          <box flexDirection="column" paddingBottom={1}>
            <text attributes={TextAttributes.BOLD} fg={theme.primary}>
              {section.titleKey}
            </text>
            <For each={section.items}>
              {(item) => (
                <box flexDirection="row" paddingLeft={1}>
                  <text fg={theme.text} width={14}>
                    {item.label}
                  </text>
                  <text fg={theme.textMuted}>{item.desc}</text>
                </box>
              )}
            </For>
          </box>
        )}
      </For>

      <box flexDirection="row" justifyContent="flex-end" paddingTop={1} paddingBottom={1}>
        <box paddingLeft={3} paddingRight={3} backgroundColor={theme.primary} onMouseUp={() => dialog.clear()}>
          <text fg={theme.selectedListItemText}>{t("tui.dialog.help.ok")}</text>
        </box>
      </box>
    </box>
  )
}
