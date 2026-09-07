/* Image uploads for the shared gift catalogue. Files keep their original bytes. */
(function () {
  'use strict';
  const VERSION = '10.12.2';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function fileInfo(file) {
    const types = {'image/png':'png','image/webp':'webp','image/gif':'gif','image/jpeg':'jpg','image/avif':'avif'};
    if (!types[file.type]) throw new Error(`${file.name}: use PNG, WebP, GIF, JPG or AVIF.`);
    if (!file.size || file.size > 8 * 1024 * 1024) throw new Error(`${file.name}: images must be between 1 byte and 8 MB.`);
    const name = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim().slice(0,32) || 'Gift';
    return { name, extension:types[file.type] };
  }
  async function publishImage(item, category, services) {
    const {uid, database, databaseModule:dmod, storage, storageModule:smod, stillAllowed} = services;
    const check = () => { if (!stillAllowed()) throw new Error('Your account changed. Sign in again before adding gifts.'); };
    check();
    const name = item.name.trim(), group = category.trim();
    if (!name || name.length > 32 || !group || group.length > 40) throw new Error('Give each gift a name and a category.');
    const info = fileInfo(item.file);
    const storagePath = `gifts/${uid}/${item.id}.${info.extension}`;
    if (!item.asset) {
      const reference = smod.ref(storage, storagePath);
      await smod.uploadBytes(reference, item.file, {contentType:item.file.type, cacheControl:'public,max-age=31536000'});
      check();
      item.asset = { storagePath, image:await smod.getDownloadURL(reference) };
    }
    check();
    // A failed save can retry the same ID without uploading or creating duplicates.
    const record = { ...item.asset, name, category:group, enabled:true, createdAt:item.createdAt, createdBy:uid };
    await dmod.set(dmod.ref(database, `giftCatalog/${item.id}`), record);
    return record;
  }

  const panel = $('gift-admin');
  if (!panel) return;
  let dmod, smod, storage, moduleRequest, unsubscribe, activeUid = '', session = 0;
  let allowed = false, catalogReady = false, busy = false, queue = [], uploaded = {};
  const say = (text, bad = false) => { $('agMessage').textContent = text; $('agMessage').classList.toggle('bad',bad); };
  const permissionError = error => /permission|unauthorized/i.test(String(error?.code || '') + String(error?.message || ''));
  async function modules() {
    if (!moduleRequest) moduleRequest = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${VERSION}/firebase-database.js`),
      import(`https://www.gstatic.com/firebasejs/${VERSION}/firebase-storage.js`)
    ]).then(([databaseModule,storageModule]) => { dmod=databaseModule; smod=storageModule; storage=smod.getStorage(MFAuth._app); }).catch(error=>{moduleRequest=null;throw error;});
    await moduleRequest;
  }
  function controls() {
    panel.querySelectorAll('button,input').forEach(control => { control.disabled=busy || !allowed; });
    $('agPublish').disabled=busy || !allowed || !catalogReady || !queue.length;
    $('agForm').hidden=!queue.length;
  }
  function clearQueue() {
    queue.forEach(item => URL.revokeObjectURL(item.preview));
    queue=[]; $('agFiles').value=''; drawQueue();
  }
  function drawQueue() {
    $('agQueue').innerHTML = queue.map(item => `<div class="agQueueItem"><div class="agImage"><img src="${esc(item.preview)}" alt=""></div><div class="agQueueDetails"><label>Gift name<input data-gift-name="${item.id}" maxlength="32" value="${esc(item.name)}" required /></label><label>Category<input data-gift-category="${item.id}" list="agCategories" maxlength="40" value="${esc(item.category)}" required /></label><small>${(item.file.size/1024).toFixed(0)} KB</small></div><button type="button" data-remove-image="${item.id}" aria-label="Remove ${esc(item.name)}">✕</button></div>`).join('');
    $('agQueue').querySelectorAll('[data-gift-name]').forEach(input => input.oninput=()=>{const item=queue.find(item=>item.id===input.dataset.giftName);if(item)item.name=input.value;});
    $('agQueue').querySelectorAll('[data-gift-category]').forEach(input => input.oninput=()=>{const item=queue.find(item=>item.id===input.dataset.giftCategory);if(item){item.category=input.value;drawCategories();}});
    $('agQueue').querySelectorAll('[data-remove-image]').forEach(button => button.onclick=()=>{
      if(busy)return;
      const item=queue.find(item=>item.id===button.dataset.removeImage);
      if(item)URL.revokeObjectURL(item.preview);
      queue=queue.filter(row=>row!==item);drawQueue();
    });
    drawCategories();controls();
  }
  function applyCategory() {
    if (busy || !allowed) return;
    const category=$('agCategory').value.trim();
    if (!category || category.length>40) return say('Choose a category of up to 40 characters for the batch.',true);
    queue.forEach(item=>{item.category=category;});
    drawQueue();say('Category applied to all queued images. You can still change each one below.');
  }
  function addFiles(files) {
    if (busy || !allowed) return;
    const errors=[];
    for (const file of files) {
      try {
        const info=fileInfo(file);
        queue.push({id:'gift-'+crypto.randomUUID(),name:info.name,category:$('agCategory').value.trim() || 'Friendship',file,createdAt:Date.now(),preview:URL.createObjectURL(file)});
      } catch(error) { errors.push(error.message); }
    }
    $('agFiles').value=''; drawQueue();
    say(errors.join('\n'),!!errors.length);
  }
  function drawLibrary() {
    const search=$('agSearch').value.trim().toLowerCase();
    const rows=Object.entries(uploaded).filter(([,gift])=>gift && typeof gift==='object').sort((a,b)=>(b[1].createdAt||0)-(a[1].createdAt||0));
    const visible=rows.filter(([,gift])=>`${gift.name} ${gift.category}`.toLowerCase().includes(search));
    $('agLibrary').innerHTML=visible.length?visible.map(([id,gift])=>{
      // Use the same trusted URL validation as the public gift picker.
      const definition=window.MFAuth?.giftCatalog?.[id];
      return `<article class="agGift ${gift.enabled===false?'isHidden':''}"><div class="agImage">${definition?.image?`<img src="${esc(definition.image)}" alt="${esc(gift.name)}" loading="lazy">`:''}</div><b>${esc(gift.name)}</b><small>${esc(gift.category)}${gift.enabled===false?' · Hidden':''}</small><button type="button" data-toggle-gift="${esc(id)}"${busy?' disabled':''}>${gift.enabled===false?'Show in picker':'Hide from picker'}</button></article>`;
    }).join(''):`<p>${search?'No gifts match your search.':'No uploads yet. Add your first gift above.'}</p>`;
    $('agLibrary').querySelectorAll('[data-toggle-gift]').forEach(button=>button.onclick=()=>toggleGift(button.dataset.toggleGift));
    drawCategories();
  }
  function drawCategories() {
    const categories=new Set(['Friendship','Romantic','Cozy','Celebration',...Object.values(MFAuth.giftCatalog || {}).map(gift=>gift.category),...queue.map(item=>item.category),$('agCategory').value].map(category=>String(category || '').trim()).filter(category=>category && category.length<=40));
    $('agCategories').innerHTML=[...categories].sort().map(category=>`<option value="${esc(category)}"></option>`).join('');
  }
  async function refresh() {
    if (!allowed || busy) return;
    const stamp=session;
    try {
      const snap=await dmod.get(dmod.ref(MFAuth.db,'giftCatalog'));
      if(stamp!==session)return;
      uploaded=snap.val() || {};
      catalogReady=true; $('agSetup').hidden=true;
      await MFAuth.loadGiftCatalog();
      if(stamp!==session)return;
      drawLibrary(); say('');
    } catch(error) {
      if(stamp!==session)return;
      catalogReady=false; $('agSetup').hidden=!permissionError(error);
      say(permissionError(error)?'Publish the gift database rules once to enable uploads.':'Gifts could not be loaded. Try Refresh.',true);
    }
    controls();
  }
  async function toggleGift(id) {
    if(!allowed || busy || !uploaded[id])return;
    busy=true;controls();
    try {
      const enabled=uploaded[id].enabled===false;
      await dmod.update(dmod.ref(MFAuth.db,`giftCatalog/${id}`),{enabled});
      say(enabled?'Gift is available in the picker.':'Gift hidden from the picker. Previously received gifts keep their image.');
    } catch(error) {say('Could not change this gift. Please try again.',true);}
    finally {busy=false;controls();}
  }
  async function publish(event) {
    event.preventDefault();
    if(!allowed || !catalogReady || busy || !queue.length)return;
    const items=[...queue], stamp=session, uid=activeUid;
    if(items.some(item=>!item.name.trim() || item.name.trim().length>32 || !item.category.trim() || item.category.trim().length>40))return say('Give every gift a name (up to 32 characters) and a category (up to 40 characters).',true);
    busy=true;controls();say('');
    let added=0;
    try {
      for (const item of items) {
        $('agProgress').textContent=`Adding ${added+1} of ${items.length}…`;
        await publishImage(item,item.category,{uid,storage,storageModule:smod,database:MFAuth.db,databaseModule:dmod,stillAllowed:()=>allowed && session===stamp && MFAuth.user?.uid===uid});
        added++;
        if(session!==stamp)return;
        URL.revokeObjectURL(item.preview);queue=queue.filter(row=>row!==item);
      }
      say(`${added} gift${added===1?'':'s'} added. They’re ready to choose in the gift picker.`);
    } catch(error) {
      if(session===stamp){
        const setup=permissionError(error);$('agSetup').hidden=!setup;
        say(`${added?`${added} added. `:''}${setup?'Firebase blocked the upload. Complete the one-time gift setup, then try Add gifts again.':error.message || 'Could not add gifts. Try again.'} Your remaining selections are still here.`,true);
      }
    } finally {
      busy=false;$('agProgress').textContent='';drawQueue();
      if(session===stamp){await MFAuth.loadGiftCatalog().catch(()=>{});drawLibrary();}
    }
  }
  async function start(user) {
    const stamp=++session;
    allowed=false;catalogReady=false;panel.hidden=true;
    if(unsubscribe){unsubscribe();unsubscribe=null;}
    if(activeUid!==(user?.uid || ''))clearQueue();
    activeUid=user?.uid || '';uploaded={};controls();
    if(!user)return;
    try {
      await modules();
      const get=async path=>(await dmod.get(dmod.ref(MFAuth.db,path))).val();
      const [owner,handleValue]=await Promise.all([get('owner'),get(`users/${user.uid}/username`)]);
      const handle=String(handleValue || '').toLowerCase();
      if(!/^[a-z0-9_]{1,20}$/.test(handle))return;
      const [admin,registeredUid]=await Promise.all([get(`admins/${handle}`),get(`usernames/${handle}`)]);
      if(stamp!==session || registeredUid!==user.uid || !(admin===true || String(owner || '').toLowerCase()===handle))return;
      allowed=true;panel.hidden=false;controls();
      await refresh();
      if(stamp!==session)return;
      unsubscribe=dmod.onValue(dmod.ref(MFAuth.db,'giftCatalog'),async snapshot=>{
        if(stamp!==session)return;
        uploaded=snapshot.val() || {};catalogReady=true;
        await MFAuth.loadGiftCatalog().catch(()=>{});
        if(stamp===session){drawLibrary();controls();}
      },error=>{if(stamp===session){catalogReady=false;$('agSetup').hidden=!permissionError(error);controls();}});
    } catch(error) { if(stamp===session)say('The gift manager could not start. Reload this page and try again.',true); }
  }

  $('agChoose').onclick=()=>$('agFiles').click();
  $('agFiles').onchange=event=>addFiles(event.target.files);
  $('agClear').onclick=()=>{if(!busy){clearQueue();say('');}};
  $('agForm').onsubmit=publish;
  $('agApplyCategory').onclick=applyCategory;
  $('agCategory').oninput=drawCategories;
  $('agRefresh').onclick=refresh;
  $('agSearch').oninput=drawLibrary;
  $('agDrop').addEventListener('dragover',event=>{event.preventDefault();if(!busy)$('agDrop').classList.add('isOver');});
  $('agDrop').addEventListener('dragleave',()=>$('agDrop').classList.remove('isOver'));
  $('agDrop').addEventListener('drop',event=>{event.preventDefault();$('agDrop').classList.remove('isOver');addFiles(event.dataTransfer.files);});
  window.addEventListener('beforeunload',event=>{if(busy){event.preventDefault();event.returnValue='';}});
  function boot(){if(window.MFAuth?.onChange)MFAuth.onChange(start);else setTimeout(boot,100);}
  boot();
})();
