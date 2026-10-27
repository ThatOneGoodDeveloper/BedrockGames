/**
 * Asteroids — original arcade shooter.
 * Rotate, thrust, fire, split rocks and survive endless waves.
 */

const W = 720;
const H = 520;

export default function createGame(api) {
  const { ctx } = api.initCanvas(W, H);
  api.setBestMode('higher');

  const state = {
    ship: { x: W / 2, y: H / 2, vx: 0, vy: 0, angle: -Math.PI / 2, thrust: false, invuln: 2 },
    bullets: [],
    asteroids: [],
    particles: [],
    stars: [],
    score: 0,
    lives: 3,
    wave: 1,
    cooldown: 0,
    dead: false,
    time: 0,
    keys: new Set(),
  };

  function makeAsteroid(x, y, size, speedBoost = 1) {
    const radius = size === 3 ? 46 : size === 2 ? 27 : 16;
    const angle = Math.random() * Math.PI * 2;
    const speed = (size === 3 ? 26 : size === 2 ? 42 : 62) * speedBoost;
    const vertices = [];
    const count = 9 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2;
      const r = radius * (0.78 + Math.random() * 0.35);
      vertices.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size, radius, vertices, spin: (Math.random() - 0.5) * 1.3, rot: Math.random() * Math.PI };
  }

  function spawnWave() {
    state.asteroids = [];
    const count = 6 + state.wave * 2;
    for (let i = 0; i < count; i += 1) {
      let x;
      let y;
      do {
        x = Math.random() * W;
        y = Math.random() * H;
      } while (Math.hypot(x - state.ship.x, y - state.ship.y) < 150);
      state.asteroids.push(makeAsteroid(x, y, 3, 1 + state.wave * 0.05));
    }
    api.setStatus(`Wave ${state.wave} — clear the rocks`);
  }

  function resetShip() {
    state.ship = { x: W / 2, y: H / 2, vx: 0, vy: 0, angle: -Math.PI / 2, thrust: false, invuln: 2.2 };
    state.bullets = [];
  }

  function reset() {
    state.score = 0;
    state.lives = 3;
    state.wave = 1;
    state.dead = false;
    state.cooldown = 0;
    state.particles = [];
    state.keys.clear();
    state.stars = Array.from({ length: 90 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: 0.5 + Math.random() * 1.5, v: 5 + Math.random() * 10 }));
    resetShip();
    spawnWave();
    api.setScore(0, 'Score');
  }

  function fire() {
    if (!api.canPlay() || state.dead || state.cooldown > 0) return;
    state.cooldown = 0.2;
    const ship = state.ship;
    state.bullets.push({
      x: ship.x + Math.cos(ship.angle) * 18,
      y: ship.y + Math.sin(ship.angle) * 18,
      vx: Math.cos(ship.angle) * 560 + ship.vx * 0.4,
      vy: Math.sin(ship.angle) * 560 + ship.vy * 0.4,
      life: 1.05,
    });
    api.sfx('jump');
  }

  function burst(x, y, color, count = 10) {
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = 30 + Math.random() * 200;
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.35 + Math.random() * 0.5, color });
    }
  }

  function splitAsteroid(asteroid) {
    if (asteroid.size > 1) {
      for (let i = 0; i < 2; i += 1) {
        const child = makeAsteroid(asteroid.x, asteroid.y, asteroid.size - 1, 1.15);
        child.vx += asteroid.vx * 0.4;
        child.vy += asteroid.vy * 0.4;
        state.asteroids.push(child);
      }
    }
    state.score += asteroid.size === 3 ? 20 : asteroid.size === 2 ? 50 : 100;
    api.setScore(state.score, 'Score');
    burst(asteroid.x, asteroid.y, '#a3e635', asteroid.size * 5);
    api.sfx('hit');
  }

  function loseLife() {
    if (state.ship.invuln > 0 || state.dead) return;
    state.lives -= 1;
    api.sfx('lose');
    burst(state.ship.x, state.ship.y, '#f472b6', 24);
    if (state.lives <= 0) {
      state.dead = true;
      api.gameOver({
        score: state.score,
        title: 'Ship destroyed',
        message: `${state.score.toLocaleString()} points · Wave ${state.wave}. Keep moving; the rocks never stop.`,
      });
    } else {
      resetShip();
      api.setStatus(`${state.lives} ${state.lives === 1 ? 'life' : 'lives'} left`);
    }
  }

  function update(dt) {
    if (state.dead) return;
    state.time += dt;
    state.ship.invuln = Math.max(0, state.ship.invuln - dt);
    state.cooldown = Math.max(0, state.cooldown - dt);

    const ship = state.ship;
    const rotate = 3.4;
    if (state.keys.has('ArrowLeft') || state.keys.has('a')) ship.angle -= rotate * dt;
    if (state.keys.has('ArrowRight') || state.keys.has('d')) ship.angle += rotate * dt;
    const thrusting = state.keys.has('ArrowUp') || state.keys.has('w');
    if (thrusting) {
      ship.vx += Math.cos(ship.angle) * 220 * dt;
      ship.vy += Math.sin(ship.angle) * 220 * dt;
      if (Math.random() < 0.4) {
        state.particles.push({
          x: ship.x - Math.cos(ship.angle) * 18,
          y: ship.y - Math.sin(ship.angle) * 18,
          vx: -Math.cos(ship.angle) * 80 + (Math.random() - 0.5) * 50,
          vy: -Math.sin(ship.angle) * 80 + (Math.random() - 0.5) * 50,
          life: 0.25, color: '#22d3ee',
        });
      }
    }
    ship.vx *= Math.pow(0.995, dt * 60);
    ship.vy *= Math.pow(0.995, dt * 60);
    ship.x = (ship.x + ship.vx * dt + W) % W;
    ship.y = (ship.y + ship.vy * dt + H) % H;

    state.bullets.forEach((b) => {
      b.x = (b.x + b.vx * dt + W) % W;
      b.y = (b.y + b.vy * dt + H) % H;
      b.life -= dt;
    });
    state.bullets = state.bullets.filter((b) => b.life > 0);

    state.asteroids.forEach((a) => {
      a.x = (a.x + a.vx * dt + W) % W;
      a.y = (a.y + a.vy * dt + H) % H;
      a.rot += a.spin * dt;
    });

    // Bullet hits
    for (const bullet of state.bullets) {
      for (const asteroid of state.asteroids) {
        if (asteroid.alive === false) continue;
        if (Math.hypot(bullet.x - asteroid.x, bullet.y - asteroid.y) < asteroid.radius) {
          bullet.life = 0;
          asteroid.alive = false;
          splitAsteroid(asteroid);
          break;
        }
      }
    }
    state.asteroids = state.asteroids.filter((a) => a.alive !== false);

    // Ship collision
    if (ship.invuln <= 0) {
      for (const asteroid of state.asteroids) {
        if (Math.hypot(ship.x - asteroid.x, ship.y - asteroid.y) < asteroid.radius + 12) {
          loseLife();
          break;
        }
      }
    }

    state.particles.forEach((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    });
    state.particles = state.particles.filter((p) => p.life > 0);

    state.stars.forEach((star) => {
      star.y += star.v * dt;
      if (star.y > H) {
        star.y = 0;
        star.x = Math.random() * W;
      }
    });

    if (!state.asteroids.length) {
      state.wave += 1;
      spawnWave();
      api.sfx('win');
    }
  }

  function drawShip() {
    const ship = state.ship;
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.angle);
    const flicker = ship.invuln > 0 && Math.floor(state.time * 12) % 2 === 0;
    ctx.globalAlpha = flicker ? 0.35 : 1;
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-12, -11);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-12, 11);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(-16, -5);
    ctx.lineTo(-16, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function draw() {
    ctx.fillStyle = '#05070f';
    ctx.fillRect(0, 0, W, H);
    state.stars.forEach((star) => {
      ctx.globalAlpha = 0.35 + star.s / 4;
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(star.x, star.y, star.s, star.s);
    });
    ctx.globalAlpha = 1;

    state.asteroids.forEach((a) => {
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.rot);
      ctx.strokeStyle = '#94a3b8';
      ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#a3e635';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      a.vertices.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });

    state.bullets.forEach((b) => {
      ctx.fillStyle = '#a3e635';
      ctx.shadowColor = '#a3e635';
      ctx.shadowBlur = 10;
      ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
      ctx.shadowBlur = 0;
    });

    state.particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 3, 3);
    });
    ctx.globalAlpha = 1;

    drawShip();

    ctx.fillStyle = '#f8fafc';
    ctx.font = '900 17px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(String(state.score).padStart(5, '0'), 18, 30);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#22d3ee';
    ctx.fillText('▲'.repeat(Math.max(0, state.lives)), W - 18, 30);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(148,163,184,0.7)';
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.fillText(`WAVE ${state.wave}`, W / 2, 30);
  }

  api.loop((dt) => {
    if (dt > 0 && api.canPlay()) update(dt);
    draw();
  });

  function keyName(event) {
    return event.key.length === 1 ? event.key.toLowerCase() : event.key;
  }
  window.addEventListener('keydown', (event) => {
    if (!api.canPlay()) return;
    const key = keyName(event);
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'a', 'd', 'w', ' '].includes(key)) {
      event.preventDefault();
      if (key === ' ') fire();
      else state.keys.add(key);
    }
  });
  window.addEventListener('keyup', (event) => state.keys.delete(keyName(event)));

  if (api.isTouch) {
    const row = document.createElement('div');
    row.className = 'touch-row';
    row.innerHTML = `
      <button class="touch-btn" type="button" aria-label="Rotate left">◀</button>
      <button class="touch-btn" type="button" aria-label="Thrust">▲</button>
      <button class="touch-btn" type="button" aria-label="Rotate right">▶</button>
      <button class="touch-btn wide" type="button" aria-label="Fire">Fire</button>`;
    const [left, thrust, right, fireBtn] = row.querySelectorAll('button');
    const bind = (btn, key) => {
      btn.addEventListener('pointerdown', (e) => { e.preventDefault(); state.keys.add(key); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((evt) => btn.addEventListener(evt, () => state.keys.delete(key)));
    };
    bind(left, 'ArrowLeft');
    bind(thrust, 'ArrowUp');
    bind(right, 'ArrowRight');
    fireBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); fire(); });
    api.addControls(row);
  }

  reset();
  return {
    start() { reset(); },
    restart() { reset(); },
  };
}
