import * as THREE from 'three';

/* Statyczne OBB – collider używany przez fizykę i wizualizację */
export function makeBox(w, h, d, color) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = color && color.isMaterial ? color
    : new THREE.MeshStandardMaterial({ color: color ?? 0x888888, roughness: 0.85, metalness: 0.05 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/* --- tekstury proceduralne --- */
function grassTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#4c7a3d';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 12000; i++) {
    const g = 96 + Math.random() * 60;
    ctx.fillStyle = `rgb(${30 + Math.random() * 30},${g},${40 + Math.random() * 25})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* odcinek drogi: asfalt + białe krawędzie + przerywana linia środka */
function roadTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#33363b';
  ctx.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 2500; i++) {
    const v = 44 + Math.random() * 22;
    ctx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
    ctx.fillRect(Math.random() * 128, Math.random() * 256, 2, 2);
  }
  ctx.fillStyle = '#e8e8e2';
  ctx.fillRect(6, 0, 4, 256);          // lewa krawędź
  ctx.fillRect(118, 0, 4, 256);        // prawa krawędź
  ctx.fillStyle = '#f2e46a';
  for (let y = 0; y < 256; y += 64) {  // przerywana środkowa
    ctx.fillRect(61, y, 6, 34);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function concreteTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8b9096';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) {
    const v = 125 + Math.random() * 30;
    ctx.fillStyle = `rgb(${v},${v + 2},${v + 4})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  ctx.strokeStyle = 'rgba(60,62,66,.55)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 256; i += 64) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildWorld(scene) {
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  const addBox = (mesh, x, y, z, yaw = 0, pitch = 0) => {
    mesh.position.set(x, y, z);
    const q = new THREE.Quaternion()
      .setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
    mesh.quaternion.copy(q);
    const hx = mesh.geometry.parameters.width / 2;
    const hy = mesh.geometry.parameters.height / 2;
    const hz = mesh.geometry.parameters.depth / 2;
    group.add(mesh);
    colliders.push({ pos: mesh.position, quat: q, hx, hy, hz, mesh });
    return mesh;
  };

  /* ---------- teren: trawiasty 800 × 800 ---------- */
  const grass = grassTexture();
  grass.wrapS = grass.wrapT = THREE.RepeatWrapping;
  grass.repeat.set(28, 28);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(800, 800),
    new THREE.MeshStandardMaterial({ map: grass, roughness: 1, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  /* ---------- sieć dróg (pasek: szer × dł, y=0.02, obrót yaw) ---------- */
  const roadTex = roadTexture();
  roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.9, metalness: 0 });
  const addRoad = (length, width, x, z, yaw = 0, tiles = null) => {
    const tex = roadTex.clone();
    tex.needsUpdate = true;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, tiles ?? Math.round(length / 16));
    const mat = roadMat.clone();
    mat.map = tex;
    const m = new THREE.Mesh(new THREE.BoxGeometry(width, 0.03, length), mat);
    m.position.set(x, 0.015, z);
    m.rotation.y = yaw;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  // bulwar NS przez całą mapę + aleje EW + ulice boczne
  addRoad(300, 14, 0, 0);
  addRoad(300, 12, 0, -100);
  addRoad(300, 12, 0, 100);
  addRoad(300, 12, -75, 0, Math.PI / 2);
  addRoad(300, 12, 75, 0, Math.PI / 2);
  addRoad(300, 12, -75, -100, Math.PI / 2);
  addRoad(300, 12, 75, -100, Math.PI / 2);
  addRoad(300, 12, -75, 100, Math.PI / 2);
  addRoad(300, 12, 75, 100, Math.PI / 2);

  // plac manewrowy przy starcie (beton)
  const conc = concreteTexture();
  conc.wrapS = conc.wrapT = THREE.RepeatWrapping;
  conc.repeat.set(4, 4);
  const plaza = new THREE.Mesh(
    new THREE.BoxGeometry(70, 0.03, 46),
    new THREE.MeshStandardMaterial({ map: conc, roughness: 0.95 })
  );
  plaza.position.set(0, 0.012, 70);
  plaza.receiveShadow = true;
  group.add(plaza);

  /* ---------- mury zewnętrzne 300 × 300 ---------- */
  const wallMat = 0x5b6066;
  const H = 2.4;
  addBox(makeBox(300, H, 2, wallMat), 0, H / 2, 150);
  addBox(makeBox(300, H, 2, wallMat), 0, H / 2, -150);
  addBox(makeBox(2, H, 300, wallMat), 150, H / 2, 0);
  addBox(makeBox(2, H, 300, wallMat), -150, H / 2, 0);

  /* ---------- strefa crash-testu (bulwar x=0, na południe) ---------- */
  addBox(makeBox(1.2, 2.2, 16, 0xb9bec6), 0, 1.1, -95);
  addBox(makeBox(0.1, 2.2, 0.9, 0xd35400), -0.66, 1.1, -88);
  addBox(makeBox(0.1, 2.2, 0.9, 0xd35400), -0.66, 1.1, -102);

  /* ---------- rampa (przy ulicy x=75, jazda w -Z) ---------- */
  const rampAng = 0.245;
  addBox(makeBox(12, 1.4, 9, 0x64696f), 75, 0.2, -60, 0, rampAng);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(12, 0.14, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xf39c12, roughness: 0.6 }));
  edge.position.set(75, 1.99, -64.1);
  edge.rotation.x = rampAng;
  edge.castShadow = true;
  group.add(edge);

  /* ---------- slalom: stożki wzdłuż ulicy x=-75 ---------- */
  const coneGeo = new THREE.ConeGeometry(0.25, 0.7, 10);
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.7 });
  for (let i = 0; i < 10; i++) {
    const c = new THREE.Mesh(coneGeo, coneMat);
    c.position.set(-75 + (i % 2 ? 1.8 : -1.8), 0.36, 40 - i * 8);
    c.castShadow = true;
    group.add(c);
    colliders.push({ pos: c.position, quat: new THREE.Quaternion(), hx: 0.3, hy: 0.36, hz: 0.3 });
  }

  /* ---------- słupki na skrzyżowaniu x=75 ---------- */
  for (let i = 0; i < 5; i++) {
    addBox(makeBox(0.4, 1.1, 0.4, 0xe74c3c), 75, 0.55, 30 + i * 8, i * 0.5);
  }

  /* ---------- drzewa (poza drogami) ---------- */
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 3.2, 8);
  const crownGeo = new THREE.ConeGeometry(2.4, 5.5, 8);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6d4c33, roughness: 1 });
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x2d6b2f, roughness: 1 });
  const treeSpots = [
    [-40, 40], [40, 40], [-40, -45], [40, -45],
    [-110, 45], [112, 45], [-110, -45], [112, -45],
    [-110, 140], [-40, 140], [40, 140], [110, 140],
    [-110, -140], [-40, -140], [40, -140], [110, -140],
  ];
  for (const [tx, tz] of treeSpots) {
    const t = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.6;
    trunk.castShadow = true;
    const crown = new THREE.Mesh(crownGeo, crownMat);
    crown.position.y = 5.4;
    crown.castShadow = true;
    t.add(trunk, crown);
    t.position.set(tx, 0, tz);
    group.add(t);
    colliders.push({ pos: t.position, quat: new THREE.Quaternion(), hx: 0.5, hy: 3.2, hz: 0.5 });
  }

  return { colliders, group };
}
