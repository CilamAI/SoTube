process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

const { app, BrowserWindow, Tray, Menu, nativeImage, screen, ipcMain, nativeTheme, Notification, shell, dialog, protocol, net, powerSaveBlocker } = require('electron');

if (powerSaveBlocker) {
  try { powerSaveBlocker.start('prevent-app-suspension'); } catch (_) { }
}

try { app.setAppUserModelId('com.sotube.app'); } catch (_) { }

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    try { showMainWindow(); } catch (_) { }
  });
}

app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
const path = require('path');
const fs = require('fs');
const url = require('url');
const settingsManager = require('./settings');
const convertApi = require('./convertapi');
const { activeJobs, FFMPEG_BIN, getDefaultDownloadDir, hasActiveDownloads } = convertApi;

process.on('uncaughtException', (err) => {
  console.error('[MAIN] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[MAIN] Unhandled Rejection:', reason);
});

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media-stream',
    privileges: {
      bypassCSP: true,
      stream: true,
      standard: true,
      secure: true,
      supportFetchAPI: true
    }
  }
]);

function getLocalesDir() {
  try {
    if (app.isPackaged) return path.join(process.resourcesPath, 'locales');
  } catch (_) { }
  return path.join(__dirname, 'locales');
}

function loadLocaleStrings(lang) {
  const sanitize = (s) => String(s || 'en').toLowerCase().replace(/[^a-z-]/g, '').slice(0, 5) || 'en';
  const read = (code) => {
    try {
      const f = path.join(getLocalesDir(), code + '.json');
      if (fs.existsSync(f)) {
        const data = JSON.parse(fs.readFileSync(f, 'utf8'));
        if (data && typeof data === 'object') return data;
      }
    } catch (_) { }
    return null;
  };
  const code = sanitize(lang);
  return read(code) || read(code.split('-')[0]) || read('en') || {};
}

let mainWindow = null;
let splashWindow = null;
let tray = null;
let trayPopup = null;
let quitDialog = null;
let isQuitting = false;
let trayBalloonShown = false;

function createSplashWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) return splashWindow;
  splashWindow = new BrowserWindow({
    width: 128,
    height: 128,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    icon: getWindowIconPath(),
    webPreferences: {
      sandbox: true,
      contextIsolation: true
    }
  });
  splashWindow.loadFile(path.join(__dirname, 'pages', 'splash.html'));
  splashWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.show();
  });
  splashWindow.on('closed', () => {
    splashWindow = null;
  });
  return splashWindow;
}

function closeSplash() {
  try {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
  } catch (_) { }
}

function getWindowIconPath() {
  const icoInAssets = path.join(__dirname, 'assets', 'icon.ico');
  if (fs.existsSync(icoInAssets)) return icoInAssets;
  return path.join(__dirname, 'icon.ico');
}

function getSavedTheme() {
  try {
    const s = settingsManager.loadSettings();
    return s && s.theme ? s.theme : (nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
  } catch (_) {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  }
}

function broadcastTheme(theme) {
  try {
    if (trayPopup && !trayPopup.isDestroyed()) trayPopup.webContents.send('tray:theme', theme);
  } catch (_) { }
  try {
    if (quitDialog && !quitDialog.isDestroyed()) quitDialog.webContents.send('dialog:theme', theme);
  } catch (_) { }
}

function ensureVisibleBounds(bounds) {
  if (!bounds || typeof bounds.width !== 'number' || typeof bounds.height !== 'number') return null;
  try {
    const displays = screen.getAllDisplays();
    const visible = displays.some((d) => {
      const a = d.workArea;
      const oX = Math.max(bounds.x, a.x);
      const oY = Math.max(bounds.y, a.y);
      return oX < a.x + a.width && oY < a.y + a.height;
    });
    if (!visible) return null;
  } catch (_) { }
  return bounds;
}

function getTrayIconPath() {
  if (process.platform === 'win32') {
    const ico = path.join(__dirname, 'assets', 'icon.ico');
    if (fs.existsSync(ico)) return ico;
    const rootIco = path.join(__dirname, 'icon.ico');
    if (fs.existsSync(rootIco)) return rootIco;
  }
  const png = path.join(__dirname, 'assets', 'icon.png');
  if (fs.existsSync(png)) return png;
  const rootPng = path.join(__dirname, 'icon.png');
  if (fs.existsSync(rootPng)) return rootPng;
  return getWindowIconPath();
}

function getPreloadPath() {
  const apiPreload = path.join(__dirname, 'api', 'preload.js');
  if (fs.existsSync(apiPreload)) return apiPreload;
  return path.join(__dirname, 'preload.js');
}

function showMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  } else {
    createWindow();
  }
}

function toggleMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    showMainWindow();
  }
}

function quitApp() {
  isQuitting = true;
  try {
    if (activeJobs) {
      for (const [jobId] of activeJobs.entries()) {
        try { convertApi.cancelJob(jobId); } catch (_) { }
      }
    }
    if (convertApi && convertApi.activeTrimJobs) {
      for (const [jobId] of convertApi.activeTrimJobs.entries()) {
        try { convertApi.handleTrimCancel(null, jobId); } catch (_) { }
      }
    }
  } catch (_) { }
  try { closeSplash(); } catch (_) { }
  try { if (quitDialog && !quitDialog.isDestroyed()) quitDialog.destroy(); } catch (_) { }
  try { if (trayPopup && !trayPopup.isDestroyed()) trayPopup.destroy(); } catch (_) { }
  try { if (tray && !tray.isDestroyed()) tray.destroy(); } catch (_) { }
  try { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy(); } catch (_) { }
  app.quit();
  setTimeout(() => {
    try { app.exit(0); } catch (_) { }
  }, 150);
}

function confirmQuitApp() {
  try { hideTrayPopup(); } catch (_) { }
  try { app.focus({ steal: true }); } catch (_) { }

  if (quitDialog && !quitDialog.isDestroyed()) {
    quitDialog.focus();
    return;
  }

  const theme = getSavedTheme();

  quitDialog = new BrowserWindow({
    width: 440,
    height: 180,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    backgroundColor: '#00000000',
    icon: getWindowIconPath(),
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  quitDialog.loadFile(path.join(__dirname, 'pages', 'dialog.html'));

  const revealDialog = () => {
    if (quitDialog && !quitDialog.isDestroyed()) {
      try { quitDialog.webContents.send('dialog:theme', theme); } catch (_) { }
      if (!quitDialog.isVisible()) {
        quitDialog.show();
        quitDialog.focus();
      }
    }
  };

  quitDialog.webContents.on('did-finish-load', revealDialog);
  quitDialog.once('ready-to-show', revealDialog);
  setTimeout(revealDialog, 350);

  quitDialog.on('closed', () => {
    quitDialog = null;
  });
}

function updateTrayMenu() {
  if (!tray || tray.isDestroyed()) return null;
  const isVisible = mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible();
  return Menu.buildFromTemplate([
    { label: isVisible ? 'Hide SoTube' : 'Open SoTube', click: () => toggleMainWindow() },
    { label: 'Open Downloads', click: () => { try { shell.openPath(getDefaultDownloadDir()); } catch (_) { } } },
    { type: 'separator' },
    { label: 'Close SoTube', click: () => confirmQuitApp() }
  ]);
}

let lastTrayBlurTime = 0;

function createTrayPopup() {
  if (trayPopup && !trayPopup.isDestroyed()) return trayPopup;
  trayPopup = new BrowserWindow({
    width: 200,
    height: 122,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    icon: getWindowIconPath(),
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false
    }
  });
  try { trayPopup.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch (_) { }
  trayPopup.loadFile(path.join(__dirname, 'pages', 'tray.html'));
  trayPopup.webContents.on('did-finish-load', () => {
    try {
      const theme = getSavedTheme();
      const isVisible = !!(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible());
      trayPopup.webContents.send('tray:theme', theme);
      trayPopup.webContents.send('tray:window-state', isVisible);
    } catch (_) { }
  });
  trayPopup.on('blur', () => {
    lastTrayBlurTime = Date.now();
    try { hideTrayPopup(); } catch (_) { }
  });
  trayPopup.on('closed', () => { trayPopup = null; });
  return trayPopup;
}

function positionTrayPopup() {
  try {
    if (!trayPopup || trayPopup.isDestroyed()) return;
    const bounds = tray && !tray.isDestroyed() ? tray.getBounds() : null;
    const size = trayPopup.getSize();
    const w = size[0] || 200;
    const h = size[1] || 122;
    let x = null;
    let y = null;
    try {
      const display = bounds && (bounds.x > 0 || bounds.y > 0 || bounds.width > 0)
        ? screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y })
        : screen.getPrimaryDisplay();
      const area = display.workArea;

      if (bounds && (bounds.width > 0 || bounds.height > 0)) {
        x = Math.round(bounds.x + bounds.width / 2 - w / 2);
        if (bounds.y >= area.y + area.height / 2) {
          y = Math.round(bounds.y - h - 6);
        } else if (bounds.y < area.y + 20) {
          y = Math.round(bounds.y + bounds.height + 6);
        } else if (bounds.x < area.x + 20) {
          x = Math.round(bounds.x + bounds.width + 6);
          y = Math.round(bounds.y + bounds.height / 2 - h / 2);
        } else if (bounds.x >= area.x + area.width - 20) {
          x = Math.round(bounds.x - w - 6);
          y = Math.round(bounds.y + bounds.height / 2 - h / 2);
        } else {
          y = Math.round(bounds.y - h - 6);
        }
      } else {
        x = Math.round(area.x + area.width - w - 12);
        y = Math.round(area.y + area.height - h - 12);
      }
      x = Math.max(area.x + 8, Math.min(x, area.x + area.width - w - 8));
      y = Math.max(area.y + 8, Math.min(y, area.y + area.height - h - 8));
    } catch (_) {
      x = null;
      y = null;
    }
    if (x !== null && y !== null) {
      trayPopup.setBounds({ x, y, width: w, height: h });
    }
  } catch (_) { }
}

