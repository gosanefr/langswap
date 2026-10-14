---
title: "Règles de nettoyage et de rattachement aux sens de l'étape assembler"
labels: [wayfinder:grilling]
parent: map
status: closed
assignee: cat
blocked_by: [012]
---

## Question

Quelles règles l'étape `assembler` du [Pipeline de build](010-pipeline-outillage.md) applique-t-elle aux traductions et aux sens, au vu du [bruit mesuré](011-bruit-extraction.md) (règles candidates : [recherche §6](../../research/011-bruit-extraction.md)) ? Il faut trancher :
- le bruit textuel : rejeter, corriger ou découper (`( )` vidés, ` / `, `x ; [2] y` en de ; genre seul en pt ; crochets de rection en en ; vides en en ; pays pris pour des traductions en it→es ; cible codée dans la langue de l'entrée) ;
- la copie des traductions sur toutes les POS de la page (it 27 %, es 12 %, y compris sur les formes fléchies) : dédoublonner, rattacher à une seule entrée, ou à quelle POS ;
- les libellés de sens qui ne sont pas des sens (placeholders `Translations`, `sdü`, « Traductions à trier », libellés it qui sont une POS ou un domaine) : les traiter comme « sans sens précis » ou non ;
- l'ancre des frères de sens pour es : la valider au niveau de la page, et non de l'entrée, ce qui touche la règle « même entrée » de [WikDict ou wiktextract ?](007-wikdict-ou-wiktextract.md) ; multi-ancrage pour les plages et listes (`2-3`, `1,2`) ; plages pt tronquées (`De 1 e 2…`) ;
- l'usage des régions en `tags`/`raw_tags` pour remplir `traduction.région`.

L'extraction des entrées étrangères de l'édition en est déjà tranchée dans [Entrées étrangères de l'édition en](012-gloses-anglaises-edition-en.md) ; ce ticket porte sur les blocs `translations` des 6 éditions.

## Résolution (2026-10-13)

Ces règles s'appuient sur la [recherche sur le bruit d'extraction](../../research/011-bruit-extraction.md). Les listes fermées (placeholders, abréviations de genre, pays, table des régions) vivent dans le code partagé (`cle`).

1. **Copie des traductions sur toutes les POS d'une page** (it 27 %, es 12 %). On ne garde **qu'une copie par page** (même mot, même langue), rattachée dans cet ordre :
   - à l'entrée qui possède le sens numéroté (es, numérotation continue sur la page) ;
   - sinon à l'entrée de la POS que nomme le libellé (`aggettivo`, `(sostantivo)`, `verbo`…) ; ce libellé vaut alors « sans sens précis » ;
   - sinon à la première entrée non `form_of` de la page ;
   - si la page n'a que des `form_of`, à la première entrée.
   
   Une traduction qui relevait de la 2ᵉ POS peut se retrouver sous la 1ʳᵉ. C'est accepté : une traduction n'a pas de POS.
2. **Libellés qui ne sont pas des sens**. Une liste fermée de placeholders vaut « sans sens précis » (`ancre = faux`, pas de glose) : `Translations`, `sdü`/`sdÜ`, `Übersetzungen umgeleitet`, `Traductions à trier…`/`À trier`, `?`, ainsi que les libellés de POS it. Les **libellés de domaine it** (`termine araldico`, `(senso figurato)`…) restent des gloses et des ancres, affichés tels quels, y compris quand ils sont tronqués. `controler` produit un rapport des 50 gloses les plus fréquentes par édition, pour repérer un nouveau placeholder (sans blocage).
3. **Ancrage par numéro**. Il est validé **après** le rattachement du point 1, donc la règle « même entrée + même sens » de [WikDict ou wiktextract ?](007-wikdict-ou-wiktextract.md) tient.
   - Listes et plages (`2-3`, `1,2`, `1–3, 7`) : **multi-ancrage**, une `traduction` par sens couvert, éventuellement sur plusieurs entrées.
   - `2a` va au sens `2a`, sinon au sens `2`. Un `2` sans sens propre va à toutes ses sous-sections.
   - Orphelins partiels : on garde les numéros valides. Si aucun numéro n'est valide : « sans sens précis ».
   - Plages pt tronquées (`De 1 e 2…`) : on reparse le reste de `sense` (`e 2`, `, 2 e 4`, `–2`) et on le retire de la glose. Si le reparsage échoue, rattachement au premier sens seulement.
   - de `*`/`?` et fr/pt `0` : « sans sens précis ».
4. **Bruit textuel dans `word`**.
   - **On rejette** :
     - `word` vide (la `note` n'est pas utilisée) ;
     - abréviation de genre seule (`m`, `f`, `n`, `c`, `m/f`, `m pl`…, en minuscules seulement) ;
     - cible dans la langue de l'entrée ;
     - nom de pays en it→es ;
     - mot sans aucune lettre latine ;
     - dialectes étiquetés en (`Alemannic-German`, `Bavarian`…) ;
     - de : `( )` au milieu du mot (mot incomplet).
   - **On corrige** :
     - ponctuation de bord et crochet isolé ;
     - en : groupes entre crochets en tête ou en fin (`[with en]`, `[el]`) et préfixe `[n] ^((please verify))` ; les crochets au milieu du mot restent tels quels.
   - **On découpe** :
     - de ` ; [n] ` (chaque morceau garde son sous-sens) ;
     - ` / ` en variantes de même rang ;
     - de `x ( ), y ( )` : découpage sur `, ` puis retrait du `( )` final.
   - **On garde tout le reste** : locutions longues, « multiples », `word` = mot-tête, `ª º`, grec dans un mot latin.
5. **`traduction.région`**. Une table fermée multilingue forme → code ISO 3166 (≈ 150 formes) est appliquée aux `tags` et `raw_tags`. Les tags inconnus sont ignorés. Plusieurs régions donnent des codes séparés par des virgules ; sans région, le champ reste vide.
