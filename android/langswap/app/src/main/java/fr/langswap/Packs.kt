// Téléchargement des packs de langue (pipeline/packs.mjs) : manifeste packs.json, puis un fichier .sqlite.xz (ou .gz,
// anciens builds) par pack, à une URL absolue (release GitHub, `langswap publish-packs`) ou relative au manifeste
// (`langswap serve-packs`). Serveur : BuildConfig.PACKS_URL, ou l'URL réglée dans l'appli (Config → Avancé, gardée
// dans les préférences) ; HTTPS seulement hors debug (ticket 017).
// Un seul build à la fois sur l'appareil (les ids changent à chaque build) : si le serveur publie un autre build,
// tous les fichiers gardés sont retéléchargés. Téléchargement et décompression dans files/packs/tmp, hors verrou ;
// la recherche continue sur les anciens packs. Bascule finale (renommages, suppressions, installed.json) via
// `swap`, que le pont exécute dictionnaire fermé et sous son verrou.
package fr.langswap

import android.content.SharedPreferences
import android.os.StatFs
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.Executors
import java.util.zip.GZIPInputStream
import org.tukaani.xz.XZInputStream

class Packs(
    private val dir: File,
    private val defaultUrl: String,
    private val prefs: SharedPreferences,
    private val allowCleartext: Boolean,
    private val swap: (() -> Unit) -> Unit,
) {
    private val worker = Executors.newSingleThreadExecutor()
    private val tmp = File(dir, "tmp")
    private val installedFile = File(dir, "installed.json")

    init {
        // Packs « bridges » des versions précédentes : plus utilisés.
        dir.listFiles().orEmpty().filter { it.name.startsWith("bridges-") }.forEach { it.delete() }
    }

    // État lu par l'interface (packsState) ; écrit par le fil de travail.
    @Volatile private var manifest: JSONObject? = null
    @Volatile private var manifestError: String? = null
    @Volatile private var status = JSONObject().put("state", "idle")
    @Volatile private var serverUrl = prefs.getString(PREF_URL, null) ?: defaultUrl

    /** État pour l'interface : serveur, manifeste distant, packs installés, téléchargement en cours. */
    fun state(): JSONObject {
        if (manifest == null && manifestError == null && serverUrl.isNotEmpty() && status.optString("state") == "idle") refresh()
        val current = status
        // « done » n'est rendu qu'une fois : l'interface recharge la page, qui ne doit pas recharger à nouveau.
        if (current.optString("state") == "done") status = JSONObject().put("state", "idle")
        return JSONObject()
            .put("server", serverUrl)
            .put("defaultServer", defaultUrl)
            .put("custom", serverUrl != defaultUrl)
            .put("manifest", manifest ?: JSONObject.NULL)
            .put("manifestError", manifestError ?: JSONObject.NULL)
            .put("installed", installed() ?: JSONObject.NULL)
            .put("present", JSONArray(dir.listFiles().orEmpty().map { it.name }.filter { it.endsWith(".sqlite") }.map { it.removeSuffix(".sqlite") }.sorted()))
            .put("status", current)
    }

    /** Relit packs.json sur le serveur. */
    fun refresh() {
        if (serverUrl.isEmpty()) return
        status = JSONObject().put("state", "loading")
        worker.execute {
            try {
                manifest = JSONObject(get(manifestUrl()).bufferedReader().use { it.readText() }); manifestError = null
            } catch (e: Exception) {
                manifestError = e.message ?: e.toString(); Log.e("langswap", "packs.json", e)
            }
            status = JSONObject().put("state", "idle")
        }
    }

    /** Change le serveur des packs (`url` vide : celui de l'appli). Refuse une URL non HTTPS hors debug. */
    fun setServer(url: String) {
        if (status.optString("state") in setOf("downloading", "installing")) error("download in progress")
        val u = url.trim()
        if (u.isNotEmpty()) {
            val parsed = try { URL(u) } catch (e: Exception) { error("invalid URL: $u") }
            if (parsed.host.isNullOrEmpty()) error("invalid URL: $u")
            if (parsed.protocol != "https" && !(allowCleartext && parsed.protocol == "http")) error("the pack server must use HTTPS")
        }
        serverUrl = u.ifEmpty { defaultUrl }
        prefs.edit().apply { if (u.isEmpty() || u == defaultUrl) remove(PREF_URL) else putString(PREF_URL, u) }.apply()
        manifest = null; manifestError = null
        refresh()
    }

    /** Installe exactement `langs` : base + un pack par langue. */
    fun apply(langs: List<String>) {
        val m = manifest ?: error("no manifest (server unreachable?)")
        if (status.optString("state") in setOf("downloading", "installing")) error("already downloading")
        val files = m.getJSONObject("files")
        val all = m.getJSONArray("langs").let { a -> List(a.length()) { a.getString(it) } }
        require(langs.isNotEmpty() && langs.all { it in all }) { "unknown languages: $langs" }
        val build = m.getString("build")
        val wanted = listOf("base") + langs.map { "pack-$it" }
        val sameBuild = installed()?.optString("build") == build
        val toFetch = wanted.filter { !sameBuild || !File(dir, "$it.sqlite").exists() }
        // Statut posé avant de rendre la main : le prochain sondage de l'interface voit déjà le téléchargement.
        status = JSONObject().put("state", "downloading").put("file", toFetch.firstOrNull() ?: "").put("done", 0)
            .put("total", toFetch.sumOf { files.getJSONObject(it).getLong("bytes") })
        worker.execute {
            try {
                install(files, toFetch)
                swap {
                    for (name in toFetch) File(tmp, "$name.sqlite").renameTo(File(dir, "$name.sqlite"))
                    // Fichiers d'un autre build ou d'une langue retirée.
                    for (f in dir.listFiles().orEmpty()) if (f.name.endsWith(".sqlite") && f.name.removeSuffix(".sqlite") !in wanted) f.delete()
                    installedFile.writeText(JSONObject().put("build", build).put("langs", JSONArray(langs)).toString())
                }
                tmp.deleteRecursively()
                status = JSONObject().put("state", "done")   // l'interface recharge la page : le pont rouvre le dictionnaire
                Log.i("langswap", "packs installed: $langs (build $build, ${toFetch.size} files downloaded)")
            } catch (e: Exception) {
                Log.e("langswap", "packs", e)
                tmp.deleteRecursively()
                status = JSONObject().put("state", "error").put("error", e.message ?: e.toString())
            }
        }
    }

    /** Télécharge, vérifie (taille, sha256) et décompresse `names` dans tmp/. */
    private fun install(files: JSONObject, names: List<String>) {
        tmp.deleteRecursively(); tmp.mkdirs()
        val total = names.sumOf { files.getJSONObject(it).getLong("bytes") }
        val unpacked = names.sumOf { files.getJSONObject(it).getLong("sqliteBytes") }
        // Place : archive + base décompressée en même temps, plus une marge.
        val free = StatFs(dir.path).availableBytes
        if (free < total + unpacked + 50_000_000) throw IOException("not enough space: ${(total + unpacked) / 1_000_000} MB needed, ${free / 1_000_000} MB free")
        var done = 0L
        for (name in names) {
            val f = files.getJSONObject(name)
            val url = URL(manifestUrl(), f.getString("file"))   // absolue, ou relative au manifeste
            val archive = File(tmp, "$name.archive")
            val digest = MessageDigest.getInstance("SHA-256")
            get(url).use { input ->
                archive.outputStream().use { out ->
                    val buf = ByteArray(1 shl 16)
                    while (true) {
                        val n = input.read(buf); if (n < 0) break
                        out.write(buf, 0, n); digest.update(buf, 0, n); done += n
                        status = JSONObject().put("state", "downloading").put("file", name).put("done", done).put("total", total)
                    }
                }
            }
            val sha = digest.digest().joinToString("") { "%02x".format(it) }
            if (archive.length() != f.getLong("bytes") || sha != f.getString("sha256")) throw IOException("$name: corrupted download (size or sha256 mismatch)")
            status = JSONObject().put("state", "installing").put("file", name).put("done", done).put("total", total)
            val t0 = System.nanoTime()
            archive.inputStream().buffered(1 shl 16).use { raw ->
                // xz -9e : dictionnaire de 64 Mo, donc ≈ 65 Mo de mémoire pour décompresser.
                val input = if (url.path.endsWith(".gz")) GZIPInputStream(raw, 1 shl 16) else XZInputStream(raw)
                input.use { File(tmp, "$name.sqlite").outputStream().use { out -> it.copyTo(out, 1 shl 16) } }
            }
            Log.i("langswap", "$name: unpacked ${f.getLong("sqliteBytes") / 1_000_000} MB in ${(System.nanoTime() - t0) / 1_000_000} ms")
            archive.delete()
        }
    }

    private fun installed(): JSONObject? = try { JSONObject(installedFile.readText()) } catch (e: Exception) { null }

    /** URL du manifeste : l'URL réglée si elle finit par .json, sinon <dossier>/packs.json (serve-packs). */
    private fun manifestUrl() = URL(if (serverUrl.substringBefore('?').endsWith(".json")) serverUrl else serverUrl.trimEnd('/') + "/packs.json")

    // Suit les redirections HTTPS → HTTPS (releases GitHub → objects.githubusercontent.com).
    private fun get(url: URL) = (url.openConnection() as HttpURLConnection).run {
        connectTimeout = 15_000; readTimeout = 30_000
        if (responseCode != 200) throw IOException("${url.path.substringAfterLast('/')}: HTTP $responseCode")
        inputStream
    }

    private companion object { const val PREF_URL = "packs_url" }
}
