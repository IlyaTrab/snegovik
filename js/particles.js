import * as THREE from 'three';

const POOL = 80;

export class SnowParticles {
  constructor(scene) {
    this._pool   = [];
    this._active = [];

    const geo = new THREE.SphereGeometry(0.04, 6, 6);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF,
      roughness: 0.4,
      metalness: 0,
      emissive: 0xBBDDFF,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 1,
    });

    for (let i = 0; i < POOL; i++) {
      const m = new THREE.Mesh(geo, mat.clone());
      m.visible = false;
      scene.add(m);
      this._pool.push(m);
    }
  }

  // Burst snow particles at a 3D world-space position
  burst(position, count = 18, tint = 0xCCEEFF) {
    let n = 0;
    for (const mesh of this._pool) {
      if (mesh.visible || n >= count) continue;
      n++;

      mesh.visible = true;
      mesh.position.copy(position)
        .add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.12,
          (Math.random() - 0.5) * 0.12,
          (Math.random() - 0.5) * 0.12
        ));

      const size = 0.4 + Math.random() * 0.9;
      mesh.scale.setScalar(size);
      mesh.material.emissive.setHex(tint);
      mesh.material.opacity = 1;

      const speed = 1.8 + Math.random() * 2.8;
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.random() * Math.PI;

      this._active.push({
        mesh,
        vel: new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * speed,
          Math.random() * speed + 1.2,
          Math.sin(phi) * Math.sin(theta) * speed
        ),
        life: 1,
        size,
      });
    }
  }

  // Star burst (quest complete)
  starBurst(position) {
    this.burst(position, 30, 0xFFDD44);
  }

  update(dt) {
    this._active = this._active.filter(p => {
      p.life -= dt * 1.5;
      p.vel.y -= 5.5 * dt;
      p.vel.x *= 0.97;
      p.vel.z *= 0.97;
      p.mesh.position.addScaledVector(p.vel, dt);

      const t = Math.max(0, p.life);
      p.mesh.scale.setScalar(p.size * t);
      p.mesh.material.opacity = t;

      if (p.life <= 0) { p.mesh.visible = false; return false; }
      return true;
    });
  }
}
