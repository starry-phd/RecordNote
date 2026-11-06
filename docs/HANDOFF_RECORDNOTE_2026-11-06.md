# RecordNote｜AI 接手交接（2026-11-06）

> 接手規則：先查實際 GitHub、Cloudflare 正式部署及 D1 結構，不要只依賴舊 README 或對話。使用者要持續完成「未來新錄音」跨裝置資料一致性及 Web＋Expo 整合；**舊錄音不回填、不修復、不自動重寫**。

## 1. 專案入口和版本

- 正式網站：https://recordnote.starry.phd/
- 管理後台：https://recordnote.starry.phd/admin/metadata
- 正式 API 網域：`https://recordnote-api.starry.phd`
- GitHub：`yukidu/starry-recorder`；本功能分支：`feature/recordnote-m4a-metadata-20261106`
- 另有 `feat/recorder-v6-foundation`（草稿 PR #1），包含 React/Vite + Worker 開發基礎，**不是目前正式站的同一份程式碼**；切勿直接把這個草稿分支覆蓋正式網站。
- GitHub `main` 尚非當前 Cloudflare Web 正式程式的完整鏡像；正式版本應以部署中 Worker 讀回的原始碼為準，再建立可重現的 GitHub 基線。切勿在不了解差異時合併／覆蓋。
- 2026-11-06 核對 Cloudflare 正式 100% 流量：
  - `recordnote-web`：`55bd8d42-ed66-491c-8d2a-6c62f55620e1`
  - `recordnote`：`9f28746c-cc1b-4375-a41a-bb7690f9f999`
- 測試 Worker 當時：`recordnote-web-preview`：`b4acbd71-8c11-49e5-b97a-15e8c65852d5`；`recordnote-staging`：`11eb29ed-5845-4b4a-b208-9df09e0ed199`。
- 這些是**交接時版本快照**，接手先重新查核 Cloudflare 是否已變動；不要無條件回滾到上述版本。

## 2. 已部署功能（仍待真實裝置端對端測試）

- 正式 Web 和 API 已部署「未來新錄音」的來源資料同步改動。原始錄音開始時間（UTC 毫秒＋IANA 時區）、GPS 經緯度／精度、地名、政策版本與寫入狀態採獨立資料模型。
- 正式 D1 新增 `rn_recording_origin_v1`，新錄音經 API `PUT /v1/media/:id/recording-origin` 寫入；`GET /v1/storage` LEFT JOIN 此表回傳錄音來源資訊。舊錄音資料仍使用舊欄位，**沒有回填**。
- 修正原因：原先手機顯示錄音時間、電腦顯示雲端 `media.created_at`（上傳時刻且可能 UTC 顯示錯誤）；GPS 原先多在手機 IndexedDB／localStorage，雲端讀不到。
- Web 已加入新錄音同步呼叫、以來源時間優先顯示日期、GPS／地名顯示、M4A `mdta` 寫入器、及上傳後的紀錄關聯。需要再次驗證實際代碼、登入有效性、雲端狀態及失敗處理。
- 超級管理員中繼資料政策為 **只套用未來錄音**；草稿／驗證／版本／回滾保留，主要操作「儲存並立即發布」。錄音開始時凍結政策版本，不自動改寫正在錄製或已完成音檔。
- 地點名稱自動欄位為 `place_name`，非 `location_date`；GPS 由使用者自願授權；臺灣村里反查使用國土測繪中心 NLSC API，需外部地名查詢另行同意；地名的最小粒度**不能保證門牌**。
- 音檔寫入失敗應保留可播放的原始錄音，不能聲稱失敗檔已寫入；不得自動公開 GPS。

## 3. GitHub 目前可接續的模組

本分支：
- `src/m4a-mdta.mjs`：QuickTime mdta M4A 寫入／讀回，設計為不重新壓縮音訊。
- `src/web-recordnote-metadata.js`：Web 端政策、地名與寫入整合輔助程式。
- `expo/RecordNoteM4aWriter.ts`：Expo 檔案系統串流寫入轉接層，**尚未驗證接入真正 Expo App**。
- `tests/m4a-mdta.test.mjs`：模組測試；請使用 Node 測試再配合真實音檔／ffprobe 驗證。
- `docs/M4A-metadata-integration.md`：較早交接文件；部分「尚未部署」敘述**已過時**，以本文件和當前 Cloudflare 檢查為準。
- 此分支目前未查到可建置的完整 Expo 主程式、`app.json`／`app.config.*` 或可用 EAS 專案；**不能聲稱 Expo App 已建置、上架、或 Android／iOS 真機測試完成**。
- `feat/recorder-v6-foundation` 是另一套較早的 React 開發基礎，可參考，但不可當作正式 RecordNote 的可直接替換主程式。

## 4. 未完成，接手優先順序

