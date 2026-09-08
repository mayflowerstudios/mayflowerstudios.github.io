import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');

test('contact submission announces progress, prevents duplicates, and preserves a failed message for retry',async()=>{
  const controls=new Map();
  const el=id=>{if(!controls.has(id))controls.set(id,{value:'',textContent:'',disabled:false,checked:false,
    setAttribute(k,v){this[k]=v;},removeAttribute(k){delete this[k];},addEventListener(k,fn){this[k]=fn;},reset(){throw Error('failed sends must not reset the form');}});return controls.get(id);};
  let reject,calls=0;
  vm.runInNewContext(read('contact.js'),{window:{},document:{getElementById:el,referrer:''},
    crypto:{getRandomValues:b=>b},console:{warn(){}},fetch:()=>{calls++;return new Promise((_,r)=>{reject=r;});}});
  el('cMessage').value='Please help with my room.';el('cSend').textContent='Send message';
  const event={preventDefault(){}};const pending=el('cForm').submit(event);
  assert.equal(el('cSend').textContent,'Sending…');assert.equal(el('cSend')['aria-busy'],'true');
  await el('cForm').submit(event);assert.equal(calls,1);
  reject(Error('offline'));await pending;
  assert.equal(el('cMessage').value,'Please help with my room.');assert.equal(el('cSend').disabled,false);
  assert.equal(el('cSend').textContent,'Send message');assert.equal(el('cFormMsg').role,'alert');
  assert.match(el('cFormMsg').textContent,/select Send again/);
});

test('world loading errors remain visible during auth refresh and a retry restores the library',async()=>{
  const source=read('worlds.js'),begin=source.indexOf('  async function load(){'),end=source.indexOf('  grid.addEventListener',begin);
  const grid={innerHTML:'',setAttribute(k,v){this[k]=v;},removeAttribute(k){delete this[k];}};
  const notice={hidden:true,textContent:''};let fail=true,draws=0;
  const context={libraryPhase:'loading',grid,notice,all:[],DB:'https://test.invalid',location:{search:''},URLSearchParams,
    console:{warn(){}},normalize:x=>x,draw:()=>{draws++;},waitAuth(){},fetch:async()=>{if(fail)throw Error('offline');return{ok:true,json:async()=>[{title:'Garden'}]};}};
  vm.createContext(context);vm.runInContext(source.slice(begin,end),context);
  await context.load();assert.equal(context.libraryPhase,'error');assert.match(grid.innerHTML,/data-retry-worlds/);assert.equal(draws,0);
  fail=false;await context.load();assert.equal(context.libraryPhase,'ready');assert.equal(draws,1);assert.equal(grid['aria-busy'],undefined);assert.equal(notice.hidden,true);
});

test('every static interface icon reference resolves to a shipped symbol',()=>{
  const sprite=read('assets/ui-icons.svg'),ids=new Set([...sprite.matchAll(/<symbol id="([^"]+)"/g)].map(m=>m[1]));
  for(const file of ['shared.js','settings.html','chat.js','profile-view.js','watch-together.html']){
    for(const [,name] of read(file).matchAll(/ui-icons\.svg#([a-z-]+)"/g))assert.ok(ids.has(name),`${file}: missing ${name}`);
  }
  assert.equal(ids.size,25);
});
