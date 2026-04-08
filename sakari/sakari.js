/* ══════════════════════════════════════════════════════
   Sakari — engine.js

   Rendering, state management, all UI interactions.

   ── WHAT LIVES HERE ─────────────────────────────────
   - Game state (S)
   - Theme switching
   - Scene rendering (prose, choices, messages)
   - Spiral overlay
   - Epilogue
   - Tooltip positioning
   - Status bar

   ── WHAT LIVES ELSEWHERE ────────────────────────────
   - Story content  → sakari/somewhere-between/day1.js (day2.js etc)
   - Term tooltips  → sakari/somewhere-between/glossary.js
   - HTML/CSS       → somewhere-between.html

   Only edit this file if you're changing how the game
   works mechanically, not what it says.
   ══════════════════════════════════════════════════════ */

var S={dep:55,anx:70,nrg:80,scene:'morning_1',lockedCount:0,choiceCount:0};

function setTheme(name,swatchId){
  document.documentElement.setAttribute('data-theme',name==='midnight'?'':name);
  document.querySelectorAll('.t-swatch,.st-swatch').forEach(function(el){el.classList.remove('active')});
  ['sw-'+name,'st-'+name].forEach(function(id){var el=document.getElementById(id);if(el)el.classList.add('active')});
}

/* ── STATUS ────────────────────────────────────────────── */
function depLabel(v){if(v<25)return'low';if(v<45)return'mild';if(v<65)return'moderate';if(v<80)return'high';return'severe'}
function anxLabel(v){if(v<25)return'low';if(v<45)return'moderate';if(v<70)return'high';return'acute'}
function updateStatus(){
  document.getElementById('dep-fill').style.width=S.dep+'%';
  document.getElementById('anx-fill').style.width=S.anx+'%';
  document.getElementById('nrg-fill').style.width=S.nrg+'%';
  document.getElementById('dep-val').textContent=depLabel(S.dep);
  document.getElementById('anx-val').textContent=anxLabel(S.anx);
  document.getElementById('nrg-val').textContent=S.nrg;
}

/* ── GAME ──────────────────────────────────────────────── */
function startGame(){
  S={dep:55,anx:70,nrg:80,scene:'morning_1',lockedCount:0,choiceCount:0};
  document.getElementById('splash').style.display='none';
  document.getElementById('game').style.display='block';
  document.getElementById('epilogue').style.display='none';
  document.getElementById('prose-wrap').style.display='block';
  updateStatus();
  renderScene('morning_1');
}

function restart(){
  document.getElementById('epilogue').style.display='none';
  document.getElementById('prose-wrap').style.display='block';
  document.getElementById('choices-wrap').style.display='none';
  startGame();
}

function renderScene(id){
  if(id==='__epilogue__'){showEpilogue();return}
  var sc=SCENES[id];if(!sc)return;
  S.scene=id;
  if(sc.dep)S.dep=Math.max(0,Math.min(100,S.dep+sc.dep));
  if(sc.anx)S.anx=Math.max(0,Math.min(100,S.anx+sc.anx));
  if(sc.nrg)S.nrg=Math.max(0,Math.min(100,S.nrg+sc.nrg));
  updateStatus();
  document.getElementById('scene-label').textContent=sc.label||'';

  var proseEl=document.getElementById('prose');
  proseEl.innerHTML='';

  // energy warning if low
  if(S.nrg<30){
    var ew=document.createElement('div');
    ew.className='energy-warning';
    ew.textContent='your energy is very low. some options are unavailable.';
    proseEl.appendChild(ew);
  }

  sc.prose.forEach(function(p){
    if(p.type==='thought'){
      var d=document.createElement('div');d.className='thought';d.textContent=p.text;proseEl.appendChild(d);
    } else if(p.type==='msg'){
      var d=document.createElement('div');
      d.className='msg-block'+(p.cold?' cold':'');
      d.innerHTML='<div class="msg-name">'+(p.name||'')+'</div>'+p.text;
      proseEl.appendChild(d);
    } else if(p.type==='wanted'){
      var d=document.createElement('div');d.className='wanted-block';
      d.innerHTML=(p.wanted?'<div class="wb-label">what you wanted to say</div><div class="wb-text">'+p.wanted+'</div>':'')
        +(p.sent?'<div class="wb-label sent">what you sent</div><div class="wb-text sent">'+p.sent+'</div>':'');
      proseEl.appendChild(d);
    } else {
      var d=document.createElement('div');d.innerHTML='<p>'+p.text+'</p>';proseEl.appendChild(d);
    }
  });

  document.getElementById('spiral').className='';
  document.getElementById('spiral').innerHTML='';
  var cWrap=document.getElementById('choices-wrap');
  var cEl=document.getElementById('choices');
  cEl.innerHTML='';cWrap.style.display='block';

  sc.choices.forEach(function(c){
    var isEGate=c.egGate&&S.nrg<c.egGate;
    var isLocked=c.locked||isEGate;
    if(isLocked)S.lockedCount++;
    S.choiceCount++;
    var item=document.createElement('div');item.className='choice-item';
    if(isLocked){
      var html='<span class="choice-link locked"><span class="ct">'+c.text+'</span>';
      if(c.note)html+='<span class="choice-note">'+c.note+'</span>';
      html+='</span>';
      var reason=isEGate?"you don't have the energy for this right now.":(c.reason||'');
      if(reason)html+='<span class="choice-reason">'+reason+'</span>';
      item.innerHTML=html;
    } else {
      var html2='<button class="choice-link"><span class="ct">'+c.text+'</span>';
      if(c.note)html2+='<span class="choice-note">'+c.note+'</span>';
      html2+='</button>';
      item.innerHTML=html2;
      (function(choice,it){it.querySelector('button').addEventListener('click',function(){pick(choice,it)})})(c,item);
    }
    cEl.appendChild(item);
  });

  window.scrollTo({top:0,behavior:'smooth'});
  setupTerms();
}

