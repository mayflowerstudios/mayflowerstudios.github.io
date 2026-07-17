import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, set, get, update, remove, push, onDisconnect, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDVJ0Tiq0gimaB-epcD9HQlVBrOWHq-IXI",
  authDomain: "watchtogether-95d7d.firebaseapp.com",
  databaseURL: "https://watchtogether-95d7d-default-rtdb.firebaseio.com",
  projectId: "watchtogether-95d7d",
  storageBucket: "watchtogether-95d7d.firebasestorage.app",
};

const $ = id => document.getElementById(id);
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const cleanRoom = s => (s || "").replace(/[.#$\[\]\/]/g, "").trim().slice(0, 60);
const now = () => Date.now();
let toastTimer;
function toast(message){
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2500);
}

const LESSONS = [
  {
    id:"greetings", emoji:"👋", title:"Hello, My Love", goal:"Greet each other, introduce yourselves, and handle the first little moments of a conversation.",
    tip:"Portuguese greetings change with the time of day: bom dia, boa tarde, and boa noite. In English, “good night” is usually a goodbye before sleep—not a greeting.",
    vocab:[["hello","olá"],["hi","oi"],["good morning","bom dia"],["good afternoon","boa tarde"],["good evening / good night","boa noite"],["please","por favor"],["thank you","obrigada"],["you’re welcome","de nada"]],
    phrases:[["How are you?","Como você está?"],["I’m doing well.","Eu estou bem."],["What is your name?","Qual é o seu nome?"],["My name is…","Meu nome é…"],["It’s nice to meet you.","Prazer em conhecer você."],["Talk to you later.","Falo com você mais tarde."]],
    challenge:"Take turns starting a brand-new conversation. Greet each other, ask how the other person is, and say goodbye entirely in the language you are learning.",
    homework:"Write a six-line first conversation between you two. Include a greeting, names, how you feel, thank you, and a goodbye."
  },
  {
    id:"affection", emoji:"💗", title:"Affection & Pet Names", goal:"Say loving, reassuring things naturally instead of relying on literal translations.",
    tip:"Brazilian Portuguese often uses diminutives to sound affectionate: amor → amorzinho. English uses lots of pet names, but which ones feel natural depends heavily on the couple.",
    vocab:[["love","amor"],["my love","meu amor"],["baby","bebê / amor"],["beautiful","linda"],["cute","fofa"],["kiss","beijo"],["hug","abraço"],["girlfriend","namorada"]],
    phrases:[["I love you.","Eu te amo."],["You are beautiful.","Você é linda."],["Come give me a kiss.","Vem me dar um beijo."],["I wish I could hug you.","Queria poder te abraçar."],["You make me happy.","Você me faz feliz."],["You are my favorite person.","Você é a minha pessoa favorita."]],
    challenge:"Give each other three compliments: one about appearance, one about personality, and one about how the other person makes you feel.",
    homework:"Write a short love note of at least five sentences in your learning language. Use one pet name and two phrases from this lesson."
  },
  {
    id:"checkins", emoji:"☀️", title:"Everyday Check-ins", goal:"Ask about sleep, meals, work, games, and what the other person is doing right now.",
    tip:"Portuguese frequently drops the subject pronoun when it is obvious. English usually needs it: “Estou cansada” becomes “I am tired,” not simply “Am tired.”",
    vocab:[["today","hoje"],["now","agora"],["later","mais tarde"],["busy","ocupada"],["tired","cansada"],["hungry","com fome"],["sleepy","com sono"],["working","trabalhando"]],
    phrases:[["Did you sleep well?","Você dormiu bem?"],["Have you eaten yet?","Você já comeu?"],["What are you doing?","O que você está fazendo?"],["I’m a little busy.","Estou um pouco ocupada."],["I’ll be free later.","Vou estar livre mais tarde."],["Tell me about your day.","Me conta sobre o seu dia."]],
    challenge:"Do a five-minute check-in using only the target language. Ask about sleep, food, mood, and today’s plans.",
    homework:"Keep a tiny diary for one day: morning, afternoon, and night. Write one or two sentences for each part of the day."
  },
  {
    id:"feelings", emoji:"🌧️", title:"Feelings & Comfort", goal:"Explain how you feel and comfort each other when a conversation matters.",
    tip:"“Estou com saudade” has no perfect English twin. “I miss you” is correct, but saudade can carry a deeper feeling of loving absence and longing.",
    vocab:[["happy","feliz"],["sad","triste"],["worried","preocupada"],["calm","calma"],["angry","brava"],["afraid","com medo"],["safe","segura"],["proud","orgulhosa"]],
    phrases:[["I miss you.","Estou com saudade de você."],["I’m here with you.","Estou aqui com você."],["You can talk to me.","Você pode falar comigo."],["Everything will be okay.","Vai ficar tudo bem."],["I understand how you feel.","Eu entendo como você se sente."],["I’m proud of you.","Tenho orgulho de você."]],
    challenge:"Each person names one real feeling from today. The other person responds with comfort, one question, and reassurance in the language they are learning.",
    homework:"Write a comforting reply to this situation: “I had a difficult day and I feel alone.” Use at least four lesson words or phrases."
  },
  {
    id:"food", emoji:"🍓", title:"Food & Little Treats", goal:"Talk about meals, favorites, cooking, ordering, and what you want to share someday.",
    tip:"In Portuguese, hunger and thirst are things you “have”: estou com fome / estou com sede. English uses “I am hungry / thirsty.”",
    vocab:[["breakfast","café da manhã"],["lunch","almoço"],["dinner","jantar"],["water","água"],["coffee","café"],["sweet","doce"],["delicious","delicioso"],["favorite","favorito"]],
    phrases:[["What do you want to eat?","O que você quer comer?"],["This is delicious.","Isso está delicioso."],["I’m hungry.","Estou com fome."],["Do you want some coffee?","Você quer café?"],["What is your favorite food?","Qual é a sua comida favorita?"],["I want to cook for you.","Quero cozinhar para você."]],
    challenge:"Plan an imaginary meal together. Choose a drink, main dish, dessert, and who is cooking what—using the target languages.",
    homework:"Create a bilingual menu for your perfect date-night meal. Include at least six items and one sentence explaining each person’s favorite."
  },
  {
    id:"routines", emoji:"🏡", title:"Home & Routines", goal:"Describe ordinary life: waking up, chores, showers, relaxing, and getting ready for bed.",
    tip:"English phrasal verbs can be tricky: wake up, get up, clean up, lie down. Learn each as one chunk rather than translating every word separately.",
    vocab:[["home","casa"],["bed","cama"],["shower","banho"],["clothes","roupas"],["clean","limpar"],["rest","descansar"],["wake up","acordar"],["go to sleep","dormir"]],
    phrases:[["I just woke up.","Acabei de acordar."],["I’m taking a shower.","Estou tomando banho."],["I need to clean the house.","Preciso limpar a casa."],["Come lie down with me.","Vem deitar comigo."],["I’m getting ready for bed.","Estou me preparando para dormir."],["Sleep well, my love.","Dorme bem, meu amor."]],
    challenge:"Walk each other through your real evening routine from dinner until sleep. Ask at least two follow-up questions.",
    homework:"Write your normal weekday routine in eight short steps. Try to use time words such as first, then, after that, and finally."
  },
  {
    id:"timeplans", emoji:"🗓️", title:"Time, Dates & Plans", goal:"Make plans clearly across time zones without the classic “wait—today for you or me?” problem.",
    tip:"When planning long-distance, always repeat the time zone or both local times. Language confidence is lovely; calendar confidence prevents chaos.",
    vocab:[["yesterday","ontem"],["tomorrow","amanhã"],["morning","manhã"],["afternoon","tarde"],["night","noite"],["week","semana"],["weekend","fim de semana"],["time","horário / tempo"]],
    phrases:[["What time works for you?","Que horário funciona para você?"],["Are you free tomorrow?","Você está livre amanhã?"],["Let’s do it this weekend.","Vamos fazer isso neste fim de semana."],["I’ll call you at eight.","Vou te ligar às oito."],["Is that your time or mine?","Esse horário é o seu ou o meu?"],["I can’t wait.","Mal posso esperar."]],
    challenge:"Plan your next three shared activities. Say the day, both local times, what you will do, and how long it should take.",
    homework:"Write a bilingual schedule for one imaginary weekend together, from Saturday morning to Sunday night."
  },
  {
    id:"games", emoji:"🎮", title:"Games & Hobbies", goal:"Play together with less confusion: directions, reactions, help, and friendly teasing.",
    tip:"Game language is full of shorthand and borrowed English words in Brazil. Ask what people actually say in the game instead of forcing a textbook translation.",
    vocab:[["game","jogo"],["team","equipe / time"],["win","ganhar"],["lose","perder"],["help","ajuda"],["left","esquerda"],["right","direita"],["behind you","atrás de você"]],
    phrases:[["Wait for me!","Espera por mim!"],["I need help.","Preciso de ajuda."],["They’re behind you.","Eles estão atrás de você."],["That was so close!","Foi por pouco!"],["Good game.","Bom jogo."],["Let’s play one more.","Vamos jogar mais uma."]],
    challenge:"Play one round of something together while each person uses only the target language for directions and reactions.",
    homework:"Make a list of ten words or phrases you use in your favorite shared game, with natural translations—not just dictionary translations."
  },
  {
    id:"travel", emoji:"✈️", title:"Distance & Travel", goal:"Talk about visits, airports, directions, packing, and finally being in the same place.",
    tip:"Travel vocabulary rewards full phrases. Memorize “Where is the bathroom?” and “I have a reservation” as complete tools you can pull out under stress.",
    vocab:[["airport","aeroporto"],["flight","voo"],["ticket","passagem"],["passport","passaporte"],["suitcase","mala"],["hotel","hotel"],["reservation","reserva"],["arrive","chegar"]],
    phrases:[["My flight arrives at…","Meu voo chega às…"],["I have a reservation.","Eu tenho uma reserva."],["Where is the bathroom?","Onde fica o banheiro?"],["I can’t wait to see you.","Mal posso esperar para te ver."],["Text me when you arrive.","Me manda mensagem quando você chegar."],["We’re finally together.","Finalmente estamos juntas."]],
    challenge:"Role-play an airport arrival: one person has landed, the other explains where to meet and asks about luggage, food, and the flight.",
    homework:"Write a step-by-step arrival plan for your first or next visit, including the airport, messages, meeting place, and first thing you want to do."
  },
  {
    id:"realconvo", emoji:"🌙", title:"A Real Conversation", goal:"Combine everything into a natural conversation about love, daily life, plans, and what you need from each other.",
    tip:"Fluency is not speaking without mistakes. It is staying connected even while searching for a word, rephrasing, laughing, and trying again.",
    vocab:[["understand","entender"],["explain","explicar"],["repeat","repetir"],["slowly","devagar"],["meaning","significado"],["mistake","erro"],["learn","aprender"],["together","juntas"]],
    phrases:[["Can you say that again?","Você pode repetir?"],["Please speak more slowly.","Por favor, fale mais devagar."],["What does that mean?","O que isso significa?"],["I don’t know the word yet.","Eu ainda não sei essa palavra."],["Let me try again.","Deixa eu tentar de novo."],["We’re learning together.","Estamos aprendendo juntas."]],
    challenge:"Have a ten-minute conversation with no translation app. You may ask for repetition, explanations, or simpler words—but stay in your learning language.",
    homework:"Write a letter about why learning each other’s language matters to you. Then read it aloud to each other."
  }
];

const MAX_HEARTS = 5;
const SESSION_SIZE = 12;
const params = new URLSearchParams(location.search);
const presetRoom = cleanRoom(params.get("room"));
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getDatabase(app);
let ROOM = null;
let roomEntered = false;
let currentLessonIndex = 0;
let progressData = {};
let presenceData = {};
let homeworkData = {};
let phrasebookData = {};
let currentGoal = "pt";
let displayName = localStorage.getItem("lc_name") || "";
let currentTab = "learn";
let connected = false;
let activeSession = null;
let myId = localStorage.getItem("lc_device_id");
if (!myId){ myId = "lc" + Math.random().toString(36).slice(2, 10); localStorage.setItem("lc_device_id", myId); }
const identityKey = () => (window.MFAuth && MFAuth.uid) ? MFAuth.uid : myId;
const rootPath = sub => `together/${ROOM}/language${sub ? "/" + sub : ""}`;
const roomPath = sub => `together/${ROOM}/${sub}`;
const lessonById = id => LESSONS.find(l => l.id === id);
const normalize = value => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const slug = value => normalize(value).replace(/\s+/g, "_").slice(0, 90);
const clamp = (n,min,max) => Math.max(min,Math.min(max,n));
const shuffle = arr => { const copy=[...arr]; for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];} return copy; };
const todayKey = () => new Intl.DateTimeFormat("en-CA", {timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone}).format(new Date());
const yesterdayKey = () => { const d=new Date(); d.setDate(d.getDate()-1); return new Intl.DateTimeFormat("en-CA", {timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone}).format(d); };
const mine = () => progressData[identityKey()] || {};
const lessonProgress = id => { const raw=(mine().lessons || {})[id]; return raw===true ? {completed:true,stars:1,bestScore:100,legacy:true} : (raw||{}); };
const hearts = () => Number.isFinite(Number(mine().hearts)) ? Number(mine().hearts) : MAX_HEARTS;

