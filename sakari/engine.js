/* ══════════════════════════════════════════════════════
   Sakari — engine.js  (i18n build)
   ══════════════════════════════════════════════════════ */

var SAKARI = {
  stories:  {},
  S:        {},
  activeId: null,
  active:   null,
  lang:     'en',
};

var SCENES = {}, SPIRALS = {}, GLOSSARY = {};

/* ── UI STRINGS ────────────────────────────────────── */
var SAKARI_UI = {
  en: {
    begin:'i understand \u2014 begin',cwSuffix:'Underlined terms can be clicked for definitions. Not a substitute for professional support.',crisis:'If you are in crisis: <strong>988 Suicide &amp; Crisis Lifeline</strong> \u2014 call or text <a href="tel:988">988</a> (US). International: <a href="https://findahelpline.com" target="_blank">findahelpline.com</a>.',theme:'theme',langLabel:'language',cwHeader:'\u26a0 content warnings on the next screen',energyLow:'your energy is very low. some options are unavailable.',wantedLabel:'what you wanted to say',sentLabel:'what you sent',depLevels:['low','mild','moderate','high','severe'],anxLevels:['low','moderate','high','acute'],depTitle:'depression',anxTitle:'anxiety',nrgTitle:'energy',lockedLabel:'choices unavailable',lockedPct:'options locked',nrgRemaining:'energy remaining',epilogueTitle:"that's all for now.",playAgain:'play again',supportHeader:'if you need support',supportBody:'988 Suicide &amp; Crisis Lifeline: call or text <a href="tel:988">988</a> (US) &nbsp;\xb7&nbsp; International: <a href="https://findahelpline.com" target="_blank">findahelpline.com</a><br>BPD information: <a href="https://www.nami.org/About-Mental-Illness/Mental-Health-Conditions/Borderline-Personality-Disorder" target="_blank">NAMI</a> &nbsp;\xb7&nbsp; DBT skills: <a href="https://dialecticalbehaviortherapy.com" target="_blank">dialecticalbehaviortherapy.com</a>',continueBtn:'continue \u2192',endOfDay:'end of day',defaultDismiss:'breathe. come back.',
    resumeLabel:'continue where you left off',resumeBtn:'continue \u2192',startOver:'start over',settings:'settings',close:'close',returnHub:'return to library',progressSaved:'your progress is saved automatically.',reflectHeader:'where the day went',menuLabel:'menu',
  },
  de: {
    begin:'ich verstehe \u2014 beginnen',cwSuffix:'Unterstrichene Begriffe k\xf6nnen f\xfcr Definitionen angeklickt werden. Kein Ersatz f\xfcr professionelle Unterst\xfctzung.',crisis:'In einer Krise: <strong>Telefonseelsorge</strong> \u2014 kostenlos, 24/7: <a href="tel:08001110111">0800 111 0 111</a>. International: <a href="https://findahelpline.com" target="_blank">findahelpline.com</a>.',theme:'design',langLabel:'sprache',cwHeader:'\u26a0 inhaltswarnungen auf dem n\xe4chsten bildschirm',energyLow:'deine energie ist sehr niedrig. einige optionen sind nicht verf\xfcgbar.',wantedLabel:'was du sagen wolltest',sentLabel:'was du geschickt hast',depLevels:['niedrig','leicht','mittel','hoch','schwer'],anxLevels:['niedrig','mittel','hoch','akut'],depTitle:'depression',anxTitle:'angst',nrgTitle:'energie',lockedLabel:'nicht verf\xfcgbare entscheidungen',lockedPct:'gesperrte optionen',nrgRemaining:'verbleibende energie',epilogueTitle:'das war es f\xfcrs erste.',playAgain:'nochmal spielen',supportHeader:'wenn du hilfe brauchst',supportBody:'Telefonseelsorge: <a href="tel:08001110111">0800 111 0 111</a> (kostenlos, 24/7) &nbsp;\xb7&nbsp; International: <a href="https://findahelpline.com" target="_blank">findahelpline.com</a><br>BPS-Informationen: <a href="https://www.bpe-online.de" target="_blank">bpe-online.de</a> &nbsp;\xb7&nbsp; DBT: <a href="https://dialecticalbehaviortherapy.com" target="_blank">dialecticalbehaviortherapy.com</a>',continueBtn:'weiter \u2192',endOfDay:'ende von tag',defaultDismiss:'atmen. zur\xfcckkommen.',
    resumeLabel:'dort weitermachen, wo du aufgeh\xf6rt hast',resumeBtn:'weiter \u2192',startOver:'von vorne beginnen',settings:'einstellungen',close:'schlie\xdfen',returnHub:'zur\xfcck zur bibliothek',progressSaved:'dein fortschritt wird automatisch gespeichert.',reflectHeader:'wohin der tag ging',menuLabel:'men\xfc',
  },
  pt: {
    begin:'entendo \u2014 come\xe7ar',cwSuffix:'Termos sublinhados podem ser clicados para defini\xe7\xf5es. N\xe3o substitui apoio profissional.',crisis:'Em crise: <strong>CVV</strong> \u2014 ligue <a href="tel:188">188</a> (Brasil, gratuito, 24h) ou acesse <a href="https://cvv.org.br" target="_blank">cvv.org.br</a>. Internacional: <a href="https://findahelpline.com" target="_blank">findahelpline.com</a>.',theme:'tema',langLabel:'idioma',cwHeader:'\u26a0 avisos de conte\xfado na pr\xf3xima tela',energyLow:'sua energia est\xe1 muito baixa. algumas op\xe7\xf5es est\xe3o indispon\xedveis.',wantedLabel:'o que voc\xea queria dizer',sentLabel:'o que voc\xea enviou',depLevels:['baixa','leve','moderada','alta','severa'],anxLevels:['baixa','moderada','alta','aguda'],depTitle:'depress\xe3o',anxTitle:'ansiedade',nrgTitle:'energia',lockedLabel:'escolhas indispon\xedveis',lockedPct:'op\xe7\xf5es bloqueadas',nrgRemaining:'energia restante',epilogueTitle:'\xe9 tudo por agora.',playAgain:'jogar novamente',supportHeader:'se voc\xea precisar de apoio',supportBody:'CVV: ligue <a href="tel:188">188</a> (Brasil, gratuito, 24h) ou <a href="https://cvv.org.br" target="_blank">cvv.org.br</a> &nbsp;\xb7&nbsp; Internacional: <a href="https://findahelpline.com" target="_blank">findahelpline.com</a><br>Informa\xe7\xf5es sobre TPB: <a href="https://www.abp.org.br" target="_blank">ABP</a> &nbsp;\xb7&nbsp; DBT: <a href="https://dialecticalbehaviortherapy.com" target="_blank">dialecticalbehaviortherapy.com</a>',continueBtn:'continuar \u2192',endOfDay:'fim do dia',defaultDismiss:'respire. volte.',
    resumeLabel:'continuar de onde voc\xea parou',resumeBtn:'continuar \u2192',startOver:'come\xe7ar de novo',settings:'configura\xe7\xf5es',close:'fechar',returnHub:'voltar \xe0 biblioteca',progressSaved:'seu progresso \xe9 salvo automaticamente.',reflectHeader:'para onde o dia foi',menuLabel:'menu',
  },
};

