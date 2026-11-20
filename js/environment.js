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

  // ---- teraz: asfalt z farbą
  const groundTex = makeGroundTexture();
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(8, 8);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // ---- ściany zewnętrzne poligonu
  const wallMat = 0x5b6066;
  const L = 200, T = 2, H = 2.4;
  addBox(makeBox(L, H, T, wallMat), 0, H / 2, 100);
  addBox(makeBox(L, H, T, wallMat), 0, H / 2, -100);
  addBox(makeBox(T, H, L, wallMat), 100, H / 2, 0);
  addBox(makeBox(T, H, L, wallMat), -100, H / 2, 0);

  // ---- ściana do crash-testów
  const crashMat = new THREE.MeshStandardMaterial({ color: 0xb9bec6, roughness: 0.9 });
  addBox(makeBox(1.2, 2.2, 12, crashMat), 0, 1.1, -55);
  addBox(makeBox(0.1, 2.2, 0.8, 0xd35400), -0.66, 1.1, -50);
  addBox(makeBox(0.1, 2.2, 0.8, 0xd35400), -0.66, 1.1, -60);

  // ---- rampa (skok): wbudowana w grunt, górna krawędź = punkt wybicia
  const rampAng = 0.245; // atan(2/8)
  const rampMesh = makeBox(7, 1.4, 9, 0x64696f);
  addBox(rampMesh, 26, 0.2, -30, 0, rampAng);
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0xf39c12, roughness: 0.6 });
  const edge = new THREE.Mesh(new THREE.BoxGeometry(7, 0.14, 0.5), edgeMat);
  edge.position.set(26, 1.99, -34.1);
  edge.rotation.x = rampAng;
  edge.castShadow = true;
  group.add(edge);

  // ---- slalom: stożki (kolejność wizualna tylko, zderzanie przez OBB)
  const coneGeo = new THREE.ConeGeometry(0.25, 0.7, 10);
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.7 });
  for (let i = 0; i < 8; i++) {
    const c = new THREE.Mesh(coneGeo, coneMat);
    c.position.set(-34 + 0, 0.35, -6 + i * 5);
    c.castShadow = true;
    group.add(c);
    colliders.push({
      pos: c.position, quat: new THREE.Quaternion(), hx: 0.3, hy: 0.35, hz: 0.3, mesh: c,
    });
  }

  // ---- słupki
  for (let i = 0; i < 5; i++) {
    addBox(makeBox(0.4, 1.1, 0.4, 0xe74c3c), 55, 0.55, 20 + i * 8, i * 0.5);
  }

  // ---- drzewa (dekoracja + kolizja pnia)
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 3.2, 8);
  const crownGeo = new THREE.ConeGeometry(2.4, 5.5, 8);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6d4c33, roughness: 1 });
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x2d6b2f, roughness: 1 });
  const treeSpots = [
    [-70, -70], [-80, -40], [-60, -60], [70, -70], [80, -40],
    [-70, 70], [-80, 40], [70, 70], [80, 40], [40, 80], [-40, 80],
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

function makeGroundTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3a3d42';
  ctx.fillRect(0, 0, 512, 512);
  // szum asfaltu
  for (let i = 0; i < 9000; i++) {
    const v = 46 + Math.random() * 26;
    ctx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  // przerywana linia środka (siatka 8x8 => linia co 1/8 ściany tekstury)
  ctx.fillStyle = '#d8d93a';
  ctx.fillRect(250, 0, 12, 150);
  ctx.fillRect(250, 256, 12, 150);
  return new THREE.CanvasTexture(c);
}
