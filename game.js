/* Hill Bound — vanilla JS + Canvas physics driving game */
(() => {
'use strict';
const $ = id => document.getElementById(id);

// ---------------- Data ----------------
const VEHICLES = [
  { id:'buggy', name:'Trail Buggy', price:0, color:'#e84c4f', trim:'#ffd23f', desc:'Stable, punchy and easy to control.',
    speed:1.05, accel:1.18, mass:1.0, grip:1.18, susp:1.15, wheelR:20, w:112, h:34 },
  { id:'mud', name:'Mud Crusher', price:500, color:'#31a66c', trim:'#173f49', desc:'Strong torque and deep suspension.',
    speed:0.92, accel:1.38, mass:1.48, grip:1.42, susp:1.48, wheelR:27, w:132, h:42 },
  { id:'rocket', name:'Roadster X', price:1200, color:'#f1ad2d', trim:'#e65332', desc:'Fast on smooth ground, lively in air.',
    speed:1.48, accel:1.23, mass:0.82, grip:1.02, susp:0.9, wheelR:17, w:124, h:28 },
  { id:'moto', name:'Dirt Hopper', price:2500, color:'#3288e6', trim:'#ffd23f', desc:'Agile, light and built for tricks.',
    speed:1.3, accel:1.4, mass:0.64, grip:1.18, susp:1.2, wheelR:19, w:88, h:23, air:1.8 },
  { id:'monster',name:'Titan 4X4',price:4000, color:'#8657b8', trim:'#e84864', desc:'Massive tires flatten rough climbs.',
    speed:1.12, accel:1.52, mass:1.82, grip:1.58, susp:1.72, wheelR:34, w:142, h:43 },
];
const STAGES = [
  { id:'country', name:'Countryside', price:0,    g:900, grip:1,    rough:1,   sky:['#4fb8ff','#c9f0ff'], hills:['#9fd8b4','#79c28f'], dirt:'#8b5a2b', dirt2:'#7a4d23', grass:'#3f9b2e', grass2:'#6fd34f', sun:'#fff3a8' },
  { id:'desert',  name:'Desert',      price:800,  g:900, grip:0.9,  rough:1.3, sky:['#ffb26b','#ffe6b3'], hills:['#f3c98b','#e0a95f'], dirt:'#d9a05b', dirt2:'#c48a45', grass:'#b87a35', grass2:'#f2c078', sun:'#fff' },
  { id:'arctic',  name:'Arctic',      price:2000, g:900, grip:0.65, rough:1.2, sky:['#7fb7e6','#e8f6ff'], hills:['#d4e9f7','#b5d3ea'], dirt:'#6f8fa8', dirt2:'#5d7c94', grass:'#cfe8f7', grass2:'#ffffff', sun:'#fff' },
  { id:'moon',    name:'The Moon',    price:3500, g:420, grip:0.9,  rough:1.5, sky:['#05051a','#262a4a'], hills:['#3c3f55','#50546e'], dirt:'#777a8c', dirt2:'#5f6275', grass:'#9a9db0', grass2:'#c8cad6', sun:'#e8e8ff', stars:true },
];
let stage = STAGES[0];
const CHARS = [
  { id:'rex',   name:'Rex',     price:0,    skin:'#ffd6a5', color:'#e63946', type:'cap' },
  { id:'luna',  name:'Luna',    price:0,    skin:'#f1c27d', color:'#ff5da2', type:'bow' },
  { id:'bolt',  name:'Bolt',    price:0,    skin:'#b8c4d6', color:'#3a86ff', type:'robot' },
  { id:'ziggy', name:'Ziggy',   price:300,  skin:'#8ee58e', color:'#7b2cbf', type:'alien' },
  { id:'patch', name:'Captain Patch', price:600, skin:'#e0ac69', color:'#222', type:'pirate' },
  { id:'kage',  name:'Kage',    price:900,  skin:'#ffd6a5', color:'#1b1b2f', type:'ninja' },
  { id:'goldie',name:'Goldie',  price:1500, skin:'#ffe08a', color:'#f4a300', type:'crown' },
];
const UPGRADES = [
  { key:'engine',     name:'Engine' },
  { key:'suspension', name:'Suspension' },
  { key:'tires',      name:'Tires' },
  { key:'grip',       name:'Grip' },
];
const MAX_UPG = 5;
const upgCost = lvl => 60 * (lvl + 1) * (lvl + 1) + 40;

// ---------------- Save ----------------
const SAVE_KEY = 'hillbound_save_v1';
const defaultSave = () => ({
  coins: 0, best: 0, bestRace: 0,
  vehicles: ['buggy'], stages: ['country'], stage: 'country', bests: {}, chars: ['rex','luna','bolt'],
  vehicle: 'buggy', char: 'rex',
  upgrades: {}, settings: { sound: true, shake: true },
});
let save;
try { save = Object.assign(defaultSave(), JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); }
catch { save = defaultSave(); }
save.stages ||= ['country']; save.stage ||= 'country'; save.bests ||= {};
const persist = () => localStorage.setItem(SAVE_KEY, JSON.stringify(save));
const getUpg = id => (save.upgrades[id] ||= { engine:0, suspension:0, tires:0, grip:0 });

// ---------------- Audio ----------------
let actx;
function beep(freq, dur = 0.08, type = 'square', vol = 0.06) {
  if (!save.settings.sound) return;
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = vol;
    o.connect(g); g.connect(actx.destination);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.start(); o.stop(actx.currentTime + dur);
  } catch {}
}

// ---------------- Screens ----------------
const SCREENS = ['intro','loading','menu','garage','characters','settings','hud','pause','results'];
function show(...ids) {
  SCREENS.forEach(s => $(s).classList.toggle('hidden', !ids.includes(s)));
  updateCoins();
}
function updateCoins() {
  document.querySelectorAll('.coinCount').forEach(e => e.textContent = save.coins);
  $('menuBest').textContent = Math.floor(save.best);
}

// ---------------- Canvas ----------------
const canvas = $('game'); let ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * DPR; canvas.height = H * DPR;
}
window.addEventListener('resize', resize); resize();

