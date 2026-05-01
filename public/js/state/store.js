// state/store.js - Centralized application state with event-based subscription

const _listeners = {};

const _state = {
  videos: [],
  downloadingCount: 0,
  completedCount: 0,
  versions: { medis: 'loading...', ytdlp: 'loading...' }
};

/** Get a shallow copy of the current state (or a specific key) */
export function getState(key) {
  if (key !== undefined) return _state[key];
  return { ..._state };
}

/** Update one or more state properties and emit the corresponding event */
export function setState(event, partial) {
  Object.assign(_state, partial);
  _emit(event);
}

/** Subscribe to a state event */
export function subscribe(event, callback) {
  if (!_listeners[event]) _listeners[event] = [];
  _listeners[event].push(callback);
  return () => {
    _listeners[event] = _listeners[event].filter(cb => cb !== callback);
  };
}

/** Emit an event to all subscribers */
function _emit(event) {
  const handlers = _listeners[event];
  if (!handlers) return;
  for (const fn of handlers) {
    try { fn(_state); } catch (e) { console.error(`[Store] Error in ${event} handler:`, e); }
  }
}
