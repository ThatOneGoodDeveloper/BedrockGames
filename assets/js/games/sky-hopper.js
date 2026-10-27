/**
 * Sky Hopper — original endless vertical jumper.
 * Auto-bounce platforming, springs, moving platforms, monsters and height score.
 */

const W = 400;
const H = 600;

export default function createGame(api) {
  const { ctx } = api.initCanvas(W, H);
  api.setBestMode('higher');

  const state = {
    player: { x: W / 2, y: H - 90, vx: 0, vy: 0, r: 15 },
    platforms: [],
    monsters: [],
    springs: [],
    keys: { left: false, right: false },
    topY: 0,
    score: 0,
    dead: false,
    time: 0,
    stars: [],
    wrapFlash: 0,
  };

  function makePlatform(y, type = 'normal') {
    const w = type === 'moving' ? 74 : type === 'small' ? 56 : 78;
    return {
      x: 20 + Math.random() * (W - 40 - w),
      y,
      w,
      h: 13,
      type,
      dir: Math.random() > 0.5 ? 1 : -1,
      speed: 36 + Math.random() * 40,
      spring: Math.random() < 0.13,
    };
  }

  function reset() {
    state.player = { x: W / 2, y: H - 90, vx: 0, vy: 0, r: 15 };
    state.platforms = [{ x: W / 2 - 45, y: H - 52, w: 90, h: 13, type: 'normal', dir: 1, speed: 0, spring: false }];
    state.monsters = [];
    state.springs = [];
    state.keys = { left: false, right: false };
    state.topY = H - 110;
    state.score = 0;
    state.dead = false;
    state.time = 0;
    state.wrapFlash = 0;
    state.stars = Array.from({ length: 34 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      s: 0.6 + Math.random() * 1.6,
      v: 0.15 + Math.random() * 0.3,
    }));
    api.setScore(0, 'Height');
    api.setStatus('Bounce upward — do not fall off the bottom');
    generateUp();
  }

  function generateUp() {
    while (state.topY > -120) {
      const gap = 66 + Math.random() * 42;
      state.topY -= gap;
      const roll = Math.random();
      const type = roll < 0.16 ? 'moving' : roll < 0.3 ? 'small' : 'normal';
      const platform = makePlatform(state.topY, type);
      state.platforms.push(platform);
      if (state.score > 8 && Math.random() < 0.12) {
        state.monsters.push({
          x: platform.x + platform.w / 2 - 15,
          y: platform.y - 28,
          w: 30,
          h: 26,
          dir: Math.random() > 0.5 ? 1 : -1,
          baseX: platform.x + platform.w / 2 - 15,
          range: 20 + Math.random() * 26,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }
  }

  function bounce(power) {
    state.player.vy = power;
    api.sfx('jump');
  }

  function die(reason) {
    if (state.dead) return;
    state.dead = true;
    api.sfx('lose');
    api.gameOver({
      score: Math.floor(state.score),
      title: reason,
      message: `You climbed ${Math.floor(state.score)} meters. Keep steering toward the center of each platform.`,
    });
  }

  function update(dt) {
    if (state.dead) return;
    const player = state.player;
    state.time += dt;
    state.wrapFlash = Math.max(0, state.wrapFlash - dt);

    // Horizontal control
    const accel = 1900;
    const maxVx = 330;
    if (state.keys.left) player.vx -= accel * dt;
    else if (state.keys.right) player.vx += accel * dt;
    else player.vx *= Math.pow(0.0008, dt);
    player.vx = Math.max(-maxVx, Math.min(maxVx, player.vx));
    player.x += player.vx * dt;

    if (player.x < -player.r) {
      player.x = W + player.r;
      state.wrapFlash = 0.25;
    } else if (player.x > W + player.r) {
      player.x = -player.r;
      state.wrapFlash = 0.25;
    }

    const prevY = player.y;
    player.vy += 1420 * dt;
    player.y += player.vy * dt;

    // Platform collisions (only while falling)
    if (player.vy > 0) {
      for (const platform of state.platforms) {
        const feet = player.y + player.r;
        const prevFeet = prevY + player.r;
        if (
          prevFeet <= platform.y + 4
          && feet >= platform.y
          && player.x + player.r * 0.7 > platform.x
          && player.x - player.r * 0.7 < platform.x + platform.w
        ) {
          player.y = platform.y - player.r;
          bounce(platform.spring ? -940 : -610);
          if (platform.spring) api.sfx('pickup');
          break;
        }
      }
    }

    // Moving platforms
    state.platforms.forEach((platform) => {
      if (platform.type !== 'moving') return;
      platform.x += platform.dir * platform.speed * dt;
      if (platform.x < 8) {
        platform.x = 8;
        platform.dir = 1;
      } else if (platform.x + platform.w > W - 8) {
        platform.x = W - 8 - platform.w;
        platform.dir = -1;
      }
    });

    // Monsters
    state.monsters.forEach((monster) => {
      monster.phase += dt * 1.6;
      monster.x = monster.baseX + Math.sin(monster.phase) * monster.range;
      if (
        player.x + player.r * 0.7 > monster.x
        && player.x - player.r * 0.7 < monster.x + monster.w
        && player.y + player.r * 0.8 > monster.y
        && player.y - player.r * 0.8 < monster.y + monster.h
      ) {
        die('A monster caught you');
      }
    });

    // Camera shift upward
    const threshold = H * 0.4;
    if (player.y < threshold) {
      const shift = threshold - player.y;
      player.y = threshold;
      state.score += shift / 10;
      api.setScore(Math.floor(state.score), 'Height');
      state.platforms.forEach((platform) => { platform.y += shift; });
      state.monsters.forEach((monster) => { monster.y += shift; });
      state.topY += shift;
      state.platforms = state.platforms.filter((platform) => platform.y < H + 60);
      state.monsters = state.monsters.filter((monster) => monster.y < H + 60);
      generateUp();
    }

    // Stars drift down slowly
    state.stars.forEach((star) => {
      star.y += star.v;
      if (star.y > H) {
        star.y = 0;
        star.x = Math.random() * W;
      }
    });

    if (player.y - player.r > H + 20) die('You fell too far');
  }

  function drawPlatform(platform) {
    const grad = ctx.createLinearGradient(platform.x, platform.y, platform.x, platform.y + platform.h);
    grad.addColorStop(0, platform.type === 'moving' ? '#38bdf8' : '#4ade80');
    grad.addColorStop(1, platform.type === 'moving' ? '#0369a1' : '#15803d');
    ctx.fillStyle = grad;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(platform.x, platform.y, platform.w, platform.h, 6);
    else ctx.rect(platform.x, platform.y, platform.w, platform.h);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(platform.x + 5, platform.y + 2, platform.w - 10, 3);
    if (platform.spring) {
      ctx.fillStyle = '#facc15';
      ctx.fillRect(platform.x + platform.w / 2 - 8, platform.y - 8, 16, 8);
      ctx.fillStyle = '#f97316';
      ctx.fillRect(platform.x + platform.w / 2 - 10, platform.y - 10, 20, 3);
    }
  }

  function draw() {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#0b1026');
    sky.addColorStop(0.55, '#14213d');
    sky.addColorStop(1, '#1e3a5f');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    state.stars.forEach((star) => {
      ctx.globalAlpha = 0.35 + star.s / 4;
      ctx.fillStyle = '#e0f2fe';
      ctx.fillRect(star.x, star.y, star.s, star.s);
    });
    ctx.globalAlpha = 1;

    state.platforms.forEach(drawPlatform);

    state.monsters.forEach((monster) => {
      ctx.fillStyle = '#a855f7';
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(monster.x + monster.w / 2, monster.y + monster.h / 2, monster.w / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(monster.x + 10, monster.y + 11, 4, 0, Math.PI * 2);
      ctx.arc(monster.x + 21, monster.y + 11, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(monster.x + 11, monster.y + 11, 2, 0, Math.PI * 2);
      ctx.arc(monster.x + 22, monster.y + 11, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Player
    const p = state.player;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.shadowColor = '#a3e635';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#a3e635';
    ctx.beginPath();
    ctx.ellipse(0, 0, p.r, p.r * 0.92, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#365314';
    ctx.beginPath();
    ctx.arc(-5, -3, 2.6, 0, Math.PI * 2);
    ctx.arc(5, -3, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#84cc16';
    ctx.beginPath();
    ctx.ellipse(0, 6, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Score watermark
    ctx.fillStyle = 'rgba(226,232,240,0.12)';
    ctx.font = '900 46px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.floor(state.score)}m`, W / 2, 64);

    if (state.wrapFlash > 0) {
      ctx.fillStyle = `rgba(163,230,53,${state.wrapFlash})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  api.loop((dt) => {
    if (dt > 0 && api.canPlay()) update(dt);
    draw();
  });

  function setKey(name, value) {
    if (!api.canPlay()) return;
    state.keys[name] = value;
  }

  window.addEventListener('keydown', (event) => {
    if (!api.canPlay()) return;
    if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') { event.preventDefault(); setKey('left', true); }
    else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') { event.preventDefault(); setKey('right', true); }
  });
  window.addEventListener('keyup', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') setKey('left', false);
    else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') setKey('right', false);
  });

  if (api.isTouch) {
    const row = document.createElement('div');
    row.className = 'touch-row';
    row.innerHTML = `
      <button class="touch-btn wide" type="button" aria-label="Move left">◀</button>
      <button class="touch-btn wide" type="button" aria-label="Move right">▶</button>`;
    const [left, right] = row.querySelectorAll('button');
    const bind = (btn, name) => {
      btn.addEventListener('pointerdown', (e) => { e.preventDefault(); setKey(name, true); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((evt) => {
        btn.addEventListener(evt, () => setKey(name, false));
      });
    };
    bind(left, 'left');
    bind(right, 'right');
    api.addControls(row);
  }

  reset();
  return {
    start() { reset(); },
    restart() { reset(); },
  };
}
