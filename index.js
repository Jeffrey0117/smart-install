import { execSync } from "child_process"
import fs from "fs"
import path from "path"
import { detectBinaryPackages } from "./lib/registry.js"

/**
 * Smart install - resilient npm install with automatic binary recovery
 *
 * @param {string} dir - Project directory (default: cwd)
 * @param {object} opts
 * @param {boolean} opts.silent - Suppress output (default: false)
 * @param {string} opts.packageManager - Force pm: "npm" | "pnpm" | "yarn" (default: auto-detect)
 * @returns {{ ok: boolean, recovered: string[], failed: string[], report: string[] }}
 */
export function smartInstall(dir, opts = {}) {
  const projectDir = path.resolve(dir || process.cwd())
  const silent = opts.silent || false
  const stdio = silent ? "ignore" : "inherit"

  const pm = opts.packageManager || detectPM(projectDir)
  const installCmd = pm === "pnpm" ? "pnpm install" : pm === "yarn" ? "yarn install" : "npm install"

  const report = []
  const recovered = []
  const failed = []

  function log(msg) {
    report.push(msg)
    if (!silent) console.log(msg)
  }

  // Step 1: Try normal install
  log(`[smart-install] ${installCmd}`)
  try {
    execSync(installCmd, { cwd: projectDir, stdio })
    // Normal install succeeded, but still verify binaries
    const binaries = detectBinaryPackages(projectDir)
    const missing = binaries.filter((b) => b.verify && !fs.existsSync(path.join(projectDir, b.verify)))

    if (missing.length === 0) {
      log("[smart-install] done")
      return { ok: true, recovered, failed, report }
    }

    // Some binaries missing despite install "succeeding"
    log(`[smart-install] missing binaries: ${missing.map((b) => b.name).join(", ")}`)
    for (const bin of missing) {
      const ok = runBinaryInstall(projectDir, bin, stdio)
      if (ok) {
        recovered.push(bin.name)
        log(`[smart-install] ${bin.name} binary recovered`)
      } else {
        failed.push(bin.name)
        log(`[smart-install] ${bin.name} binary FAILED`)
      }
    }

    return { ok: failed.length === 0, recovered, failed, report }
  } catch {
    // Step 2: Normal install failed, retry without scripts
    log(`[smart-install] failed, retrying with --ignore-scripts`)
  }

  try {
    execSync(`${installCmd} --ignore-scripts`, { cwd: projectDir, stdio })
  } catch (err) {
    log(`[smart-install] --ignore-scripts also failed: ${err.message}`)
    return { ok: false, recovered, failed: ["npm-install"], report }
  }

  // Step 3: Manually install all detected binary packages
  const binaries = detectBinaryPackages(projectDir)
  if (binaries.length === 0) {
    log("[smart-install] done (no binaries to recover)")
    return { ok: true, recovered, failed, report }
  }

  log(`[smart-install] recovering ${binaries.length} binary packages...`)

  for (const bin of binaries) {
    const ok = runBinaryInstall(projectDir, bin, stdio)
    if (ok) {
      recovered.push(bin.name)
      log(`[smart-install] ${bin.name} recovered`)
    } else {
      failed.push(bin.name)
      log(`[smart-install] ${bin.name} FAILED`)
    }
  }

  const allOk = failed.length === 0
  log(`[smart-install] ${allOk ? "done" : "done with errors"}`)

  return { ok: allOk, recovered, failed, report }
}

/**
 * Verify a project's binary packages are all installed correctly
 */
export function verifyInstall(dir) {
  const projectDir = path.resolve(dir || process.cwd())
  const binaries = detectBinaryPackages(projectDir)
  const results = []

  for (const bin of binaries) {
    const verified = bin.verify
      ? fs.existsSync(path.join(projectDir, bin.verify))
      : null // can't verify, assume ok
    results.push({ name: bin.name, ok: verified !== false })
  }

  return results
}

function runBinaryInstall(projectDir, bin, stdio) {
  try {
    const cwd = bin.cwd ? path.join(projectDir, bin.cwd) : projectDir
    execSync(bin.install, { cwd, stdio, timeout: 120_000 })

    // Verify if possible
    if (bin.verify) {
      return fs.existsSync(path.join(projectDir, bin.verify))
    }
    return true
  } catch {
    return false
  }
}

function detectPM(projectDir) {
  if (fs.existsSync(path.join(projectDir, "pnpm-lock.yaml"))) return "pnpm"
  if (fs.existsSync(path.join(projectDir, "yarn.lock"))) return "yarn"
  return "npm"
}