function waitForRooms(tries = 0){
  if (window.MFRooms && MFRooms.whenReady){ MFRooms.whenReady(() => gateAndEnter(presetRoom)); return; }
  if (tries > 100){ location.href = "/together.html"; return; }
  setTimeout(() => waitForRooms(tries + 1), 100);
}
async function gateAndEnter(room){
  if (!room){ location.href = "/together.html"; return; }
  try{
    const info = await MFRooms.get(room);
    if (!info){ bounce("missing", room); return; }
    if (info.type !== "learn"){ location.href = MFRooms.urlFor(info); return; }
    const access = await MFRooms.canEnter(info);
    if (!access.ok){ bounce(access.reason, room); return; }
    try{ await MFRooms.touch(room); }catch(_){ }
    enterRoom(room);
  }catch(err){ console.error(err); bounce("missing", room); }
}
function bounce(reason, room){ location.href = `/together.html?denied=${encodeURIComponent(reason || "missing")}&room=${encodeURIComponent(room || "")}`; }
function trackIdentity(){
  let tries=0;
  const iv=setInterval(()=>{
    if(!window.MFAuth){ if(++tries>150) clearInterval(iv); return; }
    clearInterval(iv);
    if(!MFAuth.isConfigured()) return;
    MFAuth.onChange(user=>{
      const input=$("nameInput");
      if(user && MFAuth.name()){ displayName=MFAuth.name(); input.value=displayName; input.readOnly=true; }
      else{ input.value=displayName; input.readOnly=false; }
      if(ROOM) writePresence();
    });
  },100);
}
trackIdentity();

