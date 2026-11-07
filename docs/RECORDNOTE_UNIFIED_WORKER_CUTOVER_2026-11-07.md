# RecordNote 單一 Worker 整併與安全切換｜2026-11-07

## 目標
- 正式 Cloudflare Worker 僅留 **`recordnote`**，同時處理 `GET /` 網站與 `/v1/*` API。
- 保留原有網址 `https://recordnote.starry.phd`、`https://recordnote-api.starry.phd`；兩個域名都指向同一 Worker。
- 保留原 `recordnote` 的 Cloudflare D1 `RecordNote`、R2 `recordnote`、既有 Secrets `STARRY_BATTERY_KEY`、其他 bindings。**禁止複製、替換或明文讀取任何 Secret。**
- 測試環境 `recordnote-staging` 不與正式資料共用 D1/R2；`recordnote-web-preview` 視需要保留給回歸測試，待業主另行決定。
- 合併前網站 HTML 的 `apiBase` 改為 `window.location.origin`，消除 Web→API 跨域呼叫，但公開舊 API 域名保留向後相容。

## GitHub 來源
- 後端：`cloudflare-candidate/recordnote-worker.js`
- 前端：`cloudflare-candidate/recordnote-web.mjs`
- 單一 Worker 產物：`cloudflare-candidate/recordnote-unified.mjs`
- 路由分流：`/`、`/index.html`、`/admin/metadata`、`/assets/m4a-mdta.mjs`、`/vendor/ffmpeg/*` 交 Web handler，其餘維持後端 API handler，包含 `/health`、`/v1/*`、`/s/*`。
- 單一發佈單位沒有停止開發中 `Starry ID`，也**不更動**中央帳號服務及商店訂閱資料。

## 發布安全閘門
1. PR 自動測試全綠（Web＋API 路由、錄音／登入／Battery 測試、Gitleaks）。
2. 先對 **`recordnote-staging`** 測試 D1/R2 及非破壞性健康檢查。不可指向正式資料。
3. 在 staging 確認網站畫面／播放／編輯、API `/health`、前端 `apiBase` 同源，確認 **未觸發實際中央 Battery 扣量**，有必要時以專用 staging 帳號測試。
4. 發布前記錄 `recordnote`、`recordnote-web` 目前部署版本 ID、確認 Cloudflare rollback。更新正式 `recordnote` Worker 時要 **繼承** D1/R2/Secret，不能重置 bindings。
5. 正式 `recordnote` 先保留原 `recordnote-api.starry.phd` 域名並核對 `/health`，再把 `recordnote.starry.phd` 從 `recordnote-web` 指向 `recordnote`。
6. 切換後用匿名、唯讀測試網站 HTML、後端 `/health`、M4A JS 及 HTTP/OPTIONS，檢查兩個域名沒有掉線。
7. **只有確認網頁正式域名已改綁且回歸綠燈後**，才使用 Cloudflare 删除原 `recordnote-web` Worker。刪除前先保留程式碼版本與 GitHub source snapshot；切換未成功不得刪除。
8. 如果切換失敗，立刻把網站域名還原 `recordnote-web`，後端退回原部署版本。**程式 rollback 不等於 D1/R2 資料 rollback**；不得清除正式資料。

## 重要說明
- 一個 Worker 不代表一定比較便宜；真正收益是維護方式與路由簡化。正式版與 staging 應各自獨立 Worker，因此不是整個 Cloudflare 帳號僅留一個。
- 有原生 App／深連結等功能尚未完成驗收，本次 Worker 整併不代表手機商店上架完成。
- 合併 PR 後再部署，優先採保留正在使用服務的漸進切換；不允許先刪現有 Web 再修網域。
