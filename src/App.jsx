import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './App.css';

/**
 * Lighting/atmosphere values for each time-of-day mode.
 * Only intensities, colors and opacities differ — geometry never rebuilds.
 */
function getModeConfig(mode) {
  if (mode === 'day') {
    return {
      background: 0xcfc0ac,
      fogColor: 0xcfc0ac,
      fogDensity: 0.014,
      windowColor: 0xfff3d6,
      windowIntensity: 19,
      ambientColor: 0x9a8a7e,
      ambientIntensity: 2.5,
      hemiSky: 0xfff6e8,
      hemiIntensity: 1.05,
      paneColor: 0xffffff,
      paneOpacity: 0.97,
      moteOpacity: 0.4,
      lampIntensity: 0.85,
      standIntensity: 0.25,
      vanityIntensity: 0.45,
      fillIntensity: 0.55,
      fill2Intensity: 0.3,
    };
  }
  return {
    background: 0x362a2d,
    fogColor: 0x362a2d,
    fogDensity: 0.028,
    windowColor: 0xffc98f,
    windowIntensity: 13,
    ambientColor: 0x4a383c,
    ambientIntensity: 1.7,
    hemiSky: 0xf4e9d8,
    hemiIntensity: 0.65,
    paneColor: 0xffe2b3,
    paneOpacity: 0.92,
    moteOpacity: 0.75,
    lampIntensity: 2.2,
    standIntensity: 0.6,
    vanityIntensity: 0.8,
    fillIntensity: 1.0,
    fill2Intensity: 0.5,
  };
}

/**
 * The room's arc once every keepsake has been found: furniture fades away,
 * the standing lamp (the last light left) flickers and topples, and the
 * room settles into near-darkness before the reflection screen appears.
 * Only 'room' is interactive — the others just choreograph the scene.
 */
function getJourneyTargets(phase, modeCfg) {
  switch (phase) {
    case 'empty':
      return {
        decorOpacity: 0, decorScale: 0.82, lampFallAngle: 0,
        lightMultiplier: 0.55, fogDensity: modeCfg.fogDensity * 1.7,
        bgColor: modeCfg.background, shakeAmp: 0,
      };
    case 'distort':
      return {
        decorOpacity: 0, decorScale: 0.82, lampFallAngle: -1.3,
        lightMultiplier: 0.05, fogDensity: 0.12,
        bgColor: 0x08060a, shakeAmp: 0.045,
      };
    case 'reflect':
      return {
        decorOpacity: 0, decorScale: 0.82, lampFallAngle: -1.3,
        lightMultiplier: 0.08, fogDensity: 0.1,
        bgColor: 0x08060a, shakeAmp: 0,
      };
    default: // 'room'
      return {
        decorOpacity: 1, decorScale: 1, lampFallAngle: 0,
        lightMultiplier: 1, fogDensity: modeCfg.fogDensity,
        bgColor: modeCfg.background, shakeAmp: 0,
      };
  }
}

/**
 * NanisRoom (aka Auntie's Room)
 * An immersive, ambient 3D scene with clickable objects.
 * Each interactive object carries a `key` matching the memories object below.
 * Clicking one calls onHotspotClick(key). The 'radio' key is special-cased
 * in App() to also start playing the shabad audio.
 * `mode` ('day' | 'night') controls lighting/atmosphere only — pass it down
 * from App and the scene relights itself without rebuilding geometry.
 * `collectedKeys` marks which keepsakes have been found (they shrink away).
 * `journeyPhase` ('room' | 'empty' | 'distort' | 'reflect') drives the
 * closing sequence once everything has been collected.
 *
 * Requires: npm install three
 */
