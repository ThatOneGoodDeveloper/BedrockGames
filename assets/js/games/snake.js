/**
 * Snake — original implementation.
 * Grid-based movement, progressive speed, swipe + D-pad controls.
 */

const GRID = 20;
const CELL = 24;
const W = GRID * CELL;
const H = GRID * CELL;

export default function createGame(api) {
  const { ctx } = api.initCanvas(W, H);
  api.setBestMode('higher');

  const state = {
    snake: [],
    food: { x: 5, y: 5 },
    dir: { x: 1, y: 0 },
    queue: [],
    score: 0,
    stepMs: 135,
    acc: 0,
    dead: false,
    time: 0,
  };

  function reset() {
    state.snake = [
      { x: 9, y: 10 },
      { x: 8, y: 10 },
      { x: 7, y: 10 },
      { x: 6, y: 10 },
    ];
    state.dir = { x: 1, y: 0 };
    state.queue = [];
    state.score = 0;
    state.stepMs = 135;
    state.acc = 0;
    state.dead = false;
    api.setScore(0, 'Score');
    api.setStatus('Eat the food, avoid the walls and your tail');
    placeFood();
  }

  function placeFood() {
    const open = [];
    for (let y = 0; y < GRID; y += 1) {
      for (let x = 0; x < GRID; x += 1) {
        if (!state.snake.some((s) => s.x === x && s.y === y)) open.push({ x, y });
      }
    }
    state.food = open[Math.floor(Math.random() * open.length)] || { x: 0, y: 0 };
  }

  function setDirection(x, y) {
    if (!api.canPlay() || state.dead) return;
    const last = state.queue.length ? state.queue[state.queue.length - 1] : state.dir;
    if (last.x === -x && last.y === -y) return; // no instant reverse
    if (last.x === x && last.y === y) return;
    if (state.queue.length < 2) state.queue.push({ x, y });
  }

  function step() {
    if (state.queue.length) state.dir = state.queue.shift();
    const head = {
      x: state.snake[0].x + state.dir.x,
      y: state.snake[0].y + state.dir.y,
    };
    const hitWall = head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID;
    const hitSelf = state.snake.some((part) => part.x === head.x && part.y === head.y);
    if (hitWall || hitSelf) {
      state.dead = true;
      api.sfx('lose');
      api.gameOver({
        score: state.score,
        title: hitWall ? 'You hit the wall' : 'You bit your own tail',
        message: `Length ${state.snake.length} · Score ${state.score}. One more run?`,
      });
      return;
    }
    state.snake.unshift(head);
    if (head.x === state.food.x && head.y === state.food.y) {
      state.score += 10;
      state.stepMs = Math.max(58, state.stepMs - 4);
      api.setScore(state.score, 'Score');
      api.sfx('pickup');
      placeFood();
    } else {
      state.snake.pop();
    }
  }

  function draw(now) {
    // Background
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#08131a');
    g.addColorStop(1, '#0b1f24');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(16, 185, 129, 0.075)';
    ctx.lineWidth = 1;
    for (let i = 1; i < GRID; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * CELL, 0);
      ctx.lineTo(i * CELL, H);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL);
      ctx.lineTo(W, i * CELL);
      ctx.stroke();
    }

    // Food with pulse
    const pulse = 1 + Math.sin(now / 180) * 0.12;
    const fx = state.food.x * CELL + CELL / 2;
    const fy = state.food.y * CELL + CELL / 2;
    ctx.save();
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(fx, fy, (CELL * 0.33) * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fda4af';
    ctx.beginPath();
    ctx.arc(fx - 3, fy - 4, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Snake: gradient body with eyes on the head
    state.snake.forEach((part, index) => {
      const t = index / Math.max(1, state.snake.length - 1);
      const x = part.x * CELL + 2;
      const y = part.y * CELL + 2;
      const size = CELL - 4;
      const r = 6;
      const green = Math.round(185 - t * 60);
      ctx.fillStyle = index === 0 ? '#a3e635' : `rgb(52, ${green}, 120)`;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, size, size, r);
      else ctx.rect(x, y, size, size);
      ctx.fill();
      if (index === 0) {
        ctx.shadowColor = '#a3e635';
        ctx.shadowBlur = 16;
        ctx.fill();
        ctx.shadowBlur = 0;
        // eyes follow direction
        const ex = state.dir.x * 4;
        const ey = state.dir.y * 4;
        const cx = x + size / 2;
        const cy = y + size / 2;
        ctx.fillStyle = '#0b1f24';
        const perpX = state.dir.y;
        const perpY = state.dir.x;
        [-1, 1].forEach((side) => {
          ctx.beginPath();
          ctx.arc(cx + ex + perpX * side * 5.2, cy + ey + perpY * side * 5.2, 2.3, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    });

    if (state.dead) {
      ctx.fillStyle = 'rgba(4, 7, 14, 0.4)';
      ctx.fillRect(0, 0, W, H);
    }

    // Score watermark
    ctx.fillStyle = 'rgba(226, 232, 240, 0.1)';
    ctx.font = '800 64px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(state.score), W / 2, 74);
  }

  api.loop((dt, now) => {
    if (dt > 0) {
      state.time += dt * 1000;
      state.acc += dt * 1000;
      while (state.acc >= state.stepMs && !state.dead) {
        state.acc -= state.stepMs;
        step();
      }
    }
    draw(now);
  });

  function onKey(event) {
    if (!api.canPlay()) return;
    const k = event.key;
    if (k === 'ArrowUp' || k === 'w' || k === 'W') { event.preventDefault(); setDirection(0, -1); }
    else if (k === 'ArrowDown' || k === 's' || k === 'S') { event.preventDefault(); setDirection(0, 1); }
    else if (k === 'ArrowLeft' || k === 'a' || k === 'A') { event.preventDefault(); setDirection(-1, 0); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { event.preventDefault(); setDirection(1, 0); }
  }
  window.addEventListener('keydown', onKey);

  // Swipe
  let start = null;
  api.stage.addEventListener('pointerdown', (event) => {
    start = { x: event.clientX, y: event.clientY };
  });
  api.stage.addEventListener('pointerup', (event) => {
    if (!start || !api.canPlay()) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) setDirection(dx > 0 ? 1 : -1, 0);
    else setDirection(0, dy > 0 ? 1 : -1);
  });

  if (api.isTouch) {
    const pad = document.createElement('div');
    pad.className = 'touch-pad';
    pad.innerHTML = `
      <button class="touch-btn tp-up" type="button" aria-label="Up">▲</button>
      <button class="touch-btn tp-left" type="button" aria-label="Left">◀</button>
      <button class="touch-btn tp-down" type="button" aria-label="Down">▼</button>
      <button class="touch-btn tp-right" type="button" aria-label="Right">▶</button>`;
    pad.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        const dir = btn.classList.contains('tp-up') ? [0, -1]
          : btn.classList.contains('tp-down') ? [0, 1]
            : btn.classList.contains('tp-left') ? [-1, 0]
              : [1, 0];
        setDirection(...dir);
      });
    });
    api.addControls(pad);
  }

  reset();
  return {
    start() { reset(); },
    restart() { reset(); },
  };
}
