import * as THREE from './vendor/three.module.js';

// ───────────────────────── 기본 설정 ─────────────────────────
const N = 800;            // 트랙 샘플 수
const HW = 8;             // 도로 반폭
const WALL = HW + 7;      // 벽까지 거리
const LAPS = 3;
const PLAYER_MAX = 58;

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrapAngle = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const mod = (i, n = N) => ((i % n) + n) % n;

const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7fc8f8);
scene.fog = new THREE.Fog(0x9ad4f8, 180, 620);
const camera = new THREE.PerspectiveCamera(70, 1, 0.5, 1200);

scene.add(new THREE.HemisphereLight(0xffffff, 0x6b8f4e, 1.6));
const sun = new THREE.DirectionalLight(0xfff2d0, 1.8);
sun.position.set(80, 140, 40);
scene.add(sun);

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function canvasTex(w, h, draw, repeatX = 1, repeatY = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  if ('colorSpace' in t && THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ───────────────────────── 트랙 ─────────────────────────
const CTRL = [
  [0, -90], [120, -88], [172, -20], [130, 42], [60, 30], [20, 82], [80, 140],
  [0, 172], [-90, 130], [-70, 50], [-150, 20], [-176, -42], [-120, -88],
];
const curve = new THREE.CatmullRomCurve3(CTRL.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'catmullrom', 0.5);
const PTS = curve.getSpacedPoints(N).slice(0, N);
const TAN = [], NRM = [], CURV = [];
for (let i = 0; i < N; i++) {
  const a = PTS[mod(i - 1)], b = PTS[mod(i + 1)];
  const t = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
  TAN.push(t);
  NRM.push(new THREE.Vector3(t.z, 0, -t.x));
}
for (let i = 0; i < N; i++) {
  const a = TAN[mod(i - 5)], b = TAN[mod(i + 5)];
  CURV.push(Math.abs(wrapAngle(Math.atan2(b.x, b.z) - Math.atan2(a.x, a.z))));
}

function ribbon(offA, yA, offB, yB, material, vScale) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const p = PTS[i % N], n = NRM[i % N];
    pos.push(p.x + n.x * offA, yA, p.z + n.z * offA, p.x + n.x * offB, yB, p.z + n.z * offB);
    uv.push(0, i * vScale, 1, i * vScale);
    if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, material);
  scene.add(m);
  return m;
}

// 바닥(잔디)
{
  const grassTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#5fb04a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = Math.random() < 0.5 ? '#57a543' : '#6aba54';
      g.fillRect(Math.random() * w, Math.random() * h, 3, 3);
    }
  }, 150, 150);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshLambertMaterial({ map: grassTex }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.02, 40);
  scene.add(ground);
}
// 도로, 연석, 벽
{
  const roadTex = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#4a4e57'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) {
      g.fillStyle = Math.random() < 0.5 ? '#454952' : '#50545e';
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    g.fillStyle = '#f4f4f4'; g.fillRect(6, 0, 6, h); g.fillRect(w - 12, 0, 6, h);
    g.fillStyle = '#ffd93b'; g.fillRect(w / 2 - 3, 0, 6, h * 0.55);
  });
  const D = THREE.DoubleSide;
  ribbon(HW, 0.02, -HW, 0.02, new THREE.MeshLambertMaterial({ map: roadTex, side: D }), 1 / 8);
  const curbTex = canvasTex(16, 64, (g, w, h) => {
    g.fillStyle = '#e53935'; g.fillRect(0, 0, w, h / 2);
    g.fillStyle = '#ffffff'; g.fillRect(0, h / 2, w, h / 2);
  });
  const curbMat = new THREE.MeshLambertMaterial({ map: curbTex, side: D });
  ribbon(HW + 1.3, 0.03, HW, 0.04, curbMat, 1 / 4);
  ribbon(-HW, 0.04, -HW - 1.3, 0.03, curbMat, 1 / 4);
  const wallTex = canvasTex(64, 32, (g, w, h) => {
    g.fillStyle = '#f5f7fa'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2e7dd6'; g.fillRect(0, 0, w / 2, h);
    g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(0, h - 6, w, 6);
  });
  const wallMat = new THREE.MeshLambertMaterial({ map: wallTex, side: D });
  ribbon(WALL + 0.6, 0, WALL + 0.6, 1.4, wallMat, 1 / 6);
  ribbon(-WALL - 0.6, 0, -WALL - 0.6, 1.4, wallMat, 1 / 6);
}
// 출발선 게이트
{
  const g = new THREE.Group();
  g.position.copy(PTS[0]);
  g.rotation.y = Math.atan2(TAN[0].x, TAN[0].z);
  const checker = canvasTex(128, 32, (c, w, h) => {
    for (let y = 0; y < 2; y++) for (let x = 0; x < 8; x++) {
      c.fillStyle = (x + y) % 2 ? '#111' : '#fff';
      c.fillRect(x * 16, y * 16, 16, 16);
    }
  });
  const line = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, 2.4), new THREE.MeshBasicMaterial({ map: checker }));
  line.rotation.x = -Math.PI / 2; line.position.y = 0.06;
  g.add(line);
  const postMat = new THREE.MeshLambertMaterial({ color: 0xd63a3a });
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 8.5, 10), postMat);
    p.position.set(s * (HW + 2), 4.25, 0);
    g.add(p);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(HW * 2 + 5, 1.8, 0.7), new THREE.MeshBasicMaterial({ map: checker }));
  beam.position.y = 8;
  g.add(beam);
  scene.add(g);
}

