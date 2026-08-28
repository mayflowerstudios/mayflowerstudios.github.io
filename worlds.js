/* Mayflower Studios — public 3DX World Library */
(function(){
  "use strict";
  const DB="https://watchtogether-95d7d-default-rtdb.firebaseio.com";
  const CHECKOUT_FN="https://us-central1-watchtogether-95d7d.cloudfunctions.net/worldCheckout";
  const DOWNLOAD_FN="https://us-central1-watchtogether-95d7d.cloudfunctions.net/worldDownload";
  const DOWNLOAD_CHUNK_FN="https://us-central1-watchtogether-95d7d.cloudfunctions.net/worldDownloadChunk";
  const STORE_INFO_FN="https://us-central1-watchtogether-95d7d.cloudfunctions.net/worldStoreInfo";
  const grid=document.getElementById("worldGrid"), search=document.getElementById("worldSearch"), sort=document.getElementById("worldSort"), count=document.getElementById("worldCount"), notice=document.getElementById("worldNotice"), page=document.getElementById("worldPage");
  const featuredSection=document.getElementById("worldFeaturedSection"), featuredGrid=document.getElementById("worldFeaturedGrid");
  const purchaseBox=document.getElementById("worldPurchases"), purchaseList=document.getElementById("worldPurchaseList");
  let all=[], shots=[], shotIndex=0, authUser=null, purchases={}, activeDetail=null, storeMode="unknown";
  const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  const safeUrl=v=>{try{const u=new URL(String(v||""),location.origin);return (u.protocol==="https:"||u.protocol==="http:")?u.href:""}catch(_){return ""}};
  const fileSize=n=>{n=Number(n)||0;if(!n)return "";const u=["B","KB","MB","GB"];let i=0;while(n>=1024&&i<u.length-1){n/=1024;i++}return `${n>=10||i===0?n.toFixed(0):n.toFixed(1)} ${u[i]}`};
  const date=v=>{const d=new Date(Number(v)||0);return isNaN(d)?"":d.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"})};
  const paid=w=>!!(w&&w.commerce&&w.commerce.type==="paid");
  const purchaseMode=p=>p&&p.livemode===true?"live":"test";
  const owned=w=>{const p=authUser&&purchases&&purchases[w.id];return !!(p&&p.status==="active"&&(storeMode==="unknown"||purchaseMode(p)===storeMode))};
  function b64ToBytes(v){
    let s=String(v||"").replace(/-/g,"+").replace(/_/g,"/");
    while(s.length%4)s+="=";
    const raw=atob(s),out=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);
    return out;
  }
  function saveBlob(blob,name){
    const u=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=u;a.download=String(name||"world.world").replace(/[\\/:*?"<>|]+/g,"-");
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);
  }
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
    if(owned(w))return `<button class="btn primary worldOwned" type="button" data-paid-download="${esc(w.id)}">⬇ Download world</button>`;
    const c=w.commerce||{}, ready=Number.isInteger(Number(c.priceCents))&&Number(c.priceCents)>0&&/^[A-Z]{3}$/.test(String(c.currency||""));
    if(!ready)return `<span class="btn ghost" aria-disabled="true">Paid download not on sale yet</span>`;
    return `<button class="btn primary" type="button" data-buy="${esc(w.id)}">Buy ${esc(price(w))}</button>`;
  }
  function card(w,spotlight=false){
    const tags=(w.tags||[]).slice(0,spotlight?4:5).map(t=>`<span class="worldTag">${esc(t)}</span>`).join("");
    const classes=["card","worldCard",w.featured?"worldCardFeatured":"",spotlight?"worldSpotlightCard":""].filter(Boolean).join(" ");
    return `<article class="${classes}">${spotlight?'<div class="worldSpotlightGlow" aria-hidden="true"></div>':''}<button class="worldCoverBtn" type="button" data-open="${esc(w.id)}" aria-label="Open ${esc(w.title)}">${cover(w)}</button><div class="worldCardBody"><div class="worldCardTop"><div><h2>${esc(w.title)}</h2><div class="worldBy">${esc(w.creator||"Mayflower Studios")}${w.updatedAt?` · ${esc(date(w.updatedAt))}`:""}</div></div><div>${w.featured?'<span class="worldFeatured">★ Featured</span>':''}</div></div><div style="margin-top:8px"><span class="worldPrice${paid(w)?"":" free"}">${esc(price(w))}${owned(w)?" · Owned":""}</span></div><p class="worldSummary">${esc(w.description||"No description yet.")}</p>${tags?`<div class="worldTags">${tags}</div>`:""}<div class="worldCardActions"><a class="btn ghost" href="?world=${encodeURIComponent(w.id)}">View details</a>${actionButtons(w)}</div></div></article>`;
  }
  function renderFeatured(){
    if(!featuredSection||!featuredGrid)return;
    const picks=all.filter(w=>w.featured===true).sort((a,b)=>(b.updatedAt||b.createdAt||0)-(a.updatedAt||a.createdAt||0)).slice(0,3);
    featuredSection.hidden=!picks.length;
    featuredGrid.innerHTML=picks.map(w=>card(w,true)).join("");
  }
  function draw(){
    if(new URLSearchParams(location.search).get("world"))return;
    const q=(search.value||"").trim().toLowerCase();let arr=all.filter(w=>!q||[w.title,w.description,w.creator,...(w.tags||[])].join(" ").toLowerCase().includes(q));
    if(sort.value==="az")arr.sort((a,b)=>String(a.title).localeCompare(String(b.title)));
    else if(sort.value==="featured")arr.sort((a,b)=>(b.featured===true)-(a.featured===true)||(b.updatedAt||b.createdAt||0)-(a.updatedAt||a.createdAt||0));
    else arr.sort((a,b)=>(b.updatedAt||b.createdAt||0)-(a.updatedAt||a.createdAt||0));
    renderFeatured();
    count.textContent=`${arr.length} world${arr.length===1?"":"s"}`;
    grid.innerHTML=arr.length?arr.map(w=>card(w,false)).join(""):`<div class="worldEmpty">${all.length?"No worlds match that search.":"No worlds have been published yet."}</div>`;
  }
  function detail(w){
    activeDetail=w;
    document.title=`${w.title} • 3DX World Library • Mayflower Studios`;
    const imgs=(w.images||[]).filter(x=>x&&safeUrl(x.url));
    const gallery=imgs.length?`<div class="sectionTitle"><h2>🖼️ Screenshots</h2><span>${imgs.length} image${imgs.length===1?"":"s"}</span></div><section class="worldGallery">${imgs.map((im,i)=>`<button class="worldShot" type="button" data-shot="${i}" aria-label="Open screenshot ${i+1}"><img src="${esc(safeUrl(im.url))}" alt="${esc(im.caption||w.title+' screenshot '+(i+1))}" loading="lazy" onerror="this.closest('.worldShot').remove()"></button>`).join("")}</section>`:"";
    const tags=(w.tags||[]).map(t=>`<span class="worldTag">${esc(t)}</span>`).join("");
    const commerce=paid(w)?`<div class="worldCommerceBanner"><strong>${owned(w)?"Owned":"Buy once, keep it"} · ${esc(price(w))}</strong><br>${owned(w)?"Available to download again anytime from this Mayflower Studios account.":"Secure checkout by Stripe. Your purchase stays linked to your Mayflower Studios account for future downloads."}</div>`:"";
    page.innerHTML=`<a class="worldDetailBack" href="/worlds.html">← All worlds</a><section class="worldDetailHero"><div class="worldDetailCover">${cover(w)}</div><div class="card worldDetailInfo"><div class="worldDetailKicker">3DXChat World${w.featured?'<span class="worldDetailFeatured">★ Featured</span>':''}</div><h1>${esc(w.title)}</h1><div class="worldBy">By ${esc(w.creator||"Mayflower Studios")}</div><div style="margin-top:10px"><span class="worldPrice${paid(w)?"":" free"}">${esc(price(w))}${owned(w)?" · Owned":""}</span></div>${tags?`<div class="worldTags" style="margin-top:12px">${tags}</div>`:""}<p class="worldDetailDesc">${esc(w.description||"")}</p><div class="worldMeta">${w.version?`<div><span>Version</span><strong>${esc(w.version)}</strong></div>`:""}<div><span>Format</span><strong>3DXChat .world</strong></div>${w.world&&w.world.size?`<div><span>Size</span><strong>${esc(fileSize(w.world.size))}</strong></div>`:""}${w.updatedAt?`<div><span>Updated</span><strong>${esc(date(w.updatedAt))}</strong></div>`:""}</div><div class="worldDetailActions">${actionButtons(w,true)}<button class="btn ghost" id="worldShare" type="button">🔗 Copy link</button></div>${commerce}</div></section>${gallery}<section class="card worldDisclaimer"><strong>Using this world</strong><p>${paid(w)?"Your purchase gives you a personal, non-transferable license to use this world in 3DXChat and download it again from your Mayflower Studios account. ":"Download the <code>.world</code> file and import it through 3DXChat's world editor. "}Please do not re-upload, redistribute, resell, or claim original Mayflower Studios work as your own.</p></section>`;
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

  async function startBuy(id,button){
    const w=all.find(x=>x.id===id);if(!w||!paid(w))return;
    if(!authUser){
      alert("Sign in to your Mayflower Studios account first. The purchase is attached to that account so you can download it again later.");
      const back=location.pathname+location.search;
      location.href=`/account.html?next=${encodeURIComponent(back)}`;return;
    }
    if(owned(w)){await paidDownload(id,button);return}
    if(button){button.disabled=true;button.textContent="Opening Stripe…"}
    try{
      const token=await authUser.getIdToken(true);
      const r=await fetch(CHECKOUT_FN,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({worldId:id}),cache:"no-store"});
      const data=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(data.error||`Checkout failed (${r.status})`);
      if(data.alreadyOwned){await loadPurchases();const ownedWorld=all.find(x=>x.id===id);if(ownedWorld&&owned(ownedWorld)){await paidDownload(id,button);return}throw new Error("This world is already purchased. Refresh your purchases and try again.")}
      const u=new URL(String(data.url||""));
      if(u.protocol!=="https:"||!(u.hostname==="checkout.stripe.com"||u.hostname.endsWith(".stripe.com")))throw new Error("Stripe Checkout did not return a valid secure URL.");
      location.href=u.href;
    }catch(err){alert(err.message||"Could not start Stripe Checkout.");if(button){button.disabled=false;button.textContent=`Buy ${price(w)}`}}
  }
  async function paidDownload(id,button){
    const w=all.find(x=>x.id===id);if(w&&!paid(w))return;
    if(!authUser){alert("Sign in to the account that purchased this world first.");const back=location.pathname+location.search;location.href=`/account.html?next=${encodeURIComponent(back)}`;return}
    if(!window.crypto||!crypto.subtle){alert("This browser cannot decrypt protected world downloads. Use a current Chrome, Edge, Firefox, or Opera browser.");return}
    if(button){button.disabled=true;button.textContent="Preparing download…"}
    try{
      const token=await authUser.getIdToken(true);
      const r=await fetch(`${DOWNLOAD_FN}?world=${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
      const data=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(data.error||`Download check failed (${r.status})`);
      if(data.delivery==="inline-v1"&&data.data){
        if(button)button.textContent="Preparing world…";
        const plain=b64ToBytes(data.data);
        if(Number(data.size)>0&&plain.length!==Number(data.size))throw new Error("The protected world download was incomplete.");
        saveBlob(new Blob([plain],{type:"application/octet-stream"}),data.name||"world.world");
        return;
      }
      if(data.delivery!=="encrypted-chunks-v2"||data.scheme!=="AES-GCM-256-v1"||!data.key||!data.iv||!Number.isInteger(Number(data.chunks))||Number(data.chunks)<1||Number(data.encryptedSize)<1)throw new Error("The protected download information was not returned correctly.");
      const chunks=Number(data.chunks),encryptedSize=Number(data.encryptedSize);
      const encrypted=new Uint8Array(encryptedSize);
      let offset=0;
      for(let i=0;i<chunks;i++){
        if(button)button.textContent=`Downloading world… ${i+1}/${chunks}`;
        const fr=await fetch(`${DOWNLOAD_CHUNK_FN}?world=${encodeURIComponent(id)}&chunk=${i}`,{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
        const partData=await fr.json().catch(()=>({}));
        if(!fr.ok)throw new Error(partData.error||`Protected file download failed (${fr.status}).`);
        if(!partData.data)throw new Error("A protected file chunk was empty.");
        const part=b64ToBytes(partData.data);
        if(offset+part.length>encrypted.length)throw new Error("Protected file data was larger than expected.");
        encrypted.set(part,offset);offset+=part.length;
      }
      if(offset!==encrypted.length)throw new Error("Protected file download was incomplete.");
      if(button)button.textContent="Decrypting world…";
      const key=await crypto.subtle.importKey("raw",b64ToBytes(data.key),{name:"AES-GCM"},false,["decrypt"]);
      let plain;
      try{plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:b64ToBytes(data.iv)},key,encrypted)}catch(_){throw new Error("The protected world file could not be decrypted. Edit this world in Admin and re-select the original .world file once.")}
      saveBlob(new Blob([plain],{type:"application/octet-stream"}),data.name||"world.world");
    }catch(err){alert(err.message||"Could not unlock this download.")}
    finally{if(button){button.disabled=false;button.textContent="⬇ Download world"}}
  }
  document.addEventListener("click",e=>{
    const buy=e.target.closest&&e.target.closest("[data-buy]");if(buy){startBuy(buy.dataset.buy,buy);return}
    const dl=e.target.closest&&e.target.closest("[data-paid-download]");if(dl){paidDownload(dl.dataset.paidDownload,dl);return}
    const op=e.target.closest&&e.target.closest("[data-open]");if(op)location.href=`?world=${encodeURIComponent(op.dataset.open)}`;
  });
  search.addEventListener("input",draw);sort.addEventListener("change",draw);

  function checkoutNotice(){
    const state=new URLSearchParams(location.search).get("checkout");
    if(state==="success"){notice.hidden=false;notice.textContent="Payment completed. Your world is being added to your account now — this normally takes just a few seconds."}
    else if(state==="cancelled"){notice.hidden=false;notice.textContent="Stripe Checkout was cancelled. You were not charged by this checkout."}
  }
  async function pollCheckoutPurchase(){
    const q=new URLSearchParams(location.search);if(q.get("checkout")!=="success"||!authUser)return;
    const id=q.get("world");if(!id)return;
    for(let i=0;i<6;i++){
      await loadPurchases();
      const w=all.find(x=>x.id===id);if(w&&owned(w)){notice.hidden=false;notice.textContent="✓ Purchase confirmed. This world is now available in your account.";return}
      if(i<5)await new Promise(r=>setTimeout(r,1800));
    }
    notice.hidden=false;notice.textContent="Your payment was received, but the purchase is still being confirmed. Try the download again in a moment.";
  }

  async function loadStoreMode(){
    try{const r=await fetch(STORE_INFO_FN,{cache:"no-store"});if(r.ok){const d=await r.json();if(d&&/^(test|live)$/.test(d.mode))storeMode=d.mode}}catch(err){console.warn("store mode",err)}
  }
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
    const rows=Object.entries(purchases||{}).filter(([,p])=>p&&p.status==="active"&&(storeMode==="unknown"||purchaseMode(p)===storeMode));
    purchaseBox.hidden=false;
    if(!rows.length){purchaseList.innerHTML='<div class="worldPurchasePending">Worlds you purchase will appear here for easy redownloads.</div>';return}
    purchaseList.innerHTML=rows.map(([id])=>{const w=all.find(x=>x.id===id);return `<div class="worldPurchaseItem"><strong>${esc(w?w.title:"Purchased world")}</strong><button class="btn ghost" type="button" data-paid-download="${esc(id)}">Download</button></div>`}).join("");
  }
  function refreshWorldUI(){
    if(activeDetail){const w=all.find(x=>x.id===activeDetail.id);if(w)detail(w)}else draw();
  }
  function waitAuth(){
    if(!window.MFAuth){setTimeout(waitAuth,100);return}
    MFAuth.onChange(async u=>{authUser=u||null;checkoutNotice();await loadStoreMode();await loadPurchases();if(authUser)pollCheckoutPurchase()});
  }

  async function load(){
    try{const r=await fetch(`${DB}/worldLibrary.json?orderBy=%22published%22&equalTo=true`,{cache:"no-store"});if(!r.ok)throw new Error(`HTTP ${r.status}`);all=normalize(await r.json());const id=new URLSearchParams(location.search).get("world");if(id){const w=all.find(x=>x.id===id);if(w){detail(w);waitAuth();return}notice.hidden=false;notice.textContent="That world could not be found. Showing the library instead.";history.replaceState(null,"","/worlds.html")}draw();waitAuth()}
    catch(err){console.warn("World library failed",err);grid.innerHTML='<div class="worldEmpty">The World Library could not be loaded right now.</div>';notice.hidden=false;notice.textContent="The world list is temporarily unavailable.";waitAuth()}
  }
  load();
})();