function pick(c,itemEl){
  if(c.spiral){triggerSpiral(c.spiral);return}

  // wanted/sent reveal — show the gap before moving on
  if(c.wanted){
    // disable all choices
    document.querySelectorAll('.choice-item').forEach(function(it){
      if(it===itemEl){it.classList.add('chosen')}
      else{it.classList.add('dimmed')}
    });
    // replace button with the reveal block
    var btn=itemEl.querySelector('button');
    if(btn)btn.style.display='none';
    var rev=document.createElement('div');
    rev.className='wanted-block inline-reveal';
    rev.innerHTML='<div class="wb-label">what you wanted to say</div>'
      +'<div class="wb-text">'+c.wanted+'</div>'
      +'<div class="wb-label sent">what you sent</div>'
      +'<div class="wb-text sent">'+c.text+'</div>';
    itemEl.appendChild(rev);
    setTimeout(function(){rev.classList.add('show')},40);
    setTimeout(function(){
      if(c.nrg)S.nrg=Math.max(0,Math.min(100,S.nrg+c.nrg));
      if(c.dep)S.dep=Math.max(0,Math.min(100,S.dep+c.dep));
      if(c.anx)S.anx=Math.max(0,Math.min(100,S.anx+c.anx));
      updateStatus();
      var prose=document.getElementById('prose');
      prose.style.opacity='0';
      document.getElementById('choices-wrap').style.display='none';
      setTimeout(function(){prose.style.opacity='1';renderScene(c.next)},350);
    },2000);
    return;
  }

  if(c.nrg)S.nrg=Math.max(0,Math.min(100,S.nrg+c.nrg));
  if(c.dep)S.dep=Math.max(0,Math.min(100,S.dep+c.dep));
  if(c.anx)S.anx=Math.max(0,Math.min(100,S.anx+c.anx));
  updateStatus();
  var prose=document.getElementById('prose');
  prose.style.opacity='0';
  document.getElementById('choices-wrap').style.display='none';
  setTimeout(function(){prose.style.opacity='1';renderScene(c.next)},350);
}

function triggerSpiral(key){
  document.getElementById('choices-wrap').style.display='none';
  var el=document.getElementById('spiral');
  el.innerHTML='';el.className='on';
  var sp=SPIRALS[key]||{lines:[],dismiss:'breathe. come back.'};
  var lines=Array.isArray(sp)?sp:(sp.lines||[]);
  var dismissText=Array.isArray(sp)?'breathe. come back.':(sp.dismiss||'breathe. come back.');
  var noteText=Array.isArray(sp)?'':(sp.note||'');
  lines.forEach(function(t,i){
    var d=document.createElement('div');d.className='spiral-line';d.textContent=t;
    el.appendChild(d);
    setTimeout(function(){d.classList.add('show')},i*600+200);
  });
  if(noteText){
    var totalDelay=lines.length*600+400;
    var nd=document.createElement('div');
    nd.className='spiral-note';nd.textContent=noteText;
    el.appendChild(nd);
    setTimeout(function(){nd.classList.add('show')},totalDelay);
  }
  var btn=document.createElement('button');
  btn.id='spiral-dismiss';btn.textContent=dismissText;
  btn.onclick=dismissSpiral;el.appendChild(btn);
}

function dismissSpiral(){
  document.getElementById('spiral').className='';
  renderScene(S.scene);
}

