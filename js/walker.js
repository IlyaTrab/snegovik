/**
 * walker.js  —  Autonomous wandering + tap-to-walk/run state machine
 *
 * States: idle | wandering | walking | running
 * The character wanders automatically; tap on floor → walk/run there.
 */

import * as THREE from 'three';

// World-space movement bounds (must stay on-screen)
const BOUNDS = {
  x: [-2.25, 2.25],
  z: [-6.1, -1.55],
};

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

  screenToWorld(nx, ny) {
    const x = THREE.MathUtils.mapLinear(nx, -1, 1, BOUNDS.x[0], BOUNDS.x[1]);
    const depthLerp = THREE.MathUtils.clamp((1 - ny) * 0.5, 0, 1);
    const z = THREE.MathUtils.lerp(BOUNDS.z[0], BOUNDS.z[1], depthLerp);
    return new THREE.Vector3(x, this._group.position.y, z);
  }

  stopAndIdle() {
    this.state = 'idle';
    this._speed = 0;
    this._char?.playGeneric('idle', { fade: 0.3 });
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
    const dz  = this._target.z - pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 0.07) return true; // arrived

    // Turn toward target — faster turn when farther away
    const targetAngle = Math.atan2(dx, -dz);
    let diff = targetAngle - this._group.rotation.y;
    while (diff >  Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turnRate = BASE_TURN_SPEED + Math.min(6, dist * 4);
    this._group.rotation.y += diff * Math.min(1, turnRate * dt);

    // Ease speed near arrival
    const speed = Math.min(this._speed, dist / 0.25 * this._speed);
    pos.x += (dx / dist) * speed * dt;
    pos.z += (dz / dist) * speed * dt;

    // Clamp to bounds
    pos.x = Math.max(BOUNDS.x[0], Math.min(BOUNDS.x[1], pos.x));
    pos.z = Math.max(BOUNDS.z[0], Math.min(BOUNDS.z[1], pos.z));

    return false;
  }

  _arrive() {
    this.state  = 'idle';
    this._speed = 0;
    this._char?.playGeneric('idle', { fade: 0.3 });
    const cb = this.onArrived;
    this.onArrived = null;
    if (cb) cb();
  }

  _wander() {
    const [xMin, xMax] = BOUNDS.x;
    const [zMin, zMax] = BOUNDS.z;
    const t = new THREE.Vector3(
      xMin + Math.random() * (xMax - xMin),
      this._group.position.y,
      zMin + Math.random() * (zMax - zMin)
    );
    // Occasionally run instead of walk
    const shouldRun = Math.random() < 0.2;
    this._target = t;
    this._speed  = shouldRun ? this.RUN_SPEED : this.WALK_SPEED;
    this.state   = shouldRun ? 'running' : 'wandering';
    this._char?.playGeneric(shouldRun ? 'run' : 'walk', { fade: 0.3 });
  }

  _clamp(v) {
    return new THREE.Vector3(
      Math.max(BOUNDS.x[0], Math.min(BOUNDS.x[1], v.x)),
      this._group.position.y,
      Math.max(BOUNDS.z[0], Math.min(BOUNDS.z[1], v.z))
    );
  }
}
