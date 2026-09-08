import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../auth.js',import.meta.url),'utf8');
function harness() {
  const listeners=[],pending=new Map(),writes=[];
  let change;
  const dbMod={ref:(_,path)=>path,serverTimestamp:()=>0,onDisconnect:()=>({set(){}}),set:(path,data)=>writes.push({path,data}),
    onValue(path,fn){const sub={path,fn,active:true};listeners.push(sub);return()=>{sub.active=false;};}};
  const MFAuth={user:null,profile:null,_emit(){},refreshBasicAchievements:async()=>{}};
  const context={MFAuth,dbMod,db:{},auth:{},authMod:{onAuthStateChanged:(_,fn)=>{change=fn;}},
    ensureProfile:user=>new Promise(resolve=>pending.set(user.uid,resolve)),ready:false,
    localStorage:{getItem:()=>null},clearTimeout(){},console};
  const start=source.indexOf('      // ---- presence (online');
  const end=source.indexOf('\n    } catch (err)',start);
  vm.runInNewContext(source.slice(start,end),context);
  return{change,listeners,pending,MFAuth,writes};
}
test('account changes leave only one profile and one connection listener',async()=>{
  const h=harness();
  for(const uid of ['alice','bob','alice']) {
    const waiting=h.change({uid});h.pending.get(uid)({displayName:uid});await waiting;
    assert.equal(h.listeners.filter(s=>s.active).length,2);
  }
  const old=h.listeners.find(s=>s.path==='users/bob');
  old.fn({exists:()=>true,val:()=>({displayName:'stale Bob'})});
  assert.equal(h.MFAuth.profile.displayName,'alice');
  await h.change(null);
  assert.equal(h.listeners.filter(s=>s.active).length,0);assert.equal(h.MFAuth.profile,null);
});
test('a profile request finishing after sign-out cannot restart presence or restore that profile',async()=>{
  const h=harness();const pending=h.change({uid:'alice'});
  await h.change(null);h.pending.get('alice')({displayName:'Alice'});await pending;
  assert.equal(h.MFAuth.user,null);assert.equal(h.MFAuth.profile,null);assert.equal(h.listeners.length,0);
});
