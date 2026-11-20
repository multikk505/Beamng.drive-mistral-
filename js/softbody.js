import * as THREE from 'three';

const _dir = new THREE.Vector3();
const _relV = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _tmp2 = new THREE.Vector3();
const _local = new THREE.Vector3();
const _invQuat = new THREE.Quaternion();

export class Node {
  constructor(x, y, z, mass, radius = 0.14) {
    this.p = new THREE.Vector3(x, y, z);
    this.v = new THREE.Vector3();
    this.f = new THREE.Vector3();
    this.m = mass;
    this.invM = 1 / mass;
    this.r = radius;
    this.friction = 0.6;      // tarcie styczne przy kontakcie (wsp. prędkości stycznej)
    this.linearDamp = 0.04;   // tłumienie ogólne [1/s]
    this.contactNormal = null;
    this.impact = 0;          // siła uderzenia ostatniego kroku (do efektów)
  }
}

export class Beam {
  /**
   * k      – sztywność [N/m]
   * damp   – tłumienie wzdłuż belki [Ns/m]
   * plastic– 0..1, udział trwałego odkształcenia przy przeciążeniu
   * yield  – odkształcenie względne, powyżej którego materiał płynie plastycznie
   */
  constructor(a, b, k, damp, plastic = 0.55, yieldStrain = 0.05) {
    this.a = a; this.b = b;
    this.k = k; this.damp = damp;
    this.rest = a.p.distanceTo(b.p);
    this.rest0 = this.rest;
    this.minRest = this.rest0 * 0.25;
    this.maxRest = this.rest0 * 1.8;
    this.plastic = plastic;
    this.yield = yieldStrain;
    this.broken = false;
    this.breakStrain = 1.6;      // zerwanie przy 160% odkształcenia względem rest0
    this.strainNow = 0;
  }

  solve(dt) {
    if (this.broken) return;
    const a = this.a, b = this.b;
    _dir.subVectors(b.p, a.p);
    const len = _dir.length();
    if (len < 1e-6) return;
    _dir.multiplyScalar(1 / len);

    const strain = (len - this.rest) / this.rest;
    this.strainNow = strain;

    // plastyczność: nadmiar odkształcenia przenosi rest (trwała deformacja)
    if (this.plastic > 0 && Math.abs(strain) > this.yield) {
      const over = Math.abs(strain) - this.yield;
      const pl = Math.min(1, over * (6 + 60 * this.plastic));
      let nrest = this.rest + (len - this.rest) * Math.min(0.35, pl * this.plastic * dt * 60);
      this.rest = THREE.MathUtils.clamp(nrest, this.minRest, this.maxRest);
    }
    if (Math.abs(len - this.rest0) / this.rest0 > this.breakStrain) {
      this.broken = true;
      return;
    }

    const ext = len - this.rest;
    const spring = this.k * ext;

    _relV.subVectors(b.v, a.v);
    const vAlong = _relV.dot(_dir);
    const force = spring + this.damp * vAlong;

    if (a.m > 0) {
      a.f.addScaledVector(_dir, force);
    }
    if (b.m > 0) {
      b.f.addScaledVector(_dir, -force);
    }
  }
}

export class SoftBody {
  constructor(nodes, beams) {
    this.nodes = nodes;
    this.beams = beams;
    this.spawn = nodes.map(n => n.p.clone());
    this.gravity = -9.81;
    this.substeps = 6;
  }

  reset() {
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      n.p.copy(this.spawn[i]);
      n.v.set(0, 0, 0);
      n.f.set(0, 0, 0);
      n.impact = 0;
    }
    for (const b of this.beams) {
      b.rest = b.rest0;
      b.broken = false;
      b.strainNow = 0;
    }
  }

  collectNodeForces(contactBodies, colliders, dt) {
    for (const n of this.nodes) {
      n.f.set(0, this.gravity * n.m, 0);
      n.f.addScaledVector(n.v, -n.linearDamp * n.m);
      n.impact = 0;
    }
    for (const b of this.beams) b.solve(dt);
    if (this.onForces) this.onForces(dt);
  }

  integrate(dt) {
    for (const n of this.nodes) {
      n.v.addScaledVector(n.f, n.invM * dt);
      n.p.addScaledVector(n.v, dt);
    }
  }

  /**
   * Kolizje: płaszczyzna gruntu y=0, statyczne OBB, oraz ciała miękkie II (node-node).
   */
  resolveContacts(colliders, others, dt) {
    for (const n of this.nodes) {
      n.contactNormal = null;
      n.contactDepth = 0;
      // grunt: koła - sprężysty kontakt (model opony w addForces),
      // karoseria - korekcja pozycji
      if (n.p.y < n.r) {
        const depth = n.r - n.p.y;
        if (n.isWheel) {
          n.contactNormal = _tmp.set(0, 1, 0);
          n.contactDepth = depth;
        } else {
          pushNode(n, _tmp.set(0, 1, 0), depth, dt);
        }
      }
      for (const c of colliders) {
        sphereVsOBB(n, c, dt);
      }
    }
    if (others) {
      for (const o of others) nodeNodeBodies(this, o);
    }
  }

  step(dt, colliders, others) {
    const h = dt / this.substeps;
    for (let s = 0; s < this.substeps; s++) {
      this.collectNodeForces(colliders, others, h);
      this.integrate(h);
      this.resolveContacts(colliders, others, h);
    }
  }
}