function distToTrack(x, z) {
  let best = 1e9;
  for (let i = 0; i < N; i += 2) {
    const dx = PTS[i].x - x, dz = PTS[i].z - z;
    const d = dx * dx + dz * dz;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}
// 나무, 산, 구름
{
  const COUNT = 260;
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.7, 3, 6), new THREE.MeshLambertMaterial({ color: 0x8a5a33 }), COUNT);
  const leaf = new THREE.InstancedMesh(new THREE.ConeGeometry(3, 7, 7), new THREE.MeshLambertMaterial({ color: 0x2f8f3e }), COUNT);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  let placed = 0, tries = 0;
  while (placed < COUNT && tries < 5000) {
    tries++;
    const x = -260 + Math.random() * 520, z = -180 + Math.random() * 440;
    if (distToTrack(x, z) < WALL + 6) continue;
    const sc = 0.8 + Math.random() * 0.9;
    s.set(sc, sc, sc);
    m.compose(p.set(x, 1.5 * sc, z), q, s); trunk.setMatrixAt(placed, m);
    m.compose(p.set(x, 6 * sc, z), q, s); leaf.setMatrixAt(placed, m);
    placed++;
  }
  trunk.count = leaf.count = placed;
  scene.add(trunk, leaf);

  const mMat = new THREE.MeshLambertMaterial({ color: 0x6f8fa8 });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, r = 420 + Math.random() * 80, h = 70 + Math.random() * 90;
    const mt = new THREE.Mesh(new THREE.ConeGeometry(90 + Math.random() * 60, h, 6), mMat);
    mt.position.set(Math.cos(a) * r, h / 2 - 4, 40 + Math.sin(a) * r);
    scene.add(mt);
  }
  const cMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
  for (let i = 0; i < 22; i++) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(12 + Math.random() * 14, 8, 6), cMat);
    c.scale.set(2.2, 0.6, 1.2);
    c.position.set(-500 + Math.random() * 1000, 110 + Math.random() * 60, -400 + Math.random() * 900);
    scene.add(c);
  }
}

// ───────────────────────── 파티클 ─────────────────────────
const particles = [];
{
  const geo = new THREE.SphereGeometry(0.35, 6, 5);
  for (let i = 0; i < 120; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
    m.visible = false;
    scene.add(m);
    particles.push({ m, life: 0, max: 1, vx: 0, vy: 0, vz: 0 });
  }
}
let pCursor = 0;
function puff(x, y, z, color, life = 0.5, spread = 2, size = 1) {
  const p = particles[pCursor = (pCursor + 1) % particles.length];
  p.m.visible = true;
  p.m.position.set(x, y, z);
  p.m.material.color.setHex(color);
  p.life = p.max = life;
  p.size = size;
  p.vx = (Math.random() - 0.5) * spread; p.vy = Math.random() * spread * 0.6 + 0.5; p.vz = (Math.random() - 0.5) * spread;
}
function updateParticles(dt) {
  for (const p of particles) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { p.m.visible = false; continue; }
    p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
    const k = p.life / p.max;
    p.m.scale.setScalar(p.size * (1.6 - k));
    p.m.material.opacity = k * 0.8;
  }
}

