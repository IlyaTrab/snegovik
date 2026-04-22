import * as THREE          from 'three';
import { StateMachine, GameState } from './state.js';
import { CameraManager }           from './camera.js';
import { Snowman }                 from './snowman.js';
import { QuestManager }            from './quests.js';
import { UIManager }               from './ui.js';
import { AudioManager }            from './audio.js';

class SnowmanApp {
  constructor() {
    this.sm        = new StateMachine();
    this.ui        = new UIManager();
    this.cam       = new CameraManager();
    this.audio     = new AudioManager();
    this.questMgr  = null;
    this.snowman   = null;
    this.renderer  = null;
    this.scene     = null;
    this.camera3d  = null;
    this.raycaster = new THREE.Raycaster();
    this.pointer   = new THREE.Vector2();
    this._clock    = new THREE.Clock();
    this._sfMesh   = null;

    this._bindStates();
    this._bindDOM();
    this.sm.transition(GameState.START);
  }

  // ── State handlers ──────────────────────────────────────
  _bindStates() {
    this.sm
      .on(GameState.START, () => {
        document.getElementById('loading').style.display = 'none';
        this.ui.showScreen('screen-start');
      })
      .on(GameState.CAMERA_PROMPT, () => {
        this.ui.showScreen('screen-camera');
      })
      .on(GameState.AR_INIT, () => this._initAR())
      .on(GameState.AR_ACTIVE, () => {
        this.ui.showScreen('screen-ar');
        this._greetAndStartQuests();
      })
      .on(GameState.ALL_QUESTS_DONE, ({ score }) => {
        this.ui.showFinalReward(score);
        this.audio.playReward();
        this.ui.spawnCelebration(30);
        if (this.snowman) this.snowman.playAnimation('happy', 8000);
      })
      .on(GameState.ERROR, ({ title, msg }) => this.ui.showError(title, msg))
      .on(GameState.FALLBACK, () => this.ui.showScreen('screen-fallback'));
  }

