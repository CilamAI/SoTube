const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootDir = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function pass(name) {
  totalTests++;
  passedTests++;
  console.log(`  \x1b[32m✓\x1b[0m ${name}`);
}

function fail(name, err) {
  totalTests++;
  failedTests++;
  console.error(`  \x1b[31m✗\x1b[0m ${name}`);
  if (err) console.error(`    \x1b[31m${err.message || err}\x1b[0m`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

console.log('\x1b[1m1. File Structure & Assets\x1b[0m');
const requiredFiles = [
  'main.js',
  'preload.js',
  'api/preload.js',
  'api/index.js',
  'renderer.js',
  'styles.css',
  'package.json',
  'installer.iss',
  'pages/index.html',
  'pages/splash.html',
  'pages/tray.html',
  'pages/dialog.html',
  'pages/support.html',
  'assets/icon.ico',
  'assets/icon.png',
  'assets/sidebar.bmp',
  'assets/icon.bmp',
  'README.md',
  'AGENTS.md',
  'LICENSE.txt',
  'bun.lock',
  'install.ps1',
  'sst.config.ts',
  'tsconfig.json',
  '.sst/platform/config.d.ts',
  'bunfig.toml',
  'convertapi/index.js',
  'convertapi/binaries/index.js',
  'convertapi/storage/index.js',
  'convertapi/search/index.js',
  'convertapi/trim/index.js',
  'convertapi/download/index.js',
  'settings/index.js',
  'settings/default.json'
];

for (const file of requiredFiles) {
  const fullPath = path.join(rootDir, file);
  try {
    assert(fs.existsSync(fullPath), `Missing file: ${file}`);
    const stat = fs.statSync(fullPath);
    assert(stat.size > 0, `File is empty: ${file}`);
    pass(`Exists and non-empty: ${file}`);
  } catch (err) {
    fail(`File check: ${file}`, err);
  }
}

console.log('\n\x1b[1m2. JavaScript Syntax & Parsing\x1b[0m');
const jsFiles = [
  'main.js',
  'preload.js',
  'api/preload.js',
  'api/index.js',
  'renderer.js',
  'scripts/watch.js',
  'scripts/build.js',
  'scripts/build-inno.js',
  'scripts/postinstall.js',
  'scripts/stats.js',
  'scripts/info.js',
  'scripts/bun.js',
  'scripts/check.js',
  'convertapi/index.js',
  'convertapi/binaries/index.js',
  'convertapi/storage/index.js',
  'convertapi/search/index.js',
  'convertapi/trim/index.js',
  'convertapi/download/index.js',
  'settings/index.js'
];

for (const file of jsFiles) {
  const fullPath = path.join(rootDir, file);
  try {
    const code = fs.readFileSync(fullPath, 'utf8');
    new vm.Script(code, { filename: file });
    pass(`Valid syntax: ${file}`);
  } catch (err) {
    fail(`Syntax error in ${file}`, err);
  }
}

console.log('\n\x1b[1m3. package.json Configuration\x1b[0m');
try {
  const pkgPath = path.join(rootDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  assert(pkg.name === 'sotube', 'name should be sotube');
  assert(pkg.main === 'main.js', 'main should point to main.js');
  assert(pkg.scripts && pkg.scripts.start, 'scripts.start should exist');
  assert(pkg.scripts && pkg.scripts.dev, 'scripts.dev should exist');
  assert(pkg.scripts && pkg.scripts.watch, 'scripts.watch should exist');
  assert(pkg.scripts && pkg.scripts['build:inno'], 'scripts.build:inno should exist');
  assert(pkg.scripts && pkg.scripts.check, 'scripts.check should exist');
  assert(pkg.scripts && pkg.scripts.typecheck, 'scripts.typecheck should exist');
  assert(pkg.scripts && pkg.scripts.bun, 'scripts.bun should exist');
  assert(pkg.scripts && pkg.scripts['install:ps1'], 'scripts.install:ps1 should exist');
  assert(Array.isArray(pkg.build?.files), 'build.files must be an array');
  assert(pkg.build.files.includes('pages/**/*'), 'build.files must include pages/**/*');
  assert(pkg.build.files.includes('api/**/*'), 'build.files must include api/**/*');
  assert(pkg.build.files.includes('convertapi/**/*'), 'build.files must include convertapi/**/*');
  assert(pkg.build.files.includes('settings/**/*'), 'build.files must include settings/**/*');
  const issContent = fs.readFileSync(path.join(rootDir, 'installer.iss'), 'utf8');
  assert(issContent.includes('LicenseFile='), 'installer.iss must contain LicenseFile directive');
  pass('package.json scripts, build configuration, and installer.iss valid');
} catch (err) {
  fail('package.json validation', err);
}

console.log('\n\x1b[1m4. Locales Validation\x1b[0m');
try {
  const localesDir = path.join(rootDir, 'locales');
  const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));
  assert(files.length > 0, 'No locale JSON files found');
  for (const f of files) {
    const content = fs.readFileSync(path.join(localesDir, f), 'utf8');
    const parsed = JSON.parse(content);
    assert(typeof parsed === 'object' && parsed !== null, `${f} is not an object`);
    pass(`Valid JSON locale: locales/${f}`);
  }
} catch (err) {
  fail('Locales check', err);
}

console.log('\n\x1b[1m5. HTML Path & Reference Integrity\x1b[0m');
const htmlFiles = ['pages/index.html', 'pages/splash.html', 'pages/tray.html', 'pages/dialog.html', 'pages/support.html'];
for (const hf of htmlFiles) {
  try {
    const full = path.join(rootDir, hf);
    const content = fs.readFileSync(full, 'utf8');
    assert(content.includes('<!DOCTYPE html>'), `${hf} missing <!DOCTYPE html>`);
    assert(content.includes('<html'), `${hf} missing <html> tag`);
    pass(`HTML integrity: ${hf}`);
  } catch (err) {
    fail(`HTML check: ${hf}`, err);
  }
}

console.log('\n\x1b[1m6. GitHub Workflows & Templates\x1b[0m');
const githubFiles = [
  '.github/workflows/ci.yml',
  '.github/workflows/release.yml',
  '.github/ISSUE_TEMPLATE/bug_report.md',
  '.github/ISSUE_TEMPLATE/feature_request.md',
  '.github/pull_request_template.md',
  '.github/dependabot.yml'
];

for (const gf of githubFiles) {
  try {
    const full = path.join(rootDir, gf);
    assert(fs.existsSync(full), `Missing GitHub file: ${gf}`);
    const content = fs.readFileSync(full, 'utf8');
    assert(content.trim().length > 0, `GitHub file is empty: ${gf}`);
    pass(`GitHub verified: ${gf}`);
  } catch (err) {
    fail(`GitHub check: ${gf}`, err);
  }
}

console.log('\n\x1b[1m7. VS Code Configuration\x1b[0m');
const vscodeFiles = [
  '.vscode/launch.json',
  '.vscode/tasks.json',
  '.vscode/settings.json',
  '.vscode/extensions.json'
];

for (const vf of vscodeFiles) {
  try {
    const full = path.join(rootDir, vf);
    assert(fs.existsSync(full), `Missing VS Code file: ${vf}`);
    const content = fs.readFileSync(full, 'utf8');
    const parsed = JSON.parse(content);
    assert(typeof parsed === 'object' && parsed !== null, `${vf} is not an object`);
    pass(`VS Code config verified: ${vf}`);
  } catch (err) {
    fail(`VS Code check: ${vf}`, err);
  }
}

console.log('\n\x1b[1m8. Application Settings Module\x1b[0m');
try {
  const settingsModule = require('../settings');
  const defaults = settingsModule.getDefaultSettings();
  assert(defaults && typeof defaults === 'object', 'default settings should be an object');
  assert(typeof defaults.theme === 'string', 'default theme must be a string');
  assert(typeof defaults.format === 'string', 'default format must be a string');
  assert(typeof defaults.subtitles === 'boolean', 'default subtitles must be a boolean');
  assert(Array.isArray(defaults.subtitleLangs), 'default subtitleLangs must be an array');
  assert(typeof defaults.language === 'string', 'default language must be a string');

  const mockStorage = {
    data: {},
    getItem(k) { return this.data[k] || null; },
    setItem(k, v) { this.data[k] = v; }
  };
  const loaded = settingsModule.loadSettings(mockStorage);
  assert(loaded.theme === defaults.theme, 'loaded theme should match default');
  settingsModule.saveSettings({ ...loaded, theme: 'light' }, mockStorage);
  const reloaded = settingsModule.loadSettings(mockStorage);
  assert(reloaded.theme === 'light', 'saved setting should be persisted');
  pass('Application settings module exports and behavior verified');
} catch (err) {
  fail('Settings module validation', err);
}

console.log('\n\x1b[1m9. Convert API Module & Submodules\x1b[0m');
try {
  const binaries = require('../convertapi/binaries');
  assert(typeof binaries.findExecutable === 'function', 'binaries.findExecutable must be a function');
  pass('convertapi/binaries submodule verified');

  const storage = require('../convertapi/storage');
  assert(typeof storage.getDefaultDownloadDir === 'function', 'storage.getDefaultDownloadDir must be a function');
  assert(typeof storage.handleOpenFolder === 'function', 'storage.handleOpenFolder must be a function');
  assert(typeof storage.registerMediaProtocol === 'function', 'storage.registerMediaProtocol must be a function');
  pass('convertapi/storage submodule verified');

  const search = require('../convertapi/search');
  assert(typeof search.extractInitialData === 'function', 'search.extractInitialData must be a function');
  assert(typeof search.handleVideoSearch === 'function', 'search.handleVideoSearch must be a function');
  pass('convertapi/search submodule verified');

  const trim = require('../convertapi/trim');
  assert(trim.activeTrimJobs instanceof Map, 'trim.activeTrimJobs must be a Map');
  assert(typeof trim.handleTrimPickFile === 'function', 'trim.handleTrimPickFile must be a function');
  assert(typeof trim.handleTrimStart === 'function', 'trim.handleTrimStart must be a function');
  assert(typeof trim.handleTrimCancel === 'function', 'trim.handleTrimCancel must be a function');
  pass('convertapi/trim submodule verified');

  const download = require('../convertapi/download');
  assert(download.activeJobs instanceof Map, 'download.activeJobs must be a Map');
  assert(typeof download.extractYoutubeId === 'function', 'download.extractYoutubeId must be a function');
  assert(Array.isArray(download.downloadChannels), 'download.downloadChannels must be an array');
  assert(Array.isArray(download.cancelChannels), 'download.cancelChannels must be an array');
  assert(typeof download.handleDownload === 'function', 'download.handleDownload must be a function');
  assert(typeof download.cancelJob === 'function', 'download.cancelJob must be a function');
  pass('convertapi/download submodule verified');

  const convertApi = require('../convertapi');
  assert(convertApi && typeof convertApi === 'object', 'convertapi should export an object');
  assert(convertApi.activeJobs instanceof Map, 'activeJobs must be a Map');
  assert(convertApi.activeTrimJobs instanceof Map, 'activeTrimJobs must be a Map');
  assert(typeof convertApi.getDefaultDownloadDir === 'function', 'getDefaultDownloadDir must be a function');
  assert(typeof convertApi.findExecutable === 'function', 'findExecutable must be a function');
  assert(Array.isArray(convertApi.downloadChannels), 'downloadChannels must be an array');
  assert(Array.isArray(convertApi.cancelChannels), 'cancelChannels must be an array');
  assert(typeof convertApi.handleDownload === 'function', 'handleDownload must be a function');
  assert(typeof convertApi.cancelJob === 'function', 'cancelJob must be a function');
  assert(typeof convertApi.handleVideoSearch === 'function', 'handleVideoSearch must be a function');
  assert(typeof convertApi.handleTrimStart === 'function', 'handleTrimStart must be a function');
  assert(typeof convertApi.handleTrimCancel === 'function', 'handleTrimCancel must be a function');
  assert(typeof convertApi.handleOpenFolder === 'function', 'handleOpenFolder must be a function');
  assert(typeof convertApi.registerMediaProtocol === 'function', 'registerMediaProtocol must be a function');
  assert(typeof convertApi.hasActiveDownloads === 'function', 'hasActiveDownloads must be a function');
  assert(typeof convertApi.getActiveDownloadsCount === 'function', 'getActiveDownloadsCount must be a function');
  assert(convertApi.hasActiveDownloads() === false, 'hasActiveDownloads should initially be false');
  assert(convertApi.getActiveDownloadsCount() === 0, 'getActiveDownloadsCount should initially be 0');
  assert(typeof convertApi.register === 'function', 'register must be a function');

  // Verify ipcMain handler registration does not throw duplicate handler error
  const mockHandlers = new Map();
  const mockIpc = {
    handle: (ch, fn) => {
      if (mockHandlers.has(ch)) throw new Error(`Attempted to register a second handler for '${ch}'`);
      mockHandlers.set(ch, fn);
    },
    removeHandler: (ch) => {
      mockHandlers.delete(ch);
    },
    on: () => {}
  };
  convertApi.register(mockIpc);
  // Registering a second time should also be safely handled
  convertApi.register(mockIpc);
  pass('Convert API module exports and behavior verified');
} catch (err) {
  fail('Convert API module validation', err);
}

console.log(`\nTotal: ${totalTests} | Passed: \x1b[32m${passedTests}\x1b[0m | Failed: ${failedTests > 0 ? `\x1b[31m${failedTests}\x1b[0m` : '0'}\n`);

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('\x1b[32mAll tests passed successfully!\x1b[0m\n');
  process.exit(0);
}
