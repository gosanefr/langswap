# Prototype : packs de langue téléchargeables (2026-10-13)

> **État (2026-10-14)** : prototype devenu l'appli Android. Décisions retenues : tickets [014](../../wayfinder/tickets/014-packs-de-langue.md), [015](../../wayfinder/tickets/015-coquille-android.md), [016](../../wayfinder/tickets/016-telechargement-packs.md). Les chiffres ci-dessous datent des essais (packs avec « bridges », abandonnés depuis) ; `split.mjs` est devenu `pipeline/packs.mjs`.

Noms (fichiers, tables, colonnes, fonctions) en anglais depuis le 2026-10-14 ; les mesures ci-dessous datent d'avant ce renommage, qui n'a rien changé aux résultats.

Question : peut-on découper `langswap.sqlite` en packs par langue, attachés à la volée, sans perdre en exactitude ni en vitesse ? Et que coûte un pack « bridges » (ponts) pour garder les frères de sens des langues non installées ?

```sh
node pipeline/packs.mjs [sortie] [source.sqlite]   # découpage 17 s + gzip, depuis data/langswap.sqlite vers data/packs par défaut
node prototypes/packs/bench.mjs <sortie> [source.sqlite]   # exactitude, banc de latence, qualité fr/en/es (--correctness-only : exactitude seule)
```

## Découpage

