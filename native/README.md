# RecordNote 原生 Starry ID 驗收基座（非完整手機錄音 App）

這是現有 PR #13 的增量，不建立第二套會員、Worker、D1、R2 或付費商品。
使用 Expo SDK 58 / React Native 0.88 與 Starry ID **2026-11-07.14** 官方 Starry Client。

## 驗收範圍
- iOS／Android Google、Apple 中央瀏覽器登入中繼。
- iOS／Android 使用系統 Passkey 登入、建立、列出、刪除。
- 登入資訊由 SecureStore 保存，並非 AsyncStorage 或明文設定。
- App 啟動／回到前景最多每 60 秒查詢中央設定，按維護、停用、更新版本與公告顯示。
- 同意條款、登出、永久刪除中央帳號、聯絡客服。
- 既有網頁版仍提供錄音功能。本原生基座尚未移植錄音、雲端檔案、AI 和完整產品介面。

## 人員需執行的驗收
在開發電腦具備 Android SDK 或 Xcode，且事先完成憑證條件後：
1. 進入 native 資料夾，執行 npm install。
2. 執行 npm run typecheck，並執行 npx expo install --check 檢查 Expo 相容版本。
3. Android：npm run android。iOS：npm run ios。
4. 於實機測試登入中繼、Passkey、重新登入、條款、客服、登出、刪帳（只能使用專用測試帳號）。
5. **不得使用 Expo Go**；react-native-passkey 是原生模組，必須 development build。

不自動使用 EAS 遠端建置；若缺雲端建置帳號、憑證或需要新增付費資源，必須先經業主核准。

## Android Passkey SHA-256
- Google Play 正式版：Play Console → 應用程式完整性 → 應用程式簽署 → App signing key certificate（不是 Upload key）。
- EAS／本機 APK：使用 apksigner verify --print-certs app.apk 取得**實際安裝 APK**憑證的 SHA-256；可用 eas credentials -p android 或 Gradle signingReport 協助辨認。
- 不同簽章的測試／正式 APK 需各自登記。請業主進入 https://id.starry.phd/admin/apps → RecordNote →「編輯登記資料」並以 Passkey 二次確認。
- 尚未登記之前，Android 原生 Passkey 不可宣稱可使用；不影響 Google／Apple 登入或網頁版。
- Apple Team ID 4W7QRTXN5Y 只由 Starry ID 中央維護，RecordNote 不填。

正式網站 https://recordnote.starry.phd 與正式 API 使用既有單一 recordnote Worker，PR 不合併、不部署。

## v2026-11-07.14 原生跨 App 共用登入橋接（待實機驗證）

- `native/StarrySharedSso.ts` 提供 Starry SDK `sharedStorage`：共用鍵 `starry.sso`，由官方 SDK 操作 SSO start／status／exchange／logout；Native App 前景時每次執行 `restore()` 同步。
- iPhone：以 `$(AppIdentifierPrefix)phd.starry.shared` 形式宣告 Keychain Access Group，由 iOS 簽章決定前綴，不在 RecordNote 輸入 Apple Team ID。其他 App 須由**相同 Apple Team** 簽章並使用相同群組。
- Android：共用登入目前**選做，先不啟用、不阻擋上架**。每款 Android App 的 Google／Apple／Passkey 仍可獨立使用。
- Passkey 目前支援隨時新增，**不再要求 10 分鐘內重新登入**；每人最多 10 把。
- **iPhone 共用登入仍待同一開發者帳號下至少兩款 App 的實機交叉驗證**。Android 不要求共用登入；網頁版另使用中央同瀏覽器 SSO，不與手機 App 同步。

## v2026-11-07.14 Web 共用登入

- 登入 Google／Apple／Passkey 後呼叫官方 `shareWebSignIn`；中央瀏覽器 SSO cookie 只由 `id.starry.phd` 設定，不存 App。
- 載入網頁時呼叫官方 `syncWebSignIn`（每 5 分鐘最多查一次）；返站先呼叫 `completeWebSsoCheck`，回傳 URL 使用已登記的網站來源與頁面路徑，**不帶 Hash、帳號、Token**。
- Web 登出呼叫 `signOutWebEverywhere`；**僅同一瀏覽器內的所有繁星網頁版連動，與手機原生 App 登入分開**。
- 已有單元測試；Web Google／Apple／Passkey 與瀏覽器跨網站真實登入仍待受控測試網址和人工驗收。未合併、未部署。
