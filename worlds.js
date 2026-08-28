/* Mayflower Studios — public 3DX World Library + protected paid-world delivery */
(function(){
  "use strict";
  const DB="https://watchtogether-95d7d-default-rtdb.firebaseio.com";
  const DOWNLOAD_FN="https://us-central1-watchtogether-95d7d.cloudfunctions.net/worldDownload";
  const grid=document.getElementById("worldGrid"), search=document.getElementById("worldSearch"), sort=document.getElementById("worldSort"), count=document.getElementById("worldCount"), notice=document.getElementById("worldNotice"), page=document.getElementById("worldPage");
  const purchaseBox=document.getElementById("worldPurchases"), purchaseList=document.getElementById("worldPurchaseList"), purchaseRefresh=document.getElementById("worldPurchaseRefresh");
  let all=[], shots=[], shotIndex=0, authUser=null, purchases={}, activeDetail=null;
  const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  const safeUrl=v=>{try{const u=new URL(String(v||""),location.origin);return (u.protocol==="https:"||u.protocol==="http:")?u.href:""}catch(_){return ""}};
  const fileSize=n=>{n=Number(n)||0;if(!n)return "";const u=["B","KB","MB","GB"];let i=0;while(n>=1024&&i<u.length-1){n/=1024;i++}return `${n>=10||i===0?n.toFixed(0):n.toFixed(1)} ${u[i]}`};
  const date=v=>{const d=new Date(Number(v)||0);return isNaN(d)?"":d.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"})};
  const paid=w=>!!(w&&w.commerce&&w.commerce.type==="paid");
  const owned=w=>!!(authUser&&purchases&&purchases[w.id]&&purchases[w.id].status==="active");
  function price(w){
    if(!paid(w))return "Free";
    const c=w.commerce||{};
    try{return new Intl.NumberFormat(undefined,{style:"currency",currency:c.currency||"USD"}).format((Number(c.priceCents)||0)/100)}catch(_){return `${((Number(c.priceCents)||0)/100).toFixed(2)} ${c.currency||"USD"}`}
  }
  function normalize(data){
    return Object.entries(data||{}).map(([id,w])=>Object.assign({id},w||{})).filter(w=>w.published!==false&&w.title&&w.world&&w.world.name).map(w=>{w.images=Array.isArray(w.images)?w.images:Object.values(w.images||{});w.tags=Array.isArray(w.tags)?w.tags:Object.values(w.tags||{});w.commerce=w.commerce||{type:"free"};return w});
  }
  function cover(w){const im=(w.images||[]).find(x=>x&&safeUrl(x.url));if(!im)return `<div class="worldCoverEmpty" aria-hidden="true">🏡</div>`;return `<img src="${esc(safeUrl(im.url))}" alt="${esc(w.title)} screenshot" loading="lazy" decoding="async" onerror="this.parentElement.innerHTML='<div class=&quot;worldCoverEmpty&quot;>🏡</div>'">`}
  function actionButtons(w,detail=false){
    if(!paid(w)){
      const dl=safeUrl(w.world&&w.world.url);
      return dl?`<a class="btn primary" href="${esc(dl)}" download="${esc((w.world&&w.world.name)||w.title+'.world')}">⬇ Download .world</a>`:`<span class="btn ghost" aria-disabled="true">File unavailable</span>`;
    }
    if(owned(w))return `<button class="btn primary worldOwned" type="button" data-paid-download="${esc(w.id)}">🔐 Download purchased world</button>`;
    const c=w.commerce||{}, ready=/^\d+$/.test(String(c.bmtCid||""))&&/^\d+$/.test(String(c.bmtProductId||""));
    if(!ready)return `<span class="btn ghost" aria-disabled="true">Paid download not on sale yet</span>`;
    return `<button class="btn primary" type="button" data-buy="${esc(w.id)}">Buy ${esc(price(w))}</button>`;
  }
  function card(w){
    const tags=(w.tags||[]).slice(0,5).map(t=>`<span class="worldTag">${esc(t)}</span>`).join("");
    return `<article class="card worldCard"><button class="worldCoverBtn" type="button" data-open="${esc(w.id)}" aria-label="Open ${esc(w.title)}">${cover(w)}</button><div class="worldCardBody"><div class="worldCardTop"><div><h2>${esc(w.title)}</h2><div class="worldBy">${esc(w.creator||"Mayflower Studios")}${w.updatedAt?` · ${esc(date(w.updatedAt))}`:""}</div></div><div>${w.featured?'<span class="worldFeatured">★ Featured</span>':''}</div></div><div style="margin-top:8px"><span class="worldPrice${paid(w)?"":" free"}">${paid(w)?"🔐 ":""}${esc(price(w))}${owned(w)?" · Owned":""}</span></div><p class="worldSummary">${esc(w.description||"No description yet.")}</p>${tags?`<div class="worldTags">${tags}</div>`:""}<div class="worldCardActions"><a class="btn ghost" href="?world=${encodeURIComponent(w.id)}">View world</a>${actionButtons(w)}</div>${paid(w)?'<div class="worldBuyNote">Payment is handled by BMT Micro. The protected file unlocks to the Mayflower account used to start checkout.</div>':''}</div></article>`;
  }
  function draw(){
    if(new URLSearchParams(location.search).get("world"))return;
    const q=(search.value||"").trim().toLowerCase();let arr=all.filter(w=>!q||[w.title,w.description,w.creator,...(w.tags||[])].join(" ").toLowerCase().includes(q));
    if(sort.value==="az")arr.sort((a,b)=>String(a.title).localeCompare(String(b.title)));
    else if(sort.value==="featured")arr.sort((a,b)=>(b.featured===true)-(a.featured===true)||(b.updatedAt||b.createdAt||0)-(a.updatedAt||a.createdAt||0));
    else arr.sort((a,b)=>(b.updatedAt||b.createdAt||0)-(a.updatedAt||a.createdAt||0));
    count.textContent=`${arr.length} world${arr.length===1?"":"s"}`;
    grid.innerHTML=arr.length?arr.map(card).join(""):`<div class="worldEmpty">${all.length?"No worlds match that search.":"No worlds have been published yet."}</div>`;
  }
  function detail(w){
    activeDetail=w;
    document.title=`${w.title} • 3DX World Library • Mayflower Studios`;
    const imgs=(w.images||[]).filter(x=>x&&safeUrl(x.url));
    const gallery=imgs.length?`<div class="sectionTitle"><h2>🖼️ Screenshots</h2><span>${imgs.length} image${imgs.length===1?"":"s"}</span></div><section class="worldGallery">${imgs.map((im,i)=>`<button class="worldShot" type="button" data-shot="${i}" aria-label="Open screenshot ${i+1}"><img src="${esc(safeUrl(im.url))}" alt="${esc(im.caption||w.title+' screenshot '+(i+1))}" loading="lazy" onerror="this.closest('.worldShot').remove()"></button>`).join("")}</section>`:"";
    const tags=(w.tags||[]).map(t=>`<span class="worldTag">${esc(t)}</span>`).join("");
    const commerce=paid(w)?`<div class="worldCommerceBanner"><strong>${owned(w)?"Purchased":"Secure paid world"} · ${esc(price(w))}</strong><br>${owned(w)?"This world is unlocked for your signed-in Mayflower Studios account. Downloads use a short-lived protected link.":"Checkout is processed by BMT Micro. Mayflower Studios never receives or stores your card number. After BMT confirms the order server-to-server, this account receives download access."}</div>`:"";
    page.innerHTML=`<a class="worldDetailBack" href="/worlds.html">← All worlds</a><section class="worldDetailHero"><div class="worldDetailCover">${cover(w)}</div><div class="card worldDetailInfo"><div class="worldDetailKicker">3DXChat World</div><h1>${esc(w.title)}</h1><div class="worldBy">Shared by ${esc(w.creator||"Mayflower Studios")}</div><div style="margin-top:10px"><span class="worldPrice${paid(w)?"":" free"}">${paid(w)?"🔐 ":""}${esc(price(w))}${owned(w)?" · Owned":""}</span></div>${tags?`<div class="worldTags" style="margin-top:12px">${tags}</div>`:""}<p class="worldDetailDesc">${esc(w.description||"")}</p><div class="worldMeta">${w.version?`<div><span>Version</span><strong>${esc(w.version)}</strong></div>`:""}<div><span>File</span><strong>${esc((w.world&&w.world.name)||"World file")}</strong></div>${w.world&&w.world.size?`<div><span>Size</span><strong>${esc(fileSize(w.world.size))}</strong></div>`:""}${w.updatedAt?`<div><span>Updated</span><strong>${esc(date(w.updatedAt))}</strong></div>`:""}</div><div class="worldDetailActions">${actionButtons(w,true)}<button class="btn ghost" id="worldShare" type="button">🔗 Copy link</button></div>${paid(w)?'<div class="worldSecureLine">🔒 <span><b>Protected delivery</b> · purchase required for the actual .world file</span></div>':''}${commerce}</div></section>${gallery}<section class="card worldDisclaimer"><strong>Using this world</strong><p>${paid(w)?"Purchasing this world grants the purchaser a personal, non-transferable license to use the downloaded world in 3DXChat. It does not transfer copyright or grant permission to redistribute, resell, mirror, or claim the world as your own. ":"Download the <code>.world</code> file and import it through 3DXChat's world editor. "}Unless this world says otherwise, downloading original Mayflower Studios work does not grant permission to re-upload, redistribute, sell, or claim it as your own.</p></section>`;
    shots=imgs;wireDetail();
  }
  function wireDetail(){
    page.querySelectorAll("[data-shot]").forEach(b=>b.addEventListener("click",()=>openShot(Number(b.dataset.shot)||0)));
    const sh=document.getElementById("worldShare");if(sh)sh.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(location.href);sh.textContent="✓ Link copied";setTimeout(()=>sh.textContent="🔗 Copy link",1300)}catch(_){prompt("Copy this link:",location.href)}});
  }
  const lb=document.getElementById("worldLightbox"), lbimg=document.getElementById("worldLightboxImage"), lbcap=document.getElementById("worldLightboxCaption");
  function openShot(i){if(!shots.length)return;shotIndex=(i+shots.length)%shots.length;const im=shots[shotIndex];lbimg.src=safeUrl(im.url);lbimg.alt=im.caption||`Screenshot ${shotIndex+1}`;lbcap.textContent=im.caption||`${shotIndex+1} / ${shots.length}`;lb.hidden=false;document.body.style.overflow="hidden"}
  function closeShot(){lb.hidden=true;lbimg.src="";document.body.style.overflow=""}
  lb.querySelector(".worldLightboxClose").addEventListener("click",closeShot);lb.querySelector(".worldLightboxPrev").addEventListener("click",()=>openShot(shotIndex-1));lb.querySelector(".worldLightboxNext").addEventListener("click",()=>openShot(shotIndex+1));lb.addEventListener("click",e=>{if(e.target===lb)closeShot()});document.addEventListener("keydown",e=>{if(lb.hidden)return;if(e.key==="Escape")closeShot();if(e.key==="ArrowLeft")openShot(shotIndex-1);if(e.key==="ArrowRight")openShot(shotIndex+1)});

  async function startBuy(id){
    const w=all.find(x=>x.id===id);if(!w||!paid(w))return;
    if(!authUser){
      alert("Sign in to your Mayflower Studios account first. The purchase is attached to that account so you can download it again later.");
      const back=location.pathname+location.search;
      location.href=`/account.html?next=${encodeURIComponent(back)}`;return;
    }
    const c=w.commerce||{};
    if(!/^\d+$/.test(String(c.bmtCid||""))||!/^\d+$/.test(String(c.bmtProductId||""))){alert("This paid world is not ready for checkout yet.");return}
    const q=new URLSearchParams({CID:String(c.bmtCid),PRODUCTID:String(c.bmtProductId),CLR:"0",ORDERPARAMETERS:authUser.uid,ITEMINFO:w.id,REFERRAL:"mayflower-world-library"});
    location.href=`https://secure.bmtmicro.com/cart?${q.toString()}`;
  }
  async function paidDownload(id,button){
    const w=all.find(x=>x.id===id);if(!w||!paid(w))return;
    if(!authUser){alert("Sign in to the account that purchased this world first.");const back=location.pathname+location.search;location.href=`/account.html?next=${encodeURIComponent(back)}`;return}
    if(button){button.disabled=true;button.textContent="Checking purchase…"}
    try{
      const token=await authUser.getIdToken(true);
      const r=await fetch(`${DOWNLOAD_FN}?world=${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
      const data=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(data.error||`Download check failed (${r.status})`);
      if(!safeUrl(data.url))throw new Error("The secure download link was not returned.");
      location.href=data.url;
    }catch(err){alert(err.message||"Could not unlock this download.")}
    finally{if(button){button.disabled=false;button.textContent="🔐 Download purchased world"}}
  }
  document.addEventListener("click",e=>{
    const buy=e.target.closest&&e.target.closest("[data-buy]");if(buy){startBuy(buy.dataset.buy);return}
    const dl=e.target.closest&&e.target.closest("[data-paid-download]");if(dl){paidDownload(dl.dataset.paidDownload,dl);return}
    const op=e.target.closest&&e.target.closest("[data-open]");if(op)location.href=`?world=${encodeURIComponent(op.dataset.open)}`;
  });
  search.addEventListener("input",draw);sort.addEventListener("change",draw);

  async function loadPurchases(){
    purchases={};
    if(!authUser){renderPurchases();refreshWorldUI();return}
    try{
      const token=await authUser.getIdToken();
      const r=await fetch(`${DB}/worldPurchases/${encodeURIComponent(authUser.uid)}.json?auth=${encodeURIComponent(token)}`,{cache:"no-store"});
      if(r.ok)purchases=await r.json()||{};
    }catch(err){console.warn("purchase list",err)}
    renderPurchases();refreshWorldUI();
  }
  function renderPurchases(){
    if(!purchaseBox||!purchaseList)return;
    if(!authUser){purchaseBox.hidden=true;return}
    const ids=Object.entries(purchases||{}).filter(([,p])=>p&&p.status==="active").map(([id])=>id);
    purchaseBox.hidden=false;
    if(!ids.length){purchaseList.innerHTML='<div class="worldPurchasePending">No paid worlds are attached to this account yet. After a completed purchase, use “Refresh purchases” if the checkout tab is still open.</div>';return}
    purchaseList.innerHTML=ids.map(id=>{const w=all.find(x=>x.id===id);return w?`<div class="worldPurchaseItem"><strong>${esc(w.title)}</strong><button class="btn ghost" type="button" data-paid-download="${esc(id)}">Download</button></div>`:""}).join("")||'<div class="worldPurchasePending">Your purchase record is here, but that world is currently hidden.</div>';
  }
  function refreshWorldUI(){
    if(activeDetail){const w=all.find(x=>x.id===activeDetail.id);if(w)detail(w)}else draw();
  }
  if(purchaseRefresh)purchaseRefresh.addEventListener("click",async()=>{purchaseRefresh.disabled=true;purchaseRefresh.textContent="Refreshing…";await loadPurchases();purchaseRefresh.disabled=false;purchaseRefresh.textContent="Refresh purchases"});
  function waitAuth(){
    if(!window.MFAuth){setTimeout(waitAuth,100);return}
    MFAuth.onChange(u=>{authUser=u||null;loadPurchases()});
  }

  async function load(){
    try{const r=await fetch(`${DB}/worldLibrary.json?orderBy=%22published%22&equalTo=true`,{cache:"no-store"});if(!r.ok)throw new Error(`HTTP ${r.status}`);all=normalize(await r.json());const id=new URLSearchParams(location.search).get("world");if(id){const w=all.find(x=>x.id===id);if(w){detail(w);waitAuth();return}notice.hidden=false;notice.textContent="That world could not be found. Showing the library instead.";history.replaceState(null,"","/worlds.html")}draw();waitAuth()}
    catch(err){console.warn("World library failed",err);grid.innerHTML='<div class="worldEmpty">The World Library could not be loaded right now.</div>';notice.hidden=false;notice.textContent="The world list is temporarily unavailable.";waitAuth()}
  }
  load();
})();
