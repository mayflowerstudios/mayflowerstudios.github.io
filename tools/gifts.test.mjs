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
const social = authSource.slice(authSource.indexOf('      const GIFT_CATALOG ='), authSource.indexOf('      MFAuth.watchGuestbook ='));
function authHarness(fetcher = async () => ({ok:true,json:async()=>manifest}), remote = {}) {
  const writes=[],notifications=[],removals=[];
  const MFAuth={user:{uid:'sender'},profile:{username:'sender'},name:()=> 'A friend',createNotification:async(...args)=>notifications.push(args)};
  const dbMod={ref:(_,p)=>p,get:async()=>({val:()=>remote}),push:()=>({key:'gift-test'}),set:async(p,data)=>writes.push({path:p,data}),remove:async p=>removals.push(p)};
  vm.runInNewContext(social,{MFAuth,dbMod,db:{},cfg:{storageBucket:'watchtogether-95d7d.firebasestorage.app'},URL,location:{origin:'https://mayflowerstudios.net'},fetch:fetcher});
  return {MFAuth,writes,notifications,dbMod,removals};
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
  await assert.rejects(MFAuth.loadGiftCatalog(),/could not be loaded/);
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
  assert.deepEqual(Object.keys(writes[0].data).sort(),['fromName','fromUid','fromUsername','giftId','name','note','t']);
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
  return{api:window.MFGifts,root,more,MFAuth};
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
  const gifts=JSON.parse(read('firebase/gifts/database.rules.json')).rules.gifts.$uid;
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

const uploadId='gift-12345678-1234-1234-1234-123456789abc';
function uploadedGift(overrides={}) {
  const storagePath=`gifts/admin/${uploadId}.png`;
  return {name:'Sleepy fox',category:'Forest',enabled:true,createdBy:'admin',createdAt:1,storagePath,image:'https://firebasestorage.googleapis.com/v0/b/watchtogether-95d7d.firebasestorage.app/o/'+encodeURIComponent(storagePath)+'?alt=media&token=example',...overrides};
}
test('admin image gifts merge with starter gifts without an emoji or a website rebuild',async()=>{
  const remote={};const h=authHarness(undefined,remote);
  await h.MFAuth.loadGiftCatalog();assert.equal(h.MFAuth.giftCatalog[uploadId],undefined);
  remote[uploadId]=uploadedGift();
  await h.MFAuth.loadGiftCatalog();
  assert.equal(h.MFAuth.giftCatalog[uploadId].name,'Sleepy fox');
  assert.equal(h.MFAuth.giftCatalog[uploadId].emoji,undefined);
  assert.ok(h.MFAuth.giftCatalog.flower);
  await h.MFAuth.sendGift('recipient',uploadId,'Hello');
  assert.equal(h.writes[0].data.giftId,uploadId);
  assert.ok(!Object.hasOwn(h.writes[0].data,'emoji'));
});
test('hidden uploads retain their art but cannot be sent',async()=>{
  const remote={[uploadId]:uploadedGift({enabled:false})};const h=authHarness(undefined,remote);
  await h.MFAuth.loadGiftCatalog();assert.ok(h.MFAuth.giftCatalog[uploadId].image);
  await assert.rejects(h.MFAuth.sendGift('recipient',uploadId,''),/no longer available/);
  assert.equal(h.writes.length,0);
});
test('uploaded image URLs must match the configured bucket, gift ID and storage path',async()=>{
  for(const overrides of [
    {image:uploadedGift().image.replace('watchtogether-95d7d','other-project')},
    {image:'https://example.org/gift.png'},
    {storagePath:'gifts/admin/different.png'},
    {image:uploadedGift().image.replace('/o/','/other/')},
  ]){
    const h=authHarness(undefined,{[uploadId]:uploadedGift(overrides)});
    await h.MFAuth.loadGiftCatalog();assert.equal(h.MFAuth.giftCatalog[uploadId],undefined);
  }
});
function uploadHarness() {
  const context={window:{}};
  const source=read('admin-gifts.js');
  vm.runInNewContext(source.slice(0,source.indexOf('  const panel ='))+'window.helpers={fileInfo,publishImage,deleteImage};})();',context);
  const uploads=[],writes=[];
  const item={id:uploadId,name:'Fox',file:{name:'sleepy-fox.png',type:'image/png',size:100},createdAt:1};
  const services={uid:'admin',storage:{},database:{},stillAllowed:()=>true,
    storageModule:{ref:(_,p)=>p,uploadBytes:async(...args)=>uploads.push(args),getDownloadURL:async()=>uploadedGift().image},
    databaseModule:{ref:(_,p)=>p,set:async(...args)=>writes.push(args)}};
  return {helpers:context.window.helpers,item,services,uploads,writes};
}
test('admin uploads derive names and preserve the original image file without conversion',async()=>{
  const h=uploadHarness();assert.equal(h.helpers.fileInfo(h.item.file).name,'sleepy fox');
  await h.helpers.publishImage(h.item,'Forest',h.services);
  assert.equal(h.uploads[0][0],`gifts/admin/${uploadId}.png`);
  assert.equal(h.uploads[0][1],h.item.file,'transparent image bytes pass through unchanged');
  assert.equal(h.writes[0][0],`giftCatalog/${uploadId}`);
  assert.ok(!Object.hasOwn(h.writes[0][1],'emoji'));
});
test('invalid uploads never reach Storage',async()=>{
  for(const file of [{name:'x.svg',type:'image/svg+xml',size:12},{name:'empty.png',type:'image/png',size:0},{name:'big.png',type:'image/png',size:9*1024*1024}]){
    const h=uploadHarness();h.item.file=file;
    await assert.rejects(h.helpers.publishImage(h.item,'Forest',h.services));
    assert.equal(h.uploads.length,0);
  }
});
test('failed catalogue publication retries the same gift without uploading twice',async()=>{
  const h=uploadHarness();let calls=0;
  h.services.databaseModule.set=async(...args)=>{calls++;if(calls===1)throw Error('permission');h.writes.push(args);};
  await assert.rejects(h.helpers.publishImage(h.item,'Forest',h.services),/permission/);
  await h.helpers.publishImage(h.item,'Forest',h.services);
  assert.equal(h.uploads.length,1);assert.equal(h.writes.length,1);
  assert.equal(h.writes[0][0],`giftCatalog/${uploadId}`);
});
test('account changes after an upload prevent catalogue publication',async()=>{
  const h=uploadHarness();let allowed=true;
  h.services.stillAllowed=()=>allowed;
  h.services.storageModule.uploadBytes=async()=>{allowed=false;};
  await assert.rejects(h.helpers.publishImage(h.item,'Forest',h.services),/account changed/);
  assert.equal(h.writes.length,0);
});

// Exercise the real queue controls and submit handler with local service adapters.
function bulkUploadHarness() {
  const control=()=>({value:'',innerHTML:'',textContent:'',disabled:false,hidden:false,dataset:{},classList:{toggle(){},add(){},remove(){}},addEventListener(){},querySelectorAll(){return[];}});
  const elements=new Map([...read('admin.html').matchAll(/\bid="([^"]+)"/g)].map(([,id])=>[id,control()]));
  const $=id=>elements.get(id);
  $('agCategory').value='Friendship';
  const fields=new Map();
  Object.defineProperty($('agQueue'),'innerHTML',{set(html){
    for(const [attribute,key] of [['data-gift-name','giftName'],['data-gift-category','giftCategory'],['data-remove-image','removeImage']]) {
      fields.set(`[${attribute}]`,[...html.matchAll(new RegExp(`<[^>]+${attribute}="([^"]+)"[^>]*>`,'g'))].map(([tag,id])=>Object.assign(control(),{dataset:{[key]:id},value:tag.match(/\bvalue="([^"]*)"/)?.[1] || ''})));
    }
  }});
  $('agQueue').querySelectorAll=selector=>fields.get(selector) || [];
  $('gift-admin').querySelectorAll=()=>[...elements.values(),...[...fields.values()].flat()];
  const remote={},auth=authHarness(undefined,remote),uploads=[],writes=[];
  auth.MFAuth.user={uid:'admin'};
  let sequence=0,failNext=false;
  const services={
    databaseModule:{ref:(_,p)=>p,set:async(p,data)=>{if(failNext){failNext=false;throw Error('Connection interrupted');}writes.push({path:p,data});remote[p.split('/').pop()]=data;}},
    storageModule:{ref:(_,p)=>p,uploadBytes:async(p,file)=>uploads.push({path:p,file}),getDownloadURL:async p=>'https://firebasestorage.googleapis.com/v0/b/watchtogether-95d7d.firebasestorage.app/o/'+encodeURIComponent(p)+'?alt=media'}
  };
  const window={MFAuth:auth.MFAuth,testServices:services,addEventListener(){}};
  const source=read('admin-gifts.js').replace('  boot();',`  dmod=window.testServices.databaseModule; smod=window.testServices.storageModule; storage={}; allowed=true; catalogReady=true; activeUid='admin'; drawLibrary(); controls();`);
  vm.runInNewContext(source,{window,MFAuth:auth.MFAuth,document:{getElementById:$},URL:{createObjectURL:file=>'blob:'+file.name,revokeObjectURL(){}},crypto:{randomUUID:()=>`12345678-1234-1234-1234-${String(++sequence).padStart(12,'0')}`}});
  const inputs=()=>fields.get('[data-gift-category]');
  return {$,auth,uploads,writes,inputs,
    add:(...names)=>$('agFiles').onchange({target:{files:names.map(name=>({name,type:'image/png',size:100}))}}),
    category:(index,value)=>{const input=inputs()[index];input.value=value;input.oninput();},
    submit:()=>$('agForm').onsubmit({preventDefault(){}}),
    failNext:()=>{failNext=true;}
  };
}

test('bulk uploads save each image category and suggest newly typed categories',async()=>{
  const h=bulkUploadHarness();h.add('fox.png','lantern.png');
  h.category(0,'Forest friends');h.category(1,'Moonlight');
  assert.match(h.$('agCategories').innerHTML,/value="Forest friends"/);
  assert.match(h.$('agCategories').innerHTML,/value="Moonlight"/);
  h.add('bunny.png');
  assert.deepEqual(h.inputs().map(input=>input.value),['Forest friends','Moonlight','Friendship']);
  await h.submit();
  assert.deepEqual(h.writes.map(write=>write.data.category),['Forest friends','Moonlight','Friendship']);
  const catalog=await h.auth.MFAuth.loadGiftCatalog();
  for(const write of h.writes)assert.equal(catalog[write.path.split('/').pop()].category,write.data.category);
  assert.equal(h.inputs().length,0);
});

test('batch category changes existing selections only when Apply to all is clicked',async()=>{
  const h=bulkUploadHarness();h.add('fox.png','lantern.png');h.category(0,'Forest friends');
  h.$('agCategory').value='Autumn';h.$('agCategory').oninput();
  assert.deepEqual(h.inputs().map(input=>input.value),['Forest friends','Friendship']);
  h.$('agApplyCategory').onclick();
  assert.deepEqual(h.inputs().map(input=>input.value),['Autumn','Autumn']);
  h.category(1,'Moonlight');
  await h.submit();assert.deepEqual(h.writes.map(write=>write.data.category),['Autumn','Moonlight']);
});

test('failed bulk publication keeps each category and reuses the uploaded image on retry',async()=>{
  const h=bulkUploadHarness();h.add('fox.png','lantern.png');h.category(0,'Forest friends');h.category(1,'Moonlight');
  h.failNext();await h.submit();
  assert.equal(h.writes.length,0);assert.equal(h.uploads.length,1);
  assert.deepEqual(h.inputs().map(input=>input.value),['Forest friends','Moonlight']);
  await h.submit();
  assert.equal(h.uploads.length,2);assert.equal(h.writes.length,2);
  assert.deepEqual(h.writes.map(write=>write.data.category),['Forest friends','Moonlight']);
});

test('an empty individual category stops the entire batch before any upload',async()=>{
  const h=bulkUploadHarness();h.add('fox.png','lantern.png');h.category(1,'  ');
  await h.submit();assert.equal(h.uploads.length,0);assert.equal(h.writes.length,0);
  assert.match(h.$('agMessage').textContent,/every gift/);
});



test('profile owners can delete received gifts without touching the shared catalogue',async()=>{
  const h=authHarness();
  await h.MFAuth.deleteGift('sender','received-1');
  assert.deepEqual(h.removals,['gifts/sender/received-1']);
  await assert.rejects(h.MFAuth.deleteGift('someone-else','received-2'),/own profile/);
  for(const id of ['', '../all','x/y'])await assert.rejects(h.MFAuth.deleteGift('sender',id));
  h.MFAuth.user=null;await assert.rejects(h.MFAuth.deleteGift('sender','received-1'),/signed in/);
  assert.equal(h.removals.length,1);
});

test('guestbook deletion permits the profile owner or note author and rejects other visitors',async()=>{
  const h=authHarness();
  await h.MFAuth.deleteGuestbookPost('sender','note-1');
  h.dbMod.get=async()=>({val:()=>({fromUid:'sender'})});
  await h.MFAuth.deleteGuestbookPost('another-profile','note-2');
  h.dbMod.get=async()=>({val:()=>({fromUid:'stranger'})});
  await assert.rejects(h.MFAuth.deleteGuestbookPost('another-profile','note-3'),/only delete notes/);
  await assert.rejects(h.MFAuth.deleteGuestbookPost('sender','../all'));
  assert.deepEqual(h.removals,['guestbooks/sender/note-1','guestbooks/another-profile/note-2']);
  h.dbMod.get=async()=>{h.MFAuth.user={uid:'changed'};return{val:()=>({fromUid:'sender'})};};
  await assert.rejects(h.MFAuth.deleteGuestbookPost('another-profile','note-4'),/account changed/);
  assert.equal(h.removals.length,2);
});

test('gift deletion buttons are shown only on the signed-in owner’s wall',()=>{
  const h=giftWallHarness();h.MFAuth.user={uid:'owner'};
  const records={received:{giftId:'flower',note:'Hello',t:1}};
  h.api.renderWall(h.root,records,{profileUid:'owner'});
  assert.match(h.root.innerHTML,/data-remove-entry="received"/);
  h.api.renderWall(h.root,records,{profileUid:'someone-else'});
  assert.doesNotMatch(h.root.innerHTML,/data-remove-entry/);
  h.MFAuth.user=null;h.api.renderWall(h.root,records,{profileUid:'owner'});
  assert.doesNotMatch(h.root.innerHTML,/data-remove-entry/);
});

test('profile removal confirms, prevents double clicks, and shows errors in the same tab',async()=>{
  const controls=Object.fromEntries(['start','confirm','yes','cancel'].map(key=>['[data-remove-'+key+']',{hidden:key==='confirm',disabled:false,textContent:'',focus(){}}]));
  const entry={dataset:{removeEntry:'received'},querySelector:selector=>controls[selector]};
  let feedback,resolve,reject;const calls=[];
  const root={isConnected:true,querySelectorAll:()=>[entry],querySelector:()=>feedback,prepend:node=>{feedback=node;}};
  const MFAuth={user:{uid:'owner'},deleteGift:(...args)=>{calls.push(args);return new Promise((a,b)=>{resolve=a;reject=b;});}};
  const window={MFAuth};
  vm.runInNewContext(read('gifts.js'),{window,MFAuth,document:{createElement:()=>({dataset:{},setAttribute(){}})}});
  window.MFGifts.bindRemovals(root,{profileUid:'owner',kind:'gift'});
  controls['[data-remove-start]'].onclick();
  assert.equal(calls.length,0);assert.equal(controls['[data-remove-confirm]'].hidden,false);
  controls['[data-remove-cancel]'].onclick();assert.equal(calls.length,0);
  controls['[data-remove-start]'].onclick();
  const pending=controls['[data-remove-yes]'].onclick();
  await controls['[data-remove-yes]'].onclick();assert.equal(calls.length,1);
  reject(Error('Network interrupted'));await pending;
  assert.match(feedback.textContent,/Network interrupted/);assert.equal(controls['[data-remove-yes]'].disabled,false);
  const retry=controls['[data-remove-yes]'].onclick();resolve();await retry;
  assert.deepEqual(calls,[['owner','received'],['owner','received']]);
});

function deletionHarness() {
  const h=uploadHarness(),events=[],gift=uploadedGift();
  h.services.databaseModule.update=async(p,value)=>events.push(['hide',p,value.enabled]);
  h.services.databaseModule.remove=async p=>events.push(['remove',p]);
  h.services.storageModule.deleteObject=async p=>events.push(['deleteFile',p]);
  return {...h,events,gift,remove:()=>h.helpers.deleteImage(uploadId,gift,h.services)};
}

test('admin deletion hides the gift before deleting its file and catalogue entry',async()=>{
  const h=deletionHarness();await h.remove();
  assert.deepEqual(h.events.map(event=>event[0]),['hide','deleteFile','remove']);
  assert.equal(h.events[1][1],h.gift.storagePath);
  assert.equal(h.events[2][1],'giftCatalog/'+uploadId);
});

test('failed image deletion keeps the hidden entry for retry; already missing files finish cleanup',async()=>{
  const h=deletionHarness();
  h.services.storageModule.deleteObject=async()=>{throw Object.assign(Error('Blocked'),{code:'storage/unauthorized'});};
  await assert.rejects(h.remove(),/Blocked/);
  assert.equal(h.gift.enabled,false);assert.deepEqual(h.events.map(event=>event[0]),['hide']);
  h.services.storageModule.deleteObject=async()=>{throw Object.assign(Error('Gone'),{code:'storage/object-not-found'});};
  await h.remove();assert.equal(h.events.at(-1)[0],'remove');
});

test('admin deletion never touches another uploader’s file or a path outside this gift',async()=>{
  for(const overrides of [{createdBy:'another-admin'},{storagePath:'avatars/admin/photo.png'},{storagePath:'gifts/admin/another.png'}]){
    const h=deletionHarness();Object.assign(h.gift,overrides);
    await assert.rejects(h.remove());assert.equal(h.events.length,0);
  }
  const h=deletionHarness();
  h.services.databaseModule.update=async()=>{throw Error('Permission denied');};
  await assert.rejects(h.remove(),/Permission/);assert.equal(h.events.length,0);
});

test('account changes interrupt admin deletion before subsequent writes',async()=>{
  const h=deletionHarness();let allowed=true;h.services.stillAllowed=()=>allowed;
  h.services.storageModule.deleteObject=async()=>{allowed=false;};
  await assert.rejects(h.remove(),/account changed/);
  assert.deepEqual(h.events.map(event=>event[0]),['hide']);
});

test('database rules allow only the recipient to delete a received gift',()=>{
  const rule=JSON.parse(read('firebase/gifts/database.rules.json')).rules.gifts.$uid.$giftId['.write'];
  const snapshot=value=>({exists:()=>value!=null,child:key=>snapshot(value?.[key]),val:()=>value});
  function permits(uid,oldValue,newValue){return vm.runInNewContext(rule,{auth:uid?{uid}:null,$uid:'recipient',data:snapshot(oldValue),newData:snapshot(newValue)});}
  const gift={fromUid:'sender'};
  assert.equal(permits('recipient',gift,null),true);
  assert.equal(permits('sender',gift,null),false);
  assert.equal(permits('stranger',gift,null),false);
  assert.equal(permits(null,gift,null),false);
  assert.equal(permits('sender',null,gift),true);
  assert.equal(permits('recipient',gift,{fromUid:'recipient'}),false);
});

test('gift rules make catalogue writes admin-only and accept image gifts without emojis',()=>{
  const rules=JSON.parse(read('firebase/gifts/database.rules.json')).rules;
  const catalog=rules.giftCatalog.$giftId;
  assert.match(catalog['.write'],/child\('usernames'\)/);
  assert.match(catalog['.write'],/child\('admins'\)/);
  assert.match(catalog['.write'],/newData.exists\(\)/);
  assert.equal(catalog.$other['.validate'],false);
  assert.doesNotMatch(catalog['.validate'],/emoji/);
  assert.doesNotMatch(rules.gifts.$uid.$giftId['.validate'],/emoji/);
  assert.match(rules.gifts.$uid.$giftId['.validate'],/giftCatalog.*enabled/);
  const storage=read('firebase/gifts/storage.rules');
  assert.match(storage,/match \/gifts\/\{uid\}\/\{file\}/);
  assert.match(storage,/request.auth.uid == uid/);
  assert.match(storage,/request.resource.size <= 8 \* 1024 \* 1024/);
  const giftStorage=storage.slice(storage.indexOf('    match /gifts/'));
  assert.match(giftStorage,/allow delete: if request.auth != null\s+&& request.auth.uid == uid/);
  assert.match(catalog['.write'],/newData.exists\(\) \|\| data.child\('createdBy'\).val\(\) === auth.uid/);
});
