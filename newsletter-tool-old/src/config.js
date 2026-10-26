// Environment configuration for the Biola newsletter tool.
// Reads .env from the project root once, applies defaults, trims every value,
// and reports which required variables are missing for the chosen provider.
//
// Providers: "web" (default) collects stories from Bing News and writes with a local
// Ollama model or a template, so only the Gmail credentials are required.
// "anthropic" uses Claude and also needs ANTHROPIC_API_KEY.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(here, '..', '.env');

const DEFAULTS = {
  RESEARCH_PROVIDER: 'web',
  OLLAMA_URL: 'http://localhost:11434',
  OLLAMA_MODEL: '',
  ANTHROPIC_MODEL: 'claude-opus-5-5',
  ANTHROPIC_FALLBACKS: '1',
  SMTP_HOST: 'smtp.gmail.com',
  SMTP_PORT: '465',
  PORT: '3000',
  REPO_URL: 'https://github.com/S4ul1to/portfolio',
};

const REQUIRED_BY_PROVIDER = {
  web: ['SMTP_USER', 'SMTP_PASS'],
  anthropic: ['ANTHROPIC_API_KEY', 'SMTP_USER', 'SMTP_PASS'],
};

let envLoaded = false;

// Load .env once. Values already present in the environment win over the file,
// which is how process.loadEnvFile behaves. A missing or unreadable file is not
// an error here: configStatus() reports the missing names instead.
function loadEnvOnce() {
  if (envLoaded) return;
  envLoaded = true;
  try {
    process.loadEnvFile(envPath);
  } catch {
    // No .env yet. The caller sees the missing names.
  }
}

// Trimmed value, or the default when the variable is unset or blank.
function read(name) {
  const raw = process.env[name];
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (value) return value;
  return Object.hasOwn(DEFAULTS, name) ? DEFAULTS[name] : '';
}

function readPort(name, fallback) {
  const parsed = Number.parseInt(read(name), 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : fallback;
}

// "0", "false", "no" and "off" turn a flag off. Anything else is on.
function readFlag(name) {
  const value = read(name).toLowerCase();
  return !['0', 'false', 'no', 'off'].includes(value);
}

function readProvider() {
  return read('RESEARCH_PROVIDER').toLowerCase() === 'anthropic' ? 'anthropic' : 'web';
}

function readOllama() {
  return { url: read('OLLAMA_URL').replace(/\/+$/, ''), model: read('OLLAMA_MODEL') };
}

function missingNames(provider) {
  return REQUIRED_BY_PROVIDER[provider].filter((name) => !read(name));
}

export function setupMessage(missing) {
  return `Setup needed. Missing ${missing.join(', ')}. Copy .env.example to .env to set them.`;
}

// Never throws. Research and the dry run need the config even before the Gmail
// credentials exist; the server checks `missing` before it sends anything.
export function loadConfig() {
  loadEnvOnce();
  const provider = readProvider();
  const smtpUser = read('SMTP_USER');
  const smtpPort = readPort('SMTP_PORT', 465);

  return {
    researchProvider: provider,
    missing: missingNames(provider),
    ollama: readOllama(),
    anthropicApiKey: read('ANTHROPIC_API_KEY'),
    anthropicModel: read('ANTHROPIC_MODEL'),
    anthropicFallbacks: readFlag('ANTHROPIC_FALLBACKS'),
    smtp: {
      host: read('SMTP_HOST'),
      port: smtpPort,
      secure: smtpPort === 465,
      user: smtpUser,
      pass: read('SMTP_PASS'),
    },
    toEmail: read('TO_EMAIL') || smtpUser,
    port: readPort('PORT', 3000),
    repoUrl: read('REPO_URL'),
  };
}

// Safe to call from any route. Never throws.
export function configStatus() {
  try {
    loadEnvOnce();
    const provider = readProvider();
    const missing = missingNames(provider);
    return {
      ready: missing.length === 0,
      missing,
      to: read('TO_EMAIL') || read('SMTP_USER') || null,
      provider,
      model: read('ANTHROPIC_MODEL'),
      ollama: readOllama(),
    };
  } catch {
    return {
      ready: false,
      missing: [...REQUIRED_BY_PROVIDER.web],
      to: null,
      provider: 'web',
      model: DEFAULTS.ANTHROPIC_MODEL,
      ollama: { url: DEFAULTS.OLLAMA_URL, model: '' },
    };
  }
}