// ---------------- Terrain ----------------
let seeds = [], terrainNodes = [];
function newTerrain() {
  seeds = Array.from({ length: 8 }, () => Math.random() * 1000);
  terrainNodes = [{ x:-1000, y:450 }, { x:300, y:450 }];
  let x = 300, y = 450, i = 0;
  while (x < 90000) {
    const progress = Math.min(1, x / 50000);
    const length = 300 + hash(i + 11) * 300;
    const maxRise = (58 + 70 * progress) * stage.rough;
    let delta = (hash(i + 31) * 2 - 1) * maxRise;
    if (i < 4) delta *= 0.45;
    if (y < 300) delta = Math.abs(delta) * .65;
    if (y > 570) delta = -Math.abs(delta) * .65;
    if (i % 7 === 5) delta = -Math.abs(delta) * .65;
    x += length; y = Math.max(255, Math.min(590, y + delta));
    terrainNodes.push({ x, y }); i++;
  }
}
function hash(n) { const s = Math.sin(n * 127.1 + seeds[5]) * 43758.5453; return s - Math.floor(s); }
function terrainH(x) {
  if (x <= 300) return 450;
  let lo = 1;
  while (lo < terrainNodes.length && terrainNodes[lo].x < x) lo++;
  const b = terrainNodes[Math.min(lo, terrainNodes.length - 1)], a = terrainNodes[Math.max(0, lo - 1)];
  const raw = Math.max(0, Math.min(1, (x - a.x) / Math.max(1, b.x - a.x)));
  const u = raw * raw * (3 - 2 * raw);
  const base = a.y + (b.y - a.y) * u;
  return base + Math.sin(x * .008 + seeds[2]) * 5 * Math.sin(Math.PI * raw);
}
const slope = x => (terrainH(x + 1) - terrainH(x - 1)) / 2;
function groundInfo(px, py) {
  const s = slope(px), len = Math.hypot(s, 1);
  const nx = s / len, ny = -1 / len;           // upward normal
  const d = (terrainH(px) - py) / len;         // signed distance (+ above)
  return { d, nx, ny };
}

// ---------------- Game state ----------------
let G = 900;                  // gravity px/s^2
const PX_PER_M = 30;
let game = null, mode = 'adventure', running = false, paused = false;
const input = { gas: false, brake: false };

function buildCar(vdef) {
  const u = getUpg(vdef.id);
  const st = {
    speed: vdef.speed * (1 + 0.08 * u.engine),
    accel: vdef.accel * (1 + 0.13 * u.engine),
    susp: vdef.susp * (1 + 0.1 * u.suspension),
    grip: vdef.grip * (1 + 0.1 * u.grip) * (1 + 0.05 * u.tires) * stage.grip,
    bounce: Math.max(0, 0.12 - 0.02 * u.tires),
    airCtrl: (1 + 0.06 * u.tires) * (vdef.air || 1),
  };
  const M = 5 * vdef.mass;
  const x = 220, y = terrainH(220) - 90;
  const body = { x, y, vx: 0, vy: 0, a: 0, av: 0, M, I: M * (vdef.w ** 2 + vdef.h ** 2) / 12 };
  const rest = vdef.wheelR * 0.8 + 12;
  const ka = (M * G / 2) / (0.35 * rest) * st.susp * 0.9;
  const mw = 0.8 * vdef.mass;
  const wheels = [-1, 1].map(side => {
    const lx = side * vdef.w * 0.36, ly = vdef.h * 0.4;
    return { lx, ly, x: x + lx, y: y + ly + rest, vx: 0, vy: 0, omega: 0, rot: 0, m: mw, r: vdef.wheelR, grounded: false };
  });
  return {
    def: vdef, st, body, wheels, rest,
    ka, ca: 2 * Math.sqrt(ka * M / 2) * 0.45,
    kp: ka * 10, cp: 2 * Math.sqrt(ka * 10 * mw) * 0.6,
    travel: rest * 0.75,
  };
}

function startGame(m) {
  mode = m || mode;
  stage = STAGES.find(x => x.id === save.stage) || STAGES[0]; G = stage.g;
  newTerrain();
  const vdef = VEHICLES.find(v => v.id === save.vehicle) || VEHICLES[0];
  const cdef = CHARS.find(c => c.id === save.char) || CHARS[0];
  game = {
    car: buildCar(vdef), char: cdef,
    coins: [], cans: [], genX: 500, canX: 5000,
    collected: 0, dist: 0, startX: 220,
    fuel: 100, time: 60, lowSpeedT: 0, air: 0, airRot: 0, lastA: 0, bonus: 0, countdown: 3.25,
    nextCP: 250, rivalX: 220, rivalV: 0, finish: 800, flips: 0,
    cam: { x: 0, y: 0 }, shake: 0, over: false, particles: [],
  };
  game.cam.x = game.car.body.x; game.cam.y = game.car.body.y;
  $('meterLabel').textContent = mode === 'race' ? '🏁' : '⛽';
  $('raceProgress').classList.toggle('hidden', mode !== 'race');
  $('raceProgressFill').style.width = '0%';
  $('popups').innerHTML = '';
  popup(stage.name.toUpperCase() + (mode === 'race' ? ' — RACE!' : ''), 'big');
  running = true; paused = false;
  show('hud');
}

function genWorld() {
  const need = game.cam.x + 2500;
  while (game.genX < need) {
    const x0 = game.genX + 250 + Math.random() * 400;
    const n = 4 + Math.floor(Math.random() * 5);
    const val = Math.random() < 0.15 ? 5 : 1;
    for (let i = 0; i < n; i++) {
      const cx = x0 + i * 38;
      game.coins.push({ x: cx, y: terrainH(cx) - 48 - Math.random() * 6, val, taken: false });
    }
    game.genX = x0 + n * 38;
  }
  if (mode === 'adventure') {
    while (game.canX < need) {
      game.cans.push({ x: game.canX, y: terrainH(game.canX) - 40, taken: false });
      game.canX += 4500 + game.canX * 0.05;
    }
  }
  game.coins = game.coins.filter(c => c.x > game.cam.x - 1500 && !c.taken);
  game.cans = game.cans.filter(c => c.x > game.cam.x - 1500 && !c.taken);
}

