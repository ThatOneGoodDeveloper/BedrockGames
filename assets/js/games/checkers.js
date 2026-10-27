/**
 * Checkers — original implementation.
 * 8x8 draughts with mandatory captures, kings, a minimax CPU and local 2P.
 */

const W = 560;
const H = 640;
const CELL = 64;
const BOARD = CELL * 8;
const BX = (W - BOARD) / 2;
const BY = 92;

export default function createGame(api) {
  const { ctx } = api.initCanvas(W, H);
  api.setBestMode('higher');
  api.setScore(0, 'Wins');

  let board = [];
  let turn = 1;
  let selected = null;
  let legal = [];
  let mode = '1p';
  let difficulty = 2;
  let wins1 = 0;
  let wins2 = 0;
  let gameOver = false;
  let aiTimer = 0;
  let aiThinking = false;
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

  const playerOf = (v) => (v <= 2 ? v : v - 2);
  const isKing = (v) => v > 2;
  const opponent = (p) => (p === 1 ? 2 : 1);

  function newBoard() {
    const b = Array.from({ length: 8 }, () => Array(8).fill(0));
    for (let r = 0; r < 8; r += 1) {
      for (let c = 0; c < 8; c += 1) {
        if ((r + c) % 2 === 1) {
          if (r < 3) b[r][c] = 2;
          else if (r > 4) b[r][c] = 1;
        }
      }
    }
    return b;
  }

  function resetBoard() {
    board = newBoard();
    turn = 1;
    selected = null;
    legal = [];
    gameOver = false;
    aiThinking = false;
    aiTimer = 0;
    lastMove = null;
    api.setScore(wins1, 'Wins');
    api.setStatus(mode === '1p' ? 'You are red — select a piece' : 'Red starts');
  }

  function resetMatch() {
    wins1 = 0;
    wins2 = 0;
    resetBoard();
  }

  function directionsFor(value) {
    const dirs = isKing(value) ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : playerOf(value) === 1 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
    return dirs;
  }

  function allMoves(b, player) {
    const captures = [];
    const normal = [];
    for (let r = 0; r < 8; r += 1) {
      for (let c = 0; c < 8; c += 1) {
        const value = b[r][c];
        if (!value || playerOf(value) !== player) continue;
        for (const [dr, dc] of directionsFor(value)) {
          const mr = r + dr;
          const mc = c + dc;
          if (mr < 0 || mr > 7 || mc < 0 || mc > 7) continue;
          const mid = b[mr][mc];
          if (!mid) {
            normal.push({ from: [r, c], to: [mr, mc], capture: null });
          } else if (playerOf(mid) === opponent(player)) {
            const jr = r + dr * 2;
            const jc = c + dc * 2;
            if (jr >= 0 && jr <= 7 && jc >= 0 && jc <= 7 && !b[jr][jc]) {
              captures.push({ from: [r, c], to: [jr, jc], capture: [mr, mc] });
            }
          }
        }
      }
    }
    return captures.length ? captures : normal;
  }

  function applyMove(b, move) {
    const next = b.map((row) => row.slice());
    const [fr, fc] = move.from;
    const [tr, tc] = move.to;
    let value = next[fr][fc];
    next[fr][fc] = 0;
    if (move.capture) next[move.capture[0]][move.capture[1]] = 0;
    if (value === 1 && tr === 0) value = 3;
    if (value === 2 && tr === 7) value = 4;
    next[tr][tc] = value;
    return next;
  }

  function movesFrom(r, c) {
    return allMoves(board, turn).filter((m) => m.from[0] === r && m.from[1] === c);
  }

  function countPieces(b, player) {
    let count = 0;
    for (const row of b) for (const v of row) if (v && playerOf(v) === player) count += 1;
    return count;
  }

  function evaluate(b, aiPlayer) {
    let score = 0;
    for (let r = 0; r < 8; r += 1) {
      for (let c = 0; c < 8; c += 1) {
        const v = b[r][c];
        if (!v) continue;
        const p = playerOf(v);
        let value = isKing(v) ? 520 : 120;
        if (!isKing(v)) value += p === 1 ? (7 - r) * 8 : r * 8;
        score += p === aiPlayer ? value : -value;
      }
    }
    return score;
  }

  function search(b, player, depth, alpha, beta, aiPlayer) {
    const moves = allMoves(b, player);
    if (!moves.length) return player === aiPlayer ? -100000 + depth : 100000 - depth;
    if (depth === 0) return evaluate(b, aiPlayer);
    const maximizing = player === aiPlayer;
    let best = maximizing ? -Infinity : Infinity;
    for (const move of moves) {
      const next = applyMove(b, move);
      const value = search(next, opponent(player), depth - 1, alpha, beta, aiPlayer);
      if (maximizing) {
        best = Math.max(best, value);
        alpha = Math.max(alpha, best);
      } else {
        best = Math.min(best, value);
        beta = Math.min(beta, best);
      }
      if (alpha >= beta) break;
    }
    return best;
  }

  function chooseAI() {
    const moves = allMoves(board, 2);
    if (!moves.length) return null;
    if (difficulty === 1 && Math.random() < 0.3) return moves[Math.floor(Math.random() * moves.length)];
    const depth = difficulty === 1 ? 1 : difficulty === 2 ? 3 : 5;
    let best = moves[0];
    let bestScore = -Infinity;
    for (const move of moves) {
      const next = applyMove(board, move);
      const score = search(next, 1, depth - 1, -Infinity, Infinity, 2);
      if (score > bestScore) {
        bestScore = score;
        best = move;
      }
    }
    return best;
  }

  function finish(winner) {
    gameOver = true;
    if (winner === 1) wins1 += 1;
    else wins2 += 1;
    api.setScore(wins1, 'Wins');
    api.saveBest(wins1);
    api.sfx('win');
    if (mode === '1p') {
      if (winner === 1) api.win({ score: wins1, title: 'You win!', message: `Red cleared the board. Session: ${wins1} wins, ${wins2} losses.` });
      else api.gameOver({ score: wins1, title: 'The computer wins', message: `Black cleared the board. Session: ${wins1} wins, ${wins2} losses.` });
    } else {
      api.gameOver({ score: wins1, title: winner === 1 ? 'Player 1 wins!' : 'Player 2 wins!', message: `Session score: ${wins1} – ${wins2}. New round?` });
    }
  }

  function afterMove() {
    const nextPlayer = opponent(turn);
    if (countPieces(board, nextPlayer) === 0 || allMoves(board, nextPlayer).length === 0) {
      finish(turn);
      return;
    }
    turn = nextPlayer;
    selected = null;
    legal = [];
    if (mode === '1p' && turn === 2) {
      aiThinking = true;
      aiTimer = 0.45;
      api.setStatus('Computer is thinking…');
    } else {
      api.setStatus(mode === '1p' ? 'Your move' : `${turn === 1 ? 'Red' : 'Black'} to move`);
    }
  }

  function makeMove(move) {
    board = applyMove(board, move);
    lastMove = { from: move.from, to: move.to };
    api.sfx(move.capture ? 'hit' : 'click');
    afterMove();
  }

  function clickCell(r, c) {
    if (!api.canPlay() || gameOver || aiThinking) return;
    if (mode === '1p' && turn !== 1) return;
    if (selected) {
      const move = legal.find((m) => m.to[0] === r && m.to[1] === c);
      if (move) {
        makeMove(move);
        return;
      }
    }
    const value = board[r][c];
    if (value && playerOf(value) === turn) {
      selected = [r, c];
      legal = movesFrom(r, c);
      api.sfx('click');
    } else {
      selected = null;
      legal = [];
    }
  }

  function draw() {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#080b16');
    bg.addColorStop(1, '#171226');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Scoreboard
    ctx.textAlign = 'center';
    ctx.font = '900 18px system-ui, sans-serif';
    ctx.fillStyle = turn === 1 && !gameOver ? '#fca5a5' : '#94a3b8';
    ctx.fillText(`RED ${wins1}`, W * 0.24, 66);
    ctx.fillStyle = turn === 2 && !gameOver ? '#cbd5e1' : '#94a3b8';
    ctx.fillText(`BLACK ${wins2}`, W * 0.76, 66);
    ctx.fillStyle = 'rgba(148,163,184,0.65)';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillText(mode === '1p' ? 'You vs CPU' : 'Local 2 player', W / 2, 66);

    // Board shadow
    ctx.save();
    ctx.shadowColor = 'rgba(168, 85, 247, 0.35)';
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#2a1d16';
    ctx.fillRect(BX - 8, BY - 8, BOARD + 16, BOARD + 16);
    ctx.restore();

    for (let r = 0; r < 8; r += 1) {
      for (let c = 0; c < 8; c += 1) {
        const x = BX + c * CELL;
        const y = BY + r * CELL;
        ctx.fillStyle = (r + c) % 2 === 0 ? '#e8d5b5' : '#5b3a29';
        ctx.fillRect(x, y, CELL, CELL);
        if (lastMove && ((lastMove.from[0] === r && lastMove.from[1] === c) || (lastMove.to[0] === r && lastMove.to[1] === c))) {
          ctx.fillStyle = 'rgba(163, 230, 53, 0.22)';
          ctx.fillRect(x, y, CELL, CELL);
        }
        if (selected && selected[0] === r && selected[1] === c) {
          ctx.strokeStyle = '#a3e635';
          ctx.lineWidth = 4;
          ctx.strokeRect(x + 2, y + 2, CELL - 4, CELL - 4);
        }
      }
    }

    // Legal destination markers
    legal.forEach((move) => {
      const x = BX + move.to[1] * CELL + CELL / 2;
      const y = BY + move.to[0] * CELL + CELL / 2;
      ctx.fillStyle = 'rgba(163,230,53,0.55)';
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
    });

    // Pieces
    for (let r = 0; r < 8; r += 1) {
      for (let c = 0; c < 8; c += 1) {
        const value = board[r][c];
        if (!value) continue;
        const red = playerOf(value) === 1;
        const cx = BX + c * CELL + CELL / 2;
        const cy = BY + r * CELL + CELL / 2;
        ctx.save();
        ctx.shadowColor = red ? '#ef4444' : '#94a3b8';
        ctx.shadowBlur = 10;
        const grad = ctx.createRadialGradient(cx - 8, cy - 10, 3, cx, cy, 25);
        grad.addColorStop(0, red ? '#fecaca' : '#f1f5f9');
        grad.addColorStop(0.45, red ? '#dc2626' : '#334155');
        grad.addColorStop(1, red ? '#7f1d1d' : '#0f172a');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, 25, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = red ? 'rgba(255,220,220,0.5)' : 'rgba(226,232,240,0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
        if (isKing(value)) {
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.moveTo(cx - 12, cy + 7);
          ctx.lineTo(cx - 8, cy - 9);
          ctx.lineTo(cx - 2, cy + 1);
          ctx.lineTo(cx + 4, cy - 11);
          ctx.lineTo(cx + 10, cy + 1);
          ctx.lineTo(cx + 13, cy - 7);
          ctx.lineTo(cx + 14, cy + 8);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
    }

    ctx.textAlign = 'center';
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,0.7)';
    ctx.fillText('Select a piece, then a highlighted square · captures are mandatory', W / 2, H - 18);
  }

  api.loop((dt) => {
    if (dt > 0 && api.canPlay()) {
      if (aiThinking) {
        aiTimer -= dt;
        if (aiTimer <= 0) {
          aiThinking = false;
          const move = chooseAI();
          if (move) makeMove(move);
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
    if (r >= 0 && r < 8 && c >= 0 && c < 8) clickCell(r, c);
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
