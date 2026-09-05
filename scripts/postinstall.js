const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

const log = {
  info: (msg) => console.log(`\x1b[36mℹ [INFO]\x1b[0m ${msg}`),
  success: (msg) => console.log(`\x1b[32m✔ [SUCCESS]\x1b[0m ${msg}`),
  warn: (msg) => console.warn(`\x1b[33m⚠ [WARNING]\x1b[0m ${msg}`),
  error: (msg) => console.error(`\x1b[31m✖ [ERROR]\x1b[0m ${msg}`)
};

function checkIconAssets() {
  log.info('Validating application icons and bitmaps...');
  const icons = [
    { file: 'assets/icon.ico', required: true },
    { file: 'assets/icon.png', required: true },
    { file: 'assets/sidebar.bmp', required: false },
    { file: 'assets/icon.bmp', required: false }
  ];

  let hasWarning = false;
  for (const item of icons) {
    const fullPath = path.join(rootDir, item.file);
    if (!fs.existsSync(fullPath)) {
      if (item.required) {
        log.error(`Missing required icon: ${item.file}`);
      } else {
        log.warn(`Missing optional installer bitmap: ${item.file}`);
        hasWarning = true;
      }
    } else {
      const stat = fs.statSync(fullPath);
      if (stat.size === 0) {
        log.error(`Icon file is empty: ${item.file}`);
      } else {
        log.success(`Found ${item.file} (${stat.size} bytes)`);
      }
    }
  }

  if (hasWarning) {
    log.warn('Some installer bitmaps are missing. Default icons will be used if building setup.');
  }
}

const collectorFile = path.join(
  rootDir,
  'node_modules',
  'app-builder-lib',
  'out',
  'node-module-collector',
  'npmNodeModulesCollector.js'
);

function patchCollector() {
  log.info('Checking electron-builder collector patch...');
  if (!fs.existsSync(collectorFile)) {
    log.warn('app-builder-lib not installed in node_modules; skipping collector patch.');
    return;
  }

  try {
    let content = fs.readFileSync(collectorFile, 'utf8');
    const target = 'parseDependenciesTree(jsonBlob) {\n        return JSON.parse(jsonBlob);\n    }';
    const replacement = 'parseDependenciesTree(jsonBlob) {\n        if (!jsonBlob || !jsonBlob.trim()) return {};\n        return JSON.parse(jsonBlob);\n    }';

    if (content.includes('if (!jsonBlob || !jsonBlob.trim())')) {
      log.success('electron-builder collector patch is already applied.');
      return;
    }

    if (content.includes(target)) {
      content = content.replace(target, replacement);
      fs.writeFileSync(collectorFile, content, 'utf8');
      log.success('Successfully applied electron-builder empty dependencies patch.');
    } else if (content.includes('return JSON.parse(jsonBlob);')) {
      content = content.replace(
        'return JSON.parse(jsonBlob);',
        'if (!jsonBlob || !jsonBlob.trim()) return {};\n        return JSON.parse(jsonBlob);'
      );
      fs.writeFileSync(collectorFile, content, 'utf8');
      log.success('Successfully applied electron-builder empty dependencies patch.');
    } else {
      log.warn('Target parseDependenciesTree not found in collector; may already be customized.');
    }
  } catch (err) {
    log.error(`Failed to patch electron-builder collector: ${err.message}`);
  }
}

const packageManagerFile = path.join(
  rootDir,
  'node_modules',
  'app-builder-lib',
  'out',
  'node-module-collector',
  'packageManager.js'
);

function patchPackageManagerCommand() {
  log.info('Checking electron-builder package-manager command patch...');
  if (!fs.existsSync(packageManagerFile)) {
    log.warn('app-builder-lib not installed in node_modules; skipping package-manager patch.');
    return;
  }

  try {
    let content = fs.readFileSync(packageManagerFile, 'utf8');
    const target = '        return which.sync(fallback);';
    const replacement = '        return fallback;';

    if (!content.includes(target)) {
      log.warn('Package-manager command target not found; may already be patched or customized.');
      return;
    }

    content = content.replace(target, replacement);
    fs.writeFileSync(packageManagerFile, content, 'utf8');
    log.success('Applied electron-builder package-manager command patch (bare command, avoids .CMD path with spaces).');
  } catch (err) {
    log.error(`Failed to patch electron-builder package-manager command: ${err.message}`);
  }
}

checkIconAssets();
patchCollector();
patchPackageManagerCommand();

console.log('\n\x1b[32m✔ [SUCCESS] Postinstall checks completed.\x1b[0m\n');
