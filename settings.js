/* Mayflower Studios — unified settings */
(function(){
  const $=id=>document.getElementById(id);
  let savingPrivacy=false,savingNotify=false;
  const visibilityOptions='<option value="everyone">Everyone</option><option value="friends">Friends</option><option value="nobody">Nobody</option>';
  function status(id,text,kind){const n=$(id);if(!n)return;n.textContent=text||"";n.className="settingsStatus"+(kind?" "+kind:"");}
  function setTab(name){document.querySelectorAll('[data-settings-tab]').forEach(b=>b.classList.toggle('active',b.dataset.settingsTab===name));document.querySelectorAll('[data-settings-panel]').forEach(p=>p.classList.toggle('active',p.dataset.settingsPanel===name));try{history.replaceState(null,'','#'+name);}catch(_){}}
  function localGet(k,def){try{const v=localStorage.getItem(k);return v===null?def:v;}catch(_){return def;}}
  function localSet(k,v){try{localStorage.setItem(k,v);}catch(_){}}
  function applyAppearance(){const reduce=localGet('mf_reduce_motion','0')==='1';document.documentElement.classList.toggle('mf-reduce-motion',reduce);const canvas=$('fireflies');if(canvas)canvas.style.display=localGet('mf_hide_fireflies','0')==='1'?'none':'';}
  async function savePrivacy(){if(savingPrivacy||!window.MFAuth)return;savingPrivacy=true;status('privacyStatus','Saving…');try{const values={};document.querySelectorAll('[data-privacy]').forEach(s=>values[s.dataset.privacy]=s.value);await MFAuth.saveProfilePrivacy(values);status('privacyStatus','Privacy settings saved.','ok');}catch(e){status('privacyStatus',(e&&e.message)||'Could not save privacy settings.','bad');}finally{savingPrivacy=false;}}
  async function saveNotifications(){if(savingNotify||!window.MFAuth)return;savingNotify=true;status('notificationStatus','Saving…');try{const values={};document.querySelectorAll('[data-notify]').forEach(c=>values[c.dataset.notify]=!!c.checked);await MFAuth.saveNotificationPrefs(values);status('notificationStatus','Notification preferences saved.','ok');}catch(e){status('notificationStatus',(e&&e.message)||'Could not save notification preferences.','bad');}finally{savingNotify=false;}}
  async function load(user,profile){if(!user){$('settingsSignedOut').style.display='block';$('settingsApp').hidden=true;return;}$('settingsSignedOut').style.display='none';$('settingsApp').hidden=false;profile=profile||{};const name=profile.displayName||MFAuth.name()||'friend';$('settingsName').textContent=name;$('settingsHandle').textContent=profile.username?'@'+profile.username:'No username set';$('settingsEmail').textContent=user.email||'';const a=MFAuth.avatarFor(profile,name),av=$('settingsAvatar');av.innerHTML=a.kind==='photo'?`<img src="${String(a.value).replace(/"/g,'&quot;')}" alt="">`:String(a.value||'🌸');
    document.querySelectorAll('[data-privacy]').forEach(s=>{if(!s.options.length)s.innerHTML=visibilityOptions;});
    const privacy=await MFAuth.getProfilePrivacy(user.uid);document.querySelectorAll('[data-privacy]').forEach(s=>s.value=privacy[s.dataset.privacy]||'everyone');
    const prefs=await MFAuth.getNotificationPrefs();document.querySelectorAll('[data-notify]').forEach(c=>c.checked=prefs[c.dataset.notify]!==false);
    $('settingsAppearOffline').checked=!!(MFAuth.getAppearOffline&&MFAuth.getAppearOffline());$('settingsReduceMotion').checked=localGet('mf_reduce_motion','0')==='1';$('settingsFireflies').checked=localGet('mf_hide_fireflies','0')!=='1';applyAppearance();
  }
  function wire(){document.querySelectorAll('[data-settings-tab]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.settingsTab)));document.querySelectorAll('[data-privacy]').forEach(s=>{s.innerHTML=visibilityOptions;s.addEventListener('change',savePrivacy);});document.querySelectorAll('[data-notify]').forEach(c=>c.addEventListener('change',saveNotifications));
    $('settingsAppearOffline').addEventListener('change',()=>{if(MFAuth.setAppearOffline)MFAuth.setAppearOffline($('settingsAppearOffline').checked);status('presenceStatus',$('settingsAppearOffline').checked?'You now appear offline on this device.':'Your online presence is visible again, subject to your profile privacy setting.','ok');});
    $('settingsReduceMotion').addEventListener('change',()=>{localSet('mf_reduce_motion',$('settingsReduceMotion').checked?'1':'0');applyAppearance();status('appearanceStatus','Appearance preference saved on this device.','ok');});
    $('settingsFireflies').addEventListener('change',()=>{localSet('mf_hide_fireflies',$('settingsFireflies').checked?'0':'1');applyAppearance();status('appearanceStatus',$('settingsFireflies').checked?'Fireflies will appear after a reload if they were disabled.':'Fireflies hidden on this device.','ok');});
    $('settingsResetPassword').addEventListener('click',async()=>{const email=MFAuth.user&&MFAuth.user.email;if(!email)return status('securityStatus','This sign-in method does not have a password-reset email.','bad');try{await MFAuth.resetPassword(email);status('securityStatus','Password-reset email sent.','ok');}catch(e){status('securityStatus',(e&&e.message)||'Could not send the reset email.','bad');}});
    $('settingsSignOut').addEventListener('click',async()=>{try{await MFAuth.signOut();location.href='/';}catch(e){status('securityStatus','Could not sign out.','bad');}});
    const requested=location.hash.replace('#','');if(['account','privacy','notifications','presence','appearance','security'].includes(requested))setTab(requested);
  }
  function boot(){wire();const wait=()=>{if(window.MFAuth&&MFAuth.onChange)MFAuth.onChange(load);else setTimeout(wait,100);};wait();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
