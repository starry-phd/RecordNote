# 繁星答錄機 RecordNote

原開發代號「繁星 AI 錄音 Starry Recorder」。本專案是繁星生態系的獨立錄音／學習紀錄 App；**正式名稱以「繁星答錄機 RecordNote」為準**。

## 程式與合併狀態

目前 `main` 僅存初始化說明；後續程式位於功能分支，尚在堆疊式 Draft PR 審查中，不能因為看到完整程式就宣稱已部署或已上架。

- [PR #1：V6 基座與介面預覽](https://github.com/starry-phd/RecordNote/pull/1)
- [PR #2：錄音同步／M4A 中繼與 Web](https://github.com/starry-phd/RecordNote/pull/2)
- [PR #3：手機音訊品質](https://github.com/starry-phd/RecordNote/pull/3)
- [PR #4：持續登入](https://github.com/starry-phd/RecordNote/pull/4)
- [PR #5：首頁錄音音量柱與短錄音保護](https://github.com/starry-phd/RecordNote/pull/5)
- [PR #6：Starry ID 與 Battery 整合](https://github.com/starry-phd/RecordNote/pull/6)

合併前須確認各 PR 的基底分支、CI、正式 D1 遷移相容性與安全性；不得直接將下游補丁合併到僅有 README 的 `main`。

## Starry ID 與繁星電池艙

- `app_id=recordnote`；iOS Bundle ID／Android package：`phd.starry.recordnote`。
- Starry ID：`https://id.starry.phd`。由中央處理會員身份，RecordNote 不另建身份資料庫。
- **繁星電池艙 Starry Battery** 正式定義為「會員共用的消費用量月額度」，不限制只有 AI 任務。會員共用額度可在已授權的 Starry Apps 使用。
- **量子電池** 是指定 App 的補充額度，不跨 App；依中央規則先使用免費月額度，不足再扣量子電池。
- 僅 App 後端可持有中央扣量服務金鑰；未開通或中央維護時，所有需要扣量的新任務都必須停止。

詳見 [2026-11-07.3 串接稽核與待辦](docs/RECORDNOTE_STARRY_ID_AUDIT_2026-11-07.3.md)。

## 原始開發規劃（歷史規格，尚待重新驗收）

原訂每堂課最多 10 筆錄音，每筆最多 100 分鐘、單檔 100 MB；錄音格式及品質已經有後續分支修訂，**不得再將最初 AAC M4A／16 kHz／64 kbps 規格視為最新定案**。Cloudflare Worker、D1、R2、Expo、AI 音訊處理、商店訂閱及安全測試都必須在合併／部署前分別驗收。

本 README 不代表 Cloudflare 正式部署、App Store／Google Play 上架、RevenueCat 開通或 Starry Battery 已啟用。
