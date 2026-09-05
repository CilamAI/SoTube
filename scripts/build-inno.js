const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { buildDistDir } = require('./build');

const rootDir = path.resolve(__dirname, '..');

const log = {
  info: (msg) => console.log(`\x1b[36mℹ [INFO]\x1b[0m ${msg}`),
  success: (msg) => console.log(`\x1b[32m✔ [SUCCESS]\x1b[0m ${msg}`),
  warn: (msg) => console.warn(`\x1b[33m⚠ [WARNING]\x1b[0m ${msg}`),
  error: (msg) => console.error(`\x1b[31m✖ [ERROR]\x1b[0m ${msg}`)
};

function sleep(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch (_) {
    const end = Date.now() + ms;
    while (Date.now() < end) { }
  }
}

console.log('Preparing Inno Setup compiler...\n');
sleep(1000);

log.info('Validating installer icons and wizard bitmaps...');
const licenseTxtPath = path.join(rootDir, 'LICENSE.txt');
const licenseMdPath = path.join(rootDir, 'LICENSE.md');
if (!fs.existsSync(licenseTxtPath) && fs.existsSync(licenseMdPath)) {
  fs.copyFileSync(licenseMdPath, licenseTxtPath);
}

const installerAssets = [
  { file: 'assets/icon.ico', required: true },
  { file: 'assets/sidebar.bmp', required: true },
  { file: 'assets/icon.bmp', required: true },
  { file: 'LICENSE.txt', required: true }
];

let assetsValid = true;
for (const item of installerAssets) {
  const full = path.join(rootDir, item.file);
  if (!fs.existsSync(full)) {
    if (item.required) {
      log.error(`Missing required installer asset: ${item.file}`);
      assetsValid = false;
    } else {
      log.warn(`Missing optional installer asset: ${item.file}`);
    }
  } else {
    const stat = fs.statSync(full);
    if (stat.size === 0) {
      log.error(`Installer asset file is empty: ${item.file}`);
      assetsValid = false;
    } else {
      log.success(`Found ${item.file}`);
    }
  }
}

if (!assetsValid) {
  log.error('Aborting build: Required installer assets are missing.');
  process.exit(1);
}

log.info('Locating Inno Setup 6 compiler (ISCC.exe)...');
const candidates = [
  'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
  'C:\\Program Files\\Inno Setup 6\\ISCC.exe',
  'C:\\Program Files (x86)\\Inno Setup 5\\ISCC.exe',
  'C:\\Program Files\\Inno Setup 5\\ISCC.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Inno Setup 6', 'ISCC.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Inno Setup 5', 'ISCC.exe')
];

let isccPath = candidates.find(p => fs.existsSync(p));

if (!isccPath) {
  const check = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['iscc'], { encoding: 'utf8' });
  if (check.status === 0 && check.stdout.trim()) {
    isccPath = check.stdout.trim().split(/[\r\n]+/)[0];
  }
}

if (!isccPath) {
  log.error('Inno Setup compiler (ISCC.exe) was not found on this system.');
  log.warn('Please install Inno Setup 6 from: https://jrsoftware.org/isdl.php');
  process.exit(1);
}

log.success(`Inno Setup compiler found: ${isccPath}`);

log.info('Checking unpacked application binaries in dist/win-unpacked...');
const unpackedExe = path.join(rootDir, 'dist', 'win-unpacked', 'SoTube.exe');
const forceRebuild = process.argv.includes('--rebuild') || process.argv.includes('--dist');

if (!fs.existsSync(unpackedExe) || forceRebuild) {
  const buildStatus = buildDistDir();
  if (buildStatus !== 0) {
    log.error('Failed to build dist/win-unpacked.');
    process.exit(buildStatus);
  }
} else {
  log.success('Unpacked application verified at dist/win-unpacked/SoTube.exe');
}

const scriptPath = path.join(rootDir, 'installer.iss');
log.info(`Compiling installer script: ${path.basename(scriptPath)}...`);

const result = spawnSync(isccPath, [scriptPath], {
  stdio: 'inherit',
  cwd: rootDir
});

if (result.status === 0) {
  const setupFile = path.join(rootDir, 'dist', 'SoTubeSetup.exe');
  if (fs.existsSync(setupFile)) {
    const stat = fs.statSync(setupFile);
    const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);
    log.success(`Installer successfully compiled: dist/SoTubeSetup.exe (${sizeMb} MB)`);
  } else {
    log.success('Inno Setup compilation completed successfully.');
  }
} else {
  log.error(`Inno Setup compiler exited with error code: ${result.status}`);
}

process.exit(result.status ?? 0);