// ---------------- Physics ----------------
function applyBodyForce(b, acc, px, py, fx, fy) {
  acc.fx += fx; acc.fy += fy;
  acc.t += (px - b.x) * fy - (py - b.y) * fx;
}
function bodyPoint(b, lx, ly) {
  const c = Math.cos(b.a), s = Math.sin(b.a);
  return [b.x + lx * c - ly * s, b.y + lx * s + ly * c];
}
function pointVel(b, px, py) {
  return [b.vx - b.av * (py - b.y), b.vy + b.av * (px - b.x)];
}

function step(dt) {
  const car = game.car, b = car.body, st = car.st, def = car.def;
  const controlsReady = game.countdown <= 0;
  const gas = controlsReady && input.gas && !game.over && (mode !== 'adventure' || game.fuel > 0);
  const brake = controlsReady && input.brake && !game.over;
  const anyGround = car.wheels.some(w => w.grounded);

  // --- engine / brakes on wheels ---
  for (const w of car.wheels) {
    const maxOm = 720 * st.speed / w.r;
    if (gas) {
      const hillAssist = w.grounded && Math.abs(w.omega * w.r) < 185 ? 1.8 : 1;
      w.omega += (760 * st.accel / w.r) * dt * hillAssist * (w.omega < 0 ? 2.2 : 1);
    } else if (brake) {
      if (w.omega > 0.5) w.omega -= (1400 / w.r) * dt;
      else w.omega -= (380 * st.accel / w.r) * dt;
    } else {
      w.omega *= 1 - 0.25 * dt;
    }
    w.omega = Math.max(-maxOm * 0.45, Math.min(maxOm, w.omega));
  }

  // --- forces ---
  const acc = { fx: 0, fy: b.M * G, t: 0 };
  // air control / wheelie torque
  const tilt = (gas ? -1 : 0) + (brake ? 1 : 0);
  acc.t += tilt * b.I * (anyGround ? 0.7 : 5.2 * st.airCtrl);
  b.av *= 1 - (anyGround ? 1.4 : 0.35) * dt;

  const c = Math.cos(b.a), s = Math.sin(b.a);
  const axX = -s, axY = c, ppX = c, ppY = s;
  for (const w of car.wheels) {
    const [Ax, Ay] = bodyPoint(b, w.lx, w.ly);
    const [vAx, vAy] = pointVel(b, Ax, Ay);
    const Tx = Ax + axX * car.rest, Ty = Ay + axY * car.rest;
    const dx = Tx - w.x, dy = Ty - w.y;
    const da = dx * axX + dy * axY, dp = dx * ppX + dy * ppY;
    const rvx = vAx - w.vx, rvy = vAy - w.vy;
    const rva = rvx * axX + rvy * axY, rvp = rvx * ppX + rvy * ppY;
    let fa = car.ka * da + car.ca * rva;
    if (da > car.travel) fa += car.ka * 12 * (da - car.travel);       // bump stop
    if (da < -car.travel * 0.6) fa += car.ka * 12 * (da + car.travel * 0.6); // droop limit
    const fp = car.kp * dp + car.cp * rvp;
    const Fx = axX * fa + ppX * fp, Fy = axY * fa + ppY * fp;
    w.vx += (Fx / w.m) * dt; w.vy += (Fy / w.m + G) * dt;
    w.compress = da;
    applyBodyForce(b, acc, Ax, Ay, -Fx, -Fy);
  }

  // body hull collision (penalty)
  const hw = def.w / 2, hh = def.h / 2;
  const hull = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh], [0, -hh - 8]];
  for (const [lx, ly] of hull) {
    const [px, py] = bodyPoint(b, lx, ly);
    const g = groundInfo(px, py);
    if (g.d < 0) {
      const [vx, vy] = pointVel(b, px, py);
      const vn = vx * g.nx + vy * g.ny;
      const tx = -g.ny, ty = g.nx, vt = vx * tx + vy * ty;
      const fn = Math.max(0, -g.d * b.M * 500 - vn * b.M * 25);
      applyBodyForce(b, acc, px, py, g.nx * fn - tx * vt * b.M * 6, g.ny * fn - ty * vt * b.M * 6);
    }
  }

  // integrate body
  b.vx += acc.fx / b.M * dt; b.vy += acc.fy / b.M * dt; b.av += acc.t / b.I * dt;
  b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.av * dt;

  // integrate & collide wheels
  for (const w of car.wheels) {
    w.x += w.vx * dt; w.y += w.vy * dt;
    w.grounded = false;
    const g = groundInfo(w.x, w.y);
    if (g.d < w.r) {
      const pen = w.r - g.d;
      w.x += g.nx * pen; w.y += g.ny * pen;
      const vn = w.vx * g.nx + w.vy * g.ny;
      if (vn < 0) { w.vx -= g.nx * vn * (1 + st.bounce); w.vy -= g.ny * vn * (1 + st.bounce); }
      if (vn < -500 && save.settings.shake) game.shake = Math.min(12, -vn / 80);
      // traction
      const tx = -g.ny, ty = g.nx;
      const vt = w.vx * tx + w.vy * ty;
      const slip = w.omega * w.r - vt;
      const lowSpeedBoost = gas && Math.abs(vt) < 180 ? 1.65 : 1;
      const maxDv = st.grip * 3400 * lowSpeedBoost * dt;
      const dv = Math.max(-maxDv, Math.min(maxDv, slip / 2.4));
      w.vx += tx * dv; w.vy += ty * dv;
      w.omega -= (2 * dv) / w.r;
      w.grounded = true;
      if (Math.abs(slip) > 250 && Math.random() < 0.08) spawnDust(w.x, w.y + w.r * 0.8);
    }
    w.rot += w.omega * dt;
  }

  // head crash check
  const [hx, hy] = bodyPoint(b, 0, -hh - 22);
  if (!game.over && groundInfo(hx, hy).d < 4) endGame('CRASHED!');
}

