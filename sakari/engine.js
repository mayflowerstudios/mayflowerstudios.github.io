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
  },
  de: {
    begin:'ich verstehe \u2014 beginnen',cwSuffix:'Unterstrichene Begriffe k\xf6nnen f\xfcr Definitionen angeklickt werden. Kein Ersatz f\xfcr professionelle Unterst\xfctzung.',crisis:'In einer Krise: <strong>Telefonseelsorge</strong> \u2014 kostenlos, 24/7: <a href="tel:08001110111">0800 111 0 111</a>. International: <a href="https://findahelpline.com" target="_blank">findahelpline.com</a>.',theme:'design',langLabel:'sprache',cwHeader:'\u26a0 inhaltswarnungen auf dem n\xe4chsten bildschirm',energyLow:'deine energie ist sehr niedrig. einige optionen sind nicht verf\xfcgbar.',wantedLabel:'was du sagen wolltest',sentLabel:'was du geschickt hast',depLevels:['niedrig','leicht','mittel','hoch','schwer'],anxLevels:['niedrig','mittel','hoch','akut'],depTitle:'depression',anxTitle:'angst',nrgTitle:'energie',lockedLabel:'nicht verf\xfcgbare entscheidungen',lockedPct:'gesperrte optionen',nrgRemaining:'verbleibende energie',epilogueTitle:'das war es f\xfcrs erste.',playAgain:'nochmal spielen',supportHeader:'wenn du hilfe brauchst',supportBody:'Telefonseelsorge: <a href="tel:08001110111">0800 111 0 111</a> (kostenlos, 24/7) &nbsp;\xb7&nbsp; International: <a href="https://findahelpline.com" target="_blank">findahelpline.com</a><br>BPS-Informationen: <a href="https://www.bpe-online.de" target="_blank">bpe-online.de</a> &nbsp;\xb7&nbsp; DBT: <a href="https://dialecticalbehaviortherapy.com" target="_blank">dialecticalbehaviortherapy.com</a>',continueBtn:'weiter \u2192',endOfDay:'ende von tag',defaultDismiss:'atmen. zur\xfcckkommen.',
  },
  pt: {
    begin:'entendo \u2014 come\xe7ar',cwSuffix:'Termos sublinhados podem ser clicados para defini\xe7\xf5es. N\xe3o substitui apoio profissional.',crisis:'Em crise: <strong>CVV</strong> \u2014 ligue <a href="tel:188">188</a> (Brasil, gratuito, 24h) ou acesse <a href="https://cvv.org.br" target="_blank">cvv.org.br</a>. Internacional: <a href="https://findahelpline.com" target="_blank">findahelpline.com</a>.',theme:'tema',langLabel:'idioma',cwHeader:'\u26a0 avisos de conte\xfado na pr\xf3xima tela',energyLow:'sua energia est\xe1 muito baixa. algumas op\xe7\xf5es est\xe3o indispon\xedveis.',wantedLabel:'o que voc\xea queria dizer',sentLabel:'o que voc\xea enviou',depLevels:['baixa','leve','moderada','alta','severa'],anxLevels:['baixa','moderada','alta','aguda'],depTitle:'depress\xe3o',anxTitle:'ansiedade',nrgTitle:'energia',lockedLabel:'escolhas indispon\xedveis',lockedPct:'op\xe7\xf5es bloqueadas',nrgRemaining:'energia restante',epilogueTitle:'\xe9 tudo por agora.',playAgain:'jogar novamente',supportHeader:'se voc\xea precisar de apoio',supportBody:'CVV: ligue <a href="tel:188">188</a> (Brasil, gratuito, 24h) ou <a href="https://cvv.org.br" target="_blank">cvv.org.br</a> &nbsp;\xb7&nbsp; Internacional: <a href="https://findahelpline.com" target="_blank">findahelpline.com</a><br>Informa\xe7\xf5es sobre TPB: <a href="https://www.abp.org.br" target="_blank">ABP</a> &nbsp;\xb7&nbsp; DBT: <a href="https://dialecticalbehaviortherapy.com" target="_blank">dialecticalbehaviortherapy.com</a>',continueBtn:'continuar \u2192',endOfDay:'fim do dia',defaultDismiss:'respire. volte.',
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

/* ── STATUS ────────────────────────────────────────── */
function depLabel(v){var ls=ui('depLevels');return v<25?ls[0]:v<45?ls[1]:v<65?ls[2]:v<80?ls[3]:ls[4];}
function anxLabel(v){var ls=ui('anxLevels');return v<25?ls[0]:v<45?ls[1]:v<70?ls[2]:ls[3];}
function updateStatus(){var s=SAKARI.S;var df=document.getElementById('sk-dep-fill');if(df)df.style.width=s.dep+'%';var af=document.getElementById('sk-anx-fill');if(af)af.style.width=s.anx+'%';var nf=document.getElementById('sk-nrg-fill');if(nf)nf.style.width=s.nrg+'%';var dv=document.getElementById('sk-dep-val');if(dv)dv.textContent=depLabel(s.dep);var av=document.getElementById('sk-anx-val');if(av)av.textContent=anxLabel(s.anx);var nv=document.getElementById('sk-nrg-val');if(nv)nv.textContent=s.nrg;}

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
  var toLoad=SAKARI_STORY_IDS.length;
  if(toLoad===0){renderHub();return;}
  SAKARI_STORY_IDS.forEach(function(id){
    loadScript('sakari/'+id+'/meta.js',function(){
      toLoad--;
      if(toLoad===0){renderHub();handleDeepLink();}
    });
  });
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
    card.innerHTML='<div class="story-card-inner"><div class="story-card-top"><span class="story-card-title">'+m.title+'</span><div class="story-card-tags">'+tags+'</div></div><p class="story-card-desc">'+m.desc+'</p>'+(m.note?'<p class="story-card-note">'+m.note+'</p>':'')+'<div class="story-card-footer"><span class="story-cw">\u26a0 content warnings on the next screen</span><span class="story-enter">read \u2192</span></div></div>';
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
    '<button class="start-btn" onclick="startStory()">'+ui('begin')+'</button>';
  splash.style.display='flex';
}

