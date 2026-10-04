const KEY = 'chatter.nickname';

const ADJECTIVES = [
  'Swift', 'Calm', 'Bright', 'Quiet', 'Bold', 'Keen', 'Warm', 'Lucky',
  'Clever', 'Brave', 'Nimble', 'Sunny'
];

const ANIMALS = [
  'Otter', 'Heron', 'Lynx', 'Finch', 'Badger', 'Falcon', 'Marten', 'Ibex',
  'Raven', 'Dolphin', 'Gecko', 'Puffin'
];

const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)];

export const randomNickname = (): string =>
  pick(ADJECTIVES) + pick(ANIMALS) + Math.floor(Math.random() * 90 + 10);

export const getNickname = (): string => {
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored && stored.length >= 2) return stored;
  } catch (error) {
    return randomNickname();
  }

  const generated = randomNickname();
  try {
    window.localStorage.setItem(KEY, generated);
  } catch (error) {
    return generated;
  }
  return generated;
};

export const setNickname = (value: string): string => {
  const trimmed = value.trim().replace(/\s+/g, ' ').slice(0, 24);
  const next = trimmed.length >= 2 ? trimmed : randomNickname();
  try {
    window.localStorage.setItem(KEY, next);
  } catch (error) {
    return next;
  }
  return next;
};