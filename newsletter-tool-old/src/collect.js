// Keyless web collection.
//
// Bing News publishes an RSS feed for any search, with the publisher name, a snippet,
// the publication date and a picture. Its links are click trackers that carry the real
// article url in a query parameter, so the publisher url is read straight out of the
// link. Each candidate page is then fetched once: a page that answers proves the link
// works and supplies its own picture and description for the email.

import { fetchPageInfo } from './page.js';
import { cleanText, clipSentences, endsCut, formatShortDate, hostOf, stripPublisherSuffix } from './text.js';

const FEED_URL = 'https://www.bing.com/news/search';
const FEED_TIMEOUT_MS = 10000;
const MAX_AGE_DAYS = 30;
const MIN_STORIES = 3;
const MAX_STORIES = 5;
const CANDIDATES = 10;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

// The feed is plain XML without CDATA; entities are the five XML ones plus numeric.
function decodeXml(value) {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function tagText(item, name) {
  const m = item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decodeXml(m[1]).trim() : '';
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// Bing's click tracker keeps the destination in ?url=. Anything else is used as is.
export function publisherUrl(link) {
  try {
    const url = new URL(link);
    const target = /(^|\.)bing\.com$/i.test(url.hostname) ? url.searchParams.get('url') : null;
    const out = new URL(target || url.href);
    if (out.protocol !== 'http:' && out.protocol !== 'https:') return '';
    out.hash = '';
    return out.href;
  } catch {
    return '';
  }
}

// Bing serves the article picture at any size. Pictures smaller than the email column
// are skipped so nothing is upscaled; the page's own og:image is preferred anyway.
function thumbnailUrl(raw, maxWidth, maxHeight) {
  if (!raw || maxWidth < 600 || maxHeight < 300) return null;
  try {
    const url = new URL(raw);
    url.protocol = 'https:';
    url.searchParams.set('w', '1200');
    url.searchParams.set('h', '630');
    url.searchParams.set('c', '14');
    return url.href;
  } catch {
    return null;
  }
}

export function parseFeed(xml) {
  return String(xml)
    .split(/<item>/i)
    .slice(1)
    .map((chunk) => chunk.split(/<\/item>/i)[0])
    .map((item) => {
      const source = tagText(item, 'News:Source');
      const title = stripPublisherSuffix(stripTags(tagText(item, 'title')), source);
      const publishedAt = new Date(tagText(item, 'pubDate'));
      return {
        title,
        url: publisherUrl(tagText(item, 'link')),
        snippet: cleanText(stripTags(tagText(item, 'description'))),
        publishedAt: Number.isNaN(publishedAt.getTime()) ? null : publishedAt,
        source,
        thumbnail: thumbnailUrl(
          tagText(item, 'News:Image'),
          Number(tagText(item, 'News:ImageMaxWidth')),
          Number(tagText(item, 'News:ImageMaxHeight')),
        ),
      };
    })
    .filter((item) => item.title && item.url);
}

async function fetchFeed(topic, params, signal) {
  const url = new URL(FEED_URL);
  url.searchParams.set('q', topic);
  url.searchParams.set('format', 'RSS');
  url.searchParams.set('setlang', 'en');
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const timeout = AbortSignal.timeout(FEED_TIMEOUT_MS);
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    headers: { 'user-agent': USER_AGENT, accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8' },
  });
  if (!response.ok) throw new Error(`Bing News answered ${response.status}.`);
  return parseFeed(await response.text());
}

function titleKey(title) {
  return cleanText(title).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Syndicated copies of one article often differ only by a trailing clause ("... to
// Prepare Students for What's Next"). Two keys are the same story when one starts
// with the other and the shorter is long enough to be more than a few words.
const SAME_STORY_MIN_CHARS = 40;

function sameStory(keyA, keyB) {
  if (!keyA || !keyB) return false;
  if (keyA === keyB) return true;
  const [shorter, longer] = keyA.length <= keyB.length ? [keyA, keyB] : [keyB, keyA];
  return shorter.length >= SAME_STORY_MIN_CHARS && longer.startsWith(shorter);
}

// Listing pages that Bing sometimes indexes as news: a publisher's tag or topic
// archive, an author page, a college profile. Not articles, so never the lead story.
// Only the archive itself matches (/tag/quantum-computing, /colleges/biola-university);
// an article filed under such a segment has more path after it and does not.
const LISTING_PATH = /\/(tags?|topics?|categor(?:y|ies)|authors?|colleges|profiles?|search|sections?)(?:\/[^/]+)?\/?$/i;

function looksLikeSlug(title) {
  const t = cleanText(title);
  return !t.includes(' ') && /-/.test(t);
}

// 0: an article page. 1: a page that calls itself something else (og:type website,
// profile, video) but has an ordinary headline; some publishers mark every page
// that way, so these rank after articles rather than being dropped. 2: a listing
// page, a bare slug for a headline, or a 200 that was not a web page.
function pageTier(item, page) {
  let path = '';
  try {
    path = new URL(item.url).pathname;
  } catch {
    path = '';
  }
  if (page.nonHtml || LISTING_PATH.test(path) || looksLikeSlug(item.title)) return 2;
  if (page.type && !/article|news/i.test(page.type)) return 1;
  return 0;
}

function pathKey(url) {
  try {
    const u = new URL(url);
    return `${u.hostname.toLowerCase().replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '').toLowerCase()}`;
  } catch {
    return url;
  }
}

// Function words, and the words people add to a topic that say nothing about it.
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'for', 'to', 'at', 'by', 'with', 'from', 'about', 'into',
  'over', 'under', 'vs', 'versus', 'is', 'are', 'be', 'as', 'its', 'their', 'how', 'why', 'what', 'all', 'any',
  'this', 'that', 'these', 'those', 'new', 'latest', 'recent', 'today', 'top', 'best', 'news', 'story', 'stories',
  'headlines', 'coverage', 'update', 'updates', 'report', 'reports', 'topic', 'topics', 'newsletter',
]);

// A word's stem, so plurals and verb forms still count: "sustainability" and
// "sustainable" both match "sustai", "universities" matches "univer".
function stem(word) {
  if (word.length > 6) return word.slice(0, 6);
  if (word.length === 6) return word.slice(0, 5);
  return word;
}

// Topic words worth matching. Two-letter words count when the topic wrote them as
// an acronym (AI, EV, UK); "ai" always counts, since that is what the stories say.
export function topicTerms(topic) {
  const clean = cleanText(topic);
  const words = clean
    .split(/[^A-Za-z0-9]+/)
    .filter((w0) => {
      const w = w0.toLowerCase();
      return (w.length >= 3 || w === 'ai' || /^[A-Z0-9]{2}$/.test(w0)) && !STOPWORDS.has(w);
    })
    .map((w0) => w0.toLowerCase());
  const terms = new Set(words.map(stem));
  if (words.includes('artificial') && words.includes('intelligence')) terms.add('ai');
  return [...terms];
}

// Which topic terms the headline and snippet mention. Short terms must match a
// whole word, so "ai" does not match "aid".
function matchedTerms(item, terms) {
  const text = `${item.title} ${item.snippet}`.toLowerCase();
  return terms.filter((t) => new RegExp(t.length <= 3 ? `\\b${t}\\b` : `\\b${t}`, 'i').test(text));
}

// Words that name a kind of thing rather than the thing: in "Biola University" or
// "campus sustainability" they narrow the topic but cannot carry a story alone. A
// story about some other university, or about a campus being sold, is not on topic.
const GENERIC_WORDS = new Set(
  [
    'university', 'universities', 'college', 'colleges', 'school', 'schools', 'campus', 'campuses', 'education',
    'educational', 'student', 'students', 'faculty', 'staff', 'policy', 'policies', 'government', 'federal',
    'state', 'city', 'county', 'country', 'company', 'companies', 'business', 'industry', 'market', 'markets',
    'technology', 'tech', 'research', 'study', 'studies', 'program', 'programs', 'department', 'center',
    'institute', 'team', 'teams', 'sports', 'game', 'games', 'health', 'science', 'plan', 'plans', 'project',
    'projects', 'event', 'events', 'conference', 'week', 'month', 'year', 'america', 'american', 'united',
    'states', 'world', 'global', 'national', 'international', 'public', 'community', 'people', 'group', 'groups',
    'organization', 'issue', 'issues', 'trend', 'trends', 'future', 'impact', 'system', 'systems', 'service',
    'services', 'development', 'media', 'higher',
  ].map(stem),
);

// Splits the topic terms into the specific ones and the generic ones. A term is also
// generic when Bing matched it in most of the results (at least twice as many items
// as the rarest term, and at least half of them), since it then separates nothing.
// When every term is generic they all count the same.
function splitTerms(items, terms) {
  const hits = new Map(terms.map((t) => [t, items.filter((item) => matchedTerms(item, [t]).length).length]));
  const rarest = Math.min(...[...hits.values()].filter((n) => n > 0));
  const generic = terms.filter(
    (t) => GENERIC_WORDS.has(t) || (Number.isFinite(rarest) && hits.get(t) >= Math.max(2 * rarest, items.length / 2)),
  );
  const specific = terms.filter((t) => !generic.includes(t));
  if (!specific.length) return { specific: terms, generic: [] };
  return { specific, generic };
}

// Most on-topic first, then newest; one story per publisher while that still fills
// the issue, then the rest. Items without a date sort after dated ones. An item that
// mentions none of the topic words is dropped: Bing pads a thin search with
// unrelated headlines, and those must not become an issue about the topic. When
// enough items mention one of the specific words, items that only mention a generic
// one are dropped too.
export function rankCandidates(items, now, topic) {
  const terms = topicTerms(topic);
  const cutoff = now - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const seenTitles = [];
  const seenPaths = new Set();
  const fresh = [];
  for (const item of items) {
    const tk = titleKey(item.title);
    const pk = pathKey(item.url);
    if (!tk || seenPaths.has(pk) || seenTitles.some((seen) => sameStory(seen, tk))) continue;
    seenTitles.push(tk);
    seenPaths.add(pk);
    fresh.push(item);
  }
  const time = (item) => (item.publishedAt ? item.publishedAt.getTime() : 0);
  const { specific, generic } = splitTerms(fresh, terms);
  for (const item of fresh) {
    item.specificHits = matchedTerms(item, specific).length;
    item.score = item.specificHits * 2 + matchedTerms(item, generic).length;
  }
  let scored = terms.length ? fresh.filter((item) => item.score > 0) : fresh;
  if (generic.length) {
    const strict = scored.filter((item) => item.specificHits > 0);
    if (strict.length >= MIN_STORIES) scored = strict;
  }
  // Ties go to items Bing itself ranked as relevant, then to the newer item.
  scored.sort((a, b) => b.score - a.score || Number(Boolean(b.relevant)) - Number(Boolean(a.relevant)) || time(b) - time(a));
  const recent = scored.filter((item) => item.publishedAt && item.publishedAt.getTime() >= cutoff);
  const pool = recent.length >= MIN_STORIES ? recent : scored;

  const perHost = new Map();
  const firstPass = [];
  const rest = [];
  for (const item of pool) {
    const host = hostOf(item.url);
    const count = perHost.get(host) || 0;
    perHost.set(host, count + 1);
    (count === 0 ? firstPass : rest).push(item);
  }
  return [...firstPass, ...rest].slice(0, CANDIDATES);
}

/**
 * Collect the latest stories on a topic from the open web. No API key.
 * @param {string} topic
 * @param {{ signal?: AbortSignal, now?: Date }} [options]
 * @returns {Promise<{ stories: Array<{ headline: string, summary: string, source: string, url: string, date: string, image: string|null, publishedAt: Date|null }>, feedItems: number, candidates: number }>}
 */
export async function collectStories(topic, options = {}) {
  const cleanTopic = cleanText(topic);
  if (!cleanTopic) throw new Error('Enter a topic.');
  const signal = options.signal instanceof AbortSignal ? options.signal : undefined;
  const now = options.now instanceof Date ? options.now.getTime() : Date.now();

  // Two views of the same search: most relevant, and newest first. Merged and deduped,
  // with Bing's relevance ranking remembered as a tiebreaker.
  const feeds = await Promise.allSettled([
    fetchFeed(cleanTopic, {}, signal).then((list) => list.map((item) => ({ ...item, relevant: true }))),
    fetchFeed(cleanTopic, { qft: 'sortbydate="1"' }, signal),
  ]);
  const items = feeds.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
  if (!items.length) {
    const reason = feeds.map((r) => (r.status === 'rejected' ? r.reason && r.reason.message : '')).filter(Boolean)[0];
    if (reason) {
      const detail = /fetch failed/i.test(reason) ? 'Check the internet connection.' : reason;
      throw new Error(`Could not reach Bing News. ${detail}`);
    }
    throw new Error(`Bing News has no recent coverage of "${cleanTopic}". Try a broader topic.`);
  }

  const candidates = rankCandidates(items, now, cleanTopic);
  const pages = await Promise.all(candidates.map((item) => fetchPageInfo(item.url, signal)));
  const tiers = candidates.map((item, i) => pageTier(item, pages[i]));

  // Four passes, each loosening one rule: articles from distinct publishers; pages
  // with an unusual og:type from distinct publishers; a second story from a
  // publisher; and listing pages, which only run when the issue would otherwise
  // fail. The passes stop as soon as the issue is full.
  const passes = [
    { maxTier: 0, newHostOnly: true },
    { maxTier: 1, newHostOnly: true },
    { maxTier: 1, newHostOnly: false },
    { maxTier: 2, newHostOnly: false, onlyIfShort: true },
  ];
  const stories = [];
  const hostsUsed = new Set();
  for (const pass of passes) {
    if (pass.onlyIfShort && stories.length >= MIN_STORIES) break;
    for (let i = 0; i < candidates.length && stories.length < MAX_STORIES; i += 1) {
      const item = candidates[i];
      const page = pages[i];
      const host = hostOf(item.url);
      if (tiers[i] > pass.maxTier) continue;
      if (pass.newHostOnly && hostsUsed.has(host)) continue;
      if (stories.some((s) => s.url === item.url)) continue;
      // A dead page is never linked. A page that blocks bots (401, 403, 429) or times
      // out is kept: Bing listed it today, and a browser will usually get through.
      if ([404, 410].includes(page.status) || (page.status >= 500 && page.status < 600)) continue;
      const summary = pickSummary(cleanText(page.description), item.snippet);
      if (!summary) continue;
      // The same article under two headlines (a syndicated copy) reads the same.
      const key = titleKey(item.title);
      if (stories.some((s) => s.summary === summary || sameStory(titleKey(s.headline), key))) continue;
      hostsUsed.add(host);
      stories.push({
        headline: item.title,
        summary,
        source: item.source || cleanText(page.siteName) || host,
        url: item.url,
        date: formatShortDate(item.publishedAt),
        image: page.image || item.thumbnail || null,
        publishedAt: item.publishedAt,
      });
    }
  }

  if (stories.length < MIN_STORIES) {
    throw new Error(`Found only ${stories.length} usable recent stories for "${cleanTopic}". Try a broader topic.`);
  }
  return { stories, feedItems: items.length, candidates: candidates.length };
}

// The publisher's own description when it is whole and long enough to say something,
// else the feed snippet when that is, else the longer of the two. A summary has to
// start like a sentence; a footnote ("* Per the 2024 data...") is not one.
const MIN_SUMMARY_CHARS = 40;

function pickSummary(description, snippet) {
  const options = [description, snippet].filter(Boolean);
  const whole = options.find((text) => !endsCut(text) && text.length >= MIN_SUMMARY_CHARS);
  const chosen = whole || options.sort((a, b) => b.length - a.length)[0] || '';
  const summary = clipSentences(chosen);
  return /^[\p{L}\p{N}"'“‘($]/u.test(summary) ? summary : '';
}
