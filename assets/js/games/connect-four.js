/**
 * Connect Four — original implementation.
 *
 * The alpha-beta search and threat-scoring approach are adapted from the
 * MIT-licensed kenrick95/c4 project (Copyright (c) Kenrick), rewritten for
 * this site's compact canvas shell. See /LICENSES.md.
 */

const COLS = 7;
const ROWS = 6;
const CELL = 70;
const BOARD_W = COLS * CELL;
const BOARD_H = ROWS * CELL;
const W = 560;
const H = 610;
const BOARD_X = (W - BOARD_W) / 2;
const BOARD_Y = 132;

export default function createGame(api) {
  const { ctx } = api.initCanvas(W, H);
  api.setBestMode('higher');
  api.setScore(0, 'Wins');

  let board = [];
  let turn = 1;
  let mode = '1p';
  let difficulty = 2;
  let dropping = null;
  let winner = null;
  let gameOver = false;
  let aiTimer = 0;
  let aiThinking = false;
  let hoverCol = -1;
  let wins1 = 0;
  let wins2 = 0;
  let draws = 0;
  let pulse = 0;

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

  function emptyBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  }

  function resetBoard() {
    board = emptyBoard();
    turn = 1;
    dropping = null;
    winner = null;
    gameOver = false;
    aiThinking = false;
    aiTimer = 0;
    hoverCol = -1;
    api.setStatus(mode === '1p' ? 'You are red — choose a column' : 'Red starts — choose a column');
    api.setScore(wins1, 'Wins');
  }

  function resetMatch() {
    wins1 = 0;
    wins2 = 0;
    draws = 0;
    resetBoard();
  }

  function lowestRow(col) {
    for (let r = ROWS - 1; r >= 0; r -= 1) {
      if (!board[r][col]) return r;
    }
    return -1;
  }

  function validColumns() {
    const cols = [];
    for (let c = 0; c < COLS; c += 1) {
      if (board[0][c] === 0) cols.push(c);
    }
    return cols.sort((a, b) => Math.abs(3 - a) - Math.abs(3 - b));
  }

  function lineAt(r, c, dr, dc, player) {
    const cells = [];
    for (let i = 0; i < 4; i += 1) {
      const rr = r + dr * i;
      const cc = c + dc * i;
      if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || board[rr][cc] !== player) return null;
      cells.push([rr, cc]);
    }
    return cells;
  }

  function checkWinner(player) {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        if (board[r][c] !== player) continue;
        for (const [dr, dc] of directions) {
          const cells = lineAt(r, c, dr, dc, player);
          if (cells) return cells;
        }
      }
    }
    return null;
  }

  function isFull() {
    return board[0].every((cell) => cell !== 0);
  }

  function placeDisc(col, player) {
    const row = lowestRow(col);
    if (row < 0) return false;
    board[row][col] = player;
    return true;
  }

  function finishRound(result, cells) {
    gameOver = true;
    winner = { player: result, cells };
    pulse = 0;
    if (result === 0) {
      draws += 1;
      api.sfx('click');
      api.setStatus('Draw — the board is full');
      if (mode === '1p') {
        api.gameOver({ score: wins1, title: 'A draw', message: 'The board filled without a four-in-a-row. Try to keep the center column open.' });
      }
      return;
    }
    if (result === 1) wins1 += 1;
    else wins2 += 1;
    api.setScore(wins1, 'Wins');
    api.saveBest(wins1);
    api.sfx('win');
    api.setStatus(result === 1 ? 'Red wins!' : 'Yellow wins!');
    if (mode === '1p') {
      if (result === 1) {
        api.win({
          score: wins1,
          title: 'You win!',
          message: `Red connected four. Session score: ${wins1} wins, ${wins2} losses, ${draws} draws.`,
        });
      } else {
        api.gameOver({
          score: wins1,
          title: 'Computer wins',
          message: `Yellow connected four. Session score: ${wins1} wins, ${wins2} losses, ${draws} draws.`,
        });
      }
    } else {
      api.gameOver({
        score: wins1,
        title: result === 1 ? 'Player 1 wins!' : 'Player 2 wins!',
        message: `${wins1} – ${wins2} in the session. Start a new round to play again.`,
      });
    }
  }

  function commitDrop() {
    const { col, row, player } = dropping;
    board[row][col] = player;
    dropping = null;
    const cells = checkWinner(player);
    if (cells) {
      finishRound(player, cells);
      return;
    }
    if (isFull()) {
      finishRound(0, null);
      return;
    }
    turn = player === 1 ? 2 : 1;
    if (mode === '1p' && turn === 2) {
      aiThinking = true;
      aiTimer = 0.4;
      api.setStatus('Computer is thinking…');
    } else {
      api.setStatus(mode === '1p' ? 'Your move' : `${turn === 1 ? 'Red' : 'Yellow'} to move`);
    }
  }

  function drop(col) {
    if (!api.canPlay() || gameOver || dropping || aiThinking) return;
    if (mode === '1p' && turn !== 1) return;
    const row = lowestRow(col);
    if (row < 0) return;
    dropping = { col, row, player: turn, y: BOARD_Y - CELL, targetY: BOARD_Y + row * CELL };
    api.sfx('click');
    api.setStatus('');
  }

  // --- Evaluation and search ------------------------------------------------
  function scoreWindow(window, aiPlayer, humanPlayer) {
    let ai = 0;
    let human = 0;
    for (const value of window) {
      if (value === aiPlayer) ai += 1;
      else if (value === humanPlayer) human += 1;
    }
    if (ai && human) return 0;
    if (ai) return [0, 1, 12, 120, 100000][ai];
    if (human) return -[0, 1, 12, 120, 100000][human];
    return 0;
  }

  function evaluate(aiPlayer, humanPlayer) {
    let score = 0;
    // Center control.
    for (let r = 0; r < ROWS; r += 1) {
      if (board[r][3] === aiPlayer) score += 6;
      else if (board[r][3] === humanPlayer) score -= 6;
    }
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        for (const [dr, dc] of directions) {
          const er = r + dr * 3;
          const ec = c + dc * 3;
          if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue;
          const window = [];
          for (let i = 0; i < 4; i += 1) window.push(board[r + dr * i][c + dc * i]);
          score += scoreWindow(window, aiPlayer, humanPlayer);
        }
      }
    }
    return score;
  }

  function search(depth, alpha, beta, maximizing, aiPlayer, humanPlayer) {
    const aiWin = checkWinner(aiPlayer);
    const humanWin = checkWinner(humanPlayer);
    if (aiWin) return 1000000 - depth;
    if (humanWin) return -1000000 + depth;
    if (depth === 0 || isFull()) return evaluate(aiPlayer, humanPlayer);
    const cols = validColumns();
    if (maximizing) {
      let best = -Infinity;
      for (const col of cols) {
        const row = lowestRow(col);
        board[row][col] = aiPlayer;
        best = Math.max(best, search(depth - 1, alpha, beta, false, aiPlayer, humanPlayer));
        board[row][col] = 0;
        alpha = Math.max(alpha, best);
        if (alpha >= beta) break;
      }
      return best;
    }
    let best = Infinity;
    for (const col of cols) {
      const row = lowestRow(col);
      board[row][col] = humanPlayer;
      best = Math.min(best, search(depth - 1, alpha, beta, true, aiPlayer, humanPlayer));
      board[row][col] = 0;
      beta = Math.min(beta, best);
      if (alpha >= beta) break;
    }
    return best;
  }

  function chooseAIMove() {
    const aiPlayer = 2;
    const humanPlayer = 1;
    const cols = validColumns();
    // Immediate win first.
    for (const col of cols) {
      const row = lowestRow(col);
      board[row][col] = aiPlayer;
      const win = checkWinner(aiPlayer);
      board[row][col] = 0;
      if (win) return col;
    }
    // Block an immediate human win.
    for (const col of cols) {
      const row = lowestRow(col);
      board[row][col] = humanPlayer;
      const win = checkWinner(humanPlayer);
      board[row][col] = 0;
      if (win) return col;
    }
    if (difficulty === 1 && Math.random() < 0.35) {
      return cols[Math.floor(Math.random() * cols.length)];
    }
    const depth = difficulty === 1 ? 2 : difficulty === 2 ? 4 : 6;
    let bestCol = cols[0];
    let bestScore = -Infinity;
    for (const col of cols) {
      const row = lowestRow(col);
      board[row][col] = aiPlayer;
      const score = search(depth - 1, -Infinity, Infinity, false, aiPlayer, humanPlayer);
      board[row][col] = 0;
      if (score > bestScore) {
        bestScore = score;
        bestCol = col;
      }
    }
    return bestCol;
  }

  // --- Drawing -------------------------------------------------------------
  function drawDisc(x, y, player, alpha = 1) {
    const radius = CELL * 0.36;
    ctx.save();
    ctx.globalAlpha = alpha;
    const color = player === 1 ? '#ef4444' : '#facc15';
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    const grad = ctx.createRadialGradient(x - radius * 0.35, y - radius * 0.4, radius * 0.1, x, y, radius);
    grad.addColorStop(0, player === 1 ? '#fecaca' : '#fef08a');
    grad.addColorStop(0.5, color);
    grad.addColorStop(1, player === 1 ? '#7f1d1d' : '#854d0e');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function draw() {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#080d1c');
    bg.addColorStop(1, '#141b3a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Scoreboard
    ctx.textAlign = 'center';
    ctx.font = '900 18px system-ui, sans-serif';
    ctx.fillStyle = turn === 1 && !gameOver ? '#fca5a5' : '#94a3b8';
    ctx.fillText(`RED ${wins1}`, W * 0.22, 94);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillText(`${draws} draws`, W / 2, 92);
    ctx.fillStyle = turn === 2 && !gameOver ? '#fde047' : '#94a3b8';
    ctx.font = '900 18px system-ui, sans-serif';
    ctx.fillText(`YELLOW ${wins2}`, W * 0.78, 94);

    // Board frame
    ctx.save();
    ctx.shadowColor = 'rgba(34, 211, 238, 0.35)';
    ctx.shadowBlur = 28;
    ctx.fillStyle = '#1d4ed8';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(BOARD_X - 12, BOARD_Y - 12, BOARD_W + 24, BOARD_H + 24, 20);
    else ctx.rect(BOARD_X - 12, BOARD_Y - 12, BOARD_W + 24, BOARD_H + 24);
    ctx.fill();
    ctx.shadowBlur = 0;
    const grad = ctx.createLinearGradient(BOARD_X, BOARD_Y, BOARD_X, BOARD_Y + BOARD_H);
    grad.addColorStop(0, '#1e40af');
    grad.addColorStop(1, '#172554');
    ctx.fillStyle = grad;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(BOARD_X - 8, BOARD_Y - 8, BOARD_W + 16, BOARD_H + 16, 16);
    else ctx.rect(BOARD_X - 8, BOARD_Y - 8, BOARD_W + 16, BOARD_H + 16);
    ctx.fill();
    ctx.restore();

    // Holes and discs
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const x = BOARD_X + c * CELL + CELL / 2;
        const y = BOARD_Y + r * CELL + CELL / 2;
        ctx.fillStyle = '#060b18';
        ctx.beginPath();
        ctx.arc(x, y, CELL * 0.38, 0, Math.PI * 2);
        ctx.fill();
        if (board[r][c]) drawDisc(x, y, board[r][c]);
        if (winner && winner.cells && winner.cells.some(([rr, cc]) => rr === r && cc === c)) {
          ctx.strokeStyle = `rgba(255,255,255,${0.55 + Math.sin(pulse * 6) * 0.35})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(x, y, CELL * 0.39, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    // Hover column highlight
    if (!gameOver && !dropping && !aiThinking && hoverCol >= 0 && (mode === '2p' || turn === 1)) {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(BOARD_X + hoverCol * CELL, BOARD_Y, CELL, BOARD_H);
    }

    // Dropping disc
    if (dropping) {
      const x = BOARD_X + dropping.col * CELL + CELL / 2;
      drawDisc(x, dropping.y + CELL / 2, dropping.player, 0.96);
    }

    // Winner banner
    if (gameOver && winner) {
      ctx.fillStyle = 'rgba(4,7,14,0.35)';
      ctx.fillRect(BOARD_X - 8, BOARD_Y - 8, BOARD_W + 16, BOARD_H + 16);
    }

    ctx.textAlign = 'center';
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,0.7)';
    ctx.fillText('Click a column or press 1–7 · first to connect four wins', W / 2, H - 22);
  }

  api.loop((dt) => {
    if (dt > 0 && api.canPlay()) {
      pulse += dt;
      if (dropping) {
        dropping.y += 1700 * dt;
        if (dropping.y >= dropping.targetY) {
          dropping.y = dropping.targetY;
          commitDrop();
        }
      }
      if (aiThinking) {
        aiTimer -= dt;
        if (aiTimer <= 0) {
          const col = chooseAIMove();
          aiThinking = false;
          if (col != null) {
            const row = lowestRow(col);
            dropping = { col, row, player: 2, y: BOARD_Y - CELL, targetY: BOARD_Y + row * CELL };
          }
        }
      }
    }
    draw();
  });

  function columnFromEvent(event) {
    const pos = api.pointerPos(event);
    if (pos.y < BOARD_Y || pos.y > BOARD_Y + BOARD_H) return -1;
    const col = Math.floor((pos.x - BOARD_X) / CELL);
    return col >= 0 && col < COLS ? col : -1;
  }

  api.stage.addEventListener('mousemove', (event) => {
    hoverCol = columnFromEvent(event);
  });
  api.stage.addEventListener('mouseleave', () => { hoverCol = -1; });
  api.stage.addEventListener('pointerdown', (event) => {
    if (!api.canPlay() || gameOver) return;
    const col = columnFromEvent(event);
    if (col >= 0) drop(col);
  });

  window.addEventListener('keydown', (event) => {
    if (!api.canPlay() || gameOver) return;
    if (/^[1-7]$/.test(event.key)) {
      event.preventDefault();
      drop(Number(event.key) - 1);
    }
  });

  tools.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.mode;
      tools.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('is-active', b === btn));
      resetBoard();
      api.sfx('click');
    });
  });
  const difficultySelect = tools.querySelector('[data-difficulty]');
  difficultySelect.addEventListener('change', () => {
    difficulty = Number(difficultySelect.value);
    api.setStatus(`Computer difficulty: ${difficultySelect.options[difficultySelect.selectedIndex].text}`);
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
