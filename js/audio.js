export class AudioManager {
  constructor() {
    this._ctx     = null;
    this.enabled  = false;
    this._lines   = {
      greet:      ['Привет, друг!', 'Ура, ты здесь!', 'Какой морозный день!'],
      dance:      ['Потанцуем?', 'Я люблю танцевать!', 'Давай вместе!'],
      sing:       ['Ля-ля-ля!', 'Зимняя песенка!', 'Тра-ля-ля-ля!'],
      wave:       ['Привет-привет!', 'Я тебя вижу!', 'Помашем вместе!'],
      throw:      ['Лови снежок!', 'Сейчас брошу!', 'Снежный залп!'],
      questStart: ['Новое задание!', 'Попробуй это!', 'Вот задание!'],
      questDone:  ['Молодец!', 'Ты справился!', 'Отлично!'],
      nose:       ['Ой, мой нос!', 'Хи-хи, щекотно!', 'Холодный!'],
      tap:        ['Привет!', 'Хи-хи!', 'Ой!'],
      win:        ['Ты лучший!', 'Победа!', 'Ура-ура-ура!'],
    };
  }

  init() {
    try {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.enabled = true;
    } catch (e) {
      console.warn('[Audio] Web Audio not supported');
    }
  }

  resume() {
    if (this._ctx && this._ctx.state === 'suspended') this._ctx.resume();
  }

  getLine(key) {
    const arr = this._lines[key] || ['...'];
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // Synthesise a simple tone
  _tone(freq, dur = 0.2, type = 'sine', vol = 0.28) {
    if (!this.enabled || !this._ctx) return;
    const osc  = this._ctx.createOscillator();
    const gain = this._ctx.createGain();
    osc.connect(gain);
    gain.connect(this._ctx.destination);
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, this._ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this._ctx.currentTime + dur);
    osc.start();
    osc.stop(this._ctx.currentTime + dur);
  }

  playTap() {
    this._tone(440, 0.08);
    setTimeout(() => this._tone(660, 0.08), 70);
  }

  playSuccess() {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this._tone(f, 0.22), i * 90)
    );
  }

  playReward() {
    [523, 587, 659, 698, 784, 880, 988, 1047].forEach((f, i) =>
      setTimeout(() => this._tone(f, 0.28), i * 75)
    );
  }

  playError() {
    this._tone(200, 0.35, 'sawtooth', 0.2);
  }
}
