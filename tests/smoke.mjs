/* Test dymny fizyki soft-body (Node, bez przeglądarki): npm i && node tests/smoke.mjs */
import * as THREE from 'three';

const root = new URL('../js/vehicle.js', import.meta.url).href;
const { Vehicle } = await import(root);

const scene = { add() {} };
const car = new Vehicle(scene, { color: 0xc62828 });
car.control = { throttle: 1, brake: 0, steer: 0, handbrake: 0 };
car.setSpawn(0, 0, 0);

const finite = () => car.nodes.every(n => [n.p.x, n.p.y, n.p.z, n.v.x, n.v.y, n.v.z].every(Number.isFinite));

// 1) jazda prosto 6 s
let yMin = 9;
for (let i = 0; i < 360; i++) {
  car.step(1 / 60, [], null);
  car.updateVisual(1 / 60);
  if (!finite()) { console.error('FAIL: NaN t=', i); process.exit(1); }
  for (const n of car.nodes) yMin = Math.min(yMin, n.p.y);
}
console.log('jazda: z =', car.nodes[0].p.z.toFixed(1), 'm, speed =', car.speed.toFixed(1), 'm/s, yMin =', yMin.toFixed(3));
if (car.nodes[0].p.z < 30) { console.error('FAIL: auto nie jedzie naprzód'); process.exit(1); }
if (yMin < -0.5) { console.error('FAIL: auto zapadło się pod grunt'); process.exit(1); }

// 2) crash w ścianę z pełnym gazem
const wall = {
  pos: new THREE.Vector3(0, 1.1, car.nodes[0].p.z + 12),
  quat: new THREE.Quaternion(),
  hx: 0.6, hy: 1.1, hz: 6,
};
let maxImpact = 0;
for (let i = 0; i < 300; i++) {
  car.step(1 / 60, [wall], null);
  car.updateVisual(1 / 60);
  for (const n of car.nodes) maxImpact = Math.max(maxImpact, n.impact);
  if (!finite()) { console.error('FAIL: NaN w crashu t=', i); process.exit(1); }
}
const vRest = Math.max(...car.nodes.map(n => n.v.length()));
const broken = car.beams.filter(b => b.broken).length;
console.log('crash: damage =', (car.damage * 100).toFixed(1) + '%, maxImpact =', maxImpact.toFixed(1),
  ', vRest =', vRest.toFixed(2), ', belki zerwane:', broken);
if (car.damage < 0.02) { console.error('FAIL: brak odkształceń przy zderzeniu'); process.exit(1); }
if (vRest > 3) { console.error('FAIL: fizyka eksplodowała'); process.exit(1); }

// 3) reset przywraca geometrię i spoczynek
car.reset();
car.control = { throttle: 0, brake: 1, steer: 0, handbrake: 1 };
const back = car.nodes.map((n, i) => n.p.distanceTo(car.soft.spawn[i]));
if (Math.max(...back) > 1e-6) { console.error('FAIL: reset nie wraca do spawnu'); process.exit(1); }
for (let i = 0; i < 120; i++) { car.step(1 / 60, [], null); car.updateVisual(1 / 60); }
const vIdle = Math.max(...car.nodes.map(n => n.v.length()));
console.log('postój po resecie: vMax =', vIdle.toFixed(3), 'm/s');
if (vIdle > 1.5) { console.error('FAIL: auto nie spoczywa'); process.exit(1); }

// 4) skręt zmienia tor
car.reset();
car.control = { throttle: 1, brake: 0, steer: -1, handbrake: 0 };
for (let i = 0; i < 240; i++) car.step(1 / 60, [], null);
const dx = car.nodes[0].p.x;
console.log('skręt: x =', dx.toFixed(1), 'm');
if (Math.abs(dx) < 3) { console.error('FAIL: skręt nie działa'); process.exit(1); }

console.log('SMOKE OK');
