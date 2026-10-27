/**
 * Memory Match — original implementation.
 * Three board sizes, flip animations, move counter and best-score saving.
 */

const CARD_FACES = [
  { id: 'clubs-a', src: '/assets/img/cards/cardClubsA.png', label: 'Ace of clubs' },
  { id: 'diamonds-k', src: '/assets/img/cards/cardDiamondsK.png', label: 'King of diamonds' },
  { id: 'hearts-q', src: '/assets/img/cards/cardHeartsQ.png', label: 'Queen of hearts' },
  { id: 'spades-j', src: '/assets/img/cards/cardSpadesJ.png', label: 'Jack of spades' },
  { id: 'clubs-10', src: '/assets/img/cards/cardClubs10.png', label: 'Ten of clubs' },
  { id: 'diamonds-9', src: '/assets/img/cards/cardDiamonds9.png', label: 'Nine of diamonds' },
  { id: 'hearts-8', src: '/assets/img/cards/cardHearts8.png', label: 'Eight of hearts' },
  { id: 'spades-7', src: '/assets/img/cards/cardSpades7.png', label: 'Seven of spades' },
  { id: 'clubs-6', src: '/assets/img/cards/cardClubs6.png', label: 'Six of clubs' },
  { id: 'diamonds-5', src: '/assets/img/cards/cardDiamonds5.png', label: 'Five of diamonds' },
];
const CARD_BACK = '/assets/img/cards/cardBack_blue1.png';
const SIZES = {
  small: { cols: 4, rows: 3, label: '4×3' },
  medium: { cols: 4, rows: 4, label: '4×4' },
  large: { cols: 5, rows: 4, label: '5×4' },
};

const formatTime = (seconds) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export default function createGame(api) {
  const wrap = document.createElement('div');
  wrap.className = 'mm-wrap';
  wrap.innerHTML = `
    <div class="board-tools">
      <button class="board-btn is-active" type="button" data-size="small">4×3</button>
      <button class="board-btn" type="button" data-size="medium">4×4</button>
      <button class="board-btn" type="button" data-size="large">5×4</button>
      <button class="board-btn" type="button" data-act="new">New board</button>
    </div>
    <div class="board-readout">
      <span>Moves <strong data-readout="moves">0</strong></span>
      <span>Pairs <strong data-readout="pairs">0</strong></span>
      <span>Time <strong data-readout="time">00:00</strong></span>
    </div>
    <div class="mm-board" aria-label="Memory board"></div>
    <p class="g2048-hint">Flip two cards · match every pair to clear the board</p>`;
  api.area.appendChild(wrap);
  api.initDOM({ aspect: '1 / 1', maxWidth: 660 });
  api.setBestMode('lower');
  api.setScoreFormat((v) => String(v));
  api.setBestFormat((v) => String(v));

  const boardEl = wrap.querySelector('.mm-board');
  const movesOut = wrap.querySelector('[data-readout="moves"]');
  const pairsOut = wrap.querySelector('[data-readout="pairs"]');
  const timeOut = wrap.querySelector('[data-readout="time"]');

  let size = 'small';
  let cards = [];
  let first = null;
  let second = null;
  let lock = false;
  let moves = 0;
  let matched = 0;
  let elapsed = 0;
  let timerStop = null;
  let started = false;
  let won = false;

  function bestFor(key) {
    const value = api.storageGet(`best-${key}`, null);
    return Number.isFinite(value) ? value : null;
  }

  function updateBest() {
    api.setBest(bestFor(size), 'Best moves');
  }

  function newBoard(nextSize = size) {
    size = nextSize;
    const cfg = SIZES[size];
    const total = cfg.cols * cfg.rows;
    const pairCount = total / 2;
    const picks = [...CARD_FACES].sort(() => Math.random() - 0.5).slice(0, pairCount);
    cards = [...picks, ...picks]
      .map((face, index) => ({ id: index, face, matched: false, flipped: false }))
      .sort(() => Math.random() - 0.5);
    first = null;
    second = null;
    lock = false;
    moves = 0;
    matched = 0;
    elapsed = 0;
    started = false;
    won = false;
    if (timerStop) { timerStop(); timerStop = null; }
    movesOut.textContent = '0';
    pairsOut.textContent = `0 / ${pairCount}`;
    timeOut.textContent = '00:00';
    api.setScore(0, 'Moves');
    updateBest();
    wrap.querySelectorAll('[data-size]').forEach((btn) => btn.classList.toggle('is-active', btn.dataset.size === size));
    boardEl.style.gridTemplateColumns = `repeat(${cfg.cols}, 1fr)`;
    boardEl.style.width = `min(100%, ${cfg.cols * 96}px)`;
    render();
    api.setStatus(`Find all ${pairCount} pairs`);
  }

  function render() {
    boardEl.innerHTML = '';
    cards.forEach((card, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `mm-card${card.flipped || card.matched ? ' is-flipped' : ''}${card.matched ? ' is-matched' : ''}`;
      btn.dataset.index = String(index);
      btn.setAttribute('aria-label', card.flipped || card.matched ? card.face.label : 'Hidden card');
      btn.innerHTML = `<span class="mm-inner">
        <span class="mm-face mm-back"><img src="${CARD_BACK}" alt="" width="120" height="168" loading="lazy"></span>
        <span class="mm-face mm-front"><img src="${card.face.src}" alt="${card.face.label}" width="120" height="168" loading="lazy"></span>
      </span>`;
      btn.addEventListener('click', () => flip(index));
      boardEl.appendChild(btn);
    });
  }

  function startTimer() {
    if (timerStop) return;
    timerStop = api.every(1000, () => {
      elapsed += 1;
      timeOut.textContent = formatTime(elapsed);
    });
  }

  function flip(index) {
    if (!api.canPlay() || lock || won) return;
    const card = cards[index];
    if (card.matched || card.flipped) return;
    if (!started) {
      started = true;
      startTimer();
    }
    card.flipped = true;
    api.sfx('click');
    render();
    if (first === null) {
      first = index;
      return;
    }
    second = index;
    moves += 1;
    movesOut.textContent = String(moves);
    api.setScore(moves, 'Moves');
    const a = cards[first];
    const b = cards[second];
    if (a.face.id === b.face.id) {
      lock = true;
      window.setTimeout(() => {
        a.matched = true;
        b.matched = true;
        matched += 1;
        pairsOut.textContent = `${matched} / ${cards.length / 2}`;
        first = null;
        second = null;
        lock = false;
        api.sfx('score');
        render();
        if (matched === cards.length / 2) win();
      }, 360);
    } else {
      lock = true;
      window.setTimeout(() => {
        a.flipped = false;
        b.flipped = false;
        first = null;
        second = null;
        lock = false;
        render();
      }, 720);
    }
  }

  function win() {
    won = true;
    if (timerStop) { timerStop(); timerStop = null; }
    const best = bestFor(size);
    if (best == null || moves < best) api.storageSet(`best-${size}`, moves);
    updateBest();
    api.saveBest(moves);
    api.win({
      score: moves,
      title: 'Board cleared!',
      message: `${SIZES[size].label} cleared in ${moves} moves and ${formatTime(elapsed)}. Your best for this size is saved.`,
    });
  }

  wrap.querySelectorAll('[data-size]').forEach((btn) => {
    btn.addEventListener('click', () => {
      api.sfx('click');
      newBoard(btn.dataset.size);
    });
  });
  wrap.querySelector('[data-act="new"]').addEventListener('click', () => {
    api.sfx('click');
    newBoard();
  });

  newBoard('small');

  return {
    start() { newBoard(); },
    restart() { newBoard(); },
  };
}
