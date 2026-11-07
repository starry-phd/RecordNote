# RecordNote × Starry ID 2026-11-07.9｜增量差異與驗收

**來源**：業主 2026-11-07 20:40 的 v2026-11-07.9 指令；中央 \`docs/integration-guide.md\`、\`sdk/starry-client.ts\`、OpenAPI 3.1 與 ADR 0011。以 PR #13 現有程式為基礎，不重做此前已完成的登入、Battery、錄音或會員資料。

**重要限制**：本變更只在 RecordNote 的 Draft PR #13。未合併、未正式部署；iOS/Android 尚無可建置的完整 Expo App；Web Passkey 仍需真實瀏覽器與會員端到端測試。

## 11 項檢查
| # | 結果 | 說明 |
|---|---|---|
| 1 Battery 409 / 503 | 已符合（沿用） | 失敗時拒絕執行 AI 任務 |
| 2 量子電池 | 已符合既有查詢/扣量契約 | 商品目錄空白，不新增商品或販售 |
| 3 SDK | 本 PR 由 v7 增量補上 | 後端既有官方 \`starry-sdk.ts\`；新增原樣官方前端 \`starry-client.ts\`；Web 正式組裝產物與 Expo adapter 委派中繼、Refresh Token、Passkey、帳號及 config 給共用套件 |
| 4 啟動/前景/公告 | 本 PR 更新為共用套件 | 原 60 秒節流保留，公告只顯示純文字；中央不可用僅訪客功能 |
| 5 JWKS | 已符合（沿用） | ES256/iss/aud/app_id、陌生 kid 刷新 |
| 6 永久刪帳 | 已符合（沿用） | 立即刪除、無撤回期；不能代取消商店訂閱 |
| 7 同意條款 | 本 PR 前端改交 SDK | \`consent_required\` 的既有 UI 保留 |
| 8 Passkey | Web 代碼與 Expo adapter 已更新；實機未驗收 | 由共用客戶端管理挑戰/序列化，平台 adapter 使用中央 \`id.starry.phd\` |
| 9 客服 | 已符合（沿用） | 僅 app_id、版本、通用瀏覽器或原生裝置名稱 |
| 10 Service Binding | 已符合（維持 HTTPS） | 可選，避免改動 Worker |
| 11 中央管理功能 | 已符合（不重複） | 邀請碼、資料匯出、通知設定仍在中央 |

## 登記方式（官方 ADR 0011）
- RecordNote 已轉入中央 \`registered_apps\`；\`config/apps.json\` 只保留 \`account\`。
- iOS Apple Team ID：中央 Worker 變數 \`STARRY_APPLE_TEAM_ID\`，由中央統一管理，**不要在 RecordNote 填寫/修改**。
- Android SHA-256：業主登入 \`https://id.starry.phd/admin/apps\` → RecordNote →「編輯登記資料」，填入 SHA-256，經 Passkey 二次確認儲存；後到「整合狀態」核對。**簽章未登記前 Android 原生 Passkey 不可視為可用**。
- Google Play 上架版：Play Console → 這款 App →「測試與發布」/「應用程式完整性」→「應用程式簽署」，複製 **App signing key certificate 的 SHA-256**，不是上傳金鑰。
- EAS 內部 APK：用 \`eas credentials -p android\` 辨認憑證；以實際 APK 的 \`apksigner verify --print-certs app.apk\` 查 SHA-256，可能不同於 Play 版本，需另外登記。
- 本機 debug APK：以 \`./gradlew signingReport\` 的 debug 變體，或實際 APK 的 \`apksigner\` 取得 SHA-256，另行登記。**只提交指紋，不提交私鑰、Keystore 或密碼**。
- iOS App：\`ios.associatedDomains=["webcredentials:id.starry.phd"]\`；需要 Expo development build、實體裝置與 AASA 驗證。

## 合併前未完成的 Gate
1. 使用已登入測試帳號，Web 真瀏覽器逐項驗證 Google/Apple 中繼、Passkey 建立/登入/移除、REAUTH_REQUIRED、登出與刪帳限制、客服與公告。
2. 完整原生 Expo App 尚未建立；以可編譯真 App 接入 adapter，再進行 iOS/Android development build 與實機 Passkey 測試（Android SHA-256 完成後）。
3. GitHub CI 所有必要檢查完成、人工審閱與必要安全測試通過，再將 Draft PR #13 改為可合併；無明確核准不部署正式 \`recordnote\` Worker。
4. 不新增、刪除 Cloudflare 正式資源；正式 Web/API 只用既有 **\`recordnote\`** Worker。新指令的 \`recordnote-api\` 僅適用全新 App，不覆蓋業主已定單 Worker 現況。

**請業主處理**：取得並在 Admin Lite 登記符合實際安裝版本的 Android SHA-256；未來安排真實瀏覽器與原生實機驗收。Apple Team ID 不需另填；商品目錄空白時不新增收費商品。
