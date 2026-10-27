/**
 * Chess — full rules via the vendored chess.js library (BSD-2-Clause),
 * plus an original alpha-beta opponent, board UI and move history.
 */

import { Chess } from '../vendor/chess.js';

const FILES = 'abcdefgh';
const PIECES = {
  wp: '♙', wn: '♘', wb: '♗', wr: '♖', wq: '♕', wk: '♔',
  bp: '♟', bn: '♞', bb: '♝', br: '♜', bq: '♛', bk: '♚',
};
const VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

export default function createGame(api) {
  const wrap = document.createElement('div');
  wrap.className = 'ch-wrap';
  wrap.innerHTML = `
    <div class="ch-board" role="grid" aria-label="Chess board"></div>
    <div class="ch-side">
      <div class="board-tools">
        <button class="board-btn" type="button" data-act="undo">Undo</button>
        <button class="board-btn" type="button" data-act="flip">Flip</button>
        <button class="board-btn" type="button" data-act="new">New</button>
      </div>
      <label class="ch-status">You play
        <select class="ch-select" data-select="side">
          <option value="w">White</option>
          <option value="b">Black</option>
        </select>
      </label>
      <label class="ch-status">Computer
        <select class="ch-select" data-select="level">
          <option value="1">Easy</option>
          <option value="2" selected>Medium</option>
          <option value="3">Hard</option>
        </select>
      </label>
      <div class="ch-status" data-readout="status">White to move</div>
      <h3>Moves</h3>
      <div class="ch-moves" data-readout="moves"></div>
    </div>`;
  api.area.appendChild(wrap);
  api.initDOM({ aspect: '16 / 10', maxWidth: 780 });
  api.setBestMode('higher');
  api.setBest(api.storageGet('best-wins', 0), 'Best');

  const boardEl = wrap.querySelector('.ch-board');
  const statusEl = wrap.querySelector('[data-readout="status"]');
  const movesEl = wrap.querySelector('[data-readout="moves"]');
  const sideSelect = wrap.querySelector('[data-select="side"]');
  const levelSelect = wrap.querySelector('[data-select="level"]');

  const game = new Chess();
  let userColor = 'w';
  let flipped = false;
  let selected = null;
  let legalTargets = new Map();
  let lastMove = null;
  let sessionWins = api.storageGet('wins', 0) || 0;
  let thinking = false;
  let finished = false;
  let pendingPromotion = null;

  api.setScore(sessionWins, 'Wins');

  function aiColor() {
    return userColor === 'w' ? 'b' : 'w';
  }

  function squareName(row, col) {
    return `${FILES[col]}${8 - row}`;
  }

  function buildBoard() {
    boardEl.innerHTML = '';
    for (let i = 0; i < 64; i += 1) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ch-sq';
      btn.setAttribute('role', 'gridcell');
      boardEl.appendChild(btn);
    }
  }

  function render() {
    const board = game.board();
    const rows = [...board];
    const colOrder = [0, 1, 2, 3, 4, 5, 6, 7];
    if (flipped) {
      rows.reverse();
      colOrder.reverse();
    }
    let index = 0;
    boardEl.innerHTML = '';
    rows.forEach((row, ri) => {
      colOrder.forEach((ci) => {
        const piece = row[ci];
        const actualRow = flipped ? 7 - ri : ri;
        const actualCol = flipped ? 7 - ci : ci;
        const square = squareName(actualRow, actualCol);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `ch-sq ${(actualRow + actualCol) % 2 === 0 ? 'light' : 'dark'}`;
        btn.dataset.square = square;
        btn.setAttribute('role', 'gridcell');
        btn.setAttribute('aria-label', `${square}${piece ? ` ${piece.color === 'w' ? 'white' : 'black'} ${piece.type}` : ' empty'}`);
        if (piece) {
          const span = document.createElement('span');
          span.className = 'piece';
          span.textContent = PIECES[`${piece.color}${piece.type}`];
          span.style.color = piece.color === 'w' ? '#fffdf5' : '#1f2937';
          span.style.textShadow = piece.color === 'w' ? '0 1px 2px rgba(0,0,0,0.45)' : '0 1px 1px rgba(255,255,255,0.35)';
          btn.appendChild(span);
        }
        if (lastMove && (lastMove.from === square || lastMove.to === square)) {
          btn.style.boxShadow = 'inset 0 0 0 3px rgba(139,92,246,0.6)';
        }
        if (selected === square) btn.classList.add('is-selected');
        if (legalTargets.has(square)) {
          btn.classList.add(legalTargets.get(square) || piece ? 'is-capture' : 'is-legal');
        }
        // highlight checked king
        if (game.inCheck() && piece && piece.type === 'k' && piece.color === game.turn()) {
          btn.style.boxShadow = 'inset 0 0 0 4px rgba(244,63,94,0.75)';
        }
        btn.addEventListener('click', () => onSquareClick(square));
        boardEl.appendChild(btn);
        index += 1;
      });
    });
    updateSide();
  }

  function updateSide() {
    const history = game.history();
    movesEl.innerHTML = history.map((move, i) => `<span>${i % 2 === 0 ? `${i / 2 + 1}.` : ''} ${move}</span>`).join('');
    movesEl.scrollTop = movesEl.scrollHeight;
    if (finished) return;
    const turn = game.turn();
    if (thinking) statusEl.textContent = 'Computer is thinking…';
    else if (game.inCheck()) statusEl.innerHTML = `<strong>${turn === 'w' ? 'White' : 'Black'} is in check</strong>`;
    else statusEl.textContent = `${turn === 'w' ? 'White' : 'Black'} to move`;
    api.setStatus(thinking ? 'Computer is thinking…' : `${turn === userColor ? 'Your move' : 'Computer to move'}`);
  }

  function clearSelection() {
    selected = null;
    legalTargets = new Map();
  }

  function onSquareClick(square) {
    if (finished || thinking || game.turn() !== userColor) return;
    const piece = game.get(square);
    if (selected) {
      if (legalTargets.has(square)) {
        const candidates = game.moves({ square: selected, verbose: true }).filter((m) => m.to === square);
        if (candidates.some((m) => m.promotion)) {
          pendingPromotion = { from: selected, to: square };
          showPromotion();
          return;
        }
        makeMove({ from: selected, to: square });
        return;
      }
      if (piece && piece.color === userColor) {
        selectSquare(square);
        return;
      }
      clearSelection();
      render();
      return;
    }
    if (piece && piece.color === userColor) selectSquare(square);
  }

  function selectSquare(square) {
    selected = square;
    legalTargets = new Map();
    game.moves({ square, verbose: true }).forEach((move) => {
      legalTargets.set(move.to, Boolean(game.get(move.to)) || move.flags.includes('e'));
    });
    api.sfx('click');
    render();
  }

  function showPromotion() {
    const existing = wrap.querySelector('.ch-promo');
    existing?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'ch-promo';
    overlay.innerHTML = `<div class="ch-promo-inner">
      ${['q', 'r', 'b', 'n'].map((p) => `<button type="button" data-piece="${p}" aria-label="Promote to ${p}">${PIECES[`${userColor}${p}`]}</button>`).join('')}
    </div>`;
    overlay.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const promotion = btn.dataset.piece;
        const pending = pendingPromotion;
        pendingPromotion = null;
        overlay.remove();
        makeMove({ ...pending, promotion });
      });
    });
    wrap.appendChild(overlay);
  }

  function makeMove(move) {
    const result = game.move(move);
    if (!result) return;
    lastMove = { from: result.from, to: result.to };
    clearSelection();
    api.sfx(result.captured ? 'hit' : 'click');
    render();
    if (checkGameOver()) return;
    if (game.turn() === aiColor()) scheduleAI();
  }

  function checkGameOver() {
    if (!game.isGameOver()) return false;
    finished = true;
    if (game.isCheckmate()) {
      const winner = game.turn() === 'w' ? 'b' : 'w';
      if (winner === userColor) {
        sessionWins += 1;
        api.storageSet('wins', sessionWins);
        api.setScore(sessionWins, 'Wins');
        api.saveBest(sessionWins);
        api.storageSet('best-wins', Math.max(sessionWins, api.storageGet('best-wins', 0) || 0));
        api.win({
          score: sessionWins,
          title: 'Checkmate — you win!',
          message: `You beat the level ${levelSelect.value} computer. Total wins this session: ${sessionWins}.`,
        });
      } else {
        api.setScore(sessionWins, 'Wins');
        api.gameOver({
          score: sessionWins,
          title: 'Checkmate',
          message: 'The computer found the mate. Take back a move and try a different plan.',
        });
      }
    } else {
      api.setScore(sessionWins, 'Wins');
      api.gameOver({
        score: sessionWins,
        title: 'Draw',
        message: game.isStalemate() ? 'Stalemate — no legal moves left.' : 'The position is a draw.',
      });
    }
    render();
    return true;
  }

  function evaluate(color) {
    let score = 0;
    const board = game.board();
    board.forEach((row, r) => {
      row.forEach((piece, c) => {
        if (!piece) return;
        const value = VALUES[piece.type] || 0;
        const center = 3.5;
        const centrality = (3.5 - Math.abs(r - center)) + (3.5 - Math.abs(c - center));
        const bonus = piece.type === 'p' ? centrality * 2 : centrality * 3;
        score += (piece.color === 'w' ? 1 : -1) * (value + bonus);
      });
    });
    return color === 'w' ? score : -score;
  }

  function orderMoves(moves) {
    return moves
      .map((move) => {
        let score = 0;
        if (move.captured) score += (VALUES[move.captured] || 0) * 10 - (VALUES[move.piece] || 0);
        if (move.promotion) score += 800;
        if (move.san.includes('+')) score += 50;
        return { move, score };
      })
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.move);
  }

  function search(depth, alpha, beta, color) {
    if (game.isGameOver()) {
      if (game.isCheckmate()) return -100000; // the side to move has been mated
      return 0;
    }
    if (depth === 0) return evaluate(color);
    const moves = orderMoves(game.moves({ verbose: true }));
    if (!moves.length) return 0;
    let best = -Infinity;
    for (const move of moves) {
      game.move(move);
      const score = -search(depth - 1, -beta, -alpha, color === 'w' ? 'b' : 'w');
      game.undo();
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  function chooseAIMove() {
    const depth = Number(levelSelect.value) || 2;
    const moves = orderMoves(game.moves({ verbose: true }));
    if (!moves.length) return null;
    if (Math.random() < (depth === 1 ? 0.35 : 0.06)) {
      return moves[Math.floor(Math.random() * moves.length)];
    }
    let bestMove = moves[0];
    let bestScore = -Infinity;
    let alpha = -Infinity;
    const started = performance.now();
    for (const move of moves) {
      game.move(move);
      const score = -search(depth - 1, -Infinity, -alpha, userColor);
      game.undo();
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
      if (score > alpha) alpha = score;
      if (performance.now() - started > 1400) break;
    }
    return bestMove;
  }

  function scheduleAI() {
    if (finished) return;
    thinking = true;
    updateSide();
    window.setTimeout(() => {
      if (finished) return;
      const move = chooseAIMove();
      thinking = false;
      if (!move) {
        checkGameOver();
        return;
      }
      makeMove(move);
    }, 260);
  }

  function newGame() {
    game.reset();
    finished = false;
    thinking = false;
    selected = null;
    legalTargets = new Map();
    lastMove = null;
    pendingPromotion = null;
    wrap.querySelector('.ch-promo')?.remove();
    render();
    if (game.turn() === aiColor()) scheduleAI();
  }

  function undo() {
    if (thinking) return;
    if (!game.history().length) return;
    game.undo();
    if (game.history().length && game.turn() !== userColor) game.undo();
    finished = false;
    clearSelection();
    lastMove = null;
    render();
    api.sfx('click');
  }

  wrap.querySelector('[data-act="undo"]').addEventListener('click', undo);
  wrap.querySelector('[data-act="flip"]').addEventListener('click', () => {
    flipped = !flipped;
    render();
  });
  wrap.querySelector('[data-act="new"]').addEventListener('click', () => {
    api.sfx('click');
    newGame();
  });
  sideSelect.addEventListener('change', () => {
    userColor = sideSelect.value;
    flipped = userColor === 'b';
    newGame();
  });
  levelSelect.addEventListener('change', () => {
    api.setStatus(`Computer level: ${levelSelect.options[levelSelect.selectedIndex].text}`);
  });

  buildBoard();
  render();
  if (game.turn() === aiColor()) scheduleAI();

  return {
    start() { newGame(); },
    restart() { newGame(); },
  };
}
