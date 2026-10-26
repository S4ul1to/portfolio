// Research provider "anthropic". Claude searches the web with the server-side
// web_search tool and writes the issue as structured output. This module then keeps
// only the stories whose links the search actually returned, and fetches an og:image
// for each. Needs ANTHROPIC_API_KEY; the default "web" provider in research.js does not.

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

import { loadConfig } from './config.js';
import { fetchPageInfo } from './page.js';
import { cleanText, hostOf, trimTitle } from './text.js';

const MIN_STORIES = 3;
const MAX_STORIES = 5;
const TAKEAWAY_COUNT = 3;
const MAX_TOKENS = 16000;
const MAX_CONTINUATIONS = 3;
const WEB_SEARCH_MAX_USES = 8;
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

// Plain types only. Counts and lengths are enforced in code after parsing, because
// refinements such as .min() or .url() add JSON Schema keywords the output grammar
// may reject. The image field is not asked of the model: it comes from the page.
const StorySchema = z.object({
  headline: z.string().describe('12 words or fewer'),
  summary: z.string().describe('2 to 3 sentences in your own words'),
  source: z.string().describe('Publisher name, for example Reuters'),
  url: z.string().describe('The exact page URL returned by web search'),
  date: z.string().describe('Publication date written like Oct 18, 2026'),
});

const NewsletterSchema = z.object({
  title: z.string().describe('80 characters or fewer; does not contain the word newsletter'),
  intro: z.string().describe('2 to 3 sentences'),
  stories: z.array(StorySchema).describe('Exactly 5 stories from 5 different publishers'),
  takeaways: z.array(z.string()).describe('Exactly 3, each 20 words or fewer'),
});

// Stable across runs: today's date and the topic go in the user message instead.
const SYSTEM_PROMPT = [
  'You are the editor of a university newsletter read by students, faculty and staff.',
  'You are factual. Write every sentence in your own words and never copy a source.',
  'Prefer coverage published in the last 30 days.',
  'Use the web_search tool. Search at least 3 different angles on the topic before writing.',
  'Write exactly 5 stories from 5 different publishers.',
  'Every url must be the exact page you retrieved through web search. Never invent, guess or shorten a url.',
  'Each headline is 12 words or fewer. Each summary is 2 to 3 sentences.',
  'The title is 80 characters or fewer and does not contain the word newsletter.',
  'Write exactly 3 takeaways of 20 words or fewer each.',
  'Write dates like Oct 18, 2026.',
  'Do not use em dashes or en dashes in any text. Do not use exclamation marks.',
  'Respond only with the structured output.',
].join('\n');

// Link verification

