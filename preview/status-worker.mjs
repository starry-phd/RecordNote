/** Isolated smoke-test preview only. Never handles member data, audio, AI or billing. */
const headers = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; connect-src 'none'",
  'Permissions-Policy': 'microphone=(), camera=(), geolocation=(), payment=()',
  'Cache-Control': 'no-store',
};
const page = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex,nofollow,noarchive"/>
<title>繁星 AI 錄音｜開發測試狀態</title><style>
:root{font-family:system-ui,-apple-system,"Noto Sans TC",sans-serif;color-scheme:dark}
*{box-sizing:border-box}body{margin:0;background:#0b1221;color:#eaf1fc}
main{max-width:720px;margin:5vh auto;padding:22px}
header{display:flex;gap:12px;align-items:center;margin-bottom:24px}
.logo{background:#244e87;padding:12px;border-radius:14px;font-size:26px}
h1{font-size:clamp(24px,5vw,36px);margin:0}
.small{font-size:13px;color:#aec4de}
.panel{background:#14233b;border:1px solid #405574;border-radius:20px;padding:25px}
.status{display:inline-block;padding:5px 11px;border-radius:90px;background:#52341f;color:#ffe1bd;font-weight:650;font-size:13px}
h2{font-size:22px;margin:17px 0 9px}
p{line-height:1.9;color:#c8d7ea}
.items{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:19px}
.item{border:1px solid #314c70;border-radius:12px;padding:13px;font-size:14px}
a{color:#aad0ff}
footer{font-size:12px;color:#8ea6c3;padding-top:25px}
@media(max-width:520px){.items{grid-template-columns:1fr}}
</style></head><body><main><header><span class="logo" aria-hidden="true">🎙️</span>
<div><h1>繁星 AI 錄音</h1><div class="small">Starry Recorder · Cloudflare 測試環境</div></div></header>
<section class="panel"><span class="status">開發中｜尚未正式上線</span>
<h2>連線與部署流程測試成功</h2>
<p>這是獨立的部署驗證頁，不是可使用的錄音 App。尚未開放登入、錄音、音檔上傳、AI 逐字稿、私人資料及付款功能，也不會收集任何會員資訊。</p>
<div class="items"><div class="item">✓ GitHub 獨立專案</div><div class="item">✓ Cloudflare 獨立測試資源</div>
<div class="item">✓ 私人 R2 不公開</div><div class="item">✓ 資料庫測試環境</div>
<div class="item">✓ AI 額度防重複計算，已通過測試</div><div class="item">✓ 重要課程與 180 天保留規則，已通過測試</div><div class="item">✓ M4A 真實音檔格式測試通過</div><div class="item">✓ 私人課程管理與跨會員權限測試通過（功能尚未開放）</div><div class="item">✓ 私人音檔驗證入庫及權限播放程式測試通過（服務尚未啟用）</div><div class="item">✓ Cloudflare AI 語音、摘要、圖片辨識與私人佇列測試成功（會員功能尚未開放）</div><div class="item">進行中：Starry ID 登入、正式會員 AI 工作流程與原生背景錄音</div></div>
<p class="small">程式進度請查看 <a href="https://github.com/yukidu/starry-recorder/pull/1" rel="noopener noreferrer">GitHub PR #1</a>。</p></section>
<footer>Starry.phd · Preview Only · No Member Data · No Payment</footer></main></body></html>`;
function respond(request) {
  const url = new URL(request.url);
  const h=new Headers(headers);
  if(request.method!=='GET'&&request.method!=='HEAD')
    return new Response(JSON.stringify({error:'disabled'}),{status:405,headers:{...headers,'content-type':'application/json'}});
  if(url.pathname==='/healthz'){
    h.set('Content-Type','application/json; charset=utf-8');
    return new Response(request.method==='HEAD'?null:JSON.stringify({service:'starry-recorder-preview',phase:'deployment-smoke-test',milestone:'v6-ai-lab',ready:false,member_login:false,recording:false,billing:false}),{status:200,headers:h});
  }
  if(url.pathname==='/robots.txt'){
    h.set('Content-Type','text/plain; charset=utf-8');
    return new Response(request.method==='HEAD'?null:'User-agent: *\nDisallow: /\n',{headers:h});
  }
  if(url.pathname==='/'){
    h.set('Content-Type','text/html; charset=utf-8');
    return new Response(request.method==='HEAD'?null:page,{status:200,headers:h});
  }
  return new Response('Not Found',{status:404,headers:h});
}
export default {fetch:respond,respond};

