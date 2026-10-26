// Runs the research step and renders the email without sending it.
//   node scripts/dry-run.js "campus sustainability"
// Writes dry-run.html next to package.json and prints what was collected.
// Needs no credentials with the default web provider.

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { research } from '../src/research.js';
import { renderNewsletter } from '../src/newsletter.js';
import { loadConfig } from '../src/config.js';

const topic = process.argv.slice(2).join(' ').trim() || 'Artificial intelligence in higher education';
const startedAt = Date.now();
const config = loadConfig();

const content = await research(topic, {
  onStage: (stage, message) => console.log(`[${stage}] ${message}`),
});

const { subject, html, text } = renderNewsletter(content, {
  topic,
  date: new Date(),
  repoUrl: config.repoUrl,
  to: config.toEmail || 'the recipient',
});

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dry-run.html');
writeFileSync(out, html);

console.log('');
console.log(`Subject: ${subject}`);
console.log(`Intro: ${content.intro}`);
for (const [i, story] of content.stories.entries()) {
  console.log(`${i + 1}. ${story.headline}`);
  console.log(`   ${story.source}, ${story.date || 'no date'}${story.image ? ', with image' : ''}`);
  console.log(`   ${story.url}`);
}
if (content.takeaways.length) {
  console.log('At a glance:');
  for (const t of content.takeaways) console.log(`- ${t}`);
}
if (content.writerNote) console.log(content.writerNote);
console.log('');
console.log(`Wrote ${out} (${html.length} bytes) in ${((Date.now() - startedAt) / 1000).toFixed(1)} s.`);
console.log(`Text version: ${text.split('\n').length} lines.`);
