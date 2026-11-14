import fs from 'node:fs';
const css = fs.readFileSync('common.css', 'utf8');
const card = (opt, dmg, fillPct, fillColor, numColor, wounds, woundColor) => `
<div class="opt"><div class="cap">${opt.name}</div>
<div class="blk"><h4>Health<span class="hstate">Conscious</span></h4>
<div class="hl"><span class=l>Damage</span><div class="track ${opt.cls}"><div class=fill style="width:${fillPct}%;background:${fillColor}"></div><div class=tick style="left:80.5%"></div></div><span class=v style="color:${numColor}">${dmg}</span></div>
<div class="hl"><span class=l>Wounds</span><span class=v style="color:${woundColor}">${wounds}</span></div>
<div class=stats><div class=line><span>Unconscious</span><span class=val>58</span></div><div class=line><span>Death</span><span class=val>72</span></div><div class=line><span>Wound Threshold</span><span class=val>11</span></div><div class=line><span>Recoveries</span><span class="val rec"><span class=dice>⚄</span>0 / 3</span></div></div></div></div>`;
const opts = [
  { name: 'A — solid grey track', cls: 'a' },
  { name: 'B — outlined track', cls: 'b' },
  { name: 'C — hairline track, taller tick', cls: 'c' },
];
const row = (title, args) => `<h3>${title}</h3><div class=row>${opts.map((o) => card(o, ...args)).join('')}</div>`;
const html = `<!doctype html><meta charset=utf-8><style>${css}
body{width:auto;height:auto;padding:16px;background:#12151b}
h3{font-size:.8rem;font-weight:500;color:#93a0b3;margin:14px 0 6px}
.row{display:flex;gap:16px;flex-wrap:wrap}
.opt{width:355px}.cap{font-size:.8rem;font-weight:500;color:#e6e9ee;margin-bottom:4px}
.blk{height:168px}
.hl{display:flex;gap:12px;justify-content:space-between;align-items:center;height:25px;margin-bottom:3px;font-size:var(--fs-body);font-weight:500;color:inherit}
.hl .l{width:50px;flex:none}.hl .v{font-size:var(--fs-title);font-weight:500;min-width:22px;text-align:right}
.track{flex:1;position:relative}
.fill{position:absolute;left:0;top:0;bottom:0;min-width:5px;border-radius:3px}
.tick{position:absolute;width:2px;background:#93a0b3;opacity:.9;border-radius:1px}
.track.a{height:6px;border-radius:3px;background:#3a4150}.track.a .tick{top:-3px;bottom:-3px}
.track.b{height:8px;border-radius:4px;border:1px solid #4a5364;background:transparent}.track.b .fill{top:1px;bottom:1px;left:1px;border-radius:3px}.track.b .tick{top:-4px;bottom:-4px}
.track.c{height:3px;border-radius:2px;background:#4a5364}.track.c .fill{border-radius:2px}.track.c .tick{top:-6px;bottom:-6px}
.stats{margin-top:auto;border-top:1px solid var(--border);padding-top:3px}
.stats .line{font-size:var(--fs-small);padding:.5px 0}.stats .line span:first-child{color:var(--muted)}
.dice{width:16px;height:16px;border-radius:50%;border:1px solid var(--accent);background:var(--accent-bg);color:var(--accent);display:inline-flex;align-items:center;justify-content:center;font-size:var(--fs-eyebrow);margin-right:6px}
.val.rec{display:inline-flex;align-items:center}
</style>
${row('Calm — Damage 3 / Unconscious 58 / Death 72', [3, 4.2, '#93a0b3', '#f0f3f7', 0, '#f0f3f7'])}
${row('Risk — Damage 52 (amber), 2 Wounds', [52, 72.2, '#d9944e', '#d9944e', 2, '#e0846f'])}
`;
fs.writeFileSync('gauge-options.html', html);
