# RecordNote Cloudflare 單一 Worker 清理｜2026-11-07

**業主目標：Cloudflare Workers 列表僅保留 `recordnote` 一項。**

## 保留
- 正式 Worker：`recordnote`，已同時提供網站及 API。
- 正式網址：`https://recordnote.starry.phd` 與 `https://recordnote-api.starry.phd`，均使用 `recordnote`。
- 正式 D1 `RecordNote`、R2 `recordnote`、Worker secrets（含 `STARRY_BATTERY_KEY`）。
- 隔離測試資料庫 D1 `RecordNote-staging`、R2 `recordnote-staging`：**不刪資料**，必要時可重新建立暫時測試 Worker。

## 刪除 Cloudflare Workers（非儲存資源）
- `recordnote-staging`：正式 Worker 的獨立測試執行個體。無正式 Custom Domain、無 cron；刪除會讓其 workers.dev 測試網址停止服務。
- `recordnote-web-preview`：舊版 Web 預覽 Worker。無正式 Custom Domain、無 cron；刪除會讓其 workers.dev 預覽網址停止服務。

## GitHub CI 改法
- 舊 `recordnote-staging-smoke.yml` 依賴永久存在的測試 Worker。
- 改以 `recordnote-unified-local-smoke.yml` 執行 Node.js 無機密、無資料寫入的 Web/API/素材模擬測試，另保留正式網址的唯讀 API 與 Web smoke tests。
- 未來若涉及正式會員登入、資料庫 migration、電池扣量或其他高風險整合，**仍需重新建立獨立 staging／使用專用測試資源驗收**；不可拿正式會員／正式資料直接做破壞性測試。

## OAuth 注意事項
- `starry-phd/id` 目前仍把 `https://recordnote-web-preview.starry-phd.workers.dev` 註冊為 RecordNote Web Origin。刪除舊預覽 Worker 不會更動現有正式 `https://recordnote.starry.phd` 登入；未來應經 Starry ID 管理流程移除此已廢止 Origin。
- 依 RecordNote 2026-11-07.3 不擅自修改中央 Starry ID 專案。

## 回復
- GitHub 的 `cloudflare-baseline`、`cloudflare-candidate` 提供測試與 Web 基準程式；現行合一源碼 `cloudflare-candidate/recordnote-unified.mjs` 位於 `main`。
- 需要測試部署時，從 GitHub 重建 Worker 並且使用隔離 D1/R2；**不可把正式 DB、正式 R2、正式 Battery 金鑰連到測試 Worker**。
