// Writes the issue around the collected stories: a title, a two-sentence intro, three
// takeaways and tightened summaries. A local model through Ollama does it when one is
// running; otherwise a plain template does, so the tool never depends on a key or a
// service being up.

import {
  BANNED_WORD_LIST,
  cleanText,
  clipSentences,
  fixAcronyms,
  formatShortDate,
  hasBannedWord,
  sentenceCase,
  trimTitle,
} from './text.js';

const TAGS_TIMEOUT_MS = 3000;
const PS_TIMEOUT_MS = 3000;
// A loaded model answers a one-token probe in about a second. A model that still has
// to load needs its load time first, up to a minute on this machine.
const PROBE_LOADED_TIMEOUT_MS = 15000;
const PROBE_COLD_TIMEOUT_MS = 90000;
const WRITE_TIMEOUT_MS = 120000;
const KEEP_ALIVE = '30m';
const TAKEAWAY_COUNT = 3;
// Timed on this machine (RTX 5050, 8 GB) with schema-constrained JSON for a five
// story issue: qwen3.5:4b 22 s warm with the GPU free, 55 to 60 s when the GPU was
// throttled after a sleep (about 7 tokens a second); gemma4:e4b about 30 s;
// qwen3.5:9b 84 s warm because it spills to CPU. The 4b is the demo pick.
const PREFERRED_MODELS = ['qwen3.5:4b', 'gemma4:e4b', 'qwen3.5:9b'];
// Same options for the warm-up, the probe and the write, or Ollama reloads the model
// between them. 4096 context fits the prompt (about 1,200 tokens for five stories)
// and is the size the model was loaded with.
const OLLAMA_OPTIONS = { temperature: 0.3, num_ctx: 4096, num_predict: 800 };

const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    intro: { type: 'string' },
    takeaways: { type: 'array', items: { type: 'string' } },
    summaries: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'intro', 'takeaways', 'summaries'],
};

const SYSTEM_PROMPT = [
  'You edit a university newsletter read by students, faculty and staff.',
  'You write plainly, in sentence case, in your own words.',
  'No exclamation marks. No em dashes or en dashes.',
  `Never use these words: ${BANNED_WORD_LIST}.`,
  'You never add a fact, number, name or claim that is not in the material you are given.',
].join(' ');

