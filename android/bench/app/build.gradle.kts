plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "fr.langswap.bench"
    compileSdk = 35
    defaultConfig {
        applicationId = "fr.langswap.bench"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1"
        ndk { abiFilters += "arm64-v8a" }
    }
    buildTypes {
        // Débogable (pour `run-as`), mais compilé et optimisé comme en release.
        getByName("debug") { isMinifyEnabled = false }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.sqlite:sqlite-bundled:2.6.2")
    implementation("androidx.webkit:webkit:1.12.1")
}

// Le code JS du serveur, copié tel quel dans les assets (server/, shared/), avec web/ (page du banc).
val generatedWeb = layout.buildDirectory.dir("generated/web")
val copyWeb by tasks.registering(Sync::class) {
    into(generatedWeb)
    from("../../../server") { into("server"); include("search.mjs", "queries.mjs") }
    from("../../../shared") { into("shared"); include("normalize.mjs", "lists.mjs", "constants.mjs") }
    from("../web") { into("bench") }
}
android.sourceSets["main"].assets.srcDir(generatedWeb)
tasks.named("preBuild") { dependsOn(copyWeb) }