  // ── DOM event bindings ──────────────────────────────────
  _bindDOM() {
    document.getElementById('btn-start').addEventListener('click', () => {
      this.audio.init();
      this.audio.resume();
      if (this.cam.isSupported()) {
        this.sm.transition(GameState.CAMERA_PROMPT);
      } else {
        this.sm.transition(GameState.FALLBACK);
      }
    });

    document.getElementById('btn-allow-camera').addEventListener('click', () => {
      this.sm.transition(GameState.AR_INIT);
    });

    document.getElementById('btn-next-quest').addEventListener('click', () => {
      this.ui.hideOverlay('screen-quest-complete');
      this._nextQuest();
    });

    document.getElementById('btn-restart').addEventListener('click', () => {
      location.reload();
    });

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

    // Canvas tap / touch
    const canvas = document.getElementById('ar-canvas');
    canvas.style.pointerEvents = 'all';
    canvas.addEventListener('click',    e => this._onTap(e.clientX, e.clientY));
    canvas.addEventListener('touchend', e => {
      e.preventDefault();
      const t = e.changedTouches[0];
      this._onTap(t.clientX, t.clientY);
    }, { passive: false });

    // Orientation for subtle 3D feel
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', e => {
        if (this.snowman) {
          this.snowman.group.rotation.y = ((e.gamma || 0) * Math.PI / 180) * 0.25;
        }
      }, { passive: true });
    }
  }

  // ── AR initialisation ───────────────────────────────────
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

  // ── Three.js setup ──────────────────────────────────────
  _initThree() {
    const canvas = document.getElementById('ar-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000, 0);

    this.scene    = new THREE.Scene();
    this.camera3d = new THREE.PerspectiveCamera(
      60, window.innerWidth / window.innerHeight, 0.1, 100
    );

    // Lights
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const sun = new THREE.DirectionalLight(0xfff5d6, 1.3);
    sun.position.set(3, 6, 4);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xb8d4ff, 0.4);
    fill.position.set(-3, 2, -2);
    this.scene.add(fill);

    window.addEventListener('resize', () => {
      this.camera3d.aspect = window.innerWidth / window.innerHeight;
      this.camera3d.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  _buildScene() {
    this.snowman = new Snowman(this.scene);

    // Floating snowflake particles
    const count = 100;
    const geo   = new THREE.BufferGeometry();
    const pos   = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 9;
      pos[i * 3 + 1] = Math.random() * 7 - 1;
      pos[i * 3 + 2] = -1.5 - Math.random() * 6;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const sfMat  = new THREE.PointsMaterial({ color: 0xffffff, size: 0.055, transparent: true, opacity: 0.75 });
    this._sfMesh = new THREE.Points(geo, sfMat);
    this.scene.add(this._sfMesh);
  }

  _startRenderLoop() {
    const animate = () => {
      requestAnimationFrame(animate);
      if (this.snowman) this.snowman.update();
      this._tickSnowflakes();
      this.renderer.render(this.scene, this.camera3d);
    };
    animate();

    // Periodic UI snowflakes
    setInterval(() => {
      if (this.sm.isAny(GameState.AR_ACTIVE, GameState.QUEST_ACTIVE)) {
        this.ui.spawnSnowflake();
      }
    }, 1600);
  }

  _tickSnowflakes() {
    if (!this._sfMesh) return;
    const pos = this._sfMesh.geometry.attributes.position.array;
    for (let i = 1; i < pos.length; i += 3) {
      pos[i] -= 0.004;
      if (pos[i] < -2) pos[i] = 6;
    }
    this._sfMesh.geometry.attributes.position.needsUpdate = true;
  }

  // ── Tap handling ─────────────────────────────────────────
  _onTap(cx, cy) {
    if (!this.snowman) return;
    if (!this.sm.isAny(GameState.AR_ACTIVE, GameState.QUEST_ACTIVE)) return;

    this.audio.resume();
    this.audio.playTap();
    this.ui.spawnTapRipple(cx, cy);

    this.pointer.x = (cx / window.innerWidth)  *  2 - 1;
    this.pointer.y = (cy / window.innerHeight)  * -2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera3d);

    const hits = this.raycaster.intersectObjects(this.snowman.getMeshes());
    if (!hits.length) return;

    const isNose = hits[0].object === this.snowman.noseMesh;
    this._handleTrigger(isNose ? 'tap_nose' : 'tap_body');
  }

  // ── Action buttons ───────────────────────────────────────
  _handleAction(action) {
    const animMap = { dance: 'dance', sing: 'sing', wave: 'wave' };
    this.snowman.playAnimation(animMap[action] || 'happy', 3500);
    this.ui.showSpeech(this.audio.getLine(action));
    this.audio.playSuccess();
    this._handleTrigger('action_' + action);
  }

  // ── Trigger checking ─────────────────────────────────────
  _handleTrigger(trigger) {
    const completed = this.questMgr?.checkTrigger(trigger);

    if (completed) {
      this.snowman.playAnimation(completed.animation, 3500);
      this.ui.showSpeech(this.audio.getLine(completed.speechKey));
      this.ui.updateScore(this.questMgr.totalScore);
      this.audio.playSuccess();
      this.ui.hideQuestPanel();
      setTimeout(() => this.ui.showQuestComplete(completed), 900);
    } else {
      // Generic reaction (not the quest trigger)
      if (trigger === 'tap_nose') {
        this.snowman.playAnimation('tapNose', 1500);
        this.ui.showSpeech(this.audio.getLine('nose'));
      } else if (trigger === 'tap_body') {
        this.snowman.playAnimation('surprised', 1500);
        this.ui.showSpeech(this.audio.getLine('tap'));
      }
    }
  }

  // ── Quest flow ───────────────────────────────────────────
  _greetAndStartQuests() {
    this.snowman.playAnimation('happy', 2200);
    this.ui.showSpeech(this.audio.getLine('greet'), 2800);
    setTimeout(() => this._nextQuest(), 2600);
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

// Boot when DOM ready
document.addEventListener('DOMContentLoaded', () => new SnowmanApp());
