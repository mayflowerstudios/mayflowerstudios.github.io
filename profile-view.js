/* profile-view.js — Mayflower Studios public profile overlay
   Respects profile privacy and shows permanent achievements + owner-awarded badges. */
(function () {
  let dbMods = null, db = null, statusUnsub = null;
  let liveUnsubs = [], requestId = 0, returnFocus = null, previousOverflow = '';

  function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }
  function niceDate(t) { if (!t) return ""; return new Date(t).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"}); }
  function timeAgo(t) { if(!t)return"";const s=Math.floor((Date.now()-t)/1000);if(s<60)return"just now";if(s<3600)return Math.floor(s/60)+"m ago";if(s<86400)return Math.floor(s/3600)+"h ago";const d=Math.floor(s/86400);return d===1?"yesterday":d+"d ago"; }
  function sortNewest(obj){return Object.entries(obj||{}).map(([id,v])=>({id,...(v||{})})).sort((a,b)=>(b.t||b.unlockedAt||0)-(a.t||a.unlockedAt||0));}
  function isBirthdayToday(v){if(!/^\d{2}-\d{2}$/.test(String(v||"")))return false;const d=new Date(),mm=String(d.getMonth()+1).padStart(2,"0"),dd=String(d.getDate()).padStart(2,"0");return v===`${mm}-${dd}`;}
  function lastSeenText(st, canOnline, canLast){
    if(!canOnline&&!canLast)return"activity hidden";
    if(st&&st.state==="online"&&canOnline)return"online now";
    if(!canLast)return canOnline?"offline":"activity hidden";
    const t=st&&st.last;if(!t)return"offline";const s=Math.floor((Date.now()-t)/1000);if(s<90)return"last seen just now";if(s<3600)return"last seen "+Math.floor(s/60)+"m ago";if(s<86400)return"last seen "+Math.floor(s/3600)+"h ago";const d=Math.floor(s/86400);return"last seen "+(d===1?"yesterday":d+"d ago");
  }

  async function rankOf(username){if(!username)return"";const h=String(username).toLowerCase();try{const[o,a]=await Promise.all([dbMods.get(dbMods.ref(db,"owner")),dbMods.get(dbMods.ref(db,`admins/${h}`))]);if(o.exists()&&String(o.val()).toLowerCase()===h)return"Owner";if(a.val()===true)return"Admin";}catch(_){}return"";}

  function renderGuestbook(uid,posts){const box=document.getElementById("mfProfGuestPosts"),countEl=document.getElementById("mfProfGuestCount");if(!box)return;const list=sortNewest(posts);if(countEl)countEl.textContent=String(list.length);box.innerHTML=list.map(p=>{const canDelete=MFAuth.uid===uid||MFAuth.uid===p.fromUid,from=p.fromUsername?"@"+p.fromUsername:(p.fromName||"Someone");return`<div class="mf-prof-gbpost" data-post="${esc(p.id)}"><div class="mf-prof-gbmeta"><b>${esc(from)}</b><small>${esc(timeAgo(p.t))}</small></div><p>${esc(p.text||"")}</p>${canDelete?window.MFGifts?.removalControls(p.id,'note') || '':""}</div>`;}).join("")||'<div class="mf-prof-empty">No guestbook notes yet.</div>';window.MFGifts?.bindRemovals(box,{profileUid:uid,kind:'note'});}

  function renderAchievements(records){const box=document.getElementById("mfProfAchievements");if(!box)return;const defs=(MFAuth.achievementCatalog||[]),earned=defs.filter(a=>records&&records[a.id]).map(a=>({...a,unlockedAt:Number(records[a.id].unlockedAt)||0})).sort((a,b)=>b.unlockedAt-a.unlockedAt);box.innerHTML=earned.length?earned.map(a=>`<div class="mf-prof-ach" title="${a.unlockedAt?`Unlocked ${esc(niceDate(a.unlockedAt))}`:'Unlocked'}"><span>${esc(a.icon)}</span><b>${esc(a.name)}</b><small>${esc(a.desc)}</small></div>`).join(""):'<div class="mf-prof-empty">No achievements unlocked yet.</div>';const n=document.getElementById("mfProfAchievementCount");if(n)n.textContent=String(earned.length);}
  function renderBadges(badges){const strip=document.getElementById("mfProfBadgeStrip"),box=document.getElementById("mfProfBadgeList");const list=Object.entries(badges||{}).map(([id,b])=>({id,...(b||{})})).sort((a,b)=>(Number(b.assignedAt)||0)-(Number(a.assignedAt)||0));const html=list.map(b=>`<span class="mf-prof-userbadge" title="${esc(b.description||"")}"><b>${esc(b.icon||"🏷️")}</b>${esc(b.label||"Badge")}</span>`).join("");if(strip){strip.innerHTML=html;strip.hidden=!list.length;}if(box)box.innerHTML=list.length?html:'<div class="mf-prof-empty">No badges yet.</div>';}
  async function renderFriends(friendObj){const box=document.getElementById("mfProfFriends");if(!box)return;const ids=Object.keys(friendObj||{}).slice(0,12);if(!ids.length){box.innerHTML='<div class="mf-prof-empty">No friends to show.</div>';return;}box.innerHTML='<div class="mf-prof-empty">Loading friends…</div>';const rows=[];for(const id of ids){try{const snap=await dbMods.get(dbMods.ref(db,`users/${id}`));if(!snap.exists())continue;const p=snap.val()||{},name=p.displayName||p.username||"someone",a=MFAuth.avatarFor(p,name);rows.push({id,p,name,a});}catch(_){}}if(!box.isConnected)return;box.innerHTML=rows.length?rows.map(x=>`<button class="mf-prof-friend" type="button" data-friend-open="${esc(x.id)}"><span>${x.a.kind==='photo'?`<img src="${esc(x.a.value)}" alt="">`:esc(x.a.value)}</span><b>${esc(x.name)}</b><small>${x.p.username?'@'+esc(x.p.username):''}</small></button>`).join(""):'<div class="mf-prof-empty">No friends to show.</div>';box.querySelectorAll('[data-friend-open]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.friendOpen)));}

  function ensureDOM() {
    if (document.getElementById('mfProfOverlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'mfProfOverlay'; overlay.className = 'mf-prof-overlay';
    overlay.innerHTML = '<div class="mf-prof-card" id="mfProfCard" role="dialog" aria-modal="true" aria-label="Member profile" tabindex="-1"></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', event => { if(event.target === overlay && !window.MFGifts?.isOpen) hide(); });
    document.addEventListener('keydown', event => {
      if (!overlay.classList.contains('open') || window.MFGifts?.isOpen) return;
      if (event.key === 'Escape') hide();
      if (event.key !== 'Tab') return;
      const nodes = [...overlay.querySelectorAll('button:not(:disabled),a[href],textarea,[tabindex="0"]')].filter(el => !el.closest('[hidden]'));
      const first = nodes[0], last = nodes[nodes.length-1];
      if (event.shiftKey && (document.activeElement===first || !nodes.includes(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement===last || !nodes.includes(document.activeElement))) { event.preventDefault(); first?.focus(); }
    });
  }
  function hide() {
    ++requestId;
    const overlay = document.getElementById('mfProfOverlay');
    if (overlay?.classList.contains('open')) {
      overlay.classList.remove('open');
      document.body.style.overflow = previousOverflow;
      if (returnFocus?.isConnected) returnFocus.focus();
    }
    if (statusUnsub) { try { statusUnsub(); } catch (_) {} statusUnsub = null; }
    liveUnsubs.forEach(fn => { try { fn(); } catch (_) {} }); liveUnsubs = [];
  }
  function renderGifts(uid,gifts) {
    const count = document.getElementById('mfProfGiftCount');
    if (count) count.textContent = String(Object.keys(gifts || {}).length);
    window.MFGifts?.renderWall(document.getElementById('mfProfGiftRecent'), gifts, {profileUid:uid});
  }
  async function show(uid) {
    if (!window.MFAuth || !MFAuth.isConfigured() || !uid || window.MFGifts?.isOpen) return;
    ensureDOM(); hide();
    const current = ++requestId, active = () => current === requestId;
    returnFocus = document.activeElement; previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const overlay = document.getElementById('mfProfOverlay'), card = document.getElementById('mfProfCard');
    card.innerHTML = '<button class="mf-prof-x" aria-label="Close profile"><svg class="mf-icon" aria-hidden="true" focusable="false"><use href="/assets/ui-icons.svg#close"></use></svg></button><div class="mf-prof-loading" role="status">Loading profile…<div class="mf-skeleton" aria-hidden="true"></div><div class="mf-skeleton" aria-hidden="true"></div></div>';
    card.querySelector('button').onclick = hide;
    overlay.classList.add('open'); card.focus();
    try {
      if (!window.MFGifts) await import('/gifts.js?v=4');
      if (!active()) return;
      if (!dbMods) {
        let n = 0;
        while (!MFAuth.db && n++ < 40 && active()) await new Promise(resolve => setTimeout(resolve,80));
        db = MFAuth.db;
        if (!db) throw new Error('Please sign in to view member profiles.');
        dbMods = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js');
      }
      if (!active()) return;
      const snap = await dbMods.get(dbMods.ref(db, `users/${uid}`));
      if (!snap.exists()) throw new Error('This profile is no longer available.');
      const prof = snap.val() || {}, isMe = MFAuth.uid === uid;
      const [privacy, viewerFriend] = await Promise.all([
        MFAuth.getProfilePrivacy ? MFAuth.getProfilePrivacy(uid) : {},
        isMe ? true : (MFAuth.areFriends ? MFAuth.areFriends(uid) : false)
      ]);
      const can = key => {
        const mode = privacy?.[key] || (key === 'friends' ? 'friends' : 'everyone');
        return isMe || mode === 'everyone' || (mode === 'friends' && viewerFriend);
      };
      const canGifts=can('gifts'), canGuest=can('guestbook'), canFriends=can('friends'), canOnline=can('onlineStatus'), canLast=can('lastSeen'), canAchievements=can('achievements'), canBadges=can('badges');
      const [rel,rank] = await Promise.all([can('relationship') && MFAuth.getRelationship ? MFAuth.getRelationship(uid) : null, rankOf(prof.username)]);
      if (!active()) return;
      const name=prof.displayName || 'someone', avatar=MFAuth.avatarFor(prof,name), photo=avatar.kind==='photo' ? MFAuth.safeImageURL(avatar.value) : '';
      const avatarHTML=photo ? `<img src="${esc(photo)}" alt="">` : `<span>${esc(avatar.kind==='photo' ? '🌸' : avatar.value)}</span>`;
      const accent=/^#[0-9a-fA-F]{6}$/.test(prof.accent || '') ? prof.accent : '#ffc0d9';
      card.style.setProperty('--prof-accent',accent);
      card.setAttribute('aria-label', `${name}’s profile`);
      card.classList.toggle('isBirthday',isBirthdayToday(prof.birthday));
      const tabs = [{id:'about',name:'About'}, ...(canGifts ? [{id:'gifts',name:'Gifts'}] : []), ...(canGuest ? [{id:'guestbook',name:'Guestbook'}] : []), ...(canAchievements ? [{id:'achievements',name:'Achievements'}] : []), ...(canFriends ? [{id:'friends',name:'Friends'}] : [])];
      card.innerHTML = `<button class="mf-prof-x" id="mfProfX" aria-label="Close profile"><svg class="mf-icon" aria-hidden="true" focusable="false"><use href="/assets/ui-icons.svg#close"></use></svg></button><div class="mf-prof-banner"></div>
        <header class="mf-prof-header"><div class="mf-prof-head"><div class="mf-prof-avatar">${avatarHTML}</div><div class="mf-prof-intro"><div class="mf-prof-name">${esc(name)}</div><div class="mf-prof-identity">${prof.username ? `<span>@${esc(prof.username)}</span>` : ''}${prof.pronouns ? `<span class="mf-prof-pron">${esc(prof.pronouns)}</span>` : ''}${rank ? `<span class="mf-prof-rank ${rank.toLowerCase()}">${rank}</span>` : ''}</div><div class="mf-prof-presence"><span class="mf-prof-dot"></span><span id="mfProfPresText">${canOnline||canLast ? 'Checking status…' : 'Activity hidden'}</span></div></div><div class="mf-prof-actions" id="mfProfActions">${isMe ? '<a class="mf-prof-btn" href="/account.html">Edit profile</a>' : `${canGifts ? '<button class="mf-prof-btn" data-send-gift type="button">Send gift</button>' : ''}<button class="mf-prof-btn secondary" id="mfProfConnect" type="button">${viewerFriend ? 'Message' : 'Add friend'}</button><span class="mf-prof-dim" id="mfProfActionMsg" role="status"></span>`}</div></div>
        ${prof.status ? `<p class="mf-prof-status">${esc(prof.status)}</p>` : ''}
        ${prof.bio ? `<p class="mf-prof-bio">${esc(prof.bio)}</p>` : ''}
        ${canBadges ? '<div class="mf-prof-badge-strip" id="mfProfBadgeStrip" hidden></div>' : ''}
        <div class="mf-prof-meta"><span>Joined ${esc(niceDate(prof.createdAt) || 'recently')}</span>${canGifts ? '<span><b id="mfProfGiftCount">—</b> recent gifts</span>' : ''}${canGuest ? '<span><b id="mfProfGuestCount">—</b> notes</span>' : ''}${canAchievements ? '<span><b id="mfProfAchievementCount">—</b> achievements</span>' : ''}</div>
        ${isBirthdayToday(prof.birthday) ? `<p class="mf-prof-birthday">🎂 Celebrating a birthday today</p>` : ''}</header>
        <nav class="mf-prof-tabs" role="tablist" aria-label="Profile sections">${tabs.map((tab,i) => `<button type="button" role="tab" id="mfProfTab-${tab.id}" aria-controls="mfProfPane-${tab.id}" aria-selected="${i===0}" tabindex="${i===0?0:-1}" data-profile-tab="${tab.id}">${tab.name}</button>`).join('')}</nav>
        <div class="mf-prof-body"><section id="mfProfPane-about" role="tabpanel" aria-labelledby="mfProfTab-about" tabindex="0">
          ${can('relationship') ? `<div class="mf-prof-detail"><span>Relationship</span><div>${rel ? `<b>${esc(rel.partnerName || 'In a relationship')}</b><small>Since ${esc(niceDate(rel.startedAt))}</small>` : '<span class="mf-prof-dim">Not shared</span>'}</div></div>` : ''}
          ${canBadges ? '<section class="mf-prof-panel"><h3>Badges</h3><div class="mf-prof-badge-list" id="mfProfBadgeList"></div></section>' : ''}
          ${!can('relationship')&&!canBadges ? '<p class="mf-prof-empty">No additional details shared.</p>' : ''}
        </section>
        ${canGifts ? '<section id="mfProfPane-gifts" role="tabpanel" aria-labelledby="mfProfTab-gifts" tabindex="0" hidden><div id="mfProfGiftRecent"><div class="mf-prof-empty">Loading gifts…</div></div></section>' : ''}
        ${canGuest ? `<section id="mfProfPane-guestbook" role="tabpanel" aria-labelledby="mfProfTab-guestbook" tabindex="0" hidden>${!isMe ? `<div class="mf-prof-gbform"><label for="mfProfGuestText">Leave a note</label><textarea id="mfProfGuestText" maxlength="500" rows="3" placeholder="Write to ${esc(name)}…"></textarea><button class="mf-prof-btn" id="mfProfGuestSend" type="button">Post note</button></div>` : ''}<div class="mf-prof-dim" id="mfProfGuestMsg" role="status"></div><div id="mfProfGuestPosts" class="mf-prof-gblist"></div></section>` : ''}
        ${canAchievements ? '<section id="mfProfPane-achievements" role="tabpanel" aria-labelledby="mfProfTab-achievements" tabindex="0" hidden><div class="mf-prof-achievements" id="mfProfAchievements"><div class="mf-prof-empty">Loading achievements…</div></div></section>' : ''}
        ${canFriends ? '<section id="mfProfPane-friends" role="tabpanel" aria-labelledby="mfProfTab-friends" tabindex="0" hidden><div class="mf-prof-friends-grid" id="mfProfFriends"><div class="mf-prof-empty">Loading friends…</div></div></section>' : ''}</div>`;
      const banner=MFAuth.safeImageURL(prof.bannerURL);
      if (banner) card.querySelector('.mf-prof-banner').style.backgroundImage = `url("${banner}")`;
      card.querySelector('#mfProfX').onclick=hide;
      function selectTab(id) {
        card.querySelectorAll('[data-profile-tab]').forEach(button => { const selected=button.dataset.profileTab===id; button.setAttribute('aria-selected',String(selected)); button.tabIndex=selected?0:-1; });
        tabs.forEach(tab => { card.querySelector(`#mfProfPane-${tab.id}`).hidden=tab.id!==id; });
      }
      const tabButtons=[...card.querySelectorAll('[data-profile-tab]')];
      tabButtons.forEach((button,index) => {
        button.onclick=()=>selectTab(button.dataset.profileTab);
        button.onkeydown=event=>{
          let next;
          if(event.key==='ArrowRight')next=(index+1)%tabs.length;
          if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;
          if(event.key==='Home')next=0;
          if(event.key==='End')next=tabs.length-1;
          if(next!==undefined){event.preventDefault();selectTab(tabs[next].id);tabButtons[next].focus();}
        };
      });
      card.querySelectorAll('[data-send-gift]').forEach(button=>button.onclick=()=>MFGifts.compose(uid,name));
      const connect=card.querySelector('#mfProfConnect');
      if(connect)connect.onclick=async()=>{
        const message=card.querySelector('#mfProfActionMsg');
        if(viewerFriend){hide();if(window.MFChat)MFChat.openDM(uid);return;}
        connect.disabled=true;
        try{if(!prof.username)throw new Error('They have not set a username yet.');await MFAuth.sendFriendRequest(prof.username);message.textContent='Friend request sent ♡';}
        catch(error){message.textContent=error.message || 'Could not send request.';connect.disabled=false;}
      };
      const guestSend=card.querySelector('#mfProfGuestSend');
      if(guestSend)guestSend.onclick=async()=>{
        const textarea=card.querySelector('#mfProfGuestText'),message=card.querySelector('#mfProfGuestMsg');
        guestSend.disabled=true;
        try{await MFAuth.postGuestbook(uid,textarea.value);if(active()){textarea.value='';message.textContent='Your note is posted ♡';}}
        catch(error){if(active())message.textContent=error.message || 'Could not post your note.';}
        finally{guestSend.disabled=false;}
      };
      const watch=(allowed,method,render,...extra)=>{if(allowed&&method)liveUnsubs.push(method(uid,value=>{if(active())render(value);},...extra));};
      watch(canGifts,MFAuth.watchGifts,gifts=>renderGifts(uid,gifts),80);
      watch(canGuest,MFAuth.watchGuestbook,posts=>renderGuestbook(uid,posts),80);
      watch(canAchievements,MFAuth.watchAchievements,renderAchievements);
      watch(canBadges,MFAuth.watchUserBadges,renderBadges);
      if(canFriends&&MFAuth.getFriendsForProfile)MFAuth.getFriendsForProfile(uid).then(friends=>{if(active())renderFriends(friends);}).catch(()=>{if(active())card.querySelector('#mfProfFriends').textContent='Friends could not be loaded.';});
      if((canOnline||canLast)&&MFAuth.watchStatus)statusUnsub=MFAuth.watchStatus(uid,status=>{
        if(!active())return;
        card.querySelector('.mf-prof-dot').classList.toggle('on',!!(status?.state==='online'&&canOnline));
        card.querySelector('#mfProfPresText').textContent=lastSeenText(status,canOnline,canLast);
      });
    } catch(error) {
      if(!active())return;
      card.innerHTML=`<button class="mf-prof-x" aria-label="Close profile"><svg class="mf-icon" aria-hidden="true" focusable="false"><use href="/assets/ui-icons.svg#close"></use></svg></button><div class="mf-prof-loading" role="alert"><strong>Profile unavailable</strong><p>${esc(error.message || 'Check your connection and try again.')}</p><button type="button" class="mf-prof-btn secondary" id="mfProfRetry">Try again</button></div>`;
      card.querySelector('button').onclick=hide;
      card.querySelector('#mfProfRetry').onclick=()=>show(uid);
    }
  }
  window.MFProfile={show,hide};
})();
