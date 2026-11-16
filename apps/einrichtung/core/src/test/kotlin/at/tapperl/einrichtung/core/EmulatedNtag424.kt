package at.tapperl.einrichtung.core

import java.security.SecureRandom

/**
 * Software-Nachbau eines NTAG 424 DNA (nur die hier benötigten Befehle),
 * unabhängig vom Code in Ntag424.kt implementiert – für Tests ohne Hardware.
 */
class EmulatedNtag424(val uid: ByteArray = "04DE5F1EACC040".unhex()) : Transceiver {
    val keys = Array(5) { ByteArray(16) }
    val keyVersions = IntArray(5)
    val ndef = ByteArray(256)
    // Werkszustand laut Datenblatt: plain, Lesen/Schreiben/LesenSchreiben frei, Rechte ändern nur mit Schlüssel 0
    var fileSettings: ByteArray = byteArrayOf(0x00, 0xE0.toByte(), 0xEE.toByte())
    var sdmCounter = 0
    var log = mutableListOf<String>()

    private var appSelected = false
    private var ndefSelected = false
    private var pendingAuth: Triple<Int, ByteArray, ByteArray>? = null // keyNo, rndB, key
    private var authKey = -1
    private var ti = ByteArray(4)
    private var sesEnc = ByteArray(16)
    private var sesMac = ByteArray(16)
    private var cmdCtr = 0
    private val rnd = SecureRandom()

    private fun sw(a: Int, b: Int) = byteArrayOf(a.toByte(), b.toByte())
    private fun resetAuth() { authKey = -1; pendingAuth = null }

    override fun transceive(apdu: ByteArray): ByteArray {
        val cla = apdu[0].toInt() and 0xff
        val ins = apdu[1].toInt() and 0xff
        if (cla == 0x00) return iso(ins, apdu)
        if (cla != 0x90) return sw(0x6E, 0x00)
        val lc = apdu[4].toInt() and 0xff
        val data = apdu.copyOfRange(5, 5 + lc)
        log += "%02X".format(ins)
        return when (ins) {
            0x71 -> authFirst(data)
            0xAF -> authSecond(data)
            0x8D -> writeData(data)
            0x5F -> changeFileSettings(data)
            0xC4 -> changeKey(data)
            else -> sw(0x91, 0x1C)
        }
    }

    private fun iso(ins: Int, apdu: ByteArray): ByteArray = when (ins) {
        0xA4 -> {
            val p1 = apdu[2].toInt()
            val lc = apdu[4].toInt()
            val d = apdu.copyOfRange(5, 5 + lc)
            if (p1 == 0x04 && d.contentEquals("D2760000850101".unhex())) { appSelected = true; ndefSelected = false; resetAuth(); sw(0x90, 0) }
            else if (p1 == 0x00 && appSelected && d.contentEquals("E104".unhex())) { ndefSelected = true; sw(0x90, 0) }
            else sw(0x6A, 0x82)
        }
        0xB0 -> {
            if (!ndefSelected) sw(0x69, 0x86) else {
                val off = ((apdu[2].toInt() and 0xff) shl 8) or (apdu[3].toInt() and 0xff)
                val len = apdu[4].toInt() and 0xff
                mirror().copyOfRange(off, off + len) + sw(0x90, 0)
            }
        }
        else -> sw(0x6D, 0)
    }

    /** SUN-Spiegelung wie der echte Chip beim Lesen. */
    private fun mirror(): ByteArray {
        val out = ndef.copyOf()
        if (fileSettings[0].toInt() and 0x40 == 0) return out
        sdmCounter++
        val s = fileSettings
        val metaKeyNo = (s[5].toInt() shr 4) and 0x0f
        val fileKeyNo = s[5].toInt() and 0x0f
        fun off(i: Int) = (s[i].toInt() and 0xff) or ((s[i + 1].toInt() and 0xff) shl 8) or ((s[i + 2].toInt() and 0xff) shl 16)
        val piccOff = off(6); val macInOff = off(9); val macOff = off(12)
        val ctr = le24(sdmCounter)
        val picc = byteArrayOf(0xC7.toByte()) + uid + ctr + ByteArray(5).also { rnd.nextBytes(it) }
        val enc = Crypto.aesCbcEncrypt(keys[metaKeyNo], picc).hex().toByteArray()
        enc.copyInto(out, piccOff)
        val sesKey = Crypto.cmac(keys[fileKeyNo], "3CC300010080".unhex() + uid + ctr)
        val macInput = out.copyOfRange(macInOff, macOff)
        val mac = Crypto.truncateMac(Crypto.cmac(sesKey, macInput)).hex().toByteArray()
        mac.copyInto(out, macOff)
        return out
    }