function enterRoom(room){
  if(roomEntered) return;
  roomEntered=true; ROOM=room;
  $("gateView").hidden=true; $("roomView").hidden=false; $("roomBar").hidden=false; $("nameInput").value=displayName;
  const u=new URL(location.href); u.searchParams.set("room",room); history.replaceState(null,"",u);
  setupTabs(); setupPresence(); setupSharedState(); setupActions(); renderEverything();
}
function setupTabs(){
  $("tabs").querySelectorAll(".tab").forEach(tab=>tab.addEventListener("click",()=>{
    currentTab=tab.dataset.tab;
    $("tabs").querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t===tab));
    document.querySelectorAll(".panel").forEach(panel=>panel.classList.toggle("active",panel.dataset.panel===currentTab));
    if(ROOM) update(ref(db,roomPath(`presence/${myId}`)),{tab:currentTab,t:now()}).catch(()=>{});
  }));
}
function paintConnection(){
  $("connDot").className="dot "+(connected?"on":"off");
  const identities=new Set(Object.entries(presenceData).filter(([,v])=>v&&now()-(v.t||0)<70000).map(([id,v])=>v.idk||id));
  $("connText").textContent=connected?(identities.size>1?`Connected · ${identities.size} here`:"Connected · waiting for your person"):"Offline";
}
function writePresence(){
  if(!ROOM) return;
  const p=ref(db,roomPath(`presence/${myId}`));
  set(p,{name:displayName||"someone",idk:identityKey(),tab:currentTab,lessonId:LESSONS[currentLessonIndex]?.id||LESSONS[0].id,joined:serverTimestamp(),t:now()});
  onDisconnect(p).remove();
}
function setupPresence(){
  writePresence(); setInterval(writePresence,20000);
  onValue(ref(db,".info/connected"),snap=>{connected=snap.val()===true;paintConnection();if(connected)writePresence();});
  onValue(ref(db,roomPath("presence")),snap=>{
    const raw=snap.val()||{},fresh={};
    Object.entries(raw).forEach(([id,v])=>{ if(id===myId||now()-((v&&v.t)||0)<70000)fresh[id]=v; else remove(ref(db,roomPath(`presence/${id}`))).catch(()=>{}); });
    presenceData=fresh; renderPresence(); paintConnection();
  });
}
function setupSharedState(){
  onValue(ref(db,rootPath("progress")),snap=>{
    progressData=snap.val()||{};
    const me=mine(); currentGoal=me.goal||currentGoal;
    if(me.currentLesson){ const idx=LESSONS.findIndex(l=>l.id===me.currentLesson); if(idx>=0) currentLessonIndex=idx; }
    $("goalSelect").value=currentGoal;
    renderEverything();
  });
  onValue(ref(db,rootPath("homework")),snap=>{homeworkData=snap.val()||{};renderHomework();});
  onValue(ref(db,rootPath("phrasebook")),snap=>{phrasebookData=snap.val()||{};renderPhrasebook();});
  get(ref(db,rootPath(`progress/${identityKey()}`))).then(s=>{
    if(!s.exists()) update(ref(db,rootPath(`progress/${identityKey()}`)),{name:displayName||"someone",goal:currentGoal,hearts:MAX_HEARTS,xp:0,streak:0,currentLesson:LESSONS[0].id,updated:now()});
  });
}
function setupActions(){
  $("copyRoomBtn").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(location.href);toast("Class link copied 🔗");}catch(_){toast(location.href);}});
  $("nameInput").addEventListener("input",e=>{if(e.target.readOnly)return;displayName=e.target.value.slice(0,24)||"someone";localStorage.setItem("lc_name",displayName);writePresence();});
  $("goalSelect").addEventListener("change",e=>{currentGoal=e.target.value;updateMyProgress({name:displayName||"someone",goal:currentGoal});renderLessonOverview();});
  $("closeSession").addEventListener("click",closeSession);
  $("smartPracticeBtn").addEventListener("click",()=>startPractice("weak"));
  $("randomPracticeBtn").addEventListener("click",()=>startPractice("mixed"));
  $("practiceMistakesBtn").addEventListener("click",()=>startPractice("mistakes"));
  $("refillHeartsBtn").addEventListener("click",()=>startPractice("hearts"));
  $("assignLessonHomework").addEventListener("click",assignLessonHomework);
  $("createHomework").addEventListener("click",createHomework);
  $("addPhrase").addEventListener("click",addPhrase);
  $("bookSearch").addEventListener("input",renderPhrasebook);
}
function updateMyProgress(values){ return update(ref(db,rootPath(`progress/${identityKey()}`)),{name:displayName||"someone",goal:currentGoal,updated:now(),...values}); }

