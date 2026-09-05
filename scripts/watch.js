const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const electronPath = require(path.join(rootDir, 'node_modules', 'electron'));

const log = {
  info: (msg) => console.log(`\x1b[36mℹ [INFO]\x1b[0m ${msg}`),
  success: (msg) => console.log(`\x1b[32m✔ [SUCCESS]\x1b[0m ${msg}`),
  warn: (msg) => console.warn(`\x1b[33m⚠ [WARNING]\x1b[0m ${msg}`),
  error: (msg) => console.error(`\x1b[31m✖ [ERROR]\x1b[0m ${msg}`)
};

let electronProcess = null;
let restartTimer = null;
let isExiting = false;

function checkAppIcons() {
  const iconFiles = [
    'assets/icon.ico',
    'assets/icon.png',
    'assets/sidebar.bmp',
    'assets/icon.bmp'
  ];

  let allOk = true;
  for (const file of iconFiles) {
    const full = path.join(rootDir, file);
    if (!fs.existsSync(full) || fs.statSync(full).size === 0) {
      log.warn(`Missing or empty asset: ${file}`);
      allOk = false;
    }
  }
  if (allOk) {
    log.success('Application icons and installer bitmaps verified.');
  }
}

function killCurrentProcess(callback) {
  if (!electronProcess || electronProcess.killed) {
    if (callback) callback();
    return;
  }

  const pid = electronProcess.pid;
  try {
    if (process.platform === 'win32') {
      const killer = spawn('taskkill', ['/pid', String(pid), '/f', '/t']);
      killer.on('close', () => {
        electronProcess = null;
        if (callback) callback();
      });
      killer.on('error', (err) => {
        log.warn(`taskkill warning: ${err.message}`);
        electronProcess = null;
        if (callback) callback();
      });
      return;
    } else {
      electronProcess.kill('SIGTERM');
      electronProcess = null;
    }
  } catch (err) {
    log.error(`Failed to terminate process ${pid}: ${err.message}`);
    electronProcess = null;
  }
  if (callback) setTimeout(callback, 100);
}

function startApp() {
  if (isExiting) return;
  const time = new Date().toLocaleTimeString();
  log.info(`[${time}] Opening Electron application...`);

  try {
    electronProcess = spawn(electronPath, ['.'], {
      stdio: 'inherit',
      cwd: rootDir
    });

    if (electronProcess.pid) {
      log.success(`Electron app opened and running (PID: ${electronProcess.pid})`);
    }

    electronProcess.on('spawn', () => {
      log.info(`Electron main window process spawned.`);
    });

    electronProcess.on('error', (err) => {
      log.error(`Electron execution error: ${err.message}`);
    });

    electronProcess.on('exit', (code) => {
      if (!restartTimer && !isExiting) {
        if (code === 0 || code === null) {
          log.info(`App closed cleanly (code ${code ?? 0}). Watching for file changes...`);
        } else {
          log.warn(`App exited with non-zero code ${code}. Waiting for file changes...`);
        }
      }
    });
  } catch (err) {
    log.error(`Failed to launch Electron: ${err.message}`);
  }
}

function queueRestart(changedFile) {
  if (isExiting) return;
  clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    restartTimer = null;
    log.info(`File modified: \x1b[1m${changedFile}\x1b[0m -> Reloading application...`);
    killCurrentProcess(() => {
      startApp();
    });
  }, 250);
}

const watchExts = new Set(['.js', '.html', '.css', '.json']);
const ignoreDirs = ['node_modules', 'dist', '.git', '.github', '.vscode', '.sst', 'scripts'];

console.log('\n\x1b[1m\x1b[35m[SoTube Watch]\x1b[0m Initializing development watcher...\n');
checkAppIcons();

try {
  fs.watch(rootDir, { recursive: true }, (_eventType, filename) => {
    if (!filename) return;
    const norm = filename.replace(/\\/g, '/');
    if (ignoreDirs.some(dir => norm.startsWith(dir + '/') || norm === dir)) return;
    const ext = path.extname(filename).toLowerCase();
    if (watchExts.has(ext)) {
      queueRestart(filename);
    }
  });
  log.info('Watching for file modifications in .js, .html, .css, .json');
} catch (err) {
  log.error(`Recursive directory watch failed: ${err.message}`);
}

startApp();

function cleanupAndExit() {
  if (isExiting) return;
  isExiting = true;
  console.log('');
  log.info('Shutting down watch process and sub-processes...');
  killCurrentProcess(() => {
    log.success('Cleanup complete. Goodbye!');
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 1000);
}

process.on('SIGINT', cleanupAndExit);
process.on('SIGTERM', cleanupAndExit);
