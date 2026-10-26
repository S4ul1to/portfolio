// Local web server for the Biola newsletter tool.
// node:http only. The routes are fixed, see the router near the bottom of this file.
//
//   GET  /             public/index.html
//   GET  /brand.css    brandCss() from src/brand.js
//   GET  /api/config   configStatus()
//   GET  /api/preview  the sample issue rendered as HTML
//   POST /api/send     { topic } in, newline-delimited JSON events out
//   anything else      404 JSON

import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { brandCss } from './brand.js';
import { loadConfig, configStatus } from './config.js';
import { research } from './research.js';
import { renderNewsletter } from './newsletter.js';
import { sampleContent, sampleMeta } from './sample.js';
import { sendNewsletter } from './mailer.js';
import { resolveWriter, warmUp, writerLabel } from './writer.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.join(here, '..', 'public', 'index.html');

const MAX_BODY_BYTES = 10 * 1024;
const MAX_TOPIC_LENGTH = 120;
const STAGES = new Set(['search', 'write', 'send']);

// Helpers

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function elapsedSeconds(startedAt) {
  return ((Date.now() - startedAt) / 1000).toFixed(1);
}

function log(line) {
  process.stdout.write(`${new Date().toISOString()} ${line}\n`);
}

function logError(err) {
  process.stderr.write(`${err && err.stack ? err.stack : String(err)}\n`);
}

function plainMessage(err) {
  if (err && typeof err.message === 'string' && err.message.trim()) return err.message.trim();
  return 'The run failed. Check the server log for details.';
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  });
  res.end(payload);
}

function sendText(res, status, contentType, body, headers = {}) {
  res.writeHead(status, {
    'content-type': contentType,
    'content-length': Buffer.byteLength(body),
    ...headers,
  });
  res.end(body);
}

// Collect the request body up to a byte limit. Anything larger is a 400.
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      fn(value);
    };
    req.on('data', (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > limit) {
        finish(reject, new RequestError(400, `Keep the request under ${limit / 1024} KB.`));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => finish(resolve, Buffer.concat(chunks).toString('utf8')));
    req.on('error', (err) => finish(reject, err));
  });
}

function parseTopic(raw) {
  let body;
  try {
    body = raw.trim() ? JSON.parse(raw) : {};
  } catch {
    throw new RequestError(400, 'Send a JSON body with a topic, for example {"topic":"campus sustainability"}.');
  }
  const topic = body && typeof body.topic === 'string' ? body.topic.trim() : '';
  if (!topic) throw new RequestError(400, 'Enter a topic.');
  if (topic.length > MAX_TOPIC_LENGTH) {
    throw new RequestError(400, `Keep the topic to ${MAX_TOPIC_LENGTH} characters or fewer.`);
  }
  return topic;
}

// GET /

async function serveIndex(res) {
  let html;
  try {
    html = await readFile(indexPath, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      sendJson(res, 500, { error: 'public/index.html is missing.' });
      return;
    }
    throw err;
  }
  sendText(res, 200, 'text/html; charset=utf-8', html, { 'cache-control': 'no-store' });
}

// POST /api/send
// Validation problems answer with a 400 JSON body. Once the stream starts the
// status is 200 and every outcome, including failure, is an event line.

async function handleSend(req, res, startedAt) {
  let topic;
  try {
    topic = parseTopic(await readBody(req, MAX_BODY_BYTES));
  } catch (err) {
    const status = err instanceof RequestError ? err.status : 400;
    sendJson(res, status, { error: plainMessage(err) });
    log(`POST /api/send ${status} ${elapsedSeconds(startedAt)}s`);
    return;
  }

  res.on('error', logError);
  res.writeHead(200, {
    'content-type': 'application/x-ndjson; charset=utf-8',
    'cache-control': 'no-cache',
    'x-accel-buffering': 'no',
  });
  res.flushHeaders();

  // 'close' before the response finished means the browser went away mid-run.
  // Stop the model call and never send an email nobody is waiting for.
  const abort = new AbortController();
  res.on('close', () => {
    if (!res.writableFinished) abort.abort();
  });

  const emitted = new Set();
  const write = (event) => {
    if (res.destroyed || res.writableEnded) return;
    res.write(`${JSON.stringify(event)}\n`);
  };
  const stage = (name, message) => {
    const key = String(name);
    if (!STAGES.has(key)) return;
    emitted.add(key);
    write({ event: 'stage', stage: key, message: String(message ?? '') });
  };

  let outcome = 'ok';
  try {
    const status = configStatus();
    if (!status.ready) {
      throw new Error(
        `Setup needed. Missing ${status.missing.join(', ')}. Copy .env.example to .env to set them.`,
      );
    }
    const config = loadConfig();
    const to = config.toEmail;

    stage('search', `Searching the web for recent coverage of "${topic}".`);
    const content = await research(topic, { onStage: stage, signal: abort.signal });
    if (!emitted.has('write')) stage('write', 'Writing the newsletter.');

    const { subject, html, text } = renderNewsletter(content, {
      topic,
      date: new Date(),
      repoUrl: config.repoUrl,
      to,
    });

    if (abort.signal.aborted) {
      throw new Error('Cancelled: the browser disconnected before the newsletter was sent.');
    }
    stage('send', `Sending to ${to}.`);
    await sendNewsletter({ to, subject, html, text }, config);

    write({
      event: 'done',
      to,
      subject,
      title: content.title,
      sources: Array.isArray(content.stories) ? content.stories.length : 0,
      writer: typeof content.writerNote === 'string' ? content.writerNote : '',
      sentAt: new Date().toISOString(),
      html,
    });
  } catch (err) {
    outcome = abort.signal.aborted ? 'cancelled' : 'error';
    logError(err);
    write({ event: 'error', message: plainMessage(err) });
  } finally {
    if (!res.destroyed && !res.writableEnded) res.end();
    log(`POST /api/send "${topic}" ${outcome} ${elapsedSeconds(startedAt)}s`);
  }
}

