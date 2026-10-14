---
title: "Que doit retrouver la saisie : formes fléchies, accents, préfixe, fautes"
labels: [wayfinder:grilling]
parent: map
status: closed
assignee: cat
blocked_by: [001]
---

## Question

Que doit faire la recherche quand l'utilisateur tape un mot : retrouver le lemme depuis une forme fléchie (travaillé → travailler), ignorer accents et casse, proposer des suggestions au fil de la frappe (préfixe), tolérer les fautes de frappe ? Lesquels sont indispensables pour le prototype ?

## Réponse provisoire (2026-10-12, en attente de la recherche sur les sources)

Position de cat : **ignorer accents et casse**, sinon version simple : correspondance exacte du mot normalisé. Pas de lemmatisation, pas de préfixe, pas de tolérance aux fautes pour le prototype. À confirmer une fois la recherche sur les sources fermée.

## Résolution (2026-10-13)

La réponse provisoire est révisée : la recherche sur les sources a montré que l'index forme → lemme est gratuit (wiktextract), donc on lemmatise.

1. **Formes fléchies** : index forme → lemme tiré de wiktextract (`form_of` + `forms[]`, 6 langues). Une forme qui renvoie à plusieurs lemmes donne **un groupe par lemme**, sans fusion, chacun avec la mention « *travaillé* → forme de **travailler** ».
2. **Entrée et forme à la fois** (fr *porte*, *est* ; es *como* ; en *saw* ; de *Essen*) : on montre **les deux**, l'entrée exacte d'abord, puis les groupes de lemmes.
3. **Mode AUTO** : **deux couches**. D'abord les entrées de toutes les langues, puis les formes ; dans chaque couche, un groupe par langue d'origine (« depuis Español »). Avec une source fixée, une correspondance par forme compte comme « trouvé » et ne déclenche pas le repli.
4. **Accents et casse** :
   - correspondance insensible (NFD sans diacritiques, puis *casefold*, donc ß → ss ; pas de translittération ä → ae) ;
   - les correspondances **identiques au caractère près en tête** ; les variantes d'accent ou de casse suivent en groupes séparés, avec la mention « aussi : *péché*, *pêché* » ;
   - si la saisie n'a pas d'accent, les variantes sont au même rang, triées par volume de traductions ;
   - ce critère s'applique **à l'intérieur de chaque couche** : une entrée d'accent différent passe avant une forme.
5. **Ponctuation et espaces** :
   - espaces retirés aux extrémités et réduits à un seul ; apostrophes typographiques (’ ʼ) ramenées à ' ; **trait d'union et espace équivalents** (*week end* trouve *week-end*) ;
   - les **expressions de plusieurs mots** sont cherchées comme une seule entrée, sans découpage ;
   - pas de retrait d'article (*l'eau*, *der Hund*) ni de marqueur « to ».
6. **Déclenchement** : la recherche part **en direct, 250 ms** après la dernière frappe, ou tout de suite sur Entrée. Si un mot partiel ne donne rien, le **résultat précédent reste affiché en grisé**, sans déclencher le repli.
7. **Pas de complétion par préfixe, pas de tolérance aux fautes.** Quand rien ne correspond nulle part, on affiche l'état vide « Aucun résultat pour *x* dans les 6 langues ». Préfixe et fautes sont **hors périmètre** du prototype.

Conséquences pour les données :
- un **index des formes normalisées** qui renvoie vers les entrées et les lemmes, sur les 6 langues (plusieurs millions de formes) ;
- la **forme originale accentuée** conservée, pour classer les correspondances exactes ;
- le **volume de traductions** par entrée, pour départager les variantes.
