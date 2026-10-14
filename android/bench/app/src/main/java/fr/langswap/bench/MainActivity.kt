// Banc sur téléphone : rejoue les appels SQL enregistrés par prototypes/packs/trace.mjs
// (mêmes requêtes, mêmes arguments, même ordre que search()) et mesure le temps SQL par recherche.
// Mode « webview » (--es mode webview) : search.mjs tel quel dans une WebView, SQL via Bridge.
// Entrées : files/trace.json et files/packs/*.sqlite (poussés par run.sh). Sortie : files/results.txt + logcat « bench ».
// Extras : --es config <nom> (une seule configuration), --ez pragmas true (mmap/cache, mode natif ; toujours en WebView).
package fr.langswap.bench

import android.app.Activity
import android.os.Bundle
import android.util.Log
import android.widget.TextView
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.sqlite.SQLiteStatement
import androidx.webkit.WebViewAssetLoader
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import kotlin.concurrent.thread

class MainActivity : Activity() {
    private lateinit var view: TextView
    private val output = StringBuilder()

    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        view = TextView(this).apply { textSize = 11f; setPadding(24, 24, 24, 24); typeface = android.graphics.Typeface.MONOSPACE }
        if (intent.getStringExtra("mode") == "webview") return webview()
        setContentView(android.widget.ScrollView(this).apply { addView(view) })
        thread(name = "bench") {
            try { bench() } catch (e: Throwable) { log("ERROR $e\n${e.stackTraceToString()}") }
            log("END")
            File(filesDir, "results.txt").writeText(output.toString())
        }
    }

    private fun log(line: String) {
        Log.i("bench", line)
        output.appendLine(line)
        runOnUiThread { view.text = output }
    }

    /** Page assets/bench/index.html servie en https://appassets.androidplatform.net/ (contexte sûr : crypto.subtle). */
    private fun webview() {
        val loader = WebViewAssetLoader.Builder().addPathHandler("/", WebViewAssetLoader.PathHandler { path ->
            try {
                val type = if (path.endsWith(".mjs") || path.endsWith(".js")) "text/javascript" else "text/html"
                WebResourceResponse(type, "utf-8", assets.open(path))
            } catch (e: java.io.IOException) { null }
        }).build()
        val web = WebView(this)
        web.settings.javaScriptEnabled = true
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(v: WebView, r: WebResourceRequest): WebResourceResponse? = loader.shouldInterceptRequest(r.url)
        }
        web.webChromeClient = object : android.webkit.WebChromeClient() {
            override fun onConsoleMessage(m: android.webkit.ConsoleMessage): Boolean { Log.i("bench", "console: ${m.message()} (${m.sourceId()}:${m.lineNumber()})"); return true }
        }
        web.addJavascriptInterface(Bridge(filesDir, intent.getStringExtra("config"), ::log) {
            log("END"); File(filesDir, "results.txt").writeText(output.toString())
        }, "Android")
        setContentView(web)
        web.loadUrl("https://appassets.androidplatform.net/bench/index.html")
    }

    private fun bench() {
        val packsDir = File(filesDir, "packs")
        val trace = JSONObject(File(filesDir, "trace.json").readText())
        val pragmas = intent.getBooleanExtra("pragmas", false)
        log("LangSwap bench — ${android.os.Build.MODEL}, Android ${android.os.Build.VERSION.RELEASE}")
        val only = intent.getStringExtra("config")
        for (name in trace.keys()) {
            if (only != null && name != only) continue
            val c = trace.getJSONObject(name)

            var t0 = System.nanoTime()
            val cx = open(packsDir, c, pragmas)
            val st = cx.queries
            val openMs = (System.nanoTime() - t0) / 1e6

            val searches = c.getJSONArray("searches")
            val warm = ArrayList<Double>(); val cold = ArrayList<Double>(); val sample = ArrayList<Double>()
            var rows = 0L
            for (pass in 0 until 3) for (i in 0 until searches.length()) {
                val r = searches.getJSONObject(i)
                val isBench = r.getBoolean("bench")
                if (!isBench && pass > 0) continue
                t0 = System.nanoTime()
                val calls = r.getJSONArray("calls")
                for (j in 0 until calls.length()) rows += replay(st, calls.getJSONArray(j))
                val ms = (System.nanoTime() - t0) / 1e6
                when { !isBench -> sample += ms; pass == 0 -> cold += ms; else -> warm += ms }
            }
            log("\n== $name${if (pragmas) " + mmap/cache" else ""} (open + prepare ${"%.0f".format(openMs)} ms)")
            log("  bench, 1st pass: ${stats(cold)}")
            log("  bench, passes 2-3: ${stats(warm)}")
            if (sample.isNotEmpty()) log("  sample of ${sample.size} words: ${stats(sample)}")
            Log.i("bench", "$name rows read $rows")
            cx.close()
        }
    }

    /** Rejoue un appel [name, [args…]] : lie les arguments, lit toutes les colonnes de toutes les lignes. */
    private fun replay(st: Map<String, SQLiteStatement>, call: JSONArray): Int {
        val s = st.getValue(call.getString(0))
        val args = call.getJSONArray(1)
        s.reset(); s.clearBindings()
        for (k in 0 until args.length()) when (val a = args.get(k)) {
            is Int -> s.bindLong(k + 1, a.toLong())
            is Long -> s.bindLong(k + 1, a)
            is Number -> s.bindDouble(k + 1, a.toDouble())
            JSONObject.NULL -> s.bindNull(k + 1)
            else -> s.bindText(k + 1, a.toString())
        }
        var n = 0
        val cols = s.getColumnCount()
        while (s.step()) {
            for (k in 0 until cols) if (!s.isNull(k)) s.getText(k)
            n++
        }
        return n
    }

    private fun stats(t: List<Double>): String {
        if (t.isEmpty()) return "—"
        val s = t.sorted()
        fun p(x: Double) = s[minOf(s.size - 1, (s.size * x).toInt())]
        return "p50 %5.1f ms  p95 %5.1f ms  max %6.1f ms  (n=%d)".format(p(0.5), p(0.95), s.last(), s.size)
    }
}
