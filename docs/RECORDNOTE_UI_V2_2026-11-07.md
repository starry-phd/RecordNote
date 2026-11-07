# RecordNote UI v2｜整體介面簡化與大字版交接紀錄
版本：2026-11-07 · Cloudflare 正式部署

## 設計原則
- 最常用的操作先顯示：開始錄音、播放、分享、搜尋、書本與定位同意。
- 低頻、複雜或高風險操作放在原生 `<details><summary>` 展開區；未展開不顯示進階按鈕，但功能入口不刪除。
- 增加文字、按鈕與點擊區尺寸，減少重複文字。所有介面使用繁體中文。
- 手機版底部固定 5 項：錄音、書本、搜尋、設定、更多；更多包含雲端容量及最近刪除。電腦版使用同一資訊架構。
- 設定依使用順序排序：Starry ID 帳號、定位與地名、其他設定；檔名、上傳限制、資料夾、資料隱私、管理員入口收在進階。
- 自動生成錄音檔只在畫面上縮短顯示成「月/日 時:分 錄音」；完整原始檔名保留在更多操作，不改音檔名稱。
- 書本頁：錄音主流程直接顯示；照片、AI 問答、逐字稿、摘要、參考資料、分享/隱私、匯出工具預設手動展開。
- 雲端容量：用量與下載直接顯示，分享和刪除手動展開，付費方案尚未開放。
- 遵守位置授權與 Geoapify 署名，條款/資料說明不刪除；僅將較長說明收於「資料來源」類展開區。

## 功能保留與可用性
- 舊版 GitHub source `f62666d9a183cb226788c9ae172a48fc609c8730` 與 UI v2 做靜態 `data-action` 對照，**消失的既有動作數 = 0**。
- GPS 定位、Geoapify 中央服務、Google Maps 桌面座標、M4A metadata、播放器、裁切、分享、AI、照片與雲端功能均保留。
- 新增 `data-ui-key` 開合狀態機制：同頁重新 render 時恢復使用者手動展開的進階區域。
- 不自動清除會員資料、不更改錄音音訊、不批次回寫舊音檔或位置；不增加地理供應商與 Cloudflare 付費設定。

## 測試與發布
- GitHub branch：`feature/recordnote-m4a-metadata-20261106`；UI 開發程式和測試均存在既有 Draft PR #2。
- Node 22 + FFmpeg 完整自動測試 **44/44 PASS**：https://github.com/yukidu/starry-recorder/actions/runs/42279200658
- 獨立網頁語法、地名服務與發布 Gate **17/17 PASS**：https://github.com/yukidu/starry-recorder/actions/runs/42279199775
- UI 專用測試 `tests/recordnote-ui-v2.test.mjs` 覆蓋手機/電腦主要導覽、首頁、錄音卡片、設定排序/展開、書本功能、雲端容量、檔名顯示及展開狀態保持；上述測試無法取代人工實機視覺驗收。
- **正式 Cloudflare Web Worker `recordnote-web`：100% active version `a094a072-ae0d-4f91-b24a-9aea6743e099`，deployment `9eeb994f-e04b-414e-a60a-c8ccf0aa886b`。**
- 回退前版：`a798c54d-ea14-4b28-8d18-e13571121fc3`，透過 Cloudflare Deployments 將原版設回 100%，不更動 D1/R2。
- API `recordnote` active `8105ecb0-5c55-44c4-bd32-c6b04375c64c`，Location active `09f5bfaf-beeb-4a5f-9be1-c790661e6d00`，均未修改。
- Cloudflare 回讀驗證：最新 100% active Worker 的 HTML 含主要導覽、簡化卡片、設定展開、GPS/M4A、safe-area、播放器、書本管理等函式；未改 API Bindings/Secrets。

## 未驗證與限制
- 目前完成的是 **程式測試和 Cloudflare 活躍版本回讀**，未取得使用者手機/電腦上的視覺 QA 截圖、真實點擊流程或各裝置螢幕閱讀器實測；不應宣稱人工 UAT 全通過。
- 真實畫面若出現過大的字體、浮動「更多」被底部遮擋、表單收合後使用不便、特定原生瀏覽器的布局差異，需按實機觀察調整，但不得因此刪除功能。