function showTrayPopup() {
  const popup = createTrayPopup();
  if (!popup || popup.isDestroyed()) return;
  const theme = getSavedTheme();
  const isVisible = !!(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible());
  try {
    popup.webContents.send('tray:theme', theme);
    popup.webContents.send('tray:window-state', isVisible);
  } catch (_) { }
  positionTrayPopup();
  popup.show();
  try { popup.focus(); } catch (_) { }
}

function hideTrayPopup() {
  try {
    if (trayPopup && !trayPopup.isDestroyed() && trayPopup.isVisible()) trayPopup.hide();
  } catch (_) { }
}

function toggleTrayPopup() {
  try {
    if (Date.now() - lastTrayBlurTime < 250) {
      hideTrayPopup();
      return;
    }
    if (trayPopup && !trayPopup.isDestroyed() && trayPopup.isVisible()) hideTrayPopup();
    else showTrayPopup();
  } catch (_) { }
}

function createTray() {
  if (tray && !tray.isDestroyed()) return tray;
  try {
    const iconPath = getTrayIconPath();
    let trayIcon = nativeImage.createFromPath(iconPath);
    try {
      if (!trayIcon.isEmpty() && process.platform === 'win32') {
        const size = trayIcon.getSize();
        if (size.width > 16 || size.height > 16) {
          trayIcon = trayIcon.resize({ width: 16, height: 16, quality: 'best' });
        }
      }
    } catch (_) { }
    if (trayIcon.isEmpty()) {
      tray = new Tray(iconPath);
    } else {
      tray = new Tray(trayIcon);
    }
  } catch (_) {
    try {
      tray = new Tray(getWindowIconPath());
    } catch (_) {
      return null;
    }
  }

  tray.setToolTip('SoTube');
  try { tray.setTitle('SoTube'); } catch (_) { }

  tray.on('click', () => toggleTrayPopup());
  try {
    tray.on('right-click', () => toggleTrayPopup());
  } catch (_) { }
  try {
    tray.on('double-click', () => {
      try { hideTrayPopup(); } catch (_) { }
      showMainWindow();
    });
  } catch (_) { }

  try { createTrayPopup(); } catch (_) { }
  return tray;
}

