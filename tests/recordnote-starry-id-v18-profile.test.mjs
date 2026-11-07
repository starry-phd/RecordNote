import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const script=file('cloudflare-candidate/recordnote-web.mjs');
const literal=/const PAGE=("(?:\\.|[^"\\])*")/s.exec(script);
assert.ok(literal,'Web PAGE must be literal');
const page=JSON.parse(literal[1]);
const native=file('native/App.tsx');
const openapi=JSON.parse(file('vendor/starry-id/starry-id.v1.json'));
const me=openapi.components.schemas.Me;
const profile=openapi.components.schemas.Profile;
const from=page.indexOf('function centralAvatarUrl(');
const to=page.indexOf('function memberBatterySection()',from);
assert.ok(from>0&&to>from,'Central member UI must be present');

function getViews(meData){
 const context={
  ID:'https://id.starry.phd',URL,encodeURIComponent,
  state:{mode:'live',centralMe:meData,centralMeLoading:false,centralMeError:null},
  e:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
 };
 runInNewContext(page.slice(from,to),context);
 return context;
}
test('v18 uses centrally supplied mutable member_no, initials and expiring avatar URL',()=>{
 for(const f of ['member_no','profile','user_id'])
  assert.ok(me.properties[f],f);
 assert.ok(profile.properties.avatar_url);
 assert.ok(profile.properties.initials);
 assert.ok(native.includes('user?.profile?.initials'));
 assert.ok(native.includes('encodeURIComponent(memberNo)'));
 assert.ok(native.includes('Share.share({message:url,url})'));
 assert.ok(!native.includes('/v1/me/avatar'));
 assert.ok(!page.includes("member_no+':recordnote'"));
});
test('Website null avatar shows central initials (not derived), public link has no fixed 7-digit assumption',()=>{
 const me={user_id:'uuid-1',member_no:'TW0123456789',profile:{initials:'王文',nickname:'範例',avatar_url:null}};
 const v=getViews(me);
 const html=runInNewContext('centralMemberSection()',v);
 assert.match(html,/王文/);
 assert.match(html,/TW0123456789/);
 assert.match(html,/https:\/\/id.starry.phd\/TW0123456789/);
 assert.ok(!html.includes('<img'),'Null avatar must not render broken image');
 assert.equal(runInNewContext("centralMemberLink('invite','TW0123456789')",v),'https://id.starry.phd/Invite/TW0123456789');
 assert.equal(runInNewContext("centralMemberLink('profile','TW0123456')",v),'https://id.starry.phd/TW0123456');
});
test('Website safely renders signed avatar and HTML-encodes profile and member number',()=>{
 const v=getViews({member_no:'TW0<script>',profile:{initials:'<&',shown_name:'<img>',display_name:'Private Name',avatar_url:'https://id.starry.phd/signed/avatar?x=1&y=2'}});
 const html=runInNewContext('centralMemberSection()',v);
 assert.ok(html.includes('&lt;img&gt;'));
 assert.ok(html.includes('&lt;&amp;'));
 assert.ok(html.includes('TW0&lt;script&gt;'));
 assert.ok(html.includes('TW0%3Cscript%3E'));
 assert.ok(html.includes('id.starry.phd/signed/avatar?x=1&amp;y=2'));
 assert.ok(!html.includes('src="javascript:'));
});
test('Website refreshes /v1/me on entry and again immediately before sharing, without local avatar copy',()=>{
 assert.ok(page.includes("if(page==='settings'){void refreshMemberBattery();void loadPasskeys();void refreshCentralMember();}"));
 assert.ok(page.includes('const me=await starryClient.me(); // member_no can change'));
 assert.ok(page.includes('if(state.mode===\'live\'&&currentUserScope()===scope)state.centralMe=me'));
 assert.ok(page.includes("case 'shareMemberInvite':await shareMemberInvite()"));
 assert.ok(page.includes('navigator.share({title:'));
 assert.ok(page.includes('navigator.clipboard.writeText(url)'));
 assert.ok(!page.includes('/v1/me/avatar'));
});
test('Member identity is scoped to Starry user_id, not editable member_no',()=>{
 assert.ok(page.includes('claims.sub'));
 assert.ok(page.includes('currentUserScope()'));
 assert.ok(!page.includes('localStorage.setItem(me.member_no'));
 assert.ok(!native.includes('key={user.member_no}'));
});
test('Fixed central Battery icons and units in Web and Native are preserved',()=>{
 assert.ok(page.includes('🔋 <strong>\'+e(b.remaining)'));
 assert.ok(page.includes(' 顆普通電池'));
 assert.ok(page.includes('⚛️ <strong>\'+e(q.available)'));
 assert.ok(page.includes(' 顆量子電池'));
 assert.ok(native.includes('🔋 普通電池'));
});
