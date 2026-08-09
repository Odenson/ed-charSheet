#!/usr/bin/env bash
# Refresh the gitignored local working copies from the character-data branch:
#   data/characters.json    (grouped ed-characters/1 store)
#   data/custom-items.json  (ed-items/2 catalog)
#   data/chakka.jpg         (portrait)
#
# These copies are what store.js reads and tools/dev-server.mjs writes while the
# app runs off-Pages (README → Running locally; .gitignore). The branch — not the
# bundle — is the source of truth for character data, so a fresh clone has none
# of these files until this runs.
#
#   bash scripts/sync-local-data.sh              # overwrite with the latest branch state
#   bash scripts/sync-local-data.sh --if-missing # only create files that don't exist
#
# Prefers origin/character-data (the local character-data branch can go stale —
# it's only touched when the worker/fold pushes) and falls back to it.
set -euo pipefail
cd "$(dirname "$0")/.."

IF_MISSING=false
[ "${1:-}" = "--if-missing" ] && IF_MISSING=true

REF="origin/character-data"
git rev-parse --verify -q "$REF" >/dev/null 2>&1 || REF="character-data"
if ! git rev-parse --verify -q "$REF" >/dev/null 2>&1; then
  echo "error: no character-data branch (remote or local) to sync from" >&2
  exit 1
fi

mkdir -p data

# <branch-path> <local-path> <fallback content>
sync_json() {
  local remote_path="$1" local_path="$2" fallback="$3"
  if [ "$IF_MISSING" = true ] && [ -f "$local_path" ]; then
    return 0
  fi
  if git show "$REF:$remote_path" > "$local_path" 2>/dev/null; then
    echo "synced $local_path (from $REF)"
  else
    printf '%s\n' "$fallback" > "$local_path"
    echo "created $local_path (no $remote_path on $REF)"
  fi
}

sync_binary() {
  local remote_path="$1" local_path="$2"
  if [ "$IF_MISSING" = true ] && [ -f "$local_path" ]; then
    return 0
  fi
  if git show "$REF:$remote_path" > "$local_path" 2>/dev/null; then
    echo "synced $local_path (from $REF)"
  else
    rm -f "$local_path"
    echo "note: no $remote_path on $REF — leaving $local_path absent" >&2
  fi
}

sync_json data/characters.json data/characters.json '{"schema":"ed-characters/1","characters":{}}'
sync_json data/custom-items.json data/custom-items.json '{"schema":"ed-items/2","effectTaxonomy":"docs/EFFECT-TAXONOMY.md (v3)","source":"custom","notes":"Player-created items, folded into rules/custom-items.json on dev by CI.","items":{}}'
sync_binary data/chakka.jpg data/chakka.jpg