function createWindow() {
  const userSettings = settingsManager.loadSettings();
  const isLight = userSettings && userSettings.theme === 'light';
  console.log('[WCO] createWindow isLight =', isLight, 'theme =', userSettings && userSettings.theme);

  const savedWindow = settingsManager.getWindowState();
  const savedBounds = ensureVisibleBounds(savedWindow && savedWindow.bounds);

  mainWindow = new BrowserWindow({
    show: false,
    width: (savedBounds && savedBounds.width) || 680,
    height: (savedBounds && savedBounds.height) || 740,
    x: savedBounds ? savedBounds.x : undefined,
    y: savedBounds ? savedBounds.y : undefined,
    minWidth: 460,
    minHeight: 500,
    autoHideMenuBar: true,
    backgroundColor: isLight ? '#f3f3f3' : '#202020',
    titleBarStyle: 'hidden',
    icon: getWindowIconPath(),
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false
    }
  });

  if (savedWindow && savedWindow.maximized) {
    try { mainWindow.maximize(); } catch (_) { }
  }

  let saveTimer = null;
  const persistWindowState = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        if (mainWindow && !mainWindow.isDestroyed()) {
          const maximized = mainWindow.isMaximized();
          settingsManager.saveWindowState({
            maximized,
            bounds: maximized ? mainWindow.getNormalBounds() : mainWindow.getBounds()
          });
        }
      } catch (_) { }
    }, 300);
  };
  mainWindow.on('resize', persistWindowState);
  mainWindow.on('move', persistWindowState);
  mainWindow.on('maximize', persistWindowState);
  mainWindow.on('unmaximize', persistWindowState);

  mainWindow.loadFile(path.join(__dirname, 'pages', 'index.html'));

  let revealed = false;
  const revealMain = () => {
    if (revealed) return;
    revealed = true;
    setTimeout(() => {
      try { closeSplash(); } catch (_) { }
      try {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show();
          mainWindow.focus();
        }
      } catch (_) { }
    }, 700);
  };
  mainWindow.once('ready-to-show', revealMain);
  setTimeout(revealMain, 4500);

  const sendMaxState = () => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('window:maximized', mainWindow.isMaximized());
      }
    } catch (_) { }
  };
  mainWindow.on('maximize', sendMaxState);
  mainWindow.on('unmaximize', sendMaxState);

  mainWindow.webContents.setVisualZoomLevelLimits(1, 1);
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const isCtrlR = input.control && typeof input.key === 'string' && input.key.toLowerCase() === 'r';
    const isF5 = input.key === 'F5';
    const isZoom = input.control && (input.key === '=' || input.key === '+' || input.key === '-' || input.key === '_' || input.key === '0');
    if (isCtrlR || isF5 || isZoom) {
      event.preventDefault();
    }
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      try {
        if (mainWindow && !mainWindow.isDestroyed()) {
          const maximized = mainWindow.isMaximized();
          settingsManager.saveWindowState({
            maximized,
            bounds: maximized ? mainWindow.getNormalBounds() : mainWindow.getBounds()
          });
        }
      } catch (_) { }
      if (typeof hasActiveDownloads === 'function' && hasActiveDownloads()) {
        confirmQuitApp();
        return;
      }
      mainWindow.hide();
      updateTrayMenu();
      if (!trayBalloonShown && tray && !tray.isDestroyed()) {
        trayBalloonShown = true;
        try {
          tray.displayBalloon({
            iconType: 'info',
            title: 'SoTube',
            content: 'SoTube is running in your system tray.'
          });
        } catch (_) { }
      }
      return;
    }
    try { closeSplash(); } catch (_) { }
    try { if (quitDialog && !quitDialog.isDestroyed()) quitDialog.destroy(); } catch (_) { }
    try { if (trayPopup && !trayPopup.isDestroyed()) trayPopup.destroy(); } catch (_) { }
    try { if (tray && !tray.isDestroyed()) tray.destroy(); } catch (_) { }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    app.quit();
  });

  try {
    mainWindow.on('show', () => {
      updateTrayMenu();
      if (trayPopup && !trayPopup.isDestroyed()) {
        try { trayPopup.webContents.send('tray:window-state', true); } catch (_) { }
      }
    });
    mainWindow.on('hide', () => {
      updateTrayMenu();
      if (trayPopup && !trayPopup.isDestroyed()) {
        try { trayPopup.webContents.send('tray:window-state', false); } catch (_) { }
      }
    });
  } catch (_) { }

  return mainWindow;
}

ipcMain.handle('app:get-theme', () => {
  try {
    const s = settingsManager.loadSettings();
    if (s && s.theme) return s.theme;
  } catch (_) { }
  return 'dark';
});
ipcMain.handle('i18n:get-strings', (_e, lang) => loadLocaleStrings(lang));

