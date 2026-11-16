package at.tapperl.einrichtung

import at.tapperl.einrichtung.core.ProvisioningData
import at.tapperl.einrichtung.core.unhex
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

class ApiException(message: String) : Exception(message)

data class Provisioning(val deviceName: String, val organization: String, val data: ProvisioningData)

/** Minimaler Client für die Einrichtungs-Endpunkte der Tapperl-API. */
class Api(private val baseUrl: String) {

    private fun post(path: String, body: JSONObject): JSONObject {
        val conn = (URL(baseUrl.trimEnd('/') + path).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 15_000
            readTimeout = 20_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Accept", "application/json")
            useCaches = false
        }
        try {
            conn.outputStream.use { it.write(body.toString().toByteArray()) }
            val status = conn.responseCode
            val text = (if (status in 200..299) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
            val json = runCatching { JSONObject(text) }.getOrNull()
            if (status !in 200..299) {
                val msg = json?.optJSONObject("error")?.optString("message")?.takeIf { it.isNotBlank() }
                throw ApiException(msg ?: if (status == 429) "Zu viele Versuche. Bitte kurz warten." else "Serverfehler ($status).")
            }
            return json ?: throw ApiException("Unerwartete Antwort vom Server.")
        } catch (e: IOException) {
            throw ApiException("Keine Verbindung zum Tapperl-Server. Bitte Internet prüfen.")
        } finally {
            conn.disconnect()
        }
    }

    private fun JSONArray?.keys(): List<ByteArray> =
        if (this == null) emptyList() else (0 until length()).map { getString(it).unhex() }

    fun fetch(code: String): Provisioning {
        val r = post("/devices/v1/provisioning/fetch", JSONObject().put("code", code))
        val device = r.getJSONObject("device")
        val profile = r.getJSONObject("profile")
        val keys = r.getJSONObject("keys")
        val prev = r.optJSONObject("previousKeys")
        return Provisioning(
            deviceName = device.getString("name"),
            organization = device.optString("organization"),
            data = ProvisioningData(
                publicId = device.getString("publicId"),
                keyVersion = r.getInt("keyVersion") and 0xff,
                ndefUriPayload = profile.getString("ndefUriPayload"),
                piccDataOffset = profile.getInt("piccDataOffset"),
                sdmMacInputOffset = profile.getInt("sdmMacInputOffset"),
                sdmMacOffset = profile.getInt("sdmMacOffset"),
                masterKey = keys.getString("master").unhex(),
                metaKey = keys.getString("sdmMetaRead").unhex(),
                fileKey = keys.getString("sdmFileRead").unhex(),
                masterCandidates = emptyList(),
                metaCandidates = prev?.optJSONArray("sdmMetaRead").keys(),
                fileCandidates = prev?.optJSONArray("sdmFileRead").keys(),
            ),
        )
    }

    fun complete(code: String, e: String, c: String) {
        post("/devices/v1/provisioning/complete", JSONObject().put("code", code).put("e", e).put("c", c))
    }
}