/* ── EPILOGUE ────────────────────────────────────────── */
function showEpilogue(){
  document.getElementById('choices-wrap').style.display='none';
  document.getElementById('prose-wrap').style.display='none';
  document.getElementById('scene-label').textContent='';
  var el=document.getElementById('epilogue');
  el.style.display='block';

  var pct=Math.round((S.lockedCount/Math.max(S.choiceCount,1))*100);
  var endedWell=S.dep<60;

  el.innerHTML='<h2>that\'s all for now.</h2>'
  +'<div class="epi-block">'
  +'<p>This is one day. Not the worst one, not the best one. A day that cost a specific amount and ended with you in your bed, which is where most days end, which is something.</p>'
  +'<p class="thought">you survived it. you do, most days. it just costs more than people know.</p>'
  +'<p>BPD, dependent personality disorder, anxiety, and depression don\'t look like what people expect them to look like. They look like being nine minutes late and spending an hour dreading it. They look like twelve minutes in front of a wardrobe. They look like reading the same two words — "or no" — until they mean something they don\'t mean. They look like a person in a meeting, performing the posture of engagement. They look like someone having a perfectly good evening by anyone else\'s measure, and still going over it three times on the way home.</p>'
  +'</div>'
  +'<div class="epi-stats">'
  +'<div class="epi-stat"><div class="n">'+S.lockedCount+'</div><div class="l">choices unavailable</div></div>'
  +'<div class="epi-stat"><div class="n">'+pct+'%</div><div class="l">options locked</div></div>'
  +'<div class="epi-stat"><div class="n">'+S.nrg+'</div><div class="l">energy remaining</div></div>'
  +'</div>'
  +'<div class="epi-block">'
  +'<p>If you have these disorders, or think you might: you are not too much. You are not broken. The things that are hard for you are genuinely hard — not because you\'re weak, but because you\'re doing significantly more cognitive and emotional work than most people do just to get through a morning. That\'s not a metaphor. That\'s physiology.</p>'
  +'<p>If someone you know might have these disorders: the locked choices are the whole point. Those weren\'t options they chose not to take. Those were options their brain made genuinely unavailable. The checking, the reassurance-seeking, the inability to pick a top — none of it is manipulative, none of it is attention-seeking. It\'s a person doing the best they can with a brain that is working very hard against them.</p>'
  +'<p class="thought">thank you for spending a day here.</p>'
  +'</div>'
  +'<div class="epi-resources">'
  +'<strong style="display:block;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:var(--accent);margin-bottom:8px;font-weight:400">if you need support</strong>'
  +'988 Suicide & Crisis Lifeline: call or text <a href="tel:988">988</a> (US) &nbsp;·&nbsp; '
  +'International resources: <a href="https://findahelpline.com" target="_blank">findahelpline.com</a><br>'
  +'BPD information: <a href="https://www.nami.org/About-Mental-Illness/Mental-Health-Conditions/Borderline-Personality-Disorder" target="_blank">NAMI</a> &nbsp;·&nbsp; '
  +'DBT skills (often used for BPD): <a href="https://dialecticalbehaviortherapy.com" target="_blank">dialecticalbehaviortherapy.com</a>'
  +'</div>'
  +'<button id="restart-btn" onclick="restart()">play again</button>';

  window.scrollTo({top:0,behavior:'smooth'});
}

function setupTerms(){
  var tip=document.getElementById('tooltip');
  document.querySelectorAll('.term').forEach(function(el){
    el.addEventListener('mouseenter',function(e){
      var g=GLOSSARY[el.dataset.key];if(!g)return;
      tip.innerHTML='<strong>'+g.title+'</strong>'+g.body;
      tip.classList.add('show');positionTip(e,el);
    });
    el.addEventListener('mousemove',function(e){positionTip(e,el)});
    el.addEventListener('mouseleave',function(){tip.classList.remove('show')});
    el.addEventListener('click',function(e){
      var g=GLOSSARY[el.dataset.key];if(!g)return;
      tip.innerHTML='<strong>'+g.title+'</strong>'+g.body;
      tip.classList.add('show');positionTip(e,el);e.stopPropagation();
    });
  });
  document.addEventListener('click',function(){tip.classList.remove('show')});
}

function positionTip(e,targetEl){
  var tip=document.getElementById('tooltip');
  var vw=window.innerWidth;
  var vh=window.innerHeight;
  var TW=Math.min(300,vw-32);
  var tipH=tip.scrollHeight||180;
  var x,y;
  // on mobile or tap events: anchor to element rect, not cursor
  if(vw<640||(e&&e.type==='click')){
    var rect=(targetEl||e.target).getBoundingClientRect();
    x=Math.max(16,Math.min(vw-TW-16,rect.left+rect.width/2-TW/2));
    y=rect.bottom+10;
    if(y+tipH>vh-8)y=Math.max(8,rect.top-tipH-10);
  } else {
    x=e.clientX+14;y=e.clientY+14;
    if(x+TW>vw)x=e.clientX-TW-8;
    if(y+tipH>vh)y=e.clientY-tipH-8;
    if(x<8)x=8;
  }
  tip.style.maxWidth=TW+'px';
  tip.style.left=x+'px';
  tip.style.top=y+'px';
}
