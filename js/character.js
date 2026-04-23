/**
 * character.js  —  GLTF character loader with AnimationMixer blending
 */

import * as THREE  from 'three';
import { GLTFLoader }  from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export const MODEL_URL = new URL('../assets/models/snowman.glb', import.meta.url).href;

// Target visual height in world units
const TARGET_HEIGHT = 1.75;

// ── Animation name resolver ───────────────────────────────────
const ANIM_MAP = {
  idle:      ['Idle', 'idle', 'Standing', 'IDLE', 'Armature|Idle'],
  walk:      ['Walk', 'Walking', 'walk', 'WALK'],
  run:       ['Run', 'Running', 'run', 'RUN', 'WalkJump'],
  dance:     ['Dance', 'dance', 'DANCE', 'Dive'],
  wave:      ['Wave', 'wave', 'WAVE', 'Dive'],
  happy:     ['Jump', 'Yes', 'ThumbsUp', 'Happy', 'happy', 'Dive'],
  surprised: ['No', 'Punch', 'Surprised', 'surprised', 'Dive'],
  sing:      ['Yes', 'sing', 'Dive'],
  thumbsup:  ['ThumbsUp', 'Yes', 'Idle'],
  sit:       ['Sitting', 'Sit', 'Idle'],
};

// ── Damped spring ─────────────────────────────────────────────
class Spring {
  constructor(k = 200, c = 16) { this.k = k; this.c = c; this.x = 0; this.v = 0; }
  update(dt) {
    const d = Math.min(dt, 0.05);
    this.v += (-this.k * this.x - this.c * this.v) * d;
    this.x += this.v * d;
    return this.x;
  }
  impulse(a) { this.v += a; }
  reset()    { this.x = 0; this.v = 0; }
}

// ══════════════════════════════════════════════════════════════
export class Character {
  constructor() {
    this.group  = new THREE.Group();
    this.model  = null;
    this._mixer = null;
    this._acts  = {};      // clipName → AnimationAction
    this._cur   = null;    // current clip name

    this.loaded = false;
    this.baseY  = 0;       // world Y of feet (set after load)

    // Springs for personality physics
    this._sp = {
      lean:    new Spring(140, 12),   // forward lean when walking
      wobbleX: new Spring(200, 14),
      wobbleZ: new Spring(200, 14),
      bounceY: new Spring(280, 18),
    };

    this._clock   = 0;
    this._footPh  = 0;     // footstep phase accumulator
  }

  // ── Load GLTF ──────────────────────────────────────────────
  async load(scene, url = MODEL_URL) {
    const loader = new GLTFLoader();

    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    loader.setDRACOLoader(draco);

    const gltf = await new Promise((res, rej) => {
      loader.load(url, res, undefined, rej);
    });

    this.model = gltf.scene;

    // Traverse: shadows + material quality
    this.model.traverse(c => {
      if (!c.isMesh) return;
      c.castShadow = c.receiveShadow = true;
      if (c.material) {
        c.material.envMapIntensity = 0.9;
        if (c.material.map) c.material.map.anisotropy = 4;
      }
    });

    // Auto-fit height and align feet to y=0
    const box    = new THREE.Box3().setFromObject(this.model);
    const height = box.max.y - box.min.y;
    const scale  = TARGET_HEIGHT / height;
    this.model.scale.setScalar(scale);

    const box2 = new THREE.Box3().setFromObject(this.model);
    this.model.position.y = -box2.min.y;   // lift so feet = y=0 in local space

    this.group.add(this.model);
    scene.add(this.group);

    this._setupAnimations(gltf.animations);
    this.loaded = true;
    console.log('[Character] loaded. Clips:', Object.keys(this._acts).join(', '));
    return this;
  }

  _setupAnimations(clips) {
    if (!clips?.length) return;
    this._mixer = new THREE.AnimationMixer(this.model);
    clips.forEach(c => { this._acts[c.name] = this._mixer.clipAction(c); });
    this.playGeneric('idle', { fade: 0, fallbackToAny: false });
  }