function buildSwatches(){
  var themes=[{name:'midnight',bg:'#2a1e18',label:'Midnight'},{name:'parchment',bg:'#d0c8b0',label:'Parchment'},{name:'violet',bg:'#3a2868',label:'Violet'},{name:'rose',bg:'#6a2040',label:'Rose'},{name:'paper',bg:'#7a6030',label:'Candlelight'}];
  return themes.map(function(t){return'<div class="sk-swatch t-swatch" data-theme="'+t.name+'" style="background:'+t.bg+'" title="'+t.label+'" onclick="skSetTheme(\''+t.name+'\')"></div>';}).join('');
}

/* ── SHOW/HIDE VIEWS ───────────────────────────────── */
function showPlayerView(){document.getElementById('sk-hub').style.display='none';document.getElementById('sk-player').style.display='block';}
function showHub(){document.getElementById('sk-player').style.display='none';document.getElementById('sk-hub').style.display='block';history.pushState({},'',window.location.pathname);SAKARI.activeId=null;SAKARI.active=null;SAKARI.S={};['sk-splash','sk-game','sk-day-transition','sk-epilogue','sk-loading'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='none';});}

/* ── START STORY ───────────────────────────────────── */
function startStory(){
  var id=SAKARI.activeId;var m=SAKARI.stories[id];if(!m)return;
  SAKARI.S={dep:m.initialDep||55,anx:m.initialAnx||70,nrg:m.initialNrg||80,dayIndex:0,scene:null,lockedCount:0,choiceCount:0};
  document.getElementById('sk-splash').style.display='none';
  document.getElementById('sk-game').style.display='block';
  updateStatus();
  SAKARI.active=m;
  var firstScene=m.startScene||(m.scenes?Object.keys(m.scenes)[0]:null);
  if(!firstScene){console.error('Sakari: no startScene found for '+id);return;}
  renderScene(firstScene);
}

