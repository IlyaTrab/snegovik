export const QUESTS = [
  {
    id:        'tap_snowman',
    title:     '🖐 Потрогай снеговика',
    desc:      'Нажми прямо на снеговика!',
    trigger:   'tap_body',
    animation: 'surprised',
    speechKey: 'tap',
    points:    30,
    hint:      'Просто нажми на снеговика на экране',
  },
  {
    id:        'tap_nose',
    title:     '🥕 Потрогай нос',
    desc:      'Нажми на оранжевый морковный нос!',
    trigger:   'tap_nose',
    animation: 'tapNose',
    speechKey: 'nose',
    points:    50,
    hint:      'Найди оранжевый нос снеговика и нажми на него',
  },
  {
    id:        'dance_quest',
    title:     '💃 Потанцуем!',
    desc:      'Нажми кнопку «Танцуй!» внизу',
    trigger:   'action_dance',
    animation: 'dance',
    speechKey: 'dance',
    points:    40,
    hint:      'Нажми большую кнопку «Танцуй!»',
  },
  {
    id:        'wave_quest',
    title:     '👋 Помаши снеговику!',
    desc:      'Нажми «Помаши!»',
    trigger:   'action_wave',
    animation: 'wave',
    speechKey: 'wave',
    points:    35,
    hint:      'Нажми кнопку «Помаши!» внизу экрана',
  },
  {
    id:        'sing_quest',
    title:     '🎵 Запой песенку!',
    desc:      'Нажми «Пой!» — снеговик запоёт!',
    trigger:   'action_sing',
    animation: 'sing',
    speechKey: 'sing',
    points:    45,
    hint:      'Нажми кнопку «Пой!»',
  },
];

export class QuestManager {
  constructor(onAllDone) {
    this._quests     = [...QUESTS];
    this._index      = 0;
    this._active     = null;
    this.totalScore  = 0;
    this._onAllDone  = onAllDone;
  }

  get active()      { return this._active; }
  get isFinished()  { return this._index >= this._quests.length; }
  get progress()    { return { done: this._index, total: this._quests.length }; }

  startNext() {
    if (this.isFinished) {
      this._onAllDone(this.totalScore);
      return null;
    }
    this._active = this._quests[this._index];
    return this._active;
  }

  // Returns the completed quest object, or false if trigger doesn't match
  checkTrigger(trigger) {
    if (!this._active || this._active.trigger !== trigger) return false;
    const completed   = this._active;
    this.totalScore  += completed.points;
    this._index++;
    this._active      = null;
    return completed;
  }
}
