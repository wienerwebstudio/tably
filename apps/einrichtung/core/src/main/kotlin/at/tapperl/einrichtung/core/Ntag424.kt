package at.tapperl.einrichtung.core

import java.security.SecureRandom

/** Übertragung eines APDU an den Chip (auf Android: IsoDep.transceive). */
fun interface Transceiver {
    fun transceive(apdu: ByteArray): ByteArray
}

class ChipException(message: String, val status: Int = -1) : Exception(message)

/**
 * NXP NTAG 424 DNA – die Befehle, die für die Einrichtung eines Tapperl-Stempels
 * nötig sind (Datenblatt NT4H2421Gx, AN12196).
 */
class Ntag424(private val io: Transceiver, private val random: SecureRandom = SecureRandom()) {

    private class Session(val ti: ByteArray, val encKey: ByteArray, val macKey: ByteArray) {
        var counter = 0
    }

    private var session: Session? = null

    val isAuthenticated get() = session != null

    companion object {
        const val STATUS_OK = 0x9100
        const val STATUS_MORE = 0x91AF
        const val STATUS_INTEGRITY_ERROR = 0x911E
        const val STATUS_AUTH_ERROR = 0x91AE
        const val STATUS_PERMISSION_DENIED = 0x919D
        const val NDEF_FILE = 0x02
        val ZERO_KEY = ByteArray(16)
    }

    private fun status(resp: ByteArray): Int {
        if (resp.size < 2) throw ChipException("Antwort zu kurz")
        return ((resp[resp.size - 2].toInt() and 0xff) shl 8) or (resp[resp.size - 1].toInt() and 0xff)
    }

    private fun data(resp: ByteArray) = resp.copyOfRange(0, resp.size - 2)

    // ── ISO-7816-Befehle ────────────────────────────────────────────────
    fun selectApplication() {
        val r = io.transceive("00A4040007D276000085010100".unhex())
        if (status(r) != 0x9000) throw ChipException("Das ist kein NTAG 424 DNA (Anwendung nicht gefunden).", status(r))
    }

    fun selectNdefFile() {
        val r = io.transceive("00A4000C02E104".unhex())
        if (status(r) != 0x9000) throw ChipException("NDEF-Datei nicht gefunden.", status(r))
    }

    fun readBinary(offset: Int, length: Int): ByteArray {
        val r = io.transceive(byteArrayOf(0x00, 0xB0.toByte(), (offset shr 8).toByte(), offset.toByte(), length.toByte()))
        if (status(r) != 0x9000) throw ChipException("Lesen fehlgeschlagen.", status(r))
        return data(r)
    }

    // ── Native Befehle ──────────────────────────────────────────────────
    private fun native(cmd: Int, payload: ByteArray): ByteArray {
        val apdu = byteArrayOf(0x90.toByte(), cmd.toByte(), 0, 0, payload.size.toByte()) + payload + byteArrayOf(0)
        return io.transceive(apdu)
    }

    /** AuthenticateEV2First. Gibt false zurück, wenn der Schlüssel nicht stimmt. */
    fun authenticate(keyNo: Int, key: ByteArray): Boolean {
        session = null
        val r1 = native(0x71, byteArrayOf(keyNo.toByte(), 0))
        if (status(r1) != STATUS_MORE) {
            if (status(r1) == STATUS_AUTH_ERROR) return false
            throw ChipException("Anmeldung am Chip fehlgeschlagen.", status(r1))
        }
        val rndB = Crypto.aesCbcDecrypt(key, data(r1))
        val rndA = ByteArray(16).also { random.nextBytes(it) }
        val r2 = native(0xAF, Crypto.aesCbcEncrypt(key, rndA + Crypto.rotateLeft(rndB)))
        if (status(r2) != STATUS_OK) {
            if (status(r2) == STATUS_AUTH_ERROR) return false
            throw ChipException("Anmeldung am Chip fehlgeschlagen.", status(r2))
        }
        val plain = Crypto.aesCbcDecrypt(key, data(r2))
        val ti = plain.copyOfRange(0, 4)
        if (!Crypto.rotateRight(plain.copyOfRange(4, 20)).contentEquals(rndA)) return false
        val mid = ByteArray(6) { (rndA[2 + it].toInt() xor rndB[it].toInt()).toByte() }
        val ctx = rndA.copyOfRange(0, 2) + mid + rndB.copyOfRange(6, 16) + rndA.copyOfRange(8, 16)
        session = Session(
            ti,
            Crypto.cmac(key, "A55A00010080".unhex() + ctx),
            Crypto.cmac(key, "5AA500010080".unhex() + ctx),
        )
        return true
    }

