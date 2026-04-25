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
  throwSnowball(fromX, fromY) {
    const toX = window.innerWidth  * (0.25 + Math.random() * 0.5);
    const toY = window.innerHeight * (0.20 + Math.random() * 0.45);

    const ball = document.createElement('div');
    ball.className = 'snowball-fx';
    ball.style.left = fromX + 'px';
    ball.style.top  = fromY + 'px';
    ball.style.setProperty('--tx', (toX - fromX) + 'px');
    ball.style.setProperty('--ty', (toY - fromY) + 'px');
    document.body.appendChild(ball);

    setTimeout(() => {
      ball.remove();
      const splat = document.createElement('div');
      splat.className = 'snowball-splat';
      splat.textContent = '❄';
      splat.style.left = toX + 'px';
      splat.style.top  = toY + 'px';
      document.body.appendChild(splat);
      setTimeout(() => splat.remove(), 2000);
    }, 560);
  }

  magicSnowfall() {
    let count = 0;
    const max = 45;
    const iv = setInterval(() => {
      this.spawnSnowflake();
      if (++count >= max) clearInterval(iv);
    }, 70);
  }

  danceSparkles(cx, cy) {
    const emojis = ['✨', '⭐', '💫', '🌟', '🎉', '🎊', '🌈'];
    for (let i = 0; i < 14; i++) {
      setTimeout(() => {
        const el = document.createElement('div');
        el.className = 'dance-sparkle';
        el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        const angle = (i / 14) * Math.PI * 2 + Math.random() * 0.4;
        const dist  = 55 + Math.random() * 90;
        el.style.left = cx + 'px';
        el.style.top  = cy + 'px';
        el.style.setProperty('--tx', Math.cos(angle) * dist + 'px');
        el.style.setProperty('--ty', Math.sin(angle) * dist + 'px');
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 1000);
      }, i * 55);
    }
  }

  singNotes(cx, cy) {
    const notes = ['♩', '♪', '♫', '♬', '🎵', '🎶'];
    for (let i = 0; i < 9; i++) {
      setTimeout(() => {
        const el = document.createElement('div');
        el.className = 'sing-note';
        el.textContent = notes[Math.floor(Math.random() * notes.length)];
        const offsetX = (Math.random() - 0.5) * 110;
        el.style.left = cx + 'px';
        el.style.top  = cy + 'px';
        el.style.setProperty('--tx', offsetX + 'px');
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 1500);
      }, i * 110);
    }
  }
}
