/* Mayflower Studios — admin Stripe world payment history/refunds */
(function(){
  "use strict";
  const DB="https://watchtogether-95d7d-default-rtdb.firebaseio.com";
  const ACTION_FN="https://us-central1-watchtogether-95d7d.cloudfunctions.net/worldAdminPaymentAction";
  const STORE_INFO_FN="https://us-central1-watchtogether-95d7d.cloudfunctions.net/worldStoreInfo";
  const $=id=>document.getElementById(id);
  if(!$('wpayList'))return;
  const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  let user=null,allowed=false,orders={},worlds={},users={},storeMode="unknown",busy="";

  const msg=(t,bad=false)=>{const e=$('wpayMsg');e.textContent=t||"";e.className='wpayMsg '+(bad?'bad':'ok')};
  const money=(cents,currency='USD')=>{try{return new Intl.NumberFormat(undefined,{style:'currency',currency:String(currency||'USD').toUpperCase()}).format((Number(cents)||0)/100)}catch(_){return '$'+((Number(cents)||0)/100).toFixed(2)}};
  const date=v=>{const d=new Date(Number(v)||0);return isNaN(d)?'':d.toLocaleString(undefined,{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})};
  const mode=o=>o&&o.livemode===true?'live':'test';
  const stripeUrl=o=>`${o&&o.livemode===true?'https://dashboard.stripe.com/payments/':'https://dashboard.stripe.com/test/payments/'}${encodeURIComponent(String(o&&o.paymentIntentId||''))}`;
  async function token(){if(!user)throw new Error('Not signed in');return user.getIdToken()}
  async function get(path){const t=await token();const r=await fetch(`${DB}/${path}.json?auth=${encodeURIComponent(t)}`,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()}
  async function check(u){
    user=u;if(!u)return;
    try{
      const profile=window.MFAuth&&MFAuth.profile||{};let me=String(profile.username||'').toLowerCase();if(!me)me=String(await get(`users/${u.uid}/username`)||'').toLowerCase();if(!me)return;
      const [owner,admin]=await Promise.all([get('owner'),get(`admins/${encodeURIComponent(me)}`)]);
      allowed=String(owner||'').toLowerCase()===me||admin===true;if(!allowed)return;
      wire();await load();
    }catch(e){msg('Payment history could not start: '+e.message,true)}
  }
  function wire(){
    if($('wpayList').dataset.wired)return;$('wpayList').dataset.wired='1';
    $('wpayRefresh').addEventListener('click',load);$('wpaySearch').addEventListener('input',draw);$('wpayMode').addEventListener('change',draw);$('wpayStatus').addEventListener('change',draw);$('wpayList').addEventListener('click',act);
  }
  async function load(){
    if(!allowed)return;$('wpayList').innerHTML='<div class="acctEmpty">Loading payments…</div>';$('wpayRefresh').disabled=true;
    try{
      const [o,w,u,sm]=await Promise.all([get('worldOrders'),get('worldLibrary'),get('users'),fetch(STORE_INFO_FN,{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null)]);
      orders=o||{};worlds=w||{};users=u||{};if(sm&&/^(test|live)$/.test(sm.mode))storeMode=sm.mode;
      $('wpayStoreMode').textContent=storeMode==='live'?'LIVE STRIPE MODE':storeMode==='test'?'TEST STRIPE MODE':'STRIPE MODE UNKNOWN';$('wpayStoreMode').className='wpayModeBadge '+storeMode;
      draw();msg('');
    }catch(e){$('wpayList').innerHTML='<div class="acctEmpty">Could not load payment history.</div>';msg(e.message,true)}finally{$('wpayRefresh').disabled=false}
  }
  function buyer(o){const u=users[o.uid]||{};const name=u.displayName||u.username||o.customerName||o.customerEmail||o.uid||'Unknown buyer';const handle=u.username?` @${u.username}`:'';return {name,handle}}
  function title(o){return worlds[o.worldId]&&worlds[o.worldId].title||o.worldId||'Unknown world'}
  function filtered(){
    const q=String($('wpaySearch').value||'').trim().toLowerCase(),mf=$('wpayMode').value,sf=$('wpayStatus').value;
    return Object.entries(orders).map(([id,o])=>({id,...(o||{})})).filter(o=>{
      if(mf&&mode(o)!==mf)return false;if(sf&&String(o.status||'paid')!==sf)return false;
      if(q){const b=buyer(o);const hay=[o.id,o.paymentIntentId,o.customerEmail,b.name,b.handle,title(o),o.worldId,o.status].join(' ').toLowerCase();if(!hay.includes(q))return false}
      return true;
    }).sort((a,b)=>(Number(b.recordedAt)||0)-(Number(a.recordedAt)||0));
  }
  function stats(rows){
    const live=rows.filter(o=>mode(o)==='live'),test=rows.filter(o=>mode(o)==='test');
    const gross=live.reduce((n,o)=>n+(Number(o.amountPaidCents)||0),0),refunds=live.reduce((n,o)=>n+(Number(o.refundedCents??o.partialRefundCents)||0),0);
    $('wpayStats').innerHTML=`<div><span>Orders shown</span><b>${rows.length}</b></div><div><span>Live gross</span><b>${esc(money(gross,'USD'))}</b></div><div><span>Live / Test</span><b>${live.length} / ${test.length}</b></div><div><span>Refunded tracked</span><b>${esc(money(refunds,'USD'))}</b></div>`;
  }
  function statusBadge(o){const s=String(o.status||'paid');const label=s==='paid'?'Paid / active':s==='disputed'?'Disputed':s==='revoked'?'Revoked / refunded':s;return `<span class="wpayStatus ${esc(s)}">${esc(label)}</span>`}
  function row(o){
    const b=buyer(o),ref=Number(o.refundedCents??o.partialRefundCents)||0,remaining=Math.max(0,(Number(o.amountPaidCents)||0)-ref),canRefund=!!o.paymentIntentId&&remaining>0&&o.status!=='disputed';
    const currentMode=mode(o)===storeMode;
    return `<article class="wpayOrder ${mode(o)}">
      <div class="wpayOrderMain"><div class="wpayOrderTop"><div><strong>${esc(title(o))}</strong><small>${esc(date(o.recordedAt))}</small></div><div class="wpayBadges"><span class="wpayModeBadge ${mode(o)}">${mode(o).toUpperCase()}</span>${statusBadge(o)}</div></div>
      <div class="wpayBuyer"><b>${esc(b.name)}</b>${b.handle?`<span>${esc(b.handle)}</span>`:''}${o.customerEmail?`<span>${esc(o.customerEmail)}</span>`:''}</div>
      <div class="wpayFacts"><span><small>Paid</small><b>${esc(money(o.amountPaidCents,o.currency))}</b></span>${ref?`<span><small>Refunded</small><b>${esc(money(ref,o.currency))}</b></span>`:''}<span><small>Mayflower UID</small><code>${esc(o.uid||'')}</code></span><span><small>Order</small><code>${esc(o.id)}</code></span></div>
      ${o.statusReason?`<div class="wpayReason">${esc(o.statusReason)}</div>`:''}${!currentMode?`<div class="wpayWarning">This is a ${mode(o)} payment while the store is currently ${storeMode}. Stripe actions need the matching ${mode(o)} key.</div>`:''}</div>
      <div class="wpayActions">${o.paymentIntentId?`<a class="btn ghost" target="_blank" rel="noopener" href="${esc(stripeUrl(o))}">Open in Stripe</a>`:''}${canRefund?`<button type="button" data-pay-action="partial" data-session="${esc(o.id)}">Partial refund</button><button class="danger" type="button" data-pay-action="refund" data-session="${esc(o.id)}">Full refund</button>`:''}${o.status==='paid'?`<button type="button" data-pay-action="revoke" data-session="${esc(o.id)}">Revoke access</button>`:`<button type="button" data-pay-action="restore" data-session="${esc(o.id)}">Restore access</button>`}</div>
    </article>`;
  }
  function draw(){const rows=filtered();$('wpayCount').textContent=`${rows.length} order${rows.length===1?'':'s'}`;stats(rows);$('wpayList').innerHTML=rows.length?rows.map(row).join(''):'<div class="acctEmpty">No payments match these filters.</div>'}
  async function call(sessionId,action,amountCents){
    if(busy)return;busy=sessionId;draw();
    try{
      const t=await token(),r=await fetch(ACTION_FN,{method:'POST',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body:JSON.stringify({sessionId,action,amountCents}),cache:'no-store'}),d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d.error||`Payment action failed (${r.status})`);msg(d.message||'Payment updated.');await new Promise(r=>setTimeout(r,900));await load();
    }catch(e){msg(e.message||'Payment action failed.',true)}finally{busy='';draw()}
  }
  function parseDollars(v){const s=String(v||'').trim();if(!/^\d+(?:\.\d{1,2})?$/.test(s))return NaN;const [a,b='']=s.split('.');return Number(a)*100+Number(b.padEnd(2,'0'))}
  async function act(e){
    const b=e.target.closest&&e.target.closest('[data-pay-action]');if(!b||busy)return;const id=b.dataset.session,o=orders[id];if(!o)return;const a=b.dataset.payAction;
    if(a==='refund'){
      if(!confirm(`FULL REFUND ${money(o.amountPaidCents,o.currency)} for “${title(o)}”?\n\nStripe will return the money and the buyer's download access will be revoked when Stripe confirms the refund.`))return;
      return call(id,'refundFull');
    }
    if(a==='partial'){
      const already=Number(o.refundedCents??o.partialRefundCents)||0,max=Math.max(0,(Number(o.amountPaidCents)||0)-already),raw=prompt(`Partial refund for “${title(o)}”\nMaximum remaining: ${money(max,o.currency)}\n\nEnter refund amount in dollars:`);if(raw==null)return;const cents=parseDollars(raw);if(!Number.isFinite(cents)||cents<1||cents>max){alert(`Enter an amount from $0.01 to ${(max/100).toFixed(2)}.`);return}return call(id,'refundPartial',cents);
    }
    if(a==='revoke'){
      const reason=prompt(`Revoke download access for “${title(o)}”?\nThis does NOT refund their Stripe payment.\n\nOptional reason:`,'Access manually revoked by Mayflower Studios');if(reason==null)return;
      const t=await token();busy=id;try{const r=await fetch(ACTION_FN,{method:'POST',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body:JSON.stringify({sessionId:id,action:'revoke',reason}),cache:'no-store'}),d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Revoke failed');msg(d.message||'Access revoked.');await load()}catch(err){msg(err.message,true)}finally{busy='';draw()}return;
    }
    if(a==='restore'){
      if(!confirm(`Restore download access for “${title(o)}”? Stripe will be checked first to make sure the payment is still valid.`))return;return call(id,'restore');
    }
  }
  function wait(){if(!window.MFAuth){setTimeout(wait,100);return}MFAuth.onChange(u=>check(u))}wait();
})();
