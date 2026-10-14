---
title: Quelles sources libres couvrent les paires fr/en/es/de/it/pt avec plusieurs sens ?
labels: [wayfinder:research]
parent: map
status: closed
assignee: claude-research
blocked_by: []
---

## Question

Quelles sources de traduction libres de droit (ex. Wiktionary via wiktextract/kaikki.org, DBnary, FreeDict, Apertium, Open Multilingual Wordnet, OmegaWiki, OPUS…) peuvent alimenter une base locale de traduction mot-à-mot entre fr, en, es (principales) et de, it, pt (secondaires) ?

Pour chaque source : licence (et contraintes de redistribution), couverture par paire (nombre d'entrées, paires directes vs via l'anglais), granularité des sens (traductions groupées par sens ? gloses ? catégorie grammaticale ?), présence des formes fléchies / lemmes, format et taille des dumps, fraîcheur et facilité d'extraction. Conclure par une recommandation de combinaison.

## Résolution

Wiktionary est la seule source libre qui donne plusieurs équivalents **groupés par sens avec glose** pour les 15 paires, avec en plus les formes fléchies et leur lemme. Licence CC BY-SA 4.0 + GFDL.
Source canonique recommandée : **wiktextract/kaikki.org** (JSONL). L'édition anglaise sert de colonne vertébrale en↔X : 97 à 162 k traductions par paire, ~100 % rattachées à un sens. Les éditions fr/de/es/it/pt fournissent les liens directs hors anglais, riches pour fr/de, maigres pour es/it/pt (7 à 21 k).
Raccourci et filet : **WikDict** (DBnary), 30 bases SQLite prêtes pour les 15 paires, déjà fusionnées, inférées par pivot et scorées.
Paires faibles (es↔it, es↔pt, it↔pt, pt↔fr/de, it↔de) : un pivot sera nécessaire (→ 002). Exclus : MUSE et PanLex (non commerciaux), OmegaWiki (mort), OPUS (pas de dictionnaire). OMW, Apertium (GPL) et FreeDict/Ding restent des compléments éventuels.

Contexte : [recherche](../../research/001-sources-libres.md)