// ───────────────────────── 카트 ─────────────────────────
function buildKartMesh(color) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const paint = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x22252b });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); body.add(m); return m; };
  add(new THREE.BoxGeometry(1.5, 0.45, 2.5), paint, 0, 0.5, 0);
  add(new THREE.BoxGeometry(1.0, 0.32, 0.9), paint, 0, 0.45, 1.45);
  add(new THREE.BoxGeometry(1.7, 0.12, 0.3), dark, 0, 0.35, 1.95);
  add(new THREE.BoxGeometry(1.1, 0.7, 0.2), dark, 0, 0.95, -0.75);
  add(new THREE.BoxGeometry(1.7, 0.1, 0.45), paint, 0, 1.25, -1.2);
  add(new THREE.BoxGeometry(0.1, 0.5, 0.1), dark, -0.6, 1.0, -1.2);
  add(new THREE.BoxGeometry(0.1, 0.5, 0.1), dark, 0.6, 1.0, -1.2);
  const wheels = [];
  const wGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.38, 12);
  for (const [x, z] of [[-0.9, 0.9], [0.9, 0.9], [-0.9, -0.9], [0.9, -0.9]]) {
    const w = add(wGeo, dark, x, 0.4, z);
    w.rotation.z = Math.PI / 2;
    wheels.push(w);
  }
  add(new THREE.CylinderGeometry(0.32, 0.38, 0.6, 10), new THREE.MeshLambertMaterial({ color: 0xffffff }), 0, 1.0, -0.2);
  add(new THREE.SphereGeometry(0.4, 14, 10), new THREE.MeshLambertMaterial({ color: 0xffd9b0 }), 0, 1.6, -0.2);
  add(new THREE.SphereGeometry(0.44, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), paint, 0, 1.63, -0.2);
  const flame = add(new THREE.ConeGeometry(0.4, 2.2, 8), new THREE.MeshBasicMaterial({ color: 0x4fd8ff, transparent: true, opacity: 0.85 }), 0, 0.55, -2.3);
  flame.rotation.x = -Math.PI / 2;
  flame.visible = false;
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.6, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.07;
  root.add(shadow);
  scene.add(root);
  return { root, body, flame, wheels };
}