/* ── SCENE RENDERING ───────────────────────────────── */
function renderScene(id){
  if(id==='__epilogue__'){showEpilogue();return;}
  if(id==='__next_day__'){startNextDay();return;}
  var sc=SAKARI.active&&SAKARI.active.scenes?SAKARI.active.scenes[id]:SCENES[id];
  if(!sc){console.error('Sakari: scene not found:',id);return;}
  var S=SAKARI.S;S.scene=id;
  if(sc.dep)S.dep=Math.max(0,Math.min(100,S.dep+sc.dep));
  if(sc.anx)S.anx=Math.max(0,Math.min(100,S.anx+sc.anx));
  if(sc.nrg)S.nrg=Math.max(0,Math.min(100,S.nrg+sc.nrg));
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
  (sc.choices||[]).forEach(function(c){
    var isEGate=c.egGate&&S.nrg<c.egGate;var isLocked=c.locked||isEGate;
    if(isLocked)S.lockedCount++;S.choiceCount++;
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
  window.scrollTo({top:0,behavior:'smooth'});setupTerms();
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
    setTimeout(function(){rev.classList.add('show');},40);
    setTimeout(function(){applyDeltas(c);transitionTo(c.next);},2200);
    return;
  }
  applyDeltas(c);transitionTo(c.next);
}
function applyDeltas(c){var S=SAKARI.S;if(c.nrg)S.nrg=Math.max(0,Math.min(100,S.nrg+c.nrg));if(c.dep)S.dep=Math.max(0,Math.min(100,S.dep+c.dep));if(c.anx)S.anx=Math.max(0,Math.min(100,S.anx+c.anx));updateStatus();}
function transitionTo(next){var prose=document.getElementById('sk-prose');prose.style.opacity='0';document.getElementById('sk-choices-wrap').style.display='none';setTimeout(function(){prose.style.opacity='1';renderScene(next);},350);}

/* ── SPIRAL ────────────────────────────────────────── */
function triggerSpiral(key){
  document.getElementById('sk-choices-wrap').style.display='none';
  var el=document.getElementById('sk-spiral');el.innerHTML='';el.className='on';
  var _sp=SAKARI.active&&SAKARI.active.spirals?SAKARI.active.spirals:SPIRALS;
  var sp=_sp[key]||{lines:[],dismiss:ui('defaultDismiss')};
  var lines=Array.isArray(sp)?sp:(sp.lines||[]);
  var dismissText=Array.isArray(sp)?ui('defaultDismiss'):(sp.dismiss||ui('defaultDismiss'));
  var noteText=Array.isArray(sp)?'':(sp.note||'');
  lines.forEach(function(t,i){var d=document.createElement('div');d.className='spiral-line';d.textContent=t;el.appendChild(d);setTimeout(function(){d.classList.add('show');},i*600+200);});
  if(noteText){var nd=document.createElement('div');nd.className='spiral-note';nd.textContent=noteText;el.appendChild(nd);setTimeout(function(){nd.classList.add('show');},lines.length*600+400);}
  var btn=document.createElement('button');btn.id='sk-spiral-dismiss';btn.textContent=dismissText;btn.onclick=dismissSpiral;el.appendChild(btn);
}
function dismissSpiral(){document.getElementById('sk-spiral').className='';renderScene(SAKARI.S.scene);}

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
    renderScene(Object.keys(SCENES)[0]);
  });
}

/* ── EPILOGUE ──────────────────────────────────────── */
function showEpilogue(){
  document.getElementById('sk-choices-wrap').style.display='none';
  document.getElementById('sk-prose-wrap').style.display='none';
  document.getElementById('sk-scene-label').textContent='';
  var el=document.getElementById('sk-epilogue');el.style.display='block';
  var S=SAKARI.S;var m=SAKARI.stories[SAKARI.activeId];
  var pct=Math.round((S.lockedCount/Math.max(S.choiceCount,1))*100);
  var blocksHtml=(m.epilogue||[]).map(function(b){return b.type==='thought'?'<p class="thought">'+b.text+'</p>':'<p>'+b.text+'</p>';}).join('');
  el.innerHTML=
    '<h2>'+ui('epilogueTitle')+'</h2>'+
    '<div class="epi-block">'+blocksHtml+'</div>'+
    '<div class="epi-stats">'+
      '<div class="epi-stat"><div class="n">'+S.lockedCount+'</div><div class="l">'+ui('lockedLabel')+'</div></div>'+
      '<div class="epi-stat"><div class="n">'+pct+'%</div><div class="l">'+ui('lockedPct')+'</div></div>'+
      '<div class="epi-stat"><div class="n">'+S.nrg+'</div><div class="l">'+ui('nrgRemaining')+'</div></div>'+
    '</div>'+
    '<div class="epi-resources"><strong style="display:block;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin-bottom:8px;font-weight:400">'+ui('supportHeader')+'</strong>'+ui('supportBody')+'</div>'+
    '<button class="epi-restart-btn" onclick="restartStory()">'+ui('playAgain')+'</button>';
  window.scrollTo({top:0,behavior:'smooth'});
}
function restartStory(){var id=SAKARI.activeId;SAKARI.active=null;document.getElementById('sk-epilogue').style.display='none';document.getElementById('sk-prose-wrap').style.display='block';showSplash(id);}

/* ── TOOLTIPS ──────────────────────────────────────── */
function setupTerms(){
  var tip=document.getElementById('sk-tooltip');
  document.querySelectorAll('.term').forEach(function(el){
    el.addEventListener('mouseenter',function(e){var _gl=SAKARI.active&&SAKARI.active.glossary?SAKARI.active.glossary:GLOSSARY;var g=_gl[el.dataset.key];if(!g)return;tip.innerHTML='<strong>'+g.title+'</strong>'+g.body;tip.classList.add('show');positionTip(e,el);});
    el.addEventListener('mousemove',function(e){positionTip(e,el);});
    el.addEventListener('mouseleave',function(){tip.classList.remove('show');});
    el.addEventListener('click',function(e){var _gl2=SAKARI.active&&SAKARI.active.glossary?SAKARI.active.glossary:GLOSSARY;var g=_gl2[el.dataset.key];if(!g)return;tip.innerHTML='<strong>'+g.title+'</strong>'+g.body;tip.classList.add('show');positionTip(e,el);e.stopPropagation();});
  });
  document.addEventListener('click',function(){tip.classList.remove('show');});
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