function spawnDust(x, y) {
  game.particles.push({ x, y, vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 60, life: 0.7 });
}

function update(dt) {
  if (game.countdown > -.65) {
    const before = Math.ceil(game.countdown);
    game.countdown -= dt;
    const after = Math.ceil(game.countdown);
    const count = $('countdown');
    count.classList.remove('hidden');
    count.textContent = game.countdown <= 0 ? 'GO!' : String(Math.max(1, after));
    if (before !== after) { count.style.animation = 'none'; void count.offsetWidth; count.style.animation = ''; beep(game.countdown <= 0 ? 900 : 520, .08, 'square', .05); }
    if (game.countdown <= -.65) count.classList.add('hidden');
  } else $('countdown').classList.add('hidden');
  const SUB = 10, h = dt / SUB;
  for (let i = 0; i < SUB; i++) step(h);
  const car = game.car, b = car.body;

  game.dist = Math.max(game.dist, (b.x - game.startX) / PX_PER_M);
  genWorld();

  // pickups
  for (const cn of game.coins) {
    if (cn.taken) continue;
    const near = Math.hypot(cn.x - b.x, cn.y - b.y) < 55 || car.wheels.some(w => Math.hypot(cn.x - w.x, cn.y - w.y) < w.r + 16);
    if (near) { cn.taken = true; game.collected += cn.val; beep(cn.val > 1 ? 1320 : 990, 0.07); }
  }
  for (const cn of game.cans) {
    if (!cn.taken && Math.hypot(cn.x - b.x, cn.y - b.y) < 70) { cn.taken = true; game.fuel = 100; beep(520, 0.2, 'triangle', 0.1); }
  }

  // mode timers
  if (!game.over) {
    const speed = Math.hypot(b.vx, b.vy);
    if (mode === 'adventure') {
      game.fuel = Math.max(0, game.fuel - dt * (input.gas ? 3.2 : 1.2));
      if (game.fuel <= 0) {
        game.lowSpeedT = speed < 25 ? game.lowSpeedT + dt : 0;
        if (game.lowSpeedT > 1.5) endGame('OUT OF FUEL!');
      }
    } else {
      const target = 300 + 90 * Math.sin(performance.now() / 1300) + 25 * STAGES.indexOf(stage);
      game.rivalV += (target - game.rivalV) * dt;
      game.rivalX += game.rivalV * dt;
      if (game.dist >= game.finish) { game.won = true; game.bonus += 150; popup('YOU WIN! +150', 'big'); endGame('YOU WIN!'); }
      else if ((game.rivalX - game.startX) / PX_PER_M >= game.finish) endGame('RIVAL WON!');
    }
    if (b.y > terrainH(b.x) + 400) endGame('CRASHED!');
  }

  // tricks
  const grounded = car.wheels.some(w => w.grounded);
  let da = b.a - game.lastA; game.lastA = b.a;
  if (!grounded && !game.over) { game.air += dt; game.airRot += da; }
  else if (game.air > 0) {
    const flips = Math.floor((Math.abs(game.airRot) + 0.9) / (Math.PI * 2));
    if (!game.over) {
      if (flips > 0) { const v = flips * 10; game.bonus += v; game.flips += flips; popup((game.airRot < 0 ? 'BACKFLIP' : 'FRONTFLIP') + (flips > 1 ? ' x' + flips : '') + ' +' + v); beep(1500, 0.15, 'triangle'); }
      if (game.air > 1.4) { const v = Math.floor(game.air * 4); game.bonus += v; popup('AIR TIME ' + game.air.toFixed(1) + 's +' + v); }
    }
    game.air = 0; game.airRot = 0;
  }
  if (mode === 'adventure' && game.dist >= game.nextCP && !game.over) {
    const v = 20 + Math.floor(game.nextCP / 25); game.bonus += v;
    popup('CHECKPOINT ' + game.nextCP + 'm  +' + v, 'big'); beep(700, 0.3, 'triangle', 0.1);
    game.nextCP += 250 + Math.floor(game.nextCP * 0.3 / 50) * 50;
  }

  // particles
  game.particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 200 * dt; p.life -= dt; });
  game.particles = game.particles.filter(p => p.life > 0);

  // camera
  const lookAhead = Math.max(-100, Math.min(250, b.vx * 0.35));
  game.cam.x += (b.x + lookAhead - game.cam.x) * Math.min(1, dt * 5);
  game.cam.y += (b.y - game.cam.y) * Math.min(1, dt * 4);
  game.shake *= 0.9;

  // HUD
  $('hudDist').textContent = Math.floor(game.dist);
  $('hudCoins').textContent = game.collected + game.bonus;
  $('hudSpeed').textContent = Math.round(Math.abs(b.vx) / PX_PER_M * 3.6);
  const pct = mode === 'adventure' ? game.fuel : Math.min(100, game.dist / game.finish * 100);
  $('raceProgressFill').style.width = Math.min(100, game.dist / game.finish * 100) + '%';
  $('meterFill').style.width = pct + '%';
  $('meterFill').style.background = mode === 'race' ? '#2b7de9' : pct < 25 ? '#e63946' : pct < 50 ? '#f4a300' : '#43aa3b';
}

function endGame(title) {
  if (game.over) return;
  game.over = true;
  if (save.settings.shake) game.shake = 14;
  beep(160, 0.4, 'sawtooth', 0.08);
  const earned = game.collected + game.bonus;
  save.coins += earned;
  const d = Math.floor(game.dist);
  let newBest = false;
  if (d > save.best) save.best = d;
  if (mode === 'adventure' && d > (save.bests[stage.id] || 0)) { save.bests[stage.id] = d; newBest = true; }
  persist();
  setTimeout(() => {
    running = false;
    $('resTitle').textContent = (newBest && title !== 'YOU WIN!') ? 'NEW BEST!' : title;
    $('resDist').textContent = d + ' m';
    $('resCoins').textContent = '+' + earned;
    $('resBest').textContent = (save.bests[stage.id] || 0) + ' m';
    $('resExtra').textContent = `${stage.name} • Flips: ${game.flips}`;
    show('results');
  }, 1200);
}

