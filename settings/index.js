const path = require('path');
const fs = require('fs');

let defaults = null;
let filePath = null;

function getDefaultSettings() {
  if (defaults) return { ...defaults };
  try {
    const file = path.join(__dirname, 'default.json');
    defaults = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    defaults = {
      theme: 'dark',
      format: '1080p',
      location: '',
      subtitles: true,
      subtitleLangs: ['English'],
      audioTracks: false,
      notify: true,
      parallel: 2,
      language: 'English',
      cookies: false
    };
  }
  return { ...defaults };
}

function getSettingsFilePath() {
  if (filePath) return filePath;
  try {
    const { app } = require('electron');
    if (app && typeof app.getPath === 'function') {
      filePath = path.join(app.getPath('userData'), 'settings.json');
      return filePath;
    }
  } catch (_) { }
  try {
    filePath = path.join(__dirname, '.settings.json');
  } catch (_) { }
  return filePath;
}

function fileStorage() {
  const file = getSettingsFilePath();
  const store = {
    getItem(k) {
      try {
        if (!file || !fs.existsSync(file)) return null;
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        return data && typeof data === 'object' ? (data[k] ?? null) : null;
      } catch (_) {
        return null;
      }
    },
    setItem(k, v) {
      try {
        if (!file) return;
        let data = {};
        try {
          if (fs.existsSync(file)) data = JSON.parse(fs.readFileSync(file, 'utf8')) || {};
        } catch (_) { }
        data[k] = v;
        fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
      } catch (_) { }
    },

    removeItem(k) {
      try {
        if (!file || !fs.existsSync(file)) return;
        const data = JSON.parse(fs.readFileSync(file, 'utf8')) || {};
        delete data[k];
        fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
      } catch (_) { }
    }
  };
  return store;
}

function defaultStorage() {
  return fileStorage();
}

function getStorage(storage) {
  return storage && typeof storage.getItem === 'function' ? storage : defaultStorage();
}

function loadSettings(storage) {
  const base = getDefaultSettings();
  const store = getStorage(storage);
  try {
    const raw = store.getItem('sotube-settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...base, ...parsed };
    }
  } catch (_) { }
  return { ...base };
}

function saveSettings(settings, storage) {
  const store = getStorage(storage);
  const merged = { ...getDefaultSettings(), ...(settings || {}) };
  try {
    store.setItem('sotube-settings', JSON.stringify(merged));
  } catch (_) { }
  return merged;
}

function resetSettings(storage) {
  const store = getStorage(storage);
  try {
    store.removeItem('sotube-settings');
  } catch (_) { }
  return getDefaultSettings();
}

function getWindowState(storage) {
  const store = getStorage(storage);
  try {
    const raw = store.getItem('sotube-window-state');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (_) { }
  return null;
}

function saveWindowState(state, storage) {
  const store = getStorage(storage);
  try {
    store.setItem('sotube-window-state', JSON.stringify(state || {}));
  } catch (_) { }
  return state || {};
}

module.exports = {
  getDefaultSettings,
  loadSettings,
  saveSettings,
  resetSettings,
  getWindowState,
  saveWindowState
};
