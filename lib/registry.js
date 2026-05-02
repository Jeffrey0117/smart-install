import fs from "fs"
import path from "path"

// Known packages with native binaries that need special postinstall handling.
// Each entry defines how to manually install the binary and how to verify it worked.

const isWin = process.platform === "win32"

export const BINARY_PACKAGES = {
  electron: {
    install: "node node_modules/electron/install.js",
    verify: isWin
      ? "node_modules/electron/dist/electron.exe"
      : "node_modules/electron/dist/electron",
  },

  esbuild: {
    install: "node node_modules/esbuild/install.js",
    verify: isWin
      ? "node_modules/@esbuild/win32-x64/esbuild.exe"
      : "node_modules/esbuild/bin/esbuild",
  },

  "@swc/core": {
    install: "node node_modules/@swc/core/postinstall.js",
    verify: null,
  },

  sharp: {
    install: "node node_modules/sharp/install/check.js",
    verify: null,
  },

  puppeteer: {
    install: "node node_modules/puppeteer/install.mjs",
    verify: null,
  },

  "better-sqlite3": {
    install: "npx node-gyp rebuild",
    verify: "node_modules/better-sqlite3/build/Release/better_sqlite3.node",
    cwd: "node_modules/better-sqlite3",
  },

  canvas: {
    install: "npx node-gyp rebuild",
    verify: "node_modules/canvas/build/Release/canvas.node",
    cwd: "node_modules/canvas",
  },

  libsql: {
    install: "node node_modules/libsql/install.js",
    verify: null,
  },
}

/**
 * Scan node_modules and return which registered binary packages are installed
 */
export function detectBinaryPackages(projectDir) {
  const found = []

  for (const [name, config] of Object.entries(BINARY_PACKAGES)) {
    const pkgJson = path.join(projectDir, "node_modules", name, "package.json")
    if (fs.existsSync(pkgJson)) {
      found.push({ name, ...config })
    }
  }

  return found
}