// ---------------- Rendering ----------------
function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, stage.sky[0]); g.addColorStop(1, stage.sky[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // sun
  if (stage.stars) { ctx.fillStyle = '#fff'; for (let i = 0; i < 80; i++) ctx.fillRect((i * 137.5) % W, (i * 71.3) % (H * 0.6), 2, 2); }
  ctx.fillStyle = stage.sun; ctx.beginPath(); ctx.arc(W * 0.82, H * 0.18, 40, 0, 7); ctx.fill();
  // parallax hills
  const layers = [[stage.hills[0], 0.15, 0.55, 90], [stage.hills[1], 0.3, 0.65, 70]];
  for (const [col, par, base, amp] of layers) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W + 20; x += 20) {
      const wx = x + game.cam.x * par;
      ctx.lineTo(x, H * base + Math.sin(wx * 0.004) * amp + Math.sin(wx * 0.011) * amp * 0.3);
    }
    ctx.lineTo(W, H); ctx.fill();
  }
  // clouds
  ctx.fillStyle = stage.stars ? 'rgba(255,255,255,0)' : 'rgba(255,255,255,.85)';
  for (let i = 0; i < 5; i++) {
    const cx = ((i * 420 - game.cam.x * 0.08) % (W + 400) + W + 400) % (W + 400) - 200;
    const cy = 60 + (i * 53) % 120;
    ctx.beginPath(); ctx.arc(cx, cy, 26, 0, 7); ctx.arc(cx + 30, cy - 10, 32, 0, 7); ctx.arc(cx + 62, cy, 24, 0, 7); ctx.fill();
  }
}

function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  drawBackground();
  const zoom = Math.min(1.2, Math.max(0.55, H / 620));
  const sx = (Math.random() - 0.5) * game.shake, sy = (Math.random() - 0.5) * game.shake;
  ctx.save();
  ctx.translate(W * 0.35 + sx, H * 0.55 + sy);
  ctx.scale(zoom, zoom);
  ctx.translate(-game.cam.x, -game.cam.y);
  const left = game.cam.x - (W * 0.35) / zoom - 20, right = game.cam.x + (W * 0.65) / zoom + 20;
  const bottom = game.cam.y + H / zoom + 200;

  // terrain
  ctx.beginPath(); ctx.moveTo(left, bottom);
  for (let x = left; x <= right; x += 8) ctx.lineTo(x, terrainH(x));
  ctx.lineTo(right, bottom); ctx.closePath();
  ctx.fillStyle = stage.dirt; ctx.fill();
  // dirt stripes
  ctx.save(); ctx.clip();
  ctx.fillStyle = stage.dirt2;
  for (let x = Math.floor(left / 120) * 120; x < right; x += 120) {
    const y = terrainH(x);
    ctx.beginPath(); ctx.arc(x + 40, y + 70, 14, 0, 7); ctx.arc(x + 95, y + 130, 9, 0, 7); ctx.fill();
  }
  ctx.restore();
  // grass
  ctx.beginPath();
  for (let x = left; x <= right; x += 8) ctx.lineTo(x, terrainH(x) + 4);
  ctx.strokeStyle = stage.grass; ctx.lineWidth = 16; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.beginPath();
  for (let x = left; x <= right; x += 8) ctx.lineTo(x, terrainH(x));
  ctx.strokeStyle = stage.grass2; ctx.lineWidth = 6; ctx.stroke();

  // distance markers
  ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Nunito'; ctx.textAlign = 'center';
  for (let m = Math.ceil((left - game.startX) / PX_PER_M / 100) * 100; m * PX_PER_M + game.startX < right; m += 100) {
    if (m <= 0) continue;
    const x = game.startX + m * PX_PER_M, y = terrainH(x);
    ctx.fillStyle = '#5c3b1e'; ctx.fillRect(x - 2, y - 50, 4, 50);
    ctx.fillStyle = '#fff'; ctx.fillRect(x - 24, y - 70, 48, 22);
    ctx.fillStyle = '#222'; ctx.fillText(m + 'm', x, y - 53);
  }

  // coins
  const t = performance.now() / 1000;
  for (const cn of game.coins) {
    if (cn.taken || cn.x < left || cn.x > right) continue;
    const sw = Math.abs(Math.cos(t * 3 + cn.x * 0.01));
    const r = cn.val > 1 ? 14 : 11;
    ctx.fillStyle = cn.val > 1 ? '#ff7b00' : '#ffc300';
    ctx.strokeStyle = '#9b6200'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(cn.x, cn.y, r * sw + 2, r, 0, 0, 7); ctx.fill(); ctx.stroke();
  }
  // fuel cans
  for (const cn of game.cans) {
    if (cn.taken || cn.x < left || cn.x > right) continue;
    ctx.fillStyle = '#e63946'; ctx.fillRect(cn.x - 14, cn.y - 18, 28, 36);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Nunito'; ctx.fillText('F', cn.x, cn.y + 5);
  }
  // particles
  for (const p of game.particles) {
    ctx.fillStyle = `rgba(139,90,43,${p.life})`; ctx.beginPath(); ctx.arc(p.x, p.y, 6 * (1.2 - p.life), 0, 7); ctx.fill();
  }

  // checkpoint flag / finish line
  const flagM = mode === 'race' ? game.finish : game.nextCP;
  const fx = game.startX + flagM * PX_PER_M;
  if (fx > left && fx < right) {
    const fy = terrainH(fx);
    ctx.fillStyle = '#333'; ctx.fillRect(fx - 3, fy - 140, 6, 140);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { ctx.fillStyle = (i + j) % 2 ? '#fff' : '#111'; ctx.fillRect(fx + 3 + i * 14, fy - 140 + j * 14, 14, 14); }
    ctx.fillStyle = '#fff'; ctx.font = 'bold 18px Nunito'; ctx.fillText(mode === 'race' ? 'FINISH' : 'CHECKPOINT', fx, fy - 150);
  }
  if (mode === 'race') {
    const rx = game.rivalX, ry = terrainH(rx), ang = Math.atan(slope(rx));
    const rd = VEHICLES[(VEHICLES.findIndex(v => v.id === game.car.def.id) + 1) % VEHICLES.length];
    ctx.save(); ctx.globalAlpha = 0.55; ctx.translate(rx, ry); ctx.rotate(ang);
    ctx.translate(0, -rd.wheelR - rd.h * 0.4 - 10);
    drawVehicleBody(rd, CHARS[3]);
    const wy = rd.h * 0.4 + 10; drawWheel(-rd.w * 0.36, wy, rd.wheelR, rx / rd.wheelR); drawWheel(rd.w * 0.36, wy, rd.wheelR, rx / rd.wheelR);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Nunito'; ctx.fillText('RIVAL', 0, -rd.h - 40);
    ctx.restore();
  }
  drawCar(game.car, game.char);
  ctx.restore();
}

