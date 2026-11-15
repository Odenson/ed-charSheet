// deploy.mjs — `npm run deploy` in tools/worker. Runs `wrangler deploy` tagged
// with the current git commit, so the Cloudflare Deployments list shows which
// code a version came from. A "+dirty" suffix means tools/worker/ had
// uncommitted changes at deploy time. Only hex/static strings reach the shell.
import { execFileSync, spawnSync } from 'node:child_process';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

const sha = git('rev-parse', '--short', 'HEAD');
const dirty = git('status', '--porcelain', '--', '.') !== '';
const tag = dirty ? `${sha}+dirty` : sha;
const message = `Deploy ${tag}`;

console.log(`Deploying worker as ${tag}`);
const r = spawnSync('npx', ['wrangler', 'deploy', '--message', `"${message}"`, '--tag', `"${tag}"`], {
  stdio: 'inherit',
  shell: true, // npx is npx.cmd on Windows
});
process.exit(r.status ?? 1);
