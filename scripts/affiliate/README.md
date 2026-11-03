# Le build conserve les destinations privées et rend les boutons encodés

Le générateur de variante, le runtime et les contrôles proviennent du projet PBN, commit 7bf7fdd58.
La copie locale permet un build autonome sans dépendre d’un chemin du Mac ni d’un autre dépôt au runtime.
Les deux adaptations du consommateur conservent les URL canoniques sans slash final et transportent l’origine Trackr vérifiée de chaque offre, car le registre utilise deux domaines.
Les identifiants publics sont produits par le générateur commun stable pour rentierdigital.xyz.
Les fichiers JavaScript du runtime sont des sorties compilées du générateur TypeScript.

Le build consulte l’API privée existante avec AFFILIATE_REGISTRY_READ_KEY (ou la clé privée existante pour un build local supervisé) et ne conserve aucun secret ni registre brut dans dist.
Les alias des produits propres wizard, vdl, affiliation et vibe-coding-for-real restent ordinaires.
La page source `src/pages/vibe-coding/index.astro` identifie Phil comme auteur du livre Amazon B0GYQHLSCB ; sa destination sans tag reste inchangée.
Tout alias connu non vérifié ou toute offre française dans un contenu anglais bloque la publication.
Les liens marchands ordinaires et les livres propres restent inchangés.

## Les placements Contabo existants attendent vérification.

Le 3 novembre 2026, dix placements publics sur trois pages utilisent le publisher CJ 100429498, qui ne correspond pas aux campagnes Contabo enregistrées avec 100562241.
Le registre conserve uniquement les trois couples exacts page/URL dans `DEFERRED`, avec un plafond correspondant aux occurrences publiques observées (5, 3, 2).
Toute nouvelle page ou augmentation bloque la compilation ; aucune destination ni attribution existante n’est remplacée.
