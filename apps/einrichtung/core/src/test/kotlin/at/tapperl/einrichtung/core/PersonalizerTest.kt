package at.tapperl.einrichtung.core

import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull
import kotlin.test.assertTrue
import java.io.File

class PersonalizerTest {
    private val payload = "staging.tapperl.at/t/abc123?e=${"0".repeat(32)}&c=${"0".repeat(16)}"
    private val piccOff = 7 + payload.indexOf("e=") + 2
    private val macOff = 7 + payload.indexOf("c=") + 2

    private fun data(master: String = "11".repeat(16), meta: String = "22".repeat(16), file: String = "33".repeat(16), version: Int = 1,
                     metaCand: List<String> = emptyList(), fileCand: List<String> = emptyList(), masterCand: List<String> = emptyList()) =
        ProvisioningData("abc123", version, payload, piccOff, macOff, macOff,
            master.unhex(), meta.unhex(), file.unhex(),
            masterCand.map { it.unhex() }, metaCand.map { it.unhex() }, fileCand.map { it.unhex() })

    @Test fun cmacMatchesRfc4493() {
        val key = "2b7e151628aed2a6abf7158809cf4f3c".unhex()
        assertEquals("BB1D6929E95937287FA37D129B756746", Crypto.cmac(key, ByteArray(0)).hex())
        assertEquals("070A16B46B4D4144F79BDD9DD04A287C", Crypto.cmac(key, "6bc1bee22e409f96e93d7e117393172a".unhex()).hex())
        assertEquals("DFA66747DE9AE63030CA32611497C827",
            Crypto.cmac(key, "6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e5130c81c46a35ce411".unhex()).hex())
    }

    @Test fun ndefFileLayoutMatchesServerOffsets() {
        val f = NdefFile.build(payload)
        assertEquals("e=", String(f, piccOff - 2, 2))
        assertEquals("0".repeat(32), String(f, piccOff, 32))
        assertEquals("c=", String(f, macOff - 2, 2))
        assertEquals("https://$payload", NdefFile.parseUrl(f))
    }

    @Test fun personalizesFactoryChip() {
        val chip = EmulatedNtag424()
        val steps = mutableListOf<Step>()
        val result = Personalizer(Ntag424(chip)) { steps += it }.run(data())
        assertContentEquals("11".repeat(16).unhex(), chip.keys[0])
        assertContentEquals("22".repeat(16).unhex(), chip.keys[1])
        assertContentEquals("33".repeat(16).unhex(), chip.keys[2])
        assertEquals(Step.entries.toList(), steps)
        assertNotNull(result.tapUrl)
        assertTrue(result.tapUrl!!.startsWith("https://staging.tapperl.at/t/abc123?e="))
        assertEquals(32, result.e!!.length)
        assertEquals(16, result.c!!.length)
        assertTrue(result.e != "0".repeat(32))
    }

    @Test fun sunFromPersonalizedChipIsVerifiable() {
        val chip = EmulatedNtag424()
        val r = Personalizer(Ntag424(chip)).run(data())
        val picc = Crypto.aesCbcDecrypt("22".repeat(16).unhex(), r.e!!.unhex())
        assertEquals(0xC7.toByte(), picc[0])
        assertContentEquals(chip.uid, picc.copyOfRange(1, 8))
        val ctr = picc.copyOfRange(8, 11)
        val ses = Crypto.cmac("33".repeat(16).unhex(), "3CC300010080".unhex() + chip.uid + ctr)
        assertEquals(Crypto.truncateMac(Crypto.cmac(ses, ByteArray(0))).hex(), r.c)
        // Für den Abgleich mit dem Server-Code (packages/nfc verifySun):
        System.getProperty("sunExport")?.let { File(it).writeText("""{"meta":"${"22".repeat(16)}","file":"${"33".repeat(16)}","e":"${r.e}","c":"${r.c}","uid":"${chip.uid.hex()}"}""") }
    }

    @Test fun rerunWithRotatedKeysUsesPreviousKeys() {
        val chip = EmulatedNtag424()
        Personalizer(Ntag424(chip)).run(data())
        Personalizer(Ntag424(chip)).run(data(meta = "44".repeat(16), file = "55".repeat(16), version = 2,
            metaCand = listOf("22".repeat(16)), fileCand = listOf("33".repeat(16))))
        assertContentEquals("44".repeat(16).unhex(), chip.keys[1])
        assertContentEquals("55".repeat(16).unhex(), chip.keys[2])
        assertEquals(2, chip.keyVersions[1])
    }

    @Test fun resumesAfterInterruptedRun() {
        val chip = EmulatedNtag424()
        // Abbruch nach dem Setzen von Schlüssel 1 simulieren: Schlüssel 1 ist neu, 0 und 2 noch Werkszustand
        val ntag = Ntag424(chip); ntag.selectApplication(); ntag.authenticate(0, ByteArray(16))
        ntag.changeKey(1, ByteArray(16), "22".repeat(16).unhex(), 1)
        Personalizer(Ntag424(chip)).run(data())
        assertContentEquals("11".repeat(16).unhex(), chip.keys[0])
        assertContentEquals("22".repeat(16).unhex(), chip.keys[1])
    }

    @Test fun foreignChipIsRejected() {
        val chip = EmulatedNtag424()
        chip.keys[0] = "99".repeat(16).unhex()
        val e = assertFailsWith<ChipException> { Personalizer(Ntag424(chip)).run(data()) }
        assertTrue(e.message!!.contains("unbekannten Schlüssel"))
    }

    @Test fun ndefIsWriteProtectedAfterwards() {
        val chip = EmulatedNtag424()
        Personalizer(Ntag424(chip)).run(data())
        val ntag = Ntag424(chip); ntag.selectApplication()
        assertFailsWith<ChipException> { ntag.writeData(2, 0, byteArrayOf(0, 0)) }
    }
}
