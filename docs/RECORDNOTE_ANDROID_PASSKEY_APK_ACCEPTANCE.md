# Android Passkey 驗收檢查表

RecordNote PR #13：僅有「已建立 Android 測試 APK、且已取得配對的 SHA-256」才可進行以下測試。此文件不代表已在實機上完成驗證。

## 指紋與 APK 配對

- 業主已回報於 Starry ID Admin Lite 輸入 Android SHA-256；**尚未證明該組指紋與最後下載 APK 相符**。
- GitHub Actions 採一次性 Android Debug 簽章，每次重跑**可能產生新指紋**。必須以實際安裝那次建置的 `RecordNote-Android-test-SHA256.txt` 為準。
- 開啟 https://github.com/starry-phd/RecordNote/actions，選最近一次 **成功** 的「RecordNote Android test APK SHA256」。
- 從同一次執行的 **Artifacts** 下載 `RecordNote-test-APK-with-SHA256`，解壓取得 APK 與文字檔；先用文字檔的 64 位 SHA-256 和 Starry ID Admin Lite RecordNote 已登記值逐字比對。
- 如果不一致：**請業主在 Admin Lite 更新／加登這一份 APK 的指紋**；不要沿用上一輪建置的指紋，也不要提交 keystore 或簽署私鑰。
- Starry ID 管理路徑：https://id.starry.phd/admin/apps → RecordNote →「編輯登記資料」→ Passkey 管理員再次確認。

## Android 實機測試（只能使用專用測試會員）

- [ ] APK 可在真實 Android 手機安裝並開啟，沒有閃退。
- [ ] Google 登入中繼成功、返回 RecordNote；Apple 登入中繼成功返回（若該裝置可使用該流程）。
- [ ] 使用 Passkey 登入按鈕，成功連到中央 RP `id.starry.phd`。
- [ ] 會員設定頁新增 Passkey，正常列出，移除時能正確確認；按取消不顯示錯誤。
- [ ] 未登入或裝置未支援時有可理解的提示及 Google／Apple 替代方式。
- [ ] 完成登出、重新登入及會員條款同意驗收。
- [ ] 開啟「聯絡客服」跳到 https://id.starry.phd/support，僅帶 App ID、版本、裝置。
- [ ] 實測中央暫停、停用、最低版本及純文字公告（需中央管理員安排測試視窗，**不要更動正式會員設定**）。
- [ ] 刪除帳號只能使用**專用可刪除的測試會員**；立即永久刪除且無撤回期、不會自動取消任何商店訂閱。
- [ ] 同時確認需扣用 Starry Battery 的 AI 任務遇 409／503 會停止並顯示提示；**目前原生驗收基座沒有錄音或 AI 執行畫面，這一項留待完整原生功能移植後測試**。

## 驗收結論與下一關

Android SHA-256 已輸入中央後，仍須「指紋配對確認」→「測試 APK 可下載」→「Android 實機 Passkey 成功」三關，不可視為直接可上架。

目前 PR #13 持續 Draft，不合併、不部署正式 Worker；正式錄音仍以既有網頁版為主。