function drawWheel(x, y, r, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
  ctx.fillStyle = '#bbb'; ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, 7); ctx.fill();
  ctx.strokeStyle = '#555'; ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(-r * 0.55, 0); ctx.lineTo(r * 0.55, 0); ctx.stroke(); }
  ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(0, 0, r * 0.15, 0, 7); ctx.fill();
  ctx.restore();
}

function drawCharacter(c, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = '#172238'; ctx.lineWidth = 2.6;
  ctx.fillStyle = c.color; ctx.beginPath(); ctx.roundRect(-12, -1, 24, 26, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = c.skin;
  if (c.type === 'robot') { ctx.beginPath(); ctx.roundRect(-15, -31, 30, 29, 7); ctx.fill(); ctx.stroke(); }
  else { ctx.beginPath(); ctx.ellipse(0, -16, 15, 17, -.08, 0, 7); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = c.type === 'robot' ? '#53eaff' : '#172238';
  ctx.beginPath(); ctx.ellipse(5, -18, 2.6, 3.4, 0, 0, 7); ctx.ellipse(11, -17, 2.3, 3.1, 0, 0, 7); ctx.fill();
  if (c.type !== 'robot' && c.type !== 'ninja') { ctx.strokeStyle = '#8d4938'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(7, -11, 4.5, .3, 2.65); ctx.stroke(); }
  ctx.strokeStyle = '#172238'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-9, 22); ctx.lineTo(-13, 31); ctx.moveTo(9, 22); ctx.lineTo(15, 30); ctx.stroke();
  ctx.fillStyle = c.color;
  switch (c.type) {
    case 'cap': ctx.beginPath(); ctx.arc(-1, -22, 15, Math.PI, 0); ctx.fill(); ctx.stroke(); ctx.fillRect(1, -24, 20, 5); break;
    case 'bow': ctx.beginPath(); ctx.moveTo(-5, -31); ctx.lineTo(-17, -38); ctx.lineTo(-16, -25); ctx.closePath(); ctx.moveTo(-5, -31); ctx.lineTo(7, -38); ctx.lineTo(6, -25); ctx.fill(); break;
    case 'robot': ctx.strokeStyle = '#555'; ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(0, -32); ctx.stroke(); ctx.fillStyle = '#e63946'; ctx.beginPath(); ctx.arc(0, -33, 3, 0, 7); ctx.fill(); break;
    case 'alien': ctx.strokeStyle = '#2d6a4f'; ctx.beginPath(); ctx.moveTo(-4, -23); ctx.lineTo(-8, -32); ctx.moveTo(4, -23); ctx.lineTo(8, -32); ctx.stroke(); ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(-8, -33, 3, 0, 7); ctx.arc(8, -33, 3, 0, 7); ctx.fill(); break;
    case 'pirate': ctx.fillStyle = '#222'; ctx.beginPath(); ctx.moveTo(-15, -18); ctx.quadraticCurveTo(0, -36, 15, -18); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -24, 2.5, 0, 7); ctx.fill(); ctx.fillStyle = '#222'; ctx.fillRect(7, -16, 5, 5); break;
    case 'ninja': ctx.fillStyle = '#1b1b2f'; ctx.fillRect(-15, -15, 30, 12); ctx.fillStyle = '#e63946'; ctx.fillRect(-15, -27, 30, 5); ctx.fillRect(-22, -27, 9, 4); break;
    case 'crown': ctx.fillStyle = '#ffc300'; ctx.beginPath(); ctx.moveTo(-10, -20); ctx.lineTo(-10, -30); ctx.lineTo(-5, -25); ctx.lineTo(0, -32); ctx.lineTo(5, -25); ctx.lineTo(10, -30); ctx.lineTo(10, -20); ctx.fill(); break;
  }
  ctx.restore();
}

