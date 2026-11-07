# 設計與安全原則

獨立 GitHub、Worker、D1、R2，不變更其他繁星 App；Starry ID 提供中央身份。

音訊流程：手機本機分段保存 → M4A/AAC 轉檔 → 大小、時間驗證 → R2 私有隔離區 → 伺服端驗證媒體實際參數 → 正式私人檔案 → AI 分段辨識 → 私有檢索。

目前只有隔離區範例 API，沒有可信音訊轉換／媒體解析，**不得上線**。副檔名和 content-type 無法證明 AAC 格式。

私人錄音、逐字稿、照片及 AI 索引都以中央會員 ID 作權限控管；分享預設唯讀，AI、下載另需授權。被授權人的 AI 用量計入自己額度。

原生 Android/iOS 鎖屏錄音、接聽來電後恢復、付款商店確認與 AI 正確性均未完成。React 介面目前是不能錄音、上傳或付款的展示版。

## 受控私人音訊流程（開發中）

`private R2 quarantine` → 外部可信 FFprobe/轉碼服務（尚未架設）→ `verifyMediaProbe` 及 DB/R2 一致性核對 → `promoteTrustedAudio` 原子狀態更新 → `verified/` 私人 R2 物件 → `authorizedAudioPlayback` 依當下會員／分享授權串流。

所有讀取都經 Worker 身份驗證，R2 Bucket 不公開，禁止把 private object key 回傳給客戶端。使用者標記「不允許下載」僅控制 App 功能，技術上無法阻止有權播放者複製音訊位元組。
