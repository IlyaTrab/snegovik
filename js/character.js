/**
 * character.js  - GLTF character loader with adaptive placement and animation mapping
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const MODEL_URL = new URL('../assets/models/snowman.glb', import.meta.url).href;

const TARGET_HEIGHT = 0.78;
const GENERIC_KEYS = ['idle', 'walk', 'run', 'dance', 'wave', 'sing', 'happy', 'surprised'];
const ACTION_META = {
  dance: { label: 'Танцуй!', emoji: '💃' },
  sing:  { label: 'Пой!', emoji: '🎵' },
  wave:  { label: 'Помаши!', emoji: '👋' },
};

const ANIM_MAP = {
  idle:      ['Idle', 'idle', 'Standing', 'IDLE', 'Armature|Idle'],
  walk:      ['Walk', 'Walking', 'walk', 'WALK'],
  run:       ['Run', 'Running', 'run', 'RUN', 'WalkJump'],
  dance:     ['Dance', 'dance', 'DANCE', 'Dive'],
  wave:      ['Wave', 'wave', 'WAVE', 'Hello'],
  happy:     ['Jump', 'Yes', 'ThumbsUp', 'Happy', 'happy'],
  surprised: ['No', 'Punch', 'Surprised', 'surprised', 'React'],
  sing:      ['Sing', 'sing', 'Song', 'Vocal'],
  thumbsup:  ['ThumbsUp', 'Yes', 'Idle'],
  sit:       ['Sitting', 'Sit', 'Idle'],
};

const ANIM_KEYWORDS = {
  idle:      ['idle', 'breath', 'breathe', 'stand', 'standing', 'loop'],
  walk:      ['walk', 'walking', 'stroll', 'locomotion'],
  run:       ['run', 'running', 'jog', 'sprint'],
  dance:     ['dance', 'dancing', 'groove', 'celebrate', 'celebration'],
  wave:      ['wave', 'hello', 'hi', 'greet'],
  sing:      ['sing', 'song', 'vocal', 'karaoke', 'microphone'],
  happy:     ['happy', 'joy', 'cheer', 'jump', 'victory', 'thumbsup'],
  surprised: ['surprise', 'surprised', 'shock', 'panic', 'react', 'no'],
};

function normalizeClipName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[_|]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function prettyClipName(name) {
  return String(name || '')
    .replace(/[_|]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

class Spring {
  constructor(k = 200, c = 16) {
    this.k = k;
    this.c = c;
    this.x = 0;
    this.v = 0;
  }

  update(dt) {
    const d = Math.min(dt, 0.05);
    this.v += (-this.k * this.x - this.c * this.v) * d;
    this.x += this.v * d;
    return this.x;
  }

  impulse(a) {
    this.v += a;
  }

  reset() {
    this.x = 0;
    this.v = 0;
  }
}

export class Character {
  constructor() {
    this.group = new THREE.Group();
    this.model = null;
    this._mixer = null;
    this._acts = {};
    this._cur = null;
    this._oneShotHandler = null;
    this._genericMap = {};
    this._actionBindings = this._buildEmptyActionBindings();
    this._modelSize = new THREE.Vector3(TARGET_HEIGHT, TARGET_HEIGHT, TARGET_HEIGHT * 0.5);

    this.loaded = false;
    this.baseY = 0;
    this.onStatusChange = null;
    this.onActionBindingsChange = null;

    this._sp = {
      lean: new Spring(140, 12),
      wobbleX: new Spring(200, 14),
      wobbleZ: new Spring(200, 14),
      bounceY: new Spring(280, 18),
    };

    this._clock = 0;
    this._footPh = 0;
  }

  async load(scene, url = MODEL_URL) {
    const loader = new GLTFLoader();
    let gltf;

    try {
      gltf = await new Promise((resolve, reject) => {
        loader.load(url, resolve, undefined, reject);
      });
    } catch (loadError) {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        throw loadError;
      }

      const arrayBuffer = await response.arrayBuffer();
      const baseUrl = new URL('./', url).href;
      gltf = await new Promise((resolve, reject) => {
        loader.parse(arrayBuffer, baseUrl, resolve, reject);
      });
    }

    this._acts = {};
    this._cur = null;
    this._oneShotHandler = null;
    this._genericMap = {};
    this._actionBindings = this._buildEmptyActionBindings();

    this.model = gltf.scene;
    this.model.traverse(child => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
      if (child.material) {
        child.material.envMapIntensity = 0.9;
        if (child.material.map) child.material.map.anisotropy = 4;
      }
    });

    const box = new THREE.Box3().setFromObject(this.model);
    const height = Math.max(box.max.y - box.min.y, 0.001);
    const scale = TARGET_HEIGHT / height;
    this.model.scale.setScalar(scale);

    const scaledBox = new THREE.Box3().setFromObject(this.model);
    const center = scaledBox.getCenter(new THREE.Vector3());
    this.model.position.set(-center.x, -scaledBox.min.y, -center.z);

    const fittedBox = new THREE.Box3().setFromObject(this.model);
    fittedBox.getSize(this._modelSize);

    this.group.add(this.model);
    scene.add(this.group);

    this._setupAnimations(gltf.animations || []);
    this.loaded = true;
    console.log('[Character] loaded. Clips:', Object.keys(this._acts).join(', '));
    return this;
  }

  _setupAnimations(clips) {
    if (!clips.length) {
      this._notifyActionBindings();
      this._notifyAnimationStatus();
      return;
    }

    this._mixer = new THREE.AnimationMixer(this.model);
    clips.forEach(clip => {
      this._acts[clip.name] = this._mixer.clipAction(clip);
    });

    this._genericMap = this._buildGenericMap(Object.keys(this._acts));
    this._actionBindings = this._buildActionBindings();
    this._notifyActionBindings();
    const startedIdle = this.playGeneric('idle', { fade: 0, fallbackToAny: false });
    if (!startedIdle) this._stopCurrent();
  }

  _buildGenericMap(clipNames) {
    const genericMap = {};
    const normalized = clipNames.map(name => ({ name, norm: normalizeClipName(name) }));

    for (const generic of GENERIC_KEYS) {
      let bestName = null;
      let bestScore = 0;

      for (const clip of normalized) {
        const score = this._scoreClip(clip.norm, generic);
        if (score > bestScore) {
          bestScore = score;
          bestName = clip.name;
        }
      }

      if (bestName && bestScore > 0) genericMap[generic] = bestName;
    }

    return genericMap;
  }

  _scoreClip(normalizedName, generic) {
    if (!normalizedName) return 0;

    let score = 0;
    const aliases = (ANIM_MAP[generic] || []).map(normalizeClipName).filter(Boolean);
    const keywords = (ANIM_KEYWORDS[generic] || []).map(normalizeClipName).filter(Boolean);
    const words = normalizedName.split(' ');

    if (aliases.includes(normalizedName)) score += 320;
    for (const alias of aliases) {
      if (alias && normalizedName.includes(alias)) score += 160;
    }

    for (const keyword of keywords) {
      if (words.includes(keyword)) score += 120;
      else if (normalizedName.includes(keyword)) score += 70;
    }

    return score;
  }

  _buildEmptyActionBindings() {
    return Object.fromEntries(
      Object.entries(ACTION_META).map(([action, meta]) => [
        action,
        { action, ...meta, clipName: null, displayClip: 'нет анимации', enabled: false },
      ]),
    );
  }

  _buildActionBindings() {
    const bindings = {};
    const used = new Set();
    const reserved = new Set([this._genericMap.idle, this._genericMap.walk, this._genericMap.run].filter(Boolean));
    const clipNames = Object.keys(this._acts);

    for (const [action, meta] of Object.entries(ACTION_META)) {
      let clipName = this._genericMap[action] || null;
      if (clipName && used.has(clipName)) clipName = null;

      if (!clipName) {
        clipName =
          clipNames.find(name => !used.has(name) && !reserved.has(name)) ||
          clipNames.find(name => !used.has(name)) ||
          null;
      }

      bindings[action] = {
        action,
        ...meta,
        clipName,
        displayClip: clipName ? prettyClipName(clipName) : 'нет анимации',
        enabled: !!clipName,
      };

      if (clipName) used.add(clipName);
    }

    return bindings;
  }

  _resolve(generic, { fallbackToAny = false } = {}) {
    if (this._genericMap[generic]) return this._genericMap[generic];

    const candidates = ANIM_MAP[generic] || [generic];
    const resolved = candidates.find(name => this._acts[name]) || (this._acts[generic] ? generic : null);
    return resolved ?? (fallbackToAny ? Object.keys(this._acts)[0] ?? null : null);
  }

  _notifyAnimationStatus() {
    this.onStatusChange?.(this.getAnimationStatus());
  }

  _notifyActionBindings() {
    this.onActionBindingsChange?.(this.getActionBindings());
  }

  _stopCurrent() {
    if (!this._cur || !this._acts[this._cur]) return;
    this._acts[this._cur].stop();
    this._cur = null;
    this._notifyAnimationStatus();
  }

  play(clipName, { fade = 0.3, loop = true, force = false } = {}) {
    if (!this._acts[clipName]) return false;
    if (this._cur === clipName && !force) return true;

    const prev = this._cur ? this._acts[this._cur] : null;
    const next = this._acts[clipName];

    if (prev === next && force) {
      prev.stop();
      this._cur = null;
    }

    next.reset();
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    next.clampWhenFinished = !loop;
    next.enabled = true;
    next.setEffectiveWeight(1);

    if (prev && prev !== next && fade > 0) next.crossFadeFrom(prev, fade, true);
    else if (prev && prev !== next) prev.stop();

    next.play();
    this._cur = clipName;
    this._notifyAnimationStatus();
    return true;
  }

  playGeneric(name, opts = {}) {
    const fallbackToAny = opts.fallbackToAny ?? !['idle', 'walk', 'run'].includes(name);
    const clipName = this._resolve(name, { fallbackToAny });
    if (!clipName) {
      if (name === 'idle') this._stopCurrent();
      return false;
    }
    return this.play(clipName, opts);
  }

  playOnce(name, returnTo = 'idle', fade = 0.28) {
    const resolved = this._resolve(name, { fallbackToAny: true });
    const returnRes = this._resolve(returnTo, { fallbackToAny: false });
    if (!resolved || !this._acts[resolved]) {
      this.playGeneric(returnTo, { fade: 0.3, fallbackToAny: false });
      return false;
    }

    if (this._oneShotHandler && this._mixer) {
      this._mixer.removeEventListener('finished', this._oneShotHandler);
      this._oneShotHandler = null;
    }

    this.play(resolved, { fade, loop: false, force: true });

    const handler = (e) => {
      if (e.action !== this._acts[resolved]) return;

      this._mixer.removeEventListener('finished', handler);
      this._oneShotHandler = null;
      this._cur = null;

      if (returnRes) {
        this.play(returnRes, { fade: 0.3 });
      } else {
        this._acts[resolved].stop();
        this._notifyAnimationStatus();
      }
    };

    this._oneShotHandler = handler;
    this._mixer.addEventListener('finished', handler);
    return true;
  }

  playAction(action, returnTo = 'idle', fade = 0.28) {
    const binding = this._actionBindings[action];
    if (!binding?.clipName) return false;
    return this.playOnce(binding.clipName, returnTo, fade);
  }

  tap() {
    const sign = Math.random() > 0.5 ? 1 : -1;
    this._sp.wobbleZ.impulse(0.5 * sign);
    this._sp.wobbleX.impulse(-0.25);
    this._sp.bounceY.impulse(0.3);
  }

  update(dt, isWalking = false, moveSpeed = 0) {
    if (!this.loaded) return;
    this._clock += dt;
    const t = this._clock;

    if (this._mixer) this._mixer.update(dt);

    const lean = this._sp.lean.update(dt);
    const wx = this._sp.wobbleX.update(dt);
    const wz = this._sp.wobbleZ.update(dt);
    const bounceY = this._sp.bounceY.update(dt);

    const leanTarget = isWalking ? 0.14 * Math.min(1, moveSpeed) : 0;
    this._sp.lean.x += (leanTarget - lean) * dt * 5;

    if (isWalking) {
      this._footPh += dt * 7 * Math.min(1, moveSpeed);
      const footBounce = Math.abs(Math.sin(this._footPh)) * 0.02 * Math.min(1, moveSpeed);
      this.group.position.y = this.baseY + footBounce;
    } else {
      this.group.position.y = this.baseY + bounceY * 0.08 + Math.sin(t * 1.08) * 0.012;
    }

    this.group.rotation.x = lean * 0.18 + wx;
    this.group.rotation.z = wz;
  }

  getMeshes() {
    const out = [];
    this.group.traverse(child => {
      if (child.isMesh) out.push(child);
    });
    return out;
  }

  getRecommendedPlacement(camera, floorY = -1.2) {
    const visibleRatio = camera.aspect < 0.72 ? 0.20 : 0.23;
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const height = this._modelSize.y || TARGET_HEIGHT;
    const depth = Math.max(this._modelSize.z || 0.5, 0.4);
    const distance = (height / (2 * Math.tan(fov / 2) * visibleRatio)) + depth * 0.6;

    return {
      x: 0,
      y: floorY,
      z: -THREE.MathUtils.clamp(distance, 4.1, 6.2),
    };
  }

  getActionBindings() {
    return this._actionBindings;
  }

  getActionAvailability() {
    return Object.fromEntries(
      Object.entries(this._actionBindings).map(([action, binding]) => [action, !!binding.enabled]),
    );
  }

  getAnimationStatus() {
    const clipNames = Object.keys(this._acts);
    return {
      current: this._cur,
      currentLabel: this._cur ? prettyClipName(this._cur) : 'ожидание',
      clips: clipNames.map(prettyClipName),
      clipCount: clipNames.length,
    };
  }
}