// Router

async function handle(req, res) {
  const startedAt = Date.now();
  const method = req.method || 'GET';

  let pathname;
  try {
    pathname = new URL(req.url || '/', 'http://localhost').pathname;
  } catch {
    sendJson(res, 400, { error: 'Bad request URL.' });
    log(`${method} ${req.url} 400 ${elapsedSeconds(startedAt)}s`);
    return;
  }

  const route = `${method} ${pathname}`;

  if (route === 'POST /api/send') {
    await handleSend(req, res, startedAt);
    return;
  }

  res.on('finish', () => {
    log(`${route} ${res.statusCode} ${elapsedSeconds(startedAt)}s`);
  });

  try {
    switch (route) {
      case 'GET /':
        await serveIndex(res);
        return;
      case 'GET /brand.css':
        sendText(res, 200, 'text/css; charset=utf-8', brandCss(), { 'cache-control': 'no-store' });
        return;
      case 'GET /api/config': {
        const status = configStatus();
        const writer = status.provider === 'web' ? writerLabel(await resolveWriter(status.ollama)) : `Claude ${status.model}`;
        const sources = status.provider === 'web' ? 'Bing News' : 'Claude web search';
        sendJson(res, 200, { ...status, writer, sources });
        return;
      }
      case 'GET /api/preview': {
        const { html } = renderNewsletter(sampleContent, sampleMeta);
        sendText(res, 200, 'text/html; charset=utf-8', html, { 'cache-control': 'no-store' });
        return;
      }
      default:
        sendJson(res, 404, { error: 'Not found.' });
    }
  } catch (err) {
    logError(err);
    if (!res.headersSent) {
      sendJson(res, 500, { error: 'Server error. Check the server log for details.' });
    } else if (!res.writableEnded) {
      res.end();
    }
  }
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    logError(err);
    if (!res.headersSent) {
      sendJson(res, 500, { error: 'Server error. Check the server log for details.' });
    } else if (!res.writableEnded) {
      res.end();
    }
  });
});

// Startup

function resolvePort() {
  try {
    return loadConfig().port;
  } catch {
    // No .env yet. Apply the same range check config.js uses, so a bad PORT
    // falls back to 3000 instead of crashing listen().
    const parsed = Number.parseInt(process.env.PORT ?? '', 10);
    return Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : 3000;
  }
}

const port = resolvePort();

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    logError(`Port ${port} is already in use. Set PORT in .env to use another port.`);
  } else {
    logError(err);
  }
  process.exit(1);
});

server.listen(port, () => {
  log(`Biola newsletter tool: http://localhost:${port}`);
  try {
    const status = configStatus();
    if (status.ready) {
      log(`Ready. Delivering to ${status.to}.`);
    } else {
      log(`Setup needed. Missing ${status.missing.join(', ')}. Copy .env.example to .env to set them.`);
    }
    if (status.provider === 'web') {
      // Load the local model now so the first click does not pay for it.
      warmUp(status.ollama)
        .then((writer) => log(`Sources: Bing News. Writer: ${writerLabel(writer)}.${writer.reason ? ` ${writer.reason}` : ''}`))
        .catch(logError);
    } else {
      log(`Sources: Claude web search. Writer: Claude ${status.model}.`);
    }
  } catch (err) {
    logError(err);
  }
});
