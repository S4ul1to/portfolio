// Fetches an article page once and reads what the newsletter needs from its <meta>
// tags: the social image, the publisher's own description, the title and the date.
// Never throws. Bounded in time (6 s) and in bytes (300 KB of the head of the page).

const TIMEOUT_MS = 6000;
const SCAN_BYTES = 300 * 1024;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const IMAGE_KEYS = ['og:image', 'og:image:secure_url', 'og:image:url', 'twitter:image', 'twitter:image:src'];
const DESCRIPTION_KEYS = ['og:description', 'twitter:description', 'description'];
const TITLE_KEYS = ['og:title', 'twitter:title'];
const SITE_KEYS = ['og:site_name'];
const PUBLISHED_KEYS = ['article:published_time', 'og:article:published_time', 'datepublished', 'date', 'pubdate'];
const TYPE_KEYS = ['og:type'];
const WANTED = new Set([
  ...IMAGE_KEYS, ...DESCRIPTION_KEYS, ...TITLE_KEYS, ...SITE_KEYS, ...PUBLISHED_KEYS, ...TYPE_KEYS,
  'og:image:width', 'og:image:height',
]);
// A page that redirected here is a sign-in or subscription wall, not the article.
const WALL_PATH = /(^|\/)(log-?in|sign-?in|signup|sign-up|subscribe|subscription|paywall|account|auth)(\/|$|\.)/i;

export function decodeEntities(value) {
  return String(value)
    .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&');
}

// Walks every <meta> tag and reads its attributes, so the order of property and
// content does not matter. First occurrence of each key wins.
export function readMeta(html) {
  const found = new Map();
  const tagPattern = /<meta\b[^>]*>/gi;
  const attrPattern = /([a-zA-Z:_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let tag;
  while ((tag = tagPattern.exec(html)) !== null) {
    const attrs = {};
    attrPattern.lastIndex = 0;
    let attr;
    while ((attr = attrPattern.exec(tag[0])) !== null) {
      attrs[attr[1].toLowerCase()] = attr[2] ?? attr[3] ?? attr[4] ?? '';
    }
    const key = String(attrs.property || attrs.name || attrs.itemprop || '').toLowerCase();
    const content = typeof attrs.content === 'string' ? attrs.content.trim() : '';
    if (content && WANTED.has(key) && !found.has(key)) found.set(key, decodeEntities(content));
  }
  const first = (keys) => {
    for (const key of keys) if (found.has(key)) return found.get(key);
    return '';
  };
  return {
    image: first(IMAGE_KEYS),
    imageWidth: Number(found.get('og:image:width')) || 0,
    imageHeight: Number(found.get('og:image:height')) || 0,
    description: first(DESCRIPTION_KEYS),
    title: first(TITLE_KEYS),
    siteName: first(SITE_KEYS),
    published: first(PUBLISHED_KEYS),
    type: first(TYPE_KEYS).toLowerCase(),
  };
}

// An https image url for the email, or null. A square or portrait picture would run
// 600px tall or more in the story column, so when the page declares the size anything
// taller than 3:4 is skipped. Publishers still emit http image urls on https pages;
// mail clients block mixed content, so the scheme is upgraded rather than dropped.
export function pickImage(meta, baseUrl) {
  if (!meta.image) return null;
  if (meta.imageWidth > 0 && meta.imageHeight > 0 && meta.imageHeight / meta.imageWidth > 0.75) return null;
  try {
    const resolved = new URL(meta.image, baseUrl);
    if (resolved.protocol === 'http:') resolved.protocol = 'https:';
    return resolved.protocol === 'https:' ? resolved.href : null;
  } catch {
    return null;
  }
}

// Reads at most `limit` bytes of the body, then cancels the rest.
async function readHead(response, limit) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let text = '';
  let bytes = 0;
  try {
    while (bytes < limit) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return text;
}

const EMPTY = {
  ok: false, status: 0, image: null, description: '', title: '', siteName: '', published: '', type: '', nonHtml: false,
};

function discard(response) {
  return Promise.resolve(response.body?.cancel()).catch(() => {});
}

/**
 * Fetch a page and read its metadata. Never throws.
 * @param {string} pageUrl
 * @param {AbortSignal} [signal]  cancels the request early (the browser went away)
 * @returns {Promise<{ ok: boolean, status: number, image: string|null, description: string, title: string, siteName: string, published: string, type: string, nonHtml: boolean }>}
 *   `type` is the page's og:type when it declares one ("article", "website", ...).
 *   `nonHtml` marks a 200 that was not a web page (a PDF, a JSON document).
 *   A redirect to a sign-in or subscription wall comes back as a 403 with no
 *   picture or description, so nothing from the wall page reaches the email.
 */
export async function fetchPageInfo(pageUrl, signal) {
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  try {
    const response = await fetch(pageUrl, {
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      redirect: 'follow',
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
      },
    });
    const type = response.headers.get('content-type') || '';
    if (!response.ok) {
      await discard(response);
      return { ...EMPTY, status: response.status };
    }
    if (type && !/html|xml/i.test(type)) {
      await discard(response);
      return { ...EMPTY, ok: true, status: response.status, nonHtml: true };
    }
    let landedOnWall = false;
    try {
      landedOnWall = response.redirected && WALL_PATH.test(new URL(response.url).pathname);
    } catch {
      landedOnWall = false;
    }
    if (landedOnWall) {
      await discard(response);
      return { ...EMPTY, status: 403 };
    }
    const html = await readHead(response, SCAN_BYTES);
    const meta = readMeta(html);
    return {
      ok: true,
      status: response.status,
      image: pickImage(meta, response.url || pageUrl),
      description: meta.description,
      title: meta.title,
      siteName: meta.siteName,
      published: meta.published,
      type: meta.type,
      nonHtml: false,
    };
  } catch {
    return { ...EMPTY };
  }
}
