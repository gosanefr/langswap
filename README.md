# LangSwap

Traduction mot à mot entre fr/en/es (principales) et de/it/pt (secondaires), **hors ligne**, à partir de Wiktionary (wiktextract, 6 éditions). Deux formes : le **prototype web** local (poste) et l'**appli Android** (même interface et même recherche dans une WebView, dictionnaire téléchargé par langue).

- Spec du prototype : [`wayfinder/map.md`](wayfinder/map.md) (complète, construite). Appli Android : [`wayfinder/map-android.md`](wayfinder/map-android.md) — décisions prises et **questions ouvertes** (là où reprendre).
- Poste : Node 22 + `node:sqlite`, **zéro dépendance**, aucun `npm install`. Interface HTML/CSS/JS servie telle quelle.

## Utilisation

```sh
bin/install            # une fois : commande ~/.local/bin/langswap + entrée de menu .desktop
langswap               # démarre le serveur s'il ne tourne pas (≈ 80 ms) et ouvre http://localhost:4765/
langswap stop
langswap packs         # packs de langue de l'appli Android (data/packs : .sqlite.xz + packs.json + LICENSE-DATA.md)
langswap serve-packs   # sert data/packs sur le réseau local (port 4766) pour le téléchargement depuis l'appli
langswap publish-packs --dry-run   # puis sans --dry-run : release GitHub packs-<build> + packs/packs.json (commit + push)
langswap release 1.0.0 --dry-run   # appli Android : APK/AAB signés, vérification reproductible, puis tag + release GitHub
```

Raccourcis : Alt+0 AUTO · Alt+1…6 source · Alt+Maj+1…6 destination · Alt+S inverser · Alt+M 1 langue / toutes · Alt+H historique.
Sur un mot : clic / Entrée = copier ; double-clic / Alt+Entrée = chercher ce mot.

## Construire la base

```sh
langswap update          # telecharger (nouveau jeu dans dumps/AAAA-MM-JJ/) puis construire
langswap build           # extraire → assembler → controler, sur le jeu épinglé le plus récent (jamais le réseau)
```

| Étape | Fichier | Rôle | Mesuré (2026-10-13) |
|---|---|---|---|
| `download` | `pipeline/download.mjs` | 6 dumps kaikki → `dumps/AAAA-MM-JJ/` + `manifest.json` (sha256) ; garde 2 jeux ; `--wikdict` épingle WikDict | 4,2 Go |
| `extract` | `pipeline/extract.mjs` | lecture en flux, filtre 6 langues + champs utiles, aucune règle → `cache/<sha256>.jsonl.gz` (réutilisé) | 2,9 min |
| `assemble` | `pipeline/assemble.mjs` | règles 012/013, `word`/`entry`/`sense`/`translation`/`form`, agrégats, index → `data/langswap.sqlite.tmp` | 3,2–4 min, 802 Mo |
| (dans `assemble`) | `pipeline/sizes.mjs` | taille approximative par langue (`meta.size_by_lang`, affichée dans Config) ; lançable seul sur une base existante | 14 s |
| `check` | `pipeline/check.mjs` | `reports/AAAA-MM-JJ.md` (couverture vs WikDict, écart au build précédent, santé, banc, gloses fréquentes) ; renomme en `langswap.sqlite` si rien ne bloque | 24 s |

Options : `--set=AAAA-MM-JJ` (extract/assemble), `--force` (extract), `--no-rename` (check). Le serveur doit être relancé pour voir une nouvelle base (`langswap build` le fait). Les packs Android ne sont pas refaits par `build` : lancer `langswap packs` ensuite (≈ 2 min).

| Hors `build` | Fichier | Rôle | Mesuré (2026-10-14) |
|---|---|---|---|
| `packs` | `pipeline/packs.mjs` | `base` (méta + mots des 6 langues) + `pack-<l>` par langue, xz -9e, `packs.json` (build, tailles, sha256, licence) + `LICENSE-DATA.md` → `data/packs/` | ≈ 4 min ; fr/en/es ≈ 66 Mo à télécharger |
| `publish-packs` | `pipeline/publish-packs.mjs` | vérifie `data/packs`, crée la release GitHub `packs-<build>` (jamais « latest »), écrit `packs/packs.json` (URL absolues) puis commit + push : c'est ce push qui fait passer l'appli au nouveau build. `--dry-run` d'abord | jeton gh du compte `gosanefr` |

## Organisation

