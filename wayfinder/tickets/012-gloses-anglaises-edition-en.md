---
title: "Entrées étrangères de l'édition en : leurs gloses anglaises deviennent-elles des liens X→en ?"
labels: [wayfinder:grilling]
parent: map
status: closed
assignee: cat
blocked_by: [011]
---

## Question

L'édition anglaise du Wiktionary contient des entrées fr/es/de/it/pt dont les sens sont rédigés comme des gloses anglaises (« fr:*travail* — work; job »). Faut-il les transformer en **liens fermes X→en** (traductions directes, donc frères et pivot possibles), les garder comme **simples gloses** de sens, ou les ignorer ? Et comment les concilier avec les entrées natives des éditions fr/es/… pour le même mot, sans doublonner les sens du tableau de [Résultat](003-modele-resultat.md) ?

## Résolution (2026-10-13)

Constat sur des entrées réelles (kaikki : fr:travail, es:trabajo, de:Arbeit) : ces entrées n'ont **pas de bloc `translations`**. Les équivalents anglais ne sont que dans le texte des gloses et leurs `links`, eux-mêmes mêlés d'étiquettes de domaine (`physics`), de mots de définition et de renvois `#German`.

1. **Rôle : liens fermes X→en.** Ce sont des liens directs, donc étapes de pivot possibles et mots rendus cherchables. Chaque entrée devient une seconde `entree` du mot, avec `édition = en` et ses propres `sens`.
2. **Extraction** (étape `assembler`) :
   - les sens `form_of` sont ignorés ;
   - la glose est découpée sur `,` et `;` ; chaque élément est nettoyé (parenthèses, `to ` initial, `a`/`an`/`the` initiaux) ;
   - un élément est gardé s'il correspond **entièrement** au texte d'un `link` vers une page anglaise simple (pas de `#Langue`), avec 3 mots au plus ;
   - **extraction partielle permise** : un sens est gardé dès qu'il donne au moins un mot ; sa glose complète reste affichée ; l'ordre des `traduction` suit la glose ;
   - exemples : travail → work, labor / job / workplace ; trabajo → work, job / work / (« school assignment… » écarté) ; Arbeit sens 1 → toil, labor, job, employment, occupation.
3. **`ancre = faux`** pour tous ces sens. Il n'y a pas de frères en↔en (work ↔ labor), donc pas de pivot par synonyme anglais. Le lien direct et les sens inverses ne changent pas.
4. **Tableau** (complète [Résultat](003-modele-resultat.md)) :
   - ces lignes viennent après les sens de l'entrée de l'édition native et avant les sens inverses, avec l'étiquette `en ·` ;
   - **masquage à la requête** : une ligne est masquée si tous ses mots en figurent déjà dans la colonne en d'une autre ligne du même groupe POS. Ce n'est pas une fusion, juste le masquage d'une ligne strictement redondante ;
   - la POS est celle de l'entrée en ; pour l'ordre des groupes, l'entrée de l'édition native passe en premier, l'entrée en ensuite.
5. **Formes** : les `forme` de l'édition native et celles de l'édition en (entrées `form_of`, tables `forms[]`) sont réunies, avec dédoublonnage sur (`cle`, `mot_id`, `couche`).
6. **`mot.volume`** compte les paires de liens **distinctes**, car un même lien peut être donné à la fois par en:work et par l'entrée en de fr:travail.
