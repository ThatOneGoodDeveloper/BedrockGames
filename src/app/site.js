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
    view: matchMedia('(max-width: 768px)').matches ? 'grid' : 'shelf',
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
    root.setAttribute('data-theme', 'dark');
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

  // ─── Screens: the home pane (Games or Apps) and full-screen sheets on top ───
  const isMobile = () => matchMedia('(max-width: 768px)').matches;
  const APPS = {
    games:   { title: 'Games' },
    apps:    { title: 'Apps' },
    options: { title: 'Settings' },
    help:    { title: 'Help' },
    about:   { title: 'About Bedrock Games' },
  };
  let front = null;       // id of the sheet that is open, or null
  let tab = 'games';      // which home pane is showing

  function setTab(t) {
    tab = t;
    $$('.tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
    $('#pane-games').hidden = t !== 'games';
    $('#pane-apps').hidden = t !== 'apps';
    root.setAttribute('data-tab', t);
  }
  function openApp(id) {
    if (id === 'games' || id === 'apps') { closeSheet(true); setTab(id); return; }
    const el = $('#sheet-' + id);
    if (!el) return;
    if (front && front !== id) closeSheet(true);
    closeMenu();
    el.hidden = false;
    front = id;
    root.setAttribute('data-sheet', id);
    if (id === 'options') syncSettingsUI();
    if (id === 'help') showPanicKey();
    if (APPS[id].ext) loadExt(id);
    const back = $('.back-btn', el);
    if (back) back.focus({ preventScroll: true });
  }
  function closeSheet(silent) {
    if (!front) return;
    const id = front;
    $('#sheet-' + id).hidden = true;
    if (APPS[id].ext) unloadExt(id);
    front = null;
    root.removeAttribute('data-sheet');
    if (!silent) focusHome();
  }
  const closeApp = id => { if (front === id) closeSheet(); };
  function focusHome() {
    const target = $(tab === 'apps' ? '.app-tile' : '.game-card') || $('.tab[aria-selected="true"]');
    if (target) target.focus({ preventScroll: true });
  }
  $$('.tab').forEach(b => b.addEventListener('click', () => openApp(b.dataset.tab)));
  $$('.sheet').forEach(el => $('.back-btn', el).addEventListener('click', () => closeSheet()));

  // ─── Apps that show a web page in an iframe ───
  // Each gets a tile on the Apps pane and a full-screen sheet. The page loads when the sheet opens and
  // unloads when it closes. They have no icons: the tile shows the name.
  const EXT_APPS = [
    { id: 'duckmath', title: 'Duck Math', url: 'https://prime-yamal.s3.us-east-2.amazonaws.com/duckmath_1.htm' },
    { id: 'google', title: 'Google', url: 'https://prime-yamal.s3.us-east-2.amazonaws.com/google.html' },
    { id: 'storm', title: 'Storm 0S', url: 'https://prime-yamal.s3.us-east-2.amazonaws.com/storm-auto-loader+2.html' },
    { id: 'unblockedzone', title: 'Unblocked Zone', url: 'https://prime-yamal.s3.us-east-2.amazonaws.com/unblockedzone.html' },
  ];
  const extById = id => EXT_APPS.find(a => a.id === id);
  const extFrames = {};
  EXT_APPS.forEach((app, i) => {
    APPS[app.id] = { title: app.title, ext: true };
    const el = document.createElement('section');
    el.className = 'sheet sheet--ext'; el.id = 'sheet-' + app.id; el.dataset.app = app.id; el.hidden = true;
    el.setAttribute('aria-label', app.title);
    el.innerHTML =
      '<header class="sheet__head"><button class="back-btn" data-act="close" aria-label="Back">&#8249;</button><h2 class="sheet__title"></h2>' +
      '<button class="pbtn pbtn--small" data-reload="1" type="button">Reload</button></header>' +
      '<div class="sheet__body"><iframe class="ext-frame" title="" allow="fullscreen; autoplay; clipboard-write; gamepad; pointer-lock; microphone; camera" allowfullscreen="allowfullscreen"></iframe></div>';
    $('.sheet__title', el).textContent = app.title;
    const frame = $('.ext-frame', el);
    frame.title = app.title;
    extFrames[app.id] = frame;
    $('[data-reload]', el).addEventListener('click', () => { frame.src = 'about:blank'; setTimeout(() => { frame.src = app.url; }, 30); });
    $('.back-btn', el).addEventListener('click', () => closeSheet());
    document.body.appendChild(el);
    const tile = document.createElement('button');
    tile.className = 'app-tile'; tile.dataset.app = app.id; tile.type = 'button';
    tile.style.setProperty('--h', String((i * 67 + 215) % 360));
    const name = document.createElement('span'); name.className = 'app-tile__name'; name.textContent = app.title;
    tile.appendChild(name);
    tile.addEventListener('click', () => openApp(app.id));
    $('#appsRow').appendChild(tile);
  });
  const loadExt = id => { const f = extFrames[id]; if (f && !f.getAttribute('src')) f.src = extById(id).url; };
  const unloadExt = id => { const f = extFrames[id]; if (f) f.removeAttribute('src'); };

  // ─── Quick menu ───
  const menuPop = $('#menuPop');
  let openMenuName = null;
  const panicLabel = () => (settings.panicKey === ' ' ? 'Space' : settings.panicKey);
  const MENUS = {
    logo: () => [
      { label: 'Games', key: '1', action: () => openApp('games') },
      { label: 'Apps', key: '2', action: () => openApp('apps') },
      { label: 'Settings', key: '3', action: () => openApp('options') },
      { label: 'Help', key: '?', action: () => openApp('help') },
      { label: 'About Bedrock Games', action: () => openApp('about') }, 'sep',
      { label: 'Random Game', action: () => randomGame() },
      { label: 'Open Site in about:blank', action: () => openInBlank() },
      { label: fsElement() ? 'Exit Full Screen' : 'Enter Full Screen', action: () => { if (fsElement()) exitFs(); else enterFs(root); } }, 'sep',
      { label: 'Hide Site (Panic)', key: panicLabel(), action: goPanic },
    ],
  };
  function closeMenu() {
    menuPop.hidden = true;
    openMenuName = null;
    $('#logoBtn').classList.remove('is-open');
  }
  function openMenu(name, anchor) {
    if (openMenuName === name) { closeMenu(); return; }
    closeMenu();
    menuPop.innerHTML = '';
    MENUS[name]().forEach(item => {
      if (item === 'sep') { const s = document.createElement('div'); s.className = 'mi-sep'; menuPop.appendChild(s); return; }
      const b = document.createElement('button');
      b.className = 'mi'; b.setAttribute('role', 'menuitem'); b.disabled = !!item.disabled;
      b.innerHTML = '<span>' + esc(item.label) + '</span>' + (item.key ? '<span class="mi__key">' + esc(item.key) + '</span>' : '');
      b.addEventListener('click', () => { closeMenu(); item.action(); });
      menuPop.appendChild(b);
    });
    const r = anchor.getBoundingClientRect();
    menuPop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 290)) + 'px';
    menuPop.hidden = false;
    openMenuName = name;
    anchor.classList.add('is-open');
    const first = $('.mi', menuPop);
    if (first) first.focus({ preventScroll: true });
  }
  $('#logoBtn').addEventListener('click', e => { e.stopPropagation(); openMenu('logo', e.currentTarget); });
  document.addEventListener('pointerdown', e => { if (!menuPop.hidden && !e.target.closest('#menuPop, #logoBtn')) closeMenu(); });
  $('#topSearch').addEventListener('click', () => openSpot());
  $('#topRandom').addEventListener('click', () => randomGame());
  $('#topSettings').addEventListener('click', () => openApp('options'));

  function tickClock() {
    $('#clock').textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  tickClock();
  setInterval(tickClock, 15000);

  // ─── Moving around with arrow keys or a controller ───
  const FOCUSABLE = 'button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex="0"], a[href]';
  const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !el.closest('[hidden]'); };
  function navLayer() {
    if (!spot.hidden) return spot;
    if (!menuPop.hidden) return menuPop;
    if (front) return $('#sheet-' + front);
    return $('#home');
  }
  function layerItems(layer) {
    let items = $$(FOCUSABLE, layer).filter(visible);
    if (layer === $('#home')) items = items.concat($$('.tab, .icon-btn, .top__logo').filter(visible));
    return items;
  }
  function spatialMove(dir) {
    const layer = navLayer();
    const items = layerItems(layer);
    if (!items.length) return false;
    let cur = document.activeElement;
    if (!cur || !items.includes(cur)) { cur = null; }
    if (!cur) { const first = layer === $('#home') ? ($('.game-card') || items[0]) : items[0]; first.focus({ preventScroll: true }); revealFocus(first); return true; }
    const c = cur.getBoundingClientRect();
    const cx = c.left + c.width / 2, cy = c.top + c.height / 2;
    let best = null, bestScore = Infinity;
    items.forEach(el => {
      if (el === cur) return;
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const dx = x - cx, dy = y - cy;
      let score;
      if (dir === 'right' && dx > 4) score = dx + 2.5 * Math.abs(dy);
      else if (dir === 'left' && dx < -4) score = -dx + 2.5 * Math.abs(dy);
      else if (dir === 'down' && dy > 4) score = dy + 2.5 * Math.abs(dx);
      else if (dir === 'up' && dy < -4) score = -dy + 2.5 * Math.abs(dx);
      else return;
      if (score < bestScore) { bestScore = score; best = el; }
    });
    if (!best) return false;
    best.focus({ preventScroll: true });
    revealFocus(best);
    return true;
  }
  function revealFocus(el) { try { el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); } catch {} }
  function goBack() {
    if (!spot.hidden) { closeSpot(); return true; }
    if (!menuPop.hidden) { closeMenu(); return true; }
    if (gamePlayer.classList.contains('open')) { closeGame(); return true; }
    if (front) { closeSheet(); return true; }
    if (tab !== 'games') { openApp('games'); return true; }
    return false;
  }

  // Controller: D-pad or left stick moves, Cross (A) selects, Circle (B) goes back. Ignored while a game or
  // app is open, because those read the controller themselves.
  const padState = {};
  function padLoop() {
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    const busy = gamePlayer.classList.contains('open') || (front && APPS[front].ext);
    const now = performance.now();
    const held = { left: false, right: false, up: false, down: false, a: false, b: false };
    pads.forEach(p => {
      const bt = i => !!(p.buttons[i] && p.buttons[i].pressed);
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      held.left = held.left || bt(14) || ax < -0.6;
      held.right = held.right || bt(15) || ax > 0.6;
      held.up = held.up || bt(12) || ay < -0.6;
      held.down = held.down || bt(13) || ay > 0.6;
      held.a = held.a || bt(0);
      held.b = held.b || bt(1);
    });
    Object.keys(held).forEach(k => {
      const s = padState[k] || (padState[k] = { down: false, next: 0 });
      if (!held[k]) { s.down = false; return; }
      let fire = false;
      if (!s.down) { s.down = true; s.next = now + 380; fire = true; }
      else if (k !== 'a' && k !== 'b' && now >= s.next) { s.next = now + 110; fire = true; }
      if (!fire || busy) return;
      if (k === 'a') { const el = document.activeElement; if (el && el !== document.body) el.click(); }
      else if (k === 'b') goBack();
      else spatialMove(k);
    });
    requestAnimationFrame(padLoop);
  }
  window.addEventListener('gamepadconnected', () => { if (!padLoop.running) { padLoop.running = true; padLoop(); } });


  // ─── Desktop: Spotlight search ───
  const spot = $('#spot'), spotInput = $('#spotInput'), spotList = $('#spotList');
  let spotRows = [], spotIndex = 0;
  const SPOT_APPS = [['games', 'Games'], ['apps', 'Apps'], ['options', 'Settings'], ['help', 'Help'], ['about', 'About Bedrock Games']].concat(EXT_APPS.map(a => [a.id, a.title]));

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
    else if (APP_ICONS[row.app]) icon.innerHTML = '<span class="px">' + APP_ICONS[row.app] + '</span>';
    else icon.classList.add('spot__icon--none');
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
    const playedId = currentGameId;
    currentGameId = null;
    if (fsElement()) exitFs();
    refreshGames(true);
    // Put focus back on the tile that was played. Leaving fullscreen can drop focus a moment later, so retry.
    const refocus = () => {
      if (gamePlayer.classList.contains('open') || front || (document.activeElement && document.activeElement !== document.body)) return;
      const back = playedId && $('.game-card[data-id="' + playedId + '"]');
      if (back) back.focus({ preventScroll: true });
    };
    refocus();
    setTimeout(refocus, 150);
    setTimeout(refocus, 500);
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
    card.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') setFocusGame(game); });
    card.addEventListener('focus', () => setFocusGame(game));
    return card;
  }

  // The game that is highlighted: shown large below the shelf, and its art fills the background.
  let focusedGame = null;
  const detailTitle = $('#detailTitle'), detailMeta = $('#detailMeta'), detailFav = $('#detailFav'), bgArt = $('#bgArt');
  function setFocusGame(game) {
    if (game === focusedGame) return;
    focusedGame = game || null;
    $('#details').classList.toggle('is-empty', !game);
    if (!game) { bgArt.classList.remove('on'); return; }
    detailTitle.textContent = game.title;
    const n = plays[game.id] || 0;
    detailMeta.textContent = game.category.charAt(0).toUpperCase() + game.category.slice(1) + (n ? ' · Played ' + n + (n === 1 ? ' time' : ' times') : '');
    syncDetailFav();
    if (game.img) { bgArt.style.backgroundImage = 'url("' + game.img + '")'; bgArt.classList.add('on'); }
    else bgArt.classList.remove('on');
  }
  function syncDetailFav() { if (focusedGame) detailFav.textContent = isFavorite(focusedGame.id) ? 'Saved' : 'Save'; }
  function syncCardFav(id) {
    const c = $('.game-card[data-id="' + id + '"]');
    if (!c) return;
    let f = $('.game-card__fav', c);
    if (isFavorite(id)) {
      if (!f) { f = document.createElement('span'); f.className = 'game-card__fav'; f.innerHTML = HEART_SVG; $('.game-card__image', c).appendChild(f); }
    } else if (f) f.parentNode.removeChild(f);
  }
  $('#detailPlay').addEventListener('click', () => { if (focusedGame) openGame(focusedGame); });
  detailFav.addEventListener('click', () => {
    if (!focusedGame) return;
    const added = toggleFavorite(focusedGame.id);
    syncDetailFav(); syncCardFav(focusedGame.id);
    showToast(added ? 'Saved to favorites' : 'Removed from favorites');
  });

  // Shelf (one scrolling row) or grid (everything at once)
  function applyView() {
    if (settings.view !== 'grid' && settings.view !== 'shelf') settings.view = DEFAULTS.view;
    const grid = settings.view === 'grid';
    $('#pane-games').classList.toggle('is-grid', grid);
    $('#viewToggle').textContent = grid ? 'Shelf view' : 'Grid view';
  }
  applyView();
  $('#viewToggle').addEventListener('click', () => {
    settings.view = settings.view === 'grid' ? 'shelf' : 'grid';
    save('view', settings.view);
    applyView();
    gamesScroll.scrollLeft = 0; gamesScroll.scrollTop = 0;
    maybeLoadMore();
  });
  function maybeLoadMore() {
    if (!currentFiltered.length || visibleCount >= currentFiltered.length) return;
    const g = settings.view === 'grid';
    const near = g ? gamesScroll.scrollTop + gamesScroll.clientHeight > gamesScroll.scrollHeight - 500
      : gamesScroll.scrollLeft + gamesScroll.clientWidth > gamesScroll.scrollWidth - 700;
    if (near) showMore();
  }
  gamesScroll.addEventListener('scroll', maybeLoadMore, { passive: true });

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
    const top = gamesScroll.scrollTop, left = gamesScroll.scrollLeft;
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
      focusedGame = undefined; setFocusGame(null);
      return;
    }
    visibleCount = Math.min(PAGE_SIZE, list.length);
    const frag = document.createDocumentFragment();
    for (let i = 0; i < visibleCount; i++) frag.appendChild(makeCard(list[i]));
    grid.appendChild(frag);
    if (visibleCount < list.length) showLoadMore();
    gamesScroll.scrollTop = keepScroll ? top : 0;
    gamesScroll.scrollLeft = keepScroll ? left : 0;
    const prev = keepScroll && focusedGame ? list.find(g => g.id === focusedGame.id) : null;
    focusedGame = undefined;
    setFocusGame(prev || list[0]);
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
    applyTheme(); applyGlass(); applyWall(); applyTabCloak(); syncSettingsUI(); applyView();
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
    if (e.key === 'Escape') { if (goBack()) e.preventDefault(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(String(e.target.tagName).toUpperCase()) || e.target.isContentEditable) return;
    if (gamePlayer.classList.contains('open')) return;
    const arrow = (e.key.match(/^Arrow(Left|Right|Up|Down)$/) || [])[1];
    if (arrow) { if (!(front && APPS[front].ext) && spatialMove(arrow.toLowerCase())) e.preventDefault(); return; }
    if (!spot.hidden) return;
    if (e.key === settings.panicKey) { goPanic(); return; }
    if (e.key === '/') { e.preventDefault(); openSpot(); }
    else if (e.key === '1') openApp('games');
    else if (e.key === '2') openApp('apps');
    else if (e.key === '3') openApp('options');
    else if (e.key === '?') openApp('help');
  });

  $('#aboutReload').addEventListener('click', () => location.reload());
  $('#aboutBuild').textContent = BUILD;

  // ─── Start ───
  updateCounts();
  refreshGames();
  showPanicKey();

  const routeId = () => (location.hash.match(/^#\/(\w+)/) || [])[1];
  setTab('games');
  if (APPS[routeId()]) openApp(routeId());
  window.addEventListener('hashchange', () => {
    const id = routeId();
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
