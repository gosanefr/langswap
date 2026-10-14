---
title: "Données du prototype : WikDict tel quel ou pipeline wiktextract ?"
labels: [wayfinder:grilling]
parent: map
status: closed
assignee: cat
blocked_by: []
---

## Question

Pour le prototype, part-on des bases SQLite WikDict telles quelles (15 paires prêtes, ~330 Mo, gloses et score `is_good`, mais POS peu fiable, pas de formes fléchies, scoring d'un tiers incluant de l'inférence par pivot) ou construit-on directement notre propre base à partir des dumps wiktextract/kaikki (contrôle total, liens directs uniquement, mais un pipeline à écrire) ? Voir [la recherche sur les sources](../../research/001-sources-libres.md), §2–3. Lié à la réponse provisoire de « Paires de langues directes ou passage par une langue pivot ? » : WikDict mélange direct et pivot, il faudrait filtrer.

### Contrainte reçue (2026-10-13)

Depuis [Paires directes ou pivot ?](002-pivot-ou-direct.md) : le modèle exige de connaître pour chaque traduction son **type de lien** (direct / frère de sens / pivot en chaîne à 1 saut) et, pour le pivot, le **nombre de mots intermédiaires distincts**. WikDict fond tout cela dans un score unique et ne donne pas les frères de sens comme tels : vérifier s'il peut quand même convenir.

### Contrainte reçue (2026-10-13)

Depuis [Qu'est-ce qu'un « résultat »](003-modele-resultat.md) : il faut aussi les **sens inverses** (sens d'autres entrées, toutes éditions, qui listent le mot cherché, avec leur glose, leur entrée d'origine, leur POS et leur rang), le **genre** des traductions et les **chemins pivot** eux-mêmes (affichés au survol), pas seulement leur nombre. WikDict, groupé par paire et par glose de la langue source, ne donne pas directement les sens inverses multilingues.

### Contrainte reçue (2026-10-13)

Depuis [Que doit retrouver la saisie](004-comportement-saisie.md) : il faut un **index forme fléchie → lemme** dans les 6 langues (`form_of` + `forms[]` de wiktextract). Il faut aussi la forme originale accentuée et un volume de traductions par entrée. Les bases de paire WikDict n'ont pas de formes fléchies : même en partant de WikDict, une extraction wiktextract serait nécessaire au moins pour les formes.

## Résolution (2026-10-13)

Les exigences des tickets fermés (type de lien, frères de sens, sens inverses multilingues, chemins pivot, genre, POS fiable, formes fléchies) ne sont pas couvertes par les bases de paire WikDict. Une extraction wiktextract était donc nécessaire dans tous les cas.

1. **Source unique : wiktextract**, avec les **6 éditions** : en (`raw-wiktextract-data.jsonl.gz`) et fr, de, es, it, pt (`xx-extract.jsonl.gz`), voir [rawdata](https://kaikki.org/dictionary/rawdata.html). Les petites éditions (it/es/pt) portent les liens directs des paires maigres.
2. **WikDict n'alimente jamais la base.** Il reste seulement une **référence de contrôle au build**, par exemple pour détecter une perte massive de couverture sur une paire comparée à WikDict.
3. **Traductions sans sens** (bloc non désambiguïsé d'une entrée, ~73 % pour fr et pt) :
   - ce sont des **liens directs**, affichés dans la ligne « sans sens précis » ;
   - elles ne sont **pas frères de sens** entre elles, faute d'ancre ;
   - elles peuvent servir d'**étape de pivot**, puisqu'un lien direct est un lien ferme.
4. **Ancre des frères de sens** : même entrée **et** même sens, que ce sens soit identifié par sa **glose** ou par son seul **`sense_index`**. Un `sense_index` qui ne correspond à aucun sens existant de l'entrée est traité comme « sans sens précis » (validation au build).

