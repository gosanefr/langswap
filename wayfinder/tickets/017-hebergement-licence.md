---
title: "Hébergement public des packs et conformité CC BY-SA / GFDL"
labels: [wayfinder:grilling]
parent: map-android
status: closed
assignee: cat
blocked_by: []
---

## Question

Où publier les packs pour que l'appli les télécharge hors du réseau local, et que faut-il pour redistribuer légalement une base dérivée de Wiktionary ?

## Ce qu'on sait

- Licence : Wiktionary est sous double licence CC BY-SA 4.0 et GFDL ; la réutilisation impose attribution + partage à l'identique ([recherche 001](../../research/001-sources-libres.md)). La base dérivée et les packs le sont aussi.
- Aujourd'hui : l'appli lit `packs.json` + `*.sqlite.gz` sur `packs.url` (`android/langswap/local.properties`), servi en développement par `langswap serve-packs` sur le réseau local. Aucun hébergement public, aucun écran d'attribution dans l'appli.
- Volume : ≈ 190 Mo pour les 6 langues + base (gzip), ≈ 117 Mo pour fr/en/es ; un nouveau build tous les ~mois si on suit kaikki.
- Compression : zstd (`-19 --long`) ferait ≈ 92 Mo au lieu de ≈ 117–130 pour fr/en/es, mais demande une bibliothèque native sur Android (zstd-jni) ; gzip passe par `java.util.zip`.

## À trancher

- Hébergeur (GitHub Releases, stockage objet, petit serveur statique…) et URL stable ; HTTPS obligatoire hors debug.
- Contenu de l'attribution : écran « À propos / Licence » dans l'appli (sources, licences, lien wiktionary.org, date des dumps), mention dans `packs.json`, fichier LICENSE à côté des packs.
- Publication des packs : automatiser `langswap packs` + envoi après `langswap build` ?
- gzip ou zstd.

## Contraintes F-Droid et Google Play (relevées le 2026-10-14)

L'utilisateur vise **F-Droid et Google Play** (canal de [020](020-publication.md)), ce qui pèse sur l'hébergement.

