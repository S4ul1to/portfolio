// Write preview.html next to package.json from the sample content. Needs no API keys.
// Usage, from the project root: node scripts/preview.js

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderNewsletter } from '../src/newsletter.js';
import { sampleContent, sampleMeta } from '../src/sample.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.resolve(here, '..', 'preview.html');

const { html, text } = renderNewsletter(sampleContent, sampleMeta);
writeFileSync(outFile, html, 'utf8');

console.log(outFile);
console.log(text.split('\n').slice(0, 10).join('\n'));
