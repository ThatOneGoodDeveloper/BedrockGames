/**
 * Shared game shell: HUD, overlays, pause, sound, fullscreen, high scores
 * and a pause-aware requestAnimationFrame loop.
 *
 * A game module default-exports createGame(api) and returns:
 *   { start(), restart(), pause(), resume(), destroy() }
 * All optional. The shell owns the chrome; the module owns the play field.
 */

const SOUND_KEY = 'ugg-sound';
const bestKey = (slug) => `ugg-best-${slug}`;

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage may be disabled in private mode */
  }
}

function formatNumber(value) {
  if (typeof value === 'string') return value;
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 100_000) return `${(value / 1000).toFixed(1)}k`;
  return Math.round(value).toLocaleString('en-US');
}

export function initGame({ slug, name, createGame, tagline = '', controlsHint = '' }) {
  const shell = document.getElementById('gameShell');
  const stage = document.getElementById('gameStage');
  const area = document.getElementById('gameArea');
  const canvas = document.getElementById('gameCanvas');
  const overlay = document.getElementById('gameOverlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayText = document.getElementById('overlayText');
  const overlayBtn = document.getElementById('overlayBtn');
  const overlayHint = document.getElementById('overlayHint');
  const touchControls = document.getElementById('touchControls');
  const scoreValue = document.getElementById('scoreValue');
  const scoreLabel = document.getElementById('scoreLabel');
  const bestValue = document.getElementById('bestValue');
  const bestLabel = document.getElementById('bestLabel');
  const statusText = document.getElementById('statusText');
  const btnRestart = document.getElementById('btnRestart');
  const btnPause = document.getElementById('btnPause');
  const btnSound = document.getElementById('btnSound');
  const btnFullscreen = document.getElementById('btnFullscreen');

  if (!shell || !stage || !area || !canvas || !overlay) {
    console.error('Game shell markup is missing.');
    return;
  }

  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const state = {
    started: false,
    paused: false,
    over: false,
    destroyed: false,
    sound: readJSON(SOUND_KEY, true) !== false,
    score: 0,
    best: readJSON(bestKey(slug), null),
    bestMode: 'higher',
    scoreFmt: (v) => formatNumber(v),
    bestFmt: (v) => formatNumber(v),
  };

  let loopHandle = null;
  let loopCallback = null;
  let lastTime = 0;
  let intervals = [];
  let audioCtx = null;
  let game = null;
  let lastFocus = null;

  function updateHud() {
    if (scoreValue) scoreValue.textContent = state.scoreFmt(state.score);
    if (bestValue) bestValue.textContent = state.best == null ? '—' : state.bestFmt(state.best);
  }

  function setOverlay({ kicker, title, text, button, hint, tone = 'start' }) {
    overlay.dataset.tone = tone;
    overlay.classList.add('is-visible');
    if (overlayTitle) overlayTitle.textContent = title;
    if (overlayText) overlayText.textContent = text || '';
    if (overlayBtn) overlayBtn.textContent = button;
    if (overlayHint) {
      overlayHint.textContent = hint || '';
      overlayHint.hidden = !hint;
    }
    overlayBtn?.focus({ preventScroll: true });
  }

  function hideOverlay() {
    overlay.classList.remove('is-visible');
  }

  function setStatus(text) {
    if (statusText) statusText.textContent = text;
  }

  function setPaused(paused, { silent = false } = {}) {
    if (!state.started || state.over) return;
    state.paused = paused;
    if (btnPause) {
      btnPause.textContent = paused ? 'Resume' : 'Pause';
      btnPause.classList.toggle('is-paused', paused);
      btnPause.setAttribute('aria-pressed', String(paused));
    }
    if (paused) {
      game?.pause?.();
      if (!silent) {
        setOverlay({
          kicker: 'Paused',
          title: 'Paused',
          text: 'The game is frozen. Your progress is safe.',
          button: 'Resume',
          hint: 'Press P or Esc to resume',
          tone: 'pause',
        });
      }
    } else {
      game?.resume?.();
      hideOverlay();
    }
  }

  function startGame() {
    if (state.over) {
      restartGame();
      return;
    }
    state.started = true;
    state.paused = false;
    hideOverlay();
    if (btnPause) {
      btnPause.disabled = false;
      btnPause.textContent = 'Pause';
      btnPause.classList.remove('is-paused');
    }
    lastTime = performance.now();
    game?.start?.();
    stage.focus({ preventScroll: true });
    setStatus('Playing');
  }

  function restartGame() {
    state.started = true;
    state.paused = false;
    state.over = false;
    state.score = 0;
    updateHud();
    hideOverlay();
    if (btnPause) {
      btnPause.disabled = false;
      btnPause.textContent = 'Pause';
      btnPause.classList.remove('is-paused');
    }
    lastTime = performance.now();
    game?.restart?.();
    stage.focus({ preventScroll: true });
    setStatus('Playing');
  }

  function gameOver({ score, title = 'Game over', message = '', hint = 'Press R to restart', tone = 'over' } = {}) {
    if (state.over) return;
    state.over = true;
    state.started = true;
    if (typeof score === 'number') {
      state.score = score;
      updateHud();
      api.saveBest(score);
    }
    game?.pause?.();
    setOverlay({
      kicker: tone === 'win' ? 'Victory' : 'Run complete',
      title,
      text: message,
      button: 'Play again',
      hint,
      tone,
    });
    setStatus(tone === 'win' ? 'You win!' : 'Game over');
    if (btnPause) btnPause.disabled = true;
  }

  function toggleSound() {
    state.sound = !state.sound;
    writeJSON(SOUND_KEY, state.sound);
    if (btnSound) {
      btnSound.textContent = state.sound ? 'Sound on' : 'Sound off';
      btnSound.classList.toggle('is-muted', !state.sound);
      btnSound.setAttribute('aria-pressed', String(state.sound));
    }
    if (state.sound) api.sfx('click');
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      const target = shell;
      target.requestFullscreen?.().catch(() => {
        shell.classList.toggle('is-expanded');
      });
    }
  }

  function loop(callback) {
    loopCallback = callback;
    lastTime = performance.now();
    if (loopHandle) return () => {};
    const tick = (now) => {
      if (state.destroyed) return;
      loopHandle = requestAnimationFrame(tick);
      const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;
      if (!loopCallback) return;
      if (state.started && !state.paused && !state.over) {
        loopCallback(dt, now);
      } else {
        loopCallback(0, now, true);
      }
    };
    loopHandle = requestAnimationFrame(tick);
    return () => {
      loopCallback = null;
    };
  }

  function every(ms, callback) {
    const id = setInterval(() => {
      if (state.started && !state.paused && !state.over) callback();
    }, ms);
    intervals.push(id);
    return () => clearInterval(id);
  }

  let canvasSize = { w: 0, h: 0 };

  function fitCanvas() {
    if (canvas.hidden || !canvasSize.w) return;
    const stageW = stage.clientWidth;
    const stageH = stage.clientHeight;
    if (!stageW || !stageH) return;
    const scale = Math.min(stageW / canvasSize.w, stageH / canvasSize.h);
    canvas.style.width = `${Math.max(1, canvasSize.w * scale)}px`;
    canvas.style.height = `${Math.max(1, canvasSize.h * scale)}px`;
  }

  function initCanvas(w, h) {
    canvas.hidden = false;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvasSize = { w, h };
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stage.style.aspectRatio = `${w} / ${h}`;
    stage.dataset.ready = 'true';
    fitCanvas();
    requestAnimationFrame(fitCanvas);
    window.addEventListener('resize', fitCanvas);
    if ('ResizeObserver' in window) new ResizeObserver(fitCanvas).observe(stage);
    return { ctx, W: w, H: h };
  }

  function initDOM({ aspect = '1 / 1', maxWidth = 620, autoHeight = true } = {}) {
    canvas.hidden = true;
    stage.style.aspectRatio = aspect;
    stage.style.maxWidth = `${maxWidth}px`;
    stage.classList.toggle('is-dom', autoHeight);
    stage.dataset.ready = 'true';
    return area;
  }

  function addControls(node) {
    if (!touchControls) return;
    if (node) touchControls.appendChild(node);
    touchControls.classList.add('has-controls');
  }

  // --- Sound: tiny WebAudio synth, no asset files -------------------------
  const SOUNDS = {
    click: [[520, 0.045, 'triangle', 0.035]],
    score: [[660, 0.06, 'sine', 0.05], [880, 0.08, 'sine', 0.04]],
    jump: [[330, 0.07, 'square', 0.025], [520, 0.09, 'square', 0.02]],
    hit: [[170, 0.09, 'sawtooth', 0.04], [110, 0.12, 'sawtooth', 0.03]],
    lose: [[320, 0.12, 'sawtooth', 0.04], [240, 0.14, 'sawtooth', 0.04], [160, 0.2, 'sawtooth', 0.04]],
    win: [[523, 0.1, 'sine', 0.05], [659, 0.1, 'sine', 0.05], [784, 0.16, 'sine', 0.05]],
    pickup: [[740, 0.06, 'sine', 0.04], [990, 0.08, 'sine', 0.03]],
  };

  function sfx(name = 'click', options = {}) {
    if (!state.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const notes = options.notes || SOUNDS[name] || SOUNDS.click;
      let offset = 0;
      notes.forEach(([freq, duration, type, gain]) => {
        const osc = audioCtx.createOscillator();
        const vol = audioCtx.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + offset);
        if (options.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + options.slide), audioCtx.currentTime + offset + duration);
        vol.gain.setValueAtTime(0.0001, audioCtx.currentTime + offset);
        vol.gain.exponentialRampToValueAtTime(gain || 0.04, audioCtx.currentTime + offset + 0.012);
        vol.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + offset + duration);
        osc.connect(vol).connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + offset);
        osc.stop(audioCtx.currentTime + offset + duration + 0.02);
        offset += duration * 0.85;
      });
    } catch {
      /* audio is optional */
    }
  }

  // --- Public API handed to each game ------------------------------------
  const api = {
    slug,
    name,
    tagline,
    shell,
    stage,
    area,
    canvas,
    ctx,
    get W() {
      return canvas.width / dpr;
    },
    get H() {
      return canvas.height / dpr;
    },
    get paused() {
      return state.paused;
    },
    get over() {
      return state.over;
    },
    get started() {
      return state.started;
    },
    get soundOn() {
      return state.sound;
    },
    get best() {
      return state.best;
    },
    canPlay: () => state.started && !state.paused && !state.over,
    initCanvas,
    initDOM,
    addControls,
    pointerPos(event) {
      const rect = canvas.getBoundingClientRect();
      const vw = canvasSize.w || canvas.width / dpr;
      const vh = canvasSize.h || canvas.height / dpr;
      const scale = Math.min(rect.width / vw, rect.height / vh) || 1;
      const drawnW = vw * scale;
      const drawnH = vh * scale;
      const left = rect.left + (rect.width - drawnW) / 2;
      const top = rect.top + (rect.height - drawnH) / 2;
      return {
        x: (event.clientX - left) / scale,
        y: (event.clientY - top) / scale,
      };
    },
    setAspect(aspect) {
      stage.style.aspectRatio = aspect;
    },
    setStageMaxWidth(width) {
      stage.style.maxWidth = `${width}px`;
    },
    loop,
    every,
    setScore(value, label) {
      state.score = value;
      if (label && scoreLabel) scoreLabel.textContent = label;
      updateHud();
    },
    setScoreFormat(fn) {
      state.scoreFmt = fn;
      updateHud();
    },
    setBestFormat(fn) {
      state.bestFmt = fn;
      updateHud();
    },
    setBest(value, label) {
      state.best = value;
      if (label && bestLabel) bestLabel.textContent = label;
      updateHud();
    },
    setBestMode(mode) {
      state.bestMode = mode;
    },
    saveBest(value) {
      if (!Number.isFinite(value)) return;
      const current = state.best;
      const better =
        current == null || (state.bestMode === 'lower' ? value < current : value > current);
      if (better) {
        state.best = value;
        writeJSON(bestKey(slug), value);
        updateHud();
      }
    },
    setStatus,
    sfx,
    gameOver,
    win(options = {}) {
      gameOver({ ...options, tone: 'win', title: options.title || 'You win!' });
    },
    storageGet(key, fallback) {
      return readJSON(`ugg-${slug}-${key}`, fallback);
    },
    storageSet(key, value) {
      writeJSON(`ugg-${slug}-${key}`, value);
    },
    requestPause() {
      setPaused(true);
    },
    isTouch: window.matchMedia('(pointer: coarse)').matches,
  };

  // --- Wire chrome --------------------------------------------------------
  overlayBtn?.addEventListener('click', () => {
    if (state.over) restartGame();
    else if (state.paused) setPaused(false);
    else if (!state.started) startGame();
  });

  btnRestart?.addEventListener('click', () => {
    api.sfx('click');
    restartGame();
  });
  btnPause?.addEventListener('click', () => {
    api.sfx('click');
    setPaused(!state.paused);
  });
  btnSound?.addEventListener('click', toggleSound);
  btnFullscreen?.addEventListener('click', toggleFullscreen);

  if (btnPause) btnPause.disabled = true;
  if (btnSound) {
    btnSound.textContent = state.sound ? 'Sound on' : 'Sound off';
    btnSound.classList.toggle('is-muted', !state.sound);
    btnSound.setAttribute('aria-pressed', String(state.sound));
  }

  stage.addEventListener('pointerdown', () => {
    if (state.started && !state.paused && !state.over) stage.focus({ preventScroll: true });
  });

  window.addEventListener('keydown', (event) => {
    if (event.defaultPrevented) return;
    const tag = (event.target?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || event.target?.isContentEditable) return;
    const key = event.key;
    if (key === 'p' || key === 'P' || key === 'Escape') {
      if (state.started && !state.over) {
        event.preventDefault();
        setPaused(!state.paused);
      }
      return;
    }
    if (key === 'r' || key === 'R') {
      if (!event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        restartGame();
      }
      return;
    }
    if (key === 'f' || key === 'F') {
      event.preventDefault();
      toggleFullscreen();
      return;
    }
    if (key === 'm' || key === 'M') {
      toggleSound();
      return;
    }
    if (state.started && !state.paused && !state.over) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Spacebar'].includes(key) || event.code === 'Space') {
        event.preventDefault();
      }
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.started && !state.paused && !state.over) {
      setPaused(true, { silent: true });
      setOverlay({
        kicker: 'Paused',
        title: 'Paused',
        text: 'The game paused when you switched tabs.',
        button: 'Resume',
        hint: 'Press P or Esc to resume',
        tone: 'pause',
      });
    }
  });

  document.addEventListener('fullscreenchange', () => {
    if (btnFullscreen) btnFullscreen.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen';
  });

  window.addEventListener('beforeunload', () => {
    state.destroyed = true;
    game?.destroy?.();
  });

  // Build the game.
  try {
    game = createGame(api) || {};
  } catch (error) {
    console.error('Failed to start game:', error);
    setOverlay({
      kicker: 'Error',
      title: 'This game could not start',
      text: 'Please refresh the page or try a different game.',
      button: 'Refresh',
      tone: 'over',
    });
    overlayBtn?.addEventListener('click', () => location.reload());
    return;
  }

  updateHud();
  setStatus('Ready to play');
  setOverlay({
    kicker: tagline || 'Free browser game',
    title: name,
    text: 'Click play, then use the controls below. Your best score is saved on this device.',
    button: 'Play now',
    hint: `${controlsHint ? `${controlsHint} · ` : ''}P pause · R restart · F fullscreen · M sound`,
  });

  // Update the best label when a game uses a custom metric (time, moves…).
  api.setBestLabel = (label) => {
    if (bestLabel) bestLabel.textContent = label;
  };

  return { api, startGame, restartGame, setPaused, game };
}

if (/[?&]embed=1/.test(location.search)) {
  document.documentElement.classList.add('embed');
  let tries = 0;
  const timer = setInterval(() => {
    const overlay = document.getElementById('gameOverlay');
    const btn = document.getElementById('overlayBtn');
    if (overlay && btn && overlay.classList.contains('is-visible') && overlay.dataset.tone === 'start') btn.click();
    else if (overlay && !overlay.classList.contains('is-visible')) clearInterval(timer);
    if (++tries > 40) clearInterval(timer);
  }, 150);
}
