/* Mayflower Studios — automatic homepage featured 3DX worlds */
(function(){
  "use strict";
  const DB="https://watchtogether-95d7d-default-rtdb.firebaseio.com";
  const section=document.getElementById("featured-worlds"),grid=document.getElementById("homeFeaturedWorldsGrid");
  if(!section||!grid)return;
  const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  const safeUrl=v=>{try{const u=new URL(String(v||""),location.origin);return (u.protocol==="https:"||u.protocol==="http:")?u.href:""}catch(_){return ""}};
  const price=w=>{
    const c=w&&w.commerce||{};
    if(c.type!=="paid")return "Free";
    try{return new Intl.NumberFormat(undefined,{style:"currency",currency:c.currency||"USD"}).format((Number(c.priceCents)||0)/100)}catch(_){return `$${((Number(c.priceCents)||0)/100).toFixed(2)}`}
  };
  const image=w=>{
    const imgs=Array.isArray(w.images)?w.images:Object.values(w.images||{});
    const im=imgs.find(x=>x&&safeUrl(x.url));
    return im?`<img src="${esc(safeUrl(im.url))}" alt="${esc(w.title)} screenshot" loading="lazy" decoding="async">`:'<div class="home-world-empty" aria-hidden="true">🏡</div>';
  };
  function card(w){
    const paid=w.commerce&&w.commerce.type==="paid";
    return `<article class="card home-world-card"><a class="home-world-cover" href="/worlds.html?world=${encodeURIComponent(w.id)}">${image(w)}</a><div class="home-world-body"><div class="home-world-top"><div><h3>${esc(w.title)}</h3><div class="home-world-by">${esc(w.creator||"Mayflower Studios")}</div></div><span class="home-world-featured">★ Featured</span></div><span class="home-world-price${paid?"":" free"}">${paid?"🔐 ":""}${esc(price(w))}</span><p class="home-world-desc">${esc(w.description||"Explore this featured 3DXChat world.")}</p><div class="home-world-actions"><a class="btn-ghost sm" href="/worlds.html?world=${encodeURIComponent(w.id)}">Explore world →</a></div></div></article>`;
  }
  fetch(`${DB}/worldLibrary.json?orderBy=%22published%22&equalTo=true`,{cache:"no-store"})
    .then(r=>r.ok?r.json():Promise.reject(new Error(`HTTP ${r.status}`)))
    .then(data=>{
      const picks=Object.entries(data||{}).map(([id,w])=>Object.assign({id},w||{})).filter(w=>w.published!==false&&w.featured===true&&w.title).sort((a,b)=>(b.updatedAt||b.createdAt||0)-(a.updatedAt||a.createdAt||0)).slice(0,3);
      if(!picks.length)return;
      grid.innerHTML=picks.map(card).join("");
      section.hidden=false;
    })
    .catch(err=>console.warn("Featured worlds unavailable",err));
})();
