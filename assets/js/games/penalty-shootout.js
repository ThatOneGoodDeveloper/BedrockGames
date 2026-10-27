/**
 * Penalty Shootout — original football penalty game.
 * Aim, charge, beat the diving keeper, then defend your lead through five rounds.
 */

const W = 480;
const H = 640;
const GOAL = { x: 86, y: 138, w: 308, h: 186 };
const BALL_HOME = { x: W / 2, y: 552 };

export default function createGame(api) {
  const { ctx } = api.initCanvas(W, H);
  api.setBestMode('higher');

  const state = {
    phase: 'aim',
    aim: { x: W / 2, y: GOAL.y + GOAL.h * 0.55 },
    pointerAim: { x: W / 2, y: GOAL.y + GOAL.h * 0.55 },
    charge: 0,
    charging: false,
    keeperX: W / 2,
    keeperDive: null,
    flight: 0,
    shotFrom: { ...BALL_HOME },
    shotTo: { ...BALL_HOME },
    resultText: '',
    resultTimer: 0,
    playerGoals: 0,
    aiGoals: 0,
    round: 0,
    suddenDeath: false,
    over: false,
    keys: new Set(),
    time: 0,
    history: [],
  };

  function reset() {
    state.phase = 'aim';
    state.aim = { x: W / 2, y: GOAL.y + GOAL.h * 0.55 };
    state.pointerAim = { ...state.aim };
    state.charge = 0;
    state.charging = false;
    state.keeperX = W / 2;
    state.keeperDive = null;
    state.flight = 0;
    state.resultText = '';
    state.resultTimer = 0;
    state.playerGoals = 0;
    state.aiGoals = 0;
    state.round = 0;
    state.suddenDeath = false;
    state.over = false;
    state.keys.clear();
    state.history = [];
    state.time = 0;
    api.setScore(0, 'Goals');
    api.setStatus('Aim with the mouse, hold to charge, release to shoot');
  }

  function currentKickNumber() {
    return state.suddenDeath ? state.round + 1 : state.round + 1;
  }

  function shoot() {
    if (state.phase !== 'aim' || !api.canPlay()) return;
    const target = { ...state.aim };
    state.shotFrom = { ...BALL_HOME };
    state.shotTo = target;
    state.flight = 0;
    state.phase = 'flight';
    // Keeper picks a dive. It reads the aim with some noise.
    const accuracy = 0.55;
    const guessedX = W / 2 + (target.x - W / 2) * accuracy + (Math.random() - 0.5) * 170;
    const guessY = GOAL.y + GOAL.h * 0.55 + (Math.random() - 0.5) * 130;
    state.keeperDive = { x: guessedX, y: guessY };
    state.keeperX = W / 2;
    api.sfx('hit');
  }

  function resolveShot() {
    const target = state.shotTo;
    const insideGoal = target.x > GOAL.x + 8 && target.x < GOAL.x + GOAL.w - 8
      && target.y > GOAL.y + 8 && target.y < GOAL.y + GOAL.h - 6;
    const keeperDistance = Math.hypot(target.x - state.keeperDive.x, target.y - state.keeperDive.y);
    const saved = insideGoal && keeperDistance < 62;
    let scored = insideGoal && !saved;
    if (!insideGoal) {
      const post = Math.abs(target.x - GOAL.x) < 10 || Math.abs(target.x - (GOAL.x + GOAL.w)) < 10;
      state.resultText = post ? 'Off the post!' : 'Off target!';
    } else if (saved) {
      state.resultText = 'Great save!';
    } else {
      state.resultText = 'GOAL!';
      state.playerGoals += 1;
      api.sfx('win');
    }
    if (insideGoal && saved) api.sfx('lose');
    state.history.push({ scored, saved });
    state.phase = 'result';
    state.resultTimer = 1.35;
    api.setScore(state.playerGoals, 'Goals');
    api.setStatus(saved ? 'The keeper guessed right' : scored ? 'Top corner!' : 'Aim inside the frame');
  }

  function aiKick() {
    state.phase = 'ai';
    state.resultTimer = 0.9;
    state.flight = 0;
    const target = {
      x: GOAL.x + 20 + Math.random() * (GOAL.w - 40),
      y: GOAL.y + 20 + Math.random() * (GOAL.h - 40),
    };
    const miss = Math.random() < 0.18;
    const scored = !miss;
    if (scored) state.aiGoals += 1;
    state.shotFrom = { ...BALL_HOME };
    state.shotTo = miss ? { x: GOAL.x - 40, y: target.y } : target;
    state.flight = 0;
    state.keeperDive = { x: W / 2 + (Math.random() - 0.5) * 120, y: GOAL.y + GOAL.h * 0.5 };
    state.aiScored = scored;
    state.history.push({ scored, ai: true });
    if (scored) api.sfx('score');
    else api.sfx('click');
  }

  function nextKick() {
    const playerKicks = state.history.filter((h) => !h.ai).length;
    const aiKicks = state.history.filter((h) => h.ai).length;
    if (!state.suddenDeath && playerKicks >= 5 && aiKicks >= 5) {
      if (state.playerGoals === state.aiGoals) {
        state.suddenDeath = true;
        api.setStatus('Sudden death — next goal wins');
      } else {
        endShootout();
        return;
      }
    }
    if (state.suddenDeath && playerKicks === aiKicks) {
      if (state.playerGoals !== state.aiGoals) {
        endShootout();
        return;
      }
    }
    state.phase = playerKicks <= aiKicks ? 'aim' : 'ai';
    state.charge = 0;
    state.charging = false;
    state.flight = 0;
    state.keeperDive = null;
    state.keeperX = W / 2;
    state.resultText = '';
    api.setStatus(state.phase === 'ai' ? 'The computer steps up…' : 'Your kick — aim, hold and release');
    if (state.phase === 'ai') aiKick();
  }

  function endShootout() {
    state.over = true;
    const won = state.playerGoals > state.aiGoals;
    const score = state.playerGoals * 100 + (won ? 500 : 0);
    api.setScore(score, 'Score');
    api.saveBest(score);
    if (won) {
      api.win({
        score,
        title: 'Shootout won!',
        message: `${state.playerGoals} – ${state.aiGoals}. You out-scored the computer.`,
      });
    } else {
      api.gameOver({
        score,
        title: 'Shootout lost',
        message: `${state.playerGoals} – ${state.aiGoals}. Aim for the top corners next time.`,
      });
    }
  }

  function update(dt) {
    if (state.over) return;
    state.time += dt;
    const speed = 150;
    if (state.keys.has('ArrowLeft')) state.aim.x -= speed * dt;
    if (state.keys.has('ArrowRight')) state.aim.x += speed * dt;
    if (state.keys.has('ArrowUp')) state.aim.y -= speed * dt;
    if (state.keys.has('ArrowDown')) state.aim.y += speed * dt;
    state.aim.x = Math.max(40, Math.min(W - 40, state.aim.x));
    state.aim.y = Math.max(90, Math.min(GOAL.y + GOAL.h + 50, state.aim.y));

    if (state.charging) state.charge = Math.min(1, state.charge + dt * 1.4);
    if (state.phase === 'flight' || state.phase === 'ai') {
      state.flight += dt;
      const t = Math.min(1, state.flight / 0.62);
      state.keeperX = W / 2 + (state.keeperDive.x - W / 2) * Math.min(1, t * 1.4);
      if (t >= 1) {
        if (state.phase === 'flight') resolveShot();
        else {
          state.phase = 'result';
          state.resultTimer = 1.15;
          state.resultText = state.aiScored ? 'Computer scores' : 'Computer misses!';
        }
      }
    }
    if (state.phase === 'result') {
      state.resultTimer -= dt;
      if (state.resultTimer <= 0) {
        state.round += 1;
        nextKick();
      }
    }

  }

  function drawGoal() {
    // Net
    ctx.fillStyle = 'rgba(8, 20, 40, 0.55)';
    ctx.fillRect(GOAL.x, GOAL.y, GOAL.w, GOAL.h);
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.28)';
    ctx.lineWidth = 1;
    for (let x = GOAL.x + 14; x < GOAL.x + GOAL.w; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, GOAL.y);
      ctx.lineTo(x, GOAL.y + GOAL.h);
      ctx.stroke();
    }
    for (let y = GOAL.y + 14; y < GOAL.y + GOAL.h; y += 18) {
      ctx.beginPath();
      ctx.moveTo(GOAL.x, y);
      ctx.lineTo(GOAL.x + GOAL.w, y);
      ctx.stroke();
    }
    // Posts
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(GOAL.x, GOAL.y + GOAL.h);
    ctx.lineTo(GOAL.x, GOAL.y);
    ctx.lineTo(GOAL.x + GOAL.w, GOAL.y);
    ctx.lineTo(GOAL.x + GOAL.w, GOAL.y + GOAL.h);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  function drawKeeper() {
    const x = state.keeperX;
    const y = GOAL.y + GOAL.h * 0.58;
    const diving = state.phase === 'flight' || state.phase === 'ai';
    ctx.save();
    ctx.translate(x, y);
    if (diving) ctx.rotate((state.keeperDive.x - W / 2) / 220);
    // body
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-17, -34, 34, 52, 10);
    else ctx.rect(-17, -34, 34, 52);
    ctx.fill();
    // head
    ctx.fillStyle = '#fcd7b6';
    ctx.beginPath();
    ctx.arc(0, -42, 14, 0, Math.PI * 2);
    ctx.fill();
    // arms
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-14, -22);
    ctx.lineTo(-34, -44);
    ctx.moveTo(14, -22);
    ctx.lineTo(34, -44);
    ctx.stroke();
    // legs
    ctx.beginPath();
    ctx.moveTo(-9, 18);
    ctx.lineTo(-16, 46);
    ctx.moveTo(9, 18);
    ctx.lineTo(16, 46);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.restore();
  }

  function drawBall() {
    let x = BALL_HOME.x;
    let y = BALL_HOME.y;
    let scale = 1;
    if (state.phase === 'flight' || state.phase === 'ai') {
      const t = Math.min(1, state.flight / 0.62);
      const ease = t * t * (3 - 2 * t);
      x = state.shotFrom.x + (state.shotTo.x - state.shotFrom.x) * ease;
      y = state.shotFrom.y + (state.shotTo.y - state.shotFrom.y) * ease - Math.sin(ease * Math.PI) * 34;
      scale = 1 - ease * 0.72;
    } else if (state.phase === 'result') {
      x = state.shotTo.x;
      y = state.shotTo.y;
      scale = 0.28;
    }
    const r = 15 * scale;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(x - r * 0.25, y - r * 0.2, r * 0.28, 0, Math.PI * 2);
    ctx.arc(x + r * 0.3, y + r * 0.15, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function draw() {
    // Stadium
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#0b1026');
    sky.addColorStop(0.55, '#112a4a');
    sky.addColorStop(1, '#0a3a24');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Crowd dots
    for (let i = 0; i < 110; i += 1) {
      const x = (i * 83) % W;
      const y = 30 + ((i * 47) % 92);
      ctx.fillStyle = ['#1e293b', '#334155', '#4c1d95', '#7c2d12'][i % 4];
      ctx.fillRect(x, y, 5, 4);
    }

    // Pitch
    const pitch = ctx.createLinearGradient(0, 330, 0, H);
    pitch.addColorStop(0, '#166534');
    pitch.addColorStop(1, '#14532d');
    ctx.fillStyle = pitch;
    ctx.fillRect(0, 330, W, H - 330);
    ctx.strokeStyle = 'rgba(226,232,240,0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(20, H - 30);
    ctx.lineTo(20, 330);
    ctx.moveTo(W - 20, H - 30);
    ctx.lineTo(W - 20, 330);
    ctx.stroke();

    // Penalty box lines
    ctx.strokeStyle = 'rgba(226,232,240,0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(44, 330, W - 88, 250);
    ctx.beginPath();
    ctx.arc(W / 2, 552, 76, Math.PI, 0);
    ctx.stroke();

    drawGoal();
    drawKeeper();

    // Aim reticle
    if (state.phase === 'aim') {
      const { x, y } = state.aim;
      ctx.save();
      ctx.strokeStyle = state.charging ? '#facc15' : '#22d3ee';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 14 + state.charge * 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 22, y);
      ctx.lineTo(x - 6, y);
      ctx.moveTo(x + 6, y);
      ctx.lineTo(x + 22, y);
      ctx.moveTo(x, y - 22);
      ctx.lineTo(x, y - 6);
      ctx.moveTo(x, y + 6);
      ctx.lineTo(x, y + 22);
      ctx.stroke();
      ctx.restore();

      // Power bar
      ctx.fillStyle = 'rgba(2,6,23,0.65)';
      ctx.fillRect(160, 594, 160, 14);
      const power = ctx.createLinearGradient(160, 0, 320, 0);
      power.addColorStop(0, '#a3e635');
      power.addColorStop(0.6, '#facc15');
      power.addColorStop(1, '#f43f5e');
      ctx.fillStyle = power;
      ctx.fillRect(162, 596, 156 * state.charge, 10);
    }

    drawBall();

    // Scoreboard
    ctx.fillStyle = 'rgba(2, 6, 23, 0.62)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(W / 2 - 92, 18, 184, 46, 10);
    else ctx.rect(W / 2 - 92, 18, 184, 46);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.font = '900 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`YOU ${state.playerGoals}  ·  CPU ${state.aiGoals}`, W / 2, 49);
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,0.85)';
    const kickNumber = Math.min(5, state.history.filter((h) => !h.ai).length + (state.phase === 'aim' ? 1 : 0));
    ctx.fillText(state.suddenDeath ? 'SUDDEN DEATH' : `ROUND ${Math.max(1, kickNumber)} OF 5`, W / 2, 92);

    if (state.resultText) {
      ctx.fillStyle = state.resultText === 'GOAL!' ? '#a3e635' : '#f8fafc';
      ctx.font = '900 34px system-ui, sans-serif';
      ctx.strokeStyle = 'rgba(2,6,23,0.6)';
      ctx.lineWidth = 5;
      ctx.strokeText(state.resultText, W / 2, 360);
      ctx.fillText(state.resultText, W / 2, 360);
    }
  }

  api.loop((dt) => {
    if (dt > 0 && api.canPlay()) update(dt);
    draw();
  });

  function setAimFromEvent(event) {
    if (state.phase !== 'aim' || !api.canPlay()) return;
    const pos = api.pointerPos(event);
    state.aim.x = Math.max(40, Math.min(W - 40, pos.x));
    state.aim.y = Math.max(90, Math.min(GOAL.y + GOAL.h + 50, pos.y));
  }

  api.stage.addEventListener('pointermove', (event) => {
    if (api.isTouch) return;
    setAimFromEvent(event);
  });
  api.stage.addEventListener('pointerdown', (event) => {
    if (!api.canPlay() || state.phase !== 'aim') return;
    event.preventDefault();
    setAimFromEvent(event);
    state.charging = true;
    state.charge = 0.15;
  });
  window.addEventListener('pointerup', () => {
    if (!api.canPlay() || state.phase !== 'aim') return;
    if (!state.charging) return;
    state.charging = false;
    shoot();
  });

  window.addEventListener('keydown', (event) => {
    if (!api.canPlay()) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      state.keys.add(event.key);
    } else if (event.key === ' ' || event.key === 'Spacebar' || event.code === 'Space') {
      event.preventDefault();
      if (state.phase === 'aim' && !state.charging) {
        state.charging = true;
        state.charge = 0.15;
      }
    }
  });
  window.addEventListener('keyup', (event) => {
    state.keys.delete(event.key);
    if ((event.key === ' ' || event.key === 'Spacebar' || event.code === 'Space') && state.charging && state.phase === 'aim') {
      state.charging = false;
      shoot();
    }
  });

  if (api.isTouch) {
    const row = document.createElement('div');
    row.className = 'touch-row';
    row.innerHTML = `<button class="touch-btn wide" type="button" aria-label="Shoot">Hold to shoot</button>`;
    const btn = row.querySelector('button');
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (state.phase === 'aim') {
        state.charging = true;
        state.charge = 0.15;
      }
    });
    btn.addEventListener('pointerup', (e) => {
      e.preventDefault();
      if (state.charging && state.phase === 'aim') {
        state.charging = false;
        shoot();
      }
    });
    api.addControls(row);
  }

  reset();
  return {
    start() { reset(); },
    restart() { reset(); },
  };
}