function renderEverything(){ renderStats();renderPresence();renderPath();renderLessonOverview();renderWeakWords();renderMistakes();renderClassProgress();renderHomework();renderPhrasebook(); }
function renderStats(){
  const me=mine(); const complete=LESSONS.reduce((n,l)=>n+(lessonProgress(l.id).completed?1:0),0);
  const mastery=LESSONS.length?Math.round((complete/LESSONS.length)*100):0;
  $("streakStat").textContent=Number(me.streak||0); $("xpStat").textContent=`${Number(me.xp||0)} XP`; $("heartsStat").textContent=`${hearts()} / ${MAX_HEARTS}`; $("masteryStat").textContent=`${mastery}%`;
}
function renderPresence(){
  const freshest=new Map();
  Object.entries(presenceData).forEach(([id,v])=>{if(!v||now()-(v.t||0)>=70000)return;const key=v.idk||id,old=freshest.get(key);if(!old||(v.t||0)>(old.v.t||0))freshest.set(key,{id,v});});
  const box=$("whoHere"); if(!box)return; box.innerHTML="";
  freshest.forEach(({v},key)=>{const chip=document.createElement("span");chip.className="whoChip"+(key===identityKey()?" me":"");chip.textContent=(v.name||"someone")+(key===identityKey()?" (you)":"");box.appendChild(chip);});
}
function isLessonUnlocked(index){ if(index===0)return true; return !!lessonProgress(LESSONS[index-1].id).completed; }
function renderPath(){
  const box=$("pathList"); if(!box)return; box.innerHTML="";
  LESSONS.forEach((lesson,index)=>{
    const p=lessonProgress(lesson.id), unlocked=isLessonUnlocked(index), done=!!p.completed, current=index===currentLessonIndex;
    const wrap=document.createElement("div");wrap.className="pathNodeWrap";
    const btn=document.createElement("button");btn.className="pathNode "+(done?"done ":"")+(current?"current ":"")+(!unlocked?"locked":"");btn.disabled=!unlocked;btn.textContent=!unlocked?"🔒":done?"✓":lesson.emoji;btn.title=lesson.title;
    btn.addEventListener("click",()=>selectLesson(index));
    const info=document.createElement("div");info.className="pathInfo"; const stars=Number(p.stars||0); info.innerHTML=`<strong>${index+1}. ${esc(lesson.title)}</strong><span>${!unlocked?"Complete the lesson above":done?`Best: ${Number(p.bestScore||0)}% · <span class="stars">${"★".repeat(stars)}${"☆".repeat(3-stars)}</span>`:"New lesson"}</span>`;
    wrap.append(btn,info);box.appendChild(wrap);
  });
}
function selectLesson(index){ if(!isLessonUnlocked(index)){toast("Complete the previous lesson first 🔒");return;} currentLessonIndex=index;updateMyProgress({currentLesson:LESSONS[index].id});writePresence();renderPath();renderLessonOverview(); }
function direction(){ return currentGoal==="en"?"en":currentGoal==="both"?"mix":"pt"; }
function renderLessonOverview(){
  const box=$("lessonOverview"); if(!box)return;
  const lesson=LESSONS[currentLessonIndex],p=lessonProgress(lesson.id),unlocked=isLessonUnlocked(currentLessonIndex),score=Number(p.bestScore||0),done=!!p.completed;
  const learned=(lesson.vocab.length+lesson.phrases.length); const langLabel=currentGoal==="en"?"Portuguese → English":currentGoal==="both"?"Both directions":"English → Portuguese";
  box.innerHTML=`
    <div class="lessonBanner"><div class="lessonEmoji">${lesson.emoji}</div><div><h2>${currentLessonIndex+1}. ${esc(lesson.title)}</h2><p>${esc(lesson.goal)}</p><div class="lessonMeta"><span class="tag">${learned} words & phrases</span><span class="tag">${langLabel}</span><span class="tag">${done?"Completed":"About 5–8 min"}</span></div></div></div>
    <div class="progressTrack"><div class="progressFill" style="width:${done?100:score}%"></div></div><div class="progressText"><span>${done?"Lesson complete":"Best lesson score"}</span><span>${done?`${Number(p.stars||1)} star${Number(p.stars||1)===1?"":"s"}`:`${score}%`}</span></div>
    <div class="lessonActions"><button class="btn primary" id="startLessonBtn" ${unlocked?"":"disabled"}>${done?"Practice again":"Start lesson"}</button><button class="btn purple" id="previewAudioBtn">🔊 Hear lesson words</button></div>
    <h3 style="margin:0 0 4px">What you’ll practice</h3><div class="skillGrid"><div class="skill"><strong>👂 Listening</strong><p>Hear words naturally and identify what was said.</p></div><div class="skill"><strong>🧩 Sentence building</strong><p>Put useful sentences together in the right order.</p></div><div class="skill"><strong>⌨️ Recall</strong><p>Type translations without seeing the answer first.</p></div><div class="skill"><strong>🔗 Matching</strong><p>Connect words across both languages quickly.</p></div></div>
    <h3 style="margin:19px 0 4px">Words introduced</h3><div class="wordPreview">${lesson.vocab.slice(0,8).map(([en,pt])=>`<span class="wordChip">${esc(en)} · <b>${esc(pt)}</b></span>`).join("")}</div>
    <div class="tip"><strong>Language note:</strong> ${esc(lesson.tip)}</div>`;
  $("startLessonBtn").addEventListener("click",()=>startLesson(currentLessonIndex));
  $("previewAudioBtn").addEventListener("click",()=>speakSequence(lesson.vocab.slice(0,5)));
}
async function speakSequence(rows){ for(const [en,pt] of rows){ const text=direction()==="en"?en:pt; await speakAndWait(text,direction()==="en"?"en-US":"pt-BR"); await new Promise(r=>setTimeout(r,180)); } }

