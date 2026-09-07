// Unit tests only: no browser and no connection to the live Firebase database.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { buildCatalog } from './build-gifts.mjs';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const manifest = JSON.parse(read('assets/gifts/catalog.json'));
const authSource = read('auth.js');
const social = authSource.slice(authSource.indexOf('      const GIFT_CATALOG ='), authSource.indexOf('      MFAuth.watchGifts ='));
function authHarness(fetcher = async () => ({ok:true,json:async()=>manifest})) {
  const writes=[],notifications=[];
  const MFAuth={user:{uid:'sender'},profile:{username:'sender'},name:()=> 'A friend',createNotification:async(...args)=>notifications.push(args)};
  const dbMod={ref:(_,p)=>p,push:()=>({key:'gift-test'}),set:async(p,data)=>writes.push({path:p,data})};
  vm.runInNewContext(social,{MFAuth,dbMod,db:{},URL,location:{origin:'https://mayflowerstudios.net'},fetch:fetcher});
  return {MFAuth,writes,notifications,dbMod};
}

test('folder catalogue matches the shipped manifest and all original IDs survive', async()=>{
  assert.deepEqual(await buildCatalog(),manifest);
  for(const id of ['flower','heart','coffee','cookie','ticket','controller','plushie','star']) assert.ok(manifest.gifts.some(g=>g.id===id));
  for(const gift of manifest.gifts) assert.ok(readFileSync(new URL('../'+decodeURIComponent(gift.image.slice(1)),import.meta.url)).length>0);
});
test('new folders become categories; transparency/animation formats stay unchanged', async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'mf-gifts-'));
  t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  await fs.mkdir(path.join(dir,'Forest friends'));
  await fs.writeFile(path.join(dir,'Forest friends','sleepy-fox.png'),'image');
  await fs.writeFile(path.join(dir,'Forest friends','sparkles.gif'),'image');
  await fs.writeFile(path.join(dir,'Forest friends','ignore.svg'),'not a gift');
  const result=await buildCatalog(dir);
  assert.equal(result.gifts.length,2);
  assert.equal(result.gifts[0].name,'Sleepy Fox');
  assert.equal(result.gifts[0].category,'Forest Friends');
  assert.equal(result.gifts[0].image,'/assets/gifts/Forest%20friends/sleepy-fox.png');
  assert.ok(result.gifts[1].image.endsWith('.gif'));
  await fs.writeFile(path.join(dir,'sleepy-fox.webp'),'duplicate');
  await assert.rejects(buildCatalog(dir),/Duplicate/);
});
test('catalogue fetch is shared and can retry after a failure', async()=>{
  let calls=0;
  const {MFAuth}=authHarness(async()=>{calls++;if(calls===1)throw Error('offline');return{ok:true,json:async()=>manifest};});
  await assert.rejects(MFAuth.loadGiftCatalog(),/offline/);
  await Promise.all([MFAuth.loadGiftCatalog(),MFAuth.loadGiftCatalog()]);
  assert.equal(calls,2);
  assert.equal(MFAuth.giftCatalog.teddy.name,'A little bear hug');
});
test('catalogue rejects remote images, traversal, unsupported files and prototype IDs',async()=>{
  const {MFAuth}=authHarness(async()=>({ok:true,json:async()=>({gifts:[
    ...manifest.gifts,
    {id:'external',name:'No',image:'https://elsewhere.test/assets/gifts/a.png'},
    {id:'traversal',name:'No',image:'/assets/gifts/%2e%2e/private.png'},
    {id:'encoded',name:'No',image:'/assets/gifts/%2f..%2fprivate.png'},
    {id:'svg',name:'No',image:'/assets/gifts/a.svg'},
    {id:'constructor',name:'No',image:'/assets/gifts/a.png'},
  ]})}));
  const catalog=await MFAuth.loadGiftCatalog();
  for(const id of ['external','traversal','encoded','svg','constructor'])assert.ok(!Object.hasOwn(catalog,id));
});
test('sending a custom image gift retains the database schema and short dedication',async()=>{
  const {MFAuth,writes,notifications}=authHarness();
  await MFAuth.sendGift('recipient','teddy','  '+ 'x'.repeat(180)+'  ');
  assert.equal(writes.length,1);assert.equal(writes[0].path,'gifts/recipient/gift-test');
  assert.equal(writes[0].data.giftId,'teddy');assert.equal(writes[0].data.note.length,160);
  assert.deepEqual(Object.keys(writes[0].data).sort(),['emoji','fromName','fromUid','fromUsername','giftId','name','note','t']);
  assert.equal(notifications.length,1);
});
test('self gifts, unknown IDs, prototype IDs and signed-out sends never write',async()=>{
  const {MFAuth,writes}=authHarness();
  await assert.rejects(MFAuth.sendGift('sender','flower',''));
  await assert.rejects(MFAuth.sendGift('recipient','missing',''));
  await assert.rejects(MFAuth.sendGift('recipient','constructor',''));
  MFAuth.user=null;await assert.rejects(MFAuth.sendGift('recipient','flower',''));
  assert.equal(writes.length,0);
});
test('changing accounts while the catalogue loads aborts the send',async()=>{
  let resolve;
  const {MFAuth,writes}=authHarness(()=>new Promise(r=>resolve=r));
  const send=MFAuth.sendGift('recipient','flower','Hello');
  MFAuth.user={uid:'different'};resolve({ok:true,json:async()=>manifest});
  await assert.rejects(send,/account changed/);assert.equal(writes.length,0);
});
test('failed database writes never announce a delivered gift',async()=>{
  const {MFAuth,dbMod,notifications}=authHarness();
  dbMod.set=async()=>{throw Error('PERMISSION_DENIED');};
  await assert.rejects(MFAuth.sendGift('recipient','flower','Hi'),/PERMISSION/);
  assert.equal(notifications.length,0);
});

