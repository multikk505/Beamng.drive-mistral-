import * as THREE from 'three';
import { Node, Beam } from './softbody.js';
import { SoftBody } from './softbody.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* Trasy punktów zarysu bocznego (z, y, połszerokość, materiał odcinka).
   Materiały: 0 lakier, 1 szkło, 2 ciemny plastik. Pętla zamknięta; dół
   wraca od tyłu do przodu z łukami nadkoli nad kołami (z = ±1.6 / ∓1.45). */
const OUTLINE = [
  [2.32, 0.46, 0.70, 2],   // przód – dolna warga zderzaka
  [2.38, 0.58, 0.74, 2],   // zderzak
  [2.30, 0.82, 0.74, 0],   // pas reflektorów
  [2.05, 0.94, 0.74, 0],   // przód maski
  [1.50, 1.00, 0.78, 0],   // maska
  [1.02, 1.08, 0.78, 1],   // podstawa szyby
  [0.42, 1.48, 0.64, 1],   // góra wycieraczek... przedni słupek
  [-0.50, 1.52, 0.64, 1],  // dach
  [-1.32, 1.14, 0.68, 1],  // tylna szyba – podstawa
  [-2.05, 1.04, 0.72, 2],  // pokrywa bagażnika
  [-2.26, 0.88, 0.74, 2],
  [-2.32, 0.70, 0.74, 2],   // tylny zderzak
  [-2.28, 0.48, 0.70, 2],
  [-1.98, 0.48, 0.76, 2],
  [-1.82, 0.74, 0.82, 2],  // wejście w łuk nadkola
  [-1.45, 0.90, 0.84, 2],  // szczyt łuku (tył)
  [-1.08, 0.74, 0.82, 2],
  [-0.60, 0.50, 0.76, 2],  // próg
  [0.40, 0.48, 0.76, 2],
  [0.90, 0.50, 0.76, 2],
  [1.25, 0.74, 0.82, 2],   // wejście w przedni łuk
  [1.60, 0.90, 0.84, 2],   // szczyt łuku (przód)
  [2.02, 0.74, 0.82, 2],
].

  map(p => ({ z: p[0], y: p[1], w: p[2], m: p[3] }));

export const TIRES = {
  radius: 0.34,
  groundK: 150000,
  groundDamp: 3600,
  grip: 1.55,          // wyższa przyczepność = łatwiejsze prowadzenie
  latGrip: 6400,       // szybsza reakcja na skręt
  brakeForce: 7800,
  driveForce: 6400,
  maxSpeed: 55,
  rollResist: 22,
};

export class Vehicle {
  constructor(scene, opts = {}) {
    this.color = new THREE.Color(opts.color ?? 0xc62828);
    this.scene = scene;
    this.buildNodes();
    this.buildBeams();
    this.soft = new SoftBody(this.nodes, this.beams);
    this.soft.onForces = (dt) => this.addForces(dt);
    this.steer = 0;
    this.steerTarget = 0;
    this.damage = 0;
    this.control = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
    this.frame = { fwd: V(0, 0, 1), right: V(1, 0, 0), up: V(0, 1, 0) };
    this.speed = 0;
    this.buildVisual();
    scene.add(this.root);
  }

