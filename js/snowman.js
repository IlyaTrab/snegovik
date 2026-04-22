import * as THREE from 'three';

export class Snowman {
  constructor(scene) {
    this.scene       = scene;
    this.group       = new THREE.Group();
    this.animState   = 'idle';
    this._animHandle = null;
    this.noseMesh    = null;

    this._build();
    // Position in front of camera
    this.group.position.set(0, -1.3, -3.2);
    scene.add(this.group);
  }

  // ── Build procedural snowman ────────────────────────────
  _build() {
    const white  = new THREE.MeshToonMaterial({ color: 0xEEF5FF });
    const orange = new THREE.MeshToonMaterial({ color: 0xFF7043 });
    const dark   = new THREE.MeshToonMaterial({ color: 0x1A1A2E });
    const coal   = new THREE.MeshToonMaterial({ color: 0x263238 });
    const red    = new THREE.MeshToonMaterial({ color: 0xE53935 });
    const brown  = new THREE.MeshToonMaterial({ color: 0x6D4C41 });

    const sphere = (r, m) => new THREE.Mesh(new THREE.SphereGeometry(r, 24, 24), m);

    // Body
    const body = sphere(0.56, white);
    body.position.y = -0.56;
    this.group.add(body);
    this.bodyMesh = body;

    // Torso
    const torso = sphere(0.42, white);
    torso.position.y = 0.35;
    this.group.add(torso);
    this.torsoMesh = torso;

    // Buttons on torso
    for (let i = -1; i <= 1; i++) {
      const btn = sphere(0.042, coal);
      btn.position.set(0, 0.35 + i * 0.16, 0.39);
      this.group.add(btn);
    }

    // Head group (rotates independently)
    this.headGroup = new THREE.Group();
    this.headGroup.position.y = 1.03;

    const head = sphere(0.31, white);
    this.headGroup.add(head);
    this.headMesh = head;

    // Eyes
    for (const x of [-0.11, 0.11]) {
      const eye = sphere(0.052, dark);
      eye.position.set(x, 0.04, 0.27);
      this.headGroup.add(eye);
    }

    // Nose (carrot cone)
    const noseGeo = new THREE.ConeGeometry(0.042, 0.22, 10);
    const nose = new THREE.Mesh(noseGeo, orange);
    nose.rotation.x = -Math.PI / 2;
    nose.position.set(0, -0.04, 0.33);
    this.headGroup.add(nose);
    this.noseMesh = nose;

    // Smile
    for (let i = -2; i <= 2; i++) {
      const ang  = (i / 2.5) * 0.55;
      const dot  = sphere(0.028, coal);
      dot.position.set(
        Math.sin(ang) * 0.18,
        -0.13 + Math.cos(ang) * 0.05 - 0.04,
        Math.sqrt(Math.max(0, 0.31 ** 2 - (Math.sin(ang) * 0.18) ** 2)) * 0.92
      );
      this.headGroup.add(dot);
    }

    // Hat cylinder
    const hatCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.36, 18), coal);
    hatCyl.position.y = 0.48;
    this.headGroup.add(hatCyl);

    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.045, 18), dark);
    brim.position.y = 0.32;
    this.headGroup.add(brim);

    this.group.add(this.headGroup);

    // Scarf ring
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.065, 10, 20), red);
    scarf.position.y = 0.70;
    scarf.rotation.x = 0.18;
    this.group.add(scarf);

    // Arms
    this.leftArmGroup  = this._makeArm(brown);
    this.rightArmGroup = this._makeArm(brown);
    this.leftArmGroup.position.set(-0.42, 0.35, 0);
    this.leftArmGroup.rotation.z  =  Math.PI / 4;
    this.rightArmGroup.position.set(0.42, 0.35, 0);
    this.rightArmGroup.rotation.z = -Math.PI / 4;
    this.group.add(this.leftArmGroup);
    this.group.add(this.rightArmGroup);

    // Collect all meshes for raycasting
    this.allMeshes = [];
    this.group.traverse(c => { if (c.isMesh) this.allMeshes.push(c); });
  }

  _makeArm(mat) {
    const g = new THREE.Group();
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.022, 0.52, 8), mat);
    cyl.position.y = 0.26;
    g.add(cyl);
    for (const x of [-0.07, 0, 0.07]) {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.01, 0.16, 6), mat);
      f.position.set(x, 0.55, 0);
      f.rotation.z = x * 1.4;
      g.add(f);
    }
    return g;
  }

  // ── Animations ──────────────────────────────────────────
  playAnimation(name, duration = 3000) {
    if (this._animHandle) { clearInterval(this._animHandle); this._animHandle = null; }
    this.animState = name;
    this._runAnim(name);
    if (name !== 'idle') {
      setTimeout(() => this.playAnimation('idle'), duration);
    }
  }

  _runAnim(name) {
    switch (name) {
      case 'idle':       this._resetPose(); this._animIdle();      break;
      case 'dance':      this._animDance();     break;
      case 'wave':       this._animWave();      break;
      case 'sing':       this._animSing();      break;
      case 'happy':      this._animHappy();     break;
      case 'surprised':  this._animSurprised(); break;
      case 'tapNose':    this._animTapNose();   break;
    }
  }

  update() {
    if (this.animState === 'idle') {
      const t = Date.now() / 1000;
      this.group.position.y   = -1.3 + Math.sin(t * 1.1) * 0.028;
      this.headGroup.rotation.y = Math.sin(t * 0.7) * 0.07;
    }
  }

  getMeshes() { return this.allMeshes; }

  // ── Individual animations ────────────────────────────────
  _animIdle() {
    // subtle breathing handled in update()
  }

  _animDance() {
    let t = 0;
    this._animHandle = setInterval(() => {
      if (this.animState !== 'dance') { clearInterval(this._animHandle); return; }
      t += 0.055;
      this.group.rotation.y          = Math.sin(t * 3)    * 0.38;
      this.group.position.y          = -1.3 + Math.abs(Math.sin(t * 4)) * 0.14;
      this.leftArmGroup.rotation.z   =  Math.PI / 4 + Math.sin(t * 3)          * 0.65;
      this.rightArmGroup.rotation.z  = -(Math.PI / 4 + Math.sin(t * 3 + Math.PI) * 0.65);
      this.torsoMesh.rotation.y      = Math.sin(t * 3) * 0.25;
    }, 16);
  }

  _animWave() {
    let t = 0;
    this._animHandle = setInterval(() => {
      if (this.animState !== 'wave') { clearInterval(this._animHandle); return; }
      t += 0.09;
      this.rightArmGroup.rotation.z = -(Math.PI / 4 + Math.sin(t * 4) * 0.72 + 0.55);
      this.headGroup.rotation.y     = Math.sin(t * 1.8) * 0.13;
    }, 16);
  }

  _animSing() {
    let t = 0;
    this._animHandle = setInterval(() => {
      if (this.animState !== 'sing') { clearInterval(this._animHandle); return; }
      t += 0.065;
      this.headGroup.rotation.x     = Math.sin(t * 2)   * 0.09 - 0.04;
      this.headGroup.rotation.y     = Math.sin(t * 1.4) * 0.11;
      this.leftArmGroup.rotation.z  =  Math.PI / 4 + Math.sin(t * 1.4) * 0.18;
      this.rightArmGroup.rotation.z = -(Math.PI / 4 + Math.sin(t * 1.4) * 0.18);
      this.group.position.y         = -1.3 + Math.sin(t * 2) * 0.035;
    }, 16);
  }

  _animHappy() {
    let t = 0;
    this._animHandle = setInterval(() => {
      if (this.animState !== 'happy') { clearInterval(this._animHandle); return; }
      t += 0.11;
      this.group.position.y = -1.3 + Math.abs(Math.sin(t * 6)) * 0.18;
      this.group.rotation.z = Math.sin(t * 3) * 0.045;
    }, 16);
  }

  _animSurprised() {
    this.headGroup.rotation.x  = -0.22;
    this.leftArmGroup.rotation.z  =  Math.PI / 4 + 0.85;
    this.rightArmGroup.rotation.z = -(Math.PI / 4 + 0.85);
    this.group.scale.set(0.88, 1.08, 0.88);
    setTimeout(() => { this.group.scale.set(0.9, 0.9, 0.9); }, 220);
  }

  _animTapNose() {
    const orig = this.noseMesh.position.z;
    this.noseMesh.position.z += 0.09;
    this.noseMesh.material = this.noseMesh.material.clone();
    this.noseMesh.material.color.setHex(0xFF3300);
    setTimeout(() => {
      this.noseMesh.position.z = orig;
      this.noseMesh.material.color.setHex(0xFF7043);
    }, 450);
    this._animSurprised();
  }

  _resetPose() {
    this.group.rotation.set(0, 0, 0);
    this.group.position.set(0, -1.3, -3.2);
    this.group.scale.set(0.9, 0.9, 0.9);
    this.headGroup.rotation.set(0, 0, 0);
    this.torsoMesh.rotation.set(0, 0, 0);
    this.leftArmGroup.rotation.set(0, 0,  Math.PI / 4);
    this.rightArmGroup.rotation.set(0, 0, -Math.PI / 4);
  }
}
