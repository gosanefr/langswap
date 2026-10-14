---
title: LangSwap — spec du prototype web
labels: [wayfinder:map]
---

## Destination

Une spec du prototype web LangSwap (usage local sur ordi), assez précise pour le construire sans plus rien trancher : sources de traduction libres retenues et leur organisation en données locales préparées, interface de recherche, historique. Langues : fr/en/es (principales), de/it/pt (secondaires).

## Notes

- **État (2026-10-14)** : spec complète, prototype construit et en usage (voir le [README du dépôt](../README.md)). La suite (appli Android) se poursuit sur [`map-android.md`](map-android.md). Le code a été renommé en anglais : [correspondance des noms](renommage-2026-10-14.md) pour lire les tickets ci-dessous.

- Idée d'origine : `~/Documents/Obsidian/Perso/LangSwap.md`.
- Contraintes : rapide, idéalement léger, interface sobre mais pas trop basique.
- Données **locales préparées uniquement** — aucune API en ligne.
- Un mot doit donner **plusieurs équivalents** (polysémie de la cible : en:work → travail / œuvre / fonctionne ; ambiguïté de la source : en:job → travail / métier).
- Langues secondaires (de/it/pt) : couverture moindre acceptable.
- Skills : `/grilling` + `/domain-modeling` par défaut ; `/research` pour les recherches ; `/prototype` pour l'écran.
- Tracker : markdown local, voir `README.md`.

## Decisions so far

<!-- une ligne par ticket fermé -->
- [Quelles sources libres couvrent les paires fr/en/es/de/it/pt avec plusieurs sens ?](tickets/001-sources-libres.md) — Wiktionary via wiktextract (édition en + 5 éditions natives) comme source canonique, WikDict SQLite comme raccourci/pivot ; licence CC BY-SA sur la base dérivée.
- [Écran principal : changer de langue source/destination en un geste](tickets/005-ecran-langues.md) — pastilles source (avec AUTO + repli détection, groupes par langue d'origine non fusionnés) et destination, bascule 1 langue / toutes (colonnes égales), raccourcis Alt.
- [Paires de langues directes ou passage par une langue pivot ?](tickets/002-pivot-ou-direct.md) — liens fermes = directs + frères de sens (même sens glosé) ; pivot en chaîne à 1 saut via les 6 langues, style flou, trié par nombre de chemins, en complément par défaut (réglable).
- [Qu'est-ce qu'un « résultat » : sens, gloses, catégorie, ordre](tickets/003-modele-resultat.md) — tableau de sens glosés (natifs puis inverses, sans fusion) groupés par POS, ligne « sans sens précis », ligne finale « Proches (via pivot) » avec chemins au survol ; plafonds 5/6 ; genre seul ; clic copie, double-clic relance.
- [Que doit retrouver la saisie : formes fléchies, accents, préfixe, fautes](tickets/004-comportement-saisie.md) — forme → lemme (mention « forme de »), entrée exacte puis formes ; insensible aux accents/casse avec exact en tête ; trait d'union ≡ espace, expressions de plusieurs mots ; recherche en direct après 250 ms ; ni préfixe ni fautes.
- [Historique : ce qu'on garde et comment on le rouvre](tickets/006-historique.md) — journal chronologique sans dédoublonnage (Entrée, copie, rebond ou 2 s d'inactivité) ; mot tapé + lemme + langue(s) + date + lien de rebond ; la réouverture relance la recherche ; pas de plafond, filtre et suppression.
- [Données du prototype : WikDict tel quel ou pipeline wiktextract ?](tickets/007-wikdict-ou-wiktextract.md) — wiktextract seul, 6 éditions ; WikDict seulement en contrôle au build ; traductions sans sens = liens directs, pas frères ; ancre de frère = même entrée + même glose ou `sense_index`.
- [Format de stockage et index de recherche](tickets/008-stockage-index.md) — natif + SQLite, un fichier dictionnaire (6 langues) + un fichier historique (en texte) ; nœud = mot ; tables mot/entree/sens/traduction/forme, liens et frères non matérialisés, pivot à la volée avec plafond ; mots présents seulement comme cible de traduction aussi cherchables.
- [Stack du prototype : coquille native, langage et budget chiffré de « rapide »](tickets/009-stack-prototype.md) — serveur local Node 22 + `node:sqlite` sans dépendance + onglet navigateur, interface HTML/JS sans framework ni build ; SQL isolé pour Android ; objectif ≈ 300 ms ressenti (plafond 1 s) mesuré sur une liste de mots tests ; lancement à la demande prêt en < 1 s ; plafond pivot 30 intermédiaires.
- [Pipeline de build : langage, outillage, reproductibilité et mise à jour des dumps](tickets/010-pipeline-outillage.md) — dumps kaikki copiés en dossiers datés (manifeste sha256, 2 jeux gardés) ; Node sans dépendance avec `cle` partagée ; `telecharger` → `extraire` (filtre 6 langues, mis en cache) → `assembler` (< 5 min) → `controler` (rapport par paire contre WikDict, blocage si une paire perd plus de 10 % par rapport au build précédent ou si un mot test dépasse 1 s) ; ≈ 20 Go de disque.
- [Quel bruit d'extraction et quels sense_index orphelins dans les 6 éditions wiktextract ?](tickets/011-bruit-extraction.md) — bruit textuel ≈ 0,2–0,5 % des traductions (≈ 2 % en de), régions/vides/non-latin marginaux ; vrai enjeu structurel : copie des traductions sur toutes les POS de la page (it 27 %, es 12 %), placeholders de sens (`Translations`, `sdü`, « à trier ») ; `sense_index` orphelins 0,03–0,4 %, es à valider au niveau page (17 % → 0,8 %).
- [Entrées étrangères de l'édition en : leurs gloses anglaises deviennent-elles des liens X→en ?](tickets/012-gloses-anglaises-edition-en.md) — oui, liens fermes X→en extraits des gloses (éléments ≤ 3 mots = un `link` anglais, extraction partielle) ; `ancre = faux` ; lignes `en ·` entre sens natifs et inverses, masquées si redondantes ; union des formes ; volume en paires distinctes.
- [Règles de nettoyage et de rattachement aux sens de l'étape assembler](tickets/013-regles-nettoyage.md) — une copie par page (numéro → libellé POS → 1ʳᵉ entrée non `form_of`) ; placeholders = sans sens précis, domaines it gardés ; multi-ancrage des plages, reparse pt ; règles de rejet/correction/découpage du texte ; région via table fermée ISO 3166.

## Not yet specified

<!-- vide : la spec est complète. Le plan de construction (routes et format des réponses, découpage du module `requetes`, liste de mots tests) relève de l'implémentation, pas d'une décision. -->

## Out of scope

- Application Android : effort séparé, ouvert le 2026-10-13 → [`map-android.md`](map-android.md).
- API de traduction en ligne, y compris en secours.
- Hébergement, usage mobile, PWA hors-ligne.
- Langues au-delà des 6.
- Attribution / conformité CC BY-SA pour redistribuer la base dérivée — le prototype reste local ; traitée avec Android : [017](tickets/017-hebergement-licence.md).
- Complétion par préfixe et tolérance aux fautes de frappe : décidé dans [Que doit retrouver la saisie](tickets/004-comportement-saisie.md), le prototype fait une correspondance exacte normalisée et affiche un état vide explicite.