function giftWallHarness() {
  const MFAuth={giftCatalog:Object.fromEntries(manifest.gifts.map(({id,...g})=>[id,g]))};
  const window={MFAuth};vm.runInNewContext(read('gifts.js'),{window,MFAuth});
  const more={addEventListener:(_,fn)=>more.click=fn};
  const root={innerHTML:'',querySelectorAll:()=>[],querySelector:selector=>selector==='.mf-gift-more'?more:null};
  return{api:window.MFGifts,root,more};
}
test('gift wall renders transparent art and escapes sender names and dedications',()=>{
  const {api,root}=giftWallHarness();
  api.renderWall(root,{a:{giftId:'flower',fromName:'<img onerror=bad>',note:'<script>bad</script>',t:1},b:{giftId:'retired-custom',name:'Old gift',emoji:'💜',t:2}});
  assert.match(root.innerHTML,/assets\/gifts\/Friendship\/flower.webp/);
  assert.match(root.innerHTML,/&lt;script&gt;bad&lt;\/script&gt;/);
  assert.doesNotMatch(root.innerHTML,/<script>|<img onerror/);
  assert.match(root.innerHTML,/💜/);
});
test('gift wall shows older keepsakes on demand without discarding messages',()=>{
  const {api,root,more}=giftWallHarness();
  const records=Object.fromEntries(Array.from({length:12},(_,i)=>[i,{giftId:'flower',note:`note ${i}`,t:i+1}]));
  api.renderWall(root,records);
  assert.equal((root.innerHTML.match(/<article/g)||[]).length,8);
  more.click();assert.equal((root.innerHTML.match(/<article/g)||[]).length,12);
});

