# La préproduction valide les boutons affiliés Rentierdigital.

Le 3 novembre 2026, la compilation a validé 45 boutons sur 18 pages parmi 321 pages indexées.
Les trois tests ciblés et le contrôle TypeScript strict passent.
Le navigateur headless a exécuté 108 activations souris, Entrée et Espace sur les 18 pages, avec attribution présente et aucune navigation vers les marchands.
La fenêtre newsletter est fermée par son bouton normal pendant les tests.
Deux pages présentent un débordement mobile préexistant, confirmé sur la production avant déploiement (bloc code et tableau, hors boutons) : `/blog/self-hosted-mesh-vpn-netbird-tailscale` et `/blog/best-korean-proxy-for-builders`.
Les dix placements Contabo non vérifiables restent inchangés sur les trois pages consignées.
Le livre propre Vibe Coding, For Real reste exclu des affiliations.
La production publique et la collecte réelle Trackr restent à vérifier après déploiement.
Le contrôle automatique a refusé le transfert de PBN_INGEST_KEY vers Vercel.
La préparation utilise désormais une clé distincte AFFILIATE_REGISTRY_READ_KEY limitée au registre vérifié ; sa configuration distante reste à autoriser.
Aucun secret n’a été transféré lors de cette tentative refusée.
La contre-revue indépendante n’a pas été exécutée car la voie CLI déléguée a épuisé son quota ; la session principale a effectué la revue et les validations ciblées.

## Le build simplifié passe sans accès privé affilié.

Après le GO de simplification du 3 novembre, le build et les tests navigateur ont été exécutés avec PBN_INGEST_KEY et AFFILIATE_REGISTRY_READ_KEY retirées de l’environnement.
Les quatre tests d’intégration, le contrôle TypeScript, la compilation de 45 boutons sur 18 pages et les 108 activations navigateur passent.
Le registre versionné a été vérifié pendant la migration : 93 alias vérifiés et trois non vérifiés, dont seules les offres compatibles et réellement utilisées sont rendues.
Le build ne consulte plus le registre privé et ne requiert plus de nouvelle configuration Vercel.
Les paragraphes d’attente de clé ci-dessus décrivent la tentative abandonnée ; aucune autorisation de transfert n’est désormais nécessaire.
