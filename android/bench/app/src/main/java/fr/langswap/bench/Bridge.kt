// Pont JS → SQLite embarqué pour la WebView : window.Android.all(name, argsJson) rend les lignes en JSON,
// avec les mêmes types que node:sqlite (entiers, réels, texte, null) et les noms de colonnes en clés.
// Appelé de façon synchrone sur le fil « JavaBridge » de la WebView, seul à toucher la connexion.
package fr.langswap.bench

import android.webkit.JavascriptInterface
import androidx.sqlite.SQLITE_DATA_FLOAT
import androidx.sqlite.SQLITE_DATA_INTEGER
import androidx.sqlite.SQLITE_DATA_NULL
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

class Bridge(private val dir: File, private val config: String?, private val log: (String) -> Unit, private val done: () -> Unit) {
    private val trace by lazy { File(dir, "trace.json").readText() }
    private var cx: Connection? = null
    private var nativeNs = 0L

    @JavascriptInterface fun trace(): String = trace
    @JavascriptInterface fun config(): String = config ?: ""
    @JavascriptInterface fun open(name: String) {
        cx?.close()
        cx = open(File(dir, "packs"), JSONObject(trace).getJSONObject(name), pragmas = true)
    }
    @JavascriptInterface fun close() { cx?.close(); cx = null }
    @JavascriptInterface fun nativeReset() { nativeNs = 0 }
    @JavascriptInterface fun nativeMs(): Double = nativeNs / 1e6
    @JavascriptInterface fun log(line: String) = log.invoke(line)
    @JavascriptInterface fun done() = done.invoke()

    @JavascriptInterface
    fun all(name: String, argsJson: String): String {
        val t0 = System.nanoTime()
        val s = cx!!.queries.getValue(name)
        val args = JSONArray(argsJson)
        s.reset(); s.clearBindings()
        for (k in 0 until args.length()) when (val a = args.get(k)) {
            is Int -> s.bindLong(k + 1, a.toLong())
            is Long -> s.bindLong(k + 1, a)
            is Number -> s.bindDouble(k + 1, a.toDouble())
            JSONObject.NULL -> s.bindNull(k + 1)
            else -> s.bindText(k + 1, a.toString())
        }
        val n = s.getColumnCount()
        val names = Array(n) { JSONObject.quote(s.getColumnName(it)) }
        val sb = StringBuilder("[")
        var first = true
        while (s.step()) {
            if (!first) sb.append(','); first = false
            sb.append('{')
            for (k in 0 until n) {
                if (k > 0) sb.append(',')
                sb.append(names[k]).append(':')
                when (s.getColumnType(k)) {
                    SQLITE_DATA_NULL -> sb.append("null")
                    SQLITE_DATA_INTEGER -> sb.append(s.getLong(k))
                    SQLITE_DATA_FLOAT -> sb.append(s.getDouble(k))
                    else -> sb.append(JSONObject.quote(s.getText(k)))
                }
            }
            sb.append('}')
        }
        sb.append(']')
        nativeNs += System.nanoTime() - t0
        return sb.toString()
    }
}
