# RecordNote — Starry ID v2026-11-07.18 增量檢查

**依據**：2026-11-07.18（2026-11-08 01:25 台灣時間）。沿用 `starry-phd/RecordNote` 的 [PR #13](https://github.com/starry-phd/RecordNote/pull/13)。**不修改 Starry ID 程式／設定**。

## 本次補上的差異

- **中央會員頭像與 initials**：Web 的「設定 → 我的中央會員」及原生驗收基座改由官方 `starryClient.me()` (`GET /v1/me`) 提供 `profile.avatar_url`；頭像為 1 小時效期的簽章 HTTPS URL，Web 每次進入設定重新抓取，原生 App 啟動、回到前景及登入時重新抓取。為 null 或載入失敗時用中央回傳的 `profile.initials`，不自行以姓名產生。
- **可變動 member_no**：只作畫面與分享用途，不當 user_id、主鍵或檔名；`https://id.starry.phd/<會員編號>`、`https://id.starry.phd/Invite/<會員編號>`。Web 分享優先 `navigator.share`，不支援則複製連結；原生 App 透過 React Native `Share.share`。**分享前再次查詢 `/v1/me`** 避免會員改編號後用到舊資料。
- **電池圖示**：Web 顯示普通 `🔋 N 顆普通電池`、量子 `⚛️ N 顆量子電池`，並補上電池設定、提示及原生版錯誤文字的固定圖示。不更動結算、伺服器端免費／量子扣量次序。
- **OpenAPI 3.1**：從中央最新版本原樣更新 `vendor/starry-id/starry-id.v1.json`，保留既有 `openapi-typescript` 自動型別流程。官方前後端 SDK 逐檔確認與中央完全相同，沒有重寫。
- **沒有額外保存個資**：不新增頭像上傳、背景複製或會員獨立資料庫；會員主鍵始終沿用 Starry `user_id`。

**文件差異提醒**：中央 `integration-guide.md` 的舊章節 4/9.5 目前仍提及 App 自行上傳頭像或 `member_no` 永久不變；本次以業主更新的 v18 指令及最新 OpenAPI（具有 `member_no`、`profile.avatar_url`、`profile.initials`）為準，**未修改中央文件**。需由中央文件管理方另行更新，RecordNote 不自行改動中央。

## 第六節 11 項驗證

| 編號 | 狀態 | 判斷 |
|---|---|---|
| 1 Battery 409／503 | 已符合 | 失敗即停止 AI 任務，已有回歸測試 |
| 2 免費／量子 Battery | 已符合；顯示格式 v18 已補上 | 不新增商品或購買流程 |
| 3 前／後端官方 SDK、OpenAPI | SDK 已符合；OpenAPI v18 已補上 PR #13 | TypeScript 型別由契約產生 |
| 4 啟動 config／維護／公告 | 已符合 | 保留遠端狀態與節流、公告純文字 |
| 5 JWKS kid 輪替 | 已符合 | 後端驗證，不自製身份 |
| 6 永久刪除帳號 | 已符合 | 不可撤回、不自動取消商店訂閱 |
| 7 最新條款同意 | 已符合 | SDK consent_required |
| 8 Passkey | 已符合程式要求 | Android 與 iOS 實機仍待測試 |
| 9 客服 | 已符合 | 不帶 Token，僅登記三個欄位 |
| 10 Service Binding | 已符合（選用，未用） | 維持 HTTPS |
| 11 非必要功能 | 已符合 | 不增加序號輸入、兌換頁或商店商品 |

另：v14 已新增 Web 同瀏覽器 SSO、iOS Keychain；Android 跨 App SSO 選做仍不啟用。

## 交付與人工驗收

- Repo：`starry-phd/RecordNote`；PR：[ #13 ](https://github.com/starry-phd/RecordNote/pull/13)。
- Cloudflare 正式 Worker：`recordnote`（既有單一 Web／API）。最新線上部署 v19 為**v14**，本次 v18 **尚未部署**；`recordnote-web-preview` 來源已登記，不表示有該 Worker。
- 中央 `GET https://id.starry.phd/v1/apps/recordnote/config`：由 CI `central-registration` 連線檢查 `active`／最低版本 `0.0.0`；CI 完成後應再以該次結果確認。
- **CI 全綠前不合併**，本次未上架 Android/iOS，也未變更正式 Worker。
- 業主人工驗收：Web 用測試會員確認頭像（有圖／null）、改會員編號後公開頁／邀請連結更新、分享面板及實際登入；iOS 開發建置實測頭像／邀請分享及共同 Keychain；Android Passkey 需與實際 APK 指紋比對。Google Play 正式包請用 Play Console「App signing key certificate SHA-256」，不是 upload key；EAS／測試 APK 需另用對應簽章指紋。