// Comparison keys for a url: exact (host, path and query), path (host and path)
// and host. A leading www., a trailing slash, the protocol and the fragment are
// ignored, because the model often rewrites those while naming the same page.
function urlKeys(raw) {
  try {
    const url = new URL(String(raw).trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const pathname = url.pathname.replace(/\/+$/, '').toLowerCase();
    return { exact: `${host}${pathname}${url.search}`, path: `${host}${pathname}`, host };
  } catch {
    return null;
  }
}

function newSearchIndex() {
  return { exact: new Map(), path: new Map(), host: new Set() };
}

// Every url the web search returned, indexed for comparison. On success a
// web_search_tool_result block holds an array of results; on failure it holds
// an error object, which is skipped.
function collectSearchUrls(content, into) {
  for (const block of content || []) {
    if (!block || block.type !== 'web_search_tool_result') continue;
    if (!Array.isArray(block.content)) continue;
    for (const result of block.content) {
      if (!result || result.type !== 'web_search_result' || typeof result.url !== 'string') continue;
      const keys = urlKeys(result.url);
      if (!keys) continue;
      if (!into.exact.has(keys.exact)) into.exact.set(keys.exact, result.url);
      if (!into.path.has(keys.path)) into.path.set(keys.path, result.url);
      into.host.add(keys.host);
    }
  }
}

// Stories come in two tiers. A story whose page the search returned (exact url or
// same path) is verified and keeps the url the search gave. A story whose
// publisher the search returned but whose page it did not is provisional: it is
// used only to reach the minimum, and research() drops it unless the page answers.
function buildContent(parsed, searchUrls) {
  const seen = new Set();
  const verified = [];
  const provisional = [];

  for (const story of Array.isArray(parsed.stories) ? parsed.stories : []) {
    const keys = urlKeys(story && story.url);
    if (!keys || seen.has(keys.path)) continue;
    const headline = cleanText(story.headline);
    const summary = cleanText(story.summary);
    if (!headline || !summary) continue;
    const matched = searchUrls.exact.get(keys.exact) || searchUrls.path.get(keys.path) || null;
    if (!matched && !searchUrls.host.has(keys.host)) continue;
    seen.add(keys.path);
    const url = matched || String(story.url).trim();
    const entry = {
      headline,
      summary,
      source: cleanText(story.source) || hostOf(url),
      url,
      date: cleanText(story.date),
      image: null,
      verified: Boolean(matched),
    };
    (matched ? verified : provisional).push(entry);
  }

  const stories = verified.slice(0, MAX_STORIES);
  for (const entry of provisional) {
    if (stories.length >= MIN_STORIES) break;
    console.log(`research: web search did not return ${entry.url}; keeping it on a publisher match pending a page check.`);
    stories.push(entry);
  }

  if (stories.length < MIN_STORIES) {
    throw new Error('Could not verify enough sources for this topic. Try a broader or more recent topic.');
  }

  const takeaways = (Array.isArray(parsed.takeaways) ? parsed.takeaways : [])
    .map(cleanText)
    .filter(Boolean)
    .slice(0, TAKEAWAY_COUNT);
  // The model is asked for exactly 3. If it sent fewer, fill from real headlines
  // rather than fail the run or invent text.
  for (const story of stories) {
    if (takeaways.length >= TAKEAWAY_COUNT) break;
    if (!takeaways.includes(story.headline)) takeaways.push(story.headline);
  }

  return {
    title: trimTitle(parsed.title),
    intro: cleanText(parsed.intro),
    stories,
    takeaways,
  };
}

// Claude API

// zodOutputFormat(...).parse throws on any text block that is not schema-valid
// JSON, and beta.messages.parse runs it on every text block before returning.
// A refusal, a max_tokens cut or a short interim text block would then surface
// as a parse error instead of a readable stop_reason. This wrapper returns null
// for such blocks so the message always comes back and stop_reason is checked
// first. The last parse problem is kept for the server log.
function makeOutputFormat(diagnostics) {
  const base = zodOutputFormat(NewsletterSchema);
  return {
    ...base,
    parse: (text) => {
      try {
        return base.parse(text);
      } catch (err) {
        diagnostics.lastParseError = err instanceof Error ? err.message : String(err);
        return null;
      }
    },
  };
}

function buildParams(config, messages, format, useFallbacks) {
  const params = {
    model: config.anthropicModel,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages,
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: WEB_SEARCH_MAX_USES }],
    output_config: { effort: 'medium', format },
  };
  if (useFallbacks) {
    params.betas = [FALLBACK_BETA];
    params.fallbacks = 'default';
  }
  return params;
}

function apiDetail(err) {
  const body = err && err.error;
  const message = (body && body.error && body.error.message) || (body && body.message);
  return typeof message === 'string' && message.trim() ? ` ${message.trim()}` : '';
}

// Classified by instanceof, most specific first. Returns a plain Error with a
// message the page can show.
function toUserError(err) {
  if (err instanceof Anthropic.AuthenticationError) {
    return new Error('The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in .env.');
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new Error('Anthropic rate limit hit. Wait a minute and try again.');
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new Error('Could not reach the Anthropic API. Check the network.');
  }
  if (err instanceof Anthropic.APIError) {
    return new Error(`The Anthropic API returned an error (status ${err.status ?? 'unknown'}).${apiDetail(err)}`);
  }
  if (err instanceof Anthropic.AnthropicError) {
    return new Error('The Anthropic SDK could not complete the request. Try again.');
  }
  return err instanceof Error ? err : new Error(String(err));
}

