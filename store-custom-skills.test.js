// store-custom-skills.test.js — run with `npm test` (node --test, no deps).
// Custom-skill save + overlay plumbing (plans/gen-skill-other I3), mirroring
// store-custom-items.test.js: saveCustomSkills (mocked worker), the `ed-custom-skills`
// localStorage overlay, applyCustomSkillEdits, isSkillsReflected.
// Assumption (spec leaves open): `committedSkills` passed to isSkillsReflected is the
// committed file's `skills` ARRAY (applyCustomSkillEdits also works on that array form).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  saveCustomSkills,
  loadCustomSkillEdits,
  hasCustomSkillPendingEdits,
  saveCustomSkillEdits,
  reconcileCustomSkillEdits,
  applyCustomSkillEdits,
  isSkillsReflected,
  DEFAULT_SKILLS_ENDPOINT,
} from './store-custom-skills.js';
import { SaveError } from './store-server.js';

function installLocalStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  return () => {
    delete globalThis.localStorage;
  };
}

const LORE = { name: 'Dwarven Mining Lore', category: 'knowledge', tier: 1, strain: 0, attribute: 'Perception', custom: true };
const DANCE = { name: 'Rope Dancing', category: 'general', tier: 2, strain: 0, attribute: 'Dexterity', summary: 'On a rope.', custom: true };

function mockFetch(handler) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    const { status = 200, body = {} } = handler(calls.length, { url: String(url), options });
    return new Response(JSON.stringify(body), { status });
  };
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

// --- saveCustomSkills -------------------------------------------------------------

test('DEFAULT_SKILLS_ENDPOINT points at the /save-skills route', () => {
  assert.match(DEFAULT_SKILLS_ENDPOINT, /\/save-skills$/);
});

test('saveCustomSkills POSTs { skills } to /save-skills with the key and returns the commit', async () => {
  const mock = mockFetch(() => ({ status: 200, body: { ok: true, commit: { sha: 'c1', url: 'https://github.com/commit/c1' } } }));
  try {
    const commit = await saveCustomSkills({ [LORE.name]: LORE }, { saveKey: 'k' });
    assert.equal(commit.sha, 'c1');
    assert.equal(commit.url, 'https://github.com/commit/c1');
    const call = mock.calls[0];
    assert.equal(call.url, DEFAULT_SKILLS_ENDPOINT);
    assert.equal(call.options.method, 'POST');
    assert.equal(call.options.headers['x-save-key'], 'k');
    assert.deepEqual(JSON.parse(call.options.body), { skills: { [LORE.name]: LORE } });
  } finally {
    mock.restore();
  }
});

test('saveCustomSkills honours an endpoint override', async () => {
  const mock = mockFetch(() => ({ status: 200, body: { ok: true, commit: { sha: 'c', url: 'u' } } }));
  try {
    await saveCustomSkills({}, { saveKey: 'k', endpoint: 'http://localhost:9/save-skills' });
    assert.equal(mock.calls[0].url, 'http://localhost:9/save-skills');
  } finally {
    mock.restore();
  }
});

test('saveCustomSkills without a save key -> SaveError no_key before any request', async () => {
  const mock = mockFetch(() => ({ status: 200, body: {} }));
  try {
    await assert.rejects(() => saveCustomSkills({}), SaveError);
    await assert.rejects(() => saveCustomSkills({}), (e) => e.code === 'no_key');
    assert.equal(mock.calls.length, 0);
  } finally {
    mock.restore();
  }
});

test('saveCustomSkills maps worker error codes to typed SaveError', async () => {
  const cases = [
    ['unauthorized', 'bad or missing save key', 401],
    ['invalid_skills', 'skills["x"]: attribute: unknown', 400],
    ['conflict', 'sha kept moving', 409],
    ['upstream', 'github 403', 502],
  ];
  for (const [code, message, status] of cases) {
    const mock = mockFetch(() => ({ status, body: { ok: false, error: { code, message } } }));
    try {
      await assert.rejects(() => saveCustomSkills({}, { saveKey: 'k' }), (e) => e instanceof SaveError && e.code === code && e.message === message);
    } finally {
      mock.restore();
    }
  }
});

test('saveCustomSkills unreachable worker -> SaveError offline', async () => {
  const mock = mockFetch(() => {
    throw new TypeError('fetch failed');
  });
  try {
    await assert.rejects(() => saveCustomSkills({}, { saveKey: 'k' }), (e) => e.code === 'offline');
  } finally {
    mock.restore();
  }
});

// --- ed-custom-skills overlay ----------------------------------------------------

