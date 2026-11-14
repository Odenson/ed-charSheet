// discord-send.js — the one I/O call for the Discord die report. Never throws,
// never logs, and never puts the webhook URL (a secret) into its result.

export async function postWebhook(url, payload, fetchImpl = globalThis.fetch) {
  try {
    if (typeof fetchImpl !== 'function') return { ok: false, message: 'Network error' };
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res && res.ok) return { ok: true };
    return { ok: false, message: `HTTP ${res?.status ?? 0}` };
  } catch {
    return { ok: false, message: 'Network error' };
  }
}
