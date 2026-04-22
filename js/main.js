import * as THREE                  from 'three';
import { StateMachine, GameState }  from './state.js';
import { CameraManager }            from './camera.js';
import { Snowman }                  from './snowman.js';
import { SnowParticles }            from './particles.js';
import { QuestManager }             from './quests.js';
import { UIManager }                from './ui.js';
import { AudioManager }             from './audio.js';

class SnowmanApp {
  constructor() {
    this.sm       = new StateMachine();
    this.ui       = new UIManager();
    this.cam      = new CameraManager();
    this.audio    = new AudioManager();
    this.questMgr = null;
    this.snowman  = null;
    this.particles = null;
    this.renderer  = null;
    this.scene     = null;
    this.cam3d     = null;
    this._rc       = new THREE.Raycaster();
    this._ptr      = new THREE.Vector2();
    this._clock    = new THREE.Clock();
    this._sfGeo    = null;

    // Hold-press detection
    this._holdTimer = null;

    this._bindStates();
    this._bindDOM();
    this.sm.transition(GameState.START);
  }

  // ── State machine ──────────────────────────────────────────
  _bindStates() {
    this.sm
      .on(GameState.START, () => {
        document.getElementById('loading').style.display = 'none';
        this.ui.showScreen('screen-start');
      })
      .on(GameState.CAMERA_PROMPT, () => this.ui.showScreen('screen-camera'))
      .on(GameState.AR_INIT,       () => this._initAR())
      .on(GameState.AR_ACTIVE,     () => {
        this.ui.showScreen('screen-ar');
        this._greetAndStart();
      })
      .on(GameState.ALL_QUESTS_DONE, ({ score }) => {
        this.ui.showFinalReward(score);
        this.audio.playReward();
        this.ui.spawnCelebration(35);
        if (this.snowman) this.snowman.playAnimation('happy', 9000);
        // Big star burst in 3D
        if (this.particles && this.snowman) {
          this.particles.starBurst(this.snowman.group.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
        }
      })
      .on(GameState.ERROR,    ({ title, msg }) => this.ui.showError(title, msg))
      .on(GameState.FALLBACK, ()               => this.ui.showScreen('screen-fallback'));
  }

  // ── DOM bindings ───────────────────────────────────────────
  _bindDOM() {
    document.getElementById('btn-start').addEventListener('click', () => {
      this.audio.init();
      this.audio.resume();
      this.sm.transition(this.cam.isSupported() ? GameState.CAMERA_PROMPT : GameState.FALLBACK);
    });

    document.getElementById('btn-allow-camera').addEventListener('click', () => {
      this.sm.transition(GameState.AR_INIT);
    });

    document.getElementById('btn-next-quest').addEventListener('click', () => {
      this.ui.hideOverlay('screen-quest-complete');
      this._nextQuest();
    });

    document.getElementById('btn-restart').addEventListener('click', () => location.reload());

    document.getElementById('btn-retry').addEventListener('click', () => {
      this.sm.transition(GameState.CAMERA_PROMPT);
    });

    document.getElementById('btn-fallback-from-error').addEventListener('click', () => {
      this.sm.transition(GameState.AR_INIT);
    });

    document.getElementById('btn-fallback-play').addEventListener('click', () => {
      this.sm.transition(GameState.AR_INIT);
    });

    document.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        if (!this.sm.isAny(GameState.AR_ACTIVE, GameState.QUEST_ACTIVE)) return;
        this.audio.resume();
        this._handleAction(e.currentTarget.dataset.action);
      });
    });

    // Canvas tap + hold
    const canvas = document.getElementById('ar-canvas');
    canvas.style.pointerEvents = 'all';

    const onTapStart = (cx, cy) => {
      clearTimeout(this._holdTimer);
      this._holdTimer = setTimeout(() => {
        if (this.snowman && this.sm.isAny(GameState.AR_ACTIVE, GameState.QUEST_ACTIVE)) {
          this.snowman.playAnimation('dance', 2200);
          this.ui.showSpeech(this.audio.getLine('dance'));
          this.audio.playSuccess();
          this.audio.resume();
        }
      }, 1100);
    };

    const onTapEnd = (cx, cy) => {
      clearTimeout(this._holdTimer);
      this._onTap(cx, cy);
    };

    canvas.addEventListener('click',      e => onTapEnd(e.clientX, e.clientY));
    canvas.addEventListener('touchstart', e => {
      const t = e.touches[0];
      onTapStart(t.clientX, t.clientY);
    }, { passive: true });
    canvas.addEventListener('touchend', e => {
      e.preventDefault();
      const t = e.changedTouches[0];
      onTapEnd(t.clientX, t.clientY);
    }, { passive: false });
    canvas.addEventListener('touchcancel', () => clearTimeout(this._holdTimer), { passive: true });

    // Device orientation — subtle AR feel
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', e => {
        if (!this.snowman) return;
        this.snowman.group.rotation.y = (e.gamma || 0) * Math.PI / 180 * 0.22;
      }, { passive: true });
    }
  }

  // ── AR init ────────────────────────────────────────────────
  async _initAR() {
    const loading = document.getElementById('loading');
    loading.style.display = 'flex';

    try {
      await this.cam.requestCamera();
    } catch (err) {
      loading.style.display = 'none';
      if (err.name === 'NotAllowedError') {
        this.sm.transition(GameState.ERROR, {
          title: 'Нет доступа к камере',
          msg: 'Разреши камеру в настройках браузера и нажми «Попробовать снова».',
        });
      } else {
        this.sm.transition(GameState.FALLBACK);
      }
      return;
    }

    this._initThree();
    this._buildScene();
    this._startRenderLoop();

    this.questMgr = new QuestManager(score => {
      this.sm.transition(GameState.ALL_QUESTS_DONE, { score });
    });

    loading.style.display = 'none';
    this.sm.transition(GameState.AR_ACTIVE);
  }

  // ── Three.js ───────────────────────────────────────────────
  _initThree() {
    const canvas   = document.getElementById('ar-canvas');
    this.renderer  = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping       = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputColorSpace  = THREE.SRGBColorSpace;

    this.scene  = new THREE.Scene();
    this.cam3d  = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 80);

    // ── Lighting rig ──────────────────────────────────────
    // Sky/ground hemisphere
    const hemi = new THREE.HemisphereLight(0xB0CCFF, 0x4466AA, 0.75);
    this.scene.add(hemi);

    // Main sun (warm golden)
    const sun = new THREE.DirectionalLight(0xFFE4B5, 1.5);
    sun.position.set(4, 8, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far  = 20;
    sun.shadow.camera.left = sun.shadow.camera.bottom = -4;
    sun.shadow.camera.right = sun.shadow.camera.top   =  4;
    sun.shadow.radius = 3;
    this.scene.add(sun);

    // Cool fill (from left)
    const fill = new THREE.DirectionalLight(0x88AAFF, 0.55);
    fill.position.set(-4, 3, -2);
    this.scene.add(fill);

    // Rim (back edge highlight — makes the snowman pop)
    const rim = new THREE.DirectionalLight(0xFFFFFF, 0.45);
    rim.position.set(0, 2, -6);
    this.scene.add(rim);

    // Bounce from snowy ground
    const bounce = new THREE.DirectionalLight(0xCCDDFF, 0.22);
    bounce.position.set(0, -4, 0);
    this.scene.add(bounce);

    window.addEventListener('resize', () => {
      this.cam3d.aspect = window.innerWidth / window.innerHeight;
      this.cam3d.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  _buildScene() {
    // Snowman
    this.snowman = new Snowman(this.scene);

    // Particle system
    this.particles = new SnowParticles(this.scene);

    // Floating 3D snowflakes
    const count = 120;
    const pos   = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 10;
      pos[i * 3 + 1] = Math.random() * 8 - 2;
      pos[i * 3 + 2] = -1 - Math.random() * 7;
    }
    const sfGeo  = new THREE.BufferGeometry();
    sfGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const sfMat  = new THREE.PointsMaterial({ color: 0xD0E8FF, size: 0.06, transparent: true, opacity: 0.8, sizeAttenuation: true });
    const sfMesh = new THREE.Points(sfGeo, sfMat);
    this.scene.add(sfMesh);
    this._sfMesh = sfMesh;
    this._sfGeo  = sfGeo;
  }

  _startRenderLoop() {
    const animate = () => {
      requestAnimationFrame(animate);
      const dt = Math.min(this._clock.getDelta(), 0.05);

      if (this.snowman)   this.snowman.update(dt);
      if (this.particles) this.particles.update(dt);
      this._animSnowflakes();

      this.renderer.render(this.scene, this.cam3d);
    };
    animate();

    setInterval(() => {
      if (this.sm.isAny(GameState.AR_ACTIVE, GameState.QUEST_ACTIVE)) {
        this.ui.spawnSnowflake();
      }
    }, 1500);
  }

  _animSnowflakes() {
    if (!this._sfGeo) return;
    const arr = this._sfGeo.attributes.position.array;
    for (let i = 1; i < arr.length; i += 3) {
      arr[i] -= 0.0038;
      if (arr[i] < -2.5) arr[i] = 6;
    }
    this._sfGeo.attributes.position.needsUpdate = true;
  }

  // ── Tap handling ───────────────────────────────────────────
  _onTap(cx, cy) {
    if (!this.snowman) return;
    if (!this.sm.isAny(GameState.AR_ACTIVE, GameState.QUEST_ACTIVE)) return;

    this.audio.resume();
    this.audio.playTap();
    this.ui.spawnTapRipple(cx, cy);

    this._ptr.x =  (cx / window.innerWidth)  * 2 - 1;
    this._ptr.y = -(cy / window.innerHeight)  * 2 + 1;
    this._rc.setFromCamera(this._ptr, this.cam3d);

    const hits = this._rc.intersectObjects(this.snowman.getMeshes());
    if (!hits.length) return;

    // Particle burst at 3D hit point
    this.particles.burst(hits[0].point, 20);

    const trigger = this.snowman.tap(hits[0].object);
    this._handleTrigger(trigger);
  }

  // ── Action buttons ─────────────────────────────────────────
  _handleAction(action) {
    const anims = { dance: 'dance', sing: 'sing', wave: 'wave' };
    this.snowman.playAnimation(anims[action] || 'happy', 3500);
    this.ui.showSpeech(this.audio.getLine(action));
    this.audio.playSuccess();

    // Particle burst above head on action
    if (this.particles && this.snowman) {
      const pos = this.snowman.group.position.clone().add(new THREE.Vector3(0, 2.2, -0.5));
      this.particles.burst(pos, 12, 0xAAFFCC);
    }

    this._handleTrigger('action_' + action);
  }

  // ── Quest trigger check ────────────────────────────────────
  _handleTrigger(trigger) {
    const done = this.questMgr?.checkTrigger(trigger);

    if (done) {
      this.snowman.playAnimation(done.animation, 3500);
      this.ui.showSpeech(this.audio.getLine(done.speechKey));
      this.ui.updateScore(this.questMgr.totalScore);
      this.audio.playSuccess();
      this.ui.hideQuestPanel();

      // Star burst on quest complete
      if (this.particles && this.snowman) {
        const pos = this.snowman.group.position.clone().add(new THREE.Vector3(0, 1.8, -0.4));
        this.particles.starBurst(pos);
      }

      setTimeout(() => this.ui.showQuestComplete(done), 900);
    } else {
      // Generic reactions (not quest trigger)
      if (trigger === 'tap_nose') {
        this.snowman.playAnimation('tapNose', 1500);
        this.ui.showSpeech(this.audio.getLine('nose'));
      } else if (trigger === 'tap_body') {
        this.snowman.playAnimation('surprised', 1500);
        this.ui.showSpeech(this.audio.getLine('tap'));
      } else if (trigger === 'tap_hat') {
        this.ui.showSpeech('Не трогай мою шляпу! 🎩');
      }
    }
  }

  // ── Quest flow ─────────────────────────────────────────────
  _greetAndStart() {
    this.snowman.playAnimation('happy', 2300);
    this.ui.showSpeech(this.audio.getLine('greet'), 2800);
    setTimeout(() => this._nextQuest(), 2700);
  }

  _nextQuest() {
    const quest = this.questMgr.startNext();
    if (!quest) return;
    this.sm.transition(GameState.QUEST_ACTIVE);
    this.ui.showQuestPanel(quest);
    this.ui.setHint(quest.hint);
    this.ui.showSpeech(this.audio.getLine('questStart'));
  }
}

document.addEventListener('DOMContentLoaded', () => new SnowmanApp());
