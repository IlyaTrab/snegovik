export class UIManager {
  constructor() {
    this._screens = {};
    document.querySelectorAll('.screen').forEach(el => {
      this._screens[el.id] = el;
    });

    this._scoreEl = document.getElementById('score-value');
    this._hintEl = document.getElementById('hint-text');
    this._speechEl = document.getElementById('speech-bubble');
    this._speechTextEl = document.getElementById('speech-text');
    this._questPanel = document.getElementById('quest-panel');
    this._questTitleEl = document.getElementById('quest-title-text');
    this._questDescEl = document.getElementById('quest-desc-text');
    this._comboEl = document.getElementById('combo-badge');
    this._comboValEl = document.getElementById('combo-value');
    this._actionButtons = new Map(
      [...document.querySelectorAll('.action-btn')].map(btn => [btn.dataset.action, btn]),
    );
    this._speechTimer = null;
    this._comboTimer = null;
  }

  showScreen(id) {
    Object.values(this._screens).forEach(screen => {
      screen.classList.remove('active');
      screen.style.display = '';
    });
    const el = this._screens[id];
    if (el) {
      el.style.display = 'flex';
      el.classList.add('active');
    }
  }

  showOverlay(id) {
    const el = this._screens[id];
    if (el) {
      el.style.display = 'flex';
      el.classList.add('active');
    }
  }

  hideOverlay(id) {
    const el = this._screens[id];
    if (el) {
      el.style.display = 'none';
      el.classList.remove('active');
    }
  }

  updateScore(score) {
    if (!this._scoreEl) return;
    this._scoreEl.textContent = score;
    this._scoreEl.style.animation = 'none';
    requestAnimationFrame(() => {
      this._scoreEl.style.animation = 'countPop 0.3s ease';
    });
  }

  updateCombo(combo) {
    if (!this._comboEl) return;
    if (combo < 2) {
      this._comboEl.classList.add('hidden');
      return;
    }

    clearTimeout(this._comboTimer);
    this._comboValEl.textContent = '🔥 x' + combo;
    this._comboEl.classList.remove('hidden');
    this._comboEl.classList.remove('combo-pop');
    void this._comboEl.offsetWidth;
    this._comboEl.classList.add('combo-pop');

    this._comboTimer = setTimeout(() => this._comboEl.classList.add('hidden'), 4000);
  }

  setHint(text) {
    if (this._hintEl) this._hintEl.textContent = text;
  }

  updateActionButtons(bindings) {
    if (!bindings) return;
    for (const [action, btn] of this._actionButtons.entries()) {
      const binding = bindings[action];
      if (!binding) continue;
      btn.disabled = !binding.enabled;
      btn.classList.toggle('is-disabled', !binding.enabled);
      btn.textContent = binding.emoji;
    }
  }

  updateAnimationStatus({ currentLabel, clips, clipCount }) {
    void currentLabel;
    void clips;
    void clipCount;
  }

  showSpeech(text, duration = 2800) {
    if (this._speechTimer) clearTimeout(this._speechTimer);
    this._speechTextEl.textContent = text;
    this._speechEl.classList.remove('hidden');
    this._speechTimer = setTimeout(() => this._speechEl.classList.add('hidden'), duration);
  }

  showQuestPanel(quest) {
    if (!this._questPanel) return;
    this._questTitleEl.textContent = quest.title;
    this._questDescEl.textContent = quest.desc;
    this._questPanel.classList.remove('hidden');
  }

  hideQuestPanel() {
    this._questPanel?.classList.add('hidden');
  }

  showQuestComplete({ title, earned, bonus, combo }) {
    document.getElementById('quest-complete-title').textContent = title;
    document.getElementById('points-earned').textContent = '+' + earned;

    const bonusEl = document.getElementById('quest-bonus');
    if (bonus > 0 && bonusEl) {
      bonusEl.textContent = `🔥 Комбо x${combo} +${bonus} бонус!`;
      bonusEl.classList.remove('hidden');
    } else if (bonusEl) {
      bonusEl.classList.add('hidden');
    }

    this.showOverlay('screen-quest-complete');
  }

  showError(title, msg) {
    document.getElementById('error-title').textContent = title;
    document.getElementById('error-msg').textContent = msg;
    this.showScreen('screen-error');
  }

  showFinalReward(score) {
    document.getElementById('final-score').textContent = score + ' очков';
    const stars = Math.max(1, Math.min(5, Math.ceil(score / 50)));
    const el = document.getElementById('achievement-stars');
    if (el) el.textContent = '⭐'.repeat(stars);
    this.showScreen('screen-reward');
  }

  spawnTapRipple(x, y) {
    const el = document.createElement('div');
    el.className = 'tap-ripple';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 600);
  }

  spawnSnowflake() {
    const el = document.createElement('div');
    el.className = 'snowflake-particle';
    el.textContent = ['❄', '❅'][Math.floor(Math.random() * 2)];
    el.style.left = (Math.random() * 96 + 2) + 'vw';
    el.style.fontSize = (10 + Math.random() * 10) + 'px';
    const dur = 3.4 + Math.random() * 2.2;
    el.style.animationDuration = dur + 's';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), dur * 1000);
  }

  spawnCelebration(count = 25) {
    for (let i = 0; i < count; i++) setTimeout(() => this.spawnSnowflake(), i * 70);
  }

  // ── Action visual effects ───────────────────────────────────

  // ── Снежок — много снежков, жирные залепы ──────────────────
  throwSnowball(fromX, fromY) {
    const targets = [
      { x: window.innerWidth * 0.50, y: window.innerHeight * 0.28 },
      { x: window.innerWidth * 0.18, y: window.innerHeight * 0.42 },
      { x: window.innerWidth * 0.82, y: window.innerHeight * 0.35 },
      { x: window.innerWidth * 0.35, y: window.innerHeight * 0.55 },
      { x: window.innerWidth * 0.68, y: window.innerHeight * 0.20 },
    ];
    targets.forEach((to, idx) => {
      setTimeout(() => {
        const ball = document.createElement('div');
        ball.className = 'snowball-fx';
        ball.style.left = fromX + 'px';
        ball.style.top  = fromY + 'px';
        ball.style.setProperty('--tx', (to.x - fromX) + 'px');
        ball.style.setProperty('--ty', (to.y - fromY) + 'px');
        document.body.appendChild(ball);
        setTimeout(() => { ball.remove(); this._glassSplat(to.x, to.y); }, 500);
      }, idx * 160);
    });
  }

  _glassSplat(cx, cy) {
    // Big opaque main blob
    const splat = document.createElement('div');
    splat.className = 'glass-splat';
    splat.style.left = cx + 'px';
    splat.style.top  = cy + 'px';
    document.body.appendChild(splat);
    setTimeout(() => splat.remove(), 4000);

    // Thick opaque chunks scattered around
    for (let i = 0; i < 10; i++) {
      const chunk = document.createElement('div');
      chunk.className = 'glass-chunk';
      const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.5;
      const r     = 35 + Math.random() * 70;
      chunk.style.left   = (cx + Math.cos(angle) * r) + 'px';
      chunk.style.top    = (cy + Math.sin(angle) * r) + 'px';
      const sz = 14 + Math.random() * 22;
      chunk.style.width  = sz + 'px';
      chunk.style.height = sz * (0.7 + Math.random() * 0.6) + 'px';
      chunk.style.borderRadius = (30 + Math.random() * 50) + '%';
      document.body.appendChild(chunk);
      setTimeout(() => chunk.remove(), 3800);
    }

    // Drip trails downward
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const drip = document.createElement('div');
        drip.className = 'glass-drip-trail';
        drip.style.left = (cx + (Math.random() - 0.5) * 80) + 'px';
        drip.style.top  = (cy + 20) + 'px';
        document.body.appendChild(drip);
        setTimeout(() => drip.remove(), 2500);
      }, i * 200);
    }
  }

  // ── Магия — волшебная палочка + мега метель ─────────────────
  magicSnowfall(cx, cy) {
    // Magic wand — large, at snowman hand level
    const wand = document.createElement('div');
    wand.className = 'magic-wand-fx';
    wand.textContent = '🪄';
    wand.style.left = cx + 'px';
    wand.style.top  = (cy - 20) + 'px';
    document.body.appendChild(wand);
    setTimeout(() => wand.remove(), 2200);

    // Magic sparkle burst from wand
    const sparkEmojis = ['✨', '⭐', '💫', '🌟', '💥'];
    for (let i = 0; i < 10; i++) {
      setTimeout(() => {
        const sp = document.createElement('div');
        sp.className = 'magic-spark';
        sp.textContent = sparkEmojis[Math.floor(Math.random() * sparkEmojis.length)];
        const angle = Math.random() * Math.PI * 2;
        const dist  = 50 + Math.random() * 80;
        sp.style.left = cx + 'px';
        sp.style.top  = (cy - 40) + 'px';
        sp.style.setProperty('--tx', Math.cos(angle) * dist + 'px');
        sp.style.setProperty('--ty', Math.sin(angle) * dist + 'px');
        document.body.appendChild(sp);
        setTimeout(() => sp.remove(), 900);
      }, 300 + i * 60);
    }

    // SUPER blizzard — starts after wand wave
    setTimeout(() => {
      const end = Date.now() + 5000;
      const flake = () => {
        if (Date.now() > end) return;
        const el = document.createElement('div');
        el.className = 'blizzard-flake';
        el.textContent = ['❄', '❅', '❆', '❄', '❅'][Math.floor(Math.random() * 5)];
        el.style.left = (Math.random() * 115 - 7) + 'vw';
        const size = 22 + Math.random() * 36;
        el.style.fontSize = size + 'px';
        const dur = 0.9 + Math.random() * 1.0;
        el.style.setProperty('--drift', (Math.random() * 80 - 40) + 'px');
        el.style.animationDuration = dur + 's';
        document.body.appendChild(el);
        setTimeout(() => el.remove(), dur * 1000 + 200);
        setTimeout(flake, 25 + Math.random() * 30);
      };
      flake();
    }, 700);
  }

  // ── Танец — диско-шар + цветные лучи ───────────────────────
  danceSparkles(cx, cy) {
    // Disco ball drops from top
    const container = document.createElement('div');
    container.className = 'disco-ball-container';
    container.innerHTML = `<div class="disco-string"></div><div class="disco-ball">🪩</div>`;
    document.body.appendChild(container);
    setTimeout(() => {
      container.classList.add('disco-exit');
      setTimeout(() => container.remove(), 600);
    }, 4000);

    // Pulsing colored light beams from ball to screen
    const colors = ['#ff0055','#ff8800','#ffee00','#00ff88','#00aaff','#aa00ff','#ff0088'];
    let beam = 0;
    const beamIv = setInterval(() => {
      const b = document.createElement('div');
      b.className = 'disco-beam';
      b.style.background = colors[beam % colors.length];
      b.style.setProperty('--bangle', (Math.random() * 360) + 'deg');
      document.body.appendChild(b);
      setTimeout(() => b.remove(), 500);
      beam++;
    }, 280);
    setTimeout(() => clearInterval(beamIv), 4200);

    // Flash screen color on beat
    const flashColors = ['rgba(255,0,85,0.18)', 'rgba(0,200,255,0.18)', 'rgba(255,200,0,0.18)', 'rgba(150,0,255,0.18)'];
    let fc = 0;
    const flashIv = setInterval(() => {
      const fl = document.createElement('div');
      fl.className = 'disco-color-flash';
      fl.style.background = flashColors[fc % flashColors.length];
      fc++;
      document.body.appendChild(fl);
      setTimeout(() => fl.remove(), 250);
    }, 380);
    setTimeout(() => clearInterval(flashIv), 4200);

    // Particle burst
    const emojis = ['✨', '💫', '🌟', '⭐', '🎊'];
    for (let i = 0; i < 16; i++) {
      setTimeout(() => {
        const el = document.createElement('div');
        el.className = 'dance-sparkle';
        el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        const angle = (i / 16) * Math.PI * 2;
        const dist  = 80 + Math.random() * 110;
        el.style.left = cx + 'px';
        el.style.top  = cy + 'px';
        el.style.setProperty('--tx', Math.cos(angle) * dist + 'px');
        el.style.setProperty('--ty', Math.sin(angle) * dist + 'px');
        el.style.fontSize = (20 + Math.random() * 12) + 'px';
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 1200);
      }, i * 50);
    }
  }

  // ── Пой — CSS-пианино + нажатия клавиш + ноты ──────────────
  singNotes(cx, cy) {
    // Build CSS piano
    const piano = this._buildPiano();
    piano.style.left = cx + 'px';
    piano.style.top  = (cy + 70) + 'px';
    document.body.appendChild(piano);

    // Animate random key presses in rhythm
    const keys = piano.querySelectorAll('.pwk');
    for (let i = 0; i < 22; i++) {
      setTimeout(() => {
        const k = keys[Math.floor(Math.random() * keys.length)];
        k.classList.add('pressed');
        setTimeout(() => k.classList.remove('pressed'), 130);
      }, i * 160 + 100);
    }
    setTimeout(() => piano.remove(), 5200);

    // Speech bubble
    const bubble = document.createElement('div');
    bubble.className = 'sing-bubble';
    bubble.textContent = '♫ ла-ла-лааа ♫';
    bubble.style.left = cx + 'px';
    bubble.style.top  = (cy - 90) + 'px';
    document.body.appendChild(bubble);
    setTimeout(() => bubble.remove(), 4800);

    // Waves of notes rising from piano
    const notes = ['♩', '♪', '♫', '♬', '🎵', '🎶'];
    for (let i = 0; i < 20; i++) {
      setTimeout(() => {
        const el = document.createElement('div');
        el.className = 'sing-note';
        el.textContent = notes[Math.floor(Math.random() * notes.length)];
        const offsetX = (Math.random() - 0.5) * 200;
        el.style.left = cx + 'px';
        el.style.top  = (cy + 30) + 'px';
        el.style.setProperty('--tx', offsetX + 'px');
        el.style.fontSize = (24 + Math.random() * 22) + 'px';
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 2400);
      }, i * 155);
    }
  }

  // ── Per-character button overrides ─────────────────────────

  setCharacterButtons(actionMeta) {
    if (!actionMeta) return;
    for (const [action, btn] of this._actionButtons.entries()) {
      const cfg = actionMeta[action];
      if (!cfg) continue;
      btn.textContent = cfg.emoji;
      btn.title = cfg.label;
      btn.disabled = false;
      btn.classList.remove('is-disabled');
    }
  }

  updateCharacterSwitcher(activeId) {
    document.querySelectorAll('.char-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.char === activeId);
    });
  }

  setDualModeActive(active) {
    document.getElementById('btn-dual-mode')?.classList.toggle('dual-active', active);
  }

  // ── Santa: greeting burst ───────────────────────────────────
  santaGreeting(cx, cy) {
    const bubble = document.createElement('div');
    bubble.className = 'greet-bubble';
    bubble.textContent = '🎅 Хо-хо-хо!';
    bubble.style.left = cx + 'px';
    bubble.style.top  = (cy - 60) + 'px';
    document.body.appendChild(bubble);
    setTimeout(() => bubble.remove(), 2900);

    const emojis = ['⭐', '💫', '✨', '🌟', '❄️', '🎄'];
    for (let i = 0; i < 14; i++) {
      setTimeout(() => {
        const sp = document.createElement('div');
        sp.className = 'greet-star';
        sp.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        sp.style.left = cx + 'px';
        sp.style.top  = (cy - 60) + 'px';
        sp.style.fontSize = (18 + Math.random() * 18) + 'px';
        const angle = (i / 14) * Math.PI * 2;
        const dist  = 70 + Math.random() * 100;
        sp.style.setProperty('--tx', Math.cos(angle) * dist + 'px');
        sp.style.setProperty('--ty', Math.sin(angle) * dist + 'px');
        document.body.appendChild(sp);
        setTimeout(() => sp.remove(), 1200);
      }, 200 + i * 50);
    }
  }

  // ── Santa: gift throw ───────────────────────────────────────
  giftFly(cx, cy) {
    // Big "ПОДАРОК!" label
    const label = document.createElement('div');
    label.className = 'greet-bubble';
    label.style.left = cx + 'px';
    label.style.top  = (cy - 110) + 'px';
    label.style.fontSize = '32px';
    label.style.background = 'linear-gradient(135deg,#e91e63,#ff5722)';
    label.textContent = '🎁 ПОДАРОК!';
    document.body.appendChild(label);
    setTimeout(() => label.remove(), 3000);

    // Multiple gifts flying in from edges
    const origins = [
      { x: -80, y: window.innerHeight * 0.3 },
      { x: window.innerWidth + 80, y: window.innerHeight * 0.2 },
      { x: window.innerWidth * 0.5, y: -80 },
    ];
    origins.forEach((from, idx) => {
      setTimeout(() => {
        const gift = document.createElement('div');
        gift.className = 'gift-fly';
        gift.textContent = ['🎁','🎀','🎊'][idx];
        gift.style.left = from.x + 'px';
        gift.style.top  = from.y + 'px';
        gift.style.setProperty('--gx', (cx - from.x) + 'px');
        gift.style.setProperty('--gy', (cy - from.y) + 'px');
        document.body.appendChild(gift);
        setTimeout(() => gift.remove(), 2800);
      }, idx * 200);
    });

    // Massive confetti burst after landing
    const items = ['⭐','🌟','💫','❤️','🎉','✨','💝','🎊','💕','🎈'];
    for (let i = 0; i < 28; i++) {
      setTimeout(() => {
        const el = document.createElement('div');
        el.className = 'gift-confetti';
        el.textContent = items[Math.floor(Math.random() * items.length)];
        el.style.left = cx + 'px';
        el.style.top  = cy + 'px';
        el.style.fontSize = (16 + Math.random() * 22) + 'px';
        const angle = (i / 28) * Math.PI * 2;
        const dist  = 80 + Math.random() * 150;
        el.style.setProperty('--tx', Math.cos(angle) * dist + 'px');
        el.style.setProperty('--ty', Math.sin(angle) * dist + 'px');
        el.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 1600);
      }, 600 + i * 35);
    }
  }

  // ── Santa: christmas tree ───────────────────────────────────
  christmasTree(cx, cy) {
    // Screen green flash
    const flash = document.createElement('div');
    flash.className = 'shine-flash';
    flash.style.background = 'radial-gradient(circle at 50% 60%, rgba(0,200,60,0.25) 0%, transparent 65%)';
    flash.style.setProperty('--ox', '50%');
    flash.style.setProperty('--oy', '60%');
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 900);

    // Giant tree grows from bottom
    const tree = document.createElement('div');
    tree.className = 'xmas-tree';
    tree.textContent = '🎄';
    tree.style.left = cx + 'px';
    tree.style.top  = (cy + 20) + 'px';
    document.body.appendChild(tree);
    setTimeout(() => tree.remove(), 5000);

    // Golden star floats up to top of tree
    setTimeout(() => {
      const star = document.createElement('div');
      star.style.cssText = `position:fixed;pointer-events:none;z-index:616;font-size:42px;
        left:${cx}px;top:${cy}px;transform:translate(-50%,-50%);
        filter:drop-shadow(0 0 20px gold);
        animation:greetPop 0.5s cubic-bezier(0.34,1.56,0.64,1),giftFade 0.5s ease 4s forwards`;
      star.textContent = '⭐';
      document.body.appendChild(star);
      setTimeout(() => star.remove(), 4700);
    }, 500);

    // "С НОВЫМ ГОДОМ!" label
    setTimeout(() => {
      const label = document.createElement('div');
      label.className = 'greet-bubble';
      label.style.left = cx + 'px';
      label.style.top  = (cy - 130) + 'px';
      label.style.fontSize = '24px';
      label.style.background = 'linear-gradient(135deg,#2e7d32,#66bb6a)';
      label.textContent = '🎄 С Новым Годом!';
      document.body.appendChild(label);
      setTimeout(() => label.remove(), 3500);
    }, 400);

    // Many blinking lights in a tree shape
    const colors = ['#FF0000','#FFD700','#00FF60','#00AAFF','#FF69B4','#FF6600','#ffffff'];
    for (let i = 0; i < 35; i++) {
      setTimeout(() => {
        const light = document.createElement('div');
        light.className = 'xmas-light';
        // Place lights in a triangle (tree shape)
        const row    = Math.floor(Math.random() * 5);
        const spread = (row + 1) * 18;
        const angle  = (Math.random() - 0.5) * Math.PI;
        const dist   = Math.random() * spread;
        light.style.left   = (cx + Math.cos(angle) * dist) + 'px';
        light.style.top    = (cy - 10 + row * 20 + Math.random() * 10) + 'px';
        light.style.width  = (8 + Math.random() * 6) + 'px';
        light.style.height = light.style.width;
        const col = colors[Math.floor(Math.random() * colors.length)];
        light.style.background = col;
        light.style.boxShadow  = `0 0 10px ${col}, 0 0 20px ${col}`;
        light.style.animationDelay = (Math.random() * 0.5) + 's';
        document.body.appendChild(light);
        setTimeout(() => light.remove(), 4400);
      }, i * 60);
    }

    // Ornament emojis appearing on tree
    const ornaments = ['🔴','🔵','🟡','🟢','🟠','💛','❤️'];
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        const orn = document.createElement('div');
        orn.style.cssText = `position:fixed;pointer-events:none;z-index:614;font-size:20px;
          left:${cx + (Math.random()-0.5)*80}px;top:${cy + 10 + i*15}px;
          transform:translate(-50%,-50%);
          animation:charBtnPop 0.4s cubic-bezier(0.34,1.56,0.64,1),giftFade 0.5s ease 3.5s forwards`;
        orn.textContent = ornaments[i % ornaments.length];
        document.body.appendChild(orn);
        setTimeout(() => orn.remove(), 4200);
      }, 600 + i * 150);
    }
  }

  // ── Deer: gallop ────────────────────────────────────────────
  deerGallop(cx, cy) {
    const bubble = document.createElement('div');
    bubble.className = 'greet-bubble';
    bubble.textContent = '🦌 Вжух-х-х!';
    bubble.style.left = cx + 'px';
    bubble.style.top  = (cy - 80) + 'px';
    document.body.appendChild(bubble);
    setTimeout(() => bubble.remove(), 2800);

    // Speed lines
    for (let i = 0; i < 12; i++) {
      setTimeout(() => {
        const line = document.createElement('div');
        line.className = 'gallop-line';
        line.style.left  = (cx - 30 + Math.random() * 60) + 'px';
        line.style.top   = (cy - 60 + Math.random() * 120) + 'px';
        line.style.transform = `rotate(${-5 + Math.random() * 10}deg)`;
        document.body.appendChild(line);
        setTimeout(() => line.remove(), 400);
      }, i * 55);
    }

    // Dust puffs
    const puffs = ['💨', '☁️', '🌪️'];
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        const dust = document.createElement('div');
        dust.className = 'gallop-dust';
        dust.textContent = puffs[Math.floor(Math.random() * puffs.length)];
        dust.style.left = (cx + 30 + Math.random() * 40) + 'px';
        dust.style.top  = (cy + 20 + Math.random() * 30) + 'px';
        const angle = Math.PI + (Math.random() - 0.5) * 0.8;
        const dist  = 60 + Math.random() * 80;
        dust.style.setProperty('--tx', Math.cos(angle) * dist + 'px');
        dust.style.setProperty('--ty', Math.sin(angle) * dist + 'px');
        document.body.appendChild(dust);
        setTimeout(() => dust.remove(), 900);
      }, i * 90);
    }
  }

  // ── Deer: bells ─────────────────────────────────────────────
  deerBells(cx, cy) {
    const bell = document.createElement('div');
    bell.className = 'bells-fx';
    bell.textContent = '🔔';
    bell.style.left = cx + 'px';
    bell.style.top  = (cy - 20) + 'px';
    document.body.appendChild(bell);
    setTimeout(() => bell.remove(), 2800);

    // Musical notes rising
    const notes = ['♩', '♪', '♫', '♬', '🎶', '🎵'];
    for (let i = 0; i < 16; i++) {
      setTimeout(() => {
        const note = document.createElement('div');
        note.className = 'bell-note';
        note.textContent = notes[Math.floor(Math.random() * notes.length)];
        note.style.left = cx + 'px';
        note.style.top  = cy + 'px';
        const offsetX = (Math.random() - 0.5) * 180;
        note.style.setProperty('--tx', offsetX + 'px');
        note.style.fontSize = (18 + Math.random() * 18) + 'px';
        document.body.appendChild(note);
        setTimeout(() => note.remove(), 1700);
      }, i * 100);
    }
  }

  // ── Deer: shine / nose glow ──────────────────────────────────
  deerShine(cx, cy) {
    // Radial flash
    const flash = document.createElement('div');
    flash.className = 'shine-flash';
    flash.style.setProperty('--ox', (cx / window.innerWidth * 100) + '%');
    flash.style.setProperty('--oy', (cy / window.innerHeight * 100) + '%');
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 750);

    // Expanding rings
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const ring = document.createElement('div');
        ring.className = 'shine-ring';
        ring.style.left = cx + 'px';
        ring.style.top  = cy + 'px';
        ring.style.width  = (60 + i * 30) + 'px';
        ring.style.height = (60 + i * 30) + 'px';
        ring.style.borderColor = i === 0 ? 'rgba(255,80,80,0.9)' : i === 1 ? 'rgba(255,200,80,0.8)' : 'rgba(255,255,160,0.7)';
        document.body.appendChild(ring);
        setTimeout(() => ring.remove(), 1300);
      }, i * 150);
    }

    // Star burst
    const emojis = ['⭐', '🌟', '💫', '✨', '❄️'];
    for (let i = 0; i < 14; i++) {
      setTimeout(() => {
        const star = document.createElement('div');
        star.className = 'shine-star';
        star.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        star.style.left = cx + 'px';
        star.style.top  = cy + 'px';
        star.style.fontSize = (16 + Math.random() * 20) + 'px';
        const angle = (i / 14) * Math.PI * 2;
        const dist  = 80 + Math.random() * 100;
        star.style.setProperty('--tx', Math.cos(angle) * dist + 'px');
        star.style.setProperty('--ty', Math.sin(angle) * dist + 'px');
        document.body.appendChild(star);
        setTimeout(() => star.remove(), 1100);
      }, i * 40);
    }
  }

  // ── Deer: jump ───────────────────────────────────────────────
  deerJump(cx, cy) {
    const bubble = document.createElement('div');
    bubble.className = 'deer-jump-bubble';
    bubble.textContent = '❄️ Wheee!!';
    bubble.style.left = cx + 'px';
    bubble.style.top  = cy + 'px';
    document.body.appendChild(bubble);
    setTimeout(() => bubble.remove(), 2500);

    // Snow cloud burst from below
    const clouds = ['❄️', '🌨️', '💨', '☁️'];
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        const cloud = document.createElement('div');
        cloud.className = 'deer-jump-cloud';
        cloud.textContent = clouds[Math.floor(Math.random() * clouds.length)];
        cloud.style.left = (cx + (Math.random() - 0.5) * 120) + 'px';
        cloud.style.top  = (cy + 30) + 'px';
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
        const dist  = 60 + Math.random() * 80;
        cloud.style.setProperty('--tx', Math.cos(angle) * dist + 'px');
        document.body.appendChild(cloud);
        setTimeout(() => cloud.remove(), 1000);
      }, i * 60);
    }

    // Motion trail
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        const trail = document.createElement('div');
        trail.className = 'deer-trail';
        trail.textContent = '🦌';
        trail.style.left = cx + 'px';
        trail.style.top  = (cy - i * 18) + 'px';
        trail.style.setProperty('--tx', (Math.random() - 0.5) * 20 + 'px');
        trail.style.setProperty('--ty', -(30 + i * 15) + 'px');
        document.body.appendChild(trail);
        setTimeout(() => trail.remove(), 900);
      }, i * 80);
    }
  }

  _buildPiano() {
    const scene = document.createElement('div');
    scene.className = 'piano-scene';
    scene.innerHTML = `
      <div class="piano-body">
        <div class="piano-lid"><span class="piano-logo">🎵 Grand</span></div>
        <div class="piano-keys-wrap">
          <div class="piano-white-keys">
            <div class="pwk"></div><div class="pwk"></div><div class="pwk"></div>
            <div class="pwk"></div><div class="pwk"></div><div class="pwk"></div>
            <div class="pwk"></div>
          </div>
          <div class="pbk" style="left:10.5%"></div>
          <div class="pbk" style="left:24.5%"></div>
          <div class="pbk" style="left:52.5%"></div>
          <div class="pbk" style="left:66.5%"></div>
          <div class="pbk" style="left:80.5%"></div>
        </div>
      </div>`;
    return scene;
  }
}
