import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './App.css';

/**
 * NanisRoom (aka Auntie's Room)
 * An immersive, ambient 3D scene with clickable objects.
 * Each interactive object carries a `key` matching the memories object below.
 * Clicking one calls onHotspotClick(key).
 *
 * Requires: npm install three
 */
function NanisRoom({ onHotspotClick, className, style }) {
  const mountRef = useRef(null);
  const onHotspotClickRef = useRef(onHotspotClick);
  onHotspotClickRef.current = onHotspotClick;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ---------- palette ----------
    const wallColor  = 0x4a373b;
    const floorColor = 0x6b4a34;
    const amber      = 0xffc98f;
    const teal       = 0x2c5450;
    const rose       = 0xd88a95;
    const cream      = 0xf4e9d8;
    const gold       = 0xd4af6a;

    // ---------- core scene ----------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x362a2d);
    scene.fog = new THREE.FogExp2(0x362a2d, 0.028);

    const camera = new THREE.PerspectiveCamera(55, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, 1.6, 6.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.25;
    controls.minDistance = 2.5;
    controls.maxDistance = 9;
    controls.maxPolarAngle = Math.PI * 0.53;
    controls.target.set(0, 1.3, 0);

    // ---------- room shell ----------
    const roomSize = 10;
    const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.95, metalness: 0.02 });
    const floorMat = new THREE.MeshStandardMaterial({ color: floorColor, roughness: 0.75, metalness: 0.05 });
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0x3a2e30, roughness: 1 });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(roomSize, roomSize), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(roomSize, roomSize), ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 4.2;
    scene.add(ceiling);

    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(roomSize, 4.2), wallMat);
    backWall.position.set(0, 2.1, -roomSize / 2);
    backWall.receiveShadow = true;
    scene.add(backWall);

    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(roomSize, 4.2), wallMat);
    leftWall.position.set(-roomSize / 2, 2.1, 0);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.receiveShadow = true;
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(roomSize, 4.2), wallMat);
    rightWall.position.set(roomSize / 2, 2.1, 0);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.receiveShadow = true;
    scene.add(rightWall);

    // ---------- window + light shaft ----------
    const windowGroup = new THREE.Group();
    windowGroup.position.set(-2.4, 2.4, -roomSize / 2 + 0.02);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x2c2022, roughness: 0.8 });
    windowGroup.add(new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.3, 0.12), frameMat));
    const paneMat = new THREE.MeshBasicMaterial({ color: 0xffe2b3, transparent: true, opacity: 0.92 });
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.0), paneMat);
    pane.position.z = 0.07;
    windowGroup.add(pane);
    for (let i = -1; i <= 1; i++) {
      const barV = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.0, 0.02), frameMat);
      barV.position.set(i * 0.53, 0, 0.08);
      windowGroup.add(barV);
    }
    const barH = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.02), frameMat);
    barH.position.set(0, 0, 0.08);
    windowGroup.add(barH);
    scene.add(windowGroup);

    const windowLight = new THREE.SpotLight(amber, 13, 16, Math.PI / 6.2, 0.5, 1.1);
    windowLight.position.set(-2.4, 3.4, -roomSize / 2 + 1.2);
    windowLight.target.position.set(0.4, 0, 1.2);
    windowLight.castShadow = true;
    windowLight.shadow.mapSize.set(1024, 1024);
    scene.add(windowLight, windowLight.target);

    const shaftMat = new THREE.MeshBasicMaterial({
      color: cream, transparent: true, opacity: 0.06,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const shaft = new THREE.Mesh(new THREE.ConeGeometry(2.6, 8, 32, 1, true), shaftMat);
    shaft.rotation.x = Math.PI;
    shaft.position.set(-1.2, 0.4, -1.5);
    shaft.rotation.z = 0.35;
    scene.add(shaft);

    const moteCount = 380;
    const motePos = new Float32Array(moteCount * 3);
    for (let i = 0; i < moteCount; i++) {
      const t = Math.random();
      motePos[i * 3 + 0] = -2.4 + (Math.random() - 0.5) * 3.2 * t + 1.2;
      motePos[i * 3 + 1] = 3.4 - t * 3.6 + (Math.random() - 0.5) * 0.6;
      motePos[i * 3 + 2] = -4.6 + t * 6.5 + (Math.random() - 0.5) * 1.0;
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
    const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({
      color: cream, size: 0.02, transparent: true, opacity: 0.75,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    scene.add(motes);

    // ---------- ambient / fill light ----------
    scene.add(new THREE.AmbientLight(0x4a383c, 1.7));
    scene.add(new THREE.HemisphereLight(0xf4e9d8, floorColor, 0.65));
    const fill = new THREE.PointLight(teal, 1.0, 9);
    fill.position.set(2.5, 1.6, 2.5);
    scene.add(fill);
    const fill2 = new THREE.PointLight(rose, 0.5, 8);
    fill2.position.set(-2.5, 1.4, 2.2);
    scene.add(fill2);

    // ---------- lamp + side table ----------
    const lampGroup = new THREE.Group();
    const lampBaseMat = new THREE.MeshStandardMaterial({ color: 0x2c2022, roughness: 0.6 });
    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.08, 20), lampBaseMat);
    const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 10), lampBaseMat);
    lampPole.position.y = 0.49;
    const lampShade = new THREE.Mesh(
      new THREE.ConeGeometry(0.32, 0.4, 20, 1, true),
      new THREE.MeshStandardMaterial({ color: rose, emissive: 0x6b3a2e, emissiveIntensity: 0.7, side: THREE.DoubleSide, roughness: 0.6 })
    );
    lampShade.position.y = 1.0;
    lampGroup.add(lampBase, lampPole, lampShade);
    lampGroup.position.set(2.6, 0.66, -1.6);
    scene.add(lampGroup);
    const lampLight = new THREE.PointLight(0xffd7ab, 1.8, 5, 2);
    lampLight.position.set(2.6, 1.05, -1.6);
    scene.add(lampLight);

    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 24), floorMat);
    table.position.set(2.6, 0.42, -1.6);
    table.castShadow = true; table.receiveShadow = true;
    const tableLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 12), floorMat);
    tableLeg.position.set(2.6, 0.2, -1.6);
    scene.add(table, tableLeg);

    // ---------- rocking chair ----------
    const chairGroup = new THREE.Group();
    const chairMat = new THREE.MeshStandardMaterial({ color: 0x3a2825, roughness: 0.8 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.06, 0.6), chairMat);
    seat.position.y = 0.55;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.06), chairMat);
    back.position.set(0, 0.9, -0.28);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.6), chairMat);
    armL.position.set(-0.3, 0.72, 0);
    const armR = armL.clone(); armR.position.x = 0.3;
    const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.55, 8);
    const legFL = new THREE.Mesh(legGeo, chairMat); legFL.position.set(-0.26, 0.28, 0.26);
    const legFR = legFL.clone(); legFR.position.x = 0.26;
    const legBL = legFL.clone(); legBL.position.z = -0.26;
    const legBR = legFR.clone(); legBR.position.z = -0.26;
    const rockerCurve = new THREE.TorusGeometry(0.78, 0.02, 8, 24, Math.PI * 0.55);
    const rockerL = new THREE.Mesh(rockerCurve, chairMat);
    rockerL.rotation.z = Math.PI / 2 + 0.72;
    rockerL.position.set(-0.26, 0.02, 0);
    const rockerR = rockerL.clone(); rockerR.position.x = 0.26;
    chairGroup.add(seat, back, armL, armR, legFL, legFR, legBL, legBR, rockerL, rockerR);
    chairGroup.position.set(-1.0, 0, 1.4);
    chairGroup.rotation.y = 0.5;
    chairGroup.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(chairGroup);

    // ---------- plants ----------
    function makePlant(x, z, scale) {
      const g = new THREE.Group();
      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.14, 0.24, 14),
        new THREE.MeshStandardMaterial({ color: 0x7a5240, roughness: 0.9 })
      );
      pot.position.y = 0.12;
      g.add(pot);
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x4a6b48, roughness: 0.7 });
      for (let i = 0; i < 7; i++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.5, 6), leafMat);
        const a = (i / 7) * Math.PI * 2;
        leaf.position.set(Math.cos(a) * 0.08, 0.5, Math.sin(a) * 0.08);
        leaf.rotation.z = Math.cos(a) * 0.35;
        leaf.rotation.x = Math.sin(a) * 0.35;
        g.add(leaf);
      }
      g.position.set(x, 0, z);
      g.scale.setScalar(scale);
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      return g;
    }
    scene.add(makePlant(3.4, 1.8, 1.0));
    scene.add(makePlant(3.2, -3.0, 0.8));

    // ---------- colourful woven rug ----------
    function makeRugTexture() {
      const c = document.createElement('canvas');
      c.width = 256; c.height = 256;
      const ctx = c.getContext('2d');
      const colors = ['#d95d39', '#e8b13a', '#3a7d5c', '#4a6fa5', '#c98a83', '#f4e9d8'];
      ctx.fillStyle = '#8a2e3a';
      ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = colors[i % colors.length];
        ctx.fillRect(0, i * 26, 256, 9);
      }
      ctx.strokeStyle = '#f4e9d8';
      ctx.lineWidth = 5;
      ctx.strokeRect(8, 8, 240, 240);
      for (let x = 16; x < 256; x += 28) {
        ctx.fillStyle = colors[(Math.floor(x / 28)) % colors.length];
        ctx.beginPath();
        ctx.moveTo(x, 8);
        ctx.lineTo(x + 14, 22);
        ctx.lineTo(x, 36);
        ctx.lineTo(x - 14, 22);
        ctx.closePath();
        ctx.fill();
      }
      return new THREE.CanvasTexture(c);
    }
    const rug = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 1.7),
      new THREE.MeshStandardMaterial({ map: makeRugTexture(), roughness: 1 })
    );
    rug.rotation.x = -Math.PI / 2;
    rug.rotation.z = -0.08;
    rug.position.set(-0.4, 0.012, 1.0);
    rug.receiveShadow = true;
    scene.add(rug);

    // ---------- bed, flush against the left wall ----------
    const bedGroup = new THREE.Group();
    const bedFrameMat = new THREE.MeshStandardMaterial({ color: 0x4a3320, roughness: 0.7 });
    const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 2.2), bedFrameMat);
    bedFrame.position.y = 0.15;
    const headboard = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.08), bedFrameMat);
    headboard.position.set(0, 0.75, -1.06);
    const mattress = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.2, 2.1),
      new THREE.MeshStandardMaterial({ color: 0xe8ddc7, roughness: 0.9 })
    );
    mattress.position.y = 0.4;
    const sheetMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.55, 2.15, 10, 10),
      new THREE.MeshStandardMaterial({ color: rose, roughness: 0.8, side: THREE.DoubleSide })
    );
    sheetMesh.rotation.x = -Math.PI / 2;
    sheetMesh.position.y = 0.512;
    const shPos = sheetMesh.geometry.attributes.position;
    for (let i = 0; i < shPos.count; i++) {
      const x = shPos.getX(i), y = shPos.getY(i);
      shPos.setZ(i, Math.sin(x * 3 + y * 2) * 0.02);
    }
    sheetMesh.geometry.computeVertexNormals();
    const pillowMat = new THREE.MeshStandardMaterial({ color: 0xf4e9d8, roughness: 0.9 });
    const pillow1 = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), pillowMat);
    pillow1.scale.set(1.4, 0.55, 1);
    pillow1.position.set(-0.35, 0.58, -0.82);
    const pillow2 = pillow1.clone();
    pillow2.position.set(0.35, 0.58, -0.82);
    bedGroup.add(bedFrame, headboard, mattress, sheetMesh, pillow1, pillow2);
    // rotate so the bed's length runs along the wall, headboard against it, then
    // slide the whole group so the headboard sits flush against the left wall (x = -5)
    bedGroup.rotation.y = Math.PI / 2;
    bedGroup.position.set(-3.89, 0, -2.4);
    bedGroup.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(bedGroup);

    // ---------- vanity with mirror ----------
    const vanityGroup = new THREE.Group();
    const vanityWoodMat = new THREE.MeshStandardMaterial({ color: 0x6b4a34, roughness: 0.6 });
    const vanityTop = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.45), vanityWoodMat);
    vanityTop.position.y = 0.75;
    vanityGroup.add(vanityTop);
    const legGeo2 = new THREE.CylinderGeometry(0.02, 0.02, 0.75, 8);
    [[-0.4, -0.18], [0.4, -0.18], [-0.4, 0.18], [0.4, 0.18]].forEach(([x, z]) => {
      const leg = new THREE.Mesh(legGeo2, vanityWoodMat);
      leg.position.set(x, 0.375, z);
      vanityGroup.add(leg);
    });
    const mirrorFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.65, 0.03),
      new THREE.MeshStandardMaterial({ color: gold, roughness: 0.4, metalness: 0.5 })
    );
    mirrorFrame.position.set(0, 1.15, -0.2);
    const mirrorGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.57),
      new THREE.MeshStandardMaterial({ color: 0xaec4d4, roughness: 0.1, metalness: 0.7, emissive: 0x1f2f38, emissiveIntensity: 0.2 })
    );
    mirrorGlass.position.set(0, 1.15, -0.183);
    vanityGroup.add(mirrorFrame, mirrorGlass);
    vanityGroup.position.set(3.7, 0, -3.4);
    vanityGroup.rotation.y = -0.4;
    scene.add(vanityGroup);
    const vanityLight = new THREE.PointLight(0xffe4bf, 0.8, 3.5, 2);
    vanityLight.position.set(3.7, 1.3, -3.2);
    scene.add(vanityLight);

    // =========================================================
    // INTERACTIVE HOTSPOTS — one per memory key
    // =========================================================
    const hotspots = []; // { root, glow, key, baseY }

    function addFloorGlow(parent, radius, color) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(radius, radius * 1.35, 32),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.01;
      parent.add(ring);
      return ring;
    }

    function addWallGlow(parent, radius, color, zOffset) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(radius, radius * 1.22, 32),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false })
      );
      ring.position.set(0, 0, zOffset);
      parent.add(ring);
      return ring;
    }

    function registerHotspot(root, key, glow) {
      root.userData.hotspotKey = key;
      root.traverse((o) => { o.userData.hotspotKey = key; });
      hotspots.push({ root, glow, key, baseY: root.position.y });
    }

    // --- Jewellery box + bangles box, sitting together at the foot of the bed ---
    const jewelGroup = new THREE.Group();
    const jewelMat = new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.6, metalness: 0.15 });
    const jewelBody = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.18), jewelMat);
    const jewelLid = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.03, 0.19), new THREE.MeshStandardMaterial({ color: gold, roughness: 0.4, metalness: 0.5 }));
    jewelLid.position.y = 0.085;
    jewelGroup.add(jewelBody, jewelLid);
    jewelGroup.position.set(0.28, 0.585, 0.65); // local to bedGroup, foot of the bed
    jewelGroup.rotation.y = 0.3;
    jewelGroup.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const jewelGlow = addFloorGlow(jewelGroup, 0.2, gold);
    bedGroup.add(jewelGroup);
    registerHotspot(jewelGroup, 'jewellery', jewelGlow);

    const banglesGroup = new THREE.Group();
    const banglesBowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.11, 0.06, 16, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x2c2022, roughness: 0.7, side: THREE.DoubleSide })
    );
    banglesGroup.add(banglesBowl);
    const bangleColors = [gold, rose, 0x3a7d5c, 0x4a6fa5, 0xd95d39, cream];
    for (let i = 0; i < 7; i++) {
      const bangle = new THREE.Mesh(
        new THREE.TorusGeometry(0.075, 0.007, 8, 20),
        new THREE.MeshStandardMaterial({ color: bangleColors[i % bangleColors.length], metalness: 0.6, roughness: 0.3 })
      );
      bangle.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.4;
      bangle.rotation.z = (Math.random() - 0.5) * 0.3;
      bangle.position.set((Math.random() - 0.5) * 0.05, i * 0.01, (Math.random() - 0.5) * 0.05);
      banglesGroup.add(bangle);
    }
    banglesGroup.position.set(-0.26, 0.575, 0.62); // local to bedGroup, next to the jewellery box
    banglesGroup.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const banglesGlow = addFloorGlow(banglesGroup, 0.18, rose);
    bedGroup.add(banglesGroup);
    registerHotspot(banglesGroup, 'bangles', banglesGlow);

    // --- Makeup box on the vanity ---
    const makeupGroup = new THREE.Group();
    const makeupBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.08, 0.14),
      new THREE.MeshStandardMaterial({ color: rose, roughness: 0.5 })
    );
    const makeupLid = new THREE.Mesh(
      new THREE.BoxGeometry(0.21, 0.02, 0.15),
      new THREE.MeshStandardMaterial({ color: gold, roughness: 0.4, metalness: 0.5 })
    );
    makeupLid.position.y = 0.05;
    makeupGroup.add(makeupBox, makeupLid);
    makeupGroup.position.set(-0.24, 0.815, 0.08); // local to vanityGroup
    makeupGroup.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const makeupGlow = addFloorGlow(makeupGroup, 0.16, rose);
    vanityGroup.add(makeupGroup);
    registerHotspot(makeupGroup, 'makeup', makeupGlow);

    // --- Amla oil bottle on the vanity ---
    const amlaGroup = new THREE.Group();
    const amlaBottle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.04, 0.12, 14),
      new THREE.MeshStandardMaterial({ color: 0x2d4a2e, roughness: 0.25, metalness: 0.15, transparent: true, opacity: 0.92 })
    );
    amlaBottle.position.y = 0.06;
    const amlaCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 0.03, 10),
      new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.5 })
    );
    amlaCap.position.y = 0.135;
    amlaGroup.add(amlaBottle, amlaCap);
    amlaGroup.position.set(0.22, 0.775, 0.1); // local to vanityGroup
    amlaGroup.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const amlaGlow = addFloorGlow(amlaGroup, 0.09, 0x3a7d5c);
    vanityGroup.add(amlaGroup);
    registerHotspot(amlaGroup, 'amlaOil', amlaGlow);

    // --- Framed photograph: mounted on the right wall ---
    function makePhotoTexture() {
      const c = document.createElement('canvas');
      c.width = 128; c.height = 160;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#e8ddc7';
      ctx.fillRect(0, 0, 128, 160);
      const g = ctx.createLinearGradient(0, 0, 128, 140);
      g.addColorStop(0, '#8a8172');
      g.addColorStop(1, '#3a332c');
      ctx.fillStyle = g;
      ctx.fillRect(10, 10, 108, 120);
      return new THREE.CanvasTexture(c);
    }
    const photoGroup = new THREE.Group();
    const photoFrameMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.04), new THREE.MeshStandardMaterial({ color: 0x2c2022, roughness: 0.7 }));
    const photoPic = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.5), new THREE.MeshStandardMaterial({ map: makePhotoTexture(), roughness: 0.85 }));
    photoPic.position.set(0, 0, 0.025);
    photoGroup.add(photoFrameMesh, photoPic);
    photoGroup.position.set(roomSize / 2 - 0.06, 2.3, 1.0);
    photoGroup.rotation.y = -Math.PI / 2;
    photoGroup.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const photoGlowRing = addWallGlow(photoGroup, 0.32, amber, 0.05);
    scene.add(photoGroup);
    registerHotspot(photoGroup, 'photograph', photoGlowRing);

    // --- Painting: mounted on the back wall, beside the window ---
    function makePaintingTexture() {
      const c = document.createElement('canvas');
      c.width = 180; c.height = 220;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#f4e9d8';
      ctx.fillRect(0, 0, 180, 220);
      const colors = ['#d95d39', '#e8b13a', '#3a7d5c', '#4a6fa5', '#c98a83'];
      const cx = 90, cy = 110;
      let ci = 0;
      for (let r = 82; r > 10; r -= 14) {
        ctx.fillStyle = colors[ci % colors.length];
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ci++;
      }
      ctx.fillStyle = '#2c2022';
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fill();
      return new THREE.CanvasTexture(c);
    }
    const paintingGroup = new THREE.Group();
    const paintingFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.76, 0.04),
      new THREE.MeshStandardMaterial({ color: gold, roughness: 0.4, metalness: 0.45 })
    );
    const paintingCanvas = new THREE.Mesh(
      new THREE.PlaneGeometry(0.52, 0.66),
      new THREE.MeshStandardMaterial({ map: makePaintingTexture(), roughness: 0.9 })
    );
    paintingCanvas.position.z = 0.023;
    paintingGroup.add(paintingFrame, paintingCanvas);
    paintingGroup.position.set(1.6, 2.5, -roomSize / 2 + 0.05);
    paintingGroup.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const paintingGlow = addWallGlow(paintingGroup, 0.38, amber, 0.05);
    scene.add(paintingGroup);
    registerHotspot(paintingGroup, 'painting', paintingGlow);

    // --- Saree: draped across the rocking chair ---
    const sareeGroup = new THREE.Group();
    const sareeMat = new THREE.MeshStandardMaterial({ color: 0x7e2735, roughness: 0.85, side: THREE.DoubleSide });
    const sareeMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.55, 6, 6), sareeMat);
    const sPos = sareeMesh.geometry.attributes.position;
    for (let i = 0; i < sPos.count; i++) {
      const x = sPos.getX(i);
      sPos.setZ(i, Math.sin(x * 4) * 0.03);
    }
    sareeMesh.geometry.computeVertexNormals();
    const zariTrim = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.05), new THREE.MeshStandardMaterial({ color: gold, roughness: 0.4, metalness: 0.4, side: THREE.DoubleSide }));
    zariTrim.position.y = -0.25;
    sareeGroup.add(sareeMesh, zariTrim);
    sareeGroup.position.set(-1.0, 0.75, 1.62);
    sareeGroup.rotation.set(-0.35, 0.5, 0.08);
    sareeGroup.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(sareeGroup);
    const sareeFloorGlow = addFloorGlow(chairGroup, 0.5, rose);
    registerHotspot(sareeGroup, 'saree', sareeFloorGlow);

    // --- Cassette: sitting on the side table ---
    const cassetteGroup = new THREE.Group();
    const cassetteBody = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.14), new THREE.MeshStandardMaterial({ color: 0x201c1c, roughness: 0.5 }));
    const reelMat = new THREE.MeshStandardMaterial({ color: 0xcfcfcf, roughness: 0.4 });
    const reelL = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.032, 16), reelMat);
    reelL.rotation.x = Math.PI / 2;
    reelL.position.set(-0.05, 0.02, 0);
    const reelR = reelL.clone(); reelR.position.x = 0.05;
    cassetteGroup.add(cassetteBody, reelL, reelR);
    cassetteGroup.position.set(2.5, 0.465, -1.72);
    cassetteGroup.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const cassetteGlow = addFloorGlow(cassetteGroup, 0.16, cream);
    scene.add(cassetteGroup);
    registerHotspot(cassetteGroup, 'cassette', cassetteGlow);

    // ---------- raycasting: click + hover ----------
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hoveredKey = null;

    function setPointer(event) {
      const rect = mount.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function pickHotspot() {
      raycaster.setFromCamera(pointer, camera);
      const targets = hotspots.map((h) => h.root);
      const hits = raycaster.intersectObjects(targets, true);
      if (hits.length === 0) return null;
      let obj = hits[0].object;
      while (obj && !obj.userData.hotspotKey) obj = obj.parent;
      return obj ? obj.userData.hotspotKey : null;
    }

    function handlePointerMove(event) {
      setPointer(event);
      hoveredKey = pickHotspot();
      renderer.domElement.style.cursor = hoveredKey ? 'pointer' : 'grab';
    }

    function handleClick(event) {
      setPointer(event);
      const key = pickHotspot();
      if (key && onHotspotClickRef.current) {
        onHotspotClickRef.current(key);
      }
    }

    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('click', handleClick);

    // ---------- resize ----------
    function handleResize() {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    }
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mount);

    // ---------- animate ----------
    const clock = new THREE.Clock();
    let frameId;
    function animate() {
      frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      const pos = moteGeo.attributes.position.array;
      for (let i = 0; i < moteCount; i++) {
        pos[i * 3 + 1] -= 0.0016;
        if (pos[i * 3 + 1] < -0.2) pos[i * 3 + 1] = 3.4;
        pos[i * 3 + 0] += Math.sin(t * 0.3 + i) * 0.0003;
      }
      moteGeo.attributes.position.needsUpdate = true;

      hotspots.forEach((h) => {
        if (!h.glow) return;
        const isHovered = h.key === hoveredKey;
        const pulse = 0.35 + Math.sin(t * 2.2 + h.baseY * 3) * 0.15;
        h.glow.material.opacity = isHovered ? 0.85 : pulse;
        const s = isHovered ? 1.15 : 1.0;
        h.glow.scale.set(s, s, s);
      });

      lampLight.intensity = 1.8 + Math.sin(t * 7.0) * 0.03 + Math.sin(t * 2.3) * 0.02;

      controls.autoRotate = !hoveredKey;
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    // ---------- cleanup ----------
    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('click', handleClick);
      controls.dispose();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        }
      });
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className={className}
      style={{ width: '100%', height: '100%', background: '#362a2d', ...style }}
    />
  );
}

