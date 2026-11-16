package at.tapperl.einrichtung

import android.app.Activity
import android.content.Intent
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.TagLostException
import android.nfc.tech.IsoDep
import android.os.Bundle
import android.provider.Settings
import android.text.InputFilter
import android.text.InputType
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import at.tapperl.einrichtung.core.ChipException
import at.tapperl.einrichtung.core.Ntag424
import at.tapperl.einrichtung.core.Personalizer
import at.tapperl.einrichtung.core.Step
import java.io.IOException
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Tapperl-Einrichtung: beschreibt einen NTAG 424 DNA mit den Schlüsseln und der
 * SUN-URL eines Tapperl-Stempels. Ablauf: Code → Chip auflegen → fertig.
 * Schlüssel liegen nur im Arbeitsspeicher und werden nie gespeichert oder geloggt.
 */
class MainActivity : Activity(), NfcAdapter.ReaderCallback {

    private sealed interface Screen {
        data object EnterCode : Screen
        data class Ready(val p: Provisioning, val code: String) : Screen
        data class Working(val p: Provisioning, val code: String, val step: Step) : Screen
        data class Done(val p: Provisioning, val activated: Boolean) : Screen
        data class Failed(val p: Provisioning, val code: String, val message: String) : Screen
    }

    private val io = Executors.newSingleThreadExecutor()
    private val busy = AtomicBoolean(false)
    private var nfc: NfcAdapter? = null
    private var screen: Screen = Screen.EnterCode
    private var apiBase = BuildConfig.DEFAULT_API
    private var prefillCode = ""
    private var loadingCode = false
    private var codeError: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        nfc = NfcAdapter.getDefaultAdapter(this)
        handleIntent(intent)
        render()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        if (busy.get()) return
        handleIntent(intent)
        screen = Screen.EnterCode
        render()
    }

    private fun handleIntent(intent: Intent?) {
        val uri = intent?.data ?: return
        if (uri.scheme != "tapperl") return
        uri.getQueryParameter("code")?.let { prefillCode = it.uppercase().filter { c -> c.isLetterOrDigit() || c == '-' }.take(20) }
        uri.getQueryParameter("api")?.let { if (isAllowedApi(it)) apiBase = it.trimEnd('/') }
        if (prefillCode.isNotEmpty()) loadCode(prefillCode)
    }

    private fun isAllowedApi(url: String): Boolean =
        Regex("^https://[a-z0-9.-]+(:\\d+)?$", RegexOption.IGNORE_CASE).matches(url) ||
            Regex("^http://(10\\.0\\.2\\.2|localhost)(:\\d+)?$").matches(url)

    override fun onResume() {
        super.onResume()
        updateReader()
    }

    override fun onPause() {
        super.onPause()
        nfc?.disableReaderMode(this)
    }

    override fun onDestroy() {
        io.shutdownNow()
        super.onDestroy()
    }

    /** Lesemodus nur aktiv, solange ein Stempel zum Beschreiben bereitsteht. */
    private fun updateReader() {
        val adapter = nfc ?: return
        val wantsChip = screen is Screen.Ready || screen is Screen.Failed || screen is Screen.Working
        if (wantsChip && adapter.isEnabled) {
            adapter.enableReaderMode(this, this, NfcAdapter.FLAG_READER_NFC_A or NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK, Bundle().apply {
                putInt(NfcAdapter.EXTRA_READER_PRESENCE_CHECK_DELAY, 1000)
            })
        } else {
            adapter.disableReaderMode(this)
        }
    }

    private fun loadCode(code: String) {
        if (loadingCode) return
        loadingCode = true
        codeError = null
        render()
        io.execute {
            val result = runCatching { Api(apiBase).fetch(code) }
            runOnUiThread {
                loadingCode = false
                result.onSuccess { screen = Screen.Ready(it, code) }
                    .onFailure { codeError = it.message ?: "Unbekannter Fehler." }
                render()
                updateReader()
            }
        }
    }

    // ── NFC ─────────────────────────────────────────────────────────────
    override fun onTagDiscovered(tag: Tag) {
        val current = screen
        val (p, code) = when (current) {
            is Screen.Ready -> current.p to current.code
            is Screen.Failed -> current.p to current.code
            else -> return
        }
        if (!busy.compareAndSet(false, true)) return
        val iso = IsoDep.get(tag)
        if (iso == null) {
            busy.set(false)
            runOnUiThread { show(Screen.Failed(p, code, "Das ist kein NTAG-424-DNA-Chip (kein ISO-DEP). Bitte einen passenden Chip verwenden.")) }
            return
        }
        try {
            iso.connect()
            iso.timeout = 5000
            val chip = Ntag424({ apdu -> iso.transceive(apdu) })
            val result = Personalizer(chip) { step -> runOnUiThread { show(Screen.Working(p, code, step)) } }.run(p.data)
            if (result.e != null && result.c != null) {
                Api(apiBase).complete(code, result.e!!, result.c!!)
                runOnUiThread { show(Screen.Done(p, activated = true)) }
            } else {
                runOnUiThread { show(Screen.Done(p, activated = false)) }
            }
        } catch (e: TagLostException) {
            runOnUiThread { show(Screen.Failed(p, code, "Chip zu früh entfernt. Bitte erneut auflegen und ruhig halten, bis „Fertig“ erscheint. Das ist unbedenklich – die Einrichtung setzt einfach neu an.")) }
        } catch (e: ChipException) {
            runOnUiThread { show(Screen.Failed(p, code, e.message ?: "Chip-Fehler.")) }
        } catch (e: ApiException) {
            runOnUiThread { show(Screen.Failed(p, code, "Der Chip ist beschrieben, aber die Bestätigung an Tapperl ist fehlgeschlagen: ${e.message} Bitte den Chip erneut auflegen.")) }
        } catch (e: IOException) {
            runOnUiThread { show(Screen.Failed(p, code, "Verbindung zum Chip unterbrochen. Bitte erneut auflegen und ruhig halten.")) }
        } finally {
            runCatching { iso.close() }
            busy.set(false)
        }
    }

    private fun show(s: Screen) {
        screen = s
        render()
        updateReader()
    }

    // ── Oberfläche ──────────────────────────────────────────────────────
    private fun dp(v: Int) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics).toInt()
    private fun color(id: Int) = getColor(id)

    private fun text(s: String, size: Float = 16f, bold: Boolean = false, colorId: Int = R.color.ink, center: Boolean = false) = TextView(this).apply {
        text = s
        textSize = size
        setTextColor(color(colorId))
        if (bold) setTypeface(typeface, Typeface.BOLD)
        if (center) gravity = Gravity.CENTER_HORIZONTAL
        setLineSpacing(0f, 1.2f)
    }

    private fun button(label: String, primary: Boolean = true, onClick: () -> Unit) = Button(this).apply {
        text = label
        isAllCaps = false
        textSize = 16f
        setTextColor(color(if (primary) R.color.surface else R.color.ink))
        background = GradientDrawable().apply {
            cornerRadius = dp(12).toFloat()
            setColor(color(if (primary) R.color.brand else R.color.surface))
            if (!primary) setStroke(dp(1), color(R.color.line))
        }
        minHeight = dp(52)
        setOnClickListener { onClick() }
    }

    private fun card(vararg children: View) = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(20), dp(20), dp(20), dp(20))
        background = GradientDrawable().apply {
            cornerRadius = dp(16).toFloat()
            setColor(color(R.color.surface))
            setStroke(dp(1), color(R.color.line))
        }
        children.forEach { addView(it) }
    }

    private fun LinearLayout.gap(h: Int) = addView(View(context), LinearLayout.LayoutParams(1, dp(h)))

    private fun render() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(32), dp(20), dp(32))
        }
        root.addView(text("tapperl", 22f, bold = true, colorId = R.color.brand))
        root.addView(text("Stempel einrichten", 14f, colorId = R.color.muted))
        root.gap(24)

        val adapter = nfc
        if (adapter == null) {
            root.addView(card(text("Dieses Handy hat kein NFC.", 18f, bold = true), text("Zum Einrichten wird ein Android-Handy mit NFC benötigt.", colorId = R.color.muted)))
            setContentView(ScrollView(this).apply { addView(root) })
            return
        }
        if (!adapter.isEnabled && screen !is Screen.EnterCode) {
            root.addView(card(
                text("NFC ist ausgeschaltet", 18f, bold = true),
                text("Bitte NFC in den Einstellungen einschalten und zurückkehren.", colorId = R.color.muted),
            ))
            root.gap(12)
            root.addView(button("NFC-Einstellungen öffnen") { startActivity(Intent(Settings.ACTION_NFC_SETTINGS)) })
            root.gap(12)
        }

        when (val s = screen) {
            is Screen.EnterCode -> renderCode(root)
            is Screen.Ready -> {
                root.addView(deviceCard(s.p))
                root.gap(20)
                root.addView(card(
                    text("Chip jetzt auflegen", 20f, bold = true),
                    text("Halte den NTAG-424-DNA-Chip flach an die Rückseite des Handys (meist mittig oder oben bei der Kamera) und bewege ihn nicht, bis „Fertig“ erscheint. Das dauert etwa zwei Sekunden.", colorId = R.color.muted),
                ))
                root.gap(16)
                root.addView(button("Anderen Code eingeben", primary = false) { show(Screen.EnterCode) })
            }
            is Screen.Working -> {
                root.addView(deviceCard(s.p))
                root.gap(20)
                val list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
                list.addView(text("Wird eingerichtet … Chip nicht bewegen", 18f, bold = true))
                list.gap(12)
                Step.entries.forEach { st ->
                    val done = st.ordinal < s.step.ordinal
                    val now = st == s.step
                    list.addView(text((if (done) "✓  " else if (now) "›  " else "•  ") + st.label, 15f, bold = now, colorId = if (done) R.color.success else if (now) R.color.ink else R.color.muted))
                }
                root.addView(card(list))
            }
            is Screen.Done -> {
                root.addView(card(
                    text("✓", 48f, bold = true, colorId = R.color.success, center = true),
                    text("Fertig!", 22f, bold = true, center = true),
                    text(
                        if (s.activated) "„${s.p.deviceName}“ ist eingerichtet und aktiv. Kunden können ab sofort Stempel sammeln."
                        else "Der Chip ist beschrieben. Halte ihn jetzt einmal an ein Handy (ohne App) – der erste Tap aktiviert den Stempel.",
                        colorId = R.color.muted, center = true,
                    ),
                ))
                root.gap(16)
                root.addView(button("Nächsten Stempel einrichten") { prefillCode = ""; show(Screen.EnterCode) })
            }
            is Screen.Failed -> {
                root.addView(deviceCard(s.p))
                root.gap(20)
                root.addView(card(
                    text("Hat nicht geklappt", 18f, bold = true, colorId = R.color.danger),
                    text(s.message, colorId = R.color.ink),
                    text("\nZum erneuten Versuch den Chip einfach wieder auflegen.", 14f, colorId = R.color.muted),
                ))
                root.gap(16)
                root.addView(button("Anderen Code eingeben", primary = false) { show(Screen.EnterCode) })
            }
        }
        setContentView(ScrollView(this).apply { isFillViewport = true; addView(root) })
    }

    private fun deviceCard(p: Provisioning) = card(
        text("Stempel", 13f, colorId = R.color.muted),
        text(p.deviceName, 20f, bold = true),
        text(p.organization, 14f, colorId = R.color.muted),
    )

    private fun renderCode(root: LinearLayout) {
        val input = EditText(this).apply {
            hint = "XXXXX-XXXXX"
            setText(prefillCode)
            textSize = 24f
            typeface = Typeface.MONOSPACE
            gravity = Gravity.CENTER
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
            filters = arrayOf(InputFilter.AllCaps(), InputFilter.LengthFilter(11))
            imeOptions = EditorInfo.IME_ACTION_GO
            contentDescription = "Einrichtungscode"
        }
        val submit = {
            val code = input.text.toString().trim()
            prefillCode = code
            if (code.isNotEmpty()) loadCode(code)
        }
        input.setOnEditorActionListener { _, id, _ -> if (id == EditorInfo.IME_ACTION_GO) { submit(); true } else false }

        root.addView(card(
            text("Einrichtungscode", 18f, bold = true),
            text("Im Tapperl-Dashboard: Stempel öffnen → „Mit Android-Handy einrichten“. Scanne dort den QR-Code oder tippe den Code hier ein.", 14f, colorId = R.color.muted),
            input,
        ))
        codeError?.let {
            root.gap(12)
            root.addView(text(it, 15f, colorId = R.color.danger))
        }
        root.gap(16)
        root.addView(button(if (loadingCode) "Wird geladen …" else "Weiter") { if (!loadingCode) submit() })
        root.gap(24)
        val host = runCatching { Uri.parse(apiBase).host }.getOrNull() ?: apiBase
        root.addView(text("Server: $host", 12f, colorId = R.color.muted))
    }
}
