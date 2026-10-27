/**
 * Cookie Clicker — original idle clicker.
 * Eight producers, one-time upgrades, milestones, offline earnings and auto-save.
 */

const PRODUCERS = [
  { id: 'cursor', name: 'Cursor', icon: '👆', baseCost: 15, cps: 0.1, blurb: 'Clicks the cookie for you.' },
  { id: 'grandma', name: 'Grandma', icon: '👵', baseCost: 100, cps: 1, blurb: 'Bakes with love (and butter).' },
  { id: 'farm', name: 'Farm', icon: '🌾', baseCost: 1100, cps: 8, blurb: 'Grows cookie plants.' },
  { id: 'mine', name: 'Mine', icon: '⛏️', baseCost: 12000, cps: 47, blurb: 'Digs up chocolate chips.' },
  { id: 'factory', name: 'Factory', icon: '🏭', baseCost: 130000, cps: 260, blurb: 'Mass-produced deliciousness.' },
  { id: 'bank', name: 'Bank', icon: '🏦', baseCost: 1.4e6, cps: 1400, blurb: 'Invests in cookie futures.' },
  { id: 'temple', name: 'Temple', icon: '🛕', baseCost: 20e6, cps: 7800, blurb: 'Worships the crumb.' },
  { id: 'portal', name: 'Portal', icon: '🌀', baseCost: 330e6, cps: 44000, blurb: 'Imports cookies from dimension C.' },
];

const UPGRADES = [
  { id: 'click1', name: 'Reinforced index finger', desc: 'Clicking is twice as effective.', cost: 100, kind: 'click' },
  { id: 'click2', name: 'Carpal tunnel prevention', desc: 'Clicking is twice as effective again.', cost: 5000, kind: 'click' },
  { id: 'click3', name: 'Ambidextrous', desc: 'Clicking is twice as effective again.', cost: 100000, kind: 'click' },
  ...PRODUCERS.map((p) => ({
    id: `up-${p.id}`,
    name: `${p.name} upgrade`,
    desc: `${p.name}s produce twice as many cookies.`,
    cost: Math.ceil(p.baseCost * 12),
    kind: 'producer',
    target: p.id,
  })),
];

const format = (value) => {
  if (!Number.isFinite(value)) return '0';
  const units = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];
  let n = Math.max(0, value);
  let i = 0;
  while (n >= 1000 && i < units.length - 1) { n /= 1000; i += 1; }
  return `${n >= 100 ? Math.round(n) : n.toFixed(n >= 10 ? 1 : 2)}${units[i]}`;
};

const MILESTONES = [100, 1000, 10000, 100000, 1e6, 1e7, 1e9, 1e12];

