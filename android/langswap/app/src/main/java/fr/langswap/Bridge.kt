// Pont JS → SQLite embarqué (window.Android), appelé de façon synchrone sur le fil « JavaBridge » de la WebView,
// seul à toucher les connexions. Toute la logique reste en JS (android/api.mjs) : ce pont ouvre les bases,
// prépare des requêtes et rend leurs lignes en JSON, avec les types de node:sqlite.
//  - « dict » : files/packs/base.sqlite + pack-<l>.sqlite, attachés en lecture seule sous base, p_<l> ; mmap/cache comme shared/constants.mjs (SQLITE_PRAGMAS).
//  - « history » : files/history.sqlite, lecture-écriture, schéma shared/history.sql.
// Erreurs : rendues en {"error": "…"} (une exception ne traverse pas le pont).
// Packs de langue : téléchargés par Packs.kt (serveur BuildConfig.PACKS_URL ou réglé dans l'appli) ; la bascule des fichiers se fait sous
// `lock`, dictionnaire fermé, pour ne jamais couper une requête en cours.
package fr.langswap

import android.content.Context
import android.util.Log
import android.webkit.JavascriptInterface
import androidx.sqlite.SQLITE_DATA_FLOAT
import androidx.sqlite.SQLITE_DATA_INTEGER
import androidx.sqlite.SQLITE_DATA_NULL
import androidx.sqlite.SQLiteConnection
import androidx.sqlite.SQLiteStatement
import androidx.sqlite.driver.bundled.BundledSQLiteDriver
import androidx.sqlite.driver.bundled.SQLITE_OPEN_CREATE
import androidx.sqlite.driver.bundled.SQLITE_OPEN_READWRITE
import androidx.sqlite.driver.bundled.SQLITE_OPEN_URI
import androidx.sqlite.execSQL
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

class Bridge(private val ctx: Context, private val onPacksChanged: () -> Unit) {
    private val driver = BundledSQLiteDriver()
    private val packsDir = File(ctx.filesDir, "packs").apply { mkdirs() }
    private val lock = Any()
    // Après une bascule, toutes les requêtes préparées sont fermées : la page doit se recharger (qui que soit
    // l'appelant de packsApply), ce que fait onPacksChanged (MainActivity).
    private val packs = Packs(packsDir, BuildConfig.PACKS_URL, ctx.getSharedPreferences("langswap", Context.MODE_PRIVATE), BuildConfig.DEBUG) { swapFiles -> synchronized(lock) { closeDictionary(); swapFiles() }; onPacksChanged() }
    private var dict: SQLiteConnection? = null
    private var history: SQLiteConnection? = null
    private val statements = ArrayList<SQLiteStatement>()
    private val lastInsert by lazy { historyConnection().prepare("SELECT last_insert_rowid()") }

    /** Attache les packs présents. → {"langs": [...]} ou {"error": "…"}.
     *  Appelé à chaque chargement de la page : repart de zéro (requêtes préparées et dictionnaire précédents fermés). */
    @JavascriptInterface
    fun openDictionary(): String = guarded {
        closeDictionary()
        val base = File(packsDir, "base.sqlite")
        if (!base.exists()) return@guarded JSONObject().put("error", "no pack installed (${base.path} missing)").toString()
        val pattern = Regex("^pack-([a-z]{2})\\.sqlite$")
        val present = packsDir.listFiles().orEmpty().mapNotNull { pattern.find(it.name)?.groupValues }
        val langs = present.map { it[1] }.sorted()
        val c = driver.open(":memory:", SQLITE_OPEN_READWRITE or SQLITE_OPEN_CREATE or SQLITE_OPEN_URI)
        val schemas = listOf("base" to "base.sqlite") + langs.map { "p_$it" to "pack-$it.sqlite" }
        for ((alias, f) in schemas) {
            c.execSQL("ATTACH 'file:${File(packsDir, f).path}?mode=ro' AS $alias")
            c.execSQL("PRAGMA $alias.mmap_size = 268435456")
            c.execSQL("PRAGMA $alias.cache_size = -16000")
        }
        dict = c
        Log.i("langswap", "dictionary: packs $langs")
        JSONObject().put("langs", JSONArray(langs)).toString()
    }

