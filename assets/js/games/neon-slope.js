/**
 * Neon Slope — original pseudo-3D endless runner.
 * Perspective-projected track, three lanes, jumpable barriers and rising speed.
 */

const W = 480;
const H = 640;
const HORIZON = H * 0.36;
const F = 320;
const CAM_Y = 10;
const NEAR_Z = 9;
const FAR_Z = 110;
const ROAD_HALF = 4.5;
const LANES = [-3, 0, 3];

export default function createGame(api) {
  const { ctx } = api.initCanvas(W, H);
  api.setBestMode('higher');

  const state = {
    distance: 0,
    speed: 15,
    lane: 1,
    playerX: 0,
    playerY: 0,
    vy: 0,
    jumping: false,
    obstacles: [],
    nextSpawn: 26,
    dead: false,
    time: 0,
    trail: [],
  };

  const curve = (z) => Math.sin((state.distance + z) * 0.025) * 2.2 + Math.sin((state.distance + z) * 0.011) * 1.2;

  const project = (x, y, z) => {
    const scale = F / Math.max(1, z);
    return {
      x: W / 2 + (x + curve(z)) * scale,
      y: HORIZON + (CAM_Y - y) * scale,
      scale,
    };
  };

  function reset() {
    state.distance = 0;
    state.speed = 15;
    state.lane = 1;
    state.playerX = LANES[1];
    state.playerY = 0;
    state.vy = 0;
    state.jumping = false;
    state.obstacles = [];
    state.nextSpawn = 24;
    state.dead = false;
    state.time = 0;
    state.trail = [];
    api.setScore(0, 'Distance');
    api.setStatus('← → steer · Space jump · look far ahead');
  }

  function spawnPattern() {
    const zWorld = state.distance + 78;
    const roll = Math.random();
    if (roll < 0.4) {
      // One tall block in a random lane.
      state.obstacles.push({ z: zWorld, lane: Math.floor(Math.random() * 3), type: 'tall' });
    } else if (roll < 0.68) {
      // Two tall blocks, one free lane.
      const free = Math.floor(Math.random() * 3);
      for (let lane = 0; lane < 3; lane += 1) {
        if (lane !== free) state.obstacles.push({ z: zWorld, lane, type: 'tall' });
      }
    } else if (roll < 0.88) {
      // A low barrier you can jump over.
      state.obstacles.push({ z: zWorld, lane: Math.floor(Math.random() * 3), type: 'low' });
    } else {
      // Staggered blockers.
      const first = Math.floor(Math.random() * 3);
      state.obstacles.push({ z: zWorld, lane: first, type: 'tall' });
      state.obstacles.push({ z: zWorld + 5.5, lane: (first + 1 + Math.floor(Math.random() * 2)) % 3, type: 'low' });
    }
    state.nextSpawn = state.distance + 12 + Math.random() * 10;
  }

  function update(dt) {
    if (state.dead) return;
    state.time += dt;
    state.speed = Math.min(42, 15 + state.distance * 0.045);
    state.distance += state.speed * dt;
    api.setScore(Math.floor(state.distance), 'Distance');

    // Steer toward the selected lane.
    const target = LANES[state.lane];
    const dx = target - state.playerX;
    state.playerX += Math.max(-16 * dt, Math.min(16 * dt, dx));

    // Jump
    if (state.jumping) {
      state.vy -= 34 * dt;
      state.playerY += state.vy * dt;
      if (state.playerY <= 0) {
        state.playerY = 0;
        state.vy = 0;
        state.jumping = false;
      }
    }

    // Spawn
    if (state.distance >= state.nextSpawn) spawnPattern();

    // Collisions
    for (const obstacle of state.obstacles) {
      const z = obstacle.z - state.distance + NEAR_Z;
      if (z < 8.6 || z > 10.2) continue;
      const laneX = LANES[obstacle.lane];
      if (Math.abs(laneX - state.playerX) < 1.55) {
        if (obstacle.type === 'low' && state.playerY > 0.95) continue;
        state.dead = true;
        api.sfx('hit');
        api.gameOver({
          score: Math.floor(state.distance),
          title: 'Run ended',
          message: `${Math.floor(state.distance)} m at ${Math.round(state.speed * 3.6)} km/h. Look farther down the track.`,
        });
        return;
      }
    }

    state.obstacles = state.obstacles.filter((obstacle) => obstacle.z - state.distance + NEAR_Z > 6);

    state.trail.unshift({ x: state.playerX, y: state.playerY, life: 1 });
    if (state.trail.length > 12) state.trail.pop();
    state.trail.forEach((point) => { point.life -= dt * 2.4; });
  }

  function drawRoad() {
    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON + 60);
    sky.addColorStop(0, '#07021a');
    sky.addColorStop(0.6, '#160a33');
    sky.addColorStop(1, '#2a1052');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, HORIZON + 60);

    // Stars
    for (let i = 0; i < 60; i += 1) {
      const x = ((i * 97 + state.distance * 2) % (W + 40)) - 20;
      const y = (i * 53) % HORIZON;
      ctx.globalAlpha = 0.25 + ((i * 7) % 10) / 20;
      ctx.fillStyle = i % 5 === 0 ? '#22d3ee' : '#e2e8f0';
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;

    // Sun / horizon glow
    const glow = ctx.createRadialGradient(W / 2, HORIZON, 8, W / 2, HORIZON, 190);
    glow.addColorStop(0, 'rgba(236, 72, 153, 0.5)');
    glow.addColorStop(0.5, 'rgba(139, 92, 246, 0.2)');
    glow.addColorStop(1, 'rgba(139, 92, 246, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, HORIZON + 100);

    // Road surface
    const leftFar = project(-ROAD_HALF, 0, FAR_Z);
    const rightFar = project(ROAD_HALF, 0, FAR_Z);
    const leftNear = project(-ROAD_HALF, 0, NEAR_Z);
    const rightNear = project(ROAD_HALF, 0, NEAR_Z);
    const roadGrad = ctx.createLinearGradient(0, HORIZON, 0, H);
    roadGrad.addColorStop(0, '#14082e');
    roadGrad.addColorStop(1, '#1b0b3d');
    ctx.fillStyle = roadGrad;
    ctx.beginPath();
    ctx.moveTo(leftFar.x, leftFar.y);
    ctx.lineTo(rightFar.x, rightFar.y);
    ctx.lineTo(rightNear.x, rightNear.y);
    ctx.lineTo(leftNear.x, leftNear.y);
    ctx.closePath();
    ctx.fill();

    // Lane lines
    for (const laneX of [-1.5, 1.5]) {
      const far = project(laneX, 0, FAR_Z);
      const near = project(laneX, 0, NEAR_Z);
      const grad = ctx.createLinearGradient(far.x, far.y, near.x, near.y);
      grad.addColorStop(0, 'rgba(34, 211, 238, 0.1)');
      grad.addColorStop(1, 'rgba(34, 211, 238, 0.8)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(far.x, far.y);
      ctx.lineTo(near.x, near.y);
      ctx.stroke();
    }

    // Horizontal grid lines with perspective
    const offset = state.distance % 8;
    for (let z = NEAR_Z + (8 - offset); z < FAR_Z; z += 8) {
      const l = project(-ROAD_HALF, 0, z);
      const r = project(ROAD_HALF, 0, z);
      const alpha = Math.max(0, 0.5 - z / (FAR_Z * 1.6));
      ctx.strokeStyle = `rgba(168, 85, 247, ${alpha})`;
      ctx.lineWidth = Math.max(1, 5 / z);
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(r.x, r.y);
      ctx.stroke();
    }

    // Road edge glow
    [-ROAD_HALF, ROAD_HALF].forEach((edge) => {
      const far = project(edge, 0, FAR_Z);
      const near = project(edge, 0, NEAR_Z);
      ctx.strokeStyle = 'rgba(236, 72, 153, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(far.x, far.y);
      ctx.lineTo(near.x, near.y);
      ctx.stroke();
    });
  }

  function drawObstacle(obstacle) {
    const z = obstacle.z - state.distance + NEAR_Z;
    if (z < NEAR_Z - 1 || z > FAR_Z) return;
    const laneX = LANES[obstacle.lane];
    const halfW = 1.25;
    const height = obstacle.type === 'tall' ? 2.3 : 0.75;
    const base = project(laneX, 0, z);
    const top = project(laneX, height, z);
    const width = (halfW * 2) * (F / z);
    const w = Math.max(4, width);
    const h = Math.max(3, base.y - top.y);
    const x = base.x - w / 2;
    const y = top.y;
    const color = obstacle.type === 'tall' ? '#f43f5e' : '#22d3ee';
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = Math.min(24, 14 * (NEAR_Z / z));
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(10, 10, 30, 0.8)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
    // front stripe
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x + 2, y + 2, w - 4, Math.max(2, h * 0.12));
    ctx.restore();
  }

  function drawPlayer() {
    const z = NEAR_Z + 0.6;
    const base = project(state.playerX, state.playerY + 0.55, z);
    const radius = Math.max(7, 0.55 * (F / z));
    // trail
    state.trail.forEach((point, index) => {
      if (point.life <= 0) return;
      const p = project(point.x, point.y + 0.5, z + index * 0.12);
      ctx.globalAlpha = Math.max(0, point.life * 0.16);
      ctx.fillStyle = '#a3e635';
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius * (1 - index * 0.04), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.shadowColor = '#a3e635';
    ctx.shadowBlur = 28;
    const grad = ctx.createRadialGradient(base.x - radius * 0.3, base.y - radius * 0.35, radius * 0.15, base.x, base.y, radius);
    grad.addColorStop(0, '#f7fee7');
    grad.addColorStop(0.45, '#a3e635');
    grad.addColorStop(1, '#3f6212');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(base.x, base.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // shadow on the track
    const shadow = project(state.playerX, 0, z);
    const shadowScale = Math.max(0.35, 1 - state.playerY * 0.4);
    ctx.fillStyle = `rgba(0,0,0,${0.35 * shadowScale})`;
    ctx.beginPath();
    ctx.ellipse(shadow.x, shadow.y, radius * shadowScale, radius * 0.35 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHud() {
    ctx.fillStyle = '#f8fafc';
    ctx.font = '900 20px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.floor(state.distance)} m`, 18, 34);
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,0.8)';
    ctx.fillText(`${Math.round(state.speed * 3.6)} km/h`, 18, 52);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(163,230,53,0.8)';
    ctx.fillText(api.isTouch ? 'SWIPE TO STEER' : '← → STEER · SPACE JUMP', W - 18, 34);
  }

  api.loop((dt) => {
    if (dt > 0 && api.canPlay()) update(dt);
    drawRoad();
    state.obstacles
      .slice()
      .sort((a, b) => b.z - a.z)
      .forEach(drawObstacle);
    drawPlayer();
    drawHud();
  });

  function steer(direction) {
    if (!api.canPlay() || state.dead) return;
    state.lane = Math.max(0, Math.min(2, state.lane + direction));
    api.sfx('click');
  }

  function jump() {
    if (!api.canPlay() || state.dead) return;
    if (state.jumping) return;
    state.jumping = true;
    state.vy = 11.5;
    api.sfx('jump');
  }

  function onKey(event) {
    if (!api.canPlay()) return;
    if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') { event.preventDefault(); steer(-1); }
    else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') { event.preventDefault(); steer(1); }
    else if (event.key === ' ' || event.key === 'Spacebar' || event.code === 'Space' || event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') {
      event.preventDefault();
      jump();
    }
  }
  window.addEventListener('keydown', onKey);

  let start = null;
  api.stage.addEventListener('pointerdown', (event) => {
    start = { x: event.clientX, y: event.clientY };
  });
  api.stage.addEventListener('pointerup', (event) => {
    if (!start || !api.canPlay()) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
    if (Math.abs(dx) > Math.abs(dy)) steer(dx > 0 ? 1 : -1);
    else if (dy < 0) jump();
  });

  if (api.isTouch) {
    const row = document.createElement('div');
    row.className = 'touch-row';
    row.innerHTML = `
      <button class="touch-btn" type="button" aria-label="Steer left">◀</button>
      <button class="touch-btn" type="button" aria-label="Jump">⤒</button>
      <button class="touch-btn" type="button" aria-label="Steer right">▶</button>`;
    const [left, up, right] = row.querySelectorAll('button');
    left.addEventListener('pointerdown', (e) => { e.preventDefault(); steer(-1); });
    right.addEventListener('pointerdown', (e) => { e.preventDefault(); steer(1); });
    up.addEventListener('pointerdown', (e) => { e.preventDefault(); jump(); });
    api.addControls(row);
  }

  reset();
  return {
    start() { reset(); },
    restart() { reset(); },
  };
}
