---
title: Paires de langues directes ou passage par une langue pivot ?
labels: [wayfinder:grilling]
parent: map
status: closed
assignee: cat
blocked_by: [001]
---

## Question

Pour les 15 paires entre les 6 langues, stocke-t-on des traductions directes par paire, passe-t-on par une langue pivot (anglais ? sens Wiktionary ?), ou un mélange (direct quand disponible, pivot sinon) — et comment gérer la perte de précision des sens via un pivot ?

## Réponse provisoire (2026-10-12, en attente de la recherche sur les sources)

Position de cat : **paires directes uniquement**, pas de langue pivot. À confirmer une fois la recherche sur les sources fermée : vérifier quelles paires restent mal couvertes en direct (surtout entre langues secondaires) et si c'est acceptable.

### Note après la recherche (2026-10-13)

Un lien direct se lit dans les deux sens (une traduction fr→pt du Wiktionnaire fr sert aussi pt→fr). En sommant les deux directions par paire ([recherche](../../research/001-sources-libres.md), tableau des éditions non anglaises), les paires **vraiment maigres en direct** sont es↔it (~27 k items), es↔pt (~34 k) et it↔pt (~23 k) — à comparer à ~90–130 k pour fr↔de/it/es et 200 k+ pour en↔X. fr↔pt, de↔pt, it↔de restent moyennes (~48–74 k). À trancher : la position « direct uniquement » tient-elle avec ces trois paires maigres ?

## Résolution (2026-10-13)

Trois types de liens, deux niveaux visuels.

- **Liens fermes** (style normal, non distingués à l'écran ; la provenance reste dans les données) :
  1. **Lien direct**, lu dans les deux sens (une traduction fr→pt sert aussi pt→fr).
  2. **Frères de sens** : deux traductions listées sous **le même sens glosé d'une même entrée**, quelle que soit l'édition (ex. en:*work* « effort expended… » → es:*trabajo* et it:*lavoro*). Le sens sert d'ancre : aucun mot intermédiaire ambigu.
- **Pivot en chaîne** (3), **style visuel « flou »** :
  - **1 saut**, par **n'importe laquelle des 6 langues** ; chaque étape est un lien ferme (1 ou 2).
  - **Compteur de chemins** = nombre de mots intermédiaires distincts (langue + mot) ; sert à trier les résultats flous.
  - **En complément, toujours** : tout mot nouveau, absent de 1+2, est ajouté, même pour une langue bien couverte. Raison : en conversation, un mot même éloigné peut débloquer.
- **Réglage Config** : pivot en complément (défaut) / en repli seulement (si rien de ferme dans la langue) / désactivé. L'outil est exploratoire, ce choix doit rester révisable.

Conséquences : le modèle de données doit conserver le type de lien (1/2/3) et le nombre de chemins ; le placement des mots flous dans le tableau sens × langues (un pivot n'est rattaché à aucun sens source) revient à « Qu'est-ce qu'un « résultat » ».