- `shared/` — code commun build + serveur : `normalize.mjs` (normalisation, seule définition, aussi servie au navigateur), `lists.mjs` (listes fermées : placeholders, genres, régions ISO 3166, dialectes, pays), `constants.mjs` (langues, plafonds, réglages SQLite, mots tests ; sans import, chargeable hors de Node), `config.mjs` (chemins et port, Node seulement), `schema.sql` / `index.sql` / `history.sql`.
- `server/` — `queries.mjs` (**tout le SQL**), `pack-queries.mjs` (le même SQL pour les packs de langue de l'appli Android), `search.mjs` (construction du résultat : groupes, sens natifs/inverses, pivot), `history.mjs`, `server.mjs` (HTTP, localhost seulement).
- `web/` — interface (aussi embarquée telle quelle dans l'appli Android).
- `pipeline/` — construction de la base (`download` → `extract` → `assemble` → `check`) et des packs (`packs`).
- `data/` — `langswap.sqlite` (lecture seule), `history.sqlite` (lecture-écriture), `packs/` (packs Android). `reports/` — rapports de `check`.
- `bin/` — `langswap` (commande), `install` (commande + entrée de menu).
- `fastlane/metadata/android/` — fiches Play / F-Droid (en/fr/es) ; `PRIVACY.md` — politique de confidentialité de l'appli.
- `packs/packs.json` — manifeste des packs publiés, lu par l'appli (écrit par `publish-packs`, jamais à la main).
- `tests/` — `node --test tests/*.test.mjs`.
- `android/langswap/` — appli Android : l'interface `web/` dans une WebView, `server/search.mjs` tel quel, routes `/api/*` servies dans la page (`web/api.mjs`), SQLite embarqué via un pont Kotlin (`Bridge.kt`), packs de langue téléchargés depuis Config (`Packs.kt`). Construction, installation, débogage : [`android/langswap/README.md`](android/langswap/README.md).
- `android/bench/` — banc de mesure sur téléphone (rejeu SQL, WebView) ; `prototypes/packs/` — bancs et mesures des packs (`README.md`).

## Conventions

- **Code en anglais** (identifiants, fichiers, SQL, JSON, messages, rapport de `check`) ; **commentaires et documents en français**. Les tickets 001–013 emploient les anciens noms français : [correspondance](wayfinder/renommage-2026-10-14.md).
- **Une seule source** pour ce qui est partagé : `web/`, `server/search.mjs`, `queries.mjs`, `pack-queries.mjs` et `shared/*.mjs` sont copiés tels quels dans l'APK au build ; `shared/constants.mjs` n'importe rien (chargeable dans la WebView), `shared/config.mjs` est réservé à Node. `pack-queries.mjs` doit rester aligné sur `queries.mjs` (mêmes colonnes, mêmes ordres de lignes).
- Vérifier un changement de recherche : `node --test tests/*.test.mjs`, le banc de `check`, et `prototypes/packs/bench.mjs` (monolithe contre packs).

## Choix d'implémentation (non tranchés par la spec)

- **Ids de mots contigus par langue** (`meta.word_ranges`) : le pivot connaît la langue d'un voisin sans jointure, ce qui a ramené le p95 du banc sous 50 ms.
- **Intermédiaires du pivot** : les 30 voisins fermes reliés au mot par le plus de chemins (lien direct + sens partagés) d'abord, **seulement dans les langues de la recherche** (langues configurées, plus la langue source) : jamais « via » une langue décochée (2026-10-14). Voisins chargés par lot (`neighborsBatch`, une requête pour tous les intermédiaires).
- **Réglages SQLite** (`SQLITE_PRAGMAS` : mmap 256 Mo + cache 16 Mo) : ≈ 40 % plus rapide que les réglages par défaut ; appliqués par le serveur et par le banc de `check`.
- **`word.volume`** = liens directs distincts + appartenances aux sens d'ancre vraie (approximation linéaire des paires de frères, qui seraient quadratiques).
- **Sens inverses sans glose** (blocs « sans sens précis » d'autres entrées) : leur mot d'origine rejoint la ligne « sans sens précis » de la POS, puisque seul le lien direct compte.
- **Mot partiel sans résultat** : le résultat précédent reste grisé ; sur Entrée, l'état vide explicite s'affiche.
- **Alt+Maj+n en mode « toutes »** passe en mode 1 langue sur cette destination.
- Garde-fou : 12 groupes de correspondances au plus par recherche (« N autres correspondances »).
- Réglages de l'interface (langues secondaires, pivot, mode, langue de l'interface) : `localStorage` du navigateur.
- **Langue de l'interface** (fr, en, es ; textes dans `web/i18n.js`) : boutons FR EN ES dans la barre du bas, à côté des icônes de page (accueil, historique, réglages) ; sinon la première de fr/en/es dans les langues du navigateur, sinon fr. Gloses et mots ne sont jamais traduits.
- **Écran tactile sans survol** (`hover: none`) : pastilles et aides `Alt+…` masquées ; écran étroit : placeholder plus petit. Bouton « effacer » dans le champ de saisie.
- **Panneau des packs** (Config) : affiché seulement si `/api/config` renvoie `packs: true`, c'est-à-dire dans l'appli Android.

## Licences

- **Code** : [GPL-3.0-or-later](LICENSE).
- **Données** (base et packs de langue) : dérivées du [Wiktionnaire](https://wiktionary.org), © ses contributeurs, sous [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) ; extraites par [wiktextract](https://github.com/tatuylonen/wiktextract) ([kaikki.org](https://kaikki.org)), puis filtrées et restructurées par ce pipeline. Chaque release `packs-<build>` contient son `LICENSE-DATA.md`.
