// engine/formula.js — pure, DOM-free evaluation of homebrew rule formulas
// (docs/HOMEBREW-RULES.md §3). A formula is a flat list of additive terms; each
// term is a signed monomial: sign × coef × Π(times) ÷ Π(over). There is no
// operator DSL — a rule author composes terms out of refs, and this module only
// multiplies, divides, and sums.
//
// Null contract: evaluation returns null when any ref is unresolvable or a term
// divides by zero. The caller renders that as a placeholder pill — the engine
// never fabricates a number. `note` fields are documentation only and ignored.

/**
 * Resolve a single ref string to a number.
 * @callback resolveRef
 * @param {string} ref  e.g. "attribute|Toughness|Step", "talent|Durability|Rank",
 *                      "characteristics|uncon"
 * @returns {number|undefined} undefined means the ref cannot be resolved — the
 *                             whole rating evaluates to null.
 */

/**
 * Evaluate one term: sign × coef × Π(times) ÷ Π(over).
 * A term is `{ ref }`, `{ times: [...] }`, or a bare constant `{ coef }`.
 * @param {object} term
 * @param {resolveRef} resolve
 * @returns {number|null} null on an unresolvable ref or a zero denominator.
 */
export function evalTerm(term, resolve) {
  const sign = term?.sign === 'subtract' ? -1 : 1;
  const factors = term?.ref != null ? [term.ref] : (term?.times ?? []);
  let value = term?.coef ?? 1;
  for (const ref of factors) {
    const v = resolve(ref);
    if (typeof v !== 'number') return null;
    value *= v;
  }
  if (!term?.over?.length) return sign * value;
  let divisor = 1;
  for (const ref of term.over) {
    const v = resolve(ref);
    if (typeof v !== 'number') return null;
    divisor *= v;
  }
  if (divisor === 0) return null;
  return sign * (value / divisor);
}

/**
 * Evaluate a rating's formula: the sum of its signed terms.
 * @param {{terms: Array<object>}} formula
 * @param {resolveRef} resolve
 * @returns {number|null} null if any term is unresolvable or divides by zero.
 */
export function evalFormula(formula, resolve) {
  let total = 0;
  for (const term of formula?.terms ?? []) {
    const v = evalTerm(term, resolve);
    if (v === null) return null;
    total += v;
  }
  return total;
}
