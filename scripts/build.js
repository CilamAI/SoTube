const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

const log = {
  info: (msg) => console.log(`\x1b[36mℹ [INFO]\x1b[0m ${msg}`),
  success: (msg) => console.log(`\x1b[32m✔ [SUCCESS]\x1b[0m ${msg}`),
  warn: (msg) => console.warn(`\x1b[33m⚠ [WARNING]\x1b[0m ${msg}`),
  error: (msg) => console.error(`\x1b[31m✖ [ERROR]\x1b[0m ${msg}`)
};

function sleep(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { }
}

function terminateSoTube() {
  if (process.platform !== 'win32') return;

  const result = spawnSync('taskkill', ['/IM', 'SoTube.exe', '/F', '/T'], {
    stdio: 'ignore'
  });

  // taskkill exits non-zero when no matching process exists; that is expected.
  if (result.status === 0) {
    log.info('Terminated running SoTube.exe process(es) to release app.asar.');
  }
}

function cleanUnpackedDir() {
  const dir = path.join(rootDir, 'dist', 'win-unpacked');
  if (!fs.existsSync(dir)) return true;

  log.info('Removing stale dist/win-unpacked to avoid locked-file build errors...');

  let lastError = null;
  for (let attempt = 1; attempt <= 15; attempt++) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      log.success('Removed dist/win-unpacked.');
      return true;
    } catch (err) {
      lastError = err;
      const retryable = err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'ENOTEMPTY';
      if (!retryable || attempt === 15) break;
      sleep(500);
    }
  }

  log.error(
    `Could not remove dist/win-unpacked (${lastError && lastError.code || 'unknown'}). ` +
    'A file inside it is still open by another program — most often your editor/IDE or a running SoTube.exe. ' +
    'Close any open app.asar tab and stop SoTube, then rerun the build.'
  );
  return false;
}

function runElectronBuilder() {
  const builderCli = path.join(rootDir, 'node_modules', 'electron-builder', 'cli.js');
  if (fs.existsSync(builderCli)) {
    return spawnSync(process.execPath, [builderCli, '--win', '--dir'], {
      stdio: 'inherit',
      cwd: rootDir
    });
  }

  return spawnSync('npx', ['--no-install', 'electron-builder', '--win', '--dir'], {
    stdio: 'inherit',
    cwd: rootDir,
    shell: true
  });
}

function buildDistDir() {
  terminateSoTube();
  if (process.platform === 'win32') {
    sleep(500);
  }

  if (!cleanUnpackedDir()) {
    return 1;
  }

  log.info('Building unpacked application with electron-builder (--win --dir)...');
  const result = runElectronBuilder();

  if (result.status === 0) {
    log.success('Unpacked application successfully built.');
  } else {
    log.error('electron-builder exited with a non-zero status.');
  }

  return result.status ?? 1;
}

module.exports = { buildDistDir, terminateSoTube, cleanUnpackedDir };

if (require.main === module) {
  process.exit(buildDistDir());
}