  buildNodes() {
    const F = 32, S = 16, R = TIRES.radius;
    const mk = (x, y, z, m, r, zone, wheel = false) => {
      const n = new Node(x, y, z, m, r);
      n.zone = zone;
      n.isWheel = wheel;
      n.wheel = null;
      return n;
    };
    this.nodes = [];
    this.nFL = mk(0.78, 0.50, 2.05, F, 0.14, 'frame');
    this.nFR = mk(-0.78, 0.50, 2.05, F, 0.14, 'frame');
    this.nML = mk(0.84, 0.52, 0.15, F, 0.14, 'frame');
    this.nMR = mk(-0.84, 0.52, 0.15, F, 0.14, 'frame');
    this.nRL = mk(0.78, 0.50, -1.85, F, 0.14, 'frame');
    this.nRR = mk(-0.78, 0.50, -1.85, F, 0.14, 'frame');
    this.nodes.push(this.nFL, this.nFR, this.nML, this.nMR, this.nRL, this.nRR);

    this.nRoofFL = mk(0.64, 1.46, 0.35, S, 0.20, 'shell');
    this.nRoofFR = mk(-0.64, 1.46, 0.35, S, 0.20, 'shell');
    this.nRoofRL = mk(0.66, 1.46, -1.05, S, 0.20, 'shell');
    this.nRoofRR = mk(-0.66, 1.46, -1.05, S, 0.20, 'shell');
    this.nCowlL = mk(0.72, 1.05, 1.05, S, 0.20, 'shell');
    this.nCowlR = mk(-0.72, 1.05, 1.05, S, 0.20, 'shell');
    this.nRearL = mk(0.74, 1.36, -1.95, S, 0.20, 'shell');
    this.nRearR = mk(-0.74, 1.36, -1.95, S, 0.20, 'shell');
    this.nHoodL = mk(0.72, 1.00, 2.02, S, 0.20, 'shell');
    this.nHoodR = mk(-0.72, 1.00, 2.02, S, 0.20, 'shell');
    this.nodes.push(this.nRoofFL, this.nRoofFR, this.nRoofRL, this.nRoofRR,
      this.nCowlL, this.nCowlR, this.nRearL, this.nRearR, this.nHoodL, this.nHoodR);

    const mkWheel = (x, z, front) => {
      const n = mk(x, R, z, 18, R, 'wheel', true);
      n.friction = 0; // tarcie styczne załatwia model opony
      n.wheel = {
        front,
        steer: 0,
        spin: 0,
        grounded: false,
        groundNormal: V(0, 1, 0),
        depth: 0,
        slip: 0,
      };
      return n;
    };
    this.wFL = mkWheel(0.86, 1.60, true);
    this.wFR = mkWheel(-0.86, 1.60, true);
    this.wRL = mkWheel(0.86, -1.45, false);
    this.wRR = mkWheel(-0.86, -1.45, false);
    this.nodes.push(this.wFL, this.wFR, this.wRL, this.wRR);
    this.wheels = [this.wFL, this.wFR, this.wRL, this.wRR];
  }