    /** Prépare `sql` sur « dict » ou « history ». → id de requête (nombre) ou {"error"}. */
    @JavascriptInterface
    fun prepare(db: String, sql: String): String = guarded {
        val c = if (db == "history") historyConnection() else dict ?: error("dictionary not open")
        statements += c.prepare(sql)
        (statements.size - 1).toString()
    }

    /** Exécute la requête `id` avec `argsJson` et rend toutes ses lignes : [{colonne: valeur}, …]. */
    @JavascriptInterface
    fun all(id: Int, argsJson: String): String = guarded {
        val s = bind(id, argsJson)
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
        sb.append(']').toString()
    }

    /** Exécute une écriture sur « history ». → {"id": dernier rowid inséré}. */
    @JavascriptInterface
    fun run(id: Int, argsJson: String): String = guarded {
        val s = bind(id, argsJson)
        while (s.step()) { /* rien à lire */ }
        lastInsert.reset()
        lastInsert.step()
        JSONObject().put("id", lastInsert.getLong(0)).toString()
    }

    /** Packs : état (serveur, manifeste, installés, progression), relecture du manifeste, installation de `langs`. */
    @JavascriptInterface
    fun packsState(): String = guarded { packs.state().toString() }

    @JavascriptInterface
    fun packsRefresh(): String = guarded { packs.refresh(); "{}" }

    @JavascriptInterface
    fun packsApply(langsJson: String): String = guarded {
        val a = JSONArray(langsJson)
        packs.apply(List(a.length()) { a.getString(it) }); "{}"
    }

    @JavascriptInterface
    fun packsSetServer(url: String): String = guarded { packs.setServer(url); "{}" }

    /** Version de l'appli, pour l'écran « À propos ». */
    @JavascriptInterface
    fun appInfo(): String = JSONObject().put("version", BuildConfig.VERSION_NAME).put("versionCode", BuildConfig.VERSION_CODE)
        .put("debug", BuildConfig.DEBUG).toString()

    fun close() = synchronized(lock) {
        closeDictionary()
        history?.close()
    }

    /** Ferme toutes les requêtes préparées (dictionnaire et historique) et le dictionnaire. */
    private fun closeDictionary() {
        statements.forEach { it.close() }; statements.clear()
        dict?.close(); dict = null
    }

    private fun historyConnection(): SQLiteConnection = history ?: driver.open(File(ctx.filesDir, "history.sqlite").path, SQLITE_OPEN_READWRITE or SQLITE_OPEN_CREATE).also { c ->
        c.execSQL("PRAGMA journal_mode=WAL")
        // Même schéma que le poste : shared/history.sql, une instruction à la fois. Commentaires « -- » retirés
        // d'abord : ils peuvent contenir des « ; » (le fichier n'a aucun « -- » dans une chaîne).
        val schema = ctx.assets.open("history.sql").bufferedReader().readText()
        for (statement in schema.lines().joinToString("\n") { it.substringBefore("--") }.split(';'))
            if (statement.isNotBlank()) c.execSQL(statement)
        history = c
    }

    private fun bind(id: Int, argsJson: String): SQLiteStatement {
        val s = statements.getOrNull(id) ?: error("query $id is closed (dictionary reopened): reload the page")
        val args = JSONArray(argsJson)
        s.reset(); s.clearBindings()
        for (k in 0 until args.length()) when (val a = args.get(k)) {
            is Int -> s.bindLong(k + 1, a.toLong())
            is Long -> s.bindLong(k + 1, a)
            is Number -> s.bindDouble(k + 1, a.toDouble())
            JSONObject.NULL -> s.bindNull(k + 1)
            else -> s.bindText(k + 1, a.toString())
        }
        return s
    }

    private inline fun guarded(f: () -> String): String = try { synchronized(lock) { f() } } catch (e: Throwable) {
        Log.e("langswap", "bridge", e)
        JSONObject().put("error", e.message ?: e.toString()).toString()
    }
}
