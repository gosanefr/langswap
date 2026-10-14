---
title: "Performance sur téléphone : premier accès à froid et mots riches"
labels: [wayfinder:prototype]
parent: map-android
status: closed
assignee: cat
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

## Résolution (2026-10-14)

Rien à construire : les deux points sont acceptés à l'usage, sur le Mi 9 SE.

1. **Premier accès à froid** : jugé correct au lancement (≈ 0,5 s au plus en fr/en/es sur le premier mot riche, sans doute moins depuis la suppression des « bridges »). Pas de préchauffage, pas d'indicateur de chargement.
2. **Mots riches** (p50 ≈ 57 ms, p95 ≈ 106 ms dans la WebView) : ressentis comme instantanés. Sur téléphone, l'objectif devient **≈ 100 ms au p95 sur mot riche**. Les < 50 ms au p95 de [Stack du prototype](009-stack-prototype.md) restent l'objectif du poste.
3. Pistes non retenues, à rouvrir seulement si l'usage le demande (téléphone plus lent, plaintes) : préchauffage des index au lancement, affichage du tableau des sens avant le pivot. Le portage Kotlin reste écarté ([Coquille Android](015-coquille-android.md)).
