export class UIManager {
  constructor() {
    this._screens = {};
    document.querySelectorAll('.screen').forEach(el => {
      this._screens[el.id] = el;
    });

    this._scoreEl        = document.getElementById('score-value');
    this._hintEl         = document.getElementById('hint-text');
    this._speechEl       = document.getElementById('speech-bubble');
    this._speechTextEl   = document.getElementById('speech-text');
    this._questPanel     = document.getElementById('quest-panel');
    this._questTitleEl   = document.getElementById('quest-title-text');
    this._questDescEl    = document.getElementById('quest-desc-text');
    this._speechTimer    = null;
  }

  // ── Screen control ──────────────────────────────────────
  showScreen(id) {
    Object.values(this._screens).forEach(s => {
      s.classList.remove('active');
      s.style.display = '';
    });
    const el = this._screens[id];
    if (el) { el.style.display = 'flex'; el.classList.add('active'); }
  }

  showOverlay(id) {
    const el = this._screens[id];
    if (el) { el.style.display = 'flex'; el.classList.add('active'); }
  }

  hideOverlay(id) {
    const el = this._screens[id];
    if (el) { el.style.display = 'none'; el.classList.remove('active'); }
  }

  // ── Score ───────────────────────────────────────────────
  updateScore(score) {
    this._scoreEl.textContent = score;
    this._scoreEl.style.animation = 'none';
    requestAnimationFrame(() => { this._scoreEl.style.animation = 'countPop 0.3s ease'; });
  }

  // ── Hint ────────────────────────────────────────────────
  setHint(text) { this._hintEl.textContent = text; }

  // ── Speech bubble ───────────────────────────────────────
  showSpeech(text, duration = 2800) {
    if (this._speechTimer) clearTimeout(this._speechTimer);
    this._speechTextEl.textContent = text;
    this._speechEl.classList.remove('hidden');
    this._speechTimer = setTimeout(() => this._speechEl.classList.add('hidden'), duration);
  }

  // ── Quest panel ─────────────────────────────────────────
  showQuestPanel(quest) {
    this._questTitleEl.textContent = quest.title;
    this._questDescEl.textContent  = quest.desc;
    this._questPanel.classList.remove('hidden');
  }

  hideQuestPanel() {
    this._questPanel.classList.add('hidden');
  }

  // ── Quest complete overlay ──────────────────────────────
  showQuestComplete(quest) {
    document.getElementById('quest-complete-title').textContent = quest.title + ' — выполнено!';
    document.getElementById('points-earned').textContent = '+' + quest.points;
    this.showOverlay('screen-quest-complete');
  }

  // ── Final reward ─────────────────────────────────────────
  showFinalReward(score) {
    document.getElementById('final-score').textContent = score + ' очков';
    const stars = Math.max(1, Math.min(5, Math.ceil(score / 40)));
    document.getElementById('achievement-stars').textContent = '⭐'.repeat(stars);
    this.showScreen('screen-reward');
  }

  // ── Error ────────────────────────────────────────────────
  showError(title, msg) {
    document.getElementById('error-title').textContent = title;
    document.getElementById('error-msg').textContent   = msg;
    this.showScreen('screen-error');
  }

  // ── Particles ────────────────────────────────────────────
  spawnTapRipple(x, y) {
    const el = document.createElement('div');
    el.className = 'tap-ripple';
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 500);
  }

  spawnSnowflake() {
    const el = document.createElement('div');
    el.className = 'snowflake-particle';
    el.textContent = ['❄', '❅', '❆', '⭐', '✨'][Math.floor(Math.random() * 5)];
    el.style.left = (Math.random() * 96 + 2) + 'vw';
    el.style.fontSize = (14 + Math.random() * 16) + 'px';
    const dur = 2.5 + Math.random() * 3;
    el.style.animationDuration = dur + 's';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), dur * 1000);
  }

  spawnCelebration(count = 25) {
    for (let i = 0; i < count; i++) {
      setTimeout(() => this.spawnSnowflake(), i * 80);
    }
  }
}
