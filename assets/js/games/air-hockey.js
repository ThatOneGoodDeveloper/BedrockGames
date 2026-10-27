/**
 * Air Hockey — original 2D implementation.
 * Puck physics, paddle momentum, CPU defence and same-keyboard two-player.
 * The CPU defensive heuristic is inspired by the MIT-licensed
 * MortimerGoro/AirHockeyWebGL project. See /LICENSES.md.
 */

const W = 720;
const H = 520;
const MARGIN = 34;
const LEFT = MARGIN;
const RIGHT = W - MARGIN;
const TOP = MARGIN;
const BOTTOM = H - MARGIN;
const GOAL_H = 150;
const GOAL_TOP = (H - GOAL_H) / 2;
const GOAL_BOTTOM = GOAL_TOP + GOAL_H;
const PADDLE_R = 38;
const PUCK_R = 17;
const WIN_SCORE = 7;

export default function createGame(api) {
  const { ctx } = api.initCanvas(W, H);
  api.setBestMode('higher');

  const state = {
    left: { x: LEFT + 78, y: H / 2, vy: 0 },
    right: { x: RIGHT - 78, y: H / 2, vy: 0 },
    puck: { x: W / 2, y: H / 2, vx: 0, vy: 0 },
    scoreL: 0,
    scoreR: 0,
    mode: '1p',
    difficulty: 2,
    serving: 1.1,
    over: false,
    keys: new Set(),
    particles: [],
    trail: [],
    shake: 0,
    flash: 0,
    time: 0,
  };

  function resetPuck(dir = 1) {
    state.puck.x = W / 2;
    state.puck.y = H / 2;
    const angle = (Math.random() - 0.5) * 0.7;
    const speed = 330;
    state.puck.vx = Math.cos(angle) * speed * dir;
    state.puck.vy = Math.sin(angle) * speed;
    state.serving = 1.1;
    state.trail = [];
  }

  function resetMatch() {
    state.scoreL = 0;
    state.scoreR = 0;
    state.left.y = H / 2;
    state.right.y = H / 2;
    state.over = false;
    state.keys.clear();
    state.particles = [];
    state.shake = 0;
    state.flash = 0;
    resetPuck(Math.random() > 0.5 ? 1 : -1);
    api.setScore(0, 'Score');
    api.setStatus('First to 7 goals wins · landscape is best for two players');
  }

  function setMode(mode) {
    state.mode = mode;
    resetMatch();
    api.setStatus(mode === '1p' ? 'One player — W/S or drag the left half' : 'Two players — W/S vs arrow keys · landscape recommended');
  }

  function spawn(x, y, color, count = 10) {
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 220;
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.45 + Math.random() * 0.4, color });
    }
  }

  function goal(scorer) {
    if (state.over) return;
    if (scorer === 'left') state.scoreL += 1;
    else state.scoreR += 1;
    api.setScore(state.scoreL, 'Score');
    api.sfx('score');
    state.shake = 0.35;
    state.flash = 0.25;
    spawn(scorer === 'left' ? RIGHT : LEFT, state.puck.y, scorer === 'left' ? '#22d3ee' : '#f472b6', 22);
    if (state.scoreL >= WIN_SCORE || state.scoreR >= WIN_SCORE) {
      state.over = true;
      const won = state.scoreL >= WIN_SCORE;
      const result = {
        score: state.scoreL,
        title: won ? 'You win the match!' : state.mode === '1p' ? 'The computer wins' : 'Player 2 wins',
        message: `Final score ${state.scoreL} – ${state.scoreR}. First to ${WIN_SCORE} takes the match.`,
      };
      if (won) api.win(result);
      else api.gameOver(result);
      return;
    }
    resetPuck(scorer === 'left' ? -1 : 1);
  }

  function collidePaddle(paddle, side) {
    const dx = state.puck.x - paddle.x;
    const dy = state.puck.y - paddle.y;
    const distance = Math.hypot(dx, dy);
    const minDistance = PADDLE_R + PUCK_R;
    if (distance > minDistance || distance === 0) return;
    const nx = dx / distance;
    const ny = dy / distance;
    // Separate the puck from the paddle.
    state.puck.x = paddle.x + nx * minDistance;
    state.puck.y = paddle.y + ny * minDistance;
    const speed = Math.max(300, Math.hypot(state.puck.vx, state.puck.vy) * 1.06);
    const paddleVy = side === 'left' ? paddle.vy : paddle.vy;
    state.puck.vx = nx * speed;
    state.puck.vy = ny * speed + paddleVy * 0.35;
    const total = Math.hypot(state.puck.vx, state.puck.vy);
    if (total > 980) {
      state.puck.vx = (state.puck.vx / total) * 980;
      state.puck.vy = (state.puck.vy / total) * 980;
    }
    state.trail = [];
    spawn(state.puck.x, state.puck.y, '#a3e635', 5);
    api.sfx('hit');
  }

  function update(dt) {
    if (state.over) return;
    state.time += dt;
    state.shake = Math.max(0, state.shake - dt);
    state.flash = Math.max(0, state.flash - dt);

    const paddleSpeed = 460;
    const prevLeftY = state.left.y;
    const prevRightY = state.right.y;
    if (state.keys.has('w')) state.left.y -= paddleSpeed * dt;
    if (state.keys.has('s')) state.left.y += paddleSpeed * dt;
    if (state.mode === '2p') {
      if (state.keys.has('ArrowUp')) state.right.y -= paddleSpeed * dt;
      if (state.keys.has('ArrowDown')) state.right.y += paddleSpeed * dt;
    } else {
      // CPU: track the puck when it is coming, otherwise return to goal center.
      const speed = [0, 290, 360, 430][state.difficulty] || 360;
      const puckComing = state.puck.vx > 0 && state.puck.x > W * 0.35;
      const target = puckComing
        ? state.puck.y + state.puck.vy * 0.08
        : H / 2;
      const diff = target - state.right.y;
      state.right.y += Math.max(-speed * dt, Math.min(speed * dt, diff));
    }
    state.left.vy = (state.left.y - prevLeftY) / Math.max(dt, 0.001);
    state.right.vy = (state.right.y - prevRightY) / Math.max(dt, 0.001);
    state.left.y = Math.max(TOP + PADDLE_R, Math.min(BOTTOM - PADDLE_R, state.left.y));
    state.right.y = Math.max(TOP + PADDLE_R, Math.min(BOTTOM - PADDLE_R, state.right.y));

    if (state.serving > 0) {
      state.serving -= dt;
      state.trail = [];
      return;
    }

    const puck = state.puck;
    puck.x += puck.vx * dt;
    puck.y += puck.vy * dt;
    puck.vx *= Math.pow(0.995, dt * 60);
    puck.vy *= Math.pow(0.995, dt * 60);

    // Top and bottom rails.
    if (puck.y - PUCK_R < TOP) {
      puck.y = TOP + PUCK_R;
      puck.vy = Math.abs(puck.vy);
      api.sfx('click');
    } else if (puck.y + PUCK_R > BOTTOM) {
      puck.y = BOTTOM - PUCK_R;
      puck.vy = -Math.abs(puck.vy);
      api.sfx('click');
    }

    // Left and right walls, with goal slots.
    if (puck.x - PUCK_R < LEFT) {
      if (puck.y > GOAL_TOP && puck.y < GOAL_BOTTOM) {
        goal('right');
        return;
      }
      puck.x = LEFT + PUCK_R;
      puck.vx = Math.abs(puck.vx);
      api.sfx('click');
    } else if (puck.x + PUCK_R > RIGHT) {
      if (puck.y > GOAL_TOP && puck.y < GOAL_BOTTOM) {
        goal('left');
        return;
      }
      puck.x = RIGHT - PUCK_R;
      puck.vx = -Math.abs(puck.vx);
      api.sfx('click');
    }

    collidePaddle(state.left, 'left');
    collidePaddle(state.right, 'right');

    state.trail.unshift({ x: puck.x, y: puck.y });
    if (state.trail.length > 10) state.trail.pop();
    state.particles.forEach((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 160 * dt;
    });
    state.particles = state.particles.filter((p) => p.life > 0);
  }

  function drawPaddle(paddle, color) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 22;
    const grad = ctx.createRadialGradient(paddle.x - 10, paddle.y - 12, 5, paddle.x, paddle.y, PADDLE_R);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.35, color);
    grad.addColorStop(1, '#0b1020');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(paddle.x, paddle.y, PADDLE_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(paddle.x, paddle.y, PADDLE_R - 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function draw() {
    ctx.save();
    if (state.shake > 0) ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
    ctx.fillStyle = '#05070f';
    ctx.fillRect(-10, -10, W + 20, H + 20);

    // Table
    const table = ctx.createLinearGradient(0, TOP, 0, BOTTOM);
    table.addColorStop(0, '#0b1730');
    table.addColorStop(0.5, '#0e2240');
    table.addColorStop(1, '#0b1730');
    ctx.fillStyle = table;
    ctx.fillRect(LEFT, TOP, RIGHT - LEFT, BOTTOM - TOP);

    // Rails
    ctx.strokeStyle = 'rgba(34,211,238,0.7)';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 14;
    ctx.strokeRect(LEFT, TOP, RIGHT - LEFT, BOTTOM - TOP);
    ctx.shadowBlur = 0;

    // Center line and circle
    ctx.strokeStyle = 'rgba(148,163,184,0.22)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 12]);
    ctx.beginPath();
    ctx.moveTo(W / 2, TOP);
    ctx.lineTo(W / 2, BOTTOM);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 68, 0, Math.PI * 2);
    ctx.stroke();

    // Goals
    for (const side of ['left', 'right']) {
      const x = side === 'left' ? LEFT : RIGHT;
      const color = side === 'left' ? '#22d3ee' : '#f472b6';
      ctx.strokeStyle = color;
      ctx.lineWidth = 7;
      ctx.shadowColor = color;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(x, GOAL_TOP);
      ctx.lineTo(x, GOAL_BOTTOM);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Puck trail
    state.trail.forEach((p, index) => {
      const alpha = (1 - index / state.trail.length) * 0.22;
      ctx.fillStyle = `rgba(163,230,53,${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, PUCK_R * (1 - index * 0.05), 0, Math.PI * 2);
      ctx.fill();
    });

    // Puck
    ctx.save();
    ctx.shadowColor = '#a3e635';
    ctx.shadowBlur = 22;
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(state.puck.x, state.puck.y, PUCK_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(state.puck.x - 5, state.puck.y - 4, 4, 0, Math.PI * 2);
    ctx.arc(state.puck.x + 6, state.puck.y + 5, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawPaddle(state.left, '#22d3ee');
    drawPaddle(state.right, '#f472b6');

    state.particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 3, 3);
    });
    ctx.globalAlpha = 1;

    // Score
    ctx.fillStyle = 'rgba(226,232,240,0.9)';
    ctx.font = '900 40px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(state.scoreL), W / 2 - 70, 58);
    ctx.fillText(String(state.scoreR), W / 2 + 70, 58);
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,0.7)';
    ctx.fillText(state.mode === '1p' ? 'YOU' : 'PLAYER 1', W / 2 - 70, 74);
    ctx.fillText(state.mode === '1p' ? 'CPU' : 'PLAYER 2', W / 2 + 70, 74);

    if (state.serving > 0) {
      ctx.fillStyle = 'rgba(226,232,240,0.7)';
      ctx.font = '700 14px system-ui, sans-serif';
      ctx.fillText('Get ready…', W / 2, H / 2 + 5);
    }

    if (state.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${state.flash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  api.loop((dt) => {
    if (dt > 0 && api.canPlay()) update(dt);
    draw();
  });

  // Mode controls
  const tools = document.createElement('div');
  tools.className = 'board-tools';
  tools.style.cssText = 'position:absolute;top:8px;left:8px;z-index:3;flex-wrap:wrap;max-width:96%';
  tools.innerHTML = `
    <button class="board-btn is-active" type="button" data-mode="1p">vs CPU</button>
    <button class="board-btn" type="button" data-mode="2p">2 Players</button>
    <select class="ch-select" data-difficulty aria-label="CPU difficulty">
      <option value="1">Easy</option>
      <option value="2" selected>Medium</option>
      <option value="3">Hard</option>
    </select>`;
  api.area.appendChild(tools);
  tools.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      tools.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('is-active', b === btn));
      setMode(btn.dataset.mode);
    });
  });
  const diff = tools.querySelector('[data-difficulty]');
  diff.addEventListener('change', () => {
    state.difficulty = Number(diff.value);
    api.setStatus(`CPU difficulty: ${diff.options[diff.selectedIndex].text}`);
  });

  window.addEventListener('keydown', (event) => {
    if (!api.canPlay()) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (['w', 's', 'ArrowUp', 'ArrowDown'].includes(key)) {
      event.preventDefault();
      state.keys.add(key);
    }
  });
  window.addEventListener('keyup', (event) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    state.keys.delete(key);
  });

  let dragSide = null;
  api.stage.addEventListener('pointerdown', (event) => {
    if (!api.canPlay()) return;
    const pos = api.pointerPos(event);
    dragSide = pos.x < W / 2 ? 'left' : 'right';
    if (dragSide === 'right' && state.mode === '1p') dragSide = null;
    onDrag(event, dragSide);
  });
  api.stage.addEventListener('pointermove', (event) => {
    if (!api.canPlay() || !dragSide) return;
    onDrag(event, dragSide);
  });
  api.stage.addEventListener('pointerup', () => { dragSide = null; });
  api.stage.addEventListener('pointercancel', () => { dragSide = null; });

  function onDrag(event, side) {
    if (!side) return;
    const pos = api.pointerPos(event);
    if (side === 'left') {
      state.left.y = Math.max(TOP + PADDLE_R, Math.min(BOTTOM - PADDLE_R, pos.y));
    } else {
      state.right.y = Math.max(TOP + PADDLE_R, Math.min(BOTTOM - PADDLE_R, pos.y));
    }
  }

  resetMatch();
  return {
    start() { resetMatch(); },
    restart() { resetMatch(); },
  };
}
