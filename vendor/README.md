# vendor/

Third-party runtime dependencies, self-hosted so the app has **no external
runtime dependency** at page load. Keeping the no-build ethos (still just static
files + an import map — no bundler, no npm at deploy time), this removes the
"CDN unreachable → blank screen" failure mode and lets the app work offline.

## lit-3.2.1.js

- **What:** Lit 3.2.1, pre-bundled as a single self-contained ES module
  (reactive-element + lit-html + lit-element inlined; no internal bare imports).
- **Exports used by the app:** `LitElement`, `html`, `css` (imported as the bare
  specifier `lit`, resolved by the import map in `index.html`).
- **Source:** `https://esm.sh/lit@3.2.1/es2022/lit.bundle.mjs`
- **Fetched:** 2026-08-01
- **SHA-256:** `7b1b8012b002dc963e72b1e7baab2e8e4997c8a0a0803b0a3e02d3354817e01f`

### Refreshing / upgrading Lit

Only needed when deliberately changing the Lit version. From the repo root:

```bash
# pick the new version, then:
curl -sL "https://esm.sh/lit@<VERSION>/es2022/lit.bundle.mjs" -o vendor/lit-<VERSION>.js
# sanity-check it is self-contained (this should print nothing but line 1):
grep -nE "esm\.sh|https?://|import\(" vendor/lit-<VERSION>.js | grep -v "^1:"
# then point index.html's import map at the new file and delete the old one.
```

Do **not** copy `node_modules/lit/index.js` directly — the npm package imports
`@lit/reactive-element` and `lit-html` as bare specifiers, so it is not
self-contained. Use the pre-bundled build above.
