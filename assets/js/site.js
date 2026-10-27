/* Site-wide enhancements: search, filters, recent games, mobile nav. */
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  // --- Recently played -----------------------------------------------------
  const RECENT_KEY = 'ugg-recent';
  const currentGame = document.body.dataset.game;
  if (currentGame) {
    try {
      const recent = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      const next = [currentGame, ...recent.filter((s) => s !== currentGame)].slice(0, 6);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  const recentSection = $('#recentSection');
  const recentGrid = $('#recentGrid');
  const gamesGrid = $('#catalogGrid');
  if (recentSection && recentGrid && gamesGrid) {
    try {
      const recent = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      const cards = new Map($$('.game-card', gamesGrid).map((card) => [card.dataset.game, card]));
      const picked = recent.map((slug) => cards.get(slug)).filter(Boolean);
      if (picked.length) {
        picked.forEach((card) => recentGrid.appendChild(card.cloneNode(true)));
        recentSection.hidden = false;
      }
      $('#clearRecent')?.addEventListener('click', () => {
        localStorage.removeItem(RECENT_KEY);
        recentSection.hidden = true;
      });
    } catch {
      /* ignore */
    }
  }

  // --- Mobile navigation ---------------------------------------------------
  const navToggle = $('#navToggle');
  const mobileNav = $('#mobileNav');
  navToggle?.addEventListener('click', () => {
    const open = navToggle.getAttribute('aria-expanded') === 'true';
    navToggle.setAttribute('aria-expanded', String(!open));
    navToggle.setAttribute('aria-label', open ? 'Open menu' : 'Close menu');
    mobileNav.hidden = open;
    document.body.classList.toggle('nav-open', !open);
  });
  $$('a', mobileNav || document.createElement('div')).forEach((link) =>
    link.addEventListener('click', () => {
      if (!mobileNav) return;
      mobileNav.hidden = true;
      navToggle?.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('nav-open');
    })
  );

  // --- Header shadow -------------------------------------------------------
  const header = $('#siteHeader');
  const onScroll = () => header?.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // --- Back to top ---------------------------------------------------------
  $('#backTop')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.getElementById('main')?.focus?.();
  });

  // --- Search + category filtering ----------------------------------------
  const searchInput = $('#siteSearch');
  const chips = $$('.chip[data-filter]');
  const resultCount = $('#resultCount');
  const emptyState = $('#emptyState');
  const featuredSection = $('#featuredSection');
  const categoriesSection = $('#categoriesSection');
  let activeFilter = 'all';

  function applyFilters() {
    if (!gamesGrid) return;
    const query = (searchInput?.value || '').trim().toLowerCase();
    let visible = 0;
    const cards = $$('.game-card', gamesGrid);
    cards.forEach((card) => {
      const name = card.dataset.name || '';
      const tags = card.dataset.tags || '';
      const matchesQuery = !query || name.includes(query) || tags.includes(query);
      const matchesCategory =
        activeFilter === 'all' ||
        tags.split(' ').includes(activeFilter) ||
        (card.dataset.category || '') === activeFilter;
      const show = matchesQuery && matchesCategory;
      card.hidden = !show;
      if (show) visible += 1;
    });
    if (resultCount) {
      resultCount.textContent = query || activeFilter !== 'all'
        ? `${visible} game${visible === 1 ? '' : 's'} found`
        : `${visible} games`;
    }
    if (emptyState) emptyState.hidden = visible !== 0;
    const filtering = Boolean(query) || activeFilter !== 'all';
    if (featuredSection) featuredSection.hidden = filtering;
    if (categoriesSection) categoriesSection.hidden = filtering;
    if (recentSection && recentGrid) recentSection.hidden = filtering || recentGrid.children.length === 0;
  }

  function selectChip(filter) {
    activeFilter = filter;
    chips.forEach((chip) => {
      const on = chip.dataset.filter === filter;
      chip.classList.toggle('is-active', on);
      chip.setAttribute('aria-pressed', String(on));
    });
    applyFilters();
  }

  chips.forEach((chip) => {
    chip.addEventListener('click', () => selectChip(chip.dataset.filter));
  });

  if (gamesGrid) {
    const params = new URLSearchParams(location.search);
    const initialQuery = params.get('q');
    if (initialQuery && searchInput) searchInput.value = initialQuery;
    const initialFilter = params.get('category');
    if (initialFilter && chips.some((c) => c.dataset.filter === initialFilter)) {
      selectChip(initialFilter);
    } else {
      applyFilters();
    }
    searchInput?.addEventListener('input', () => {
      applyFilters();
      const value = searchInput.value.trim();
      const url = new URL(location.href);
      if (value) url.searchParams.set('q', value);
      else url.searchParams.delete('q');
      history.replaceState(null, '', url);
    });
  }

  // --- Sort ----------------------------------------------------------------
  const sortSelect = $('#sortSelect');
  sortSelect?.addEventListener('change', () => {
    if (!gamesGrid) return;
    const cards = $$('.game-card', gamesGrid);
    const sorted = [...cards].sort((a, b) => {
      if (sortSelect.value === 'plays') return Number(b.dataset.plays || 0) - Number(a.dataset.plays || 0);
      if (sortSelect.value === 'az') return (a.dataset.name || '').localeCompare(b.dataset.name || '');
      if (sortSelect.value === 'za') return (b.dataset.name || '').localeCompare(a.dataset.name || '');
      return Number(a.dataset.order || 0) - Number(b.dataset.order || 0);
    });
    sorted.forEach((card) => gamesGrid.appendChild(card));
  });

  // --- Animated play counters ---------------------------------------------
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const compact = (value) => {
    const n = Number(value) || 0;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
    return String(n);
  };
  $$('.card-plays[data-play-count]').slice(0, 80).forEach((el) => {
    if (el.dataset.counted === 'true') return;
    el.dataset.counted = 'true';
    const target = Number(el.dataset.playCount) || 0;
    const out = el.querySelector('.plays-number');
    if (!out) return;
    if (reduceMotion) {
      out.textContent = compact(target);
      return;
    }
    const started = performance.now();
    const duration = 850;
    const step = (now) => {
      const t = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      out.textContent = compact(target * eased);
      if (t < 1) requestAnimationFrame(step);
      else out.textContent = compact(target);
    };
    requestAnimationFrame(step);
  });

  // --- Keyboard shortcut: "/" focuses search -------------------------------
  window.addEventListener('keydown', (event) => {
    const tag = (event.target?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || event.target?.isContentEditable) {
      if (event.key === 'Escape') {
        searchInput?.blur();
        if (searchInput?.value) {
          searchInput.value = '';
          applyFilters();
        }
      }
      return;
    }
    if (event.key === '/' && searchInput) {
      event.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });

  // --- Copy link / share on game pages ------------------------------------
  const shareBtn = $('#shareGame');
  shareBtn?.addEventListener('click', async () => {
    const shareData = {
      title: document.title,
      text: 'Play this free unblocked game online.',
      url: location.href,
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(location.href);
        shareBtn.textContent = 'Link copied!';
        setTimeout(() => (shareBtn.textContent = 'Share'), 1800);
      }
    } catch {
      /* user cancelled */
    }
  });

  // --- Prevent the page from scrolling behind a focused stage -------------
  $('#gameStage')?.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
      event.preventDefault();
    }
  });

  // --- PWA install prompt and service worker ------------------------------
  const installBanner = $('#installBanner');
  const installDismissedAt = Number(localStorage.getItem('ugg-install-dismissed') || 0);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const canShowInstall = () =>
    installBanner &&
    !isStandalone &&
    Date.now() - installDismissedAt > 14 * 24 * 60 * 60 * 1000 &&
    document.body.classList.contains('home');
  let deferredInstall = null;

  function showInstallBanner() {
    if (canShowInstall()) installBanner.hidden = false;
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstall = event;
    showInstallBanner();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstall = null;
    if (installBanner) installBanner.hidden = true;
    localStorage.removeItem('ugg-install-dismissed');
  });

  $$('[data-install-dismiss]').forEach((button) => {
    button.addEventListener('click', () => {
      if (installBanner) installBanner.hidden = true;
      localStorage.setItem('ugg-install-dismissed', String(Date.now()));
    });
  });

  $$('[data-install-app]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (deferredInstall) {
        deferredInstall.prompt();
        try {
          const choice = await deferredInstall.userChoice;
          if (choice.outcome === 'accepted') {
            localStorage.removeItem('ugg-install-dismissed');
            if (installBanner) installBanner.hidden = true;
          }
        } catch {
          /* the prompt was dismissed */
        }
        deferredInstall = null;
        return;
      }
      if (!location.pathname.endsWith('/install.html')) {
        location.href = '../../';
      } else {
        $('.install-hero')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  if (installBanner && /iphone|ipad|ipod/i.test(navigator.userAgent) && !isStandalone) {
    window.setTimeout(showInstallBanner, 5000);
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* offline support is optional */
      });
    });
  }

})();
