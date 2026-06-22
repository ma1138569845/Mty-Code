#!/usr/bin/env node
import fs from "fs"
import path from "path"

const rootPkg = JSON.parse(fs.readFileSync("package.json", "utf8"))
const catalog = rootPkg.workspaces?.catalog || {}

const packages = [
  "packages/script/package.json",
  "packages/shared/package.json",
  "packages/sdk/js/package.json",
  "packages/plugin/package.json",
  "packages/opencode/package.json",
  "packages/ui/package.json",
]

for (const pkgPath of packages) {
  if (!fs.existsSync(pkgPath)) continue
  const content = fs.readFileSync(pkgPath, "utf8")
  let modified = content
  let count = 0

  for (const [name, version] of Object.entries(catalog)) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const regex = new RegExp(`"${escaped}":\\s*"catalog:"`, "g")
    if (regex.test(modified)) {
      modified = modified.replace(regex, `"${name}": "${version}"`)
      count++
    }
  }

  if (count > 0) {
    fs.writeFileSync(pkgPath, modified, "utf8")
    console.log(`✓ ${pkgPath}: replaced ${count} catalog refs`)
  } else {
    console.log(`  ${pkgPath}: no catalog refs`)
  }
}

console.log("\nDone. Remember to revert changes after publishing.")
