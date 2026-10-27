/**
 * Snake Duel — original 2-player snake battle.
 * WASD vs arrow keys on one keyboard, or two on-screen pads on touch.
 */

const GRID = 20;
const CELL = 26;
const W = GRID * CELL + 40;
const H = GRID * CELL + 92;
const BX = 20;
const BY = 72;

export default function createGame(api) {
  const { ctx } = api.initCanvas(W, H);
  api.setBestMode('higher');
  api.setScore(0, 'Wins');

  const state = {
    p1: [],
    p2: [],
    d1: { x: 1, y: 0 },
    d2: { x: -1, y: 0 },
    q1: [],
    q2: [],
    food: { x: 10, y: 10 },
    score1: 0,
    score2: 0,
    wins1: 0,
    wins2: 0,
    acc: 0,
    step: 0.13,
    dead: false,
    time: 0,
  };

  function resetRound() {
    state.p1 = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }];
    state.p2 = [{ x: 14, y: 14 }, { x: 15, y: 14 }, { x: 16, y: 14 }];
    state.d1 = { x: 1, y: 0 };
    state.d2 = { x: -1, y: 0 };
    state.q1 = [];
    state.q2 = [];
    state.score1 = 0;
    state.score2 = 0;
    state.acc = 0;
    state.step = 0.13;
    state.dead = false;
    state.time = 0;
    placeFood();
    api.setScore(state.wins1, 'Wins');
    api.setStatus('Green: WASD · Pink: arrow keys · first to survive wins');
  }

  function resetMatch() {
    state.wins1 = 0;
    state.wins2 = 0;
    resetRound();
  }

  function placeFood() {
    const occupied = new Set([...state.p1, ...state.p2].map((p) => `${p.x},${p.y}`));
    const open = [];
    for (let y = 0; y < GRID; y += 1) {
      for (let x = 0; x < GRID; x += 1) if (!occupied.has(`${x},${y}`)) open.push({ x, y });
    }
    state.food = open[Math.floor(Math.random() * open.length)] || { x: 10, y: 10 };
  }

  function setDir(player, x, y) {
    if (!api.canPlay() || state.dead) return;
    if (player === 1) {
      const last = state.q1.length ? state.q1[state.q1.length - 1] : state.d1;
      if (last.x === -x && last.y === -y) return;
      if (last.x === x && last.y === y) return;
      if (state.q1.length < 2) state.q1.push({ x, y });
    } else {
      const last = state.q2.length ? state.q2[state.q2.length - 1] : state.d2;
      if (last.x === -x && last.y === -y) return;
      if (last.x === x && last.y === y) return;
      if (state.q2.length < 2) state.q2.push({ x, y });
    }
  }

  function stepSnake(snake, dir, queue) {
    if (queue.length) dir = queue.shift();
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    return { snake, dir, head };
  }

  function tick() {
    if (state.dead) return;
    if (state.q1.length) state.d1 = state.q1.shift();
    if (state.q2.length) state.d2 = state.q2.shift();
    const h1 = { x: state.p1[0].x + state.d1.x, y: state.p1[0].y + state.d1.y };
    const h2 = { x: state.p2[0].x + state.d2.x, y: state.p2[0].y + state.d2.y };
    const wall1 = h1.x < 0 || h1.x >= GRID || h1.y < 0 || h1.y >= GRID;
    const wall2 = h2.x < 0 || h2.x >= GRID || h2.y < 0 || h2.y >= GRID;
    const body1 = state.p1.some((p) => p.x === h1.x && p.y === h1.y);
    const body2 = state.p2.some((p) => p.x === h2.x && p.y === h2.y);
    const cross = h1.x === h2.x && h1.y === h2.y;
    const hit1 = wall1 || body1 || body2 || cross;
    const hit2 = wall2 || body2 || body1 || cross;

    if (hit1 || hit2) {
      state.dead = true;
      let title;
      let message;
      if (hit1 && hit2) {
        title = 'Double crash — draw';
        message = `Both snakes crashed. Score: ${state.score1} – ${state.score2}.`;
      } else if (hit1) {
        state.wins2 += 1;
        title = 'Pink wins the round';
        message = `Pink survived with ${state.score2} food. Session: ${state.wins1} – ${state.wins2}.`;
        api.sfx('win');
      } else {
        state.wins1 += 1;
        title = 'Green wins the round';
        message = `Green survived with ${state.score1} food. Session: ${state.wins1} – ${state.wins2}.`;
        api.sfx('win');
      }
      api.setScore(state.wins1, 'Wins');
      api.saveBest(state.wins1);
      api.gameOver({ score: state.wins1, title, message });
      return;
    }

    state.p1.unshift(h1);
    state.p2.unshift(h2);
    let ate = false;
    if (h1.x === state.food.x && h1.y === state.food.y) {
      state.score1 += 1;
      ate = true;
      api.sfx('pickup');
    } else {
      state.p1.pop();
    }
    if (h2.x === state.food.x && h2.y === state.food.y) {
      state.score2 += 1;
      ate = true;
      api.sfx('pickup');
    } else {
      state.p2.pop();
    }
    if (ate) {
      state.step = Math.max(0.07, state.step - 0.004);
      placeFood();
    }
  }

  function draw(now) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#07101a');
    bg.addColorStop(1, '#0a1f24');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // HUD
    ctx.textAlign = 'left';
    ctx.font = '900 17px system-ui, sans-serif';
    ctx.fillStyle = '#86efac';
    ctx.fillText(`GREEN ${state.score1}`, 20, 38);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#f9a8d4';
    ctx.fillText(`${state.score2} PINK`, W - 20, 38);
    ctx.textAlign = 'center';
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,0.7)';
    ctx.fillText(`ROUND WINS ${state.wins1} – ${state.wins2}`, W / 2, 38);

    // Grid
    ctx.strokeStyle = 'rgba(34,211,238,0.06)';
    ctx.lineWidth = 1;
    for (let i = 1; i < GRID; i += 1) {
      ctx.beginPath();
      ctx.moveTo(BX + i * CELL, BY);
      ctx.lineTo(BX + i * CELL, BY + GRID * CELL);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(BX, BY + i * CELL);
      ctx.lineTo(BX + GRID * CELL, BY + i * CELL);
      ctx.stroke();
    }

    // Food
    const pulse = 1 + Math.sin(now / 160) * 0.12;
    const fx = BX + state.food.x * CELL + CELL / 2;
    const fy = BY + state.food.y * CELL + CELL / 2;
    ctx.save();
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(fx, fy, 8 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    function drawSnake(snake, color, accent) {
      snake.forEach((part, i) => {
        const x = BX + part.x * CELL + 2;
        const y = BY + part.y * CELL + 2;
        const size = CELL - 4;
        ctx.fillStyle = i === 0 ? accent : color;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, size, size, 7);
        else ctx.rect(x, y, size, size);
        ctx.fill();
        if (i === 0) {
          ctx.fillStyle = '#07101a';
          const cx = x + size / 2;
          const cy = y + size / 2;
          ctx.beginPath();
          ctx.arc(cx - 4, cy - 4, 2.2, 0, Math.PI * 2);
          ctx.arc(cx + 4, cy - 4, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    drawSnake(state.p1, '#15803d', '#86efac');
    drawSnake(state.p2, '#9d174d', '#f9a8d4');

    ctx.textAlign = 'center';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,0.65)';
    ctx.fillText('Green: WASD · Pink: arrows · avoid walls, bodies and each other', W / 2, H - 12);
  }

  api.loop((dt, now) => {
    if (dt > 0 && api.canPlay() && !state.dead) {
      state.acc += dt;
      while (state.acc >= state.step && !state.dead) {
        state.acc -= state.step;
        tick();
      }
    }
    draw(now);
  });

  window.addEventListener('keydown', (event) => {
    if (!api.canPlay()) return;
    const k = event.key;
    if (k === 'w' || k === 'W') setDir(1, 0, -1);
    else if (k === 's' || k === 'S') setDir(1, 0, 1);
    else if (k === 'a' || k === 'A') setDir(1, -1, 0);
    else if (k === 'd' || k === 'D') setDir(1, 1, 0);
    else if (k === 'ArrowUp') setDir(2, 0, -1);
    else if (k === 'ArrowDown') setDir(2, 0, 1);
    else if (k === 'ArrowLeft') setDir(2, -1, 0);
    else if (k === 'ArrowRight') setDir(2, 1, 0);
    else return;
    event.preventDefault();
  });

  if (api.isTouch) {
    const wrap = document.createElement('div');
    wrap.className = 'duel-pads';
    wrap.innerHTML = `
      <div class="touch-pad" data-player="1">
        <button class="touch-btn tp-up" type="button" aria-label="Green up">▲</button>
        <button class="touch-btn tp-left" type="button" aria-label="Green left">◀</button>
        <button class="touch-btn tp-down" type="button" aria-label="Green down">▼</button>
        <button class="touch-btn tp-right" type="button" aria-label="Green right">▶</button>
      </div>
      <div class="touch-pad" data-player="2">
        <button class="touch-btn tp-up" type="button" aria-label="Pink up">▲</button>
        <button class="touch-btn tp-left" type="button" aria-label="Pink left">◀</button>
        <button class="touch-btn tp-down" type="button" aria-label="Pink down">▼</button>
        <button class="touch-btn tp-right" type="button" aria-label="Pink right">▶</button>
      </div>`;
    wrap.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        const player = Number(btn.closest('.touch-pad').dataset.player);
        const dir = btn.classList.contains('tp-up') ? [0, -1]
          : btn.classList.contains('tp-down') ? [0, 1]
            : btn.classList.contains('tp-left') ? [-1, 0]
              : [1, 0];
        setDir(player, dir[0], dir[1]);
      });
    });
    api.addControls(wrap);
  }

  resetMatch();
  return {
    start() { resetMatch(); },
    restart() { resetRound(); },
  };
}
