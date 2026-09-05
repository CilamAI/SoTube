const os = require('os');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
let pkg = {};
try {
  pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
} catch (_) { }

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}



console.log('\x1b[1mApplication:\x1b[0m');
console.log(`  Name:         ${pkg.name || 'sotube'}`);
console.log(`  Version:      v${pkg.version || '1.0.0'}`);
console.log(`  Description:  ${pkg.description || 'N/A'}`);
console.log(`  Author:       ${pkg.author || 'N/A'}`);
console.log('');

console.log('\x1b[1mRuntime Environment:\x1b[0m');
console.log(`  Node.js:      ${process.version}`);
console.log(`  V8 Engine:    ${process.versions.v8 || 'N/A'}`);
console.log(`  Electron:     ${pkg.devDependencies?.electron || 'N/A'}`);
console.log(`  Builder:      ${pkg.devDependencies?.['electron-builder'] || 'N/A'}`);
console.log('');

console.log('\x1b[1mOperating System:\x1b[0m');
console.log(`  Platform:     ${os.platform()} (${os.type()})`);
console.log(`  Release:      ${os.release()}`);
console.log(`  Architecture: ${os.arch()}`);
console.log(`  CPU Cores:    ${os.cpus().length}x ${os.cpus()[0]?.model || 'Processor'}`);
console.log(`  Total RAM:    ${formatBytes(os.totalmem())}`);
console.log(`  Free RAM:     ${formatBytes(os.freemem())}`);
console.log(`  Temp Dir:     ${os.tmpdir()}`);
console.log(`  Home Dir:     ${os.homedir()}`);
console.log('');

console.log('\x1b[1mAvailable NPM Scripts:\x1b[0m');
if (pkg.scripts) {
  for (const [key, cmd] of Object.entries(pkg.scripts)) {
    console.log(`  \x1b[33mnpm run ${key.padEnd(12)}\x1b[0m \x1b[90m→ ${cmd}\x1b[0m`);
  }
}
console.log('\n\x1b[32m✔ [SUCCESS] Info check completed.\x1b[0m\n');
