---
title: "Téléchargement des packs"
labels: [wayfinder:prototype]
parent: map-android
status: closed
assignee: cat
blocked_by: [014, 015]
---

## Question

Comment l'appli obtient-elle ses packs (sans `adb push`) : format servi, choix des langues, mises à jour du dictionnaire, comportement au premier lancement ?

## Résolution (2026-10-14)

1. **Côté poste** : `langswap packs` → `data/packs/` : `<nom>.sqlite` (pour `install-packs.sh`), `<nom>.sqlite.gz` + `packs.json` (`build` = `meta.built_at`, `langs`, par fichier : `file`, `bytes`, `sqliteBytes`, `sha256`). gzip plutôt que zstd : décompressé par `java.util.zip`, sans bibliothèque native (≈ +40 % de téléchargement ; question rouverte dans [017](017-hebergement-licence.md)).
2. **Serveur** : URL `packs.url` dans `android/langswap/local.properties` (hors dépôt) → `BuildConfig.PACKS_URL`. En développement : `langswap serve-packs` (réseau local, port 4766) ; HTTP en clair autorisé en debug seulement. Pas d'hébergement public pour l'instant → [017](017-hebergement-licence.md).
3. **Appli** (`Packs.kt`) : un seul build sur l'appareil (les ids changent à chaque build) ; si le serveur publie un autre build, tous les packs gardés sont retéléchargés. Téléchargement + vérification (taille, sha256) + décompression dans `files/packs/tmp`, hors verrou (la recherche continue) ; vérification de la place libre ; bascule (renommages, suppressions, `installed.json`) sous le verrou du pont, dictionnaire fermé ; puis l'appli recharge la page (`MainActivity`).
4. **Interface** : panneau « Langues téléchargées » dans Config (seulement si `/api/config` renvoie `packs: true`, donc jamais sur le poste) : cases par langue avec taille, total à télécharger et place sur l'appareil, progression, erreurs, avis de nouvelle version ; au moins deux langues. Premier lancement sans pack : directement sur ce panneau, fr/en/es pré-cochées.
5. Mesuré : fr+en+es (131 Mo avec les ponts de l'époque) en ≈ 30 s sur le Wi-Fi local ; ajout d'une langue = seul son pack téléchargé.
