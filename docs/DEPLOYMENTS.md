## 2026-10-24｜AI Lab 第二次部署（可靠重試）

- Worker：`starry-recorder-ai-lab`，不提供 workers.dev 或 Preview 對外網址
- Cloudflare Deployment ID：`13d70c50-f8cc-4b80-bcfc-33481418605d`
- Version ID：`5b7e7118-463b-4127-ba12-7caab3eea8d4`，已部署 100%
- 已驗證 AI 與獨立 Preview D1 綁定，且公開子網域與預覽連結仍關閉
- GitHub 驗證：https://github.com/yukidu/starry-recorder/actions/runs/39996078924 通過
- 實際新佇列工作 `synthetic-retryfix20261024a` 產生一次摘要與一次費用預留；相同工作 ID 換不同內容後未覆寫
- **還原上一版代碼：`SR-AILAB-ROLLBACK-64531C94`**，舊版 Worker `64531c94-f5c2-4919-8378-d247dc919802`
- 若需要回復，需先暫停專屬 Queue consumer，再執行舊版 Worker 切換與驗證；不得修改其他繁星 App
- 正式版 `record.starry.phd` 仍未部署

## 2026-10-24｜Cloudflare AI71 第五版 Preview 與私人佇列部署

### 唯讀狀態站（Preview v5）
- 網址：https://starry-recorder-preview.yukidu.workers.dev/
- 顯示「AI 語音、摘要、圖片辨識與私人佇列測試成功」；沒有登入、AI 端點、錄音或付款。
- Cloudflare Deployment：`ba6df23c-de5a-476b-abaa-ba3342a6a51e`。
- Cloudflare Version：`44edca64-15ae-4e76-bf09-fde2fc8c9b7b`，流量 100%。
- 最新 GitHub HTTPS 測試：https://github.com/yukidu/starry-recorder/actions/runs/39993380778（第二次嘗試成功）。
- **還原上一版代碼：`SR-PREVIEW-ROLLBACK-F9EF0061`**，目標舊版 `f9ef0061-261f-433d-b97a-98333b8524bb`。

### 無公開路由的 AI Lab Worker
- Worker：`starry-recorder-ai-lab`，workers.dev／預覽網址均停用。
- Cloudflare 最新 Deployment：`1e587af3-3b78-4f77-b8f3-18e7ccd05fdc`。
- 最新 Version：`64531c94-f5c2-4919-8378-d247dc919802`（AI 與 Preview D1 綁定）。
- 私人 Queue：`starry-recorder-ai-lab-jobs`，DLQ：`starry-recorder-ai-lab-dlq`。
- 前版 Version：`2a8a5695-9ac1-4294-81a1-7dcf635a9d77`。
- **還原舊版代碼：`SR-AILAB-ROLLBACK-2A8A5695`**。執行還原前，先停用其 Queue consumer；舊版不具 queue handler。還原後再確認工單不再進入該 Worker。
- 正式錄音 App **仍未部署**，不適用以上 Preview 還原代碼。

# 繁星 AI 錄音｜部署登記簿

> 以下「部署」僅代表獨立的無會員資料測試站，不代表正式錄音 App 上線。

## 2026-10-23｜第四次 Cloudflare Preview 部署（私人音訊規則測試進度）

- 測試網址：https://starry-recorder-preview.yukidu.workers.dev/
- 來源 GitHub 開發分支 `preview/status-worker.mjs` Commit `02ef0dd210b9a53ad4817b15e5bc3c4185779d57`
- 內容：**僅**新增私人音檔驗證入庫及授權播放「程式測試通過」的狀態說明；會員登入、真正錄音、雲端上傳、AI 與付款均**沒有啟用**。
- Cloudflare Deployment ID：`56c6d081-98a5-4925-a246-20b5fa7cf9a5`
- Cloudflare Version ID：`f9ef0061-261f-433d-b97a-98333b8524bb`，已驗證部署為 100%。
- GitHub 遠端 HTTPS Smoke test：https://github.com/yukidu/starry-recorder/actions/runs/39977280618 **成功**。
- 這次回復上一版 Preview 的代碼：**`SR-PREVIEW-ROLLBACK-0B243243`**
- 回復目標：`starry-recorder-preview` 先前 Worker Version `0b243243-294b-42af-a6ee-2e09fa3f1816`。
- 只對 Preview 有效。正式 `record.starry.phd` **仍未部署，正式還原碼不存在**。

