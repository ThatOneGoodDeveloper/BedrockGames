/**
 * Breakout — original brick breaker.
 * Neon visuals, multi-hit bricks, three power-ups, particles and levels.
 */

const W = 480;
const H = 620;
const PADDLE_Y = H - 42;

export default function createGame(api) {
  const { ctx } = api.initCanvas(W, H);
  api.setBestMode('higher');

  const state = {
    paddle: { x: W / 2, w: 92, h: 12 },
    balls: [],
    bricks: [],
    powerups: [],
    particles: [],
    score: 0,
    lives: 3,
    level: 1,
    launched: false,
    wideTimer: 0,
    slowTimer: 0,
    dead: false,
    shake: 0,
  };

  function buildBricks() {
    state.bricks = [];
    const cols = 9;
    const rows = 5 + Math.min(2, state.level - 1);
    const pad = 6;
    const margin = 22;
    const bw = (W - margin * 2 - pad * (cols - 1)) / cols;
    const bh = 22;
    const colors = ['#f43f5e', '#fb923c', '#facc15', '#4ade80', '#22d3ee', '#a78bfa', '#f472b6'];
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        state.bricks.push({
          x: margin + c * (bw + pad),
          y: 70 + r * (bh + pad),
          w: bw,
          h: bh,
          hp: state.level >= 3 && r < 2 ? 2 : 1,
          color: colors[r % colors.length],
          alive: true,
        });
      }
    }
  }

  function resetBall() {
    state.balls = [{
      x: state.paddle.x,
      y: PADDLE_Y - 12,
      vx: 0,
      vy: 0,
      r: 7,
      stuck: true,
    }];
    state.launched = false;
    state.powerups = [];
    state.wideTimer = 0;
    state.slowTimer = 0;
    state.paddle.w = 92;
  }

  function reset() {
    state.score = 0;
    state.lives = 3;
    state.level = 1;
    state.dead = false;
    state.particles = [];
    state.paddle.x = W / 2;
    api.setScore(0, 'Score');
    buildBricks();
    resetBall();
    api.setStatus('Move the paddle · Space or click to launch');
  }

  function nextLevel() {
    state.level += 1;
    state.paddle.x = W / 2;
    buildBricks();
    resetBall();
    api.setScore(state.score, 'Score');
    api.setStatus(`Level ${state.level}`);
    api.sfx('win');
  }

  function speedOf(ball) {
    return Math.hypot(ball.vx, ball.vy);
  }

  function setSpeed(ball, speed) {
    const current = speedOf(ball) || 1;
    ball.vx = (ball.vx / current) * speed;
    ball.vy = (ball.vy / current) * speed;
  }

  function launch() {
    if (!api.canPlay() || state.dead) return;
    const ball = state.balls[0];
    if (!ball || !ball.stuck) return;
    ball.stuck = false;
    const base = 300 + state.level * 14;
    ball.vx = (Math.random() > 0.5 ? 1 : -1) * 110;
    ball.vy = -base;
    setSpeed(ball, base);
    state.launched = true;
    api.sfx('jump');
  }

  function spawnParticles(x, y, color, count = 9) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 170;
      state.particles.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.4, max: 0.9, color,
      });
    }
  }

  function maybeDrop(x, y) {
    if (Math.random() > 0.14) return;
    const types = ['multi', 'wide', 'slow'];
    state.powerups.push({
      x, y, r: 10, vy: 105, type: types[Math.floor(Math.random() * types.length)],
    });
  }

  function hitBrick(brick) {
    brick.hp -= 1;
    if (brick.hp > 0) {
      brick.color = '#e2e8f0';
      api.sfx('click');
      return;
    }
    brick.alive = false;
    state.score += 10 * state.level;
    api.setScore(state.score, 'Score');
    spawnParticles(brick.x + brick.w / 2, brick.y + brick.h / 2, brick.color);
    maybeDrop(brick.x + brick.w / 2, brick.y + brick.h / 2);
    api.sfx('score');
    if (!state.bricks.some((b) => b.alive)) nextLevel();
  }

  function update(dt) {
    if (state.dead) return;
    if (state.wideTimer > 0) {
      state.wideTimer -= dt;
      if (state.wideTimer <= 0) state.paddle.w = 92;
    }
    if (state.slowTimer > 0) {
      state.slowTimer -= dt;
    }
    if (state.shake > 0) state.shake -= dt;

    state.paddle.x = Math.max(state.paddle.w / 2 + 4, Math.min(W - state.paddle.w / 2 - 4, state.paddle.x));

    state.balls.forEach((ball) => {
      if (ball.stuck) {
        ball.x = state.paddle.x;
        ball.y = PADDLE_Y - ball.r - 5;
        return;
      }
      const slow = state.slowTimer > 0 ? 0.72 : 1;
      ball.x += ball.vx * dt * slow;
      ball.y += ball.vy * dt * slow;

      if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); api.sfx('click'); }
      if (ball.x + ball.r > W) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); api.sfx('click'); }
      if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); api.sfx('click'); }

      // Paddle
      if (
        ball.vy > 0
        && ball.y + ball.r >= PADDLE_Y
        && ball.y - ball.r <= PADDLE_Y + state.paddle.h
        && ball.x > state.paddle.x - state.paddle.w / 2 - 4
        && ball.x < state.paddle.x + state.paddle.w / 2 + 4
      ) {
        const offset = (ball.x - state.paddle.x) / (state.paddle.w / 2);
        const speed = Math.max(320 + state.level * 12, speedOf(ball) * 1.02);
        const angle = offset * 1.05;
        ball.vx = Math.sin(angle) * speed;
        ball.vy = -Math.abs(Math.cos(angle) * speed);
        ball.y = PADDLE_Y - ball.r - 1;
        api.sfx('click');
      }

      // Bricks
      for (const brick of state.bricks) {
        if (!brick.alive) continue;
        if (
          ball.x + ball.r > brick.x
          && ball.x - ball.r < brick.x + brick.w
          && ball.y + ball.r > brick.y
          && ball.y - ball.r < brick.y + brick.h
        ) {
          const overlapX = Math.min(ball.x + ball.r - brick.x, brick.x + brick.w - (ball.x - ball.r));
          const overlapY = Math.min(ball.y + ball.r - brick.y, brick.y + brick.h - (ball.y - ball.r));
          if (overlapX < overlapY) ball.vx *= -1;
          else ball.vy *= -1;
          // Nudge the ball out of the brick to avoid double hits.
          if (overlapX < overlapY) ball.x += ball.vx > 0 ? overlapX : -overlapX;
          else ball.y += ball.vy > 0 ? overlapY : -overlapY;
          hitBrick(brick);
          break;
        }
      }
    });

    // Ball loss
    const lost = state.balls.filter((ball) => ball.y - ball.r > H + 20);
    if (lost.length) {
      state.balls = state.balls.filter((ball) => ball.y - ball.r <= H + 20);
      if (!state.balls.length) {
        state.lives -= 1;
        state.shake = 0.35;
        api.sfx('lose');
        if (state.lives <= 0) {
          state.dead = true;
          api.gameOver({
            score: state.score,
            title: 'Out of lives',
            message: `${state.score.toLocaleString()} points · Level ${state.level}. Catch the power-ups for a longer run.`,
          });
        } else {
          state.paddle.w = 92;
          state.paddle.x = W / 2;
          resetBall();
          state.powerups = [];
          api.setStatus(`${state.lives} ${state.lives === 1 ? 'life' : 'lives'} left — press Space to launch`);
        }
      }
    }

    // Power-ups
    state.powerups.forEach((p) => { p.y += p.vy * dt; });
    state.powerups = state.powerups.filter((p) => {
      const caught = p.y + p.r > PADDLE_Y && p.y - p.r < PADDLE_Y + 18
        && p.x > state.paddle.x - state.paddle.w / 2 - 8
        && p.x < state.paddle.x + state.paddle.w / 2 + 8;
      if (caught) {
        api.sfx('pickup');
        if (p.type === 'wide') {
          state.paddle.w = 142;
          state.wideTimer = 11;
        } else if (p.type === 'slow') {
          state.slowTimer = 8;
        } else {
          const source = state.balls[0];
          if (source) {
            [-0.45, 0.45].forEach((angle) => {
              const speed = Math.max(280, speedOf(source));
              state.balls.push({
                x: source.x, y: source.y,
                vx: Math.cos(angle) * speed * 0.8 + source.vx * 0.4,
                vy: -Math.abs(Math.sin(angle) * speed + source.vy * 0.3),
                r: 7, stuck: false,
              });
            });
          }
        }
        return false;
      }
      return p.y < H + 30;
    });

    // Particles
    state.particles.forEach((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 220 * dt;
    });
    state.particles = state.particles.filter((p) => p.life > 0);
  }

  function draw() {
    ctx.save();
    if (state.shake > 0) {
      ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
    }
    ctx.fillStyle = '#05070f';
    ctx.fillRect(-10, -10, W + 20, H + 20);
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(34, 211, 238, 0.07)');
    grad.addColorStop(1, 'rgba(168, 85, 247, 0.09)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Bricks
    state.bricks.forEach((brick) => {
      if (!brick.alive) return;
      ctx.fillStyle = brick.color;
      ctx.shadowColor = brick.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(brick.x, brick.y, brick.w, brick.h, 4);
      else ctx.rect(brick.x, brick.y, brick.w, brick.h);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(brick.x + 3, brick.y + 3, brick.w - 6, 3);
      if (brick.hp > 1) {
        ctx.strokeStyle = 'rgba(255,255,255,0.65)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(brick.x + 3, brick.y + 3, brick.w - 6, brick.h - 6);
      }
    });

    // Power-ups
    state.powerups.forEach((p) => {
      const color = p.type === 'wide' ? '#22d3ee' : p.type === 'slow' ? '#a3e635' : '#f472b6';
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#05070f';
      ctx.font = '800 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.type === 'wide' ? 'W' : p.type === 'slow' ? 'S' : 'M', p.x, p.y + 3.5);
    });

    // Particles
    state.particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 3, 3);
    });
    ctx.globalAlpha = 1;

    // Paddle
    const px = state.paddle.x - state.paddle.w / 2;
    const paddleGrad = ctx.createLinearGradient(px, 0, px + state.paddle.w, 0);
    paddleGrad.addColorStop(0, '#22d3ee');
    paddleGrad.addColorStop(0.5, '#a855f7');
    paddleGrad.addColorStop(1, '#22d3ee');
    ctx.fillStyle = paddleGrad;
    ctx.shadowColor = '#a855f7';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(px, PADDLE_Y, state.paddle.w, state.paddle.h, 6);
    else ctx.rect(px, PADDLE_Y, state.paddle.w, state.paddle.h);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Balls
    state.balls.forEach((ball) => {
      ctx.fillStyle = '#f8fafc';
      ctx.shadowColor = '#67e8f9';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // HUD
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '800 16px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${state.score.toLocaleString()}`, 16, 30);
    ctx.textAlign = 'right';
    ctx.fillText(`LEVEL ${state.level}`, W - 16, 30);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(226,232,240,0.55)';
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillText(`LIVES ${'●'.repeat(Math.max(0, state.lives))}`, W / 2, 30);

    if (!state.launched) {
      ctx.fillStyle = 'rgba(248,250,252,0.75)';
      ctx.font = '700 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Press Space or tap to launch', W / 2, PADDLE_Y - 42);
    }
    ctx.restore();
  }

  api.loop((dt) => {
    if (dt > 0 && api.canPlay()) update(dt);
    draw();
  });

  function movePaddleTo(x) {
    state.paddle.x = Math.max(state.paddle.w / 2 + 4, Math.min(W - state.paddle.w / 2 - 4, x));
  }

  function onKey(event) {
    if (!api.canPlay() || state.dead) return;
    const step = 36;
    if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
      event.preventDefault();
      movePaddleTo(state.paddle.x - step);
    } else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
      event.preventDefault();
      movePaddleTo(state.paddle.x + step);
    } else if (event.key === ' ' || event.key === 'Spacebar' || event.code === 'Space') {
      event.preventDefault();
      if (!state.launched) launch();
    }
  }
  window.addEventListener('keydown', onKey);

  let pointerActive = false;
  function onPointer(event) {
    if (!api.canPlay()) return;
    const pos = api.pointerPos(event);
    movePaddleTo(pos.x);
  }
  api.stage.addEventListener('pointerdown', (event) => {
    if (!api.canPlay()) return;
    pointerActive = true;
    if (!state.launched) launch();
    onPointer(event);
  });
  api.stage.addEventListener('pointermove', (event) => {
    if (!api.canPlay()) return;
    if (api.isTouch && !pointerActive) return;
    onPointer(event);
  });
  api.stage.addEventListener('pointerup', () => { pointerActive = false; });

  if (api.isTouch) {
    const row = document.createElement('div');
    row.className = 'touch-row';
    row.innerHTML = `
      <button class="touch-btn" type="button" aria-label="Move left">◀</button>
      <button class="touch-btn wide" type="button" aria-label="Launch">Launch</button>
      <button class="touch-btn" type="button" aria-label="Move right">▶</button>`;
    const [left, launchBtn, right] = row.querySelectorAll('button');
    left.addEventListener('pointerdown', (e) => { e.preventDefault(); movePaddleTo(state.paddle.x - 42); });
    right.addEventListener('pointerdown', (e) => { e.preventDefault(); movePaddleTo(state.paddle.x + 42); });
    launchBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); launch(); });
    api.addControls(row);
  }

  reset();
  return {
    start() { reset(); },
    restart() { reset(); },
  };
}
