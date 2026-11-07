/**
 * Build the sole deployable RecordNote Worker from its audited components.
 * The Starry ID SDK is transpiled from the UNMODIFIED official TypeScript file.
 * This builds an artifact only; it never invokes Cloudflare or deploys.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import ts from 'typescript';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(resolve(root,path),'utf8');
const outputPath=resolve(root,'cloudflare-candidate/recordnote-unified.mjs');
const current=readFileSync(outputPath,'utf8');
const sdkSource=read('vendor/starry-id/starry-sdk.ts');
const compiled=ts.transpileModule(sdkSource,{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},
 reportDiagnostics:true,
 fileName:'starry-sdk.ts'
});
if(compiled.diagnostics?.some(x=>x.category===ts.DiagnosticCategory.Error)){
 throw Error('Official Starry SDK could not be transpiled');
}
const sdk=compiled.outputText
 .replace(/^export (class|function|const) /gm,'$1 ')
 .replace(/^export\s*\{\s*\};?\s*$/gm,'').trim();
if(!sdk.includes('class StarryError')||!sdk.includes('class Starry'))throw Error('Expected official Starry SDK exports');

const api=read('cloudflare-candidate/recordnote-worker.js')
 .replace(/^export (const|function) /gm,'$1 ')
 .replace(/export default\s+\{/,'return {');
let web=read('cloudflare-candidate/recordnote-web.mjs');
const m=/const PAGE=("(?:\\.|[^"\\])*")/s.exec(web);
if(!m)throw Error('Web PAGE constant missing');
const page=JSON.parse(m[1]);

const frontendSource=read('vendor/starry-id/starry-client.ts');
const frontendCompiled=ts.transpileModule(frontendSource,{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},
 reportDiagnostics:true,fileName:'starry-client.ts'
});
if(frontendCompiled.diagnostics?.some(x=>x.category===ts.DiagnosticCategory.Error))
 throw Error('Official Starry Client could not be transpiled');
const frontendJS=frontendCompiled.outputText
 .replace(/^export (class|function|const) /gm,'$1 ')
 .replace(/^export\s*\{\s*\};?\s*$/gm,'').trim();
if(!frontendJS.includes('class StarryClient'))throw Error('Official Starry Client missing');
if(!page.includes('/* __RECORDNOTE_STARRY_CLIENT__ */'))throw Error('Starry Client injection point missing');
const runtimePage=page.replace('/* __RECORDNOTE_STARRY_CLIENT__ */',frontendJS);

const old="apiBase: 'https://recordnote-api.starry.phd'";
if(!page.includes(old))throw Error('Web needs explicit API source before same-origin binding');
web=web.slice(0,m.index)+'const PAGE='+JSON.stringify(runtimePage.replace(old,'apiBase: window.location.origin'))+web.slice(m.index+m[0].length);
web=web.replace(/export default\s+\{/,'return {');

const a=current.indexOf('const recordnoteApi = (() => {\n');
const b=current.indexOf('\n})();\nconst recordnoteWeb = (() => {\n',a);
const c=current.indexOf('\n})();\nexport default {',b);
if(a<0||b<=a||c<=b)throw Error('Unified Worker wrapper has changed; refusing unsafe replacement');
const result=current.slice(0,a)+
 'const recordnoteApi = (() => {\n'+
 '/* Vendored official Starry ID backend SDK — TypeScript transpiled, no custom API client. */\n'+sdk+'\n'+api+
 '\n})();\nconst recordnoteWeb = (() => {\n'+web+current.slice(c);
if((result.match(/\bexport default\b/g)||[]).length!==1)throw Error('Expected one bundled Worker entrypoint');
if(!result.includes('apiBase: window.location.origin'))throw Error('Same-origin Web/API routing missing');
if(process.argv.includes('--check')){
 if(result!==current){console.error('RecordNote bundle is stale: run npm run build:recordnote');process.exitCode=1;}
 else console.log('RecordNote bundle matches sources');
}else{
 writeFileSync(outputPath,result,'utf8');
 console.log('Built official-SDK unified RecordNote Worker ('+result.length+' chars)');
}
