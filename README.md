<p align="center">
  <img src="assets/icon.png" width="128" height="128" alt="SoTube Logo" />
</p>

<h1 align="center">SoTube</h1>

<p align="center">
  <img src="https://img.shields.io/badge/version-26.0.0-41B9F6?style=flat-square" alt="Version" />
  <img src="https://img.shields.io/badge/Electron-44.1.1-47848F?style=flat-square&logo=electron&logoColor=white" alt="Electron" />
  <img src="https://img.shields.io/badge/Platform-Windows-0078D6?style=flat-square&logo=windows&logoColor=white" alt="Platform" />
  <img src="https://img.shields.io/badge/CI-GitHub%20Actions-2088FF?style=flat-square&logo=githubactions&logoColor=white" alt="CI" />
  <img src="https://img.shields.io/badge/Bun-Compatible-fbf0df?style=flat-square&logo=bun&logoColor=black" alt="Bun" />
  <img src="https://img.shields.io/badge/Tests-57%20Passing-brightgreen?style=flat-square" alt="Tests" />
  <img src="https://img.shields.io/badge/License-Apache%202.0-blue?style=flat-square" alt="License" />
</p>

---

## Features

- **Download & Convert**: Download videos and extract audio (MP4, MP3, etc.) by pasting links or searching keywords. Compatible with YouTube, TikTok, X, and more with real-time progress tracking.
- **Video Trimmer**: Built-in video player preview with precise timeline controls to cut and export clips.
- **Recent Downloads History**: Track completed downloads, clear history, or open files and enclosing folders directly.
- **System Tray Integration**:
  - Window close button minimizes to the Windows taskbar notification tray.
  - Native Tray Menu on both left-click and right-click (**Open SoTube**, **Open Downloads**, **Close SoTube**).
  - Quit confirmation dialog (**"Are you sure you want to quit SoTube?"**) with active download warning.
  - Double-click tray icon to restore the main window.
- **Transparent Splash Screen**: Frameless transparent startup launcher with custom squircle icon.
- **Multi-Language Support (i18n)**: Built-in localization for 7 languages (English, German, Spanish, French, Korean, Russian, Turkish).
- **Custom Inno Setup 6 Installer**: Automated 64-bit installer build with branded wizard sidebar (`sidebar.bmp`) and header (`icon.bmp`).

---

## Project Structure

```text
SoTube/
├── .github/               # GitHub Actions CI/CD workflows and community templates
│   ├── workflows/         # Continuous integration and release automation
│   └── ISSUE_TEMPLATE/    # Bug report and feature request issue templates
├── .vscode/               # VS Code workspace settings, launch targets, and tasks
│   ├── launch.json        # Debug configurations (Electron main, watch, test)
│   ├── tasks.json         # Automated NPM build, test, and installer tasks
│   ├── settings.json      # Workspace formatter and file exclusion rules
│   └── extensions.json    # Recommended editor extensions
├── api/                   # API bridge and IPC communication
│   ├── preload.js         # Electron contextBridge API definitions
│   └── index.js           # API package entry point
├── assets/                # Application icons and wizard bitmaps
│   ├── icon.ico           # Executable & window icon
│   ├── icon.png           # Master 1024x1024 application icon
│   ├── sidebar.bmp        # Inno Setup wizard sidebar bitmap (164x314)
│   └── icon.bmp           # Inno Setup header small icon (55x58)
├── locales/               # Localization JSON files
│   ├── en.json            # English
│   ├── de.json            # German
│   ├── es.json            # Spanish
│   ├── fr.json            # French
│   ├── ko.json            # Korean
│   ├── ru.json            # Russian
│   └── tr.json            # Turkish
├── scripts/               # Automation, build, and development scripts
│   ├── build-inno.js      # Inno Setup installer compilation script
│   ├── watch.js           # Lightweight file watcher and auto-reloader
│   ├── test.js            # Automated project validation test suite
│   ├── postinstall.js     # Asset validation and electron-builder patch
│   ├── stats.js           # Codebase metrics and lines-of-code dashboard
│   ├── check.js           # Asset, icon, and configuration diagnostics
│   ├── info.js            # System and environment diagnostics
│   └── bun.js             # Bun runtime integration and runner
├── pages/                 # HTML user interface templates
│   ├── index.html         # Main application window
│   ├── splash.html        # Frameless transparent splash screen
│   └── tray.html          # Windows 11 tray popup flyout
├── settings/              # Application settings and default configuration
│   ├── default.json       # Default user preferences schema
│   └── index.js           # Settings manager module
├── dist/                  # Build output and packaged binaries
├── installer.iss          # Inno Setup compiler configuration
├── main.js                # Electron main process entry point
├── preload.js             # Root preload forwarder
├── renderer.js            # Frontend application logic
├── styles.css             # Main application stylesheet
├── package.json           # Dependencies and NPM script commands
├── package-lock.json      # NPM dependency lockfile
├── bun.lock               # Bun text-based dependency lockfile (Bun 1.2+)
├── bunfig.toml            # Bun package manager installation configuration
├── install.ps1            # Automated Windows PowerShell environment installer
├── sst.config.ts          # SST Ion cloud distribution and releases configuration
├── tsconfig.json          # TypeScript workspace configuration
├── README.md              # Project documentation and badges
├── AGENTS.md              # AI coding assistant architecture & guidelines
└── LICENSE.txt            # Apache 2.0 license and third-party notices
```

---

## Available NPM Scripts

| Command | Description |
|---|---|
| `npm start` | Launch the SoTube Electron desktop app |
| `npm run dev` | Launch watch mode with automatic restart on file changes |
| `npm run watch` | Alias for live reload file watcher (`node scripts/watch.js`) |
| `npm run test` | Run the automated validation test suite |
| `npm run dev:inno` | Build unpacked binaries and compile Inno Setup installer (`SoTubeSetup.exe`) |
| `npm run build:inno` | Alias for Inno Setup compilation |
| `npm run dist:dir` | Package unpacked application files into `dist/win-unpacked` |
| `npm run dev:stats` | Display lines-of-code, file counts, and asset footprint metrics |
| `npm run random` | Generate random sample media objects for IPC and test validation |
| `npm run info` | Print environment, OS, hardware, and dependency diagnostics |
| `npm run bun` | Check Bun runtime availability, diagnostics, and workflows |
| `npm run install:ps1` | Run automated Windows PowerShell installer script |
| `npm run postinstall` | Automatically run asset checks and verify electron-builder patches |

---

## Development Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher) or [Bun](https://bun.sh/)
- [Inno Setup 6](https://jrsoftware.org/isdl.php) (for building Windows installer)

### Quick Start
```powershell
# Automated setup via PowerShell
.\install.ps1
```
Or manually:
```bash
# Install dependencies (npm or bun)
npm install
# or
bun install

# Start development with live reload
npm run watch
# or
bun run watch

# Run test suite
npm run test
# or
bun run test
```

### Packaging & Installer
```bash
# Build the Inno Setup Windows installer (outputs to dist/SoTubeSetup.exe)
npm run dev:inno
```

---

## License
This project is licensed under the Apache License 2.0 - see the [LICENSE.txt](file:///c:/Users/omg/SoTube/LICENSE.txt) file for details.