## 2026-10-23｜第三次 Cloudflare Preview 部署（課程管理驗收進度）

- 網址：https://starry-recorder-preview.yukidu.workers.dev/
- 僅限無會員資料的唯讀狀態頁，**沒有開放登入、錄音、私人課程 API、付款或 AI 服務**。
- 來源 Commit：`67bbcbe49312883e0c327dde5b1c0971baa90e07`
- Cloudflare Deployment ID：`9b7c36d9-c0d0-47a8-a333-10d1a456c769`
- Cloudflare Version ID：`0b243243-294b-42af-a6ee-2e09fa3f1816`
- 本次部署的**舊版還原代碼**：`SR-PREVIEW-ROLLBACK-7641FCEF`
- 還原目標：上次 Preview Worker 版本 `7641fcef-d0f5-4e9e-84fd-a1f138fe344d`。僅用於 Cloudflare **Preview** 環境。
- GitHub 完整自動測試（課程隔離＋資料庫＋音檔）：https://github.com/yukidu/starry-recorder/actions/runs/39922523322 成功。
- GitHub HTTPS 公網驗證：更新後的 Smoke test 應檢查「跨會員權限測試通過」及狀態 API `ready:false`，實際測試結果另由 CI 回報。

## 2026-10-23｜第二次 Cloudflare Preview 部署（資料保護進度頁）

- 網址：https://starry-recorder-preview.yukidu.workers.dev/
- 來源：開發分支 `preview/status-worker.mjs`，提交 `e0d7b1397dc4889f94591ca2f478a986385c432b`
- 結果：Cloudflare 部署成功；無登入、錄音、個資、AI 或付款功能，僅新版唯讀狀態頁
- Cloudflare Deployment ID：`e34d87be-568d-48b8-90bb-9d519276c84f`
- 本次 Version ID：`7641fcef-d0f5-4e9e-84fd-a1f138fe344d`
- HTTPS 驗證：[GitHub Preview smoke test](https://github.com/yukidu/starry-recorder/actions/runs/39921154025) **成功**，含新版進度 ID、安全標頭、禁止私密寫入
- 本次部署的**回復舊版代碼**：**`SR-PREVIEW-ROLLBACK-9F479B66`**
- 回復目標：`starry-recorder-preview` 舊版 Worker `9f479b66-ff38-41ec-99e3-d623183ee9af`，透過 Cloudflare Workers 版本回復，完成後重新驗證 HTTPS。**僅限 Preview，正式錄音 App 無此代碼可回復。**

## 2026-10-23｜第一次 Cloudflare Preview 部署

- 環境：`starry-recorder-preview`
- 站點：https://starry-recorder-preview.yukidu.workers.dev/
- 用途：公開唯讀狀態頁、`/healthz`、安全標頭與拒絕私密寫入驗證；不收集使用者資料
- 已驗證：GitHub `Preview smoke test` https://github.com/yukidu/starry-recorder/actions/runs/39863497086
- Cloudflare Deployment ID：`c0bd392b-5766-4e8b-84e8-cf318622c83d`
- Cloudflare Version ID：`9f479b66-ff38-41ec-99e3-d623183ee9af`
- 還原識別碼：**SR-PREVIEW-20261023-9F479B66**
- 還原方式：透過 Cloudflare Workers Deployments 將 `starry-recorder-preview` 版本 `9f479b66-ff38-41ec-99e3-d623183ee9af` 的流量比例設為 100%；還原後重新檢查 `/healthz` 及首頁。**只作用於 Preview Worker，不得對正式 Worker 使用。**

## 正式部署狀態

- 尚未部署 `record.starry.phd`。
- `main` 尚未包含完整錄音 App。
- Starry ID 正式登入、M4A 驗證、AI 逐字稿與圖片 OCR、原生背景錄音、訂閱付款、合規與正式負載驗收仍未完成。
- **正式版本沒有還原代碼**：因為尚無正式部署。
