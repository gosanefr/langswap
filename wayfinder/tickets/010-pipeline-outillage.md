---
title: "Pipeline de build : langage, outillage, reproductibilité et mise à jour des dumps"
labels: [wayfinder:grilling]
parent: map
status: closed
assignee: cat
blocked_by: []
---

## Question

Comment construit-on `langswap.sqlite` (schéma de [Format de stockage et index](008-stockage-index.md)) à partir des 6 éditions wiktextract ([WikDict ou wiktextract ?](007-wikdict-ou-wiktextract.md)) ? Il faut trancher :
- le langage du pipeline : Node sans dépendance comme le serveur ([Stack du prototype](009-stack-prototype.md)) ou Python ;
- d'où viennent les dumps : JSONL kaikki.org déjà extraits, ou lancer wiktextract soi-même ;
- comment épingler la version d'un dump pour garantir la reproductibilité, et comment le mettre à jour ;
- les étapes et leur ordre (import, normalisation des formes, calcul de `volume`, `langues` et des rangs) ;
- le temps et l'espace disque acceptables pour un build ;
- comment le contrôle de couverture par paire contre WikDict s'exécute et ce qu'il rapporte.

## Résolution (2026-10-13)

1. **Dumps** : JSONL déjà extraits de kaikki.org ([rawdata](https://kaikki.org/dictionary/rawdata.html)), pas de wiktextract lancé soi-même. Passer à un wiktextract local plus tard ne changerait rien en aval (même format).
2. **Langage** : Node 22 sans dépendance, comme le serveur. La normalisation `forme.cle` est **un seul module partagé** entre build et serveur, pour éviter toute divergence (Unicode, `NFD`…).
3. **Reproductibilité et mise à jour** :
   - chaque téléchargement va dans `dumps/AAAA-MM-JJ/` (les 6 `.gz` + `manifeste.json` : URL, date serveur, taille, sha256), car kaikki ne garantit pas de pouvoir re-télécharger une ancienne version ;
   - le build ne lit **qu'un dossier épinglé**, jamais le réseau ;
   - `langswap.sqlite` porte une table `meta` (date et sha256 des dumps, version du pipeline), affichable dans Config ;
   - mise à jour par **commande explicite**, jamais automatique ; l'ancienne base n'est remplacée qu'après contrôles ;
   - rétention : le jeu courant + le précédent.
4. **Commandes et étapes** :
   - `telecharger` → `dumps/AAAA-MM-JJ/` ;
   - `extraire` (lent, une édition par processus, en parallèle) : lecture en flux, filtre sur les 6 langues (entrées et cibles de traduction) et sur les champs utiles (mot, POS, sens/gloses, `forms`, traductions avec `sense_index`, genre, région), **aucune règle de nettoyage**. Sortie `cache/<sha256>.jsonl.gz`, réutilisée tant que le dump ne change pas ;
   - `assembler` (rapide, rejoué à chaque retouche de règle), dans cet ordre :
     1. nettoyage des traductions (règles à venir, voir [Bruit d'extraction](011-bruit-extraction.md)) ;
     2. `mot` dédoublonnés par table en mémoire (langue + texte → id entier), puis `entree`, `sens`, `traduction` ;
     3. résolution des `sense_index` (les orphelins vont dans « sans sens précis », `ancre = faux`) ;
     4. `forme` : lemme (couche `mot`) + `forms` (couche `flexion`), `cle` par le module partagé ;
     5. agrégats `mot.volume`, `sens.langues`, rangs (ordre de la source), suppression des mots sans lien ferme ;
     6. index créés **en fin de chargement** (insertion en vrac, une transaction), `ANALYZE`, `VACUUM`, `meta` ;
     7. écriture dans `langswap.sqlite.tmp` ;
   - `controler` (point 6), puis renommage en `langswap.sqlite` seulement si rien ne bloque.
5. **Budgets** (un dépassement donne une alerte, pas un échec) :
   - `assembler` : < 5 min, plafond 15 min ;
   - `extraire` : ≈ 1 h, 6 éditions en parallèle ;
   - disque : ≈ 20 Go au total (2 jeux de dumps, cache, base + `.tmp`) ; jamais de décompression sur le disque ; `telecharger` refuse de partir s'il reste moins de 2× la taille attendue ;
   - taille de `langswap.sqlite` : mesurée et inscrite dans `meta`, sans plafond.
6. **Contrôle** :
   - WikDict (15 bases de paires) est épinglé une fois dans `dumps/wikdict-AAAA-MM-JJ/` ;
   - `controler` écrit `rapport/AAAA-MM-JJ.md` avec :
     - par paire orientée (30) : les mots source traduits chez nous et chez WikDict, la part des paires WikDict `is_good` retrouvées en lien ferme direct, et la même part via pivot à 1 saut ;
     - 20 exemples de manques par paire (graine fixe) ;
     - l'écart avec le build précédent ;
     - des compteurs de santé (traductions rejetées, `sense_index` orphelins, mots supprimés) ;
     - le banc des mots tests ([Stack](009-stack-prototype.md)) ;
   - **blocage du remplacement** si :
     - une paire perd plus de 10 % de couverture par rapport au **build précédent** (jamais par rapport à WikDict : l'écart avec WikDict est structurel, puisque WikDict inclut du pivot) ;
     - une table est vide ;
     - un mot test dépasse 1 s.
   - Au premier build, seul le banc bloque, et le rapport est lu à la main.
