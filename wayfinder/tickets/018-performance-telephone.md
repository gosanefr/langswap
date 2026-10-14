---
title: "Performance sur téléphone : premier accès à froid et mots riches"
labels: [wayfinder:prototype]
parent: map-android
status: open
assignee:
blocked_by: []
---

## Question

Que faire des deux points lents mesurés sur le Mi 9 SE : le premier accès à froid (fichiers hors du cache du système) et les mots les plus riches au-delà de l'objectif de 50 ms au p95 ?

## Ce qu'on sait

- Mesures : [`prototypes/packs/README.md`](../../prototypes/packs/README.md) (sections téléphone, WebView, voisins par lot). Mots riches (`set`, `faire`, `take`…) : p50 ≈ 57 ms, p95 ≈ 106 ms dans la WebView, dont ≈ 38/70 ms natifs (SQL + JSON) ; mots ordinaires p50 ≈ 5,5 ms.
- Premier accès à froid : jusqu'à ≈ 0,5 s (fr/en/es) et 1,5 s (6 langues) par mot riche ; mesure approximative (impossible de vider le cache sans root).
- Banc : `android/bench/run.sh` (rejeu SQL natif et WebView ; installer `fr.langswap.bench` demande une confirmation MIUI) ; traces : `prototypes/packs/trace.mjs`.
- Pistes non essayées : lire les index au lancement en tâche de fond (préchauffage) ; indicateur de chargement au premier mot ; porter `search.mjs` en Kotlin (estimé ≈ 35–40 ms au p50 sur mot riche, mais deux implémentations) ; afficher d'abord le tableau des sens puis le pivot.

## À trancher

- Le premier accès à froid est-il gênant à l'usage ? Si oui : préchauffage ou indicateur.
- Les ≈ 100 ms au p95 des mots riches sont-ils acceptables ?
