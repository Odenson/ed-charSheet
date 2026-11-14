import fs from 'node:fs';
const css = `.hl{background:transparent !important;padding:0 !important}
.dice{width:16px;height:16px;border-radius:50%;border:1px solid var(--accent);background:var(--accent-bg);color:var(--accent);display:inline-flex;align-items:center;justify-content:center;font-size:var(--fs-eyebrow);padding:0;margin-right:6px;vertical-align:middle}
.val.rec{display:inline-flex;align-items:center}
</style>`;
for (const [src, dst] of [['v1calm.html', 'v2calm.html'], ['v1risk.html', 'v2risk.html']]) {
  let s = fs.readFileSync(src, 'utf8');
  s = s.replace('</style>', css);
  s = s.replace(/<span class=val>(\d+ \/ \d+)<\/span>(<\/div><\/div><\/div>)$/, '<span class="val rec"><span class=dice>⚄</span>$1</span>$2');
  if (!s.includes('val rec')) throw new Error('recoveries not matched in ' + src);
  fs.writeFileSync(dst, s);
}
