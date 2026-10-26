# Biola newsletter generator: design

This file records the design of the tool and the email it sends, as built. Read it before changing anything visual. Colors and fonts live in `src/brand.js`, the page's sizes and states live in `public/index.html`, and the email's sizes and rules live in `src/newsletter.js`. Every number below was checked against those files on 2026-10-22. Where the code made a different call from the first draft of this document, the call and its reason are written here instead of the old rule.

## Design read

Reading this as: a one-button internal tool plus a transactional email, for a live demo and a brand-fidelity grader, in Biola's institutional red, black and white, in redesign-preserve mode because the brand is given and the job is to apply it faithfully, not to invent one.

## Dials

| Dial | Value | Why |
|---|---|---|
| Design variance | 4 | The audience is a grader checking brand fidelity, so the page is a left-aligned two-column grid (5fr 7fr from 960px) with square corners and no offsets or overlaps. Biola's own materials are built on straight color blocks, and redesign-preserve means matching that. |
| Motion intensity | 3 | Only state changes move: the button's hover color and 1px press, the pill, input border and link color transitions (200ms), the pulsing marker on the active progress step, and the preview swap. The email has no motion at all. Anything above 3 would be motion for show. |
| Visual density | 4 | One task per screen, but the page carries a preview pane and a progress list beside the form, and the email fits three to five stories inside 600px, so it is not airy. |

## Brand tokens

Every value below mirrors `src/brand.js`. Change that file, not this table, and then update the table. Reserved tokens are exported to `/brand.css` so they are ready, but nothing uses them yet.

