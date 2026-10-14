---
title: "Coquille Android : WebView, recherche et SQLite"
labels: [wayfinder:prototype]
parent: map-android
status: closed
assignee: cat
blocked_by: [014]
---

## Question

Comment construire l'appli en réutilisant au maximum le prototype : réécrire la recherche en Kotlin, ou faire tourner l'interface et `search.mjs` dans une WebView ? Avec quel SQLite, et à quelle vitesse sur un téléphone moyen ?

## Résolution (2026-10-13 → 2026-10-14)

Code : `android/langswap/` ([README](../../android/langswap/README.md)) ; banc : `android/bench/`.

1. **WebView** : `web/` (interface), `server/search.mjs`, `queries.mjs`, `pack-queries.mjs`, `shared/normalize.mjs`, `lists.mjs`, `constants.mjs` copiés **tels quels** dans l'APK par Gradle (une seule source dans le dépôt). Servis sur `https://appassets.androidplatform.net/` (contexte sûr).
2. **Routes `/api/*` dans la page** : `android/langswap/web/api.mjs`, chargé avant `app.js`, remplace `fetch` pour `/api/…` (mêmes routes et mêmes réponses que `server/server.mjs`). Raison : `shouldInterceptRequest` ne donne pas le corps des POST.
3. **SQLite** : `androidx.sqlite:sqlite-bundled` (version récente, `json_each` garanti), pont `@JavascriptInterface` synchrone (`Bridge.kt` : `openDictionary`, `prepare`, `all`, `run`, sous un verrou), lignes rendues en JSON avec les types de `node:sqlite`. Historique : `files/history.sqlite`, schéma `shared/history.sql`, filtre `searchKey()` fait en JS (pas de fonction SQL personnalisée).
4. **Réglages SQLite** (`SQLITE_PRAGMAS`, aussi sur le poste) : `mmap_size` 256 Mo + `cache_size` 16 Mo par fichier, ≈ 25 % plus rapide sur téléphone, ≈ 40 % sur le poste.
5. **Voisins du pivot par lot** (`neighborsBatch`) : ≈ 70 → 20 appels au pont par recherche riche (≈ 0,2 ms par aller-retour).
6. **Mesures** (Mi 9 SE, WebView Chrome 154, fr/en/es + ponts à l'époque) : mots riches p50 ≈ 57 ms, p95 ≈ 106 ms ; mots ordinaires p50 ≈ 5,5 ms, p95 ≈ 30 ms ; résultats identiques au poste (empreintes). Premier accès à froid : jusqu'à 0,5–1,5 s → [018](018-performance-telephone.md).
7. **Interface tactile** déjà faite : pas de barre de titre ; barre du bas en icônes (accueil, horloge, engrenage) + FR/EN/ES ; pastilles et aides `Alt+…` masquées sans survol (`hover: none`) ; placeholder réduit sur écran étroit ; bouton « effacer » dans le champ ; icône (bulle + flèches) adaptative et monochrome (thème Android 13+).
8. Écarté : portage Kotlin de `search.mjs` (≈ 35–40 ms gagnés au p50 sur mot riche, mais deux implémentations à garder identiques).
