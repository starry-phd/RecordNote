package phd.starry.sso

import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Reads only the central Starry SSO token via a signature-protected provider. */
class StarrySharedSsoModule : Module() {
  private val uri = Uri.parse("content://phd.starry.recordnote.sso")
  override fun definition() = ModuleDefinition {
    Name("StarrySharedSso")
    AsyncFunction("get") { key: String ->
      check(key == "starry.sso") { "Unsupported shared storage key" }
      val ctx = appContext.reactContext ?: error("Android context unavailable")
      ctx.contentResolver.call(uri, "get", key, null)?.getString("value")
    }
    AsyncFunction("set") { key: String, value: String ->
      check(key == "starry.sso") { "Unsupported shared storage key" }
      val ctx = appContext.reactContext ?: error("Android context unavailable")
      val extras = android.os.Bundle().also { it.putString("value", value) }
      ctx.contentResolver.call(uri, "set", key, extras)
      Unit
    }
    AsyncFunction("remove") { key: String ->
      check(key == "starry.sso") { "Unsupported shared storage key" }
      val ctx = appContext.reactContext ?: error("Android context unavailable")
      ctx.contentResolver.call(uri, "remove", key, null)
      Unit
    }
  }
}
