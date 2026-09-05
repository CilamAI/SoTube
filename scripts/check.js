const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

const log = {
  info: (msg) => { stats.info++; console.log(`\x1b[36mℹ [INFO]\x1b[0m ${msg}`); },
  success: (msg) => { stats.success++; console.log(`\x1b[32m✔ [SUCCESS]\x1b[0m ${msg}`); },
  warn: (msg) => { stats.warn++; console.warn(`\x1b[33m⚠ [WARNING]\x1b[0m ${msg}`); },
  error: (msg) => { stats.error++; console.error(`\x1b[31m✖ [ERROR]\x1b[0m ${msg}`); }
};

const stats = { info: 0, success: 0, warn: 0, error: 0 };

function readBmpHeader(buffer) {
  if (buffer.length < 26) return null;
  if (buffer[0] !== 0x42 || buffer[1] !== 0x4D) return null;
  const width = buffer.readInt32LE(18);
  const height = Math.abs(buffer.readInt32LE(22));
  return { width, height };
}

function readPngHeader(buffer) {
  if (buffer.length < 24) return null;
  const signature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) return null;
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height };
}

function readIcoHeader(buffer) {
  if (buffer.length < 6) return null;
  if (buffer.readUInt16LE(0) !== 0 || buffer.readUInt16LE(2) !== 1) return null;
  const count = buffer.readUInt16LE(4);
  return { count };
}

log.info(`Target workspace: ${rootDir}`);

const iconSpecifications = [
  {
    file: 'assets/icon.ico',
    required: true,
    type: 'ico',
    description: 'Windows application & executable icon'
  },
  {
    file: 'assets/icon.png',
    required: true,
    type: 'png',
    minWidth: 256,
    minHeight: 256,
    description: 'High-resolution application icon'
  },
  {
    file: 'assets/icon.bmp',
    required: true,
    type: 'bmp',
    expectedWidth: 55,
    expectedHeight: 58,
    description: 'Inno Setup wizard small image (55x58)'
  },
  {
    file: 'assets/sidebar.bmp',
    required: true,
    type: 'bmp',
    expectedWidth: 164,
    expectedHeight: 314,
    description: 'Inno Setup wizard sidebar (164x314)'
  },
  {
    file: 'assets/wizardSmall.bmp',
    required: false,
    type: 'bmp',
    expectedWidth: 55,
    expectedHeight: 58,
    description: 'Inno Setup wizard fallback small image'
  },
  {
    file: 'assets/installerSidebar.bmp',
    required: false,
    type: 'bmp',
    expectedWidth: 164,
    expectedHeight: 314,
    description: 'Inno Setup wizard fallback sidebar'
  }
];

for (const item of iconSpecifications) {
  const fullPath = path.join(rootDir, item.file);
  if (!fs.existsSync(fullPath)) {
    if (item.required) {
      log.error(`Missing required icon: ${item.file} (${item.description})`);
    } else {
      log.warn(`Optional asset missing: ${item.file} (${item.description})`);
    }
    continue;
  }

  const stat = fs.statSync(fullPath);
  if (stat.size === 0) {
    log.error(`Icon file is 0 bytes (empty): ${item.file}`);
    continue;
  }

  const buffer = fs.readFileSync(fullPath);

  if (item.type === 'ico') {
    const ico = readIcoHeader(buffer);
    if (!ico) {
      log.error(`Invalid ICO binary format: ${item.file}`);
    } else {
      log.success(`Valid ICO: ${item.file} (${stat.size} bytes, ${ico.count} embedded icon frames)`);
    }
  } else if (item.type === 'png') {
    const png = readPngHeader(buffer);
    if (!png) {
      log.error(`Invalid PNG signature: ${item.file}`);
    } else {
      if (item.minWidth && (png.width < item.minWidth || png.height < item.minHeight)) {
        log.warn(`PNG dimensions ${png.width}x${png.height} below recommended ${item.minWidth}x${item.minHeight}: ${item.file}`);
      } else {
        log.success(`Valid PNG: ${item.file} (${png.width}x${png.height}, ${stat.size} bytes)`);
      }
    }
  } else if (item.type === 'bmp') {
    const bmp = readBmpHeader(buffer);
    if (!bmp) {
      log.error(`Invalid BMP header: ${item.file}`);
    } else {
      if (item.expectedWidth && (bmp.width !== item.expectedWidth || bmp.height !== item.expectedHeight)) {
        log.warn(`BMP dimensions ${bmp.width}x${bmp.height} do not match recommended ${item.expectedWidth}x${item.expectedHeight}: ${item.file}`);
      } else {
        log.success(`Valid BMP: ${item.file} (${bmp.width}x${bmp.height}, ${stat.size} bytes)`);
      }
    }
  }
}

log.info('Checking installer and build icon mappings...');

try {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const winIcon = pkg.build?.win?.icon;
  if (!winIcon) {
    log.warn('package.json build.win.icon is not configured');
  } else if (!fs.existsSync(path.join(rootDir, winIcon))) {
    log.error(`package.json build.win.icon points to non-existent file: ${winIcon}`);
  } else {
    log.success(`package.json icon mapped: ${winIcon}`);
  }
} catch (err) {
  log.error(`Failed to validate package.json: ${err.message}`);
}

try {
  const issPath = path.join(rootDir, 'installer.iss');
  if (fs.existsSync(issPath)) {
    const iss = fs.readFileSync(issPath, 'utf8');
    const hasIcon = iss.includes('SetupIconFile=assets\\icon.ico');
    const hasSidebar = iss.includes('WizardImageFile=assets\\sidebar.bmp');
    const hasSmall = iss.includes('WizardSmallImageFile=assets\\icon.bmp');

    if (hasIcon && hasSidebar && hasSmall) {
      log.success('installer.iss asset directives verified (SetupIconFile, WizardImageFile, WizardSmallImageFile)');
    } else {
      if (!hasIcon) log.warn('installer.iss missing SetupIconFile directive');
      if (!hasSidebar) log.warn('installer.iss missing WizardImageFile directive');
      if (!hasSmall) log.warn('installer.iss missing WizardSmallImageFile directive');
    }
  }
} catch (err) {
  log.error(`Failed to validate installer.iss: ${err.message}`);
}

try {
  const mainJs = fs.readFileSync(path.join(rootDir, 'main.js'), 'utf8');
  if (mainJs.includes('icon.ico') && mainJs.includes('icon.png')) {
    log.success('main.js window icon fallbacks verified');
  } else {
    log.warn('main.js may be missing explicit icon fallbacks');
  }
} catch (err) {
  log.error(`Failed to inspect main.js: ${err.message}`);
}

console.log(`\n\x1b[36mℹ INFO:\x1b[0m ${stats.info} | \x1b[32m✔ SUCCESS:\x1b[0m ${stats.success} | \x1b[33m⚠ WARNING:\x1b[0m ${stats.warn} | \x1b[31m✖ ERROR:\x1b[0m ${stats.error}\n`);

if (stats.error > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
