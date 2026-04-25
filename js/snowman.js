import * as THREE from 'three';

// ── Damped spring (1 DOF) ──────────────────────────────────────
class Spring {
  constructor(stiffness = 200, damping = 16) {
    this.k = stiffness;
    this.c = damping;
    this.x = 0;   // displacement
    this.v = 0;   // velocity
  }
  update(dt) {
    const d = Math.min(dt, 0.05);
    const a = -this.k * this.x - this.c * this.v;
    this.v += a * d;
    this.x += this.v * d;
    return this.x;
  }
  impulse(amount) { this.v += amount; }
  reset() { this.x = 0; this.v = 0; }
}

// ── Procedural snow texture ────────────────────────────────────
function makeSnowTex(size = 512) {
  const cv  = document.createElement('canvas');
  cv.width  = cv.height = size;
  const ctx = cv.getContext('2d');

  // Base gradient: slightly blue-white
  const g = ctx.createRadialGradient(size*0.5, size*0.45, 0, size*0.5, size*0.5, size*0.7);
  g.addColorStop(0, '#F8FBFF');
  g.addColorStop(1, '#D8E8FF');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // Fine snow grain
  for (let i = 0; i < 7000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 0.5 + Math.random() * 2.2;
    const b = 155 + Math.floor(Math.random() * 90);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${b},${b},${b+18},${0.25 + Math.random() * 0.45})`;
    ctx.fill();
  }

  // Crystalline sparkles
  for (let i = 0; i < 280; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.beginPath();
    ctx.arc(x, y, Math.random() * 1.4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(190,215,255,${0.4 + Math.random() * 0.6})`;
    ctx.fill();
  }

  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  return t;
}

// ── Small mesh helper ──────────────────────────────────────────
function mkMesh(geo, mat, px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(px, py, pz);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  return m;
}

// ══════════════════════════════════════════════════════════════
export class Snowman {
  constructor(scene) {
    this.scene     = scene;
    this.group     = new THREE.Group();

    // Spring bank
    this._sp = {
      rotX:   new Spring(185, 13),
      rotZ:   new Spring(185, 13),
      scaleY: new Spring(290, 18),
      posY:   new Spring(155, 11),
      headY:  new Spring(230, 15),
      headX:  new Spring(230, 15),
    };

    this.animState    = 'idle';
    this._animIval    = null;
    this._hatAnim     = null;
    this._clock       = 0;
    this._blinkT      = 2.5 + Math.random() * 2;
    this.noseMesh     = null;
    this.hatGroup     = null;
    this._eyeL        = null;
    this._eyeR        = null;
    this.allMeshes    = [];
    this._baseY       = -1.05;

    this._build();
    this.group.position.set(0, this._baseY, -3.0);
    scene.add(this.group);
  }