## 2026-11-07｜本機錄音被誤列為待同步修復

- 問題依據：使用者 Android 03:59 螢幕截圖顯示首頁頂部「待同步 6」，錄音清單「錄音紀錄 10」，上方出現另一大區「本機錄音／待同步」與重複音檔。
- 已確認程式成因：`reloadPending()` 直接把 `RecordNoteOffline.list(owner)` 所有離線紀錄放進 `state.pending`，**沒有排除 `storage:'local-library'` 的一般已成功儲存音檔**。因此待同步數字並不可靠，會把正常本機錄音誤認為上傳工作；不應據此判定錄音遺失或上傳失敗。
- 修正：從恢復的 pending queue 排除 `storage:'local-library'`，只保留合法音訊及本來獨立建立的真正待備份工作；`clearPendingRecording` 與 `retryPending` 加上本機 library 防誤操作保護，避免上傳流程意外刪除正常本機錄音。沒有對任何用戶錄音執行清理、上傳、刪除或資料遷移。
- UI：登入狀態只顯示「已連線」，不顯示誤導性的「待同步 N」；首頁先呈現真正的「錄音紀錄」，如仍有真正獨立待備份任務，則只在清單**下方**顯示預設收合的「其他本機備份」，展開後有「下載備份」、「備份至雲端」。如果只有 6 筆正常本機 library 音檔，則 pending 區塊完全消失。
- 回歸測試 `tests/recordnote-ui-v2.test.mjs` 新增：一般 local-library 不列 pending、6 筆本機錄音時 pending 為 0、真實 queue 仍可操作但收合、一般錄音不可誤刪/誤重試。新增 `.github/workflows/recordnote-ui-quick.yml` 快速 Node 測試，不依賴 FFmpeg 安裝。
- 快速 UI CI **14/14 PASS** https://github.com/yukidu/starry-recorder/actions/runs/42285795729，Geoapify 發布 Gate **17/17 PASS** https://github.com/yukidu/starry-recorder/actions/runs/42285267631。本次完整音檔 CI https://github.com/yukidu/starry-recorder/actions/runs/42285267678 最終取消（安裝 ffmpeg 的 runner 階段未完成），不可宣稱完整 CI 通過；本次未修改音訊模組，UI 專項 14/14 和發布 Gate 17/17 均已成功。
- 已正式 Cloudflare Web Worker 部署 **100%**：version `417e97ee-e098-4212-9f7a-490a59224954`、deployment `6a9ac070-9cee-4610-a6a2-737c16411ebe`。可回退上版 `a094a072-ae0d-4f91-b24a-9aea6743e099`。API、D1、R2、Starry ID、Geoapify 中央 Worker 未修改。
- 未執行真實 Android Chrome 的點擊與資料庫目視驗收，仍須由使用者手機重新整理並檢查；若 pending 真有其他歷史上傳工作，仍可能見到展開區，但正常 library 不應重複列出。


## 2026-11-07｜首頁 7 筆以上精簡兩行清單 UI v3

