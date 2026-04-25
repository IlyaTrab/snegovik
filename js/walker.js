/**
 * walker.js  —  Autonomous wandering + tap-to-walk/run state machine
 *
 * States: idle | wandering | walking | running
 * The character wanders automatically; tap on floor → walk/run there.
 */

import * as THREE from 'three';

// World-space movement bounds — full visible area at typical snowman depth
const BOUNDS = {
  x: [-2.2, 2.2],
  y: [-2.2, 2.0],  // full vertical screen range
  z: [-8.0, -3.5],
};

// Camera half-FOV tangent (65° FOV)
const HALF_FOV_TAN = Math.tan(32.5 * Math.PI / 180);

// How fast the character turns (rad/sec, scales with distance)
const BASE_TURN_SPEED = 6;

export class Walker {
  constructor(characterGroup, character) {
    this._group = characterGroup;
    this._char  = character;

    this.state   = 'idle';     // idle | wandering | walking | running
    this._target = null;       // THREE.Vector3
    this._speed  = 0;          // current movement speed (units/sec)

    // Wander settings
    this._wanderTimer    = 0;
    this._wanderCooldown = 1.5 + Math.random() * 2;

    // Speed constants
    this.WALK_SPEED = 0.85;
    this.RUN_SPEED  = 2.4;

    // Callback when arriving at player-issued target
    this.onArrived = null;

    // Smoothed speed for physics
    this._smoothSpeed = 0;
  }

  get isMoving()     { return this.state === 'walking' || this.state === 'running'; }
  get currentSpeed() { return this._speed; }
  get smoothSpeed()  { return this._smoothSpeed; }
  get bounds()       { return { ...BOUNDS }; }

  // ── Public API ─────────────────────────────────────────────
  walkTo(target, run = false) {
    this._target = this._clamp(target);
    this._speed  = run ? this.RUN_SPEED : this.WALK_SPEED;
    this.state   = run ? 'running' : 'walking';
    this._char?.playGeneric(run ? 'run' : 'walk', { fade: 0.22 });
  }

  // Map normalised screen coords (NDC) to world position at snowman's depth
  screenToWorld(nx, ny) {
    const z      = this._group.position.z;
    const aspect = window.innerWidth / window.innerHeight;
    const worldX = THREE.MathUtils.clamp(nx * (-z) * HALF_FOV_TAN * aspect, BOUNDS.x[0], BOUNDS.x[1]);
    const worldY = THREE.MathUtils.clamp(ny * (-z) * HALF_FOV_TAN,          BOUNDS.y[0], BOUNDS.y[1]);
    return new THREE.Vector3(worldX, worldY, z);
  }

  stopAndIdle() {
    this.state = 'idle';
    this._speed = 0;
    if (this._char) {
      this._char.baseY = this._group.position.y;
      this._char.playGeneric('idle', { fade: 0.3 });
    }
  }

  // Make snowman do a circle dance
  circleMove(steps = 5, radius = 0.55) {
    const center = this._group.position.clone();
    let step = 0;
    const doStep = () => {
      if (step >= steps) { this.stopAndIdle(); return; }
      const angle = (step / steps) * Math.PI * 2;
      const tgt = new THREE.Vector3(
        center.x + Math.cos(angle) * radius,
        center.y,
        center.z + Math.sin(angle) * radius * 0.3
      );
      this.walkTo(tgt, false);
      this.onArrived = () => { step++; doStep(); };
    };
    doStep();
  }

  // ── Update (call every frame) ──────────────────────────────
  update(dt) {
    if (this.isMoving) {
      const arrived = this._step(dt);
      if (arrived) this._arrive();
    } else {
      this._wanderTimer += dt;
      if (this._wanderTimer >= this._wanderCooldown) {
        this._wanderTimer    = 0;
        this._wanderCooldown = 2 + Math.random() * 4.5;
        this._wander();
      }
    }

    // Smooth speed for animation lean
    this._smoothSpeed += (this._speed - this._smoothSpeed) * Math.min(1, dt * 8);
  }

  // ── Internal step ──────────────────────────────────────────
  _step(dt) {
    const pos = this._group.position;
    const dx  = this._target.x - pos.x;
    const dy  = this._target.y - pos.y;
    const dz  = this._target.z - pos.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist < 0.07) return true; // arrived

    // Turn toward target (XZ plane only)
    const targetAngle = Math.atan2(dx, -dz || 0.001);
    let diff = targetAngle - this._group.rotation.y;
    while (diff >  Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turnRate = BASE_TURN_SPEED + Math.min(6, dist * 4);
    this._group.rotation.y += diff * Math.min(1, turnRate * dt);

    // Ease speed near arrival
    const speed = Math.min(this._speed, dist / 0.25 * this._speed);
    pos.x += (dx / dist) * speed * dt;
    pos.y += (dy / dist) * speed * dt;
    pos.z += (dz / dist) * speed * dt;

    // Clamp to bounds
    pos.x = Math.max(BOUNDS.x[0], Math.min(BOUNDS.x[1], pos.x));
    pos.y = Math.max(BOUNDS.y[0], Math.min(BOUNDS.y[1], pos.y));
    pos.z = Math.max(BOUNDS.z[0], Math.min(BOUNDS.z[1], pos.z));

    // Keep character animation base in sync with walker Y
    if (this._char) this._char.baseY = pos.y;

    return false;
  }

  _arrive() {
    this.state  = 'idle';
    this._speed = 0;
    if (this._char) {
      this._char.baseY = this._group.position.y;
      this._char.playGeneric('idle', { fade: 0.3 });
    }
    const cb = this.onArrived;
    this.onArrived = null;
    if (cb) cb();
  }

  _wander() {
    const t = new THREE.Vector3(
      BOUNDS.x[0] + Math.random() * (BOUNDS.x[1] - BOUNDS.x[0]),
      BOUNDS.y[0] + Math.random() * (BOUNDS.y[1] - BOUNDS.y[0]),
      this._group.position.z  // keep depth fixed
    );
    const shouldRun = Math.random() < 0.2;
    this._target = t;
    this._speed  = shouldRun ? this.RUN_SPEED : this.WALK_SPEED;
    this.state   = shouldRun ? 'running' : 'wandering';
    this._char?.playGeneric(shouldRun ? 'run' : 'walk', { fade: 0.3 });
  }

  _clamp(v) {
    return new THREE.Vector3(
      Math.max(BOUNDS.x[0], Math.min(BOUNDS.x[1], v.x)),
      Math.max(BOUNDS.y[0], Math.min(BOUNDS.y[1], v.y)),
      this._group.position.z  // keep depth fixed
    );
  }
}