test('overlay round-trip: save -> load -> hasPending -> reconcile clears', () => {
  const restore = installLocalStorage();
  try {
    assert.equal(loadCustomSkillEdits(), null);
    assert.equal(hasCustomSkillPendingEdits(), false);
    saveCustomSkillEdits({ skills: { [LORE.name]: LORE } });
    assert.deepEqual(loadCustomSkillEdits(), { skills: { [LORE.name]: LORE } });
    assert.equal(hasCustomSkillPendingEdits(), true);
    assert.ok(localStorage.getItem('ed-custom-skills'), 'stored under the ed-custom-skills key');
    reconcileCustomSkillEdits();
    assert.equal(loadCustomSkillEdits(), null);
    assert.equal(hasCustomSkillPendingEdits(), false);
  } finally {
    restore();
  }
});

test('overlay: a net-empty delta reads as not pending', () => {
  const restore = installLocalStorage();
  try {
    saveCustomSkillEdits({ skills: {} });
    assert.equal(hasCustomSkillPendingEdits(), false);
  } finally {
    restore();
  }
});

test('overlay: corrupt or wrong-shape storage reads as null (never blocks loading)', () => {
  const restore = installLocalStorage();
  try {
    for (const raw of ['{not json', '"a string"', '[]', JSON.stringify({ skills: 'nope' }), 'null']) {
      localStorage.setItem('ed-custom-skills', raw);
      assert.equal(loadCustomSkillEdits(), null, raw);
    }
  } finally {
    restore();
  }
});

test('the skills overlay is independent of the custom-items overlay key', () => {
  const restore = installLocalStorage();
  try {
    localStorage.setItem('ed-custom-items', JSON.stringify({ items: { X: { kind: 'gear', effects: [] } }, delete: [] }));
    assert.equal(loadCustomSkillEdits(), null);
    assert.equal(hasCustomSkillPendingEdits(), false);
  } finally {
    restore();
  }
});

// --- applyCustomSkillEdits ---------------------------------------------------------

const FILE = () => ({ schema: 'ed-skills/1', source: 'custom', notes: '', skills: [LORE] });

test('applyCustomSkillEdits upserts new skills into the array without dropping existing ones', () => {
  const file = FILE();
  const next = applyCustomSkillEdits(file, { skills: { [DANCE.name]: DANCE } });
  assert.deepEqual(next.skills.map((s) => s.name).sort(), ['Dwarven Mining Lore', 'Rope Dancing']);
  assert.deepEqual(next.skills.find((s) => s.name === DANCE.name), DANCE);
  assert.equal(next.schema, 'ed-skills/1');
  assert.equal(file.skills.length, 1, 'input file is never mutated');
});

test('applyCustomSkillEdits: same name replaces (upsert), not a second row', () => {
  const edited = { ...LORE, summary: 'Edited copy.' };
  const next = applyCustomSkillEdits(FILE(), { skills: { [LORE.name]: edited } });
  assert.equal(next.skills.length, 1);
  assert.deepEqual(next.skills[0], edited);
});

test('applyCustomSkillEdits is core-agnostic (no core-name filtering here)', () => {
  const clash = { ...LORE, name: 'Alchemy' };
  const next = applyCustomSkillEdits(FILE(), { skills: { Alchemy: clash } });
  assert.ok(next.skills.some((s) => s.name === 'Alchemy'));
});

test('applyCustomSkillEdits with no delta returns the file unchanged', () => {
  const file = FILE();
  assert.equal(applyCustomSkillEdits(file, null), file);
});

test('applyCustomSkillEdits on a file with no skills array still yields the delta skills', () => {
  const next = applyCustomSkillEdits({ schema: 'ed-skills/1', skills: [] }, { skills: { [LORE.name]: LORE } });
  assert.deepEqual(next.skills, [LORE]);
});

// --- isSkillsReflected -------------------------------------------------------------

test('isSkillsReflected: an equal re-read confirms the save', () => {
  assert.equal(isSkillsReflected({ [LORE.name]: LORE }, [LORE]), true);
  assert.equal(isSkillsReflected({ [LORE.name]: LORE }, [DANCE, LORE]), true, 'extra committed skills do not matter');
  assert.equal(isSkillsReflected(null, []), true, 'nothing saved is trivially reflected');
  assert.equal(isSkillsReflected({}, []), true);
});

test('isSkillsReflected: missing or lagged (old content) read is NOT reflected', () => {
  assert.equal(isSkillsReflected({ [LORE.name]: LORE }, []), false, 'skill absent -> still pending');
  const stale = { ...LORE, summary: 'old text' };
  assert.equal(isSkillsReflected({ [LORE.name]: { ...LORE, summary: 'new text' } }, [stale]), false, 'same name, old content -> still pending');
});
