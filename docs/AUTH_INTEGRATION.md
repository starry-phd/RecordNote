# Starry ID integration contract

This app does not currently support member login and must **fail closed**. The newer Central ID v2 project explicitly states that OAuth/membership is not live; compatibility tickets are not suitable as production global user identity.

Central tracking issue: https://github.com/yukidu/Satrry-ID-Center/issues/23

Required before enabling `FEATURE_MEMBER_API`: verified dedicated RS256 JWT identity provider or equally secure introspection, stable `sub`, audience `starry-recorder`, central account restrictions and token revocation, PKCE and app-specific permissions.

`FEATURE_MEMBER_API`, `FEATURE_AUDIO_UPLOAD`, and `FEATURE_SHARING` are **disabled by default**. Media upload is further blocked until genuine M4A 16 kHz 64 kbps transcoding and validation is completed; never enable based on MIME headers alone.

All production features remain disabled until vetted end-to-end, load, billing and native phone tests pass.