function allLessonItems(lesson){ return lesson.vocab.concat(lesson.phrases).map(([en,pt],i)=>({en,pt,key:`${lesson.id}_${slug(en)}_${i}`,lessonId:lesson.id,isPhrase:i>=lesson.vocab.length})); }
function masteryFor(item){ return Number((mine().mastery||{})[item.key]||0); }
function buildLessonExercises(lesson){
  const items=shuffle(allLessonItems(lesson)); const dir=direction(); const exercises=[];
  items.slice(0,2).forEach(item=>exercises.push({type:"introduce",item,direction:dir==="mix"?(exercises.length%2?"en":"pt"):dir}));
  items.slice(0,5).forEach((item,i)=>exercises.push(buildExercise(item,["choice","listen","type","bank","choice"][i],dir==="mix"?(i%2?"en":"pt"):dir,lesson)));
  exercises.push({type:"match",items:shuffle(items).slice(0,4),direction:dir});
  items.slice(5,8).forEach((item,i)=>exercises.push(buildExercise(item,["type","listen","bank"][i],dir==="mix"?(i%2?"pt":"en"):dir,lesson)));
  exercises.push({type:"conversation",lesson,direction:dir});
  return exercises.slice(0,SESSION_SIZE);
}
function buildExercise(item,type,dir,lesson){
  const actualDir=dir==="mix"?"pt":dir;
  if(type==="bank" && (!(actualDir==="pt"?item.pt:item.en).includes(" ") || (actualDir==="pt"?item.pt:item.en).includes("/"))) type="choice";
  if(type==="listen") return {type,item,direction:actualDir,choices:choicePool(item,actualDir==="pt"?"en":"pt",lesson)};
  if(type==="choice") return {type,item,direction:actualDir,choices:choicePool(item,actualDir,lesson)};
  return {type,item,direction:actualDir};
}
function choicePool(item,dir,lesson){
  const answer=dir==="pt"?item.pt:item.en; const pool=shuffle(allLessonItems(lesson).map(x=>dir==="pt"?x.pt:x.en).filter(x=>x!==answer));
  return shuffle([answer,...pool.slice(0,3)]);
}
function buildPracticeExercises(mode){
  const all=LESSONS.filter((_,i)=>isLessonUnlocked(i)).flatMap(allLessonItems); const mistakes=Object.values(mine().mistakes||{}).filter(Boolean);
  let source=[];
  if(mode==="mistakes") source=mistakes.map(m=>({...m,key:m.key||`${m.lessonId}_${slug(m.en)}`}));
  else if(mode==="weak"||mode==="hearts") source=shuffle(all).sort((a,b)=>masteryFor(a)-masteryFor(b)).slice(0,18);
  else source=shuffle(all).slice(0,18);
  if(!source.length) source=shuffle(all).slice(0,18);
  const dir=direction(); const exercises=[];
  source.slice(0,10).forEach((item,i)=>{const lesson=lessonById(item.lessonId)||LESSONS[0];exercises.push(buildExercise(item,["choice","listen","type","bank"][i%4],dir==="mix"?(i%2?"en":"pt"):dir,lesson));});
  if(source.length>=4) exercises.splice(5,0,{type:"match",items:shuffle(source).slice(0,4),direction:dir});
  return exercises.slice(0,SESSION_SIZE-1);
}
function startLesson(index){
  if(!isLessonUnlocked(index)){toast("Complete the previous lesson first");return;}
  if(hearts()<=0){toast("Practice to refill your hearts first ❤️");switchTab("practice");return;}
  activeSession={kind:"lesson",lessonIndex:index,mode:"lesson",exercises:buildLessonExercises(LESSONS[index]),position:0,correct:0,wrong:0,xp:0,hearts:hearts(),locked:false,selected:null,bank:[],matched:0};
  showSession();renderExercise();
}
function startPractice(mode){
  const exercises=buildPracticeExercises(mode);
  if(!exercises.length){toast("Complete a lesson first so there is something to practice");return;}
  activeSession={kind:"practice",mode,exercises,position:0,correct:0,wrong:0,xp:0,hearts:hearts(),locked:false,selected:null,bank:[],matched:0};
  showSession();renderExercise();
}
function showSession(){ $("normalView").hidden=true;$("courseHeader").hidden=true;$("roomBar").hidden=true;$("sessionView").hidden=false;window.scrollTo({top:0,behavior:"smooth"}); }
function closeSession(){ if(!activeSession)return; const started=activeSession.position>0; if(started&&!confirm("Leave this lesson? Your unfinished attempt will not be scored."))return; activeSession=null;$("sessionView").hidden=true;$("normalView").hidden=false;$("courseHeader").hidden=false;$("roomBar").hidden=false;renderEverything(); }
function switchTab(name){ const tab=$("tabs").querySelector(`[data-tab="${name}"]`); if(tab)tab.click(); }
function targetText(ex){ return ex.direction==="pt"?ex.item.pt:ex.item.en; }
function sourceText(ex){ return ex.direction==="pt"?ex.item.en:ex.item.pt; }
function targetLang(ex){ return ex.direction==="pt"?"pt-BR":"en-US"; }
function sourceLang(ex){ return ex.direction==="pt"?"en-US":"pt-BR"; }
function renderExercise(){
  if(!activeSession)return;
  if(activeSession.position>=activeSession.exercises.length){finishSession();return;}
  activeSession.locked=false;activeSession.selected=null;activeSession.bank=[];activeSession.matched=0;
  const ex=activeSession.exercises[activeSession.position];
  $("sessionProgress").style.width=`${Math.round((activeSession.position/activeSession.exercises.length)*100)}%`;$("sessionHearts").textContent=`❤️ ${activeSession.hearts}`;
  const card=$("exerciseCard");
  if(ex.type==="introduce") renderIntroduce(card,ex);
  else if(ex.type==="choice") renderChoice(card,ex,false);
  else if(ex.type==="listen") renderChoice(card,ex,true);
  else if(ex.type==="type") renderType(card,ex);
  else if(ex.type==="bank") renderBank(card,ex);
  else if(ex.type==="match") renderMatch(card,ex);
  else if(ex.type==="conversation") renderConversation(card,ex);
}
function baseCheckBar(label="Check"){ return `<div class="checkBar"><div class="feedbackMsg" id="feedbackMsg"></div><button class="btn primary" id="checkAnswer">${label}</button></div>`; }
function renderIntroduce(card,ex){
  card.innerHTML=`<div class="exerciseType">New word</div><div class="exercisePrompt">Learn this ${ex.item.isPhrase?"phrase":"word"}</div><div class="bigWord">${esc(sourceText(ex))}</div><div style="text-align:center;font-size:25px;color:var(--lc-purple2)">${esc(targetText(ex))}</div><button class="speakerBig" id="introSpeak">🔊</button>${baseCheckBar("Got it")}`;
  $("introSpeak").addEventListener("click",()=>speak(targetText(ex),targetLang(ex)));$("checkAnswer").addEventListener("click",()=>{if(activeSession.locked)return;activeSession.locked=true;completeExercise(true,ex);});
}
function renderChoice(card,ex,listening){
  const prompt=listening?"What does this mean?":`Translate into ${ex.direction==="pt"?"Portuguese":"English"}`;
  card.innerHTML=`<div class="exerciseType">${listening?"Listening":"Multiple choice"}</div><div class="exercisePrompt">${prompt}</div>${listening?`<button class="speakerBig" id="listenBtn">🔊</button>`:`<div class="bigWord">${esc(sourceText(ex))}</div>`}<div class="choiceGrid">${ex.choices.map(c=>`<button class="choice" data-choice="${esc(c)}">${esc(c)}</button>`).join("")}</div>${baseCheckBar()}`;
  if(listening){$("listenBtn").addEventListener("click",()=>speak(targetText(ex),targetLang(ex)));setTimeout(()=>speak(targetText(ex),targetLang(ex)),250);}
  card.querySelectorAll(".choice").forEach(btn=>btn.addEventListener("click",()=>{if(activeSession.locked)return;activeSession.selected=btn.dataset.choice;card.querySelectorAll(".choice").forEach(b=>b.classList.toggle("selected",b===btn));}));
  $("checkAnswer").addEventListener("click",()=>{if(!activeSession.selected){toast("Choose an answer first");return;}const expected=listening?sourceText(ex):targetText(ex);gradeCurrent(normalize(activeSession.selected)===normalize(expected),ex,activeSession.selected,expected);});
}
function renderType(card,ex){
  card.innerHTML=`<div class="exerciseType">Write the answer</div><div class="exercisePrompt">Translate into ${ex.direction==="pt"?"Portuguese":"English"}</div><div class="bigWord">${esc(sourceText(ex))}</div><input class="input typeAnswer" id="typedAnswer" autocomplete="off" autocapitalize="sentences" placeholder="Type your answer…" />${baseCheckBar()}`;
  const input=$("typedAnswer");input.focus();input.addEventListener("keydown",e=>{if(e.key==="Enter")$("checkAnswer").click();});
  $("checkAnswer").addEventListener("click",()=>{const answer=input.value.trim();if(!answer){toast("Type an answer first");return;}gradeCurrent(isCloseAnswer(answer,targetText(ex)),ex,answer);});
}
function isCloseAnswer(given,expected){ const a=normalize(given),b=normalize(expected); if(a===b)return true; const variants=String(expected).split(/\s*\/\s*|\s*;\s*/).map(normalize); return variants.includes(a); }
function renderBank(card,ex){
  const words=shuffle(targetText(ex).replace(/[.,!?]/g,"").split(/\s+/).filter(Boolean));
  card.innerHTML=`<div class="exerciseType">Build the sentence</div><div class="exercisePrompt">Translate this sentence</div><div class="bigWord" style="font-size:34px">${esc(sourceText(ex))}</div><div class="wordBank" id="answerBank"></div><div class="bankWords">${words.map((w,i)=>`<button class="bankWord" data-i="${i}" data-word="${esc(w)}">${esc(w)}</button>`).join("")}</div>${baseCheckBar()}`;
  const redraw=()=>{$("answerBank").innerHTML=activeSession.bank.map((x,i)=>`<button class="answerWord" data-remove="${i}">${esc(x.word)}</button>`).join("");card.querySelectorAll("[data-remove]").forEach(b=>b.addEventListener("click",()=>{const [removed]=activeSession.bank.splice(Number(b.dataset.remove),1);card.querySelector(`[data-i="${removed.i}"]`).disabled=false;redraw();}));};
  card.querySelectorAll(".bankWord").forEach(btn=>btn.addEventListener("click",()=>{activeSession.bank.push({word:btn.dataset.word,i:Number(btn.dataset.i)});btn.disabled=true;redraw();}));
  $("checkAnswer").addEventListener("click",()=>{if(!activeSession.bank.length){toast("Build the sentence first");return;}const answer=activeSession.bank.map(x=>x.word).join(" ");gradeCurrent(normalize(answer)===normalize(targetText(ex)),ex,answer);});
}
function renderMatch(card,ex){
  const pairs=ex.items.map((item,i)=>({i,item})); const left=shuffle(pairs.map(p=>({side:"left",i:p.i,text:p.item.en}))), right=shuffle(pairs.map(p=>({side:"right",i:p.i,text:p.item.pt})));
  card.innerHTML=`<div class="exerciseType">Matching</div><div class="exercisePrompt">Match each pair</div><div class="matchGrid"><div>${left.map(x=>`<button class="matchItem" style="width:100%;margin-bottom:9px" data-side="${x.side}" data-pair="${x.i}">${esc(x.text)}</button>`).join("")}</div><div>${right.map(x=>`<button class="matchItem" style="width:100%;margin-bottom:9px" data-side="${x.side}" data-pair="${x.i}">${esc(x.text)}</button>`).join("")}</div></div>${baseCheckBar("Continue")}`;
  let selected=null;
  card.querySelectorAll(".matchItem").forEach(btn=>btn.addEventListener("click",()=>{
    if(btn.classList.contains("matched")||activeSession.locked)return;
    if(!selected){selected=btn;btn.classList.add("selected");return;}
    if(selected.dataset.side===btn.dataset.side){selected.classList.remove("selected");selected=btn;btn.classList.add("selected");return;}
    if(selected.dataset.pair===btn.dataset.pair){selected.classList.remove("selected");selected.classList.add("matched");btn.classList.add("matched");activeSession.matched++;selected=null;if(activeSession.matched===ex.items.length){$("feedbackMsg").textContent="Perfect matches!";$("feedbackMsg").className="feedbackMsg good";}}
    else{const first=selected;selected=null;first.classList.remove("selected");first.classList.add("bad");btn.classList.add("bad");setTimeout(()=>{first.classList.remove("bad");btn.classList.remove("bad");},260);}
  }));
  $("checkAnswer").addEventListener("click",()=>{if(activeSession.matched<ex.items.length){toast("Match all of the pairs first");return;}if(activeSession.locked)return;activeSession.locked=true;completeExercise(true,ex);});
}
function renderConversation(card,ex){
  card.innerHTML=`<div class="exerciseType">Real conversation</div><div class="exercisePrompt">Use what you learned together</div><div class="tip" style="font-size:15px;margin-top:8px"><strong>Challenge:</strong> ${esc(ex.lesson.challenge)}</div><p class="muted" style="margin-top:18px">Say it aloud. You may use the lesson words, but try not to use a translator. This final checkpoint is based on doing the activity—not being perfect.</p>${baseCheckBar("We did it")}`;
  $("checkAnswer").addEventListener("click",()=>{if(activeSession.locked)return;activeSession.locked=true;completeExercise(true,ex);});
}
function gradeCurrent(correct,ex,given,expectedOverride){
  if(activeSession.locked)return;activeSession.locked=true;
  const card=$("exerciseCard"),msg=$("feedbackMsg"),btn=$("checkAnswer");
  card.querySelectorAll("button.choice,.bankWord,.answerWord").forEach(b=>b.disabled=true);
  const expected=expectedOverride||targetText(ex);
  if(correct){msg.textContent="Correct! +10 XP";msg.className="feedbackMsg good";btn.textContent="Continue";highlightChoice(expected,true);recordCorrect(ex);}
  else{msg.innerHTML=`Not quite. Correct answer: <strong>${esc(expected)}</strong>`;msg.className="feedbackMsg bad";btn.textContent="Continue";highlightChoice(expected,false);recordWrong(ex,given);if(!ex.retry)activeSession.exercises.push({...ex,retry:true});}
  btn.onclick=()=>completeExercise(correct,ex);
}
function highlightChoice(answer,correct){ $("exerciseCard").querySelectorAll(".choice").forEach(b=>{if(normalize(b.dataset.choice)===normalize(answer))b.classList.add("correct");else if(b.classList.contains("selected")&&!correct)b.classList.add("wrong");}); }
function recordCorrect(ex){ activeSession.correct++;activeSession.xp+=10;if(ex.item){const strength=clamp(masteryFor(ex.item)+1,0,5);set(ref(db,rootPath(`progress/${identityKey()}/mastery/${ex.item.key}`)),strength);remove(ref(db,rootPath(`progress/${identityKey()}/mistakes/${ex.item.key}`))).catch(()=>{});} }
function recordWrong(ex,given){
  activeSession.wrong++;activeSession.hearts=Math.max(0,activeSession.hearts-1);$("sessionHearts").textContent=`❤️ ${activeSession.hearts}`;
  if(ex.item){const old=(mine().mistakes||{})[ex.item.key]||{};set(ref(db,rootPath(`progress/${identityKey()}/mastery/${ex.item.key}`)),Math.max(0,masteryFor(ex.item)-1));set(ref(db,rootPath(`progress/${identityKey()}/mistakes/${ex.item.key}`)),{key:ex.item.key,en:ex.item.en,pt:ex.item.pt,lessonId:ex.item.lessonId,count:Number(old.count||0)+1,lastGiven:given||"",lastWrong:now()});}
  updateMyProgress({hearts:activeSession.hearts});
}
function completeExercise(correct,ex){
  if(!activeSession)return;
  if(ex.type==="introduce"||ex.type==="match"||ex.type==="conversation"){activeSession.correct++;activeSession.xp+=ex.type==="conversation"?15:5;}
  if(activeSession.hearts<=0 && activeSession.kind==="lesson"){renderOutOfHearts();return;}
  activeSession.position++;renderExercise();
}
function renderOutOfHearts(){
  $("exerciseCard").innerHTML=`<div class="resultCard" style="display:flex;flex-direction:column;min-height:410px"><div class="resultEmoji">💔</div><h2>You’re out of hearts</h2><p class="muted">Your mistakes were saved. Do a short practice session to refill your hearts, then try the lesson again.</p><button class="btn primary" id="goPractice" style="margin-top:20px">Practice to refill</button></div>`;
  $("goPractice").addEventListener("click",()=>{activeSession=null;$("sessionView").hidden=true;$("normalView").hidden=false;$("courseHeader").hidden=false;$("roomBar").hidden=false;switchTab("practice");renderEverything();});
}
async function finishSession(){
  const s=activeSession,total=s.exercises.length,accuracy=Math.round((s.correct/Math.max(1,s.correct+s.wrong))*100),xpEarned=s.xp+(accuracy===100?20:accuracy>=80?10:0);
  const me=mine(),newXp=Number(me.xp||0)+xpEarned; const today=todayKey(),last=me.lastPracticeDate||""; let streak=Number(me.streak||0); if(last!==today)streak=last===yesterdayKey()?streak+1:1;
  const values={xp:newXp,streak,lastPracticeDate:today,hearts:s.kind==="practice"&&s.mode==="hearts"?MAX_HEARTS:s.hearts,lastSessionAccuracy:accuracy};
  if(s.kind==="lesson"){
    const lesson=LESSONS[s.lessonIndex],old=lessonProgress(lesson.id),passed=accuracy>=70,stars=accuracy>=95?3:accuracy>=82?2:passed?1:0;
    values[`lessons/${lesson.id}/attempts`]=Number(old.attempts||0)+1; values[`lessons/${lesson.id}/bestScore`]=Math.max(Number(old.bestScore||0),accuracy);values[`lessons/${lesson.id}/stars`]=Math.max(Number(old.stars||0),stars);values[`lessons/${lesson.id}/lastAttempt`]=now();
    if(passed||old.completed){values[`lessons/${lesson.id}/completed`]=true;values[`lessons/${lesson.id}/completedAt`]=old.completedAt||now();}
    if(passed){const next=LESSONS[s.lessonIndex+1];if(next)values.currentLesson=next.id;}
  }
  await updateMyProgress(values);
  const passed=s.kind==="practice"||accuracy>=70;
  $("sessionProgress").style.width="100%";
  $("exerciseCard").innerHTML=`<div class="resultCard" style="display:flex;flex-direction:column;min-height:430px"><div class="resultEmoji">${passed?accuracy>=90?"🏆":"🎉":"📚"}</div><h2>${s.kind==="practice"?"Practice complete!":passed?"Lesson complete!":"Almost there"}</h2><p class="muted">${s.kind==="lesson"&&!passed?"You need 70% to unlock the next lesson. Your mistakes are ready for review.":"That was real retrieval practice—not just reading a list of phrases."}</p><div class="resultStats"><div class="resultStat"><strong>${accuracy}%</strong><span>accuracy</span></div><div class="resultStat"><strong>+${xpEarned}</strong><span>XP earned</span></div><div class="resultStat"><strong>${s.wrong}</strong><span>mistakes saved</span></div></div><button class="btn primary" id="finishDone">${s.kind==="lesson"&&!passed?"Review and try again":"Continue"}</button></div>`;
  $("finishDone").addEventListener("click",()=>{activeSession=null;$("sessionView").hidden=true;$("normalView").hidden=false;$("courseHeader").hidden=false;$("roomBar").hidden=false;if(s.kind==="lesson"&&!passed)switchTab("mistakes");renderEverything();});
}