function NanisRoom({
  onHotspotClick,
  mode = 'night',
  collectedKeys = [],
  journeyPhase = 'room',
  className,
  style,
}) {
  const mountRef = useRef(null);
  const onHotspotClickRef = useRef(onHotspotClick);
  onHotspotClickRef.current = onHotspotClick;
  const sceneObjectsRef = useRef(null);
  const lampBaseRef = useRef(getModeConfig(mode).lampIntensity);
  const journeyPhaseRef = useRef(journeyPhase);
  const collectedSetRef = useRef(new Set(collectedKeys));
  const journeyLiveRef = useRef({
    decorOpacity: 1, decorScale: 1, lampFallAngle: 0, lightMultiplier: 1, shakeAmp: 0,
  });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const cfg = getModeConfig(mode);

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
    scene.background = new THREE.Color(cfg.background);
    scene.fog = new THREE.FogExp2(cfg.fogColor, cfg.fogDensity);

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
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x2c2022, roughness: 0.8 });
    windowGroup.add(new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.3, 0.12), frameMat));
    const paneMat = new THREE.MeshBasicMaterial({ color: cfg.paneColor, transparent: true, opacity: cfg.paneOpacity });
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
    windowGroup.scale.setScalar(1.2);
    windowGroup.position.set(-2.4, 2.4, -roomSize / 2 + 0.02);
    scene.add(windowGroup);

    const windowLight = new THREE.SpotLight(cfg.windowColor, cfg.windowIntensity, 16, Math.PI / 6, 0.5, 1.1);
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
    const motesMat = new THREE.PointsMaterial({
      color: cream, size: 0.02, transparent: true, opacity: cfg.moteOpacity,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const motes = new THREE.Points(moteGeo, motesMat);
    scene.add(motes);

    // ---------- ambient / fill light ----------
    const ambientLight = new THREE.AmbientLight(cfg.ambientColor, cfg.ambientIntensity);
    scene.add(ambientLight);
    const hemisphereLight = new THREE.HemisphereLight(cfg.hemiSky, floorColor, cfg.hemiIntensity);
    scene.add(hemisphereLight);
    const fill = new THREE.PointLight(teal, cfg.fillIntensity, 9);
    fill.position.set(2.5, 1.6, 2.5);
    scene.add(fill);
    const fill2 = new THREE.PointLight(rose, cfg.fill2Intensity, 8);
    fill2.position.set(-2.5, 1.4, 2.2);
    scene.add(fill2);

    // ---------- lamp + bigger side table ----------
    // ---------- standing floor lamp + side table ----------
const lampGroup = new THREE.Group();

const lampBaseMat = new THREE.MeshStandardMaterial({
  color: 0x2c2022,
  roughness: 0.6,
  metalness: 0.15
});

// Large circular floor base
const lampBase = new THREE.Mesh(
  new THREE.CylinderGeometry(0.28, 0.32, 0.08, 24),
  lampBaseMat
);
lampBase.position.y = 0.04;

// Tall lamp pole
const lampPole = new THREE.Mesh(
  new THREE.CylinderGeometry(0.035, 0.045, 2.7, 12),
  lampBaseMat
);
lampPole.position.y = 1.38;

// Small collar underneath shade
const lampCollar = new THREE.Mesh(
  new THREE.CylinderGeometry(0.09, 0.09, 0.08, 16),
  lampBaseMat
);
lampCollar.position.y = 2.72;

// Large standing lampshade
const lampShadeMat = new THREE.MeshStandardMaterial({
  color: rose,
  emissive: 0x6b3a2e,
  emissiveIntensity: 0.7,
  side: THREE.DoubleSide,
  roughness: 0.65
});

const lampShade = new THREE.Mesh(
  new THREE.ConeGeometry(0.42, 0.55, 24, 1, true),
  lampShadeMat
);

lampShade.position.y = 3.0;

// Slightly tilt the shade for a softer, domestic feel
lampShade.rotation.z = -0.04;

lampGroup.add(
  lampBase,
  lampPole,
  lampCollar,
  lampShade
);

// Position the lamp beside the table
lampGroup.position.set(4.5, 0, 3.35);

lampGroup.traverse((o) => {
  if (o.isMesh) {
    o.castShadow = true;
    o.receiveShadow = true;
  }
});

scene.add(lampGroup);

// Warm light from the standing lamp
const lampLight = new THREE.PointLight(
  0xffd7ab,
  lampBaseRef.current,
  6,
  2
);



lampLight.position.set(2.0, 2.65, -1.55);
scene.add(lampLight);



// ---------- side table ----------
const tableRadius = 0.58;
const tableMat = floorMat.clone();

const table = new THREE.Mesh(
  new THREE.CylinderGeometry(
    tableRadius,
    tableRadius,
    0.07,
    28
  ),
  tableMat
);

table.position.set(2.6, 0.44, -1.6);
table.castShadow = true;
table.receiveShadow = true;

const tableLeg = new THREE.Mesh(
  new THREE.CylinderGeometry(0.06, 0.06, 0.4, 12),
  tableMat
);

tableLeg.position.set(2.6, 0.2, -1.6);

scene.add(table, tableLeg);

const tableTopY = 0.44 + 0.035;

    // ---------- plants, sized up a little ----------
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
    const plant1 = makePlant(3.5, 1.9, 1.35);
    const plant2 = makePlant(3.2, -3.0, 1.05);
    scene.add(plant1, plant2);

    // ---------- bed, bigger still, flush against the left wall, with an open
    // drawer underneath spilling folded clothes ----------
    const bedGroup = new THREE.Group();
    const bedWidth = 2.4;
    const bedLength = 3.0;
    const bedFrameMat = new THREE.MeshStandardMaterial({ color: 0x4a3320, roughness: 0.7 });
    const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(bedWidth, 0.3, bedLength), bedFrameMat);
    bedFrame.position.y = 0.15;
    const headboard = new THREE.Mesh(new THREE.BoxGeometry(bedWidth, 0.9, 0.08), bedFrameMat);
    headboard.position.set(0, 0.8, -bedLength / 2 + 0.04);
    const mattress = new THREE.Mesh(
      new THREE.BoxGeometry(bedWidth - 0.1, 0.2, bedLength - 0.1),
      new THREE.MeshStandardMaterial({ color: 0xe8ddc7, roughness: 0.9 })
    );
    mattress.position.y = 0.4;
    const sheetMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(bedWidth - 0.05, bedLength - 0.05, 12, 12),
      new THREE.MeshStandardMaterial({ color: rose, roughness: 0.8, side: THREE.DoubleSide })
    );
    sheetMesh.rotation.x = -Math.PI / 2;
    sheetMesh.position.y = 0.512;
    const shPos = sheetMesh.geometry.attributes.position;
    for (let i = 0; i < shPos.count; i++) {
      const x = shPos.getX(i), y = shPos.getY(i);
      shPos.setZ(i, Math.sin(x * 2.4 + y * 1.6) * 0.025);
    }
    sheetMesh.geometry.computeVertexNormals();
    const pillowMat = new THREE.MeshStandardMaterial({ color: 0xf4e9d8, roughness: 0.9 });
    const pillow1 = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), pillowMat);
    pillow1.scale.set(1.4, 0.55, 1);
    pillow1.position.set(-0.55, 0.6, -bedLength / 2 + 0.35);
    const pillow2 = pillow1.clone();
    pillow2.position.set(0.55, 0.6, -bedLength / 2 + 0.35);
    bedGroup.add(bedFrame, headboard, mattress, sheetMesh, pillow1, pillow2);

    // open drawer underneath, pulled halfway out, with folded clothes spilling from it
    const drawerMat = new THREE.MeshStandardMaterial({ color: 0x2c2018, roughness: 0.75 });
    const drawerBox = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 1.1), drawerMat);
    drawerBox.position.set(bedWidth / 2 + 0.05, 0.1, 0.9);
    const drawerFrontMat = new THREE.MeshStandardMaterial({ color: 0x3a2818, roughness: 0.6 });
    const drawerFront = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 1.14), drawerFrontMat);
    drawerFront.position.set(bedWidth / 2 - 0.08, 0.1, 0.9);
    bedGroup.add(drawerBox, drawerFront);
    const clothColors = [rose, gold, 0x3a7d5c, 0x4a6fa5, cream, 0xd95d39];
    for (let i = 0; i < 6; i++) {
      const cloth = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 8, 6),
        new THREE.MeshStandardMaterial({ color: clothColors[i % clothColors.length], roughness: 0.95 })
      );
      cloth.scale.set(1.3, 0.55, 1.15);
      cloth.position.set(
        bedWidth / 2 + 0.05 + (Math.random() - 0.5) * 0.14,
        0.2 + Math.random() * 0.05,
        0.4 + i * 0.16 + (Math.random() - 0.5) * 0.05
      );
      bedGroup.add(cloth);
    }

    // rotate so the bed's length runs along the wall, headboard against it, then
    // slide the whole group so the headboard sits flush against the left wall (x = -5)
    bedGroup.rotation.y = Math.PI / 2;
    bedGroup.position.set(-3.49, 0, -2.0);
    bedGroup.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(bedGroup);

    // ---------- record player on a small stand, by the window ----------
    const standGroup = new THREE.Group();
    const standWoodMat = new THREE.MeshStandardMaterial({ color: 0x5a3d2b, roughness: 0.65 });
    const standTop = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.05, 20), standWoodMat);
    standTop.position.y = 0.62;
    const standLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 10), standWoodMat);
    standLeg.position.y = 0.3;
    standGroup.add(standTop, standLeg);

    const playerBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.08, 0.38),
      new THREE.MeshStandardMaterial({ color: 0x2c2022, roughness: 0.5 })
    );
    playerBody.position.y = 0.685;
    const platter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 0.015, 28),
      new THREE.MeshStandardMaterial({ color: 0x151212, roughness: 0.35, metalness: 0.3 })
    );
    platter.position.set(-0.06, 0.735, 0);
    const platterLabel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.017, 16),
      new THREE.MeshStandardMaterial({ color: rose, roughness: 0.5 })
    );
    platterLabel.position.set(-0.06, 0.736, 0);
    const tonearmBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.03, 10),
      new THREE.MeshStandardMaterial({ color: gold, roughness: 0.4, metalness: 0.6 })
    );
    tonearmBase.position.set(0.16, 0.735, 0.13);
    const tonearm = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.008, 0.008),
      new THREE.MeshStandardMaterial({ color: gold, roughness: 0.4, metalness: 0.6 })
    );
    tonearm.position.set(0.09, 0.75, 0.07);
    tonearm.rotation.y = 0.6;
    standGroup.add(playerBody, platter, platterLabel, tonearmBase, tonearm);


    // by the window, not where the chair used to be
    standGroup.scale.setScalar(1.25);
    standGroup.position.set(-1.3, 0, -3.6);
    standGroup.rotation.y = 0.5;
    standGroup.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(standGroup);
    const standLight = new THREE.PointLight(0xffdca8, cfg.standIntensity, 3, 2);
    standLight.position.set(-1.3, 1.2, -3.6);
    scene.add(standLight);

    // ---------- play arrow above record player ----------