  buildBeams() {
    this.beams = [];
    const nodes = this.nodes;
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].isWheel) continue;
      for (let j = i + 1; j < nodes.length; j++) {
        if (nodes[j].isWheel) continue;
        const d = nodes[i].p.distanceTo(nodes[j].p);
        if (d > 3.2 || d < 0.4) continue;
        const bothFrame = nodes[i].zone === 'frame' && nodes[j].zone === 'frame';
        const beam = bothFrame
          ? new Beam(nodes[i], nodes[j], 110000, 220, 0.5, 0.05)
          : new Beam(nodes[i], nodes[j], 55000, 180, 0.7, 0.045);
        this.beams.push(beam);
      }
    }
    // zawieszenie: 3 belki na koło (poprzeczna, wzdłużna, pionowy amortyzator)
    const susp = (w, side, mid, tower) => {
      this.beams.push(Object.assign(new Beam(w, side, 60000, 700, 0.08, 0.4), { susp: true }));
      this.beams.push(Object.assign(new Beam(w, mid, 30000, 450, 0.08, 0.4), { susp: true }));
      this.beams.push(Object.assign(new Beam(w, tower, 75000, 1500, 0.08, 0.4), { susp: true }));
    };
    susp(this.wFL, this.nFL, this.nMR, this.nCowlL);
    susp(this.wFR, this.nFR, this.nML, this.nCowlR);
    susp(this.wRL, this.nRL, this.nML, this.nRearL);
    susp(this.wRR, this.nRR, this.nMR, this.nRearR);
  }

  setSpawn(x, z, yaw) {
    if (!this.basePos) this.basePos = this.nodes.map(n => n.p.clone());
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (let i = 0; i < this.nodes.length; i++) {
      const b = this.basePos[i];
      this.soft.spawn[i].set(x + b.x * c + b.z * s, b.y, z - b.x * s + b.z * c);
    }
    this.soft.reset();
    this.steer = 0; this.steerTarget = 0;
    this.updateVisual(0);
  }

  /* ---------- fizyka: siły opon, aerodynamika ---------- */
  addForces(dt) {
    // celowanie w układzie nadwozia
    this.computeFrame();
    const { fwd, right, up } = this.frame;

    // aerodynamika: opór + docisk
    const speed = this.wheels.reduce((s, w) => s + w.v.length(), 0) / 4;
    this.speed = speed;
    const dragPerNode = 0.42 / this.nodes.length;
    for (const n of this.nodes) {
      const vl = n.v.length();
      if (vl > 0.1) {
        n.f.addScaledVector(n.v, -vl * dragPerNode);
      }
      if (speed > 14 && !n.isWheel && n.zone !== 'frame') {
        n.f.addScaledVector(up, -Math.min(speed * speed * 0.9, 2600) / 8);
      }
    }

    // kierownica: szerszy kąt, wolniejsze usztywnianie z prędkością, szybsza reakcja
    const maxSteer = 0.70 / (1 + speed * 0.018);
    this.steerTarget = THREE.MathUtils.clamp(this.control.steer, -1, 1) * maxSteer;
    const rate = 9 + 5 * (1 - Math.min(1, speed / 30));
    this.steer += THREE.MathUtils.clamp(this.steerTarget - this.steer, -rate * dt, rate * dt);

    const t = TIRES;
    const fwdS = _v1.copy(fwd);
    const rightS = _v2.copy(right);

    for (const w of this.wheels) {
      const W = w.wheel;
      if (W.front) W.steer = this.steer;
      // kierunek opony (skrętny) zrzutowany na płaszczyznę kontaktu
      const q = _quat.setFromAxisAngle(up, W.steer);
      const wF = _v3.copy(fwdS).applyQuaternion(q);
      const wR = _v4.copy(rightS).applyQuaternion(q);

      // normal: grunt (0,1,0) albo ostatni kontakt z przeszkodą
      let nrm = null, depth = 0;
      if (w.contactNormal && w.contactNormal.y > 0.25) { nrm = w.contactNormal; depth = w.contactDepth || 0; }
      if (w.p.y < w.r) { depth = Math.max(depth, w.r - w.p.y); nrm = _v5.set(0, 1, 0); }
      depth = Math.min(depth, 0.25);
      W.grounded = !!nrm;

      if (!nrm) {
        W.slip *= 1 - Math.min(1, dt * 4);
        continue;
      }

      // siła normalna (sprężysto-tłumiona)
      const vn = w.v.dot(nrm);
      const Fn = t.groundK * depth + t.groundDamp * Math.max(0, -vn);
      w.f.addScaledVector(nrm, Fn);

      // baza opony na płaszczyźnie kontaktu
      wF.addScaledVector(nrm, -wF.dot(nrm)).normalize();
      wR.crossVectors(nrm, wF).normalize();

      const vF = w.v.dot(wF);
      const vL = w.v.dot(wR);
      const muN = t.grip * Fn;

      // napęd / hamulec wzdłużnie (AWD)
      let long = 0;
      long += (this.control.throttle * t.driveForce * 0.25) * THREE.MathUtils.clamp(1 - vF / t.maxSpeed, 0, 1);
      const brake = this.control.brake * t.brakeForce * 0.25 + (W.front ? 0 : this.control.handbrake * 4500);
      if (brake > 0 && Math.abs(vF) > 0.25) long -= Math.sign(vF) * Math.min(brake, Math.abs(vF) * 4000);
      long -= Math.sign(vF) * Math.min(t.rollResist, Math.abs(vF) * 30);

      // poprzecznie
      let lat = -vL * t.latGrip;
      W.slip = Math.min(1, W.slip + dt * (Math.abs(vL) + Math.max(0, Math.abs(long) - muN) / Math.max(t.driveForce, 1)) * 2.2);

      // okrąg tarcia
      let fx = long, fz = lat;
      const mag = Math.hypot(fx, fz);
      if (mag > muN && mag > 0) { fx *= muN / mag; fz *= muN / mag; }
      w.f.addScaledVector(wF, fx).addScaledVector(wR, fz);
      W.spin += (vF / t.radius + (mag > muN ? this.control.throttle * 16 : 0)) * dt;
    }
  }

  computeFrame() {
    const { fwd, right, up } = this.frame;
    _v1.set(0, 0, 0); _v2.set(0, 0, 0); _v3.set(0, 0, 0); _v4.set(0, 0, 0);
    const frontAvg = _v1, rearAvg = _v2, topAvg = _v3, botAvg = _v4;
    const fNodes = [this.nFL, this.nFR];
    const rNodes = [this.nRL, this.nRR];
    let top = [], bot = [];
    for (const n of this.nodes) {
      if (n.isWheel) continue;
      if (n.p.y > 0.95) top.push(n); else bot.push(n);
    }
    for (const n of fNodes) frontAvg.add(n.p); frontAvg.multiplyScalar(1 / fNodes.length);
    for (const n of rNodes) rearAvg.add(n.p); rearAvg.multiplyScalar(1 / rNodes.length);
    for (const n of top) topAvg.add(n.p); topAvg.multiplyScalar(1 / top.length);
    for (const n of bot) botAvg.add(n.p); botAvg.multiplyScalar(1 / bot.length);

    fwd.subVectors(frontAvg, rearAvg).normalize();
    right.crossVectors(topAvg, fwd).normalize();
    up.crossVectors(fwd, right).normalize();
    fwd.crossVectors(right, up).normalize();
  }

  step(dt, colliders, others) {
    this.soft.step(dt, colliders, others);
  }

  reset() {
    this.soft.reset();
    this.steer = 0; this.steerTarget = 0; this.damage = 0;
    this.updateVisual(0);
  }

  /* ---------- wizualizacja ---------- */
  buildVisual() {
    this.root = new THREE.Group();

    // geometria nadwozia powiązana z węzłami (soft-skinnning)
    const geo = this.buildBodyGeometry();
    this.bodyMesh = new THREE.Mesh(geo, this.bodyMaterial);
    this.bodyMesh.castShadow = true;
    this.bodyMesh.receiveShadow = true;
    this.root.add(this.bodyMesh);

    // detale (przypięte do 3 najbliższych węzłów)
    this.details = [];
    const addDetail = (geoD, color, wx, wy, wz, metal = 0.4, emissive = 0x000000) => {
      const m = new THREE.Mesh(geoD, new THREE.MeshStandardMaterial({
        color, metalness: metal, roughness: 0.45, emissive,
      }));
      m.castShadow = true;
      const bind = this.bindWeights(V(wx, wy, wz));
      this.details.push({ mesh: m, bind });
      this.root.add(m);
      return m;
    };
    // reflektory i światła
    addDetail(_box(0.42, 0.16, 0.06), 0xfff3c4, 0.5, 0.78, 2.32, 0.6, 0xffedb0);
    addDetail(_box(0.42, 0.16, 0.06), 0xfff3c4, -0.5, 0.78, 2.32, 0.6, 0xffedb0);
    addDetail(_box(0.46, 0.14, 0.06), 0xff2a1f, 0.5, 0.88, -2.29, 0.6, 0xe01414);
    addDetail(_box(0.46, 0.14, 0.06), 0xff2a1f, -0.5, 0.88, -2.29, 0.6, 0xe01414);
    // grill + zderzaki
    addDetail(_box(0.9, 0.2, 0.08), 0x101216, 0, 0.62, 2.35, 0.2);
    // lusterka
    addDetail(_box(0.2, 0.12, 0.08), this.color.getHex(), 0.92, 1.02, 0.95);
    addDetail(_box(0.2, 0.12, 0.08), this.color.getHex(), -0.92, 1.02, 0.95);

    // koła: opona (torus) + felga z ramionami i piastą
    this.wheelMeshes = [];
    const tireGeo = new THREE.TorusGeometry(TIRES.radius - 0.10, 0.105, 10, 20);
    tireGeo.rotateY(Math.PI / 2); // oś obrotu wzdłuż X
    const rimGeo = new THREE.CylinderGeometry(0.225, 0.225, 0.20, 16);
    rimGeo.rotateZ(Math.PI / 2);
    const hubGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.26, 10);
    hubGeo.rotateZ(Math.PI / 2);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x0d0d0f, roughness: 0.95, metalness: 0.03 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xdfe3ea, roughness: 0.22, metalness: 0.9 });
    const spokeGeo = _box(0.28, 0.40, 0.055);
    for (const w of this.wheels) {
      const g = new THREE.Group();
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.castShadow = true;
      const rim = new THREE.Mesh(rimGeo, rimMat);
      const hub = new THREE.Mesh(hubGeo, rimMat);
      g.add(tire, rim, hub);
      for (let i = 0; i < 6; i++) {
        const sp = new THREE.Mesh(spokeGeo, rimMat);
        sp.rotation.x = (i / 6) * Math.PI * 2;
        g.add(sp);
      }
      this.root.add(g);
      this.wheelMeshes.push(g);
    }
  }

  get bodyMaterial() {
    if (!this._bodyMat) {
      this._bodyMat = new THREE.MeshStandardMaterial({
        vertexColors: true, metalness: 0.65, roughness: 0.28, flatShading: true,
      });
    }
    return this._bodyMat;
  }

  buildBodyGeometry() {
    const SUB = 5;
    const pts = [];
    const mats = [];
    for (let i = 0; i < OUTLINE.length; i++) {
      const a = OUTLINE[i], b = OUTLINE[(i + 1) % OUTLINE.length];
      for (let s = 0; s < SUB; s++) {
        const t = s / SUB;
        pts.push([a.z + (b.z - a.z) * t, a.y + (b.y - a.y) * t, a.w + (b.w - a.w) * t, a.m]);
        mats.push(a.m);
      }
    }
    const n = pts.length;
    const positions = new Float32Array(n * 2 * 3);
    const colors = new Float32Array(n * 2 * 3);
    const indices = [];
    const cBody = this.color.clone().convertSRGBToLinear();
    const cDark = new THREE.Color(0x15171c).convertSRGBToLinear();
    const cGlass = new THREE.Color(0x070a12).convertSRGBToLinear();
    for (let i = 0; i < n; i++) {
      const [z, y, w, m] = pts[i];
      const col = m === 1 ? cGlass : (m === 2 ? cDark : cBody);
      for (let side = 0; side < 2; side++) {
        const x = side === 0 ? -w : w;
        const idx = (i * 2 + side) * 3;
        positions[idx] = x; positions[idx + 1] = y; positions[idx + 2] = z;
        colors[idx] = col.r; colors[idx + 1] = col.g; colors[idx + 2] = col.b;
      }
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const L0 = i * 2 + 0, R0 = i * 2 + 1, L1 = j * 2 + 0, R1 = j * 2 + 1;
      indices.push(L0, L1, R1, L0, R1, R0);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    this.skin = {
      count: n * 2,
      base: positions.slice(),
      bindings: new Array(n * 2),
    };
    for (let vIdx = 0; vIdx < n * 2; vIdx++) {
      _v1.set(positions[vIdx * 3], positions[vIdx * 3 + 1], positions[vIdx * 3 + 2]);
      this.skin.bindings[vIdx] = this.bindWeights(_v1);
    }
    return geo;
  }

  /* 3 najbliższe węzły karoserii (bez kół), wagi ~1/d²; offset = pozycja bazowa */
  bindWeights(p) {
    const candidates = [];
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      if (n.isWheel) continue;
      const d2 = n.p.distanceToSquared(p);
      candidates.push([i, d2]);
    }
    candidates.sort((a, b) => a[1] - b[1]);
    const sel = candidates.slice(0, 3);
    let sum = 0;
    const ws = sel.map(([, d2]) => { const w = 1 / (d2 + 0.03); sum += w; return w; });
    for (let k = 0; k < 3; k++) ws[k] /= sum;
    const c = _v2.set(0, 0, 0);
    for (let k = 0; k < 3; k++) c.addScaledVector(this.nodes[sel[k][0]].p, ws[k]);
    const offset = p.clone().sub(c);
    return { idx: sel.map(s => s[0]), w: ws, offset };
  }

  updateVisual(dt) {
    const pos = this.bodyMesh.geometry.attributes.position.array;
    const skin = this.skin;
    for (let v = 0; v < skin.count; v++) {
      const bind = skin.bindings[v];
      let x = bind.offset.x, y = bind.offset.y, z = bind.offset.z;
      for (let k = 0; k < 3; k++) {
        const n = this.nodes[bind.idx[k]].p;
        const w = bind.w[k];
        x += n.x * w; y += n.y * w; z += n.z * w;
      }
      pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z;
    }
    this.bodyMesh.geometry.attributes.position.needsUpdate = true;
    this.bodyMesh.geometry.computeVertexNormals();

    for (const d of this.details) {
      const c = _v2.set(0, 0, 0);
      for (let k = 0; k < 3; k++) c.addScaledVector(this.nodes[d.bind.idx[k]].p, d.bind.w[k]);
      d.mesh.position.copy(c).add(d.bind.offset);
    }

    this.computeFrame();
    const { fwd, right, up } = this.frame;
    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i], W = w.wheel, g = this.wheelMeshes[i];
      g.position.copy(w.p);
      _quat.setFromRotationMatrix(_m1.makeBasis(right, up, fwd));
      g.quaternion.copy(_quat);
      _q2.setFromAxisAngle(_v1.set(0, 1, 0), W.steer);
      g.quaternion.premultiply(_q2);
      _q2.setFromAxisAngle(_v1.set(1, 0, 0), -W.spin);
      g.quaternion.premultiply(_q2);
    }

    // uszkodzenia: suma trwałych odkształceń belek
    let dg = 0;
    for (const b of this.beams) dg += Math.abs(b.rest - b.rest0) / b.rest0;
    this.damage = Math.min(1, dg / 7);
  }

  get position() { return _v6.copy(this.nML.p); }
}

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(),
  _v4 = new THREE.Vector3(), _v5 = new THREE.Vector3(), _v6 = new THREE.Vector3();
const _quat = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _m1 = new THREE.Matrix4();
const _box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
