import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "fr.langswap"
    compileSdk = 35
    defaultConfig {
        applicationId = "fr.langswap"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1"
        // Manifeste des packs de langue par défaut : packs/packs.json du dépôt public, qui pointe vers la release
        // packs-<build> (`langswap publish-packs`, ticket 017). Développement : `packs.url` dans local.properties
        // (hors dépôt), par ex. le dossier servi par `langswap serve-packs`. Réglable aussi dans l'appli (Config).
        val local = Properties().apply { rootProject.file("local.properties").takeIf { it.exists() }?.reader()?.use { load(it) } }
        val packsUrl = local.getProperty("packs.url", "https://raw.githubusercontent.com/gosanefr/langswap/main/packs/packs.json")
        buildConfigField("String", "PACKS_URL", "\"$packsUrl\"")
    }
    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    // Packs SQLite : jamais compressés s'ils passent un jour par les assets.
    androidResources { noCompress += "sqlite" }
}

dependencies {
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