function renderWeakWords(){
  const box=$("weakWordsList");if(!box)return;const unlocked=LESSONS.filter((_,i)=>isLessonUnlocked(i)).flatMap(allLessonItems).sort((a,b)=>masteryFor(a)-masteryFor(b)).slice(0,8);
  if(!unlocked.length){box.innerHTML=`<div class="empty">Start your first lesson to build a review list.</div>`;return;}
  box.innerHTML=unlocked.map(item=>{const m=masteryFor(item);return `<div class="reviewRow"><span>🧠</span><div class="grow"><strong>${esc(currentGoal==="en"?item.pt:item.en)}</strong><div class="muted">${esc(currentGoal==="en"?item.en:item.pt)}</div></div><div class="masteryDots">${[1,2,3,4,5].map(n=>`<span class="${n<=m?"on":""}"></span>`).join("")}</div></div>`;}).join("");
}
function renderMistakes(){
  const box=$("mistakeList");if(!box)return;const rows=Object.values(mine().mistakes||{}).filter(Boolean).sort((a,b)=>(b.lastWrong||0)-(a.lastWrong||0));
  if(!rows.length){box.innerHTML=`<div class="empty">No saved mistakes. That either means you’re brand new or suspiciously brilliant. 🌟</div>`;return;}
  box.innerHTML=rows.map(m=>`<div class="mistakeRow"><div><strong>${esc(m.en)}</strong><small>${esc(lessonById(m.lessonId)?.title||"Course review")}</small></div><div class="pt">${esc(m.pt)}<small>missed ${Number(m.count||1)} time${Number(m.count||1)===1?"":"s"}</small></div><button class="btn sm danger" data-forget="${esc(m.key)}">Remove</button></div>`).join("");
  box.querySelectorAll("[data-forget]").forEach(b=>b.addEventListener("click",()=>remove(ref(db,rootPath(`progress/${identityKey()}/mistakes/${b.dataset.forget}`)))));
}
function renderClassProgress(){
  const box=$("classProgressList");if(!box)return;const rows=Object.entries(progressData).filter(([,v])=>v&&v.name);
  box.innerHTML=rows.length?rows.map(([key,v])=>{const done=Object.values(v.lessons||{}).filter(x=>x===true||(x&&x.completed)).length;return `<div class="reviewRow"><span>${key===identityKey()?"🌟":"💞"}</span><div class="grow"><strong>${esc(v.name)}${key===identityKey()?" (you)":""}</strong><div class="muted">${goalLabel(v.goal)} · ${done}/${LESSONS.length} lessons</div></div><strong>${Number(v.xp||0)} XP</strong></div>`;}).join(""):`<div class="empty">Progress will appear after someone starts learning.</div>`;
}
function goalLabel(goal){return goal==="en"?"learning English":goal==="both"?"practicing both":"learning Portuguese";}

