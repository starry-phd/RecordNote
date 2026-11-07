# RecordNote × Starry ID 第二階段：中央電池餘額與會員帳號刪除

串接指令版本：**2026-11-07.3**

## 本次新增（Web 端開發分支）

- **會員餘額（唯讀）**：使用會員 Access Token 呼叫 `GET https://id.starry.phd/v1/me/battery`；顯示當月共用電池額度、已用／預留／剩餘／重置日期，以及此 App 專用量子電池的可用與預留顆數。手動重新讀取不涉及 `reserve`、`commit` 或 `release`。
- **正式定義**：繁星電池艙 Starry Battery＝「會員共用的消費用量月額度」，不限 AI；量子電池僅該 App 可用，中央先使用共用月額度，再使用本 App 額外額度。
- **中央帳號刪除（App 內入口）**：在「設定 → Starry ID」新增「永久刪除中央帳號」，強制使用者鍵入 `DELETE` 才能送出 `POST https://id.starry.phd/v1/me/deletion` 的 `{"confirm":true}`。
- **刪除後**：只有中央 API 確認 `status=deleted` 才清空本機登入 Token，返回訪客狀態。文案警告立即不可復原、會影響其他 Starry Apps，且**不會自動取消訂閱**。不會在無操作、登出或開頁面時自行刪除。
- **資料分離**：RecordNote 自己的雲端錄音／個人資料刪除是另一個既有功能；中央帳號刪除不代表自動確認 RecordNote 端資料已清理。跨服務刪除驗收需另列正式上線門檻。
- **原登入流程保留**：Google／Apple 的 Starry ID 瀏覽器中繼、nonce、state、refresh 與中央條款同意流程不重寫，避免破壞既有用戶登入。
- **安全**：不將 `STARRY_BATTERY_KEY` 暴露到前端；餘額只用會員 Access Token 查詢，不新增付費購買流程。

## 尚未宣稱完成

- Expo 原生 iOS／Android 登入 UI、Deep Link、SecureStore 及上架測試：此 Repository 目前尚無可供完整建置的 Expo App 基座（只有部分 Expo 功能檔），需在正式 Expo 專案對接驗收。
- 量子電池的 RevenueCat 商品、購買／退款／恢復購買：必須等 Owner 決定付費方案與商店商品後，另行實作，**沒有自動建立或收費**。
- 中央 `recordnote` App 的即時 API 狀態、Battery 啟用和金鑰設定、正式 Cloudflare 環境、會員帳號實際永久刪除流程：尚未以真實會員與 staging 完成端到端驗證。
- OpenAPI TypeScript 類型自動生成與官方 SDK 替換：後端改造仍待獨立 PR。

## 驗證要求

- `node --test tests/recordnote-member-battery-deletion.test.mjs`
- `node --test tests/*.test.mjs`
- 機密掃描、定位回歸、UI 回歸與所有既有 GitHub CI 必須通過。
- 本 PR 是前一修補 PR #7 的下游；先按 PR #1–#7 的順序審查並合併，才可處理本 PR。未經授權不得直接改寫 `main` 或正式部署。
