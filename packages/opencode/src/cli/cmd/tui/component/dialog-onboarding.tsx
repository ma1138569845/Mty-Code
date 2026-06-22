import { createSignal, Show } from "solid-js"
import { TextAttributes } from "@opentui/core"
import { useTheme } from "@tui/context/theme"
import { useDialog } from "@tui/ui/dialog"
import { useKeyboard } from "@opentui/solid"
import { useLanguage } from "@tui/context/language"
import { useSync } from "@tui/context/sync"
import { DialogSelect } from "@tui/ui/dialog-select"
import { DialogProvider } from "./dialog-provider"

type OnboardingStep = "welcome" | "done"

export function DialogOnboarding() {
  const dialog = useDialog()
  const { theme } = useTheme()
  const t = useLanguage().t
  const sync = useSync()
  const [step, setStep] = createSignal<OnboardingStep>("welcome")

  useKeyboard((evt) => {
    if (evt.name === "escape") {
      dialog.clear()
    }
  })

  const connected = () => sync.data.provider_next.connected.length > 0

  return (
    <box paddingLeft={2} paddingRight={2} gap={1} maxHeight={30}>
      <Show when={step() === "welcome"}>
        <WelcomeStep
          onConnect={() => {
            dialog.replace(() => <DialogProvider />)
          }}
          onSkip={() => dialog.clear()}
          connected={connected()}
        />
      </Show>
    </box>
  )
}

function WelcomeStep(props: { onConnect: () => void; onSkip: () => void; connected: boolean }) {
  const { theme } = useTheme()

  return (
    <box flexDirection="column" gap={1}>
      <text attributes={TextAttributes.BOLD} fg={theme.text} paddingBottom={1}>
        Welcome to MtyCoder
      </text>

      <text fg={theme.textMuted} paddingBottom={1}>
        MtyCoder is an AI-powered coding assistant that runs in your terminal.
      </text>

      <text fg={theme.textMuted}>
        To get started, connect an AI provider. You can use a free model
      </text>
      <text fg={theme.textMuted} paddingBottom={1}>
        or bring your own API key from OpenAI, Anthropic, Google, and more.
      </text>

      <Show when={!props.connected}>
        <box flexDirection="column" paddingTop={1} gap={0}>
          <text attributes={TextAttributes.BOLD} fg={theme.primary}>
            Quick Start:
          </text>
          <box flexDirection="row" paddingLeft={1}>
            <text fg={theme.text}>1. Run </text>
            <text fg={theme.primary}> /connect </text>
            <text fg={theme.textMuted}>to set up an AI provider</text>
          </box>
          <box flexDirection="row" paddingLeft={1}>
            <text fg={theme.text}>2. Or just start typing to use the default model</text>
          </box>
        </box>
      </Show>

      <Show when={props.connected}>
        <box flexDirection="row" paddingTop={1}>
          <text fg={theme.success}>✓ Provider connected. You're ready to go!</text>
        </box>
      </Show>

      <box flexDirection="row" justifyContent="flex-end" paddingTop={2} gap={2}>
        <box paddingLeft={3} paddingRight={3} backgroundColor={theme.surface1} onMouseUp={props.onSkip}>
          <text fg={theme.textMuted}>{props.connected ? "Close" : "Skip"}</text>
        </box>
        <Show when={!props.connected}>
          <box paddingLeft={3} paddingRight={3} backgroundColor={theme.primary} onMouseUp={props.onConnect}>
            <text fg={theme.selectedListItemText}>Connect Provider</text>
          </box>
        </Show>
      </box>
    </box>
  )
}
