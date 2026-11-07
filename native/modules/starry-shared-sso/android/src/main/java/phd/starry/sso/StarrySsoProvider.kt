package phd.starry.sso

import android.content.ContentProvider
import android.content.ContentValues
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.os.Binder
import android.os.Bundle
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Device SSO broker owned by RecordNote. Only same-signer apps, granted a
 * signature permission, can call it. The one shared SSO token is encrypted
 * at rest with a key protected by this app's Android Keystore.
 */
class StarrySsoProvider : ContentProvider() {
  companion object {
    const val PERMISSION = "phd.starry.sso.permission.SHARED"
    private const val TOKEN_KEY = "starry.sso"
    private const val KEY_ALIAS = "phd.starry.sso.device"
    private const val CIPHER = "AES/GCM/NoPadding"
  }
  override fun onCreate() = true

  private fun requireSignedCaller() {
    val ctx = requireNotNull(context)
    if (Binder.getCallingUid() != ctx.applicationInfo.uid &&
        ctx.checkCallingPermission(PERMISSION) != PackageManager.PERMISSION_GRANTED)
      throw SecurityException("Only same-signature Starry apps may access device SSO")
  }

  private fun secret(): SecretKey {
    val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    val previous = ks.getKey(KEY_ALIAS, null) as? SecretKey
    if (previous != null) return previous
    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
    generator.init(KeyGenParameterSpec.Builder(KEY_ALIAS,
      KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setKeySize(256)
      .build())
    return generator.generateKey()
  }
  private fun encrypt(value: String): String {
    val cipher = Cipher.getInstance(CIPHER)
    cipher.init(Cipher.ENCRYPT_MODE, secret())
    return Base64.encodeToString(cipher.iv + cipher.doFinal(value.toByteArray(Charsets.UTF_8)), Base64.NO_WRAP)
  }
  private fun decrypt(value: String): String {
    val bytes = Base64.decode(value, Base64.DEFAULT)
    check(bytes.size > 12) { "Invalid shared session" }
    val cipher = Cipher.getInstance(CIPHER)
    cipher.init(Cipher.DECRYPT_MODE, secret(), GCMParameterSpec(128, bytes.copyOfRange(0, 12)))
    return String(cipher.doFinal(bytes.copyOfRange(12, bytes.size)), Charsets.UTF_8)
  }

  override fun call(method: String, arg: String?, extras: Bundle?): Bundle? {
    requireSignedCaller()
    require(arg == TOKEN_KEY) { "Unsupported device SSO key" }
    val ctx = requireNotNull(context)
    val prefs = ctx.getSharedPreferences("starry-device-sso-v1", android.content.Context.MODE_PRIVATE)
    return when (method) {
      "get" -> {
        val encrypted = prefs.getString(TOKEN_KEY, null)
        Bundle().apply { putString("value", if (encrypted == null) null else decrypt(encrypted)) }
      }
      "set" -> {
        val value = extras?.getString("value") ?: throw IllegalArgumentException("Token missing")
        require(value.length in 1..8192) { "Invalid SSO token size" }
        check(prefs.edit().putString(TOKEN_KEY, encrypt(value)).commit()) { "Secure write failed" }
        Bundle()
      }
      "remove" -> {
        check(prefs.edit().remove(TOKEN_KEY).commit()) { "Secure deletion failed" }
        Bundle()
      }
      else -> throw IllegalArgumentException("Unknown SSO operation")
    }
  }
  override fun query(uri: Uri, projection: Array<out String>?, selection: String?,
      selectionArgs: Array<out String>?, sortOrder: String?): Cursor? = null
  override fun getType(uri: Uri): String? = null
  override fun insert(uri: Uri, values: ContentValues?): Uri? = null
  override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0
  override fun update(uri: Uri, values: ContentValues?, selection: String?,
      selectionArgs: Array<out String>?): Int = 0
}
