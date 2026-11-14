// store-discord.js — per-character Discord webhook config (plans/discord-die-report).
// Device-local (localStorage), like store-rolllog.js: the webhook URL is a secret,
// so it is never part of character data, never exported, never in a GitHub save
// and never rides the edits overlay. Fails open on blocked/corrupt storage.

const discordKey = (id) => `ed-discord:${id}`;

const WEBHOOK_RE = /^https:\/\/(?:(?:ptb|canary)\.)?(?:discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+(?:\?.*)?$/;

const EMPTY = () => ({ url: '', enabled: false });

export function isDiscordWebhookUrl(url) {
  return typeof url === 'string' && WEBHOOK_RE.test(url);
}

/** A config sends only when switched on AND holding a valid webhook URL. */
export function discordReady(cfg) {
  return !!(cfg && cfg.enabled && isDiscordWebhookUrl(cfg.url));
}

export function loadDiscordConfig(id) {
  try {
    const raw = JSON.parse(localStorage.getItem(discordKey(id)) || 'null');
    if (!raw || typeof raw !== 'object') return EMPTY();
    return { url: typeof raw.url === 'string' ? raw.url : '', enabled: !!raw.enabled };
  } catch {
    return EMPTY();
  }
}

/** Persist `{url, enabled}` for `id`. A non-blank invalid URL is rejected unwritten. */
export function saveDiscordConfig(id, { url, enabled } = {}) {
  const u = typeof url === 'string' ? url.trim() : '';
  if (u !== '' && !isDiscordWebhookUrl(u)) return { ok: false, error: 'invalid-url' };
  try {
    localStorage.setItem(discordKey(id), JSON.stringify({ url: u, enabled: !!enabled }));
  } catch {
    /* storage full/unavailable — fail open */
  }
  return { ok: true };
}

export function clearDiscordConfig(id) {
  try {
    localStorage.removeItem(discordKey(id));
  } catch {
    /* fail open */
  }
}
