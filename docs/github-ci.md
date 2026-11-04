# CI GitHub et installation Vercel

Le workflow `.github/workflows/ci.yml` s'exécute sur chaque push et chaque pull request vers `main`.
Il vérifie les types (`bun run typecheck`), lance les tests (`bun test`) puis construit le site (`bun run build`).
Le workflow `deploy-vercel.yml` reste inchangé : il déclenche seulement le deploy hook Vercel.

## Dépendance trackr

Le site consomme le paquet sans dépendance `trackr-attribution` par `"trackr-attribution": "file:../trackr/attribution"`.
Le dépôt `inforeole/trackr` doit donc exister dans `../trackr`, sur le dernier état de `main`.
Aucune copie du code d'attribution n'est conservée dans ce dépôt.

## Secret TRACKR_DEPLOY_KEY

Le secret `TRACKR_DEPLOY_KEY` contient la clé SSH privée d'une deploy key en lecture seule de `inforeole/trackr`.
Il est défini côté GitHub Actions, où le workflow l'utilise pour extraire trackr dans `trackr/`.
Il est aussi défini comme variable d'environnement du projet Vercel, où `scripts/vercel-install.sh` l'utilise.
Le script écrit la clé dans un fichier de mode 600, supprimé en sortie, et n'affiche que son empreinte.

## Installation Vercel

Vercel exécute `bash scripts/vercel-install.sh` (`installCommand` de `vercel.json`).
Le script clone `inforeole/trackr` sur `main` en `--depth 1` dans `../trackr` lorsque ce dossier est absent.
Il lance ensuite `bun install --frozen-lockfile` et remplace par une copie les liens symboliques éventuels de `node_modules/trackr-attribution`.
Il échoue avec un message explicite lorsque `../trackr` est absent et que `TRACKR_DEPLOY_KEY` est vide.

## Hook pre-push

Le hook `.githooks/pre-push` lance le typecheck et `bun test`, sans le build.
Chaque clone l'active avec `git config core.hooksPath .githooks`.
Le contournement ponctuel est `git push --no-verify`.

## Dette connue

Le dépôt n'a pas d'ESLint, donc la CI ne lint rien.
Ajouter un lint est un lot à part.
