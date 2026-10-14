---
title: "Historique : ce qu'on garde et comment on le rouvre"
labels: [wayfinder:grilling]
parent: map
status: closed
assignee: cat
blocked_by: []
---

## Question

Que retient l'historique pour chaque recherche (mot, paire de langues, premiers équivalents obtenus, date ?), combien d'entrées, dédoublonnage, et que se passe-t-il quand on rouvre une entrée (relance la recherche, restaure la paire de langues) ?

### Contrainte reçue (2026-10-13)

Depuis [Qu'est-ce qu'un « résultat »](003-modele-resultat.md) : un double-clic sur un mot du résultat (ou Alt+Entrée) lance une nouvelle recherche (« rebond »). Décider si un rebond crée une entrée d'historique et s'il garde un lien vers la recherche d'où il vient.

### Contrainte reçue (2026-10-13)

Depuis [Que doit retrouver la saisie](004-comportement-saisie.md) : la recherche part en direct, 250 ms après la dernière frappe. Les mots partiels et les étapes intermédiaires de la frappe ne doivent pas encombrer l'historique : décider ce qui crée une entrée (Entrée, copie, délai d'inactivité, rebond…). Décider aussi si l'entrée garde le mot tapé (*travaillé*) ou le lemme trouvé (*travailler*).

## Résolution (2026-10-13)

L'historique est un **journal chronologique** qui sert à retrouver le fil d'une conversation.

1. **Création d'une entrée** : Entrée, copie d'un mot, rebond, ou résultat affiché **2 s sans frappe**. Une recherche sans résultat (résultat précédent grisé, état vide) n'en crée jamais.
2. **Pas de dédoublonnage** : un mot qui revient crée une nouvelle entrée. Exception : une entrée créée **uniquement par le délai** est **remplacée** si la saisie la prolonge ou la corrige (même saisie, champ non vidé) dans les **10 s** ; une entrée confirmée par Entrée, copie ou rebond n'est jamais remplacée.
3. **Contenu stocké** : mot tapé (*travaillé*), lemme ou entrée trouvée (*travailler*), **langue(s) d'origine**, horodatage, id de l'entrée parente pour un rebond. Pas de réglages, pas de déclencheur, pas de mot copié, pas de copie des résultats.
   - Une seule langue trouvée (source fixée, repli, rebond, AUTO à un seul groupe) → cette langue.
   - AUTO avec plusieurs groupes (*casa* es/it/pt) → la liste des langues ; le lemme affiché est celui du premier groupe.
4. **Ligne de la liste** : heure · mot tapé (« → *travailler* » s'il diffère) · pastille(s) de langue · 2–3 premiers équivalents fermes en grisé, **recalculés** à l'affichage. Groupes par jour (« Aujourd'hui », « Hier », date).
5. **Réouverture** (clic ou Entrée sur une entrée) : **relance la recherche**, sans créer d'entrée. Le champ reçoit le mot tapé ; la source est fixée sur la langue d'origine, ou AUTO si plusieurs langues ; destination et mode restent ceux de l'écran actuel ; bascule sur Main. Un mot disparu d'un futur dictionnaire : cas ignoré.
6. **Rebond** : crée une entrée liée à son parent, affichée « ↳ depuis *travail* », en retrait sous le parent quand elle le suit directement, sinon à sa place chronologique avec la seule mention.
7. **Pas de plafond** (nombre ni âge) ; les jours se chargent au défilement.
8. **Gestion** : supprimer une entrée (croix au survol / Suppr, sans confirmation) ; « Tout effacer » dans **Config**, avec confirmation dans la page (pas de boîte de dialogue navigateur) ; **filtre** en haut de l'Historique, sous-chaîne sur mot tapé ou lemme, même normalisation que la saisie. Pas de pause / mode privé, pas d'export.
9. **Clavier** : Alt+H ouvre l'Historique (focus dans le filtre) ; ↑/↓ parcourir, Entrée relancer, Suppr supprimer.

Conséquence : l'historique est un petit stockage **en lecture-écriture, séparé** du dictionnaire (en lecture seule) — à prendre en compte dans le choix de la stack.
