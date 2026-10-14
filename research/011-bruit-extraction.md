# Bruit d'extraction et `sense_index` orphelins dans les 6 éditions wiktextract

Ticket : [011 — Quel bruit d'extraction et quels sense_index orphelins dans les 6 éditions wiktextract ?](../wayfinder/tickets/011-bruit-extraction.md)
Date de la recherche : 2026-10-13. Tous les chiffres sont **mesurés** le même jour sur les dumps kaikki **complets** (aucun échantillon) : chaque fichier a été lu en flux (`curl | zcat | python3`), sans être écrit sur disque. La méthode et les définitions sont en annexe. Le comportement des extracteurs est vérifié dans le code de [wiktextract](https://github.com/tatuylonen/wiktextract) (`src/wiktextract/extractor/<éd>/`).

Périmètre : entrées dont la langue (`lang_code`) est l'une des 6 langues, traductions dont la langue cible est l'une des 6 **et différente** de celle de l'entrée. On appelle ces traductions **tr6**.

## TL;DR

- **Le bruit dans le texte des traductions (`word`) est faible partout** : de l'ordre de **0,5 à 3 %** des tr6 selon l'édition, en comptant large. Les éditions **en** et **fr** sont les plus propres. L'édition **de** est la plus bruitée en texte (parenthèses vidées, plusieurs traductions collées dans un seul `word`). Les cas cités dans 001 sont réels mais **rares** : `"[6] ^((please verify)) œuvre"` n'apparaît que **2 fois** dans l'édition anglaise ; les noms de pays pris pour des traductions sont **quelques dizaines**, quasi tous dans l'édition **it**.
- **Les traductions vides ou en écriture non latine sont négligeables.** Il y a des `word` vides seulement dans l'édition en (874, soit 0,14 %, avec le texte réel dans `note`). Les caractères non latins touchent ≤ 0,1 % des tr6, et ce sont surtout des cas légitimes : ordinaux `ª º`, lettres grecques de termes scientifiques (`γ-ray`). Le vrai parasite (cyrillique, grec, japonais à la place d'un mot latin) se compte en **dizaines** par édition.
- **Le bruit qui pèse vraiment est structurel, pas textuel** :
  1. **it** : la section de traductions d'une page est **copiée sur toutes les entrées de même langue de la page** (toutes les POS). **27 %** des tr6 it sont sur une entrée qui a reçu la copie d'une entrée sœur, et **20 %** sont sur des entrées de forme fléchie (participes…). it n'a **aucun `sense_index`**, et 29 % de ses tr6 n'ont même pas de libellé de sens. Le « sens » est souvent un **libellé de POS ou de domaine** (`(aggettivo)`, `termine araldico`) plutôt qu'une glose.
  2. **es** : même copie à l'échelle de la page (12 % des tr6). Surtout, la numérotation des sens est **continue sur toute la page** (toutes POS). Résultat : **17 %** des `sense_index` es ne pointent vers aucun sens **de l'entrée**, mais seulement **0,8 %** ne pointent vers aucun sens **de la page**.
  3. **Libellés de sens qui n'en sont pas** : en `"Translations"` (4,0 % des tr6), de `sdü`/`sdÜ` (« siehe dort Übersetzungen », 1,5 %), fr `Traductions à trier…` (0,5 %), es `?`.
  4. **pt** : un `{{tradini|De 1 e 2…}}` qui couvre plusieurs sens n'est lu que sur son **premier** numéro. Le reste (`e 2`, `–2 (…`) se retrouve dans `sense` (1 107 cas, **4,9 %** des tr6 pt numérotées).
- **`sense_index` orphelins**, si on résout au bon niveau : **fr 0,38 %**, **pt 0,30 %**, **de 0,03 %**, **es 0,8 %** (au niveau page). Il n'y a **pas de `sense_index`** dans les éditions **en** et **it**. La règle de validation du ticket 007 (« `sense_index` sans sens existant → sans sens précis ») ne touchera donc que quelques centaines de traductions par édition. À condition, pour **es**, de valider **contre la page** et non contre l'entrée, sinon elle jetterait à tort 17 % des liens.

## 1. Forme du rattachement au sens, par édition

| Édition | Champ de sens sur la traduction | Type | Numérotation des sens de l'entrée | Source (extracteur) |
|---|---|---|---|---|
| en | `sense` seul (glose de `{{trans-top}}`) | texte | — (pas de `sense_index`) | `extractor/en` |
| fr | `sense` + `sense_index` | `int` (0 = absent) | implicite : rang de la définition `#` de premier niveau ; les sens ne portent pas d'index | `fr/translation.py` : 2ᵉ paramètre de `{{trad-début}}`, gardé seulement s'il est décimal |
| de | `sense` + `sense_index` | `str` (`"1"`, `"2a"`, `"1/2"`, `"*"`) | `senses[].sense_index` (`"1"`, `"2a"`…) | `de/models.py`, `de/translation.py` (`{{Ü-Tabelle}}`) |
| es | `sense_index` (+ `sense` très rare) | `str` (`"1"`, `"2-3"`, `"1,2"`, `"1–3, 7"`) | `senses[].sense_index`, **numérotés en continu sur toute la page** | `es/translation.py` : paramètres `aN=` de `{{t}}` ou `[n]` en tête de `{{trad-arriba}}` |
| it | `sense` seul (paramètre de `{{Trad1}}`) | texte | — | `it/translation.py` |
| pt | `sense` + `sense_index` | `int` | implicite (rang) | `pt/translation.py` : `{{tradini|De N …}}`, regex `De (\d+)` |

Points de code qui expliquent le bruit structurel :
- **it** (`it/translation.py`) : `for data in page_data: if data.lang_code == page_data[-1].lang_code: data.translations.extend(translations)`. Toutes les entrées de la page dans la langue reçoivent la même liste.
- **es** (`es/translation.py`) : même boucle, restreinte aux entrées de **même étymologie** (`data.etymology_texts == page_data[-1].etymology_texts`).
- **pt** (`pt/translation.py`, `extract_tradini_template`) : `re.match(r"De (\d+)", …)` ne capture que le premier numéro, et le reste du texte devient `sense`.
- **fr** : la doc de [Modèle:trad-début](https://fr.wiktionary.org/wiki/Mod%C3%A8le:trad-d%C3%A9but) définit le paramètre 2 comme le « numéro de définition à laquelle la boîte est associée ».

## 2. Volumes et couverture du rattachement

| Édition | tr6 | avec `sense_index` | avec `sense` (texte) | ni l'un ni l'autre |
|---|---|---|---|---|
| en | 637 723 | — | 637 716 (~100 %) dont **25 284 `"Translations"`** (placeholder, 4,0 %) | 7 |
| fr | 494 424 | 67 637 (13,7 %) | 140 842 (28,5 %) | 350 724 (**70,9 %**) |
| de | 487 432 | 487 432 (100 %) | 482 773 (99 %) dont **7 502 `sdü`/`sdÜ`** (1,5 %) | 0 |
| es | 102 131 | 61 797 (60,5 %) | 3 006 (2,9 %) | 39 557 (38,7 %) |
| it | 161 508 | — | 115 281 (71,4 %) | 46 227 (28,6 %) |
| pt | 98 186 | 22 667 (23,1 %) | 23 122 (23,5 %) | 72 787 (**74,1 %**) |

Ces totaux recoupent ceux de [001 §2.1](001-sources-libres.md) (en : 637 k ; fr : 494 k ; pt : 98 k…).

L'édition **de** contient aussi **97 k tr6 depuis des entrées non allemandes** vers l'allemand : en 34 839, it 29 311, fr 24 000, es 5 837, pt 2 920. Ce sont des liens directs X→de, rattachés à la numérotation des sens que le Wiktionary allemand donne à ces entrées étrangères. C'est là que se concentrent les `sdü` (renvoi vers les traductions du mot allemand).

## 3. `sense_index` orphelins

Un `sense_index` est **orphelin** s'il désigne un numéro absent des sens de l'entrée. Pour fr et pt, la comparaison se fait avec le nombre de définitions de premier niveau (`glosses[0]` distincts). Pour es et de, elle se fait avec l'ensemble des `senses[].sense_index` : `"2"` couvre `"2a"`, `"2a"` est accepté si `"2"` existe, et les plages `"1-3"` / `"1–3"` sont développées.

| Édition | tr6 avec `sense_index` | orphelins / entrée | orphelins / page¹ | non analysables |
|---|---|---|---|---|
| fr | 67 637 | **254 (0,38 %)** | 189 (0,28 %) | — |
| pt | 22 667 | **68 (0,30 %)** | 48 (0,21 %) | — |
| de | 487 432 | **123 (0,03 %)** | 114 (0,02 %) | 139 (`"*"` = 126, `"?"` = 13) |
| es | 61 797 | **10 499 (17,0 %)** (8 715 sans aucun numéro valide) | **470 (0,76 %)** (264 sans aucun numéro valide) | 0 |
| en, it | — | — | — | — |

¹ Page = toutes les entrées de même mot et de même langue qui se suivent dans le JSONL (les lignes d'une page sont contiguës).

Exemples réels :
- **es (orphelin d'entrée, valide sur la page)** : `ayuda` (verbe, sens 9 et 10) → fr *aide* `"1,2"`, car 1 et 2 sont les sens du nom ; `humano` (nom, sens 3) → de *menschlich* `"1"` ; `librar` (sens 7–9) → en *rescue* `"1"`. Un même bloc de traductions est copié sur l'adjectif et le nom (`japonés` : adj = sens 1, nom = sens 2–3, les deux reçoivent `japanisch "1"`, `Japanisch "2-3"`).
- **es (orphelin de page)** : `guía` → de *Kapitän* `"28"` (27 sens) ; `perseguir` → en *stalk* `"4,8"` (7 sens) ; `tirolesa` → fr *tyrolienne* `"2"` (1 sens).
- **fr** : `mettre` → de *anfangen*, en *start* `25` (20 définitions) ; `quel` (pronom) → de *was* `3` (1 sens) ; `acquis communautaire` → es *acervo comunitario* `3` (1 sens) ; `dalle` → en *suspended slab* `8` (6 définitions). Ce sont surtout des boîtes recopiées d'une autre POS, ou des sous-sections (pronominal) numérotées à part.
- **pt** : `acorrer` → fr *accourir* `5` (4 définitions), `cápsula` → fr *gélule* `3` (2), `chegar` → en *put oneself close to* `16` (15).
- **de** : `Kreuz` → fr *croix* `"5"` (pas de sens 5 ; 1–4, 7–14) ; `souverän` → en *sovereign* `"1"` (sens 2–4) ; `Golfkrieg` → en *Gulf war* `"1"` (seul le sens 2 existe).

**Plusieurs numéros dans un seul `sense_index`** : es 11 087 (17,9 % des numérotées : `"2-3"` 6 059, `"1,2"` 2 230, `"1–3"` 1 573…) ; de 15 seulement (`"1/2"`). Une traduction es peut donc ancrer **plusieurs sens** à la fois : il faut la rattacher à chacun.

## 4. Bruit dans le texte des traductions (`word`)

Comptages sur les tr6. Les catégories se recouvrent. « Long » = ≥ 5 mots ou > 50 caractères (ce sont surtout des proverbes et locutions légitimes). « Multiple » = contient `,` `;` `/` ou « ou/or/oder/o » entre espaces (souvent légitime aussi : *aussitôt dit, aussitôt fait*).

| Catégorie | en | fr | de | es | it | pt |
|---|---|---|---|---|---|---|
| `word` vide | **874** | 0 | 0 | 0 | 0 | 0 |
| Marqueurs `[ ] { } < > \| ^ #` | 232 | 45 | 140 | 0 | 26 | 1 |
| … dont `please verify` ou `(?)` | 2 | 0 | 2 | 0 | 0 | 0 |
| Parenthèses dans `word` | 2 774 | 779 | **3 937** | 33 | 227 | 7 |
| … dont parenthèse vidée `( )` | — | — | **524** | — | — | — |
| Plusieurs traductions collées `x ; [2] y` | — | — | 56 | — | — | — |
| Alternatives ` / ` | 428 | 5 | **2 722** | 1 | — | — |
| Ponctuation en bord (`,` `;` `/` `(`…) | 3 082 | 592 | 2 024 | 83 | 195 | 19 |
| Multiple (au sens large) | 2 900 | 1 251 | 6 256 | 401 | 131 | 79 |
| Long | 7 157 | 4 657 | 7 549 | 234 | 100 | 275 |
| Non latin (toute lettre hors LATIN) | 186 | 482 | 53 | 6 | 7 | 6 |
| Genre pris pour la traduction (`m`, `f`, `n`, `m/f`…) | 40 | 16 | 49 | 9 | 19 | **85** |
| Nom de pays dans un bloc qui contient d'autres mots | 55 | 23 | 24 | 7 | **39** | 5 |
| Doublon exact dans l'entrée | 754 | 1 038 | 496 | 148 | 492 | 39 |
| Cible = langue de l'entrée (mal codée) | 0 | 10 | 295 | 13 | 45 | 12 |
| `lang_code` absent (toutes cibles confondues) | 48 | 0 | 0 | 0 | 0 | 0 |
| **Part « vrai bruit » estimée²** | **~0,5 %** | **~0,3 %** | **~2 %** | **~0,2 %** | **~0,5 %** | **~0,3 %** |

² Estimation à la main à partir des exemples : vide + marqueurs + parenthèses vidées ou collages + genre seul + région + cible mal codée + une fraction des parenthèses et bords. Les catégories « long », « multiple », « non latin » sont majoritairement légitimes.

### Exemples par type

- **Marqueurs résiduels (en)** : `work` → fr `"[6] ^((please verify)) œuvre"`, `"[6] ^((please verify)) création"` (les 2 seuls cas). Plus fréquents : crochets de rection de l'édition en, gardés dans `word` (`concentrarse [with en]`, `lucrarse [with de or con]`, `faire [distance] à pied`, `[el] aria`, `poliglota m or f=`, `12^`).
- **it, crochet ouvrant isolé** : `ferma` → en `"[closed"`, `onere` → `"[responsibility"`, `basse` → `"[south"`.
- **de, plusieurs traductions et numéros de sous-sens collés dans un `word`** : `Miene` → it `"aspetto ; [1b] lineamenti ; [2a] intenzione ; [2b] atteggiamento"`, `Löwe` → es `"león ; [3, 5] Leo"`, `oder` → en `"or ; [2] or else ; [3] isn't it"`, `Apfelsine` → fr `"orange ; [2] oranger"`.
- **de, qualificatif extrait du texte, laissant `( )`** : `Bruch` → en `"rupture ( ), breach ( )"` avec `raw_tags: ["auch einer Verbindung","auch eines Versprechens"]` ; `nicken` → pt `"acenar ( ) cabeça"` avec `raw_tags: [..., "com","a"]`. Ici les mots manquants (*com a*) sont partis dans `raw_tags`. `raw_tags` de l'édition de contient d'ailleurs des fragments de phrase (`de` ×175, `à` ×149, `quelque chose` ×123, `la` ×91).
- **de, alternatives et bords** : `Norovirus /`, `impitoyable /`, `orgánico / orgánica`, `remorseless / remorselessly`, `tendre (qqch. à qqn),`.
- **Genre pris pour un mot** : pt `nicotina` → de `"n"`, `safadeza` → fr `"f"` ; it `stivale` → de `"m"`, es `"f"` ; es `sede` → de `"m"`. Un vrai mot d'une lettre reste légitime (`eu` → en *I*, `sol` → de *G*, `do` → en *C*).
- **Noms de régions pris pour des traductions (it)** : `lavoro` → es `Argentina`, `Uruguay`, `Spagna`, `Ecuador`, `Colombia`, `Cuba`, `Perù` (mêlés à *laburo*, *curro*, *chamba*) ; `ladro` → es `Argentina` ; `testa` → es `Uruguay` ; `rapinatore` → es `Spagna`. Ailleurs, la région est **correctement** rangée en tag : en `tags` (`Brazil` 2 153, `Portugal` 1 635, `Spain` 711, `Mexico` 548…), fr `raw_tags` (`Royaume-Uni` 1 176, `États-Unis` 1 097, `Brésil` 161…), de `raw_tags` (`Brasilien` 271, `Portugal` 170…). Faux positifs à ne pas filtrer : `laranja`/`Orange` → it *portogallo* (vrai mot régional pour « orange »), `nibbio` → es *milano* (le rapace), `beadle` → fr *suisse*.
- **Vides (en seulement)** : `cold` → fr, `word` vide, `note: "faire froid (idiom in French; there is no translation for the adjective alone)"` ; `beebrush` → de, note `"no equivalent term in German…"` ; `physical` → de, note `"unter Einsatz aller physischen Kräfte (postpositioned)"`. Le texte utile, s'il y en a, est dans `note`.
- **Non latin** : les vrais parasites sont rares (es `absurdo` → en `παράλογος`, es `Stalingrado` → en `Сталинград`, it `papalina` → en `шпрот`, pt `após` → en `その後で`, pt `apresentação` → en `ˌintroduction`, it `circumnavigazione` → es en API). Le reste est légitime (`3.ª`, `29.º`, `nº`, `γ-ray`, `ácido γ-aminobutyrique`, `Kaʿba`) et doit passer.
- **Cible mal codée = langue de l'entrée** (de 295) : `oído` (es) → es `oído` avec sens `sdü`, `tempesta` (it) → it, `backstage` (de) → de `Backstage`. Ce sont des erreurs de `lang_code` ou des renvois, à jeter.
- **Dialectes rangés sous la langue standard (en)** : 483 tr6 taguées dialecte (`Alemannic-German` 289, `Bavarian`, `Swabian`, `Tuscany`…) : `ghost` → de `Gehuuri`, `people` → de `Voik`, `wine` → de `Wii (Haut Rhin)`. Ce sont des mots justes, mais pas de l'allemand standard.

## 5. Bruit structurel (rattachement, duplication, placeholders)

| Phénomène | en | fr | de | es | it | pt |
|---|---|---|---|---|---|---|
| tr6 sur une entrée dont la liste est une **copie** de celle d'une entrée sœur (même page) | 62 | 571 | 14 | **12 254 (12,0 %)** | **43 822 (27,1 %)** | 210 |
| tr6 sur une entrée **forme fléchie** (tous ses sens sont `form_of`) | 869 | 618 | 99 | 141 | **32 234 (20,0 %)** | 162 |
| Libellé de sens placeholder | `Translations` 25 284 | `Traductions à trier…` ~2 700 | `sdü`/`sdÜ` 7 502 ; `Übersetzungen umgeleitet` 125 | `?` 54 | — | — |
| Reste d'une plage de numéros dans `sense` | 9 | — | — | — | — | **1 107** (`e 2`, `, 2 e 4 (…`, `–2 (…`) |
| `word` identique au mot-tête | 32 019 | 57 636 | 14 570 | 8 664 | 3 151 | 12 939 |

- **it** : les couples de POS les plus touchés par la copie sont nom ← adj (4 434 entrées), verbe ← adj (2 977), verbe ← nom (1 580). Exemples : `invecchiato` (verbe, participe) porte en *old-fashioned* (« senso figurato: superato ») ; `chiuso` (verbe) porte en *exclusive* ; `calcio` (verbe, forme de *calciare*) porte fr *football*. Le libellé de sens it sert souvent à dire **à quelle POS** le bloc appartient : `(aggettivo)` 1 815, `aggettivo` 1 429, `(sostantivo)` 1 032, `sostantivo` 848. D'autres libellés sont des **domaines**, pas des gloses : `termine araldico` 2 567, `(araldica)` 1 542, `(senso figurato)` 1 122, `(medicina)` 538. Certains sont tronqués (`informatica` → `"scienza)"`).
- **es** : couples nom ← adj (1 209), verbe ← verbe (607), adj ← nom (382). La copie suit l'étymologie, et la numérotation continue sur la page permet de **réattribuer** chaque traduction à l'entrée qui possède vraiment le sens visé.
- **`word` = mot-tête** : ce n'est pas du bruit en soi (noms propres, emprunts, cognats : `motel`, `curling`, `kinyarwanda`). On ne filtre pas.

## 6. Conséquences pour les règles de nettoyage (à trancher dans le pipeline)

Ce sont des constats, pas des décisions :

1. **Validation du `sense_index`** : la règle de 007 est viable, avec un taux de rejet de 0,03 à 0,4 % pour fr/pt/de. Pour **es**, il faut résoudre **au niveau de la page** (même mot, même langue, même étymologie). La traduction doit être rattachée au **sens portant ce numéro, quelle que soit l'entrée POS**, et dédupliquée entre les entrées sœurs. Sinon : 17 % de faux orphelins et autant de doublons. Il faut gérer les plages et listes (`2-3`, `1,2`, `1–3, 7`) en multi-ancrage, et les lettres (`2a` ↔ `2`). Les valeurs `"*"` et `"?"` (de) et `0` (fr/pt) valent « sans sens précis ».
2. **it** : la copie sur toutes les POS rend la POS de l'entrée **peu fiable pour les traductions it**. Options : ne garder la liste que sur une entrée (lemme non `form_of`, première POS) ; ou ventiler par le libellé quand il nomme une POS (`aggettivo`/`sostantivo`/`verbo`) ; ou accepter le flou et dédupliquer par (page, cible, mot). Les entrées `form_of` it ne devraient jamais porter de traductions (20 % des tr6 it).
3. **Placeholders de sens** (`Translations`, `sdü`/`sdÜ`, `Traductions à trier…`, `À trier`, `?`, `Übersetzungen umgeleitet`) : à traiter comme « sans glose ». Ils ne doivent pas servir d'ancre de frères (sinon tous les blocs « à trier » d'une langue deviennent frères entre eux).
4. **pt `sense` résiduel** (`e 2`, `–2 (…`) : soit reparser les plages, soit rattacher seulement au premier sens et nettoyer la glose. 1 107 cas.
5. **Texte** :
   - rejeter `word` vide (en : 874) ;
   - rejeter `word` = abréviation de genre seule ;
   - rejeter les cibles où `lang_code` = langue de l'entrée ;
   - rejeter un nom de pays seul au milieu d'un bloc d'autres mots, **pour it→es seulement** (ailleurs, faux positifs) ;
   - de : découper sur ` ; [n] ` (56 cas, où chaque morceau a son sous-sens) ; supprimer les `( )` vides (le mot reste souvent incomplet : 524 cas, à rejeter ou à garder tels quels) ; découper ` / ` en variantes ;
   - en : retirer les crochets de rection (`[with de]`, `[el]`) et le préfixe `[n] ^((please verify))` ;
   - garder `ª º`, le grec et les apostrophes modificatrices (`Kaʿba`). Rejeter seulement les mots **entièrement** dans un autre script.
   - Le volume total est de quelques milliers de tr6 sur ~2 M : une poignée de regex suffit, sans filtrage statistique.
6. **Régions et dialectes** : la variante régionale arrive proprement en `tags`/`raw_tags` dans en, fr, de (des milliers). Elle peut alimenter le champ `traduction.région` du ticket 008. Les dialectes (`Alemannic-German`, `Bavarian`…, 483 en→de) sont à exclure ou à marquer.

## 7. Dumps observés (pour le pipeline)

| Fichier | gz (octets, `content-length`) | JSONL décompressé (page rawdata) | Lignes | Dump Wiktionary | Extraction kaikki |
|---|---|---|---|---|---|
| `raw-wiktextract-data.jsonl.gz` (en) | 2 981 058 381 (2,8 Go) | 23,9 Go | — (156 474 lignes avec traductions dans les 6 langues) | enwiktionary 2026-09-02 | 2026-10-03 |
| `fr-extract.jsonl.gz` | 736 590 407 (702,5 Mo) | 6,4 Go | 7 497 189 | frwiktionary 2026-10-01 | 2026-10-02 |
| `de-extract.jsonl.gz` | 308 579 949 (294,3 Mo) | 2,9 Go | 1 329 116 | dewiktionary 2026-09-01 | 2026-10-02 |
| `es-extract.jsonl.gz` | 103 226 106 (98,4 Mo) | 1,1 Go | 1 016 609 | eswiktionary 2026-10-01 | 2026-10-02 |
| `it-extract.jsonl.gz` | 43 849 714 (41,8 Mo) | 540,4 Mo | 803 337 | itwiktionary 2026-10-01 | 2026-10-03 |
| `pt-extract.jsonl.gz` | 37 158 607 (35,4 Mo) | 341,0 Mo | 627 516 | ptwiktionary 2026-09-01 | 2026-10-02 |

Sources : en-têtes HTTP `content-length` / `last-modified` (tous les fichiers sont datés du 2026-10-03 sur le serveur) ; page [rawdata](https://kaikki.org/dictionary/rawdata.html) pour les tailles décompressées et la date du dump en ; pages `https://kaikki.org/<xx>wiktionary/index.html` pour les dates de dump et d'extraction des autres éditions. Les éditions n'ont **pas toutes le même mois de dump** (de et pt ont un mois de retard).

Observation pratique : la lecture **en flux** fonctionne bien, y compris pour l'édition anglaise (téléchargement et analyse complets en quelques minutes sur cette machine). Pour en, un `grep -F '"translations"'` avant le parseur JSON élimine la plupart des 23,9 Go. Aucun fichier n'a besoin d'être stocké décompressé.

## Annexe : méthode

- Script Python (bibliothèque standard seulement), lancé en `python3 -I` sur `curl -s <url> | zcat` (et, pour en, `| grep -F '"translations"'`). Il a fait deux passes : analyse générale, puis comptage de motifs ciblés.
- **Page** : suite de lignes consécutives de même `word`. Les ensembles de sens de la page sont pris sur les entrées de même `lang_code`.
- **Copie de liste** : deux entrées de la même page et de la même langue avec une liste `translations` identique (JSON trié). La seconde et les suivantes sont comptées comme copies.
- **Forme fléchie** : tous les sens avec gloses ont `form_of` ou le tag `form-of`.
- **Non latin** : au moins une lettre (catégorie Unicode `L*`) dont le nom Unicode ne commence pas par `LATIN`. Cela inclut `ª º`, d'où une surestimation.
- **Région dans un bloc** : `word` est un nom de pays ou de région (liste multilingue d'environ 150 formes), le mot-tête n'en est pas un, et le bloc (même `sense`, même `sense_index`, même cible) contient au moins un autre mot qui n'est pas une région. C'est un minorant : la liste n'est pas exhaustive.
- Les chiffres en % sont rapportés aux tr6 de l'édition, sauf mention « des numérotées ».
- Exemples tirés par échantillonnage aléatoire dans chaque catégorie. Tous sont recopiés tels quels du JSONL.
