/**
 * Stack Master — original one-button tower builder.
 * Perfect-drop combos, clipped overhangs, rising camera and particles.
 */

const W = 480;
const H = 640;
const BASE_Y = H - 88;
const BLOCK_H = 28;

export default function createGame(api) {
  const { ctx } = api.initCanvas(W, H);
  api.setBestMode('higher');

  const state = {
    blocks: [],
    width: 220,
    x: W / 2 - 110,
    dir: 1,
    camera: 0,
    speed: 210,
    combo: 0,
    score: 0,
    dead: false,
    particles: [],
    flash: 0,
    time: 0,
  };

  function reset() {
    state.blocks = [];
    state.width = 220;
    state.x = W / 2 - 110;
    state.dir = 1;
    state.camera = 0;
    state.speed = 210;
    state.combo = 0;
    state.score = 0;
    state.dead = false;
    state.particles = [];
    state.flash = 0;
    state.time = 0;
    state.blocks.push({ x: W / 2 - 110, w: 220, level: 0 });
    api.setScore(0, 'Score');
    api.setStatus('Tap, click or press Space to drop the block');
  }

  function currentLevel() {
    return state.blocks.length;
  }

  function currentY() {
    return BASE_Y - currentLevel() * BLOCK_H + state.camera;
  }

  function drop() {
    if (!api.canPlay() || state.dead) return;
    const prev = state.blocks[state.blocks.length - 1];
    const curLeft = state.x;
    const curRight = state.x + state.width;
    const prevLeft = prev.x;
    const prevRight = prev.x + prev.w;
    const left = Math.max(curLeft, prevLeft);
    const right = Math.min(curRight, prevRight);
    const overlap = right - left;
    if (overlap <= 2) {
      state.dead = true;
      api.sfx('lose');
      api.gameOver({
        score: state.score,
        title: 'The tower toppled',
        message: `${state.blocks.length - 1} blocks placed with a ${state.combo > 0 ? `${state.combo}-drop perfect streak` : 'best effort'}.`,
      });
      return;
    }
    const perfect = Math.abs(curLeft - prevLeft) < 3.5;
    let newBlock;
    if (perfect) {
      newBlock = { x: prev.x, w: prev.w, level: currentLevel() };
      state.combo += 1;
      state.score += 1 + state.combo;
      state.flash = 0.3;
      spawnParticles(prev.x + prev.w / 2, currentY(), '#a3e635', 16);
      api.sfx('win');
      api.setStatus(`Perfect! ×${state.combo}`);
    } else {
      newBlock = { x: left, w: overlap, level: currentLevel() };
      state.combo = 0;
      state.score += 1;
      state.width = overlap;
      state.x = left;
      const cut = Math.max(0, curLeft - left) + Math.max(0, right - curRight);
      spawnParticles(curLeft < prevLeft ? curLeft : curRight, currentY(), '#f43f5e', Math.min(22, 8 + cut / 8));
      api.sfx('hit');
      api.setStatus(`${Math.round(overlap)} px landed`);
    }
    state.blocks.push(newBlock);
    state.width = perfect ? prev.w : overlap;
    state.x = newBlock.x;
    state.dir = Math.random() > 0.5 ? 1 : -1;
    state.speed = Math.min(520, 210 + state.blocks.length * 8);
    api.setScore(state.score, 'Score');
    api.saveBest(state.score);
    api.setBestMode('higher');

    // Keep the newest block in view.
    const topY = BASE_Y - state.blocks.length * BLOCK_H + state.camera;
    if (topY < H * 0.3) state.camera += H * 0.3 - topY;
  }

  function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i += 1) {
      state.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 260,
        vy: -40 - Math.random() * 180,
        life: 0.5 + Math.random() * 0.5,
        max: 1,
        color,
      });
    }
  }

  function update(dt) {
    if (state.dead) return;
    state.time += dt;
    const y = currentY();
    state.x += state.dir * state.speed * dt;
    if (state.x < 24) {
      state.x = 24;
      state.dir = 1;
    } else if (state.x + state.width > W - 24) {
      state.x = W - 24 - state.width;
      state.dir = -1;
    }
    state.particles.forEach((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 620 * dt;
    });
    state.particles = state.particles.filter((p) => p.life > 0);
    state.flash = Math.max(0, state.flash - dt);
    return y;
  }

  function drawBlock(x, y, w, h, color, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    // top face
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 6, y - 6);
    ctx.lineTo(x + w + 6, y - 6);
    ctx.lineTo(x + w, y);
    ctx.closePath();
    ctx.fill();
    // right face
    ctx.fillStyle = 'rgba(0,0,0,0.24)';
    ctx.beginPath();
    ctx.moveTo(x + w, y);
    ctx.lineTo(x + w + 6, y - 6);
    ctx.lineTo(x + w + 6, y + h - 6);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fill();
    // highlight
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(x + 2, y + 2, w - 4, 3);
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.restore();
  }

  function draw() {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#080d1c');
    bg.addColorStop(0.55, '#101a33');
    bg.addColorStop(1, '#1b1035');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Background grid
    ctx.strokeStyle = 'rgba(148,163,184,0.06)';
    for (let i = 0; i < 14; i += 1) {
      ctx.beginPath();
      ctx.moveTo(0, i * 48 + ((state.camera * 0.15) % 48));
      ctx.lineTo(W, i * 48 + ((state.camera * 0.15) % 48));
      ctx.stroke();
    }

    const offset = state.camera;
    // Tower (draw from bottom to top)
    state.blocks.forEach((block, index) => {
      const y = BASE_Y - block.level * BLOCK_H + offset;
      if (y > H + 60 || y < -60) return;
      const hue = (index * 17 + 190) % 360;
      drawBlock(block.x, y, block.w, BLOCK_H, `hsl(${hue} 72% 58%)`);
    });

    // Moving block
    if (!state.dead) {
      const y = currentY();
      drawBlock(state.x, y, state.width, BLOCK_H, '#f8fafc', 0.96);
      ctx.strokeStyle = 'rgba(34,211,238,0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(state.x, y, state.width, BLOCK_H);
    }

    // Particles
    state.particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 5, 5);
    });
    ctx.globalAlpha = 1;

    if (state.flash > 0) {
      ctx.fillStyle = `rgba(163,230,53,${state.flash * 0.55})`;
      ctx.fillRect(0, 0, W, H);
    }

    // HUD
    ctx.fillStyle = '#f8fafc';
    ctx.font = '900 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(state.score), W / 2, 42);
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,0.8)';
    ctx.fillText('SCORE', W / 2, 58);
    if (state.combo > 0) {
      ctx.fillStyle = '#a3e635';
      ctx.font = '900 16px system-ui, sans-serif';
      ctx.fillText(`PERFECT ×${state.combo}`, W / 2, 84);
    }

    // Ground line
    ctx.strokeStyle = 'rgba(148,163,184,0.25)';
    ctx.beginPath();
    ctx.moveTo(30, BASE_Y + BLOCK_H + offset);
    ctx.lineTo(W - 30, BASE_Y + BLOCK_H + offset);
    ctx.stroke();
  }

  api.loop((dt) => {
    if (dt > 0 && api.canPlay()) update(dt);
    draw();
  });

  function onKey(event) {
    if (!api.canPlay()) return;
    if (event.key === ' ' || event.key === 'Spacebar' || event.code === 'Space') {
      event.preventDefault();
      drop();
    }
  }
  window.addEventListener('keydown', onKey);

  api.stage.addEventListener('pointerdown', (event) => {
    if (!api.canPlay()) return;
    event.preventDefault();
    drop();
  });

  reset();
  return {
    start() { reset(); },
    restart() { reset(); },
  };
}
