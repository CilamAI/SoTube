const binaries = require('./binaries');
const storage = require('./storage');
const search = require('./search');
const trim = require('./trim');
const download = require('./download');

let electron = {};
try { electron = require('electron'); } catch (_) { }
const shell = electron.shell;

function hasActiveDownloads() {
  try {
    if (download.activeJobs && download.activeJobs.size > 0) return true;
    if (trim.activeTrimJobs && trim.activeTrimJobs.size > 0) return true;
  } catch (_) { }
  return false;
}

function getActiveDownloadsCount() {
  let count = 0;
  try { count += (download.activeJobs ? download.activeJobs.size : 0); } catch (_) { }
  try { count += (trim.activeTrimJobs ? trim.activeTrimJobs.size : 0); } catch (_) { }
  return count;
}

function register(ipcMain) {
  if (!ipcMain) return;

  const safeHandle = (channel, handler) => {
    try {
      if (ipcMain && typeof ipcMain.removeHandler === 'function') {
        ipcMain.removeHandler(channel);
      }
    } catch (_) { }
    try {
      if (ipcMain && typeof ipcMain.handle === 'function') {
        ipcMain.handle(channel, handler);
      }
    } catch (_) { }
  };

  const safeOn = (channel, listener) => {
    try {
      if (ipcMain && typeof ipcMain.removeAllListeners === 'function') {
        ipcMain.removeAllListeners(channel);
      }
    } catch (_) { }
    try {
      if (ipcMain && typeof ipcMain.on === 'function') {
        ipcMain.on(channel, listener);
      }
    } catch (_) { }
  };

  download.downloadChannels.forEach((ch) => {
    safeHandle(ch, download.handleDownload);
    safeOn(ch, (event, payload) => download.handleDownload(event, payload));
  });

  ['1440p', '1080p', '720p', '480p'].forEach((res) => {
    const handler = (event, payload = {}) => {
      const p = typeof payload === 'string' ? { url: payload } : { ...payload };
      if (!p.format) p.format = res;
      return download.handleDownload(event, p);
    };
    [`video:${res}`, `video:download:${res}`, `download:${res}`].forEach((ch) => {
      safeHandle(ch, handler);
      safeOn(ch, handler);
    });
  });

  download.cancelChannels.forEach((ch) => {
    safeOn(ch, (_e, id) => download.cancelJob(id));
    safeHandle(ch, (_e, id) => download.cancelJob(id));
  });

  safeHandle('video:get-downloads-dir', () => storage.getDefaultDownloadDir());
  safeHandle('downloads:get-path', () => storage.getDefaultDownloadDir());
  safeHandle('downloads:open', () => {
    try {
      if (shell) shell.openPath(storage.getDefaultDownloadDir());
      return true;
    } catch (_) {
      return false;
    }
  });
  safeOn('downloads:open', () => {
    try {
      if (shell) shell.openPath(storage.getDefaultDownloadDir());
    } catch (_) { }
  });
  safeOn('downloads', () => {
    try {
      if (shell) shell.openPath(storage.getDefaultDownloadDir());
    } catch (_) { }
  });
  safeHandle('downloads', () => {
    try {
      if (shell) shell.openPath(storage.getDefaultDownloadDir());
      return true;
    } catch (_) {
      return false;
    }
  });

  safeHandle('downloads:has-active', () => hasActiveDownloads());
  safeHandle('downloads:active-count', () => getActiveDownloadsCount());

  safeHandle('video:open-folder', storage.handleOpenFolder);
  safeHandle('video:search', search.handleVideoSearch);
  safeHandle('trim:pick-file', trim.handleTrimPickFile);
  safeHandle('trim:start', trim.handleTrimStart);
  safeHandle('trim:cancel', trim.handleTrimCancel);
}

module.exports = {
  ...binaries,
  ...storage,
  ...search,
  ...trim,
  ...download,
  hasActiveDownloads,
  getActiveDownloadsCount,
  register
};
