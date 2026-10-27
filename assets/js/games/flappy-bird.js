/**
 * Flappy Bird — original implementation.
 * One-button physics, parallax sky, pipe scoring and medals.
 */

const W = 360;
const H = 560;
const GROUND = 74;
const BIRD_X = 96;
const BIRD_R = 14;

export default function createGame(api) {
  const { ctx } = api.initCanvas(W, H);
  api.setBestMode('higher');

  const state = {
    bird: { y: H * 0.42, vy: 0, rot: 0, wing: 0 },
    pipes: [],
    clouds: [],
    score: 0,
    started: false,
    dead: false,
    speed: 132,
    gap: 152,
    spawnTimer: 0,
    groundX: 0,
    time: 0,
    medal: '',
  };

  function reset() {
    state.bird = { y: H * 0.42, vy: 0, rot: 0, wing: 0 };
    state.pipes = [];
    state.score = 0;
    state.started = false;
    state.dead = false;
    state.speed = 132;
    state.gap = 152;
    state.spawnTimer = 0;
    state.groundX = 0;
    state.time = 0;
    state.medal = '';
    state.clouds = Array.from({ length: 6 }, (_, i) => ({
      x: Math.random() * W,
      y: 40 + Math.random() * 220,
      s: 0.5 + Math.random() * 0.8,
      v: 8 + Math.random() * 14,
      layer: i % 2,
    }));
    api.setScore(0, 'Score');
    api.setStatus('Tap or press Space to flap');
  }

  function flap() {
    if (!api.canPlay() || state.dead) return;
    if (!state.started) state.started = true;
    state.bird.vy = -405;
    state.bird.wing = 1;
    api.sfx('jump');
  }

  function spawnPipe() {
    const margin = 74;
    const gapY = margin + Math.random() * (H - GROUND - margin * 2 - state.gap);
    state.pipes.push({ x: W + 30, gapY, gapH: state.gap, scored: false });
  }

  function die() {
    if (state.dead) return;
    state.dead = true;
    api.sfx('hit');
    const medal = state.score >= 40 ? 'Platinum' : state.score >= 30 ? 'Gold' : state.score >= 20 ? 'Silver' : state.score >= 10 ? 'Bronze' : '';
    state.medal = medal;
    api.gameOver({
      score: state.score,
      title: medal ? `${medal} medal!` : 'You hit a pipe',
      message: medal
        ? `${state.score} points and a ${medal.toLowerCase()} medal. Nice flying.`
        : `${state.score} points. Stay level with the middle of the gap.`,
    });
  }

  function update(dt) {
    state.time += dt;
    state.bird.wing = Math.max(0, state.bird.wing - dt * 4);

    if (!state.started) {
      state.bird.y = H * 0.42 + Math.sin(state.time * 3) * 6;
      state.groundX = (state.groundX - 30 * dt) % 36;
      return;
    }

    state.bird.vy += 1320 * dt;
    state.bird.y += state.bird.vy * dt;
    state.bird.rot = Math.max(-0.5, Math.min(1.1, state.bird.vy / 700));

    state.speed = Math.min(230, state.speed + dt * 1.7);
    state.spawnTimer += dt * 1000;
    const interval = Math.max(1180, 1550 - state.score * 9);
    if (state.spawnTimer >= interval) {
      state.spawnTimer = 0;
      spawnPipe();
    }

    state.pipes.forEach((pipe) => {
      pipe.x -= state.speed * dt;
      if (!pipe.scored && pipe.x + 62 < BIRD_X) {
        pipe.scored = true;
        state.score += 1;
        api.setScore(state.score, 'Score');
        api.sfx('score');
      }
    });
    state.pipes = state.pipes.filter((pipe) => pipe.x > -90);

    // Collision with pipes
    const bx = BIRD_X;
    const by = state.bird.y;
    for (const pipe of state.pipes) {
      const inX = bx + BIRD_R > pipe.x && bx - BIRD_R < pipe.x + 62;
      if (!inX) continue;
      const inGap = by - BIRD_R > pipe.gapY && by + BIRD_R < pipe.gapY + pipe.gapH;
      if (!inGap) {
        die();
        return;
      }
    }
    if (by + BIRD_R >= H - GROUND) {
      state.bird.y = H - GROUND - BIRD_R;
      die();
      return;
    }
    if (by - BIRD_R <= 0) {
      state.bird.y = BIRD_R;
      state.bird.vy = 0;
    }

    state.groundX = (state.groundX - state.speed * dt) % 36;
  }

  function draw() {
    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#0ea5e9');
    sky.addColorStop(0.55, '#38bdf8');
    sky.addColorStop(1, '#bae6fd');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Sun
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#fef9c3';
    ctx.beginPath();
    ctx.arc(W - 70, 78, 38, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Clouds
    state.clouds.forEach((cloud) => {
      cloud.x -= cloud.v * (state.started ? 1 : 0.35) * (1 / 60);
      if (cloud.x < -90) {
        cloud.x = W + 80;
        cloud.y = 40 + Math.random() * 220;
      }
      ctx.save();
      ctx.globalAlpha = cloud.layer ? 0.55 : 0.8;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(cloud.x, cloud.y, 34 * cloud.s, 16 * cloud.s, 0, 0, Math.PI * 2);
      ctx.ellipse(cloud.x + 26 * cloud.s, cloud.y + 3, 24 * cloud.s, 13 * cloud.s, 0, 0, Math.PI * 2);
      ctx.ellipse(cloud.x - 26 * cloud.s, cloud.y + 4, 22 * cloud.s, 12 * cloud.s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Distant hills
    ctx.fillStyle = 'rgba(16, 185, 129, 0.28)';
    for (let i = 0; i < 4; i += 1) {
      const x = ((i * 130 - state.groundX * 0.4) % (W + 200)) - 100;
      ctx.beginPath();
      ctx.moveTo(x - 80, H - GROUND);
      ctx.quadraticCurveTo(x, H - GROUND - 110, x + 80, H - GROUND);
      ctx.fill();
    }

    // Pipes
    state.pipes.forEach((pipe) => {
      const cap = 22;
      const grad = ctx.createLinearGradient(pipe.x, 0, pipe.x + 62, 0);
      grad.addColorStop(0, '#15803d');
      grad.addColorStop(0.42, '#4ade80');
      grad.addColorStop(1, '#166534');
      ctx.fillStyle = grad;
      ctx.strokeStyle = '#14532d';
      ctx.lineWidth = 2;
      // top
      ctx.fillRect(pipe.x, 0, 62, pipe.gapY - cap);
      ctx.strokeRect(pipe.x, 0, 62, pipe.gapY - cap);
      ctx.fillRect(pipe.x - 7, pipe.gapY - cap, 76, cap);
      ctx.strokeRect(pipe.x - 7, pipe.gapY - cap, 76, cap);
      // bottom
      const by = pipe.gapY + pipe.gapH;
      ctx.fillRect(pipe.x, by + cap, 62, H - GROUND - by - cap);
      ctx.strokeRect(pipe.x, by + cap, 62, H - GROUND - by - cap);
      ctx.fillRect(pipe.x - 7, by, 76, cap);
      ctx.strokeRect(pipe.x - 7, by, 76, cap);
    });

    // Ground
    ctx.fillStyle = '#a16207';
    ctx.fillRect(0, H - GROUND, W, GROUND);
    ctx.fillStyle = '#84cc16';
    ctx.fillRect(0, H - GROUND, W, 14);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let x = state.groundX - 36; x < W + 36; x += 36) {
      ctx.fillRect(x, H - GROUND + 20, 18, 6);
      ctx.fillRect(x + 8, H - GROUND + 44, 18, 6);
    }

    // Bird
    const bx = BIRD_X;
    const by = state.bird.y;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(state.bird.rot);
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.ellipse(0, 0, BIRD_R + 3, BIRD_R, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fb923c';
    ctx.beginPath();
    ctx.ellipse(-2, 3, BIRD_R - 2, BIRD_R - 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // wing
    const wing = state.bird.wing > 0 ? -8 : 4;
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.ellipse(-4, wing, 9, 6, 0.3, 0, Math.PI * 2);
    ctx.fill();
    // eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(7, -5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(8.5, -5, 2.4, 0, Math.PI * 2);
    ctx.fill();
    // beak
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(13, 0);
    ctx.lineTo(25, 3);
    ctx.lineTo(13, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Pipe gap guides in the first seconds
    if (!state.started) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
      ctx.font = '800 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('READY?', W / 2, H * 0.28);
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.fillText('Tap, click or press Space', W / 2, H * 0.28 + 24);
    }

    if (state.score > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = '900 54px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(15,23,42,0.45)';
      ctx.lineWidth = 5;
      ctx.strokeText(String(state.score), W / 2, 78);
      ctx.fillText(String(state.score), W / 2, 78);
    }
    if (state.medal) {
      ctx.fillStyle = '#fef08a';
      ctx.font = '800 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(state.medal.toUpperCase(), W / 2, 106);
    }
  }

  api.loop((dt, now) => {
    if (dt > 0) update(dt);
    draw();
  });

  function onKey(event) {
    if (!api.canPlay()) return;
    if (event.key === ' ' || event.key === 'Spacebar' || event.code === 'Space' || event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') {
      event.preventDefault();
      flap();
    }
  }
  window.addEventListener('keydown', onKey);

  const tap = (event) => {
    if (!api.canPlay()) return;
    if (event.type === 'pointerdown' && event.button !== undefined && event.button !== 0) return;
    flap();
  };
  api.stage.addEventListener('pointerdown', tap);

  reset();
  return {
    start() { reset(); },
    restart() { reset(); },
  };
}
