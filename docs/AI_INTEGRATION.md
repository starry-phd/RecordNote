# 繁星 AI 錄音｜Cloudflare AI 整合（AI71，2026-10-24）

**狀態：Cloudflare 獨立 AI 測試 Worker 已部署；正式錄音 App 尚未部署。**

## 已接通
- 專用後台 AI Adapter `src/ai-cloudflare.ts`，Whisper Large V3 Turbo 作語音辨識；Llama 3.3 作摘要與來源限定問答；Qwen 3.8 Vision 作簡報圖片文字辨識。
- GitHub `wrangler.preview.jsonc` / `wrangler.jsonc` 已設定 Workers AI binding 名稱 `AI`；但原本私人會員 API 的全部安全開關維持關閉，尚無可用的正式資料流程。
- Cloudflare 帳號 `611de84062006fe96fafd0cf157f2ec0` 已部署無公開路由的 `starry-recorder-ai-lab` Worker；Cloudflare 確認其綁定 `AI` 類型 `ai`，Worker Version `2a8a5695-9ac1-4294-81a1-7dcf635a9d77`。
- 該 Worker 禁用 workers.dev 和預覽連結；所有收到的 HTTP 請求回傳 404，不公開任何 AI、會員或付款服務。
- 透過使用者已授權的 Cloudflare 管理連線，使用合成測試資料直接向 Workers AI 官方帳號 API 測試：
  - Llama 摘要成功。
  - Cloudflare Melo TTS 合成「Water is important for healthy human bodies.」→ Whisper 辨識還原原句，成功（約 2.73 秒）。
  - Qwen3.8 Vision 對合成 PNG 「WATER」圖片辨識得到 WATER（使用 `enable_thinking:false`）。
- 注意：對沒有真實人聲的合成聲波，Whisper 曾產生虛構的「Thank you.」，因此**必須加入靜音／VAD 檢查、品質測試以及人工校正**，不能把上述測試當作完整品質驗收。
- Meta Llama 3.2 Vision 要求額外模型授權及使用地區聲明，**未接受條款、未啟用**，已改用 Cloudflare Qwen 視覺模型。

## AI 費用保護
- `src/ai-cloudflare.ts` 限制音訊段最多 120 秒、2MB；圖片最多 800KB；問答需限量且引用已授權來源。
- `src/ai-budget.ts` 與 Preview D1 `0004_ai_lab_budget.sql`：合成測試任務須 `synthetic-` ID，每 UTC 日最多 10 次推論預留、預留估算合計不得超過 US$1；先預留再呼叫，失敗不退款以防無限重試。這是**可供私有背景工作者使用的軟體預算關卡**，並非 Cloudflare 帳號層級的強制扣款上限。
- 管理者透過 Cloudflare REST API 手動執行的上述少量模型驗證**未使用 D1 軟體預算封裝**，僅透過管理權限執行；不得宣稱所有雲端 AI 花費都已有硬性阻擋。
- 正式部署前應建立專用 AI Gateway、設定費用上限、完成真實成本文書及壓力測試，避免模型滾動超支。

## 尚未完成
- Starry ID 安全跨 App 登入、會員額度的完整預留／核銷及撤銷機制。
- 100 分鐘音訊的實際轉檔、音訊切段工作流程、正式會員資料的 AI Queue／重試／DLQ、逐字稿與 OCR 存回 D1、完整私有語意搜尋索引。
- 圖片中的文字 OCR 品質驗證、多語言多口音、人物辨識與原始音檔時間戳同步。
- Android/iOS 原生背景錄音、訂閱付款、2000 人以上安全和負載測試、正式網址 `record.starry.phd`。

## 回復
- AI 測試 Worker 初次部署，無舊版本可回切；內部 Lab 回復識別碼：`SR-AILAB-UNDO-2A8A5695`，意思是**停用並經確認後刪除這個無公開路由的測試 Worker**，不影響正式 App 或其他 Worker。
- 既有唯讀測試站繼續獨立運作，須另記錄它的每次部署版本與上一版回復代碼。

