const PROFANITY_WORDS = new Set([
  'asshole',
  'bitch',
  'bullshit',
  'idiot',
  'cunt',
  'damn',
  'dick',
  'fuck',
  'fucker',
  'fucking',
  'motherfucker',
  'piss',
  'shit',
  'shitty',
  'slut',
  'whore',
  'animal',
  'bobo',
  'bobong',
  'bwisit',
  'demonyo',
  'engot',
  'gaga',
  'gago',
  'gagong',
  'hayop',
  'hinayupak',
  'hudas',
  'inutil',
  'kupal',
  'leche',
  'lintik',
  'olol',
  'pakshit',
  'pakyu',
  'peste',
  'punyeta',
  'puta',
  'putang',
  'putangina',
  'putek',
  'tanga',
  'tangina',
  'tarantado',
  'ulol',
  'tatanga',
]);

const PROFANITY_ROOTS = [
  'fuck',
  'shit',
  'bitch',
  'gago',
  'puta',
  'putangina',
  'tangina',
  'punyeta',
  'tarantado',
  'kupal',
  'pakyu',
  'ulol',
  'tanga',
  'bobo',
];

const LEET_MAP: Record<string, string> = {
  '@': 'a',
  '4': 'a',
  '8': 'b',
  '3': 'e',
  '1': 'i',
  '!': 'i',
  '0': 'o',
  '$': 's',
  '5': 's',
  '7': 't',
};

const SPECIAL_CHARS = ['*', '@', '#', '$'];

const normalizeWord = (word: string) =>
  word
    .toLowerCase()
    .replace(/[^\p{L}\p{N}@!$]/gu, '')
    .replace(/[@481!0$57]/g, (character) => LEET_MAP[character] || character)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const isProfaneWord = (word: string) => {
  const normalized = normalizeWord(word);
  if (!normalized) return false;

  return PROFANITY_WORDS.has(normalized) || PROFANITY_ROOTS.some((root) => normalized.startsWith(root) && normalized.length <= root.length + 4);
};

const censorWord = (word: string) => {
  const characters = Array.from(word);
  if (characters.length <= 2) return characters.map((_, index) => SPECIAL_CHARS[index % SPECIAL_CHARS.length]).join('');

  return characters
    .map((character, index) => {
      if (!/[\p{L}\p{N}@!$]/u.test(character)) return character;
      if (index === 0 || index === characters.length - 1) return character;
      return SPECIAL_CHARS[index % SPECIAL_CHARS.length];
    })
    .join('');
};

export const censorProfanity = (value: unknown) => {
  if (typeof value !== 'string' || !value) return '';
  return value.replace(/[\p{L}\p{N}@!$]+(?:[-_.'][\p{L}\p{N}@!$]+)*/gu, (word) => (isProfaneWord(word) ? censorWord(word) : word));
};