### 使用者需求與正式實作
- 目標：手機首頁一般狀態下一個可視畫面容納約 7 筆以上錄音，但實際可見數仍受手機尺寸、字體放大、瀏覽器工具列、播放器展開影響，**尚未手機實機逐像素驗收，不保證任何機型一定有 7 筆**。
- 取消首頁大標題「我的錄音」與「錄音紀錄」，移除大型 Hero 錄音按鈕、重複說明與其他操作區。保留上方一列簡潔的開始／停止錄音；進行中直接顯示計時與暫停／繼續。
- **開始錄音不再離開錄音首頁**。修正 `ensureQuickCourse()` 在 home 路由只確定目標書本 ID，不呼叫 `openCourse()` 切頁；`quickRecord()` 在已錄音時改為停止，而非導向書本頁。書本、搜尋與其他既有頁面 UI 不重排。
- 首頁每筆錄音高度約 62–65 CSS px，第一行：可點擊改名的錄音名稱、MM/DD HH:mm 錄音時間、可信來源的最細地名（最後一段）、音檔長度，右側「⋯」；第二行：播放、剪輯、本機／雲端（可同時顯示）、書本分類、確定來源時的匯入標籤。
- 「⋯」手動展開其餘操作：重新命名、分享、下載、雲端備份、編輯地名、主動 GPS 辨識、查看儲存位置、移動書本、刪除。錄音紀錄／播放／開啟清單不會自動向 Geoapify 查詢。
- 錄音位置只能呈現已獲授權並已辨識的最後一段地名，例如「苗栗縣後龍鎮龍坑里・十班坑附近」只顯示「十班坑附近」。若僅知道「苗栗縣後龍鎮」則用「—」，**不杜撰村里、聚落或精確地標**。
- 自動產生檔名於首頁可簡化成「錄音 007」等易讀格式；完整檔名在右側更多選單的標題可查。點錄音名稱直接改名，既有本機音檔透過 IndexedDB 修改名稱紀錄、雲端音檔透過既有 `POST /v1/media/batch` 單筆 rename（numbered=false）更新 D1 原始檔名；**不重新編碼、重寫 R2 內容或既有 M4A 內嵌 mdta**。
- 匯入來源：未來由「匯入音檔」功能選取或網址匯入的本機音訊設 `imported:true` 並隨本機雲端同步保留；已存在的歷史雲端檔案如未保存來源，不能僅憑檔名猜測，只有確定「匯入-」命名的舊資料可顯示標籤。跨裝置僅有雲端原始資料的舊音檔，目前未另建 DB 匯入欄位，因此可能沒有匯入標籤。
- 匯入音檔入口仍保留在**全域「更多」**與書本操作內，不占首頁空間。從首頁手動將錄音備份到雲端後立即刷新畫面，顯示「本機」與「雲端」雙標籤且不跳頁。
- `recordingTile()` 只用於首頁，因此書本頁等既有錄音明細保持之前的佈局與功能。

### 驗證與部署
- 程式版本：GitHub 分支 `feature/recordnote-m4a-metadata-20261106`，正式部署候選 commit `797faf8cd96437efbf88c87e63eede381cd81b3b`，Draft PR #2（未合併）。
- UI 專用 Node 測試 **26/26 通過**：https://github.com/yukidu/starry-recorder/actions/runs/42291301718，含匯入／兩地儲存雙標籤、資料來源、改名 Blob 位元保持、GPS 最後欄位、安全降級、錄音首頁不跳頁等。
- Geoapify／發布驗證 **17/17 通過**：https://github.com/yukidu/starry-recorder/actions/runs/42291242483。
- 完整 FFmpeg/M4A workflow https://github.com/yukidu/starry-recorder/actions/runs/42291242287 在測試機安裝 FFmpeg 階段取消，因此**不能聲稱本次全部完整 CI 通過**。與前一正式 Worker 比對：嵌入 `MDTA_MODULE` 與 `mdTagFutureWebRecording()` 程式逐位元相同，沒有修改 M4A 讀寫核心；先前版本完整測試 58/58 PASS（https://github.com/yukidu/starry-recorder/actions/runs/42290237593）。
- **正式 Cloudflare RecordNote Web** active 100% version `1633db72-d87b-4026-bb1a-860ea6f17156`，deployment `6f0fe2ce-9c6f-464b-aaa7-fa378c651f42`。可立即回退前一 Web version `17245bb0-83a3-4789-b09d-5b25543309ce`（再前版 `417e97ee-e098-4212-9f7a-490a59224954`）。
- RecordNote API 仍 active `8105ecb0-5c55-44c4-bd32-c6b04375c64c`、Starry Location active `09f5bfaf-beeb-4a5f-9be1-c790661e6d00`，均無修改；現有 D1、R2 音檔、Starry ID 會員資料無批次修改。
- Cloudflare 正式部署後已回讀確認：首頁 compact CSS、兩行元件、同頁錄音、改名功能、匯入標記、手動雲端備份即時標籤及原 M4A 寫入器都存在，流量 100%。
- **限制**：未進行使用者 Android 實機的真實視覺與點擊端對端測試；實際是否 7 筆以上需依螢幕高度、瀏覽器工具列、顯示縮放及是否開啟播放器調整，不能把 CSS 預估當成真實量測。
