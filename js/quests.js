/**
 * quests.js  —  Endless quest loop with combo system
 * Quests shuffle and repeat forever — no game-over state.
 */

export const QUEST_POOL = [
  {
    id:        'tap_body',
    title:     '🖐 Потрогай снеговика',
    desc:      'Нажми прямо на снеговика!',
    trigger:   'tap_body',
    anim:      'surprised',
    once:      true,
    speech:    'tap',
    points:    30,
    hint:      'Нажми на снеговика на экране',
  },
  {
    id:        'action_dance',
    title:     '💃 Потанцуй!',
    desc:      'Нажми кнопку «Танцуй!»',
    trigger:   'action_dance',
    anim:      'dance',
    once:      false,
    speech:    'dance',
    points:    40,
    hint:      'Нажми «Танцуй!» внизу',
  },
  {
    id:        'action_wave',
    title:     '👋 Помаши снеговику!',
    desc:      'Нажми кнопку «Помаши!»',
    trigger:   'action_wave',
    anim:      'wave',
    once:      false,
    speech:    'wave',
    points:    35,
    hint:      'Нажми «Помаши!»',
  },
  {
    id:        'action_sing',
    title:     '🎵 Запой песенку!',
    desc:      'Нажми кнопку «Пой!»',
    trigger:   'action_sing',
    anim:      'sing',
    once:      false,
    speech:    'sing',
    points:    45,
    hint:      'Нажми «Пой!»',
  },
  {
    id:        'walk_to',
    title:     '🚶 Позови сюда!',
    desc:      'Нажми на пустое место — снеговик придёт!',
    trigger:   'walk_to',
    anim:      'happy',
    once:      false,
    speech:    'greet',
    points:    50,
    hint:      'Нажми на пустое место вдали от снеговика',
  },
  {
    id:        'catch_star',
    title:     '⭐ Поймай звезду!',
    desc:      'Нажми на мерцающую звезду!',
    trigger:   'catch_star',
    anim:      'happy',
    once:      false,
    speech:    'questDone',
    points:    60,
    hint:      'Ищи мигающую золотую звезду рядом со снеговиком',
  },
  {
    id:        'double_tap',
    title:     '👆👆 Два раза!',
    desc:      'Нажми на снеговика дважды подряд!',
    trigger:   'double_tap',
    anim:      'dance',
    once:      false,
    speech:    'dance',
    points:    55,
    hint:      'Два быстрых нажатия на снеговика',
  },
  {
    id:        'tap_while_walk',
    title:     '🏃 Стоп!',
    desc:      'Нажми на снеговика пока он идёт!',
    trigger:   'tap_while_walk',
    anim:      'surprised',
    once:      false,
    speech:    'tap',
    points:    65,
    hint:      'Подожди пока снеговик пойдёт — и нажми на него',
  },
];

// ── Combo milestones ─────────────────────────────────────────
export const COMBO_MILESTONES = [3, 5, 7, 10];

export class QuestManager {
  constructor() {
    this._pool      = [...QUEST_POOL];
    this._queue     = [];
    this._active    = null;

    this.totalScore  = 0;
    this.questsDone  = 0;
    this.combo       = 0;
    this.maxCombo    = 0;
    this.multiplier  = 1;   // grows with combo

    this._refill();
  }

  get active() { return this._active; }

  // ── Start next quest (call after previous completes) ────────
  startNext() {
    if (this._queue.length < 2) this._refill();
    this._active = this._queue.shift();
    return this._active;
  }

  // ── Check if current trigger matches active quest ───────────
  // Returns result object if completed, false otherwise
  tryComplete(trigger) {
    if (!this._active || this._active.trigger !== trigger) return false;

    const q = this._active;
    this._active = null;

    // Combo and multiplier
    this.combo++;
    this.maxCombo   = Math.max(this.maxCombo, this.combo);
    this.multiplier = 1 + Math.floor(this.combo / 3) * 0.25; // +25% per 3 combo

    const basePoints = q.points;
    const bonus      = this.combo >= 3 ? Math.floor(basePoints * (this.multiplier - 1)) : 0;
    const earned     = basePoints + bonus;

    this.totalScore += earned;
    this.questsDone++;

    const isComboMilestone = COMBO_MILESTONES.includes(this.combo);

    return { quest: q, earned, bonus, combo: this.combo, multiplier: this.multiplier, isComboMilestone };
  }

  breakCombo() {
    this.combo      = 0;
    this.multiplier = 1;
  }

  _refill() {
    // Shuffle pool and append to queue
    const shuffled = [...this._pool].sort(() => Math.random() - 0.5);
    this._queue.push(...shuffled);
  }
}
