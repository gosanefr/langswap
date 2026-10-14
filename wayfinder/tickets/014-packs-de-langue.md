---
title: "Packs de langue : découpage, requêtes, contenu"
labels: [wayfinder:prototype]
parent: map-android
status: closed
assignee: cat
blocked_by: []
---

## Question

Le dictionnaire fait 773 Mo pour 6 langues (≈ 800 Mo depuis le renommage anglais). Peut-on le découper en packs téléchargeables par langue, attachés à la volée, sans perdre en exactitude ni en vitesse ? Que mettre dans chaque pack, et que faire des liens qui traversent des langues non installées ?

## Résolution (2026-10-13 → 2026-10-14)

Prototype et mesures : [`prototypes/packs/README.md`](../../prototypes/packs/README.md) ; découpage : `pipeline/packs.mjs` (`langswap packs`).

1. **Découpage** : `base.sqlite` (table `meta` + `word` des 6 langues, ≈ 31 Mo, toujours installé) + `pack-<l>.sqlite` par langue (`form`, `entry`, `sense`, `translation` des mots de la langue ; une ligne n'appartient qu'à un pack). Une entrée, ses sens et leurs traductions sont toujours dans le même pack. Ids de mots contigus par langue (`meta.word_ranges`).
2. **Requêtes** : chaque requête s'exécute pack par pack (jointures locales, index du pack) puis `UNION ALL` (`server/pack-queries.mjs`, mêmes colonnes et mêmes ordres que `server/queries.mjs`). Les vues TEMP `UNION ALL` sur les tables attachées ont été rejetées : ≈ 5 s par requête (vues matérialisées).
3. **Exactitude** : avec les 6 packs, résultats identiques au monolithe une fois départagés les ex aequo des requêtes sans `ORDER BY`.
4. **Formes fléchies** : toujours dans les packs (décision de l'utilisateur, non négociable).
5. **Packs « bridges »** (sens d'ancre vraie des langues non installées, pour garder les frères de sens) : construits, mesurés (100 % des mots fermes contre 63 % sans), puis **abandonnés** : leurs lignes affichaient gloses et mots d'origine hors des langues choisies.
6. **Pivot** : ne passe que par les langues de la recherche (configurées sur le poste, installées sur Android, plus la langue source) — `near()` dans `server/search.mjs`. En fr/en/es, 86 % des proches gardés.
7. **Tailles** (build du 2026-10-14, gzip -9) : base 16 Mo ; fr 40, en 27, es 33, de 60, it 33, pt 13 Mo à télécharger ; fr+en+es ≈ 117 Mo à télécharger, ≈ 365 Mo sur l'appareil.
