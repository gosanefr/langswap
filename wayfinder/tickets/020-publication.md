---
title: "Publication : build release, signature, canal de distribution"
labels: [wayfinder:grilling]
parent: map-android
status: closed
assignee: cat
blocked_by: [017]
---

## Question

Comment passer de l'APK debug installé par USB à une appli installable par d'autres ?

## Ce qu'on sait

- Aujourd'hui : `./gradlew installDebug` uniquement ; `applicationId fr.langswap`, `versionCode 1`, `minSdk 26`, `targetSdk 35`, `compileSdk 35` ; aucune clé de signature release ; HTTP en clair autorisé en debug seulement.
- L'APK fait ≈ 6 Mo (le dictionnaire est téléchargé) : pas de limite de taille Play à gérer.
- Android 15 impose l'affichage bord à bord pour `targetSdk 35` : non vérifié (le téléphone de test est en Android 11).
- **Canal choisi par l'utilisateur (2026-10-14) : F-Droid et Google Play.** Contraintes relevées dans [017](017-hebergement-licence.md) (section « Contraintes F-Droid et Google Play »), qui fixe aussi le dépôt public (`gosanefr/langswap`), la licence GPL-3.0-or-later et l'URL des packs.
- Google Play : `targetSdk 36` exigé pour les nouvelles applis depuis le 2026-08-31 ; nouveau compte personnel = test fermé de 12 testeurs pendant 14 jours avant la production ; formulaire de sécurité des données ; politique de confidentialité (exigence à vérifier).
- F-Droid : tag `v<versionName>` par version, métadonnées `fastlane/metadata/android/<locale>/`, MR sur `fdroiddata` (`metadata/fr.langswap.yml`), builds reproductibles conseillés dès la première version.
- Vérification des développeurs Android (hors Play aussi) : en cours de déploiement (4 pays fin septembre 2026, mondial en 2027).

## À trancher

- Compte développeur Play (personnel `gosanefr` ou organisation) et façon de trouver les 12 testeurs.
- Builds reproductibles pour F-Droid (signature par F-Droid ou par l'auteur via `AllowedAPKSigningKeys`) ; langue(s) des fiches (fastlane fr/en).
- Inscription à la vérification des développeurs Android.
- Clé de signature (création, sauvegarde), numérotation des versions.
- Bord à bord (Android 15) et icône monochrome à vérifier sur un appareil récent.

## Résolution (2026-10-14)

1. **Une seule clé, celle de l'auteur, sur les deux canaux** : fournie à Play (Play App Signing, « utiliser ma propre clé ») ; F-Droid publie l'APK de l'auteur via un build reproductible et `AllowedAPKSigningKeys`. On passe de F-Droid à Play (ou à l'APK GitHub) sans désinstaller. Écarté : une clé par canal (versions incompatibles, historique perdu en changeant de source).
2. **Clé** : `~/.android/langswap-release.jks`, RSA 4096, validité ≥ 30 ans ; chemin et mots de passe dans `local.properties` (hors git). Sans eux, `assembleRelease` produit un APK **non signé** (cas du build F-Droid) au lieu d'échouer. Schémas v2/v3, v1 désactivé (`minSdk 26`). Sauvegarde : le `.jks` en pièce jointe d'une entrée KeePassX avec les deux mots de passe, plus une copie sur clé USB.
3. **Versions** : `versionName` semver, `versionCode = MAJEUR×10000 + MINEUR×100 + CORRECTIF` ; tag `v<versionName>` (F-Droid : `UpdateCheckMode: Tags`, `AutoUpdateMode: Version`). Première version distribuée : **1.0.0** (code 10000), aussi pour le test fermé ; corrections en 1.0.x.
4. **Compte Play personnel**, nom de développeur affiché **gosanefr** (25 $ une fois pour le compte, quel que soit le nombre d'applis) ; contact public de la fiche : `langswap@gosane.fr`.
5. **Test fermé Play** : un Google Group d'une quinzaine de proches (12 requis pendant 14 jours d'affilée), lancé dès la 1.0.0 signée ; retours par `langswap@gosane.fr` ou issues GitHub, changements notés pour le questionnaire de fin de test.
6. **`compileSdk`/`targetSdk 36`** ; bord à bord traité côté Kotlin (marges des barres système sur la vue racine, `WindowInsetsCompat`), sans toucher à `web/` ; couleurs des barres selon le thème. Vérifié sur un **émulateur API 36**, qui sert aussi pour l'icône monochrome et le thème sombre (point laissé ouvert par [Interactions tactiles](019-interactions-tactiles.md)). Écarté : `env(safe-area-inset-*)` en CSS (support variable selon la WebView).
7. **Fiches** : `fastlane/metadata/android/{en-US,fr-FR,es-ES}/` dans le dépôt, source unique (l'interface existe déjà en fr/en/es, `web/i18n.js`) ; recopiées à la main dans la console Play (pas de `fastlane supply`). Titre, description courte (< 80 car.), description complète, `changelogs/<versionCode>.txt`, icône 512 px, 3–4 captures par langue d'interface depuis l'émulateur ; `featureGraphic` 1024×500 pour Play. L'espagnol est relu par un proche de l'auteur.
8. **Confidentialité** : formulaire Play « aucune donnée collectée ni partagée » ; `PRIVACY.md` à la racine, en fr/en/es (rien de collecté, historique local, packs servis par GitHub ou le serveur choisi, contact), lié depuis Play et l'écran « À propos ». F-Droid : aucune anti-fonctionnalité attendue.
9. **Vérification des développeurs Android** : pas de démarche séparée ; la vérification du compte Play couvre `fr.langswap` + la clé, que l'APK F-Droid partage (point 1). À contrôler quand la console Android Developer ouvrira dans la région de l'auteur (annoncé pour 2027, sources secondaires) ; une ligne dans le README Android.
10. **Release** : commande `langswap release <version>` (avec `--dry-run`), sur le modèle de `publish-packs` : met à jour `versionName`, exige `changelogs/<code>.txt` dans les 3 langues, compile l'APK et l'AAB signés, **vérifie la reproductibilité à chaque version** (build release dans le conteneur Docker de F-Droid, `apksigcopier compare` ; échec = pas de publication), tague `v<version>` et crée la release GitHub avec l'APK (champ `Binaries:` de `fr.langswap.yml`). L'AAB est envoyé à la main dans la console Play. Les tags `v*` n'interfèrent pas avec `packs-<build>`.
11. **Pas de R8** (`isMinifyEnabled = false`) : gain faible, risque sur le pont `@JavascriptInterface` et sur la reproductibilité ; avertissement Play sur le fichier de désobfuscation ignoré.
12. **Ordre** : créer le compte Play dès maintenant (vérification d'identité de quelques jours) ; la 1.0.0 contient les interactions tactiles, `targetSdk 36` et les marges, la signature, `PRIVACY.md`, les fiches et `langswap release` ; vérifiée sur le Mi 9 SE et l'émulateur API 36 ; puis le même jour : release GitHub, test fermé Play, MR `fdroiddata` ; après 14 jours, corrections en 1.0.x sur les deux canaux, puis demande d'accès à la production Play.
