# RecordNote 正式環境整併執行紀錄｜2026-11-07（台灣時間）

**結果：Web 與 API 已合併為一個正式 Cloudflare Worker `recordnote`，並已刪除多餘的正式 `recordnote-web` Worker。**

## 執行紀錄

- 變更前：`recordnote-api.starry.phd → recordnote`，`recordnote.starry.phd → recordnote-web`。
- 正式 API 原部署版本：`b03ff2c0-b1b1-420d-ad76-d86edc0d023e`。
- 正式 Web 原部署版本：`2ceea7b1-3c76-47b2-8cc1-acb4dc74931d`。
- GitHub 整併分支／PR：`feature/recordnote-unified-worker-20261107`／[#10](https://github.com/starry-phd/RecordNote/pull/10)。
- Staging 發布的單一 Worker 版本：`35a86b23-e23d-4287-b72a-e685ccdfad4a`；專用 D1 `RecordNote-staging`、R2 `recordnote-staging`，與正式資料隔離。
- 正式 `recordnote` 發布版本：`c6b78b77-c366-4c10-944a-69240def76de`，100% 流量。
- 已驗證正式 Worker 繼承原來的 D1 `RecordNote`、R2 `recordnote` 和 Secret **`STARRY_BATTERY_KEY`**。沒有輸出、移動、覆寫任何 Secret 值。
- 正式網站 `recordnote.starry.phd` 已在 Cloudflare 原 Custom Domain ID `9bb0a41c781c8f9d9051b894cfdff97508ea539b` 上**直接更換 Worker 指向**，不更換網址或 DNS。
- 舊 API 網址 `recordnote-api.starry.phd` 保留，並指向同一個 `recordnote` Worker。
- 切換前後透過 GitHub Actions 進行免登入、唯讀的真實 HTTP 檢查：網站首頁、同源 API、/health（D1/R2）、M4A 資源、管理頁、受保護 API 的 401 與 OPTIONS 204，均成功。
- 刪除舊 `recordnote-web` Worker 前，已完整保存其最後一份正式程式碼於 `cloudflare-archive/recordnote-web-predelete-20261107.mjs`，Gitleaks 安全檢查通過；已確認舊 Worker 無 Custom Domains、無 D1/R2/Secret、無 zone Workers routes，故刪除只會移除重複執行服務，不刪會員資料。
- Cloudflare 刪除 `recordnote-web` 回傳 `success=true`，完成後再次列出正式 Custom Domains，兩者均指向 `recordnote`。

## 故意保留的測試專案

- **`recordnote-staging`**：後續正式發布之前的獨立測試環境。
- **`recordnote-web-preview`**：舊版預覽環境；因其網址仍登記於 Starry ID 的 OAuth Web Origins，未經變更中央設定不得逕自刪除。正式產品已不再依賴此 Worker。

## 尚未完成的非本次範圍

- GitHub PR #1–#10 仍是分支／Draft PR；**Cloudflare 完成部署不代表 GitHub 已合併 `main`**。須依上游 PR 依賴關係進行人工審閱與整併。
- 尚未以真實會員驗證跨 App 登入、永久帳號刪除、RevenueCat 收費、量子電池交易及中央 Battery `reserve→commit/release`；不能聲稱這些高風險流程已完整驗收或自動啟用購買功能。
- 本次是 Cloudflare 網頁/API 正式版整併，**不是 App Store 或 Google Play 手機 App 上架**。

## 回退

若本次版本發生重大問題，可先由 Cloudflare `recordnote` 的舊部署版本 `b03ff2c0-b1b1-420d-ad76-d86edc0d023e` 回退 API，但該舊版不提供整合後網站首頁，須先恢復上述 GitHub 備份的舊 Web Worker 與 Custom Domain 才能完整回退網站。**部署回退不會還原 D1/R2 資料**；禁止未經同意操作正式資料庫。