function drawVehicleBody(def, c) {
  const w = def.w, h = def.h;
  ctx.fillStyle = def.color; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 3;
  ctx.beginPath();
  if (def.id === 'rocket') {
    ctx.moveTo(-w / 2, h / 2); ctx.lineTo(-w / 2, -h / 2); ctx.lineTo(-w / 4, -h / 2);
    ctx.lineTo(w / 6, -h / 2 + 4); ctx.lineTo(w / 2 + 10, h / 4); ctx.lineTo(w / 2, h / 2);
  } else if (def.id === 'moto') {
    ctx.moveTo(-w / 2, 0); ctx.lineTo(-w / 4, -h / 2); ctx.lineTo(w / 3, -h / 2); ctx.lineTo(w / 2, h / 4); ctx.lineTo(0, h / 2);
  } else if (def.id === 'mud' || def.id === 'monster') {
    ctx.roundRect(-w / 2, -h / 2, w, h, 6);
  } else {
    ctx.moveTo(-w / 2, h / 2); ctx.lineTo(-w / 2 + 6, -h / 2); ctx.lineTo(w / 2 - 20, -h / 2);
    ctx.lineTo(w / 2, 0); ctx.lineTo(w / 2, h / 2);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = def.trim; ctx.fillRect(-w / 2 + 6, h / 2 - 10, w - 12, 6);
  ctx.fillStyle = 'rgba(220,245,255,.82)'; ctx.beginPath(); ctx.moveTo(-w*.2,-h/2);ctx.lineTo(-w*.04,-h/2-25);ctx.lineTo(w*.18,-h/2-25);ctx.lineTo(w*.25,-h/2);ctx.fill();ctx.stroke();
  if (c) drawCharacter(c, -w * 0.1, -h / 2 - 14, .88);
  // roll bar / windshield
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(w * 0.12, -h / 2); ctx.lineTo(w * 0.05, -h / 2 - 26); ctx.stroke();
  if (def.id === 'rocket') { ctx.fillStyle = '#ff6b00'; ctx.beginPath(); ctx.moveTo(-w / 2, -h / 4); ctx.lineTo(-w / 2 - 14 - Math.random() * 8, 0); ctx.lineTo(-w / 2, h / 4); ctx.fill(); }
}

function drawCar(car, ch) {
  const b = car.body;
  // suspension struts
  ctx.strokeStyle = '#444'; ctx.lineWidth = 5;
  for (const w of car.wheels) {
    const [Ax, Ay] = bodyPoint(b, w.lx, w.ly);
    ctx.beginPath(); ctx.moveTo(Ax, Ay); ctx.lineTo(w.x, w.y); ctx.stroke();
  }
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a);
  drawVehicleBody(car.def, ch);
  ctx.restore();
  for (const w of car.wheels) drawWheel(w.x, w.y, w.r, w.rot);
}

// ---------------- Loop ----------------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000); last = now;
  if (game) {
    if (running && !paused) update(dt);
    render();
  } else {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = '#1b2a4a'; ctx.fillRect(0, 0, W, H);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---------------- Input ----------------
const keyMap = { ArrowRight: 'gas', KeyD: 'gas', KeyW: 'gas', ArrowUp: 'gas', ArrowLeft: 'brake', KeyA: 'brake', KeyS: 'brake', ArrowDown: 'brake' };
window.addEventListener('keydown', e => { if (e.code === 'KeyR' && running) startGame(mode); });
window.addEventListener('keydown', e => {
  if (keyMap[e.code]) { input[keyMap[e.code]] = true; setPedal(); e.preventDefault(); }
  if ((e.code === 'KeyP' || e.code === 'Escape') && running) togglePause();
});
window.addEventListener('keyup', e => { if (keyMap[e.code]) { input[keyMap[e.code]] = false; setPedal(); } });
function setPedal() { $('pedGas').classList.toggle('active', input.gas); $('pedBrake').classList.toggle('active', input.brake); }
function bindPedal(el, key) {
  const on = e => { e.preventDefault(); input[key] = true; setPedal(); };
  const off = e => { e.preventDefault(); input[key] = false; setPedal(); };
  el.addEventListener('pointerdown', on);
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => el.addEventListener(ev, off));
  el.addEventListener('contextmenu', e => e.preventDefault());
}
bindPedal($('pedGas'), 'gas'); bindPedal($('pedBrake'), 'brake');
window.addEventListener('blur', () => { input.gas = input.brake = false; setPedal(); });

function togglePause() {
  if (!running || game.over) return;
  paused = !paused;
  input.gas = input.brake = false; setPedal();
  show(paused ? 'pause' : 'hud');
  if (paused) $('hud').classList.remove('hidden');
}

// ---------------- Menus ----------------
let garageFromMode = null;
function openGarage(m) {
  garageFromMode = m;
  $('btnDrive').textContent = m ? `DRIVE ▶ (${m.toUpperCase()})` : 'DONE';
  renderGarage(); show('garage');
}
function renderGarage() {
  const list = $('vehList'); list.innerHTML = '';
  for (const v of VEHICLES) {
    const owned = save.vehicles.includes(v.id), sel = save.vehicle === v.id;
    const el = document.createElement('div');
    el.className = 'veh' + (sel ? ' sel' : '');
    const cv = document.createElement('canvas'); cv.width = 340; cv.height = 140;
    el.appendChild(cv);
    drawPreviewVehicle(cv, v);
    const bars = [['Speed', v.speed / 1.5], ['Accel', v.accel / 1.3], ['Weight', v.mass / 1.7], ['Grip', v.grip / 1.4], ['Suspension', v.susp / 1.4]]
      .map(([n, val]) => `<div class="stat"><span>${n}</span><i><b style="width:${Math.min(100, val * 100)}%"></b></i></div>`).join('');
    el.insertAdjacentHTML('beforeend', `<h4>${v.name}</h4><p>${v.desc}</p>${bars}`);
    const btn = document.createElement('button');
    btn.className = 'btn ' + (owned ? (sel ? 'gold' : 'blue') : 'green');
    btn.innerHTML = owned ? (sel ? 'SELECTED' : 'SELECT') : `BUY <span class="coin-ico"></span> ${v.price}`;
    if (!owned && save.coins < v.price) btn.disabled = true;
    btn.onclick = e => {
      e.stopPropagation();
      if (!owned) { if (save.coins < v.price) return; save.coins -= v.price; save.vehicles.push(v.id); beep(880, 0.15); }
      save.vehicle = v.id; persist(); renderGarage(); updateCoins();
    };
    el.onclick = () => { if (owned) { save.vehicle = v.id; persist(); renderGarage(); } };
    el.appendChild(btn); list.appendChild(el);
  }
  const v = VEHICLES.find(x => x.id === save.vehicle);
  const u = getUpg(v.id);
  const sb = $('stageBar'); sb.innerHTML = '';
  for (const stg of STAGES) {
    const owned = save.stages.includes(stg.id);
    const bt = document.createElement('button');
    bt.className = 'stage-chip' + (save.stage === stg.id ? ' sel' : '');
    bt.style.background = `linear-gradient(${stg.sky[0]}, ${stg.dirt})`;
    bt.innerHTML = `<b>${stg.name}</b><small>${owned ? 'Best ' + (save.bests[stg.id] || 0) + 'm' : '🔒 ' + stg.price}</small>`;
    if (!owned && save.coins < stg.price) bt.classList.add('locked');
    bt.onclick = () => {
      if (!owned) { if (save.coins < stg.price) return; save.coins -= stg.price; save.stages.push(stg.id); beep(880, 0.15); }
      save.stage = stg.id; persist(); renderGarage();
    };
    sb.appendChild(bt);
  }
  $('upgTitle').textContent = `Upgrades — ${v.name}`;
  const ul = $('upgList'); ul.innerHTML = '';
  for (const up of UPGRADES) {
    const lvl = u[up.key];
    const row = document.createElement('div'); row.className = 'upg-row';
    row.innerHTML = `<span class="name">${up.name}</span><div class="pips">${Array.from({ length: MAX_UPG }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div>`;
    const btn = document.createElement('button'); btn.className = 'btn green';
    if (lvl >= MAX_UPG) { btn.textContent = 'MAX'; btn.disabled = true; }
    else {
      const cost = upgCost(lvl);
      btn.innerHTML = `<span class="coin-ico"></span> ${cost}`;
      btn.disabled = save.coins < cost;
      btn.onclick = () => { if (save.coins < cost) return; save.coins -= cost; u[up.key]++; persist(); beep(1100, 0.1); renderGarage(); updateCoins(); };
    }
    row.appendChild(btn); ul.appendChild(row);
  }
  updateCoins();
}

