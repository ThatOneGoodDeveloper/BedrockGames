/**
 * 2048 — original implementation.
 * DOM tiles with CSS transitions, undo, saved board and swipe controls.
 */

const SIZE = 4;
const COLORS = {
  2: ['#eee4da', '#3b3a36'],
  4: ['#ede0c8', '#3b3a36'],
  8: ['#f2b179', '#ffffff'],
  16: ['#f59563', '#ffffff'],
  32: ['#f67c5f', '#ffffff'],
  64: ['#f65e3b', '#ffffff'],
  128: ['#edcf72', '#ffffff'],
  256: ['#edcc61', '#ffffff'],
  512: ['#edc850', '#ffffff'],
  1024: ['#edc53f', '#ffffff'],
  2048: ['#edc22e', '#ffffff'],
};

export default function createGame(api) {
  const wrap = document.createElement('div');
  wrap.className = 'g2048-wrap';
  wrap.innerHTML = `
    <div class="g2048-tools">
      <button class="board-btn" type="button" data-act="undo">↶ Undo</button>
      <button class="board-btn" type="button" data-act="new">New game</button>
    </div>
    <div class="g2048-board" aria-label="2048 board" role="group">
      <div class="g2048-cells">${'<span></span>'.repeat(16)}</div>
    </div>
    <p class="g2048-hint">Arrow keys / WASD to move · swipe on touch · Z to undo</p>`;
  api.area.appendChild(wrap);

  api.initDOM({ aspect: '1 / 1', maxWidth: 560 });
  api.setBestMode('higher');

  const boardEl = wrap.querySelector('.g2048-board');
  let tiles = [];
  let nextId = 1;
  let score = 0;
  let animating = false;
  let over = false;
  let won = false;
  let queue = [];
  let undoStack = [];

  function emptyCells() {
    const taken = new Set(tiles.filter((t) => !t.removed).map((t) => `${t.row},${t.col}`));
    const cells = [];
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        if (!taken.has(`${r},${c}`)) cells.push({ r, c });
      }
    }
    return cells;
  }

  function snapshot() {
    return {
      score,
      won,
      tiles: tiles.filter((t) => !t.removed).map((t) => ({ value: t.value, row: t.row, col: t.col })),
    };
  }

  function makeTile(value, row, col, { isNew = false, isMerged = false } = {}) {
    const el = document.createElement('div');
    el.className = 'g2048-tile';
    el.textContent = value;
    const tile = { id: nextId++, value, row, col, el, removed: false, mergedThisTurn: false };
    el.style.setProperty('--row', row);
    el.style.setProperty('--col', col);
    if (isNew) el.classList.add('is-new');
    if (isMerged) el.classList.add('is-merged');
    paintTile(tile);
    boardEl.appendChild(el);
    tiles.push(tile);
    return tile;
  }

  function paintTile(tile) {
    const [bg, fg] = COLORS[tile.value] || ['#3c3a32', '#ffffff'];
    tile.el.style.background = bg;
    tile.el.style.color = fg;
    const digits = String(tile.value).length;
    tile.el.style.fontSize = digits >= 4 ? 'clamp(0.85rem, 3vw, 1.35rem)' : '';
    if (tile.value >= 128) tile.el.style.boxShadow = '0 0 18px rgba(237, 200, 80, 0.35)';
  }

  function positionTile(tile) {
    tile.el.style.setProperty('--row', tile.row);
    tile.el.style.setProperty('--col', tile.col);
  }

  function rebuildFromSnapshot(data) {
    tiles.forEach((t) => t.el.remove());
    tiles = [];
    nextId = 1;
    score = data.score || 0;
    won = Boolean(data.won);
    over = false;
    data.tiles.forEach((t) => {
      const tile = makeTile(t.value, t.row, t.col);
      if (t.value >= 2048) won = true;
      tile.mergedThisTurn = false;
    });
    api.setScore(score, 'Score');
  }

  function spawnTile() {
    const cells = emptyCells();
    if (!cells.length) return null;
    const cell = cells[Math.floor(Math.random() * cells.length)];
    return makeTile(Math.random() < 0.9 ? 2 : 4, cell.r, cell.c, { isNew: true });
  }

  function newGame() {
    tiles.forEach((t) => t.el.remove());
    tiles = [];
    nextId = 1;
    score = 0;
    over = false;
    won = false;
    animating = false;
    queue = [];
    undoStack = [];
    api.setScore(0, 'Score');
    spawnTile();
    spawnTile();
    persist();
  }

  function persist() {
    if (over) {
      api.storageSet('state', null);
      return;
    }
    api.storageSet('state', snapshot());
  }

  function canMove() {
    const active = tiles.filter((t) => !t.removed);
    if (active.length < SIZE * SIZE) return true;
    const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    active.forEach((t) => { grid[t.row][t.col] = t.value; });
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        if (c < SIZE - 1 && grid[r][c] === grid[r][c + 1]) return true;
        if (r < SIZE - 1 && grid[r][c] === grid[r + 1][c]) return true;
      }
    }
    return false;
  }

  function move(dir) {
    if (!api.canPlay() || animating || over) {
      if (animating) queue.push(dir);
      return;
    }
    const before = snapshot();
    const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    tiles.filter((t) => !t.removed).forEach((t) => { grid[t.row][t.col] = t; });

    const horizontal = dir === 'left' || dir === 'right';
    const reverse = dir === 'right' || dir === 'down';
    let moved = false;
    let gained = 0;

    for (let line = 0; line < SIZE; line += 1) {
      const sequence = [];
      for (let i = 0; i < SIZE; i += 1) {
        const index = reverse ? SIZE - 1 - i : i;
        const tile = horizontal ? grid[line][index] : grid[index][line];
        if (tile) sequence.push(tile);
      }
      // Clear this line.
      for (let i = 0; i < SIZE; i += 1) {
        if (horizontal) grid[line][i] = null;
        else grid[i][line] = null;
      }
      let target = 0;
      let last = null;
      for (const tile of sequence) {
        if (last && last.value === tile.value && !last.mergedThisTurn) {
          last.value *= 2;
          last.mergedThisTurn = true;
          last.justMerged = true;
          gained += last.value;
          tile.removed = true;
          tile.row = last.row;
          tile.col = last.col;
          moved = true;
          if (last.value === 2048) won = true;
        } else {
          const index = reverse ? SIZE - 1 - target : target;
          const row = horizontal ? line : index;
          const col = horizontal ? index : line;
          if (tile.row !== row || tile.col !== col) moved = true;
          tile.row = row;
          tile.col = col;
          grid[row][col] = tile;
          last = tile;
          target += 1;
        }
      }
    }

    if (!moved) return;

    undoStack.push(before);
    if (undoStack.length > 20) undoStack.shift();
    score += gained;
    api.setScore(score, 'Score');
    api.saveBest(score);
    animating = true;
    tiles.filter((t) => !t.removed).forEach(positionTile);
    tiles.filter((t) => t.removed).forEach(positionTile);

    window.setTimeout(() => {
      tiles.filter((t) => t.removed).forEach((t) => t.el.remove());
      tiles = tiles.filter((t) => !t.removed);
      tiles.forEach((t) => {
        t.el.textContent = t.value;
        paintTile(t);
        if (t.justMerged) {
          t.el.classList.remove('is-merged');
          // force restart of the animation
          void t.el.offsetWidth;
          t.el.classList.add('is-merged');
          t.justMerged = false;
        }
        t.mergedThisTurn = false;
      });
      spawnTile();
      animating = false;
      api.sfx(gained > 0 ? 'score' : 'click');
      persist();
      if (won && !over) {
        over = true;
        api.win({
          score,
          title: 'You made 2048!',
          message: `Final score: ${score.toLocaleString()}. Keep going for 4096 on the next run.`,
        });
        return;
      }
      if (!canMove()) {
        over = true;
        api.gameOver({
          score,
          title: 'No moves left',
          message: `You scored ${score.toLocaleString()} points. The board is full — try a new run.`,
        });
      }
      if (queue.length) {
        const next = queue.shift();
        move(next);
      }
    }, 125);
  }

  function undo() {
    if (animating || !undoStack.length || !api.canPlay()) return;
    const previous = undoStack.pop();
    tiles.forEach((t) => t.el.remove());
    tiles = [];
    nextId = 1;
    score = previous.score;
    won = previous.won;
    over = false;
    previous.tiles.forEach((t) => makeTile(t.value, t.row, t.col));
    api.setScore(score, 'Score');
    api.sfx('click');
    persist();
  }

  function loadOrNew() {
    const saved = api.storageGet('state', null);
    if (saved && Array.isArray(saved.tiles) && saved.tiles.length) {
      rebuildFromSnapshot(saved);
      if (!canMove()) newGame();
    } else {
      newGame();
    }
  }

  wrap.querySelector('[data-act="undo"]').addEventListener('click', undo);
  wrap.querySelector('[data-act="new"]').addEventListener('click', () => {
    api.sfx('click');
    newGame();
  });

  window.addEventListener('keydown', (event) => {
    if (!api.canPlay()) return;
    const tag = (event.target?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    const map = {
      ArrowLeft: 'left', a: 'left', A: 'left',
      ArrowRight: 'right', d: 'right', D: 'right',
      ArrowUp: 'up', w: 'up', W: 'up',
      ArrowDown: 'down', s: 'down', S: 'down',
    };
    if (map[event.key]) {
      event.preventDefault();
      move(map[event.key]);
    } else if (event.key === 'z' || event.key === 'Z' || event.key === 'u' || event.key === 'U') {
      event.preventDefault();
      undo();
    }
  });

  // Swipe / drag
  let start = null;
  boardEl.addEventListener('pointerdown', (event) => {
    start = { x: event.clientX, y: event.clientY };
    boardEl.setPointerCapture?.(event.pointerId);
  });
  boardEl.addEventListener('pointerup', (event) => {
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
    else move(dy > 0 ? 'down' : 'up');
  });
  boardEl.addEventListener('pointercancel', () => { start = null; });

  loadOrNew();
  api.setStatus('Arrow keys or swipe to play');

  return {
    start() {
      loadOrNew();
      boardEl.focus?.();
    },
    restart() {
      newGame();
    },
    destroy() {
      /* listeners live with the page */
    },
  };
}