const playArrowGroup = new THREE.Group();

const arrowMat = new THREE.MeshBasicMaterial({
  color: rose,
  transparent: true,
  opacity: 0.95,
  side: THREE.DoubleSide,
  depthWrite: false,
});

// Triangle play icon
const arrowShape = new THREE.Shape();
arrowShape.moveTo(0, 0.16);
arrowShape.lineTo(0, -0.16);
arrowShape.lineTo(0.28, 0);
arrowShape.closePath();

const arrowGeometry = new THREE.ShapeGeometry(arrowShape);
const playArrow = new THREE.Mesh(arrowGeometry, arrowMat);

playArrowGroup.add(playArrow);

// Position above the record player
playArrowGroup.position.set(-1.3, 1.65, -3.6);

// Make it face the camera
playArrowGroup.rotation.y = Math.PI;

scene.add(playArrowGroup);

    // ---------- vanity with mirror, sized up ----------
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
    vanityGroup.scale.setScalar(1.25);
    vanityGroup.position.set(3.75, 0, -3.55);
    vanityGroup.rotation.y = -0.4;
    scene.add(vanityGroup);
    const vanityLight = new THREE.PointLight(0xffe4bf, cfg.vanityIntensity, 3.5, 2);
    vanityLight.position.set(3.75, 1.5, -3.35);
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
      hotspots.push({ root, glow, key, baseY: root.position.y, collected: false, vanishT: 0 });
    }

    // --- Jewellery box + bangles box, sitting together at the foot of the bed ---
    const jewelGroup = new THREE.Group();
    const jewelMat = new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.6, metalness: 0.15 });
    const jewelBody = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.18), jewelMat);
    const jewelLid = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.03, 0.19), new THREE.MeshStandardMaterial({ color: gold, roughness: 0.4, metalness: 0.5 }));
    jewelLid.position.y = 0.085;
    jewelGroup.add(jewelBody, jewelLid);
    jewelGroup.position.set(0.45, 0.585, 1.05); // local to bedGroup, foot of the bed
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
    banglesGroup.position.set(-0.45, 0.575, 1.02); // local to bedGroup, next to the jewellery box
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
    photoGroup.scale.setScalar(1.15);
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
    paintingGroup.scale.setScalar(1.15);
    paintingGroup.position.set(1.7, 2.55, -roomSize / 2 + 0.05);
    paintingGroup.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const paintingGlow = addWallGlow(paintingGroup, 0.38, amber, 0.05);
    scene.add(paintingGroup);
    registerHotspot(paintingGroup, 'painting', paintingGlow);

    // --- Photo albums: a leaning stack on the side table ---
    const albumGroup = new THREE.Group();
    const albumColors = [0x7e2735, 0x2c5450, 0x5a3a24, 0x4a6fa5, 0x8a5a3a, 0x6b4a34, 0x3a4a5c];
    let stackY = 0;
    for (let i = 0; i < 7; i++) {
      const w = 0.32 + Math.random() * 0.04;
      const d = 0.26 + Math.random() * 0.03;
      const h = 0.035;
      const album = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color: albumColors[i % albumColors.length], roughness: 0.7 })
      );
      album.position.set((Math.random() - 0.5) * 0.03, stackY + h / 2, (Math.random() - 0.5) * 0.03);
      album.rotation.y = (Math.random() - 0.5) * 0.35;
      albumGroup.add(album);
      stackY += h + 0.002;
    }
    // a couple leaning against the stack for a "lots of albums" feel
    const leaningAlbum = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.035, 0.24),
      new THREE.MeshStandardMaterial({ color: 0x9a5a4a, roughness: 0.7 })
    );
    leaningAlbum.position.set(0.24, 0.1, 0.03);
    leaningAlbum.rotation.z = Math.PI / 2.3;
    leaningAlbum.rotation.y = 0.4;
    albumGroup.add(leaningAlbum);
    albumGroup.position.set(2.85, tableTopY, -1.85); // world space, on the table
    albumGroup.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(albumGroup);
    const albumGlow = addFloorGlow(albumGroup, 0.22, cream);
    registerHotspot(albumGroup, 'photoAlbums', albumGlow);

    // --- Record player: the stand's turntable, plays a shabad on click ---
    const radioGlow = addFloorGlow(standGroup, 0.34, teal);
    registerHotspot(standGroup, 'radio', radioGlow);
    const radioHotspot = hotspots[hotspots.length - 1]; // used to fade the play arrow with it
    radioHotspot.noVanishScale = true; // the record player stays in the room the whole time

    // ---------- decor that fades away once every keepsake has been found ----------
    // (the lamp is handled separately below — it stays lit and topples over
    // instead of fading, as the "something falls" beat)
    const decorGroups = [bedGroup, vanityGroup, table, tableLeg, plant1, plant2];
    decorGroups.forEach((group) => {
      group.traverse((o) => {
        if (o.isMesh && o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => { m.transparent = true; });
        }
      });
    });

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
      if (journeyPhaseRef.current !== 'room') return null;
      raycaster.setFromCamera(pointer, camera);
      const targets = hotspots.filter((h) => !h.collected || h.noVanishScale).map((h) => h.root);
      if (targets.length === 0) return null;
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
    const journeyColor = new THREE.Color();
    let frameId;
    function animate() {
      frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const objs = sceneObjectsRef.current;
      const phase = journeyPhaseRef.current;

      const pos = moteGeo.attributes.position.array;
      for (let i = 0; i < moteCount; i++) {
        pos[i * 3 + 1] -= 0.0016;
        if (pos[i * 3 + 1] < -0.2) pos[i * 3 + 1] = 3.4;
        pos[i * 3 + 0] += Math.sin(t * 0.3 + i) * 0.0003;
      }
      moteGeo.attributes.position.needsUpdate = true;

      // ---------- keepsakes: idle pulse, shrink away once collected, or grow
      // back if "Begin again" resets them. The record player is exempt from
      // both — it stays put AND keeps pulsing, so it's clear you can click
      // it again anytime before the room empties.
      hotspots.forEach((h) => {
        if (!h.glow) return;
        const isCollected = collectedSetRef.current.has(h.key);
        h.collected = isCollected;
        const staysInviting = h.noVanishScale;
        const vanishTarget = isCollected && !staysInviting ? 1 : 0;
        h.vanishT = THREE.MathUtils.lerp(h.vanishT, vanishTarget, 0.09);
        if (Math.abs(h.vanishT - vanishTarget) < 0.003) h.vanishT = vanishTarget;

        if (h.noVanishScale) {
          h.root.visible = true;
          h.root.scale.setScalar(1);
        } else {
          const visible = h.vanishT < 0.999;
          h.root.visible = visible;
          if (visible) h.root.scale.setScalar(Math.max(1 - h.vanishT, 0.0001));
        }

        if (isCollected && !staysInviting) {
          h.glow.material.opacity = 0.5 * (1 - h.vanishT);
        } else {
          const isHovered = h.key === hoveredKey;
          const pulse = 0.35 + Math.sin(t * 2.2 + h.baseY * 3) * 0.15;
          const reappear = 1 - h.vanishT;
          h.glow.material.opacity = (isHovered ? 0.85 : pulse) * reappear;
          const s = isHovered ? 1.15 : 1.0;
          h.glow.scale.set(s, s, s);
        }
      });

      // ---------- the room's arc: furniture fades, the lamp falls, light dies ----------
      if (objs) {
        const jt = getJourneyTargets(phase, objs.modeCfg);
        const live = journeyLiveRef.current;
        const ease = 0.035;
        live.decorOpacity = THREE.MathUtils.lerp(live.decorOpacity, jt.decorOpacity, ease);
        live.decorScale = THREE.MathUtils.lerp(live.decorScale, jt.decorScale, ease);
        live.lampFallAngle = THREE.MathUtils.lerp(live.lampFallAngle, jt.lampFallAngle, ease);
        live.lightMultiplier = THREE.MathUtils.lerp(live.lightMultiplier, jt.lightMultiplier, ease);
        live.shakeAmp = THREE.MathUtils.lerp(live.shakeAmp, jt.shakeAmp, ease);

        decorGroups.forEach((group) => {
          group.scale.setScalar(live.decorScale);
          group.traverse((o) => {
            if (o.isMesh && o.material) {
              const mats = Array.isArray(o.material) ? o.material : [o.material];
              mats.forEach((m) => { m.opacity = live.decorOpacity; });
            }
          });
        });

        lampGroup.rotation.z = live.lampFallAngle;

        scene.fog.density = THREE.MathUtils.lerp(scene.fog.density, jt.fogDensity, ease);
        journeyColor.set(jt.bgColor);
        scene.background.lerp(journeyColor, ease);
        scene.fog.color.lerp(journeyColor, ease);

        const flicker = phase === 'distort'
          ? 0.35 + 0.65 * Math.abs(Math.sin(t * 17) * Math.sin(t * 5))
          : 1;

        windowLight.intensity = objs.baseIntensities.window * live.lightMultiplier * flicker;
        ambientLight.intensity = objs.baseIntensities.ambient * live.lightMultiplier;
        hemisphereLight.intensity = objs.baseIntensities.hemi * live.lightMultiplier;
        fill.intensity = objs.baseIntensities.fill * live.lightMultiplier;
        fill2.intensity = objs.baseIntensities.fill2 * live.lightMultiplier;
        standLight.intensity = objs.baseIntensities.stand * live.lightMultiplier;
        vanityLight.intensity = objs.baseIntensities.vanity * live.lightMultiplier;

        if (live.shakeAmp > 0.0006) {
          camera.position.x += (Math.random() - 0.5) * live.shakeAmp;
          camera.position.y += (Math.random() - 0.5) * live.shakeAmp * 0.6;
          camera.position.z += (Math.random() - 0.5) * live.shakeAmp;
        }
      }

          // Floating play arrow animation — fades and shrinks with the record
          // player itself, instead of lingering after it's collected/gone.
      const arrowFade = 1 - radioHotspot.vanishT;
      if (arrowFade > 0.001) {
        playArrowGroup.visible = true;
        playArrowGroup.position.y = 1.65 + Math.sin(t * 2.5) * 0.06;
        playArrowGroup.scale.setScalar(arrowFade);
        playArrow.material.opacity = (0.65 + Math.sin(t * 2.5) * 0.2) * arrowFade;
        playArrow.rotation.z = Math.sin(t * 1.5) * 0.04;
      } else {
        playArrowGroup.visible = false;
      }

      // gentle platter spin, purely decorative
      platter.rotation.y += 0.01;
      platterLabel.rotation.y += 0.01;

      const lampChaos = phase === 'distort' ? (Math.random() - 0.5) * 1.1 : 0;
      lampLight.intensity = Math.max(
        0,
        (lampBaseRef.current + Math.sin(t * 7.0) * 0.04 + Math.sin(t * 2.3) * 0.025)
          * journeyLiveRef.current.lightMultiplier + lampChaos
      );

      controls.autoRotate = phase === 'room' && !hoveredKey;
      controls.update();
      renderer.render(scene, camera);
    }


    sceneObjectsRef.current = {
      scene,
      windowLight,
      ambientLight,
      hemisphereLight,
      paneMat,
      motesMat,
      standLight,
      vanityLight,
      fill,
      fill2,
      modeCfg: cfg,
      baseIntensities: {
        window: cfg.windowIntensity,
        ambient: cfg.ambientIntensity,
        hemi: cfg.hemiIntensity,
        fill: cfg.fillIntensity,
        fill2: cfg.fill2Intensity,
        stand: cfg.standIntensity,
        vanity: cfg.vanityIntensity,
      },
    };

    animate();

    

    // ---------- cleanup ----------
    return () => {
      sceneObjectsRef.current = null;
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

  // Relight the existing scene whenever `mode` changes — no geometry rebuild,
  // just colors and the base intensities the animate loop multiplies against
  // the journey system's dimming factor each frame.
  useEffect(() => {
    const objs = sceneObjectsRef.current;
    if (!objs) return;
    const cfg = getModeConfig(mode);

    objs.windowLight.color.set(cfg.windowColor);
    objs.ambientLight.color.set(cfg.ambientColor);
    objs.hemisphereLight.color.set(cfg.hemiSky);
    objs.paneMat.color.set(cfg.paneColor);
    objs.paneMat.opacity = cfg.paneOpacity;
    objs.motesMat.opacity = cfg.moteOpacity;

    objs.baseIntensities.window = cfg.windowIntensity;
    objs.baseIntensities.ambient = cfg.ambientIntensity;
    objs.baseIntensities.hemi = cfg.hemiIntensity;
    objs.baseIntensities.fill = cfg.fillIntensity;
    objs.baseIntensities.fill2 = cfg.fill2Intensity;
    objs.baseIntensities.stand = cfg.standIntensity;
    objs.baseIntensities.vanity = cfg.vanityIntensity;
    lampBaseRef.current = cfg.lampIntensity;

    objs.modeCfg = cfg;
  }, [mode]);

  // Keep the journey phase and collected-keepsakes set available to the
  // running animate loop without ever rebuilding the scene.
  useEffect(() => {
    journeyPhaseRef.current = journeyPhase;
  }, [journeyPhase]);

  useEffect(() => {
    collectedSetRef.current = new Set(collectedKeys);
  }, [collectedKeys]);

  return (
    <div
      ref={mountRef}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        background: '#362a2d',
        touchAction: 'none',
        ...style,
      }}
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
  photoAlbums: {
    eyebrow: 'Every occasion, filed away',
    title: 'The Photo Albums',
    body: "A whole stack of them, spines cracked from being pulled out again and again. Every album has a decade, and every decade has a story attached that takes longer to tell than the photo took to develop.",
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
  radio: {
    eyebrow: 'A familiar tune',
    title: 'The Record Player',
    body: "She kept the same handful of shabads on rotation, worn soft with replaying. Press play and the room fills the way it used to on quiet mornings.",
  },
};

