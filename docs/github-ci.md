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

## Dépendance imgcore

Le site consomme le moteur imgcore par `"imgcore": "file:../imgcore"`.
Le dépôt `inforeole/imgcore` doit donc exister dans `../imgcore`, sur le dernier état de `main`, sans pin ni copie des sources.
`scripts/imgcore-fix.ts` lance `imgcore fix all dist` (LCP, srcset, JSON-LD, images du sitemap) entre `astro build` et `pagefind`, avec le cache des variantes dans `node_modules/.cache/imgcore`.
Le CLI est résolu dans `node_modules/imgcore`, borné à 300 s, et son échec fait échouer le build.
Les images sans alt ne sont pas traitées : l'audit n'en trouve aucune, donc le build n'appelle ni l'API Gateway ni magasin d'alt.

## Secret IMGCORE_DEPLOY_KEY

Le secret `IMGCORE_DEPLOY_KEY` contient la clé SSH privée d'une deploy key en lecture seule de `inforeole/imgcore`.
Il est défini côté GitHub Actions (checkout dans `imgcore/`) et comme variable d'environnement du projet Vercel, avec le même traitement que `TRACKR_DEPLOY_KEY`.

## Installation Vercel

Vercel exécute `bash scripts/vercel-install.sh` (`installCommand` de `vercel.json`).
Le script clone `inforeole/trackr` et `inforeole/imgcore` sur `main` en `--depth 1` dans `../trackr` et `../imgcore` lorsque ces dossiers sont absents.
Il lance ensuite `bun install --frozen-lockfile` et remplace par une copie les liens symboliques éventuels de `node_modules/trackr-attribution` et `node_modules/imgcore`.
Les dépendances d'imgcore (sharp, node-html-parser) sont installées à la racine du site et se résolvent depuis cette copie.
Il échoue avec un message explicite lorsqu'un dossier est absent et que sa variable `TRACKR_DEPLOY_KEY` ou `IMGCORE_DEPLOY_KEY` est vide.

## Hook pre-push

Le hook `.githooks/pre-push` lance le typecheck et `bun test`, sans le build.
Chaque clone l'active avec `git config core.hooksPath .githooks`.
Le contournement ponctuel est `git push --no-verify`.

## Variables Convex du build

Le build lit les billets dans Convex, donc la CI reçoit `CONVEX_SITE_URL` et `PUBLIC_CONVEX_ACTIONS_URL` en variables Actions, car ce sont des URL publiques.
`~/tmp/rentierdigital-xyz-ci-convex-env.sh` les pose depuis les `.env.local` de rentierdigital-xyz et de rentierdigital, sans affichage.

## Dette connue

Le dépôt n'a pas d'ESLint, donc la CI ne lint rien.
Ajouter un lint est un lot à part.