const memories = {
  jewellery: {
    eyebrow: 'A small treasure',
    title: 'The Jewellery Box',
    body: 'The little box held more than gold. Every piece inside carried the warmth of a celebration, a blessing, or a story told across generations.',
  },
  bangles: {
    eyebrow: 'Catching the light',
    title: 'The Box of Bangles',
    body: "They clink together when you lift the lid, dozens of them nested inside one another. Auntie could tell you exactly which wedding each colour was bought for, and would, if you had an hour to spare.",
  },
  photograph: {
    eyebrow: 'A captured afternoon',
    title: 'The Framed Photograph',
    body: 'Auntie kept this photograph where the light could find it. The faces are soft with age, but the happiness in the room still feels close enough to touch.',
  },
  painting: {
    eyebrow: 'On the wall',
    title: 'The Painting',
    body: "She never said who painted it, only that it had hung in every house she'd ever lived in. The colours have deepened with the years, like everything else in this room.",
  },
  saree: {
    eyebrow: 'Folded with care',
    title: 'The Silk Saree',
    body: 'This saree came out for important days: weddings, festivals, and unexpected guests. Its border remembers every doorway she walked through wearing it.',
  },
  cassette: {
    eyebrow: 'A voice from home',
    title: 'The Old Cassette',
    body: 'The tape is worn from listening. Press play and you can almost hear the old songs, the clatter of tea cups, and Auntie singing just a little louder than the music.',
  },
  makeup: {
    eyebrow: 'Before stepping out',
    title: 'The Makeup Box',
    body: 'A little kajal, a dab of colour, the same routine every time — done from memory, without ever needing the mirror as much as she used it anyway.',
  },
  amlaOil: {
    eyebrow: 'Sunday mornings',
    title: 'The Amla Oil',
    body: "The smell alone brings it back — sitting on the floor while she worked it through your hair, telling you to stop fidgeting, promising it would make it grow long and strong.",
  },
};

