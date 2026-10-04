const assert = require('assert');

const moderation = require('../src/moderation');
const rateLimit = require('../src/rate-limit');
const gate = require('../src/gate');

let passed = 0;
let failed = 0;

const test = (name, fn) => {
  try {
    fn();
    passed += 1;
    console.log('  ok   ' + name);
  } catch (error) {
    failed += 1;
    console.log('  FAIL ' + name);
    console.log('       ' + error.message);
  }
};

const reset = () => {
  rateLimit.reset();
  gate.rateLimit.state.settings = Object.assign({}, rateLimit.DEFAULTS);
};

console.log('\nmoderation: clean text');

test('plain chat passes', () => {
  reset();
  assert.strictEqual(moderation.inspect('hey how are you').violation, false);
});

test('leetspeak free text passes', () => {
  reset();
  assert.strictEqual(moderation.inspect('class assignment bass guitar').violation, false);
});

test('links and handles are not profanity', () => {
  reset();
  assert.strictEqual(moderation.inspect('see https://example.com/ass or email a@b.com').violation, false);
});

console.log('\nmoderation: profanity');

test('plain profanity is caught', () => {
  reset();
  assert.strictEqual(moderation.inspect('what the fuck').violation, true);
});

test('dotted profanity is caught and flagged as obfuscated', () => {
  reset();
  const result = moderation.inspect('sh.ut the f.u.c.k up');
  assert.strictEqual(result.violation, true);
  assert.strictEqual(result.obfuscated, true);
});

test('spaced out profanity is caught', () => {
  reset();
  assert.strictEqual(moderation.inspect('f u c k').violation, true);
});

test('digit substitutions are caught', () => {
  reset();
  assert.strictEqual(moderation.inspect('sh1t').violation, true);
});

test('uppercase is caught', () => {
  reset();
  assert.strictEqual(moderation.inspect('FUCK').violation, true);
});

test('message hashes differ for different text', () => {
  reset();
  assert.notStrictEqual(moderation.inspect('hello').msgHash, moderation.inspect('goodbye').msgHash);
});

test('contact patterns are detected', () => {
  reset();
  assert.strictEqual(moderation.containsContact('add me on https://x.io'), true);
  assert.strictEqual(moderation.containsContact('just chatting'), false);
});

console.log('\nrate limit: token bucket');

test('a burst of five is allowed', () => {
  reset();
  for (let i = 0; i < 5; i += 1) {
    assert.strictEqual(rateLimit.consume('a').allowed, true, 'message ' + i);
  }
});

test('the sixth in a burst is refused', () => {
  reset();
  for (let i = 0; i < 5; i += 1) rateLimit.consume('a');
  const sixth = rateLimit.consume('a');
  assert.strictEqual(sixth.allowed, false);
  assert.ok(sixth.retryAfterMs > 0);
});

test('buckets are per identity', () => {
  reset();
  for (let i = 0; i < 5; i += 1) rateLimit.consume('a');
  assert.strictEqual(rateLimit.consume('b').allowed, true);
});

test('the bucket refills over time', () => {
  reset();
  const start = Date.now();
  for (let i = 0; i < 5; i += 1) rateLimit.consume('a', start);
  assert.strictEqual(rateLimit.consume('a', start).allowed, false);
  assert.strictEqual(rateLimit.consume('a', start + 15000).allowed, true);
});

console.log('\nstrike ladder');

test('strikes accumulate', () => {
  reset();
  assert.strictEqual(rateLimit.addStrike('a'), false);
  assert.strictEqual(rateLimit.addStrike('a'), false);
  assert.strictEqual(rateLimit.addStrike('a'), true);
});

test('a mute expires', () => {
  reset();
  const now = Date.now();
  rateLimit.addStrike('a');
  rateLimit.addStrike('a');
  rateLimit.addStrike('a');
  assert.ok(rateLimit.isMuted('a', now));
  assert.strictEqual(rateLimit.isMuted('a', now + rateLimit.state.settings.muteMs + 1), null);
});

console.log('\ngate: decisions');

test('empty messages are refused', () => {
  reset();
  assert.strictEqual(gate.check({ identity: 'a', text: '   ' }).reason, 'empty');
});

test('over-long messages are refused', () => {
  reset();
  const result = gate.check({ identity: 'a', text: 'x'.repeat(301) });
  assert.strictEqual(result.reason, 'too_long');
  assert.strictEqual(result.allowed, false);
});

test('a normal message is allowed', () => {
  reset();
  const result = gate.check({ identity: 'a', text: 'good morning all' });
  assert.strictEqual(result.allowed, true);
  assert.strictEqual(result.text, 'good morning all');
});

test('profanity returns a warning with a remaining count', () => {
  reset();
  const result = gate.check({ identity: 'a', text: 'this is bullshit' });
  assert.strictEqual(result.allowed, false);
  assert.strictEqual(result.reason, 'profanity');
  assert.strictEqual(result.strikes, 1);
  assert.strictEqual(result.remaining, 2);
});

test('the third strike mutes', () => {
  reset();
  gate.check({ identity: 'a', text: 'bullshit' });
  gate.check({ identity: 'a', text: 'bullshit' });
  const third = gate.check({ identity: 'a', text: 'bullshit' });
  assert.strictEqual(third.reason, 'muted');
  assert.strictEqual(third.muted, true);
  assert.ok(third.mutedUntil > Date.now());
});

test('a muted identity cannot send', () => {
  reset();
  gate.check({ identity: 'a', text: 'bullshit' });
  gate.check({ identity: 'a', text: 'bullshit' });
  gate.check({ identity: 'a', text: 'bullshit' });
  const blocked = gate.check({ identity: 'a', text: 'hello there' });
  assert.strictEqual(blocked.allowed, false);
  assert.strictEqual(blocked.reason, 'muted');
});

test('flooding mutes immediately', () => {
  reset();
  gate.rateLimit.state.settings.burst = 50;
  let result = null;
  for (let i = 0; i < gate.rateLimit.state.settings.floodBurst; i += 1) {
    result = gate.check({ identity: 'a', text: 'spam ' + i });
  }
  assert.strictEqual(result.reason, 'flood');
  assert.strictEqual(gate.stateOf('a').muted, true);
});

test('a soft rate limit is returned as slow_down', () => {
  reset();
  let result = null;
  for (let i = 0; i < 6; i += 1) result = gate.check({ identity: 'a', text: 'chatter ' + i });
  assert.strictEqual(result.reason, 'slow_down');
  assert.ok(result.retryAfterMs > 0);
});

test('stateOf reports the current standing', () => {
  reset();
  const before = gate.stateOf('a');
  assert.strictEqual(before.muted, false);
  assert.strictEqual(before.strikes, 0);
  gate.check({ identity: 'a', text: 'bullshit' });
  assert.strictEqual(gate.stateOf('a').strikes, 1);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);