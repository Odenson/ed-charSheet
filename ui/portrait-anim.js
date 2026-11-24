// ui/portrait-anim.js — pure, DOM-free helpers for the optional portrait
// animations (Slow drift, Embers): device preference parsing and the ember
// particle step. No imports; `rand` and the storage getter are injected so
// tests are deterministic. See plans/simple-animate-portrait/spec.md.

export const PORTRAIT_DRIFT_KEY = 'ed-portrait-drift';
export const PORTRAIT_EMBERS_KEY = 'ed-portrait-embers';
export const MAX_DT = 0.05;

const MIN_CAP = 4;
const MAX_CAP = 60;

/** Read both prefs; only the literal 'on' is on. A throwing getter reads off. */
export function readPortraitAnim(getItem) {
  const on = key => {
    try { return getItem(key) === 'on'; } catch { return false; }
  };
  return { drift: on(PORTRAIT_DRIFT_KEY), embers: on(PORTRAIT_EMBERS_KEY) };
}

export function portraitAnimValue(bool) {
  return bool ? 'on' : 'off';
}

/** Max live embers for a frame: scales with area, bounded; 0 for no area. */
export function emberCap(w, h) {
  if (!(w > 0) || !(h > 0)) return 0;
  const n = Math.round((w * h) / 4000);
  return Math.max(MIN_CAP, Math.min(MAX_CAP, n));
}

/** A new ember at/near the bottom of the frame, inside it. */
export function spawnEmber(w, h, rand) {
  const kind = rand() < 0.7 ? 'spark' : 'ash';
  const maxLife = 2.5 + rand() * 3;
  return {
    x: rand() * w,
    y: h - rand() * (h * 0.15),
    vx: (rand() - 0.5) * 10,
    vy: -(14 + rand() * 26),
    r: kind === 'spark' ? 0.8 + rand() * 1.6 : 1 + rand() * 2,
    life: maxLife * (0.5 + rand() * 0.5),
    maxLife,
    kind,
  };
}

/** Advance particles by dt seconds; returns a new array (input untouched). */
export function stepEmbers(particles, dt, w, h, rand) {
  if (!(w > 0) || !(h > 0)) return [];
  const d = Math.min(Math.max(Number.isFinite(dt) ? dt : 0, 0), MAX_DT);
  const out = [];
  for (const p of particles) {
    const life = p.life - d;
    if (life <= 0) continue;
    const age = p.maxLife - life;
    const x = p.x + (p.vx + Math.sin(age * 2 + p.r * 5) * 6) * d;
    const y = p.y + p.vy * d;
    if (y < 0 || y > h || x < 0 || x > w) continue;
    out.push({ ...p, x, y, life });
  }
  const cap = emberCap(w, h);
  // Gentle top-up (a few per frame at most) so the population builds up.
  let spawn = Math.min(3, cap - out.length);
  while (spawn-- > 0 && rand() < 0.35 + d * 4) out.push(spawnEmber(w, h, rand));
  return out;
}
