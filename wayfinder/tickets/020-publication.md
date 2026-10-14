---
title: "Publication : build release, signature, canal de distribution"
labels: [wayfinder:grilling]
parent: map-android
status: open
assignee:
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
