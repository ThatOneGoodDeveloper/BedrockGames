/**
 * Reversi / Othello — original implementation.
 * Legal-move flipping, pass handling, a weighted minimax CPU and local 2P.
 */

const W = 560;
const H = 640;
const CELL = 64;
const BOARD = CELL * 8;
const BX = (W - BOARD) / 2;
const BY = 92;
const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

export default function createGame(api) {
  const { ctx } = api.initCanvas(W, H);
  api.setBestMode('higher');
  api.setScore(0, 'Wins');

  let board = [];
  let turn = 1;
  let mode = '1p';
  let difficulty = 2;
  let wins1 = 0;
  let wins2 = 0;
  let draws = 0;
  let gameOver = false;
  let aiTimer = 0;
  let aiThinking = false;
  let legal = new Map();
  let lastMove = null;

  const tools = document.createElement('div');
  tools.className = 'board-tools';
  tools.style.cssText = 'position:absolute;top:8px;left:50%;transform:translateX(-50%);z-index:3;flex-wrap:wrap;max-width:96%';
  tools.innerHTML = `
    <button class="board-btn is-active" type="button" data-mode="1p">1 Player</button>
    <button class="board-btn" type="button" data-mode="2p">2 Players</button>
    <select class="ch-select" data-difficulty aria-label="Computer difficulty">
      <option value="1">Easy</option>
      <option value="2" selected>Medium</option>
      <option value="3">Hard</option>
    </select>
    <button class="board-btn" type="button" data-act="new">New round</button>`;
  api.area.appendChild(tools);

  const other = (p) => (p === 1 ? 2 : 1);

  function emptyBoard() {
    return Array.from({ length: 8 }, () => Array(8).fill(0));
  }

  function resetBoard() {
    board = emptyBoard();
    board[3][3] = 2;
    board[3][4] = 1;
    board[4][3] = 1;
    board[4][4] = 2;
    turn = 1;
    gameOver = false;
    aiThinking = false;
    aiTimer = 0;
    lastMove = null;
    legal = legalMoves(board, turn);
    api.setScore(wins1, 'Wins');
    api.setStatus(mode === '1p' ? 'You are black — choose a highlighted square' : 'Black starts');
  }

  function resetMatch() {
    wins1 = 0;
    wins2 = 0;
    draws = 0;
    resetBoard();
  }

  function flipsFor(b, r, c, player) {
    if (b[r][c]) return [];
    const flips = [];
    for (const [dr, dc] of DIRS) {
      let rr = r + dr;
      let cc = c + dc;
      const line = [];
      while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr][cc] === other(player)) {
        line.push([rr, cc]);
        rr += dr;
        cc += dc;
      }
      if (line.length && rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr][cc] === player) flips.push(...line);
    }
    return flips;
  }

  function legalMoves(b, player) {
    const moves = new Map();
    for (let r = 0; r < 8; r += 1) {
      for (let c = 0; c < 8; c += 1) {
        const flips = flipsFor(b, r, c, player);
        if (flips.length) moves.set(`${r},${c}`, flips);
      }
    }
    return moves;
  }

  function apply(b, r, c, player, flips) {
    const next = b.map((row) => row.slice());
    next[r][c] = player;
    flips.forEach(([rr, cc]) => { next[rr][cc] = player; });
    return next;
  }

  function discs(b, player) {
    let n = 0;
    for (const row of b) for (const v of row) if (v === player) n += 1;
    return n;
  }

  function positionWeight(r, c) {
    const corner = (r === 0 || r === 7) && (c === 0 || c === 7);
    if (corner) return 120;
    const edge = r === 0 || r === 7 || c === 0 || c === 7;
    if (edge) return 24;
    const nearCorner = (r === 1 || r === 6) && (c === 1 || c === 6);
    if (nearCorner) return -28;
    return 6;
  }

  function evaluate(b, aiPlayer) {
    let score = 0;
    for (let r = 0; r < 8; r += 1) {
      for (let c = 0; c < 8; c += 1) {
        if (!b[r][c]) continue;
        const value = positionWeight(r, c);
        score += b[r][c] === aiPlayer ? value : -value;
      }
    }
    score += (legalMoves(b, aiPlayer).size - legalMoves(b, other(aiPlayer)).size) * 8;
    score += (discs(b, aiPlayer) - discs(b, other(aiPlayer))) * 2;
    return score;
  }

  function search(b, player, depth, alpha, beta, aiPlayer) {
    const moves = legalMoves(b, player);
    if (!moves.size) {
      if (!legalMoves(b, other(player)).size) {
        const ai = discs(b, aiPlayer);
        const human = discs(b, other(aiPlayer));
        return (ai - human) * 1000;
      }
      return search(b, other(player), depth, alpha, beta, aiPlayer);
    }
    if (depth === 0) return evaluate(b, aiPlayer);
    const maximizing = player === aiPlayer;
    let best = maximizing ? -Infinity : Infinity;
    const entries = [...moves.entries()].sort((a, b2) => {
      const [ar, ac] = a[0].split(',').map(Number);
      const [br, bc] = b2[0].split(',').map(Number);
      return positionWeight(br, bc) - positionWeight(ar, ac);
    });
    for (const [key, flips] of entries) {
      const [r, c] = key.split(',').map(Number);
      const next = apply(b, r, c, player, flips);
      const value = search(next, other(player), depth - 1, alpha, beta, aiPlayer);
      if (maximizing) {
        best = Math.max(best, value);
        alpha = Math.max(alpha, value);
      } else {
        best = Math.min(best, value);
        beta = Math.min(beta, value);
      }
      if (alpha >= beta) break;
    }
    return best;
  }

  function chooseAI() {
    const moves = legalMoves(board, 2);
    if (!moves.size) return null;
    if (difficulty === 1 && Math.random() < 0.3) {
      const keys = [...moves.keys()];
      return keys[Math.floor(Math.random() * keys.length)];
    }
    const depth = difficulty === 1 ? 2 : difficulty === 2 ? 3 : 5;
    let bestKey = null;
    let bestScore = -Infinity;
    for (const [key, flips] of moves) {
      const [r, c] = key.split(',').map(Number);
      const next = apply(board, r, c, 2, flips);
      const score = search(next, 1, depth - 1, -Infinity, Infinity, 2);
      if (score > bestScore) {
        bestScore = score;
        bestKey = key;
      }
    }
    return bestKey;
  }

  function finish() {
    gameOver = true;
    const black = discs(board, 1);
    const white = discs(board, 2);
    if (black > white) wins1 += 1;
    else if (white > black) wins2 += 1;
    else draws += 1;
    api.setScore(wins1, 'Wins');
    api.saveBest(wins1);
    api.sfx('win');
    const message = `Final discs: black ${black} — white ${white}. Session: ${wins1} wins, ${wins2} losses, ${draws} draws.`;
    if (mode === '1p') {
      if (black > white) api.win({ score: wins1, title: 'You win!', message });
      else api.gameOver({ score: wins1, title: white > black ? 'The computer wins' : 'A draw', message });
    } else {
      api.gameOver({ score: wins1, title: black > white ? 'Black wins!' : white > black ? 'White wins!' : 'A draw', message });
    }
  }

  function advance() {
    turn = other(turn);
    legal = legalMoves(board, turn);
    if (!legal.size) {
      const nextLegal = legalMoves(board, other(turn));
      if (!nextLegal.size) {
        finish();
        return;
      }
      api.setStatus(`${turn === 1 ? 'Black' : 'White'} has no moves — passing`);
      turn = other(turn);
      legal = legalMoves(board, turn);
    }
    if (mode === '1p' && turn === 2) {
      aiThinking = true;
      aiTimer = 0.45;
      api.setStatus('Computer is thinking…');
    } else {
      api.setStatus(mode === '1p' ? 'Your move' : `${turn === 1 ? 'Black' : 'White'} to move`);
    }
  }

  function play(r, c) {
    if (!api.canPlay() || gameOver || aiThinking) return;
    if (mode === '1p' && turn !== 1) return;
    const flips = legal.get(`${r},${c}`);
    if (!flips) return;
    board = apply(board, r, c, turn, flips);
    lastMove = [r, c];
    api.sfx('score');
    advance();
  }

  function draw() {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#071016');
    bg.addColorStop(1, '#0e241d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const black = discs(board, 1);
    const white = discs(board, 2);
    ctx.textAlign = 'center';
    ctx.font = '900 18px system-ui, sans-serif';
    ctx.fillStyle = turn === 1 && !gameOver ? '#f8fafc' : '#94a3b8';
    ctx.fillText(`BLACK ${black}`, W * 0.24, 66);
    ctx.fillStyle = turn === 2 && !gameOver ? '#f8fafc' : '#94a3b8';
    ctx.fillText(`WHITE ${white}`, W * 0.76, 66);
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,0.65)';
    ctx.fillText(mode === '1p' ? 'You vs CPU' : 'Local 2 player', W / 2, 66);

    ctx.save();
    ctx.shadowColor = 'rgba(34, 211, 238, 0.28)';
    ctx.shadowBlur = 26;
    ctx.fillStyle = '#0b3b2a';
    ctx.fillRect(BX - 8, BY - 8, BOARD + 16, BOARD + 16);
    ctx.restore();

    for (let r = 0; r < 8; r += 1) {
      for (let c = 0; c < 8; c += 1) {
        const x = BX + c * CELL;
        const y = BY + r * CELL;
        ctx.fillStyle = '#0f6b45';
        ctx.fillRect(x, y, CELL, CELL);
        ctx.strokeStyle = 'rgba(2, 44, 28, 0.7)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
        if (lastMove && lastMove[0] === r && lastMove[1] === c) {
          ctx.fillStyle = 'rgba(163,230,53,0.18)';
          ctx.fillRect(x, y, CELL, CELL);
        }
      }
    }

    legal.forEach((_flips, key) => {
      const [r, c] = key.split(',').map(Number);
      const x = BX + c * CELL + CELL / 2;
      const y = BY + r * CELL + CELL / 2;
      ctx.fillStyle = turn === 1 ? 'rgba(15,23,42,0.55)' : 'rgba(248,250,252,0.55)';
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
    });

    for (let r = 0; r < 8; r += 1) {
      for (let c = 0; c < 8; c += 1) {
        const value = board[r][c];
        if (!value) continue;
        const cx = BX + c * CELL + CELL / 2;
        const cy = BY + r * CELL + CELL / 2;
        const dark = value === 1;
        ctx.save();
        ctx.shadowColor = dark ? '#020617' : '#e2e8f0';
        ctx.shadowBlur = 12;
        const grad = ctx.createRadialGradient(cx - 9, cy - 10, 3, cx, cy, 24);
        grad.addColorStop(0, dark ? '#475569' : '#ffffff');
        grad.addColorStop(0.5, dark ? '#0f172a' : '#dbe4ef');
        grad.addColorStop(1, dark ? '#000000' : '#94a3b8');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = dark ? 'rgba(148,163,184,0.35)' : 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.textAlign = 'center';
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,0.7)';
    ctx.fillText('Place a disc to flip a line · most discs wins · press R to restart', W / 2, H - 18);
  }

  api.loop((dt) => {
    if (dt > 0 && api.canPlay()) {
      if (aiThinking) {
        aiTimer -= dt;
        if (aiTimer <= 0) {
          aiThinking = false;
          const key = chooseAI();
          if (key) {
            const [r, c] = key.split(',').map(Number);
            const flips = legal.get(key);
            if (flips) {
              board = apply(board, r, c, 2, flips);
              lastMove = [r, c];
              api.sfx('score');
              advance();
            }
          } else {
            advance();
          }
        }
      }
    }
    draw();
  });

  api.stage.addEventListener('pointerdown', (event) => {
    if (!api.canPlay() || gameOver) return;
    const pos = api.pointerPos(event);
    const c = Math.floor((pos.x - BX) / CELL);
    const r = Math.floor((pos.y - BY) / CELL);
    if (r >= 0 && r < 8 && c >= 0 && c < 8) play(r, c);
  });

  tools.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.mode;
      tools.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('is-active', b === btn));
      resetBoard();
      api.sfx('click');
    });
  });
  const diff = tools.querySelector('[data-difficulty]');
  diff.addEventListener('change', () => {
    difficulty = Number(diff.value);
    api.setStatus(`Computer difficulty: ${diff.options[diff.selectedIndex].text}`);
  });
  tools.querySelector('[data-act="new"]').addEventListener('click', () => {
    resetBoard();
    api.sfx('click');
  });

  resetMatch();
  api.setBest(api.storageGet('best-wins', 0), 'Best');

  return {
    start() { resetMatch(); },
    restart() { resetBoard(); },
  };
}