    private fun requireSession() = session ?: throw ChipException("Nicht am Chip angemeldet.")

    private fun ivFor(s: Session, label: String, counter: Int): ByteArray =
        Crypto.aesEcbEncrypt(s.encKey, label.unhex() + s.ti + le16(counter) + ByteArray(8))

    /** Befehl im Modus „Full“: Daten verschlüsselt, Befehl und Antwort per MAC gesichert. */
    private fun sendFull(cmd: Int, header: ByteArray, plain: ByteArray): ByteArray {
        val s = requireSession()
        val enc = if (plain.isEmpty()) plain else Crypto.aesCbcEncrypt(s.encKey, Crypto.padM2(plain), ivFor(s, "A55A", s.counter))
        val macIn = byteArrayOf(cmd.toByte()) + le16(s.counter) + s.ti + header + enc
        val mac = Crypto.truncateMac(Crypto.cmac(s.macKey, macIn))
        val resp = native(cmd, header + enc + mac)
        val st = status(resp)
        s.counter++
        if (st != STATUS_OK) {
            // Jeder Fehler beendet die Sitzung auf dem Chip.
            session = null
            throw ChipException("Chip-Befehl %02X fehlgeschlagen (Status %04X).".format(cmd, st), st)
        }
        val body = data(resp)
        if (body.size < 8) return ByteArray(0) // z. B. ChangeKey für Schlüssel 0 – Sitzung endet
        val respData = body.copyOfRange(0, body.size - 8)
        val expected = Crypto.truncateMac(Crypto.cmac(s.macKey, byteArrayOf(0) + le16(s.counter) + s.ti + respData))
        if (!expected.contentEquals(body.copyOfRange(body.size - 8, body.size))) throw ChipException("Antwort des Chips ist nicht authentisch.")
        return if (respData.isEmpty()) respData else Crypto.unpadM2(Crypto.aesCbcDecrypt(s.encKey, respData, ivFor(s, "5AA5", s.counter)))
    }

    /** WriteData im Modus „Plain“ (Datei mit Kommunikationsmodus Plain). */
    fun writeData(fileNo: Int, offset: Int, bytes: ByteArray) {
        var pos = 0
        while (pos < bytes.size) {
            val chunk = bytes.copyOfRange(pos, minOf(bytes.size, pos + 48))
            val resp = native(0x8D, byteArrayOf(fileNo.toByte()) + le24(offset + pos) + le24(chunk.size) + chunk)
            session?.let { it.counter++ }
            if (status(resp) != STATUS_OK) {
                session = null
                throw ChipException("Schreiben auf den Chip fehlgeschlagen.", status(resp))
            }
            pos += chunk.size
        }
    }

    fun changeFileSettings(fileNo: Int, settings: ByteArray) {
        sendFull(0x5F, byteArrayOf(fileNo.toByte()), settings)
    }

    /** Ändert einen Schlüssel. Für Schlüssel ≠ 0 muss der bisherige Wert bekannt sein. */
    fun changeKey(keyNo: Int, oldKey: ByteArray, newKey: ByteArray, version: Int) {
        val payload = if (keyNo == 0) {
            newKey + byteArrayOf(version.toByte())
        } else {
            Crypto.xor(oldKey, newKey) + byteArrayOf(version.toByte()) + Crypto.crc32nk(newKey)
        }
        sendFull(0xC4, byteArrayOf(keyNo.toByte()), payload)
        if (keyNo == 0) session = null
    }
}
