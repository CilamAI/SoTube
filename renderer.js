window.addEventListener('DOMContentLoaded', async () => {
  const dismissStartup = () => {
    const overlay = document.getElementById('startup-overlay');
    if (!overlay || overlay.classList.contains('hide')) return;
    overlay.classList.add('hide');
    setTimeout(() => overlay.remove(), 450);
  };
  requestAnimationFrame(() => requestAnimationFrame(dismissStartup));
  setTimeout(dismissStartup, 3000);

  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  try {
    set('node-version', window.sotube.versions.node());
    set('chrome-version', window.sotube.versions.chrome());
    set('electron-version', window.sotube.versions.electron());
    set('theme', await window.sotube.getTheme());
  } catch (err) {
    console.error('preload bridge failed:', err);
  }

  window.addEventListener('wheel', (e) => {
    if (e.ctrlKey) e.preventDefault();
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey && (e.key === 'r' || e.key === 'R')) || e.key === 'F5') {
      e.preventDefault();
    }
  });
  const views = {
    home: document.getElementById('view-home'),
    trim: document.getElementById('view-trim'),
    settings: document.getElementById('view-settings'),
    help: document.getElementById('view-help'),
    support: document.getElementById('view-support')
  };

  const updateSegmented = (seg, instant = false) => {
    if (!seg) return;
    let indicator = seg.querySelector('.segmented-indicator');
    const isNew = !indicator;
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'segmented-indicator';
      seg.prepend(indicator);
    }
    const selectedBtn = seg.querySelector('button.selected') || seg.querySelector('button');
    if (selectedBtn && selectedBtn.offsetWidth > 0) {
      if (instant || isNew) {
        indicator.style.transition = 'none';
        indicator.style.transform = `translateX(${selectedBtn.offsetLeft - 2}px)`;
        indicator.style.width = `${selectedBtn.offsetWidth}px`;
        indicator.style.display = 'block';
        void indicator.offsetHeight;
        indicator.style.transition = '';
      } else {
        indicator.style.transform = `translateX(${selectedBtn.offsetLeft - 2}px)`;
        indicator.style.width = `${selectedBtn.offsetWidth}px`;
        indicator.style.display = 'block';
      }
    }
  };
  const updateAllSegmented = (instant = false) => {
    document.querySelectorAll('.segmented').forEach((s) => updateSegmented(s, instant));
  };

  const updateSidebarIndicator = (instant = false) => {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    let indicator = sidebar.querySelector('.sidebar-indicator');
    const isNew = !indicator;
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'sidebar-indicator';
      sidebar.appendChild(indicator);
    }
    const activeItem = sidebar.querySelector('.nav-item.active');
    if (!activeItem) return;

    const sidebarRect = sidebar.getBoundingClientRect();
    const itemRect = activeItem.getBoundingClientRect();
    if (itemRect.height === 0) return;

    const top = itemRect.top - sidebarRect.top + (itemRect.height - 16) / 2;
    const left = itemRect.left - sidebarRect.left;

    if (instant || isNew) {
      indicator.style.transition = 'none';
      indicator.style.transform = `translate(${left}px, ${top}px)`;
      void indicator.offsetHeight;
      indicator.style.transition = '';
    } else {
      indicator.style.transform = `translate(${left}px, ${top}px)`;
    }
  };

  document.querySelectorAll('.segmented').forEach((seg) => {
    seg.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        seg.querySelectorAll('button').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        updateSegmented(seg, false);
      });
    });
  });

  document.querySelectorAll('.nav-item[data-view]').forEach((item) => {
    item.addEventListener('click', () => {
      const name = item.getAttribute('data-view');
      document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));
      item.classList.add('active');
      Object.entries(views).forEach(([key, el]) => {
        if (el) el.hidden = key !== name;
      });
      requestAnimationFrame(() => {
        updateSidebarIndicator(false);
        updateAllSegmented(true);
      });
    });
  });
  window.addEventListener('resize', () => {
    requestAnimationFrame(() => {
      updateSidebarIndicator(true);
      updateAllSegmented(true);
    });
  });
  requestAnimationFrame(() => {
    updateSidebarIndicator(true);
    updateAllSegmented(true);
  });

  const wcMinimize = document.getElementById('wc-minimize');
  const wcMaximize = document.getElementById('wc-maximize');
  const wcClose = document.getElementById('wc-close');
  const setMaxIcon = (maximized) => { if (wcMaximize) wcMaximize.classList.toggle('maximized', !!maximized); };
  if (wcMinimize) wcMinimize.addEventListener('click', () => { try { window.sotube.windowControls.minimize(); } catch (_) { } });
  if (wcClose) wcClose.addEventListener('click', () => { try { window.sotube.windowControls.close(); } catch (_) { } });
  if (wcMaximize) {
    wcMaximize.addEventListener('click', () => { try { window.sotube.windowControls.toggleMaximize(); } catch (_) { } });
    try { window.sotube.windowControls.isMaximized().then(setMaxIcon).catch(() => { }); } catch (_) { }
    try { window.sotube.windowControls.onMaximizeChange(setMaxIcon); } catch (_) { }
  }

  const SETTINGS_KEY = 'sotube-settings';
  const defaultSettings = (window.sotube && window.sotube.settings && typeof window.sotube.settings.getDefaults === 'function')
    ? window.sotube.settings.getDefaults()
    : { theme: 'dark', format: '1080p', location: '', subtitles: true, subtitleLangs: ['English'], audioTracks: false, notify: true, parallel: 2, language: 'English', cookies: false };
  const loadSettings = () => {
    let localData = null;
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) localData = JSON.parse(raw);
    } catch (_) { }

    let preloadData = null;
    if (window.sotube && window.sotube.settings && typeof window.sotube.settings.load === 'function') {
      try { preloadData = window.sotube.settings.load(); } catch (_) { }
    }

    const base = (window.sotube && window.sotube.settings && typeof window.sotube.settings.getDefaults === 'function')
      ? window.sotube.settings.getDefaults()
      : defaultSettings;


    return { ...base, ...(localData || {}), ...(preloadData || {}) };
  };
  const saveSettings = (s) => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (_) { }
    if (window.sotube && window.sotube.settings && typeof window.sotube.settings.save === 'function') {
      try { window.sotube.settings.save(s, localStorage); } catch (_) { }
    }
  };
  let settings = loadSettings();
  const LANG_CODES = { English: 'en', Spanish: 'es', French: 'fr', German: 'de', Russian: 'ru', Korean: 'ko', Turkish: 'tr' };
  let currentStrings = {};
  let langRequest = 0;
  const tr = (key, fallback) => (
    currentStrings && typeof currentStrings[key] === 'string' ? currentStrings[key] : fallback
  );
  const applyLanguage = async () => {
    const my = ++langRequest;
    const code = LANG_CODES[settings.language] || 'en';
    let strings = {};
    try {
      strings = await window.sotube.i18n.getStrings(code);
    } catch (_) { strings = {}; }
    if (my !== langRequest) return;
    currentStrings = strings && typeof strings === 'object' ? strings : {};
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const v = currentStrings[el.getAttribute('data-i18n')];
      if (typeof v === 'string') el.textContent = v;
    });
    document.querySelectorAll('[data-i18n-tip]').forEach((el) => {
      const v = currentStrings[el.getAttribute('data-i18n-tip')];
      if (typeof v === 'string') el.setAttribute('data-tip', v);
    });
    document.querySelectorAll('[data-i18n-tip-desc]').forEach((el) => {
      const v = currentStrings[el.getAttribute('data-i18n-tip-desc')];
      if (typeof v === 'string') el.setAttribute('data-tip-desc', v);
    });
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
      const v = currentStrings[el.getAttribute('data-i18n-ph')];
      if (typeof v === 'string') el.setAttribute('placeholder', v);
    });
    if (locationPath) locationPath.textContent = settings.location || tr('folder.defaultPath', 'Default downloads folder');
    document.querySelectorAll('.download-card').forEach((card) => {
      const status = card.dataset.status;
      if (status) {
        const sub = card.querySelector('.download-sub');
        const pct = parseFloat(card.dataset.percent || '100');
        if (sub) sub.textContent = formatStatusMessage(status, pct);
      }
    });
  };

  const themeButtons = document.querySelectorAll('#theme-segmented button');
  const locationPath = document.getElementById('setting-location-path');
  const folderPicker = document.getElementById('folder-picker');
  const parallelInput = document.getElementById('setting-parallel');
  const openMenus = [];
  const closeAllMenus = () => {
    openMenus.forEach((m) => { if (m) m.hidden = true; });
    document.querySelectorAll('.dropdown.open').forEach((d) => d.classList.remove('open'));
  };
  const wireDropdown = (boxId, btnId, onPick) => {
    const box = document.getElementById(boxId);
    const btn = document.getElementById(btnId);
    const menu = box ? box.querySelector('.dropdown-menu') : null;
    if (menu && !openMenus.includes(menu)) openMenus.push(menu);
    if (btn) btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = menu ? menu.hidden : false;
      closeAllMenus();
      if (menu) {
        menu.hidden = !willOpen;
        if (!willOpen && box) box.classList.add('open');
      }
    });
    if (box) box.querySelectorAll('.dropdown-item').forEach((it) => it.addEventListener('click', (e) => {
      e.stopPropagation();
      onPick(it.dataset.value);
      closeAllMenus();
    }));
  };
  const syncDropdown = (boxId, labelId, value) => {
    const label = document.getElementById(labelId);
    let matchedValue = value;
    if (value === 'MP4 HD') matchedValue = '1080p';
    if (value === 'MP4 SD') matchedValue = '720p';
    if (label) label.textContent = matchedValue;
    document.querySelectorAll('#' + boxId + ' .dropdown-item').forEach((it) =>
      it.classList.toggle('selected', it.dataset.value === matchedValue || it.dataset.value === value));
  };
  document.addEventListener('click', closeAllMenus);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAllMenus(); });

  const syncToggles = () => {
    document.querySelectorAll('.switch input[data-setting]').forEach((t) => {
      t.checked = !!settings[t.dataset.setting];
    });
  };

  const renderSubtitleChips = () => {
    const wrap = document.getElementById('subtitle-chips');
    const addBox = document.getElementById('subtitle-add-dropdown');
    if (!wrap || !addBox) return;
    wrap.querySelectorAll('.chip').forEach((c) => c.remove());
    settings.subtitleLangs.forEach((lang) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      const name = document.createElement('span');
      name.textContent = lang;
      const x = document.createElement('button');
      x.textContent = '×';
      x.setAttribute('aria-label', 'Remove ' + lang);
      x.addEventListener('click', () => {
        settings.subtitleLangs = settings.subtitleLangs.filter((l) => l !== lang);
        saveSettings(settings);
        applySettings();
      });
      chip.appendChild(name);
      chip.appendChild(x);
      wrap.insertBefore(chip, addBox);
    });
  };

  const applySettings = () => {
    const light = settings.theme === 'light';
    document.body.classList.toggle('light', light);
    themeButtons.forEach((b) => b.classList.toggle('selected', b.dataset.value === settings.theme));
    syncDropdown('format-dropdown', 'setting-format-label', settings.format);
    syncDropdown('quick-format-dropdown', 'quick-format-label', settings.format);
    syncDropdown('language-dropdown', 'setting-language-label', settings.language);
    if (parallelInput && document.activeElement !== parallelInput) parallelInput.value = settings.parallel;
    applyLanguage();
    syncToggles();
    renderSubtitleChips();
    try {
      window.sotube.windowControls.setOverlay({
        color: '#00000000',
        symbolColor: light ? '#141c26' : '#f0f4fc'
      });
    } catch (_) { }
    try {
      if (window.sotube && window.sotube.tray && typeof window.sotube.tray.notifyTheme === 'function') {
        window.sotube.tray.notifyTheme(settings.theme);
      }
    } catch (_) { }
    requestAnimationFrame(() => updateAllSegmented(false));
  };

  themeButtons.forEach((b) => b.addEventListener('click', () => {
    settings.theme = b.dataset.value;
    saveSettings(settings);
    applySettings();
  }));
  wireDropdown('format-dropdown', 'setting-format-btn', (v) => {
    settings.format = v;
    saveSettings(settings);
    applySettings();
  });
  wireDropdown('language-dropdown', 'setting-language-btn', (v) => {
    settings.language = v;
    saveSettings(settings);
    applySettings();
  });
  wireDropdown('quick-format-dropdown', 'quick-format-btn', (v) => {
    settings.format = v;
    saveSettings(settings);
    applySettings();
  });
  wireDropdown('subtitle-add-dropdown', 'subtitle-add-btn', (v) => {
    if (!settings.subtitleLangs.includes(v)) settings.subtitleLangs.push(v);
    saveSettings(settings);
    applySettings();
  });

  document.getElementById('location-browse')?.addEventListener('click', () => folderPicker?.click());
  folderPicker?.addEventListener('change', () => {
    const f = folderPicker.files && folderPicker.files[0];
    if (f && f.path) {
      const raw = f.path;
      const idx = Math.max(raw.lastIndexOf('/'), raw.lastIndexOf('\\'));
      settings.location = idx > 0 ? raw.slice(0, idx) : raw;
      saveSettings(settings);
      applySettings();
    }
    folderPicker.value = '';
  });
  document.getElementById('location-default')?.addEventListener('click', () => {
    settings.location = '';
    saveSettings(settings);
    applySettings();
  });

  parallelInput?.addEventListener('change', () => {
    let n = parseInt(parallelInput.value, 10);
    if (isNaN(n)) n = defaultSettings.parallel;
    settings.parallel = Math.min(8, Math.max(1, n));
    saveSettings(settings);
    applySettings();
  });

  document.querySelectorAll('.switch input[data-setting]').forEach((t) => {
    t.addEventListener('change', () => {
      settings[t.dataset.setting] = t.checked;
      saveSettings(settings);
    });
  });

  const urlInput = document.querySelector('.url-input');
  const okBtn = document.querySelector('.ok-btn');
  const emptyState = document.querySelector('.empty-state');
  const recentList = document.getElementById('recent-list');
  const clearRecentBtn = document.querySelector('.clear-btn');
  const RECENTS_KEY = 'sotube-recent-downloads';
  const loadRecentDownloads = () => {
    try {
      return JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]');
    } catch (_) {
      return [];
    }
  };
  const saveRecentDownloads = (list) => {
    try {
      localStorage.setItem(RECENTS_KEY, JSON.stringify(list.slice(0, 50)));
    } catch (_) { }
  };

  let conversionHistory = loadRecentDownloads();
  const contentHeader = document.getElementById('content-header') || document.querySelector('.content-header');

  const updateHistoryView = () => {
    if (!recentList) return;
    if (conversionHistory.length === 0) {
      recentList.hidden = true;
      if (contentHeader && (!searchResultsList || searchResultsList.hidden)) {
        contentHeader.hidden = true;
      }
      if (emptyState) emptyState.hidden = false;
      return;
    }
    if (contentHeader) contentHeader.hidden = false;
    if (sectionTitle && (!searchResultsList || searchResultsList.hidden)) {
      sectionTitle.textContent = tr('recent.title', 'Recent downloads');
      if (clearBtn) clearBtn.hidden = false;
    }
    if (emptyState) emptyState.hidden = true;
    recentList.hidden = false;
  };

  const formatDurationToHMS = (dur) => {
    if (!dur) return '00:00:13';
    const parts = dur.split(':').map((p) => p.trim());
    if (parts.length === 1) return `00:00:${parts[0].padStart(2, '0')}`;
    if (parts.length === 2) return `00:${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    if (parts.length === 3) return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:${parts[2].padStart(2, '0')}`;
    return dur;
  };

  const formatStatusMessage = (status, percent, rawMessage) => {
    if (status === 'completed') return tr('status.completed', 'Download completed!');
    if (status === 'cancelled') return tr('status.cancelled', 'Cancelled');
    if (status === 'starting') return tr('status.starting', 'Initializing download...');
    if (status === 'converting') return tr('status.converting', 'Converting...');
    if (status === 'analyzing') return tr('status.analyzing', 'Analyzing media stream...');
    if (status === 'downloading') {
      const pct = typeof percent === 'number' ? ` ${Math.round(percent)}%` : '';
      return `${tr('status.downloading', 'Downloading')}${pct}`;
    }
    if (status === 'error') return tr('status.error', 'Download failed');
    return rawMessage || '';
  };

  const createCard = (jobId, title, format, thumbnail = '', channel = '', duration = '', size = '') => {
    const isAudio = format.toLowerCase().includes('mp3') || format.toLowerCase().includes('audio');
    const hms = formatDurationToHMS(duration);
    const displaySize = size || '0.83 MB';
    const card = document.createElement('div');
    card.className = 'download-card';
    card.id = 'card-' + jobId;
    card.innerHTML = `
      <div class="download-thumb-box">
        ${thumbnail ? `<img class="download-thumb-img" src="${thumbnail}" alt="" onerror="if(this.src.includes('maxresdefault'))this.src=this.src.replace('maxresdefault','hqdefault');" />` : `<div class="download-thumb-placeholder"><i class="ph ph-video"></i></div>`}
      </div>
      <div class="download-details">
        <div class="download-title">${title}</div>
        <div class="download-sub">
          <span class="sub-channel">${channel || 'YouTube Video'}</span>
          <span class="sub-duration"><i class="ph ph-clock"></i> ${hms}</span>
          <span class="sub-divider">|</span>
          <span class="sub-size">${displaySize}</span>
        </div>
        <div class="download-progress-track">
          <div class="download-progress-fill" style="width: 5%"></div>
        </div>
        <div class="download-tags">
          <span class="download-format-pill">
            <i class="ph ${isAudio ? 'ph-music-notes' : 'ph-play-circle'}"></i>
            <span>${format.toLowerCase()}</span>
          </span>
        </div>
      </div>
      <div class="download-more-wrapper">
        <button class="download-more-btn" title="${tr('card.options', 'Options')}">
          <i class="ph ph-dots-three-vertical"></i>
        </button>
        <div class="download-menu" hidden>
          <div class="download-menu-item btn-open-folder" hidden><i class="ph ph-folder-open"></i> <span data-i18n="card.openFolder">${tr('card.openFolder', 'Open in folder')}</span></div>
          <div class="download-menu-item btn-trim-video" hidden><i class="ph ph-scissors"></i> <span data-i18n="card.trimVideo">${tr('card.trimVideo', 'Trim video')}</span></div>
          <div class="download-menu-item btn-cancel-job"><i class="ph ph-x"></i> <span data-i18n="card.cancel">${tr('card.cancel', 'Cancel')}</span></div>
        </div>
      </div>
    `;

    const moreBtn = card.querySelector('.download-more-btn');
    const menu = card.querySelector('.download-menu');
    moreBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = menu.hidden;
      document.querySelectorAll('.download-menu').forEach((m) => { m.hidden = true; });
      document.querySelectorAll('.download-more-btn').forEach((b) => b.classList.remove('active'));
      menu.hidden = !isHidden;
      if (!menu.hidden) moreBtn.classList.add('active');
    });

    const doCancel = () => {
      menu.hidden = true;
      moreBtn?.classList.remove('active');
      const cancelFn = window.sotube.video?.cancel || window.sotube.cancel || window.sotube.ipc?.cancel;
      if (cancelFn) cancelFn(jobId);
      const sub = card.querySelector('.download-sub');
      if (sub) sub.innerHTML = '<span style="color: var(--text-muted);">Cancelled</span>';
      const fill = card.querySelector('.download-progress-fill');
      if (fill) fill.style.width = '0%';
      const cancelBtn = card.querySelector('.btn-cancel-job');
      if (cancelBtn) cancelBtn.hidden = true;
      const folderBtn = card.querySelector('.btn-open-folder');
      if (folderBtn) folderBtn.hidden = true;
    };

    card.querySelector('.btn-cancel-job')?.addEventListener('click', doCancel);

    recentList.insertBefore(card, recentList.firstChild);
    updateHistoryView();
    return card;
  };

  document.addEventListener('click', () => {
    document.querySelectorAll('.download-menu').forEach((m) => { m.hidden = true; });
    document.querySelectorAll('.download-more-btn').forEach((b) => b.classList.remove('active'));
  });

  const searchResultsList = document.getElementById('search-results-list');
  const sectionTitle = document.getElementById('content-section-title');
  const clearBtn = document.getElementById('content-clear-btn');
  let searchDebounce = null;
  let searchRequest = 0;

  const isDirectUrl = (str) => /^(https?:\/\/|www\.|\/\/|youtube\.com|youtu\.be)/i.test(str.trim());

  const clearSearchResults = () => {
    if (searchResultsList) {
      searchResultsList.hidden = true;
      searchResultsList.innerHTML = '';
    }
    if (sectionTitle) sectionTitle.textContent = tr('recent.title', 'Recent downloads');
    if (clearBtn) clearBtn.hidden = false;
    updateHistoryView();
  };

  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const renderSearchResults = (items, error) => {
    if (!searchResultsList) return;
    searchResultsList.innerHTML = '';

    if (error) {
      searchResultsList.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 40px 20px; font-size: 13px; display: flex; flex-direction: column; align-items: center; gap: 12px;"><span>${tr('search.failed', 'Search failed')}: ${escapeHtml(error)}</span><button class="btn-ghost" id="search-retry" type="button">${tr('search.retry', 'Retry')}</button></div>`;
      document.getElementById('search-retry')?.addEventListener('click', () => {
        if (urlInput) triggerSearch(urlInput.value.trim());
      });
      return;
    }

    if (!items || items.length === 0) {
      searchResultsList.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 40px 0; font-size: 13px;">No results found</div>`;
      return;
    }

    items.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'search-result-card';
      const thumb = escapeHtml(item.thumbnail || '');
      const title = escapeHtml(item.title || 'Untitled');
      const channel = escapeHtml(item.channel || '');
      const duration = escapeHtml(item.duration || '');
      const description = escapeHtml(item.description || '');
      card.innerHTML = `
        <div class="search-thumb-box">
          ${thumb ? `<img class="search-thumb-img" src="${thumb}" alt="" loading="lazy" />` : ''}
          ${duration ? `<span class="search-duration">${duration}</span>` : ''}
        </div>
        <div class="search-meta">
          <div class="search-video-title">${title}</div>
          <div class="search-channel-name">${channel}</div>
          ${description ? `<div class="search-snippet">${description}</div>` : ''}
        </div>
        <div class="search-actions">
          <button class="search-download-btn" title="Download & Convert">
            <i class="ph ph-download-simple"></i>
            <span>Convert</span>
          </button>
        </div>
      `;

      card.addEventListener('click', () => {
        clearSearchResults();
        startConversion({
          url: item.url,
          title: item.title,
          thumbnail: item.thumbnail,
          channel: item.channel,
          duration: item.duration
        });
      });

      searchResultsList.appendChild(card);
    });
  };

  const triggerSearch = async (query) => {
    const my = ++searchRequest;
    if (!query || query.trim().length < 2) return;
    if (contentHeader) contentHeader.hidden = false;
    if (sectionTitle) sectionTitle.textContent = tr('search.results', 'Search results');
    if (clearBtn) clearBtn.hidden = true;
    if (emptyState) emptyState.hidden = true;
    if (recentList) recentList.hidden = true;
    if (searchResultsList) {
      searchResultsList.hidden = false;
      searchResultsList.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 40px 0; font-size: 13px;">${tr('search.searching', 'Searching YouTube…')}</div>`;
    }

    try {
      const res = await window.sotube.video?.search(query);
      if (my !== searchRequest) return;
      if (res && res.success && Array.isArray(res.results)) {
        renderSearchResults(res.results);
      } else {
        renderSearchResults([], (res && res.error) || tr('search.error', 'Could not load results. Check your connection and retry.'));
      }
    } catch (err) {
      if (my === searchRequest) renderSearchResults([], (err && err.message) || tr('search.error', 'Could not load results. Check your connection and retry.'));
    }
  };

  urlInput?.addEventListener('input', () => {
    const val = urlInput.value.trim();
    if (searchDebounce) clearTimeout(searchDebounce);

    if (!val || val.length < 2) {
      clearSearchResults();
      return;
    }

    if (isDirectUrl(val)) {
      clearSearchResults();
      return;
    }

    searchDebounce = setTimeout(() => {
      triggerSearch(val);
    }, 280);
  });

  const startConversion = async (videoInfo = null) => {
    const rawUrl = videoInfo ? videoInfo.url : (urlInput ? urlInput.value.trim() : '');
    if (!rawUrl) {
      if (urlInput) {
        urlInput.focus();
        urlInput.style.borderColor = 'var(--color-red)';
        setTimeout(() => { if (urlInput) urlInput.style.borderColor = ''; }, 1000);
      }
      return;
    }

    if (!videoInfo && !isDirectUrl(rawUrl)) {
      triggerSearch(rawUrl);
      return;
    }

    const format = settings.format || '1080p';
    if (okBtn) okBtn.disabled = true;
    clearSearchResults();

    let title = videoInfo ? videoInfo.title : '';
    let thumbnail = videoInfo ? videoInfo.thumbnail : '';
    let channel = videoInfo ? videoInfo.channel : '';
    let duration = videoInfo ? videoInfo.duration : '';

    const ytMatch = rawUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/i);
    const ytId = ytMatch ? ytMatch[1] : null;

    if (!thumbnail && ytId) {
      thumbnail = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
    }

    if (!title) {
      title = ytId ? `YouTube Video` : rawUrl;
    }

    const pendingJobId = 'job_' + Date.now();
    createCard(pendingJobId, title, format, thumbnail, channel, duration);

    if (ytId) {
      fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${ytId}&format=json`)
        .then((r) => r.ok ? r.json() : null)
        .then((meta) => {
          if (!meta) return;
          const currentCard = document.getElementById('card-' + pendingJobId);
          if (currentCard) {
            if (meta.title) {
              const tEl = currentCard.querySelector('.download-title');
              if (tEl) tEl.textContent = meta.title;
            }
            if (meta.author_name) {
              const chEl = currentCard.querySelector('.sub-channel');
              if (chEl) chEl.textContent = meta.author_name;
            }
            if (meta.thumbnail_url) {
              const tb = currentCard.querySelector('.download-thumb-box');
              if (tb) {
                tb.innerHTML = `<img class="download-thumb-img" src="${meta.thumbnail_url}" alt="" onerror="if(this.src.includes('maxresdefault'))this.src=this.src.replace('maxresdefault','hqdefault');" />`;
              }
            }
          }
        })
        .catch(() => { });
    }

    try {
      const downloadFn = window.sotube.video?.download || window.sotube.video?.convert || window.sotube.download;
      const res = await downloadFn({
        jobId: pendingJobId,
        url: rawUrl,
        format: format,
        location: settings.location,
        title,
        thumbnail,
        channel,
        duration
      });

      if (urlInput) urlInput.value = '';

      if (res && res.success) {
        conversionHistory.unshift(res);
        saveRecentDownloads(conversionHistory);
        if (settings.notify) {
          try {
            const info = {
              title: 'SoTube',
              body: `Downloaded: ${res.fileName || res.title || 'video'} (${res.format || format})`,
              filePath: res.filePath || ''
            };
            if (window.sotube?.notify && typeof window.sotube.notify.completed === 'function') {
              window.sotube.notify.completed(info);
            } else if (typeof window.sotube?.notifyCompleted === 'function') {
              window.sotube.notifyCompleted(info);
            }
          } catch (_) { }
        }
        const pendingCard = document.getElementById('card-' + pendingJobId);
        if (pendingCard) pendingCard.id = 'card-' + res.jobId;

        const card = document.getElementById('card-' + res.jobId);
        if (card) {
          updateCardMetadata(res);
          const fill = card.querySelector('.download-progress-fill');
          if (fill) fill.style.width = '100%';
          const cancelBtn = card.querySelector('.btn-cancel-job');
          if (cancelBtn) cancelBtn.hidden = true;
          const folderBtn = card.querySelector('.btn-open-folder');
          if (folderBtn) {
            folderBtn.hidden = false;
            folderBtn.addEventListener('click', () => {
              window.sotube.video.openFolder(res.filePath);
            });
          }
          const trimBtn = card.querySelector('.btn-trim-video');
          if (trimBtn && res.filePath) {
            trimBtn.hidden = false;
            trimBtn.addEventListener('click', () => {
              if (window.openInTrimmer) window.openInTrimmer(res.filePath, res.title || title);
            });
          }
        }
      } else {
        const card = document.getElementById('card-' + pendingJobId);
        if (card) {
          const sub = card.querySelector('.download-sub');
          const cancelBtn = card.querySelector('.btn-cancel-job');
          if (cancelBtn) cancelBtn.hidden = true;
          const errText = res?.error || res?.message || (res?.code ? `Error code: ${res.code}` : 'Download failed');
          if (sub) sub.innerHTML = `<span style="color: #e74c3c;">Download failed: ${escapeHtml(errText)}</span>`;
          const fill = card.querySelector('.download-progress-fill');
          if (fill) fill.style.width = '0%';
        }
      }
    } catch (err) {
      console.error('Conversion failed:', err);
      const card = document.getElementById('card-' + pendingJobId);
      if (card) {
        const sub = card.querySelector('.download-sub');
        const cancelBtn = card.querySelector('.btn-cancel-job');
        if (cancelBtn) cancelBtn.hidden = true;
        const errText = err.message || (err.code ? `Error code: ${err.code}` : 'Error occurred');
        if (sub) sub.innerHTML = `<span style="color: #e74c3c;">Download failed: ${escapeHtml(errText)}</span>`;
        const fill = card.querySelector('.download-progress-fill');
        if (fill) fill.style.width = '0%';
      }
    } finally {
      if (okBtn) okBtn.disabled = false;
    }
  };

  okBtn?.addEventListener('click', () => {
    if (searchDebounce) clearTimeout(searchDebounce);
    startConversion();
  });
  urlInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      urlInput.value = '';
      if (searchDebounce) clearTimeout(searchDebounce);
      clearSearchResults();
      return;
    }
    if (e.key === 'Enter') {
      if (searchDebounce) clearTimeout(searchDebounce);
      startConversion();
    }
  });

  const updateCardMetadata = (data) => {
    const { jobId, title, thumbnail, channel } = data || {};
    let card = document.getElementById('card-' + jobId);
    if (!card) {
      const allCards = recentList ? recentList.querySelectorAll('.download-card') : [];
      if (allCards.length > 0) card = allCards[0];
    }
    if (!card) return;

    if (title) {
      const tEl = card.querySelector('.download-title');
      if (tEl && (tEl.textContent.startsWith('http') || tEl.textContent.startsWith('YouTube Video'))) {
        tEl.textContent = title;
      }
    }
    if (channel) {
      const chEl = card.querySelector('.sub-channel');
      if (chEl) chEl.textContent = channel;
    }
    if (thumbnail) {
      const tb = card.querySelector('.download-thumb-box');
      if (tb && !tb.querySelector('.download-thumb-img')) {
        tb.innerHTML = `<img class="download-thumb-img" src="${thumbnail}" alt="" onerror="if(this.src.includes('maxresdefault'))this.src=this.src.replace('maxresdefault','hqdefault');" />`;
      }
    }
  };

  window.sotube.video?.onMeta?.(updateCardMetadata);
  window.sotube.video?.onCompleted?.(updateCardMetadata);

  window.sotube.video?.onProgress((data) => {
    const { jobId, percent, message, status } = data;
    let card = document.getElementById('card-' + jobId);
    if (!card) {
      const currentCards = recentList ? recentList.querySelectorAll('.download-card') : [];
      if (currentCards.length > 0) card = currentCards[0];
    }
    if (!card) {
      card = createCard(jobId, urlInput ? (urlInput.value.trim() || 'Downloading video') : 'Downloading video', settings.format);
    }
    updateCardMetadata(data);
    card.dataset.status = status || '';
    if (typeof percent === 'number') card.dataset.percent = percent;
    const fill = card.querySelector('.download-progress-fill');
    const sub = card.querySelector('.download-sub');
    if (fill && typeof percent === 'number') fill.style.width = Math.min(100, Math.max(0, percent)) + '%';
    const displayMsg = formatStatusMessage(status, percent, message);
    if (sub && displayMsg) sub.textContent = displayMsg;
    if (status === 'completed') {
      const cancelBtn = card.querySelector('.btn-cancel-job');
      if (cancelBtn) cancelBtn.hidden = true;
      const folderBtn = card.querySelector('.btn-open-folder');
      if (folderBtn) folderBtn.hidden = false;
    } else if (status === 'cancelled') {
      const cancelBtn = card.querySelector('.btn-cancel-job');
      if (cancelBtn) cancelBtn.hidden = true;
      const folderBtn = card.querySelector('.btn-open-folder');
      if (folderBtn) folderBtn.hidden = true;
      if (sub) sub.innerHTML = `<span style="color: var(--text-muted);">${tr('status.cancelled', 'Cancelled')}</span>`;
      if (fill) fill.style.width = '0%';
    } else if (status === 'error') {
      const cancelBtn = card.querySelector('.btn-cancel-job');
      if (cancelBtn) cancelBtn.hidden = true;
      const folderBtn = card.querySelector('.btn-open-folder');
      if (folderBtn) folderBtn.hidden = true;
      if (sub) {
        const errText = message || data.error || (data.code ? `Error code: ${data.code}` : tr('status.error', 'Download failed'));
        sub.innerHTML = `<span style="color: #e74c3c;">${escapeHtml(errText)}</span>`;
      }
      if (fill) fill.style.width = '0%';
    }
  });

  window.sotube.video?.onCancelled((data) => {
    const { jobId } = data || {};
    const card = document.getElementById('card-' + jobId);
    if (card) {
      const sub = card.querySelector('.download-sub');
      if (sub) sub.innerHTML = '<span style="color: var(--text-muted);">Cancelled</span>';
      const fill = card.querySelector('.download-progress-fill');
      if (fill) fill.style.width = '0%';
      const cancelBtn = card.querySelector('.btn-cancel-job');
      if (cancelBtn) cancelBtn.hidden = true;
      const folderBtn = card.querySelector('.btn-open-folder');
      if (folderBtn) folderBtn.hidden = true;
    }
  });

  window.sotube.video?.onError?.((data) => {
    const { jobId, error, message, code } = data || {};
    const card = document.getElementById('card-' + jobId);
    if (card) {
      const sub = card.querySelector('.download-sub');
      const errText = error || message || (code ? `Error code: ${code}` : 'Download failed');
      if (sub) sub.innerHTML = `<span style="color: #e74c3c;">Download failed: ${escapeHtml(errText)}</span>`;
      const fill = card.querySelector('.download-progress-fill');
      if (fill) fill.style.width = '0%';
      const cancelBtn = card.querySelector('.btn-cancel-job');
      if (cancelBtn) cancelBtn.hidden = true;
      const folderBtn = card.querySelector('.btn-open-folder');
      if (folderBtn) folderBtn.hidden = true;
    }
  });

  clearRecentBtn?.addEventListener('click', () => {
    conversionHistory = [];
    saveRecentDownloads([]);
    if (recentList) recentList.innerHTML = '';
    updateHistoryView();
  });

  conversionHistory.forEach((item) => {
    const card = createCard(
      item.jobId || ('hist_' + Math.random()),
      item.title || 'Video',
      item.format || '1080p',
      item.thumbnail || '',
      item.channel || 'YouTube Video',
      item.duration || '00:00:13',
      item.size || '0.83 MB'
    );
    card.dataset.status = 'completed';
    card.dataset.percent = 100;
    const sub = card.querySelector('.download-sub');
    if (sub) sub.textContent = tr('status.completed', 'Download completed!');
    const fill = card.querySelector('.download-progress-fill');
    if (fill) fill.style.width = '100%';
    const cancelBtn = card.querySelector('.btn-cancel-job');
    if (cancelBtn) cancelBtn.hidden = true;
    const folderBtn = card.querySelector('.btn-open-folder');
    if (folderBtn) {
      folderBtn.hidden = false;
      if (item.filePath) {
        folderBtn.addEventListener('click', () => {
          window.sotube.video?.openFolder(item.filePath);
        });
      }
    }
    const trimBtn = card.querySelector('.btn-trim-video');
    if (trimBtn && item.filePath) {
      trimBtn.hidden = false;
      trimBtn.addEventListener('click', () => {
        if (window.openInTrimmer) window.openInTrimmer(item.filePath, item.title);
      });
    }
  });
  updateHistoryView();

  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    const text = e.dataTransfer.getData('text');
    if (text && text.trim()) {
      if (urlInput) urlInput.value = text.trim();
      startConversion();
    }
  });

  const initTrimmer = () => {
    const trimDropzone = document.getElementById('trim-dropzone');
    const trimFileInput = document.getElementById('trim-file-input');
    const trimBrowseBtn = document.getElementById('trim-browse-btn');
    const trimWorkspace = document.getElementById('trim-workspace');
    const trimFileName = document.getElementById('trim-file-name');
    const trimFileDetails = document.getElementById('trim-file-details');
    const trimChangeFileBtn = document.getElementById('trim-change-file-btn');

    const trimVideo = document.getElementById('trim-video');
    const trimVideoOverlay = document.getElementById('trim-video-overlay');
    const trimOverlayPlayBtn = document.getElementById('trim-overlay-play-btn');
    const trimPlayPauseBtn = document.getElementById('trim-play-pause-btn');
    const trimPlayIcon = document.getElementById('trim-play-icon');
    const trimCurrentTime = document.getElementById('trim-current-time');
    const trimDuration = document.getElementById('trim-duration');
    const trimMuteBtn = document.getElementById('trim-mute-btn');
    const trimVolIcon = document.getElementById('trim-vol-icon');

    const trimTimelineTrack = document.getElementById('trim-timeline-track');
    const trimTimelineRange = document.getElementById('trim-timeline-range');
    const trimTimelineNeedle = document.getElementById('trim-timeline-needle');
    const trimMarkerStart = document.getElementById('trim-marker-start');
    const trimMarkerEnd = document.getElementById('trim-marker-end');

    const trimStartInput = document.getElementById('trim-start-input');
    const trimEndInput = document.getElementById('trim-end-input');
    const trimSetStartBtn = document.getElementById('trim-set-start-btn');
    const trimSetEndBtn = document.getElementById('trim-set-end-btn');
    const trimClipDuration = document.getElementById('trim-clip-duration');
    const trimModeButtons = document.querySelectorAll('#trim-mode-segmented button');

    const trimSubmitBtn = document.getElementById('trim-submit-btn');
    const trimStatusCard = document.getElementById('trim-status-card');
    const trimStatusText = document.getElementById('trim-status-text');
    const trimProgressFill = document.getElementById('trim-progress-fill');
    const trimCancelBtn = document.getElementById('trim-cancel-btn');
    const trimResultActions = document.getElementById('trim-result-actions');
    const trimOpenFolderBtn = document.getElementById('trim-open-folder-btn');
    const trimPlayResultBtn = document.getElementById('trim-play-result-btn');

    if (!trimDropzone || !trimVideo) return;

    let currentFile = null;
    let videoDuration = 0;
    let trimStart = 0;
    let trimEnd = 0;
    let activeTrimJobId = null;
    let lastTrimResult = null;
    let trimMode = 'fast';

    const formatSeconds = (sec) => {
      if (!Number.isFinite(sec) || sec < 0) sec = 0;
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = Math.floor(sec % 60);
      const ms = Math.floor((sec % 1) * 1000);
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      const ss = String(s).padStart(2, '0');
      const mmm = String(ms).padStart(3, '0');
      return `${hh}:${mm}:${ss}.${mmm}`;
    };

    const parseTimeString = (str) => {
      if (!str || typeof str !== 'string') return 0;
      const parts = str.trim().split(':');
      if (parts.length === 3) {
        const h = parseFloat(parts[0]) || 0;
        const m = parseFloat(parts[1]) || 0;
        const s = parseFloat(parts[2]) || 0;
        return (h * 3600) + (m * 60) + s;
      }
      if (parts.length === 2) {
        const m = parseFloat(parts[0]) || 0;
        const s = parseFloat(parts[1]) || 0;
        return (m * 60) + s;
      }
      return parseFloat(str) || 0;
    };

    const formatBytes = (bytes) => {
      if (!bytes || bytes <= 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
    };

    const updateTimelineUI = () => {
      if (!videoDuration || videoDuration <= 0) return;
      const current = trimVideo.currentTime || 0;
      const needlePct = Math.min(100, Math.max(0, (current / videoDuration) * 100));
      const startPct = Math.min(100, Math.max(0, (trimStart / videoDuration) * 100));
      const endPct = Math.min(100, Math.max(0, (trimEnd / videoDuration) * 100));

      if (trimTimelineNeedle) trimTimelineNeedle.style.left = `${needlePct}%`;
      if (trimMarkerStart) trimMarkerStart.style.left = `${startPct}%`;
      if (trimMarkerEnd) trimMarkerEnd.style.left = `${endPct}%`;
      if (trimTimelineRange) {
        trimTimelineRange.style.left = `${startPct}%`;
        trimTimelineRange.style.width = `${Math.max(0, endPct - startPct)}%`;
      }

      if (trimClipDuration) {
        const dur = Math.max(0, trimEnd - trimStart);
        trimClipDuration.textContent = formatSeconds(dur);
      }
    };

    const updatePlayState = () => {
      const isPaused = trimVideo.paused;
      if (trimPlayIcon) {
        trimPlayIcon.className = isPaused ? 'ph ph-play' : 'ph ph-pause';
      }
      if (trimVideoOverlay) {
        trimVideoOverlay.style.display = isPaused ? 'flex' : 'none';
      }
    };

    const loadVideoFile = (fileObj) => {
      if (!fileObj) return;
      currentFile = fileObj;
      if (trimFileName) trimFileName.textContent = fileObj.name || 'video';
      if (trimFileDetails) trimFileDetails.textContent = `Loading... • ${formatBytes(fileObj.size)}`;

      if (fileObj.path) {
        trimVideo.src = 'media-stream://' + encodeURIComponent(fileObj.path);
      } else if (fileObj.rawFile) {
        trimVideo.src = URL.createObjectURL(fileObj.rawFile);
      }

      trimVideo.load();
      if (trimStatusCard) trimStatusCard.hidden = true;
      if (trimResultActions) trimResultActions.hidden = true;
    };

    trimVideo.addEventListener('loadedmetadata', () => {
      videoDuration = trimVideo.duration || 0;
      trimStart = 0;
      trimEnd = videoDuration;

      if (trimDuration) trimDuration.textContent = formatSeconds(videoDuration);
      if (trimCurrentTime) trimCurrentTime.textContent = formatSeconds(0);
      if (trimStartInput) trimStartInput.value = formatSeconds(0);
      if (trimEndInput) trimEndInput.value = formatSeconds(videoDuration);
      if (trimFileDetails) {
        trimFileDetails.textContent = `${formatSeconds(videoDuration).slice(0, 8)} • ${formatBytes(currentFile?.size)}`;
      }

      trimDropzone.hidden = true;
      trimWorkspace.hidden = false;
      updateTimelineUI();
      updatePlayState();
    });

    trimVideo.addEventListener('timeupdate', () => {
      if (trimCurrentTime) trimCurrentTime.textContent = formatSeconds(trimVideo.currentTime);
      updateTimelineUI();

      if (trimVideo.currentTime >= trimEnd && !trimVideo.paused) {
        trimVideo.pause();
        trimVideo.currentTime = trimStart;
        updatePlayState();
      }
    });

    trimVideo.addEventListener('play', updatePlayState);
    trimVideo.addEventListener('pause', updatePlayState);

    const togglePlay = () => {
      if (trimVideo.paused) {
        if (trimVideo.currentTime < trimStart || trimVideo.currentTime >= trimEnd) {
          trimVideo.currentTime = trimStart;
        }
        trimVideo.play();
      } else {
        trimVideo.pause();
      }
    };

    trimPlayPauseBtn?.addEventListener('click', togglePlay);
    trimOverlayPlayBtn?.addEventListener('click', togglePlay);
    trimVideo?.addEventListener('click', togglePlay);

    trimMuteBtn?.addEventListener('click', () => {
      trimVideo.muted = !trimVideo.muted;
      if (trimVolIcon) {
        trimVolIcon.className = trimVideo.muted ? 'ph ph-speaker-slash' : 'ph ph-speaker-high';
      }
    });

    const handleTimelineClick = (e) => {
      if (!videoDuration || !trimTimelineTrack) return;
      const rect = trimTimelineTrack.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      trimVideo.currentTime = pct * videoDuration;
    };

    trimTimelineTrack?.addEventListener('click', (e) => {
      if (e.target === trimMarkerStart || e.target === trimMarkerEnd) return;
      handleTimelineClick(e);
    });

    let activeDragMarker = null;

    const onMouseDownMarker = (markerType) => (e) => {
      e.stopPropagation();
      e.preventDefault();
      activeDragMarker = markerType;
      window.addEventListener('mousemove', onMouseMoveMarker);
      window.addEventListener('mouseup', onMouseUpMarker);
    };

    const onMouseMoveMarker = (e) => {
      if (!activeDragMarker || !videoDuration || !trimTimelineTrack) return;
      const rect = trimTimelineTrack.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const targetSec = pct * videoDuration;

      if (activeDragMarker === 'start') {
        trimStart = Math.min(targetSec, trimEnd - 0.1);
        if (trimStartInput) trimStartInput.value = formatSeconds(trimStart);
        trimVideo.currentTime = trimStart;
      } else if (activeDragMarker === 'end') {
        trimEnd = Math.max(targetSec, trimStart + 0.1);
        if (trimEndInput) trimEndInput.value = formatSeconds(trimEnd);
        trimVideo.currentTime = trimEnd;
      }
      updateTimelineUI();
    };

    const onMouseUpMarker = () => {
      activeDragMarker = null;
      window.removeEventListener('mousemove', onMouseMoveMarker);
      window.removeEventListener('mouseup', onMouseUpMarker);
    };

    trimMarkerStart?.addEventListener('mousedown', onMouseDownMarker('start'));
    trimMarkerEnd?.addEventListener('mousedown', onMouseDownMarker('end'));

    trimSetStartBtn?.addEventListener('click', () => {
      const cur = trimVideo.currentTime || 0;
      trimStart = Math.min(cur, trimEnd - 0.1);
      if (trimStartInput) trimStartInput.value = formatSeconds(trimStart);
      updateTimelineUI();
    });

    trimSetEndBtn?.addEventListener('click', () => {
      const cur = trimVideo.currentTime || 0;
      trimEnd = Math.max(cur, trimStart + 0.1);
      if (trimEndInput) trimEndInput.value = formatSeconds(trimEnd);
      updateTimelineUI();
    });

    trimStartInput?.addEventListener('change', () => {
      const parsed = parseTimeString(trimStartInput.value);
      trimStart = Math.max(0, Math.min(parsed, trimEnd - 0.1));
      trimStartInput.value = formatSeconds(trimStart);
      trimVideo.currentTime = trimStart;
      updateTimelineUI();
    });

    trimEndInput?.addEventListener('change', () => {
      const parsed = parseTimeString(trimEndInput.value);
      trimEnd = Math.min(videoDuration, Math.max(parsed, trimStart + 0.1));
      trimEndInput.value = formatSeconds(trimEnd);
      trimVideo.currentTime = trimEnd;
      updateTimelineUI();
    });

    trimModeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        trimModeButtons.forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        trimMode = btn.dataset.value || 'fast';
      });
    });

    const pickVideoFile = async () => {
      if (window.sotube?.trim?.pickFile) {
        const res = await window.sotube.trim.pickFile();
        if (res && !res.canceled && res.filePath) {
          loadVideoFile({ path: res.filePath, name: res.fileName, size: res.size });
          return;
        }
      }
      trimFileInput?.click();
    };

    trimBrowseBtn?.addEventListener('click', pickVideoFile);
    trimChangeFileBtn?.addEventListener('click', pickVideoFile);

    trimFileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      let filePath = '';
      try {
        filePath = window.sotube?.trim?.getPathForFile ? window.sotube.trim.getPathForFile(file) : (file.path || '');
      } catch (_) { }
      loadVideoFile({ path: filePath, name: file.name, size: file.size, rawFile: file });
      e.target.value = '';
    });

    trimDropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      trimDropzone.classList.add('drag-over');
    });

    trimDropzone?.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      trimDropzone.classList.remove('drag-over');
    });

    trimDropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      trimDropzone.classList.remove('drag-over');
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      let filePath = '';
      try {
        filePath = window.sotube?.trim?.getPathForFile ? window.sotube.trim.getPathForFile(file) : (file.path || '');
      } catch (_) { }
      loadVideoFile({ path: filePath, name: file.name, size: file.size, rawFile: file });
    });

    trimSubmitBtn?.addEventListener('click', async () => {
      if (!currentFile?.path) {
        alert('Please select a local video file from disk to trim.');
        return;
      }
      if (trimEnd <= trimStart) {
        alert('End time must be greater than start time.');
        return;
      }

      trimVideo.pause();
      updatePlayState();

      trimStatusCard.hidden = false;
      trimResultActions.hidden = true;
      trimSubmitBtn.disabled = true;
      if (trimProgressFill) trimProgressFill.style.width = '0%';
      if (trimStatusText) trimStatusText.textContent = 'Preparing trim with FFmpeg...';

      const payload = {
        inputPath: currentFile.path,
        startTime: trimStart,
        endTime: trimEnd,
        mode: trimMode
      };

      try {
        const res = await window.sotube.trim.start(payload);
        trimSubmitBtn.disabled = false;
        if (res?.success) {
          lastTrimResult = res;
          if (trimProgressFill) trimProgressFill.style.width = '100%';
          if (trimStatusText) trimStatusText.innerHTML = `<span style="color: #38a7f6; font-weight: 600;">✓ Trimmed successfully:</span> ${res.fileName || 'video'}`;
          if (trimResultActions) trimResultActions.hidden = false;
        } else if (res?.cancelled) {
          if (trimStatusText) trimStatusText.textContent = 'Trim was cancelled';
        } else {
          if (trimStatusText) trimStatusText.innerHTML = `<span style="color: #ef4444;">Trim failed:</span> ${res?.error || 'Unknown error'}`;
        }
      } catch (err) {
        trimSubmitBtn.disabled = false;
        if (trimStatusText) trimStatusText.innerHTML = `<span style="color: #ef4444;">Error:</span> ${err.message}`;
      }
    });

    window.sotube?.trim?.onProgress?.((data) => {
      if (trimProgressFill && typeof data?.percent === 'number') {
        trimProgressFill.style.width = `${Math.min(100, Math.max(0, data.percent))}%`;
      }
      if (trimStatusText && data?.percent) {
        trimStatusText.textContent = `Trimming video... ${data.percent}%`;
      }
    });

    trimCancelBtn?.addEventListener('click', () => {
      window.sotube?.trim?.cancel?.(activeTrimJobId);
      if (trimStatusText) trimStatusText.textContent = 'Cancelling...';
    });

    trimOpenFolderBtn?.addEventListener('click', () => {
      if (lastTrimResult?.outputPath) {
        window.sotube?.trim?.openFolder?.(lastTrimResult.outputPath);
      }
    });

    trimPlayResultBtn?.addEventListener('click', () => {
      if (lastTrimResult?.outputPath) {
        loadVideoFile({
          path: lastTrimResult.outputPath,
          name: lastTrimResult.fileName || 'trimmed.mp4',
          size: 0
        });
      }
    });

    window.openInTrimmer = (filePath, name) => {
      document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));
      document.querySelector('.nav-item[data-view="trim"]')?.classList.add('active');
      Object.entries(views).forEach(([key, el]) => {
        if (el) el.hidden = key !== 'trim';
      });
      requestAnimationFrame(() => updateSidebarIndicator(false));
      loadVideoFile({ path: filePath, name: name || 'video.mp4', size: 0 });
    };
  };

  try { initTrimmer(); } catch (err) { console.error('trimmer init failed:', err); }
  try { applySettings(); } catch (err) { console.error('settings init failed:', err); }

  const initSupport = () => {
    const openDownloadsBtn = document.getElementById('btn-support-open-downloads');
    if (openDownloadsBtn) {
      openDownloadsBtn.addEventListener('click', () => {
        try {
          if (window.sotube?.openDownloads) {
            window.sotube.openDownloads();
          }
        } catch (_) { }
      });
    }

    const issuesBtn = document.getElementById('btn-support-issues');
    if (issuesBtn) {
      issuesBtn.addEventListener('click', () => {
        try {
          if (window.sotube?.openExternal) {
            window.sotube.openExternal('https://github.com');
          }
        } catch (_) { }
      });
    }

    const discussionsBtn = document.getElementById('btn-support-discussions');
    if (discussionsBtn) {
      discussionsBtn.addEventListener('click', () => {
        try {
          if (window.sotube?.openExternal) {
            window.sotube.openExternal('https://github.com');
          }
        } catch (_) { }
      });
    }

    document.querySelectorAll('#view-support .faq-question').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.faq-item');
        if (item) item.classList.toggle('open');
      });
    });
  };

  try { initSupport(); } catch (err) { console.error('support init failed:', err); }
});
