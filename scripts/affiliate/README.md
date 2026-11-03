# Le build conserve les destinations privées et rend les boutons encodés

Le générateur de variante, le runtime et les contrôles proviennent du projet PBN, commit 7bf7fdd58.
La copie locale permet un build autonome sans dépendre d’un chemin du Mac ni d’un autre dépôt au runtime.
Les deux adaptations du consommateur conservent les URL canoniques sans slash final et transportent l’origine Trackr vérifiée de chaque offre, car le registre utilise deux domaines.
Les identifiants publics sont produits par le générateur commun stable pour rentierdigital.xyz.
Les fichiers JavaScript du runtime sont des sorties compilées du générateur TypeScript.

Le build lit `verified-registry.json`, un jeu de données interne vérifié le 3 novembre 2026 pendant la migration.
Il n’appelle aucune API privée pour les boutons et n’utilise aucune nouvelle clé ou variable Vercel.
Les destinations sont encodées dans le HTML ; le registre interne n’est jamais copié dans dist.
Une nouvelle offre nécessite la vérification de son token, de sa source et de sa destination puis une mise à jour explicite du registre avant publication.
Une route ou un token inconnu bloque le build au lieu d’exposer une destination directe.
Cette vérification n’est pas un contrôle de santé permanent du marchand ; les contrôles existants de Trackr restent distincts.
Les alias des produits propres wizard, vdl, affiliation et vibe-coding-for-real restent ordinaires.
La page source `src/pages/vibe-coding/index.astro` identifie Phil comme auteur du livre Amazon B0GYQHLSCB ; sa destination sans tag reste inchangée.
Tout alias connu non vérifié ou toute offre française dans un contenu anglais bloque la publication.
Les liens marchands ordinaires et les livres propres restent inchangés.

## Les dix placements Contabo utilisent le publisher enregistré.

Phil a autorisé le 3 novembre 2026 le remplacement des offres dont l’affiliation existe déjà, après vérification de la destination et du tracking.
Les dix placements des trois pages OpenClaw utilisent le transport `nUmYSJS`, campagne `6132`, vers `https://www.kqzyfj.com/links/100562241/type/dlg/https://contabo.com/en-us/openclaw-hosting/`.
Le test HTTP marchand confirme la page OpenClaw, `PID=100562241`, `AID=12438672` et un identifiant CJ.
L’ancienne URL avec publisher `100429498` reste uniquement comme clé interne de remplacement des contenus historiques ; elle n’est plus une destination publiée.
Les trois exceptions Contabo sont retirées de `DEFERRED`, dont le mécanisme de contrôle reste intact.
Le build produit 55 boutons sur 21 pages, sans nouvelle variable Vercel ni API privée pour le registre affilié.
Les tests de transformation passent ; la validation Trackr avant déploiement et la vérification publique sont conservées dans les artefacts de livraison.

Le 3 novembre 2026, le déploiement Vercel `rentierdigital-i8hcvv5oy-inforeoles-projects.vercel.app` a été aliasé sur le domaine public.
Le contrôle HTTP vérifie les dix boutons des trois pages ; le navigateur public vérifie les trois boutons du guide avec douze activations souris, clavier et mobile.
Les preuves sont dans `artifacts/affiliate-replacements-20261103/` ; le clic QA `5b31b829677675e97f76b8c723c6b9c6` a une attribution collectée et doit être exclu des statistiques commerciales.
Le débordement mobile préexistant de 72 px reste hors scope ; les boutons restent dans l’écran.