function ui(key){var l=SAKARI.lang||'en';return(SAKARI_UI[l]||SAKARI_UI.en)[key]||SAKARI_UI.en[key]||'';}

/* ── THEME ─────────────────────────────────────────── */
function skSetTheme(name){document.documentElement.setAttribute('data-theme',name==='midnight'?'':name);document.querySelectorAll('.sk-swatch').forEach(function(el){el.classList.toggle('active',el.dataset.theme===name);});try{localStorage.setItem('sk-theme',name);}catch(e){}}

/* ── LANGUAGE ──────────────────────────────────────── */
function skSetLang(code){
  if(!SAKARI_UI[code]||code===SAKARI.lang)return;
  SAKARI.lang=code;
  try{localStorage.setItem('sk-lang',code);}catch(e){}
  Object.keys(SAKARI.stories).forEach(function(id){
    var m=SAKARI.stories[id];
    if(m.loadedLang!==code){m.loaded=false;m.loadedLang=null;m.scenes=null;m.spirals=null;m.glossary=null;}
  });
  if(SAKARI.activeId)openStory(SAKARI.activeId);
}

/* ── SAVE / RESUME ─────────────────────────────────── */
/* Persists in-progress runs so a refresh (or stepping away) doesn't
   wipe an emotionally heavy playthrough. One save slot per story id. */
var SK_SAVE_PREFIX='sk-save-';
function skSaveKey(id){return SK_SAVE_PREFIX+id;}
function skSaveProgress(){
  if(!SAKARI.activeId||!SAKARI.S||!SAKARI.S.scene)return;
  if(SAKARI.S.scene==='__epilogue__')return;
  var S=SAKARI.S;
  var data={v:1,scene:S.scene,dep:S.dep,anx:S.anx,nrg:S.nrg,dayIndex:S.dayIndex||0,lockedCount:S.lockedCount||0,choiceCount:S.choiceCount||0,seen:S._seenChoices||{},lockedAt:S._lockedAt||[],lang:SAKARI.lang,t:Date.now()};
  try{localStorage.setItem(skSaveKey(SAKARI.activeId),JSON.stringify(data));}catch(e){}
}
function skLoadProgress(id){
  try{var raw=localStorage.getItem(skSaveKey(id));if(!raw)return null;var d=JSON.parse(raw);if(!d||!d.scene||d.scene==='__epilogue__')return null;return d;}catch(e){return null;}
}
function skClearProgress(id){try{localStorage.removeItem(skSaveKey(id));}catch(e){}}
function skHasProgress(id){return !!skLoadProgress(id);}

/* ── REDUCED MOTION ────────────────────────────────── */
/* Spiral cascades and fade transitions can be distressing or
   vestibular-triggering, especially given what they depict. Respect
   the OS-level preference: skip JS stagger and neutralize CSS motion. */
