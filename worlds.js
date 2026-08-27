/* Mayflower Studios — public 3DX World Library */
(function(){
  "use strict";
  const DB="https://watchtogether-95d7d-default-rtdb.firebaseio.com";
  const grid=document.getElementById("worldGrid"), search=document.getElementById("worldSearch"), sort=document.getElementById("worldSort"), count=document.getElementById("worldCount"), notice=document.getElementById("worldNotice"), page=document.getElementById("worldPage");
  let all=[], shots=[], shotIndex=0;
  const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  const safeUrl=v=>{try{const u=new URL(String(v||""),location.origin);return (u.protocol==="https:"||u.protocol==="http:")?u.href:""}catch(_){return ""}};
  const fileSize=n=>{n=Number(n)||0;if(!n)return "";const u=["B","KB","MB","GB"];let i=0;while(n>=1024&&i<u.length-1){n/=1024;i++}return `${n>=10||i===0?n.toFixed(0):n.toFixed(1)} ${u[i]}`};
  const date=v=>{const d=new Date(Number(v)||0);return isNaN(d)?"":d.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"})};
  function normalize(data){
    return Object.entries(data||{}).map(([id,w])=>Object.assign({id},w||{})).filter(w=>w.published!==false&&w.title&&w.world&&safeUrl(w.world.url)).map(w=>{w.images=Array.isArray(w.images)?w.images:Object.values(w.images||{});w.tags=Array.isArray(w.tags)?w.tags:Object.values(w.tags||{});return w});
  }
  function cover(w){const im=(w.images||[]).find(x=>x&&safeUrl(x.url));if(!im)return `<div class="worldCoverEmpty" aria-hidden="true">🏡</div>`;return `<img src="${esc(safeUrl(im.url))}" alt="${esc(w.title)} screenshot" loading="lazy" decoding="async" onerror="this.parentElement.innerHTML='<div class=&quot;worldCoverEmpty&quot;>🏡</div>'">`}
  function card(w){
    const tags=(w.tags||[]).slice(0,5).map(t=>`<span class="worldTag">${esc(t)}</span>`).join("");
    const dl=safeUrl(w.world&&w.world.url);
    return `<article class="card worldCard"><button class="worldCoverBtn" type="button" data-open="${esc(w.id)}" aria-label="Open ${esc(w.title)}">${cover(w)}</button><div class="worldCardBody"><div class="worldCardTop"><div><h2>${esc(w.title)}</h2><div class="worldBy">${esc(w.creator||"Mayflower Studios")}${w.updatedAt?` · ${esc(date(w.updatedAt))}`:""}</div></div>${w.featured?'<span class="worldFeatured">★ Featured</span>':''}</div><p class="worldSummary">${esc(w.description||"No description yet.")}</p>${tags?`<div class="worldTags">${tags}</div>`:""}<div class="worldCardActions"><a class="btn primary" href="?world=${encodeURIComponent(w.id)}">View world</a><a class="btn ghost" href="${esc(dl)}" download="${esc((w.world&&w.world.name)||w.title+'.world')}">⬇ .world</a></div></div></article>`;
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
    document.title=`${w.title} • 3DX World Library • Mayflower Studios`;
    const imgs=(w.images||[]).filter(x=>x&&safeUrl(x.url));
    const gallery=imgs.length?`<div class="sectionTitle"><h2>🖼️ Screenshots</h2><span>${imgs.length} image${imgs.length===1?"":"s"}</span></div><section class="worldGallery">${imgs.map((im,i)=>`<button class="worldShot" type="button" data-shot="${i}" aria-label="Open screenshot ${i+1}"><img src="${esc(safeUrl(im.url))}" alt="${esc(im.caption||w.title+' screenshot '+(i+1))}" loading="lazy" onerror="this.closest('.worldShot').remove()"></button>`).join("")}</section>`:"";
    const tags=(w.tags||[]).map(t=>`<span class="worldTag">${esc(t)}</span>`).join("");
    const worldUrl=safeUrl(w.world.url);
    page.innerHTML=`<a class="worldDetailBack" href="/worlds.html">← All worlds</a><section class="worldDetailHero"><div class="worldDetailCover">${cover(w)}</div><div class="card worldDetailInfo"><div class="worldDetailKicker">3DXChat World</div><h1>${esc(w.title)}</h1><div class="worldBy">Shared by ${esc(w.creator||"Mayflower Studios")}</div>${tags?`<div class="worldTags" style="margin-top:12px">${tags}</div>`:""}<p class="worldDetailDesc">${esc(w.description||"")}</p><div class="worldMeta">${w.version?`<div><span>Version</span><strong>${esc(w.version)}</strong></div>`:""}<div><span>File</span><strong>${esc((w.world&&w.world.name)||"World file")}</strong></div>${w.world&&w.world.size?`<div><span>Size</span><strong>${esc(fileSize(w.world.size))}</strong></div>`:""}${w.updatedAt?`<div><span>Updated</span><strong>${esc(date(w.updatedAt))}</strong></div>`:""}</div><div class="worldDetailActions"><a class="btn primary" href="${esc(worldUrl)}" download="${esc((w.world&&w.world.name)||w.title+'.world')}">⬇ Download .world</a><button class="btn ghost" id="worldShare" type="button">🔗 Copy link</button></div></div></section>${gallery}<section class="card worldDisclaimer"><strong>Using this world</strong><p>Download the <code>.world</code> file and import it through 3DXChat's world editor. Unless this world says otherwise, downloading original Mayflower Studios work does not grant permission to re-upload, redistribute, sell, or claim it as your own.</p></section>`;
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
  grid.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-open]");if(b)location.href=`?world=${encodeURIComponent(b.dataset.open)}`});search.addEventListener("input",draw);sort.addEventListener("change",draw);
  async function load(){
    try{const r=await fetch(`${DB}/worldLibrary.json?orderBy=%22published%22&equalTo=true`,{cache:"no-store"});if(!r.ok)throw new Error(`HTTP ${r.status}`);all=normalize(await r.json());const id=new URLSearchParams(location.search).get("world");if(id){const w=all.find(x=>x.id===id);if(w){detail(w);return}notice.hidden=false;notice.textContent="That world could not be found. Showing the library instead.";history.replaceState(null,"","/worlds.html")}draw()}
    catch(err){console.warn("World library failed",err);grid.innerHTML='<div class="worldEmpty">The World Library could not be loaded right now.</div>';notice.hidden=false;notice.textContent="The world list is temporarily unavailable."}
  }
  load();
})();
