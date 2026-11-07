# RecordNote × Starry ID｜2026-11-07.14 更新報告

來源：業主 v2026-11-07.14（2026-11-07 23:25 台灣時間）、中央最新 docs/integration-guide.md 第 12 與 13.5 節及官方 SDK/OpenAPI。
沿用既有 Repo starry-phd/RecordNote、PR #13；不修改 Starry ID 的程式碼或設定，不建立新 Worker。

## 本次差異

- 中央 `sdk/starry-client.ts` 及 `openapi/starry-id.v1.json` 已原樣更新至最新；CI 使用 `openapi-typescript` 產生型別；後端官方 `starry-sdk.ts` 不變。
- 網頁版：登入中繼完成後 `shareWebSignIn`；Passkey 成功後同樣採用；每次載入 `syncWebSignIn`，先判斷並處理 `completeWebSsoCheck` 回傳。登出透過 `signOutWebEverywhere`。5 分鐘節流及 one-time code 流程由官方 SDK 控制；回傳 URL 只含來源/路徑，無 Hash/Token。
- iOS：仍以 `$(AppIdentifierPrefix)phd.starry.shared` 設定 Keychain Access Group，使用支援此 group 的原生橋接，官方 SDK sharedStorage 只在 iOS 啟用；同一 Apple 開發者帳號簽署的其他 App 需使用相同群組。
- Android：**共用登入選做且目前不啟用、不阻擋 Android 上架**。移除 Android 共享憑證 Provider 註冊設定，原生登入及 Passkey 保持原設計；登入其他 Android 繁星 App 時不宣稱自動同步。
- 同一瀏覽器的繁星**網頁版**才會共用登入；**與 Android/iOS 原生 App 不連動**。開啟網頁時（或 SDK 5 分鐘節流允許的檢查）更新登入狀態。
- Passkey 仍支援不限最近登入多久新增，每位會員最多 10 把；客服、刪除、條款及 Starry Battery 既有功能不重做。

## 第 12 節 11 項檢查

| # | 狀態 | 說明 |
|---|---|---|
| 1 409/503 禁止開始 AI 任務 | 已符合 | 使用後端官方 Battery SDK，故障即停 |
| 2 免費及量子電池 | 已符合 | 不新增付費商品與 RevenueCat 商品 |
| 3 官方 SDK／OpenAPI | **已補上 PR #13** | 同步 v14，型別自動產生 |
| 4 config／維護／公告 | 已符合 | 含原生前景及 60 秒節流、公告純文字 |
| 5 JWKS 輪替 | 已符合 | 金鑰不識別 kid 時重新抓 |
| 6 立即永久刪帳 | 已符合 | 沒有撤回期、不自動取消訂閱 |
| 7 新版條款同意 | 已符合 | consent_required |
| 8 Passkey | 已符合既有介面 | Web／Native 實機操作待驗收 |
| 9 客服 | 已符合 | 只送 app_id、版本、裝置 |
| 10 Service Binding | 已符合（選用未開） | 維持 HTTPS |
| 11 不需 App 實作的功能 | 已符合 | 無邀請碼兌換、商品、通知開關等 |
| v14 Web 同瀏覽器 SSO | **已補上 PR #13** | SDK Web SSO 接入，待真人跨網站測試 |
| v14 iOS SSO | 已補上 PR #13 | Keychain 群組一致，待雙 App 實機測試 |
| v14 Android SSO | **依新版指令略過** | 選做且不阻擋上架 |

## 環境與發佈

- 既有 GitHub Repo：`starry-phd/RecordNote`（沿用），既有 Cloudflare Worker：`recordnote`（單一 Web/API，沿用，沒有建立 `recordnote-api` 或 preview）。
- 中央驗證：`GET https://id.starry.phd/v1/apps/recordnote/config` 應為 `app_id=recordnote,status=active,min_version=0.0.0`；CI 會真正 GET 檢查，不能僅憑本文宣稱最新部署已驗收。
- 已登記 Web origins：`https://recordnote-web-preview.starry-phd.workers.dev`、`https://recordnote.starry.phd`。**preview 網址已登記不表示 preview Worker 已部署**。
- PR #13 原已改為 Ready for review；在**所有 CI 全綠、必要實機/瀏覽器驗收及人工審核前不得合併**。不擅自部署、上架。

## 業主需人工操作的事項

1. Android：用實際 APK 配對 Starry ID 已登記 SHA-256；GitHub 測試 APK／EAS APK 指紋不同需分別登記。查詢 APK：`apksigner verify --print-certs 檔名.apk`、`eas credentials -p android`；Play 正式版到 Play Console → 應用程式完整性 → 應用程式簽署 → **App signing key certificate SHA-256**（不是 Upload key）。
2. iOS：需要由同一 Apple 開發者帳號簽署至少兩款繁星 App，於真實 iPhone 測試 Keychain Access Group 的共用登入/登出。**業主不用在 RecordNote 再填 Apple Team ID**。
3. Web：若要驗收真實 Google／Apple／Passkey／跨網頁連動，需要受控新版測試站，及真人測試帳號操作；部署前須業主核准。中央現有後台與正式會員不可用來做破壞性測試。