1. **實機 E2E：** Android Chrome 錄製新的 M4A → 上傳雲端 → 電腦同一 Starry ID 登入 → 核對同一媒體 ID、錄音時間（本地時區一致）、GPS、地名、長度、內容、AI／雲端狀態，包含離線／權限拒絕／重試／刪除／大檔案。
2. **M4A 真實位元組驗收：** 對 Web 和將來 Expo 的新音檔，以 ffprobe／另一解析器讀回 Apple mdta；驗證 AAC 音訊資料未損壞，確保非 M4A 或不支援格式安全回退。現有寫入器只支持部分 QuickTime 文字 mdta；**不是**所有 27＋48 欄位均已可寫。
3. **GitHub 事實來源同步：** 在新分支安全備份 Cloudflare 線上 Worker 原始碼及設定差異（不提交密鑰、Token、私有錄音），建立可重現的 Web/API 測試、CI 與釋出作業，消除 GitHub 與 Cloudflare 的程式版本落差。
4. **Expo 真正主程式：** 找到或建立與 RecordNote 正式需求一致的 Expo Router + RN + TypeScript App，連接 Starry ID／錄音／本機保存／M4A writer／新錄音 metadata API；建立 iOS／Android build 與 EAS、原生權限與背景錄音驗收。**不要直接宣告已整合**。
5. **安全與 UX：** 完整相容性矩陣、GPS 分享預設移除／明確同意、跨裝置時區、時間戳防偽／驗證、寫入狀態、政策管理回滾、長錄音低記憶體處理及監控。
6. 任何正式上線前核對既有 D1/R2 資料、權限、成本及 Cloudflare Worker 版本／回滾點；先測試、再安全部署、最後驗證正式網址。

## 5. 不可違反

- 不修改 Starry ID 中央會員來源／金鑰、舊錄音、原始 R2 音檔或無關的 H-Global 系統。
- 不為測試而讀取／曝光真正用戶錄音、Token 或私人 GPS。
- 不將 GitHub 的舊草稿主程式直接覆蓋正式 Cloudflare Worker。
- 遇到工具／平台限制，清楚報告未完成的範圍，不能將單元測試等同 iOS／Android 實機驗收。
- 使用繁體中文簡潔報告，維持 GitHub 為長期事實來源。

## 給接手 AI 的短指令

> 接續開發 RecordNote：先讀本文件、本 GitHub 功能分支及 Cloudflare 正式版，修復並驗證未來新錄音在手機、電腦間的錄音時間／時區／GPS／地名一致性，完成 M4A 中繼資料 Web 實測與 Expo 真正 App 串接；舊音檔不改。先對照、測試與備份，再經授權部署；更新 GitHub 交接與逐項驗收，勿宣稱未驗證的功能完成。


## 6. 同日接手實際查核與修補（2026-11-06）

### Cloudflare 正式部署（本次唯讀核對）
- Cloudflare Starry 帳戶 `starry.phd@gmail.com` 中，正式 `recordnote-web` 100% 流量版本仍為 `55bd8d42-ed66-491c-8d2a-6c62f55620e1`；`recordnote` API 100% 流量版本仍為 `9f28746c-cc1b-4375-a41a-bb7690f9f999`。與上文快照一致。
- 讀取正式 Worker 程式（非只看版本編號）確認 Web 有 `mdTagFutureWebRecording`、錄音來源 PUT；API 有 `rn_recording_origin_v1`、`PUT /v1/media/:id/recording-origin` 與 `GET /v1/storage` LEFT JOIN。
- 對正式 RecordNote D1 僅讀取 `sqlite_master` 的 `media`／`rn_recording_origin_v1` 建表 SQL，未讀取任何會員或錄音內容，未執行 D1/R2 寫入。來源表以 `media_id` 為主鍵，含 `client_recording_id`、UTC 毫秒、IANA 時區、GPS、地名、政策與寫入狀態。
- **未修改、部署或回退任何 Cloudflare Worker；未修改正式 D1/R2/Starry ID。**

### 正式 Worker 現有風險（尚未修正正式服務）
1. API `rnOriginRoute` 使用 `INSERT OR IGNORE`，執行後未驗證實際 D1 寫入。重試與競態可能在未落庫時收到成功回應；重試同一 ID+時間也未比較 GPS／時區／地名等全部欄位。
2. `GET /v1/storage` 的 SQL 沒有回傳 `o.client_recording_id`，跨裝置無法直接核對原始錄音 UUID 與雲端媒體 ID 的映射。
3. Web 上傳音檔與 `PUT recording-origin` 是兩次操作；第二次失敗時須保留已上傳的媒體 ID 並可安全重試，只重試來源資料 PUT，不可重新建立新錄音或重複上傳 R2。
4. 正式 Web 尚未以 Android Chrome → 桌面登入同一 Starry ID 做實際端對端驗收；真實 M4A/ffprobe 與 Expo iOS／Android 也尚未重新驗證。