    private fun authFirst(d: ByteArray): ByteArray {
        resetAuth()
        if (!appSelected) return sw(0x91, 0xCA.toByte().toInt() and 0xff)
        val keyNo = d[0].toInt()
        val rndB = ByteArray(16).also { rnd.nextBytes(it) }
        pendingAuth = Triple(keyNo, rndB, keys[keyNo].copyOf())
        return Crypto.aesCbcEncrypt(keys[keyNo], rndB) + sw(0x91, 0xAF)
    }

    private fun authSecond(d: ByteArray): ByteArray {
        val (keyNo, rndB, key) = pendingAuth ?: return sw(0x91, 0xCA)
        pendingAuth = null
        val plain = Crypto.aesCbcDecrypt(key, d)
        val rndA = plain.copyOfRange(0, 16)
        val rndBrot = plain.copyOfRange(16, 32)
        if (!rndBrot.contentEquals(rndB.copyOfRange(1, 16) + rndB[0])) return sw(0x91, 0xAE)
        ti = ByteArray(4).also { rnd.nextBytes(it) }
        authKey = keyNo
        cmdCtr = 0
        val sv = rndA.copyOfRange(0, 2) + ByteArray(6) { (rndA[2 + it].toInt() xor rndB[it].toInt()).toByte() } + rndB.copyOfRange(6, 16) + rndA.copyOfRange(8, 16)
        sesEnc = Crypto.cmac(key, "A55A00010080".unhex() + sv)
        sesMac = Crypto.cmac(key, "5AA500010080".unhex() + sv)
        val resp = ti + (rndA.copyOfRange(1, 16) + rndA[0]) + ByteArray(12)
        return Crypto.aesCbcEncrypt(key, resp) + sw(0x91, 0x00)
    }

    private fun macOk(cmd: Int, header: ByteArray, enc: ByteArray, mac: ByteArray): Boolean {
        val exp = Crypto.truncateMac(Crypto.cmac(sesMac, byteArrayOf(cmd.toByte()) + le16(cmdCtr) + ti + header + enc))
        return exp.contentEquals(mac)
    }

    private fun decryptCmd(enc: ByteArray): ByteArray {
        val iv = Crypto.aesEcbEncrypt(sesEnc, "A55A".unhex() + ti + le16(cmdCtr) + ByteArray(8))
        return Crypto.unpadM2(Crypto.aesCbcDecrypt(sesEnc, enc, iv))
    }

    private fun okWithMac(): ByteArray {
        cmdCtr++
        val mac = Crypto.truncateMac(Crypto.cmac(sesMac, byteArrayOf(0) + le16(cmdCtr) + ti))
        return mac + sw(0x91, 0x00)
    }

    private fun fail(code: Int): ByteArray { resetAuth(); return sw(0x91, code) }

    private fun fullCommand(cmd: Int, d: ByteArray): ByteArray? {
        if (authKey < 0) return null
        val header = d.copyOfRange(0, 1)
        val enc = d.copyOfRange(1, d.size - 8)
        if (!macOk(cmd, header, enc, d.copyOfRange(d.size - 8, d.size))) return null
        return decryptCmd(enc)
    }

    private fun changeFileSettings(d: ByteArray): ByteArray {
        val plain = fullCommand(0x5F, d) ?: return fail(0xAE)
        val changeKey = fileSettings[1].toInt() and 0x0f
        if (changeKey != 0x0E && changeKey != authKey) return fail(0x9D)
        fileSettings = plain
        return okWithMac()
    }

    private fun changeKey(d: ByteArray): ByteArray {
        val keyNo = d[0].toInt()
        val plain = fullCommand(0xC4, d) ?: return fail(0xAE)
        if (authKey != 0) return fail(0x9D)
        if (keyNo == 0) {
            keys[0] = plain.copyOfRange(0, 16)
            keyVersions[0] = plain[16].toInt()
            resetAuth()
            return sw(0x91, 0x00)
        }
        val newKey = Crypto.xor(plain.copyOfRange(0, 16), keys[keyNo])
        if (!Crypto.crc32nk(newKey).contentEquals(plain.copyOfRange(17, 21))) return fail(0x1E)
        keys[keyNo] = newKey
        keyVersions[keyNo] = plain[16].toInt()
        return okWithMac()
    }

    private fun writeData(d: ByteArray): ByteArray {
        val write = fileSettings[2].toInt() and 0x0f
        val rw = (fileSettings[1].toInt() shr 4) and 0x0f
        val allowed = write == 0x0E || rw == 0x0E || authKey == write || authKey == rw
        if (authKey >= 0) cmdCtr++
        if (!allowed) return fail(0x9D)
        val off = (d[1].toInt() and 0xff) or ((d[2].toInt() and 0xff) shl 8) or ((d[3].toInt() and 0xff) shl 16)
        val len = (d[4].toInt() and 0xff) or ((d[5].toInt() and 0xff) shl 8)
        d.copyInto(ndef, off, 7, 7 + len)
        return sw(0x91, 0x00)
    }
}