class Kart {
  constructor(name, color, isPlayer) {
    this.name = name; this.color = color; this.isPlayer = isPlayer;
    this.mesh = buildKartMesh(color);
    this.pos = new THREE.Vector3();
    this.ai = { lane: 0, laneT: 0, max: 54, itemT: 2, stuckT: 0 };
  }
  reset(slot) {
    const row = Math.floor(slot / 2), side = slot % 2 ? 1 : -1;
    const i = mod(N - 8 - row * 7 - (slot % 2) * 3);
    this.idx = i; this.progress = i - N;
    this.pos.copy(PTS[i]).addScaledVector(NRM[i], side * 3.2);
    this.h = Math.atan2(TAN[i].x, TAN[i].z);
    this.vx = 0; this.vz = 0; this.fwd = 0; this.lat = 0; this.off = 0;
    this.items = []; this.gauge = 0; this.boostT = 0; this.spinT = 0; this.spinA = 0;
    this.drifting = false; this.driftTime = 0; this.visYaw = 0;
    this.finished = false; this.finishTime = 0;
    this.ai.lane = side * 3.2; this.ai.laneT = 2 + Math.random() * 3;
    this.ai.max = 51 + Math.random() * 5.5; this.ai.stuckT = 0; this.ai.itemT = 2;
    this.sync(0);
  }
  spin(t) {
    if (this.spinT > 0) return;
    this.spinT = t; this.vx *= 0.35; this.vz *= 0.35; this.boostT = 0; this.drifting = false;
    if (this.isPlayer) beep(140, 0.3, 'sawtooth');
  }
  update(dt, inp) {
    if (this.spinT > 0) {
      this.spinT -= dt; this.spinA += dt * 14;
      inp = { accel: 0, brake: 0, steer: 0, drift: false };
      if (this.spinT <= 0) this.spinA = 0;
    }
    if (this.boostT > 0) this.boostT -= dt;
    const boosting = this.boostT > 0;

    let fx = Math.sin(this.h), fz = Math.cos(this.h);
    let fwd = this.vx * fx + this.vz * fz;

    // 드리프트 상태
    if (!this.drifting && inp.drift && inp.steer !== 0 && fwd > 18) { this.drifting = true; this.driftTime = 0; }
    else if (this.drifting && (!inp.drift || fwd < 10)) {
      this.drifting = false;
      if (this.driftTime > 0.8) { this.boostT = Math.max(this.boostT, 0.55); if (this.isPlayer) beep(660, 0.12, 'square'); }
    }
    if (this.drifting) this.driftTime += dt;

    // 조향
    const rate = (this.drifting ? 2.35 : 1.75) * clamp(Math.abs(fwd) / 14, Math.abs(fwd) > 0.5 ? 0.3 : 0, 1) * (fwd < 0 ? -1 : 1);
    this.h += inp.steer * rate * dt;
    fx = Math.sin(this.h); fz = Math.cos(this.h);
    fwd = this.vx * fx + this.vz * fz;
    let lat = this.vx * fz - this.vz * fx;

    // 가감속
    const offRoad = Math.abs(this.off) > HW + 1.2;
    const base = this.isPlayer && !this.finished ? PLAYER_MAX : this.ai.max * this.rubber;
    const max = base * (boosting ? 1.45 : 1) * (offRoad ? 0.5 : 1);
    if (inp.accel > 0) fwd += (boosting ? 60 : 30) * (1 - fwd / max) * dt;
    else if (boosting) fwd += 60 * (1 - fwd / max) * dt;
    else fwd -= fwd * 0.6 * dt;
    if (inp.brake > 0) fwd = Math.max(fwd - 48 * dt, -14);
    if (offRoad && fwd > max) fwd -= (fwd - max) * 2.5 * dt;
    lat *= Math.exp(-(this.drifting ? 3.4 : 11) * dt);

    this.vx = fx * fwd + fz * lat; this.vz = fz * fwd - fx * lat;
    this.pos.x += this.vx * dt; this.pos.z += this.vz * dt;
    this.fwd = fwd; this.lat = lat;

    // 드리프트 게이지
    if (this.drifting && Math.abs(lat) > 4) {
      this.gauge += dt * 0.3;
      if (this.gauge >= 1) {
        this.gauge = 0;
        if (this.items.length < 2) { this.items.push('boost'); if (this.isPlayer) beep(880, 0.15, 'triangle'); }
      }
    }

    // 트랙 위치 추적
    let best = 1e9, bi = this.idx;
    for (let k = -12; k <= 28; k++) {
      const i = mod(this.idx + k), dx = this.pos.x - PTS[i].x, dz = this.pos.z - PTS[i].z, d = dx * dx + dz * dz;
      if (d < best) { best = d; bi = i; }
    }
    let delta = bi - this.idx;
    if (delta > N / 2) delta -= N; else if (delta < -N / 2) delta += N;
    this.progress += delta; this.idx = bi;
    const n = NRM[bi];
    this.off = (this.pos.x - PTS[bi].x) * n.x + (this.pos.z - PTS[bi].z) * n.z;

    // 벽 충돌
    const lim = WALL - 0.6;
    if (Math.abs(this.off) > lim) {
      const s = Math.sign(this.off), over = Math.abs(this.off) - lim;
      this.pos.x -= n.x * s * over; this.pos.z -= n.z * s * over;
      const vn = (this.vx * n.x + this.vz * n.z) * s;
      if (vn > 0) { this.vx -= n.x * s * vn * 1.3; this.vz -= n.z * s * vn * 1.3; }
      const k = Math.exp(-1.5 * dt); this.vx *= k; this.vz *= k;
      this.off = s * lim;
    }

    // 완주 판정
    if (!this.finished && this.progress >= LAPS * N) {
      this.finished = true; this.finishTime = raceTime;
    }
    this.sync(dt, inp, boosting);
  }
  sync(dt, inp, boosting) {
    const m = this.mesh;
    m.root.position.copy(this.pos);
    m.root.rotation.y = this.h;
    const targetYaw = this.drifting && inp ? inp.steer * 0.38 : 0;
    this.visYaw += (targetYaw - this.visYaw) * Math.min(1, dt * 8);
    m.body.rotation.y = this.visYaw + this.spinA;
    m.body.rotation.z = inp ? -inp.steer * 0.05 * clamp(this.fwd / 30, 0, 1) : 0;
    m.flame.visible = !!boosting;
    if (boosting) m.flame.scale.set(1, 0.8 + Math.random() * 0.5, 1);
    for (const w of m.wheels) w.rotation.x += (this.fwd || 0) * dt * 2.2;
    if (dt > 0) {
      const bx = this.pos.x - Math.sin(this.h) * 1.4, bz = this.pos.z - Math.cos(this.h) * 1.4;
      if (this.drifting && Math.random() < 0.7) puff(bx, 0.3, bz, 0xffffff, 0.45, 2.5);
      if (boosting && Math.random() < 0.6) puff(bx, 0.6, bz, 0x6fe0ff, 0.3, 1.5, 0.8);
      if (Math.abs(this.off) > HW + 1.5 && Math.abs(this.fwd) > 12 && Math.random() < 0.4) puff(bx, 0.2, bz, 0x7a9a4a, 0.4, 3);
    }
  }
  aiInput(dt) {
    const a = this.ai;
    a.laneT -= dt;
    if (a.laneT <= 0) { a.laneT = 2 + Math.random() * 4; a.lane = (Math.random() - 0.5) * 9; }
    const look = Math.round(10 + this.fwd * 0.22);
    const ti = mod(this.idx + look);
    const tx = PTS[ti].x + NRM[ti].x * a.lane, tz = PTS[ti].z + NRM[ti].z * a.lane;
    const diff = wrapAngle(Math.atan2(tx - this.pos.x, tz - this.pos.z) - this.h);
    let curv = 0;
    for (let k = 6; k <= 42; k += 6) curv = Math.max(curv, CURV[mod(this.idx + k)]);
    const target = Math.max(26, 80 / (1 + curv * 1.15));
    // 끼임 방지
    if (this.fwd < 4 && this.spinT <= 0) a.stuckT += dt; else a.stuckT = 0;
    if (a.stuckT > 2.5) { a.stuckT = 0; this.respawn(); }
    // 아이템 사용
    if (this.items.length) {
      a.itemT -= dt;
      if (a.itemT <= 0) {
        const it = this.items[0];
        if (it !== 'boost' || curv < 0.12) { useItem(this); a.itemT = 1.5 + Math.random() * 3.5; }
      }
    }
    return { accel: this.fwd < target ? 1 : 0, brake: this.fwd > target + 10 ? 1 : 0, steer: clamp(diff * 3, -1, 1), drift: false };
  }
  respawn() {
    const i = this.idx;
    this.pos.copy(PTS[i]);
    this.h = Math.atan2(TAN[i].x, TAN[i].z);
    this.vx = this.vz = 0; this.spinT = 0; this.spinA = 0; this.drifting = false;
  }
}

