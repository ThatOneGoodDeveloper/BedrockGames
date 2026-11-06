(function () {
  'use strict';

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => [...(ctx || document).querySelectorAll(sel)];
  const root = document.documentElement;
  const BUILD = '{{BUILD}}';
  const FAVICON = '{{FAVICON}}';
  const HEART_SVG = '{{HEART}}';
  const APP_ICONS = {{APPICONS}};
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // ─── Storage ───
  function load(key, fallback) {
    try { const v = localStorage.getItem('bg-' + key); return v !== null ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  }
  function save(key, val) {
    try { localStorage.setItem('bg-' + key, JSON.stringify(val)); } catch {}
  }

  const ICONS = {
    google:    'https://www.google.com/favicon.ico',
    drive:     'https://ssl.gstatic.com/docs/doclist/images/drive_2022q3_32dp.png',
    docs:      'https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico',
    classroom: 'https://ssl.gstatic.com/classroom/favicon.png',
    canvas:    'https://du11hjcvx0uqb.cloudfront.net/dist/images/favicon-e10d657a73.ico',
    wikipedia: 'https://en.wikipedia.org/static/favicon/wikipedia.ico',
    khan:      'https://cdn.kastatic.org/images/favicon.ico',
  };
  const WALLPAPERS = ['horizon', 'dusk', 'aurora', 'sand', 'graphite'];

  const DEFAULTS = {
    theme: 'system', cloak: false, tabTitle: '', tabIcon: '',
    panicKey: '`', panicUrl: 'https://classroom.google.com', solid: false, autoFs: true,
    accent: '', wallpaper: 'horizon',
  };
  let settings = {};
  Object.keys(DEFAULTS).forEach(k => { settings[k] = load(k, DEFAULTS[k]); });
  if (!WALLPAPERS.includes(settings.wallpaper)) settings.wallpaper = 'horizon';

  // ─── Favorites, history, play counts ───
  let favorites = load('favorites', []);
  let recentlyPlayed = load('recent', []);
  let plays = load('plays', {});
  const isFavorite = id => favorites.includes(id);
  const getGameById = id => GAMES.find(g => g.id === id);

  function toggleFavorite(id) {
    const i = favorites.indexOf(id);
    if (i >= 0) favorites.splice(i, 1); else favorites.unshift(id);
    save('favorites', favorites);
    updateCounts();
    refreshGames(true);
    return i < 0;
  }

  function addToRecent(id) {
    recentlyPlayed = [id].concat(recentlyPlayed.filter(r => r !== id)).slice(0, 20);
    plays[id] = (plays[id] || 0) + 1;
    save('recent', recentlyPlayed);
    save('plays', plays);
    updateCounts();
  }

  // Built-in games are stored inside this file as HTML text and opened from a blob address.
  const localUrls = {};
  function localHtml(id) {
    const page = LOCAL_GAMES[id];
    if (page == null) return null;
    return page.replace('@@GAMECSS@@', () => GAME_LIB.css).replace('@@SHELLJS@@', () => GAME_LIB.shell).replace('@@PAGEJS@@', () => GAME_LIB.page);
  }
  function getGameUrl(game) {
    if (GAME_SOURCES[game.id]) return GAME_SOURCES[game.id];
    const html = localHtml(game.id);
    if (html == null) return 'about:blank';
    if (!localUrls[game.id]) localUrls[game.id] = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    return localUrls[game.id];
  }

  // ─── Toast ───
  let toastTimer;
  function showToast(msg) {
    let el = $('#toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  // ─── Fullscreen helpers (iPhone Safari has no element fullscreen) ───
  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  function enterFs(el) {
    const fn = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!fn) return false;
    try { const r = fn.call(el); if (r && r.catch) r.catch(() => {}); } catch { return false; }
    return true;
  }
  function exitFs() {
    const fn = document.exitFullscreen || document.webkitExitFullscreen;
    if (!fn) return;
    try { const r = fn.call(document); if (r && r.catch) r.catch(() => {}); } catch {}
  }

  // ─── Theme, accent, glass, wallpaper ───
  function applyTheme() {
    const resolved = settings.theme === 'system'
      ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : settings.theme;
    root.setAttribute('data-theme', resolved);
    applyAccent();
    $$('.theme-opt').forEach(btn => btn.classList.toggle('active', btn.dataset.themeVal === settings.theme));
  }
  function applyAccent() {
    const valid = /^#[0-9a-f]{6}$/i.test(settings.accent || '');
    if (window.bgApplyAccent) window.bgApplyAccent(valid ? settings.accent : '', root.getAttribute('data-theme'));
    $$('.swatch').forEach(b => {
      const mine = (b.dataset.accent || '').toLowerCase();
      b.setAttribute('aria-pressed', String(mine === (valid ? settings.accent.toLowerCase() : '')));
    });
    const custom = $('#accentCustom');
    if (custom && valid) custom.value = settings.accent.toLowerCase();
  }
  function applyGlass() {
    root.classList.toggle('solid', !!settings.solid);
    $('#solidToggle').setAttribute('aria-checked', String(!!settings.solid));
  }
  function applyWall() {
    root.setAttribute('data-wall', settings.wallpaper);
    $$('.wp').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.wall === settings.wallpaper)));
  }
  applyTheme();
  applyGlass();
  applyWall();

  function setTheme(v) { settings.theme = v; save('theme', v); applyTheme(); }
  function toggleSolid() { settings.solid = !settings.solid; save('solid', settings.solid); applyGlass(); }

  // ─── Tab disguise ───
  function applyTabCloak() {
    document.title = settings.tabTitle || 'Bedrock Games';
    const link = $('link[rel="icon"]');
    if (link) link.href = settings.tabIcon && ICONS[settings.tabIcon] ? ICONS[settings.tabIcon] : FAVICON;
  }
  applyTabCloak();

  function goPanic() {
    const url = settings.panicUrl || DEFAULTS.panicUrl;
    try { window.top.location.replace(url); } catch { window.location.replace(url); }
  }

  // A page opened from a file or an unusual scheme cannot be framed inside about:blank, so use the hosted copy.
  const HOSTED_SITE = 'https://thatonegooddeveloper.github.io/BedrockGames/';
  const selfUrl = () => (/^https?:$/.test(location.protocol) ? location.href.split('#')[0] : HOSTED_SITE);

  // Writes the disguised page into a new about:blank window. Some browsers (Firefox) finish loading
  // their own blank page a moment later and wipe what was written, so keep checking that the frame is
  // still there and write again if it is not. Resolves true once it has stayed put.
  function writeBlankDoc(win, target) {
    const src = typeof target === 'string' ? target : '';
    const srcdoc = typeof target === 'string' ? null : target.srcdoc;
    const title = settings.tabTitle || 'Google Docs';
    const icon = settings.tabIcon && ICONS[settings.tabIcon] ? ICONS[settings.tabIcon] : '';
    const html =
      '<!doctype html><html><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + esc(title) + '</title>' +
      (icon ? '<link rel="icon" href="' + esc(icon) + '">' : '') +
      '<style>html,body{margin:0;height:100%;background:#0b0b0f;overflow:hidden}' +
      'iframe{position:fixed;inset:0;width:100%;height:100%;border:0}</style></head><body>' +
      '<iframe ' + (srcdoc != null ? 'srcdoc="' + esc(srcdoc) + '"' : 'src="' + esc(src) + '"') + ' allow="fullscreen; autoplay; gamepad; pointer-lock; clipboard-write" allowfullscreen></iframe>' +
      '</body></html>';
    let attempts = 0;
    const writeDom = () => {
      const d = win.document;
      d.title = title;
      d.documentElement.style.cssText = 'margin:0;height:100%;background:#0b0b0f;overflow:hidden';
      d.body.style.cssText = 'margin:0;height:100%;overflow:hidden';
      const f = d.createElement('iframe');
      if (srcdoc != null) f.srcdoc = srcdoc; else f.src = src;
      f.setAttribute('allow', 'fullscreen; autoplay; gamepad; pointer-lock; clipboard-write');
      f.setAttribute('allowfullscreen', '');
      f.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0';
      d.body.appendChild(f);
    };
    const write = () => {
      attempts++;
      try {
        if (attempts % 3 === 0) { writeDom(); return true; }
        win.document.open(); win.document.write(html); win.document.close(); return true;
      } catch { return false; }
    };
    const hasFrame = () => {
      try { return !win.closed && !!win.document.querySelector('iframe'); } catch { return false; }
    };
    return new Promise(resolve => {
      write();
      let stable = 0, ticks = 0;
      const timer = setInterval(() => {
        ticks++;
        if (win.closed) { clearInterval(timer); resolve(false); return; }
        if (hasFrame()) {
          if (++stable >= 4) { clearInterval(timer); resolve(true); }
          return;
        }
        stable = 0;
        if (ticks > 30) {
          clearInterval(timer);
          if (srcdoc != null) { try { win.close(); } catch {} showToast('This browser would not keep an about:blank page.'); }
          else { try { win.location.replace(src); } catch {} showToast('This browser would not keep an about:blank page, so the site opened in a normal tab.'); }
          resolve(false);
          return;
        }
        write();
      }, 100);
    });
  }

  function openInBlank(quiet) {
    const win = window.open('about:blank', '_blank');
    if (!win) {
      if (quiet !== true) showToast('Pop-up blocked. Allow pop-ups for this site and try again.');
      return false;
    }
    if (quiet !== true) showToast('Opening in about:blank...');
    writeBlankDoc(win, selfUrl()).then(ok => {
      if (!ok) return;
      try { sessionStorage.setItem('bg-cloaked', '1'); } catch {}
      window.location.replace(settings.panicUrl || DEFAULTS.panicUrl);
    });
    return true;
  }

  // Popups need a user gesture, so retry on the first click if the load-time attempt was blocked.
  if (settings.cloak && window.self === window.top && !sessionStorage.getItem('bg-cloaked')) {
    if (!openInBlank(true)) {
      showToast('Tap anywhere to open in about:blank');
      document.addEventListener('click', function once() {
        document.removeEventListener('click', once, true);
        openInBlank();
      }, true);
    }
  }

  // ─── Desktop: windows ───
  const APPS = {
    games:   { title: 'Games',   w: 1060, h: 700, minW: 420, minH: 320 },
    options: { title: 'Options', w: 720,  h: 640, minW: 400, minH: 300 },
    help:    { title: 'Help',    w: 640,  h: 500, minW: 380, minH: 280 },
    about:   { title: 'Bedrock Games', w: 340, h: 392, minW: 300, minH: 300, fixed: true },
  };
  const MBAR = 28;
  const dockSpace = () => 92;
  const isMobile = () => matchMedia('(max-width: 768px)').matches;
  const wins = {};
  let winState = load('win2', {});
  let zTop = 20;
  let front = null;
  let cascade = 0;

  const viewport = () => ({ w: window.innerWidth, h: window.innerHeight });
  const saveWins = () => save('win2', winState);

  function defaultGeom(id) {
    const a = APPS[id], v = viewport();
    const room = v.w > 768 && v.h >= 760 ? 236 : 0; // leave the desktop clock visible
    const top = MBAR + 14 + room;
    const w = Math.min(a.w, v.w - 40);
    const h = Math.min(a.h, v.h - top - dockSpace() - 14);
    const off = (cascade++ % 4) * 30;
    return { x: Math.max(10, Math.round((v.w - w) / 2) - 30 + off), y: top + off, w, h: Math.max(h, a.minH) };
  }
  function ensureState(id) {
    if (!winState[id] || !Number.isFinite(winState[id].w)) {
      winState[id] = Object.assign({ open: false, min: false, max: false }, defaultGeom(id));
    }
    return winState[id];
  }
  function clampGeom(g, a) {
    const v = viewport();
    const w = Math.max(a.minW, Math.min(g.w, v.w - 8));
    const h = Math.max(a.minH, Math.min(g.h, v.h - MBAR - 8));
    return { w, h, x: Math.min(Math.max(g.x, 90 - w), v.w - 90), y: Math.min(Math.max(g.y, MBAR), v.h - 70) };
  }
  function applyGeom(id) {
    const el = wins[id];
    if (!el) return;
    const st = ensureState(id), v = viewport();
    let g;
    if (st.max) g = { x: 10, y: MBAR + 10, w: v.w - 20, h: v.h - MBAR - dockSpace() - 14 };
    else g = clampGeom(st, APPS[id]);
    el.style.left = g.x + 'px'; el.style.top = g.y + 'px';
    el.style.width = g.w + 'px'; el.style.height = g.h + 'px';
  }

  const dockItem = id => $('.dock-item[data-app="' + id + '"]');
  function syncDock() {
    $$('.dock-item[data-app]').forEach(b => {
      const st = winState[b.dataset.app];
      b.classList.toggle('is-open', !!(st && st.open));
    });
  }
  function setAppName() {
    const name = front ? (front === 'about' ? 'Bedrock Games' : APPS[front].title) : 'Bedrock Games';
    $('#mbApp').textContent = name;
  }

  function renormalizeZ() {
    const open = Object.keys(wins).filter(id => !wins[id].hidden).sort((a, b) => (+wins[a].style.zIndex || 0) - (+wins[b].style.zIndex || 0));
    zTop = 20;
    open.forEach(id => { wins[id].style.zIndex = ++zTop; });
  }
  function focusApp(id) {
    const el = wins[id];
    if (!el) return;
    Object.keys(wins).forEach(k => wins[k].classList.toggle('win--front', k === id));
    el.style.zIndex = ++zTop;
    if (zTop > 300) renormalizeZ();
    front = id;
    setAppName();
    try { history.replaceState(null, '', id === 'games' ? location.pathname + location.search : '#/' + id); } catch {}
  }
  function focusTopmost(except) {
    const open = Object.keys(wins).filter(id => id !== except && !wins[id].hidden && !(winState[id] && winState[id].min))
      .sort((a, b) => (+wins[b].style.zIndex || 0) - (+wins[a].style.zIndex || 0));
    if (open.length) focusApp(open[0]);
    else { front = null; Object.keys(wins).forEach(k => wins[k].classList.remove('win--front')); setAppName(); }
  }

  function openApp(id) {
    const el = wins[id];
    if (!el) return;
    const st = ensureState(id);
    st.open = true; st.min = false;
    el.classList.remove('win--min', 'win--closing');
    el.hidden = false;
    applyGeom(id);
    focusApp(id);
    saveWins(); syncDock();
    if (id === 'options') syncSettingsUI();
    if (id === 'help') showPanicKey();
    if (APPS[id].ext) loadExt(id);
  }
  function closeApp(id) {
    const el = wins[id], st = winState[id];
    if (!el || el.hidden || !st) return;
    st.open = false; st.min = false;
    el.classList.add('win--closing');
    setTimeout(() => { if (!st.open) { el.hidden = true; if (APPS[id].ext) unloadExt(id); } el.classList.remove('win--closing'); }, 170);
    if (front === id) focusTopmost(id);
    saveWins(); syncDock();
  }
  function minimizeApp(id) {
    const el = wins[id], st = winState[id];
    if (!el || el.hidden || !st || isMobile()) return;
    const dock = dockItem(id);
    const r = el.getBoundingClientRect();
    const d = dock ? dock.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight, width: 0, height: 0 };
    el.style.setProperty('--tx', Math.round(d.left + d.width / 2 - (r.left + r.width / 2)) + 'px');
    el.style.setProperty('--ty', Math.round(d.top + d.height / 2 - (r.top + r.height / 2)) + 'px');
    el.classList.add('win--min');
    st.min = true;
    setTimeout(() => { if (st.min) el.hidden = true; }, 300);
    if (front === id) focusTopmost(id);
    saveWins(); syncDock();
  }
  function zoomApp(id) {
    const el = wins[id];
    if (!el || APPS[id].fixed || isMobile()) return;
    const st = ensureState(id);
    el.classList.add('win--zoom');
    st.max = !st.max;
    applyGeom(id);
    setTimeout(() => el.classList.remove('win--zoom'), 260);
    saveWins();
  }
  function resetWindows() {
    Object.keys(wins).forEach(id => {
      const was = winState[id];
      delete winState[id];
      const st = ensureState(id);
      st.open = !!(was && was.open); st.min = false;
      wins[id].classList.remove('win--min');
      if (st.open) { wins[id].hidden = false; applyGeom(id); }
    });
    saveWins();
    showToast('Windows reset');
  }

  function setupWindow(el) {
    const id = el.dataset.app;
    wins[id] = el;
    const a = APPS[id];
    el.addEventListener('pointerdown', () => { if (front !== id) focusApp(id); }, true);
    $$('.light', el).forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      const act = b.dataset.act;
      if (act === 'close') closeApp(id); else if (act === 'min') minimizeApp(id); else zoomApp(id);
    }));
    const bar = $('.win__bar', el);
    const skip = t => t.closest('button, input, select, label, a');
    bar.addEventListener('pointerdown', e => {
      if (isMobile() || e.button !== 0 || skip(e.target)) return;
      const st = ensureState(id);
      if (st.max) return;
      e.preventDefault();
      bar.setPointerCapture(e.pointerId);
      const sx = e.clientX, sy = e.clientY, ox = st.x, oy = st.y;
      const move = ev => { st.x = ox + ev.clientX - sx; st.y = oy + ev.clientY - sy; Object.assign(st, clampGeom(st, a)); applyGeom(id); };
      const up = () => { bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', up); bar.removeEventListener('pointercancel', up); saveWins(); };
      bar.addEventListener('pointermove', move);
      bar.addEventListener('pointerup', up);
      bar.addEventListener('pointercancel', up);
    });
    bar.addEventListener('dblclick', e => { if (!isMobile() && !skip(e.target)) zoomApp(id); });
    $$('.grip', el).forEach(g => g.addEventListener('pointerdown', e => {
      if (isMobile() || e.button !== 0) return;
      const st = ensureState(id);
      if (st.max) return;
      e.preventDefault(); e.stopPropagation();
      g.setPointerCapture(e.pointerId);
      const sx = e.clientX, sy = e.clientY, ow = st.w, oh = st.h;
      const wide = g.classList.contains('grip--r') || g.classList.contains('grip--br');
      const tall = g.classList.contains('grip--b') || g.classList.contains('grip--br');
      const move = ev => {
        const v = viewport();
        if (wide) st.w = Math.max(a.minW, Math.min(ow + ev.clientX - sx, v.w - st.x));
        if (tall) st.h = Math.max(a.minH, Math.min(oh + ev.clientY - sy, v.h - st.y));
        applyGeom(id);
      };
      const up = () => { g.removeEventListener('pointermove', move); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up); saveWins(); };
      g.addEventListener('pointermove', move);
      g.addEventListener('pointerup', up);
      g.addEventListener('pointercancel', up);
    }));
  }
  // ─── Apps that show a web page in an iframe ───
  // Each gets a window, a dock icon, a Window menu entry and a Spotlight entry. The page loads when the
  // window opens and unloads when it closes. The icon is the page's favicon; if it cannot load, a colored
  // tile with the first letter is shown.
  const EXT_APPS = [
    { id: 'duckmath', title: 'Duck Math', url: 'https://prime-yamal.s3.us-east-2.amazonaws.com/duckmath_1.htm', icon: 'https://prime-yamal.s3.us-east-2.amazonaws.com/imgs/duck.webp', color: '#e8a400' },
    { id: 'google', title: 'Google', url: 'https://prime-yamal.s3.us-east-2.amazonaws.com/google.html', icon: 'https://www.google.com/favicon.ico', color: '#4285f4' },
    { id: 'storm', title: 'Storm 0S', url: 'https://prime-yamal.s3.us-east-2.amazonaws.com/storm-auto-loader+2.html', icon: '', color: '#6b4df0' },
    { id: 'unblockedzone', title: 'Unblocked Zone', url: 'https://prime-yamal.s3.us-east-2.amazonaws.com/unblockedzone.html', icon: '', color: '#1f9d8f' },
  ];
  const extById = id => EXT_APPS.find(a => a.id === id);
  function extIcon(app, size) {
    const t = document.createElement('span');
    t.className = 'app-ico';
    t.style.cssText = '--c:' + app.color + ';width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 0.46) + 'px';
    const letter = () => { t.className = 'app-ico app-ico--letter'; t.textContent = app.title.charAt(0).toUpperCase(); };
    if (!app.icon) { letter(); return t; }
    t.classList.add('app-ico--img');
    const img = document.createElement('img');
    img.alt = ''; img.referrerPolicy = 'no-referrer';
    img.onerror = () => { t.textContent = ''; letter(); };
    img.src = app.icon;
    t.appendChild(img);
    return t;
  }
  const extFrames = {};
  EXT_APPS.forEach(app => {
    APPS[app.id] = { title: app.title, w: 1040, h: 700, minW: 420, minH: 320, ext: true };
    const el = document.createElement('section');
    el.className = 'win'; el.id = 'win-' + app.id; el.dataset.app = app.id; el.hidden = true;
    el.setAttribute('aria-label', app.title);
    el.innerHTML =
      '<header class="win__bar"><div class="lights"><button class="light light--close" data-act="close" aria-label="Close"></button>' +
      '<button class="light light--min" data-act="min" aria-label="Minimize"></button><button class="light light--max" data-act="max" aria-label="Zoom"></button></div>' +
      '<h2 class="win__title"></h2><div class="win__tools"><button class="mini" data-reload="1" type="button">Reload</button></div></header>' +
      '<div class="win__body"><iframe class="ext-frame" title="" allow="fullscreen; autoplay; clipboard-write; gamepad; pointer-lock; microphone; camera" allowfullscreen="allowfullscreen"></iframe></div>' +
      '<i class="grip grip--r"></i><i class="grip grip--b"></i><i class="grip grip--br"></i>';
    $('.win__title', el).textContent = app.title;
    const frame = $('.ext-frame', el);
    frame.title = app.title;
    extFrames[app.id] = frame;
    $('[data-reload]', el).addEventListener('click', () => { frame.src = 'about:blank'; setTimeout(() => { frame.src = app.url; }, 30); });
    $('#desk').appendChild(el);
    const item = document.createElement('button');
    item.className = 'dock-item'; item.dataset.app = app.id; item.setAttribute('aria-label', app.title);
    const ico = document.createElement('span'); ico.className = 'dock-icon'; ico.appendChild(extIcon(app, 54));
    const tip = document.createElement('span'); tip.className = 'dock-tip'; tip.textContent = app.title;
    const dot = document.createElement('i'); dot.className = 'dock-dot';
    item.append(ico, tip, dot);
    const dockInnerEl = $('#dockInner');
    dockInnerEl.insertBefore(item, $('.dock-sep', dockInnerEl));
  });
  const loadExt = id => { const f = extFrames[id]; if (f && !f.getAttribute('src')) f.src = extById(id).url; };
  const unloadExt = id => { const f = extFrames[id]; if (f) f.removeAttribute('src'); };
  // A click inside an iframe never reaches this page, so bring its window to the front when the frame takes focus.
  window.addEventListener('blur', () => setTimeout(() => {
    const a = document.activeElement;
    if (a && a.classList && a.classList.contains('ext-frame')) { const w = a.closest('.win'); if (w && front !== w.dataset.app) focusApp(w.dataset.app); }
  }, 0));

  $$('.win').forEach(setupWindow);
  window.addEventListener('resize', () => Object.keys(wins).forEach(id => { if (!wins[id].hidden) applyGeom(id); }));

  // ─── Desktop: dock ───
  $$('.dock-item[data-app]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.app, st = winState[id];
    if (st && st.open && !st.min && !wins[id].hidden) { if (front !== id) focusApp(id); } else openApp(id);
  }));
  const dockEl = $('#dock'), dockInner = $('#dockInner');
  dockInner.addEventListener('pointermove', e => {
    if (isMobile() || e.pointerType === 'touch') return;
    const base = dockEl.getBoundingClientRect().left;
    $$('.dock-item', dockInner).forEach(it => {
      const center = base + it.offsetLeft + it.offsetWidth / 2;
      const k = Math.max(0, 1 - Math.abs(e.clientX - center) / 120);
      it.style.transform = 'scale(' + (1 + 0.38 * k * k).toFixed(3) + ')';
    });
  });
  dockInner.addEventListener('pointerleave', () => $$('.dock-item', dockInner).forEach(it => { it.style.transform = ''; }));

  // ─── Desktop: menu bar ───
  const menuPop = $('#menuPop');
  let openMenuName = null;
  const panicLabel = () => (settings.panicKey === ' ' ? 'Space' : settings.panicKey);
  const appItem = (id, label, key) => ({ label, key, check: !!(winState[id] && winState[id].open && !wins[id].hidden), action: () => openApp(id) });
  const MENUS = {
    logo: () => [
      { label: 'About Bedrock Games', action: () => openApp('about') }, 'sep',
      { label: 'Options', key: '3', action: () => openApp('options') },
      { label: 'Reduce Transparency', check: !!settings.solid, action: toggleSolid }, 'sep',
      { label: 'Hide Site (Panic)', key: panicLabel(), action: goPanic },
    ],
    file: () => [
      { label: 'Random Game', action: () => randomGame() },
      { label: 'Open Site in about:blank', action: () => openInBlank() }, 'sep',
      { label: 'Close Window', disabled: !front, action: () => front && closeApp(front) },
    ],
    view: () => [
      { label: 'Light', check: settings.theme === 'light', action: () => setTheme('light') },
      { label: 'Dark', check: settings.theme === 'dark', action: () => setTheme('dark') },
      { label: 'Auto', check: settings.theme === 'system', action: () => setTheme('system') }, 'sep',
      { label: fsElement() ? 'Exit Full Screen' : 'Enter Full Screen', action: () => { if (fsElement()) exitFs(); else enterFs(root); } },
      { label: 'Reset Window Positions', action: resetWindows },
    ],
    window: () => [
      appItem('games', 'Games', '1'), appItem('options', 'Options', '2'), appItem('help', 'Help', '?'), 'sep',
      ...EXT_APPS.map(a => appItem(a.id, a.title)), 'sep',
      { label: 'Minimize', disabled: !front || isMobile(), action: () => front && minimizeApp(front) },
      { label: 'Zoom', disabled: !front || isMobile() || APPS[front].fixed, action: () => front && zoomApp(front) },
    ],
    help: () => [
      { label: 'How to Play', action: () => openApp('help') },
      { label: 'Search', key: '/', action: () => openSpot() }, 'sep',
      { label: 'About Bedrock Games', action: () => openApp('about') },
    ],
  };
  function closeMenu() {
    menuPop.hidden = true;
    openMenuName = null;
    $$('.mb-btn.is-open').forEach(b => b.classList.remove('is-open'));
  }
  function openMenu(name, anchor) {
    if (openMenuName === name) { closeMenu(); return; }
    closeMenu();
    menuPop.innerHTML = '';
    MENUS[name]().forEach(item => {
      if (item === 'sep') { const s = document.createElement('div'); s.className = 'mi-sep'; menuPop.appendChild(s); return; }
      const b = document.createElement('button');
      b.className = 'mi'; b.setAttribute('role', 'menuitem'); b.disabled = !!item.disabled;
      b.innerHTML = (item.check ? '<span class="mi__check">&#10003;</span>' : '') + '<span>' + esc(item.label) + '</span>' + (item.key ? '<span class="mi__key">' + esc(item.key) + '</span>' : '');
      b.addEventListener('click', () => { closeMenu(); item.action(); });
      menuPop.appendChild(b);
    });
    const r = anchor.getBoundingClientRect();
    menuPop.style.left = Math.max(4, Math.min(r.left, window.innerWidth - 250)) + 'px';
    menuPop.hidden = false;
    openMenuName = name;
    anchor.classList.add('is-open');
  }
  $('#mbLogo').addEventListener('click', e => { e.stopPropagation(); openMenu('logo', e.currentTarget); });
  $$('.mb-menu').forEach(b => {
    b.addEventListener('click', e => { e.stopPropagation(); openMenu(b.dataset.menu, b); });
    b.addEventListener('pointerenter', () => { if (openMenuName && openMenuName !== b.dataset.menu) { const n = openMenuName; openMenuName = null; closeMenu(); openMenu(b.dataset.menu, b); void n; } });
  });
  document.addEventListener('pointerdown', e => { if (!menuPop.hidden && !e.target.closest('#menuPop, .mb-btn')) closeMenu(); });
  $('#mbSearch').addEventListener('click', () => openSpot());
  $('#mbRandom').addEventListener('click', () => randomGame());
  $('#dockRandom').addEventListener('click', () => randomGame());

  function tickClock() {
    const d = new Date();
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const date = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    $('#mbClock').textContent = isMobile() ? time : date + '  ' + time;
    $('#wcTime').textContent = time.replace(/\s?[AP]M$/i, '');
    $('#wcDate').textContent = d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  }
  tickClock();
  setInterval(tickClock, 15000);

  // ─── Desktop: Spotlight search ───
  const spot = $('#spot'), spotInput = $('#spotInput'), spotList = $('#spotList');
  let spotRows = [], spotIndex = 0;
  const SPOT_APPS = [['games', 'Games'], ['options', 'Options'], ['help', 'Help'], ['about', 'About Bedrock Games']].concat(EXT_APPS.map(a => [a.id, a.title]));

  function openSpot(prefill) {
    closeMenu();
    spot.hidden = false;
    spotInput.value = prefill || '';
    renderSpot();
    spotInput.focus();
  }
  function closeSpot() { spot.hidden = true; spotInput.blur(); }
  function spotRowEl(row, idx) {
    const li = document.createElement('li');
    li.className = 'spot__row'; li.setAttribute('role', 'option'); li.dataset.i = idx;
    const icon = document.createElement('span');
    icon.className = 'spot__icon';
    if (row.game) icon.innerHTML = row.game.img ? '<img alt="" src="' + esc(row.game.img) + '">' : '';
    else if (extById(row.app)) icon.appendChild(extIcon(extById(row.app), 40));
    else icon.innerHTML = '<span class="px">' + APP_ICONS[row.app || 'games'] + '</span>';
    const name = document.createElement('span'); name.className = 'spot__name'; name.textContent = row.label;
    const kind = document.createElement('span'); kind.className = 'spot__kind'; kind.textContent = row.kind;
    li.append(icon, name, kind);
    li.addEventListener('pointermove', () => { if (spotIndex !== idx) { spotIndex = idx; markSpot(); } });
    li.addEventListener('click', () => activateSpot(idx));
    return li;
  }
  function renderSpot() {
    const q = spotInput.value.trim();
    const lq = q.toLowerCase();
    const groups = [];
    if (q) {
      const apps = SPOT_APPS.filter(([, n]) => n.toLowerCase().includes(lq)).map(([id, n]) => ({ app: id, label: n, kind: 'App' }));
      const games = GAMES.filter(g => g.title.toLowerCase().includes(lq)).slice(0, 8).map(g => ({ game: g, label: g.title, kind: g.category }));
      if (apps.length) groups.push(['Apps', apps]);
      if (games.length) groups.push(['Games', games]);
    } else {
      const recents = recentlyPlayed.map(getGameById).filter(Boolean).slice(0, 5).map(g => ({ game: g, label: g.title, kind: g.category }));
      if (recents.length) groups.push(['Recently Played', recents]);
      groups.push(['Apps', SPOT_APPS.map(([id, n]) => ({ app: id, label: n, kind: 'App' }))]);
    }
    spotList.innerHTML = '';
    spotRows = [];
    groups.forEach(([title, rows]) => {
      const h = document.createElement('li'); h.className = 'spot__head'; h.textContent = title; spotList.appendChild(h);
      rows.forEach(r => { spotRows.push(r); spotList.appendChild(spotRowEl(r, spotRows.length - 1)); });
    });
    spotIndex = 0;
    markSpot();
  }
  function markSpot() {
    $$('.spot__row', spotList).forEach(li => li.setAttribute('aria-selected', String(+li.dataset.i === spotIndex)));
    const cur = $('.spot__row[aria-selected="true"]', spotList);
    if (cur) cur.scrollIntoView({ block: 'nearest' });
  }
  function activateSpot(i) {
    const row = spotRows[i];
    if (!row) return;
    closeSpot();
    if (row.game) openGame(row.game);
    else openApp(row.app);
  }
  spotInput.addEventListener('input', renderSpot);
  spotInput.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); spotIndex = Math.min(spotRows.length - 1, spotIndex + 1); markSpot(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); spotIndex = Math.max(0, spotIndex - 1); markSpot(); }
    else if (e.key === 'Enter') { e.preventDefault(); activateSpot(spotIndex); }
    else if (e.key === 'Escape') { e.preventDefault(); closeSpot(); }
  });
  spot.addEventListener('pointerdown', e => { if (e.target === spot) closeSpot(); });

  // ─── Game player ───
  const gamePlayer = $('#gamePlayer');
  const gamePlayerFrame = $('#gamePlayerFrame');
  const gamePlayerTitle = $('#gamePlayerTitle');
  const gamePlayerFav = $('#gamePlayerFav');
  let currentGameId = null;
  let fsFromOpen = false;

  // Esc inside a built-in game (same origin) never reaches this page, so listen for it in the frame too.
  gamePlayerFrame.addEventListener('load', () => {
    try {
      const w = gamePlayerFrame.contentWindow;
      if (w && w.location.href !== 'about:blank') w.addEventListener('keydown', e => { if (e.key === 'Escape' && currentGameId) closeGame(); });
    } catch {}
  });

  function updateFavBtn() {
    if (!currentGameId) return;
    const active = isFavorite(currentGameId);
    gamePlayerFav.classList.toggle('fav-active', active);
    gamePlayerFav.textContent = active ? 'Saved' : 'Save';
  }

  function openGame(game) {
    currentGameId = game.id;
    gamePlayerTitle.textContent = game.title;
    gamePlayerFrame.src = getGameUrl(game);
    gamePlayer.classList.add('open');
    addToRecent(game.id);
    updateFavBtn();
    fsFromOpen = !!settings.autoFs && enterFs(gamePlayer);
  }

  function closeGame() {
    fsFromOpen = false;
    try { gamePlayerFrame.blur(); window.focus(); } catch {}
    gamePlayer.classList.remove('open');
    gamePlayerFrame.src = 'about:blank';
    currentGameId = null;
    if (fsElement()) exitFs();
    refreshGames(true);
  }
  function randomGame() { openGame(GAMES[Math.floor(Math.random() * GAMES.length)]); }

  $('#gamePlayerBack').addEventListener('click', closeGame);
  gamePlayerFav.addEventListener('click', () => {
    if (!currentGameId) return;
    const added = toggleFavorite(currentGameId);
    updateFavBtn();
    showToast(added ? 'Saved to favorites' : 'Removed from favorites');
  });
  $('#gamePlayerFullscreen').addEventListener('click', () => {
    if (fsElement()) { fsFromOpen = false; exitFs(); }
    else if (!enterFs(gamePlayer)) showToast('This browser cannot fullscreen. Use the Tab button.');
  });
  $('#gamePlayerNewTab').addEventListener('click', () => {
    const game = currentGameId && getGameById(currentGameId);
    if (!game) return;
    const win = window.open('about:blank', '_blank');
    if (!win) { showToast('Pop-up blocked. Allow pop-ups for this site and try again.'); return; }
    const local = !GAME_SOURCES[game.id] && LOCAL_GAMES[game.id] != null;
    writeBlankDoc(win, local ? { srcdoc: localHtml(game.id) } : new URL(getGameUrl(game), selfUrl()).href).then(ok => { if (ok) closeGame(); });
  });
  function onFsChange() {
    if (!fsElement() && fsFromOpen && gamePlayer.classList.contains('open')) closeGame();
  }
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);

  // ─── Games app ───
  const grid = $('#gamesGrid');
  const gamesScroll = $('#gamesScroll');
  const sortSelect = $('#sortSelect');
  const searchInput = $('#searchInput');
  const PAGE_SIZE = 60;
  const CAT_LABELS = {
    all: 'All Games', '@favorites': 'Favorites', '@recent': 'Recently Played', puzzle: 'Puzzle', arcade: 'Arcade', action: 'Action',
    racing: 'Racing', adventure: 'Adventure', multiplayer: 'Multiplayer', shooting: 'Shooting', simulation: 'Simulation', platform: 'Platform', sports: 'Sports',
  };
  let activeCategory = 'all';
  let currentFiltered = [];
  let visibleCount = 0;

  function makeCard(game) {
    const card = document.createElement('div');
    card.className = 'game-card';
    card.dataset.title = game.title;
    card.dataset.id = game.id;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.innerHTML =
      '<div class="game-card__image">' +
        (game.img ? '<img class="game-card__thumb" src="' + esc(game.img) + '" alt="" loading="lazy">' : '') +
        (isFavorite(game.id) ? '<span class="game-card__fav">' + HEART_SVG + '</span>' : '') +
        '<div class="game-card__play"><span></span></div>' +
      '</div>' +
      '<div class="game-card__body">' +
        '<div class="game-card__title">' + esc(game.title) + '</div>' +
        '<div class="game-card__category">' + esc(game.category) + '</div>' +
      '</div>';
    card.addEventListener('click', () => openGame(game));
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openGame(game); } });
    return card;
  }

  function sortList(list) {
    const mode = sortSelect.value;
    const byTitle = (a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
    const arr = list.slice();
    if (mode === 'za') return arr.sort((a, b) => byTitle(b, a));
    if (mode === 'category') return arr.sort((a, b) => a.category.localeCompare(b.category) || byTitle(a, b));
    if (mode === 'played') return arr.sort((a, b) => (plays[b.id] || 0) - (plays[a.id] || 0) || byTitle(a, b));
    return arr.sort(byTitle);
  }
  function baseList(cat) {
    if (cat === '@favorites') return favorites.map(getGameById).filter(Boolean);
    if (cat === '@recent') return recentlyPlayed.map(getGameById).filter(Boolean);
    if (cat === 'all') return GAMES;
    return GAMES.filter(g => g.category === cat);
  }

  function refreshGames(keepScroll) {
    const top = gamesScroll.scrollTop;
    const q = searchInput.value.trim().toLowerCase();
    let list = baseList(activeCategory);
    if (q) list = list.filter(g => g.title.toLowerCase().includes(q));
    if (activeCategory !== '@recent') list = sortList(list);
    currentFiltered = list;
    $('#gamesTitle').textContent = CAT_LABELS[activeCategory] || activeCategory;
    $('#gamesSubtitle').textContent = list.length + (list.length === 1 ? ' game' : ' games');
    grid.innerHTML = '';
    removeLoadMore();
    if (!list.length) {
      const msg = activeCategory === '@favorites' && !q ? ['No favorites yet', 'Open a game and press Save to add it here.']
        : activeCategory === '@recent' && !q ? ['Nothing played yet', 'Games you open will show up here.']
        : ['No results', 'Try another search or category.'];
      grid.innerHTML = '<div class="empty-state"><h3 class="empty-state__title">' + msg[0] + '</h3><p class="empty-state__text">' + msg[1] + '</p></div>';
      return;
    }
    visibleCount = Math.min(PAGE_SIZE, list.length);
    const frag = document.createDocumentFragment();
    for (let i = 0; i < visibleCount; i++) frag.appendChild(makeCard(list[i]));
    grid.appendChild(frag);
    if (visibleCount < list.length) showLoadMore();
    gamesScroll.scrollTop = keepScroll ? top : 0;
  }

  function showMore() {
    const end = Math.min(visibleCount + PAGE_SIZE, currentFiltered.length);
    const frag = document.createDocumentFragment();
    for (let i = visibleCount; i < end; i++) frag.appendChild(makeCard(currentFiltered[i]));
    grid.appendChild(frag);
    visibleCount = end;
    if (visibleCount >= currentFiltered.length) removeLoadMore(); else updateLoadMoreText();
  }
  function showLoadMore() {
    let btn = $('#loadMoreBtn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'loadMoreBtn';
      btn.className = 'btn btn--primary btn--load-more';
      btn.addEventListener('click', showMore);
      gamesScroll.appendChild(btn);
    }
    updateLoadMoreText();
    btn.style.display = '';
  }
  function updateLoadMoreText() {
    const btn = $('#loadMoreBtn');
    if (btn) btn.textContent = 'Show more (' + (currentFiltered.length - visibleCount) + ' left)';
  }
  function removeLoadMore() {
    const btn = $('#loadMoreBtn');
    if (btn) btn.style.display = 'none';
  }

  function updateCounts() {
    const counts = {};
    GAMES.forEach(g => { counts[g.category] = (counts[g.category] || 0) + 1; });
    $('#countAll').textContent = GAMES.length;
    $('#favCount').textContent = favorites.filter(getGameById).length;
    $('#playedCount').textContent = recentlyPlayed.filter(getGameById).length;
    ['puzzle', 'arcade', 'action', 'racing', 'adventure', 'multiplayer', 'shooting', 'simulation', 'platform', 'sports'].forEach(cat => {
      const el = $('#count' + cat.charAt(0).toUpperCase() + cat.slice(1));
      if (el) el.textContent = counts[cat] || 0;
    });
  }

  function selectCategory(cat) {
    activeCategory = cat;
    $$('.side__item').forEach(b => b.classList.toggle('side__item--active', b.dataset.cat === cat));
  }
  $('#gamesSide').addEventListener('click', e => {
    const btn = e.target.closest('.side__item');
    if (!btn) return;
    selectCategory(btn.dataset.cat);
    refreshGames();
  });
  sortSelect.addEventListener('change', () => refreshGames());
  searchInput.addEventListener('input', () => refreshGames());

  // ─── Options ───
  function showPanicKey() {
    const label = panicLabel();
    $('#panicKeyDisplay').textContent = label;
    const h = $('#helpPanicKey');
    if (h) h.textContent = label;
  }
  function syncSettingsUI() {
    $$('.theme-opt').forEach(btn => btn.classList.toggle('active', btn.dataset.themeVal === settings.theme));
    $('#cloakToggle').setAttribute('aria-checked', String(settings.cloak));
    $('#solidToggle').setAttribute('aria-checked', String(!!settings.solid));
    $('#autoFsToggle').setAttribute('aria-checked', String(!!settings.autoFs));
    $('#tabTitleInput').value = settings.tabTitle;
    $('#tabIconSelect').value = settings.tabIcon;
    $('#panicUrlInput').value = settings.panicUrl;
    applyAccent();
    applyWall();
    showPanicKey();
  }

  $$('.theme-opt').forEach(btn => btn.addEventListener('click', () => setTheme(btn.dataset.themeVal)));

  function bindToggle(sel, key, after) {
    $(sel).addEventListener('click', function () {
      settings[key] = !settings[key];
      this.setAttribute('aria-checked', String(settings[key]));
      save(key, settings[key]);
      if (after) after();
    });
  }
  bindToggle('#solidToggle', 'solid', applyGlass);
  bindToggle('#cloakToggle', 'cloak');
  bindToggle('#autoFsToggle', 'autoFs');

  $('#accentPicker').addEventListener('click', e => {
    const btn = e.target.closest('.swatch');
    if (!btn) return;
    settings.accent = btn.dataset.accent;
    save('accent', settings.accent);
    applyAccent();
  });
  $('#accentCustom').addEventListener('input', function () {
    settings.accent = this.value;
    save('accent', settings.accent);
    applyAccent();
  });
  $('#wallPicker').addEventListener('click', e => {
    const btn = e.target.closest('.wp');
    if (!btn) return;
    settings.wallpaper = btn.dataset.wall;
    save('wallpaper', settings.wallpaper);
    applyWall();
  });

  $('#tabTitleInput').addEventListener('input', function () {
    settings.tabTitle = this.value; save('tabTitle', settings.tabTitle); applyTabCloak();
  });
  $('#tabIconSelect').addEventListener('change', function () {
    settings.tabIcon = this.value; save('tabIcon', settings.tabIcon); applyTabCloak();
  });
  $('#panicUrlInput').addEventListener('input', function () {
    settings.panicUrl = this.value; save('panicUrl', settings.panicUrl);
  });

  const setPanicKeyBtn = $('#setPanicKey');
  let listeningForKey = false;
  setPanicKeyBtn.addEventListener('click', () => {
    listeningForKey = true;
    $('#panicKeyDisplay').textContent = '...';
    $('#panicKeyDisplay').classList.add('listening');
    setPanicKeyBtn.textContent = 'Press a key';
  });
  document.addEventListener('keydown', e => {
    if (!listeningForKey) return;
    e.preventDefault();
    e.stopPropagation();
    listeningForKey = false;
    settings.panicKey = e.key;
    save('panicKey', settings.panicKey);
    $('#panicKeyDisplay').classList.remove('listening');
    setPanicKeyBtn.textContent = 'Change';
    showPanicKey();
  }, true);

  $('#launchBlank').addEventListener('click', () => openInBlank());

  function refreshAll() {
    applyTheme(); applyGlass(); applyWall(); applyTabCloak(); syncSettingsUI();
    updateCounts(); refreshGames();
  }

  $('#clearFavorites').addEventListener('click', () => {
    if (!confirm('Clear all favorites?')) return;
    favorites = [];
    save('favorites', favorites);
    refreshAll();
    showToast('Favorites cleared');
  });
  $('#clearHistory').addEventListener('click', () => {
    if (!confirm('Clear recently played and play counts?')) return;
    recentlyPlayed = []; plays = {};
    save('recent', recentlyPlayed); save('plays', plays);
    refreshAll();
    showToast('History cleared');
  });
  $('#resetSettings').addEventListener('click', () => {
    if (!confirm('Reset all options, favorites and history?')) return;
    try { Object.keys(localStorage).forEach(k => { if (k.indexOf('bg-') === 0 && k !== 'bg-win2') localStorage.removeItem(k); }); } catch {}
    try { sessionStorage.removeItem('bg-cloaked'); } catch {}
    settings = Object.assign({}, DEFAULTS);
    favorites = []; recentlyPlayed = []; plays = {};
    refreshAll();
    showToast('Everything reset');
  });

  // ─── Backup file ───
  $('#exportData').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ app: 'bedrock-games', version: 1, settings, favorites, recent: recentlyPlayed, plays }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bedrock-games-save.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    showToast('Save file downloaded');
  });
  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', function () {
    const file = this.files && this.files[0];
    this.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => showToast('Could not read that file');
    reader.onload = () => {
      let d;
      try { d = JSON.parse(reader.result); } catch { showToast('That is not a valid save file'); return; }
      if (!d || d.app !== 'bedrock-games') { showToast('That is not a Bedrock Games save file'); return; }
      const ids = x => (Array.isArray(x) ? x : []).filter(id => typeof id === 'string' && getGameById(id));
      favorites = ids(d.favorites);
      recentlyPlayed = ids(d.recent).slice(0, 20);
      plays = {};
      if (d.plays && typeof d.plays === 'object') {
        Object.keys(d.plays).forEach(id => { if (getGameById(id) && Number.isFinite(d.plays[id]) && d.plays[id] > 0) plays[id] = Math.floor(d.plays[id]); });
      }
      if (d.settings && typeof d.settings === 'object') {
        Object.keys(DEFAULTS).forEach(k => { if (typeof d.settings[k] === typeof DEFAULTS[k]) settings[k] = d.settings[k]; });
        if (!['light', 'dark', 'system'].includes(settings.theme)) settings.theme = 'system';
        if (!WALLPAPERS.includes(settings.wallpaper)) settings.wallpaper = 'horizon';
      }
      save('favorites', favorites); save('recent', recentlyPlayed); save('plays', plays);
      Object.keys(DEFAULTS).forEach(k => save(k, settings[k]));
      refreshAll();
      showToast('Save file loaded');
    };
    reader.readAsText(file);
  });

  // ─── Keyboard ───
  document.addEventListener('keydown', e => {
    if (listeningForKey) return;
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); if (spot.hidden) openSpot(); else closeSpot(); return; }
    if (e.key === 'Escape') {
      if (!spot.hidden) { closeSpot(); return; }
      if (openMenuName) { closeMenu(); return; }
      if (gamePlayer.classList.contains('open')) { e.preventDefault(); closeGame(); return; }
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(String(e.target.tagName).toUpperCase()) || e.target.isContentEditable) return;
    if (gamePlayer.classList.contains('open') || !spot.hidden) return;
    if (e.key === settings.panicKey) { goPanic(); return; }
    if (e.key === '/') { e.preventDefault(); openSpot(); }
    else if (e.key === '1') openApp('games');
    else if (e.key === '2') openApp('options');
    else if (e.key === '?') openApp('help');
  });

  $('#aboutReload').addEventListener('click', () => location.reload());
  $('#aboutBuild').textContent = BUILD;

  // ─── Start ───
  updateCounts();
  refreshGames();
  showPanicKey();
  syncDock();

  function startupApps() {
    const fromHash = (location.hash.match(/^#\/(\w+)/) || [])[1];
    const wanted = APPS[fromHash] && fromHash !== 'games' ? fromHash : null;
    if (isMobile()) { openApp(wanted || 'games'); return; }
    const restored = ['games', 'options', 'help'].concat(EXT_APPS.map(a => a.id)).filter(id => winState[id] && winState[id].open && id !== wanted);
    const list = restored.length || wanted ? restored : ['games'];
    list.forEach(id => openApp(id));
    if (wanted) openApp(wanted);
    else if (!front) openApp('games');
  }
  startupApps();
  window.addEventListener('hashchange', () => {
    const id = (location.hash.match(/^#\/(\w+)/) || [])[1];
    if (APPS[id] && front !== id) openApp(id);
  });

  // If the browser served a saved older copy, reload once to get the current one.
  if (/^https?:$/.test(location.protocol)) {
    // Only the first few kilobytes are read: the build stamp sits at the very top of the file.
    const ctl = new AbortController();
    fetch(location.href.split('#')[0].split('?')[0], { cache: 'no-store', signal: ctl.signal })
      .then(async r => {
        if (!r.ok || !r.body) return '';
        const reader = r.body.getReader(), dec = new TextDecoder();
        let text = '';
        while (text.length < 4000) {
          const { done, value } = await reader.read();
          if (done) break;
          text += dec.decode(value, { stream: true });
        }
        ctl.abort();
        return text;
      })
      .then(head => {
        const m = head.match(/bgbuild=([^;"<]+);/);
        if (!m || m[1] === BUILD) return;
        let already = false;
        try { already = sessionStorage.getItem('bg-updated') === m[1]; sessionStorage.setItem('bg-updated', m[1]); } catch {}
        if (already) return;
        showToast('New version found. Reloading...');
        setTimeout(() => location.reload(), 900);
      })
      .catch(() => {});
  }
})();
