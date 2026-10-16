import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// local.properties (hors dépôt) : sdk.dir, packs.url (debug), clé de signature release.
val local = Properties().apply { rootProject.file("local.properties").takeIf { it.exists() }?.reader()?.use { load(it) } }
val PUBLIC_PACKS = "https://raw.githubusercontent.com/gosanefr/langswap/main/packs/packs.json"

android {
    namespace = "fr.langswap"
    compileSdk = 36
    buildToolsVersion = "36.0.0"   // épinglé : même zipalign/aapt2 ici, dans android/repro et chez F-Droid
    defaultConfig {
        applicationId = "fr.langswap"
        minSdk = 26
        targetSdk = 36
        // Semver ; versionCode = MAJEUR×10000 + MINEUR×100 + CORRECTIF (ticket 020). Les deux sont écrits par
        // `langswap release` ; versionCode reste un littéral, que F-Droid (checkupdates) sait lire.
        versionName = "1.0.0"
        versionCode = 10000
        // Manifeste des packs de langue par défaut : packs/packs.json du dépôt public, qui pointe vers la release
        // packs-<build> (`langswap publish-packs`, ticket 017). Réglable aussi dans l'appli (Config).
        buildConfigField("String", "PACKS_URL", "\"$PUBLIC_PACKS\"")
    }
    // Clé de l'auteur, la même pour Play et F-Droid (ticket 020) : chemin et mots de passe dans local.properties
    // (release.storeFile, release.storePassword, release.keyAlias, release.keyPassword). Sans eux, assembleRelease
    // produit un APK non signé (build F-Droid, vérifié ensuite par apksigcopier) au lieu d'échouer.
    val releaseKey = local.getProperty("release.storeFile")?.let { path ->
        signingConfigs.create("release") {
            storeFile = file(path)
            storePassword = local.getProperty("release.storePassword")
            keyAlias = local.getProperty("release.keyAlias", "langswap")
            keyPassword = local.getProperty("release.keyPassword")
            enableV1Signing = false   // minSdk 26 : v2/v3 suffisent
            enableV2Signing = true
            enableV3Signing = true
        }
    }
    buildTypes {
        // Développement : `packs.url` de local.properties, par ex. le dossier servi par `langswap serve-packs`.
        // Jamais en release : l'APK publié lit toujours le manifeste public.
        debug { buildConfigField("String", "PACKS_URL", "\"${local.getProperty("packs.url", PUBLIC_PACKS)}\"") }
        release {
            // Pas de R8 : gain faible, risque sur le pont @JavascriptInterface et sur la reproductibilité.
            isMinifyEnabled = false
            // Pas de META-INF/version-control-info.textproto (commit git) : son contenu dépend de l'endroit où le
            // dépôt est cloné, et l'APK doit être identique ici, dans android/repro et chez F-Droid.
            vcsInfo.include = false
            signingConfig = releaseKey
        }
    }
    // Build reproductible (F-Droid) : pas de blob de dépendances chiffré par Google dans l'APK/AAB.
    dependenciesInfo { includeInApk = false; includeInBundle = false }
    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    // libsqliteJni.so tel que livré : le stripping dépend de la présence du NDK, qui varie d'un poste de build à
    // l'autre (ici, android/repro, F-Droid) et rendrait l'APK non reproductible.
    packaging { jniLibs { keepDebugSymbols += "**/*.so" } }
    // Packs SQLite : jamais compressés s'ils passent un jour par les assets.
    androidResources { noCompress += "sqlite" }
}

dependencies {
    implementation("androidx.core:core:1.16.0")   // WindowInsetsCompat : marges bord à bord (ticket 020)
    implementation("androidx.sqlite:sqlite-bundled:2.6.2")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("org.tukaani:xz:1.10")   // décompression des packs (.sqlite.xz), Java pur, domaine public
}

// Interface et code JS du dépôt, copiés tels quels dans assets/www (une seule source : web/, server/, shared/).
// Même plan que le serveur Node : web/ à la racine, /normalize.js = shared/normalize.mjs ; modules partagés sous /js/.
val repoRoot = "../../.."
val generatedWeb = layout.buildDirectory.dir("generated/web")
val copyWeb by tasks.registering(Sync::class) {
    into(generatedWeb)
    from("$repoRoot/web") { into("www") }
    from("$repoRoot/shared/normalize.mjs") { into("www"); rename { "normalize.js" } }
    from("$repoRoot/server") { into("www/js/server"); include("search.mjs", "queries.mjs", "pack-queries.mjs") }
    from("$repoRoot/shared") { into("www/js/shared"); include("normalize.mjs", "lists.mjs", "constants.mjs") }
    from("$repoRoot/shared/history.sql")
    from("../web") { into("www/android") }
}
android.sourceSets["main"].assets.srcDir(generatedWeb)
tasks.named("preBuild") { dependsOn(copyWeb) }
