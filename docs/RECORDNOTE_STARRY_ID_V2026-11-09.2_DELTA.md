# RecordNote｜Starry ID 2026-11-09.2 增量更新（2026-11-09）

## 範圍與不變項目
- 已登記 `app_id=recordnote`，沿用 `starry-phd/RecordNote`、現有 Worker `recordnote` 與正式網站 `https://recordnote.starry.phd`。
- **不修改 Starry ID 原始碼／設定、不遷移／清空 D1、R2、不接觸 Secrets、不新增計費商品、不部署正式環境。**
- 延用官方 `sdk/starry-client.ts`，同步 `starrySettingsBlocks()` 與新 `/v1/me/web-link` 的 OpenAPI；不重新手寫登入與扣電池流程。

## 相較 2026-11-09.1 的具體差異
| 項目 | 結果 | 修改 |
| --- | --- | --- |
| 1 Battery 預留 409／503 | 沿用既有 | 不動後端 |
| 2 量子電池 | 沿用既有 | 依中央回傳，不重算 |
| 3 官方 SDK | 已更新 | Vendor 更新至含 `starrySettingsBlocks` 的官方版；OpenAPI 同步 |
| 4 維護／公告／版本 | 沿用既有 | 啟動／回前景檢查維持 |
| 5 JWKS 及輪替 | 沿用既有 | 不動 JWT 驗證 |
| 6 刪帳 | 已符合 | 繼續要求 DELETE 與確認操作 |
| 7 同意新條款 | 已符合 | 現有官方 SDK |
| 8 Passkey | 已符合 | 沿用官方新增／列出／移除 |
| 9 固定三區塊 | 已補上 | 網頁與原生設定頁使用 SDK 產生「繁星電池艙」「我的中央會員」「我的 Passkey」資料、文字及按鈕；移除自行顯示的說明及額外重新整理鈕；進設定與回前景讀取三類資料 |
| 9 每頁網址 | 已補上 | `/`、`/settings`、`/books`、`/search`、`/trash`、`/storage`、`/courses/<id>`；pushState、popstate、初次載入及 SPA fallback；不認得的路由顯示 404 |
| 9 會員資料頁 | 已補上 | `page=battery` 與 `page=profile` 先用單次 web-link；Native 留在 WKWebView／Android WebView；Web 因中央禁止跨網域 iframe，用同一個瀏覽器分頁導向；不是直接跳未登入網址 |
| 10 Service Binding | 未啟用（選做） | 不額外更動 |
| 11 驗證／回報 | 待 CI | 合併前 CI 全綠，不直接上線 |

## 限制與驗收
- `native/App.tsx` 仍為**原生登入驗收基座**，錄音完整功能尚未移植成上架 App。本 PR 不涉及商店正式版發布。
- Android 實際安裝的 APK 指紋需對應 App 登記；現有 1 組是否符合將來的 Play／EAS 簽章，需依實際建置驗證。
- 正式 Cloudflare Worker 僅能另經核准後部署。發布前必須確認原有 D1、R2、Secrets、回退版本與 staging 狀態。
- 有別於 2026-11-09.1 的改版：不再使用 web-link `page=card` 作為設定頁卡片；會員區塊完全依官方 `starrySettingsBlocks()` 繪製。
