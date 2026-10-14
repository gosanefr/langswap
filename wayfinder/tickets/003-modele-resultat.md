---
title: "Qu'est-ce qu'un « résultat » : sens, gloses, catégorie, ordre"
labels: [wayfinder:grilling]
parent: map
status: closed
assignee: cat
blocked_by: [001]
---

## Question

Quel est le modèle d'un résultat de recherche affiché à l'utilisateur : regroupe-t-on les équivalents par sens du mot source, affiche-t-on une glose / la catégorie grammaticale, combien d'équivalents au maximum, et dans quel ordre (fréquence, ordre de la source, pertinence) ?

### Contrainte reçue (2026-10-13)

Depuis [Paires directes ou pivot ?](002-pivot-ou-direct.md) : les résultats comprennent des mots **flous** (pivot en chaîne, triés par nombre de chemins) qui ne sont rattachés à aucun sens source. Décider où ils s'affichent dans le tableau sens × langues et en mode 1 langue, et avec quel style.

## Résolution (2026-10-13)

Un résultat = un tableau de **lignes de sens** (lignes) × langues (colonnes), même structure en mode 1 langue (lignes vides masquées).

1. **Lignes de sens** : une ligne par sens glosé, quelle que soit son origine — sens de l'**entrée native** du mot cherché, ou **sens inverse** (sens d'une autre entrée, toute édition, qui liste le mot cherché parmi ses traductions, ex. en:work « effort expended… » pour fr:travail). **Pas de fusion** entre entrées ; doublons de sens acceptés. Traductions natives sans sens → ligne **« sans sens précis »**.
2. **POS** : lignes regroupées par catégorie grammaticale, intertitre (« nom », « verbe »…) seulement s'il y a plusieurs POS. Un sens inverse prend la POS de son entrée d'origine. Ordre des groupes : celui de l'entrée native, sinon volume de traductions.
3. **Ordre des lignes** dans un groupe : sens natifs (ordre du Wiktionnaire) → sens inverses triés par nombre de langues de destination couvertes, puis rang du sens dans son entrée d'origine → « sans sens précis ».
4. **Mots flous (pivot)** : une **ligne finale unique « Proches (via pivot) »**, sous tous les groupes POS, non découpée par POS, triée par nombre de chemins, style flou. **Survol / focus** : les chemins (« via en:work, de:Arbeit (2) »). En réglage « repli seulement », la ligne n'apparaît que pour les langues sans lien ferme.
5. **Plafonds** (valeurs de départ, à ajuster) : case ferme sans plafond (ordre de la liste Wiktionary, dédoublonnée sur le mot, meilleure position retenue) ; « Proches » : **5** mots par colonne puis « +N » ; tableau : sens natifs + **6** premiers sens inverses puis « N autres sens ». Gloses longues tronquées, texte complet au survol.
6. **Gloses** : telles quelles, dans leur langue. Sens inverse suivi d'une étiquette discrète d'origine `en · work` ; sens natif sans étiquette. Sens sans glose mais numéroté → « sens n » + étiquette.
7. **Annotations** : **genre uniquement** (`travail m.`, `Arbeit f.`). Registre, région, translittération, notes : non affichés (région gardée dans les données).
8. **Interaction** : **clic = copier** le mot ; **double-clic = nouvelle recherche** (langue du mot en source fixée, destination inchangée). Clavier : Entrée = copier, Alt+Entrée = nouvelle recherche.

Conséquences : les données doivent fournir les sens inverses (index mot → sens d'autres entrées qui le contiennent), la POS par entrée, le rang des sens, le genre des traductions et les chemins pivot (pas seulement leur nombre).