// Small DOM fixtures exercise the compose handlers without a browser or Firebase.
function composerHarness() {
  const control=()=>({disabled:false,hidden:false,textContent:'',innerHTML:'',value:'',dataset:{},setAttribute(k,v){this[k]=v;},focus(){},addEventListener(){}});
  const selected=control(), note=control(), submit=control(), feedback=control(), output=control(), preview=control(), close=control(), cancel=control();
  const form={querySelector:selector=>({'textarea':note,'[type=submit]':submit,'[role=status]':feedback,'.mf-gift-selected':selected,'output':output,'blockquote':preview}[selector]),querySelectorAll:()=>[]};
  const categories= [...new Set(['All gifts',...manifest.gifts.map(g=>g.category)])].map(category=>Object.assign(control(),{dataset:{category}}));
  const options={set innerHTML(html){this.buttons=[...html.matchAll(/data-gift-choice="([^"]+)"/g)].map(([,id])=>Object.assign(control(),{dataset:{giftChoice:id}}));},querySelectorAll(selector){return selector==='[data-gift-choice]'?this.buttons:[];}};
  const body={innerHTML:'',querySelector:selector=>({'.mf-gift-options':options,form,button:cancel}[selector]),querySelectorAll:selector=>selector==='[data-category]'?categories:[]};
  const overlay={innerHTML:'',addEventListener(){},remove(){},querySelector:selector=>({'.mf-gift-content':body,section:control(),'.mf-gift-close':close}[selector]),querySelectorAll:()=>[close,submit,note,cancel,...categories,...(options.buttons||[])]};
  const document={activeElement:{},body:{style:{overflow:''},appendChild(){}},createElement:()=>overlay,addEventListener(){},removeEventListener(){}};
  let resolveSend,rejectSend;
  const calls=[];
  const MFAuth={user:{uid:'sender'},giftCatalog:Object.fromEntries(manifest.gifts.map(({id,...g})=>[id,g])),loadGiftCatalog:async()=>MFAuth.giftCatalog,sendGift:(...args)=>{calls.push(args);return new Promise((resolve,reject)=>{resolveSend=resolve;rejectSend=reject;});}};
  const window={MFAuth};vm.runInNewContext(read('gifts.js'),{window,MFAuth,document});
  return {api:window.MFGifts,options,note,form,selected,calls,submit,feedback,resolve:()=>resolveSend(),reject:()=>rejectSend(Error('Try later')),body};
}
test('choosing and switching a gift never sends; explicit Send writes once even on double submit',async()=>{
  const h=composerHarness();await h.api.compose('recipient','Sakura');
  h.options.buttons.find(b=>b.dataset.giftChoice==='flower').onclick();
  h.options.buttons.find(b=>b.dataset.giftChoice==='heart').onclick();
  h.note.value='For you ♡';h.note.oninput();assert.equal(h.calls.length,0);
  const pending=h.form.onsubmit({preventDefault(){}});
  await h.form.onsubmit({preventDefault(){}});
  assert.deepEqual(h.calls,[['recipient','heart','For you ♡']]);
  h.api.close();assert.equal(h.api.isOpen,true,'in-flight sends keep their status visible');
  h.resolve();await pending;
  assert.match(h.body.innerHTML,/DELIVERED WITH LOVE/);
});
test('a failed send preserves the selected image and note for retry',async()=>{
  const h=composerHarness();await h.api.compose('recipient','Sakura');
  h.options.buttons[0].onclick();h.note.value='Keep this note';
  const pending=h.form.onsubmit({preventDefault(){}});h.reject();await pending;
  assert.equal(h.note.value,'Keep this note');assert.equal(h.submit.disabled,false);assert.equal(h.feedback.textContent,'Try later');
  assert.ok(h.selected.innerHTML.includes('img'));
});
test('account inline scripts parse and their fixed controls exist after the redesign',()=>{
  const html=read('account.html');
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  for(const [,js] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)){
    if(!js.trim())continue;
    const result=spawnSync(process.execPath,['--input-type=module','--check'],{input:js,encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    const dynamic=[...js.matchAll(/\.id\s*=\s*"([^"]+)"/g)].map(m=>m[1]);
    for(const [,id] of js.matchAll(/\$\("([^"]+)"\)/g))assert.ok(ids.includes(id)||dynamic.includes(id),`Missing account control: ${id}`);
  }
});
test('database gift rules accept custom IDs while retaining ownership and message validation',()=>{
  const gifts=JSON.parse(read('FirebaseRules-full.json')).rules.gifts.$uid;
  assert.deepEqual(gifts['.indexOn'],['t']);
  assert.match(gifts['.read'],/profilePrivacy/);
  const record=gifts.$giftId;
  assert.match(record['.write'],/!data.exists\(\)/);
  assert.match(record['.write'],/auth.uid !== \$uid/);
  assert.match(record['.write'],/fromUid.*=== auth.uid/);
  const pattern=record['.validate'].match(/\.matches\(\/(.*?)\/\)/)[1];
  const re=new RegExp(pattern);
  for(const gift of manifest.gifts)assert.ok(re.test(gift.id));
  for(const bad of ['../x','x/y','https://x','a'.repeat(65),''])assert.ok(!re.test(bad));
  assert.match(record.note['.validate'],/length <= 160/);
  assert.equal(record.$other['.validate'],false);
});

function profileHarness({privacy={},friend=false,getProfile}={}) {
  const selectors=new Map(), watchers=[],closed=[];
  const control=()=>({innerHTML:'',textContent:'',hidden:false,isConnected:true,style:{setProperty(){}},classList:{toggle(){}},setAttribute(){},addEventListener(){},focus(){},querySelectorAll:()=>[]});
  const card=control();
  card.querySelector=selector=>{
    if(!selectors.has(selector))selectors.set(selector,control());
    return selectors.get(selector);
  };
  const classes=new Set(),overlay={classList:{contains:c=>classes.has(c),add:c=>classes.add(c),remove:c=>classes.delete(c)}};
  const document={body:{style:{overflow:''}},activeElement:{},getElementById:id=>id==='mfProfOverlay'?overlay:id==='mfProfCard'?card:card.querySelector('#'+id)};
  const dbAdapter={ref:(_,p)=>p,get:async p=>({exists:()=>p.startsWith('users/'),val:()=>({displayName:p.slice(6)})})};
  if(getProfile)dbAdapter.get=getProfile;
  const MFAuth={uid:'viewer',db:{},isConfigured:()=>true,getProfilePrivacy:async()=>privacy,areFriends:async()=>friend,avatarFor:()=>({kind:'emoji',value:'🌸'}),safeImageURL:()=>'',getRelationship:async()=>null};
  for(const key of ['Gifts','Guestbook','Achievements','UserBadges','Status'])MFAuth['watch'+key]=(uid,cb)=>{watchers.push({key,uid,cb});return()=>closed.push(key);};
  const MFGifts={isOpen:false,renderWall(){}},window={MFAuth,MFGifts};
  const source=read('profile-view.js').replace("import('https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js')",'Promise.resolve(dbAdapter)');
  vm.runInNewContext(source,{window,MFAuth,MFGifts,document,dbAdapter,setTimeout});
  return{api:window.MFProfile,card,watchers,closed};
}
test('public profile respects hidden gift/guestbook sections and never watches their data',async()=>{
  const h=profileHarness({privacy:{gifts:'onlyme',guestbook:'friends'},friend:false});
  await h.api.show('sakura');
  assert.doesNotMatch(h.card.innerHTML,/id="mfProfPane-gifts"|id="mfProfPane-guestbook"|data-send-gift/);
  assert.ok(!h.watchers.some(w=>w.key==='Gifts'||w.key==='Guestbook'));
});
test('friend-visible gift walls are available to friends and subscriptions close with the profile',async()=>{
  const h=profileHarness({privacy:{gifts:'friends'},friend:true});
  await h.api.show('sakura');
  assert.match(h.card.innerHTML,/id="mfProfPane-gifts"/);
  assert.ok(h.watchers.some(w=>w.key==='Gifts'));
  h.api.hide();assert.ok(h.closed.includes('Gifts'));
});
test('late profile requests cannot replace the newest recipient',async()=>{
  let finishFirst;
  const h=profileHarness({getProfile:p=>p==='users/first'?new Promise(resolve=>finishFirst=()=>resolve({exists:()=>true,val:()=>({displayName:'First'})})):Promise.resolve({exists:()=>true,val:()=>({displayName:'Second'})})});
  const first=h.api.show('first');
  await new Promise(resolve=>setImmediate(resolve));
  await h.api.show('second');
  finishFirst();await first;
  assert.match(h.card.innerHTML,/Second/);assert.doesNotMatch(h.card.innerHTML,/>First</);
  assert.ok(h.watchers.every(w=>w.uid==='second'));
});

test('account tabs open direct links and keep exactly one section visible',()=>{
  const html=read('account.html');
  const ids=['overview','gifts','guestbook','achievements','friends'];
  const panes=Object.fromEntries(ids.map(id=>[id,{hidden:true}]));
  const buttons=ids.map(id=>({dataset:{accountTab:id},events:{},getAttribute:()=>id,setAttribute(k,v){this[k]=v;},addEventListener(k,fn){this.events[k]=fn;},focus(){}}));
  const events={},history={replaceState:(_state,_title,hash)=>history.hash=hash};
  const source=html.slice(html.indexOf('    // Shareable profile sections;'),html.indexOf('    function show(el, on)'));
  vm.runInNewContext(source,{
    document:{querySelectorAll:()=>buttons},$:(id)=>panes[id],
    window:{addEventListener:(key,fn)=>events[key]=fn},location:{hash:'#gifts'},history,
  });
  const visible=()=>ids.filter(id=>!panes[id].hidden);
  assert.deepEqual(visible(),['gifts']);
  buttons[3].events.click();assert.deepEqual(visible(),['achievements']);
  assert.equal(history.hash,'#achievements');
  buttons[3].events.keydown({key:'ArrowRight',preventDefault(){}});
  assert.deepEqual(visible(),['friends']);
  assert.equal(buttons.filter(button=>button.tabIndex===0).length,1);
});
test('public profiles give achievements and friends their own tab panels',async()=>{
  const h=profileHarness({friend:true});await h.api.show('sakura');
  for(const id of ['about','gifts','guestbook','achievements','friends']){
    assert.ok(h.card.innerHTML.includes(`aria-controls="mfProfPane-${id}"`));
    assert.ok(h.card.innerHTML.includes(`id="mfProfPane-${id}" role="tabpanel"`));
  }
  assert.match(h.card.innerHTML, /id="mfProfPane-achievements"[^>]+hidden><div class="mf-prof-achievements"/);
  assert.doesNotMatch(h.card.innerHTML,/mf-prof-side|KEPT CLOSE TO THE HEART|A LITTLE ABOUT ME/);
});
