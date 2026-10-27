/**
 * Pong — original implementation.
 * Single-player AI or two-player, first to seven, keyboard and touch.
 */

const W = 640;
const H = 420;
const PADDLE_W = 12;
const PADDLE_H = 74;
const WIN_SCORE = 7;

export default function createGame(api) {
  const { ctx } = api.initCanvas(W, H);
  api.setBestMode('higher');

  const state = {
    left: { y: H / 2, vy: 0 },
    right: { y: H / 2, vy: 0 },
    ball: { x: W / 2, y: H / 2, vx: 0, vy: 0, r: 7, speed: 330 },
    scoreL: 0,
    scoreR: 0,
    mode: '1p',
    keys: new Set(),
    over: false,
    time: 0,
    serveTimer: 0,
    trail: [],
    particles: [],
  };

  function resetBall(dir = 1) {
    state.ball.x = W / 2;
    state.ball.y = H / 2;
    const angle = (Math.random() - 0.5) * 0.6;
    state.ball.speed = 330;
    state.ball.vx = Math.cos(angle) * state.ball.speed * dir;
    state.ball.vy = Math.sin(angle) * state.ball.speed;
    state.serveTimer = 0.7;
  }

  function resetMatch() {
    state.left.y = H / 2;
    state.right.y = H / 2;
    state.scoreL = 0;
    state.scoreR = 0;
    state.over = false;
    state.keys.clear();
    state.trail = [];
    state.particles = [];
    resetBall(Math.random() > 0.5 ? 1 : -1);
    api.setScore(0, 'Score');
    api.setStatus('First to 7 points wins');
  }

  function setMode(mode) {
    state.mode = mode;
    resetMatch();
    api.setStatus(mode === '1p' ? 'Single player — use W/S or the mouse' : 'Two players — W/S vs arrow keys');
  }

  function update(dt) {
    if (state.over) return;
    state.time += dt;
    if (state.serveTimer > 0) state.serveTimer -= dt;

    const speed = 430;
    if (state.keys.has('w')) state.left.y -= speed * dt;
    if (state.keys.has('s')) state.left.y += speed * dt;
    if (state.mode === '2p') {
      if (state.keys.has('ArrowUp')) state.right.y -= speed * dt;
      if (state.keys.has('ArrowDown')) state.right.y += speed * dt;
    } else {
      // AI: track the ball with a speed limit and a little error.
      const target = state.ball.y + Math.sin(state.time * 2.2) * 16;
      const aiSpeed = 330;
      const diff = target - state.right.y;
      state.right.y += Math.max(-aiSpeed * dt, Math.min(aiSpeed * dt, diff));
    }
    state.left.y = Math.max(PADDLE_H / 2 + 6, Math.min(H - PADDLE_H / 2 - 6, state.left.y));
    state.right.y = Math.max(PADDLE_H / 2 + 6, Math.min(H - PADDLE_H / 2 - 6, state.right.y));

    if (state.serveTimer <= 0) {
      const ball = state.ball;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); api.sfx('click'); }
      if (ball.y + ball.r > H) { ball.y = H - ball.r; ball.vy = -Math.abs(ball.vy); api.sfx('click'); }

      // Left paddle
      if (
        ball.vx < 0
        && ball.x - ball.r <= PADDLE_W + 14
        && ball.x - ball.r >= PADDLE_W - 4
        && ball.y > state.left.y - PADDLE_H / 2 - 6
        && ball.y < state.left.y + PADDLE_H / 2 + 6
      ) {
        const offset = (ball.y - state.left.y) / (PADDLE_H / 2);
        ball.vx = Math.abs(ball.vx) * 1.045;
        ball.vy = offset * ball.vx * 0.85 + ball.vy * 0.25;
        ball.x = PADDLE_W + 14 + ball.r;
        ball.speed = Math.hypot(ball.vx, ball.vy);
        spawn(ball.x, ball.y, '#22d3ee', 7);
        api.sfx('click');
      }
      // Right paddle
      if (
        ball.vx > 0
        && ball.x + ball.r >= W - PADDLE_W - 14
        && ball.x + ball.r <= W - PADDLE_W + 4
        && ball.y > state.right.y - PADDLE_H / 2 - 6
        && ball.y < state.right.y + PADDLE_H / 2 + 6
      ) {
        const offset = (ball.y - state.right.y) / (PADDLE_H / 2);
        ball.vx = -Math.abs(ball.vx) * 1.045;
        ball.vy = offset * Math.abs(ball.vx) * 0.85 + ball.vy * 0.25;
        ball.x = W - PADDLE_W - 14 - ball.r;
        ball.speed = Math.hypot(ball.vx, ball.vy);
        spawn(ball.x, ball.y, '#f472b6', 7);
        api.sfx('click');
      }

      state.trail.unshift({ x: ball.x, y: ball.y });
      if (state.trail.length > 9) state.trail.pop();
      state.particles.forEach((p) => { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; });
      state.particles = state.particles.filter((p) => p.life > 0);
      if (ball.x < -30) {
        spawn(20, ball.y, '#f472b6', 20);
        state.scoreR += 1;
        api.setScore(`${state.scoreL} – ${state.scoreR}`, 'Match');
        api.sfx('score');
        if (state.scoreR >= WIN_SCORE) endMatch('ai');
        else resetBall(1);
      } else if (ball.x > W + 30) {
        spawn(W - 20, ball.y, '#22d3ee', 20);
        state.scoreL += 1;
        api.setScore(`${state.scoreL} – ${state.scoreR}`, 'Match');
        api.sfx('score');
        if (state.scoreL >= WIN_SCORE) endMatch('player');
        else resetBall(-1);
      }
    }
  }

  function endMatch(winner) {
    state.over = true;
    const won = winner === 'player';
    const options = {
      score: state.scoreL * 100 + state.scoreR,
      title: won ? 'You win the match!' : 'The computer wins',
      message: `Final score ${state.scoreL} – ${state.scoreR}. First to ${WIN_SCORE} takes the match.`,
    };
    if (won) api.win(options);
    else api.gameOver(options);
  }

  function spawn(x, y, color, count = 8) {
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const v = 40 + Math.random() * 180;
      state.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.35 + Math.random() * 0.35, color });
    }
  }

  function draw() {
    ctx.fillStyle = '#05070f';
    ctx.fillRect(0, 0, W, H);
    const grad = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.7);
    grad.addColorStop(0, 'rgba(34,211,238,0.08)');
    grad.addColorStop(1, 'rgba(139,92,246,0.02)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Center line
    ctx.strokeStyle = 'rgba(148,163,184,0.25)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 14]);
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
    ctx.setLineDash([]);

    // Scores
    ctx.fillStyle = 'rgba(226,232,240,0.85)';
    ctx.font = '900 54px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(state.scoreL), W / 2 - 80, 74);
    ctx.fillText(String(state.scoreR), W / 2 + 80, 74);
    ctx.fillStyle = 'rgba(148,163,184,0.5)';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillText(state.mode === '1p' ? 'YOU' : 'PLAYER 1', W / 2 - 80, 96);
    ctx.fillText(state.mode === '1p' ? 'CPU' : 'PLAYER 2', W / 2 + 80, 96);

    // Paddles
    ctx.fillStyle = '#22d3ee';
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(14, state.left.y - PADDLE_H / 2, PADDLE_W, PADDLE_H, 5);
    else ctx.rect(14, state.left.y - PADDLE_H / 2, PADDLE_W, PADDLE_H);
    ctx.fill();
    ctx.fillStyle = '#f472b6';
    ctx.shadowColor = '#f472b6';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(W - PADDLE_W - 14, state.right.y - PADDLE_H / 2, PADDLE_W, PADDLE_H, 5);
    else ctx.rect(W - PADDLE_W - 14, state.right.y - PADDLE_H / 2, PADDLE_W, PADDLE_H);
    ctx.fill();

    // Ball trail
    state.trail.forEach((p, i) => {
      ctx.globalAlpha = (1 - i / state.trail.length) * 0.2;
      ctx.fillStyle = '#a3e635';
      ctx.beginPath();
      ctx.arc(p.x, p.y, state.ball.r * (1 - i * 0.06), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    state.particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 3, 3);
    });
    ctx.globalAlpha = 1;

    // Ball
    ctx.fillStyle = '#f8fafc';
    ctx.shadowColor = '#a3e635';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(state.ball.x, state.ball.y, state.ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    if (state.serveTimer > 0) {
      ctx.fillStyle = 'rgba(226,232,240,0.65)';
      ctx.font = '700 14px system-ui, sans-serif';
      ctx.fillText('Get ready…', W / 2, H - 26);
    }

    ctx.fillStyle = 'rgba(148,163,184,0.5)';
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(state.mode === '1p' ? 'W / S or mouse' : 'W / S · ↑ / ↓', 14, H - 14);
    ctx.textAlign = 'right';
    ctx.fillText(state.mode === '1p' ? 'CPU' : 'ARROWS', W - 14, H - 14);
  }

  api.loop((dt) => {
    if (dt > 0 && api.canPlay()) update(dt);
    draw();
  });

  const keys = state.keys;
  window.addEventListener('keydown', (event) => {
    if (!api.canPlay()) return;
    if (['ArrowUp', 'ArrowDown'].includes(event.key) && state.mode === '2p') {
      event.preventDefault();
    }
    keys.add(event.key.length === 1 ? event.key.toLowerCase() : event.key);
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key);
  });

  api.stage.addEventListener('pointermove', (event) => {
    if (!api.canPlay()) return;
    const pos = api.pointerPos(event);
    if (state.mode === '2p') {
      if (pos.x < W / 2) state.left.y = pos.y;
      else state.right.y = pos.y;
    } else {
      state.left.y = pos.y;
    }
  });

  // Mode toggle in the stage corner
  const tools = document.createElement('div');
  tools.className = 'board-tools';
  tools.style.cssText = 'position:absolute;top:8px;left:50%;transform:translateX(-50%);z-index:3';
  tools.innerHTML = `
    <button class="board-btn is-active" type="button" data-mode="1p">1 Player</button>
    <button class="board-btn" type="button" data-mode="2p">2 Players</button>`;
  tools.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      tools.querySelectorAll('button').forEach((b) => b.classList.toggle('is-active', b === btn));
      api.sfx('click');
      setMode(btn.dataset.mode);
    });
  });
  api.area.appendChild(tools);

  resetMatch();
  return {
    start() { resetMatch(); },
    restart() { resetMatch(); },
  };
}
