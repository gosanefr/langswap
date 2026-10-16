# LangSwap — appli Android

L'interface `web/` du dépôt dans une WebView, avec `server/search.mjs` tel quel et un SQLite embarqué. Décisions et questions ouvertes : [`wayfinder/map-android.md`](../../wayfinder/map-android.md).

## Outils (Ubuntu 24.04, ligne de commande)

- apt : `openjdk-21-jdk-headless adb android-sdk-platform-tools-common google-android-cmdline-tools-13.0-installer` ; utilisateur dans le groupe `plugdev`.
- SDK dans `~/Android/Sdk` : `sdkmanager --sdk_root=$HOME/Android/Sdk "platform-tools" "platforms;android-36" "build-tools;36.0.0"` ; émulateur API 36 (bord à bord, icône monochrome, thème sombre) : `"emulator" "system-images;android-36;google_apis;x86_64"`, AVD `api36` (`~/.android/avd/`, écrit à la main : l'`avdmanager` d'apt ne voit pas `~/Android/Sdk`), lancé par `~/Android/Sdk/emulator/emulator -avd api36` ; il joint le poste en `10.0.2.2` (Config → Avancé : `http://10.0.2.2:4766/`).
- `~/.zshrc` : `JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64`, `ANDROID_HOME=$HOME/Android/Sdk`, `PATH` avec `cmdline-tools/latest/bin` et `platform-tools`. Gradle : le wrapper du projet (`./gradlew`), jamais celui d'apt.
- `local.properties` (hors dépôt) : `sdk.dir=…` et `packs.url=http://<ip-du-poste>:4766/` (packs servis par `langswap serve-packs` ; absent : `packs/packs.json` du dépôt public sur GitHub).

## Construire et lancer

```sh
./gradlew installDebug                      # APK debug sur le téléphone branché (adb devices)
adb shell am start -n fr.langswap/.MainActivity
```

Xiaomi / MIUI : activer « Install via USB » (options développeur) ; chaque **nouveau** paquet demande une confirmation à l'écran (libellés confus, plusieurs essais possibles) ; une réinstallation du même paquet passe sans.

## Version publiée (ticket 020)

```sh
langswap release 1.0.1 --dry-run   # build signé + vérification reproductible, rien de publié
langswap release 1.0.1              # puis : commit « Version 1.0.1 », tag v1.0.1, push, release GitHub avec l'APK
```

- **Clé** : `~/.android/langswap-release.jks` (RSA 4096, alias `langswap`, certificat `CN=gosanefr, C=FR` : il est public, lisible dans chaque APK ; SHA-256 `b2a9feb8…e812d`), la même pour Play (Play App Signing, « utiliser ma propre clé ») et F-Droid (`AllowedAPKSigningKeys`) ; sauvegarde : KeePassX (pièce jointe + mots de passe) et clé USB. `local.properties` : `release.storeFile`, `release.storePassword`, `release.keyPassword` (`release.keyAlias`, défaut `langswap`). Sans eux, `assembleRelease` produit `app-release-unsigned.apk` (cas du build F-Droid).
- **Versions** : `versionName` semver, `versionCode = MAJEUR×10000 + MINEUR×100 + CORRECTIF` (littéral, écrit par `langswap release`) ; tag `v<versionName>` ; `fastlane/metadata/android/{en-US,fr-FR,es-ES}/changelogs/<versionCode>.txt` exigés avant la release (500 octets max).
- **Reproductibilité** : `langswap release` reconstruit l'APK non signé dans `android/repro` (Docker : Debian trixie, JDK 21, build-tools 36.0.0 épinglé, chemin de F-Droid) et le compare à l'APK signé (`apksigcopier compare`) ; un écart bloque la publication (`diffoscope` pour comprendre). Pas de R8, pas de blob `dependenciesInfo`, `.so` non strippés (le strip dépend de la présence du NDK).
- **Sorties** : `data/release/<version>/langswap-<version>.{apk,aab}` ; l'AAB s'envoie à la main dans la console Play ; F-Droid suit les tags (`android/fdroid/fr.langswap.yml`, brouillon de la MR `fdroiddata`).
- **Fiches** : `fastlane/metadata/android/` (titre, descriptions, changelogs, `images/` : icône 512, `featureGraphic` 1024×500, captures prises sur l'émulateur), recopiées à la main dans la console Play. Confidentialité : [`PRIVACY.md`](../../PRIVACY.md), lié depuis « À propos ».
- **Bord à bord** (Android 15+, imposé par `targetSdk 36`) : `MainActivity.edgeToEdge()` met des marges à la WebView (barres système, encoche, clavier) et peint derrière les barres les couleurs de `web/style.css` (`--bg`, `--panel`), selon le thème ; à reporter si ces couleurs changent.
- **Vérification des développeurs Android** : pas de démarche séparée, la vérification du compte Play couvre `fr.langswap` et la clé ; à contrôler quand la console Android Developer ouvrira en France (annoncé pour 2027).
- Outils : `docker` (apt `docker.io`, utilisateur dans le groupe `docker`), `apksigcopier` (`uv tool install apksigcopier`), `gh` (compte `gosanefr`).

## Packs de langue

Par défaut, l'appli lit `https://raw.githubusercontent.com/gosanefr/langswap/main/packs/packs.json`, qui pointe vers la release GitHub `packs-<build>` (publiée par `langswap publish-packs`). En développement : `langswap packs`, puis `langswap serve-packs` (réseau local, port 4766) et `packs.url` dans `local.properties` (builds debug seulement : l'APK release lit toujours le manifeste public). Dans l'appli : Config → « Langues téléchargées » (premier lancement : directement là) ; Config → « Avancé » change le serveur (adresse d'un `packs.json`, ou d'un dossier qui en contient un ; HTTPS seulement hors debug). Archives `.sqlite.xz` (XZ for Java) ; les `.sqlite.gz` d'anciens builds restent lisibles. Sans réseau : `./install-packs.sh ../../data/packs fr,en,es` copie les `.sqlite` par `run-as` (debug seulement).

