export const GameState = {
  LOADING:           'LOADING',
  START:             'START',
  CAMERA_PROMPT:     'CAMERA_PROMPT',
  AR_INIT:           'AR_INIT',
  AR_ACTIVE:         'AR_ACTIVE',
  QUEST_ACTIVE:      'QUEST_ACTIVE',
  QUEST_COMPLETE:    'QUEST_COMPLETE',
  ALL_QUESTS_DONE:   'ALL_QUESTS_DONE',
  ERROR:             'ERROR',
  FALLBACK:          'FALLBACK',
};

export class StateMachine {
  constructor() {
    this.state = GameState.LOADING;
    this._listeners = new Map();
  }

  on(stateName, fn) {
    if (!this._listeners.has(stateName)) this._listeners.set(stateName, []);
    this._listeners.get(stateName).push(fn);
    return this;
  }

  transition(newState, data = {}) {
    console.log(`[State] ${this.state} → ${newState}`, data);
    this.state = newState;
    const handlers = this._listeners.get(newState) || [];
    handlers.forEach(fn => fn(data));
  }

  is(stateName) { return this.state === stateName; }

  isAny(...states) { return states.includes(this.state); }
}
