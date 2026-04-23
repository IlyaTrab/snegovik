/**
 * star.js  —  Collectible star for "catch the star" quest
 */

import * as THREE from 'three';

const GEO = new THREE.IcosahedronGeometry(0.14, 1);

export class Star {
  constructor(scene, nearPos) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xFFD740, roughness: 0.15, metalness: 0.7,
      emissive: 0xFFAA00, emissiveIntensity: 0.9,
    });
    this.mesh = new THREE.Mesh(GEO, mat);

    // Place beside character, slightly above head
    const angle = Math.random() * Math.PI * 2;
    const dist  = 0.75 + Math.random() * 0.5;
    this.mesh.position.set(
      nearPos.x + Math.cos(angle) * dist,
      nearPos.y + 1.0 + Math.random() * 0.5,
      nearPos.z + Math.sin(angle) * dist * 0.35
    );
    this.mesh.castShadow = true;

    // Point light for star glow
    this._light = new THREE.PointLight(0xFFAA00, 1.2, 2.5);
    this._light.position.copy(this.mesh.position);

    scene.add(this.mesh, this._light);
    this._scene   = scene;
    this._t       = 0;
    this.alive    = true;
    this.lifespan = 14; // seconds until auto-disappear
  }

  update(dt) {
    if (!this.alive) return;
    this._t += dt;

    this.mesh.rotation.y += dt * 2.8;
    this.mesh.rotation.x += dt * 1.2;
    this.mesh.position.y += Math.sin(this._t * 3.5) * 0.003;

    // Pulsing glow
    const pulse = 0.6 + Math.sin(this._t * 5) * 0.4;
    this.mesh.material.emissiveIntensity = pulse;
    this._light.intensity = pulse * 1.5;
    this._light.position.copy(this.mesh.position);

    // Expire
    if (this._t > this.lifespan) this.collect(false);
  }

  getMesh() { return this.mesh; }

  collect(withReward = true) {
    if (!this.alive) return;
    this.alive = false;
    this._scene.remove(this.mesh, this._light);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    return withReward;
  }
}
