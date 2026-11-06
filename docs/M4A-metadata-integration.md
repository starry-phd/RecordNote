# RecordNote｜M4A 中繼資料跨平台整合交付包（2026-11-06）

## 已採納設定

- 所在地名稱選「系統自動」→ `place_name`，**不是** `location_date`。
- **只套用未來錄音**；錄音開始時凍結政策版本。既有 M4A、正在錄音的檔案都不自動改寫。
- 後台使用「儲存並立即發布」單一主按鈕，後端保留驗證、版本、回滾與超級管理員授權。
- 地名查詢須另行取得使用者的明確同意；臺灣採用國土測繪中心戶政村里反查，無法保證道路門牌。音檔絕不傳給地名服務。

## 實際完成的事項

| 項目 | 完成狀態 |
|---|---|
| 正式版管理後台一鍵發布 | 已部署 Cloudflare Web Worker；正式入口 `/admin/metadata` |
| 正式版臺灣村里反查 API | 已部署，但尚未以有效會員 Token 做行動裝置端到端測試 |
| QuickTime mdta 寫入器（Web／React Native 共用） | 程式已完成，含一般與串流寫入、不重新壓縮音訊、讀回驗證 |
| Web 錄音完整串接 | 已在候選 Worker 程式完成並上傳，但 **未部署正式流量／未做 Android 真機測試** |
| Expo iOS／Android 檔案系統轉接層 | 程式完成，但 **缺少真正的 Expo App 專案，無法完成合併、EAS build 或真機測試** |
| Apple QuickTime 27 + iTunes 48 欄位 | 管理目錄 75 項；目前寫入器僅支援 QuickTime 文字型 mdta 子集合，**未實作所有 iTunes 標籤** |

## 核心檔案

- `src/m4a-mdta.mjs`：ESM 零音訊重壓縮 M4A metadata 寫入、串流讀寫、讀回。
- `src/web-recordnote-metadata.js`：瀏覽器錄音前取得政策、同意後查村里、M4A 停錄後寫檔及讀回。
- `src/recordnote-web-metadata-integration.html`：已套用錄音流程的 Web HTML 候選版。
- `src/web-integration-patches.json`：不覆蓋其他前台修改的精準字串補丁。
- `expo/RecordNoteM4aWriter.ts`：Expo FileSystem chunked writer，寫入暫存檔再讀回，原音檔不變。
- `tests/`：M4A 樣本、一般／faststart 封裝比較、Node 檢查。

## 目前仍有阻礙

本次嘗試部署 Web Writer 候選版本到預覽 Worker 時，Cloudflare 工具操作遭平台安全攔截，不能宣稱已正式部署。候選程式儲存在 Cloudflare 的未部署版本中，**不會接收正式流量**。

GitHub `yukidu/starry-recorder` 目前只有 README，沒有 Expo App 的主程式、`app.json`、package.json 或 EAS 設定，因此不能直接建置 App Store／Google Play 版本。

## 驗證方式

```
node tests/verify-m4a.mjs
node tests/stream.test.mjs
ffprobe -v error -show_entries format_tags -of json tests/faststart-tagged.m4a
```

FFmpeg PCM SHA-256：原音檔、一般 mdta 寫入、串流 mdta 寫入的結果全部一致：
`c11dab2b4c269af0d9bc09e6291254a5137c3a98c83b62664ed4e055cf9b650a`

## 安全性

- 檔案超出支援結構或容量時停止寫入，保留原檔；不得將錯誤音檔當成功。
- Apple 其他非字串中繼欄位及 iTunes `mdir` 中繼資料需要額外實作與測試。
- GPS 資料不應被沒有授權的使用者或第三方看見，分享時應預設移除定位資訊（尚未完整實作）。
- Cloudflare DB 的舊媒體表、R2、Starry ID 未因本次 M4A writer 修改而覆寫。