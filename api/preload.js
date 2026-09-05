const { contextBridge, ipcRenderer, webUtils, webFrame } = require('electron');
const settingsModule = require('../settings');

try {
  webFrame.setVisualZoomLevelLimits(1, 1);
  webFrame.setZoomFactor(1);
} catch (_) {}

const trimApi = {
  pickFile: () => ipcRenderer.invoke('trim:pick-file'),
  start: (payload) => ipcRenderer.invoke('trim:start', payload),
  cancel: (id) => ipcRenderer.invoke('trim:cancel', id),
  getPathForFile: (file) => (webUtils && typeof webUtils.getPathForFile === 'function' ? webUtils.getPathForFile(file) : (file?.path || '')),
  openFolder: (filePath) => ipcRenderer.invoke('video:open-folder', filePath),
  onProgress: (callback) => {
    const l = (_e, d) => callback(d);
    ipcRenderer.on('trim:progress', l);
    return () => ipcRenderer.removeListener('trim:progress', l);
  },
  onCompleted: (callback) => {
    const l = (_e, d) => callback(d);
    ipcRenderer.on('trim:completed', l);
    return () => ipcRenderer.removeListener('trim:completed', l);
  },
  onCancelled: (callback) => {
    const l = (_e, d) => callback(d);
    ipcRenderer.on('trim:cancelled', l);
    return () => ipcRenderer.removeListener('trim:cancelled', l);
  },
  onError: (callback) => {
    const l = (_e, d) => callback(d);
    ipcRenderer.on('trim:error', l);
    return () => ipcRenderer.removeListener('trim:error', l);
  }
};

const cancelHandler = (jobId) => {
  try { ipcRenderer.send('video:cancel', jobId); } catch (_) { }
  try { ipcRenderer.send('download:cancel', jobId); } catch (_) { }
  try { ipcRenderer.send('ipc:cancel', jobId); } catch (_) { }
  try { ipcRenderer.send('cancel', jobId); } catch (_) { }
  return ipcRenderer.invoke('video:cancel', jobId);
};

const makeCancelListener = (callback) => {
  const listener = (_e, data) => callback(data);
  const channels = [
    'video:cancelled',
    'download:cancelled',
    'convert:cancelled',
    'video:cancel',
    'download:cancel',
    'ipc:cancel',
    'ipc:cancelled',
    'cancelled',
    'cancel'
  ];
  channels.forEach((ch) => ipcRenderer.on(ch, listener));
  return () => {
    channels.forEach((ch) => ipcRenderer.removeListener(ch, listener));
  };
};

const makeProgressListener = (callback) => {
  const listener = (_e, data) => callback(data);
  const channels = ['video:progress', 'download:progress', 'convert:progress'];
  channels.forEach((ch) => ipcRenderer.on(ch, listener));
  return () => {
    channels.forEach((ch) => ipcRenderer.removeListener(ch, listener));
  };
};

const makeCompletedListener = (callback) => {
  const listener = (_e, data) => callback(data);
  const channels = ['video:completed', 'download:completed', 'convert:completed'];
  channels.forEach((ch) => ipcRenderer.on(ch, listener));
  return () => {
    channels.forEach((ch) => ipcRenderer.removeListener(ch, listener));
  };
};

const makeErrorListener = (callback) => {
  const listener = (_e, data) => callback(data);
  const channels = ['video:error', 'download:error', 'convert:error'];
  channels.forEach((ch) => ipcRenderer.on(ch, listener));
  return () => {
    channels.forEach((ch) => ipcRenderer.removeListener(ch, listener));
  };
};

const makeMetaListener = (callback) => {
  const listener = (_e, data) => callback(data);
  ipcRenderer.on('video:meta', listener);
  return () => {
    ipcRenderer.removeListener('video:meta', listener);
  };
};

