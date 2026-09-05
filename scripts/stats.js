const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function countLines(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let code = 0;
    let blank = 0;
    for (const line of lines) {
      if (!line.trim()) blank++;
      else code++;
    }
    return { total: lines.length, code, blank, size: Buffer.byteLength(content, 'utf8') };
  } catch (_) {
    return { total: 0, code: 0, blank: 0, size: 0 };
  }
}

function getFilesRecursively(dir, filterFn) {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
          results = results.concat(getFilesRecursively(fullPath, filterFn));
        }
      } else if (!filterFn || filterFn(fullPath)) {
        results.push(fullPath);
      }
    }
  } catch (_) { }
  return results;
}

let pkg = {};
try {
  pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
} catch (_) { }

console.log(`\n\x1b[1m\x1b[36mSoTube Developer Statistics\x1b[0m\n`);

console.log(`\x1b[1mApp Name:\x1b[0m       ${pkg.name || 'sotube'} (v${pkg.version || '1.0.0'})`);
console.log(`\x1b[1mElectron:\x1b[0m       ${pkg.devDependencies?.electron || 'N/A'}`);
console.log(`\x1b[1melectron-builder:\x1b[0m ${pkg.devDependencies?.['electron-builder'] || 'N/A'}`);
console.log(`\x1b[1mNode Runtime:\x1b[0m   ${process.version}`);
console.log('');

const exts = ['.js', '.html', '.css', '.json', '.iss'];
const extStats = {};
for (const ext of exts) {
  extStats[ext] = { count: 0, code: 0, blank: 0, total: 0, size: 0 };
}

const allProjectFiles = getFilesRecursively(rootDir);
for (const f of allProjectFiles) {
  const ext = path.extname(f).toLowerCase();
  if (extStats[ext]) {
    const counts = countLines(f);
    extStats[ext].count++;
    extStats[ext].code += counts.code;
    extStats[ext].blank += counts.blank;
    extStats[ext].total += counts.total;
    extStats[ext].size += counts.size;
  }
}

console.log('\x1b[1mCodebase Breakdown:\x1b[0m');
console.log('--------------------------------------------------------');
console.log(' Type        Files     Lines of Code     Blanks      Size');
console.log('--------------------------------------------------------');
let grandTotalFiles = 0;
let grandTotalCode = 0;
let grandTotalBlanks = 0;
let grandTotalSize = 0;

for (const [ext, s] of Object.entries(extStats)) {
  grandTotalFiles += s.count;
  grandTotalCode += s.code;
  grandTotalBlanks += s.blank;
  grandTotalSize += s.size;
  const label = (ext.slice(1).toUpperCase() + ' files').padEnd(12);
  const count = String(s.count).padStart(5);
  const code = String(s.code).padStart(17);
  const blank = String(s.blank).padStart(10);
  const size = formatBytes(s.size).padStart(10);
  console.log(` ${label} ${count} ${code} ${blank} ${size}`);
}
console.log('--------------------------------------------------------');
console.log(` TOTALS      ${String(grandTotalFiles).padStart(5)} ${String(grandTotalCode).padStart(17)} ${String(grandTotalBlanks).padStart(10)} ${formatBytes(grandTotalSize).padStart(10)}`);
console.log('');

console.log('\x1b[1mKey Core Files:\x1b[0m');
console.log('--------------------------------------------------------');
const coreFiles = [
  'main.js',
  'preload.js',
  'api/preload.js',
  'api/index.js',
  'renderer.js',
  'styles.css',
  'installer.iss',
  'scripts/build-inno.js',
  'scripts/watch.js',
  'scripts/test.js',
  'scripts/postinstall.js',
  'scripts/bun.js',
  'convertapi/index.js',
  'convertapi/binaries/index.js',
  'convertapi/storage/index.js',
  'convertapi/search/index.js',
  'convertapi/trim/index.js',
  'convertapi/download/index.js',
  'settings/index.js'
];

for (const cf of coreFiles) {
  const full = path.join(rootDir, cf);
  if (fs.existsSync(full)) {
    const c = countLines(full);
    console.log(`  ${cf.padEnd(26)} ${String(c.code).padStart(5)} lines  (${formatBytes(c.size)})`);
  }
}
console.log('');

try {
  const localesDir = path.join(rootDir, 'locales');
  if (fs.existsSync(localesDir)) {
    const locFiles = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));
    console.log(`\x1b[1mLocalization:\x1b[0m ${locFiles.length} languages supported`);
    for (const lf of locFiles) {
      try {
        const raw = fs.readFileSync(path.join(localesDir, lf), 'utf8');
        const parsed = JSON.parse(raw);
        const keys = Object.keys(parsed).length;
        console.log(`  • ${lf.replace('.json', '').padEnd(6)} ${keys} translated strings (${formatBytes(Buffer.byteLength(raw, 'utf8'))})`);
      } catch (_) { }
    }
    console.log('');
  }
} catch (_) { }

try {
  const assetsDir = path.join(rootDir, 'assets');
  if (fs.existsSync(assetsDir)) {
    const assetFiles = fs.readdirSync(assetsDir);
    let totalAssetSize = 0;
    console.log('\x1b[1mAssets & Media:\x1b[0m');
    for (const af of assetFiles) {
      const full = path.join(assetsDir, af);
      const stat = fs.statSync(full);
      totalAssetSize += stat.size;
      console.log(`  • ${af.padEnd(16)} ${formatBytes(stat.size)}`);
    }
    console.log(`  Total Asset Footprint: ${formatBytes(totalAssetSize)}\n`);
  }
} catch (_) { }

const distDir = path.join(rootDir, 'dist');
if (fs.existsSync(distDir)) {
  console.log('\x1b[1mDistribution Artifacts:\x1b[0m');
  const unpackedDir = path.join(distDir, 'win-unpacked');
  if (fs.existsSync(unpackedDir)) {
    let unpackedTotal = 0;
    function calcDir(d) {
      try {
        for (const it of fs.readdirSync(d)) {
          const p = path.join(d, it);
          const s = fs.statSync(p);
          if (s.isDirectory()) calcDir(p);
          else unpackedTotal += s.size;
        }
      } catch (_) { }
    }
    calcDir(unpackedDir);
    console.log(`  • win-unpacked folder:   ${formatBytes(unpackedTotal)}`);
  }

  const installerFile = path.join(distDir, 'SoTubeSetup.exe');
  if (fs.existsSync(installerFile)) {
    const s = fs.statSync(installerFile);
    console.log(`  • Inno Setup Installer:  ${formatBytes(s.size)} (${installerFile})`);
  }
  console.log('');
}

console.log('\x1b[32m✔ Stats generation complete.\x1b[0m\n');