function drawPreviewVehicle(cv, v) {
  const c = cv.getContext('2d');
  swapDraw(c, () => {
    c.translate(cv.width / 2, cv.height / 2 + 18); c.scale(1.3, 1.3);
    const ch = CHARS.find(x => x.id === save.char);
    drawVehicleBody(v, ch);
    drawWheel(-v.w * 0.36, v.h * 0.4 + v.wheelR * 0.6, v.wheelR, 0);
    drawWheel(v.w * 0.36, v.h * 0.4 + v.wheelR * 0.6, v.wheelR, 0);
  });
}
function swapDraw(c, fn) { const o = ctx; ctx = c; try { fn(); } finally { ctx = o; } }

function renderChars() {
  const list = $('charList'); list.innerHTML = '';
  for (const ch of CHARS) {
    const owned = save.chars.includes(ch.id), sel = save.char === ch.id;
    const el = document.createElement('div'); el.className = 'char' + (sel ? ' sel' : '');
    const cv = document.createElement('canvas'); cv.width = 180; cv.height = 180;
    swapDraw(cv.getContext('2d'), () => { ctx.translate(90, 110); ctx.scale(2.6, 2.6); drawCharacter(ch, 0, 0); });
    el.appendChild(cv);
    el.insertAdjacentHTML('beforeend', `<h4>${ch.name}</h4>`);
    const btn = document.createElement('button');
    btn.className = 'btn ' + (owned ? (sel ? 'gold' : 'blue') : 'green');
    btn.innerHTML = owned ? (sel ? 'SELECTED' : 'SELECT') : `UNLOCK <span class="coin-ico"></span> ${ch.price}`;
    if (!owned && save.coins < ch.price) btn.disabled = true;
    btn.onclick = () => {
      if (!owned) { if (save.coins < ch.price) return; save.coins -= ch.price; save.chars.push(ch.id); beep(880, 0.15); }
      save.char = ch.id; persist(); renderChars();
    };
    el.appendChild(btn); list.appendChild(el);
  }
  updateCoins();
}

// Wire buttons
document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { beep(660); openGarage(b.dataset.mode); });
$('btnGarage').onclick = () => { beep(660); openGarage(null); };
$('btnChars').onclick = () => { beep(660); renderChars(); show('characters'); };
$('btnSettings').onclick = () => {
  $('setSound').checked = save.settings.sound; $('setShake').checked = save.settings.shake; show('settings');
};
$('setSound').onchange = e => { save.settings.sound = e.target.checked; persist(); };
$('setShake').onchange = e => { save.settings.shake = e.target.checked; persist(); };
$('btnReset').onclick = () => { if (confirm('Reset all progress?')) { save = defaultSave(); persist(); updateCoins(); } };
document.querySelectorAll('.back').forEach(b => b.onclick = () => show('menu'));
$('btnDrive').onclick = () => { if (garageFromMode) startGame(garageFromMode); else show('menu'); };
$('btnPause').onclick = togglePause;
$('btnResume').onclick = togglePause;
$('btnPauseRetry').onclick = () => startGame(mode);
$('btnPauseMenu').onclick = () => { running = false; game = null; show('menu'); };
$('btnRetry').onclick = () => startGame(mode);
$('btnResGarage').onclick = () => { game = null; openGarage(mode); };
$('btnResMenu').onclick = () => { game = null; show('menu'); };

function popup(text, cls = '') {
  const el = document.createElement('div'); el.className = 'popup ' + cls; el.textContent = text;
  $('popups').appendChild(el); setTimeout(() => el.remove(), 1800);
}
async function goFullscreen() {
  try {
    const el = document.documentElement;
    if (!document.fullscreenElement) await (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape').catch(() => {});
  } catch {}
}
$('btnFull').onclick = goFullscreen;
if (matchMedia('(pointer: coarse)').matches) document.addEventListener('pointerdown', function f() { goFullscreen(); document.removeEventListener('pointerdown', f); });
// ---------------- Startup ----------------
const TIPS = ['Tip: Tilt in the air with GAS and BRAKE!', 'Tip: Land on both wheels to keep speed.', 'Tip: Upgrade Grip to climb steep hills.', 'Tip: Grab fuel cans in Adventure mode.', 'Tip: Orange coins are worth 5!'];
show('intro');
setTimeout(() => {
  show('loading');
  $('loadTip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
  const total = 3000 + Math.random() * 7000, t0 = performance.now();
  const iv = setInterval(() => {
    const p = Math.min(1, (performance.now() - t0) / total);
    $('loadFill').style.width = (p * 100) + '%';
    if (p >= 1) { clearInterval(iv); show('menu'); }
  }, 100);
}, 2800);
})();

