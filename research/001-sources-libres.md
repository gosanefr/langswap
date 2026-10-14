# Sources libres pour la traduction mot-à-mot fr/en/es/de/it/pt

Ticket : [001 — Quelles sources libres couvrent les paires fr/en/es/de/it/pt avec plusieurs sens ?](../wayfinder/tickets/001-sources-libres.md)
Date de la recherche : 2026-10-12/13. Les chiffres « mesurés » proviennent de comptages faits le même jour sur les dumps eux-mêmes (méthode en annexe). Les autres viennent des pages officielles citées.

## TL;DR

- **Wiktionary est la seule source libre qui réponde au besoin central** : plusieurs équivalents **groupés par sens, avec glose**, pour les 6 langues et dans les 15 paires, avec en plus des formes fléchies (et leur lemme) en masse. Licence CC BY-SA 4.0 + GFDL ([Wiktionary:Copyrights](https://en.wiktionary.org/wiki/Wiktionary:Copyrights)).
- On peut l'exploiter de deux manières :
  1. **wiktextract / kaikki.org** : JSONL, extraction hebdomadaire. On a l'édition anglaise (2,8 Go gz) et les éditions fr, es, de, it et pt (de 35 à 700 Mo gz chacune). C'est le format le plus riche et le plus simple à traiter (lignes JSON, `translations[]` avec `sense`/`sense_index`, `forms[]`, `form_of`).
  2. **WikDict** (construit sur DBnary) : **30 bases SQLite prêtes à l'emploi** (une par sens de traduction pour les 15 paires, 2 à 26 Mo chacune, ~330 Mo au total). Les traductions y sont déjà fusionnées entre éditions, **inférées via pivot** quand il n'y a pas de lien direct, et scorées. Elles sont regroupées par glose. CC BY-SA.
- **Recommandation** : construire la base à partir de **wiktextract (édition anglaise + les 5 autres éditions)**. Ce sera la source canonique : sens, gloses, catégorie, formes fléchies. Utiliser **WikDict comme raccourci de démarrage, base de comparaison et complément** pour les paires sans anglais. Les autres sources sont soit de niche (Apertium en GPL, utile pour la morphologie), soit inadaptées : OMW n'a pas d'allemand dans le paquet, les sens y sont trop fins et sans glose dans la langue ; MUSE et PanLex sont **non commerciaux** ; OmegaWiki est **mort** ; FreeDict est hétérogène et ses meilleurs dictionnaires *sont* WikDict.

## 1. Comparatif

| Source | Licence | Paires couvertes (sur 15) | Sens / gloses / POS | Formes fléchies | Format, taille, fraîcheur |
|---|---|---|---|---|---|
| **Wiktionary via wiktextract (kaikki.org)** | Données : CC BY-SA 4.0 + GFDL (Wiktionary). Code : MIT | 15 : 5 paires en↔X très riches. Les 10 paires sans anglais ont des liens directs mais plus maigres (cf. §2) | **Oui** : traduction rattachée à une glose de sens (`sense`) ou à un numéro de sens (`sense_index`), POS par entrée | **Oui** : `forms[]` (tables de flexion) et entrées `form_of` (forme → lemme) pour les 6 langues | JSONL. en : 23,9 Go (2,8 Go gz). fr : 6,4 Go (702 Mo gz). de : 294 Mo gz. es : 98 Mo gz. it : 42 Mo gz. pt : 35 Mo gz. Mis à jour « au moins une fois par semaine ». Dump enwiktionary du 2026-09-02, extrait le 2026-10-03 |
| **DBnary** | CC BY-SA 3.0 (données). Code : MIT | Mêmes éditions que Wiktionary, en RDF | Oui. Fichier *enhancement* qui relie les traductions à des sens précis | Morphologie riche seulement pour fr (16 Mo bz2) et de (74 Mo bz2). Quasi vide pour en/es/it/pt | RDF Turtle (ontolex). en : 209 Mo bz2. fr : 112 Mo bz2. Mis à jour 2×/mois (fichiers du 2026-10-02/04) |
| **WikDict** (DBnary → SQLite) | CC BY-SA (données). Générateur : MIT | **15/15, dans les 2 sens**, avec inférence par pivot | Groupé par glose de sens (glose dans la langue source), score + `is_good`, importance | Uniquement dans les bases monolingues (`fr.sqlite3` 440 Mo…), reprises de DBnary : fr/de surtout | SQLite. Bases de paire de 2 à 26 Mo. Build du 2026-06-23 |
| **Apertium** (dictionnaires bilingues `.dix`) | GPL-2.0 / GPL-3.0 | ~10 paires réellement utilisables. Rien ou presque pour es-de, it-pt, it-de, pt-de | POS oui. **Pas de gloses**. Plusieurs équivalents possibles, mais un seul par défaut (pensé pour la TA) | Excellente (analyseurs morphologiques monolingues), mais GPL et au format XML/lttoolbox | XML dans des dépôts GitHub, de 0,6 k à 70 k entrées par paire |
| **Open Multilingual Wordnet 2.0** | Par wordnet : fr WOLF **CeCILL-C** · es **CC BY 3.0** · it **CC BY 3.0** (+ ItalWordNet ODC-BY) · pt **CC BY-SA**. Allemand absent du paquet (OdeNet à part, CC BY-SA 4.0) | Toutes les paires via les synsets (concepts interlingues), sauf de | Sens = synsets **très fins**. Les définitions sont en anglais seulement ; les wordnets fr/es/it/pt n'ont que des lemmes | Non (lemmes seuls) | WN-LMF XML, 1 à 11 Mo xz par langue. Release v2.0 du 2026-02-01 |
| **FreeDict** | Variable : GPL (Ding de-en, travlang) ou CC BY-SA (dictionnaires WikDict) | 28 dictionnaires entre nos langues. Les plus récents (2025-11-23) **sont des exports WikDict** | Selon la source | Non | TEI / dictd / StarDict |
| **MUSE** (Facebook) | **CC BY-NC 4.0** | Les 30 directions entre les 6 langues | Non : paires de mots à plat, formes de surface | Formes de surface, pas de lien au lemme | TXT, ~100 k paires (en-fr : 113 286 lignes). Dépôt archivé (2023) |
| **PanLex** | Page de licence officielle : **CC BY-NC-SA 4.0**, usage commercial sur autorisation | Toutes | Pauvre | Non | `db.panlex.org` injoignable lors de la recherche |
| **OmegaWiki** | CC-BY / GFDL (historique) | — | — | — | **Projet mort** : site injoignable, dernière capture Internet Archive du 2023-07-09 |
| **OPUS** | Licence propre à chaque corpus | — | — | — | Corpus parallèles, pas de dictionnaire téléchargeable. Il faudrait aligner soi-même |

## 2. Wiktionary / wiktextract : couverture mesurée

### 2.1 Traductions extraites, par édition et par paire

Comptage sur les dumps kaikki d'octobre 2026. *items* = paires (mot source, traduction). *mots-tête* = (mot, POS) distincts ayant au moins une traduction vers la langue cible. *% sens* = part des traductions rattachées à un sens (glose ou numéro de sens).

**Édition anglaise** (traductions depuis les entrées anglaises) :

| Paire | items | mots-tête | (mot, POS, sens) distincts | % sens |
|---|---|---|---|---|
| en→de | 162 150 | 72 796 | 95 764 | ~100 % |
| en→es | 147 083 | 68 058 | 86 952 | ~100 % |
| en→fr | 128 303 | 77 020 | 95 931 | ~100 % |
| en→pt | 101 911 | 58 072 | 75 863 | ~100 % |
| en→it | 97 402 | 54 846 | 69 229 | ~100 % |

L'édition anglaise contient aussi des entrées **en langue étrangère avec gloses anglaises** (non-formes fléchies, sens glosés). Cela donne la direction X→en : it 163 390, es 117 937, fr 98 355, de 94 346, pt 79 817 entrées.

**Éditions non anglaises** (traductions depuis les mots-tête de la langue de l'édition) :

| Édition | →en | →fr | →es | →de | →it | →pt | % sens (moy.) |
|---|---|---|---|---|---|---|---|
| fr (wiktionnaire) | 196 130 | — | 78 472 | 86 238 | 90 315 | 43 224 | ~27 % (38 % pour pt) |
| de | 135 034 | 102 922 | 62 482 | — | 57 364 | 32 723 | ~99 % |
| it | 109 653 | 14 410 | 13 018 | 17 008 | — | 7 275 | ~72 % |
| es | 34 737 | 22 025 | — | 18 633 | 13 837 | 12 899 | ~60 % |
| pt | 28 309 | 18 702 | 20 627 | 15 010 | 15 523 | — | ~25 % |

(Les chiffres sont des *items*. Les mots-tête distincts représentent environ 60 à 70 % des items. Le détail figure dans les sorties de comptage.)

**Lecture pour les 15 paires** :
- **en↔fr/es/de/it/pt** : très bien couvertes dans les deux sens, toujours avec sens.
- **fr↔de, fr↔it, fr↔es** : correctes en direct (fr→X : 78 à 90 k, plus de→fr 103 k), grâce aux gros Wiktionnaires fr et de.
- **de↔es, de↔it, de↔pt, fr↔pt** : moyennes (de→X 33 à 62 k, presque entièrement avec sens).
- **es↔it, es↔pt, it↔pt, pt↔fr…** : maigres en direct (7 à 21 k items par direction). C'est là que le **pivot par l'anglais** (ou par les sens d'une même entrée multilingue) devient nécessaire, ce qui alimente le ticket 002.

### 2.2 Granularité des sens : l'exemple du ticket

Édition anglaise, `work` (nom) → fr : *travail* (« effort expended on a particular task », « place where one is employed », physique…), *travail / œuvre* (« literary, artistic, or intellectual production »). `work` (verbe) → fr : *travailler, bosser* (« to do a specific task »), *marcher, fonctionner* (« to function correctly »), *opérer*, *actionner*, *faire*, *broder*. `job` (nom) → fr : *travail, emploi, métier, boulot, job, poste* (« economic role for which a person is paid »), *tâche, travail, boulot* (« task »).

Le regroupement attendu par la carte (« en:work → travail / œuvre / fonctionner ; en:job → travail / métier ») est donc **natif** dans les données.

Côté fr : `travail` → en *work, job, labor* (« Labeur, tâche »), *work, job* (« Activité professionnelle »), de *Wehe* / en *labor* (« Contractions de l'accouchement »). Côté de : `Arbeit` a 3 gloses de sens distinctes, avec en/fr/es/it/pt sous chacune. Côté pt : `trabalho` → « atividade física ou intelectual », « profissão, ofício »…

### 2.3 Formes fléchies et lemmes

Chaque entrée peut porter `forms[]` (liste `{form, tags}`) et des sens `form_of` (« forme fléchie de » → lemme) ([README wiktextract](https://github.com/tatuylonen/wiktextract)). Entrées `form_of` mesurées :
- dans l'édition anglaise : es 694 k, en 691 k, it 462 k, pt 367 k, fr 305 k, de 278 k ;
- dans les éditions natives : fr 1,56 M, de 823 k, es 704 k, it 486 k, pt 306 k.

Les `forms[]` des tables de flexion vont de 0,6 M (fr, pt) à 3,7 M (de) dans l'édition anglaise. Il y a donc **assez de matière pour un index forme → lemme dans les 6 langues** sans outil de morphologie externe (cela alimente le ticket 004).

### 2.4 Bruit d'extraction observé (à nettoyer au build)

- Édition anglaise : marqueurs résiduels dans `word`, par ex. `"[6] ^((please verify)) œuvre"` pour `work` → fr.
- Édition italienne : des noms de régions sont extraits comme traductions (`lavoro` → es : « Argentina », « Uruguay », « Messico »… mêlés à *laburo*, *curro*, *chamba*).
- Wiktionnaire fr et pt : seulement ~25 % des traductions sont rattachées à un sens. Le reste est un bloc non désambiguïsé (cohérent avec DBnary : 933 497 traductions fr « sans glose » sur 1 451 690).
- Les gloses des éditions non anglaises sont **dans la langue de l'édition** (glose fr pour une entrée fr), ce qui convient bien à l'affichage côté source.
- Les fichiers par langue de kaikki (`kaikki.org-dictionary-French.jsonl`…) sont marqués **DEPRECATED**. Il faut se baser sur le dump brut (`raw-wiktextract-data.jsonl.gz`) et les `xx-extract.jsonl.gz` ([rawdata](https://kaikki.org/dictionary/rawdata.html)).

### 2.5 Licence

Wiktionary est sous double licence CC BY-SA 4.0 et GFDL. La réutilisation impose **attribution + partage à l'identique** ; un lien visible vers wiktionary.org satisfait l'attribution GFDL ([Wiktionary:Copyrights](https://en.wiktionary.org/wiki/Wiktionary:Copyrights)). Les pages kaikki ne restatent pas de licence pour les données et demandent seulement de citer Ylonen (LREC 2022) et de faire un lien vers kaikki.org. **Conséquence pour LangSwap** : un prototype local ne pose aucun problème. Si un jour la base dérivée est redistribuée (appli Android), elle devra être sous CC BY-SA avec attribution. Le code de l'appli, lui, n'est pas contaminé : la contrainte porte sur la base.

## 3. DBnary et WikDict

### DBnary
- 27 éditions extraites en RDF ontolex. Données sous **CC BY-SA 3.0**. Mise à jour à chaque dump, soit environ 2 fois par mois. Les fichiers `*_dbnary_enhancement.ttl.bz2` relient les paires de traduction aux sens précis ([about DBnary](https://kaiko.getalp.org/about-dbnary/)).
- Statistiques officielles (dump 20261001, fichiers `*_dbnary_statistics.ttl.bz2` de [latest](https://kaiko.getalp.org/static/ontolex/latest/)) :

| Édition | entrées lexicales | sens | traductions (toutes langues cibles) |
|---|---|---|---|
| en | 1 516 264 | 1 271 722 | 3 640 819 |
| fr | 626 455 | 709 738 | 1 451 690 |
| de | 254 986 | 242 732 | 1 219 812 |
| pt | 62 702 | 107 287 | 296 401 |
| es | 123 186 | 176 438 | 240 424 |
| it | 77 524 | 99 038 | 173 627 |

- Morphologie : riche pour fr et de, quasi vide pour les 4 autres (fichiers `*_morphology` de ~460 octets). wiktextract est plus complet sur ce point.
- RDF : plus lourd à traiter que le JSONL. Inutile d'y aller directement si on prend WikDict ou wiktextract.

### WikDict
- Téléchargement SQLite par paire et par direction : [download.wikdict.com/dictionaries/sqlite/2/](https://download.wikdict.com/dictionaries/sqlite/2/). **Les 30 directions entre nos 6 langues existent** (de 1,9 Mo pour pt-it à 26 Mo pour de-en, ~330 Mo au total, build du 2026-06-23). Existent aussi en TEI, StarDict et Kobo. Licence CC BY-SA ([page download](https://www.wikdict.com/page/download)).
- Schéma (vérifié) : table `translation(lexentry, sense_num, sense, written_rep, trans_list, score, is_good, importance)`, vue `translation_grouped`, table `simple_translation(written_rep, trans_list, max_score, rel_importance)`.
- Construction ([wikdict-gen](https://github.com/karlb/wikdict-gen), `src/scoring.py`) : une traduction directe vaut 100 ; une traduction seulement inverse (B→A) vaut 2 ; une traduction **indirecte via pivot** vaut au plus 10 × (score de back-link)² par langue pivot. Les chemins sont additionnés. `is_good` = score ≥ 15 et entrée lexicale connue (précision mesurée d'environ 92 % sur la bande 15–20).
- Lignes `translation` mesurées (total / dont `sense` non vide / dont `is_good`) :

| Dir. | total | avec sens | is_good | Dir. | total | avec sens | is_good |
|---|---|---|---|---|---|---|---|
| en-fr | 199 431 | 100 798 | 98 240 | fr-en | 182 856 | 33 412 | 140 235 |
| en-de | 157 801 | 100 909 | 97 143 | de-en | 165 298 | 105 077 | 96 413 |
| en-es | 110 916 | 94 489 | 89 067 | es-en | 102 643 | 13 821 | 25 887 |
| en-it | 108 583 | 86 820 | 73 293 | it-en | 79 832 | 22 326 | 35 836 |
| en-pt | 92 101 | 82 750 | 75 774 | pt-en | 69 448 | 3 965 | 14 086 |
| fr-de | 122 561 | 25 401 | 59 746 | de-fr | 125 975 | 94 053 | 78 178 |
| fr-es | 92 993 | 23 459 | 62 801 | es-fr | 72 114 | 12 146 | 18 074 |
| fr-it | 97 391 | 23 866 | 76 687 | it-fr | 89 434 | 18 836 | 8 812 |
| fr-pt | 67 574 | 20 848 | 34 155 | pt-fr | 37 532 | 3 457 | 11 104 |
| de-es | 80 066 | 76 817 | 50 018 | es-de | 54 961 | 12 290 | 14 489 |
| de-it | 77 777 | 74 658 | 46 677 | it-de | 59 317 | 19 106 | 9 463 |
| de-pt | 68 457 | 65 881 | 29 474 | pt-de | 31 031 | 3 457 | 9 663 |
| es-it | 26 764 | 11 602 | 12 464 | it-es | 34 541 | 18 590 | 7 019 |
| es-pt | 28 584 | 10 994 | 11 386 | pt-es | 20 374 | 3 566 | 11 801 |
| it-pt | 32 236 | 17 978 | 5 485 | pt-it | 15 734 | 3 365 | 9 536 |

- Exemple `en-fr` / `work` : 14 lignes groupées par glose (« effort expended on a particular task » → *travail | œuvre* ; « to do a specific task » → *travailler | bosser* ; sans glose → *marcher | fonctionner | …*). On note une **anomalie** : toutes les lignes portent `lexentry = eng/work__Noun__1`, y compris les sens verbaux. La POS n'est donc pas fiable via `lexentry` dans cette base.
- Exemple `es-fr` / `trabajo` : une seule ligne (sens 01 → *travail*). C'est beaucoup moins riche que la direction en→X.
- Verdict : c'est l'**option la plus rapide** pour un premier prototype (aucun pipeline, SQLite directement). En revanche, on dépend des choix de scoring d'un tiers, la POS est fragile, les formes fléchies ne sont pas dans les bases de paire, et les builds sont espacés (juin 2026 pour un DBnary mis à jour 2×/mois).

## 4. Autres sources

### Apertium
Dictionnaires bilingues `.dix` (XML lttoolbox) dans `github.com/apertium/apertium-X-Y`, sous **GPL** (2.0 ou 3.0 selon le dépôt). Entrées `<e>` comptées dans le bidix : eng-deu 70 322, eng-spa 37 796 (dépôt actif, push 2026-09-15), eng-ita 30 005, fra-spa 27 029, fra-por 18 604, spa-ita 16 732, fra-eng 16 575, spa-por 15 538, fra-ita 9 709, spa-deu 620, ita-por 13. Aucun dépôt trouvé pour it-de, pt-de ou es-de hors spa-deu (quasi vide) ; en-fr = fra-eng (16,6 k). Plusieurs équivalents existent (`work` n → *trabajo, obra, labor, faena, curro* ; v → *trabajar, funcionar, explotar, obrar*), mais **sans glose**, et les variantes sont marquées par des restrictions de direction (`r="LR"/"RL"`) et des préférences (`slr/srl`) pensées pour la traduction automatique. Intérêt réel : les **analyseurs morphologiques monolingues** (apertium-fra, -spa, -eng, -ita, -por, -deu) pour lemmatiser. Mais wiktextract fournit déjà forme → lemme, et la GPL est contraignante si on embarque les données.

### Open Multilingual Wordnet 2.0
Release v2.0 du 2026-02-01 ([omw-data releases](https://github.com/omwn/omw-data/releases)). Licences d'après l'index du paquet `wn` ([index.toml](https://raw.githubusercontent.com/goodmami/wn/main/wn/index.toml)). Contenu mesuré :

| Wordnet | Licence | entrées | sens | synsets |
|---|---|---|---|---|
| omw-en | (PWN 3.0) | 156 584 | 206 978 | 117 659 |
| omw-es (MCR) | CC BY 3.0 | 93 834 | 145 641 | 78 948 |
| omw-fr (WOLF) | CeCILL-C | 59 612 | 102 647 | 59 091 |
| omw-pt (OpenWN-PT) | CC BY-SA | 54 932 | 74 012 | 43 895 |
| omw-it (MultiWordNet) | CC BY 3.0 | 43 004 | 62 125 | 35 001 |
| de | OdeNet, CC BY-SA 4.0 (hors paquet OMW) | — | — | — |

Les traductions s'obtiennent par synset partagé, et toutes les paires sont reliées par construction (pivot conceptuel, pas lexical). Mais les sens WordNet sont **trop fins** pour un usage « en pleine conversation » (*work* compte 7 sens nominaux et 27 verbaux dans omw-en), les gloses sont en anglais uniquement, les wordnets fr/es/it/pt sont construits automatiquement (bruités) et la couverture du vocabulaire courant est inégale. C'est au mieux un **complément** pour combler des trous, pas une base.

### FreeDict
D'après la base [freedict-database.json](https://freedict.org/freedict-database.json), 28 dictionnaires concernent nos langues. Les plus gros récents (édition 2025.11.23 : eng-spa 64 k, fra-ita 67 k, fra-spa 53 k, deu-fra 60 k, …) ont pour source `wikdict.com` : ce sont des exports WikDict. Le reste est ancien (2017–2019), petit (spa-por 357 mots-tête, spa-eng 4 502) ou sous GPL : deu-eng/eng-deu 517 k/460 k mots-tête issus de Ding (TU Chemnitz), « GNU GPL ver. 2.0 and any later version ». **Seul ajout utile** : Ding de↔en, si l'allemand s'avère faible, avec la contrainte GPL.

### MUSE (facebookresearch)
Paires de mots pour toutes les directions entre de/en/es/fr/it/pt (« up to 100k pairs », en-fr = 113 286 lignes). Formes de surface (`work → travaux, travail, travailler`), sans sens ni glose. **Licence CC BY-NC 4.0** (fichier LICENSE du dépôt), dépôt archivé le 2023-10-31. À exclure, sauf pour une évaluation locale sans redistribution.

### PanLex, OmegaWiki, OPUS
- **PanLex** : la [page de licence](https://panlex.org/license/) indique CC BY-NC-SA 4.0 et un usage commercial sur autorisation écrite. D'anciennes pages mentionnent des snapshots CC0, mais `db.panlex.org` ne répondait pas. Contradictoire et incertain, donc à exclure.
- **OmegaWiki** : `omegawiki.org` injoignable. Dernière capture Internet Archive du 2023-07-09. Wikimedia Commons le qualifie de « defunct » ([Commons](https://commons.wikimedia.org/wiki/Category:OmegaWiki), [Meta](https://meta.wikimedia.org/wiki/OmegaWiki)). À exclure.
- **OPUS** : corpus parallèles ([opus.nlpl.eu](https://opus.nlpl.eu/)), chacun sous sa licence. Aucun dictionnaire prêt à l'emploi ; il faudrait faire l'alignement de mots soi-même. Ce serait éventuellement utile plus tard pour **ordonner** les équivalents par fréquence, pas pour les produire.

## 5. Recommandation

1. **Source canonique : Wiktionary via wiktextract.** On prend l'édition anglaise (dump brut) **plus** les éditions fr, de, es, it et pt (`xx-extract.jsonl.gz`). L'édition anglaise apporte la colonne vertébrale en↔X avec sens glosés (~100 % des traductions rattachées à un sens) et les gloses anglaises des entrées étrangères. Les éditions natives apportent les liens directs entre langues non anglaises, des gloses dans la langue source et des formes fléchies massives. Le tout tient en ~1,2 Go compressé pour les éditions natives plus 2,8 Go pour l'anglaise, à réduire en une base locale de quelques dizaines de Mo.
2. **Raccourci / filet : WikDict SQLite.** Il est utilisable tel quel pour un premier écran (30 fichiers, ~330 Mo, aucun pipeline). C'est aussi une base de comparaison pour l'agrégation multi-éditions et l'inférence par pivot, déjà faites et scorées (`is_good`).
3. **Paires faibles** (es↔it, es↔pt, it↔pt, pt↔fr, pt↔de, it↔de) : il faudra un pivot, via l'anglais ou via l'agrégation de type WikDict. C'est l'objet du ticket 002.
4. **Lemmatisation** : les `form_of` et `forms[]` de wiktextract suffisent (6 langues). Apertium n'est à prendre qu'en cas de besoin ponctuel, en acceptant la GPL.
5. **Exclus** : MUSE et PanLex (non commerciaux), OmegaWiki (mort), OPUS (pas de dictionnaire). OMW et FreeDict/Ding sont de simples compléments éventuels.
6. **Contrainte de licence** : la base dérivée hérite de CC BY-SA. Il faut prévoir une mention « Données : Wiktionary (CC BY-SA 4.0), via wiktextract/kaikki.org » dans l'UI.

## Annexe : méthode de mesure

- Les dumps kaikki ont été lus en flux (`curl | gunzip`) par un script Python. Pour chaque entrée dont le `lang_code` est dans {fr, en, es, de, it, pt}, il compte les éléments de `translations` (au niveau de l'entrée et des sens) dont la langue cible est aussi dans l'ensemble. Une traduction est comptée « avec sens » si `sense`, `sense_index` ou `sense_id` est renseigné. Les entrées `form_of`/`alt_of` sont comptées à part. Fichiers : `raw-wiktextract-data.jsonl.gz` (enwiktionary 2026-09-02, extraction 2026-10-03), `fr|es|de|it|pt-extract.jsonl.gz` (même vague, [rawdata](https://kaikki.org/dictionary/rawdata.html)).
- WikDict : les 30 fichiers `xx-yy.sqlite3` de `download.wikdict.com/dictionaries/sqlite/2/` ont été interrogés en lecture seule.
- DBnary : fichiers `*_dbnary_statistics.ttl.bz2` officiels.
- Apertium : nombre d'éléments `<e` dans `apertium-X-Y.X-Y.dix` (branche master).
- OMW : nombre de `<LexicalEntry`, `<Sense ` et `<Synset ` dans les archives `omw-xx-2.0.tar.xz`.
