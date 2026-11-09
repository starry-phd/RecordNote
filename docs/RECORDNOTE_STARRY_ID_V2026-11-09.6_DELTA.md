# RecordNote｜Starry ID 2026-11-09.6 差異更新

## 只補差異

既有 Repo `starry-phd/RecordNote`、正式單一 Worker `recordnote`（同時服務 `https://recordnote.starry.phd`、`https://recordnote-api.starry.phd`）保持不變。沒有新建 Repo、重新部署 Starry ID、建立新 Worker、修改 D1/R2/Secrets 或變動商店商品。既有 Worker 名稱不按新版交接單重新命名，以免中斷正式站點。

本次新增／搬移：

1. **官方 SDK、OpenAPI**：僅同步已更新的 `starry-client.ts` 和 `starry-id.v1.json`，取得 SDK 產生的 Owner「⚙ Admin 專區」按鈕（反向填色）、`getLatestHandoff(integratedVersion)`。未改寫 SDK。
2. **Web `/admin`**：網址可直接打開、重新整理、上一頁／下一頁；每次進入及回到前景重新讀 `/v1/me`，只有 `staff_role==='owner'` 看到管理內容；SDK 按鈕只負責入口，不當成授權。
3. **最上方「串接指令」卡片**：固定目前採用 `2026-11-09.6`，呼叫官方 `starryClient.getLatestHandoff('2026-11-09.6')` 比較中央版本；有新版才顯示複製全文，顯示「更新時請 AI 只補差異，不要整份重做」。
4. **管理入口搬移（保留原功能）**：將原本設定頁的 AI 電池用量設定、超級管理員上傳容量表單移到 `/admin`，保留原表單 ID、後端 API、既有提交流程。原獨立 `/admin/metadata` 頁改導回 `/admin`，其 M4A 編輯器以同來源內嵌資產形式留在 `/admin`，並保留原安全 API。
5. **真正的後端 Owner 驗證**：既有 metadata 與 upload-policy 端點改成每次使用 `principal()` 驗證後、讀取 Starry ID `/v1/me` 的 `staff_role=owner`；AI 定價端點原本已如此驗證，不動。舊 `RECORDNOTE_SUPERADMIN_IDS` 綁定仍保留，防止意外變更 Cloudflare 設定，但不再充當管理權限。
6. **原生手機登入驗收基座**：SDK Owner 按鈕導向 App 內的 `/admin` 畫面，提供最新版本與複製指令；加上與 Expo SDK 58 對應的 `expo-clipboard`。原生基座仍非完整錄音 App，本次不送商店。

## 2026-11-09.6 更新清單

| 項目 | 結果 |
| --- | --- |
| 1 Battery 409／503 | 已符合，**未修改** |
| 2 量子電池 | 已符合，**未修改** |
| 3 官方後端 SDK | 已符合，**未修改** |
| 3 官方前端 SDK | **已補上** Owner Admin 與 handoff |
| 4 啟動、公告、維護 | 已符合，**未修改** |
| 5 JWKS 輪替 | 已符合，**未修改** |
| 6 刪帳提醒 | 已符合，**未修改** |
| 7 同意條款 | 已符合，**未修改** |
| 8 Passkey / SSO | 已符合現有程式，**未修改**；Android 仍需真機簽章驗收 |
| 9 三固定設定區塊及網址 | 原本已符合，**只新增官方 Owner 按鈕** |
| 10 Service Binding | 選用、未啟用，**未修改** |
| 11 Admin / handoff | **已補上**（本 PR） |
| 12 逐項差異回報 | 本文件 |

## 待實際驗證／業主事項

- **PR**：CI 全綠後須由業主授權合併及正式部署；本 PR 不會自行合併或發布。
- **隔離 staging**：已有 PR18 隔離預覽，但 Cloudflare 未產生其可存取網址，當時正式部署因驗收不足而停止。本 PR 不解鎖或繞過該部署關卡。
- **Android Passkey**：中央已登記一組 SHA-256，仍須確認與實際 APK 符合。Google Play 版取 Play Console → 應用程式完整性 → 應用程式簽署 → App signing key certificate 的 SHA-256（不是上傳金鑰）；EAS 版可用 `eas credentials -p android` 查金鑰，或在安裝 APK 上執行 `apksigner verify --print-certs app.apk`；本地 Debug 版使用該次實際 APK 的指紋，依版本分別核對並在 Admin Lite 補登。

## 驗證

待 GitHub CI 回報：需要完成 Web 及 Native TypeScript、單 Worker 本機測試、瀏覽器冒煙測試、GitLeaks 與 Starry ID 公開設定 `GET /v1/apps/recordnote/config`（預期 `active`）。本 PR 不修改 Starry ID 自身設定與程式。
