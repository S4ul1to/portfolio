// Research step: turns a topic into newsletter content.
//
//   provider "web" (default)  Bing News RSS collects the stories, a local Ollama model
//                             or a plain template writes the issue. No API key.
//   provider "anthropic"      Claude with the web search tool does both. Needs
//                             ANTHROPIC_API_KEY. Kept for anyone who has one.
//
// Both return the same content shape: { title, intro, stories[], takeaways[], writerNote }.
// writerNote is one sentence on who wrote the copy, shown on the page after a send.

import { loadConfig } from './config.js';

export function describeWriter(writer) {
  if (writer && writer.kind === 'ollama') return `Written by ${writer.model} on this machine.`;
  const reason = writer && writer.reason ? ` ${writer.reason}` : '';
  return `Written by the built-in template.${reason}`;
}

export async function research(topic, options = {}) {
  const config = loadConfig();
  const onStage = typeof options.onStage === 'function' ? options.onStage : () => {};
  const signal = options.signal instanceof AbortSignal ? options.signal : undefined;

  if (config.researchProvider === 'anthropic') {
    const { researchWithClaude } = await import('./research-anthropic.js');
    const content = await researchWithClaude(topic, options);
    return { ...content, writerNote: `Written by Claude ${config.anthropicModel}.` };
  }

  const [{ collectStories }, { writeIssue, resolveWriter, writerLabel }] = await Promise.all([
    import('./collect.js'),
    import('./writer.js'),
  ]);

  onStage('search', 'Collecting the latest coverage from Bing News');
  const collected = await collectStories(topic, { signal });

  const planned = await resolveWriter(config.ollama);
  onStage('write', planned.kind === 'ollama' ? `Writing the issue with ${planned.model} on this machine` : 'Assembling the issue');
  const issue = await writeIssue(topic, collected.stories, { ollama: config.ollama, signal });

  console.log(
    `research: ${issue.stories.length} stories from ${collected.feedItems} feed items, ${collected.candidates} pages checked, writer ${writerLabel(issue.writer)}.`,
  );
  return {
    title: issue.title,
    intro: issue.intro,
    stories: issue.stories.map(({ headline, summary, source, url, date, image }) => ({ headline, summary, source, url, date, image })),
    takeaways: issue.takeaways,
    writerNote: describeWriter(issue.writer),
  };
}
