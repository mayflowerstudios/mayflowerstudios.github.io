/* Shared illustrated gift picker and profile gift wall. No writes until Send. */
(function () {
  if (window.MFGifts) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let dialog = null;
  const wallState = new WeakMap();
  const giftFor = gift => Object.hasOwn(window.MFAuth?.giftCatalog || {}, gift.giftId) ? MFAuth.giftCatalog[gift.giftId] : gift;
  const date = t => Number.isFinite(Number(t)) && Number(t) > 0 ? new Date(Number(t)).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' }) : '';

  function artwork(gift) {
    const definition = giftFor(gift);
    // Only catalogue entries can supply an image; old database records use emoji fallback.
    const image = definition !== gift ? definition.image : '';
    return `<span class="mf-gift-art">${image ? `<img src="${esc(image)}" alt="${esc(definition.name)}" loading="lazy" decoding="async">` : ''}<span class="mf-gift-fallback"${image ? ' hidden' : ''} role="img" aria-label="${esc(gift.name || definition.name || 'Gift')}">${esc(definition.emoji || gift.emoji || '🎁')}</span></span>`;
  }
  function imageFallbacks(root) {
    root.querySelectorAll('.mf-gift-art img').forEach(img => {
      const fallback = () => { img.hidden = true; img.nextElementSibling.hidden = false; };
      img.addEventListener('error', fallback, { once:true });
      if (img.complete && img.naturalWidth === 0) fallback();
    });
  }

  function mount(content, label) {
    close();
    const returnFocus = document.activeElement;
    const overlay = document.createElement('div');
    overlay.className = 'mf-gift-overlay';
    overlay.innerHTML = `<section class="mf-gift-dialog" role="dialog" aria-modal="true" aria-label="${esc(label)}" tabindex="-1"><button class="mf-gift-close" type="button" aria-label="Close gift window">✕</button>${content}</section>`;
    const state = { overlay, returnFocus, pending:false, overflow:document.body.style.overflow };
    dialog = state;
    document.body.style.overflow = 'hidden';
    document.body.appendChild(overlay);
    state.keydown = event => {
      if (dialog !== state) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); }
      if (event.key !== 'Tab') return;
      const nodes = [...overlay.querySelectorAll('button:not(:disabled),textarea,a[href],[tabindex="0"]')].filter(el => !el.closest('[hidden]'));
      if (!nodes.length) return;
      const first = nodes[0], last = nodes[nodes.length-1];
      if (event.shiftKey && (document.activeElement === first || !nodes.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !nodes.includes(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', state.keydown, true);
    overlay.addEventListener('click', event => { if (event.target === overlay || event.target.closest('.mf-gift-close,[data-gift-cancel]')) close(); });
    overlay.querySelector('section').focus();
    return state;
  }
  function close() {
    if (!dialog || dialog.pending) return;
    const previous = dialog; dialog = null;
    document.removeEventListener('keydown', previous.keydown, true);
    previous.overlay.remove();
    document.body.style.overflow = previous.overflow;
    if (previous.returnFocus?.isConnected) previous.returnFocus.focus();
  }

  async function compose(uid, name) {
    if (dialog?.pending) return;
    const state = mount(`<header class="mf-gift-heading"><span class="mf-gift-eyebrow">A LITTLE SOMETHING, JUST BECAUSE</span><h2>Send a little happiness</h2><p>To <strong>${esc(name || 'your friend')}</strong>, with love from you.</p></header><div class="mf-gift-content"><p class="mf-gift-feedback" role="status">Opening the gift cupboard…</p></div>`, 'Send a gift');
    const body = state.overlay.querySelector('.mf-gift-content');
    if (!window.MFAuth?.user || MFAuth.user.uid === uid) {
      body.innerHTML = `<p class="mf-gift-feedback">${window.MFAuth?.user ? 'Choose a friend’s profile to send them a gift.' : 'Sign in to send a little happiness.'}</p>${!window.MFAuth?.user ? '<a class="mf-gift-primary" href="/account.html">Sign in</a>' : ''}`;
      return;
    }
    let catalog;
    try { catalog = await MFAuth.loadGiftCatalog(); }
    catch (error) {
      if (dialog !== state) return;
      body.innerHTML = `<p class="mf-gift-feedback" role="alert">${esc(error.message)}</p><button class="mf-gift-primary" data-gift-retry type="button">Try again</button>`;
      body.querySelector('[data-gift-retry]').onclick = () => compose(uid, name);
      return;
    }
    if (dialog !== state) return;
    const entries = Object.entries(catalog).filter(([,gift]) => gift.enabled !== false), categories = ['All gifts', ...new Set(entries.map(([,g]) => g.category))];
    if (!entries.length) { body.innerHTML = '<p class="mf-gift-feedback">No gifts are available yet. Check back soon.</p>'; return; }
    let selected = null;
    body.innerHTML = `<div class="mf-gift-compose"><section class="mf-gift-cupboard" aria-label="Choose a gift"><h3><span>01</span> Pick something lovely</h3><div class="mf-gift-categories" aria-label="Gift categories">${categories.map((category,i) => `<button type="button" data-category="${esc(category)}" aria-pressed="${i===0}">${esc(category)}</button>`).join('')}</div><div class="mf-gift-options"></div></section><form class="mf-gift-dedication"><h3><span>02</span> Make it personal</h3><div class="mf-gift-selected"><span class="mf-gift-empty-icon" aria-hidden="true">♡</span><p>Your little gift goes here</p></div><label for="mfGiftNote">A note for ${esc(name || 'your friend')} <small>(optional)</small></label><textarea id="mfGiftNote" maxlength="160" rows="3" placeholder="A tiny gift to brighten your day…"></textarea><div class="mf-gift-note-meta"><span>Displayed on their gift wall</span><output id="mfGiftCharacters" for="mfGiftNote">0 / 160</output></div><blockquote class="mf-gift-note-preview" hidden></blockquote><p class="mf-gift-feedback" role="status" aria-live="polite"></p><button class="mf-gift-primary" type="submit" disabled>Choose a gift first</button><button class="mf-gift-secondary" type="button" data-gift-cancel>Cancel</button><small class="mf-gift-free">A little kindness is always free.</small></form></div>`;
    const options = body.querySelector('.mf-gift-options'), form = body.querySelector('form'), note = form.querySelector('textarea'), send = form.querySelector('[type=submit]'), feedback = form.querySelector('[role=status]');
    function choose(id) {
      if (state.pending) return;
      selected = id;
      options.querySelectorAll('[data-gift-choice]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.giftChoice === selected)));
      form.querySelector('.mf-gift-selected').innerHTML = artwork({giftId:id}) + `<b>${esc(catalog[id].name)}</b>`;
      imageFallbacks(form);
      send.disabled = false; send.textContent = 'Send gift ♡'; feedback.textContent = '';
    }
    function filter(category) {
      options.innerHTML = entries.filter(([,g]) => category === 'All gifts' || g.category === category).map(([id,g]) => `<button class="mf-gift-option" type="button" data-gift-choice="${esc(id)}" aria-pressed="${id===selected}">${artwork({giftId:id})}<span>${esc(g.name)}</span></button>`).join('');
      options.querySelectorAll('[data-gift-choice]').forEach(button => button.onclick = () => choose(button.dataset.giftChoice));
      imageFallbacks(options);
    }
    body.querySelectorAll('[data-category]').forEach(button => button.onclick = () => {
      if (state.pending) return;
      body.querySelectorAll('[data-category]').forEach(other => other.setAttribute('aria-pressed', String(other===button)));
      filter(button.dataset.category);
    });
    note.oninput = () => {
      form.querySelector('output').textContent = `${note.value.length} / 160`;
      const preview = form.querySelector('blockquote');
      preview.textContent = note.value; preview.hidden = !note.value.trim();
    };
    form.onsubmit = async event => {
      event.preventDefault();
      if (!selected || state.pending || dialog !== state) return;
      state.pending = true;
      const giftId = selected, message = note.value.slice(0,160);
      state.overlay.querySelectorAll('button,textarea').forEach(control => control.disabled = true);
      send.textContent = 'Sending…'; feedback.textContent = '';
      try {
        await MFAuth.sendGift(uid, giftId, message);
        state.pending = false;
        if (dialog !== state) return;
        body.innerHTML = `<div class="mf-gift-success">${artwork({giftId})}<span class="mf-gift-eyebrow">DELIVERED WITH LOVE</span><h3>A little joy, on its way.</h3><p>Your ${esc(catalog[giftId].name.toLowerCase())} is on ${esc(name || 'your friend')}’s gift wall.</p>${message ? `<blockquote>${esc(message)}</blockquote>` : ''}<button class="mf-gift-primary" type="button" data-gift-cancel>Lovely ♡</button></div>`;
        state.overlay.querySelector('.mf-gift-close').disabled = false;
        imageFallbacks(body); body.querySelector('button').focus();
      } catch (error) {
        state.pending = false;
        if (dialog !== state) return;
        state.overlay.querySelectorAll('button,textarea').forEach(control => control.disabled = false);
        send.textContent = 'Send gift ♡';
        feedback.textContent = /permission.denied/i.test(error.code || error.message) ? 'This gift could not be sent. Please try again later.' : (error.message || 'Your gift could not be sent. Your note is still here.');
      }
    };
    filter('All gifts');
  }

  function removalControls(id, kind) {
    const label=kind==='gift'?'gift':'note';
    return `<div class="mf-profile-removal" data-remove-entry="${esc(id)}"><button class="mf-profile-delete" type="button" data-remove-start>Delete ${label}</button><div class="mf-profile-confirm" data-remove-confirm hidden><p>Delete this ${label} from the profile?</p><button class="mf-profile-delete" type="button" data-remove-yes>Delete permanently</button><button class="mf-profile-delete" type="button" data-remove-cancel>Cancel</button></div></div>`;
  }
  function bindRemovals(root, {profileUid, kind}) {
    const viewerUid=window.MFAuth?.user?.uid;
    root.querySelectorAll('[data-remove-entry]').forEach(control=>{
      const start=control.querySelector('[data-remove-start]'), confirmation=control.querySelector('[data-remove-confirm]'), yes=control.querySelector('[data-remove-yes]'), cancel=control.querySelector('[data-remove-cancel]');
      let pending=false;
      start.onclick=()=>{start.hidden=true;confirmation.hidden=false;cancel.focus();};
      cancel.onclick=()=>{if(pending)return;confirmation.hidden=true;start.hidden=false;start.focus();};
      yes.onclick=async()=>{
        if(pending)return;
        pending=true;yes.disabled=true;cancel.disabled=true;yes.textContent='Deleting…';
        const oldFeedback=root.querySelector('[data-removal-feedback]');
        if(oldFeedback)oldFeedback.textContent='';
        try {
          if(!viewerUid || MFAuth.user?.uid!==viewerUid)throw Error('Your account changed. Reopen the profile and try again.');
          if(kind==='gift')await MFAuth.deleteGift(profileUid,control.dataset.removeEntry);
          else await MFAuth.deleteGuestbookPost(profileUid,control.dataset.removeEntry);
          yes.textContent='Deleted';
        } catch(error) {
          if(root.isConnected!==false){
            let message=root.querySelector('[data-removal-feedback]');
            if(!message){message=document.createElement('p');message.dataset.removalFeedback='';message.className='mf-profile-removal-error';message.setAttribute('role','alert');root.prepend(message);}
            message.textContent=/permission|unauthorized/i.test(error.code || error.message || '')?'This entry could not be deleted. Please try again later or contact a site administrator.':error.message || 'Could not delete this entry. Please try again.';
          }
          yes.disabled=false;cancel.disabled=false;yes.textContent='Delete permanently';
        } finally {pending=false;}
      };
    });
  }

  function renderWall(root, records, { empty = 'Gifts and messages you receive will appear here.', profileUid = '' } = {}) {
    if (!root) return;
    const previous = wallState.get(root);
    const state = { records, visible:previous?.visible || 8, empty, loaded:previous?.loaded || false };
    wallState.set(root,state);
    function draw() {
      if (wallState.get(root) !== state) return;
      const gifts = Object.entries(records || {}).map(([id,value]) => ({...value,id})).sort((a,b) => (Number(b.t)||0)-(Number(a.t)||0));
      const canDelete=!!profileUid && window.MFAuth?.user?.uid===profileUid;
      root.innerHTML = gifts.length ? `<div class="mf-gift-wall">${gifts.slice(0,state.visible).map(gift => `<article class="mf-gift-keepsake"><div class="mf-gift-sender"><b>${esc(gift.fromName || 'Someone')}</b><time>${esc(date(gift.t))}</time></div>${artwork(gift)}<span class="mf-gift-caption">${esc(giftFor(gift).name || gift.name || 'A little gift')}</span>${gift.note ? `<p class="mf-gift-message">${esc(gift.note)}</p>` : '<p class="mf-gift-message mf-gift-muted">A little something, just for you ♡</p>'}${gift.fromUsername ? `<span class="mf-gift-handle">from @${esc(gift.fromUsername)}</span>` : ''}${canDelete?removalControls(gift.id,'gift'):''}</article>`).join('')}</div>${gifts.length>state.visible ? `<button class="mf-gift-secondary mf-gift-more" type="button">Show more gifts (${gifts.length-state.visible})</button>` : ''}` : `<div class="mf-gift-empty"><span aria-hidden="true">♡</span><h4>No gifts yet</h4><p>${esc(empty)}</p></div>`;
      imageFallbacks(root);
      if(canDelete)bindRemovals(root,{profileUid,kind:'gift'});
      root.querySelector('.mf-gift-more')?.addEventListener('click', () => { state.visible += 8; draw(); });
    }
    draw();
    const hasUnknownGift = Object.values(records || {}).some(gift => !Object.hasOwn(window.MFAuth?.giftCatalog || {}, gift?.giftId));
    if ((!state.loaded || hasUnknownGift) && window.MFAuth?.loadGiftCatalog) {
      MFAuth.loadGiftCatalog().then(() => { if (wallState.get(root) === state) { state.loaded = true; draw(); } }).catch(() => {});
    }
  }
  window.MFGifts = { compose, close, renderWall, removalControls, bindRemovals, get isOpen() { return !!dialog; } };
})();
