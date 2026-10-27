/**
 * Sudoku — original generator and solver.
 * Unique-solution puzzles, notes, hints, mistakes and three difficulties.
 */

const ALL = 0x1ff;
const formatTime = (seconds) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

const DIFFICULTY = {
  easy: { clues: 42, label: 'Easy' },
  medium: { clues: 34, label: 'Medium' },
  hard: { clues: 27, label: 'Hard' },
};

const boxOf = (r, c) => Math.floor(r / 3) * 3 + Math.floor(c / 3);
const bitCount = (value) => {
  let count = 0;
  let v = value;
  while (v) { count += v & 1; v >>= 1; }
  return count;
};
const bits = (mask) => {
  const out = [];
  for (let d = 1; d <= 9; d += 1) if (mask & (1 << (d - 1))) out.push(d);
  return out;
};
const shuffle = (array) => {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

function masksFor(grid) {
  const rows = Array(9).fill(0);
  const cols = Array(9).fill(0);
  const boxes = Array(9).fill(0);
  for (let i = 0; i < 81; i += 1) {
    const value = grid[i];
    if (!value) continue;
    const r = Math.floor(i / 9);
    const c = i % 9;
    const bit = 1 << (value - 1);
    rows[r] |= bit;
    cols[c] |= bit;
    boxes[boxOf(r, c)] |= bit;
  }
  return { rows, cols, boxes };
}

function makeSolution() {
  const grid = Array(81).fill(0);
  const { rows, cols, boxes } = masksFor(grid);
  function fill(index) {
    if (index === 81) return true;
    const r = Math.floor(index / 9);
    const c = index % 9;
    const b = boxOf(r, c);
    const free = ALL & ~(rows[r] | cols[c] | boxes[b]);
    const options = shuffle(bits(free));
    for (const value of options) {
      const bit = 1 << (value - 1);
      grid[index] = value;
      rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
      if (fill(index + 1)) return true;
      rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit;
      grid[index] = 0;
    }
    return false;
  }
  fill(0);
  return grid;
}

function countSolutions(grid, limit = 2) {
  const { rows, cols, boxes } = masksFor(grid);
  let found = 0;
  function solve() {
    if (found >= limit) return;
    let bestIndex = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < 81; i += 1) {
      if (grid[i]) continue;
      const r = Math.floor(i / 9);
      const c = i % 9;
      const b = boxOf(r, c);
      const free = ALL & ~(rows[r] | cols[c] | boxes[b]);
      const count = bitCount(free);
      if (count === 0) return;
      if (count < bestCount) {
        bestCount = count;
        bestIndex = i;
        bestMask = free;
        if (count === 1) break;
      }
    }
    if (bestIndex === -1) {
      found += 1;
      return;
    }
    const r = Math.floor(bestIndex / 9);
    const c = bestIndex % 9;
    const b = boxOf(r, c);
    for (const value of bits(bestMask)) {
      const bit = 1 << (value - 1);
      grid[bestIndex] = value;
      rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
      solve();
      rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit;
      grid[bestIndex] = 0;
      if (found >= limit) return;
    }
  }
  solve();
  return found;
}

function makePuzzle(targetClues) {
  const solution = makeSolution();
  const puzzle = [...solution];
  const positions = shuffle(Array.from({ length: 81 }, (_, i) => i));
  let clues = 81;
  for (const index of positions) {
    if (clues <= targetClues) break;
    const backup = puzzle[index];
    puzzle[index] = 0;
    if (countSolutions([...puzzle], 2) !== 1) puzzle[index] = backup;
    else clues -= 1;
  }
  return { puzzle, solution };
}

