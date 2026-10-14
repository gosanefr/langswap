---
title: "Écran principal : changer de langue source/destination en un geste"
labels: [wayfinder:prototype]
parent: map
status: closed
assignee: cat
blocked_by: []
---

## Question

Comment l'écran principal (zone source, zone destination, menu Main/Historique/Config) permet-il de changer la langue source ou destination en un seul geste parmi les langues configurées (3 principales + jusqu'à 3 secondaires), et d'inverser source/destination ? Prototype d'UI rough à réagir.

## Résolution (2026-10-13)

Retenu : **variante E** du prototype : les rangées de pastilles de A, plus la détection de D, plus le mode « toutes » de C.

- **Source.** Une rangée de pastilles : `AUTO` | FR EN ES | DE IT PT. Les langues secondaires sont en retrait. Une langue choisie désactive AUTO.
- **AUTO.** Le mot est cherché dans toutes les langues configurées.
- **Repli automatique.** Si la source fixée ne donne rien, on bascule sur la détection, avec la mention « Rien en <langue> — trouvé ailleurs ».
- **Langue d'origine.** Les résultats détectés sont groupés par langue d'origine (« depuis Español »). On garde cette langue visible et on **ne fusionne pas** les groupes, même quand les sens se recoupent (ex. *casa* en es/it/pt).
- **Destination, deux modes** qu'un bouton fait basculer en un geste, **« toutes » par défaut** :
  - **1 langue** : rangée de pastilles de destination, résultats groupés par sens.
  - **toutes** : tableau avec les sens en lignes et les langues en colonnes. Toutes les colonnes de langue ont **la même largeur** et ce sont **les mêmes colonnes pour tous les groupes détectés** : un seul tableau, la colonne de la langue d'origine montre le mot cherché en grisé. Une case affiche aussi DE/IT/PT.
- **Inverser** : un bouton ⇅, désactivé en AUTO.
- **Clavier (Linux, pas de glyphes Apple)** : Alt+0 AUTO, Alt+1…6 source, Alt+Maj+1…6 destination, Alt+S inverser, Alt+M 1 langue / toutes. L'interface affiche « Alt+… ».
- **Menu bas** : Main / Historique / Config, inchangé.

Prototype (asset, jetable, ?variant=A…E) : [prototypes/ecran-langues/index.html](../../prototypes/ecran-langues/index.html)
