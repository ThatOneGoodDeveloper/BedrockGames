/**
 * Tic-Tac-Toe — original implementation with a perfect minimax opponent.
 */

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export default function createGame(api) {
  const wrap = document.createElement('div');
  wrap.className = 'tt-wrap';
  wrap.innerHTML = `
    <div class="board-tools">
      <button class="board-btn is-active" type="button" data-mode="1p">vs Computer</button>
      <button class="board-btn" type="button" data-mode="2p">2 Players</button>
      <button class="board-btn" type="button" data-act="new">New round</button>
    </div>
    <div class="tt-score">
      <span>Wins <strong data-score="wins">0</strong></span>
      <span>Losses <strong data-score="losses">0</strong></span>
      <span>Draws <strong data-score="draws">0</strong></span>
    </div>
    <div class="board-readout" data-readout="status"></div>
    <div class="tt-board" role="grid" aria-label="Tic-tac-toe board"></div>
    <p class="g2048-hint">Get three in a row · the computer plays perfectly</p>`;
  api.area.appendChild(wrap);
  api.initDOM({ aspect: '1 / 1', maxWidth: 520 });
  api.setBestMode('higher');
  api.setScore(0, 'Wins');
  api.setBest(api.storageGet('best-wins', 0), 'Wins');

  const boardEl = wrap.querySelector('.tt-board');
  const statusEl = wrap.querySelector('[data-readout="status"]');
  const winsOut = wrap.querySelector('[data-score="wins"]');
  const lossesOut = wrap.querySelector('[data-score="losses"]');
  const drawsOut = wrap.querySelector('[data-score="draws"]');

  let board = Array(9).fill('');
  let turn = 'X';
  let mode = '1p';
  let over = false;
  let winLine = null;
  let session = { wins: api.storageGet('wins', 0) || 0, losses: api.storageGet('losses', 0) || 0, draws: api.storageGet('draws', 0) || 0 };
  let buttons = [];

  function build() {
    boardEl.innerHTML = '';
    buttons = [];
    for (let i = 0; i < 9; i += 1) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tt-cell';
      btn.dataset.index = String(i);
      btn.setAttribute('role', 'gridcell');
      btn.addEventListener('click', () => play(i));
      boardEl.appendChild(btn);
      buttons.push(btn);
    }
  }

  function paint() {
    for (let i = 0; i < 9; i += 1) {
      const btn = buttons[i];
      btn.textContent = board[i] || '';
      btn.className = `tt-cell${board[i] ? ` ${board[i].toLowerCase()}` : ''}${winLine && winLine.includes(i) ? ' win' : ''}`;
      btn.setAttribute('aria-label', board[i] ? `${board[i]} at row ${Math.floor(i / 3) + 1} column ${(i % 3) + 1}` : `Empty row ${Math.floor(i / 3) + 1} column ${(i % 3) + 1}`);
    }
    winsOut.textContent = String(session.wins);
    lossesOut.textContent = String(session.losses);
    drawsOut.textContent = String(session.draws);
    if (over) return;
    statusEl.textContent = mode === '1p'
      ? (turn === 'X' ? 'Your turn — you are X' : 'Computer is thinking…')
      : `${turn}'s turn`;
  }

  function winnerOf(state) {
    for (const line of LINES) {
      const [a, b, c] = line;
      if (state[a] && state[a] === state[b] && state[a] === state[c]) {
        return { player: state[a], line };
      }
    }
    if (state.every(Boolean)) return { player: 'draw', line: null };
    return null;
  }

  function minimax(state, player) {
    const result = winnerOf(state);
    if (result) {
      if (result.player === 'O') return { score: 10 };
      if (result.player === 'X') return { score: -10 };
      return { score: 0 };
    }
    let best = { score: player === 'O' ? -Infinity : Infinity, index: -1 };
    for (let i = 0; i < 9; i += 1) {
      if (state[i]) continue;
      state[i] = player;
      const outcome = minimax(state, player === 'O' ? 'X' : 'O').score;
      state[i] = '';
      if (player === 'O' ? outcome > best.score : outcome < best.score) {
        best = { score: outcome, index: i };
      }
    }
    return best;
  }

  function endRound(result) {
    over = true;
    winLine = result.line;
    if (result.player === 'draw') {
      session.draws += 1;
      api.sfx('click');
      api.setStatus('Draw — nobody wins this one');
    } else if (result.player === 'X') {
      session.wins += 1;
      api.storageSet('wins', session.wins);
      api.setScore(session.wins, 'Wins');
      api.saveBest(session.wins);
      api.sfx('win');
      if (mode === '1p') api.setStatus('You win! The computer is not perfect after all.');
    } else {
      session.losses += 1;
      api.storageSet('losses', session.losses);
      api.sfx('lose');
      api.setStatus('Computer wins — try a corner next time');
    }
    paint();
    if (mode === '1p' && result.player === 'X') {
      api.win({
        score: session.wins,
        title: 'Three in a row!',
        message: `You beat the minimax computer. Session record: ${session.wins} wins, ${session.losses} losses.`,
      });
    } else if (mode === '1p' && result.player === 'O') {
      api.gameOver({
        score: session.wins,
        title: 'Computer wins',
        message: `The computer completed a line. Session record: ${session.wins} wins, ${session.losses} losses.`,
      });
    } else if (result.player === 'draw' && mode === '1p') {
      api.gameOver({
        score: session.wins,
        title: 'A draw',
        message: 'A draw against a perfect opponent is the best possible result. Try starting from a corner.',
      });
    } else if (mode === '2p') {
      api.setStatus(result.player === 'X' ? 'X wins!' : 'O wins!');
    }
  }

  function place(index, player) {
    if (board[index] || over) return false;
    board[index] = player;
    api.sfx('click');
    const result = winnerOf(board);
    if (result) {
      endRound(result);
      return true;
    }
    turn = player === 'X' ? 'O' : 'X';
    paint();
    return true;
  }

  function play(index) {
    if (over || board[index]) return;
    if (mode === '1p' && turn !== 'X') return;
    if (!place(index, turn)) return;
    if (mode === '1p' && !over && turn === 'O') {
      window.setTimeout(() => {
        if (over) return;
        const move = minimax([...board], 'O');
        if (move.index >= 0) place(move.index, 'O');
      }, 280);
    }
  }

  function newRound() {
    board = Array(9).fill('');
    turn = 'X';
    over = false;
    winLine = null;
    paint();
    api.setStatus(mode === '1p' ? 'You are X — click any square' : 'X starts');
  }

  function setMode(next) {
    mode = next;
    wrap.querySelectorAll('[data-mode]').forEach((btn) => btn.classList.toggle('is-active', btn.dataset.mode === mode));
    newRound();
  }

  wrap.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });
  wrap.querySelector('[data-act="new"]').addEventListener('click', newRound);

  window.addEventListener('keydown', (event) => {
    if (!api.canPlay() || over) return;
    if (/^[1-9]$/.test(event.key)) {
      event.preventDefault();
      play(Number(event.key) - 1);
    }
  });

  build();
  newRound();
  winsOut.textContent = String(session.wins);
  lossesOut.textContent = String(session.losses);
  drawsOut.textContent = String(session.draws);
  api.setStatus('You are X — click any square');

  return {
    start() { newRound(); },
    restart() { newRound(); },
  };
}
