#!/usr/bin/env bash
# Start the local EDCharSheet instance — the file-backed local dev loop
# (README → Running locally; tools/dev-server.mjs).
#
#   1. Creates the gitignored local working copies from character-data if they
#      don't exist yet (never overwrites your local saves), and the /dev symlink
#      that simulates the deployed dev instance (the DEV pill keys on the URL
#      path — a Tier-1 rule; the symlink mirrors /dev/ without touching it).
#   2. Starts the dev server — the static app plus the two save routes
#      (POST /save, POST /save-items) — on $PORT (default 8000). Saves land in
#      the gitignored data/ working copies: no Cloudflare, no GitHub, no secrets.
#
# Usage:
#   bash scripts/start-local.sh          # or: npm start
#   PORT=9000 bash scripts/start-local.sh
#
# Saves are same-origin, so no query flags are needed — just open the printed
# URL. The save-key prompt still appears on first save; type anything (the
# local server accepts any/missing key).
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-8000}"

bash scripts/sync-local-data.sh --if-missing

if [ ! -e dev ] && [ ! -L dev ]; then
  ln -s . dev
  echo "created the /dev symlink (simulates the deployed dev instance)"
fi

echo "EDCharSheet local instance"
echo "  app:  http://localhost:$PORT/          production-like (no DEV pill)"
echo "  app:  http://localhost:$PORT/dev/       dev instance (DEV pill, dev-only UI)"
echo "  saves: POST /save and /save-items → gitignored data/ working copies"
echo "  Ctrl+C to stop"
exec node tools/dev-server.mjs --port "$PORT"