export default function createGame(api) {
  const wrap = document.createElement('div');
  wrap.className = 'cc-wrap';
  wrap.innerHTML = `
    <div class="cc-left">
      <button class="cc-cookie" type="button" aria-label="Bake a cookie">🍪</button>
      <div class="cc-cps"><strong data-readout="cps">0</strong> cookies / second</div>
      <div class="cc-stat">Click power <strong data-readout="click">1</strong></div>
      <div class="cc-stat">Total baked <strong data-readout="total">0</strong></div>
      <div class="board-tools">
        <button class="board-btn" type="button" data-act="save">Save</button>
        <button class="board-btn" type="button" data-act="reset">Reset</button>
      </div>
      <p class="g2048-hint">Click the cookie · buy producers and upgrades · auto-saves</p>
    </div>
    <div class="cc-store">
      <div class="cc-store-head"><span>Store</span><span data-readout="cookies">0 cookies</span></div>
      <div class="cc-items" data-list="producers"></div>
      <div class="cc-store-head cc-upgrade-head"><span>Upgrades</span><span>one-time</span></div>
      <div class="cc-items" data-list="upgrades"></div>
    </div>`;
  api.area.appendChild(wrap);
  api.initDOM({ aspect: '16 / 10', maxWidth: 980, autoHeight: false });
  api.setBestMode('higher');

  const cookieBtn = wrap.querySelector('.cc-cookie');
  const cpsOut = wrap.querySelector('[data-readout="cps"]');
  const clickOut = wrap.querySelector('[data-readout="click"]');
  const totalOut = wrap.querySelector('[data-readout="total"]');
  const cookiesOut = wrap.querySelector('[data-readout="cookies"]');
  const prodList = wrap.querySelector('[data-list="producers"]');
  const upgradeList = wrap.querySelector('[data-list="upgrades"]');

  let cookies = 0;
  let total = 0;
  let owned = Object.fromEntries(PRODUCERS.map((p) => [p.id, 0]));
  let bought = new Set();
  let milestoneIndex = 0;
  let clickPower = 1;
  let lastSave = Date.now();
  let dirty = false;

  function costOf(producer) {
    return Math.ceil(producer.baseCost * Math.pow(1.15, owned[producer.id]));
  }

  function producerCps(producer) {
    return owned[producer.id] * producer.cps * (bought.has(`up-${producer.id}`) ? 2 : 1);
  }

  function cps() {
    return PRODUCERS.reduce((sum, producer) => sum + producerCps(producer), 0);
  }

  function updateClickPower() {
    let power = 1;
    ['click1', 'click2', 'click3'].forEach((id) => { if (bought.has(id)) power *= 2; });
    clickPower = power;
    clickOut.textContent = format(clickPower);
  }

  function save() {
    const data = {
      cookies, total, owned, bought: [...bought], milestoneIndex, lastSave: Date.now(),
    };
    api.storageSet('save', data);
    lastSave = data.lastSave;
    dirty = false;
  }

  function load() {
    const data = api.storageGet('save', null);
    if (!data) return false;
    cookies = Number(data.cookies) || 0;
    total = Number(data.total) || 0;
    owned = { ...owned, ...(data.owned || {}) };
    bought = new Set(data.bought || []);
    milestoneIndex = Number(data.milestoneIndex) || 0;
    lastSave = Number(data.lastSave) || Date.now();
    const seconds = Math.min(4 * 3600, Math.max(0, (Date.now() - lastSave) / 1000));
    const offline = cps() * seconds * 0.4;
    if (offline > 1) {
      cookies += offline;
      total += offline;
      api.setStatus(`Welcome back — your bakery earned ${format(offline)} cookies offline`);
    }
    return true;
  }

  function toast(message) {
    const el = document.createElement('div');
    el.className = 'cc-toast';
    el.textContent = message;
    wrap.appendChild(el);
    window.setTimeout(() => el.remove(), 2200);
  }

  function buildStore() {
    PRODUCERS.forEach((producer) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'cc-item';
      item.dataset.producer = producer.id;
      item.innerHTML = `
        <span class="cc-item-icon">${producer.icon}</span>
        <span class="cc-item-main">
          <span class="cc-item-name">${producer.name} <em data-owned>0</em></span>
          <span class="cc-item-blurb">${producer.blurb}</span>
        </span>
        <span class="cc-item-cost" data-cost>0</span>`;
      item.addEventListener('click', () => buyProducer(producer));
      prodList.appendChild(item);
    });
    UPGRADES.forEach((upgrade) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'cc-item cc-upgrade';
      item.dataset.upgrade = upgrade.id;
      item.innerHTML = `
        <span class="cc-item-icon">✨</span>
        <span class="cc-item-main">
          <span class="cc-item-name">${upgrade.name}</span>
          <span class="cc-item-blurb">${upgrade.desc}</span>
        </span>
        <span class="cc-item-cost" data-cost>${format(upgrade.cost)}</span>`;
      item.addEventListener('click', () => buyUpgrade(upgrade));
      upgradeList.appendChild(item);
    });
  }

  function refresh() {
    const perSecond = cps();
    cpsOut.textContent = format(perSecond);
    totalOut.textContent = format(total);
    cookiesOut.textContent = `${format(cookies)} cookies`;
    api.setScore(cookies, 'Cookies');
    api.saveBest(cookies);

    prodList.querySelectorAll('[data-producer]').forEach((el) => {
      const producer = PRODUCERS.find((p) => p.id === el.dataset.producer);
      const cost = costOf(producer);
      el.querySelector('[data-owned]').textContent = String(owned[producer.id]);
      el.querySelector('[data-cost]').textContent = format(cost);
      el.disabled = cookies < cost;
      el.setAttribute('aria-label', `Buy ${producer.name} for ${format(cost)} cookies`);
    });
    upgradeList.querySelectorAll('[data-upgrade]').forEach((el) => {
      const upgrade = UPGRADES.find((u) => u.id === el.dataset.upgrade);
      const isBought = bought.has(upgrade.id);
      el.classList.toggle('is-bought', isBought);
      el.querySelector('[data-cost]').textContent = isBought ? 'Owned' : format(upgrade.cost);
      el.disabled = isBought || cookies < upgrade.cost;
    });
  }

  function bake(amount, x, y) {
    cookies += amount;
    total += amount;
    dirty = true;
    api.sfx('click');
    const floater = document.createElement('span');
    floater.className = 'cc-floater';
    floater.textContent = `+${format(amount)}`;
    if (x != null) {
      floater.style.left = `${x}px`;
      floater.style.top = `${y}px`;
    }
    wrap.appendChild(floater);
    window.setTimeout(() => floater.remove(), 900);
    checkMilestones();
    refresh();
  }

  function checkMilestones() {
    while (milestoneIndex < MILESTONES.length && total >= MILESTONES[milestoneIndex]) {
      toast(`Milestone: ${format(MILESTONES[milestoneIndex])} cookies baked!`);
      milestoneIndex += 1;
    }
  }

  function buyProducer(producer) {
    const cost = costOf(producer);
    if (cookies < cost) return;
    cookies -= cost;
    owned[producer.id] += 1;
    dirty = true;
    api.sfx('score');
    refresh();
  }

  function buyUpgrade(upgrade) {
    if (bought.has(upgrade.id) || cookies < upgrade.cost) return;
    cookies -= upgrade.cost;
    bought.add(upgrade.id);
    dirty = true;
    api.sfx('win');
    updateClickPower();
    refresh();
  }

  cookieBtn.addEventListener('click', (event) => {
    const rect = cookieBtn.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    bake(clickPower, event.clientX - wrapRect.left, event.clientY - wrapRect.top);
    cookieBtn.classList.remove('is-pressed');
    void cookieBtn.offsetWidth;
    cookieBtn.classList.add('is-pressed');
  });

  wrap.querySelector('[data-act="save"]').addEventListener('click', () => {
    save();
    toast('Game saved');
  });
  wrap.querySelector('[data-act="reset"]').addEventListener('click', () => {
    if (!confirm('Reset your cookie empire? This cannot be undone.')) return;
    cookies = 0;
    total = 0;
    owned = Object.fromEntries(PRODUCERS.map((p) => [p.id, 0]));
    bought = new Set();
    milestoneIndex = 0;
    updateClickPower();
    save();
    refresh();
    api.setScore(0, 'Cookies');
  });

  buildStore();
  const loaded = load();
  updateClickPower();
  refresh();
  api.setStatus(loaded ? 'Bakery loaded — cookies keep coming' : 'Click the cookie to start your empire');
  if (loaded) toast('Bakery restored from your last save');
  api.saveBest(cookies);
  api.setBest(api.storageGet('best', cookies), 'Best');

  api.every(100, () => {
    const gain = cps() * 0.1;
    if (gain > 0) {
      cookies += gain;
      total += gain;
      dirty = true;
      checkMilestones();
      refresh();
    }
  });
  api.every(5000, () => { if (dirty) save(); });
  window.addEventListener('beforeunload', save);

  return {
    start() {
      refresh();
      api.setStatus('Click the cookie to bake');
    },
    restart() {
      refresh();
    },
  };
}
