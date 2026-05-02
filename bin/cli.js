#!/usr/bin/env node

import { smartInstall, verifyInstall } from "../index.js"

const args = process.argv.slice(2)
const cmd = args[0]

if (cmd === "--help" || cmd === "-h") {
  console.log(`
  smart-install - Resilient npm install for native binary packages

  Usage:
    smart-install [dir]        Install deps with auto-recovery
    smart-install verify [dir] Check if all binaries are installed
    smart-install --help       Show this help

  Examples:
    smart-install              Install in current directory
    smart-install ./my-app     Install in ./my-app
    smart-install verify       Verify binaries in current directory
`)
  process.exit(0)
}

if (cmd === "verify") {
  const dir = args[1] || "."
  const results = verifyInstall(dir)

  if (results.length === 0) {
    console.log("No native binary packages detected.")
    process.exit(0)
  }

  for (const r of results) {
    const icon = r.ok ? "ok" : "MISSING"
    console.log(`  ${r.name}: ${icon}`)
  }

  const allOk = results.every((r) => r.ok)
  process.exit(allOk ? 0 : 1)
}

// Default: install
const dir = cmd || "."
const result = smartInstall(dir)

if (!result.ok) {
  console.error(`\nFailed: ${result.failed.join(", ")}`)
  process.exit(1)
}
