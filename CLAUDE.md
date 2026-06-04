# smart-install

Resilient npm/pnpm/yarn install that auto-recovers from postinstall failures in native binary packages (electron, sharp, esbuild, etc.).

## Stack
- Node.js, pure ESM (`"type": "module"`), zero runtime dependencies
- Ships as both a library (`smartInstall`, `verifyInstall` exports) and a CLI (`bin/smart-install`)
- `child_process.execSync` to drive the package manager and per-package install scripts

## Directory structure

```
index.js        ← Core: smartInstall() + verifyInstall(), PM detection, binary recovery
bin/cli.js      ← CLI entry (install / verify / --help), shebang, exit codes
lib/registry.js ← BINARY_PACKAGES registry + detectBinaryPackages() scanner
package.json
```

`files` whitelist (published to npm): `index.js`, `bin/cli.js`, `lib/registry.js`.

## Key concepts

- **3-step install fallback** (`smartInstall` in `index.js`):
  1. Run normal `<pm> install`. If it succeeds, still verify binaries; recover any missing ones.
  2. On failure, retry with `--ignore-scripts` (skips the postinstall that broke).
  3. Manually run each detected binary package's install script, then verify.
- **Binary registry** (`lib/registry.js`): `BINARY_PACKAGES` maps a package name to `{ install, verify, cwd? }`.
  - `install` — command to run to build/fetch the native binary.
  - `verify` — path that must exist after install (platform-aware via `isWin`); `null` means "can't verify, assume ok".
  - `cwd` — optional subdir (e.g. node-gyp rebuilds run inside the package dir).
  - Currently covers: electron, esbuild, @swc/core, sharp, puppeteer, better-sqlite3, canvas, libsql.
- **Detection** (`detectBinaryPackages`): scans `node_modules/<name>/package.json` existence; only registered packages are recovered.
- **PM auto-detect** (`detectPM`): `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, else npm. Overridable via `opts.packageManager`.
- **Return shape**: `{ ok, recovered: string[], failed: string[], report: string[] }`. CLI maps `ok` to exit code 0/1; binary install has a 120s timeout.
- **`opts.silent`**: suppresses console output (stdio `ignore`) but still fills `report`.

## Commands

```bash
node bin/cli.js [dir]            # install with auto-recovery (default: cwd)
node bin/cli.js verify [dir]     # check installed binaries; exit 1 if any missing
node bin/cli.js --help           # usage
smart-install [dir]              # same, once installed/linked (bin name)
npm test                         # NOTE: references test.js which does not exist yet
```

To add a new native package: add an entry to `BINARY_PACKAGES` in `lib/registry.js` with its `install`, `verify`, and optional `cwd`.

## Coding rules
- Pure ESM with `import`; keep zero runtime dependencies.
- No-throw recovery: `runBinaryInstall` swallows errors and returns a boolean; aggregate results into `recovered`/`failed` rather than throwing.
- Platform-aware verify paths (branch on `process.platform === "win32"`).
- Respect the `silent` flag — route all output through the local `log()` helper.
