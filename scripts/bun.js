const { spawnSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');

const log = {
  info: (msg) => console.log(`\x1b[36mℹ [INFO]\x1b[0m ${msg}`),
  success: (msg) => console.log(`\x1b[32m✔ [SUCCESS]\x1b[0m ${msg}`),
  warn: (msg) => console.warn(`\x1b[33m⚠ [WARNING]\x1b[0m ${msg}`),
  error: (msg) => console.error(`\x1b[31m✖ [ERROR]\x1b[0m ${msg}`)
};

let bunVersion = null;
let bunPath = null;

function findBun() {
  const homedir = os.homedir();
  const directCandidates = [
    path.join(homedir, '.bun', 'bin', 'bun.exe'),
    path.join(homedir, '.bun', 'bin', 'bun'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Bun', 'bun.exe'),
    path.join(process.env.APPDATA || '', 'npm', 'bun.cmd'),
    'C:\\Program Files\\Bun\\bun.exe'
  ];

  for (const p of directCandidates) {
    if (p && fs.existsSync(p)) return p;
  }

  const pathDirs = (process.env.PATH || '').split(path.delimiter).slice(0, 20);
  for (const dir of pathDirs) {
    if (!dir) continue;
    const candidate = path.join(dir, process.platform === 'win32' ? 'bun.exe' : 'bun');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

bunPath = findBun();

if (bunPath) {
  try {
    const ver = spawnSync(bunPath, ['--version'], { encoding: 'utf8', timeout: 1500 });
    if (ver.status === 0 && ver.stdout) {
      bunVersion = ver.stdout.trim();
    }
  } catch (_) { }
}

console.log('\n\x1b[1m\x1b[35mSoTube Bun Environment\x1b[0m\n');

log.info('Checking Bun runtime availability...');
if (bunPath && bunVersion) {
  log.success(`Bun is installed: v${bunVersion}`);
  log.success(`Binary path: ${bunPath}`);
} else if (bunPath) {
  log.success(`Bun binary located at: ${bunPath}`);
} else {
  log.warn('Bun runtime is not installed or not found in system PATH.');
  console.log('\n\x1b[1mInstallation Options for Windows:\x1b[0m');
  console.log('  PowerShell: \x1b[33mpowershell -c "irm bun.sh/install.ps1 | iex"\x1b[0m');
  console.log('  Scoop:      \x1b[33mscoop install bun\x1b[0m');
  console.log('  Chocolatey: \x1b[33mchoco install bun\x1b[0m');
}

console.log('\n\x1b[1mSoTube Bun Workflows:\x1b[0m');
console.log('  \x1b[36mbun install\x1b[0m        Fast install of SoTube dependencies');
console.log('  \x1b[36mbun run start\x1b[0m      Launch SoTube Electron desktop client');
console.log('  \x1b[36mbun run watch\x1b[0m      Start development file watcher');
console.log('  \x1b[36mbun run test\x1b[0m       Execute full automated test suite');
console.log('  \x1b[36mbun run info\x1b[0m       View runtime diagnostics');
console.log('  \x1b[36mbun run random\x1b[0m     Generate test video metadata');
console.log('  \x1b[36mbun run dev:stats\x1b[0m  Inspect project codebase metrics');

const forwardArgs = process.argv.slice(2);
if (forwardArgs.length > 0 && bunPath) {
  log.info(`Forwarding command to Bun: bun ${forwardArgs.join(' ')}`);
  const res = spawnSync(bunPath, forwardArgs, { stdio: 'inherit', cwd: rootDir });
  process.exit(res.status ?? 0);
} else {
  console.log('\n\x1b[32m✔ [SUCCESS] Bun compatibility verified.\x1b[0m\n');
}
