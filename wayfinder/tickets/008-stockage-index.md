---
title: "Format de stockage et index de recherche"
labels: [wayfinder:grilling]
parent: map
status: closed
assignee: cat
blocked_by: [007]
---

## Question

Sous quelle forme stocke-t-on la base locale construite depuis wiktextract (6 éditions, voir [WikDict tel quel ou wiktextract ?](007-wikdict-ou-wiktextract.md)), et quels index prépare-t-on, pour servir chaque recherche du prototype rapidement ? Choix possibles : SQLite, JSON trié, FST, etc. ; pivot précalculé ou calculé à la volée.

La base doit permettre :
- de garder le **type de lien** (direct / frère de sens / pivot à 1 saut), le **nombre de chemins** et les **chemins pivot** eux-mêmes ([Directes ou pivot ?](002-pivot-ou-direct.md)) ;
- d'utiliser un **index inverse** mot → sens d'autres entrées qui le contiennent, avec la glose, l'entrée d'origine, la POS et le rang du sens ; la POS par entrée ; le genre des traductions ([Résultat](003-modele-resultat.md)) ;
- d'utiliser un **index des formes normalisées** (sans accents, casefold, trait d'union ≡ espace) vers les entrées et les lemmes, soit plusieurs millions de formes, en gardant la forme accentuée d'origine et le volume de traductions par entrée ([Saisie](004-comportement-saisie.md)) ;
- de chercher dans les **6 langues à la fois** (mode AUTO).

## Résolution (2026-10-13)

1. **Processus natif + SQLite**, pas de base chargée dans le navigateur. Le choix vaut aussi pour la future app Android (SQLite natif).
2. **Deux fichiers** : `langswap.sqlite` (dictionnaire, 6 langues, lecture seule, un seul fichier car frères de sens, sens inverses et pivot traversent toutes les éditions) et `historique.sqlite` (lecture-écriture). Le téléchargement par langue est laissé à l'effort Android.
3. **Nœud = mot** (langue + forme écrite exacte, accents et casse gardés), car une traduction Wiktionary n'est qu'une chaîne sans POS. La POS vit sur les entrées et sur les sens. Effet accepté : un pivot via fr:*marche* mélange nom et verbe (cohérent avec le style flou).
4. **Schéma** :
   - `mot(id, lang, texte, volume)` ;
   - `entree(id, mot_id, pos, édition, rang)` ;
   - `sens(id, entree_id, rang, glose, ancre, langues)` : la ligne « sans sens précis » de chaque entrée et les `sense_index` orphelins ont `ancre = faux` ;
   - `traduction(sens_id, mot_id, rang, genre, région)`, indexée sur `mot_id` ;
   - `forme(cle, mot_id, forme_orig, couche = mot|flexion)`, indexée sur `cle`. `cle` = normalisation de « Saisie ». `forme_orig` sert au classement des correspondances exactes et aux variantes « aussi : … ».
   - Les mots sont référencés par **id entier** partout.
5. **Aucune matérialisation des liens** (les paires de frères seraient quadratiques) :
   - lien direct = mot de l'entrée ↔ mot traduit, lu dans les deux sens ;
   - frères de sens = autres `traduction` d'un `sens` d'ancre vraie contenant le mot ;
   - sens inverses = ces mêmes `sens` ;
   - tout cela via l'index de `traduction` ;
   - **pivot calculé à la volée** = ce saut appliqué deux fois, groupé par mot intermédiaire. Il est protégé par un **plafond de mots intermédiaires** (les plus riches en chemins d'abord), à chiffrer avec la stack.
6. **Cherchable** = tout mot ayant au moins un lien ferme, y compris un mot présent seulement comme cible de traduction (il n'a alors que des sens inverses).
7. **Précalculés au build** : `mot.volume` (nombre de liens fermes), `sens.langues` (masque des 6 langues cibles couvertes), les rangs. Les langues configurées et le réglage pivot sont filtrés à la requête.
8. **Historique** : `recherche(id, saisie, lemme, langues, horodatage, parent_id)`, **en texte**, sans aucun `mot_id`, car les ids changent à chaque build.
