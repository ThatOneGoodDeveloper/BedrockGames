(function () {
  'use strict';

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => [...(ctx || document).querySelectorAll(sel)];
  const root = document.documentElement;

  // ─── Storage helpers ───
  function load(key, fallback) {
    try { const v = localStorage.getItem('bg-' + key); return v !== null ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  }
  function save(key, val) {
    try { localStorage.setItem('bg-' + key, JSON.stringify(val)); } catch {}
  }

  // ─── Favicon map ───
  const ICONS = {
    google:    'https://www.google.com/favicon.ico',
    drive:     'https://ssl.gstatic.com/docs/doclist/images/drive_2022q3_32dp.png',
    docs:      'https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico',
    classroom: 'https://ssl.gstatic.com/classroom/favicon.png',
    canvas:    'https://du11hjcvx0uqb.cloudfront.net/dist/images/favicon-e10d657a73.ico',
    wikipedia: 'https://en.wikipedia.org/static/favicon/wikipedia.ico',
    khan:      'https://cdn.kastatic.org/images/favicon.ico',
  };

  // ─── Settings state ───
  let settings = {
    theme:    load('theme', 'system'),
    cloak:    load('cloak', false),
    tabTitle: load('tabTitle', ''),
    tabIcon:  load('tabIcon', ''),
    panicKey: load('panicKey', '`'),
    panicUrl: load('panicUrl', 'https://classroom.google.com'),
  };

  // ─── Favorites & History ───
  let favorites = load('favorites', []);
  let recentlyPlayed = load('recent', []);

  function isFavorite(id) { return favorites.includes(id); }

  function toggleFavorite(id) {
    const i = favorites.indexOf(id);
    if (i >= 0) favorites.splice(i, 1);
    else favorites.unshift(id);
    save('favorites', favorites);
    renderFavorites();
    return i < 0;
  }

  function addToRecent(id) {
    recentlyPlayed = recentlyPlayed.filter(r => r !== id);
    recentlyPlayed.unshift(id);
    if (recentlyPlayed.length > 20) recentlyPlayed = recentlyPlayed.slice(0, 20);
    save('recent', recentlyPlayed);
    renderRecent();
  }

  function getGameById(id) { return GAMES.find(g => g.id === id); }

  // ─── Toast ───
  let toastTimer;
  function showToast(msg) {
    let el = $('#toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
  }

  // ─── Theme ───
  function resolveTheme(pref) {
    if (pref === 'light' || pref === 'dark') return pref;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  function applyTheme() {
    const resolved = resolveTheme(settings.theme);
    root.setAttribute('data-theme', resolved);
    $$('.theme-opt').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.themeVal === settings.theme);
    });
  }
  applyTheme();

  // ─── Tab cloaking ───
  function applyTabCloak() {
    if (settings.tabTitle) document.title = settings.tabTitle;
    else document.title = 'Bedrock Games';

    const link = $('link[rel="icon"]');
    if (settings.tabIcon && ICONS[settings.tabIcon]) {
      link.href = ICONS[settings.tabIcon];
    } else {
      link.href = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎮</text></svg>";
    }
  }
  applyTabCloak();

  function openInBlank() {
    const url = window.location.href;
    const win = window.open('about:blank', '_blank');
    if (!win) return;
    const iframe = win.document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:none;margin:0;padding:0;';
    iframe.src = url;
    win.document.body.style.margin = '0';
    win.document.body.appendChild(iframe);
    if (settings.tabTitle) win.document.title = settings.tabTitle;
    else win.document.title = 'Google Docs';
    if (settings.tabIcon && ICONS[settings.tabIcon]) {
      const fav = win.document.createElement('link');
      fav.rel = 'icon';
      fav.href = ICONS[settings.tabIcon];
      win.document.head.appendChild(fav);
    }
    window.location.replace(settings.panicUrl || 'https://classroom.google.com');
  }

  if (settings.cloak && window.self === window.top && !sessionStorage.getItem('bg-cloaked')) {
    sessionStorage.setItem('bg-cloaked', '1');
    openInBlank();
  }

  // ─── Panic key ───
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if ($('#gamePlayer').classList.contains('open')) return;
    if (e.key === settings.panicKey) {
      window.location.replace(settings.panicUrl || 'https://classroom.google.com');
    }
  });

  // ─── Game Player (fullscreen overlay) ───
  const gamePlayer = $('#gamePlayer');
  const gamePlayerFrame = $('#gamePlayerFrame');
  const gamePlayerTitle = $('#gamePlayerTitle');
  const gamePlayerFav = $('#gamePlayerFav');
  let currentGameId = null;

  function openGame(game) {
    currentGameId = game.id;
    gamePlayerTitle.textContent = game.title;
    gamePlayerFrame.src = game.path;
    gamePlayer.classList.add('open');
    document.body.style.overflow = 'hidden';
    addToRecent(game.id);
    updateFavBtn();
  }

  function closeGame() {
    gamePlayer.classList.remove('open');
    gamePlayerFrame.src = '';
    document.body.style.overflow = '';
    currentGameId = null;
  }

  function updateFavBtn() {
    if (!currentGameId) return;
    const active = isFavorite(currentGameId);
    gamePlayerFav.classList.toggle('fav-active', active);
  }

  $('#gamePlayerBack').addEventListener('click', closeGame);

  gamePlayerFav.addEventListener('click', () => {
    if (!currentGameId) return;
    const added = toggleFavorite(currentGameId);
    updateFavBtn();
    showToast(added ? 'Added to favorites' : 'Removed from favorites');
  });

  $('#gamePlayerFullscreen').addEventListener('click', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      gamePlayer.requestFullscreen().catch(() => {});
    }
  });

  $('#gamePlayerNewTab').addEventListener('click', () => {
    if (currentGameId) {
      const game = getGameById(currentGameId);
      if (game) window.open(game.path, '_blank');
    }
  });

  document.addEventListener('keydown', e => {
    if (!gamePlayer.classList.contains('open')) return;
    if (e.key === 'Escape') { e.preventDefault(); closeGame(); }
  });

  // ─── Render games ───
  const grid = $('#gamesGrid');
  const gameCountEl = $('#gameCount');
  const subtitleEl = $('#gamesSubtitle');
  let activeCategory = 'all';
  const PAGE_SIZE = 60;
  let currentFiltered = [];
  let visibleCount = 0;

  function makeCard(game, opts) {
    const card = document.createElement('div');
    card.className = 'game-card';
    card.dataset.title = game.title;
    card.dataset.id = game.id;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');

    const favBadge = isFavorite(game.id) ? '<span class="game-card__fav-badge">&#9829;</span>' : '';

    const imgPart = game.img
      ? `<img class="game-card__thumb" src="${game.img}" alt="${game.title}" loading="lazy"><span class="game-card__emoji-badge">${game.emoji}</span>${favBadge}`
      : `${game.emoji}${favBadge}`;

    card.innerHTML = `
      <div class="game-card__image${game.img ? ' game-card__image--has-thumb' : ''}">
        ${imgPart}
        <div class="game-card__play">
          <div class="game-card__play-btn">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
      </div>
      <div class="game-card__body">
        <div class="game-card__title">${game.title}</div>
        <div class="game-card__category">${game.category}</div>
      </div>`;

    card.addEventListener('click', () => openGame(game));
    card.addEventListener('keydown', e => { if (e.key === 'Enter') openGame(game); });
    return card;
  }

  function renderGames(filter, search) {
    grid.innerHTML = '';
    let filtered = GAMES;
    if (filter && filter !== 'all') filtered = filtered.filter(g => g.category === filter);
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(g => g.title.toLowerCase().includes(q));
    }

    currentFiltered = filtered;
    subtitleEl.textContent = filtered.length + ' game' + (filtered.length !== 1 ? 's' : '') + (filter !== 'all' ? ' in ' + filter : '');

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">🔍</div>
          <h3 class="empty-state__title">No games found</h3>
          <p class="empty-state__text">Try a different search or category.</p>
        </div>`;
      removeLoadMore();
      return;
    }

    visibleCount = Math.min(PAGE_SIZE, filtered.length);
    const frag = document.createDocumentFragment();
    for (let i = 0; i < visibleCount; i++) frag.appendChild(makeCard(filtered[i]));
    grid.appendChild(frag);

    if (visibleCount < filtered.length) showLoadMore();
    else removeLoadMore();
  }

  function showMore() {
    const start = visibleCount;
    const end = Math.min(visibleCount + PAGE_SIZE, currentFiltered.length);
    const frag = document.createDocumentFragment();
    for (let i = start; i < end; i++) frag.appendChild(makeCard(currentFiltered[i]));
    grid.appendChild(frag);
    visibleCount = end;
    if (visibleCount >= currentFiltered.length) removeLoadMore();
    else updateLoadMoreText();
  }

  function showLoadMore() {
    let btn = $('#loadMoreBtn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'loadMoreBtn';
      btn.className = 'btn btn--primary btn--load-more';
      btn.addEventListener('click', showMore);
      grid.parentElement.appendChild(btn);
    }
    updateLoadMoreText();
    btn.style.display = '';
  }

  function updateLoadMoreText() {
    const btn = $('#loadMoreBtn');
    if (btn) {
      const remaining = currentFiltered.length - visibleCount;
      btn.textContent = 'Load More (' + remaining + ' remaining)';
    }
  }

  function removeLoadMore() {
    const btn = $('#loadMoreBtn');
    if (btn) btn.style.display = 'none';
  }

  // ─── Category counts ───
  function renderCategoryCounts() {
    const counts = {};
    GAMES.forEach(g => { counts[g.category] = (counts[g.category] || 0) + 1; });
    const countAll = $('#countAll');
    if (countAll) countAll.textContent = GAMES.length;
    ['puzzle','arcade','action','racing','adventure','multiplayer','shooting','simulation','platform','sports'].forEach(cat => {
      const el = $('#count' + cat.charAt(0).toUpperCase() + cat.slice(1));
      if (el) el.textContent = counts[cat] || 0;
    });
  }

  gameCountEl.textContent = GAMES.length;
  renderCategoryCounts();
  renderGames('all', '');

  // ─── Recently Played ───
  function renderRecent() {
    const section = $('#recentSection');
    const container = $('#recentGrid');
    const games = recentlyPlayed.map(getGameById).filter(Boolean).slice(0, 10);
    if (games.length === 0) { section.style.display = 'none'; return; }
    section.style.display = '';
    container.innerHTML = '';
    const frag = document.createDocumentFragment();
    games.forEach(g => frag.appendChild(makeCard(g)));
    container.appendChild(frag);
  }
  renderRecent();

  // ─── Favorites ───
  function renderFavorites() {
    const section = $('#favSection');
    const container = $('#favGrid');
    const games = favorites.map(getGameById).filter(Boolean);
    if (games.length === 0) { section.style.display = 'none'; return; }
    section.style.display = '';
    container.innerHTML = '';
    const frag = document.createDocumentFragment();
    games.forEach(g => frag.appendChild(makeCard(g)));
    container.appendChild(frag);
  }
  renderFavorites();

  // ─── Category filter ───
  const categoryBar = $('#categoryBar');
  categoryBar.addEventListener('click', e => {
    const btn = e.target.closest('.category');
    if (!btn) return;
    $$('.category', categoryBar).forEach(b => b.classList.remove('category--active'));
    btn.classList.add('category--active');
    activeCategory = btn.dataset.category;
    const searchVal = $('#searchInput').value || ($('#mobileSearchInput') ? $('#mobileSearchInput').value : '');
    renderGames(activeCategory, searchVal);
  });

  $$('[data-cat-link]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const cat = link.dataset.catLink;
      $$('.category', categoryBar).forEach(b => {
        b.classList.toggle('category--active', b.dataset.category === cat);
      });
      activeCategory = cat;
      renderGames(cat, '');
      document.getElementById('games').scrollIntoView({ behavior: 'smooth' });
    });
  });

  // ─── Search (desktop) ───
  const searchInput = $('#searchInput');
  searchInput.addEventListener('input', () => {
    renderGames(activeCategory, searchInput.value);
    const mobileInput = $('#mobileSearchInput');
    if (mobileInput && mobileInput.value !== searchInput.value) mobileInput.value = searchInput.value;
  });

  // ─── Mobile search ───
  const mobileSearchBtn = $('#mobileSearchBtn');
  const mobileSearchBar = $('#mobileSearchBar');
  const mobileSearchInput = $('#mobileSearchInput');
  const mobileSearchClose = $('#mobileSearchClose');

  mobileSearchBtn.addEventListener('click', () => {
    mobileSearchBar.classList.add('open');
    mobileSearchInput.focus();
  });

  mobileSearchClose.addEventListener('click', () => {
    mobileSearchBar.classList.remove('open');
    mobileSearchInput.value = '';
    searchInput.value = '';
    renderGames(activeCategory, '');
  });

  mobileSearchInput.addEventListener('input', () => {
    renderGames(activeCategory, mobileSearchInput.value);
    searchInput.value = mobileSearchInput.value;
  });

  // ─── Random game ───
  $('#randomGameBtn').addEventListener('click', () => {
    const game = GAMES[Math.floor(Math.random() * GAMES.length)];
    if (game) openGame(game);
  });

  // ─── Settings modal ───
  const settingsOverlay = $('#settingsOverlay');
  const settingsBtn = $('#settingsBtn');
  const heroSettingsBtn = $('#heroSettingsBtn');
  const settingsClose = $('#settingsClose');

  function openSettings() { settingsOverlay.classList.add('open'); document.body.style.overflow = 'hidden'; syncSettingsUI(); }
  function closeSettings() { settingsOverlay.classList.remove('open'); document.body.style.overflow = ''; }

  settingsBtn.addEventListener('click', openSettings);
  heroSettingsBtn.addEventListener('click', openSettings);
  settingsClose.addEventListener('click', closeSettings);
  settingsOverlay.addEventListener('click', e => { if (e.target === settingsOverlay) closeSettings(); });

  function syncSettingsUI() {
    $$('.theme-opt').forEach(btn => btn.classList.toggle('active', btn.dataset.themeVal === settings.theme));
    $('#cloakToggle').setAttribute('aria-checked', String(settings.cloak));
    $('#tabTitleInput').value = settings.tabTitle;
    $('#tabIconSelect').value = settings.tabIcon;
    $('#panicKeyDisplay').textContent = settings.panicKey === ' ' ? 'Space' : settings.panicKey;
    $('#panicUrlInput').value = settings.panicUrl;
  }

  $$('.theme-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      settings.theme = btn.dataset.themeVal;
      save('theme', settings.theme);
      applyTheme();
    });
  });

  $('#cloakToggle').addEventListener('click', function () {
    settings.cloak = !settings.cloak;
    this.setAttribute('aria-checked', String(settings.cloak));
    save('cloak', settings.cloak);
  });

  $('#tabTitleInput').addEventListener('input', function () {
    settings.tabTitle = this.value;
    save('tabTitle', settings.tabTitle);
    applyTabCloak();
  });

  $('#tabIconSelect').addEventListener('change', function () {
    settings.tabIcon = this.value;
    save('tabIcon', settings.tabIcon);
    applyTabCloak();
  });

  const panicKeyDisplay = $('#panicKeyDisplay');
  const setPanicKeyBtn = $('#setPanicKey');
  let listeningForKey = false;

  setPanicKeyBtn.addEventListener('click', () => {
    listeningForKey = true;
    panicKeyDisplay.textContent = '...';
    panicKeyDisplay.classList.add('listening');
    setPanicKeyBtn.textContent = 'Press a key';
  });

  document.addEventListener('keydown', e => {
    if (!listeningForKey) return;
    e.preventDefault();
    listeningForKey = false;
    settings.panicKey = e.key;
    save('panicKey', settings.panicKey);
    panicKeyDisplay.textContent = e.key === ' ' ? 'Space' : e.key;
    panicKeyDisplay.classList.remove('listening');
    setPanicKeyBtn.textContent = 'Change';
  });

  $('#panicUrlInput').addEventListener('input', function () {
    settings.panicUrl = this.value;
    save('panicUrl', settings.panicUrl);
  });

  $('#launchBlank').addEventListener('click', openInBlank);

  // ─── Clear favorites & history ───
  $('#clearFavorites').addEventListener('click', () => {
    if (!confirm('Clear all favorites?')) return;
    favorites = [];
    save('favorites', favorites);
    renderFavorites();
    renderGames(activeCategory, searchInput.value);
    showToast('Favorites cleared');
  });

  $('#clearHistory').addEventListener('click', () => {
    if (!confirm('Clear recently played?')) return;
    recentlyPlayed = [];
    save('recent', recentlyPlayed);
    renderRecent();
    showToast('History cleared');
  });

  $('#resetSettings').addEventListener('click', () => {
    if (!confirm('Reset all settings to defaults?')) return;
    try {
      Object.keys(localStorage).forEach(k => { if (k.startsWith('bg-')) localStorage.removeItem(k); });
    } catch {}
    sessionStorage.removeItem('bg-cloaked');
    settings = { theme: 'system', cloak: false, tabTitle: '', tabIcon: '', panicKey: '`', panicUrl: 'https://classroom.google.com' };
    favorites = [];
    recentlyPlayed = [];
    applyTheme();
    applyTabCloak();
    syncSettingsUI();
    renderFavorites();
    renderRecent();
    renderGames('all', '');
    showToast('Settings reset');
  });

  // ─── Home link ───
  $('#homeLink').addEventListener('click', e => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ─── Nav scroll effect ───
  const nav = $('.nav');
  const backToTop = $('#backToTop');
  let ticking = false;

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const scrolled = window.scrollY > 20;
        nav.classList.toggle('nav--scrolled', scrolled);
        backToTop.classList.toggle('visible', window.scrollY > 400);
        ticking = false;
      });
      ticking = true;
    }
  });

  // ─── Back to top ───
  backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ─── Scroll animations ───
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  $$('.feature, .category').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    obs.observe(el);
  });
})();
