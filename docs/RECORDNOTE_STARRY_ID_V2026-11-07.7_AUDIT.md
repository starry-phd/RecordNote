# RecordNote × Starry ID 更新稽核｜2026-11-07.7

**依據版本：2026-11-07.7，2026-11-07 17:30 台灣時間。**

**事實來源**：
- [Starry ID 最新整合指南](https://github.com/starry-phd/id/blob/main/docs/integration-guide.md)（第 3、4、9、11.2、11.3、12、13、14 節）
- [Starry ID OpenAPI 3.1](https://github.com/starry-phd/id/blob/main/openapi/starry-id.v1.json)
- [單檔 SDK](https://github.com/starry-phd/id/blob/main/sdk/starry-sdk.ts)
- [中央 Gitleaks 規則](https://github.com/starry-phd/id/blob/main/.gitleaks.toml)

**不變更 Starry ID** 的程式、設定、資料庫或會員記錄，也不增建 Cloudflare Worker。本專案正式 Cloudflare Worker 名稱為 `recordnote`，依業主先前要求合併 Web + API 一個 Worker；`recordnote-api` 僅是既有 DNS 子網域標記，不另建立同名 Worker。

## 第六節：11 項逐項檢查

| # | 項目 | 稽核結果 |
|---|---|---|
| 1 | Battery 409 / 503 保護 | **已符合**。後端預留失敗拒絕啟動任務；前端已有白話提示 |
| 2 | 量子電池 | **已符合查詢／扣量契約**。現有 `GET /v1/me/battery` 顯示 `quantum`；中央扣量會先用共用月額度，SDK Reservation 包含 `quantum_amount/quantum_charged`。**未建立任何商店商品與購買功能**（業主商品目錄目前空） |
| 3 | 單檔 SDK／OpenAPI 型別 | **本 PR 補上**。原樣儲存官方 SDK／OpenAPI；`npm run starry:types` 自動產型別；`npm run build:recordnote` 把官方 SDK 的 TS 轉成 JS 並編進唯一 Worker；Web 和獨立後端源碼不直接放金鑰 |
| 4 | 啟動／前景遠端配置與公告 | **本 PR 補上**。啟動與返回前景會查中央 `/v1/apps/recordnote/config`，60 秒內不連續重抓；暫停／停用／最低版本更新阻擋介面；只顯示在 `starts_at`～`ends_at` 時段內的公告，公告使用 `textContent`，不解讀 HTML；中央暫時不可用時只開訪客功能 |
| 5 | JWT／JWKS | **已符合**。後端驗 ES256／iss／aud／app_id／exp／簽章與中央會員，JWKS 五分鐘快取，陌生 kid 立即刷新 |
| 6 | 永久刪除帳號 | **已符合**。需要使用者輸入 DELETE；中央確認後清掉 Token；立即不可撤回，訂閱不會自動取消 |
| 7 | 最新條款與隱私權同意 | **已符合現有流程**。中央 `consent_required` 會顯示同意對話框 |
| 8 | Passkey | **Web 本 PR 補上** 登入、建立、列出及移除；iOS／Android **新增 Expo 串接模組與 app.json 範本，但還沒有可執行的原生 Expo App 基座，因此不能稱作手機版已完成** |
| 9 | 聯絡客服 | **Web 本 PR 補上**；只傳 `app_id`／`app_version`／`device`，使用 URLSearchParams 編碼、不帶 Token 或個資；原生有可使用的網址產生器，待 Expo UI 接入 |
| 10 | Service Binding | **已符合（選用，不啟用）**。繼續使用公開 Starry ID HTTPS，避免更動正式 Worker Binding |
| 11 | 邀請碼、Owner 公告設定、資料匯出及通知開關 | **已符合（不在 App 重複實作）**，交由 Starry ID 帳號中心處理 |

## 既有正常流程不重做
- Apple／Google 均沿用 Starry ID 瀏覽器中繼（nonce SHA-256、state、登記回傳網址、id_token 交換）；不使用原生 Apple／Google SDK。
- 唯一會員 ID：中央 `user_id`，不以電子郵件／姓名合併。
- Battery 任務代碼皆為 `recordnote.` 前綴，units 由 Owner 控制，後端檢查中央 `staff_role === 'owner'`。
- Battery Key 僅 Cloudflare Secret `STARRY_BATTERY_KEY`，不進前端、Git 或日誌。Gitleaks 使用官方精確 `sbk_...` 規則，並保留本 Repo 過去已查證的非機密例外。
- `recordnote` 單一正式 Worker、原 D1／R2／正式域名保留；本 PR 不部署、不收費、不更動中央後台。

## 真正需要業主處理
1. Starry ID Admin Lite → RecordNote → **編輯登記資料**：填 **Apple Team ID**（從 Apple Developer 取得）；未填，iOS Passkey 無法通過網域驗證。
2. Starry ID Admin Lite → RecordNote → **編輯登記資料**：填 **Android 應用程式簽署憑證 SHA-256 指紋**（Google Play Console「應用程式簽署」）；未填，Android Passkey 無法通過網域驗證。測試 build 需相對應 debug 指紋。
3. 當可執行 Expo App 建立後，由業主安排**真正的 iOS／Android development build** 與實機 Passkey／登入測試。需要商店送審時另行核准；**本 PR 不自行上架**。

## 待驗證
- 實際使用者的 Web Passkey 註冊／登入／刪除：需要支援相關來源的真實瀏覽器與 Starry ID 挑戰端點。
- 原生 `expo/RecordNoteStarryAuth.ts` 目前為可供整合的模組，不是已上架的手機 App。其 `expo/app.json.example` 必須合併進**真正的原生 App app.json**；需要 Expo development build，Expo Go 不支援 Passkey。
- GitHub PR CI 通過前禁止合併；本次修正沒有部署到正式 Cloudflare。部署必須重新產生 SDK 單一 Worker 產物：`npm run build:recordnote`。

## 登記資料
- `app_id=recordnote`; iOS／Android package=`phd.starry.recordnote`; 回傳 `recordnote://auth/{google|apple}`
- 既有網域 `https://recordnote.starry.phd` 為正式站。先前已刪除 `recordnote-web-preview` Worker，然而舊網址仍在中央已登記 Web Origins 中；**依本次指令不得修改 Starry ID 設定**。
- 即時 GET `https://id.starry.phd/v1/apps/recordnote/config` 的結果以 GitHub Actions `RecordNote Starry ID public contract` 檢查輸出為準，不以單純檔案登記代表即時 API 正常。