function speak(text,lang){
  if(!("speechSynthesis" in window)){toast("Speech playback isn’t supported in this browser");return;}
  speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang=lang;u.rate=.84;const voices=speechSynthesis.getVoices();const exact=voices.find(v=>v.lang.toLowerCase()===lang.toLowerCase())||voices.find(v=>v.lang.toLowerCase().startsWith(lang.slice(0,2).toLowerCase()));if(exact)u.voice=exact;speechSynthesis.speak(u);
}
function speakAndWait(text,lang){return new Promise(resolve=>{if(!("speechSynthesis" in window)){resolve();return;}speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang=lang;u.rate=.84;u.onend=resolve;u.onerror=resolve;speechSynthesis.speak(u);});}
function speakerButton(text,lang){return `<button class="speak" data-say="${esc(text)}" data-lang="${lang}" title="Hear pronunciation">🔊</button>`;}

async function addHomework(title,instructions,target){const itemRef=push(ref(db,rootPath("homework")));await set(itemRef,{title,instructions,target,createdBy:identityKey(),createdName:displayName||"someone",lessonId:LESSONS[currentLessonIndex].id,t:now()});toast("Homework assigned 📝");}
function assignLessonHomework(){const l=LESSONS[currentLessonIndex];addHomework(`${l.emoji} ${l.title} assignment`,l.homework,"both");}
function createHomework(){const title=$("hwTitle").value.trim(),instructions=$("hwInstructions").value.trim(),target=$("hwTarget").value;if(!title||!instructions){toast("Add a title and instructions");return;}addHomework(title,instructions,target);$("hwTitle").value="";$("hwInstructions").value="";}
function renderHomework(){
  const box=$("homeworkList");if(!box)return;const entries=Object.entries(homeworkData).filter(([,v])=>v).sort((a,b)=>(b[1].t||0)-(a[1].t||0));
  if(!entries.length){box.innerHTML=`<div class="empty">No homework yet. Assign the selected lesson’s real-world activity when you’re ready. ✏️</div>`;return;}
  box.innerHTML=entries.map(([id,hw])=>{const submissions=Object.entries(hw.submissions||{}),mineSub=(hw.submissions||{})[identityKey()]||{};return `<article class="hwCard"><div class="hwHead"><span style="font-size:22px">📝</span><div class="hwMain"><div class="hwTitle">${esc(hw.title)}</div><div class="hwMeta">${targetLabel(hw.target)} · assigned by ${esc(hw.createdName||"someone")}</div></div>${hw.createdBy===identityKey()?`<button class="btn sm danger" data-delete-hw="${esc(id)}">Delete</button>`:""}</div><div class="hwInstructions">${esc(hw.instructions)}</div><textarea class="textarea" data-hw-answer="${esc(id)}" placeholder="Write your answer here…">${esc(mineSub.text||"")}</textarea><button class="btn purple sm" data-save-hw="${esc(id)}" style="margin-top:8px">Save my answer</button><div>${submissions.map(([key,sub])=>`<div class="submission"><strong>${esc(sub.name||"someone")}${key===identityKey()?" (you)":""}</strong><p>${esc(sub.text||"")}</p>${sub.feedback?`<div class="feedback">💛 ${esc(sub.feedback)}</div>`:""}${key!==identityKey()?`<div style="display:flex;gap:7px;margin-top:8px"><input class="input" style="padding:8px" data-feedback-input="${esc(id)}|${esc(key)}" value="${esc(sub.feedback||"")}" placeholder="Kind correction or encouragement"/><button class="btn sm" data-save-feedback="${esc(id)}|${esc(key)}">Save</button></div>`:""}</div>`).join("")}</div></article>`;}).join("");
  box.querySelectorAll("[data-save-hw]").forEach(b=>b.addEventListener("click",()=>saveHomeworkAnswer(b.dataset.saveHw)));box.querySelectorAll("[data-delete-hw]").forEach(b=>b.addEventListener("click",()=>remove(ref(db,rootPath(`homework/${b.dataset.deleteHw}`)))));box.querySelectorAll("[data-save-feedback]").forEach(b=>b.addEventListener("click",()=>saveFeedback(b.dataset.saveFeedback)));
}
function targetLabel(target){return target==="pt"?"For the Portuguese learner":target==="en"?"For the English learner":"For both of you";}
function saveHomeworkAnswer(id){const text=document.querySelector(`[data-hw-answer="${CSS.escape(id)}"]`).value.trim();if(!text){toast("Write an answer first");return;}set(ref(db,rootPath(`homework/${id}/submissions/${identityKey()}`)),{name:displayName||"someone",text,t:now()});toast("Homework saved ✓");}
function saveFeedback(key){const [hwId,studentId]=key.split("|");const input=document.querySelector(`[data-feedback-input="${CSS.escape(key)}"]`);update(ref(db,rootPath(`homework/${hwId}/submissions/${studentId}`)),{feedback:input.value.trim(),feedbackBy:displayName||"someone",feedbackT:now()});toast("Feedback saved 💛");}
function addPhrase(){const en=$("bookEn").value.trim(),pt=$("bookPt").value.trim(),note=$("bookNote").value.trim();if(!en||!pt){toast("Add both English and Portuguese");return;}const item=push(ref(db,rootPath("phrasebook")));set(item,{en,pt,note,by:identityKey(),name:displayName||"someone",t:now()});$("bookEn").value="";$("bookPt").value="";$("bookNote").value="";toast("Added to your phrasebook 💬");}
function renderPhrasebook(){
  const box=$("phrasebookList");if(!box)return;const q=($("bookSearch")?.value||"").trim().toLowerCase();const rows=Object.entries(phrasebookData).filter(([,v])=>v&&(!q||`${v.en} ${v.pt} ${v.note||""}`.toLowerCase().includes(q))).sort((a,b)=>(b[1].t||0)-(a[1].t||0));
  if(!rows.length){box.innerHTML=`<div class="empty">${q?"Nothing matches that search.":"Your phrasebook is empty. Add something you truly want to remember. 💞"}</div>`;return;}
  box.innerHTML=rows.map(([id,v])=>`<div class="bookRow"><div><strong>${esc(v.en)}</strong> ${speakerButton(v.en,"en-US")}</div><div class="bookPt">${esc(v.pt)} ${speakerButton(v.pt,"pt-BR")}</div><div class="bookNote">${esc(v.note||`added by ${v.name||"someone"}`)}</div>${v.by===identityKey()?`<button class="btn sm danger" data-delete-book="${esc(id)}">Delete</button>`:"<span></span>"}</div>`).join("");
  box.querySelectorAll("[data-say]").forEach(b=>b.addEventListener("click",()=>speak(b.dataset.say,b.dataset.lang)));box.querySelectorAll("[data-delete-book]").forEach(b=>b.addEventListener("click",()=>remove(ref(db,rootPath(`phrasebook/${b.dataset.deleteBook}`)))));
}

window.addEventListener("DOMContentLoaded",waitForRooms);