const videoApi = {
  search: (query) => ipcRenderer.invoke('video:search', query),
  download: (payload) => ipcRenderer.invoke('video:download', payload),
  convert: (payload) => ipcRenderer.invoke('video:convert', payload),
  downloadVideo: (payload) => ipcRenderer.invoke('video:download', payload),
  convertVideo: (payload) => ipcRenderer.invoke('video:convert', payload),
  downloadConvertVideo: (payload) => ipcRenderer.invoke('video:download', payload),
  downloadConvert: (payload) => ipcRenderer.invoke('video:download', payload),
  download1440p: (payload) => ipcRenderer.invoke('video:1440p', payload),
  download1080p: (payload) => ipcRenderer.invoke('video:1080p', payload),
  download720p: (payload) => ipcRenderer.invoke('video:720p', payload),
  download480p: (payload) => ipcRenderer.invoke('video:480p', payload),
  video1440p: (payload) => ipcRenderer.invoke('video:1440p', payload),
  video1080p: (payload) => ipcRenderer.invoke('video:1080p', payload),
  video720p: (payload) => ipcRenderer.invoke('video:720p', payload),
  video480p: (payload) => ipcRenderer.invoke('video:480p', payload),
  cancel: cancelHandler,
  ipcCancel: cancelHandler,
  cancelIpc: cancelHandler,
  cancelled: cancelHandler,
  cancelDownload: cancelHandler,
  cancelVideo: cancelHandler,
  cancelConvert: cancelHandler,
  cancelDownloadConvert: cancelHandler,
  cancelDownloadConvertVideo: cancelHandler,
  openFolder: (filePath) => ipcRenderer.invoke('video:open-folder', filePath),
  openDownloads: () => ipcRenderer.send('tray:downloads'),
  getDownloadsDir: () => ipcRenderer.invoke('video:get-downloads-dir'),
  onProgress: makeProgressListener,
  onCompleted: makeCompletedListener,
  onCancelled: makeCancelListener,
  onCancel: makeCancelListener,
  onError: makeErrorListener,
  onMeta: makeMetaListener
};

const ipcApi = {
  cancel: cancelHandler,
  ipcCancel: cancelHandler,
  cancelIpc: cancelHandler,
  cancelled: cancelHandler,
  cancelDownload: cancelHandler,
  cancelVideo: cancelHandler,
  cancelConvert: cancelHandler,
  download: (payload) => ipcRenderer.invoke('video:download', payload),
  convert: (payload) => ipcRenderer.invoke('video:convert', payload),
  downloadVideo: (payload) => ipcRenderer.invoke('video:download', payload),
  convertVideo: (payload) => ipcRenderer.invoke('video:convert', payload),
  downloadConvert: (payload) => ipcRenderer.invoke('video:download', payload),
  downloadConvertVideo: (payload) => ipcRenderer.invoke('video:download', payload),
  download1440p: (payload) => ipcRenderer.invoke('video:1440p', payload),
  download1080p: (payload) => ipcRenderer.invoke('video:1080p', payload),
  download720p: (payload) => ipcRenderer.invoke('video:720p', payload),
  download480p: (payload) => ipcRenderer.invoke('video:480p', payload),
  video1440p: (payload) => ipcRenderer.invoke('video:1440p', payload),
  video1080p: (payload) => ipcRenderer.invoke('video:1080p', payload),
  video720p: (payload) => ipcRenderer.invoke('video:720p', payload),
  video480p: (payload) => ipcRenderer.invoke('video:480p', payload),
  onProgress: makeProgressListener,
  onCompleted: makeCompletedListener,
  onCancelled: makeCancelListener,
  onCancel: makeCancelListener,
  onError: makeErrorListener,
  onMeta: makeMetaListener
};

const notifyApi = {
  completed: (info) => ipcRenderer.invoke('notify:completed', info || {})
};

