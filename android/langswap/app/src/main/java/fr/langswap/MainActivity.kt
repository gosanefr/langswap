// LangSwap Android : l'interface web/ du dépôt dans une WebView.
// Les fichiers viennent de assets/www (copiés au build depuis web/, server/, shared/), servis sur
// https://appassets.androidplatform.net/ (contexte sûr : localStorage, presse-papiers). index.html reçoit
// android/api.mjs avant app.js : ce module répond aux fetch('/api/…') dans la page, à la place du serveur Node.
package fr.langswap

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.window.OnBackInvokedDispatcher
import androidx.webkit.WebViewAssetLoader
import java.io.ByteArrayInputStream
import java.io.IOException

class MainActivity : Activity() {
    private lateinit var web: WebView
    private lateinit var bridge: Bridge

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
        setContentView(web)
        if (state == null) web.loadUrl("https://appassets.androidplatform.net/") else web.restoreState(state)
        // Android 13+ : onBackPressed n'est plus appelé (enableOnBackInvokedCallback, imposé avec targetSdk 36).
        if (Build.VERSION.SDK_INT >= 33) onBackInvokedDispatcher.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT) { back() }
    }

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
