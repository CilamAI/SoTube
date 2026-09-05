## 1. Project Overview

**SoTube** is a high-performance, minimalist desktop client built with:
- **Runtime**: [Electron](https://www.electronjs.org/) (`^44.1.1`) and [Node.js](https://nodejs.org/) (`v24.x`).
- **Package Manager / Tooling**: Compatible with both **npm** and **[Bun](https://bun.sh/)**.
- **Packaging & Distribution**: [Inno Setup 6](https://jrsoftware.org/isdl.php) producing a standalone Windows installer (`dist/SoTubeSetup.exe`).
- **License**: Apache License 2.0 (see [LICENSE.txt](file:///c:/Users/omg/SoTube/LICENSE.txt)).

---

## 2. Directory Structure

```text
SoTube/
├── .github/               # GitHub Actions CI/CD workflows and community templates
│   ├── workflows/         # ci.yml and release.yml pipelines
│   └── ISSUE_TEMPLATE/    # Bug report and feature request templates
├── .vscode/               # Editor configurations, debug launch targets, and tasks
├── api/                   # Electron IPC bridge and contextBridge definitions
│   ├── preload.js         # Renderer bridge API
│   └── index.js           # API entry point
├── convertapi/            # Media download, stream analysis, and conversion engine
│   ├── binaries/          # Executable & dependency discovery (yt-dlp, ffmpeg, node)
│   ├── storage/           # Download directories, folder opening, and media-stream protocol
│   ├── search/            # YouTube search scraping & extraction
│   ├── trim/              # Video & audio trimming engine
│   ├── download/          # Media downloader, converter & cancellation manager
│   └── index.js           # Convert API router, aggregator & unified IPC handlers
├── assets/                # Application icon, logo, and Inno Setup wizard bitmaps
├── locales/               # Internationalization dictionaries (7 languages)
├── pages/                 # UI HTML templates (index.html, splash.html, tray.html)
├── settings/              # Application settings and default configuration
├── scripts/               # Automation, build, and development scripts
├── dist/                  # Packaging outputs and installer binaries
├── installer.iss          # Inno Setup 6 compiler script
├── main.js                # Electron main process entry point
├── preload.js             # Root preload forwarder
├── renderer.js            # Frontend logic and DOM controllers
├── styles.css             # Unified stylesheet and theme variables
├── package.json           # Dependencies and project scripts
├── package-lock.json      # NPM lockfile
├── bun.lock               # Bun text-based lockfile (v1.2+)
├── bunfig.toml            # Bun package manager configuration
├── install.ps1            # Automated Windows PowerShell environment installer
├── sst.config.ts          # SST Ion cloud distribution and releases configuration
├── tsconfig.json          # TypeScript compiler configuration
├── README.md              # Project documentation and badges
└── LICENSE.txt            # Apache 2.0 license and third-party notices
```

---

## 3. Core Architecture & Conventions

### Main Process & Window Lifecycle (`main.js`)
- **Single Instance Lock**: Ensures only one instance runs at a time via `app.requestSingleInstanceLock()`.
- **System Tray**: Left-clicking or right-clicking the tray icon opens the custom Windows 11 HTML tray flyout (`pages/tray.html`) with **Open/Hide SoTube**, **Open Downloads**, and **Close SoTube**.
- **Quit Confirmation Dialog**: Closing the window hides to tray; selecting **Close SoTube** triggers a native confirmation dialog box (`Are you sure you want to quit SoTube?`).
- **Preload Resolution**: Always use `getPreloadPath()` which resolves `api/preload.js` with fallback to `preload.js`.

### API & IPC Communication (`api/`)
- Always expose renderer functionality securely via `contextBridge.exposeInMainWorld('electronAPI', { ... })`.
- Keep `preload.js` at root as a lightweight forwarder: `require('./api/preload.js')`.

### Automation Scripts (`scripts/`)
- Place all automation, build, and test scripts inside `scripts/`.
- Standardize console logs using ANSI color badges:
  - `ℹ [INFO]` (Cyan)
  - `✔ [SUCCESS]` (Green)
  - `⚠ [WARNING]` (Yellow)
  - `✖ [ERROR]` (Red)
- Omit redundant inline comments and superfluous description metadata in automated scripts unless explicitly required by the user.

### Inno Setup Installer (`installer.iss` & `scripts/build-inno.js`)
- Output base executable name must always be `SoTubeSetup` (`dist/SoTubeSetup.exe`).
- License file directive under `[Setup]` must use `LicenseFile=LICENSE.txt`.
- Required assets for compilation:
  - `assets/icon.ico`
  - `assets/sidebar.bmp` (164x314)
  - `assets/icon.bmp` (55x58)
  - `LICENSE.txt`

---

## 4. NPM & Bun Scripts

| Script | Command | Purpose |
|---|---|---|
| `npm start` / `bun run start` | `electron .` | Launch the desktop app |
| `npm run dev` / `bun run dev` | `node scripts/watch.js` / `bun run watch` | Live file watcher and automatic app restarter |
| `npm run watch` / `bun run watch` | `node scripts/watch.js` | Alias for live file watcher |
| `npm run dist:dir` | `node scripts/build.js` | Build unpacked binaries into `dist/win-unpacked` (with pre-build cleanup) |
| `npm run dev:inno` / `build:inno` | `node scripts/build-inno.js` | Compile Windows Inno Setup installer |
| `npm run test` / `bun run test` | `node scripts/test.js` | Execute automated validation suite |
| `npm run check` | `node scripts/check.js` | Verify icon assets, headers, dimensions, and config with warning/info/error badges |
| `npm run typecheck` | `tsc --noEmit` | Execute TypeScript typechecking without emitting build output |
| `npm run postinstall` | `node scripts/postinstall.js` | Asset verification & electron-builder patch |
| `npm run dev:stats` | `node scripts/stats.js` | Display lines of code and asset footprint metrics |
| `npm run info` | `node scripts/info.js` | Print hardware, OS, and runtime diagnostics |
| `npm run bun` | `node scripts/bun.js` | Bun environment diagnostics and runner |
| `npm run install:ps1` | `powershell -File install.ps1` | Automated Windows PowerShell installer |

---

## 5. Development & Testing Rules for AI Agents

1. **Test Verification**:
   Always run `node scripts/test.js` after introducing modifications to confirm that all test assertions pass.
2. **Path Resolution**:
   Always use `path.resolve(__dirname, '..')` or relative paths when referencing workspace roots to ensure cross-platform compatibility.
3. **Sandbox Execution Note**:
   In constrained sandboxes where direct `node` binary execution is unavailable, invoke scripts via the bundled Electron binary:
   ```powershell
   $env:ELECTRON_RUN_AS_NODE=1; & ".\node_modules\electron\dist\electron.exe" scripts/<script-name>.js
   ```
4. **Preserve Documentation & Clean Code**:
   Maintain concise, modern, and readable code. Avoid creating redundant directories or re-introducing deprecated folders (such as `node-npm`).
