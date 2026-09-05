const path = require('path');
const fs = require('fs');

let electron = {};
try { electron = require('electron'); } catch (_) {}
const app = electron.app;
const shell = electron.shell;

function getDefaultDownloadDir() {
  try {
    if (app && typeof app.getPath === 'function') {
      return app.getPath('downloads');
    }
  } catch (_) { }
  return path.join(process.env.USERPROFILE || process.env.HOME || '.', 'Downloads');
}

async function handleOpenFolder(_e, filePath) {
  try {
    const target = filePath || (app && typeof app.getPath === 'function' ? app.getPath('downloads') : getDefaultDownloadDir());
    if (target && fs.existsSync(target)) {
      const stat = fs.statSync(target);
      if (stat.isDirectory()) {
        if (shell) shell.openPath(target);
      } else {
        if (shell) shell.showItemInFolder(target);
      }
      return true;
    }
  } catch (_) { }
  return false;
}

function registerMediaProtocol(protocol, net, url) {
  try {
    if (!protocol || typeof protocol.handle !== 'function') return;
    protocol.handle('media-stream', (request) => {
      try {
        const raw = request.url.replace(/^media-stream:\/\//, '');
        const decoded = decodeURIComponent(raw);
        return net.fetch(url.pathToFileURL(decoded).toString());
      } catch (_) {
        return new Response('Media load failed', { status: 500 });
      }
    });
  } catch (_) { }
}

module.exports = {
  getDefaultDownloadDir,
  handleOpenFolder,
  registerMediaProtocol
};
