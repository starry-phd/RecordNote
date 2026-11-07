# RecordNote｜Starry ID 2026-11-07.12 更新檢查與驗收

**版本**：2026-11-07.12（2026-11-07 22:40 台灣時間）。既有 Repo `starry-phd/RecordNote`，沿用 **Draft PR #13**：https://github.com/starry-phd/RecordNote/pull/13，不建立新 Repo、不重新串接中央會員。

## 11 項更新檢查（依中央 integration-guide.md 第 12 節）

| # | 現況 | 說明 |
|---|---|---|
| 1 Battery 409 / 503 | **已符合（沿用）** | 預留失敗即停止 AI 工作；不得開始扣費任務；仍由既有 CI 回歸 |
| 2 量子電池 | **已符合（沿用）** | 已有量子電池查詢、顯示及後端官方 `reserve` 契約；不新增商品 |
| 3 官方 SDK / OpenAPI | **已補上 PR #13** | 前端官方 `starry-client.ts` 原樣更新至中央 v12（含 SSO）；OpenAPI 原樣同步並由既有 `npm run starry:types` 產生型別；後端 `starry-sdk.ts` 已相同無需修改 |
| 4 啟動/前景/公告 | **已符合；Native v12 補強** | 中央狀態及公告沿用 SDK；Native 在每次回前景同步 SSO，遠端 config 60 秒節流；文字不當 HTML |
| 5 JWKS 驗證 | **已符合（沿用）** | ES256/iss/aud/app_id/kid，新 kid 刷新 JWKS |
| 6 立即永久刪帳 | **已符合（沿用）** | 沒有撤回期、不會取消商店訂閱，輸入 DELETE |
| 7 會員新條款同意 | **已符合（沿用）** | `consent_required` 觸發確認 |
| 8 Passkey | **已補上 PR #13** | 原生及 Web 登入按鈕與管理 UI 均在；Native 已改「隨時可新增」，移除 10 分鐘限制。**Android/iOS 實機仍待驗收** |
| 9 聯絡客服 | **已符合（沿用）** | `app_id`、`app_version`、`device`；不送 Token／其他個資 |
| 10 Service Binding | **已符合（維持 HTTPS）** | 選用，不調整正式 Worker 或金鑰 |
| 11 不須 App 內實作功能 | **已符合（沿用）** | 不加入序號／邀請碼／兌換頁／額外商品 |

## v12 新增：同一支手機跨 App 共用登入（第 13.5 節）

- **SDK 已更新；原生程式橋接已補在 PR #13，尚未完成實機與跨 App 驗收。**
- Native `StarryClient` 已傳入 `sharedStorage`；儲存鍵只允許 `starry.sso`，由官方 SDK 呼叫 SSO start/status/exchange/logout。每次啟動與回到前景呼叫 `restore()`，包含官方 `syncDeviceSignIn()`；登出按鈕改「登出所有繁星 App」。
- iOS：`ios.entitlements.keychain-access-groups` 由簽章時的 `$(AppIdentifierPrefix)` 自動取得，不直接設定 Apple Team ID；Swift bridge 讀取真實已簽章 Entitlements 中 `phd.starry.shared` 的 Keychain 群組，只在本裝置儲存。**其他繁星 App 必須宣告完全相同的群組且由同一 Apple Team 簽署。**
- Android：RecordNote 提供 **`content://phd.starry.recordnote.sso`** 供同簽章 App 透過 `phd.starry.sso.permission.SHARED`（signature 權限）存取，token 由 Android Keystore AES/GCM 加密。**RecordNote 必須已安裝並保留，其他 App 必須配合相同簽章與相同 Provider 契約；不同 Play App Signing 金鑰的 App 不能互用。**這是目前的橋接方案，非中央統一服務；未與其他 App 實機交叉測試，不可宣布「跨 App 自動登入已完成」。
- 若其他 App 沒有此橋接，仍需要各自登入；不能靠單純使用同一 Starry ID 網站或各 App 自己的 SecureStore 就自動共用。
- Web：維持官方前端 `sessionStorage`，瀏覽器沒有 iOS/Android 原生共用儲存橋接；網頁不宣稱與手機共用本機 Token。

## 網頁與環境

- 中央新登記 Web origins：`https://recordnote-web-preview.starry-phd.workers.dev` 與 `https://recordnote.starry.phd`；Relay 使用 `window.location.origin` 作返站來源，官方 SDK 驗證 nonce/state。
- Cloudflare 目前仍只有**一個正式 Worker `recordnote`**（Web+API），並未建立獨立 `recordnote-api`；保持已有架構，不新建、刪除資源。**已登記的 preview 網址不等於已建立或部署 preview Worker**；尚無 v12 Web 實際可登入的測試站。
- 完成合併或正式部署前需真實瀏覽器測試 Google／Apple／Passkey 及真實 iOS/Android App 跨 App 同步，所有 CI 完整成功、資安與真人驗收通過。

## 目前仍需業主處理（僅真正需人工）

1. Android：已在 Admin Lite 登記 1 組 SHA-256。請以**實際安裝的 APK** 指紋比對；測試 APK／EAS APK 用當次 `apksigner verify --print-certs xxx.apk`，或 `eas credentials -p android` 查憑證。Google Play 正式版需到 Play Console → App → 應用程式完整性／應用程式簽署 → **App signing key certificate SHA-256**（不是 Upload key），不同簽章需分別登記。
2. iOS：Apple Team ID 由 Starry ID 中央維護，RecordNote **不填 Team ID**；實機 build 需由相同 Team 的簽章、iOS Keychain group 與 Associated Domains 權限可用，確認 AASA 與 Passkey。
3. 業主與其他繁星 App 開發端共同確認**同一個跨 App 共用儲存契約**。Android 必須同簽章且裝有 Provider 主 App；iOS 必須同 Team/Keychain Access Group。未確認前只能算程式橋接完成，不能算全生態系 SSO 驗收完成。
4. 若需要測新版網頁登入，需核准受控測試環境及實際測試帳號操作；**不會擅自部署正式 Worker**。商店商品目前為空，不新增 RevenueCat 商品。

**本 PR 仍為 Draft：沒有合併、沒有部署、沒有修改 Starry ID。**
