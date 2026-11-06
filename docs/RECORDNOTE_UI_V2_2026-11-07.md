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
- 快速 UI CI **14/14 PASS** https://github.com/yukidu/starry-recorder/actions/runs/42285795729，Geoapify 發布 Gate **17/17 PASS** https://github.com/yukidu/starry-recorder/actions/runs/42285267631。原有音檔完整測試執行因 GitHub runner 安裝 ffmpeg 步驟仍進行中，不宣稱本次完整音檔 CI 已結束；本次無音訊模組內容變更。
- 已正式 Cloudflare Web Worker 部署 **100%**：version `417e97ee-e098-4212-9f7a-490a59224954`、deployment `6a9ac070-9cee-4610-a6a2-737c16411ebe`。可回退上版 `a094a072-ae0d-4f91-b24a-9aea6743e099`。API、D1、R2、Starry ID、Geoapify 中央 Worker 未修改。
- 未執行真實 Android Chrome 的點擊與資料庫目視驗收，仍須由使用者手機重新整理並檢查；若 pending 真有其他歷史上傳工作，仍可能見到展開區，但正常 library 不應重複列出。