  // Resolve generic name to actual available clip name
  _resolve(generic, { fallbackToAny = false } = {}) {
    const candidates = ANIM_MAP[generic] || [generic];
    const resolved = candidates.find(n => this._acts[n]);
    return resolved ?? (fallbackToAny ? Object.keys(this._acts)[0] ?? null : null);
  }

  _stopCurrent() {
    if (!this._cur || !this._acts[this._cur]) return;
    this._acts[this._cur].stop();
    this._cur = null;
  }

  // ── Animation control ──────────────────────────────────────
  play(clipName, { fade = 0.3, loop = true } = {}) {
    if (!this._acts[clipName] || this._cur === clipName) return;
    const prev = this._cur ? this._acts[this._cur] : null;
    const next = this._acts[clipName];
    next.reset();
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    next.clampWhenFinished = !loop;
    next.enabled = true;
    next.setEffectiveWeight(1);
    if (prev && fade > 0) next.crossFadeFrom(prev, fade, true);
    else if (prev) prev.stop();
    next.play();
    this._cur = clipName;
  }

  playGeneric(name, opts = {}) {
    const fallbackToAny = opts.fallbackToAny ?? !['idle', 'walk', 'run'].includes(name);
    const clipName = this._resolve(name, { fallbackToAny });
    if (!clipName) {
      if (name === 'idle') this._stopCurrent();
      return;
    }
    this.play(clipName, opts);
  }

  playOnce(name, returnTo = 'idle', fade = 0.28) {
    const resolved  = this._resolve(name, { fallbackToAny: true });
    const returnRes = this._resolve(returnTo, { fallbackToAny: false });
    if (!resolved || !this._acts[resolved]) {
      this.playGeneric(returnTo, { fade: 0.3, fallbackToAny: false });
      return;
    }

    this.play(resolved, { fade, loop: false });
    this._cur = null; // allow transition in handler

    const handler = (e) => {
      if (e.action === this._acts[resolved]) {
        this._mixer.removeEventListener('finished', handler);
        this._cur = null;
        if (returnRes) {
          this.play(returnRes, { fade: 0.3 });
        } else {
          this._acts[resolved].stop();
        }
      }
    };
    this._mixer.addEventListener('finished', handler);
  }

  // ── Physics impulse (called when user taps character) ──────
  tap() {
    const sign = Math.random() > 0.5 ? 1 : -1;
    this._sp.wobbleZ.impulse(0.5 * sign);
    this._sp.wobbleX.impulse(-0.25);
    this._sp.bounceY.impulse(0.3);
  }

  // ── Frame update ───────────────────────────────────────────
  // isWalking and speed come from Walker
  update(dt, isWalking = false, moveSpeed = 0) {
    if (!this.loaded) return;
    this._clock += dt;
    const t = this._clock;

    if (this._mixer) this._mixer.update(dt);

    // Spring values
    const lean   = this._sp.lean.update(dt);
    const wx     = this._sp.wobbleX.update(dt);
    const wz     = this._sp.wobbleZ.update(dt);
    const bounceY = this._sp.bounceY.update(dt);

    // Drive lean spring toward target
    const leanTarget = isWalking ? 0.14 * Math.min(1, moveSpeed) : 0;
    this._sp.lean.x  += (leanTarget - lean) * dt * 5;

    // Footstep bounce while walking
    if (isWalking) {
      this._footPh += dt * 7 * Math.min(1, moveSpeed);
      const footBounce = Math.abs(Math.sin(this._footPh)) * 0.02 * Math.min(1, moveSpeed);
      this.group.position.y = this.baseY + footBounce;
    } else {
      // Idle breath
      this.group.position.y = this.baseY + bounceY * 0.08 + Math.sin(t * 1.08) * 0.012;
    }

    // Apply springs to rotation
    this.group.rotation.x = lean * 0.18 + wx;
    this.group.rotation.z = wz;
  }

  getMeshes() {
    const out = [];
    this.group.traverse(c => { if (c.isMesh) out.push(c); });
    return out;
  }
}
