/* Mayflower Studios — admin-only 3DX World Library manager */
(function(){
  "use strict";

  const DB="https://watchtogether-95d7d-default-rtdb.firebaseio.com";
  const FBVER="10.12.2";
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const size=n=>{n=Number(n)||0;if(!n)return "";const u=["B","KB","MB","GB"];let i=0;while(n>=1024&&i<u.length-1){n/=1024;i++}return `${n>=10||i===0?n.toFixed(0):n.toFixed(1)} ${u[i]}`};
  if(!$("wmForm"))return;

  let user=null,token="",allowed=false,store=null,smod=null,items={},privateItems={},editing=null;
  let gallery=[]; // {kind:'existing', data:{...}} or {kind:'new', file, preview, key}
  let dragIndex=-1;

  const msg=(text,bad=false)=>{const n=$("wmMsg");n.textContent=text||"";n.className="wmMsg "+(bad?"bad":"ok")};
  const progress=text=>{$("wmProgress").textContent=text||""};

  async function fresh(){
    if(!user)throw new Error("Not signed in");
    token=await user.getIdToken();
    return token;
  }
  async function get(path,auth=true){
    const t=auth?`?auth=${encodeURIComponent(await fresh())}`:"";
    const r=await fetch(`${DB}/${path}.json${t}`,{cache:"no-store"});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  async function put(path,value){
    const r=await fetch(`${DB}/${path}.json?auth=${encodeURIComponent(await fresh())}`,{
      method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(value)
    });
    if(!r.ok)throw new Error(`HTTP ${r.status}: ${await r.text()}`);
    return r.json();
  }
  async function patchRoot(updates){
    const r=await fetch(`${DB}/.json?auth=${encodeURIComponent(await fresh())}`,{
      method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(updates)
    });
    if(!r.ok)throw new Error(`HTTP ${r.status}: ${await r.text()}`);
    return r.json();
  }
  async function del(path){
    const r=await fetch(`${DB}/${path}.json?auth=${encodeURIComponent(await fresh())}`,{method:"DELETE"});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
  }

  async function check(u){
    user=u;
    if(!u)return;
    try{
      token=await fresh();
      const profile=window.MFAuth&&MFAuth.profile||{};
      let me=String(profile.username||"").toLowerCase();
      if(!me)me=String(await get(`users/${u.uid}/username`)||"").toLowerCase();
      if(!me)return;
      const [owner,admin]=await Promise.all([get("owner"),get(`admins/${encodeURIComponent(me)}`)]);
      allowed=String(owner||"").toLowerCase()===me||admin===true;
      if(!allowed)return;
      await initStorage();
      wire();
      reset();
      await load();
    }catch(e){
      console.warn("world manager gate",e);
      msg("World manager could not start: "+e.message,true);
    }
  }

  async function initStorage(){
    if(smod)return;
    smod=await import(`https://www.gstatic.com/firebasejs/${FBVER}/firebase-storage.js`);
    if(!MFAuth._app)throw new Error("Firebase app is not ready");
    store=smod.getStorage(MFAuth._app);
  }

  function wire(){
    if($("wmForm").dataset.wired)return;
    $("wmForm").dataset.wired="1";
    $("wmForm").addEventListener("submit",save);
    $("wmCancel").addEventListener("click",reset);
    $("wmNew").addEventListener("click",()=>{reset();$("wmTitle").focus();$("world-library-admin").scrollIntoView({behavior:"smooth",block:"start"})});
    $("wmRefresh").addEventListener("click",load);
    $("wmListSearch").addEventListener("input",draw);
    $("wmList").addEventListener("click",act);
    $("wmWorldFile").addEventListener("change",renderWorldStatus);
    $("wmImages").addEventListener("change",addImages);
    $("wmAccess").addEventListener("change",accessUI);
    $("wmGallery").addEventListener("click",galleryAction);
    $("wmGallery").addEventListener("dragstart",galleryDragStart);
    $("wmGallery").addEventListener("dragover",galleryDragOver);
    $("wmGallery").addEventListener("dragleave",galleryDragLeave);
    $("wmGallery").addEventListener("drop",galleryDrop);
    $("wmGallery").addEventListener("dragend",galleryDragEnd);
  }

  function slug(s){
    return String(s||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,60)||"world";
  }
  function safeName(s){return String(s||"file").replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-100)}
  function fileOKWorld(f){return f&&/\.world$/i.test(f.name)&&f.size>0&&f.size<=250*1024*1024}
  function fileOKImage(f){return f&&/^image\/(jpeg|png|webp|gif)$/i.test(f.type)&&f.size>0&&f.size<=15*1024*1024}
  function imageArray(v){return Array.isArray(v)?v.filter(Boolean):Object.keys(v||{}).sort((a,b)=>Number(a)-Number(b)).map(k=>v[k]).filter(Boolean)}

  function bytesToB64(bytes){
    let s=""; const step=0x8000;
    for(let i=0;i<bytes.length;i+=step)s+=String.fromCharCode(...bytes.subarray(i,Math.min(i+step,bytes.length)));
    return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
  }
  async function encryptWorldFile(file){
    if(!window.crypto||!crypto.subtle)throw new Error("This browser does not support the encryption needed for paid worlds. Use a current Chrome, Edge, Firefox, or Opera browser.");
    progress("Encrypting paid world file locally…");
    const key=await crypto.subtle.generateKey({name:"AES-GCM",length:256},true,["encrypt"]);
    const rawKey=new Uint8Array(await crypto.subtle.exportKey("raw",key));
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const plain=await file.arrayBuffer();
    const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,plain);
    return {
      blob:new Blob([encrypted],{type:"application/octet-stream"}),
      key:bytesToB64(rawKey),
      iv:bytesToB64(iv),
      scheme:"AES-GCM-256-v1",
      originalName:file.name,
      originalSize:file.size
    };
  }

  async function upload(file,path,contentType,onPct,publicUrl=true,displayName=null,displaySize=null){
    const ref=smod.ref(store,path);
    const task=smod.uploadBytesResumable(ref,file,{contentType:contentType||file.type||"application/octet-stream",cacheControl:publicUrl?"public,max-age=3600":"private,no-store"});
    await new Promise((res,rej)=>task.on("state_changed",s=>{
      if(onPct)onPct(Math.round((s.bytesTransferred/s.totalBytes)*100));
    },rej,res));
    const out={path,name:displayName||file.name||"file",size:Number(displaySize==null?file.size:displaySize)||0};
    if(publicUrl)out.url=await smod.getDownloadURL(ref);
    return out;
  }
  async function erase(path){
    if(!path)return;
    try{await smod.deleteObject(smod.ref(store,path))}
    catch(e){if(!String(e.code||"").includes("object-not-found"))console.warn("storage delete",path,e)}
  }

  async function load(){
    if(!allowed)return;
    $("wmList").innerHTML='<div class="acctEmpty">Loading…</div>';
    try{
      // Authenticated admin read is required here so hidden/draft worlds are editable too.
      const pair=await Promise.all([get("worldLibrary",true),get("worldPrivate",true)]);
      items=pair[0]||{};
      privateItems=pair[1]||{};
      draw();
    }catch(e){
      $("wmList").innerHTML=`<div class="acctEmpty">Could not load worlds: ${esc(e.message)}</div>`;
    }
  }

  function isPaid(w){return !!(w&&w.commerce&&w.commerce.type==="paid")}
  function money(c){
    if(!c||c.type!=="paid")return "Free";
    try{return new Intl.NumberFormat(undefined,{style:"currency",currency:c.currency||"USD"}).format((Number(c.priceCents)||0)/100)}catch(_){return `${((Number(c.priceCents)||0)/100).toFixed(2)} ${c.currency||"USD"}`}
  }
  function cents(v){
    const t=String(v||"").trim();
    if(!/^\d+(?:[.]\d{1,2})?$/.test(t))return NaN;
    const parts=t.split(".");return Number(parts[0])*100+Number((parts[1]||"").padEnd(2,"0"));
  }
  function accessUI(){
    const paid=$("wmAccess").value==="paid";
    document.querySelectorAll(".wmPaidField").forEach(x=>x.hidden=!paid);
    const pill=$("wmAccessPill");pill.textContent=paid?"Paid":"Free";pill.classList.toggle("paid",paid);
    const label=$("wmWorldFileLabel");
    if(label)label.textContent=editing?`Replace ${paid?"protected ":""}.world file (optional)`: `Choose ${paid?"protected ":""}.world file`;
    renderWorldStatus();
  }

  function firstImage(w){
    const im=imageArray(w&&w.images)[0];
    return im&&im.url?im.url:"";
  }

  function draw(){
    const q=($("wmListSearch").value||"").trim().toLowerCase();
    const list=Object.entries(items)
      .filter(([id,w])=>!q||[id,w&&w.title,w&&w.creator,w&&w.description].join(" ").toLowerCase().includes(q))
      .sort((a,b)=>((b[1]&&b[1].updatedAt)||0)-((a[1]&&a[1].updatedAt)||0));

    $("wmList").innerHTML=list.length?list.map(([id,w])=>{
      const thumb=firstImage(w);
      const count=imageArray(w&&w.images).length;
      const active=$("wmEditId").value===id?" active":"";
      return `<div class="wmItem${active}">
        ${thumb?`<img class="wmItemThumb" src="${esc(thumb)}" alt="" loading="lazy">`:'<div class="wmItemThumbEmpty">🏡</div>'}
        <div class="wmItemBody">
          <strong>${esc(w.title||id)}</strong>
          <small>${count} screenshot${count===1?"":"s"}${w.featured?" · Featured":""}</small>
          <span class="wmAccessPill${isPaid(w)?" paid":""}">${esc(money(w.commerce))}</span>
          <small class="wmStatusPill${w.published===false?" hidden":""}">${w.published===false?"Hidden / draft":"Public"}</small>
          <div class="wmItemBtns">
            <button type="button" data-edit="${esc(id)}">Edit</button>
            <a class="btn ghost" href="/worlds.html?world=${encodeURIComponent(id)}" target="_blank" rel="noopener">View</a>
            <button class="danger" type="button" data-delete="${esc(id)}">Delete</button>
          </div>
        </div>
      </div>`;
    }).join(""):'<div class="acctEmpty">No worlds found.</div>';
  }

  function revokePending(){
    for(const g of gallery)if(g.kind==="new"&&g.preview)URL.revokeObjectURL(g.preview);
  }

  function reset(){
    revokePending();
    gallery=[];
    editing=null;
    $("wmForm").reset();
    $("wmEditId").value="";
    $("wmCreator").value="Mayflower Studios";
    $("wmPublished").checked=true;
    $("wmAccess").value="free";
    $("wmPrice").value="";
    $("wmCurrency").value="USD";
    $("wmEditor").classList.remove("wmEditing");
    $("wmEditorTitle").textContent="Add a new world";
    $("wmSave").textContent="Publish world";
    $("wmCancel").hidden=true;
    $("wmWorldFileLabel").textContent="Choose .world file";
    progress("");msg("");
    accessUI();
    renderGallery();
    draw();
  }

  function edit(id){
    const w=items[id];
    if(!w)return;
    revokePending();
    editing=JSON.parse(JSON.stringify(w));
    gallery=imageArray(w.images).map(data=>({kind:"existing",data}));
    $("wmEditId").value=id;
    $("wmTitle").value=w.title||"";
    $("wmCreator").value=w.creator||"Mayflower Studios";
    $("wmDescription").value=w.description||"";
    $("wmTags").value=(Array.isArray(w.tags)?w.tags:Object.values(w.tags||{})).join(", ");
    $("wmVersion").value=w.version||"";
    const c=w.commerce||{type:"free"};
    $("wmAccess").value=c.type==="paid"?"paid":"free";
    $("wmPrice").value=c.type==="paid"?((Number(c.priceCents)||0)/100).toFixed(2):"";
    $("wmCurrency").value=c.currency||"USD";
    $("wmFeatured").checked=!!w.featured;
    $("wmPublished").checked=w.published!==false;
    $("wmWorldFile").value="";
    $("wmImages").value="";
    $("wmEditor").classList.add("wmEditing");
    $("wmEditorTitle").textContent=`Editing: ${w.title||id}`;
    $("wmSave").textContent="Save changes";
    $("wmCancel").hidden=false;
    accessUI();
    renderWorldStatus();
    renderGallery();
    draw();
    $("wmTitle").focus();
    $("world-library-admin").scrollIntoView({behavior:"smooth",block:"start"});
  }

  function renderWorldStatus(){
    const selected=$("wmWorldFile").files&&$("wmWorldFile").files[0];
    const box=$("wmWorldStatus");
    const paid=$("wmAccess").value==="paid";
    if(selected){
      box.classList.remove("empty");
      box.innerHTML=`<span>${paid?"🔐":"📦"}</span><span><strong>${esc(selected.name)}</strong><br>${esc(size(selected.size))} · ${paid?"will be encrypted before upload":"ready for public download"}${editing?" · replaces current file when saved":""}</span>`;
      return;
    }
    if(editing){
      const id=$("wmEditId").value;
      const cur=paid?(privateItems[id]||null):(editing.world||null);
      if(cur&&cur.name){
        box.classList.remove("empty");
        box.innerHTML=`<span>${paid?"🔐":"📦"}</span><span><strong>${esc(cur.name||"Current .world file")}</strong>${cur.size?`<br>${esc(size(cur.size))}`:""}${paid?" · protected":""}</span>`;
        return;
      }
    }
    box.classList.add("empty");
    box.textContent=paid?"No paid world file selected yet.":"No world file selected yet.";
  }

  function addImages(){
    const files=Array.from($("wmImages").files||[]);
    $("wmImages").value="";
    if(!files.length)return;
    const bad=files.find(f=>!fileOKImage(f));
    if(bad){msg(`“${bad.name}” is not a supported image or is larger than 15 MB.`,true);return}
    const room=20-gallery.length;
    if(room<=0){msg("This world already has the maximum of 20 screenshots.",true);return}
    if(files.length>room)msg(`Only the first ${room} picture${room===1?"":"s"} were added because the limit is 20.`,true);else msg("");
    for(const f of files.slice(0,room))gallery.push({kind:"new",file:f,preview:URL.createObjectURL(f),key:`new-${Date.now()}-${Math.random().toString(36).slice(2)}`});
    renderGallery();
  }

  function renderGallery(){
    $("wmImageCount").textContent=`${gallery.length} / 20`;
    if(!gallery.length){
      $("wmGallery").innerHTML='<div class="wmGalleryEmpty">No screenshots yet. Add one or more pictures above.</div>';
      return;
    }
    $("wmGallery").innerHTML=gallery.map((g,i)=>{
      const im=g.kind==="existing"?g.data:null;
      const src=g.kind==="new"?g.preview:(im&&im.url)||"";
      const name=g.kind==="new"?g.file.name:(im&&im.name)||`Screenshot ${i+1}`;
      return `<div class="wmShotEdit" draggable="true" data-gidx="${i}">
        ${i===0?'<span class="wmCoverBadge">COVER</span>':''}${g.kind==="new"?'<span class="wmPendingBadge">NEW</span>':''}
        <img src="${esc(src)}" alt="Screenshot ${i+1}">
        <div class="wmShotMeta" title="${esc(name)}">${esc(name)}</div>
        <div class="wmShotTools">
          <button type="button" data-gact="cover" data-gidx="${i}" title="Make cover">★</button>
          <button type="button" data-gact="left" data-gidx="${i}" title="Move left">←</button>
          <button type="button" data-gact="right" data-gidx="${i}" title="Move right">→</button>
          <button type="button" data-gact="remove" data-gidx="${i}" title="Remove">✕</button>
        </div>
      </div>`;
    }).join("");
  }

  function moveGallery(from,to){
    if(from<0||to<0||from>=gallery.length||to>=gallery.length||from===to)return;
    const [x]=gallery.splice(from,1);gallery.splice(to,0,x);renderGallery();
  }
  function galleryAction(e){
    const b=e.target.closest&&e.target.closest("[data-gact]");
    if(!b)return;
    const i=Number(b.dataset.gidx),act=b.dataset.gact;
    if(!Number.isInteger(i)||!gallery[i])return;
    if(act==="cover")moveGallery(i,0);
    else if(act==="left")moveGallery(i,Math.max(0,i-1));
    else if(act==="right")moveGallery(i,Math.min(gallery.length-1,i+1));
    else if(act==="remove"){
      const [g]=gallery.splice(i,1);
      if(g&&g.kind==="new"&&g.preview)URL.revokeObjectURL(g.preview);
      renderGallery();
    }
  }
  function galleryDragStart(e){
    const card=e.target.closest&&e.target.closest("[data-gidx]");if(!card)return;
    dragIndex=Number(card.dataset.gidx);card.classList.add("dragging");
    if(e.dataTransfer){e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",String(dragIndex))}
  }
  function galleryDragOver(e){
    const card=e.target.closest&&e.target.closest("[data-gidx]");if(!card)return;
    e.preventDefault();card.classList.add("dragover");if(e.dataTransfer)e.dataTransfer.dropEffect="move";
  }
  function galleryDragLeave(e){const card=e.target.closest&&e.target.closest("[data-gidx]");if(card)card.classList.remove("dragover")}
  function galleryDrop(e){
    const card=e.target.closest&&e.target.closest("[data-gidx]");if(!card)return;
    e.preventDefault();card.classList.remove("dragover");
    const to=Number(card.dataset.gidx);const from=dragIndex>=0?dragIndex:Number(e.dataTransfer&&e.dataTransfer.getData("text/plain"));
    moveGallery(from,to);dragIndex=-1;
  }
  function galleryDragEnd(){dragIndex=-1;$("wmGallery").querySelectorAll(".dragging,.dragover").forEach(x=>x.classList.remove("dragging","dragover"))}

  async function act(e){
    const ed=e.target.closest&&e.target.closest("[data-edit]");
    const de=e.target.closest&&e.target.closest("[data-delete]");
    if(ed){edit(ed.dataset.edit);return}
    if(!de)return;
    const id=de.dataset.delete,w=items[id];
    if(!w)return;
    if(!confirm(`Delete “${w.title||id}” and remove its uploaded files? This cannot be undone.`))return;
    try{
      progress("Deleting…");
      await initStorage();
      await patchRoot({[`worldLibrary/${id}`]:null,[`worldPrivate/${id}`]:null});
      // Database deletion is the important part. Storage cleanup is best-effort so an old
      // file uploaded by another admin cannot prevent the world itself from being deleted.
      for(const im of imageArray(w.images))await erase(im&&im.path);
      await erase(w.world&&w.world.path);
      await erase(privateItems[id]&&privateItems[id].path);
      delete items[id];delete privateItems[id];
      if($("wmEditId").value===id)reset();else draw();
      msg("World deleted.");progress("");
    }catch(err){progress("");msg("Delete failed: "+err.message,true)}
  }

  async function save(e){
    e.preventDefault();
    if(!allowed)return;

    const title=$("wmTitle").value.trim();
    const description=$("wmDescription").value.trim();
    const creator=$("wmCreator").value.trim()||"Mayflower Studios";
    const version=$("wmVersion").value.trim();
    const tags=$("wmTags").value.split(",").map(x=>x.trim()).filter(Boolean).slice(0,12);
    const base=slug(title);
    const wid=$("wmEditId").value||(items[base]?`${base}-${Date.now().toString(36)}`:base);
    const wf=$("wmWorldFile").files[0];
    const access=$("wmAccess").value==="paid"?"paid":"free";
    const priceCents=cents($("wmPrice").value);
    const currency=String($("wmCurrency").value||"USD").toUpperCase();
    const published=$("wmPublished").checked;
    const oldAccess=editing&&isPaid(editing)?"paid":"free";

    if(!title||!description){msg("Give the world a name and description first.",true);return}
    if(access==="paid"){
      if(!Number.isFinite(priceCents)||priceCents<1){msg("Enter a valid paid-world price, such as 4.99.",true);return}
      if(!/^[A-Z]{3}$/.test(currency)){msg("Choose a valid three-letter currency.",true);return}
    }
    if(!editing&&!fileOKWorld(wf)){msg("Choose a .world file (up to 250 MB).",true);return}
    if(editing&&access!==oldAccess&&!fileOKWorld(wf)){msg(`Re-select the .world file when changing a world from ${oldAccess} to ${access}. That lets me move it into the correct ${access==="paid"?"protected":"public"} storage area.`,true);return}
    if(wf&&!fileOKWorld(wf)){msg("The world file must end in .world and be 250 MB or smaller.",true);return}
    if(gallery.length>20){msg("A world can have no more than 20 screenshots.",true);return}

    $("wmSave").disabled=true;
    const newlyUploaded=[];
    let committed=false;
    try{
      await initStorage();
      const stamp=Date.now();
      const oldPublicWorld=editing&&editing.world?editing.world:null;
      const oldPrivate=privateItems[wid]||null;
      let uploadedWorld=null;

      if(wf){
        if(access==="paid"){
          const enc=await encryptWorldFile(wf);
          const path=`world-library-paid/${user.uid}/${wid}/world/${stamp}-${safeName(wf.name)}.enc`;
          progress("Uploading encrypted paid world file…");
          uploadedWorld=await upload(enc.blob,path,"application/octet-stream",p=>progress(`Uploading encrypted paid world file… ${p}%`),false,wf.name,wf.size);
          uploadedWorld.key=enc.key;
          uploadedWorld.iv=enc.iv;
          uploadedWorld.scheme=enc.scheme;
          uploadedWorld.encryptedSize=enc.blob.size;
        }else{
          const path=`world-library/${user.uid}/${wid}/world/${stamp}-${safeName(wf.name)}`;
          progress("Uploading world file…");
          uploadedWorld=await upload(wf,path,"application/octet-stream",p=>progress(`Uploading world file… ${p}%`),true);
        }
        newlyUploaded.push(uploadedWorld.path);
      }

      let publicWorld,privateWorld=null;
      if(access==="paid"){
        const src=uploadedWorld||oldPrivate;
        if(!src||!src.path||!src.key||!src.iv)throw new Error("Encrypted paid-world metadata is missing. Please choose the .world file again.");
        publicWorld={name:src.name,size:src.size,private:true};
        privateWorld={path:src.path,name:src.name,size:src.size,encryptedSize:Number(src.encryptedSize)||0,key:src.key,iv:src.iv,scheme:src.scheme||"AES-GCM-256-v1",uploadedByUid:src.uploadedByUid||user.uid,updatedAt:Date.now()};
      }else{
        const src=uploadedWorld||oldPublicWorld;
        if(!src||!src.url||!src.path)throw new Error("Public world file metadata is missing. Please choose the .world file again.");
        publicWorld={url:src.url,path:src.path,name:src.name,size:src.size,private:false};
      }

      const finalImages=[];
      let pendingNumber=0;
      const pendingTotal=gallery.filter(g=>g.kind==="new").length;
      for(const g of gallery){
        if(g.kind==="existing"){
          finalImages.push(g.data);
          continue;
        }
        pendingNumber++;
        const f=g.file;
        const path=`world-library/${user.uid}/${wid}/images/${stamp}-${pendingNumber}-${safeName(f.name)}`;
        progress(`Uploading screenshot ${pendingNumber} of ${pendingTotal}…`);
        const up=await upload(f,path,f.type,p=>progress(`Screenshot ${pendingNumber}/${pendingTotal}… ${p}%`),true);
        newlyUploaded.push(up.path);
        finalImages.push(up);
      }

      const now=Date.now();
      const commerce=access==="paid"?{type:"paid",priceCents,currency}:{type:"free"};
      const record={
        title,creator,description,tags,version,commerce,
        featured:$("wmFeatured").checked,
        published,
        world:publicWorld,
        images:finalImages,
        createdAt:editing&&editing.createdAt||now,
        updatedAt:now,
        createdByUid:editing&&editing.createdByUid||user.uid,
        createdByName:editing&&editing.createdByName||(MFAuth.name&&MFAuth.name())||creator
      };

      progress(published?"Publishing…":"Saving hidden world…");
      await patchRoot({[`worldLibrary/${wid}`]:record,[`worldPrivate/${wid}`]:privateWorld});
      committed=true;

      // Clean up files no longer referenced after the database points at the new record.
      const oldWorldPath=oldAccess==="paid"?(oldPrivate&&oldPrivate.path):(oldPublicWorld&&oldPublicWorld.path);
      const newWorldPath=access==="paid"?(privateWorld&&privateWorld.path):(publicWorld&&publicWorld.path);
      if(oldWorldPath&&oldWorldPath!==newWorldPath)await erase(oldWorldPath);
      const keep=new Set(finalImages.map(im=>im&&im.path).filter(Boolean));
      for(const im of imageArray(editing&&editing.images))if(im&&im.path&&!keep.has(im.path))await erase(im.path);

      items[wid]=record;
      if(privateWorld)privateItems[wid]=privateWorld;else delete privateItems[wid];
      const savedTitle=title;
      reset();
      msg(`“${savedTitle}” ${record.published?"is live in":"was saved to"} the World Library${access==="paid"?" as an encrypted paid world":""}.`);
    }catch(err){
      console.warn("world publish",err);
      if(!committed)for(const path of newlyUploaded)await erase(path);
      msg("Save failed: "+err.message,true);
      progress("");
    }finally{
      $("wmSave").disabled=false;
    }
  }

  function wait(){
    if(!window.MFAuth){setTimeout(wait,100);return}
    MFAuth.onChange(u=>check(u));
  }
  wait();
})();
