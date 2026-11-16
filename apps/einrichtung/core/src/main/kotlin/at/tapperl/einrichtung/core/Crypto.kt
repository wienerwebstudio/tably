package at.tapperl.einrichtung.core

import java.util.zip.CRC32
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

/** AES-128, AES-CMAC (RFC 4493) und die CRC-Variante des NTAG 424 DNA. */
object Crypto {
    private val ZERO_IV = ByteArray(16)

    fun aesEcbEncrypt(key: ByteArray, block: ByteArray): ByteArray {
        val c = Cipher.getInstance("AES/ECB/NoPadding")
        c.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"))
        return c.doFinal(block)
    }

    fun aesCbcEncrypt(key: ByteArray, data: ByteArray, iv: ByteArray = ZERO_IV): ByteArray {
        require(data.size % 16 == 0) { "Länge muss ein Vielfaches von 16 sein" }
        val c = Cipher.getInstance("AES/CBC/NoPadding")
        c.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), IvParameterSpec(iv))
        return c.doFinal(data)
    }

    fun aesCbcDecrypt(key: ByteArray, data: ByteArray, iv: ByteArray = ZERO_IV): ByteArray {
        require(data.size % 16 == 0) { "Länge muss ein Vielfaches von 16 sein" }
        val c = Cipher.getInstance("AES/CBC/NoPadding")
        c.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), IvParameterSpec(iv))
        return c.doFinal(data)
    }

    private fun shiftLeft(b: ByteArray): ByteArray {
        val out = ByteArray(b.size)
        var carry = 0
        for (i in b.indices.reversed()) {
            val v = b[i].toInt() and 0xff
            out[i] = ((v shl 1) or carry).toByte()
            carry = v ushr 7
        }
        return out
    }

    fun cmac(key: ByteArray, msg: ByteArray): ByteArray {
        val l = aesEcbEncrypt(key, ByteArray(16))
        val k1 = shiftLeft(l).also { if (l[0].toInt() and 0x80 != 0) it[15] = (it[15].toInt() xor 0x87).toByte() }
        val k2 = shiftLeft(k1).also { if (k1[0].toInt() and 0x80 != 0) it[15] = (it[15].toInt() xor 0x87).toByte() }
        val n = maxOf(1, (msg.size + 15) / 16)
        val complete = msg.isNotEmpty() && msg.size % 16 == 0
        val last = ByteArray(16)
        val start = (n - 1) * 16
        if (complete) {
            for (i in 0 until 16) last[i] = (msg[start + i].toInt() xor k1[i].toInt()).toByte()
        } else {
            val rest = msg.size - start
            for (i in 0 until rest) last[i] = msg[start + i]
            last[rest] = 0x80.toByte()
            for (i in 0 until 16) last[i] = (last[i].toInt() xor k2[i].toInt()).toByte()
        }
        var x = ByteArray(16)
        for (b in 0 until n - 1) {
            val block = ByteArray(16) { (x[it].toInt() xor msg[b * 16 + it].toInt()).toByte() }
            x = aesEcbEncrypt(key, block)
        }
        return aesEcbEncrypt(key, ByteArray(16) { (x[it].toInt() xor last[it].toInt()).toByte() })
    }

    /** Gekürzter MAC: Bytes an den ungeraden Positionen 1, 3, …, 15. */
    fun truncateMac(mac: ByteArray): ByteArray = ByteArray(8) { mac[it * 2 + 1] }

    /** ISO/IEC 9797-1 Methode 2: 0x80, dann Nullen bis zum Blockende. */
    fun padM2(data: ByteArray): ByteArray {
        val total = (data.size / 16 + 1) * 16
        return data.copyOf(total).also { it[data.size] = 0x80.toByte() }
    }

    fun unpadM2(data: ByteArray): ByteArray {
        val idx = data.indexOfLast { it != 0.toByte() }
        require(idx >= 0 && data[idx] == 0x80.toByte()) { "Ungültiges Padding" }
        return data.copyOf(idx)
    }

    /** CRC32 ohne abschließende Inversion („JAMCRC“), little-endian – für ChangeKey. */
    fun crc32nk(data: ByteArray): ByteArray {
        val crc = CRC32().apply { update(data) }.value.inv() and 0xffffffffL
        return byteArrayOf(crc.toByte(), (crc shr 8).toByte(), (crc shr 16).toByte(), (crc shr 24).toByte())
    }

    fun xor(a: ByteArray, b: ByteArray): ByteArray {
        require(a.size == b.size)
        return ByteArray(a.size) { (a[it].toInt() xor b[it].toInt()).toByte() }
    }

    fun rotateLeft(b: ByteArray): ByteArray = b.copyOfRange(1, b.size) + b[0]
    fun rotateRight(b: ByteArray): ByteArray = byteArrayOf(b[b.size - 1]) + b.copyOfRange(0, b.size - 1)
}

fun ByteArray.hex(): String = joinToString("") { "%02X".format(it.toInt() and 0xff) }
fun String.unhex(): ByteArray {
    val s = replace(" ", "")
    require(s.length % 2 == 0)
    return ByteArray(s.length / 2) { s.substring(it * 2, it * 2 + 2).toInt(16).toByte() }
}
fun le16(v: Int) = byteArrayOf(v.toByte(), (v shr 8).toByte())
fun le24(v: Int) = byteArrayOf(v.toByte(), (v shr 8).toByte(), (v shr 16).toByte())
