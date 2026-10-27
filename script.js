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
    if (e.key === settings.panicKey) {
      window.location.replace(settings.panicUrl || 'https://classroom.google.com');
    }
  });

  // ─── Render games ───
  const grid = $('#gamesGrid');
  const gameCountEl = $('#gameCount');
  const subtitleEl = $('#gamesSubtitle');
  let activeCategory = 'all';
  const PAGE_SIZE = 60;
  let currentFiltered = [];
  let visibleCount = 0;

  function makeCard(game) {
    const card = document.createElement('a');
    card.href = game.path;
    card.className = 'game-card';
    card.dataset.title = game.title;
    card.dataset.id = game.id;
    const imgPart = game.img
      ? `<img class="game-card__thumb" src="${game.img}" alt="${game.title}" loading="lazy"><span class="game-card__emoji-badge">${game.emoji}</span>`
      : game.emoji;
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

  gameCountEl.textContent = GAMES.length;
  renderGames('all', '');

  // ─── Category filter ───
  const categoryBar = $('#categoryBar');
  categoryBar.addEventListener('click', e => {
    const btn = e.target.closest('.category');
    if (!btn) return;
    $$('.category', categoryBar).forEach(b => b.classList.remove('category--active'));
    btn.classList.add('category--active');
    activeCategory = btn.dataset.category;
    renderGames(activeCategory, $('#searchInput').value);
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

  // ─── Search ───
  const searchInput = $('#searchInput');
  searchInput.addEventListener('input', () => {
    renderGames(activeCategory, searchInput.value);
  });

  // ─── Settings modal ───
  const settingsOverlay = $('#settingsOverlay');
  const settingsBtn = $('#settingsBtn');
  const heroSettingsBtn = $('#heroSettingsBtn');
  const settingsClose = $('#settingsClose');

  function openSettings() { settingsOverlay.classList.add('open'); syncSettingsUI(); }
  function closeSettings() { settingsOverlay.classList.remove('open'); }

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

  $('#resetSettings').addEventListener('click', () => {
    if (!confirm('Reset all settings to defaults?')) return;
    try {
      Object.keys(localStorage).forEach(k => { if (k.startsWith('bg-')) localStorage.removeItem(k); });
    } catch {}
    sessionStorage.removeItem('bg-cloaked');
    settings = { theme: 'system', cloak: false, tabTitle: '', tabIcon: '', panicKey: '`', panicUrl: 'https://classroom.google.com' };
    applyTheme();
    applyTabCloak();
    syncSettingsUI();
  });

  // ─── Home link ───
  $('#homeLink').addEventListener('click', e => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ─── Smooth nav on scroll ───
  const nav = $('.nav');
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        nav.style.borderBottomColor = window.scrollY > 20 ? 'var(--border)' : 'transparent';
        ticking = false;
      });
      ticking = true;
    }
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
