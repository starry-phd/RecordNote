# RecordNote｜Starry ID v2026-11-08.3 更新檢查

基準：業主 2026-11-08 03:10（台灣時間）串接指令 v2026-11-08.3，以及 Starry ID 最新官方 OpenAPI。沿用 [PR #13](https://github.com/starry-phd/RecordNote/pull/13)，絕不修改中央 Starry ID。

## 新增或修正
- **主要顯示名稱**：Web 與 Expo 原生版只讀 `/v1/me` 的 `profile.shown_name`；null 時顯示中央 `profile.initials`。不再自行選用 nickname 或 display_name。排行榜若新增，必須使用 `/v1/directory/members` 的 shown_name。
- **頭像快取**：使用 signed `profile.avatar_url`，依 URL 問號前路徑作 cacheKey，**不使用 user_id 或短效簽章 query**。iOS/Android 使用 Expo Image，Web 在記憶體維持 path-based source 索引並交由瀏覽器 HTTP 快取圖片；沒有自行存頭像檔案。換圖路徑不同時更新，圖片錯誤或 null 顯示中央 initials。
- **頭像重取**：Web 進設定頁及每次前景均 `starryClient.me()`，即使中央 config 有 60 秒節流也重取；原生版每次啟動／前景還原後 `starryClient.me()`。
- **電池加碼**：中央根據公開且有填內容的欄位自行加乘。RecordNote 只顯示中央 `GET /v1/me/battery` 的普通與量子電池餘額，不算倍數、不提供兌換入口／獎勵頁。
- **API 型別**：OpenAPI 3.1 已原樣同步中央新版（Profile.shown_name、DirectoryMember.shown_name），現有 CI 自動產生型別；前後端官方 SDK 無版本差異，不重寫。

## 六、11 項檢查

| 編號 | 結果 | 說明 |
|---|---|---|
| 1 | 已符合 | Battery 409／503 停止 AI 工作 |
| 2 | 已符合 | 免費／量子電池由中央結算；不自行乘倍數 |
| 3 | 已符合；已補上 PR #13 | 官方 SDK 未重寫，OpenAPI 已同步 |
| 4 | 已符合；已補上 PR #13 | config／公告既有，Web 前景新增會員頭像重取 |
| 5 | 已符合 | JWKS kid 輪替驗證 |
| 6 | 已符合 | 立即永久刪除，不會取消商店訂閱 |
| 7 | 已符合 | consent_required 更新同意 |
| 8 | 已符合 | Passkey UI 既有；真人實機仍待驗證；加碼完全由中央負責 |
| 9 | 已符合 | 客服入口 |
| 10 | 已符合（選做） | 既有 HTTPS，不新增 Service Binding |
| 11 | 已符合；已補上 PR #13 | shown_name、頭像與獨立測試 |

既有：Web 同瀏覽器 SSO、iPhone Keychain SSO；Android 跨 App 共用登入仍選做。公開會員資料、Invite 分享與 🔋／⚛️ 仍沿用。

## Repo／Worker／驗收
- Repo：`starry-phd/RecordNote`；更新現有 PR #13（未合併）。
- Worker：既有 `recordnote` 單一 Web/API。正式版仍為先前 v14，**本次不部署**；不建立 `recordnote-api`。
- 中央登記：以 GitHub `central-registration` 真實 GET `https://id.starry.phd/v1/apps/recordnote/config` 的驗證結果為準，目標 active／最低版本 0.0.0。
- 上線前：需全 CI 綠燈並以真人會員測試主要顯示名稱／換圖與 initials、分享連結，確認圖片異常回退正常；iOS 共用 Keychain／原生 Passkey 實機待驗收。Android 內測 APK 與 Play 簽章指紋須按實際安裝版本登記：測試 APK 可用 `apksigner verify --print-certs xxx.apk`，EAS 可查 `eas credentials -p android`，Google Play 用 Play Console → 應用程式簽署的 **App signing key SHA-256**（非 Upload key）。
- 原生 App 目前仍是登入驗收基座，錄音功能未完整移植。
