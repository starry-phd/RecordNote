# RecordNote｜Starry ID 串接指令 2026-11-09.4 差異核對

核對範圍：已上線 **RecordNote**，Repo `starry-phd/RecordNote`，既有單一正式 Cloudflare Worker `recordnote`（同時服務 `recordnote.starry.phd`、`recordnote-api.starry.phd`）。不新建會員系統、Repo、商品、帳號，也不修改 `starry-phd/id`。本 PR 僅修改 RecordNote 原始程式、測試與交接文件；不部署、不更動資料或雲端 Secrets。

來源：`starry-phd/id` 的 `docs/integration-guide.md`、`openapi/starry-id.v1.json`、`sdk/starry-client.ts`；核對時官方 OpenAPI／Client 已與 RecordNote 的 `vendor/starry-id/` 完全一致，不重複複製。

| 第六節核對 | 狀態 | 備註 |
| --- | --- | --- |
| 1. Battery 409／503 停止任務 | 已符合 | 原保護規則與 `tests/recordnote-battery-contract.test.mjs` 保留 |
| 2. 量子電池餘額及扣款順序 | 已符合 | App 以中央回傳為準，未新增商店商品 |
| 3. 官方 SDK | 已符合 | `starry-client.ts`、`starry-id.v1.json` 已與最新官方檔案一致；既有 `starry-sdk.ts` 繼續供後端使用 |
| 4. 啟動／回前景／公告 | 已符合 | 原檢查與公告顯示保留 |
| 5. JWKS 驗證與輪替 | 已符合 | 原公鑰快取與驗證保留，不修改 |
| 6. 永久刪帳提醒 | 已符合 | 原 DELETE 雙重確認與不自動取消訂閱提醒保留 |
| 7. 條款更新同意 | 已符合 | `consent_required` 保留 |
| 8. Passkey 登入及管理 | 程式已符合、實機待驗 | 原生 App 仍為登入驗收基座，須核實實際 APK 簽章與中央登記指紋相符 |
| 9. 三區塊、頭像、網址與會員頁 | **本 PR 補上頭像相對網址支援** | 09.2 已有官方三區塊、web-link、網頁 History API；09.4 新增 Web 與 Native 用 `new URL(avatar_url,'https://id.starry.phd')` 支援完整 HTTPS 和 `/media/…` 相對網址，圖片快取只依 URL 路徑且頭像更新即換圖；沒有頭像時僅使用中央回傳 initials |
| 10. Service Binding | 選用、未啟用 | 沿用現有 Worker 與網路設定 |
| 11. 差異回報 | 已整理 | 見下文待驗事項 |

## 本次程式差異

- 網頁 `cloudflare-candidate/recordnote-web.mjs`：修正 `centralAvatarUrl()` 解析相對路徑；設定頁使用解析後 `picture.uri` 而非原始相對路徑，加入 `data-cache-key` 供換圖與回歸驗證。
- 原生 `native/StarryAvatarUrl.ts` 和 `native/App.tsx`：新增安全 HTTPS 解析與穩定圖片快取 key；直接用 SDK 回傳的姓名及 initials，不自行推算。
- 唯一可部署程式 `cloudflare-candidate/recordnote-unified.mjs`：同步以上網頁修正，維持 API、登入、D1/R2/Secrets 契約不變。
- 新增 `tests/recordnote-starry-id-v2026-11-09.4-avatar.test.mjs`：驗證完整／相對／空白／非 HTTPS 頭像、快取 query/path、中央名稱及三區塊；CI 驗證前不可合併。

## 實際需要業主處理的事項

1. **GitHub 合併與正式部署各須授權**：這次只建 PR，CI 全綠後再決定是否合併並部署。
2. **Android Passkey 實機驗證**：中央已填 1 組 SHA-256，不代表所有 APK 簽章都相符。Google Play 版請在 Play Console → 應用程式完整性（App integrity）→ 應用程式簽署（App signing）取 **App signing key certificate 的 SHA-256**（非 Upload key）。EAS 測試版用 `eas credentials -p android` 找簽章金鑰資料，或對實際安裝 APK 執行 `apksigner verify --print-certs app.apk` 讀 **Signer certificate SHA-256 digest**；本機／Debug APK 也用各自實際安裝的 APK 取值。確認與 Admin Lite → RecordNote →「編輯登記資料」中的指紋相同，否則補登相應指紋。**尚未宣稱 Android Passkey 已在實機成功。**
3. **原生完整錄音功能與商店驗收**：目前 `native/App.tsx` 為中央登入驗收基座，不是完整原生錄音 App。這次沒有 App Store／Google Play 發行。

公開登記 `GET https://id.starry.phd/v1/apps/recordnote/config`：上次 GitHub CI 證實 `app_id=recordnote`、`status=active`；本 PR 仍須以新一輪 public contract CI 結果為準。