function pushNode(n, normal, depth, dt) {
  n.p.addScaledVector(normal, depth);
  n.contactDepth = Math.max(n.contactDepth || 0, depth);
  const vn = n.v.dot(normal);
  n.impact = Math.max(n.impact, -vn);
  if (vn < 0) {
    // restytucja ~0.15, tarcie styczne skalowane krokiem czasowym
    n.v.addScaledVector(normal, -vn * 1.15);
    _tmp2.copy(n.v).addScaledVector(normal, -n.v.dot(normal));
    const mu = Math.min(1, n.friction * dt * 60);
    n.v.addScaledVector(_tmp2, -mu);
  }
  if (!n.contactNormal) n.contactNormal = normal.clone();
}

export function sphereVsOBB(n, box, dt) {
  _invQuat.copy(box.quat).invert();
  _local.copy(n.p).sub(box.pos).applyQuaternion(_invQuat);
  const hx = box.hx, hy = box.hy, hz = box.hz;
  const cx = THREE.MathUtils.clamp(_local.x, -hx, hx);
  const cy = THREE.MathUtils.clamp(_local.y, -hy, hy);
  const cz = THREE.MathUtils.clamp(_local.z, -hz, hz);
  let dx = _local.x - cx, dy = _local.y - cy, dz = _local.z - cz;
  let d2 = dx * dx + dy * dy + dz * dz;
  if (d2 > n.r * n.r) return;

  let nx, ny, nz, depth;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    nx = dx / d; ny = dy / d; nz = dz / d;
    depth = n.r - d;
  } else {
    // środek wewnątrz wypchnij wzdłuż najmniejszej osi
    const pxn = hx - Math.abs(_local.x), pyn = hy - Math.abs(_local.y), pzn = hz - Math.abs(_local.z);
    if (pyn <= pxn && pyn <= pzn) { nx = 0; ny = Math.sign(_local.y) || 1; nz = 0; depth = pyn + n.r; }
    else if (pxn <= pzn) { nx = Math.sign(_local.x) || 1; ny = 0; nz = 0; depth = pxn + n.r; }
    else { nx = 0; ny = 0; nz = Math.sign(_local.z) || 1; depth = pzn + n.r; }
  }
  _tmp.set(nx, ny, nz).applyQuaternion(box.quat);
  pushNode(n, _tmp.normalize(), Math.max(depth, 0), dt);
}

export function nodeNodeBodies(A, B, radiusScale = 1) {
  const nodesA = A.nodes, nodesB = B.nodes;
  for (const a of nodesA) {
    for (const b of nodesB) {
      const rr = (a.r + b.r) * radiusScale;
      _tmp.subVectors(b.p, a.p);
      const d2 = _tmp.lengthSq();
      if (d2 > rr * rr || d2 < 1e-8) continue;
      const d = Math.sqrt(d2);
      const depth = rr - d;
      _tmp.multiplyScalar(1 / d);
      const rel = _relV.subVectors(b.v, a.v).dot(_tmp);
      const impact = Math.max(0, -rel);
      b.impact = Math.max(b.impact, impact);
      a.impact = Math.max(a.impact, impact);
      const wa = a.m / (a.m + b.m);
      const wb = 1 - wa;
      a.p.addScaledVector(_tmp, -depth * wa * 0.5);
      b.p.addScaledVector(_tmp, depth * wb * 0.5);
      // impuls sprężysto-tłumiony wzdłuż normalnej
      const rest = 0.25, damp = 0.6 / Math.max(a.m + b.m, 1e-6);
      const j = -rel * (1 + rest) / (1 / a.m + 1 / b.m) - damp * rel;
      a.v.addScaledVector(_tmp, -j / a.m);
      b.v.addScaledVector(_tmp, j / b.m);
    }
  }
}