const NAMES = [['나', 0xe53935], ['번개', 0x1e88e5], ['호랑이', 0xfb8c00], ['민트', 0x26c6a0], ['보라돌이', 0x8e44ad], ['바나나', 0xfdd835]];
const karts = NAMES.map(([n, c], i) => new Kart(n, c, i === 0));
const player = karts[0];

// ───────────────────────── 아이템 ─────────────────────────
const ICON = { boost: '⚡', oil: '🛢️', rocket: '🚀' };
const boxes = [], oils = [], rockets = [];
{
  const tex = canvasTex(64, 64, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#ff7ad9'); gr.addColorStop(0.5, '#ffe14a'); gr.addColorStop(1, '#4ad8ff');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#fff'; g.lineWidth = 5; g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = '#fff'; g.font = 'bold 46px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('?', w / 2, h / 2 + 3);
  });
  const geo = new THREE.BoxGeometry(1.8, 1.8, 1.8);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.92 });
  for (const f of [0.13, 0.37, 0.6, 0.84]) for (const lane of [-4.5, 0, 4.5]) {
    const i = Math.round(f * N);
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(PTS[i]).addScaledVector(NRM[i], lane);
    m.position.y = 1.6;
    scene.add(m);
    boxes.push({ m, t: 0 });
  }
}
const oilGeo = new THREE.CylinderGeometry(1.7, 1.7, 0.08, 16);
const oilMat = new THREE.MeshBasicMaterial({ color: 0x15151c });
const rocketGeo = new THREE.ConeGeometry(0.45, 2, 8);
const rocketMat = new THREE.MeshLambertMaterial({ color: 0xff5544 });