ipcMain.handle('tray:is-window-visible', () => !!(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()));
ipcMain.on('tray:open', () => { try { hideTrayPopup(); } catch (_) { } toggleMainWindow(); });
ipcMain.on('tray:downloads', () => { try { hideTrayPopup(); } catch (_) { } try { shell.openPath(getDefaultDownloadDir()); } catch (_) { } });
ipcMain.handle('tray:downloads', () => { try { hideTrayPopup(); } catch (_) { } try { shell.openPath(getDefaultDownloadDir()); return true; } catch (_) { return false; } });
ipcMain.on('tray:quit', () => { try { hideTrayPopup(); } catch (_) { } confirmQuitApp(); });
ipcMain.on('tray:close', () => { try { hideTrayPopup(); } catch (_) { } confirmQuitApp(); });
ipcMain.on('tray:hide', () => { try { hideTrayPopup(); } catch (_) { } });

const handleQuitApp = () => quitApp();
ipcMain.on('app:quit', handleQuitApp);
ipcMain.on('app:close', handleQuitApp);
ipcMain.on('sotube:quit', handleQuitApp);
ipcMain.on('sotube:close', handleQuitApp);
ipcMain.on('dialog:quit-confirm', handleQuitApp);

ipcMain.on('dialog:quit-cancel', () => {
  if (quitDialog && !quitDialog.isDestroyed()) {
    try { quitDialog.close(); } catch (_) { }
    quitDialog = null;
  }
});

function showCompletionNotification(info = {}) {
  try {
    if (!Notification.isSupported()) return { success: false, error: 'Notifications not supported' };
    const body = String(info.body || 'Download completed!').slice(0, 200);
    const n = new Notification({ title: String(info.title || 'SoTube').slice(0, 100), body });
    const target = info.filePath;
    n.on('click', () => {
      try {
        if (target && fs.existsSync(target)) {
          const stat = fs.statSync(target);
          if (stat.isDirectory()) shell.openPath(target);
          else shell.showItemInFolder(target);
        } else {
          showMainWindow();
        }
      } catch (_) {
        try { showMainWindow(); } catch (_) { }
      }
    });
    n.show();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err && err.message) || 'Notify failed' };
  }
}

ipcMain.handle('notify:completed', (_e, info) => showCompletionNotification(info));
ipcMain.on('notify:completed', (_e, info) => showCompletionNotification(info));
ipcMain.handle('shell:open-external', (_e, targetUrl) => {
  try {
    if (targetUrl && (targetUrl.startsWith('https://') || targetUrl.startsWith('http://') || targetUrl.startsWith('mailto:'))) {
      shell.openExternal(targetUrl);
      return true;
    }
  } catch (_) { }
  return false;
});
function updateTitleBarOverlay(_theme) {
}

ipcMain.on('settings:theme-changed', (_e, theme) => {
  updateTitleBarOverlay(theme);
  try {
    const s = settingsManager.loadSettings();
    settingsManager.saveSettings({ ...s, theme });
  } catch (_) { }
  broadcastTheme(theme);
});

convertApi.register(ipcMain);

ipcMain.on('window:minimize', (e) => {
  BrowserWindow.fromWebContents(e.sender)?.minimize();
});
ipcMain.on('window:toggle-maximize', (e) => {
  const w = BrowserWindow.fromWebContents(e.sender) || mainWindow;
  if (!w) return;
  if (w.isMaximized()) w.unmaximize();
  else w.maximize();
});
ipcMain.on('window:close', (e) => {
  BrowserWindow.fromWebContents(e.sender)?.close();
});
ipcMain.handle('window:is-maximized', (e) => {
  const w = BrowserWindow.fromWebContents(e.sender) || mainWindow;
  return !!(w && !w.isDestroyed() && w.isMaximized());
});
ipcMain.on('window:set-overlay', () => {
});

app.whenReady().then(() => {
  convertApi.registerMediaProtocol(protocol, net, url);

  createSplashWindow();
  createWindow();
  try { createTray(); } catch (_) { }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else showMainWindow();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  try { if (quitDialog && !quitDialog.isDestroyed()) quitDialog.destroy(); } catch (_) { }
  try { if (trayPopup && !trayPopup.isDestroyed()) trayPopup.destroy(); } catch (_) { }
  try { if (tray && !tray.isDestroyed()) tray.destroy(); } catch (_) { }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
