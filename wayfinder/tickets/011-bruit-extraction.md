---
title: "Quel bruit d'extraction et quels sense_index orphelins dans les 6 éditions wiktextract ?"
labels: [wayfinder:research]
parent: map
status: closed
assignee: claude-research
blocked_by: []
---

## Question

Dans les JSONL wiktextract des éditions en, fr, es, de, it et pt, à quoi ressemble concrètement le bruit des traductions : marqueurs, qualificatifs, noms de régions pris pour des traductions, traductions vides ou en écriture non latine parasites ? Avec quelle fréquence par édition ? Et quelle part des traductions porte un `sense_index` (ou équivalent) qui ne pointe vers aucun sens existant ? Il faut des exemples réels et des ordres de grandeur, pour décider ensuite des règles de nettoyage et de validation du pipeline.

Recherche : [011-bruit-extraction](../../research/011-bruit-extraction.md)

## Résolution (2026-10-13)

Mesuré sur les 6 dumps kaikki complets (lus en flux), sur les traductions vers les 6 langues (« tr6 ») : en 638 k, fr 494 k, de 487 k, it 162 k, es 102 k, pt 98 k.

1. **Bruit textuel faible** : environ 0,2 à 0,5 % des tr6 (≈ 2 % pour de).
   - Traductions vides : seulement en (874, texte dans `note`).
   - Non latin parasite : quelques dizaines par édition. `ª º` et le grec scientifique sont légitimes.
   - Le `[6] ^((please verify))` de 001 apparaît 2 fois en tout.
   - Noms de pays pris pour des traductions : quelques dizaines, quasi tous it→es (`lavoro` → *Argentina*, *Uruguay*…). Ailleurs, la région est proprement en `tags`/`raw_tags` (milliers de cas).
   - Bruit le plus marqué en de : parenthèses vidées `( )` (524), traductions et sous-sens collés `x ; [2] y` (56), alternatives ` / ` (2,7 k).
   - Ailleurs : genre seul pris pour un mot (pt 85), crochets de rection en (`[with de]`), cible codée dans la langue de l'entrée (de 295).
2. **Bruit structurel, le vrai enjeu** :
   - it copie la section de traductions sur toutes les POS de la page (27 % des tr6 it), y compris sur les formes fléchies (20 %). it n'a aucun `sense_index`, et ses libellés de sens sont souvent une POS ou un domaine.
   - es copie aussi par page (12 %) et numérote les sens en continu sur la page.
   - Placeholders de sens : en `Translations` (4 %), de `sdü`/`sdÜ` (1,5 %), fr `Traductions à trier…` (~2,7 k).
   - pt ne lit que le premier numéro de `De 1 e 2…` (1 107 cas).
3. **`sense_index` orphelins** : fr 0,38 %, pt 0,30 %, de 0,03 % des traductions numérotées ; en et it n'en ont pas. es : 17 % si on valide contre l'entrée, mais **0,8 % contre la page**. La validation de 007 doit donc se faire au niveau de la page pour es, avec plages et listes (`2-3`, `1,2`, 18 % des es) en multi-ancrage.

Les règles de nettoyage restent à trancher dans le pipeline. La recherche propose une liste de règles candidates (§6) et note tailles et dates des dumps (§7).