function ranked() {
  return [...karts].sort((a, b) => (b.finished ? 1e9 - b.finishTime : b.progress) - (a.finished ? 1e9 - a.finishTime : a.progress));
}
function useItem(k) {
  const it = k.items.shift();
  if (!it) return;
  if (it === 'boost') {
    k.boostT = 2.2;
    if (k.isPlayer) beep(520, 0.25, 'square');
  } else if (it === 'oil') {
    const m = new THREE.Mesh(oilGeo, oilMat);
    m.position.set(k.pos.x - Math.sin(k.h) * 3.5, 0.08, k.pos.z - Math.cos(k.h) * 3.5);
    scene.add(m);
    oils.push({ m, owner: k, t: 0 });
    if (k.isPlayer) beep(240, 0.12, 'sine');
  } else if (it === 'rocket') {
    const r = ranked(), me = r.indexOf(k);
    const target = me > 0 && !r[me - 1].finished ? r[me - 1] : null;
    const m = new THREE.Mesh(rocketGeo, rocketMat);
    m.position.set(k.pos.x, 1.2, k.pos.z);
    scene.add(m);
    rockets.push({ m, owner: k, target, idx: k.idx, life: 6 });
    if (k.isPlayer) beep(320, 0.3, 'sawtooth');
  }
}
function boom(x, z) {
  for (let i = 0; i < 16; i++) puff(x, 1, z, i % 2 ? 0xffa030 : 0xfff06a, 0.6, 9, 1.4);
}
function updateItems(dt) {
  const t = performance.now() / 1000;
  for (const b of boxes) {
    if (b.t > 0) { b.t -= dt; if (b.t <= 0) b.m.visible = true; continue; }
    b.m.rotation.y = t * 1.5; b.m.rotation.x = t;
    for (const k of karts) {
      const dx = k.pos.x - b.m.position.x, dz = k.pos.z - b.m.position.z;
      if (dx * dx + dz * dz < 6.5) {
        b.t = 4; b.m.visible = false;
        if (k.items.length < 2) {
          const r = Math.random();
          k.items.push(r < 0.4 ? 'boost' : r < 0.7 ? 'oil' : 'rocket');
          if (k.isPlayer) beep(780, 0.1, 'triangle');
        }
        break;
      }
    }
  }
  for (let i = oils.length - 1; i >= 0; i--) {
    const o = oils[i]; o.t += dt;
    let hit = o.t > 40;
    for (const k of karts) {
      if (k === o.owner && o.t < 1.2) continue;
      const dx = k.pos.x - o.m.position.x, dz = k.pos.z - o.m.position.z;
      if (dx * dx + dz * dz < 5.5) { k.spin(1.0); hit = true; break; }
    }
    if (hit) { scene.remove(o.m); oils.splice(i, 1); }
  }
  for (let i = rockets.length - 1; i >= 0; i--) {
    const r = rockets[i]; r.life -= dt;
    const p = r.m.position;
    let tx, tz, done = r.life <= 0;
    const tg = r.target;
    if (tg && Math.hypot(tg.pos.x - p.x, tg.pos.z - p.z) < 38) { tx = tg.pos.x; tz = tg.pos.z; }
    else { const ti = mod(r.idx + 7); tx = PTS[ti].x; tz = PTS[ti].z; }
    const d = Math.hypot(tx - p.x, tz - p.z) || 1;
    const dx = (tx - p.x) / d, dz = (tz - p.z) / d;
    p.x += dx * 115 * dt; p.z += dz * 115 * dt;
    r.m.rotation.set(Math.PI / 2, 0, 0); r.m.rotation.z = -Math.atan2(dx, dz);
    puff(p.x, 1.2, p.z, 0xdddddd, 0.3, 1, 0.7);
    let best = 1e9;
    for (let k = -4; k <= 30; k++) {
      const j = mod(r.idx + k), ex = p.x - PTS[j].x, ez = p.z - PTS[j].z, e = ex * ex + ez * ez;
      if (e < best) { best = e; r.bi = j; }
    }
    r.idx = r.bi;
    for (const k of karts) {
      if (k === r.owner) continue;
      if (Math.hypot(k.pos.x - p.x, k.pos.z - p.z) < 2.6) { k.spin(1.3); boom(p.x, p.z); done = true; break; }
    }
    if (done) { scene.remove(r.m); rockets.splice(i, 1); }
  }
}
function clearItems() {
  for (const o of oils) scene.remove(o.m);
  for (const r of rockets) scene.remove(r.m);
  oils.length = rockets.length = 0;
  for (const b of boxes) { b.t = 0; b.m.visible = true; }
}

