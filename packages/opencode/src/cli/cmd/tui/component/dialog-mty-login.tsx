import { useDialog } from "@tui/ui/dialog"
import { useLanguage } from "../context/language"
import { DialogSelect } from "@tui/ui/dialog-select"

export function DialogMtyLogin() {
  const dialog = useDialog()
  const { t } = useLanguage()

  return (
    <DialogSelect
      title={t("tui.dialog.login.title")}
      skipFilter
      options={[
        {
          label: "MtyCoder",
          value: "mtycoder",
          hint: t("tui.dialog.login.mtycoder.desc"),
        },
      ]}
      onSelect={(choice) => {
        if (choice === "mtycoder") {
          dialog.close()
        }
      }}
    />
  )
}