  // ── Build ──────────────────────────────────────────────────
  _build() {
    const snowTex = makeSnowTex(512);

    const snowM = () => new THREE.MeshStandardMaterial({
      color: 0xEEF6FF, roughness: 0.88, metalness: 0.0,
      map: snowTex, envMapIntensity: 0.7,
      emissive: 0x6699CC, emissiveIntensity: 0.06,
    });
    const coal   = new THREE.MeshStandardMaterial({ color: 0x1A1A2E, roughness: 0.45, metalness: 0.3, emissive: 0x000010, emissiveIntensity: 0.1 });
    const orange = new THREE.MeshStandardMaterial({ color: 0xFF6B35, roughness: 0.5,  metalness: 0.0, emissive: 0xFF3300, emissiveIntensity: 0.12 });
    const redM   = new THREE.MeshStandardMaterial({ color: 0xC62828, roughness: 0.75, metalness: 0.0, emissive: 0x8B0000, emissiveIntensity: 0.08 });
    const brown  = new THREE.MeshStandardMaterial({ color: 0x5D4037, roughness: 0.92, metalness: 0.0 });
    const hatM   = new THREE.MeshStandardMaterial({ color: 0x141428, roughness: 0.5,  metalness: 0.25, emissive: 0x050510, emissiveIntensity: 0.15 });
    const bandM  = new THREE.MeshStandardMaterial({ color: 0xB71C1C, roughness: 0.7,  metalness: 0.0, emissive: 0x600000, emissiveIntensity: 0.08 });
    const glowM  = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.0,  metalness: 0.0, emissive: 0xFFFFFF, emissiveIntensity: 1.4 });
    const cheekM = new THREE.MeshStandardMaterial({ color: 0xFFAABB, roughness: 0.9,  transparent: true, opacity: 0.55, emissive: 0xFF7799, emissiveIntensity: 0.12 });

    const sph = (r, mat, segs = 32) => new THREE.Mesh(new THREE.SphereGeometry(r, segs, segs), mat);

    // ── BODY ────────────────────────────────────────────────
    this.bodyMesh = sph(0.62, snowM());
    this.bodyMesh.castShadow = this.bodyMesh.receiveShadow = true;
    this.group.add(this.bodyMesh);

    [0.30, 0.06, -0.18].forEach((yOff, i) => {
      const btn = sph(0.048, coal.clone(), 12);
      btn.position.set(0.04 - i * 0.015, yOff, 0.59);
      this.group.add(btn);
    });

    // ── TORSO ───────────────────────────────────────────────
    this.torsoMesh = sph(0.46, snowM());
    this.torsoMesh.position.y = 0.94;
    this.torsoMesh.castShadow = true;
    this.group.add(this.torsoMesh);

    // ── SCARF ───────────────────────────────────────────────
    const scarfPts = new THREE.EllipseCurve(0, 0, 0.46, 0.42, 0, Math.PI * 2, false, 0)
      .getPoints(48).map(p => new THREE.Vector3(p.x, 0, p.y));
    const scarf = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(scarfPts, true), 48, 0.068, 10, true),
      redM
    );
    scarf.position.y = 1.3;
    scarf.rotation.x = 0.14;
    this.group.add(scarf);

    // Scarf tail
    const tail = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.38, 1.28, 0.14),
        new THREE.Vector3(-0.33, 1.06, 0.22),
        new THREE.Vector3(-0.26, 0.80, 0.24),
        new THREE.Vector3(-0.22, 0.60, 0.18),
      ]), 12, 0.056, 8, false
    );
    this.group.add(new THREE.Mesh(tail, redM));

    // ── HEAD ────────────────────────────────────────────────
    this.headGroup = new THREE.Group();
    this.headGroup.position.y = 1.70;

    this.headMesh = sph(0.34, snowM());
    this.headMesh.castShadow = true;
    this.headGroup.add(this.headMesh);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.064, 18, 18);
    this._eyeL = new THREE.Mesh(eyeGeo, coal.clone());
    this._eyeR = new THREE.Mesh(eyeGeo, coal.clone());
    this._eyeL.position.set(-0.13, 0.07, 0.29);
    this._eyeR.position.set( 0.13, 0.07, 0.29);
    this.headGroup.add(this._eyeL, this._eyeR);

    // Eye shine highlights
    const hlGeo = new THREE.SphereGeometry(0.023, 8, 8);
    [-0.13, 0.13].forEach(x => {
      const hl = new THREE.Mesh(hlGeo, glowM);
      hl.position.set(x + 0.03, 0.10, 0.34);
      this.headGroup.add(hl);
    });

    // Eyebrows
    const browGeo = new THREE.BoxGeometry(0.115, 0.03, 0.026);
    [[-0.13, 0.19, 0.28, 0.22], [0.13, 0.19, 0.28, -0.22]].forEach(([x, y, z, rz]) => {
      const b = new THREE.Mesh(browGeo, coal.clone());
      b.position.set(x, y, z);
      b.rotation.z = rz;
      this.headGroup.add(b);
    });

    // Cheeks
    [-0.22, 0.22].forEach(x => {
      const ck = sph(0.09, cheekM, 16);
      ck.position.set(x, -0.05, 0.27);
      this.headGroup.add(ck);
    });

    // Nose (carrot)
    const noseGeo = new THREE.ConeGeometry(0.052, 0.3, 12);
    this.noseMesh = new THREE.Mesh(noseGeo, orange);
    this.noseMesh.rotation.x = -Math.PI / 2;
    this.noseMesh.position.set(0, 0, 0.38);
    this.headGroup.add(this.noseMesh);

    // Smile
    for (let i = -3; i <= 3; i++) {
      const ang = (i / 4.5) * 0.72;
      const r   = 0.245;
      const dot = sph(0.028, coal.clone(), 8);
      dot.position.set(
        Math.sin(ang) * r,
        -0.145 - Math.abs(i) * 0.010,
        Math.sqrt(Math.max(0, 0.34 * 0.34 - (Math.sin(ang) * r) ** 2)) * 0.86
      );
      this.headGroup.add(dot);
    }

    // ── HAT ─────────────────────────────────────────────────
    this.hatGroup = new THREE.Group();
    this.hatGroup.position.y = 0.31;

    const hatCyl = mkMesh(new THREE.CylinderGeometry(0.252, 0.265, 0.44, 20), hatM, 0, 0.28, 0);
    const hatBrim = mkMesh(new THREE.CylinderGeometry(0.39, 0.39, 0.05, 20), hatM, 0, 0.07, 0);
    const hatTop  = mkMesh(new THREE.CylinderGeometry(0.04, 0.252, 0.04, 16), hatM, 0, 0.525, 0);
    const hatBand = mkMesh(new THREE.CylinderGeometry(0.26, 0.26, 0.065, 20), bandM, 0, 0.14, 0);

    this.hatGroup.add(hatCyl, hatBrim, hatTop, hatBand);
    this._hatRestY = this.hatGroup.position.y;
    this.headGroup.add(this.hatGroup);
    this.group.add(this.headGroup);

    // ── ARMS ────────────────────────────────────────────────
    this.leftArmG  = this._arm(brown);
    this.rightArmG = this._arm(brown);
    this.leftArmG.position.set(-0.5, 0.86, 0);
    this.leftArmG.rotation.z  =  Math.PI / 3.2;
    this.rightArmG.position.set(0.5, 0.86, 0);
    this.rightArmG.rotation.z = -Math.PI / 3.2;
    this.group.add(this.leftArmG, this.rightArmG);

    // ── BLOB SHADOW ─────────────────────────────────────────
    const blobShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.72, 32),
      new THREE.MeshBasicMaterial({ color: 0x000033, transparent: true, opacity: 0.22 })
    );
    blobShadow.rotation.x = -Math.PI / 2;
    blobShadow.position.y  = -0.63;
    this.group.add(blobShadow);
    this._shadow = blobShadow;

    // Raycasting collection (exclude blob shadow)
    this.group.traverse(c => { if (c.isMesh && c !== blobShadow) this.allMeshes.push(c); });
  }

  _arm(mat) {
    const g = new THREE.Group();
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.018, 0.62, 8), mat);
    cyl.position.y = 0.31;
    g.add(cyl);
    [-0.45, 0, 0.45].forEach(ang => {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.008, 0.18, 6), mat);
      f.position.set(Math.sin(ang) * 0.07, 0.65, Math.cos(ang) * 0.04);
      f.rotation.z = ang * 0.55;
      f.rotation.x = -0.32;
      g.add(f);
    });
    return g;
  }

  // ── Interaction ────────────────────────────────────────────
  tap(hitObject) {
    if (hitObject === this.noseMesh)               { this._reactNose(); return 'tap_nose'; }
    if (this._childOf(this.hatGroup, hitObject))   { this._reactHat();  return 'tap_hat'; }
    this._reactBody();
    return 'tap_body';
  }

  _childOf(parent, target) {
    let found = false;
    parent.traverse(c => { if (c === target) found = true; });
    return found;
  }

  _reactBody() {
    const sign = Math.random() > 0.5 ? 1 : -1;
    this._sp.rotZ.impulse(0.45 * sign);
    this._sp.rotX.impulse(-0.20);
    this._sp.scaleY.impulse(-0.45);
    this._sp.posY.impulse(0.25);
    this._sp.headY.impulse(0.30 * sign);
  }

  _reactNose() {
    this._sp.rotX.impulse(-0.55);
    this._sp.headX.impulse(-0.45);
    const mat = this.noseMesh.material;
    mat.emissive.setHex(0xFF5500);
    mat.emissiveIntensity = 0.85;
    setTimeout(() => { mat.emissive.setHex(0xFF3300); mat.emissiveIntensity = 0.12; }, 420);
  }

  _reactHat() {
    if (this._hatAnim) clearInterval(this._hatAnim);
    let t = 0;
    const sy = this.hatGroup.position.y;
    this._hatAnim = setInterval(() => {
      t += 0.055;
      this.hatGroup.position.y = sy + Math.sin(t) * 1.0 * Math.exp(-t * 0.5);
      this.hatGroup.rotation.y = Math.sin(t * 2) * 0.65 * Math.exp(-t * 0.5);
      this.hatGroup.rotation.z = Math.sin(t * 1.3) * 0.4  * Math.exp(-t * 0.5);
      if (t > 5) {
        this.hatGroup.position.y = sy;
        this.hatGroup.rotation.set(0, 0, 0);
        clearInterval(this._hatAnim);
      }
    }, 16);
    this._sp.headY.impulse(0.55);
  }

  // ── Named animations ───────────────────────────────────────
  playAnimation(name, duration = 3000) {
    if (this._animIval) { clearInterval(this._animIval); this._animIval = null; }
    this.animState = name;
    this._startAnim(name);
    if (name !== 'idle') setTimeout(() => this.playAnimation('idle'), duration);
  }

  _startAnim(name) {
    let t = 0;
    const loop = (fn) => {
      this._animIval = setInterval(() => {
        if (this.animState !== name) { clearInterval(this._animIval); return; }
        t += 0.05;
        fn(t);
      }, 16);
    };

    switch (name) {
      case 'idle':
        this._resetPose();
        break;

      case 'dance':
        loop(t => {
          this.group.rotation.y     = Math.sin(t * 3) * 0.44;
          this.torsoMesh.rotation.y = Math.sin(t * 3) * 0.28;
          this.headGroup.rotation.y = Math.sin(t * 2) * 0.18;
          this.leftArmG.rotation.z  =  Math.PI / 3.2 + Math.sin(t * 3)          * 0.95;
          this.rightArmG.rotation.z = -(Math.PI / 3.2 + Math.sin(t * 3 + Math.PI) * 0.95);
          if (Math.abs(Math.sin(t * 6)) > 0.97) this._sp.posY.impulse(0.28);
        });
        break;

      case 'wave':
        loop(t => {
          this.rightArmG.rotation.z = -(Math.PI / 3.2 + Math.sin(t * 4) * 0.9 + 0.7);
          this.headGroup.rotation.y = Math.sin(t * 1.6) * 0.12;
        });
        break;

      case 'sing':
        loop(t => {
          this.headGroup.rotation.x    = Math.sin(t * 2) * 0.11;
          this.headGroup.rotation.y    = Math.sin(t * 1.5) * 0.15;
          this.leftArmG.rotation.z  =  Math.PI / 3.2 + Math.sin(t * 1.5) * 0.26;
          this.rightArmG.rotation.z = -(Math.PI / 3.2 + Math.sin(t * 1.5) * 0.26);
          if (Math.abs(Math.sin(t * 2)) > 0.98) this._sp.posY.impulse(0.06);
        });
        break;

      case 'happy':
        loop(t => {
          this.group.rotation.z = Math.sin(t * 2.5) * 0.07;
          if (Math.abs(Math.sin(t * 5)) > 0.97) {
            this._sp.posY.impulse(0.32);
            this._sp.scaleY.impulse(-0.18);
          }
        });
        break;

      case 'surprised':
        this._sp.rotX.impulse(-0.7);
        this._sp.scaleY.impulse(-0.6);
        this.leftArmG.rotation.z  =  Math.PI / 3.2 + 1.15;
        this.rightArmG.rotation.z = -(Math.PI / 3.2 + 1.15);
        setTimeout(() => {
          this.leftArmG.rotation.z  =  Math.PI / 3.2;
          this.rightArmG.rotation.z = -Math.PI / 3.2;
        }, 1800);
        break;

      case 'tapNose':
        this._reactNose();
        this._sp.headX.impulse(-0.5);
        break;
    }
  }

  // ── Frame update ───────────────────────────────────────────
  update(dt) {
    this._clock += dt;
    const t  = this._clock;

    const rx = this._sp.rotX.update(dt);
    const rz = this._sp.rotZ.update(dt);
    const sy = this._sp.scaleY.update(dt);
    const py = this._sp.posY.update(dt);
    const hy = this._sp.headY.update(dt);
    const hx = this._sp.headX.update(dt);

    // Idle breathing
    if (this.animState === 'idle') {
      this.group.position.y   = this._baseY + py + Math.sin(t * 1.15) * 0.014;
      this.headGroup.rotation.y = Math.sin(t * 0.55) * 0.055 + hy;
    } else {
      this.group.position.y   = this._baseY + py;
      this.headGroup.rotation.y += hy * 0.06;
    }
    this.headGroup.rotation.x = hx;

    // Apply wobble springs
    this.group.rotation.x = rx;
    this.group.rotation.z = rz;

    // Squash & stretch (volume conserving)
    const sc  = sy * 0.28;   // sy goes negative on squash
    const bsc = 0.85;
    this.group.scale.set(
      bsc * (1 - sc * 0.55),
      bsc * (1 + sc),
      bsc * (1 - sc * 0.55)
    );

    // Shadow follows height
    if (this._shadow) {
      const h = Math.max(0.4, 1 - py * 0.6);
      this._shadow.scale.setScalar(h);
      this._shadow.material.opacity = 0.22 * h;
    }

    // Blink
    this._blinkT -= dt;
    if (this._blinkT <= 0) {
      if (this._eyeL.scale.y > 0.15) {
        this._eyeL.scale.y = this._eyeR.scale.y = 0.04;
        this._blinkT = 0.10;
      } else {
        this._eyeL.scale.y = this._eyeR.scale.y = 1;
        this._blinkT = 2.8 + Math.random() * 3.2;
      }
    }
  }

  getMeshes() { return this.allMeshes; }

  _resetPose() {
    this.torsoMesh.rotation.set(0, 0, 0);
    this.headGroup.rotation.set(0, 0, 0);
    this.leftArmG.rotation.set(0, 0,  Math.PI / 3.2);
    this.rightArmG.rotation.set(0, 0, -Math.PI / 3.2);
    this.group.rotation.set(0, 0, 0);
  }
}
