---
title: LangSwap — appli Android
labels: [wayfinder:map]
---

## Destination

Une appli Android LangSwap utilisable au quotidien et distribuable : mêmes résultats que le prototype web (`map.md`), hors ligne, dictionnaire téléchargé par langue (au moins fr/en/es), interface tactile, conforme à la licence de Wiktionary.

## Notes

- Effort ouvert le 2026-10-13, après le prototype web (spec : [`map.md`](map.md), entièrement tranchée et construite).
- Appareil de test : Xiaomi Mi 9 SE, Android 11 (API 30), arm64, MIUI. Chaque **nouveau** paquet installé par USB demande une confirmation à l'écran (« Install via USB » dans les options développeur, libellés à double négation : plusieurs essais possibles) ; une réinstallation du même paquet passe sans.
- Poste : Ubuntu 24.04, SDK Android en ligne de commande (`~/Android/Sdk`, JDK 21) ; détails dans [`android/langswap/README.md`](../android/langswap/README.md).
- Le code du dépôt est **entièrement en anglais** depuis le 2026-10-14 (commentaires et documents en français). Les tickets antérieurs emploient les anciens noms : [correspondance](renommage-2026-10-14.md).
- Mesures et prototypes des packs : [`prototypes/packs/README.md`](../prototypes/packs/README.md).
- Dépôt public : `gosanefr/langswap` (compte GitHub `gosanefr`). Canal visé : F-Droid + Google Play.
- Skills : `/grilling` pour trancher, `/prototype` pour les essais, `/research` pour les recherches.

## Decisions so far

<!-- une ligne par ticket fermé -->
- [Packs de langue : découpage, requêtes, contenu](tickets/014-packs-de-langue.md) — `base` (méta + mots des 6 langues) + un `pack-<l>` par langue, attachés à une connexion SQLite ; requêtes exécutées pack par pack puis `UNION ALL` (les vues `UNION ALL` coûtaient ≈ 5 s) ; formes fléchies toujours incluses ; pas de packs « bridges » ; pivot limité aux langues de la recherche.
- [Coquille Android : WebView, recherche et SQLite](tickets/015-coquille-android.md) — l'interface `web/` et `server/search.mjs` tels quels dans une WebView ; routes `/api/*` servies dans la page (`api.mjs`) ; pont Kotlin synchrone vers SQLite embarqué (mmap/cache) ; voisins du pivot par lot ; ≈ 57 ms au p50 sur mot riche, 5–6 ms sur mot ordinaire (Mi 9 SE).
- [Téléchargement des packs](tickets/016-telechargement-packs.md) — `packs.json` + `.sqlite.gz` sur un serveur HTTP (`packs.url`) ; un seul build sur l'appareil ; vérification sha256, décompression puis bascule sous verrou, rechargement natif de la page ; premier lancement sur le panneau des packs.
- [Hébergement public des packs et conformité CC BY-SA / GFDL](tickets/017-hebergement-licence.md) — canal F-Droid + Play ; dépôt public `gosanefr/langswap` (tout sauf les données), code GPL-3.0-or-later, packs CC BY-SA 4.0 ; releases `packs-<build>` + manifeste `packs/packs.json` versionné (URL absolues) ; URL réglable dans l'appli, HTTPS seulement en release ; xz au lieu de gzip ; écran « À propos » ; `langswap publish-packs` à la main.
- [Performance sur téléphone : premier accès à froid et mots riches](tickets/018-performance-telephone.md) — rien à construire : accès à froid jugé correct, mots riches (p95 ≈ 106 ms) ressentis instantanés ; objectif téléphone relevé à ≈ 100 ms au p95 sur mot riche.
- [Interactions tactiles et écrans du téléphone](tickets/019-interactions-tactiles.md) — sur tactile seulement : tap sur un mot = bulle « Copier · Chercher · via … », recherche sans clavier ; appui long sur une entrée d'historique = « Supprimer » ; retour = bulle, puis page principale, puis arrière-plan ; paysage inchangé ; pas de focus automatique qui ferait monter le clavier sur un résultat.
- [Publication : build release, signature, canal de distribution](tickets/020-publication.md) — une seule clé (l'auteur) pour Play et F-Droid via build reproductible vérifié à chaque version ; compte Play personnel « gosanefr », test fermé par Google Group ; versions semver dès 1.0.0 ; `targetSdk 36` + marges Kotlin, vérifiés sur émulateur API 36 ; fiches fastlane en/fr/es ; `PRIVACY.md` ; `langswap release` ; pas de R8 ; la 1.0.0 inclut les interactions tactiles.

## Not yet specified

<!-- vide : plus aucun ticket ouvert, la route vers la destination est tracée (2026-10-14). Reste la mise en œuvre, hors carte. -->

## Out of scope

- iOS.
- Langues au-delà des 6.
- API de traduction en ligne.
- Synchronisation de l'historique entre appareils.
- Partager les résultats vers une autre appli : fonction nouvelle, pas une adaptation au tactile ; amélioration possible plus tard ([Interactions tactiles](tickets/019-interactions-tactiles.md)).
