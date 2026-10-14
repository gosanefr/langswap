// Ouverture d'une configuration de la trace : monolithe (fichier principal) ou packs (base mémoire + ATTACH).
package fr.langswap.bench

import androidx.sqlite.SQLiteConnection
import androidx.sqlite.SQLiteStatement
import androidx.sqlite.driver.bundled.BundledSQLiteDriver
import androidx.sqlite.driver.bundled.SQLITE_OPEN_CREATE
import androidx.sqlite.driver.bundled.SQLITE_OPEN_READONLY
import androidx.sqlite.driver.bundled.SQLITE_OPEN_READWRITE
import androidx.sqlite.driver.bundled.SQLITE_OPEN_URI
import androidx.sqlite.execSQL
import org.json.JSONObject
import java.io.File

class Connection(val conn: SQLiteConnection, val queries: Map<String, SQLiteStatement>) {
    fun close() { queries.values.forEach { it.close() }; conn.close() }
}

/** Ouvre la configuration `c` de trace.json. pragmas = mmap 256 Mo + cache 16 Mo par fichier. */
fun open(packsDir: File, c: JSONObject, pragmas: Boolean): Connection {
    val driver = BundledSQLiteDriver()
    val files = c.getJSONObject("files")
    val conn = if (files.has("main")) {
        driver.open(File(packsDir, files.getString("main")).path, SQLITE_OPEN_READONLY)
    } else {
        driver.open(":memory:", SQLITE_OPEN_READWRITE or SQLITE_OPEN_CREATE or SQLITE_OPEN_URI).also { db ->
            for (alias in files.keys()) db.execSQL("ATTACH 'file:${File(packsDir, files.getString(alias)).path}?mode=ro' AS $alias")
        }
    }
    if (pragmas) {
        val schemas = if (files.has("main")) listOf("main") else files.keys().asSequence().toList()
        for (s in schemas) { conn.execSQL("PRAGMA $s.mmap_size = 268435456"); conn.execSQL("PRAGMA $s.cache_size = -16000") }
    }
    val sql = c.getJSONObject("sql")
    val st = HashMap<String, SQLiteStatement>()
    for (k in sql.keys()) st[k] = conn.prepare(sql.getString(k))
    return Connection(conn, st)
}