export default function createGame(api) {
  const wrap = document.createElement('div');
  wrap.className = 'su-wrap';
  wrap.innerHTML = `
    <div class="board-tools">
      <button class="board-btn is-active" type="button" data-diff="easy">Easy</button>
      <button class="board-btn" type="button" data-diff="medium">Medium</button>
      <button class="board-btn" type="button" data-diff="hard">Hard</button>
      <button class="board-btn" type="button" data-act="new">New puzzle</button>
    </div>
    <div class="board-readout">
      <span>Mistakes <strong data-readout="mistakes">0</strong></span>
      <span>Hints <strong data-readout="hints">0</strong></span>
      <span>Time <strong data-readout="time">00:00</strong></span>
    </div>
    <div class="su-board" role="grid" aria-label="Sudoku board"></div>
    <div class="su-numpad"></div>
    <p class="g2048-hint">Click a cell, type 1–9 · N notes · Backspace erase · H hint</p>`;
  api.area.appendChild(wrap);
  api.initDOM({ aspect: '1 / 1', maxWidth: 620 });
  api.setBestMode('lower');
  api.setScoreFormat(formatTime);
  api.setBestFormat(formatTime);

  const boardEl = wrap.querySelector('.su-board');
  const numpad = wrap.querySelector('.su-numpad');
  const mistakesOut = wrap.querySelector('[data-readout="mistakes"]');
  const hintsOut = wrap.querySelector('[data-readout="hints"]');
  const timeOut = wrap.querySelector('[data-readout="time"]');

  let difficulty = 'easy';
  let solution = [];
  let values = [];
  let given = [];
  let notes = [];
  let selected = -1;
  let notesMode = false;
  let mistakes = 0;
  let hints = 0;
  let elapsed = 0;
  let timerStop = null;
  let solved = false;
  let buttons = [];

  function bestFor(key) {
    const value = api.storageGet(`best-${key}`, null);
    return Number.isFinite(value) ? value : null;
  }

  function updateBest() {
    api.setBest(bestFor(difficulty), 'Best');
  }

  function newPuzzle(diff = difficulty) {
    difficulty = diff;
    const target = DIFFICULTY[difficulty].clues;
    const generated = makePuzzle(target);
    solution = generated.solution;
    given = generated.puzzle.map((v) => v !== 0);
    values = [...generated.puzzle];
    notes = Array.from({ length: 81 }, () => new Set());
    selected = -1;
    notesMode = false;
    mistakes = 0;
    hints = 0;
    elapsed = 0;
    solved = false;
    if (timerStop) { timerStop(); timerStop = null; }
    mistakesOut.textContent = '0';
    hintsOut.textContent = '0';
    timeOut.textContent = '00:00';
    api.setScore(0, 'Time');
    updateBest();
    wrap.querySelectorAll('[data-diff]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.diff === difficulty);
    });
    buildBoard();
    render();
    api.setStatus(`New ${DIFFICULTY[difficulty].label.toLowerCase()} puzzle — good luck`);
    timerStop = api.every(1000, () => {
      if (solved) return;
      elapsed += 1;
      timeOut.textContent = formatTime(elapsed);
      api.setScore(elapsed, 'Time');
    });
  }

  function buildBoard() {
    boardEl.innerHTML = '';
    buttons = [];
    for (let i = 0; i < 81; i += 1) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'su-cell';
      btn.dataset.index = String(i);
      btn.setAttribute('role', 'gridcell');
      btn.addEventListener('click', () => selectCell(i));
      boardEl.appendChild(btn);
      buttons.push(btn);
    }
  }

  function selectCell(index) {
    if (solved) return;
    selected = index;
    render();
  }

  function render() {
    const selectedValue = selected >= 0 ? values[selected] : 0;
    const selRow = selected >= 0 ? Math.floor(selected / 9) : -1;
    const selCol = selected >= 0 ? selected % 9 : -1;
    const selBox = selected >= 0 ? boxOf(selRow, selCol) : -1;
    for (let i = 0; i < 81; i += 1) {
      const btn = buttons[i];
      const r = Math.floor(i / 9);
      const c = i % 9;
      btn.className = 'su-cell';
      btn.textContent = '';
      btn.innerHTML = '';
      if (given[i]) btn.classList.add('is-given');
      if (selected >= 0 && (r === selRow || c === selCol || boxOf(r, c) === selBox)) btn.classList.add('is-peer');
      if (selectedValue && values[i] === selectedValue) btn.classList.add('is-same');
      if (i === selected) btn.classList.add('is-selected');
      if (!given[i] && values[i] && values[i] !== solution[i]) btn.classList.add('is-error');
      if (values[i]) {
        btn.textContent = String(values[i]);
      } else if (notes[i].size) {
        const note = document.createElement('span');
        note.className = 'notes';
        for (let d = 1; d <= 9; d += 1) {
          const n = document.createElement('span');
          n.textContent = notes[i].has(d) ? String(d) : '';
          note.appendChild(n);
        }
        btn.appendChild(note);
      }
      btn.setAttribute('aria-label', values[i] ? `Row ${r + 1} column ${c + 1} value ${values[i]}` : `Row ${r + 1} column ${c + 1} empty`);
    }
  }

  function checkWin() {
    if (values.some((v, i) => v !== solution[i])) return;
    solved = true;
    if (timerStop) { timerStop(); timerStop = null; }
    const best = bestFor(difficulty);
    if (best == null || elapsed < best) api.storageSet(`best-${difficulty}`, elapsed);
    updateBest();
    api.saveBest(elapsed);
    api.win({
      score: elapsed,
      title: 'Sudoku solved!',
      message: `${DIFFICULTY[difficulty].label} puzzle cleared in ${formatTime(elapsed)} with ${mistakes} mistakes and ${hints} hints.`,
    });
  }

  function setValue(value) {
    if (solved || selected < 0 || given[selected]) return;
    if (notesMode && !values[selected]) {
      if (notes[selected].has(value)) notes[selected].delete(value);
      else notes[selected].add(value);
      api.sfx('click');
      render();
      return;
    }
    values[selected] = values[selected] === value ? 0 : value;
    notes[selected].clear();
    if (values[selected] && values[selected] !== solution[selected]) {
      mistakes += 1;
      mistakesOut.textContent = String(mistakes);
      api.sfx('hit');
    } else if (values[selected]) {
      api.sfx('score');
    } else {
      api.sfx('click');
    }
    render();
    checkWin();
  }

  function erase() {
    if (solved || selected < 0 || given[selected]) return;
    values[selected] = 0;
    notes[selected].clear();
    api.sfx('click');
    render();
  }

  function hint() {
    if (solved) return;
    let target = selected;
    if (target < 0 || values[target] === solution[target]) {
      target = values.findIndex((v, i) => v !== solution[i]);
    }
    if (target < 0) return;
    values[target] = solution[target];
    notes[target].clear();
    hints += 1;
    hintsOut.textContent = String(hints);
    selected = target;
    api.sfx('pickup');
    render();
    checkWin();
  }

  // Number pad
  const eraseBtn = document.createElement('button');
  eraseBtn.type = 'button';
  eraseBtn.textContent = 'Erase';
  eraseBtn.addEventListener('click', erase);
  const notesBtn = document.createElement('button');
  notesBtn.type = 'button';
  notesBtn.textContent = 'Notes';
  notesBtn.className = notesMode ? 'is-active' : '';
  notesBtn.addEventListener('click', () => {
    notesMode = !notesMode;
    notesBtn.classList.toggle('is-active', notesMode);
    api.setStatus(notesMode ? 'Notes mode: digits become pencil marks' : 'Normal mode');
  });
  const hintBtn = document.createElement('button');
  hintBtn.type = 'button';
  hintBtn.textContent = 'Hint';
  hintBtn.addEventListener('click', hint);
  for (let d = 1; d <= 9; d += 1) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = String(d);
    btn.addEventListener('click', () => setValue(d));
    numpad.appendChild(btn);
  }
  numpad.append(eraseBtn, notesBtn, hintBtn);

  wrap.querySelectorAll('[data-diff]').forEach((btn) => {
    btn.addEventListener('click', () => {
      api.sfx('click');
      newPuzzle(btn.dataset.diff);
    });
  });
  wrap.querySelector('[data-act="new"]').addEventListener('click', () => {
    api.sfx('click');
    newPuzzle();
  });

  window.addEventListener('keydown', (event) => {
    if (!api.canPlay() || solved) return;
    const tag = (event.target?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    if (/^[1-9]$/.test(event.key)) {
      event.preventDefault();
      setValue(Number(event.key));
    } else if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') {
      event.preventDefault();
      erase();
    } else if (event.key === 'n' || event.key === 'N') {
      event.preventDefault();
      notesBtn.click();
    } else if (event.key === 'h' || event.key === 'H') {
      event.preventDefault();
      hint();
    } else if (event.key === 'ArrowLeft') { event.preventDefault(); selectCell(Math.max(0, selected - 1)); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); selectCell(Math.min(80, selected + 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); selectCell(Math.max(0, selected - 9)); }
    else if (event.key === 'ArrowDown') { event.preventDefault(); selectCell(Math.min(80, selected + 9)); }
  });

  newPuzzle('easy');

  return {
    start() { newPuzzle(); },
    restart() { newPuzzle(); },
  };
}