function App() {
  const [openMemory, setOpenMemory] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  function toggleAmbientSound() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  }

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpenMemory(null);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const memory = openMemory ? memories[openMemory] : null;

  return (
    <main className="archive-shell">
      <div className="room-stage">
        <NanisRoom onHotspotClick={setOpenMemory} />
      </div>
      <header className="archive-header">
        <p className="archive-kicker">A digital memory archive</p>
        <h1>Auntie's Room</h1>
        <p className="archive-prompt">Explore the room and listen closely.</p>
      </header>
      <div className="audio-controller">
        <button type="button" onClick={toggleAmbientSound} aria-pressed={isPlaying}>
          <span aria-hidden="true">{isPlaying ? '◼' : '▶'}</span>
          {isPlaying ? ' Pause ambience' : ' Play ambience'}
        </button>
        <audio ref={audioRef} loop preload="none">
          <source src="/assets/ambient-room.mp3" type="audio/mpeg" />
        </audio>
      </div>
      <p className="archive-hint" aria-hidden="true">Drag to look around · Click a glowing keepsake</p>
      {memory && (
        <div className="modal-backdrop" role="presentation" onClick={() => setOpenMemory(null)}>
          <section className="memory-modal" role="dialog" aria-modal="true" aria-labelledby="memory-title" onClick={(event) => event.stopPropagation()}>
            <button className="close-btn" type="button" onClick={() => setOpenMemory(null)} aria-label="Close memory">×</button>
            <p className="memory-eyebrow">{memory.eyebrow}</p>
            <h2 id="memory-title">{memory.title}</h2>
            <p className="memory-body">{memory.body}</p>
            <button className="return-btn" type="button" onClick={() => setOpenMemory(null)}>Return to the room</button>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;