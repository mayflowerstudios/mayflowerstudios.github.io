/* Mayflower Studios — admin-only 3DX World Library manager */
(function(){
  "use strict";

  const DB="https://watchtogether-95d7d-default-rtdb.firebaseio.com";
  const FBVER="10.12.2";
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const size=n=>{n=Number(n)||0;if(!n)return "";const u=["B","KB","MB","GB"];let i=0;while(n>=1024&&i<u.length-1){n/=1024;i++}return `${n>=10||i===0?n.toFixed(0):n.toFixed(1)} ${u[i]}`};
  if(!$("wmForm"))return;

  let user=null,token="",allowed=false,store=null,smod=null,items={},editing=null;
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

  async function upload(file,path,contentType,onPct){
    const ref=smod.ref(store,path);
    const task=smod.uploadBytesResumable(ref,file,{contentType:contentType||file.type||"application/octet-stream"});
    await new Promise((res,rej)=>task.on("state_changed",s=>{
      if(onPct)onPct(Math.round((s.bytesTransferred/s.totalBytes)*100));
    },rej,res));
    return {url:await smod.getDownloadURL(ref),path,name:file.name,size:file.size};
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
      items=await get("worldLibrary",true)||{};
      draw();
    }catch(e){
      $("wmList").innerHTML=`<div class="acctEmpty">Could not load worlds: ${esc(e.message)}</div>`;
    }
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
    $("wmEditor").classList.remove("wmEditing");
    $("wmEditorTitle").textContent="Add a new world";
    $("wmSave").textContent="Publish world";
    $("wmCancel").hidden=true;
    $("wmWorldFileLabel").textContent="Choose .world file";
    progress("");msg("");
    renderWorldStatus();
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
    $("wmFeatured").checked=!!w.featured;
    $("wmPublished").checked=w.published!==false;
    $("wmWorldFile").value="";
    $("wmImages").value="";
    $("wmEditor").classList.add("wmEditing");
    $("wmEditorTitle").textContent=`Editing: ${w.title||id}`;
    $("wmSave").textContent="Save changes";
    $("wmCancel").hidden=false;
    $("wmWorldFileLabel").textContent="Replace .world file (optional)";
    renderWorldStatus();
    renderGallery();
    draw();
    $("wmTitle").focus();
    $("world-library-admin").scrollIntoView({behavior:"smooth",block:"start"});
  }

  function renderWorldStatus(){
    const selected=$("wmWorldFile").files&&$("wmWorldFile").files[0];
    const box=$("wmWorldStatus");
    if(selected){
      box.classList.remove("empty");
      box.innerHTML=`<span>📦</span><span><strong>${esc(selected.name)}</strong><br>${esc(size(selected.size))} · ${editing?"will replace current file when saved":"ready to upload"}</span>`;
      return;
    }
    if(editing&&editing.world){
      box.classList.remove("empty");
      box.innerHTML=`<span>📦</span><span><strong>${esc(editing.world.name||"Current .world file")}</strong>${editing.world.size?`<br>${esc(size(editing.world.size))}`:""}</span>`;
      return;
    }
    box.classList.add("empty");
    box.textContent="No world file selected yet.";
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
      await del(`worldLibrary/${encodeURIComponent(id)}`);
      // Database deletion is the important part. Storage cleanup is best-effort so an old
      // file uploaded by another admin cannot prevent the world itself from being deleted.
      for(const im of imageArray(w.images))await erase(im&&im.path);
      await erase(w.world&&w.world.path);
      delete items[id];
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

    if(!title||!description){msg("Give the world a name and description first.",true);return}
    if(!editing&&!fileOKWorld(wf)){msg("Choose a .world file (up to 250 MB).",true);return}
    if(wf&&!fileOKWorld(wf)){msg("The world file must end in .world and be 250 MB or smaller.",true);return}
    if(gallery.length>20){msg("A world can have no more than 20 screenshots.",true);return}

    $("wmSave").disabled=true;
    const newlyUploaded=[];
    let committed=false;
    try{
      await initStorage();
      const stamp=Date.now();
      let world=editing&&editing.world?editing.world:null;
      const oldWorld=world;

      if(wf){
        progress("Uploading world file…");
        const path=`world-library/${user.uid}/${wid}/world/${stamp}-${safeName(wf.name)}`;
        world=await upload(wf,path,"application/octet-stream",p=>progress(`Uploading world file… ${p}%`));
        newlyUploaded.push(world.path);
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
        const up=await upload(f,path,f.type,p=>progress(`Screenshot ${pendingNumber}/${pendingTotal}… ${p}%`));
        newlyUploaded.push(up.path);
        finalImages.push(up);
      }

      const now=Date.now();
      const record={
        title,creator,description,tags,version,
        featured:$("wmFeatured").checked,
        published:$("wmPublished").checked,
        world,
        images:finalImages,
        createdAt:editing&&editing.createdAt||now,
        updatedAt:now,
        createdByUid:editing&&editing.createdByUid||user.uid,
        createdByName:editing&&editing.createdByName||(MFAuth.name&&MFAuth.name())||creator
      };

      progress($("wmPublished").checked?"Publishing…":"Saving hidden world…");
      await put(`worldLibrary/${encodeURIComponent(wid)}`,record);
      committed=true;

      // Clean up files no longer referenced after the database points at the new record.
      if(oldWorld&&wf&&oldWorld.path&&oldWorld.path!==world.path)await erase(oldWorld.path);
      const keep=new Set(finalImages.map(im=>im&&im.path).filter(Boolean));
      for(const im of imageArray(editing&&editing.images))if(im&&im.path&&!keep.has(im.path))await erase(im.path);

      items[wid]=record;
      const savedTitle=title;
      reset();
      msg(`“${savedTitle}” ${record.published?"is live in":"was saved to"} the World Library.`);
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
