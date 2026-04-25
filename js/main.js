import * as THREE from 'three';

import { StateMachine, GameState } from './state.js?v=20260425e';
import { CameraManager }           from './camera.js?v=20260425e';
import { Character, ProceduralCharacterAdapter, CHARACTER_CONFIGS } from './character.js?v=20260425e';
import { Walker }                  from './walker.js?v=20260425e';
import { SnowParticles }           from './particles.js?v=20260425e';
import { Star }                    from './star.js?v=20260425e';
import { QuestManager }            from './quests.js?v=20260425e';
import { UIManager }               from './ui.js?v=20260425e';
import { AudioManager }            from './audio.js?v=20260425e';

// Double-tap threshold (ms)
const DBL_TAP_MS = 380;

// ══════════════════════════════════════════════════════════════
class App {
  constructor() {
    this.sm        = new StateMachine();
    this.ui        = new UIManager();
    this.cam       = new CameraManager();
    this.audio     = new AudioManager();

    this.character = null;
    this.walker    = null;
    this.particles = null;
    this.questMgr  = null;
    this.activeStar = null;

    // Character state
    this._currentCharId  = 'snowman';
    this._isSwitching    = false;
    this._dualMode       = false;
    this._secondCharId   = null;
    this._secondCharacter = null;

    // Three.js
    this.renderer = null;
    this.scene    = null;
    this.cam3d    = null;
    this._clock   = new THREE.Clock();
    this._rc      = new THREE.Raycaster();
    this._ptr     = new THREE.Vector2();
    this._sfGeo   = null;

    // Tap state
    this._lastTapTime   = 0;
    this._tapOnChar     = false;
    this._holdTimer     = null;
    this._dblTapPending = false;

    this._bindStates();
    this._bindDOM();
    this.sm.transition(GameState.START);
  }

  // ── State handlers ──────────────────────────────────────────
  _bindStates() {
    this.sm
      .on(GameState.START, () => {
        document.getElementById('loading').style.display = 'none';
        this.ui.showScreen('screen-start');
      })
      .on(GameState.CAMERA_PROMPT, () => this.ui.showScreen('screen-camera'))
      .on(GameState.AR_INIT,       () => this._initAR())
      .on(GameState.AR_ACTIVE, () => {
        this.ui.showScreen('screen-ar');
        this._greetAndStartQuests();
      })
      .on(GameState.ERROR,    ({ title, msg }) => this.ui.showError(title, msg))
      .on(GameState.FALLBACK, ()               => this.ui.showScreen('screen-fallback'));
  }