- `base` (toujours installé) : `meta` + `word` des 6 langues. Une traduction vers une langue absente garde son texte, donc le pivot peut passer par `de:Arbeit` sans le pack de.
- `pack-<L>` : `form`, `entry`, `sense`, `translation` des mots de L. Une ligne n'appartient qu'à un pack (vérifié : sommes = monolithe).
- `bridges-<L>` : pack partiel de L, sans formes : sens d'ancre vraie à ≥ 2 traductions, avec glose, leurs entrées et traductions. Installé seulement quand L ne l'est pas.
- Index de `shared/index.sql` par pack, sauf `word_lang_text` (aucune requête ne s'en sert, 28 Mo).

## Requêtes : pas de vues

Des vues TEMP `UNION ALL` sur les tables attachées donnent le bon résultat, mais les jointures à 3–4 tables matérialisent les vues avec index automatiques : **≈ 5 s** par requête `inverseSenses`, `siblings`, `neighbors`.

Une entrée, ses sens et leurs traductions sont toujours dans le même pack. `server/pack-queries.mjs` (d'abord ici, déplacé pour l'appli Android) exécute donc chaque requête pack par pack (jointures locales, index du pack), puis `UNION ALL`. Seul `base.word` est partagé. Les colonnes de sortie sont celles de `server/queries.mjs` : `search.mjs` est inchangé.

## Résultats (banc de `check`, machine de dev)

| Configuration | p50 | p95 |
|---|---|---|
| monolithe, 6 langues | 15 ms | 44 ms |
| 6 packs | 15 ms | 53 ms |
| monolithe, fr/en/es | 14 ms | 26 ms |
| 3 packs fr/en/es | 7 ms | 16 ms |
| 3 packs + bridges de/it/pt | 11 ms | 24 ms |

Exactitude, 6 packs vs monolithe sur les 20 mots tests : identiques au caractère près une fois les lignes des requêtes sans `ORDER BY` triées des deux côtés. Sans ce tri, l'ordre des ex aequo change. Au plafond de 30 intermédiaires du pivot, cela change aussi quels proches sortent. C'est déjà le cas d'un build à l'autre : départager par id dans `search.mjs` rendrait le résultat déterministe.

Qualité fr/en/es (900 mots : 600 au hasard de volume ≥ 3 + 100 plus riches par langue), en % du monolithe :

| | mots fermes | dont frères | proches (pivot) |
|---|---|---|---|
| 3 packs | 63 % | 33 % | 85 % |
| 3 packs + bridges de/it/pt | 100 % | 100 % | 99 % |

## Tailles (sur disque → zstd -19 --long=27)

| | disque | téléchargé |
|---|---|---|
| base | 30,6 Mo | 12,8 Mo |
| pack fr / en / es | 131,7 / 68,4 / 121,1 | 28,4 / 20,0 / 21,2 |
| pack de / it / pt | 237,4 / 118,9 / 36,2 | 40,9 / 21,6 / 9,2 |
| bridges fr / en / es | 9,2 / 36,7 / 5,2 | 3,1 / 11,3 / 1,7 |
| bridges de / it / pt | 24,7 / 5,6 / 1,7 | 7,6 / 1,9 / 0,5 |
| **fr+en+es+bridges de/it/pt** | **384 Mo** | **92 Mo** |
| 6 langues | 744 Mo | 154 Mo |

Décompression d'un pack (fr) : 0,2 s sur la machine de dev.

## Reste à vérifier

- Latence sur un vrai téléphone (SQLite embarqué, stockage flash), et premier accès à froid.
- Plafond de 10 bases attachées par défaut : base + 6 packs/bridges = 7, sans marge pour une 7e langue (`SQLITE_MAX_ATTACHED` monte à 125 en recompilant).

## Sur téléphone (Mi 9 SE, Android 11, 2026-10-13)

`android/bench/` rejoue les appels SQL que fait `search()` (enregistrés par `trace.mjs`, mêmes arguments, même ordre) avec SQLite embarqué (`androidx.sqlite:sqlite-bundled` 2.6.2) ; base et packs copiés dans le stockage interne de l'appli. **Temps SQL seul** : la logique JS de `search.mjs` et l'affichage s'ajoutent.

```sh
android/bench/run.sh <dossier_packs> <trace.json>   # installe, pousse ≈ 1,6 Go, lance, affiche files/results.txt
```

Banc (mots tests = les plus riches : set, faire, take…), passes 2–3, cache chaud :

| Configuration | p50 | p95 |
|---|---|---|
| monolithe, 6 langues | 49 ms | 131 ms |
| 6 packs | 51 ms | 159 ms |
| monolithe, fr/en/es | 48 ms | 85 ms |
| 3 packs | 24 ms | 51 ms |
| 3 packs + bridges | 40–43 ms | 76–84 ms |
| 3 packs + bridges, `mmap_size` 256 Mo + `cache_size` 16 Mo par fichier | **31 ms** | **58 ms** |

Échantillon de 300 mots fr/en/es ordinaires, 3 packs + bridges, réglages mmap/cache : p50 1,8 ms, p95 16 ms, max 31 ms.

Premier accès (fichiers hors du cache du système) : jusqu'à 1,5 s par mot riche en 6 langues, p95 ≈ 0,5 s pour 3 packs + bridges. Mesure approximative : sans root, impossible de vider le cache entre les configurations (l'ordre des configurations influence les chiffres de 1re passe et d'échantillon du premier lancement).

Lecture :
- Le découpage en packs n'est pas plus lent que le monolithe, à langues égales (fr/en/es : 3 packs + bridges 76 ms au p95 contre 85 ms pour le monolithe).
- Le téléphone est ≈ 2–3× plus lent que la machine de dev. Les 50 ms au p95 ne tiennent pas sur les mots les plus riches (58 ms avec mmap/cache) ; les mots ordinaires restent bien en dessous.
- À garder pour l'appli : `PRAGMA <schéma>.mmap_size` et `cache_size` sur chaque pack attaché.
- Premier accès à froid : jugé correct à l'usage, rien à construire ([018](../../wayfinder/tickets/018-performance-telephone.md)).

### `search.mjs` dans une WebView (même téléphone)

Mode `--es mode webview` de `android/bench` : `server/search.mjs`, `queries.mjs`, `shared/normalize.mjs`, `lists.mjs`, `constants.mjs` copiés tels quels dans les assets. Le SQL passe par un pont `@JavascriptInterface` synchrone vers SQLite embarqué (mmap/cache), qui rend les lignes en JSON avec les types de `node:sqlite`. WebView Chrome 154.

**Exactitude** : 315/315 résultats identiques au poste (empreinte SHA-1 du JSON), dans les 5 configurations.

3 packs + bridges, configuration lancée seule, 3 lancements (temps total par recherche : JS + pont + SQL) :

| | p50 | p95 | dont natif (SQL + JSON Kotlin), p50 / p95 |
|---|---|---|---|
| banc (mots riches), passes 2–3 | 69–81 ms | 141–143 ms | 38–41 / 76–77 ms |
| 300 mots ordinaires | 7,0–7,4 ms | 40–46 ms | 3,1–3,2 / 21–22 ms |
| monolithe fr/en/es, pour comparaison : banc | 66 ms | 131 ms | 38 / 68 ms |

Où passe le temps (mot riche, p50 ≈ 70 ms) :
- SQL ≈ 30 ms (mesuré en natif seul) ;
- sérialisation JSON côté Kotlin ≈ 9 ms ;
- pont : ≈ 0,2 ms par aller-retour à vide × ≈ 70 appels par recherche ≈ 14 ms (la plupart : `neighbors`, un appel par intermédiaire du pivot) ;
- logique JS + `JSON.parse` ≈ 15 ms.

Pistes :
- `neighbors` par lots (tous les intermédiaires en un appel) : ≈ 70 → ≈ 15 appels par recherche. Change aussi `search.mjs` sur le poste.
- Porter `search.mjs` en Kotlin : plus de pont ni de JSON par requête. Estimation ≈ SQL + quelques ms, soit ≈ 35–40 ms au p50 sur mot riche. Mais deux implémentations à garder identiques.

Attention : enchaîner les 5 configurations dans un même lancement dégrade nettement les chiffres (jusqu'à ×3, passes 2–3 plus lentes que la 1re), sans alerte thermique. Les chiffres ci-dessus viennent de lancements séparés par une pause.

### `neighbors` par lot (2026-10-14)

`server/queries.mjs` : `neighbors` (un id) remplacé par `neighborsBatch` (liste JSON d'ids → lignes `(source, id)`). `search.mjs` charge en un appel tous les intermédiaires absents du mémo. `CROSS JOIN` garde la liste en boucle externe, donc les lignes d'une même source sortent dans le même ordre qu'avant. `check.mjs` suit.

- **Résultats inchangés** : empreintes identiques à la trace d'avant, dans les 5 configurations (20/20, 315/315 ×3) ; `node --test` : 6/6.
- **Appels SQL** sur le banc fr/en/es : ≈ 70 → 20 par recherche.

Téléphone, 3 packs + bridges dans la WebView, 2 lancements :

| | p50 | p95 | dont natif p50 / p95 |
|---|---|---|---|
| mots riches, passes 2–3 | 57 ms (avant 69–81) | 106 ms (avant 141–143) | 38–39 / 69–71 ms |
| 300 mots ordinaires | 5,4–5,7 ms (avant 7,0–7,4) | 29–31 ms (avant 40–46) | 2,7–2,9 / 19 ms |
| monolithe fr/en/es, mots riches | 59 ms | 111 ms | 42 / 73 ms |

Le rejeu natif seul paraît plus lent (p50 43 ms, p95 75 ms contre 31/58) : ce banc lit chaque colonne en texte, et le lot rend 2 colonnes par ligne. La part native mesurée dans la WebView (lecture typée + JSON) n'a pas augmenté.

Poste : avec les réglages SQLite par défaut, le lot est 10–20 % plus lent que l'ancien appel par id (A/B dans le même processus). Chaque branche de l'union parcourt tous les ids avant la suivante, et le cache de 2 Mo ne garde plus les pages d'un même mot. Avec `mmap_size` 256 Mo + `cache_size` 16 Mo, l'écart tombe à 1–8 %. Ces deux réglages accélèrent aussi le poste d'environ 40 % (6 langues, p95 56 → 34 ms) : ajoutés depuis dans `server/server.mjs` et `pipeline/check.mjs` (`SQLITE_PRAGMAS`, `shared/constants.mjs`).

## Décision (2026-10-14) : pas de packs « bridges »

Retirés de l'appli et du pipeline. Leurs lignes (sens inverses venant d'une langue non installée) affichaient des gloses et des mots d'origine hors des langues choisies (« de · Arbeit », glose allemande) : perçues comme du bruit. Coût accepté, d'après les mesures ci-dessus : 3 packs seuls = 63 % des mots fermes et 33 % des frères du monolithe (contre 100 % avec les ponts) ; gain : 32 Mo sur l'appareil, 14 Mo de téléchargement. `server/pack-queries.mjs` ne prend plus de packs « bridges » ; les configurations `+ bridges` ont été retirées de `bench.mjs` et `trace.mjs`.

Même jour : le pivot ne passe plus que par les langues de la recherche (`server/search.mjs`, `near()` : intermédiaires filtrés sur les langues configurées sur le poste, installées sur Android ; la langue source en fait toujours partie). Plus aucun « via de:Arbeit » hors du choix. Avec les 6 langues configurées, résultats identiques ; en fr/en/es, 86 % des proches gardés.
