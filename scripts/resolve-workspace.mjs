#!/usr/bin/env node
import fs from "fs"

const VERSION = "0.1.2"
const pkgs = [
  "packages/script/package.json",
  "packages/shared/package.json",
  "packages/sdk/js/package.json",
  "packages/plugin/package.json",
  "packages/opencode/package.json",
  "packages/ui/package.json",
]

for (const f of pkgs) {
  let content = fs.readFileSync(f, "utf8")
  const before = content
  content = content.replace(/"workspace:\*"/g, `"${VERSION}"`)
  if (content !== before) {
    fs.writeFileSync(f, content, "utf8")
    const count = (before.match(/workspace:\*/g) || []).length
    console.log(`✓ ${f}: replaced ${count} workspace:* refs`)
  } else {
    console.log(`  ${f}: no workspace refs`)
  }
}

console.log("\nDone.")