function skReducedMotion(){try{return window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(e){return false;}}
function injectMotionStyles(){
  if(document.getElementById('sk-motion-styles'))return;
  var s=document.createElement('style');s.id='sk-motion-styles';
  s.textContent='@media (prefers-reduced-motion: reduce){'+
    '#sk-prose{transition:none !important;}'+
    '.spiral-line,.spiral-note{transition:none !important;animation:none !important;}'+
    '#sk-spiral .spiral-line,#sk-spiral .spiral-note{opacity:1 !important;transform:none !important;}'+
    '.wanted-block.inline-reveal{transition:none !important;}'+
    '.sk-swatch,.story-card,.choice-link{transition:none !important;}'+
    '*{scroll-behavior:auto !important;}'+
  '}';
  document.head.appendChild(s);
}
function skScroll(){try{window.scrollTo({top:0,behavior:skReducedMotion()?'auto':'smooth'});}catch(e){window.scrollTo(0,0);}}

/* ── STATUS ────────────────────────────────────────── */
function depLabel(v){var ls=ui('depLevels');return v<25?ls[0]:v<45?ls[1]:v<65?ls[2]:v<80?ls[3]:ls[4];}
function anxLabel(v){var ls=ui('anxLevels');return v<25?ls[0]:v<45?ls[1]:v<70?ls[2]:ls[3];}
function updateStatus(){var s=SAKARI.S;
  function meter(fillId,valId,pct,label,title){
    var f=document.getElementById(fillId);if(f)f.style.width=pct+'%';
    var v=document.getElementById(valId);if(v)v.textContent=label;
    /* expose the meter to assistive tech (width/colour alone isn't enough) */
    var bar=f?f.parentElement:null;
    if(bar){bar.setAttribute('role','meter');bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax','100');bar.setAttribute('aria-valuenow',Math.round(pct));bar.setAttribute('aria-valuetext',title+': '+label);bar.setAttribute('aria-label',title);}
  }
  meter('sk-dep-fill','sk-dep-val',s.dep,depLabel(s.dep),ui('depTitle'));
  meter('sk-anx-fill','sk-anx-val',s.anx,anxLabel(s.anx),ui('anxTitle'));
  meter('sk-nrg-fill','sk-nrg-val',s.nrg,s.nrg,ui('nrgTitle'));
}

/* ── SCRIPT LOADER ─────────────────────────────────── */
function loadScript(url,cb){var s=document.createElement('script');s.src=url;s.onload=cb;s.onerror=function(){console.error('Sakari: failed to load '+url);cb();};document.head.appendChild(s);}
function loadScriptsSequential(urls,cb){if(!urls.length){cb();return;}loadScript(urls[0],function(){loadScriptsSequential(urls.slice(1),cb);});}

/* ── LANGUAGE FILE HELPER ──────────────────────────── */
function langVariant(f,lang){if(lang==='en')return f;var d=f.lastIndexOf('.');if(d<0)return f+'.'+lang;return f.slice(0,d)+'.'+lang+f.slice(d);}

/* ── INJECT LANG STYLES ────────────────────────────── */
function injectLangStyles(){if(document.getElementById('sk-lang-styles'))return;var s=document.createElement('style');s.id='sk-lang-styles';s.textContent='.lang-row{display:flex;align-items:center;gap:8px;margin:10px 0 4px;font-size:10px;letter-spacing:.1em;text-transform:lowercase;}.lang-row>span{opacity:.45;}.sk-lang-btn{background:none;border:1px solid rgba(255,255,255,.18);color:inherit;padding:3px 10px;border-radius:3px;cursor:pointer;font-size:11px;letter-spacing:.06em;font-family:inherit;transition:border-color .18s,color .18s;}.sk-lang-btn:hover{border-color:var(--accent,#b07095);color:var(--accent,#b07095);}.sk-lang-btn.active{border-color:var(--accent,#b07095);color:var(--accent,#b07095);background:rgba(176,112,149,.12);}';document.head.appendChild(s);}

/* ── META LOADING ──────────────────────────────────── */
function initEngine(){
  if(typeof SAKARI_STORY_IDS==='undefined'){console.error('Sakari: stories.js not loaded');return;}
  try{var st=localStorage.getItem('sk-theme');if(st)skSetTheme(st);}catch(e){}
  try{var sl=localStorage.getItem('sk-lang');if(sl&&SAKARI_UI[sl])SAKARI.lang=sl;}catch(e){}
  injectLangStyles();
  injectMotionStyles();
  var toLoad=SAKARI_STORY_IDS.length;
  if(toLoad===0){renderHub();return;}
  SAKARI_STORY_IDS.forEach(function(id){
    loadScript('sakari/'+id+'/meta.js',function(){
      toLoad--;
      if(toLoad===0){renderHub();handleDeepLink();}
    });
  });
}

/* ── DEV: SCENE GRAPH VALIDATOR ────────────────────── */
/* Enable with ?debug=1. Walks the loaded scene graph and reports
   broken next/spiral targets and unreachable scenes to the console,
   so authoring errors surface immediately instead of stranding a
   player at a dead link. */
function skIsDebug(){try{return new URLSearchParams(window.location.search).get('debug')==='1';}catch(e){return false;}}
var SK_SPECIAL_TARGETS={'__epilogue__':1,'__next_day__':1};
function validateSceneGraph(m){
  if(!m||!m.scenes)return;
  var scenes=m.scenes,spirals=m.spirals||{};
  var ids=Object.keys(scenes);
  var problems=[];
  var reachable={};
  var start=m.startScene||ids[0];
  /* BFS from start over next + spiral targets */
  var queue=[start],guard=0;
  while(queue.length&&guard++<5000){
    var cur=queue.shift();
    if(!cur||SK_SPECIAL_TARGETS[cur]||reachable[cur])continue;
    if(!scenes[cur]){continue;}
    reachable[cur]=true;
    (scenes[cur].choices||[]).forEach(function(c){
      if(c.next&&!SK_SPECIAL_TARGETS[c.next]&&!scenes[c.next])problems.push('broken next: '+cur+' \u2192 '+c.next);
      if(c.next)queue.push(c.next);
      if(c.spiral){if(!spirals[c.spiral])problems.push('missing spiral: '+cur+' \u2192 '+c.spiral);queue.push(cur);}
    });
  }
  ids.forEach(function(id){if(!reachable[id])problems.push('unreachable scene: '+id);});
  if(problems.length){
    console.warn('[Sakari validator] '+m.id+': '+problems.length+' issue(s)');
    problems.forEach(function(p){console.warn('  \u2022 '+p);});
  }else{
    console.log('[Sakari validator] '+m.id+': graph OK ('+ids.length+' scenes)');
  }
}

/* ── DEEP LINK ─────────────────────────────────────── */
function handleDeepLink(){var params=new URLSearchParams(window.location.search);var id=params.get('story');if(id&&SAKARI.stories[id])openStory(id);}

/* ── HUB RENDERING ─────────────────────────────────── */
function renderHub(){
  var grid=document.getElementById('sk-story-grid');if(!grid)return;
  grid.innerHTML='';
  SAKARI_STORY_IDS.forEach(function(id){
    var m=SAKARI.stories[id];if(!m||m.hidden)return;
    var tags=(m.tags||[]).map(function(t){return'<span class="badge'+(t.style?' badge-'+t.style:'')+'">'+t.text+'</span>';}).join('');
    var card=document.createElement('div');card.className='story-card';
    card.innerHTML='<div class="story-card-inner"><div class="story-card-top"><span class="story-card-title">'+m.title+'</span><div class="story-card-tags">'+tags+'</div></div><p class="story-card-desc">'+m.desc+'</p>'+(m.note?'<p class="story-card-note">'+m.note+'</p>':'')+'<div class="story-card-footer"><span class="story-cw">'+ui('cwHeader')+'</span><span class="story-enter">read \u2192</span></div></div>';
    card.addEventListener('click',function(){openStory(id);});
    grid.appendChild(card);
  });
}

/* ── STORY OPEN / LOAD ─────────────────────────────── */
function openStory(id){
  var m=SAKARI.stories[id];if(!m)return;
  var lang=SAKARI.lang||'en';
  history.pushState({story:id},'','?story='+id);
  if(m.loadedLang===lang){showSplash(id);return;}
  showPlayerView();
  document.getElementById('sk-splash').style.display='none';
  document.getElementById('sk-game').style.display='none';
  document.getElementById('sk-loading').style.display='flex';
  document.getElementById('sk-player-title').textContent=m.title;
  SCENES={};SPIRALS={};GLOSSARY={};
  var files=[];
  if(lang!=='en'&&m.langs&&m.langs.some(function(l){return l.code===lang;})){
    files.push('sakari/'+id+'/meta.'+lang+'.js');
  }
  (m.days||[]).forEach(function(day){
    (day.files||[]).forEach(function(f){files.push('sakari/'+id+'/'+langVariant(f,lang));});
  });
  loadScriptsSequential(files,function(){
    m.scenes=SCENES;m.spirals=SPIRALS;m.glossary=GLOSSARY;
    m.loaded=true;m.loadedLang=lang;
    document.getElementById('sk-loading').style.display='none';
    if(skIsDebug())validateSceneGraph(m);
    showSplash(id);
  });
}

/* ── SPLASH ────────────────────────────────────────── */
function showSplash(id){
  SAKARI.activeId=id;
  var m=SAKARI.stories[id];
  showPlayerView();
  ['sk-game','sk-day-transition','sk-epilogue','sk-loading'].forEach(function(eid){var el=document.getElementById(eid);if(el)el.style.display='none';});
  document.getElementById('sk-player-title').textContent=m.title;
  var tags=(m.tags||[]).map(function(t){return'<span class="tag">'+t.text+'</span>';}).join('');
  var langPicker='';
  if(m.langs&&m.langs.length>1){
    langPicker='<div class="lang-row"><span>'+ui('langLabel')+'</span>'+
      m.langs.map(function(l){return'<button class="sk-lang-btn'+(SAKARI.lang===l.code?' active':'')+'" onclick="skSetLang(\''+l.code+'\')">'+l.label+'</button>';}).join('')+
    '</div>';
  }
  var saved=skLoadProgress(id);
  var resumeBlock='';
  if(saved){
    resumeBlock='<div class="sk-resume-row"><button class="start-btn sk-resume-btn" onclick="resumeStory()">'+ui('resumeBtn')+'</button>'+
      '<button class="sk-text-btn" onclick="startStory()">'+ui('startOver')+'</button></div>'+
      '<p class="sk-resume-note">'+ui('progressSaved')+'</p>';
  }
  var splash=document.getElementById('sk-splash');
  splash.innerHTML=
    '<h1>'+m.title+'</h1>'+
    '<p class="byline">'+(m.subtitle||'')+'</p>'+
    '<div class="tags">'+tags+'</div>'+
    (m.note?'<p class="splash-note">'+m.note+'</p>':'')+
    '<div class="theme-row"><span>'+ui('theme')+'</span>'+buildSwatches()+'</div>'+
    langPicker+
    '<p class="cw">'+(m.cw||'')+' '+ui('cwSuffix')+'</p>'+
    '<div class="crisis">'+ui('crisis')+'</div>'+
    (saved?resumeBlock:'<button class="start-btn" onclick="startStory()">'+ui('begin')+'</button>');
  splash.style.display='flex';
  setMenuVisible(false);
}

/* ── RESUME ────────────────────────────────────────── */
function resumeStory(){
  var id=SAKARI.activeId;var m=SAKARI.stories[id];if(!m)return;
  var saved=skLoadProgress(id);
  if(!saved){startStory();return;}
  /* scenes for all days are loaded by openStory, so the saved scene is
     already available in m.scenes */
  SAKARI.active=m;
  SAKARI.S={dep:saved.dep,anx:saved.anx,nrg:saved.nrg,dayIndex:saved.dayIndex||0,scene:saved.scene,lockedCount:saved.lockedCount||0,choiceCount:saved.choiceCount||0,_seenChoices:saved.seen||{},_lockedAt:saved.lockedAt||[]};
  document.getElementById('sk-splash').style.display='none';
  document.getElementById('sk-game').style.display='block';
  updateStatus();
  setMenuVisible(true);
  /* re-render the saved scene WITHOUT re-applying its entry deltas
     (they were already applied when first entered) */
  renderSceneNoDelta(saved.scene);
}

function buildSwatches(){
  var themes=[{name:'midnight',bg:'#2a1e18',label:'Midnight'},{name:'parchment',bg:'#d0c8b0',label:'Parchment'},{name:'violet',bg:'#3a2868',label:'Violet'},{name:'rose',bg:'#6a2040',label:'Rose'},{name:'paper',bg:'#7a6030',label:'Candlelight'}];
  return themes.map(function(t){return'<div class="sk-swatch t-swatch" data-theme="'+t.name+'" style="background:'+t.bg+'" title="'+t.label+'" onclick="skSetTheme(\''+t.name+'\')"></div>';}).join('');
}

/* ── SHOW/HIDE VIEWS ───────────────────────────────── */
function showPlayerView(){document.getElementById('sk-hub').style.display='none';document.getElementById('sk-player').style.display='block';ensureMenu();}

/* ── IN-PLAY MENU ──────────────────────────────────── */
/* Injected from JS so no HTML host changes are required. Gives a way
   to pause, change theme/language, or step away (progress is saved)
   without relying on the browser back button. */
function ensureMenu(){
  if(document.getElementById('sk-menu-btn'))return;
  injectMenuStyles();
  var btn=document.createElement('button');
  btn.id='sk-menu-btn';btn.type='button';
  btn.setAttribute('aria-label',ui('menuLabel'));
  btn.innerHTML='<span></span><span></span><span></span>';
  btn.addEventListener('click',openMenu);
  document.body.appendChild(btn);
  var overlay=document.createElement('div');
  overlay.id='sk-menu-overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
  overlay.addEventListener('click',function(e){if(e.target===overlay)closeMenu();});
  document.body.appendChild(overlay);
}
function openMenu(){
  var overlay=document.getElementById('sk-menu-overlay');if(!overlay)return;
  var m=SAKARI.stories[SAKARI.activeId]||{};
  var langPicker='';
  if(m.langs&&m.langs.length>1){
    langPicker='<div class="lang-row"><span>'+ui('langLabel')+'</span>'+
      m.langs.map(function(l){return'<button class="sk-lang-btn'+(SAKARI.lang===l.code?' active':'')+'" onclick="skSetLang(\''+l.code+'\')">'+l.label+'</button>';}).join('')+'</div>';
  }
  overlay.innerHTML='<div class="sk-menu-panel">'+
    '<h3>'+ui('settings')+'</h3>'+
    '<div class="theme-row"><span>'+ui('theme')+'</span>'+buildSwatches()+'</div>'+
    langPicker+
    '<p class="sk-menu-note">'+ui('progressSaved')+'</p>'+
    '<div class="sk-menu-actions">'+
      '<button class="sk-text-btn" onclick="closeMenu()">'+ui('close')+'</button>'+
      '<button class="sk-text-btn sk-menu-hub" onclick="menuReturnHub()">'+ui('returnHub')+'</button>'+
    '</div>'+
  '</div>';
  overlay.style.display='flex';
  document.addEventListener('keydown',menuEscHandler);
}
function closeMenu(){var o=document.getElementById('sk-menu-overlay');if(o)o.style.display='none';document.removeEventListener('keydown',menuEscHandler);}
function menuEscHandler(e){if(e.key==='Escape'){closeMenu();}}
function menuReturnHub(){skSaveProgress();closeMenu();showHub();}
function setMenuVisible(v){var b=document.getElementById('sk-menu-btn');if(b)b.style.display=v?'flex':'none';if(!v)closeMenu();}
function injectMenuStyles(){
  if(document.getElementById('sk-menu-styles'))return;
  var s=document.createElement('style');s.id='sk-menu-styles';
  s.textContent='#sk-menu-btn{position:fixed;top:14px;right:14px;z-index:60;width:38px;height:38px;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:4px;background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.16);border-radius:6px;cursor:pointer;backdrop-filter:blur(4px);transition:border-color .18s;}'+
    '#sk-menu-btn:hover{border-color:var(--accent,#b07095);}'+
    '#sk-menu-btn span{display:block;width:16px;height:1.5px;background:currentColor;opacity:.7;}'+
    '#sk-menu-overlay{display:none;position:fixed;inset:0;z-index:61;background:rgba(0,0,0,.55);backdrop-filter:blur(3px);align-items:center;justify-content:center;padding:20px;}'+
    '.sk-menu-panel{background:var(--bg,#1a1410);border:1px solid rgba(255,255,255,.14);border-radius:10px;max-width:360px;width:100%;padding:24px 22px;color:inherit;box-shadow:0 18px 50px rgba(0,0,0,.5);}'+
    '.sk-menu-panel h3{margin:0 0 16px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;font-weight:400;color:var(--accent,#b07095);}'+
    '.sk-menu-note{font-size:11px;opacity:.5;margin:14px 0 0;letter-spacing:.03em;}'+
    '.sk-menu-actions{display:flex;justify-content:space-between;gap:10px;margin-top:18px;}'+
    '.sk-text-btn{background:none;border:1px solid rgba(255,255,255,.2);color:inherit;padding:7px 14px;border-radius:5px;cursor:pointer;font-size:12px;letter-spacing:.05em;font-family:inherit;transition:border-color .18s,color .18s;}'+
    '.sk-text-btn:hover{border-color:var(--accent,#b07095);color:var(--accent,#b07095);}'+
    '.sk-resume-row{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:6px;}'+
    '.sk-resume-note{font-size:11px;opacity:.45;margin:8px 0 0;letter-spacing:.03em;}'+
    '@media (prefers-reduced-motion: reduce){#sk-menu-btn,.sk-text-btn{transition:none;}}';
  document.head.appendChild(s);
}

function showHub(){setMenuVisible(false);document.getElementById('sk-player').style.display='none';document.getElementById('sk-hub').style.display='block';history.pushState({},'',window.location.pathname);SAKARI.activeId=null;SAKARI.active=null;SAKARI.S={};['sk-splash','sk-game','sk-day-transition','sk-epilogue','sk-loading'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='none';});}

/* ── START STORY ───────────────────────────────────── */
function startStory(){
  var id=SAKARI.activeId;var m=SAKARI.stories[id];if(!m)return;
  SAKARI.S={dep:m.initialDep||55,anx:m.initialAnx||70,nrg:m.initialNrg||80,dayIndex:0,scene:null,lockedCount:0,choiceCount:0,_seenChoices:{},_lockedAt:[]};
  document.getElementById('sk-splash').style.display='none';
  document.getElementById('sk-game').style.display='block';
  updateStatus();
  SAKARI.active=m;
  var firstScene=m.startScene||(m.scenes?Object.keys(m.scenes)[0]:null);
  if(!firstScene){console.error('Sakari: no startScene found for '+id);return;}
  setMenuVisible(true);
  renderScene(firstScene);
}

/* ── SCENE RENDERING ───────────────────────────────── */
function renderSceneNoDelta(id){renderScene(id,true);}
function renderScene(id,skipDelta){
  if(id==='__epilogue__'){showEpilogue();return;}
  if(id==='__next_day__'){startNextDay();return;}
  var sc=SAKARI.active&&SAKARI.active.scenes?SAKARI.active.scenes[id]:SCENES[id];
  if(!sc){console.error('Sakari: scene not found:',id);return;}
  var S=SAKARI.S;S.scene=id;
  if(!skipDelta){
    if(sc.dep)S.dep=Math.max(0,Math.min(100,S.dep+sc.dep));
    if(sc.anx)S.anx=Math.max(0,Math.min(100,S.anx+sc.anx));
    if(sc.nrg)S.nrg=Math.max(0,Math.min(100,S.nrg+sc.nrg));
  }
  updateStatus();
  var m=SAKARI.stories[SAKARI.activeId];
  var dayLabel=(m&&m.days&&m.days[S.dayIndex])?m.days[S.dayIndex].label:'';
  document.getElementById('sk-scene-label').textContent=(sc.label||'')+(dayLabel?' \xb7 '+dayLabel:'');
  var proseEl=document.getElementById('sk-prose');proseEl.innerHTML='';
  if(S.nrg<30){var ew=document.createElement('div');ew.className='energy-warning';ew.textContent=ui('energyLow');proseEl.appendChild(ew);}
  (sc.prose||[]).forEach(function(p){
    var d=document.createElement('div');
    if(p.type==='thought'){d.className='thought';d.textContent=p.text;}
    else if(p.type==='msg'){d.className='msg-block'+(p.cold?' cold':'');d.innerHTML='<div class="msg-name">'+(p.name||'')+'</div>'+p.text;}
    else if(p.type==='wanted'){d.className='wanted-block';d.innerHTML=(p.wanted?'<div class="wb-label">'+ui('wantedLabel')+'</div><div class="wb-text">'+p.wanted+'</div>':'')+(p.sent?'<div class="wb-label sent">'+ui('sentLabel')+'</div><div class="wb-text sent">'+p.sent+'</div>':'');}
    else{d.innerHTML='<p>'+p.text+'</p>';}
    proseEl.appendChild(d);
  });
  document.getElementById('sk-spiral').className='';
  document.getElementById('sk-spiral').innerHTML='';
  var cWrap=document.getElementById('sk-choices-wrap');
  var cEl=document.getElementById('sk-choices');cEl.innerHTML='';cWrap.style.display='block';
  (sc.choices||[]).forEach(function(c,ci){
    /* lock reasons, in priority order:
       - c.locked  : always locked (authored)
       - c.egGate  : locked when energy < threshold
       - c.lockIf  : {dep:{min,max}, anx:{min,max}, nrg:{min,max}}
                     locked only when ALL provided ranges are satisfied —
                     the choice the brain takes off the table in a
                     particular state, and leaves available in another */
    var isEGate=c.egGate&&S.nrg<c.egGate;
    var isCond=false;
    if(c.lockIf){
      isCond=true;
      var L=c.lockIf;
      if(L.dep&&!(S.dep>=(L.dep.min||0)&&S.dep<=(L.dep.max||100)))isCond=false;
      if(L.anx&&!(S.anx>=(L.anx.min||0)&&S.anx<=(L.anx.max||100)))isCond=false;
      if(L.nrg&&!(S.nrg>=(L.nrg.min||0)&&S.nrg<=(L.nrg.max||100)))isCond=false;
    }
    var isLocked=c.locked||isEGate||isCond;
    /* count each authored choice slot once per playthrough, even if the
       scene is re-rendered (e.g. after dismissing a spiral) */
    var ckey=id+'#'+ci;
    if(!S._seenChoices[ckey]){
      S._seenChoices[ckey]=true;
      S.choiceCount++;
      if(isLocked){S.lockedCount++;S._lockedAt.push({scene:sc.label||id,text:c.text});}
    }
    var item=document.createElement('div');item.className='choice-item';
    if(isLocked){
      var reason=isEGate?ui('energyLow'):(c.reason||'');
      item.innerHTML='<span class="choice-link locked"><span class="ct">'+c.text+'</span>'+(c.note?'<span class="choice-note">'+c.note+'</span>':'')+'</span>'+(reason?'<span class="choice-reason">'+reason+'</span>':'');
    }else{
      var btn=document.createElement('button');btn.className='choice-link';
      btn.innerHTML='<span class="ct">'+c.text+'</span>'+(c.note?'<span class="choice-note">'+c.note+'</span>':'');
      item.appendChild(btn);
      (function(choice,it){it.querySelector('button').addEventListener('click',function(){pick(choice,it);});})(c,item);
    }
    cEl.appendChild(item);
  });
  skSaveProgress();
  skScroll();setupTerms();
}

/* ── PICK ──────────────────────────────────────────── */
function pick(c,itemEl){
  if(c.spiral){triggerSpiral(c.spiral);return;}
  if(c.wanted){
    document.querySelectorAll('.choice-item').forEach(function(it){it.classList.add(it===itemEl?'chosen':'dimmed');});
    var btn=itemEl.querySelector('button');if(btn)btn.style.display='none';
    var rev=document.createElement('div');rev.className='wanted-block inline-reveal';
    rev.innerHTML='<div class="wb-label">'+ui('wantedLabel')+'</div><div class="wb-text">'+c.wanted+'</div><div class="wb-label sent">'+ui('sentLabel')+'</div><div class="wb-text sent">'+c.text+'</div>';
    itemEl.appendChild(rev);
    var rm=skReducedMotion();
    setTimeout(function(){rev.classList.add('show');},rm?0:40);
    setTimeout(function(){applyDeltas(c);transitionTo(c.next);},rm?900:2200);
    return;
  }
  applyDeltas(c);transitionTo(c.next);
}
function applyDeltas(c){var S=SAKARI.S;if(c.nrg)S.nrg=Math.max(0,Math.min(100,S.nrg+c.nrg));if(c.dep)S.dep=Math.max(0,Math.min(100,S.dep+c.dep));if(c.anx)S.anx=Math.max(0,Math.min(100,S.anx+c.anx));updateStatus();}
function transitionTo(next){var prose=document.getElementById('sk-prose');var rm=skReducedMotion();if(!rm)prose.style.opacity='0';document.getElementById('sk-choices-wrap').style.display='none';setTimeout(function(){prose.style.opacity='1';renderScene(next);},rm?0:350);}

/* ── SPIRAL ────────────────────────────────────────── */
function triggerSpiral(key){
  document.getElementById('sk-choices-wrap').style.display='none';
  var el=document.getElementById('sk-spiral');el.innerHTML='';el.className='on';
  var _sp=SAKARI.active&&SAKARI.active.spirals?SAKARI.active.spirals:SPIRALS;
  var sp=_sp[key]||{lines:[],dismiss:ui('defaultDismiss')};
  var lines=Array.isArray(sp)?sp:(sp.lines||[]);
  var dismissText=Array.isArray(sp)?ui('defaultDismiss'):(sp.dismiss||ui('defaultDismiss'));
  var noteText=Array.isArray(sp)?'':(sp.note||'');
  var rm=skReducedMotion();
  var step=rm?0:600,base=rm?0:200;
  lines.forEach(function(t,i){var d=document.createElement('div');d.className='spiral-line';d.textContent=t;el.appendChild(d);if(rm){d.classList.add('show');}else{setTimeout(function(){d.classList.add('show');},i*step+base);}});
  if(noteText){var nd=document.createElement('div');nd.className='spiral-note';nd.textContent=noteText;el.appendChild(nd);if(rm){nd.classList.add('show');}else{setTimeout(function(){nd.classList.add('show');},lines.length*step+400);}}
  /* make the spiral overlay announce itself and trap Escape to dismiss */
  el.setAttribute('role','dialog');el.setAttribute('aria-live','polite');
  var btn=document.createElement('button');btn.id='sk-spiral-dismiss';btn.textContent=dismissText;btn.onclick=dismissSpiral;el.appendChild(btn);
  setTimeout(function(){try{btn.focus();}catch(e){}},rm?0:Math.min(lines.length*step+500,1500));
}
function dismissSpiral(){document.getElementById('sk-spiral').className='';renderSceneNoDelta(SAKARI.S.scene);}

/* ── DAY TRANSITION ────────────────────────────────── */
function startNextDay(){
  var id=SAKARI.activeId;var m=SAKARI.stories[id];var S=SAKARI.S;S.dayIndex++;
  var nextDay=m.days[S.dayIndex];if(!nextDay){showEpilogue();return;}
  document.getElementById('sk-game').style.display='none';
  var dt=document.getElementById('sk-day-transition');dt.style.display='flex';
  dt.innerHTML='<div class="day-transition-inner"><div class="day-transition-label">'+ui('endOfDay')+' '+S.dayIndex+'</div><div class="day-transition-next">'+nextDay.label+'</div><button class="start-btn" onclick="loadNextDay()">'+ui('continueBtn')+'</button></div>';
}
function loadNextDay(){
  var id=SAKARI.activeId;var m=SAKARI.stories[id];var lang=SAKARI.lang||'en';
  var day=m.days[SAKARI.S.dayIndex];if(!day)return;
  document.getElementById('sk-day-transition').style.display='none';
  SCENES={};SPIRALS={};
  var files=(day.files||[]).filter(function(f){return!/^glossary/.test(f);});
  var paths=files.map(function(f){return'sakari/'+id+'/'+langVariant(f,lang);});
  loadScriptsSequential(paths,function(){
    Object.assign(m.scenes,SCENES);Object.assign(m.spirals,SPIRALS);
    document.getElementById('sk-game').style.display='block';
    setMenuVisible(true);
    /* prefer an explicit entry point; key order is fragile and can break
       silently when scene files are reordered or merged */
    var entry=day.startScene||Object.keys(SCENES)[0];
    if(!entry){console.error('Sakari: no startScene for day',SAKARI.S.dayIndex);return;}
    renderScene(entry);
  });
}

/* ── EPILOGUE ──────────────────────────────────────── */
function buildReflection(S){
  /* a short, varying close that reflects how THIS run went, so two
     different playthroughs don't land on an identical screen */
  var l=SAKARI.lang||'en';
  var lines=[];
  var R={
    en:{
      heavy:'The day cost a lot. Most of the weight came from how much was happening underneath — the dread, the checking, the going-over.',
      light:'The day was lighter than some. That happens too, and it counts.',
      lockedMany:'A lot of doors were closed before you reached them. That is what the disorder does — it decides in advance.',
      lockedFew:'Fewer doors were closed today than on the hard days. Some mornings the brain leaves more on the table.',
      drained:'You ended on almost nothing left. Getting through on that little is its own kind of work.',
      held:'You ended with something still in reserve. Not every day empties you all the way.',
      moment:'The one that stayed with you: '
    },
    de:{
      heavy:'Der Tag hat viel gekostet. Das meiste Gewicht kam von dem, was darunter lag — die Angst, das Pr\xfcfen, das Durchgehen.',
      light:'Der Tag war leichter als manche. Auch das passiert, und es z\xe4hlt.',
      lockedMany:'Viele T\xfcren waren geschlossen, bevor du sie erreicht hast. Das macht die St\xf6rung — sie entscheidet im Voraus.',
      lockedFew:'Heute waren weniger T\xfcren geschlossen als an den schweren Tagen.',
      drained:'Du bist mit fast nichts mehr \xfcbrig angekommen. Damit durchzukommen ist eine eigene Art von Arbeit.',
      held:'Du hattest am Ende noch etwas in Reserve. Nicht jeder Tag leert dich ganz.',
      moment:'Der Moment, der geblieben ist: '
    },
    pt:{
      heavy:'O dia custou muito. O peso veio do que acontecia por baixo — o medo, a verifica\xe7\xe3o, o repassar.',
      light:'O dia foi mais leve que alguns. Isso tamb\xe9m acontece, e conta.',
      lockedMany:'Muitas portas se fecharam antes de voc\xea chegar at\xe9 elas. \xc9 o que o transtorno faz — decide com anteced\xeancia.',
      lockedFew:'Hoje menos portas se fecharam do que nos dias dif\xedceis.',
      drained:'Voc\xea terminou com quase nada. Atravessar com t\xe3o pouco \xe9 um tipo de trabalho.',
      held:'Voc\xea terminou com algo ainda em reserva. Nem todo dia te esvazia por completo.',
      moment:'O momento que ficou: '
    }
  };
  var t=R[l]||R.en;
  var pct=Math.round((S.lockedCount/Math.max(S.choiceCount,1))*100);
  lines.push(S.dep>=60?t.heavy:t.light);
  lines.push(pct>=40?t.lockedMany:t.lockedFew);
  lines.push(S.nrg<25?t.drained:t.held);
  var html='<p>'+lines.join(' ')+'</p>';
  if(S._lockedAt&&S._lockedAt.length){
    var pick=S._lockedAt[Math.floor(S._lockedAt.length/2)];
    if(pick&&pick.text){html+='<p class="thought">'+t.moment+'\u201c'+pick.text+'\u201d</p>';}
  }
  return html;
}
function showEpilogue(){
  document.getElementById('sk-choices-wrap').style.display='none';
  document.getElementById('sk-prose-wrap').style.display='none';
  document.getElementById('sk-scene-label').textContent='';
  var el=document.getElementById('sk-epilogue');el.style.display='block';
  setMenuVisible(false);
  var S=SAKARI.S;var m=SAKARI.stories[SAKARI.activeId];
  if(SAKARI.activeId)skClearProgress(SAKARI.activeId);
  var pct=Math.round((S.lockedCount/Math.max(S.choiceCount,1))*100);
  var blocksHtml=(m.epilogue||[]).map(function(b){return b.type==='thought'?'<p class="thought">'+b.text+'</p>':'<p>'+b.text+'</p>';}).join('');
  el.innerHTML=
    '<h2>'+ui('epilogueTitle')+'</h2>'+
    '<div class="epi-block">'+blocksHtml+'</div>'+
    '<div class="epi-reflect"><strong style="display:block;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin-bottom:8px;font-weight:400">'+ui('reflectHeader')+'</strong>'+buildReflection(S)+'</div>'+
    '<div class="epi-stats">'+
      '<div class="epi-stat"><div class="n">'+S.lockedCount+'</div><div class="l">'+ui('lockedLabel')+'</div></div>'+
      '<div class="epi-stat"><div class="n">'+pct+'%</div><div class="l">'+ui('lockedPct')+'</div></div>'+
      '<div class="epi-stat"><div class="n">'+S.nrg+'</div><div class="l">'+ui('nrgRemaining')+'</div></div>'+
    '</div>'+
    '<div class="epi-resources"><strong style="display:block;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin-bottom:8px;font-weight:400">'+ui('supportHeader')+'</strong>'+ui('supportBody')+'</div>'+
    '<button class="epi-restart-btn" onclick="restartStory()">'+ui('playAgain')+'</button>';
  skScroll();
}
function restartStory(){var id=SAKARI.activeId;SAKARI.active=null;document.getElementById('sk-epilogue').style.display='none';document.getElementById('sk-prose-wrap').style.display='block';showSplash(id);}

/* ── TOOLTIPS ──────────────────────────────────────── */
var SK_TERMS_GLOBALBOUND=false;
function skGlossaryFor(){return SAKARI.active&&SAKARI.active.glossary?SAKARI.active.glossary:GLOSSARY;}
function skShowTip(el,e){
  var tip=document.getElementById('sk-tooltip');var g=skGlossaryFor()[el.dataset.key];if(!g)return;
  tip.innerHTML='<strong>'+g.title+'</strong>'+g.body;tip.classList.add('show');
  tip.setAttribute('role','tooltip');
  positionTip(e,el);
  el.setAttribute('aria-expanded','true');
}
function skHideTip(){var tip=document.getElementById('sk-tooltip');if(tip)tip.classList.remove('show');document.querySelectorAll('.term[aria-expanded="true"]').forEach(function(t){t.setAttribute('aria-expanded','false');});}
function setupTerms(){
  document.querySelectorAll('.term').forEach(function(el){
    if(el._skBound)return;el._skBound=true;
    /* make each term reachable and operable by keyboard + screen reader */
    if(!el.hasAttribute('tabindex'))el.setAttribute('tabindex','0');
    el.setAttribute('role','button');
    el.setAttribute('aria-expanded','false');
    var g=skGlossaryFor()[el.dataset.key];
    if(g)el.setAttribute('aria-label',(g.title||el.textContent)+' \u2014 '+(el.textContent||''));
    el.addEventListener('mouseenter',function(e){skShowTip(el,e);});
    el.addEventListener('mousemove',function(e){positionTip(e,el);});
    el.addEventListener('mouseleave',skHideTip);
    el.addEventListener('focus',function(e){skShowTip(el,{type:'click'});});
    el.addEventListener('blur',skHideTip);
    el.addEventListener('click',function(e){skShowTip(el,e);e.stopPropagation();});
    el.addEventListener('keydown',function(e){
      if(e.key==='Enter'||e.key===' '){e.preventDefault();skShowTip(el,{type:'click'});e.stopPropagation();}
      else if(e.key==='Escape'){skHideTip();el.blur();}
    });
  });
  if(!SK_TERMS_GLOBALBOUND){
    SK_TERMS_GLOBALBOUND=true;
    document.addEventListener('click',skHideTip);
    document.addEventListener('keydown',function(e){if(e.key==='Escape')skHideTip();});
  }
}
function positionTip(e,targetEl){
  var tip=document.getElementById('sk-tooltip');var vw=window.innerWidth,vh=window.innerHeight;
  var TW=Math.min(300,vw-32);var tipH=tip.scrollHeight||180;var x,y;
  if(vw<640||(e&&e.type==='click')){var rect=(targetEl||e.target).getBoundingClientRect();x=Math.max(16,Math.min(vw-TW-16,rect.left+rect.width/2-TW/2));y=rect.bottom+10;if(y+tipH>vh-8)y=Math.max(8,rect.top-tipH-10);}
  else{x=e.clientX+14;y=e.clientY+14;if(x+TW>vw)x=e.clientX-TW-8;if(y+tipH>vh)y=e.clientY-tipH-8;if(x<8)x=8;}
  tip.style.maxWidth=TW+'px';tip.style.left=x+'px';tip.style.top=y+'px';
}

/* ── BOOT ──────────────────────────────────────────── */
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',initEngine);}else{initEngine();}
window.addEventListener('popstate',function(e){if(e.state&&e.state.story){openStory(e.state.story);}else{showHub();}});