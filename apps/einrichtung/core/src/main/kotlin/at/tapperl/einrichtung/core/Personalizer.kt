package at.tapperl.einrichtung.core

/** Daten vom Tapperl-Server für genau einen Stempel. */
data class ProvisioningData(
    val publicId: String,
    val keyVersion: Int,
    /** NDEF-URI ohne „https://“, mit Platzhaltern für e= und c= */
    val ndefUriPayload: String,
    val piccDataOffset: Int,
    val sdmMacInputOffset: Int,
    val sdmMacOffset: Int,
    val masterKey: ByteArray,
    val metaKey: ByteArray,
    val fileKey: ByteArray,
    /** Mögliche aktuelle Werte der Schlüssel auf dem Chip (z. B. Werkszustand, vorige Version) */
    val masterCandidates: List<ByteArray>,
    val metaCandidates: List<ByteArray>,
    val fileCandidates: List<ByteArray>,
)

data class PersonalizationResult(val uidHex: String?, val tapUrl: String?, val e: String?, val c: String?)

enum class Step(val label: String) {
    CONNECT("Chip erkannt"),
    AUTH("Anmeldung am Chip"),
    WRITE_URL("Tapperl-Adresse schreiben"),
    SETTINGS("Sicherheitsfunktion (SUN) einschalten"),
    KEYS("Schlüssel setzen"),
    MASTER("Chip sperren"),
    VERIFY("Prüfen"),
}

object NdefFile {
    const val URI_PAYLOAD_OFFSET = 7

    /** NLEN (2 Byte) + kurzer NDEF-URI-Record mit Präfix 0x04 (https://). */
    fun build(uriPayload: String): ByteArray {
        val uri = uriPayload.toByteArray(Charsets.US_ASCII)
        require(uri.size + 1 <= 255) { "URL zu lang" }
        val record = byteArrayOf(0xD1.toByte(), 0x01, (uri.size + 1).toByte(), 'U'.code.toByte(), 0x04) + uri
        return byteArrayOf((record.size shr 8).toByte(), record.size.toByte()) + record
    }

    /** Liest die URL aus dem Inhalt der NDEF-Datei. */
    fun parseUrl(file: ByteArray): String? {
        if (file.size < 7) return null
        val nlen = ((file[0].toInt() and 0xff) shl 8) or (file[1].toInt() and 0xff)
        if (nlen < 5 || file.size < 2 + nlen) return null
        if (file[2] != 0xD1.toByte() || file[3] != 0x01.toByte() || file[5] != 'U'.code.toByte()) return null
        val len = file[4].toInt() and 0xff
        val prefix = when (file[6].toInt()) { 0x04 -> "https://"; 0x03 -> "http://"; 0x02 -> "https://www."; 0x01 -> "http://www."; else -> "" }
        return prefix + String(file, 7, len - 1, Charsets.US_ASCII)
    }

    /** ChangeFileSettings-Daten für Datei 02: SDM an, Klartext, Lesen frei, Schreiben nur mit Schlüssel 0. */
    fun sdmSettings(piccDataOffset: Int, macInputOffset: Int, macOffset: Int): ByteArray =
        byteArrayOf(
            0x40, // SDM aktiviert, Kommunikation „plain“
            0x00, // Lesen+Schreiben: Schlüssel 0 · Rechte ändern: Schlüssel 0
            0xE0.toByte(), // Lesen: frei · Schreiben: Schlüssel 0
            0xC1.toByte(), // UID spiegeln, Lesezähler spiegeln, ASCII-Kodierung
            0xF1.toByte(), // Zählerabruf: Schlüssel 1
            0x12, // PICCData-Verschlüsselung: Schlüssel 1 · SDM-MAC: Schlüssel 2
        ) + le24(piccDataOffset) + le24(macInputOffset) + le24(macOffset)
}

/**
 * Richtet einen fabrikneuen (oder bereits für Tapperl eingerichteten) NTAG 424 DNA ein.
 * Der Ablauf ist wiederholbar: bricht er ab, kann der Chip einfach erneut aufgelegt werden.
 */
class Personalizer(private val chip: Ntag424, private val onStep: (Step) -> Unit = {}) {

    private fun authMaster(candidates: List<ByteArray>): ByteArray {
        for (k in candidates) if (chip.authenticate(0, k)) return k
        throw ChipException("Der Chip ist mit einem unbekannten Schlüssel gesperrt. Er gehört vermutlich zu einem anderen System.")
    }

    private fun setKey(keyNo: Int, newKey: ByteArray, version: Int, oldCandidates: List<ByteArray>, master: ByteArray) {
        val tried = mutableListOf<ByteArray>()
        for (old in oldCandidates) {
            if (tried.any { it.contentEquals(old) }) continue
            tried += old
            if (!chip.isAuthenticated) authMaster(listOf(master))
            try {
                chip.changeKey(keyNo, old, newKey, version)
                return
            } catch (e: ChipException) {
                if (e.status != Ntag424.STATUS_INTEGRITY_ERROR) throw e
                // Falscher Altwert → Chip beendet die Sitzung, nächsten Kandidaten probieren.
            }
        }
        throw ChipException("Schlüssel $keyNo auf dem Chip ist unbekannt. Der Chip kann nicht eingerichtet werden.")
    }

    fun run(data: ProvisioningData): PersonalizationResult {
        onStep(Step.CONNECT)
        chip.selectApplication()

        onStep(Step.AUTH)
        val masterCandidates = (listOf(data.masterKey) + data.masterCandidates + listOf(Ntag424.ZERO_KEY)).distinctBy { it.hex() }
        val currentMaster = authMaster(masterCandidates)

        onStep(Step.WRITE_URL)
        val file = NdefFile.build(data.ndefUriPayload)
        chip.writeData(Ntag424.NDEF_FILE, 0, file)

        onStep(Step.SETTINGS)
        chip.changeFileSettings(Ntag424.NDEF_FILE, NdefFile.sdmSettings(data.piccDataOffset, data.sdmMacInputOffset, data.sdmMacOffset))

        onStep(Step.KEYS)
        val metaOld = (listOf(Ntag424.ZERO_KEY, data.metaKey) + data.metaCandidates).distinctBy { it.hex() }
        val fileOld = (listOf(Ntag424.ZERO_KEY, data.fileKey) + data.fileCandidates).distinctBy { it.hex() }
        setKey(1, data.metaKey, data.keyVersion, metaOld, currentMaster)
        setKey(2, data.fileKey, data.keyVersion, fileOld, currentMaster)

        onStep(Step.MASTER)
        if (!currentMaster.contentEquals(data.masterKey)) {
            if (!chip.isAuthenticated) authMaster(listOf(currentMaster))
            chip.changeKey(0, currentMaster, data.masterKey, data.keyVersion)
        }

        onStep(Step.VERIFY)
        return try {
            chip.selectApplication()
            chip.selectNdefFile()
            val content = chip.readBinary(0, file.size)
            val url = NdefFile.parseUrl(content)
            val query = url?.substringAfter('?', "")?.split('&')?.associate { it.substringBefore('=') to it.substringAfter('=', "") }
            PersonalizationResult(null, url, query?.get("e"), query?.get("c"))
        } catch (e: ChipException) {
            PersonalizationResult(null, null, null, null)
        }
    }
}