async function callModel(client, config, messages, format, state, signal) {
  const requestOptions = signal ? { signal } : undefined;
  try {
    return await client.beta.messages.parse(buildParams(config, messages, format, state.useFallbacks), requestOptions);
  } catch (err) {
    // The one allowed string check: an API that does not know the fallback beta
    // yet rejects the request with a 400 whose message names the field or the
    // header. Read the API's own message, not the serialized error body.
    const rejectedFallback =
      state.useFallbacks &&
      err instanceof Anthropic.BadRequestError &&
      /\bfallbacks?\b|server-side-fallback/i.test(apiDetail(err));
    if (!rejectedFallback) throw err;
    console.log('research: the API rejected the refusal fallback fields, retrying once without them.');
    state.useFallbacks = false;
    return client.beta.messages.parse(buildParams(config, messages, format, false), requestOptions);
  }
}

export async function researchWithClaude(topic, options) {
  const cleanTopic = typeof topic === 'string' ? topic.trim() : '';
  if (!cleanTopic) throw new Error('Enter a topic.');
  const onStage = options && typeof options.onStage === 'function' ? options.onStage : null;
  // The server aborts this when the browser disconnects mid-run.
  const signal = options && options.signal instanceof AbortSignal ? options.signal : null;

  const config = loadConfig();
  if (!config.anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set. Add it to .env, or set RESEARCH_PROVIDER=web to run without a key.');
  }
  const client = new Anthropic({ apiKey: config.anthropicApiKey });
  const diagnostics = { lastParseError: null };
  const format = makeOutputFormat(diagnostics);
  const today = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date());

  const messages = [
    {
      role: 'user',
      content: `Today is ${today}. Topic: ${cleanTopic}\n\nResearch this topic with web search and write the issue.`,
    },
  ];
  const searchUrls = newSearchIndex();
  const state = { useFallbacks: Boolean(config.anthropicFallbacks) };

  onStage?.('search', 'Searching the web for the latest coverage');

  let response;
  try {
    for (let continuation = 0; ; continuation += 1) {
      response = await callModel(client, config, messages, format, state, signal);
      collectSearchUrls(response.content, searchUrls);
      if (response.stop_reason !== 'pause_turn') break;
      // The server-side search loop paused. Send the turn back and it resumes.
      if (continuation >= MAX_CONTINUATIONS) {
        throw new Error('The search took too many steps. Try a narrower topic.');
      }
      messages.push({ role: 'assistant', content: response.content });
    }
  } catch (err) {
    if (signal && signal.aborted) throw new Error('The run was cancelled because the browser disconnected.');
    throw toUserError(err);
  }

  onStage?.('write', 'Verifying sources and fetching images');

  if (response.stop_reason === 'refusal') {
    const category = response.stop_details && response.stop_details.category;
    throw new Error(category ? `Claude declined this topic (category: ${category}).` : 'Claude declined this topic.');
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error('The model ran out of room. Try a narrower topic.');
  }

  const iterations = (response.usage && response.usage.iterations) || [];
  if (iterations.some((entry) => entry && entry.type === 'fallback_message')) {
    console.log(`research: served by ${response.model} after a refusal fallback.`);
  }

  const parsed = response.parsed_output;
  if (!parsed) {
    if (diagnostics.lastParseError) {
      console.error(`research: structured output did not match the schema. ${diagnostics.lastParseError}`);
    }
    throw new Error('The model did not return a complete newsletter. Try again.');
  }

  const content = buildContent(parsed, searchUrls);

  // One request per story, in parallel: the og:image for the email and, for a
  // provisional story, the proof that the page exists.
  const pages = await Promise.all(content.stories.map((story) => fetchPageInfo(story.url, signal)));
  content.stories = content.stories.filter((story, i) => {
    story.image = pages[i].image;
    const keep = story.verified || pages[i].ok;
    if (!keep) console.log(`research: dropped ${story.url}; web search did not return it and the page did not answer.`);
    delete story.verified;
    return keep;
  });
  if (content.stories.length < MIN_STORIES) {
    throw new Error('Could not verify enough sources for this topic. Try a broader or more recent topic.');
  }

  return content;
}