const TOTAL_KEEPSAKES = Object.keys(memories).length;

function App() {
  const [openMemory, setOpenMemory] = useState(null);
  const [hasEntered, setHasEntered] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [mode, setMode] = useState('night');
  const [collectedKeys, setCollectedKeys] = useState([]);
  const [journeyPhase, setJourneyPhase] = useState('room');
  const [musicOn, setMusicOn] = useState(false);
  const [musicStarted, setMusicStarted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const shabadAudioRef = useRef(null);
  const endingTriggeredRef = useRef(false);

  function toggleMode() {
    setMode((m) => (m === 'night' ? 'day' : 'night'));
  }

  function toggleMusic() {
    const audio = shabadAudioRef.current;
    if (!audio) return;
    if (musicOn) {
      audio.pause();
      setMusicOn(false);
    } else {
      audio.play().then(() => setMusicOn(true)).catch((err) => {
        console.warn('Shabad playback failed:', err);
      });
    }
  }

  function handleHotspotClick(key) {
    if (key === 'radio' && shabadAudioRef.current) {
      const audio = shabadAudioRef.current;
      audio.currentTime = 0;
      audio.play().then(() => setMusicOn(true)).catch((err) => {
        console.warn('Shabad playback failed:', err);
      });
      setMusicStarted(true);
    }
    setOpenMemory(key);
    setCollectedKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }

  function handleRestartJourney() {
    endingTriggeredRef.current = false;
    setCollectedKeys([]);
    setJourneyPhase('room');
    setMusicOn(false);
    setMusicStarted(false);
    if (shabadAudioRef.current) {
      shabadAudioRef.current.pause();
      shabadAudioRef.current.currentTime = 0;
    }
  }

  useEffect(() => {
    if (shabadAudioRef.current) {
      shabadAudioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpenMemory(null);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Once every keepsake has been found, walk the room through its ending:
  // furniture fades away, the lamp topples and the lights die, then the
  // room settles into stillness for the reflection screen.
  // NOTE: journeyPhase is deliberately NOT a dependency here — this effect
  // itself changes journeyPhase via the timers below, and if it were a
  // dependency, each phase change would re-run the effect and its cleanup
  // would cancel the remaining timers before they ever fired.
  useEffect(() => {
    if (
      !openMemory &&
      collectedKeys.length === TOTAL_KEEPSAKES &&
      !endingTriggeredRef.current
    ) {
      endingTriggeredRef.current = true;
      if (shabadAudioRef.current) {
        shabadAudioRef.current.pause();
      }
      setMusicOn(false);
      const toEmpty = setTimeout(() => setJourneyPhase('empty'), 1300);
      const toDistort = setTimeout(() => setJourneyPhase('distort'), 1300 + 2600);
      const toReflect = setTimeout(() => setJourneyPhase('reflect'), 1300 + 2600 + 1900);
      return () => {
        clearTimeout(toEmpty);
        clearTimeout(toDistort);
        clearTimeout(toReflect);
      };
    }
  }, [collectedKeys, openMemory]);

  const memory = openMemory ? memories[openMemory] : null;

  return (
    <main className="archive-shell">

      {!hasEntered && (
  <div className="splash-screen">
    <div className="splash-content">
      <p className="splash-kicker">
        A DIGITAL MEMORY ARCHIVE
      </p>

      <h1>Nani's Room</h1>

      <p className="splash-description">
        Can you collect all 8 memories and their stories? Drag around the
        room to find the objects. Start with the record player to help
        guide you round the room with a traditional song.
      </p>

      <button
        className="enter-room-btn"
        type="button"
        onClick={() => setHasEntered(true)}
      >
        Enter the room <span>→</span>
      </button>

      <p className="splash-small">
        Best experienced with sound on
      </p>
    </div>
  </div>
)}

      
      <div className="room-stage">
        <NanisRoom
          onHotspotClick={handleHotspotClick}
          mode={mode}
          collectedKeys={collectedKeys}
          journeyPhase={journeyPhase}
        />
      </div>

      {/* Shabad audio — plays when the record player hotspot is clicked.
          File lives at public/assets/shabad.mp3 */}
      <audio ref={shabadAudioRef} preload="none" loop>
        <source src="/assets/shabad.mp3" type="audio/mpeg" />
      </audio>

      <header className={`archive-header${journeyPhase !== 'room' ? ' is-fading' : ''}`}>
        <p className="archive-kicker">A digital memory archive</p>
        <h1>Nani's Room</h1>
        <p className="archive-prompt">Explore the room and listen closely.</p>
      </header>

      <div className="top-controls">
        {musicStarted && (
          <button
            className={`glass-btn music-toggle-btn${journeyPhase !== 'room' ? ' is-fading' : ''}`}
            type="button"
            onClick={toggleMusic}
            disabled={journeyPhase !== 'room'}
            aria-pressed={musicOn}
            aria-label={musicOn ? 'Turn music off' : 'Turn music on'}
            title={musicOn ? 'Turn music off' : 'Turn music on'}
          >
            <span className={`music-dot${musicOn ? ' is-on' : ''}`} aria-hidden="true" />
            Music {musicOn ? 'On' : 'Off'}
          </button>
        )}
        <button
          className="glass-btn mode-toggle-btn"
          type="button"
          onClick={toggleMode}
          aria-label={mode === 'night' ? 'Switch to day mode' : 'Switch to night mode'}
          title={mode === 'night' ? 'Switch to day' : 'Switch to night'}
        >
          <span aria-hidden="true">{mode === 'night' ? '☾' : '☀'}</span>
        </button>
        <button
          className="glass-btn about-btn"
          type="button"
          onClick={() => setShowAbout(true)}
        >
          About
        </button>
      </div>
      <p className={`archive-hint${journeyPhase !== 'room' ? ' is-fading' : ''}`} aria-hidden="true">Drag to look around · Click a glowing keepsake</p>
      <p className={`keepsake-tally${journeyPhase !== 'room' ? ' is-fading' : ''}`} aria-hidden="true">
        <span className="tally-count">{collectedKeys.length}</span> / {TOTAL_KEEPSAKES} memories found
      </p>
      {memory && openMemory !== 'radio' && (
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

      {openMemory === 'radio' && (
        <div className="modal-backdrop" role="presentation" onClick={() => setOpenMemory(null)}>
          <section
            className="record-player-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="record-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="close-btn" type="button" onClick={() => setOpenMemory(null)} aria-label="Close">×</button>
            <p className="memory-eyebrow">{memories.radio.eyebrow}</p>
            <h2 id="record-title">{memories.radio.title}</h2>

            <div className="record-player-plan">
              <svg viewBox="0 0 200 200" className={`record-plan-svg${musicOn ? ' is-spinning' : ''}`} aria-hidden="true">
                <circle cx="100" cy="100" r="96" className="rp-base" />
                <circle cx="100" cy="100" r="96" className="rp-base-ring" />
                <g className="record-disc">
                  <circle cx="100" cy="100" r="80" className="rp-disc" />
                  <circle cx="100" cy="100" r="64" className="rp-groove" />
                  <circle cx="100" cy="100" r="49" className="rp-groove" />
                  <circle cx="100" cy="100" r="34" className="rp-groove" />
                  <circle cx="100" cy="100" r="17" className="rp-label" />
                  <circle cx="100" cy="100" r="2.5" className="rp-spindle" />
                </g>
                <g className="tonearm">
                  <circle cx="166" cy="42" r="7" className="rp-arm-pivot" />
                  <line x1="166" y1="42" x2="118" y2="94" className="rp-arm" />
                  <circle cx="118" cy="94" r="3.5" className="rp-arm-tip" />
                </g>
              </svg>
            </div>

            <p className="memory-body">{memories.radio.body}</p>

            <div className="record-player-controls">
              <button
                className="return-btn play-pause-btn"
                type="button"
                onClick={toggleMusic}
                aria-pressed={musicOn}
              >
                {musicOn ? '❚❚ Pause' : '▶ Play'}
              </button>
              <label className="volume-control">
                <span className="volume-label">
                  Volume <span className="volume-value">{Math.round(volume * 100)}%</span>
                </span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(event) => setVolume(Number(event.target.value))}
                  aria-label="Volume"
                />
              </label>
            </div>

            <button className="return-btn" type="button" onClick={() => setOpenMemory(null)}>Return to the room</button>
          </section>
        </div>
      )}

      {showAbout && (
  <div
    className="modal-backdrop"
    role="presentation"
    onClick={() => setShowAbout(false)}
  >
    <section
      className="about-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-title"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        className="close-btn"
        type="button"
        onClick={() => setShowAbout(false)}
        aria-label="Close about"
      >
        ×
      </button>

      <p className="memory-eyebrow">
        ABOUT THE ARCHIVE
      </p>

      <h2 id="about-title">
        Welcome to Nani's Room
      </h2>

      <p className="memory-body">
        What does home feel like to you? Is it a house? A person? Certain
        objects, sounds, or music? Or is it the way all of these things
        come together to remind you of somewhere — or someone — you
        belong to?
      </p>

      <p className="memory-body">
        Has your idea of home changed as you've grown older? Have you
        ever found yourself yearning for a version of home that no
        longer exists, or perhaps one that only exists in your memories?
      </p>

      <p className="memory-body">
        Nani's Room is an immersive digital space that explores memory,
        nostalgia, and the meaning of home within a British Asian
        experience.
      </p>

      <p className="memory-body">
        Each object in the room holds a memory. Explore the space,
        click the glowing keepsakes and listen closely.
      </p>

      <button
        className="return-btn"
        type="button"
        onClick={() => setShowAbout(false)}
      >
        Return to the room
      </button>
    </section>
  </div>
)}

      {journeyPhase === 'reflect' && (
        <div className="reflect-screen" role="dialog" aria-modal="true" aria-labelledby="reflect-title">
          <div className="reflect-content">
            <p className="memory-eyebrow">The room, emptied</p>
            <h2 id="reflect-title">Are the Memories Gone?</h2>
            <p className="reflect-body">
              Every object here; a bangle, a bottle of oil, a record
              spinning the same song held nothing on its own.
              They were only ever doorways. The room could be emptied. The
              light could go out.
            </p>
            <p className="reflect-question">
              So now that it has, where do the memories go?
              <br />
              Are they still with you?
            </p>
            <button className="return-btn" type="button" onClick={handleRestartJourney}>
              Begin again
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;