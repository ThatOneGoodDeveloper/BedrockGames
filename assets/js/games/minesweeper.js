/**
 * Minesweeper — original implementation.
 * First-click safety, flood fill, flags, chording, three difficulties.
 */

const LEVELS = {
  beginner: { cols: 9, rows: 9, mines: 10, label: 'Beginner' },
  intermediate: { cols: 16, rows: 16, mines: 40, label: 'Intermediate' },
  expert: { cols: 30, rows: 16, mines: 99, label: 'Expert' },
};

const FLAG_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v18" stroke="#f8fafc" stroke-width="2.4" stroke-linecap="round"/><path d="M7 4h10.5l-2.3 4.2 2.3 4.3H7z" fill="#f43f5e"/></svg>';
const MINE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><g stroke="#f87171" stroke-width="2" stroke-linecap="round"><path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M19.1 4.9l-2.8 2.8M7.7 16.3l-2.8 2.8"/></g><circle cx="12" cy="12" r="5.2" fill="#111827" stroke="#f87171" stroke-width="1.5"/><circle cx="10.2" cy="10.2" r="1.4" fill="#fca5a5"/></svg>';
const CROSS_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="#f87171" stroke-width="2.6" stroke-linecap="round"/></svg>';

const formatTime = (seconds) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export default function createGame(api) {
  const wrap = document.createElement('div');
  wrap.className = 'ms-wrap';
  wrap.innerHTML = `
    <div class="board-tools">
      <button class="board-btn is-active" type="button" data-level="beginner">Beginner</button>
      <button class="board-btn" type="button" data-level="intermediate">Intermediate</button>
      <button class="board-btn" type="button" data-level="expert">Expert</button>
      <button class="board-btn" type="button" data-act="new">New board</button>
    </div>
    <div class="board-readout">
      <span>Mines <strong data-readout="mines">0</strong></span>
      <span>Flags <strong data-readout="flags">0</strong></span>
      <span>Time <strong data-readout="time">00:00</strong></span>
    </div>
    <div class="ms-board" role="grid" aria-label="Minesweeper board"></div>
    <p class="g2048-hint">Left click reveal · right click / long-press flag · double click chord</p>`;
  api.area.appendChild(wrap);
  api.initDOM({ aspect: '16 / 10', maxWidth: 940 });
  api.setBestMode('lower');
  api.setScoreFormat(formatTime);
  api.setBestFormat(formatTime);

  const boardEl = wrap.querySelector('.ms-board');
  const minesOut = wrap.querySelector('[data-readout="mines"]');
  const flagsOut = wrap.querySelector('[data-readout="flags"]');
  const timeOut = wrap.querySelector('[data-readout="time"]');

  let level = 'beginner';
  let cfg = LEVELS[level];
  let cells = [];
  let started = false;
  let dead = false;
  let won = false;
  let elapsed = 0;
  let timerStop = null;
  let flagCount = 0;
  let buttons = [];

  function bestFor(key) {
    const value = api.storageGet(`best-${key}`, null);
    return Number.isFinite(value) ? value : null;
  }

  function updateBestDisplay() {
    const best = bestFor(level);
    api.setBest(best, 'Best');
  }

  function newBoard(nextLevel = level) {
    level = nextLevel;
    cfg = LEVELS[level];
    started = false;
    dead = false;
    won = false;
    elapsed = 0;
    flagCount = 0;
    cells = [];
    buttons = [];
    if (timerStop) { timerStop(); timerStop = null; }
    api.setScore(0, 'Time');
    updateBestDisplay();
    api.stage.style.maxWidth = level === 'expert' ? '960px' : level === 'intermediate' ? '720px' : '460px';
    wrap.querySelectorAll('[data-level]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.level === level);
    });
    boardEl.style.gridTemplateColumns = `repeat(${cfg.cols}, 1fr)`;
    boardEl.style.width = `min(100%, ${Math.min(cfg.cols * 34, 900)}px)`;
    boardEl.innerHTML = '';
    for (let i = 0; i < cfg.cols * cfg.rows; i += 1) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ms-cell';
      btn.dataset.index = String(i);
      btn.setAttribute('role', 'gridcell');
      btn.setAttribute('aria-label', 'Hidden cell');
      boardEl.appendChild(btn);
      buttons.push(btn);
      cells.push({ mine: false, revealed: false, flagged: false, count: 0 });
    }
    minesOut.textContent = String(cfg.mines);
    flagsOut.textContent = '0';
    timeOut.textContent = '00:00';
    api.setStatus('Click any cell to start — the first click is always safe');
  }

  function neighbours(index) {
    const col = index % cfg.cols;
    const row = Math.floor(index / cfg.cols);
    const out = [];
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (!dr && !dc) continue;
        const c = col + dc;
        const r = row + dr;
        if (c >= 0 && c < cfg.cols && r >= 0 && r < cfg.rows) out.push(r * cfg.cols + c);
      }
    }
    return out;
  }

  function placeMines(safeIndex) {
    const safe = new Set([safeIndex, ...neighbours(safeIndex)]);
    const candidates = [];
    for (let i = 0; i < cells.length; i += 1) {
      if (!safe.has(i)) candidates.push(i);
    }
    for (let i = candidates.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    candidates.slice(0, cfg.mines).forEach((index) => { cells[index].mine = true; });
    cells.forEach((cell, index) => {
      if (cell.mine) return;
      cell.count = neighbours(index).filter((n) => cells[n].mine).length;
    });
  }

  function paint(index) {
    const cell = cells[index];
    const btn = buttons[index];
    btn.className = 'ms-cell';
    btn.textContent = '';
    if (cell.revealed) {
      btn.classList.add('is-open');
      if (cell.mine) {
        btn.classList.add('is-mine');
        btn.innerHTML = MINE_SVG;
      } else if (cell.count > 0) {
        btn.classList.add(`n${cell.count}`);
        btn.textContent = String(cell.count);
      }
      btn.setAttribute('aria-label', cell.mine ? 'Mine' : `${cell.count} adjacent mines`);
    } else if (cell.flagged) {
      btn.classList.add('is-flag');
      btn.innerHTML = FLAG_SVG;
      btn.setAttribute('aria-label', 'Flagged as mine');
    } else {
      btn.setAttribute('aria-label', 'Hidden cell');
    }
  }

  function startTimer() {
    if (timerStop) return;
    timerStop = api.every(1000, () => {
      elapsed += 1;
      timeOut.textContent = formatTime(elapsed);
      api.setScore(elapsed, 'Time');
    });
  }

  function checkWin() {
    const safeCells = cells.length - cfg.mines;
    const revealed = cells.filter((c) => c.revealed).length;
    if (revealed !== safeCells || won) return;
    won = true;
    if (timerStop) { timerStop(); timerStop = null; }
    api.setBestMode('lower');
    api.saveBest(elapsed);
    api.win({
      score: elapsed,
      title: 'Minefield cleared!',
      message: `You cleared ${cfg.label.toLowerCase()} in ${formatTime(elapsed)}. Best time saved.`,
    });
  }

  function lose(index) {
    dead = true;
    if (timerStop) { timerStop(); timerStop = null; }
    cells.forEach((cell, i) => {
      if (cell.mine) {
        cell.revealed = true;
        paint(i);
      } else if (cell.flagged) {
        buttons[i].classList.add('is-wrong');
        buttons[i].innerHTML = CROSS_SVG;
      }
    });
    buttons[index].classList.add('is-mine');
    api.sfx('lose');
    api.gameOver({
      score: elapsed,
      title: 'Boom!',
      message: `A mine ended the run after ${formatTime(elapsed)}. Flag the numbers you have already solved.`,
    });
  }

  function reveal(index) {
    const cell = cells[index];
    if (dead || won || cell.flagged || cell.revealed) return;
    if (!started) {
      started = true;
      placeMines(index);
      startTimer();
      api.setStatus('Use the numbers to deduce where the mines are');
    }
    if (cell.mine) {
      cell.revealed = true;
      paint(index);
      lose(index);
      return;
    }
    // Iterative flood fill.
    const stack = [index];
    while (stack.length) {
      const current = stack.pop();
      const c = cells[current];
      if (c.revealed || c.flagged) continue;
      c.revealed = true;
      paint(current);
      if (c.count === 0) neighbours(current).forEach((n) => {
        if (!cells[n].revealed && !cells[n].flagged) stack.push(n);
      });
    }
    api.sfx('click');
    checkWin();
  }

  function toggleFlag(index) {
    if (dead || won || cells[index].revealed) return;
    const cell = cells[index];
    cell.flagged = !cell.flagged;
    flagCount += cell.flagged ? 1 : -1;
    flagsOut.textContent = String(flagCount);
    api.sfx('click');
    paint(index);
  }

  function chord(index) {
    const cell = cells[index];
    if (!cell.revealed || !cell.count || dead || won) return;
    const around = neighbours(index);
    const flags = around.filter((n) => cells[n].flagged).length;
    if (flags !== cell.count) return;
    around.forEach((n) => {
      if (!cells[n].flagged && !cells[n].revealed) reveal(n);
    });
  }

  boardEl.addEventListener('click', (event) => {
    const btn = event.target.closest('.ms-cell');
    if (!btn) return;
    reveal(Number(btn.dataset.index));
  });
  boardEl.addEventListener('contextmenu', (event) => {
    const btn = event.target.closest('.ms-cell');
    if (!btn) return;
    event.preventDefault();
    toggleFlag(Number(btn.dataset.index));
  });
  boardEl.addEventListener('dblclick', (event) => {
    const btn = event.target.closest('.ms-cell');
    if (!btn) return;
    event.preventDefault();
    chord(Number(btn.dataset.index));
  });

  // Long press to flag on touch devices.
  let pressTimer = null;
  let longPressed = false;
  boardEl.addEventListener('pointerdown', (event) => {
    const btn = event.target.closest('.ms-cell');
    if (!btn || event.pointerType === 'mouse') return;
    longPressed = false;
    pressTimer = window.setTimeout(() => {
      longPressed = true;
      toggleFlag(Number(btn.dataset.index));
      if (navigator.vibrate) navigator.vibrate(20);
    }, 380);
  });
  const cancelPress = () => {
    if (pressTimer) window.clearTimeout(pressTimer);
    pressTimer = null;
  };
  boardEl.addEventListener('pointerup', (event) => {
    cancelPress();
    if (longPressed) {
      event.preventDefault();
      event.stopPropagation();
      longPressed = false;
    }
  });
  boardEl.addEventListener('pointerleave', cancelPress);
  boardEl.addEventListener('pointercancel', cancelPress);

  wrap.querySelectorAll('[data-level]').forEach((btn) => {
    btn.addEventListener('click', () => {
      api.sfx('click');
      newBoard(btn.dataset.level);
    });
  });
  wrap.querySelector('[data-act="new"]').addEventListener('click', () => {
    api.sfx('click');
    newBoard();
  });

  newBoard('beginner');

  return {
    start() { newBoard(); },
    restart() { newBoard(); },
  };
}