function listNames(names) {
  const list = [...new Set(names.filter(Boolean))];
  if (list.length <= 1) return list.join('');
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

// The issue without a model: a factual title and intro, no takeaways (the email
// omits that band when the list is empty), summaries as collected.
export function templateIssue(topic, stories) {
  const count = stories.length;
  const suffix = `: ${count} recent stories`;
  // The cut, when a long topic needs one, lands inside the topic so the count survives.
  const subject = trimTitle(sentenceCase(topic), 80 - suffix.length);
  const title = subject ? `${subject}${suffix}` : `${count} recent stories`;
  const dates = stories.map((s) => s.publishedAt).filter((d) => d instanceof Date && !Number.isNaN(d.getTime()));
  const earliest = dates.length ? formatShortDate(new Date(Math.min(...dates.map((d) => d.getTime())))) : '';
  const latest = dates.length ? formatShortDate(new Date(Math.max(...dates.map((d) => d.getTime())))) : '';
  const span = earliest && latest ? (earliest === latest ? `published ${latest}` : `published between ${earliest} and ${latest}`) : 'published recently';
  const intro = cleanText(
    `The ${count} most recent stories on ${cleanText(topic)} from across the web, ${span}. Publishers include ${listNames(stories.map((s) => s.source))}.`,
  );
  return { title, intro, takeaways: [], stories: stories.map((s) => ({ ...s })) };
}

async function ollamaJson(ollama, path, body, timeoutMs, signal) {
  const timeout = AbortSignal.timeout(timeoutMs);
  const response = await fetch(new URL(path, ollama.url), {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok) throw new Error(`Ollama answered ${response.status} on ${path}.`);
  return response.json();
}

let resolved = null;
let resolvedKey = '';
let resolvedAt = 0;
const RESOLVE_TTL_MS = 60000;

/**
 * Which writer will run: a local model or the template. Cached for a minute per
 * url and model.
 * @param {{ url: string, model: string }} ollama
 * @returns {Promise<{ kind: 'ollama', model: string } | { kind: 'template', reason: string }>}
 */
export async function resolveWriter(ollama) {
  const key = `${ollama.url}|${ollama.model}`;
  if (resolved && resolvedKey === key && Date.now() - resolvedAt < RESOLVE_TTL_MS) return resolved;
  let result;
  try {
    const tags = await ollamaJson(ollama, '/api/tags', null, TAGS_TIMEOUT_MS);
    const installed = (tags.models || []).map((m) => m.name).filter(Boolean);
    if (ollama.model) {
      result = installed.includes(ollama.model)
        ? { kind: 'ollama', model: ollama.model }
        : { kind: 'template', reason: `Ollama is running but ${ollama.model} is not installed (ollama pull ${ollama.model}).` };
    } else {
      const pick = PREFERRED_MODELS.find((m) => installed.includes(m)) || installed.find((m) => !/embed/i.test(m));
      result = pick ? { kind: 'ollama', model: pick } : { kind: 'template', reason: 'Ollama is running but has no models installed.' };
    }
  } catch {
    result = { kind: 'template', reason: `Ollama is not reachable at ${ollama.url}.` };
  }
  resolved = result;
  resolvedKey = key;
  resolvedAt = Date.now();
  return result;
}

export function writerLabel(writer) {
  return writer && writer.kind === 'ollama' ? `${writer.model} (local, Ollama)` : 'built-in template';
}

// Loads the model into memory so the first click does not pay the load time.
export async function warmUp(ollama) {
  const writer = await resolveWriter(ollama);
  if (writer.kind !== 'ollama') return writer;
  try {
    await ollamaJson(ollama, '/api/generate', { model: writer.model, keep_alive: KEEP_ALIVE, options: OLLAMA_OPTIONS }, WRITE_TIMEOUT_MS);
  } catch (err) {
    console.log(`writer: could not pre-load ${writer.model}. ${err.message}`);
  }
  return writer;
}

// Whether Ollama reports the model as loaded right now. Unknown counts as not loaded,
// which only makes the probe below more patient.
async function modelLoaded(ollama, model, signal) {
  try {
    const ps = await ollamaJson(ollama, '/api/ps', null, PS_TIMEOUT_MS, signal);
    return (ps.models || []).some((m) => m.name === model || m.model === model);
  } catch {
    return false;
  }
}

// Ollama's API can keep answering while its model runner is hung (seen on this
// machine after a sleep and resume): /api/tags is fine, but a generate request sits
// until it times out. A one-token probe finds that out in seconds instead of letting
// every click wait out the full write limit.
async function probeModel(ollama, model, signal) {
  const loaded = await modelLoaded(ollama, model, signal);
  await ollamaJson(
    ollama,
    '/api/generate',
    { model, prompt: 'Reply with the word ok.', stream: false, keep_alive: KEEP_ALIVE, options: { ...OLLAMA_OPTIONS, num_predict: 1 } },
    loaded ? PROBE_LOADED_TIMEOUT_MS : PROBE_COLD_TIMEOUT_MS,
    signal,
  );
}

function userPrompt(topic, stories, today) {
  const lines = stories.map((s, i) =>
    [
      `Story ${i + 1}`,
      `Headline: ${s.headline}`,
      `Publisher: ${s.source}${s.date ? `, ${s.date}` : ''}`,
      `Publisher's summary: ${s.summary}`,
    ].join('\n'),
  );
  return [
    `Today is ${today}. Topic: ${topic}.`,
    `Material: ${stories.length} stories, each with a headline, publisher, date and the publisher's own summary.`,
    'Write JSON with:',
    '- title: 80 characters or fewer, in sentence case (capitalize only the first word and proper nouns), says what is happening across the stories. It must not simply restate the topic. No colon, no word newsletter.',
    '- intro: exactly 2 sentences on what is happening across these stories, drawn only from the material.',
    `- takeaways: exactly ${TAKEAWAY_COUNT} items of 20 words or fewer, each traceable to one story.`,
    `- summaries: exactly ${stories.length} items in the same order as the stories, 2 sentences each, 320 characters or fewer, rewritten in your own words from that story's material only. If the material is thin, write 1 sentence rather than invent.`,
    '',
    ...lines,
  ].join('\n');
}

// A field the model wrote is used only when it is well formed and clean; otherwise
// the template's or the publisher's version stands.
function mergeDraft(draft, topic, stories, fallback) {
  const d = draft && typeof draft === 'object' ? draft : {};
  // Small models asked for sentence case tend to lowercase everything, including
  // acronyms; capitalize the first letter and restore AI.
  let title = fixAcronyms(sentenceCase(trimTitle(d.title)));
  // A title that only echoes the topic says nothing; the template title at least
  // counts the stories.
  if (!title || title.toLowerCase() === cleanText(topic).toLowerCase() || hasBannedWord(title)) title = fallback.title;
  const introClean = fixAcronyms(sentenceCase(d.intro));
  const intro = introClean.length >= 40 && !hasBannedWord(introClean) ? clipSentences(introClean, 3, 420) : fallback.intro;
  let takeaways = (Array.isArray(d.takeaways) ? d.takeaways : [])
    .map((t) => fixAcronyms(sentenceCase(t)).replace(/\.$/, ''))
    .filter((t) => t.length >= 8 && t.length <= 200 && !hasBannedWord(t))
    .slice(0, TAKEAWAY_COUNT);
  if (takeaways.length < 2) takeaways = [];
  const summaries = Array.isArray(d.summaries) ? d.summaries : [];
  const merged = stories.map((story, i) => {
    const candidate = fixAcronyms(sentenceCase(summaries[i]));
    const usable = candidate.length >= 40 && candidate.length <= 420 && !hasBannedWord(candidate);
    return { ...story, summary: usable ? clipSentences(candidate, 2, 320) : story.summary };
  });
  return { title, intro, takeaways, stories: merged };
}

/**
 * Write the issue. Falls back to the template on any model problem.
 * @param {string} topic
 * @param {Array} stories  from collectStories()
 * @param {{ ollama: { url: string, model: string }, signal?: AbortSignal, now?: Date }} options
 * @returns {Promise<{ title: string, intro: string, takeaways: string[], stories: Array, writer: { kind: 'ollama'|'template', model?: string, reason?: string } }>}
 *   `writer` says who wrote it: the model, or the template with the reason.
 */
export async function writeIssue(topic, stories, options) {
  const fallback = templateIssue(topic, stories);
  const ollama = options && options.ollama;
  if (!ollama || !ollama.url) return { ...fallback, writer: { kind: 'template', reason: 'No Ollama url is set.' } };
  const writer = await resolveWriter(ollama);
  if (writer.kind !== 'ollama') {
    console.log(`writer: ${writer.reason} Using the template.`);
    return { ...fallback, writer };
  }
  const today = formatShortDate(options.now instanceof Date ? options.now : new Date());
  const cancelled = () => options.signal && options.signal.aborted;
  try {
    await probeModel(ollama, writer.model, options.signal);
  } catch (err) {
    if (cancelled()) throw new Error('The run was cancelled because the browser disconnected.');
    const reason = `${writer.model} did not answer a short test request (${err.message}). Restart Ollama to use it again.`;
    console.log(`writer: ${reason} Using the template.`);
    return { ...fallback, writer: { kind: 'template', reason } };
  }
  try {
    const result = await ollamaJson(
      ollama,
      '/api/chat',
      {
        model: writer.model,
        stream: false,
        think: false,
        format: SCHEMA,
        keep_alive: KEEP_ALIVE,
        options: OLLAMA_OPTIONS,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt(topic, stories, today) },
        ],
      },
      WRITE_TIMEOUT_MS,
      options.signal,
    );
    const content = result && result.message && result.message.content;
    const draft = JSON.parse(String(content));
    return { ...mergeDraft(draft, topic, stories, fallback), writer: { kind: 'ollama', model: writer.model } };
  } catch (err) {
    if (cancelled()) throw new Error('The run was cancelled because the browser disconnected.');
    const reason = /timeout/i.test(err.message)
      ? `${writer.model} did not finish within ${WRITE_TIMEOUT_MS / 1000} seconds.`
      : `${writer.model} failed (${err.message}).`;
    console.log(`writer: ${reason} Using the template.`);
    return { ...fallback, writer: { kind: 'template', reason } };
  }
}
