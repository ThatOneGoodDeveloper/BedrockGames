/**
 * Pac-Man — original HTML5 maze chase.
 * Tile-based movement, four ghosts with distinct targets, power pellets,
 * lives, levels and both keyboard and touch controls.
 */

const TILE = 26;
const COLS = 19;
const ROWS = 21;
const TOP = 46;
const W = COLS * TILE;
const H = TOP + ROWS * TILE;

const MAZE = [
  '###################',
  '#........#........#',
  '#o##.###.#.###.##o#',
  '#.................#',
  '#.##.#.#####.#.##.#',
  '#....#...#...#....#',
  '####.### # ###.####',
  '   #.#       #.#   ',
  '####.# ##-## #.####',
  '    .  #   #  .    ',
  '####.# ##### #.####',
  '   #.#       #.#   ',
  '####.# ##### #.####',
  '#........#........#',
  '#.##.###.#.###.##.#',
  '#o.#.......P...#.o#',
  '##.#.#.#####.#.#.##',
  '#....#...#...#....#',
  '#.######.#.######.#',
  '#.................#',
  '###################',
];

const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const GHOST_COLORS = ['#ef4444', '#f9a8d4', '#22d3ee', '#fb923c'];

export default function createGame(api) {
  const { ctx } = api.initCanvas(W, H);
  api.setBestMode('higher');

  let pellets;
  let powerPellets;
  let player;
  let ghosts;
  let score;
  let lives;
  let level;
  let frightenedTimer;
  let ghostCombo;
  let modeTimer;
  let mode;
  let freeze;
  let dead;

  function resetMaze() {
    pellets = new Set();
    powerPellets = new Set();
    MAZE.forEach((row, r) => {
      row.split('').forEach((ch, c) => {
        if (ch === '.') pellets.add(`${c},${r}`);
        if (ch === 'o') powerPellets.add(`${c},${r}`);
      });
    });
  }

  function resetActors() {
    player = {
      col: 11, row: 15, dir: { ...DIRS.right }, next: { ...DIRS.right }, progress: 0, speed: 5.4,
    };
    const spots = [
      { col: 9, row: 7, release: 0 },
      { col: 7, row: 7, release: 0.8 },
      { col: 11, row: 7, release: 1.6 },
      { col: 12, row: 7, release: 2.4 },
    ];
    ghosts = spots.map((spot, index) => ({
      col: spot.col,
      row: spot.row,
      dir: { ...DIRS.up },
      progress: 0,
      speed: 4.4 + (level - 1) * 0.22,
      release: spot.release,
      timer: 0,
      state: 'wait',
      home: index,
    }));
    frightenedTimer = 0;
    ghostCombo = 0;
    mode = 'chase';
    modeTimer = 0;
    freeze = 0;
  }

  function resetLevel(full = true) {
    if (full) {
      score = 0;
      lives = 3;
      level = 1;
      dead = false;
      api.setScore(0, 'Score');
    }
    resetMaze();
    resetActors();
    api.setStatus('Clear every pellet. Power pellets make ghosts edible.');
  }

  function isWall(col, row, ghost = false) {
    if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return true;
    const ch = MAZE[row][col];
    if (ch === '#') return true;
    if (ch === '-') return !ghost;
    return false;
  }

  function centerOf(entity) {
    return {
      x: (entity.col + 0.5 + entity.dir.x * entity.progress) * TILE,
      y: TOP + (entity.row + 0.5 + entity.dir.y * entity.progress) * TILE,
    };
  }

  function canTurn(entity, dir, ghost = false) {
    return !isWall(entity.col + dir.x, entity.row + dir.y, ghost);
  }

  function opposite(dir) {
    return dir.x === -player.dir.x && dir.y === -player.dir.y;
  }

  function choosePlayerDir() {
    if (player.next && canTurn(player, player.next)) {
      player.dir = { ...player.next };
    }
  }

  function ghostTarget(ghost) {
    if (ghost.state === 'eyes') return { col: 9, row: 7 };
    if (mode === 'scatter') {
      const corners = [
        { col: 1, row: 1 },
        { col: 17, row: 1 },
        { col: 1, row: 19 },
        { col: 17, row: 19 },
      ];
      return corners[ghost.home];
    }
    switch (ghost.home) {
      case 0:
        return { col: player.col, row: player.row };
      case 1:
        return { col: player.col + player.dir.x * 4, row: player.row + player.dir.y * 4 };
      case 2: {
        const target = { col: player.col + player.dir.x * 2, row: player.row + player.dir.y * 2 };
        return { col: target.col * 2 - ghost.col, row: target.row * 2 - ghost.row };
      }
      default: {
        const distance = Math.hypot(player.col - ghost.col, player.row - ghost.row);
        return distance > 7
          ? { col: player.col, row: player.row }
          : { col: 1, row: 19 };
      }
    }
  }

  function chooseGhostDir(ghost, force = false) {
    if (ghost.state === 'eyes' && ghost.col === 9 && ghost.row === 7) {
      ghost.state = 'chase';
      ghost.speed = 4.4 + (level - 1) * 0.22;
    }
    if (ghost.state === 'wait') return;

    const target = ghost.state === 'frightened'
      ? { col: COLS - player.col, row: ROWS - player.row }
      : ghostTarget(ghost);
    const options = Object.values(DIRS).filter((dir) => {
      if (isWall(ghost.col + dir.x, ghost.row + dir.y, true)) return false;
      if (!force && ghost.dir && dir.x === -ghost.dir.x && dir.y === -ghost.dir.y) return false;
      return true;
    });
    if (!options.length) {
      ghost.dir = { x: -ghost.dir.x, y: -ghost.dir.y };
      return;
    }
    let best = options[0];
    let bestScore = ghost.state === 'frightened' ? -Infinity : Infinity;
    options.forEach((dir) => {
      const d = Math.hypot(target.col - (ghost.col + dir.x), target.row - (ghost.row + dir.y));
      const value = ghost.state === 'frightened' ? d : d + Math.random() * 0.02;
      if ((ghost.state === 'frightened' ? value > bestScore : value < bestScore)) {
        bestScore = value;
        best = dir;
      }
    });
    ghost.dir = { ...best };
  }

  function advancePlayer(dt) {
    if (player.dir.x === 0 && player.dir.y === 0) {
      choosePlayerDir();
      if (player.dir.x === 0 && player.dir.y === 0) return;
    }
    player.progress += player.speed * dt;
    let guard = 0;
    while (player.progress >= 1 && guard < 8) {
      guard += 1;
      const nc = player.col + player.dir.x;
      const nr = player.row + player.dir.y;
      if (isWall(nc, nr)) {
        player.progress = 0;
        player.dir = { x: 0, y: 0 };
        choosePlayerDir();
        break;
      }
      player.col = nc;
      player.row = nr;
      player.progress -= 1;
      eatAt(player.col, player.row);
      choosePlayerDir();
      if (player.dir.x === 0 && player.dir.y === 0) {
        player.progress = 0;
        break;
      }
    }
  }

  function advanceGhost(ghost, dt) {
    if (ghost.state === 'wait') {
      ghost.timer += dt;
      if (ghost.timer >= ghost.release) {
        ghost.state = 'chase';
        chooseGhostDir(ghost, true);
      }
      return;
    }
    if (ghost.state === 'eyes' && ghost.col === 9 && ghost.row === 7) {
      ghost.state = 'chase';
      ghost.speed = 4.4 + (level - 1) * 0.22;
    }
    const speed = ghost.state === 'eyes' ? 8.5 : ghost.state === 'frightened' ? 2.9 : ghost.speed;
    ghost.progress += speed * dt;
    let guard = 0;
    while (ghost.progress >= 1 && guard < 8) {
      guard += 1;
      const nc = ghost.col + ghost.dir.x;
      const nr = ghost.row + ghost.dir.y;
      if (isWall(nc, nr, true)) {
        ghost.progress = 0;
        chooseGhostDir(ghost, true);
        if (isWall(ghost.col + ghost.dir.x, ghost.row + ghost.dir.y, true)) break;
        continue;
      }
      ghost.col = nc;
      ghost.row = nr;
      ghost.progress -= 1;
      chooseGhostDir(ghost);
    }
  }

  function eatAt(col, row) {
    const key = `${col},${row}`;
    if (pellets.delete(key)) {
      score += 10;
      api.setScore(score, 'Score');
      api.sfx('click');
    }
    if (powerPellets.delete(key)) {
      score += 50;
      frightenedTimer = 7.5;
      ghostCombo = 0;
      ghosts.forEach((g) => {
        if (g.state === 'chase' || g.state === 'frightened') {
          g.state = 'frightened';
          g.dir = { x: -g.dir.x, y: -g.dir.y };
        }
      });
      api.setScore(score, 'Score');
      api.sfx('pickup');
    }
    const remaining = pellets.size + powerPellets.size;
    if (remaining === 0) {
      api.sfx('win');
      level += 1;
      resetMaze();
      resetActors();
      api.setStatus(`Level ${level} — the ghosts are faster now`);
    }
  }

  function respawnPlayer() {
    player = { col: 11, row: 15, dir: { ...DIRS.right }, next: { ...DIRS.right }, progress: 0, speed: 5.4 };
    ghosts.forEach((g) => {
      g.state = 'wait';
      g.timer = 0;
      g.release = 0.6 + g.home * 0.55;
      g.progress = 0;
    });
    freeze = 1.2;
    frightenedTimer = 0;
  }

  function checkCollisions() {
    if (freeze > 0 || dead) return;
    ghosts.forEach((ghost) => {
      if (ghost.state === 'wait' || ghost.state === 'eyes') return;
      const distance = Math.hypot(ghost.col - player.col, ghost.row - player.row)
        + Math.hypot(ghost.dir.x * ghost.progress - player.dir.x * player.progress, ghost.dir.y * ghost.progress - player.dir.y * player.progress);
      if (distance > 0.78) return;
      if (ghost.state === 'frightened') {
        ghostCombo += 1;
        const points = 200 * 2 ** (ghostCombo - 1);
        score += points;
        ghost.state = 'eyes';
        ghost.dir = { x: 0, y: 0 };
        api.setScore(score, 'Score');
        api.sfx('pickup');
        return;
      }
      lives -= 1;
      api.sfx('lose');
      if (lives <= 0) {
        dead = true;
        api.gameOver({
          score,
          title: 'The ghosts got you',
          message: `${score.toLocaleString()} points · Level ${level}. Keep an eye on the side tunnels.`,
        });
      } else {
        respawnPlayer();
        api.setStatus(`Ouch! ${lives} ${lives === 1 ? 'life' : 'lives'} left`);
      }
    });
  }

  function update(dt) {
    if (freeze > 0) {
      freeze -= dt;
      return;
    }
    if (frightenedTimer > 0) {
      frightenedTimer -= dt;
      if (frightenedTimer <= 0) {
        ghosts.forEach((g) => {
          if (g.state === 'frightened') g.state = 'chase';
        });
      }
    }
    modeTimer += dt;
    const phase = mode === 'chase' ? 8 : 5;
    if (modeTimer >= phase) {
      modeTimer = 0;
      mode = mode === 'chase' ? 'scatter' : 'chase';
    }
    advancePlayer(dt);
    ghosts.forEach((ghost) => advanceGhost(ghost, dt));
    checkCollisions();
  }

  function drawMaze(time) {
    ctx.fillStyle = '#05070f';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#081120';
    ctx.fillRect(0, 0, W, TOP);

    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const ch = MAZE[r][c];
        const x = c * TILE;
        const y = TOP + r * TILE;
        if (ch === '#') {
          const grad = ctx.createLinearGradient(x, y, x, y + TILE);
          grad.addColorStop(0, '#1e3a8a');
          grad.addColorStop(1, '#1e40af');
          ctx.fillStyle = grad;
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.65)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(x + 1.5, y + 1.5, TILE - 3, TILE - 3, 4);
          else ctx.rect(x + 1.5, y + 1.5, TILE - 3, TILE - 3);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = 'rgba(147, 197, 253, 0.13)';
          ctx.fillRect(x + 4, y + 4, TILE - 8, 3);
        } else if (ch === '-') {
          ctx.fillStyle = '#f9a8d4';
          ctx.fillRect(x + 2, y + TILE / 2 - 2, TILE - 4, 4);
        }
        if (pellets.has(`${c},${r}`)) {
          ctx.fillStyle = '#fde68a';
          ctx.beginPath();
          ctx.arc(x + TILE / 2, y + TILE / 2, 2.7, 0, Math.PI * 2);
          ctx.fill();
        }
        if (powerPellets.has(`${c},${r}`)) {
          const pulse = 1 + Math.sin(time / 160) * 0.2;
          ctx.save();
          ctx.shadowColor = '#fde047';
          ctx.shadowBlur = 14;
          ctx.fillStyle = '#fde047';
          ctx.beginPath();
          ctx.arc(x + TILE / 2, y + TILE / 2, 6 * pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }
  }

  function drawPlayer(time) {
    const pos = centerOf(player);
    let angle = 0;
    if (player.dir.x === -1) angle = Math.PI;
    else if (player.dir.y === -1) angle = -Math.PI / 2;
    else if (player.dir.y === 1) angle = Math.PI / 2;
    const mouth = 0.08 + Math.abs(Math.sin(time / 70)) * 0.42;
    const radius = TILE * 0.42;
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(angle);
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, mouth, Math.PI * 2 - mouth);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0b1220';
    ctx.beginPath();
    ctx.arc(radius * 0.5, -radius * 0.42, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawGhost(ghost, time) {
    const pos = centerOf(ghost);
    const x = pos.x;
    const y = pos.y;
    const r = TILE * 0.4;
    const frightened = ghost.state === 'frightened';
    const flash = frightened && frightenedTimer < 2 && Math.floor(time / 180) % 2 === 0;
    const color = ghost.state === 'eyes' ? 'transparent' : frightened ? (flash ? '#e2e8f0' : '#3b82f6') : GHOST_COLORS[ghost.home];

    ctx.save();
    if (color !== 'transparent') {
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(x, y - r * 0.15, r, Math.PI, 0);
      ctx.lineTo(x + r, y + r * 0.75);
      for (let i = 0; i < 3; i += 1) {
        const step = (r * 2) / 3;
        const bx = x + r - step * i - step / 2;
        ctx.quadraticCurveTo(bx + step / 4, y + r * 0.5, bx - step / 2, y + r * 0.75);
      }
      ctx.lineTo(x - r, y - r * 0.15);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    // eyes
    const ex = 4.2;
    const ey = -2;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x - ex, y + ey, 3.6, 0, Math.PI * 2);
    ctx.arc(x + ex, y + ey, 3.6, 0, Math.PI * 2);
    ctx.fill();
    if (frightened && !flash) {
      ctx.fillStyle = '#f9fafb';
      ctx.beginPath();
      ctx.arc(x, y + 6, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#111827';
      const dx = ghost.dir.x * 1.6;
      const dy = ghost.dir.y * 1.6;
      ctx.beginPath();
      ctx.arc(x - ex + dx, y + ey + dy, 1.8, 0, Math.PI * 2);
      ctx.arc(x + ex + dx, y + ey + dy, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawHud() {
    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 15px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${score.toLocaleString()}`, 12, 27);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fde68a';
    ctx.fillText(`LEVEL ${level}`, W / 2, 27);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText('LIVES', W - 78, 27);
    for (let i = 0; i < Math.min(lives, 4); i += 1) {
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(W - 58 + i * 17, 22, 6, 0.25, Math.PI * 2 - 0.25);
      ctx.lineTo(W - 58 + i * 17, 22);
      ctx.fill();
    }
  }

  api.loop((dt, now) => {
    if (dt > 0 && !dead && !api.over) update(dt);
    drawMaze(now);
    ghosts.forEach((g) => drawGhost(g, now));
    drawPlayer(now);
    drawHud();
    if (freeze > 0) {
      ctx.fillStyle = 'rgba(4,7,14,0.4)';
      ctx.fillRect(0, TOP, W, H - TOP);
    }
  });

  function setDir(name) {
    if (!api.canPlay() || dead) return;
    const dir = DIRS[name];
    if (!dir) return;
    player.next = { ...dir };
    if (player.dir.x === 0 && player.dir.y === 0) player.dir = { ...dir };
    // Allow an instant turn when lined up with the tile center.
    if (player.progress < 0.18 && canTurn(player, dir)) {
      player.dir = { ...dir };
      player.progress = 0;
    }
  }

  function onKey(event) {
    if (!api.canPlay() || dead) return;
    const map = {
      ArrowUp: 'up', w: 'up', W: 'up',
      ArrowDown: 'down', s: 'down', S: 'down',
      ArrowLeft: 'left', a: 'left', A: 'left',
      ArrowRight: 'right', d: 'right', D: 'right',
    };
    if (map[event.key]) {
      event.preventDefault();
      setDir(map[event.key]);
    }
  }
  window.addEventListener('keydown', onKey);

  let swipeStart = null;
  api.stage.addEventListener('pointerdown', (event) => {
    swipeStart = { x: event.clientX, y: event.clientY };
  });
  api.stage.addEventListener('pointerup', (event) => {
    if (!swipeStart || !api.canPlay()) return;
    const dx = event.clientX - swipeStart.x;
    const dy = event.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
    if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 'right' : 'left');
    else setDir(dy > 0 ? 'down' : 'up');
  });

  if (api.isTouch) {
    const pad = document.createElement('div');
    pad.className = 'touch-pad';
    pad.innerHTML = `
      <button class="touch-btn tp-up" type="button" aria-label="Up">▲</button>
      <button class="touch-btn tp-left" type="button" aria-label="Left">◀</button>
      <button class="touch-btn tp-down" type="button" aria-label="Down">▼</button>
      <button class="touch-btn tp-right" type="button" aria-label="Right">▶</button>`;
    const dirs = { 'tp-up': 'up', 'tp-left': 'left', 'tp-down': 'down', 'tp-right': 'right' };
    pad.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        const cls = [...btn.classList].find((c) => dirs[c]);
        setDir(dirs[cls]);
      });
    });
    api.addControls(pad);
  }

  resetLevel(true);
  return {
    start() { resetLevel(true); },
    restart() { resetLevel(true); },
  };
}