- **F-Droid** ([guide](https://f-droid.org/fr/docs/Submitting_to_F-Droid_Quick_Start_Guide/), [politique](https://f-droid.org/docs/Inclusion_Policy/), [anti-fonctionnalités](https://f-droid.org/docs/Anti-Features/)) : dépôt source **public** avec fichier de licence libre ; build depuis les sources, en ligne de commande ; dépendances libres (AndroidX sur le Maven Google : admis) ; tag `v<versionName>` par version ; métadonnées `fastlane/metadata/android/<locale>/` (`short_description.txt` < 80 car., `full_description.txt`, `images/icon.png`, `images/phoneScreenshots/`, `changelogs/<versionCode>.txt`) ; MR sur `fdroiddata` (`metadata/fr.langswap.yml`). Builds reproductibles conseillés dès le départ. Des données libres téléchargées ne déclenchent pas d'anti-fonctionnalité, mais un serveur unique et non remplaçable peut valoir « Tethered Network Services » (sauf si l'URL est réglable vers une alternative auto-hébergeable).
- **Google Play** : `targetSdk 36` exigé pour les nouvelles applis depuis le 2026-08-31 ([page officielle](https://developer.android.com/google/play/requirements/target-sdk)) ; un nouveau compte personnel doit faire un test fermé avec **12 testeurs pendant 14 jours** avant la production ([aide Play](https://support.google.com/googleplay/android-developer/answer/14151465)) ; formulaire de sécurité des données. Exigence de politique de confidentialité : non vérifiée.
- **Vérification des développeurs Android** : appliquée aussi hors Play (Brésil, Indonésie, Singapour, Thaïlande depuis fin septembre 2026, mondiale en 2027, d'après des sources secondaires) ; elle touche les APK F-Droid signés par F-Droid.
- **Écarts dans le dépôt** : pas de git ni de dépôt public, pas de LICENSE ; `PACKS_URL` est lu dans `local.properties`, hors dépôt, donc **vide dans un build F-Droid** (l'appli ne télécharge rien) ; pas de signature release ; `targetSdk 35` ; pas de métadonnées fastlane. Aucune appli « LangSwap » ni `fr.langswap` trouvée sur Play ou F-Droid.

## Résolution (2026-10-14)

Canal visé : F-Droid + Google Play (contraintes ci-dessus), ce qui impose un dépôt source public.

1. **Dépôt public** : `gosanefr/langswap` sur GitHub (compte `gosanefr`). On y publie tout sauf les données générées : `dumps/`, `data/`, `cache/`, les sorties de build (`.gradle/`, `.kotlin/`, `build/`) et `local.properties` sont ignorés ; l'IP locale est retirée de `android/langswap/README.md`. Identité de commit locale au dépôt : `GoSane` + adresse no-reply GitHub de `gosanefr`.
2. **Licences** : code en **GPL-3.0-or-later** ; données (packs) en **CC BY-SA 4.0**, dérivées de Wiktionary : `LICENSE-DATA.md` dans chaque release de packs, champ `license` dans `packs.json`.
3. **Attribution** : écran « À propos » dans Config : Wiktionnaire (6 éditions, © contributeurs, CC BY-SA 4.0, modifié : extrait, filtré, restructuré via wiktextract/kaikki.org), dates du dump et du build des packs installés, liens (wiktionary.org, licence, packs) ; l'appli en GPL-3.0-or-later avec lien vers les sources et la version ; AndroidX (Apache-2.0), SQLite (domaine public). Pas de lien « voir sur le Wiktionnaire » par mot.
4. **Hébergement** : une release GitHub par build du dictionnaire, tag `packs-<build>` (ex. `packs-20261014-0517`), avec les `.sqlite.xz` et `LICENSE-DATA.md`. Le manifeste `packs/packs.json` est versionné dans git et donne des **URL absolues** vers les fichiers de cette release ; `Packs.kt` accepte les URL absolues (les noms relatifs restent valables pour `serve-packs`). Écartés : `releases/latest` (une release de l'appli sans packs casserait les téléchargements) et un tag `packs` mobile (pas d'historique, remplacement non atomique).
5. **URL de l'appli** : par défaut `https://raw.githubusercontent.com/gosanefr/langswap/main/packs/packs.json`, versionnée dans `build.gradle.kts` (surchargée par `local.properties` en développement) et **réglable dans l'appli** (Config → Avancé) pour éviter « Tethered Network Services ». **HTTPS seulement en release** (une URL autre est refusée avec un message) ; HTTP en clair reste permis en debug.
6. **Compression : xz -9e**, décompression par `org.tukaani:xz` (Java pur, domaine public, Maven Central). Mesuré sur le build du 2026-10-14 : fr+en+es+base = **66 Mo** contre 117 Mo en gzip (base 11,1, fr 21,2, en 16,2, es 17,2 Mo). Décompression sur téléphone non mesurée (estimée 10–20 s pour ≈ 365 Mo, en tâche de fond) ; au-delà de ≈ 30 s sur le Mi 9 SE, retour à gzip. zstd écarté (bibliothèque native, ≈ 92 Mo).
7. **Publication** : commande locale `langswap publish-packs` (avec `--dry-run`), lancée à la main après `langswap packs` : vérifie `data/packs/` (sha256) et `gh`, crée la release `packs-<build>`, envoie les fichiers, écrit `packs/packs.json`, commit + push sur `main` (c'est ce push qui fait passer les téléphones au nouveau build). Pas d'enchaînement automatique après `langswap build`, pas de CI (dumps de 4,3 Go).

## Mise en œuvre (2026-10-14)

- Dépôt public créé : https://github.com/gosanefr/langswap (LICENSE GPL-3.0, `.gitignore` des données et builds). Push par un assistant d'identification git propre au dépôt (jeton gh de `gosanefr`) ; le compte gh actif de la machine ne change pas.
- Première release : [`packs-20261014-0517`](https://github.com/gosanefr/langswap/releases/tag/packs-20261014-0517) (7 `.sqlite.xz` + `LICENSE-DATA.md`), manifeste `packs/packs.json` sur `main`. Hash vérifié de bout en bout (raw.githubusercontent.com → release).
- Code : `pipeline/packs.mjs` (xz -9e en parallèle, `LICENSE-DATA.md`, champ `license`), `pipeline/publish-packs.mjs`, `Packs.kt` (URL absolues ou relatives, xz/gz, serveur réglable), `Bridge.kt` (`packsSetServer`, `appInfo`), `MainActivity.kt` (liens externes dans le navigateur), Config → « Avancé » et « À propos » (`web/`).
- Tailles xz (6 langues + base) : 124 Mo au lieu de 223 Mo en gzip ; fr/en/es + base : 66 Mo.
- **Décompression xz sur le Mi 9 SE** : ≈ 15 Mo/s décompressés (pack-de : 247 Mo en 16,3 s ; pack-pt : 37 Mo en 3,0 s). fr/en/es + base (≈ 365 Mo) : ≈ 24 s estimées, **sous le seuil de 30 s** : xz est gardé.
- Vérifié sur le téléphone : URL refusées (non HTTPS, invalides), manifeste lu sur GitHub, ajout de/pt depuis la release, recherche sur les nouveaux packs, écran « À propos », lien ouvert dans Firefox ; téléphone remis en fr/en/es sur le serveur par défaut. Build release (non signé) compilé.
