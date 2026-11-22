// store-custom-skills.js — save + overlay plumbing for owner-created custom skills
// (plans/gen-skill-other I3). Mirrors store-custom-items.js: this module owns the
// /save-skills POST plus the local `ed-custom-skills` overlay (pending edits survive a
// reload and an offline worker); a confirmed save reconciles it away.
//
// Not an engine module: pure I/O plumbing (no game logic, no DOM).

import { SaveError } from './store-server.js';

export const DEFAULT_SKILLS_ENDPOINT = 'https://ed-charsheet-save.edsavechar.workers.dev/save-skills';

const OVERLAY_KEY = 'ed-custom-skills';

function messageForCode(code) {
  switch (code) {
    case 'unauthorized':
      return 'Your save key was rejected. Re-enter it and try again.';
    case 'invalid_skills':
      return 'One or more skills failed validation and were not saved.';
    case 'conflict':
      return 'The skill catalog kept changing under us — try saving again.';
    case 'upstream':
      return 'GitHub rejected the save. Check the token, then try again.';
    default:
      return 'The save did not complete.';
  }
}

/**
 * Save the custom-skill delta `{ [name]: skill }` to GitHub via the worker. Returns the
 * commit `{ sha, url }`; throws a typed {@link SaveError} otherwise. A missing key throws
 * `no_key` before any request (the worker fails closed).
 */
export async function saveCustomSkills(skills, { endpoint = DEFAULT_SKILLS_ENDPOINT, saveKey } = {}) {
  if (!saveKey) throw new SaveError('no_key', 'Enter your save key to save to GitHub.');
  let res;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-save-key': saveKey },
      body: JSON.stringify({ skills }),
    });
  } catch {
    throw new SaveError('offline', 'Could not reach the save service. Check your connection and try again.');
  }
  const out = await res.json().catch(() => null);
  if (!res.ok || !out || out.ok === false) {
    const code = out?.error?.code ?? `http_${res.status}`;
    throw new SaveError(code, out?.error?.message || messageForCode(code));
  }
  return out.commit;
}

/** The pending delta `{ skills: { [name]: skill } }`, or null (corrupt/absent reads as null). */
export function loadCustomSkillEdits() {
  try {
    const raw = JSON.parse(localStorage.getItem(OVERLAY_KEY) || 'null');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    if (!raw.skills || typeof raw.skills !== 'object' || Array.isArray(raw.skills)) return null;
    return raw;
  } catch {
    return null;
  }
}

export function hasCustomSkillPendingEdits() {
  const d = loadCustomSkillEdits();
  return !!d && Object.keys(d.skills).length > 0;
}

export function saveCustomSkillEdits(delta) {
  localStorage.setItem(OVERLAY_KEY, JSON.stringify(delta));
}

/** Clear the overlay — call only on a confirmed save success. */
export function reconcileCustomSkillEdits() {
  localStorage.removeItem(OVERLAY_KEY);
}

/** Upsert a delta onto a skills file by name (pure; core-agnostic — the merge filters core). */
export function applyCustomSkillEdits(file, delta) {
  if (!delta) return file;
  const skills = [...(Array.isArray(file?.skills) ? file.skills : [])];
  for (const [name, skill] of Object.entries(delta.skills ?? {})) {
    const i = skills.findIndex((s) => s?.name === name);
    if (i >= 0) skills[i] = skill;
    else skills.push(skill);
  }
  return { ...(file ?? {}), skills };
}

/**
 * True when a re-read of the committed `skills` array reflects a just-saved delta map.
 * Content-aware (a lagged read with old content is NOT reflected).
 */
export function isSkillsReflected(savedSkills, committedSkills) {
  const list = Array.isArray(committedSkills) ? committedSkills : [];
  for (const [name, skill] of Object.entries(savedSkills ?? {})) {
    const seen = list.find((s) => s?.name === name);
    if (!seen || JSON.stringify(seen) !== JSON.stringify(skill)) return false;
  }
  return true;
}
