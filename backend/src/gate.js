const moderation = require('./moderation');
const rateLimit = require('./rate-limit');

// Single entry point for every outgoing message.
// Returns { allowed, reason, ... } and never throws.
const check = ({ identity, text, now = Date.now() }) => {
  const raw = String(text == null ? '' : text);
  const trimmed = raw.trim();

  if (!trimmed) return { allowed: false, reason: 'empty', message: 'Type something first.' };

  if (trimmed.length > rateLimit.state.settings.maxLength) {
    return {
      allowed: false,
      reason: 'too_long',
      message: 'Keep it under ' + rateLimit.state.settings.maxLength + ' characters.'
    };
  }

  const mutedUntil = rateLimit.isMuted(identity, now);
  if (mutedUntil) {
    return {
      allowed: false,
      reason: 'muted',
      mutedUntil,
      message: 'You are muted for another ' + Math.ceil((mutedUntil - now) / 1000) + 's.'
    };
  }

  const bucket = rateLimit.consume(identity, now);
  if (!bucket.allowed) {
    return {
      allowed: false,
      reason: 'slow_down',
      retryAfterMs: bucket.retryAfterMs,
      allowance: 0,
      message: 'Slow down a little.'
    };
  }

  const flood = rateLimit.recordFlood(identity, now);
  if (flood) {
    const mutedUntil = now + rateLimit.state.settings.muteMs;
    rateLimit.clearIdentity(identity);
    rateLimit.state.muted.set(identity, mutedUntil);
    return {
      allowed: false,
      reason: 'flood',
      muted: true,
      mutedUntil,
      message: 'Too many messages at once. Take a breath.'
    };
  }

  const profanity = moderation.inspect(trimmed);
  if (profanity.violation) {
    const muted = rateLimit.addStrike(identity, now);
    const strikes = muted ? rateLimit.state.settings.strikeLimit : rateLimit.strikeCount(identity, now);

    if (muted) {
      return {
        allowed: false,
        reason: 'muted',
        muted: true,
        mutedUntil: now + rateLimit.state.settings.muteMs,
        strikes,
        message:
          'Language like that gets you muted. You are out for ' +
          rateLimit.state.settings.muteMs / 60000 +
          ' minutes.'
      };
    }

    return {
      allowed: false,
      reason: 'profanity',
      obfuscated: profanity.obfuscated,
      strikes,
      remaining: rateLimit.state.settings.strikeLimit - strikes,
      message: 'Watch the language.'
    };
  }

  return {
    allowed: true,
    text: trimmed,
    obfuscated: false,
    allowance: bucket.allowance,
    strikes: rateLimit.strikeCount(identity, now)
  };
};

const stateOf = identity => {
  const now = Date.now();
  const mutedUntil = rateLimit.isMuted(identity, now);
  return {
    muted: Boolean(mutedUntil),
    mutedUntil: mutedUntil || null,
    strikes: rateLimit.strikeCount(identity, now),
    strikeLimit: rateLimit.state.settings.strikeLimit,
    allowance: rateLimit.allowance(identity, now)
  };
};

module.exports = { check, stateOf, moderation, rateLimit };