/**
 * Space Invaders — original wave shooter.
 * Marching formation, destructible shields, UFO bonus and endless waves.
 */

const W = 640;
const H = 520;
const PLAYER_Y = H - 42;

export default function createGame(api) {
  const { ctx } = api.initCanvas(W, H);
  api.setBestMode('higher');

  const state = {
    player: { x: W / 2, w: 34, h: 18, cooldown: 0 },
    formation: { x: 90, y: 66, dir: 1, speed: 26 },
    aliens: [],
    bullets: [],
    enemyBullets: [],
    shields: [],
    stars: [],
    ufo: null,
    ufoTimer: 16,
    alienFireTimer: 0,
    score: 0,
    lives: 3,
    wave: 1,
    dead: false,
    time: 0,
    shake: 0,
  };

  const COLS = 9;
  const ROWS = 5;
  const SPACING_X = 46;
  const SPACING_Y = 36;

  function buildWave() {
    state.aliens = [];
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        state.aliens.push({ col: c, row: r, alive: true, type: r });
      }
    }
    state.formation.x = 78;
    state.formation.y = 64 + Math.min(4, state.wave - 1) * 8;
    state.formation.dir = 1;
    state.formation.speed = 24 + state.wave * 5;
    state.bullets = [];
    state.enemyBullets = [];
    state.alienFireTimer = 1.2;
    state.ufoTimer = 12 + Math.random() * 8;
  }

  function buildShields() {
    state.shields = [];
    const bunkerW = 66;
    const bunkerH = 40;
    const startX = (W - 4 * bunkerW - 3 * 42) / 2;
    for (let b = 0; b < 4; b += 1) {
      const bx = startX + b * (bunkerW + 42);
      const by = PLAYER_Y - 105;
      for (let r = 0; r < 4; r += 1) {
        for (let c = 0; c < 8; c += 1) {
          const corner = (r === 0 && (c === 0 || c === 7)) || (r === 1 && (c === 0 || c === 7));
          if (corner) continue;
          state.shields.push({
            x: bx + c * 8, y: by + r * 8, w: 8, h: 8, hp: 2, alive: true,
          });
        }
      }
    }
  }

  function reset() {
    state.score = 0;
    state.lives = 3;
    state.wave = 1;
    state.dead = false;
    state.player.x = W / 2;
    state.player.cooldown = 0;
    state.ufo = null;
    state.particles = [];
    state.stars = Array.from({ length: 70 }, () => ({
      x: Math.random() * W,
      y: Math.random() * (H - 60),
      s: Math.random() * 1.6 + 0.3,
      tw: Math.random() * Math.PI * 2,
    }));
    api.setScore(0, 'Score');
    buildShields();
    buildWave();
    api.setStatus('← → move · Space fire · protect the shields');
  }

  function alienPos(alien) {
    return {
      x: state.formation.x + alien.col * SPACING_X,
      y: state.formation.y + alien.row * SPACING_Y,
    };
  }

  function fire() {
    if (!api.canPlay() || state.dead) return;
    if (state.player.cooldown > 0) return;
    state.player.cooldown = 0.24;
    state.bullets.push({ x: state.player.x, y: PLAYER_Y - 16, vy: -520, w: 3, h: 12 });
    api.sfx('jump');
  }

  function alienFire() {
    const alive = state.aliens.filter((a) => a.alive);
    if (!alive.length) return;
    const shooter = alive[Math.floor(Math.random() * alive.length)];
    const pos = alienPos(shooter);
    state.enemyBullets.push({ x: pos.x + 14, y: pos.y + 24, vy: 180 + state.wave * 14, w: 4, h: 10 });
  }

  function spawnUfo() {
    state.ufo = { x: -50, y: 40, dir: 1, alive: true, hp: 1 };
    api.sfx('click');
  }

  function hitShield(bullet) {
    for (const cell of state.shields) {
      if (!cell.alive) continue;
      if (
        bullet.x + bullet.w > cell.x && bullet.x < cell.x + cell.w
        && bullet.y + bullet.h > cell.y && bullet.y < cell.y + cell.h
      ) {
        cell.hp -= 1;
        if (cell.hp <= 0) cell.alive = false;
        return true;
      }
    }
    return false;
  }

  function nextWave() {
    state.wave += 1;
    state.player.x = W / 2;
    buildWave();
    buildShields();
    api.sfx('win');
    api.setStatus(`Wave ${state.wave} incoming`);
  }

  function loseLife() {
    state.lives -= 1;
    state.shake = 0.35;
    api.sfx('lose');
    state.enemyBullets = [];
    state.player.x = W / 2;
    if (state.lives <= 0) {
      state.dead = true;
      api.gameOver({
        score: state.score,
        title: 'Invasion complete',
        message: `${state.score.toLocaleString()} points · Wave ${state.wave}. The formation reached the bottom.`,
      });
    } else {
      api.setStatus(`${state.lives} ${state.lives === 1 ? 'life' : 'lives'} left`);
    }
  }

  function update(dt) {
    if (state.dead) return;
    state.time += dt;
    state.player.cooldown = Math.max(0, state.player.cooldown - dt);
    state.shake = Math.max(0, state.shake - dt);

    if (state.time % 4 < dt) {
      state.stars.forEach((star) => { star.tw += 0.7; });
    }

    const alive = state.aliens.filter((a) => a.alive);
    if (!alive.length) {
      nextWave();
      return;
    }

    // March
    const maxCol = Math.max(...alive.map((a) => a.col));
    const minCol = Math.min(...alive.map((a) => a.col));
    const maxRow = Math.max(...alive.map((a) => a.row));
    const progress = 1 - alive.length / (COLS * ROWS);
    const speed = state.formation.speed + progress * 46;
    state.formation.x += state.formation.dir * speed * dt;
    const leftEdge = state.formation.x + minCol * SPACING_X;
    const rightEdge = state.formation.x + maxCol * SPACING_X + 34;
    if (rightEdge > W - 16 && state.formation.dir > 0) {
      state.formation.dir = -1;
      state.formation.y += 14;
    } else if (leftEdge < 16 && state.formation.dir < 0) {
      state.formation.dir = 1;
      state.formation.y += 14;
    }
    if (state.formation.y + maxRow * SPACING_Y + 30 >= PLAYER_Y - 8) {
      state.dead = true;
      api.gameOver({
        score: state.score,
        title: 'They reached the bottom',
        message: `${state.score.toLocaleString()} points · Wave ${state.wave}. Clear the lowest row first next time.`,
      });
      return;
    }

    // Alien fire
    state.alienFireTimer -= dt;
    if (state.alienFireTimer <= 0) {
      state.alienFireTimer = Math.max(0.32, 1.5 - state.wave * 0.08 - progress * 0.5);
      alienFire();
    }

    // UFO
    state.ufoTimer -= dt;
    if (!state.ufo && state.ufoTimer <= 0) spawnUfo();
    if (state.ufo) {
      state.ufo.x += state.ufo.dir * 120 * dt;
      if (state.ufo.x > W + 60 || state.ufo.x < -80) {
        state.ufo = null;
        state.ufoTimer = 14 + Math.random() * 10;
      }
    }

    // Bullets
    state.bullets.forEach((b) => { b.y += b.vy * dt; });
    state.bullets = state.bullets.filter((b) => b.y > -20);
    state.enemyBullets.forEach((b) => { b.y += b.vy * dt; });
    state.enemyBullets = state.enemyBullets.filter((b) => {
      if (b.y > H + 20) return false;
      if (hitShield(b)) return false;
      if (b.x + b.w > state.player.x - state.player.w / 2 && b.x < state.player.x + state.player.w / 2
        && b.y + b.h > PLAYER_Y - state.player.h && b.y < PLAYER_Y + 6) {
        loseLife();
        return false;
      }
      return true;
    });

    // Player bullets
    state.bullets = state.bullets.filter((b) => {
      if (hitShield(b)) return false;
      for (const alien of state.aliens) {
        if (!alien.alive) continue;
        const pos = alienPos(alien);
        if (b.x + b.w > pos.x && b.x < pos.x + 30 && b.y + b.h > pos.y && b.y < pos.y + 26) {
          alien.alive = false;
          state.score += [30, 25, 20, 15, 10][alien.type] || 10;
          api.setScore(state.score, 'Score');
          api.sfx('score');
          return false;
        }
      }
      if (state.ufo && state.ufo.alive
        && b.x + b.w > state.ufo.x && b.x < state.ufo.x + 46
        && b.y + b.h > state.ufo.y && b.y < state.ufo.y + 18) {
        state.score += 150;
        api.setScore(state.score, 'Score');
        state.ufo = null;
        state.ufoTimer = 16;
        api.sfx('win');
        return false;
      }
      return true;
    });
  }

  function drawAlien(x, y, type, frame) {
    const colors = ['#f472b6', '#a78bfa', '#22d3ee', '#4ade80', '#facc15'];
    const color = colors[type % colors.length];
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    const bob = frame ? 2 : 0;
    // body
    ctx.fillRect(x + 6, y + 6 + bob, 18, 10);
    ctx.fillRect(x + 2, y + 10 + bob, 26, 6);
    // legs
    ctx.fillRect(x + 2, y + 16 + bob, 4, 5);
    ctx.fillRect(x + 11, y + 16 + bob, 4, 5);
    ctx.fillRect(x + 20, y + 16 + bob, 4, 5);
    ctx.fillRect(x + 25, y + 16 + bob, 3, 5);
    // eyes
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#05070f';
    ctx.fillRect(x + 10, y + 9 + bob, 3, 3);
    ctx.fillRect(x + 19, y + 9 + bob, 3, 3);
  }

  function draw() {
    ctx.save();
    if (state.shake > 0) ctx.translate((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5);
    ctx.fillStyle = '#05070f';
    ctx.fillRect(-10, -10, W + 20, H + 20);

    // Stars
    state.stars.forEach((star) => {
      const alpha = 0.35 + Math.sin(state.time * 2 + star.tw) * 0.3;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(star.x, star.y, star.s, star.s);
    });
    ctx.globalAlpha = 1;

    // Shields
    state.shields.forEach((cell) => {
      if (!cell.alive) return;
      ctx.fillStyle = cell.hp > 1 ? '#22c55e' : '#15803d';
      ctx.fillRect(cell.x, cell.y, cell.w - 1, cell.h - 1);
    });

    // Aliens
    const frame = Math.floor(state.time * 2.2) % 2 === 0;
    state.aliens.forEach((alien) => {
      if (!alien.alive) return;
      const pos = alienPos(alien);
      drawAlien(pos.x, pos.y, alien.type, frame);
    });

    // UFO
    if (state.ufo) {
      ctx.fillStyle = '#facc15';
      ctx.shadowColor = '#facc15';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.ellipse(state.ufo.x + 23, state.ufo.y + 9, 23, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0ea5e9';
      ctx.beginPath();
      ctx.ellipse(state.ufo.x + 23, state.ufo.y + 4, 11, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Bullets
    ctx.fillStyle = '#a3e635';
    ctx.shadowColor = '#a3e635';
    ctx.shadowBlur = 8;
    state.bullets.forEach((b) => ctx.fillRect(b.x, b.y, b.w, b.h));
    ctx.fillStyle = '#f43f5e';
    ctx.shadowColor = '#f43f5e';
    state.enemyBullets.forEach((b) => ctx.fillRect(b.x, b.y, b.w, b.h));
    ctx.shadowBlur = 0;

    // Player cannon
    const px = state.player.x;
    ctx.fillStyle = '#22d3ee';
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(px, PLAYER_Y - 20);
    ctx.lineTo(px - 17, PLAYER_Y + 4);
    ctx.lineTo(px + 17, PLAYER_Y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(px - 3, PLAYER_Y - 22, 6, 12);
    ctx.shadowBlur = 0;

    // HUD
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '800 16px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${state.score.toLocaleString()}`, 16, 28);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`WAVE ${state.wave}`, W / 2, 28);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#22d3ee';
    ctx.fillText('▲'.repeat(Math.max(0, state.lives)), W - 16, 28);
    ctx.restore();
  }

  api.loop((dt) => {
    if (dt > 0 && api.canPlay()) update(dt);
    draw();
  });

  function onKey(event) {
    if (!api.canPlay() || state.dead) return;
    if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
      event.preventDefault();
      state.player.x = Math.max(24, state.player.x - 14);
    } else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
      event.preventDefault();
      state.player.x = Math.min(W - 24, state.player.x + 14);
    } else if (event.key === ' ' || event.key === 'Spacebar' || event.code === 'Space') {
      event.preventDefault();
      fire();
    }
  }
  window.addEventListener('keydown', onKey);

  if (api.isTouch) {
    const row = document.createElement('div');
    row.className = 'touch-row';
    row.innerHTML = `
      <button class="touch-btn" type="button" aria-label="Move left">◀</button>
      <button class="touch-btn" type="button" aria-label="Move right">▶</button>
      <button class="touch-btn wide" type="button" aria-label="Fire">Fire</button>`;
    const [left, right, fireBtn] = row.querySelectorAll('button');
    left.addEventListener('pointerdown', (e) => { e.preventDefault(); state.player.x = Math.max(24, state.player.x - 22); });
    right.addEventListener('pointerdown', (e) => { e.preventDefault(); state.player.x = Math.min(W - 24, state.player.x + 22); });
    fireBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); fire(); });
    api.addControls(row);
  }

  reset();
  return {
    start() { reset(); },
    restart() { reset(); },
  };
}