Sur l'appareil (`/data/user/0/fr.langswap/files/`) : `packs/base.sqlite`, `packs/pack-<l>.sqlite`, `packs/installed.json` (`build`, `langs`), `packs/tmp/` pendant un téléchargement ; `history.sqlite` ; WebView : `localStorage` (réglages de l'interface).

## Organisation

- `app/build.gradle.kts` — tâche `copyWeb` : copie `web/` → `assets/www/`, `shared/normalize.mjs` → `www/normalize.js`, `server/{search,queries,pack-queries}.mjs` et `shared/{normalize,lists,constants}.mjs` → `www/js/…`, `shared/history.sql` → `assets/`. `BuildConfig.PACKS_URL` : `packs.url` de `local.properties`, sinon le manifeste du dépôt public.
- `MainActivity.kt` — WebView sur `https://appassets.androidplatform.net/` (WebViewAssetLoader) ; insère `android/api.mjs` avant `app.js` dans `index.html` ; recharge la page quand les packs changent.
- `web/api.mjs` — les routes `/api/*` de `server/server.mjs`, servies dans la page (remplace `fetch`) ; plus `/api/packs` (état, `POST` = installer un jeu de langues, `/refresh`).
- `Bridge.kt` — `window.Android` : `openDictionary`, `prepare('dict'|'history', sql)`, `all`, `run`, `packsState`, `packsRefresh`, `packsSetServer`, `packsApply`, `appInfo` ; tout sous un verrou ; erreurs rendues en `{"error"}`.
- `Packs.kt` — serveur (par défaut ou réglé, préférence `packs_url`), téléchargement (URL absolues ou relatives au manifeste), vérification sha256, décompression xz, bascule des fichiers.
- `MainActivity.edgeToEdge()` — marges bord à bord (WindowInsetsCompat) et couleurs des barres selon le thème.
- `res/` — thème sans barre de titre, icône adaptative (bulle + flèches) avec couche monochrome.

## Déboguer

- Journaux : `adb logcat -s langswap` (messages du pont et console de la page).
- DevTools de la WebView (debug) : `chrome://inspect` sur le poste, ou `adb forward tcp:9222 localabstract:webview_devtools_remote_$(adb shell pidof fr.langswap)` puis le protocole DevTools sur `http://127.0.0.1:9222/json` (permet d'appeler `fetch('/api/search?q=…')` dans la page).
- Capture d'écran : `adb exec-out screencap -p > shot.png`.

## Banc de mesure

`android/bench/` (paquet `fr.langswap.bench`) rejoue les appels SQL de `search()` enregistrés par `node prototypes/packs/trace.mjs <packs_dir> <trace.json>`, en natif ou dans une WebView : `android/bench/run.sh <packs_dir> <trace.json>`. Lancer chaque configuration séparément (`--es config …`) : les enchaîner fausse les chiffres. Résultats passés : [`prototypes/packs/README.md`](../../prototypes/packs/README.md).
