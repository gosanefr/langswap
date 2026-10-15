// LangSwap Android : l'interface web/ du dépôt dans une WebView.
// Les fichiers viennent de assets/www (copiés au build depuis web/, server/, shared/), servis sur
// https://appassets.androidplatform.net/ (contexte sûr : localStorage, presse-papiers). index.html reçoit
// android/api.mjs avant app.js : ce module répond aux fetch('/api/…') dans la page, à la place du serveur Node.
package fr.langswap

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.res.Configuration
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.Gravity
import android.view.View
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.window.OnBackInvokedDispatcher
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewAssetLoader
import java.io.ByteArrayInputStream
import java.io.IOException

class MainActivity : Activity() {
    private lateinit var web: WebView
    private lateinit var bridge: Bridge
    private lateinit var root: FrameLayout
    private lateinit var navStrip: View

    private val types = mapOf(
        "html" to "text/html", "js" to "text/javascript", "mjs" to "text/javascript",
        "css" to "text/css", "svg" to "image/svg+xml", "png" to "image/png", "json" to "application/json",
    )

    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        if (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) WebView.setWebContentsDebuggingEnabled(true)
        bridge = Bridge(this) { runOnUiThread { web.reload() } }   // packs changés : la page rouvre le dictionnaire

        val loader = WebViewAssetLoader.Builder().addPathHandler("/", WebViewAssetLoader.PathHandler { path ->
            val rel = path.ifEmpty { "index.html" }
            try {
                val type = types[rel.substringAfterLast('.', "")] ?: "application/octet-stream"
                val stream = if (rel == "index.html") ByteArrayInputStream(indexWithApi()) else assets.open("www/$rel")
                WebResourceResponse(type, "utf-8", stream)
            } catch (e: IOException) { null }
        }).build()

        web = WebView(this)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true   // réglages de l'interface (localStorage)
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(v: WebView, r: WebResourceRequest): WebResourceResponse? = loader.shouldInterceptRequest(r.url)
            // Liens externes (À propos : Wiktionnaire, licences, dépôt) : dans le navigateur, jamais dans la WebView.
            override fun shouldOverrideUrlLoading(v: WebView, r: WebResourceRequest): Boolean {
                if (r.url.host == "appassets.androidplatform.net") return false
                try { startActivity(Intent(Intent.ACTION_VIEW, r.url)) } catch (e: ActivityNotFoundException) { Log.w("langswap", "no app for ${r.url}") }
                return true
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(m: ConsoleMessage): Boolean {
                Log.i("langswap", "${m.message()} (${m.sourceId()}:${m.lineNumber()})"); return true
            }
        }
        web.addJavascriptInterface(bridge, "Android")
        setContentView(edgeToEdge())
        if (state == null) web.loadUrl("https://appassets.androidplatform.net/") else web.restoreState(state)
        // Android 13+ : onBackPressed n'est plus appelé (enableOnBackInvokedCallback, imposé avec targetSdk 36).
        if (Build.VERSION.SDK_INT >= 33) onBackInvokedDispatcher.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT) { back() }
    }

    /** Bord à bord (ticket 020) : imposé par Android 15 avec targetSdk 35+, appliqué à toutes les versions pour un
     *  seul comportement. La WebView reçoit des marges égales aux barres système (et au clavier : adjustResize n'a plus
     *  d'effet en bord à bord) ; derrière les barres, les couleurs de la page (--bg en haut, --panel sous la barre de
     *  navigation de la page). Rien dans web/ : env(safe-area-inset-*) dépend trop de la version de la WebView. */
    @Suppress("DEPRECATION")   // statusBarColor / navigationBarColor
    private fun edgeToEdge(): View {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT       // ignorés à partir d'Android 15,
        window.navigationBarColor = Color.TRANSPARENT   // déjà transparentes
        root = FrameLayout(this)
        navStrip = View(this)
        root.addView(navStrip, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, 0, Gravity.BOTTOM))
        root.addView(web, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        ViewCompat.setOnApplyWindowInsetsListener(root) { _, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val bottom = maxOf(bars.bottom, insets.getInsets(WindowInsetsCompat.Type.ime()).bottom)
            (web.layoutParams as FrameLayout.LayoutParams).setMargins(bars.left, bars.top, bars.right, bottom)
            navStrip.layoutParams.height = bars.bottom
            root.requestLayout()
            WindowInsetsCompat.CONSUMED
        }
        barColors()
        return root
    }

    /** Couleurs derrière les barres et icônes claires/sombres selon le thème (mêmes valeurs que web/style.css).
     *  Android 8–9 : thème clair seulement (values/themes.xml). */
    private fun barColors() {
        val night = Build.VERSION.SDK_INT >= 29 &&
            (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        root.setBackgroundColor(if (night) 0xFF17181B.toInt() else 0xFFF6F5F2.toInt())   // --bg
        navStrip.setBackgroundColor(if (night) 0xFF202226.toInt() else 0xFFFFFFFF.toInt())   // --panel
        WindowInsetsControllerCompat(window, root).apply { isAppearanceLightStatusBars = !night; isAppearanceLightNavigationBars = !night }
    }

    override fun onConfigurationChanged(config: Configuration) { super.onConfigurationChanged(config); barColors() }

    /** Bouton retour (ticket 019) : la page ferme sa bulle ou revient à la page principale (window.langswapBack) ;
     *  sinon l'appli passe en arrière-plan sans être détruite (état et recherche conservés). */
    private fun back() {
        web.evaluateJavascript("window.langswapBack?.() === true") { handled -> if (handled != "true") moveTaskToBack(true) }
    }

    @Deprecated("Android 12 et avant ; Android 13+ passe par OnBackInvokedCallback")
    override fun onBackPressed() = back()

    /** index.html de web/ avec android/api.mjs chargé juste avant le script module app.js
     *  (les scripts module s'exécutent dans l'ordre du document). */
    private fun indexWithApi(): ByteArray {
        val html = assets.open("www/index.html").bufferedReader().readText()
        val appScript = Regex("""<script\b[^>]*\bsrc=["'](?:\./)?app\.js["'][^>]*>\s*</script>""")
        val match = checkNotNull(appScript.find(html)) { "index.html: app.js script tag not found" }
        return html.replaceRange(match.range, """<script type="module" src="android/api.mjs"></script>""" + "\n" + match.value).toByteArray()
    }

    override fun onSaveInstanceState(state: Bundle) { super.onSaveInstanceState(state); web.saveState(state) }

    override fun onDestroy() { web.destroy(); bridge.close(); super.onDestroy() }
}