const sotubeApi = {
  versions: {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron
  },
  getTheme: () => ipcRenderer.invoke('app:get-theme'),
  i18n: {
    getStrings: (lang) => ipcRenderer.invoke('i18n:get-strings', lang)
  },
  video: videoApi,
  ipc: ipcApi,
  trim: trimApi,
  download: (payload) => ipcRenderer.invoke('video:download', payload),
  downloadVideo: (payload) => ipcRenderer.invoke('video:download', payload),
  convert: (payload) => ipcRenderer.invoke('video:convert', payload),
  convertVideo: (payload) => ipcRenderer.invoke('video:convert', payload),
  downloadConvertVideo: (payload) => ipcRenderer.invoke('video:download', payload),
  downloadConvert: (payload) => ipcRenderer.invoke('video:download', payload),
  download1440p: (payload) => ipcRenderer.invoke('video:1440p', payload),
  download1080p: (payload) => ipcRenderer.invoke('video:1080p', payload),
  download720p: (payload) => ipcRenderer.invoke('video:720p', payload),
  download480p: (payload) => ipcRenderer.invoke('video:480p', payload),
  video1440p: (payload) => ipcRenderer.invoke('video:1440p', payload),
  video1080p: (payload) => ipcRenderer.invoke('video:1080p', payload),
  video720p: (payload) => ipcRenderer.invoke('video:720p', payload),
  video480p: (payload) => ipcRenderer.invoke('video:480p', payload),
  cancel: cancelHandler,
  ipcCancel: cancelHandler,
  cancelIpc: cancelHandler,
  cancelled: cancelHandler,
  cancelDownload: cancelHandler,
  cancelVideo: cancelHandler,
  cancelConvert: cancelHandler,
  cancelDownloadConvert: cancelHandler,
  cancelDownloadConvertVideo: cancelHandler,
  onProgress: makeProgressListener,
  onCompleted: makeCompletedListener,
  onCancelled: makeCancelListener,
  onCancel: makeCancelListener,
  onError: makeErrorListener,
  onMeta: makeMetaListener,
  notify: notifyApi,
  notifyCompleted: (info) => ipcRenderer.invoke('notify:completed', info || {}),
  openDownloads: () => {
    try { ipcRenderer.send('tray:downloads'); } catch (_) { }
    try { ipcRenderer.send('downloads:open'); } catch (_) { }
    try { ipcRenderer.send('downloads'); } catch (_) { }
    try { ipcRenderer.invoke('downloads:open'); } catch (_) { }
  },
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  getDownloadsDir: () => ipcRenderer.invoke('video:get-downloads-dir'),
  hasActiveDownloads: () => ipcRenderer.invoke('downloads:has-active'),
  getActiveDownloadsCount: () => ipcRenderer.invoke('downloads:active-count'),
  close: () => ipcRenderer.send('app:close'),
  quit: () => ipcRenderer.send('app:quit'),
  closeSoTube: () => ipcRenderer.send('app:close'),
  windowControls: {
    minimize: () => ipcRenderer.send('window:minimize'),
    toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
    close: () => ipcRenderer.send('window:close'),
    setOverlay: (colors) => ipcRenderer.send('window:set-overlay', colors),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
    onMaximizeChange: (callback) => {
      const l = (_e, maximized) => { try { callback(maximized); } catch (_) { } };
      ipcRenderer.on('window:maximized', l);
      return () => ipcRenderer.removeListener('window:maximized', l);
    }
  },
  tray: {
    open: () => ipcRenderer.send('tray:open'),
    downloads: () => ipcRenderer.send('tray:downloads'),
    quit: () => ipcRenderer.send('tray:quit'),
    close: () => ipcRenderer.send('tray:close'),
    hide: () => ipcRenderer.send('tray:hide'),
    isWindowVisible: () => ipcRenderer.invoke('tray:is-window-visible'),
    notifyTheme: (theme) => ipcRenderer.send('settings:theme-changed', theme),
    onTheme: (callback) => {
      const l = (_e, theme) => { try { callback(theme); } catch (_) { } };
      ipcRenderer.on('tray:theme', l);
      return () => ipcRenderer.removeListener('tray:theme', l);
    },
    onWindowState: (callback) => {
      const l = (_e, visible) => { try { callback(visible); } catch (_) { } };
      ipcRenderer.on('tray:window-state', l);
      return () => ipcRenderer.removeListener('tray:window-state', l);
    }
  },
  dialog: {
    quitConfirm: () => ipcRenderer.send('dialog:quit-confirm'),
    quitCancel: () => ipcRenderer.send('dialog:quit-cancel'),
    onTheme: (callback) => {
      const l = (_e, theme) => { try { callback(theme); } catch (_) { } };
      ipcRenderer.on('dialog:theme', l);
      return () => ipcRenderer.removeListener('dialog:theme', l);
    }
  },
  settings: {
    getDefaults: () => settingsModule.getDefaultSettings(),
    load: () => settingsModule.loadSettings(),
    save: (s) => settingsModule.saveSettings(s),
    reset: () => settingsModule.resetSettings()
  }
};

contextBridge.exposeInMainWorld('sotube', sotubeApi);
try {
  contextBridge.exposeInMainWorld('electronAPI', sotubeApi);
} catch (_) { }