## 2026-10-24｜真實私有 AI 佇列驗證
- 只接受 `synthetic-` 測試識別碼及短測試文字，拒絕真實會員資料與所有公開 HTTP AI 請求。
- Cloudflare Worker `starry-recorder-ai-lab` 目前具 AI binding 與專屬 Preview D1 binding。workers.dev 子網域和預覽連結均 **disabled**。
- Worker Queue `starry-recorder-ai-lab-jobs`，最大每批 1 件、同時 1 個消費者、失敗最多重試 2 次，搭配 `starry-recorder-ai-lab-dlq`。兩個佇列均與其他繁星 App 資源隔離。
- `0004_ai_lab_budget.sql` 和 `0005_ai_synthetic_results.sql` 已於專用 Preview D1 套用並驗證，含 `job_id` 唯一索引以免重複扣額度。
- 管理者送出測試工作 `synthetic-waterdemo241024` → Queue → D1 預估 US$0.04 預留 → Cloudflare Llama AI → `ai_synthetic_results` 保存「這個合成科學課說水對生物體是必需的。」；重新送出完全相同工作，D1 僅 **1** 筆預留與 **1** 筆結果。
- 真實 AI 另外確認 Whisper 對合成英文人聲正確回復「Water is important for healthy human bodies.」，Qwen3.8 圖片 OCR 能回復「WATER」。不代表長音檔分段處理、講者辨識與 OCR 多語言品質已驗收。
- 最近 GitHub CI：https://github.com/yukidu/starry-recorder/actions/runs/39992603916 成功；狀態站外網檢查：https://github.com/yukidu/starry-recorder/actions/runs/39993380778 第二次嘗試成功。
- 實際佇列程序有程式級每日最多 10 次推論預留及 US$1 預估預留限制；**不是雲端帳號級硬性總花費上限**。不可供任何會員在 Starry ID／訂閱額度串接完成前使用。


## 2026-10-24｜繼續開發：重試、逐字稿與授權來源

- `ai-lab/queue-worker.mjs` 已修正：同一 synthetic job 預留相同 payload hash，兩次失敗封頂；每一次實際 AI 執行都另外預留費用，同工作改內容被拒絕；已成功保存的結果即使在狀態標記前中斷，重試也會自動修復狀態，不會重新呼叫模型。
- 針對新 Worker Version `5b7e7118-463b-4127-ba12-7caab3eea8d4` 送出 `synthetic-retryfix20261024a`，確認 Cloudflare Queue→模型→D1：`attempts=1`、成功一筆、費用預留一次。隨後用同 ID 不同 prompt 重送，資料與費用均維持一次。
- 新增 `src/transcript-store.ts`，限定已驗證錄音和會員擁有者的逐字稿分段寫入，使用 DB batch 與每工作分段唯一索引避免重試重複；讀取時需擁有者或有效分享權限。
- 新增 `src/asr-segmentation.ts`：100 分鐘可切成約 90 秒的可解碼區間計畫，含重疊去重及 Whisper 相對時間轉原始時間，**尚無 FFmpeg 轉檔執行器**。
- 新增 `src/authorized-evidence.ts`：AI 問答資料僅限課程擁有者或有效 `allow_ai` 分享者，過期／已撤銷的授權拒絕；現階段有限量 DB 來源抽取，**不是完整語意搜尋**。
- GitHub 測試成功：https://github.com/yukidu/starry-recorder/actions/runs/39997585368 。
- Preview D1 已成功執行 `0006_ai_lab_jobs.sql`；`0007_transcript_chunk_indices.sql` 的雲端套用因工具安全檢查遭拒，**尚未套用 Cloudflare D1**。不以替代手段繞過安全限制；部署正式逐字稿前必須補上此 migration 並確認資料庫欄位與索引存在。
- Starry ID、R2 真實音檔轉碼、真人長音檔、原生 Android/iOS 錄音、AI 付費與正式上線門檻均未完成。
