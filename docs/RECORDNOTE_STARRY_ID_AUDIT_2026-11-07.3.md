# RecordNote × Starry ID 串接稽核｜2026-11-07.3

> 稽核對象：`starry-phd/RecordNote` 的 `feature/recordnote-starry-id-battery-compliance-20261107`，再以本修補分支增量更新。這不是正式上架或部署驗收報告。

## 1. 正式身份與唯一來源

- App 正式名稱：**繁星答錄機 RecordNote**
- `app_id`：`recordnote`；iOS Bundle ID、Android package：`phd.starry.recordnote`
- Web Origins：`https://recordnote-web-preview.starry-phd.workers.dev`、`https://recordnote.starry.phd`
- 原生回傳網址：`recordnote://auth/google`、`recordnote://auth/apple`
- 最低版本：`0.0.0`
- 中央會員與身份的唯一事實來源：`https://id.starry.phd`；不得用 Email／顯示名稱自行合併會員。
- Starry ID OpenAPI：`https://raw.githubusercontent.com/starry-phd/id/main/openapi/starry-id.v1.json`；整合說明：`https://raw.githubusercontent.com/starry-phd/id/main/docs/integration-guide.md`。
- `starry-phd/id/config/apps.json` 已含 `recordnote`，設定檔狀態為 `active`；**尚未完成正式 API 端點的即時驗證**。

## 2. Battery 的正式定義

**繁星電池艙 Starry Battery**：每位會員獨立擁有、可在已授權 Starry Apps 共用的「會員共用的消費用量月額度」。**不限於 AI 任務**，其他需扣量的服務也可依 App 後端政策扣除。扣量數由 App 的 Owner 設定，中央負責預留、扣量、歸還及全站／App 上限。App 必須先在 Starry ID 後台開通 Battery，將服務金鑰設成後端 Secret `STARRY_BATTERY_KEY`；不輸入 GitHub、前端或 AI 對話。

**量子電池 Quantum Battery**：各 App 的額外額度，不跨 App；先扣免費月額度，不足才使用該 App 的量子電池。若有販售，依當時 Starry ID 規範設定 RevenueCat 一次性商品（`NON_RENEWING_PURCHASE`），不得自行在客戶端加值或重複入帳。

## 3. 本分支補強

1. **JWKS 公鑰快取**：後端快取公開簽章金鑰五分鐘，且按 Starry ID 原始網域分開存放；遭遇不認識的 `kid` 立即重新抓取。原有 ES256、`iss`、`aud`、`app_id`、`exp`、簽章驗證與 `GET /v1/me` 仍維持；不允許缺失金鑰時跳過驗簽。
2. **電池艙錯誤 UX**：中央回 `409 BATTERY_APP_CAP` 或 `503 SERVICE_UNAVAILABLE`，顯示明確原因並不開始 AI 工作；既有預留失敗即停止任務的機制保留。
3. **啟動遠端設定**：網頁啟動時讀取 `GET /v1/apps/recordnote/config`；`paused`／`killed` 停止進入；低於 `min_version` 要求更新。中央暫時無法連線時，僅允許訪客本機功能，不自動換發會員 Token。
4. **回歸測試**：涵蓋 JWKS 快取／輪替、中央維護／額度上限、啟動 App 設定／版本與離線訪客模式。

## 4. 九項逐項稽核

| 項目 | 稽核狀態 | 說明 |
|---|---|---|
| 1. 中央 Battery 錯誤處理 | **已補強（本 PR）** | 409／503 直接阻擋新 AI 任務，增加維護提示與回歸測試 |
| 2. 量子電池 | **平台支援／App 待補** | 中央 SDK 支援 split charge；RecordNote 前端仍缺 `GET /v1/me/battery` 的量子餘額呈現及購買 UI；非販售階段不得假裝商品已開通 |
| 3. 單檔 SDK／OpenAPI Types | **待補** | 現有 Worker 自行封裝 Battery API；可改用 Starry ID 官方單檔 SDK；正式 TypeScript Client 須由 OpenAPI 自動產生 |
| 4. App 啟動遠端設定 | **已補強（本 PR）** | Web 啟動狀態、最低版本與離線時訪客安全降級；未驗證原生 Expo 完整介面 |
| 5. JWKS 金鑰快取及輪替 | **已補強（本 PR）** | 未知 `kid` 強制更新；原本每次請求抓 JWKS，改為帶時效快取 |
| 6. 永久刪除帳號 | **待補** | 需 App 內清楚確認立即永久刪除且不自動取消訂閱，調用 `POST /v1/me/deletion`；不得以檔案刪除替代 |
| 7. 隱私權政策／條款同意 | **既有 Web 流程可見，待端到端驗證** | Web 已呼叫 `POST /v1/me/consents`，依登入回傳 `consent_required` 提示 |
| 8. Passkey 等非 App 功能 | **不應重複實作** | Passkey、邀請碼、公告及資料匯出導向中央帳號中心；RecordNote 不自行複製 |
| 9. 登入與後端身份安全 | **部分既有／仍待驗收** | Web 已有 Starry 瀏覽器中繼 + nonce + state；後端依 Token 認證與 Owner 身份；原生 Expo Deep Link、端到端驗收仍未完成 |

## 5. 已知差異與風險

- 本 Repository 的 `main` 目前只有初始化 README，完整程式在 **尚未合併的堆疊式 PR**；請先依既有 PR 順序整合，不要把本分支直接合併到空白 `main`。
- 既有「持續登入」分支將 Refresh Token 存入 Web `localStorage`。官方整合說明建議使用 `sessionStorage` 降低持久暴露風險；這是既有功能與安全建議間的取捨，**本修補不擅自更動登入持久化行為**，須另行決策。
- 現有 RecordNote 工作者採自己的 Battery 呼叫程式，舊的 `AI_BILLING_MODE` 與每日額度仍是 AI 專屬保護，不可將它解讀為「繁星電池艙只允許 AI 消費」。若要讓 Geoapify 等一般服務扣電池，應新增**獨立服務端任務類型、Owner 單價與預留／扣量流程**。
- `STARRY_BATTERY_KEY`、正式環境及 RevenueCat 商品是否已完成開通，**未驗證**。未開通前所有需扣電池的服務必須 fail closed。
- 原生 Expo App、商店上架、正式 Cloudflare 部署、D1 migration、付費功能均**不在本修補的實際執行範圍**。

## 6. 業主後續動作（未擅自代做）

1. 在 Starry ID Admin Lite 確認 RecordNote 的 Battery 已啟用，必要時由業主將服務金鑰設定在 RecordNote Worker Secret；**金鑰不要分享給 AI**。
2. 檢查此 PR 的 GitHub Actions，逐個按堆疊次序審核合併。先完成 staging API、設定、登入、JWKS、扣量交易及 D1 migration 驗收，才考慮正式部署。
3. 若決定販售量子電池，先確認 RevenueCat 專案、商店商品及退款規則，再另外實作完整購買與恢復購買畫面。
4. 後續新增帳號刪除、會員 Battery 餘額（含量子電池）、原生登入及完整 App 功能，另開追蹤 PR；不能把本次補強誤認為已全部完成。
