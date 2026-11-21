import * as THREE from 'three';
import { Vehicle } from './vehicle.js';
import { buildWorld } from './environment.js';
import { Controls } from './controls.js';
import { Sound } from './audio.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9db8d2);
scene.fog = new THREE.Fog(0x9db8d2, 120, 420);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.2, 800);

// światła
const hemi = new THREE.HemisphereLight(0xcfe3f7, 0x4a5238, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2dd, 2.4);
sun.position.set(60, 80, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -40; sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
sun.shadow.camera.near = 10; sun.shadow.camera.far = 220;
sun.shadow.bias = -0.0004;
scene.add(sun, sun.target);

const { colliders } = buildWorld(scene);

// auta – start na placu manewrowym; gracz jedzie bulwarem na południe (-Z):
// auto do zderzenia czołowego, dalej rampa/ulice, na końcu ściana crash-testu
const car = new Vehicle(scene, { color: 0xc62828 });
car.setSpawn(3, 70, Math.PI);
car.control = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };

const parked = new Vehicle(scene, { color: 0x2d6cb5 });
parked.setSpawn(-3, -60, 0);
parked.control = { throttle: 0, brake: 1, steer: 0, handbrake: 1 };

const controls = new Controls();
const sound = new Sound();

// kamera
let camMode = 0; // 0 = pościgowa, 1 = maska
const camPos = new THREE.Vector3(0, 4, 30);
const shake = new THREE.Vector3();

// HUD
const speedVal = document.getElementById('speed-val');
const dmgFill = document.getElementById('damage-fill');
const dmgLabel = document.getElementById('damage-label');

document.getElementById('btn-reset').addEventListener('click', () => {
  car.reset();
  parked.reset();
});
document.getElementById('btn-cam').addEventListener('click', () => { camMode = (camMode + 1) % 2; });
document.getElementById('btn-sound').addEventListener('click', (e) => {
  sound.init(); sound.resume();
  const on = !sound.enabled;
  sound.setEnabled(on);
  e.currentTarget.textContent = on ? '🔊' : '🔇';
});
document.getElementById('btn-full').addEventListener('click', async () => {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
    if (screen.orientation && screen.orientation.lock) {
      await screen.orientation.lock('landscape').catch(() => {});
    }
  } catch { /* iOS: brak API fullscreen */ }
});

const startBtn = document.getElementById('btn-start');
startBtn.addEventListener('click', async () => {
  document.getElementById('start-screen').style.display = 'none';
  sound.init(); sound.resume();
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    if (screen.orientation && screen.orientation.lock) {
      await screen.orientation.lock('landscape').catch(() => {});
    }
  } catch { /* brak API – nakładka portrait i tak działa */ }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
const TIRE_MAX_SPEED_IN = 52;

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
let started = false;

function updateCamera(dt) {
  const t = car.position;
  const { fwd, right, up } = car.frame;
  let wanted;
  if (camMode === 0) {
    wanted = _v1.copy(t).addScaledVector(fwd, -8.2).addScaledVector(up, 3.2);
    if (wanted.y < 1.2) wanted.y = 1.2;
    camPos.lerp(wanted, 1 - Math.exp(-4.5 * dt));
  } else {
    wanted = _v1.copy(t).addScaledVector(fwd, 0.6).addScaledVector(up, 1.25);
    camPos.copy(wanted);
  }
  camera.position.copy(camPos).add(shake);
  const look = _v2.copy(t).addScaledVector(fwd, camMode === 0 ? 3.5 : 10);
  look.y += camMode === 0 ? 0.8 : 0.4;
  camera.lookAt(look);

  // słońce podąża za autem (spójne cienie)
  sun.position.set(t.x + 60, 80, t.z + 30);
  sun.target.position.copy(t);
}

function updateHUD(carDmg, parkedDmg) {
  const kmh = Math.round(car.speed * 3.6);
  speedVal.textContent = kmh;
  const dmg = Math.min(1, (carDmg + parkedDmg) / 2);
  dmgFill.style.width = (dmg * 100).toFixed(0) + '%';
  dmgFill.style.background = dmg < 0.33 ? '#2ecc71' : dmg < 0.66 ? '#f39c12' : '#e63946';
  dmgLabel.textContent = 'uszkodzenia ' + Math.round(dmg * 100) + '%';
}

function collectImpact(body) {
  let m = 0;
  for (const n of body.nodes) m = Math.max(m, n.impact);
  return m;
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (started) {
    car.control = controls.poll();

    const maxImpact = Math.max(collectImpact(car), collectImpact(parked));
    if (maxImpact > 2.2) {
      sound.crash(maxImpact);
      shake.set((Math.random() - .5), (Math.random() - .5), 0)
        .multiplyScalar(Math.min(maxImpact * 0.25, 14) * dt);
    } else {
      shake.multiplyScalar(Math.exp(-8 * dt));
    }

    car.step(dt, colliders, [parked]);
    parked.step(dt, colliders, null);

    car.updateVisual(dt);
    parked.updateVisual(dt);

    updateHUD(car.damage, parked.damage);
    sound.update(dt, Math.min(1, car.speed / TIRE_MAX_SPEED_IN), car.control.throttle, true);
  }
  updateCamera(dt);
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(tick);
started = true;
