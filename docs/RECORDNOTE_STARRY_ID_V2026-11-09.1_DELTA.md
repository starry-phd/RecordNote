# RecordNote｜Starry ID 串接指令 2026-11-09.1 差異核對

範圍：**只做既有 App 的增量更新，不修改 starry-phd/id，不更換正式 Worker、D1、R2、Secrets，也不部署。**
原生 `native/App.tsx` 仍是登入／帳號驗收基座，**並非完整錄音 App 上架版本**。

| 指令核對項目 | 結果 | 說明 |
| --- | --- | --- |
| 1. Battery 409／503 | 沿用既有 | 原後端保留；本 PR 未改扣量 |
| 2. 量子電池中央回應 | 沿用既有 | 不自行計算，未新增商店商品 |
| 3. 官方單檔 SDK | 已符合 | 官方 `starry-client.ts` 未改；只同步官方 OpenAPI `/v1/me/web-link` |
| 4. 啟動／回前景 config、公告 | 沿用既有 | Native `checkApp`、前景檢查保留 |
| 5. JWKS 與輪替 | 沿用既有 | 原後端驗證保持不變 |
| 6. 永久刪除會員 | 已符合 | 保留原雙重確認、輸入 DELETE；移至固定四顆按鈕第 4 顆 |
| 7. 新版條款 consent | 已符合 | 原 `acceptConsent` 保留 |
| 8. Passkey | 已符合 | 登入與新增、列表、移除保留；放到固定四顆按鈕下方 |
| 9. 會員區塊與頁面 | **原生已補上（本 PR）** | `POST /v1/me/web-link {page:'card'}`、內嵌 WebView、頁面自適應高度、會員中心使用 `page:'profile'`、四顆按鈕順序固定、客服系統瀏覽器；不自行畫中央會員卡 |
| 10. Service Binding | 選用，未啟用 | 不動既有連線設定 |
| 11. 差異回報 | 已整理 | 原生變更和網頁版限制見下 |

## 平台差異與未完成事項

- **原生 iOS／Android（驗收基座）：** 加入 Expo SDK 58 建議的 `react-native-webview@14.0.1`。使用 `starryClient.request('POST','/v1/me/web-link', {page})`，僅允許 HTTPS `id.starry.phd` 內容顯示，單次網址不寫進本機儲存或日誌。返回前景、重新進設定頁會重新要求會員卡網址；其餘 member page 的網頁在 App 內呈現。Passkey 與原生登入流程不動。
- **網頁版 RecordNote：** `starry-phd/id` 的 `src/web/layout.ts` 對會員頁回應套用 `Content-Security-Policy: frame-ancestors 'none'`，跨來源的 `<iframe>` 因此**無法**在 `recordnote.starry.phd` 中顯示中央會員卡。這個限制屬 Starry ID，依業主禁令不能在本 PR 修改中央的程式或設定。故網頁版舊顯示先維持不變，避免推出一個空白會員卡；**網頁版第 9 項仍需中央提供受限且安全的嵌入方案**，不能標為已完成。
- App 會員資料頁的 `page=referral/network/apps` 使用同一個 `StarryMemberWebView`，如未來新增入口，不需另寫登入。
- **使用者／業主事項：** PR CI 全綠後由業主決定合併；原生 development build 需安裝依賴並在真實手機驗收 WebView 單次登入卡、會員中心、退出、回前景更新。尚未發佈任何商店版本。
- 公開 `GET https://id.starry.phd/v1/apps/recordnote/config` 應確認 `status=active`；若工具無法直接讀取，回報為「尚待實際 GET 驗證」，不可宣稱已驗證。
