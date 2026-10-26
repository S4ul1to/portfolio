# Biola newsletter generator

A class-project tool that turns one click into a finished newsletter. Type a topic, press the button, and the server collects the latest coverage from Bing News, writes a short issue in Biola University's visual identity, and emails it to the owner's inbox (sedgardoh@gmail.com by default). The email arrives fully rendered, with layout, colors, fonts, story images and working source links, not as plain text and not as an attachment. It is built for a live demo and for a grader checking brand fidelity.

It needs no paid API. The stories come from Bing News RSS, the copy is written by a local model through Ollama when one is running (a built-in template writes it otherwise), and the only credential is a Gmail App Password for sending.

## How it works

1. Collect, in `src/collect.js`. The server fetches two Bing News RSS feeds for the topic, one sorted newest first and one sorted by relevance, and parses the XML itself, with no dependency. Bing's links are click trackers, so the real publisher URL is decoded out of the `?url=` parameter. Items are deduplicated by title (a syndicated copy whose headline begins with another's counts as the same story) and by host plus path, then scored by how many topic words their headline and snippet mention (word stems, with stopwords removed, two-letter acronyms such as AI kept, and "ai" counting for "artificial intelligence"). Items that mention no topic word are dropped, since Bing pads a thin search with unrelated headlines; generic topic words such as university, campus, education or policy cannot carry a story alone when enough items mention a specific word, so "Biola University" does not admit a story about some other university. The rest are sorted by score, then by Bing's own relevance ranking, then by date. Items from the last 30 days are kept (all items, if fewer than three are that recent), one story per publisher while that still fills the issue. Up to 10 candidate pages are then fetched in parallel through `src/page.js`, with a 6 second timeout each, to confirm the link answers and to read the page's `og:image`, `og:description` and `og:type`. A page that answers 404, 410 or a 5xx is dropped; a page that blocks bots (401, 403, 429) or times out is kept, because Bing listed it today and a browser gets through; a redirect to a sign-in wall is treated as blocked, so nothing from the wall page is used. Articles fill the issue first; listing pages (a tag archive, an author page, a college profile, a bare slug for a headline, a PDF) are used only when the issue would otherwise fail. A story whose summary matches one already in the issue is skipped. Each story gets the page's image, or else Bing's own thumbnail of the article at 1200x630, or none. Three to five stories come back, or the run stops with a plain-language error rather than padding the issue.
2. Write, in `src/writer.js`. The server looks for Ollama at `OLLAMA_URL` (default http://localhost:11434). With `OLLAMA_MODEL` blank it picks the first installed of qwen3.5:4b, gemma4:e4b and qwen3.5:9b, or else any installed model that is not an embedding model. It asks the model for schema-constrained JSON (a title, a two-sentence intro, three takeaways and one rewritten summary per story) with thinking off, temperature 0.3, a 4096 token context, 800 output tokens at most, and a 30 minute keep-alive. The answer is validated and merged into the collected stories: sentence case, the AI acronym restored, a title that only echoes the topic replaced, a summary that is too short or too long replaced by the collected one. On any failure, or when Ollama is not running, the built-in template writes the issue instead: the title is "{Topic}: N recent stories", the intro is a factual sentence naming the date span and the publishers, there are no takeaways (the email omits the At a glance band when the list is empty), and the summaries are the publishers' own. The server pre-loads the model at startup so the first click does not pay the load time.
3. Render and send, in `src/newsletter.js` and `src/mailer.js`. A pure function builds a 600px table-based email with every style inline, using only the tokens exported from `src/brand.js`, and returns the subject, the HTML and a plain-text alternative. It does no I/O, so the same function drives the preview, the dry run and the real send. nodemailer then connects to Gmail SMTP (port 465, TLS) with a Gmail App Password and sends a multipart message: the HTML plus the text alternative.

`src/research.js` is the dispatcher. With `RESEARCH_PROVIDER=web` (the default) it runs collect, then write, and returns the issue. With `RESEARCH_PROVIDER=anthropic` it hands the topic to `src/research-anthropic.js`, which keeps the Claude path for anyone who has an `ANTHROPIC_API_KEY`: Claude Opus 5.5 with the web search tool and structured output, a link check against the URLs the search returned, and the same page fetch for images. Its error message says what to set when the key is missing. Both providers return the same shape: a title, an intro, the stories and the takeaways.

`src/server.js` ties it together. `GET /api/config` reports whether setup is complete, the delivery address, the provider, and two labels the page shows: `writer` (for example "qwen3.5:4b (local, Ollama)" or "built-in template") and `sources` ("Bing News"). `POST /api/send` streams newline-delimited JSON (`application/x-ndjson`), one event per line, flushed as each step happens: `search`, `write`, `send`, then `done` with the final HTML, or `error` with a plain-language message. The page reads that stream to show progress and to swap the preview pane to the issue that was just sent. If the browser disconnects mid-run, the server aborts the feed, page and model requests through an `AbortSignal` and nothing is sent. At startup the server logs the sources and the writer and warms the model.

## Project layout

```
newsletter-tool/
  README.md                   this file
  DESIGN.md                   design notes as built: tokens, typography, email rules, content sources, checklist
  package.json                npm scripts: start, dev, preview, dry-run, check
  .env.example                environment template; copy it to .env
  .gitignore                  keeps .env, node_modules and preview.html out of git
  public/index.html           the one-button page: topic, progress steps, sources line, preview pane
  scripts/preview.js          writes preview.html from the sample issue, no keys needed
  scripts/dry-run.js          collects and writes a real issue into dry-run.html, no email, no keys needed
  src/brand.js                Biola colors, fonts, radius and dot grid; the only place they live
  src/config.js               loads .env once; exports loadConfig() and configStatus(); never throws
  src/research.js             dispatcher: the web provider (collect, then write) or the Anthropic provider
  src/collect.js              Bing News RSS: fetch, parse, rank, check the pages, pick the images
  src/page.js                 fetches one article page and reads its og:image, description, title and date
  src/writer.js               writes the issue with a local Ollama model, or with the built-in template
  src/text.js                 text helpers: house-style cleanup, title trimming, sentence clipping, dates
  src/research-anthropic.js   optional Claude provider: web search, structured output, link check
  src/newsletter.js           renderNewsletter(content, meta) returns subject, html, text
  src/sample.js               sampleContent and sampleMeta for previews
  src/mailer.js               sendNewsletter() over Gmail SMTP with nodemailer
  src/server.js               routes: /, /brand.css, /api/config, /api/preview, /api/send
```

## Setup

1. Install Node 24 or newer and check it with `node --version`.
2. Run `npm install` in this folder.
3. Copy `.env.example` to `.env`.
4. Create a Gmail App Password. Open your Google Account, then Security, then 2-Step Verification, then App passwords. 2-Step Verification has to be on before App passwords appears. Name the password anything, copy the 16 characters and paste them into `SMTP_PASS` without spaces. Set `SMTP_USER` to the same Gmail address. Those two are the only required variables.
5. Run `npm start`.
6. Open http://localhost:3000. The header pill should read Ready to send, and the line under Delivers to reads Sources: Bing News. Writer: qwen3.5:4b (local, Ollama), or Writer: built-in template when Ollama is not running. Enter a topic and press Generate and email newsletter.

The `.env` file is read once at startup, so restart the server after editing it. `npm run dev` restarts the server when a source file changes (not when `.env` changes), and `npm run check` syntax-checks every module without starting anything.

Optional:

- Ollama, for better copy. Install Ollama from ollama.com, run `ollama pull qwen3.5:4b`, and start the server. There is nothing else to configure: the server finds Ollama at http://localhost:11434, picks the model, and pre-loads it. Set `OLLAMA_MODEL` in `.env` to force a particular installed model, and `OLLAMA_URL` if Ollama listens somewhere else. Without Ollama the tool still works; the template writes the issue and the email has no At a glance band.
- Claude, for anyone with an API key. Set `RESEARCH_PROVIDER=anthropic` and paste a key from the Claude Console (console.anthropic.com) into `ANTHROPIC_API_KEY`. Claude Opus 5.5 (`ANTHROPIC_MODEL`) then searches the web and writes the issue itself; `ANTHROPIC_FALLBACKS=1` keeps the server-side refusal fallback on.

## Try it without keys

`npm run preview` writes `preview.html` in the project root from the sample issue in `src/sample.js` and prints the absolute path. Open that file in a browser to see the email design.

`npm run dry-run "campus sustainability"` runs the real collect and write steps on the web and writes `dry-run.html` in the project root, without sending anything and without any credentials. It prints each stage, the subject, the intro, every story with its publisher, date, link and whether it has an image, the takeaways when a model wrote them, and the time it took. With no topic it uses "Artificial intelligence in higher education". The last line says who wrote the copy: the local model, or the built-in template and why. `dry-run.html` is in `.gitignore`.

The page works without keys too. Run `npm start` and open http://localhost:3000. The preview pane shows the sample issue (served at `/api/preview`) and the header pill reads Setup needed, with the missing variables listed from `/api/config`. Sending needs the Gmail App Password.

Timings measured on this machine (an RTX 5050 with 8 GB): collect takes 2 to 5 seconds, qwen3.5:4b writes a five-story issue in about 22 seconds when the model is warm and the GPU is free, 55 to 60 seconds when the GPU is throttled (seen after a sleep and resume, at about 7 tokens a second), and about 60 seconds more when it has to load first. The send takes a few seconds. The template writes instantly. Before each write the writer sends the model a one-token test request (15 seconds when the model is loaded, 90 when it still has to load); if that fails, as it does when Ollama's runner has hung, the template takes over at once and the page says so after the send. The write itself gets 120 seconds. If it has not answered by then, the template takes over and the run still finishes, so a slow model costs time but never the issue.

## Design

The visual decisions, tokens, contrast numbers and the pre-flight checklist live in [DESIGN.md](DESIGN.md). The short version:

- Biola's core trio carries the whole thing: a black masthead, a Biola Red (#CC1122) hero and button, and white content. Sky Blue (#E2EFF8) softens the red in the at a glance and sources panels, around the email, and on the page ground.
- Gotham is Biola's primary face but is not a web font, so the stack falls back to Proxima Nova, Helvetica and Arial, the substitutes Biola's own standards list as acceptable. League Spartan, bold weight only, is reserved for the headlines, the BIOLA wordmark and the primary button.
- The dot grid, Biola's community pattern, appears in gray on the web page ground only, never in color and never in the email.
- The email renders in Gmail because it is a 600px nested table with every style inline, `bgcolor` beside `background-color`, width attributes on images, and no background images, gradients, flexbox or CSS variables. Apple Mail loads League Spartan; Gmail and Outlook show Helvetica or Arial, which Biola permits.

## Video outline (2 to 5 minutes)

| Time | Beat |
|---|---|
| 0:00 | What the tool is: one button, one topic, a Biola-branded newsletter in your inbox with real, checked links. It runs on free sources, Bing News RSS for the stories and a local model for the copy, so there is no paid API behind it. |
| 0:30 | How it was built: Claude Code, working from the skills in the dbello-platform repo (taste-skill and redesign-skill for the design read, the dials and the brand audit; ui-ux-pro-max for the page layout and its states; playwright-skill to check the page and the rendered email in a real browser; verification-before-completion so nothing was reported that was not actually run). |
| 1:30 | Live click. Type a topic, press the button, and watch the three progress steps (collect, write, send) complete with the status line and timer. The status line names Bing News while it collects and the model while it writes. When the done event arrives, the preview pane switches from the sample issue to the issue that was just sent. |
| 3:00 | Open Gmail. Show the email arriving and rendering, then walk the Biola design top to bottom: black masthead with the wordmark and date, red hero with the topic eyebrow, title and intro, Sky Blue at a glance panel with three takeaways, stories with images and working links, the sources list, and the footer with the repository link. |
| 4:15 | Wrap. What is verified (every linked page was fetched and dead pages were dropped, contrast ratios are computed, Gmail rendering is checked), what is deliberately left out (the logo, because the files are restricted), and where the code lives. |

## Troubleshooting

| Symptom | What is going on | Fix |
|---|---|---|
| Gmail rejected the SMTP login | Gmail refuses normal account passwords over SMTP. It needs a 16-character App Password, which only exists once 2-Step Verification is on. | Create an App Password (Google Account, Security, 2-Step Verification, App passwords), paste it into `SMTP_PASS` without spaces, and make sure `SMTP_USER` is the same account. Restart the server. |
| Found only N usable recent stories | Bing News returned coverage, but after deduplication, the 30 day window and the page check fewer than three stories were left. Narrow or very recent topics do this. | Broaden the topic (fewer words, or a wider subject) and run it again. The tool stops on purpose here rather than padding the issue. |
| Could not reach Bing News | Neither feed returned a single item and at least one request failed: no network, a proxy in the way, a 10 second timeout, or Bing answered with an error status (the message quotes it). When both feeds answer but are empty the message is Bing News has no recent coverage of "{topic}" instead. | Check the connection, open https://www.bing.com/news in a browser, and run it again. |
| The first click takes a minute | The local model was still loading into memory. The server warms it at startup, but a model that was evicted or that was pulled after startup loads on the first write. A write stage that sits at two full minutes and then produces a plain issue is a different case: the model answered too slowly, the 120 second limit ran out and the template took over (see the next row). | Wait for it; the next runs take 22 to 60 seconds depending on the GPU. Keep the server running between runs, since the model stays loaded for 30 minutes after each use. |
| The copy looks plain and there is no At a glance band | Ollama is not running, has no model installed, failed the one-token test request, failed on this run, or took longer than the writer's 120 second limit, so the built-in template wrote the issue. The result line on the page says so after the send (Written by the built-in template, with the reason), and the server log says why (a line starting with writer:). When Ollama is off or has no model, the sources line on the page also reads Writer: built-in template. | Start Ollama and run `ollama pull qwen3.5:4b`, then restart the server. If `OLLAMA_MODEL` names a model, make sure that exact name is installed. If the reason says the model did not answer the test request, Ollama's runner is hung: quit and reopen Ollama, then run it again. If the write ran out of time, Ollama was generating too slowly: run `ollama ps` to see what is loaded, free the GPU from anything else, and run it again. |
| A story has no picture | The page has no `og:image` or `twitter:image`, declared one that is portrait or square (taller than 3:4), or did not answer within six seconds, and Bing had no thumbnail of at least 600px for it. The story renders without a picture by design. | Nothing to fix. Topics covered by major outlets give more pictures in the demo. |
| The run stopped when I closed the tab | The server treats the closed connection as a cancel: the feed, page and model requests are aborted, nothing is sent, and the server's log line for the request reads `cancelled` instead of `ok`. | Run it again and keep the tab open until the status line reads Delivered. |
| Port 3000 in use | Another process is already listening on 3000. The server logs Port 3000 is already in use and exits. A `PORT` outside 1 to 65535 is ignored and the server falls back to 3000. | Set `PORT` in `.env` to another number and restart, or stop the other process. |

## Credits and disclaimer

This is a class project built by a student. It is not an official Biola University communication and is not endorsed by the university. Biola's colors, typefaces and graphic devices are used as described in the public brand standards at https://www.biola.edu/brand/toolkits-standards/visual-design. The official logo is not used because the logo files are restricted to authorized Biola users; a text wordmark stands in for it, and both the page footer and the email footer say the tool is a class project, not an official Biola communication.