// ───────────────────────── 입력 / 소리 ─────────────────────────
const keys = {};
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  if (e.code === 'Space' && state === 'race' && !player.finished && player.spinT <= 0) useItem(player);
  if (e.code === 'KeyR' && state === 'race' && !player.finished) player.respawn();
  if (e.code === 'KeyM') { muted = !muted; if (master) master.gain.value = muted ? 0 : 1; }
  if (e.code === 'Enter' && (state === 'menu' || state === 'done')) startRace();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

let actx = null, master = null, engOsc = null, engGain = null, muted = false;
function initAudio() {
  if (actx) return;
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(actx.destination);
    engOsc = actx.createOscillator(); engOsc.type = 'sawtooth';
    const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
    engGain = actx.createGain(); engGain.gain.value = 0;
    engOsc.connect(lp); lp.connect(engGain); engGain.connect(master);
    engOsc.start();
  } catch (e) { actx = null; }
}
function beep(freq, dur, type = 'sine') {
  if (!actx) return;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.12, actx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
  o.connect(g); g.connect(master);
  o.start(); o.stop(actx.currentTime + dur);
}

// ───────────────────────── 게임 상태 ─────────────────────────
let state = 'menu', raceTime = 0, countdown = 0, lastCount = 0, goT = 0, camH = 0;

function startRace() {
  initAudio();
  // 플레이어는 맨 뒤에서 출발
  karts.forEach((k, i) => k.reset(k.isPlayer ? karts.length - 1 : i - 1));
  clearItems();
  raceTime = 0; countdown = 3.6; lastCount = 4; goT = 0;
  camH = player.h;
  state = 'countdown';
  $('menu').classList.add('hidden');
  $('results').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('center').textContent = '';
}
$('startBtn').addEventListener('click', startRace);
$('againBtn').addEventListener('click', startRace);

function playerInput() {
  return {
    accel: keys.ArrowUp || keys.KeyW ? 1 : 0,
    brake: keys.ArrowDown || keys.KeyS ? 1 : 0,
    steer: (keys.ArrowLeft || keys.KeyA ? 1 : 0) - (keys.ArrowRight || keys.KeyD ? 1 : 0),
    drift: !!(keys.ShiftLeft || keys.ShiftRight),
  };
}
function collideKarts() {
  for (let i = 0; i < karts.length; i++) for (let j = i + 1; j < karts.length; j++) {
    const a = karts[i], b = karts[j];
    const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz);
    if (d < 2.5 && d > 0.001) {
      const nx = dx / d, nz = dz / d, push = (2.5 - d) / 2;
      a.pos.x -= nx * push; a.pos.z -= nz * push; b.pos.x += nx * push; b.pos.z += nz * push;
      const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
      if (rel < 0) { a.vx += nx * rel * 0.5; a.vz += nz * rel * 0.5; b.vx -= nx * rel * 0.5; b.vz -= nz * rel * 0.5; }
    }
  }
}
const fmt = (t) => {
  const m = Math.floor(t / 60), s = t - m * 60;
  return String(m).padStart(2, '0') + ':' + s.toFixed(2).padStart(5, '0');
};
function showResults() {
  const r = ranked();
  const place = r.indexOf(player) + 1;
  $('resultTitle').textContent = place === 1 ? '🏆 우승!' : `${place}등으로 완주!`;
  $('resultList').innerHTML = r.map((k) =>
    `<li class="${k.isPlayer ? 'me' : ''}">${k.name} — ${k.finished ? fmt(k.finishTime) : '주행 중'}</li>`).join('');
  $('results').classList.remove('hidden');
}

function step(dt) {
  if (state === 'countdown') {
    countdown -= dt;
    const c = Math.ceil(countdown);
    if (c !== lastCount && c >= 1 && c <= 3) { lastCount = c; $('center').textContent = c; beep(440, 0.15, 'square'); }
    if (countdown <= 0) { state = 'race'; $('center').textContent = 'GO!'; goT = 1; beep(880, 0.4, 'square'); }
    for (const k of karts) k.sync(0);
  } else if (state === 'race' || state === 'done') {
    raceTime += dt;
    if (goT > 0) { goT -= dt; if (goT <= 0) $('center').textContent = ''; }
    for (const k of karts) {
      const gap = k.progress - player.progress;
      k.rubber = k.isPlayer ? 1 : gap > 70 ? 0.9 : gap < -70 ? 1.07 : 1;
      k.update(dt, k.isPlayer && !k.finished ? playerInput() : k.aiInput(dt));
    }
    collideKarts();
    updateItems(dt);
    if (state === 'race' && player.finished) { state = 'done'; showResults(); beep(1040, 0.5, 'triangle'); }
    else if (state === 'done' && Math.floor(raceTime * 2) !== Math.floor((raceTime - dt) * 2)) showResults();
  }
  updateParticles(dt);
}

