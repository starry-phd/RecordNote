# RecordNote｜AI 開發交接（2026-11-07 20:07 台灣時間）

> **交接依據：RecordNote「串接指令 2026-11-07.7」（17:30 台灣時間）。開始接手前，請先檢查 Starry ID Admin Lite 是否已有 RecordNote 更高版本串接指令；有新版則以新版為準，先列出差異再修改。**
>
> 本檔是進度快照；如 GitHub、Cloudflare 實際狀態已有變更，先以實際查詢為準。禁止把尚未合併或尚未部署的程式描述為已上線。

## 1. 專案及目前真實狀態

- GitHub：`https://github.com/starry-phd/RecordNote`，正式主要分支：`main`。
- **目前待審閱的唯一開放 PR：[#13](https://github.com/starry-phd/RecordNote/pull/13)**（`feature/recordnote-starry-id-v2026-11-07-7 → main`），狀態 **Draft、未合併**。本文件寫入前，該 PR 的 9 項 GitHub CI 均曾通過；本文件寫入後須再確認該 PR 最新提交的 CI。
- 已合併的歷史：PR #1、#10、#11、#12；較早重疊的堆疊式 PR #2～#8 已納入後續完整合併版並關閉。
- Cloudflare 正式 Worker：**僅 `recordnote` 一個**，同時提供網站與 API；依業主要求，舊 `recordnote-web`、`recordnote-staging`、`recordnote-web-preview` Worker 已移除。正式站 `https://recordnote.starry.phd`、原 API 子網域 `https://recordnote-api.starry.phd` 都指向 `recordnote`。
- 正式 D1／R2 與 `STARRY_BATTERY_KEY` Secret 保留，不要新增同名 Worker，不要重新建立或清除資料；隔離的測試 D1/R2 可保留以供日後暫時測試 Worker 使用。
- **PR #13 的 Passkey、客服與公告等修改還沒有部署至正式 Worker**，不可將程式測試通過誤認為真實會員功能驗收。

## 2. 已完成的增量開發（PR #13）

- 沿用中央 Starry ID 的 Google／Apple 登入中繼、nonce／state、JWT 驗簽與 JWKS 快取、登出／刪除帳號／條款同意、Battery 預留與量子電池查詢，不重寫既有流程。
- Web：新增 Passkey 登入、建立／列出／移除、取消不報錯與白話錯誤；RP ID 必須為 `id.starry.phd`。
- Web：新增「聯絡客服」，URL 只帶 `app_id=recordnote`、App 版本及通用瀏覽器裝置名稱，不帶 token／個資。
- Web：中央 `GET /v1/apps/recordnote/config` 啟動／前景檢查、暫停／停用／最低版本提示；公告依生效時間顯示且只使用純文字。
- 版本化引入 Starry ID 官方 `sdk/starry-sdk.ts`、OpenAPI 3.1；CI 自動產生型別並編入單一 Worker 的建置產物；Gitleaks 防止 `sbk_` 服務金鑰提交。
- 原生：`expo/RecordNoteStarryAuth.ts`、`expo/app.json.example` 是待整合的串接模組／範本。**尚無完整可建置的 iOS／Android Expo App，不能宣稱原生 Passkey 已完工或上架**。
- 逐項檢查詳見 `docs/RECORDNOTE_STARRY_ID_V2026-11-07.7_AUDIT.md`。

## 3. 最新驗證

- 已透過 GitHub Actions 公開 GET 驗證 `https://id.starry.phd/v1/apps/recordnote/config`：`app_id=recordnote`、`status=active`、`min_version=0.0.0`，中央公開 JWKS 可讀取。
- `starry-phd/id/config/apps.json` 仍保有 `recordnote` 登記，**來源標示為 `config/apps.json`**；依 Starry ID 官方 `docs/integration-guide.md`：「後台只能編輯後台登記的 App；`config/apps.json` 的 App 與 `account` 不能被後台覆蓋。」
- 因此，使用者在 RecordNote Admin Lite 卡片找不到「編輯登記資料」是**目前註冊來源限制**，不是操作錯誤。不要叫使用者重複找不存在的按鈕；也不要建立第二個 RecordNote。
- 舊的 `recordnote-web-preview.starry-phd.workers.dev` 雖已刪 Worker，其來源仍列在 Starry ID 中央 Web Origins；本交接**不得擅自修改 Starry ID**。

## 4. 尚待完成及阻擋事項

1. **首先處理「Android SHA-256／Apple Team ID 無法登記」的交接問題**：RecordNote 目前由中央 `config/apps.json` 管理，Admin Lite 沒有編輯入口。請向**Starry ID 專責開發 AI／業主**回報並要求官方支援的解法（例如在授權範圍內的中央登記程序，或將登記來源轉為可在 Admin Lite 編輯），**RecordNote AI 不得直接改 Starry ID 程式、設定或資料庫**。
2. 業主取得實際 **Google Play「應用程式簽署金鑰憑證」SHA-256** 及 Apple Team ID 後，按中央提供的正式登記方式完成登記；不要貼私人金鑰或帳號密碼。Play 上傳金鑰 SHA-256 不等同商店正式簽署金鑰。
3. 需完成人工審閱 PR #13、確認最新 CI 全綠，再按 PR 流程合併 `main`；未驗證前不可發布到正式 `recordnote` Worker。
4. 使用支援相關來源的真實瀏覽器，對 Web Passkey、客服／公告和登入進行端到端測試；不得以 Node 單元測試代替。
5. 若要 iOS／Android：先建立或定位真正的 Expo App 基座，接上模組、設定 `scheme=recordnote`、`ios.associatedDomains=webcredentials:id.starry.phd`，使用 development build 實機驗證，不能只把 example 檔當成正式 app.json。
6. 重要改版上線前應用隔離測試資源重新建立**暫時 staging**，驗收後再處理正式部署。不可直接在正式會員資料上執行破壞性測試。
7. 商店商品目錄目前未登記任何商品，不要自行新增商品 ID、RevenueCat 商品或付費方案。

## 5. 開發邊界及回報格式

- 嚴守：**只改 `starry-phd/RecordNote`，不改 Starry ID**；不碰正式 Secret 值；不新增 Cloudflare 永久 Worker；不刪正式資料、不擅自發布商店版本。
- 優先沿用現有 PR #13，只有缺漏才增量修正；PR 合併前應 CI 全綠。
- 每次回報：「完成結果／PR 與 CI／剩餘阻礙／業主下一步」，簡短繁體中文。
- 如使用者已取得 Android SHA-256，請先依第 4.1 項向中央 Starry ID 專責 AI 取得可用的正式登記方法，**不要誤導業主在目前不存在的欄位輸入**。
