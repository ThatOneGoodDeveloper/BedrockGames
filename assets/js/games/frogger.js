/**
 * Frogger — original road-and-river arcade game.
 * Hop across traffic, ride logs and fill the five homes at the top.
 */

const COLS = 15;
const ROWS = 16;
const CELL = 36;
const BX = (560 - COLS * CELL) / 2;
const BY = 58;
const W = 560;
const H = 640;
const START_ROW = 15;
const RIVER_ROWS = [2, 3, 4, 5, 6];
const ROAD_ROWS = [8, 9, 10, 11, 12];

export default function createGame(api) {
  const { ctx } = api.initCanvas(W, H);
  api.setBestMode('higher');

  const state = {
    player: { x: W / 2, y: 0, row: START_ROW },
    cars: [],
    logs: [],
    homes: [],
    filled: [false, false, false, false, false],
    lives: 3,
    score: 0,
    level: 1,
    dead: false,
    message: '',
    messageTimer: 0,
  };

  function resetHomes() {
    state.homes = Array.from({ length: 5 }, (_, i) => BX + (i + 0.5) * (COLS * CELL / 5));
    state.filled = [false, false, false, false, false];
  }

  function resetPlayer() {
    state.player = { x: W / 2, y: BY + START_ROW * CELL + CELL / 2, row: START_ROW };
  }

  function buildLanes() {
    state.cars = [];
    state.logs = [];
    const speed = 1 + (state.level - 1) * 0.22;
    ROAD_ROWS.forEach((row, i) => {
      const dir = i % 2 === 0 ? 1 : -1;
      const count = 3 + (i % 3);
      for (let n = 0; n < count; n += 1) {
        const w = (i % 2 === 0 ? 74 : 96);
        state.cars.push({
          row,
          x: BX + ((n * (COLS * CELL / count) + i * 37) % (COLS * CELL)),
          w,
          vx: dir * (48 + i * 9) * speed,
          color: ['#f472b6', '#22d3ee', '#facc15', '#a78bfa', '#fb923c'][i % 5],
        });
      }
    });
    RIVER_ROWS.forEach((row, i) => {
      const dir = i % 2 === 0 ? -1 : 1;
      const count = 2 + (i % 2);
      for (let n = 0; n < count; n += 1) {
        const w = 82 + (i % 3) * 18;
        state.logs.push({
          row,
          x: BX + ((n * (COLS * CELL / count) + i * 53) % (COLS * CELL)),
          w,
          vx: dir * (30 + i * 6) * speed,
        });
      }
    });
  }

  function reset() {
    state.lives = 3;
    state.score = 0;
    state.level = 1;
    state.dead = false;
    state.message = '';
    state.messageTimer = 0;
    resetHomes();
    resetPlayer();
    buildLanes();
    api.setScore(0, 'Score');
    api.setStatus('Cross the road and river — fill all five homes');
  }

  function loseLife(reason) {
    if (state.dead) return;
    state.lives -= 1;
    api.sfx('lose');
    state.message = reason;
    state.messageTimer = 1.2;
    if (state.lives <= 0) {
      state.dead = true;
      api.gameOver({
        score: state.score,
        title: 'No lives left',
        message: `${state.score.toLocaleString()} points · Level ${state.level}. Watch the traffic before you hop.`,
      });
      return;
    }
    resetPlayer();
  }

  function nextLevel() {
    state.level += 1;
    state.score += 250;
    api.setScore(state.score, 'Score');
    resetHomes();
    buildLanes();
    resetPlayer();
    api.setStatus(`Level ${state.level} — the lanes are faster`);
    api.sfx('win');
  }

  function reachHome() {
    const index = state.homes.findIndex((x, i) => !state.filled[i] && Math.abs(x - state.player.x) < 42);
    if (index < 0) {
      loseLife('Missed the home');
      return;
    }
    state.filled[index] = true;
    state.score += 100;
    api.setScore(state.score, 'Score');
    api.sfx('score');
    if (state.filled.every(Boolean)) {
      nextLevel();
    } else {
      resetPlayer();
      api.setStatus(`${state.filled.filter(Boolean).length} / 5 homes filled`);
    }
  }

  function move(dx, dy) {
    if (!api.canPlay() || state.dead) return;
    const player = state.player;
    const nextRow = Math.max(0, Math.min(START_ROW, player.row + dy));
    player.row = nextRow;
    player.y = BY + nextRow * CELL + CELL / 2;
    player.x = Math.max(BX + CELL / 2, Math.min(BX + COLS * CELL - CELL / 2, player.x + dx * CELL));
    api.sfx('click');

    if (nextRow === 0) reachHome();
    else if (!RIVER_ROWS.includes(nextRow) && !ROAD_ROWS.includes(nextRow)) {
      // safe grass/median
    }
  }

  function update(dt) {
    if (state.dead) return;
    state.messageTimer = Math.max(0, state.messageTimer - dt);
    const total = COLS * CELL;
    for (const car of state.cars) {
      car.x += car.vx * dt;
      if (car.x > BX + total + 120) car.x = BX - car.w - 40;
      if (car.x + car.w < BX - 120) car.x = BX + total + 40;
    }
    for (const log of state.logs) {
      log.x += log.vx * dt;
      if (log.x > BX + total + 140) log.x = BX - log.w - 60;
      if (log.x + log.w < BX - 140) log.x = BX + total + 60;
    }

    const player = state.player;
    if (RIVER_ROWS.includes(player.row)) {
      const log = state.logs.find((l) => l.row === player.row && player.x > l.x - 12 && player.x < l.x + l.w + 12);
      if (log) {
        player.x += log.vx * dt;
        if (player.x < BX - 12 || player.x > BX + total + 12) loseLife('Swept off the log');
      } else {
        loseLife('Splashed into the river');
        return;
      }
    } else if (ROAD_ROWS.includes(player.row)) {
      for (const car of state.cars) {
        if (car.row !== player.row) continue;
        if (player.x > car.x - 12 && player.x < car.x + car.w + 12) {
          loseLife('Hit by traffic');
          return;
        }
      }
    }
  }

  function drawCar(car) {
    const y = BY + car.row * CELL + 4;
    const h = CELL - 8;
    const grad = ctx.createLinearGradient(car.x, y, car.x, y + h);
    grad.addColorStop(0, car.color);
    grad.addColorStop(1, '#1e293b');
    ctx.fillStyle = grad;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(car.x, y, car.w, h, 8);
    else ctx.rect(car.x, y, car.w, h);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(car.x + 8, y + 4, car.w - 16, 4);
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(car.x + 10, y + h - 8, 12, 5);
    ctx.fillRect(car.x + car.w - 22, y + h - 8, 12, 5);
  }

  function draw() {
    ctx.fillStyle = '#05070f';
    ctx.fillRect(0, 0, W, H);
    // grass
    ctx.fillStyle = '#14532d';
    ctx.fillRect(0, BY, W, CELL * 2);
    ctx.fillRect(0, BY + 7 * CELL, W, CELL);
    ctx.fillRect(0, BY + 13 * CELL, W, H - BY - 13 * CELL);
    // river
    const river = ctx.createLinearGradient(0, BY + 2 * CELL, 0, BY + 7 * CELL);
    river.addColorStop(0, '#0e7490');
    river.addColorStop(1, '#155e75');
    ctx.fillStyle = river;
    ctx.fillRect(0, BY + 2 * CELL, W, 5 * CELL);
    // road
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, BY + 8 * CELL, W, 5 * CELL);
    ctx.strokeStyle = 'rgba(250,204,21,0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([14, 14]);
    for (let r = 8; r <= 12; r += 1) {
      ctx.beginPath();
      ctx.moveTo(0, BY + r * CELL);
      ctx.lineTo(W, BY + r * CELL);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // goal homes
    for (let i = 0; i < 5; i += 1) {
      const x = state.homes[i];
      const y = BY + CELL * 0.5;
      ctx.fillStyle = state.filled[i] ? 'rgba(163,230,53,0.35)' : 'rgba(2,6,23,0.65)';
      ctx.beginPath();
      ctx.arc(x, y, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = state.filled[i] ? '#a3e635' : 'rgba(148,163,184,0.5)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // logs
    state.logs.forEach((log) => {
      const y = BY + log.row * CELL + 5;
      const h = CELL - 10;
      const grad = ctx.createLinearGradient(log.x, y, log.x, y + h);
      grad.addColorStop(0, '#92400e');
      grad.addColorStop(1, '#451a03');
      ctx.fillStyle = grad;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(log.x, y, log.w, h, 10);
      else ctx.rect(log.x, y, log.w, h);
      ctx.fill();
      ctx.strokeStyle = 'rgba(251,191,36,0.25)';
      ctx.lineWidth = 2;
      for (let i = 0; i < log.w; i += 18) {
        ctx.beginPath();
        ctx.moveTo(log.x + i + 9, y + 3);
        ctx.lineTo(log.x + i + 9, y + h - 3);
        ctx.stroke();
      }
    });

    state.cars.forEach(drawCar);

    // frog
    const p = state.player;
    ctx.save();
    ctx.shadowColor = '#a3e635';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#a3e635';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 15, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#365314';
    ctx.beginPath();
    ctx.arc(p.x - 5, p.y - 4, 2.5, 0, Math.PI * 2);
    ctx.arc(p.x + 5, p.y - 4, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // HUD
    ctx.fillStyle = '#f8fafc';
    ctx.font = '900 17px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(String(state.score).padStart(5, '0'), 14, 34);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#a3e635';
    ctx.fillText('♥'.repeat(Math.max(0, state.lives)), W - 14, 34);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(148,163,184,0.75)';
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.fillText(`LEVEL ${state.level}`, W / 2, 34);

    if (state.messageTimer > 0) {
      ctx.fillStyle = 'rgba(4,7,14,0.72)';
      ctx.fillRect(W / 2 - 130, BY + 100, 260, 44);
      ctx.fillStyle = '#f8fafc';
      ctx.font = '800 15px system-ui, sans-serif';
      ctx.fillText(state.message, W / 2, BY + 127);
    }
  }

  api.loop((dt) => {
    if (dt > 0 && api.canPlay()) update(dt);
    draw();
  });

  window.addEventListener('keydown', (event) => {
    if (!api.canPlay()) return;
    const map = {
      ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
      ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
      ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
      ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
    };
    if (map[event.key]) {
      event.preventDefault();
      move(map[event.key][0], map[event.key][1]);
    }
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
        const dx = btn.classList.contains('tp-left') ? -1 : btn.classList.contains('tp-right') ? 1 : 0;
        const dy = btn.classList.contains('tp-up') ? -1 : btn.classList.contains('tp-down') ? 1 : 0;
        move(dx, dy);
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
