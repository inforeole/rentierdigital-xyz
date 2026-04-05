# Migration Astro 5 → Astro 6 — rentierdigital.xyz

## Contraintes
- **Zéro casse d'URL** — toutes les routes identiques
- **Zéro downtime** — valider avant deploy
- **Hébergement** : Vercel (SSG) + Cloudflare devant

## Checklist

### Upgrade
- [ ] `bunx @astrojs/upgrade` — met à jour astro + @astrojs/sitemap + @astrojs/rss
- [ ] `bun install` — régénérer bun.lock
- [ ] Retirer les flags `experimental` stabilisés de `astro.config.mjs` (si warnings au build)

### Validation build
- [ ] `infisical run --domain http://infisical.mesh:8080 -- bun run build` — build sans erreur
- [ ] Comparer le nombre de pages générées (avant/après) : `find dist -name "*.html" | wc -l`
- [ ] Spot-check URLs critiques dans dist/ :
  - [ ] `dist/index.html`
  - [ ] `dist/blog/index.html`
  - [ ] Un article EN : `dist/blog/[slug]/index.html`
  - [ ] `dist/fr/blog/index.html`
  - [ ] Un article FR : `dist/fr/blog/[slug]/index.html`
  - [ ] `dist/prompt-contract/index.html`
  - [ ] `dist/rss.xml`
  - [ ] `dist/sitemap-index.xml`

### Validation visuelle (preview)
- [ ] `infisical run --domain http://infisical.mesh:8080 -- bun run preview`
- [ ] Homepage — animation hacker fonctionne
- [ ] Article EN — markdown, images AVIF, code blocks Shiki OK
- [ ] Article FR — i18n routing OK
- [ ] Page 404 — typewriter animation
- [ ] Search Pagefind — fonctionne
- [ ] prompt-contract — QR tracking script OK

### Deploy (SEULEMENT quand Phil dit "deploie")
- [ ] `bunx vercel --prod`
- [ ] Vérifier en prod que les URLs répondent correctement
- [ ] Si cache Cloudflare stale → purge via dashboard CF

## Ce qui NE devrait PAS changer
- Aucun fichier source (.astro, .ts) — que package.json et bun.lock
- Le site n'utilise aucune API supprimée en Astro 6 :
  - Pas d'Astro.glob() ✓
  - Pas de ViewTransitions ✓
  - Pas de Content Collections legacy ✓
  - Pas de heading IDs markdown ✓
  - getStaticPaths() params déjà en string ✓
  - Config en .mjs ✓

## Gains disponibles après migration
- CSP intégré (pertinent avec Cloudflare)
- Compilateur Rust expérimental (build plus rapide)
- Live Content Collections (remplacement potentiel de lib/convex.ts)
