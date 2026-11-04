#!/bin/bash
# installCommand de Vercel (cf. vercel.json). Le build distant ne contient pas
# ../trackr, que package.json consomme par "trackr-attribution": "file:../trackr/attribution" :
# on le clone sur main avant `bun install`. Si ../trackr existe déjà, le clone est sauté.
#
# TRACKR_DEPLOY_KEY : clé SSH privée (multiligne) d'une deploy key de inforeole/trackr.
# Elle est écrite dans un fichier mode 600 supprimé en sortie, jamais affichée.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TRACKR_DIR="${RD_TRACKR_DIR:-$ROOT/../trackr}"
TRACKR_REPO="${RD_TRACKR_REPO:-git@github.com:inforeole/trackr.git}"

if [ ! -d "$TRACKR_DIR" ]; then
  if [ -z "${TRACKR_DEPLOY_KEY:-}" ]; then
    echo "vercel-install: $TRACKR_DIR est absent et TRACKR_DEPLOY_KEY n'est pas définie (clé SSH privée de la deploy key inforeole/trackr, variable d'environnement du projet Vercel)." >&2
    exit 1
  fi
  umask 077
  key_file="$(mktemp)"
  trap 'rm -f "$key_file"' EXIT
  printf '%s\n' "$TRACKR_DEPLOY_KEY" > "$key_file"
  # Empreinte publique seulement, à comparer à la deploy key de inforeole/trackr en cas de refus.
  echo "vercel-install: clé $(ssh-keygen -lf "$key_file" 2>&1 | cut -d' ' -f1-2)"
  GIT_SSH_COMMAND="ssh -i $key_file -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" \
    git clone --quiet --depth 1 --branch main "$TRACKR_REPO" "$TRACKR_DIR"
fi

echo "vercel-install: trackr $(git -C "$TRACKR_DIR" rev-parse HEAD 2>/dev/null || echo 'sans historique git')"
cd "$ROOT"
bun install --frozen-lockfile

# Selon sa version, Bun remplit node_modules/trackr-attribution de liens symboliques vers ../trackr, hors de la racine
# du projet. On les remplace par une copie propre à ce build.
if [ -L node_modules/trackr-attribution ] || [ -n "$(find node_modules/trackr-attribution -maxdepth 3 -type l -print -quit)" ]; then
  copy="$(mktemp -d)"
  cp -RL node_modules/trackr-attribution/. "$copy/"
  rm -rf node_modules/trackr-attribution
  mv "$copy" node_modules/trackr-attribution
  echo "vercel-install: liens de node_modules/trackr-attribution remplacés par une copie"
fi
