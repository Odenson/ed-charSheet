// PreToolUse hook (Edit|Write|NotebookEdit). On the first edit to a protected
// path in a session, denies once and asks for the ed-change-guardrail skill;
// the retry passes. Later edits in the same session pass untouched.
// Protected surfaces: docs/GUARDRAILS.md. Wired in .claude/settings.json.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const PROTECTED = [
  /^ui\//,
  /^engine\//,
  /^rules\/.+\.json$/,
  /^data\/character.*\.json$/,
  /^docs\/EFFECT-TAXONOMY\.md$/,
];

export function isProtected(filePath, cwd) {
  if (!filePath) return false;
  const rel = path.relative(cwd, path.resolve(cwd, filePath)).split(path.sep).join('/');
  return PROTECTED.some((re) => re.test(rel));
}

export function decide(input, markerDir = os.tmpdir()) {
  const cwd = input.cwd || process.cwd();
  const target = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
  if (!isProtected(target, cwd)) return null;
  const marker = path.join(markerDir, `ed-guardrail-${input.session_id || 'nosession'}`);
  if (fs.existsSync(marker)) return null;
  fs.writeFileSync(marker, new Date().toISOString());
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason:
        'Protected surface (see docs/GUARDRAILS.md). Load the ed-change-guardrail skill, ' +
        'classify this change as Tier 1/2/3, then retry the edit. This check runs once per session.',
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let raw = '';
  process.stdin.on('data', (c) => (raw += c));
  process.stdin.on('end', () => {
    let out = null;
    try { out = decide(JSON.parse(raw)); } catch { /* never block on hook errors */ }
    if (out) process.stdout.write(JSON.stringify(out));
  });
}
