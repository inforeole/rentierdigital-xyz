#!/bin/bash
# installCommand de Vercel (cf. vercel.json). Le build distant ne contient pas les outils internes
# que package.json consomme par `file:` : ../trackr ("trackr-attribution": "file:../trackr/attribution")
# et ../imgcore ("imgcore": "file:../imgcore"). On les clone sur main avant `bun install`.
# Si le dossier existe déjà, le clone est sauté.
#
# TRACKR_DEPLOY_KEY / IMGCORE_DEPLOY_KEY : clé SSH privée (multiligne) d'une deploy key de
# inforeole/trackr / inforeole/imgcore. Elle est écrite dans un fichier mode 600 supprimé en sortie,
# jamais affichée.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TRACKR_DIR="${RD_TRACKR_DIR:-$ROOT/../trackr}"
TRACKR_REPO="${RD_TRACKR_REPO:-git@github.com:inforeole/trackr.git}"
IMGCORE_DIR="${RD_IMGCORE_DIR:-$ROOT/../imgcore}"
IMGCORE_REPO="${RD_IMGCORE_REPO:-git@github.com:inforeole/imgcore.git}"

# clone_tool <nom> <dossier> <dépôt> <nom de la variable portant la clé>
clone_tool() {
  local name="$1" dir="$2" repo="$3" key_var="$4"
  if [ ! -d "$dir" ]; then
    if [ -z "${!key_var:-}" ]; then
      echo "vercel-install: $dir est absent et $key_var n'est pas définie (clé SSH privée de la deploy key inforeole/$name, variable d'environnement du projet Vercel)." >&2
      exit 1
    fi
    local key_file
    umask 077
    key_file="$(mktemp)"
    printf '%s\n' "${!key_var}" > "$key_file"
    # Empreinte publique seulement, à comparer à la deploy key de inforeole/$name en cas de refus.
    echo "vercel-install: clé $name $(ssh-keygen -lf "$key_file" 2>&1 | cut -d' ' -f1-2)"
    if ! GIT_SSH_COMMAND="ssh -i $key_file -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" \
      git clone --quiet --depth 1 --branch main "$repo" "$dir"; then
      rm -f "$key_file"
      exit 1
    fi
    rm -f "$key_file"
  fi
  echo "vercel-install: $name $(git -C "$dir" rev-parse HEAD 2>/dev/null || echo 'sans historique git')"
}

# Selon sa version, Bun remplit node_modules/<paquet> de liens symboliques vers ../<outil>, hors de la racine
# du projet. On les remplace par une copie propre à ce build.
# Les dépendances d'imgcore (sharp, node-html-parser) sont installées à la racine du site, donc elles se
# résolvent depuis la copie ; aucun node_modules propre à l'outil n'est requis.
replace_symlinks_with_copy() {
  local pkg="$1"
  [ -e "node_modules/$pkg" ] || return 0
  if [ -L "node_modules/$pkg" ] || [ -n "$(find "node_modules/$pkg" -maxdepth 3 -type l -print -quit)" ]; then
    local copy
    copy="$(mktemp -d)"
    cp -RL "node_modules/$pkg/." "$copy/"
    rm -rf "node_modules/$pkg"
    mv "$copy" "node_modules/$pkg"
    echo "vercel-install: liens de node_modules/$pkg remplacés par une copie"
  fi
}

clone_tool trackr "$TRACKR_DIR" "$TRACKR_REPO" TRACKR_DEPLOY_KEY
clone_tool imgcore "$IMGCORE_DIR" "$IMGCORE_REPO" IMGCORE_DEPLOY_KEY
cd "$ROOT"
bun install --frozen-lockfile

replace_symlinks_with_copy trackr-attribution
replace_symlinks_with_copy imgcore