// ───────────────────────── 카메라 / HUD ─────────────────────────
function updateCamera(dt) {
  if (state === 'menu') {
    const t = performance.now() / 9000;
    camera.position.set(Math.cos(t) * 230, 120, 40 + Math.sin(t) * 230);
    camera.lookAt(0, 0, 40);
    return;
  }
  camH += wrapAngle(player.h - camH) * Math.min(1, dt * 5.5);
  const fx = Math.sin(camH), fz = Math.cos(camH);
  camera.position.set(player.pos.x - fx * 9.5, 4.6, player.pos.z - fz * 9.5);
  camera.lookAt(player.pos.x + fx * 5, 1.4, player.pos.z + fz * 5);
  const fov = 70 + clamp((player.fwd - 50) * 0.5, 0, 16);
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix(); }
}

const mini = $('minimap'), mctx = mini.getContext('2d');
let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
for (const p of PTS) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
const mScale = (mini.width - 28) / Math.max(maxX - minX, maxZ - minZ);
const mx = (x) => 14 + (maxX - x) * mScale + (mini.width - 28 - (maxX - minX) * mScale) / 2;
const mz = (z) => 14 + (maxZ - z) * mScale + (mini.height - 28 - (maxZ - minZ) * mScale) / 2;
function drawMinimap() {
  mctx.clearRect(0, 0, mini.width, mini.height);
  mctx.beginPath();
  for (let i = 0; i <= N; i += 4) { const p = PTS[i % N]; i ? mctx.lineTo(mx(p.x), mz(p.z)) : mctx.moveTo(mx(p.x), mz(p.z)); }
  mctx.lineWidth = 7; mctx.strokeStyle = 'rgba(255,255,255,.85)'; mctx.lineJoin = 'round'; mctx.stroke();
  mctx.fillStyle = '#111'; mctx.fillRect(mx(PTS[0].x) - 2, mz(PTS[0].z) - 6, 4, 12);
  for (let i = karts.length - 1; i >= 0; i--) {
    const k = karts[i];
    mctx.beginPath(); mctx.arc(mx(k.pos.x), mz(k.pos.z), k.isPlayer ? 6 : 4.5, 0, Math.PI * 2);
    mctx.fillStyle = '#' + k.color.toString(16).padStart(6, '0'); mctx.fill();
    mctx.lineWidth = 2; mctx.strokeStyle = k.isPlayer ? '#fff' : '#222'; mctx.stroke();
  }
}
function updateHUD() {
  if (state === 'menu') return;
  const place = ranked().indexOf(player) + 1;
  $('rank').innerHTML = `${place}<small>/${karts.length}</small>`;
  $('lap').textContent = `LAP ${clamp(Math.floor(player.progress / N) + 1, 1, LAPS)}/${LAPS}`;
  $('time').textContent = fmt(player.finished ? player.finishTime : raceTime);
  $('speed').innerHTML = `${Math.round(Math.abs(player.fwd) * 2.6)}<small> km/h</small>`;
  $('gauge').style.width = (player.gauge * 100).toFixed(0) + '%';
  $('slot0').textContent = ICON[player.items[0]] || '';
  $('slot1').textContent = ICON[player.items[1]] || '';
  const t = TAN[player.idx];
  const wrong = state === 'race' && player.vx * t.x + player.vz * t.z < -6;
  $('notice').textContent = wrong ? '⚠ 역주행!' : player.spinT > 0 ? '미끄러짐!' : '';
  drawMinimap();
  if (engOsc) {
    engOsc.frequency.value = 55 + Math.abs(player.fwd) * 2.4 + (player.drifting ? 25 : 0);
    engGain.gain.value = state === 'race' ? 0.05 : 0.02;
  }
}

// ───────────────────────── 메인 루프 ─────────────────────────
karts.forEach((k, i) => k.reset(k.isPlayer ? karts.length - 1 : i - 1));
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  step(dt);
  updateCamera(dt);
  updateHUD();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 디버그/테스트용
window.__game = { karts, player, step, startRace, get state() { return state; }, get raceTime() { return raceTime; } };
