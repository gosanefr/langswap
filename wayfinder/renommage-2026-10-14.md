# Renommage en anglais (2026-10-14)

Tout le code est passé en anglais (identifiants, fichiers, SQL, JSON, messages ; commentaires et documents restent en français). Les tickets 001–013 et `research/` emploient les anciens noms ; correspondance des principaux :

| Avant | Après |
|---|---|
| `partage/`, `serveur/`, `donnees/`, `rapport/` | `shared/`, `server/`, `data/`, `reports/` |
| `cle.mjs` · `cle()` · `leger()` | `normalize.mjs` · `searchKey()` · `lightNormalize()` |
| `listes.mjs`, `constantes.mjs`, `historique.sql` | `lists.mjs`, `constants.mjs`, `history.sql` |
| `recherche.mjs` · `rechercher()` · `contexte()` · `apercu()` | `search.mjs` · `search()` · `createContext()` · `preview()` |
| `requetes.mjs` · `requetes-packs.mjs` · `historique.mjs` · `serveur.mjs` | `queries.mjs` · `pack-queries.mjs` · `history.mjs` · `server.mjs` |
| `telecharger`, `extraire`, `assembler`, `controler`, `nettoyage`, `tailles`, `commun` | `download`, `extract`, `assemble`, `check`, `cleanup`, `sizes`, `common` |
| tables `mot`, `entree`, `sens`, `traduction`, `forme`, `meta(cle, valeur)` | `word`, `entry`, `sense`, `translation`, `form`, `meta(name, value)` |
| colonnes `texte`, `mot_id`, `entree_id`, `sens_id`, `rang`, `glose`, `ancre`, `langues`, `genre` | `text`, `word_id`, `entry_id`, `sense_id`, `rank`, `gloss`, `anchor`, `langs`, `gender` |
| `forme(cle, forme_orig, couche = 'mot' \| 'flexion')` | `form(search_key, orig_form, layer = 'word' \| 'inflection')` |
| méta `plages_mots`, `construit_le`, `jeu_dumps`, `compteurs`, `couverture`, `taille_par_langue` | `word_ranges`, `built_at`, `dump_set`, `counters`, `coverage`, `size_by_lang` |
| historique `recherche(saisie, lemme, langues, horodatage)` | `search(input, lemma, langs, timestamp)` |
| requêtes `formes`, `sensDuMot`, `sensInverses`, `freres`, `voisinsLot`, `motsParIds` | `forms`, `wordSenses`, `inverseSenses`, `siblings`, `neighborsBatch`, `wordsByIds` |
| JSON `saisie`, `groupes`, `lignes`, `cases`, `proches`, `chemins`, `repli`, `etiquette` | `input`, `groups`, `rows`, `cells`, `near`, `paths`, `fallback`, `label` |
| routes `/api/recherche`, `/api/historique`, `/api/apercus` | `/api/search`, `/api/history`, `/api/previews` |
| `manifeste.json` · options `--jeu=`, `--sans-renommer` | `manifest.json` · `--set=`, `--no-rename` |
| `android/banc` · `Pont.kt` · packs `ponts-<l>` | `android/bench` · `Bridge.kt` · `bridges-<l>` (abandonnés depuis) |

Vérifié au renommage : base reconstruite identique table par table (≈ 15,9 M lignes), 680 recherches et 20 aperçus identiques.
