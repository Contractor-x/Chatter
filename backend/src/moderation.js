const crypto = require('crypto');

const WORDS = [
  'fuck', 'fucking', 'fucker', 'shit', 'shitty', 'bitch', 'bastard', 'asshole',
  'dick', 'cock', 'pussy', 'cunt', 'whore', 'slut', 'faggot', 'retard',
  'nigger', 'nigga', 'coon', 'spic', 'chink', 'kike', 'tranny', 'twat', 'wanker',
  'motherfucker', 'jackass', 'dumbass', 'dipshit', 'bullshit', 'goddamn'
];

const SAFE = ['scunthorpe', 'shitake', 'bass', 'crap', 'butt', 'tittie', 'anal', 'class', 'assignment'];

const escapeRe = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const collapse = value =>
  String(value == null ? '' : value)
    .toLowerCase()
    .replace(/[\s\W_]+/g, '')
    .replace(/[0@]/g, 'o')
    .replace(/[1!|]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[4]/g, 'a')
    .replace(/[5$]/g, 's')
    .replace(/[7]/g, 't');

// Catches "f.u.c.k", "sh1t", "f u c k" and the leetspeak variants.
const obfuscated = new RegExp('(?:' + WORDS.map(w => collapse(w)).join('|') + ')', 'g');
const plain = new RegExp('\\b(' + WORDS.join('|') + ')\\b', 'gi');

const SAFE_STRIPPED = new RegExp(SAFE.map(escapeRe).join('|'), 'g');

const hash = value =>
  crypto
    .createHash('sha256')
    .update(String(value == null ? '' : value))
    .digest('hex')
    .slice(0, 32);

const inspect = text => {
  const raw = String(text == null ? '' : text);
  const squashed = collapse(raw).replace(SAFE_STRIPPED, ' ');

  const plainHit = raw.match(plain);
  if (plainHit) {
    return {
      violation: true,
      obfuscated: false,
      match: plainHit[0],
      normalized: plainHit[0].toLowerCase(),
      msgHash: hash(raw),
      matchHash: hash(plainHit[0].toLowerCase())
    };
  }

  const squashedHit = squashed.match(obfuscated);
  if (squashedHit) {
    return {
      violation: true,
      obfuscated: true,
      match: squashedHit[0],
      normalized: squashedHit[0],
      msgHash: hash(raw),
      matchHash: hash(squashedHit[0])
    };
  }

  return { violation: false, obfuscated: false, match: null, msgHash: hash(raw) };
};

const containsContact = text =>
  /(https?:\/\/|www\.)/i.test(text) ||
  /[\w.+-]+@[\w-]+\.[\w.]+/.test(text) ||
  /\b(?:\+?\d[\d\s().-]{7,}\d)\b/.test(text);

module.exports = { inspect, containsContact, hash, WORDS };