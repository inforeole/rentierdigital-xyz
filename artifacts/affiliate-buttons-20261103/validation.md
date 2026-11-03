# Les boutons Rentierdigital sont déployés et vérifiés.

Le 3 novembre 2026, le commit runtime `c5870a5` a été construit et déployé par le workflow Vercel existant, sans nouvelle variable ni transfert de secret.
La compilation a été validée localement après retrait explicite de PBN_INGEST_KEY et AFFILIATE_REGISTRY_READ_KEY de l’environnement.
Quatre tests d’intégration, quinze tests backend et les contrôles TypeScript passent.
Le contrôle public couvre 320 pages, trois scripts locaux et 45 boutons ; il ne trouve aucune URL affiliée ou Trackr en clair hors les dix placements Contabo explicitement reportés.
Le navigateur headless valide les 18 pages affiliées et 108 activations souris, Entrée et Espace.
Les seize tokens correspondent aux destinations vérifiées par sonde signée sur l’origine Trackr.
Le domaine personnalisé ne relaie pas les sondes signées ; le parcours réel a donc été vérifié avec un unique clic QA marqué, sans suivre la redirection vers le marchand.
Le clic `07a1b31570277ead1c74e456e8a0b366` a reçu un 302 vers l’offre attendue, avec `isBot=0`, attribution `collected`, s1 à s5 et origine d’entrée conformes ; il doit être exclu des statistiques.
Les dix placements Contabo non vérifiables restent inchangés sur les trois pages consignées.
Le livre propre Vibe Coding, For Real reste exclu des affiliations.
Deux débordements mobiles préexistants (bloc code et tableau) ont été confirmés sur la version publique antérieure et ne résultent pas des boutons.
La contre-revue indépendante reste indisponible après épuisement du quota CLI ; la session principale a relu le diff et exécuté les validations ciblées.

## Les ajouts retenus servent le comportement demandé.

L’encodage stable par site masque les destinations et conserve le design.
Le runtime ajoute l’attribution et gère souris, clavier et contrôles imbriqués.
Les contrôles locaux refusent une offre inconnue ou un lien confirmé encore direct ; le registre doit être actualisé après vérification avant d’introduire une nouvelle offre.
La consultation privée du registre à chaque build et son accès dédié ont été supprimés.
Le site continue à lire son contenu par l’API publique existante, comme avant cette migration.
