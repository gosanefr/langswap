---
title: "Stack du prototype : coquille native, langage et budget chiffré de « rapide »"
labels: [wayfinder:grilling]
parent: map
status: closed
assignee: cat
blocked_by: []
---

## Question

Avec quelle coquille native (petit serveur local + navigateur, Tauri, autre) et quel langage construit-on le prototype ? [Format de stockage et index](008-stockage-index.md) a déjà fixé un processus natif qui lit `langswap.sqlite` (lecture seule) et `historique.sqlite` (lecture-écriture). Il reste à choisir aussi en pensant au passage futur vers Android (réutilisation possible de la logique de requête ?). Que veut dire « rapide », en chiffres : latence cible d'une recherche (au regard du déclenchement à 250 ms de [Saisie](004-comportement-saisie.md)), temps de démarrage, et valeur du plafond de mots intermédiaires du pivot ?

## Résolution (2026-10-13)

1. **Coquille** : petit serveur local + onglet du navigateur. Ni Tauri (pas de Rust installé), ni Electron (trop lourd).
2. **Serveur** : Node 22 + `node:sqlite` intégré, **zéro dépendance** (pas de `npm install`). Il ouvre `langswap.sqlite` en lecture seule et `historique.sqlite` en lecture-écriture, sert l'interface et les routes, et n'écoute que sur `localhost`.
3. **Réutilisation Android** : on ne réutilise pas le code JS, mais le **schéma SQLite** et les **requêtes SQL**, isolées dans un module `requetes` en SQL pur.
4. **Interface** : HTML/CSS/JS en modules ES, servis tels quels, sans framework ni étape de build.
5. **Latence** (objectifs, « aussi rapide que possible ») :
   - requête serveur, pivot compris : < 50 ms au p95 ;
   - rendu : < 16 ms ;
   - ressenti total : ≈ 300 ms après la fin de la frappe (250 ms de déclenchement compris) ; une recherche par Entrée doit paraître immédiate ;
   - **plafond acceptable : 1 s ressentie**. Au-delà, on choisira alors comment s'adapter, sans le décider d'avance ;
   - une **liste fixe de mots tests** sert de banc de mesure : mots riches (*en:set*, *fr:faire*, *es:dar*…), mode AUTO, mode toutes destinations ;
   - une réponse périmée (la saisie a changé entre-temps) n'est jamais affichée.
6. **Démarrage** : lancement à la demande (commande `langswap` ou entrée `.desktop`), qui démarre le serveur et ouvre l'onglet, **prêt en < 1 s**, sans préchauffage. Si le serveur tourne déjà, on le réutilise. Pas de service systemd.
7. **Pivot** : plafond de **30 mots intermédiaires** (les plus riches en chemins d'abord), une constante réglable dans la config du serveur, validée par le banc de mesure.