### 本次 GitHub 草稿分支已交付
- `src/web-recordnote-metadata.js`：將 `mdValues()` 一併放入安全回退 `try/catch`；時間／政策格式異常時回傳原檔與 `writer_failed`，不讓中繼資料例外中斷保存錄音。
- `tests/web-recordnote-metadata.test.mjs`：UTC、非法日期、非 M4A、無啟用標籤等安全回退測試。
- `src/recording-origin-persistence.mjs`：已就正式 D1 結構撰寫**待整合**的防護 helper，使用 `ON CONFLICT(media_id) DO NOTHING`，查回全部欄位比對；相同請求冪等，差異回報 `ORIGIN_IMMUTABLE`，無落庫回報 `ORIGIN_NOT_PERSISTED`。**尚未接入正式 Worker**。
- `tests/recording-origin-persistence.test.mjs`：以假 D1 驗證新寫入、相同重試、不同 GPS 拒絕、空寫入拒絕。
- `.github/workflows/recordnote-metadata-tests.yml`：Node 22 的 PR 自動測試，不使用 Secrets、正式 D1、R2 或部署。
- 這些提交僅在 PR #2 的 Draft 分支，**不可將 isolated helper／mock 測試宣稱為正式後端修復或跨裝置 E2E 通過**。

### 後續必須完成的整合 Gate
1. 先安全匯入目前正式 Web/API 的完整可重現程式與非機密環境設定至受審分支，核對秘密資訊、綁定與版本差異；不直接以舊 GitHub 草稿覆蓋雲端。
2. 在 staging Worker 真正接入 `storeOriginVerified`，保留原身分驗證、媒體歸屬、只限新錄音及合法時間檢查，錯誤要回非 2xx，成功須有讀回證據；`GET /v1/storage` 對新錄音返回 `client_recording_id`。不能掃描／改寫舊音檔。
3. Web 實裝失敗後保留 `media_id` + 原始 UUID 的安全重試流程，驗證中斷、重登、併發、刪除及權限拒絕，不自動公開 GPS。
4. 使用隔離測試會員及**新產生**的錄音做手機→桌面跨裝置比對，再以真 M4A 的 `ffprobe`／AAC 解碼與另一解析器驗證文字 mdta。既有 helper 不代表 75 種標籤全支援。
5. 找到或建立真正 Expo 主程式後才可接線、EAS 編譯、真機 iOS／Android 驗收；Production 須在完整證據與回退準備後才發布。不得把 CI 綠燈當成上架或部署證據。


## 7. 2026-11-07 手機 M4A 中繼資料與精細地名修復

- Android 手機實際截圖：2026-11-07 02:10、約 5 秒、43KB、本機未上傳 M4A，錄音成功但顯示中繼資料寫入失敗；明細 GPS 約 24.59939,120.77735，地名顯示待設定。此為截圖，未取得原始 M4A 位元，不應誤稱已實際驗證該手機音檔。
- 修正 src/m4a-mdta.mjs 對 moof 分段式 M4A 的限制：支援經驗證的相對偏移碎片，保留全部 mdat 原位元內容，拒絕 sidx/mfra 絕對索引、tfhd absolute-base-data-offset 或加密輔助索引等可能破壞音訊的格式；不重新編碼、不回寫舊音檔，失敗一律保留原音。正式網站內嵌 MDTA_MODULE 與 standalone 原始碼一致。
- 修正 mdTagFutureWebRecording 包含 mdValues 的全流程錯誤隔離；失敗時安全顯示 errorCode，方便下次辨識設備專屬問題，勿收集密鑰、錄音內容或會員 GPS 日誌。
- 修正過嚴的定位快取比對：距離不超過 5 公尺、雙方 GPS 回報精度均不超過 35m、已由 Geoapify 確認是「附近」或行政級別，才允許沿用細地名。仍不能保證真實行政邊界，只提供有來源的附近地名；不得每次錄音自動發出 Geoapify 查詢。
- 錄音清單新增「辨識這筆 GPS 地名」按鈕，由使用者明確點擊、授權後才會查中央服務。只修改該筆在本機的顯示標籤，不改舊音檔、R2、D1、Starry ID 與 immutable origin。沒有有效 GPS 或精度 >100m 不會宣稱精細地名。
- 完整 CI 34/34 PASS：https://github.com/yukidu/starry-recorder/actions/runs/42269876836，其中生成的真實 FFmpeg fragmented AAC M4A 經 FFprobe 確認 mdta 可讀，解碼 PCM SHA-256 與原檔一致。獨立 Geoapify release gate 17/17 PASS：https://github.com/yukidu/starry-recorder/actions/runs/42269877024。
- Cloudflare RecordNote Web 最新正式 100% active version：a798c54d-ea14-4b28-8d18-e13571121fc3；deployment：95e23197-7337-4851-80d3-25a755cdc762；上一正式 Web 版本 e93d1d6d-ef17-40b5-9440-46856c78f0db 可回退。RecordNote API 8105ecb0-5c55-44c4-bd32-c6b04375c64c、Starry Location 09f5bfaf-beeb-4a5f-9be1-c790661e6d00 未修改。
- 待驗證：用戶同款手機實際 M4A 位元結構、真人授權的 GPS Geoapify 回傳，以及 Android 錄音結束與細地名顯示的端到端實機結果。新錄音若仍失敗，優先依新版安全 errorCode 與不涉及私密內容的短測試音檔追加針對性修復。
