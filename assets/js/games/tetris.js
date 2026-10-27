/**
 * Tetris — original implementation.
 * Seven-bag queue, hold, ghost piece, wall kicks, levels and scoring.
 */

const COLS = 10;
const ROWS = 20;
const CELL = 28;
const BOARD_X = 12;
const BOARD_Y = 12;
const PANEL_X = BOARD_X + COLS * CELL + 14;
const W = PANEL_X + 108;
const H = BOARD_Y * 2 + ROWS * CELL;

const SHAPES = {
  I: { color: '#22d3ee', cells: [[1, 1, 1, 1]], size: 4 },
  J: { color: '#3b82f6', cells: [[1, 0, 0], [1, 1, 1]], size: 3 },
  L: { color: '#f97316', cells: [[0, 0, 1], [1, 1, 1]], size: 3 },
  O: { color: '#facc15', cells: [[1, 1], [1, 1]], size: 2 },
  S: { color: '#22c55e', cells: [[0, 1, 1], [1, 1, 0]], size: 3 },
  T: { color: '#a855f7', cells: [[0, 1, 0], [1, 1, 1]], size: 3 },
  Z: { color: '#f43f5e', cells: [[1, 1, 0], [0, 1, 1]], size: 3 },
};

export default function createGame(api) {
  const { ctx } = api.initCanvas(W, H);
  api.setBestMode('higher');

  let board;
  let bag;
  let queue;
  let current;
  let holdType;
  let canHold;
  let score;
  let lines;
  let level;
  let dropTimer;
  let dropInterval;
  let dead;
  let clearing;
  let clearTimer;

  const emptyBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill(null));

  function refillBag() {
    const types = Object.keys(SHAPES);
    for (let i = types.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [types[i], types[j]] = [types[j], types[i]];
    }
    bag.push(...types);
  }

  function nextType() {
    if (!bag.length) refillBag();
    return bag.shift();
  }

  function makePiece(type) {
    const shape = SHAPES[type];
    return {
      type,
      matrix: shape.cells.map((row) => [...row]),
      x: Math.floor((COLS - shape.cells[0].length) / 2),
      y: 0,
    };
  }

  function spawn(type = nextType()) {
    current = makePiece(type);
    canHold = true;
    if (collides(current.matrix, current.x, current.y)) {
      dead = true;
      api.sfx('lose');
      api.gameOver({
        score,
        title: 'The stack reached the top',
        message: `${lines} lines cleared at level ${level}. Score ${score.toLocaleString()}.`,
      });
    }
  }

  function reset() {
    board = emptyBoard();
    bag = [];
    queue = [];
    holdType = null;
    canHold = true;
    score = 0;
    lines = 0;
    level = 1;
    dropTimer = 0;
    dropInterval = 0.82;
    dead = false;
    clearing = [];
    clearTimer = 0;
    while (queue.length < 3) queue.push(nextType());
    spawn();
    api.setScore(0, 'Score');
    api.setStatus('← → move · ↑ rotate · Space hard drop · C hold');
  }

  function collides(matrix, px, py) {
    for (let r = 0; r < matrix.length; r += 1) {
      for (let c = 0; c < matrix[r].length; c += 1) {
        if (!matrix[r][c]) continue;
        const x = px + c;
        const y = py + r;
        if (x < 0 || x >= COLS || y >= ROWS) return true;
        if (y >= 0 && board[y][x]) return true;
      }
    }
    return false;
  }

  function rotate(matrix, dir = 1) {
    const rows = matrix.length;
    const cols = matrix[0].length;
    const result = Array.from({ length: cols }, () => Array(rows).fill(0));
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (dir > 0) result[c][rows - 1 - r] = matrix[r][c];
        else result[cols - 1 - c][r] = matrix[r][c];
      }
    }
    return result;
  }

  function tryRotate(dir = 1) {
    if (!api.canPlay() || dead) return;
    const rotated = rotate(current.matrix, dir);
    const kicks = [
      [0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1], [-1, -1], [1, -1],
    ];
    for (const [dx, dy] of kicks) {
      if (!collides(rotated, current.x + dx, current.y + dy)) {
        current.matrix = rotated;
        current.x += dx;
        current.y += dy;
        api.sfx('click');
        return;
      }
    }
  }

  function move(dx) {
    if (!api.canPlay() || dead) return;
    if (!collides(current.matrix, current.x + dx, current.y)) {
      current.x += dx;
    }
  }

  function softDrop() {
    if (!api.canPlay() || dead) return;
    if (!collides(current.matrix, current.x, current.y + 1)) {
      current.y += 1;
      score += 1;
      api.setScore(score, 'Score');
      dropTimer = 0;
    } else {
      lock();
    }
  }

  function hardDrop() {
    if (!api.canPlay() || dead) return;
    let distance = 0;
    while (!collides(current.matrix, current.x, current.y + 1)) {
      current.y += 1;
      distance += 1;
    }
    score += distance * 2;
    api.setScore(score, 'Score');
    api.sfx('hit');
    lock();
  }

  function hold() {
    if (!api.canPlay() || dead || !canHold) return;
    const outgoing = current.type;
    if (holdType) {
      const incoming = holdType;
      holdType = outgoing;
      spawn(incoming);
    } else {
      holdType = outgoing;
      spawn();
    }
    canHold = false;
    api.sfx('click');
  }

  function lock() {
    current.matrix.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell && current.y + r >= 0) {
          board[current.y + r][current.x + c] = current.type;
        }
      });
    });
    const full = [];
    board.forEach((row, r) => {
      if (row.every(Boolean)) full.push(r);
    });
    if (full.length) {
      clearing = full;
      clearTimer = 0;
      const table = { 1: 100, 2: 300, 3: 500, 4: 800 };
      score += (table[full.length] || 0) * level;
      lines += full.length;
      level = Math.floor(lines / 10) + 1;
      dropInterval = Math.max(0.08, 0.82 - (level - 1) * 0.07);
      api.setScore(score, 'Score');
      api.sfx(full.length === 4 ? 'win' : 'score');
      return;
    }
    spawn();
    current.y = 0;
  }

  function applyClear() {
    clearing.sort((a, b) => a - b).forEach((r) => {
      board.splice(r, 1);
      board.unshift(Array(COLS).fill(null));
    });
    clearing = [];
    spawn();
  }

  function ghostY() {
    let y = current.y;
    while (!collides(current.matrix, current.x, y + 1)) y += 1;
    return y;
  }

  function drawBlock(x, y, size, color, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const grad = ctx.createLinearGradient(x, y, x + size, y + size);
    grad.addColorStop(0, color);
    grad.addColorStop(1, shade(color, -28));
    ctx.fillStyle = grad;
    ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x + 3, y + 3, size - 6, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x + 3, y + size - 7, size - 6, 4);
    ctx.restore();
  }

  function shade(hex, amount) {
    const num = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, (num >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount));
    const b = Math.max(0, Math.min(255, (num & 0xff) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }

  function drawPanelPiece(type, x, y, cell = 18) {
    const shape = SHAPES[type];
    const matrix = shape.cells;
    const offsetX = x + (4 - matrix[0].length) * cell / 2;
    matrix.forEach((row, r) => {
      row.forEach((value, c) => {
        if (value) drawBlock(offsetX + c * cell, y + r * cell, cell, shape.color);
      });
    });
  }

  function draw() {
    ctx.fillStyle = '#080d18';
    ctx.fillRect(0, 0, W, H);

    // board backdrop
    ctx.fillStyle = '#0d1526';
    ctx.fillRect(BOARD_X - 2, BOARD_Y - 2, COLS * CELL + 4, ROWS * CELL + 4);
    ctx.strokeStyle = 'rgba(148,163,184,0.18)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c += 1) {
      ctx.beginPath();
      ctx.moveTo(BOARD_X + c * CELL, BOARD_Y);
      ctx.lineTo(BOARD_X + c * CELL, BOARD_Y + ROWS * CELL);
      ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r += 1) {
      ctx.beginPath();
      ctx.moveTo(BOARD_X, BOARD_Y + r * CELL);
      ctx.lineTo(BOARD_X + COLS * CELL, BOARD_Y + r * CELL);
      ctx.stroke();
    }

    board.forEach((row, r) => {
      row.forEach((type, c) => {
        if (!type) return;
        if (clearing.includes(r)) return;
        drawBlock(BOARD_X + c * CELL, BOARD_Y + r * CELL, CELL, SHAPES[type].color, 0.95);
      });
    });

    if (!dead && current) {
      // ghost
      const gy = ghostY();
      current.matrix.forEach((row, r) => {
        row.forEach((value, c) => {
          if (!value) return;
          ctx.strokeStyle = 'rgba(226,232,240,0.24)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(
            BOARD_X + (current.x + c) * CELL + 2,
            BOARD_Y + (gy + r) * CELL + 2,
            CELL - 4,
            CELL - 4
          );
        });
      });
      // active
      current.matrix.forEach((row, r) => {
        row.forEach((value, c) => {
          if (!value) return;
          drawBlock(
            BOARD_X + (current.x + c) * CELL,
            BOARD_Y + (current.y + r) * CELL,
            CELL,
            SHAPES[current.type].color
          );
        });
      });
    }

    // clearing flash
    if (clearing.length) {
      ctx.fillStyle = `rgba(255,255,255,${0.2 + Math.abs(Math.sin(clearTimer * 20)) * 0.4})`;
      clearing.forEach((r) => {
        ctx.fillRect(BOARD_X, BOARD_Y + r * CELL, COLS * CELL, CELL);
      });
    }

    // panel
    ctx.fillStyle = '#0b1424';
    ctx.fillRect(PANEL_X - 4, BOARD_Y, 108, ROWS * CELL);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('HOLD', PANEL_X + 8, BOARD_Y + 18);
    ctx.fillStyle = '#0f1a2e';
    ctx.fillRect(PANEL_X + 6, BOARD_Y + 24, 88, 66);
    if (holdType) drawPanelPiece(holdType, PANEL_X + 6, BOARD_Y + 40, 16);

    ctx.fillStyle = '#94a3b8';
    ctx.fillText('NEXT', PANEL_X + 8, BOARD_Y + 116);
    queue.slice(0, 3).forEach((type, index) => {
      ctx.fillStyle = '#0f1a2e';
      ctx.fillRect(PANEL_X + 6, BOARD_Y + 122 + index * 62, 88, 56);
      drawPanelPiece(type, PANEL_X + 6, BOARD_Y + 136 + index * 62, 15);
    });

    const statY = BOARD_Y + 330;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillText('SCORE', PANEL_X + 8, statY);
    ctx.fillStyle = '#f4f7fb';
    ctx.font = '800 20px system-ui, sans-serif';
    ctx.fillText(score.toLocaleString(), PANEL_X + 8, statY + 24);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillText('LEVEL', PANEL_X + 8, statY + 56);
    ctx.fillStyle = '#f4f7fb';
    ctx.font = '800 20px system-ui, sans-serif';
    ctx.fillText(String(level), PANEL_X + 8, statY + 80);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillText('LINES', PANEL_X + 8, statY + 112);
    ctx.fillStyle = '#f4f7fb';
    ctx.font = '800 20px system-ui, sans-serif';
    ctx.fillText(String(lines), PANEL_X + 8, statY + 136);

    if (dead) {
      ctx.fillStyle = 'rgba(4,7,14,0.55)';
      ctx.fillRect(BOARD_X, BOARD_Y, COLS * CELL, ROWS * CELL);
    }
  }

  api.loop((dt) => {
    if (dt > 0 && api.canPlay()) {
      if (clearing.length) {
        clearTimer += dt;
        if (clearTimer > 0.18) {
          clearTimer = 0;
          applyClear();
        }
      } else {
        dropTimer += dt;
        if (dropTimer >= dropInterval) {
          dropTimer = 0;
          if (!collides(current.matrix, current.x, current.y + 1)) {
            current.y += 1;
          } else {
            lock();
          }
        }
      }
    }
    draw();
  });

  function onKey(event) {
    if (!api.canPlay() || dead) return;
    const tag = (event.target?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    if (event.code === 'Space') { event.preventDefault(); hardDrop(); return; }
    switch (event.key) {
      case 'ArrowLeft': case 'a': case 'A': event.preventDefault(); move(-1); break;
      case 'ArrowRight': case 'd': case 'D': event.preventDefault(); move(1); break;
      case 'ArrowDown': case 's': case 'S': event.preventDefault(); softDrop(); break;
      case 'ArrowUp': case 'x': case 'X': event.preventDefault(); tryRotate(1); break;
      case 'z': case 'Z': event.preventDefault(); tryRotate(-1); break;
      case ' ': case 'Spacebar': event.preventDefault(); hardDrop(); break;
      case 'c': case 'C': case 'Shift': event.preventDefault(); hold(); break;
      default: break;
    }
  }
  window.addEventListener('keydown', onKey);

  if (api.isTouch) {
    const pad = document.createElement('div');
    pad.className = 'touch-row';
    pad.innerHTML = `
      <button class="touch-btn" type="button" aria-label="Move left">◀</button>
      <button class="touch-btn" type="button" aria-label="Rotate">⟳</button>
      <button class="touch-btn" type="button" aria-label="Move right">▶</button>
      <button class="touch-btn wide" type="button" aria-label="Hard drop">⤓</button>`;
    const [left, rotate, right, drop] = pad.querySelectorAll('button');
    const bind = (btn, fn) => {
      btn.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        fn();
      });
    };
    bind(left, () => move(-1));
    bind(right, () => move(1));
    bind(rotate, () => tryRotate(1));
    bind(drop, hardDrop);
    api.addControls(pad);
  }

  reset();
  return {
    start() { reset(); },
    restart() { reset(); },
  };
}
