// Text helpers shared by the collectors and writers.

const TITLE_MAX_CHARS = 80;

// House style for anything a feed or a model wrote: no em or en dashes, no
// exclamation marks, no stray whitespace. URLs never go through this.
export function cleanText(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\s*\u2014\s*/g, ', ')
    .replace(/\u2013/g, '-')
    .replace(/!+/g, '.')
    .replace(/…/g, '...')
    // "sectors.Researchers": a model or a feed dropped the space after a sentence.
    .replace(/([a-z]{2,}[.?!])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

const DANGLING_WORDS = /\s+(?:and|or|but|with|for|to|of|in|on|at|by|as|the|a|an|its|their)$/i;

export function trimTitle(value, max = TITLE_MAX_CHARS) {
  const title = cleanText(value).replace(/\.$/, '');
  if (title.length <= max) return title;
  const cut = title.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  let out = (lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).replace(/[\s,:;]+$/, '');
  // Cutting at a word boundary can leave "... partnerships and"; drop the hanger.
  while (DANGLING_WORDS.test(out)) out = out.replace(DANGLING_WORDS, '');
  return out;
}

// Acronyms a lowercase-happy model flattens. Whole words only, so "aid" survives.
export function fixAcronyms(value) {
  return cleanText(value).replace(/\b(ai)\b/gi, 'AI').replace(/\b(u\.s\.)/gi, 'U.S.');
}

// First letter up, the rest as written, so proper nouns survive.
export function sentenceCase(value) {
  const s = cleanText(value);
  return s ? s[0].toUpperCase() + s.slice(1) : '';
}

export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

// True when a feed or a page cut the text short ("... " at the end).
export function endsCut(value) {
  return /(\.\.\.|…)\s*$/.test(String(value || '').trim());
}

// Keeps whole sentences up to the limits. A snippet that was cut mid-sentence by its
// source is returned as is when it is the only sentence, since there is no clean
// place to stop; after a whole sentence, a cut fragment is dropped instead.
export function clipSentences(value, maxSentences = 2, maxChars = 320) {
  const text = cleanText(value);
  if (!text) return '';
  const sentences = text.match(/[^.?!]+[.?!]+["')\]]*\s*|[^.?!]+$/g) || [text];
  const pieces = [];
  let length = 0;
  for (const sentence of sentences) {
    const piece = sentence.trim();
    const nextLength = length ? length + 1 + piece.length : piece.length;
    if (pieces.length && (nextLength > maxChars || pieces.length >= maxSentences)) break;
    if (!pieces.length && nextLength > maxChars) {
      const cut = piece.slice(0, maxChars);
      const lastSpace = cut.lastIndexOf(' ');
      return `${cut.slice(0, lastSpace > maxChars / 2 ? lastSpace : maxChars).replace(/[\s,;:]+$/, '')}.`;
    }
    pieces.push(piece);
    length = nextLength;
  }
  if (pieces.length > 1 && endsCut(pieces[pieces.length - 1])) pieces.pop();
  return pieces.join(' ');
}

// Words the house style keeps out of anything a model writes: filler that reads as
// machine copy. Whole words, with their usual endings.
const BANNED_WORDS =
  /\b(delv(e|es|ing)|crucial|robust|comprehensive|nuanced|multifaceted|furthermore|moreover|additionally|pivotal|landscapes?|tapestry|underscor(e|es|ing)|foster(s|ing)?|showcas(e|es|ing)|intricate|vibrant|fundamental|significant(ly)?|elevat(e|es|ing)|seamless(ly)?|unleash(es|ing)?|next-gen|game-chang(er|ing)|cutting-edge|groundbreaking|leverag(e|es|ing)|empower(s|ing)?|synergy|holistic|unlock(s|ing)?|harness(es|ing)?|revolutioniz(e|es|ing)|revolutionary|transformative|world-class|state-of-the-art)\b/i;

export function hasBannedWord(value) {
  return BANNED_WORDS.test(String(value || ''));
}

export const BANNED_WORD_LIST =
  'delve, crucial, robust, comprehensive, nuanced, multifaceted, furthermore, moreover, additionally, pivotal, landscape, tapestry, underscore, foster, showcase, intricate, vibrant, fundamental, significant, elevate, seamless, unleash, next-gen, game-changer, cutting-edge, groundbreaking, leverage, empower, synergy, holistic, unlock, harness, revolutionize, transformative, world-class, state-of-the-art';

// Trailing " - Publisher" or " | Publisher" that feeds append to headlines.
export function stripPublisherSuffix(headline, publisher) {
  const h = cleanText(headline);
  const p = cleanText(publisher);
  if (!p) return h;
  const pattern = new RegExp(`\\s*[-|:]\\s*${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');
  return h.replace(pattern, '').trim();
}

export function formatShortDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
