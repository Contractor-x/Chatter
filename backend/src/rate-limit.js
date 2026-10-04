const DEFAULTS = {
  maxLength: 300,
  burst: 5,
  refillPerMinute: 4,
  floodBurst: 10,
  floodWindowMs: 10000,
  strikeLimit: 3,
  muteMs: 5 * 60 * 1000
};

const state = {
  settings: Object.assign({}, DEFAULTS),
  buckets: new Map(),
  hits: new Map(),
  muted: new Map(),
  strikes: new Map(),
  flood: new Map()
};

const reset = () => {
  state.buckets.clear();
  state.hits.clear();
  state.muted.clear();
  state.strikes.clear();
  state.flood.clear();
};

const nowMs = () => Date.now();

// Both maps hold arrays of { at }, so prune filters the list, not the record.
const prune = (map, windowMs, at) => {
  map.forEach((list, key) => {
    const kept = (list || []).filter(entry => at - entry.at <= windowMs);
    if (kept.length) map.set(key, kept);
    else map.delete(key);
  });
};

// Token bucket per identity. A burst is allowed immediately, then it refills.
const allowance = (identity, at = nowMs()) => {
  const { burst, refillPerMinute } = state.settings;
  const bucket = state.buckets.get(identity);
  const refillPerMs = refillPerMinute / 60000;

  if (!bucket) return burst;

  const refilled = Math.min(burst, bucket.tokens + (at - bucket.at) * refillPerMs);
  return Math.floor(refilled);
};

const consume = (identity, at = nowMs()) => {
  const { burst, refillPerMinute } = state.settings;
  const refillPerMs = refillPerMinute / 60000;
  const bucket = state.buckets.get(identity);
  const current = bucket
    ? Math.min(burst, bucket.tokens + (at - bucket.at) * refillPerMs)
    : burst;

  if (current < 1) {
    state.buckets.set(identity, { tokens: current, at });
    return { allowed: false, allowance: 0, retryAfterMs: Math.ceil((1 - current) / refillPerMs) };
  }

  state.buckets.set(identity, { tokens: current - 1, at });
  return { allowed: true, allowance: Math.floor(current - 1), retryAfterMs: 0 };
};

const isMuted = (identity, at = nowMs()) => {
  const until = state.muted.get(identity);
  if (!until) return null;
  if (until <= at) {
    state.muted.delete(identity);
    return null;
  }
  return until;
};

const strikeCount = (identity, at = nowMs()) => {
  prune(state.strikes, 30 * 60 * 1000, at);
  const list = state.strikes.get(identity) || [];
  return list.length;
};

const addStrike = (identity, at = nowMs()) => {
  prune(state.strikes, 30 * 60 * 1000, at);
  const list = state.strikes.get(identity) || [];
  list.push({ at });
  state.strikes.set(identity, list);

  if (list.length >= state.settings.strikeLimit) {
    state.muted.set(identity, at + state.settings.muteMs);
    state.strikes.set(identity, []);
    return true;
  }
  return false;
};

const recordFlood = (identity, at = nowMs()) => {
  prune(state.flood, state.settings.floodWindowMs, at);
  const list = state.flood.get(identity) || [];
  list.push({ at });
  state.flood.set(identity, list);
  return list.length >= state.settings.floodBurst;
};

const clearIdentity = identity => {
  state.buckets.delete(identity);
  state.hits.delete(identity);
  state.muted.delete(identity);
  state.strikes.delete(identity);
  state.flood.delete(identity);
};

module.exports = {
  DEFAULTS,
  state,
  reset,
  allowance,
  consume,
  isMuted,
  strikeCount,
  addStrike,
  recordFlood,
  clearIdentity,
  nowMs
};