// Biola newsletter email template.
// renderNewsletter(content, meta) is pure: it takes the research output and the issue
// metadata and returns { subject, html, text }. No I/O, no clock, no network.
//
// Every color and font comes from brand.js. Every style that matters is inline on the
// element, because Gmail and Outlook drop or rewrite <style> blocks. The <style> block in
// the head holds only the League Spartan link, client resets and one narrow-screen media
// query, none of which the layout depends on.

import { color, font, links } from './brand.js';

// ---------------------------------------------------------------------------
// Guards and formatting
// ---------------------------------------------------------------------------

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// Coerce anything to a trimmed string. Objects, null and undefined become ''.
function str(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return String(value);
  return '';
}

function esc(value) {
  return str(value).replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

// Links must be absolute http(s) URLs. Anything else is dropped, never printed.
function linkUrl(value) {
  const s = str(value);
  return /^https?:\/\/\S+$/i.test(s) ? s : '';
}

// Images must be https so they load inside mail clients without mixed-content blocks.
function imageUrl(value) {
  const s = str(value);
  return /^https:\/\/\S+$/i.test(s) ? s : null;
}

const LONG_DATE = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
const SHORT_DATE = { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' };
// The masthead has about 110px beside the wordmark on a phone; the long date wraps to
// four lines there, so it gets the short form and the footer keeps the long one.
const MASTHEAD_DATE = { month: 'short', day: 'numeric', year: 'numeric' };

function formatIssueDate(value, options = LONG_DATE) {
  const d = value instanceof Date ? value : value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', options);
}

// Story dates arrive as free text from research. Only an ISO yyyy-mm-dd prefix is
// reformatted; anything else is shown as given so a vague date is never misread.
function formatStoryDate(value) {
  const s = str(value);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return s;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  // Date.UTC rolls an impossible date like 2026-02-30 forward to March 2. Show the
  // text as given unless it round-trips exactly.
  const valid = !Number.isNaN(d.getTime())
    && d.getUTCFullYear() === Number(m[1])
    && d.getUTCMonth() === Number(m[2]) - 1
    && d.getUTCDate() === Number(m[3]);
  return valid ? d.toLocaleDateString('en-US', SHORT_DATE) : s;
}

// Cut text at a word boundary near max characters for the inbox preview line.
function clip(text, max) {
  const s = str(text).replace(/\s+/g, ' ');
  if (s.length <= max) return s;
  const head = s.slice(0, max + 1);
  const at = head.lastIndexOf(' ');
  const cut = at > max * 0.6 ? head.slice(0, at) : s.slice(0, max);
  return cut.replace(/[\s,.;:]+$/, '') + '...';
}

function normalizeStory(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    headline: str(s.headline),
    summary: str(s.summary),
    source: str(s.source),
    url: linkUrl(s.url),
    date: formatStoryDate(s.date),
    image: imageUrl(s.image),
  };
}

function normalize(content, meta) {
  const c = content && typeof content === 'object' ? content : {};
  const m = meta && typeof meta === 'object' ? meta : {};
  const stories = (Array.isArray(c.stories) ? c.stories : [])
    .map(normalizeStory)
    .filter((s) => s.headline || s.summary);
  const takeaways = (Array.isArray(c.takeaways) ? c.takeaways : []).map(str).filter(Boolean);
  return {
    title: str(c.title),
    intro: str(c.intro),
    stories,
    takeaways,
    topic: str(m.topic),
    issueDate: formatIssueDate(m.date),
    mastheadDate: formatIssueDate(m.date, MASTHEAD_DATE),
    repoUrl: linkUrl(m.repoUrl),
    to: str(m.to),
    sample: Boolean(m.sample),
  };
}

// The reference list at the bottom and in the text version share one ordering.
function sourceList(n) {
  return n.stories.filter((s) => s.headline || s.url);
}

function readLabel(story) {
  return story.source ? `Read at ${story.source}` : 'Read the story';
}

// ---------------------------------------------------------------------------
// Style helpers. Values are inlined on every element.
// ---------------------------------------------------------------------------

const TABLE = 'role="presentation" cellpadding="0" cellspacing="0" border="0"';

function bodyText(px, lineHeight, textColor, weight = 400) {
  return `font-family:${font.body};font-size:${px}px;line-height:${lineHeight};font-weight:${weight};color:${textColor};mso-line-height-rule:exactly;`;
}

function displayText(px, lineHeight, textColor) {
  return `font-family:${font.display};font-size:${px}px;line-height:${lineHeight};font-weight:${font.displayWeight};color:${textColor};mso-line-height-rule:exactly;`;
}

// Solid color block: bgcolor attribute for Outlook plus inline background-color.
function cell(bg, style = '') {
  return `bgcolor="${bg}" style="background-color:${bg};${style}"`;
}

function textLink(href, label, textColor) {
  return `<a href="${esc(href)}" style="color:${textColor};text-decoration:underline;">${label}</a>`;
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function preheader(n) {
  const snippet = clip(n.intro || n.title, 90);
  if (!snippet) return '';
  const filler = '&#847;&zwnj;&nbsp;'.repeat(40);
  return `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;font-family:${font.body};color:${color.skyBlue};">${esc(snippet)}${filler}</div>`;
}

function masthead(n) {
  const dateLine = n.mastheadDate ? `<br>${esc(n.mastheadDate)}` : '';
  return `
<tr>
<td ${cell(color.black, 'padding:20px 28px;')}>
<table ${TABLE} width="100%" style="width:100%;">
<tr>
<td align="left" valign="middle" style="white-space:nowrap;">
<table ${TABLE}>
<tr>
<td valign="bottom" style="${displayText(22, 1, color.white)}letter-spacing:4px;">BIOLA</td>
<td valign="bottom" style="${bodyText(11, 1, color.white)}letter-spacing:3px;padding:0 0 2px 8px;">UNIVERSITY</td>
</tr>
</table>
</td>
<td align="right" valign="middle" style="${bodyText(12, 1.5, color.white)}text-align:right;white-space:nowrap;">Newsletter${dateLine}</td>
</tr>
</table>
</td>
</tr>`;
}

function hero(n) {
  const rows = [];
  if (n.topic) {
    rows.push(`<tr><td style="${bodyText(12, 1.4, color.white, 700)}letter-spacing:2px;padding:0 0 14px 0;">${esc(n.topic.toUpperCase())}</td></tr>`);
  }
  rows.push(`<tr><td><h1 class="hero-title" style="margin:0;padding:0;${displayText(34, 1.1, color.white)}">${esc(n.title)}</h1></td></tr>`);
  if (n.intro) {
    rows.push(`<tr><td style="${bodyText(17, 1.55, color.white)}padding:16px 0 0 0;">${esc(n.intro)}</td></tr>`);
  }
  return `
<tr>
<td ${cell(color.red, 'padding:40px 28px;')}>
<table ${TABLE} width="100%" style="width:100%;">${rows.join('')}</table>
</td>
</tr>`;
}

function glance(n) {
  if (!n.takeaways.length) return '';
  const items = n.takeaways.map((t, i) => `
<tr>
<td style="padding:${i === 0 ? 14 : 10}px 0 0 0;">
<table ${TABLE} width="100%" style="width:100%;">
<tr>
<td width="8" valign="top" style="width:8px;padding:7px 0 0 0;">
<table ${TABLE}><tr><td width="8" height="8" ${cell(color.red, 'width:8px;height:8px;font-size:1px;line-height:1px;mso-line-height-rule:exactly;')}>&nbsp;</td></tr></table>
</td>
<td width="12" style="width:12px;font-size:1px;line-height:1px;mso-line-height-rule:exactly;">&nbsp;</td>
<td valign="top" style="${bodyText(15, 1.5, color.slate)}">${esc(t)}</td>
</tr>
</table>
</td>
</tr>`).join('');
  return `
<tr>
<td ${cell(color.skyBlue, 'padding:24px 28px;')}>
<table ${TABLE} width="100%" style="width:100%;">
<tr><td><h2 style="margin:0;padding:0;${bodyText(16, 1.2, color.black, 700)}">At a glance</h2></td></tr>${items}
</table>
</td>
</tr>`;
}

function storyRows(s, index, count) {
  const first = index === 0;
  const last = index === count - 1;
  const rows = [];
  let top = first ? 32 : 28;

  if (s.image) {
    rows.push(`<tr><td style="padding:${top}px 0 0 0;"><img src="${esc(s.image)}" width="600" alt="${esc(s.headline || s.source || 'Story image')}" border="0" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;"></td></tr>`);
    top = 20;
  }

  // Source and date as quiet metadata in sentence case. The hero topic is the one
  // uppercase tracked label in the email; one per story would read as a template.
  const kicker = [s.source, s.date].filter(Boolean).map(esc).join(' &middot; ');
  if (kicker) {
    rows.push(`<tr><td style="${bodyText(13, 1.5, color.inkMuted)}padding:${top}px 28px 0 28px;">${kicker}</td></tr>`);
    top = 8;
  }

  if (s.headline) {
    rows.push(`<tr><td style="padding:${top}px 28px 0 28px;"><h2 style="margin:0;padding:0;${displayText(22, 1.2, color.black)}">${esc(s.headline)}</h2></td></tr>`);
    top = 10;
  }

  if (s.summary) {
    rows.push(`<tr><td style="${bodyText(15, 1.6, color.slate)}padding:${top}px 28px 0 28px;">${esc(s.summary)}</td></tr>`);
    top = 18;
  }

  if (s.url) {
    const label = readLabel(s);
    if (first) {
      rows.push(`<tr><td style="padding:${top}px 28px 0 28px;">
<table ${TABLE}>
<tr><td ${cell(color.red, 'padding:12px 20px;')}><a href="${esc(s.url)}" style="${bodyText(12, 1.2, color.white, 700)}letter-spacing:1.5px;text-decoration:none;display:inline-block;">${esc(label.toUpperCase())}</a></td></tr>
</table>
</td></tr>`);
    } else {
      rows.push(`<tr><td style="${bodyText(15, 1.5, color.red, 700)}padding:${top}px 28px 0 28px;">${textLink(s.url, esc(label), color.red)}</td></tr>`);
    }
  }

  if (last) {
    rows.push(`<tr><td style="padding:32px 0 0 0;font-size:1px;line-height:1px;mso-line-height-rule:exactly;">&nbsp;</td></tr>`);
  } else {
    rows.push(`<tr><td style="padding:28px 28px 0 28px;"><table ${TABLE} width="100%" style="width:100%;"><tr><td height="1" ${cell(color.rule, 'height:1px;font-size:1px;line-height:1px;mso-line-height-rule:exactly;')}>&nbsp;</td></tr></table></td></tr>`);
  }

  return rows.join('\n');
}

function stories(n) {
  if (!n.stories.length) return '';
  const rows = n.stories.map((s, i) => storyRows(s, i, n.stories.length)).join('\n');
  return `
<tr>
<td ${cell(color.white)}>
<table ${TABLE} width="100%" style="width:100%;">
${rows}
</table>
</td>
</tr>`;
}

function sources(n) {
  const list = sourceList(n);
  if (!list.length) return '';
  const rows = list.map((s, i) => {
    const publisher = s.source ? `<span style="font-weight:700;">${esc(s.source)}</span>` : '';
    const headline = s.url
      ? textLink(s.url, esc(s.headline || s.url), color.slate)
      : esc(s.headline);
    const text = [publisher, headline].filter(Boolean).join('<br>');
    return `
<tr>
<td style="padding:${i === 0 ? 14 : 10}px 0 0 0;">
<table ${TABLE} width="100%" style="width:100%;">
<tr>
<td width="24" valign="top" style="width:24px;${bodyText(14, 1.5, color.red, 700)}">${i + 1}</td>
<td valign="top" style="${bodyText(14, 1.5, color.slate)}">${text}</td>
</tr>
</table>
</td>
</tr>`;
  }).join('');
  return `
<tr>
<td ${cell(color.skyBlue, 'padding:24px 28px;')}>
<table ${TABLE} width="100%" style="width:100%;">
<tr><td><h2 style="margin:0;padding:0;${bodyText(16, 1.2, color.black, 700)}">Sources</h2></td></tr>${rows}
</table>
</td>
</tr>`;
}

function footer(n) {
  const recipient = esc(n.to || 'the recipient');
  let compiled;
  if (n.sample) {
    compiled = 'Sample issue with illustrative stories. Live issues are compiled from web sources on the day they are sent.';
  } else if (n.issueDate) {
    compiled = `Compiled from live web sources on ${esc(n.issueDate)} for ${recipient}.`;
  } else {
    compiled = `Compiled from live web sources for ${recipient}.`;
  }
  const lines = [
    compiled,
    `Designed after ${textLink(links.brandGuide, 'Biola University&#39;s brand standards', color.red)}.`,
    'A class project, not an official Biola communication.',
  ];
  if (n.repoUrl) lines.push(textLink(n.repoUrl, 'Source code', color.red));
  return `
<tr>
<td ${cell(color.white, 'padding:24px 28px;')}>
<table ${TABLE} width="100%" style="width:100%;">
<tr><td style="${bodyText(13, 1.6, color.slate)}">${lines.join('<br>')}</td></tr>
</table>
</td>
</tr>
<tr>
<td height="4" ${cell(color.black, 'height:4px;font-size:1px;line-height:1px;mso-line-height-rule:exactly;')}>&nbsp;</td>
</tr>`;
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

function renderHtml(n, subject) {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${esc(subject)}</title>
<!--[if !mso]><!--><link rel="stylesheet" href="${esc(font.googleFontsHref)}"><!--<![endif]-->
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<style>
body { margin:0; padding:0; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
table { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }
img { -ms-interpolation-mode:bicubic; }
a[x-apple-data-detectors] { color:inherit !important; text-decoration:inherit !important; }
@media only screen and (max-width:620px) {
  .wrap { width:100% !important; max-width:100% !important; }
  .hero-title { font-size:28px !important; }
}
</style>
</head>
<body bgcolor="${color.skyBlue}" style="margin:0;padding:0;background-color:${color.skyBlue};">
${preheader(n)}
<table ${TABLE} width="100%" ${cell(color.skyBlue, 'width:100%;')}>
<tr>
<td align="center" valign="top" style="padding:24px 8px;">
<table role="article" aria-roledescription="email" lang="en" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;border:1px solid ${color.rule};">
${masthead(n)}
${hero(n)}
${glance(n)}
${stories(n)}
${sources(n)}
${footer(n)}
</table>
</td>
</tr>
</table>
</body>
</html>
`;
}

function renderText(n, subject) {
  const out = [subject];
  if (n.intro) out.push(n.intro);
  out.push('');
  for (const s of n.stories) {
    if (s.headline) out.push(s.headline);
    const line = [s.source, s.date].filter(Boolean).join(', ');
    if (line) out.push(line);
    if (s.url) out.push(s.url);
    out.push('');
  }
  if (n.takeaways.length) {
    out.push('At a glance');
    for (const t of n.takeaways) out.push(`- ${t}`);
    out.push('');
  }
  const list = sourceList(n);
  if (list.length) {
    out.push('Sources');
    list.forEach((s, i) => out.push(`${i + 1}. ${s.url || s.headline}`));
    out.push('');
  }
  out.push('A class project, not an official Biola communication.');
  if (n.repoUrl) out.push(`Source code: ${n.repoUrl}`);
  return out.join('\n') + '\n';
}

/**
 * Render the newsletter email.
 * @param {object} content  { title, intro, stories, takeaways }
 * @param {object} meta     { topic, date, repoUrl, to }
 * @returns {{ subject: string, html: string, text: string }}
 */
export function renderNewsletter(content, meta) {
  const n = normalize(content, meta);
  const subject = n.title || (n.topic ? `Newsletter: ${n.topic}` : 'Newsletter');
  return {
    subject,
    html: renderHtml(n, subject),
    text: renderText(n, subject),
  };
}
