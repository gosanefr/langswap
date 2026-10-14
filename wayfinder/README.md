# Suivi local (tracker markdown)

Pas de dépôt git ni de tracker distant : la carte wayfinder vit ici.

## Opérations wayfinding

- **Cartes** (label `wayfinder:map`) : `map.md` (prototype web, spec complète et construite) et `map-android.md` (appli Android : route entièrement tracée le 2026-10-14, mise en œuvre à faire). Un ticket pointe sa carte par `parent: map` ou `parent: map-android`.
- **Noms** : le code est en anglais depuis le 2026-10-14 ; les tickets 001–013 emploient les anciens noms → [`renommage-2026-10-14.md`](renommage-2026-10-14.md).
- **Ticket** : un fichier `tickets/NNN-slug.md` ; l'id est `NNN`. Frontmatter :
  - `title`, `labels` (`wayfinder:research|prototype|grilling|task`), `parent: map`
  - `status: open|closed`
  - `assignee:` vide = non réclamé ; réclamer = y mettre son nom **avant** tout travail
  - `blocked_by: [NNN, …]` — blocage (pas de blocage natif, convention d'en-tête)
- **Frontière** : tickets `status: open`, `assignee` vide, dont tous les `blocked_by` sont `closed`.
- **Résolution** : ajouter une section `## Résolution` en fin de fichier, passer `status: closed`, ajouter une ligne dans « Decisions so far » de sa carte (et la retirer de « Not yet specified »).
- **Assets** : liés depuis le ticket (ex. `../../research/…`), jamais collés.