  // ── DOM event bindings ──────────────────────────────────────
  _bindDOM() {
    const on = (id, ev, fn) => document.getElementById(id)?.addEventListener(ev, fn);

    on('btn-start', 'click', () => {
      this.audio.init();
      this.audio.resume();
      this.sm.transition(this.cam.isSupported() ? GameState.CAMERA_PROMPT : GameState.FALLBACK);
    });
    on('btn-allow-camera', 'click', () => this.sm.transition(GameState.AR_INIT));
    on('btn-next-quest',   'click', () => { this.ui.hideOverlay('screen-quest-complete'); this._nextQuest(); });
    on('btn-restart',      'click', () => location.reload());
    on('btn-retry',        'click', () => this.sm.transition(GameState.AR_INIT));
    on('btn-fallback-from-error', 'click', () => this.sm.transition(GameState.AR_INIT));
    on('btn-fallback-play',       'click', () => this.sm.transition(GameState.AR_INIT));

    // Action buttons
    document.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        if (!this.sm.isAny(GameState.AR_ACTIVE, GameState.QUEST_ACTIVE)) return;
        this.audio.resume();
        this._handleAction(e.currentTarget.dataset.action);
      });
    });

    // Character switcher buttons
    document.querySelectorAll('.char-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!this.sm.isAny(GameState.AR_ACTIVE, GameState.QUEST_ACTIVE)) return;
        this.audio.resume();
        this._switchCharacter(btn.dataset.char);
      });
    });

    // Dual mode toggle
    on('btn-dual-mode', 'click', () => {
      if (!this.sm.isAny(GameState.AR_ACTIVE, GameState.QUEST_ACTIVE)) return;
      this.audio.resume();
      this._toggleDualMode();
    });

    // Canvas — tap/hold/double-tap
    const canvas = document.getElementById('ar-canvas');
    canvas.style.pointerEvents = 'all';

    const startHold = () => {
      clearTimeout(this._holdTimer);
      this._holdTimer = setTimeout(() => this._onHoldFire(), 1100);
    };
    const endHold = (cx, cy) => {
      clearTimeout(this._holdTimer);
      this._onTap(cx, cy);
    };

    canvas.addEventListener('click',      e => endHold(e.clientX, e.clientY));
    canvas.addEventListener('touchstart', e => startHold(), { passive: true });
    canvas.addEventListener('touchend',   e => {
      e.preventDefault();
      const t = e.changedTouches[0];
      endHold(t.clientX, t.clientY);
    }, { passive: false });
    canvas.addEventListener('touchcancel', () => clearTimeout(this._holdTimer), { passive: true });

    // Device orientation
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', e => {
        if (this.character) {
          this.character.group.rotation.z = ((e.gamma || 0) * Math.PI / 180) * 0.04;
        }
      }, { passive: true });
    }
  }

  // ── AR initialisation ───────────────────────────────────────
  async _initAR() {
    const loading = document.getElementById('loading');
    loading.style.display = 'flex';

    // Camera
    try {
      await this.cam.requestCamera();
    } catch (err) {
      loading.style.display = 'none';
      if (err.name === 'NotAllowedError') {
        this.sm.transition(GameState.ERROR, {
          title: 'Нет доступа к камере',
          msg: 'Разреши камеру в настройках браузера, потом нажми «Попробовать снова».',
        });
      } else {
        this.sm.transition(GameState.FALLBACK);
      }
      return;
    }

    // Three.js
    this._initThree();
    loading.style.display = 'none';

    try {
      await this._buildScene();
    } catch (err) {
      console.error('[AR] Scene build failed:', err);
      this.sm.transition(GameState.ERROR, {
        title: 'Не удалось загрузить персонажа',
        msg: 'Камера работает, но модель или анимации не загрузились. Проверь `.glb` и попробуй снова.',
      });
      return;
    }
    this._startRenderLoop();
    this.sm.transition(GameState.AR_ACTIVE);
  }

  // ── Three.js setup ──────────────────────────────────────────
  _initThree() {
    const canvas  = document.getElementById('ar-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled  = true;
    this.renderer.shadowMap.type     = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping        = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace   = THREE.SRGBColorSpace;

    this.scene  = new THREE.Scene();
    this.cam3d  = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 80);

    // ── Lighting ──────────────────────────────────────────────
    this.scene.add(new THREE.HemisphereLight(0xB8D0FF, 0x5577AA, 0.7));

    const sun = new THREE.DirectionalLight(0xFFE8C0, 1.55);
    sun.position.set(3, 8, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far  = 14;
    sun.shadow.camera.left = sun.shadow.camera.bottom = -3;
    sun.shadow.camera.right = sun.shadow.camera.top   =  3;
    sun.shadow.radius = 3;
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0x88AAFF, 0.5);
    fill.position.set(-4, 3, -2);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xFFFFFF, 0.4);
    rim.position.set(0, 2, -6);
    this.scene.add(rim);

    this.scene.add(new THREE.DirectionalLight(0xCCDDFF, 0.2).position.set(0, -4, 0) && new THREE.DirectionalLight(0xCCDDFF, 0.2));

    window.addEventListener('resize', () => {
      this.cam3d.aspect = window.innerWidth / window.innerHeight;
      this.cam3d.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  async _buildScene() {
    const config = CHARACTER_CONFIGS[this._currentCharId];

    this.character = new Character();
    this.character.onStatusChange = status => this.ui.updateAnimationStatus(status);
    this.character.onActionBindingsChange = bindings => this.ui.updateActionButtons(bindings);

    try {
      await this.character.load(this.scene, config.url);
    } catch (err) {
      console.warn('[AR] GLB load failed, falling back to procedural snowman.', err);
      this.character = new ProceduralCharacterAdapter();
      this.character.onStatusChange = status => this.ui.updateAnimationStatus(status);
      this.character.onActionBindingsChange = bindings => this.ui.updateActionButtons(bindings);
      await this.character.load(this.scene);
      this.ui.showSpeech('GLB не загрузился, показываю встроенного снеговика.', 3200);
    }

    const placement = this.character.getRecommendedPlacement(this.cam3d, -1.2);
    this.character.group.position.set(placement.x, placement.y, placement.z);
    this.character.baseY = placement.y;

    this.ui.setCharacterButtons(config.actionMeta);
    this.ui.updateCharacterSwitcher(this._currentCharId);
    this.ui.updateActionButtons(this.character.getActionBindings());
    this.ui.updateAnimationStatus(this.character.getAnimationStatus());

    // Walker
    this.walker = new Walker(this.character.group, this.character);
    this.questMgr = new QuestManager({
      availableActions: this.character.getActionAvailability(),
    });

    // Particles
    this.particles = new SnowParticles(this.scene);

    // Ambient 3D snowflakes
    const count = 52;
    const pos   = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i*3]   = (Math.random() - 0.5) * 8.5;
      pos[i*3+1] = Math.random() * 7 - 1.4;
      pos[i*3+2] = -1.2 - Math.random() * 6.4;
    }
    const sfGeo = new THREE.BufferGeometry();
    sfGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const sfMesh = new THREE.Points(
      sfGeo,
      new THREE.PointsMaterial({ color: 0xCCE4FF, size: 0.04, transparent: true, opacity: 0.42 })
    );
    this.scene.add(sfMesh);
    this._sfMesh = sfMesh;
    this._sfGeo  = sfGeo;
  }

  // ── Character switching ─────────────────────────────────────
  async _switchCharacter(id) {
    if (this._isSwitching) return;
    if (id === this._currentCharId && !this._dualMode) {
      this.ui.updateCharacterSwitcher(id);
      return;
    }

    this._isSwitching = true;
    const config = CHARACTER_CONFIGS[id];
    this.ui.showSpeech(`${config.emoji} Загружаю...`, 5000);

    // Stash old character reference (don't remove from scene yet)
    const oldChar = this.character;

    try {
      const newChar = new Character();
      newChar.onStatusChange = s => this.ui.updateAnimationStatus(s);
      newChar.onActionBindingsChange = () => {}; // suppress during load

      await newChar.load(this.scene, config.url);

      // Apply deer-specific rotation fix (body runs along X, rotate to face camera)
      if (id === 'deer') {
        newChar.group.rotation.y = Math.PI / 2;
      }

      // Now swap: remove old, keep new
      if (oldChar) this.scene.remove(oldChar.group);
      this.character = newChar;
      this._currentCharId = id;

      // Wire up live callbacks
      this.character.onActionBindingsChange = b => this.ui.updateActionButtons(b);

      this._applyCharacterPositions();
      this.walker.updateCharacter(this.character.group, this.character);
      this.ui.setCharacterButtons(config.actionMeta);
      this.ui.updateCharacterSwitcher(id);

      this.character.playOnce('happy', 'idle', 0.3);
      this.ui.showSpeech(config.greetLine, 2800);
      this.audio.playSuccess();

    } catch (err) {
      console.error('[Switch] Load failed:', err);
      this.ui.showSpeech('Не удалось загрузить модель 😢', 2500);
      // Restore old character if it was removed
      if (oldChar && !this.scene.children.includes(oldChar.group)) {
        this.scene.add(oldChar.group);
      }
    } finally {
      this._isSwitching = false;
    }
  }

  // ── Dual mode ───────────────────────────────────────────────
  async _toggleDualMode() {
    if (this._isSwitching) return;

    if (this._dualMode) {
      // Turn off
      this._dualMode = false;
      this.ui.setDualModeActive(false);
      if (this._secondCharacter) {
        this.scene.remove(this._secondCharacter.group);
        this._secondCharacter = null;
        this._secondCharId = null;
      }
      this._applyCharacterPositions();
      return;
    }

    // Turn on — pick secondary character
    const ids = Object.keys(CHARACTER_CONFIGS);
    const primaryIdx = ids.indexOf(this._currentCharId);
    this._secondCharId = ids[(primaryIdx + 1) % ids.length];
    const cfg2 = CHARACTER_CONFIGS[this._secondCharId];

    this._isSwitching = true;
    this.ui.showSpeech(`${cfg2.emoji} Загружаю...`, 5000);

    try {
      const char2 = new Character();
      char2.onStatusChange = () => {};
      char2.onActionBindingsChange = () => {};
      await char2.load(this.scene, cfg2.url);

      if (this._secondCharId === 'deer') char2.group.rotation.y = Math.PI / 2;

      this._secondCharacter = char2;
      this._dualMode = true;
      this.ui.setDualModeActive(true);
      this._applyCharacterPositions();
      this.ui.showSpeech(`${CHARACTER_CONFIGS[this._currentCharId].emoji} + ${cfg2.emoji} Двойная команда!`, 3000);
      this.audio.playSuccess();
    } catch (err) {
      console.error('[Dual] Secondary load failed:', err);
      this._secondCharId = null;
      this.ui.showSpeech('Не удалось загрузить второго персонажа 😢', 2500);
    } finally {
      this._isSwitching = false;
    }
  }

  _applyCharacterPositions() {
    const floorY = -1.2;
    if (this._dualMode && this._secondCharacter) {
      // Side by side
      const p1 = this.character.getRecommendedPlacement(this.cam3d, floorY);
      this.character.group.position.set(-0.5, p1.y, p1.z);
      this.character.baseY = p1.y;

      const p2 = this._secondCharacter.getRecommendedPlacement(this.cam3d, floorY);
      this._secondCharacter.group.position.set(0.5, p2.y, p2.z);
      this._secondCharacter.baseY = p2.y;
    } else {
      const p = this.character.getRecommendedPlacement(this.cam3d, floorY);
      this.character.group.position.set(p.x, p.y, p.z);
      this.character.baseY = p.y;
    }
  }

  _startRenderLoop() {
    const animate = () => {
      requestAnimationFrame(animate);
      const dt = Math.min(this._clock.getDelta(), 0.05);

      if (this.walker)    this.walker.update(dt);
      if (this.character) this.character.update(dt, this.walker?.isMoving, this.walker?.smoothSpeed);
      if (this._secondCharacter) this._secondCharacter.update(dt, false, 0);
      if (this.particles) this.particles.update(dt);
      if (this.activeStar) {
        this.activeStar.update(dt);
        if (!this.activeStar.alive) this.activeStar = null;
      }
      this._animSnowflakes();

      this.renderer.render(this.scene, this.cam3d);
    };
    animate();

    // UI snowflake effect
    setInterval(() => {
      if (this.sm.isAny(GameState.AR_ACTIVE, GameState.QUEST_ACTIVE)) {
        this.ui.spawnSnowflake();
      }
    }, 3200);
  }

  _animSnowflakes() {
    if (!this._sfGeo) return;
    const arr = this._sfGeo.attributes.position.array;
    for (let i = 1; i < arr.length; i += 3) {
      arr[i] -= 0.0024;
      if (arr[i] < -2.1) arr[i] = 5.4;
    }
    this._sfGeo.attributes.position.needsUpdate = true;
  }

  // ── Tap handling ────────────────────────────────────────────
  _onTap(cx, cy) {
    if (!this.character?.loaded) return;
    if (!this.sm.isAny(GameState.AR_ACTIVE, GameState.QUEST_ACTIVE)) return;

    this.audio.resume();
    this.audio.playTap();
    this.ui.spawnTapRipple(cx, cy);

    this._ptr.x =  (cx / window.innerWidth)  * 2 - 1;
    this._ptr.y = -(cy / window.innerHeight)  * 2 + 1;
    this._rc.setFromCamera(this._ptr, this.cam3d);

    // Check for star tap first
    if (this.activeStar?.alive) {
      const starHit = this._rc.intersectObject(this.activeStar.getMesh());
      if (starHit.length) {
        this.activeStar.collect(true);
        this.activeStar = null;
        this.particles.starBurst(starHit[0].point);
        this.audio.playSuccess();
        this._completeTrigger('catch_star');
        return;
      }
    }

    // Check character tap (primary + secondary in dual mode)
    const charMeshes = this.character.getMeshes();
    const secondMeshes = this._secondCharacter?.getMeshes() || [];
    const allMeshes = [...charMeshes, ...secondMeshes];

    const charHits = this._rc.intersectObjects(allMeshes);
    if (charHits.length) {
      // Determine which character was hit
      const hitObj = charHits[0].object;
      const hitSecond = this._secondCharacter && secondMeshes.includes(hitObj);
      const hitChar = hitSecond ? this._secondCharacter : this.character;
      this._onCharTap(charHits[0].point, hitChar);
      return;
    }

    const walkTarget = this.walker?.screenToWorld(this._ptr.x, this._ptr.y);
    if (walkTarget) this._onFloorTap(walkTarget);
  }

  _onCharTap(hitPoint, tappedChar = null) {
    const char = tappedChar || this.character;
    const now  = Date.now();
    const dbl  = (now - this._lastTapTime) < DBL_TAP_MS;
    this._lastTapTime = now;

    char.tap();
    this.particles.burst(hitPoint, 10);

    if (char === this.character) {
      if (dbl) {
        this._completeTrigger('double_tap');
      } else if (this.walker?.isMoving) {
        this._completeTrigger('tap_while_walk');
      } else {
        this._completeTrigger('tap_body');
      }
      char.playOnce('surprised', 'idle');
    } else {
      // Secondary character: just react
      char.playOnce('wave', 'idle');
    }

    this.ui.showSpeech(this.audio.getLine('tap'));
  }

  _onFloorTap(worldPt) {
    const now = Date.now();
    const dbl = (now - this._lastTapTime) < DBL_TAP_MS;
    this._lastTapTime = now;

    this.walker.walkTo(worldPt, dbl);
    this._completeTrigger('walk_to');
  }

  _onHoldFire() {
    if (!this.character?.loaded) return;
    if (!this.sm.isAny(GameState.AR_ACTIVE, GameState.QUEST_ACTIVE)) return;
    this.audio.resume();
    this.character.playOnce('dance', 'idle', 0.25);
    this.ui.showSpeech(this.audio.getLine('dance'));
    this.audio.playSuccess();
    if (this.particles && this.character) {
      const p = this.character.group.position.clone().add(new THREE.Vector3(0, 1.2, 0));
      this.particles.burst(p, 10, 0xAAFFCC);
    }
  }

  // ── Snowman screen-space position ───────────────────────────
  _getSnowmanScreenPos(yOffset = 0.6) {
    if (!this.character?.group || !this.cam3d) {
      return { x: window.innerWidth / 2, y: window.innerHeight * 0.4 };
    }
    const pos = this.character.group.position.clone();
    pos.y += yOffset;
    pos.project(this.cam3d);
    return {
      x: (pos.x + 1) / 2 * window.innerWidth,
      y: (-pos.y + 1) / 2 * window.innerHeight,
    };
  }

  // ── Action buttons ──────────────────────────────────────────
  _handleAction(action) {
    this.walker.stopAndIdle();

    const charConf  = CHARACTER_CONFIGS[this._currentCharId];
    const actionConf = charConf?.actionMeta[action];
    const animKey   = actionConf?.animKey ?? action;
    const effect    = actionConf?.effect  ?? action;

    // Try to play model animation
    let played = this.character.playOnce(animKey, 'idle', 0.25);

    if (!played) {
      if (charConf?.procedural) {
        // Procedural animation for models without GLB animations (e.g. deer)
        this.character.playProceduralAction(effect, 2200);
        played = true;
      } else {
        this.ui.showSpeech('У этой модели пока нет анимации для кнопки.');
        return;
      }
    }

    this.ui.showSpeech(this.audio.getLine(action));
    this.audio.playSuccess();

    const p  = this.character.group.position.clone().add(new THREE.Vector3(0, 1.5, -0.3));
    const sp = this._getSnowmanScreenPos();
    this._triggerEffect(effect, p, sp);
    this._completeTrigger('action_' + action);

    // Secondary character reacts too if dual mode
    if (this._dualMode && this._secondCharacter) {
      setTimeout(() => this._secondCharacter.playOnce('wave', 'idle', 0.2), 400);
    }
  }

  _triggerEffect(effect, p3d, sp) {
    switch (effect) {
      case 'dance':
        this.particles.burst(p3d, 10, 0xFFD740);
        this.ui.danceSparkles(sp.x, sp.y);
        break;
      case 'sing':
        this.particles.burst(p3d, 8, 0xFFAA44);
        this.ui.singNotes(sp.x, sp.y);
        break;
      case 'magic':
        this.particles.burst(p3d, 10, 0xAAFFEE);
        this.ui.magicSnowfall(sp.x, sp.y);
        break;
      case 'throw':
        this.particles.burst(p3d, 12, 0xEAF6FF);
        this.ui.throwSnowball(sp.x, sp.y);
        break;
      case 'greet':
        this.particles.burst(p3d, 12, 0xFFD700);
        this.ui.santaGreeting(sp.x, sp.y);
        break;
      case 'gift':
        this.particles.burst(p3d, 14, 0xFF6B9D);
        this.ui.giftFly(sp.x, sp.y);
        break;
      case 'xmastree':
        this.particles.burst(p3d, 16, 0x4CAF50);
        this.ui.christmasTree(sp.x, sp.y);
        break;
      case 'gallop':
        this.particles.burst(p3d, 10, 0xFFD740);
        this.ui.deerGallop(sp.x, sp.y);
        break;
      case 'bells':
        this.particles.burst(p3d, 8, 0xFFD700);
        this.ui.deerBells(sp.x, sp.y);
        break;
      case 'shine':
        this.particles.burst(p3d, 12, 0xFFEE00);
        this.ui.deerShine(sp.x, sp.y);
        break;
      case 'deerJump':
        this.particles.burst(p3d, 10, 0xAAFFFF);
        this.ui.deerJump(sp.x, sp.y);
        break;
      default:
        this.particles.burst(p3d, 8, 0xAAFFCC);
    }
  }

  // ── Quest logic ─────────────────────────────────────────────
  _completeTrigger(trigger) {
    const result = this.questMgr?.tryComplete(trigger);
    if (!result) return;

    const { quest, earned, bonus, combo, isComboMilestone } = result;

    this.ui.updateScore(this.questMgr.totalScore);
    this.ui.updateCombo(combo);
    this.audio.playSuccess();

    const p = this.character.group.position.clone().add(new THREE.Vector3(0, 1.5, -0.3));
    this.particles.starBurst(p);

    if (isComboMilestone) {
      this.audio.playReward();
      this.character.playOnce('happy', 'idle', 0.2);
      this.ui.showSpeech('🔥 КОМБО x' + combo + '!', 3000);
      const p2 = this.character.group.position.clone().add(new THREE.Vector3(0, 2.0, 0));
      this.particles.burst(p2, 24, 0xFF6600);
    }

    this.ui.hideQuestPanel();
    setTimeout(() => {
      this.ui.showQuestComplete({ title: quest.title, earned, bonus, combo });
    }, 700);
  }

  _greetAndStartQuests() {
    this.character.playOnce('happy', 'idle', 0.3);
    this.ui.showSpeech(this.audio.getLine('greet'), 2800);
    setTimeout(() => this._nextQuest(), 2700);
  }

  _nextQuest() {
    this.sm.transition(GameState.QUEST_ACTIVE);
    const quest = this.questMgr.startNext();
    this.ui.showQuestPanel(quest);
    this.ui.setHint(quest.hint);
    this.ui.showSpeech(this.audio.getLine('questStart'));

    if (quest.id === 'catch_star') {
      if (this.activeStar) this.activeStar.collect(false);
      this.activeStar = new Star(this.scene, this.character.group.position);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => new App());