| Token | Value | Biola name | Role | Used in |
|---|---|---|---|---|
| `color.red` | #CC1122 | Biola Red (Pantone 186) | The one accent. Page: the 6px top rule on the form panel, the button face, the input focus border, the Setup needed pill text, field errors, the active and failed step markers, the setup notice's left border, the skip link focus ring and the footer link hover. Email: the hero band, the first story's button, the Read at links on the other stories, the takeaway squares, the Sources numbers and the footer links | Both |
| `color.black` | #000000 | Black | Masthead on both. Page: title ink, body default, button hover face, button focus ring, done step markers. Email: story headlines, the At a glance and Sources headings, the 4px foot | Both |
| `color.white` | #FFFFFF | White | Page: the form panel, the input, the pill and the footer. Email: the card, the story and footer surfaces. Text on red and on black | Both |
| `color.electricRed` | #FF342E | Electric Red | Reserved. Exported as `--electric-red` and not used: white on it is 3.63:1, so it cannot carry white text, and the button hover goes to black instead (see Accessibility) | Reserved |
| `color.electricBlue` | #78D2F7 | Electric Blue | Reserved. Exported as `--electric-blue`, not used in version 1 | Reserved |
| `color.skyBlue` | #E2EFF8 | Sky Blue | Page: the ground, the Ready to send pill, the setup notice and the input focus ring. Email: the ground around the card, the At a glance panel and the Sources panel. Softens the red | Both |
| `color.gradBlue` | #1D273B | Grad Blue | Reserved. Exported as `--grad-blue`, not used: the page keeps one light theme | Reserved |
| `color.slate` | #2F3E53 | Talbot East Slate | Page: the lede, the delivery line, the status line, the timer, the preview note, the idle progress steps and the footer. Email: takeaways, summaries, the Sources text and links, and the footer | Both |
| `color.fountain` | #0488A4 | Fountain Blue | Reserved. Exported as `--fountain`, not used: 4.15:1 on white, so it would be limited to large link text (see Accessibility). Links use red, or slate in the Sources list | Reserved |
| `color.rule` | #CBD8E4 | Derived (Sky Blue toward slate) | Page: the 2px input border, the 1px iframe border, the rules above the progress list and the footer, and the idle step markers. Email: the hairline between stories | Both |
| `color.dot` | #C4D0DC | Derived (Sky Blue toward slate) | Dot grid dots; gray only | UI |
| `color.inkMuted` | #5B6B80 | Derived (slate toward Sky Blue) | Page: the help line under the input, the input hover border and the disabled button face. Email: the source and date line on each story | Both |
| `font.body` | Gotham, Proxima Nova, Helvetica Neue, Helvetica, Arial, sans-serif | Gotham with Biola's named substitutes | Every text run not listed under `font.display`, including the At a glance and Sources headings in the email | Both |
| `font.display` | League Spartan, then the body stack | League Spartan (secondary face) | Page: the title, the BIOLA wordmark, the primary button and the Preview heading. Email: the BIOLA wordmark, the hero title and the story headlines | Both |
| `font.displayWeight` | 700 | Bold only | The only weight League Spartan may be loaded or declared at | Both |
| `font.googleFontsHref` | League Spartan wght@700 | | An `@import` at the top of `/brand.css`; a `<link>` in the email head inside an Outlook guard | Both |
| `radius` | 0px | | Every corner: button, input, pill, skip link, panels, images | Both |
| `dotGrid.size` | 18px | | Distance between dot centers | UI |
| `dotGrid.css` | radial-gradient(#C4D0DC 1.1px, transparent 1.4px) | Community pattern | Page ground only | UI |

## Typography

### Web UI

All sizes are from `public/index.html`. The page body is 16px / 1.5 in `font.body`, black on Sky Blue, and everything inherits from that unless the row says otherwise.

| Element | Face | Weight | Size and leading | Color |
|---|---|---|---|---|
| Page title | `font.display` | 700 | 34px / 1.05, `text-wrap: balance`, no letter-spacing, the same size at every width (four lines at 320px) | black on white |
| Wordmark, BIOLA | `font.display` | 700 | 20px / 1, letter-spacing 4px, uppercase | white on black |
| Wordmark, UNIVERSITY | `font.body` | 400 | 11px / 1, letter-spacing 3px, uppercase | white on black |
| Status pill | `font.body` | 700 | 12px / 1.2, 6px 10px padding, sentence case | Checking setup: slate on white. Ready to send: black on Sky Blue. Setup needed or Setup unknown: red on white |
| Topic label | `font.body` | 700 | 16px / 1.5 | black on white |
| Preview heading | `font.display` | 700 | 16px, sentence case, with a 14px slate note beside it (Sample issue, or This is the email that was sent) | black on the ground |
| Lede | `font.body` | 400 | 16px / 1.5 | slate on white |
| Help line | `font.body` | 400 | 14px / 1.5 | inkMuted on white |
| Field error | `font.body` | 700 | 14px / 1.5 | red on white |
| Delivery line, status line, timer | `font.body` | 400 | 14px / 1.5; the timer uses tabular numerals | slate on white |
| Setup notice | `font.body` | 400 | 14px / 1.5, 10px 12px padding, 4px red left border | black on Sky Blue |
| Progress steps | `font.body` | 400, 700 when active or failed | 16px / 1.5 with a 10px square marker: rule gray idle, red and pulsing when active, black when done, red when failed | slate; black when active; red when failed |
| Result line | `font.body` | 400 | 16px / 1.5 | black on white; red when it reports an error |
| Input | `font.body` | 400 | 16px (prevents iOS zoom), 48px tall, 0 12px padding, 2px `color.rule` border; hover border inkMuted; focus border red plus a 3px Sky Blue outline offset 2px | black on white |
| Primary button | `font.display` | 700 | 16px / 1.2, letter-spacing 1px, min-height 52px with 12px padding; from 960px a fixed 52px with `white-space: nowrap`. Label: Generate and email newsletter | white on red; hover black; active `translateY(1px)`; disabled inkMuted with a progress cursor; focus-visible 3px black outline |
| Skip link | `font.body` | 700 | 16px, min-height 44px, 10px 16px padding, visible only on keyboard focus | black on white with a 3px red outline |
| Footer | `font.body` | 400 | 13px / 1.5, centered; links underlined with a 2px offset | slate on white; link hover red |

### Email

All sizes are from `src/newsletter.js`. Every cell declares the full font stack and `mso-line-height-rule: exactly`.

| Element | Face | Weight | Size and leading | Color |
|---|---|---|---|---|
| Preheader | `font.body` | 400 | 1px / 1px, hidden | Sky Blue, matching the ground |
| Masthead, BIOLA | `font.display` | 700 | 22px / 1, letter-spacing 4px, uppercase | white on black |
| Masthead, UNIVERSITY | `font.body` | 400 | 11px / 1, letter-spacing 3px, uppercase, with 8px of space before it | white on black |
| Masthead, right side | `font.body` | 400 | 12px / 1.5, right aligned: Newsletter, then the short date (Oct 21, 2026) | white on black |
| Hero eyebrow | `font.body` | 700 | 12px / 1.4, uppercase, letter-spacing 2px. It is the topic, and it is the only uppercase tracked label in the email | white on red |
| Hero title | `font.display` | 700 | 34px / 1.1; 28px under 620px through the `.hero-title` media query | white on red |
| Hero intro | `font.body` | 400 | 17px / 1.55 | white on red |
| At a glance heading | `font.body` | 700 | 16px / 1.2, sentence case | black on Sky Blue |
| Takeaways | `font.body` | 400 | 15px / 1.5, each with an 8px red square and a 12px gap | slate on Sky Blue |
| Source and date line | `font.body` | 400 | 13px / 1.5, sentence case, a middle dot between them: Inside Higher Ed · October 19, 2026 | inkMuted on white |
| Story headline | `font.display` | 700 | 22px / 1.2 | black on white |
| Story summary | `font.body` | 400 | 15px / 1.6 | slate on white |
| First story button | `font.body` | 700 | 12px / 1.2, uppercase, letter-spacing 1.5px, no underline, in a red cell with 12px 20px padding. Label: Read at {publisher}, or Read the story | white on red |
| Other story links | `font.body` | 700 | 15px / 1.5, underlined. Label: Read at {publisher}, or Read the story | red on white |
| Sources heading | `font.body` | 700 | 16px / 1.2, sentence case | black on Sky Blue |
| Sources list | `font.body` | 700 number and publisher, 400 headline | 14px / 1.5; the number sits in a 24px cell; the headline is an underlined link | red number; slate text and links on Sky Blue |
| Footer | `font.body` | 400 | 13px / 1.6; links underlined | slate on white; red links |
| Foot | | | 4px black bar closing the card | black |

### What each client shows

| Client | Hero title | Body | Notes |
|---|---|---|---|
| Apple Mail, iOS Mail | League Spartan 700 | Helvetica Neue | Loads the Google Fonts link from the head and honors the embedded media query. |
| Gmail (web, Android app, iOS app) | Helvetica, or Arial on Windows | Helvetica or Arial | Strips `<link>` and `@import`, keeps inline styles, drops background images. |
| Outlook for Windows (Word engine) | Arial | Arial | Ignores web fonts. An unguarded font link in the head can push the whole message to Times New Roman, so the link sits inside an Outlook conditional comment (the guard is described under Email rendering rules). Needs width attributes and `bgcolor`. |
| Outlook.com, new Outlook, Yahoo | Helvetica or Arial | Helvetica or Arial | Behaves like Gmail. |

Every one of those fallbacks is a face Biola's standards name as acceptable when Gotham is unavailable, so the email stays on brand in every client.

### The bold-only rule

League Spartan is loaded at weight 700 and nothing else. No element declares `font.display` with any weight other than 700, and the Google Fonts request asks for `wght@700` only.

Where it is used: on the page, the title, the BIOLA wordmark, the primary button and the Preview heading; in the email, the BIOLA wordmark, the hero title and the story headlines. It is never used for running text, helper lines, the At a glance and Sources headings, the source and date line or any link.

Two of those are deliberate calls that differ from the first draft, which limited the face to large headlines. A wordmark is display use, so BIOLA is set in League Spartan in both places and the page and the email match. The button takes the display face so it reads as the title's sibling and the panel has one voice; at 16px with 1px tracking it stays clearly a button, not a headline.

## Graphic devices

### Dot grid

- Biola's community pattern. Dots are `color.dot` (#C4D0DC) on the Sky Blue ground. Gray or white only, never a color.
- 18px between centers, 1.1px dots, as defined by `dotGrid` in `src/brand.js` and exposed as `--dot-grid` and `--dot-grid-size` by `/brand.css`.
- It appears on the web UI page ground only. The form panel and the preview iframe sit on solid white. The Preview heading and its note are the one piece of text that sits over the dots; they are short, bold or 14px, and the dots are light enough that they stay readable.
- It does not appear in the email. The only way to tile it there is a background image, and Gmail and Outlook drop background images.

### Wordmark

BIOLA in `font.display` 700 with 4px tracking, and UNIVERSITY in `font.body` with 3px tracking beside it: 20px and 11px on the page, 22px and 11px in the email. The official logo (the open book and flame in a circle) is not used because the logo files are restricted to authorized Biola users, and redrawing it would be a worse outcome than leaving it out. Both footers say the tool is a class project and not an official Biola communication; neither mentions the logo.

### Deliberately not used

| Device | Why not |
|---|---|
| Logo | Files are restricted. A text wordmark stands in. |
| Sunbursts, sky gradients, skyplates, background photos in the email | Gmail and Outlook drop CSS gradients and background images, so the design would differ by client. In the UI they would compete with the dot grid. |
| Wave pattern | Needs an approved asset; none is available to this project. |
| 1pt line icons | A Biola device, but there is no approved icon set here, there is no icon library in the project, and hand-rolled SVG icons are banned by the house rules. |
| Library Beacon watermark | Restricted artwork. |
| Grad Blue dark panel | One theme per page. The page is light only, so a dark surface would be a mid-page theme flip. |
| Electric Red hover | White on Electric Red is 3.63:1, below AA. The button hover goes to black (21:1), which is also Biola's core red and black pairing. |

## Layout

### The tool

- Header: full-width black bar, 64px tall, with 16px side padding (more inside a phone's safe area). Wordmark on the left, status pill on the right.
- Ground: Sky Blue with the dot grid, edge to edge.
- Container: maximum width 1200px, centered, 16px side gutters at every width, 32px above and below, 32px between columns.
- Columns: one column below 960px, controls first and preview second. From 960px a `5fr 7fr` grid with `align-items: start`, so the panel keeps its own height while the preview column runs longer.
- Left: a white panel with a 6px Biola Red top rule and 32px padding. In order: the title, the lede, the Topic label and input, the help line, the field error slot, the button, the delivery line (Delivers to {address}), the setup notice, then a hairline and the three-step progress list with a status line and an mm:ss timer, then the result line.
- Right: the Preview heading with a note beside it, then an iframe of `/api/preview`: white, 1px `color.rule` border, 720px tall below 960px and `min(1100px, calc(100vh - 200px))` from 960px, sandboxed with `allow-popups allow-popups-to-escape-sandbox`, loaded with the page rather than lazily. When the done event arrives the `src` is removed and `srcdoc` takes the HTML that was sent, and the note changes to This is the email that was sent.
- No horizontal scroll at 320px: the columns have `min-width: 0`, every message line uses `overflow-wrap: anywhere`, and the masthead's wordmark and pill fit side by side (checked in Chrome at 320px).
- States:
  - Loading: the pill reads Checking setup until `/api/config` answers.
  - Idle: the sample issue in the preview, the pill reads Ready to send, and the delivery line names the address.
  - Setup needed: the pill reads Setup needed, the Sky Blue notice lists the missing variable names and says to copy `.env.example` to `.env`, and the delivery line says which variable to add. If `/api/config` cannot be read the pill reads Setup unknown.
  - Validation: an empty topic or one over 120 characters shows a red line under the input and returns focus to it. A 400 from the server lands in the same place.
  - Running: the button is disabled (inkMuted, progress cursor), the progress block is `aria-busy`, the current step is bold with a pulsing red marker and `aria-current="step"`, the status line shows the server's message, and the timer runs.
  - Done: all three steps are marked done, the status line reads Delivered., and the result line reads Sent to {address} at {time}. Subject: {subject}. {n} sources. The preview swaps to the sent issue.
  - Error: the active step turns red, the message appears in red in the result line, and there is never a stack trace. Closing the tab mid-run cancels the server's work and nothing is sent.

### The email, top to bottom

1. Hidden preheader: the intro (or the title when there is no intro) clipped to about 90 characters at a word boundary, followed by invisible filler so the inbox snippet shows nothing else.
2. Outer table on the Sky Blue ground with 24px top and bottom padding and 8px at the sides, holding the 600px card. The card table carries `role="article"`, `aria-roledescription="email"` and `lang="en"`.
3. Masthead: black, 20px 28px padding. BIOLA UNIVERSITY on the left; Newsletter and the short issue date on the right.
4. Hero: Biola Red, 40px 28px padding. The topic as an uppercase eyebrow, the title in the display face, the intro in the body face, all white.
5. At a glance: Sky Blue, 24px 28px padding. The heading and the takeaways, each with a red square. Omitted when there are no takeaways.
6. Stories: white. For each story, the image when there is one (full width, `width="600"`, alt text), then the source and date line, the headline, the summary and the link: a red button on the first story and an underlined red text link on the rest. A `color.rule` hairline sits between stories, and 32px of space follows the last one.
7. Sources: Sky Blue, 24px 28px padding. The heading and a numbered list: a red number, the publisher in bold, and the headline as an underlined slate link.
8. Footer: white, 24px 28px padding, slate 13px text. A sample issue says Sample issue with illustrative stories. Live issues are compiled from web sources on the day they are sent. A live issue says Compiled from live web sources on {long date} for {recipient}. Then Designed after Biola University's brand standards. with a red link, A class project, not an official Biola communication., and a Source code link when `REPO_URL` is set. A 4px black bar closes the card.

## Where the content comes from

The layout renders whatever `src/research.js` returns: a title, an intro, three to five stories and a list of takeaways. Where those come from depends on the provider, and the email shows or omits a few things accordingly.

- Sources. With the default web provider (`RESEARCH_PROVIDER=web`, no API key), `src/collect.js` reads two Bing News RSS feeds for the topic, newest first and most relevant, dedupes them, ranks them by how many topic words the headline and snippet mention and then by date, drops items that mention none of the topic words (Bing pads a thin search with unrelated headlines), drops items that only mention a generic topic word such as university, campus, education or policy when enough items mention a specific one (so "Biola University" does not admit a story about some other university), breaks ties in favor of items Bing itself ranked as relevant, keeps the last 30 days, and fetches up to 10 candidate pages through `src/page.js` to prove each link answers and to read its `og:image`, `og:description` and `og:type`. Pages that answer 404, 410 or a 5xx are dropped; a redirect to a sign-in wall counts as blocked, so nothing from the wall page is used. Articles come first, pages with another `og:type` after them, and listing pages (a tag archive, an author page, a college profile, a bare slug for a headline, a PDF) only when the issue would otherwise fail. A syndicated copy of a story already in the issue (same summary, or one headline that begins with the other) is skipped. Three to five stories come back, one per publisher while that fills the issue, or the run stops with a plain-language error. Each story carries the feed's publisher name, the headline with any trailing publisher suffix removed, the feed's publication date, and a summary: the page's description when it is whole and at least 40 characters, otherwise the feed snippet when that is, otherwise the longer of the two, clipped to two sentences and 320 characters with a trailing cut fragment dropped.
- Writer. `src/writer.js` asks a local Ollama model (picked from qwen3.5:4b, gemma4:e4b and qwen3.5:9b in that order, or the one named in `OLLAMA_MODEL`) for schema-constrained JSON: a title of 80 characters or fewer that does not just restate the topic, a two-sentence intro, three takeaways of 20 words or fewer, and one rewritten summary per story. The answer is validated and merged: sentence case, the AI acronym restored, a title that only echoes the topic replaced, a summary outside 40 to 420 characters replaced by the collected one, any field that uses a word from the house banned list (delve, robust, landscape, seamless and the rest, listed in `src/text.js`) replaced by the template's or the publisher's version, and fewer than two usable takeaways means none. Story headlines are quoted from the publisher and keep the publisher's capitalization; they are the one place Title Case can appear.
- Template fallback. When Ollama is not running, has no model, does not answer a one-token test request (its runner can hang after a sleep while its API keeps answering), fails on a run, or does not answer within 120 seconds, `templateIssue()` in the same file writes the issue: the title is {Topic}: N recent stories, the intro is one factual sentence naming the date span and the publishers, there are no takeaways, and the summaries are the publishers' own. Nothing in the layout changes; the email only loses the At a glance band.
- Claude. With `RESEARCH_PROVIDER=anthropic` and an `ANTHROPIC_API_KEY`, `src/research-anthropic.js` has Claude search and write the whole issue and returns the same shape, with the takeaways filled from headlines when the model sends fewer than three.

What the email shows in each case:

| Element | Model (Ollama or Claude) | Template |
|---|---|---|
| Hero title and subject | The model's title, trimmed to 80 characters | {Topic}: N recent stories |
| Hero intro | Two sentences from the model, clipped to three sentences and 420 characters | One sentence: the N most recent stories on {topic}, the date span, and the publishers |
| At a glance band | Shown, with three takeaways | Omitted; the hero runs straight into the first story |
| Story summaries | Rewritten by the model, two sentences each | The publisher's own description or snippet, clipped |

The same in every case: the hero eyebrow is the topic as typed; the kicker on each story is the publisher from the feed (or the page's `og:site_name`, or the host) and the feed's publication date in the short form Oct 19, 2026 (the sample issue carries ISO dates, which render in the long form October 19, 2026), and a story without a date shows the publisher alone. The image is the page's `og:image` or `twitter:image` over https when the page does not declare it taller than 3:4, otherwise Bing's thumbnail of the article at 1200x630 when Bing's original is at least 600 by 300, otherwise the image row is omitted. The Sources list has one row per story, and the footer reads Compiled from live web sources on {long date} for {recipient}.

## Copy voice

- Sentence case for every heading, label, button, pill and table header. The uppercase exceptions are the BIOLA UNIVERSITY wordmark on both documents, the hero eyebrow (the topic) in the email, and the first story's button label. Story headlines are quoted from their publishers and keep the publisher's capitalization, Title Case included.
- No exclamation marks anywhere in the UI or the email. No "Oops". No emoji. `cleanText()` in `src/text.js`, which every collector and writer runs on feed and model text, turns any exclamation mark into a period.
- No em dashes and no en dashes in any file. Use a hyphen, a comma, a period or a colon instead. `cleanText()` turns an em dash from a feed or a model into a comma and an en dash into a hyphen, and both system prompts tell the model not to write them.
- Plain, specific words. The house rules ban a list of fourteen marketing words; none of them appear on the page, in the email or in these two documents, and the pre-flight scan checks for them.
- Button labels carry one intent each, a verb plus an object, in sentence case: Generate and email newsletter. It stays on one line from 960px and wraps to two lines on phones inside a button that grows from its 52px minimum. Never two buttons with the same intent on one page.
- Progress copy says what is happening now. The step labels are Collect the latest coverage, Write the newsletter and Send to your inbox. The status line carries the server's messages: Searching the web for recent coverage of "{topic}". then, from the web provider, Collecting the latest coverage from Bing News, then Writing the issue with {model} on this machine (or Assembling the issue when the template writes it), then Sending to {address}. and finally Delivered. The Anthropic provider says Searching the web for the latest coverage and Verifying sources and fetching images instead, and the server adds Writing the newsletter. if a provider did not report the write step itself.
- Error copy names the thing and the fix: Gmail rejected the SMTP login. Use a Google App Password, not the account password. No stack traces in the UI or the email.
- The email subject is the issue title, 80 characters or fewer (trimmed by `trimTitle()` in `src/text.js`), no prefix tags. With no title it falls back to Newsletter: {topic}.

## Accessibility

Contrast ratios computed with the WCAG 2.x relative luminance formula. The exact command, run from the project folder with Node 24:

```
node --input-type=module -e "const lum=h=>{const c=h.replace('#','');const [r,g,b]=[0,2,4].map(i=>parseInt(c.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4));return 0.2126*r+0.7152*g+0.0722*b;};const ratio=(a,b)=>{const [l1,l2]=[lum(a),lum(b)].sort((x,y)=>y-x);return ((l1+0.05)/(l2+0.05)).toFixed(2);};for(const [n,a,b] of [['Biola Red on white','#CC1122','#FFFFFF'],['White on Biola Red','#FFFFFF','#CC1122'],['Slate on Sky Blue','#2F3E53','#E2EFF8'],['Slate on white','#2F3E53','#FFFFFF'],['Black on Sky Blue','#000000','#E2EFF8'],['Black on white','#000000','#FFFFFF'],['Muted ink on white','#5B6B80','#FFFFFF'],['White on muted ink','#FFFFFF','#5B6B80'],['White on black','#FFFFFF','#000000'],['Biola Red on Sky Blue','#CC1122','#E2EFF8'],['Muted ink on Sky Blue','#5B6B80','#E2EFF8'],['Fountain on white','#0488A4','#FFFFFF'],['White on Electric Red','#FFFFFF','#FF342E']])console.log(n,ratio(a,b));"
```

| Pair | Where | Ratio | WCAG AA (normal text, 4.5:1) | WCAG AAA (7:1) |
|---|---|---|---|---|
| Biola Red #CC1122 on white #FFFFFF | Field errors, the Setup needed pill, red links and the failed step | 5.72 | Pass | No |
| White #FFFFFF on Biola Red #CC1122 | Button face, hero, the first story's button | 5.72 | Pass | No |
| Slate #2F3E53 on Sky Blue #E2EFF8 | Takeaways and the Sources list | 9.27 | Pass | Pass |
| Slate #2F3E53 on white #FFFFFF | Lede, helper lines, summaries, footers | 10.85 | Pass | Pass |
| Black #000000 on Sky Blue #E2EFF8 | The Ready to send pill, the setup notice, the At a glance and Sources headings | 17.94 | Pass | Pass |
| Black #000000 on white #FFFFFF | Page title, labels, story headlines | 21.00 | Pass | Pass |
| Muted ink #5B6B80 on white #FFFFFF | Help line, source and date line | 5.44 | Pass | No |
| White #FFFFFF on muted ink #5B6B80 | The disabled button while a run is in progress | 5.44 | Pass | No |
| White #FFFFFF on black #000000 | Both mastheads, the button on hover | 21.00 | Pass | Pass |
| Biola Red #CC1122 on Sky Blue #E2EFF8 | The Sources numbers (14px bold) | 4.89 | Pass | No |

Three more pairs are in the same command because they decide how three tokens may be used:

| Pair | Ratio | Consequence |
|---|---|---|
| Muted ink #5B6B80 on Sky Blue #E2EFF8 | 4.65 | Passes AA, barely. Nothing uses it today; if it is ever needed, keep it to a caption and use slate for anything longer. |
| Fountain #0488A4 on white #FFFFFF | 4.15 | Below AA for normal text. Fountain would be allowed only for large link text (24px regular, or 19px bold) and always underlined. Version 1 uses red for links, and slate in the Sources list, so Fountain stays reserved. |
| White #FFFFFF on Electric Red #FF342E | 3.63 | Below AA for text. This is why the button hover is black rather than Electric Red: the hover face has to carry the white label. Electric Red stays reserved. |

Other rules:

- Focus: the skip link shows a 3px Biola Red outline on `:focus-visible`. The input turns its border red and adds a 3px Sky Blue outline (offset 2px) on focus, so the ring reads on the white panel. The button shows a 3px black outline (offset 2px) on `:focus-visible`, which reads against both its red and black faces. The footer link shows a 2px black outline. Outlines are never removed without a visible replacement.
- Targets: the input is 48px tall, the button at least 52px, and the skip link at least 44px. The brand standards link in the page footer is inline 13px text, the one target below 44px.
- Reduced motion: under `@media (prefers-reduced-motion: reduce)` scroll behavior is instant, every transition is cut to 0.01ms and the step marker's pulse animation is removed. The email has no motion.
- Progress and errors are announced through two `aria-live="polite"` regions (the status line and the result line), the progress block is `aria-busy` while a run is in progress, the active step carries `aria-current="step"`, and progress is shown with words, not only color.
- Every story image has alt text: the headline, or the publisher when there is no headline, or Story image. There are no spacer images; spacers are table cells (see Email rendering rules).
- `lang="en"` on both documents, a real `<title>` on the page, and the email's `<title>` and subject carry the issue title.

## Email rendering rules

- A 600px layout built from nested tables with `role="presentation"`, `cellpadding="0"`, `cellspacing="0"` and `border="0"`. The card table itself is `role="article"` with `aria-roledescription="email"`.
- Every style is inline on the element that needs it. The `<style>` block in the head holds client resets and one media query at 620px (`.wrap` to 100% width, `.hero-title` to 28px); the layout holds without it. The League Spartan `<link>` sits outside the style block, inside a downlevel-revealed conditional comment that excludes mso (Word-engine Outlook skips it, every other client reads it), so Outlook never sees it.
- Backgrounds use the `bgcolor` attribute and the `background-color` style together, through one `cell()` helper.
- Images carry `width="600"`, alt text, `border="0"` and `style="display:block;width:100%;max-width:600px;height:auto"`. There is no `height` attribute, so each client scales from the file's own proportions and nothing is stretched. Only `https` URLs are rendered; `pickImage()` in `src/page.js` upgrades an `http` og:image to `https` and skips a picture whose page declares it taller than 3:4, and `src/collect.js` forces `https` on Bing's thumbnail.
- Spacer cells use `font-size:1px;line-height:1px;mso-line-height-rule:exactly` with a non-breaking space, and every text cell declares `mso-line-height-rule:exactly`, so Outlook keeps the stated heights.
- No background images, no CSS gradients, no `data:` URIs, no SVG, no flexbox, no grid, no CSS variables, no `position`, no negative margins.
- `<meta name="color-scheme" content="light only">` and `<meta name="supported-color-schemes" content="light only">`, so dark-mode clients keep the brand colors.
- A hidden preheader as the first content: `display:none`, 1px font size and line height, `max-height:0`, `max-width:0`, `opacity:0`, `overflow:hidden` and `mso-hide:all`, padded with invisible characters so the inbox snippet shows only it.
- Fonts are declared as the full stack on every text cell so Outlook and Gmail land on Helvetica or Arial, never Times New Roman.
- Links are real `<a href>` elements with an absolute `http(s)` URL; anything else is dropped rather than printed. Story links and footer links are underlined in Biola Red, Sources links are underlined in slate, and the first story's button is white on red with no underline.
- The outer ground keeps 24px above and below the card and 8px at the sides, so a phone shows a thin Sky Blue frame. A 4px black bar closes the card.
- The message is multipart: `text/html` plus a `text/plain` alternative with the same stories and links in reading order. `src/mailer.js` adds a unique `X-Entity-Ref-ID` header so Gmail does not thread one issue under another.
- Square corners everywhere, which also removes every `border-radius` compatibility question.

## Pre-flight checklist

Run before shipping a change to the page or the email. Every box is a yes or the work is not done.

- [ ] Theme lock: the page is light only, and the email's `color-scheme` and `supported-color-schemes` metas both say `light only`. No section flips to a dark surface mid-page.
- [ ] One accent: Biola Red is the only accent on the page and in the email. Electric Red, Electric Blue, Fountain and Grad Blue stay reserved and unused.
- [ ] One radius system: 0px on the button, input, pill, skip link, images and panels.
- [ ] Button and form contrast: white on red 5.72:1, white on black (hover) 21:1, white on muted ink (disabled) 5.44:1, the help line 5.44:1, the Sources numbers 4.89:1; labels are black on white and every focus ring is visible on its surface.
- [ ] CTA: one intent, sentence case, one line from 960px; on phones it may wrap to two lines inside a button that grows from 52px.
- [ ] Eyebrow count: none on the page beyond the wordmark; in the email only the hero topic. The first story's button label is the one other uppercase string, and it is a button, not a label.
- [ ] Zero em dashes and zero en dashes in every file, including code, comments, copy, alt text, the subject line and the preheader (run a scan), and `cleanText()` in `src/text.js` still rewrites any that a feed or a model sends.
- [ ] No exclamation marks, no "Oops", no emoji and no banned words in UI or email copy.
- [ ] Sentence case on every heading, label, button and pill, with the wordmark, the hero eyebrow and the first story's button as the only uppercase exceptions; quoted story headlines keep their publisher's case.
- [ ] States present: Checking setup while `/api/config` loads, the sample preview when idle, the Setup needed pill and notice when keys are missing, a field error for an empty or over-long topic, three-step progress with a status line and timer while running, the Delivered result with the preview swap, and a plain-language error inline with the failed step in red.
- [ ] Real images or none outside the labeled sample: a live story's image is the publisher page's own og:image over https, or else Bing News's 1200x630 thumbnail of that same article, or else the image row is omitted; nothing is generated or stock. The picsum placeholders in `src/sample.js` appear only in the sample, whose title and footer say it is a sample.
- [ ] No fake numbers or names: the done event reports the real story count, and the sample issue is titled Sample issue, uses real publisher names and says its stories are illustrative.
- [ ] Semantic HTML on the page: header, main, form, label with for, button, section, two aria-live regions. Tables are for the email only.
- [ ] Focus states visible on the skip link, input, button and footer link; the input (48px), button (52px) and skip link (44px) meet the 44px target size.
- [ ] Reduced motion honored, no horizontal scroll at 320px on the page, and the email's 600px card goes full width under 620px with the hero title at 28px.
