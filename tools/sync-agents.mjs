// Generates .claude/agents/*.md and .opencode/agent/*.md from the single
// source in .agents/. Usage: node tools/sync-agents.mjs [--check]
// Source layout, per agent <name>:
//   .agents/<name>.md           description (frontmatter) + shared body;
//                               {{#claude}}..{{/claude}} / {{#opencode}}..{{/opencode}}
//                               blocks hold tool-specific text
//   .agents/<name>.claude.yml   extra Claude frontmatter (tools, model)
//   .agents/<name>.opencode.yml extra OpenCode frontmatter (mode, permission)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, '.agents');
const targets = {
  claude: { dir: '.claude/agents', named: true },
  opencode: { dir: '.opencode/agent', named: false },
};

export function render(name, target, read = (f) => fs.readFileSync(path.join(srcDir, f), 'utf8')) {
  const m = read(`${name}.md`).match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${name}.md: missing frontmatter`);
  let body = m[2];
  for (const t of Object.keys(targets)) {
    const re = new RegExp(`\\{\\{#${t}\\}\\}\\n([\\s\\S]*?)\\{\\{/${t}\\}\\}\\n`, 'g');
    body = body.replace(re, t === target ? '$1' : '');
  }
  const frag = read(`${name}.${target}.yml`).replace(/\n$/, '');
  const head = [targets[target].named ? `name: ${name}` : null, m[1], frag].filter(Boolean).join('\n');
  return `---\n${head}\n---\n${body}`;
}

export function expected() {
  const out = {};
  const names = fs.readdirSync(srcDir).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));
  for (const name of names) {
    for (const [t, { dir }] of Object.entries(targets)) {
      out[path.join(dir, `${name}.md`)] = render(name, t);
    }
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  let stale = 0;
  for (const [rel, text] of Object.entries(expected())) {
    const file = path.join(root, rel);
    const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (cur === text) continue;
    stale++;
    if (check) console.error(`out of sync: ${rel}`);
    else { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); console.log(`wrote ${rel}`); }
  }
  if (check && stale) { console.error('run: node tools/sync-agents.mjs'); process.exit(1); }
}
