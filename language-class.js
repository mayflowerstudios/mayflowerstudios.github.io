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
let suggestionsData = {};
let worksheetData = {};
let currentGoal = "pt";
let displayName = localStorage.getItem("lc_name") || "";
let currentTab = "learn";
let connected = false;
let activeSession = null;
let worksheetState = null;
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
const mine = () => progressData[identityKey()] || {};
const noAudio = () => !!mine().noAudio;
const lessonProgress = id => { const raw=(mine().lessons || {})[id]; return raw===true ? {completed:true,bestScore:100,legacy:true} : (raw||{}); };
const myWorksheets = () => worksheetData[identityKey()] || {};
const dateLabel = value => value ? new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric",year:"numeric"}).format(new Date(value)) : "";
const timeLabel = value => value ? new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(value)) : "";
const safeOn = (id,event,handler) => { const el=$(id); if(el) el.addEventListener(event,handler); };

const COMMON_EN_PT = {
  "i":"eu","im":"estou","me":"me / mim","my":"meu / minha","you":"você / te","your":"seu / sua","we":"nós","our":"nosso / nossa",
  "how":"como","what":"o que / qual","where":"onde","when":"quando","why":"por que","who":"quem","is":"é / está","are":"é / está / são",
  "am":"estou","do":"fazer","does":"faz","did":"fez","can":"pode","could":"poderia","will":"vai / vou","would":"iria","have":"ter","has":"tem",
  "the":"o / a","a":"um / uma","an":"um / uma","to":"para / a","of":"de","for":"para","with":"com","in":"em","on":"em / sobre",
  "and":"e","or":"ou","but":"mas","not":"não","yes":"sim","no":"não","this":"isso / este","that":"isso / aquilo","it":"isso / ele / ela",
  "good":"bom / boa","morning":"manhã","afternoon":"tarde","night":"noite","later":"mais tarde","today":"hoje","tomorrow":"amanhã","yesterday":"ontem",
  "love":"amor / amar","beautiful":"linda","happy":"feliz","sad":"triste","tired":"cansada","hungry":"com fome","sleep":"dormir","well":"bem",
  "name":"nome","please":"por favor","thanks":"obrigada","thank":"agradecer / obrigada","hello":"olá","hi":"oi","again":"de novo","slowly":"devagar",
  "understand":"entender","mean":"significar","word":"palavra","together":"juntas","game":"jogo","help":"ajuda","left":"esquerda","right":"direita"
};
const WORD_MAP_EN_PT = {...COMMON_EN_PT};
const WORD_MAP_PT_EN = {};
LESSONS.forEach(lesson => lesson.vocab.forEach(([en,pt]) => {
  if(!en.includes(" ") && !en.includes("/")) WORD_MAP_EN_PT[normalize(en)] = pt;
  const firstPt=String(pt).split("/")[0].trim();
  if(!firstPt.includes(" ")) WORD_MAP_PT_EN[normalize(firstPt)] = en;
}));
Object.entries(COMMON_EN_PT).forEach(([en,pt]) => String(pt).split("/").forEach(piece => {
  const key=normalize(piece);
  if(key && !key.includes(" ") && !WORD_MAP_PT_EN[key]) WORD_MAP_PT_EN[key]=en;
}));

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
      if(user && MFAuth.name()){ displayName=MFAuth.name(); if(input){input.value=displayName;input.readOnly=true;} }
      else if(input){input.value=displayName;input.readOnly=false;}
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
  populateLessonSelects(); setupTabs(); setupPresence(); setupSharedState(); setupActions(); renderEverything();
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
  $("connText").textContent=connected?(identities.size>1?"Connected · partner online":"Connected"):"Offline";
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
    Object.entries(raw).forEach(([id,v])=>{ if(id===myId||now()-((v&&v.t)||0)<70000) fresh[id]=v; else remove(ref(db,roomPath(`presence/${id}`))).catch(()=>{}); });
    presenceData=fresh; paintConnection(); renderPartnerProgress();
  });
}
function setupSharedState(){
  onValue(ref(db,rootPath("progress")),snap=>{
    progressData=snap.val()||{};
    const me=mine(); currentGoal=me.goal||currentGoal;
    if(me.currentLesson){ const idx=LESSONS.findIndex(l=>l.id===me.currentLesson); if(idx>=0) currentLessonIndex=idx; }
    if($("goalSelect")) $("goalSelect").value=currentGoal;
    if($("noAudioToggle")) $("noAudioToggle").checked=!!me.noAudio;
    renderEverything();
  });
  onValue(ref(db,rootPath("homework")),snap=>{homeworkData=snap.val()||{};renderHomework();renderStats();renderPartnerProgress();});
  onValue(ref(db,rootPath("phrasebook")),snap=>{phrasebookData=snap.val()||{};renderPhrasebook();renderPath();renderLessonOverview();renderWeakWords();});
  onValue(ref(db,rootPath("suggestions")),snap=>{suggestionsData=snap.val()||{};renderSuggestions();});
  onValue(ref(db,rootPath("worksheets")),snap=>{worksheetData=snap.val()||{};renderWorksheetHistory();renderStats();renderPartnerProgress();});
  get(ref(db,rootPath(`progress/${identityKey()}`))).then(s=>{
    if(!s.exists()) update(ref(db,rootPath(`progress/${identityKey()}`)),{name:displayName||"someone",goal:currentGoal,currentLesson:LESSONS[0].id,updated:now()});
  });
}
function setupActions(){
  safeOn("copyRoomBtn","click",async()=>{try{await navigator.clipboard.writeText(location.href);toast("Course link copied 🔗");}catch(_){toast(location.href);}});
  safeOn("nameInput","input",e=>{if(e.target.readOnly)return;displayName=e.target.value.slice(0,24)||"someone";localStorage.setItem("lc_name",displayName);updateMyProgress({name:displayName});writePresence();});
  safeOn("goalSelect","change",e=>{currentGoal=e.target.value;updateMyProgress({goal:currentGoal});renderEverything();});
  safeOn("noAudioToggle","change",e=>{updateMyProgress({noAudio:!!e.target.checked});toast(e.target.checked?"Audio exercises turned off":"Audio exercises turned on");});
  safeOn("closeSession","click",closeSession);
  safeOn("smartPracticeBtn","click",()=>startPractice("weak"));
  safeOn("randomPracticeBtn","click",()=>startPractice("mixed"));
  safeOn("practiceMistakesBtn","click",()=>startPractice("mistakes"));
  safeOn("quickQuizBtn","click",()=>startQuiz("quick"));
  safeOn("vocabQuizBtn","click",()=>startQuiz("vocab"));
  safeOn("sentenceQuizBtn","click",()=>startQuiz("sentences"));
  safeOn("courseQuizBtn","click",()=>startQuiz("course"));
  safeOn("generateWorksheetBtn","click",generateWorksheet);
  safeOn("printWorksheetBtn","click",printWorksheet);
  safeOn("assignLessonHomework","click",assignLessonHomework);
  safeOn("createHomework","click",createHomework);
  safeOn("sendSuggestion","click",sendSuggestion);
  safeOn("addPhrase","click",addPhrase);
  safeOn("bookSearch","input",renderPhrasebook);
}
function updateMyProgress(values){ return update(ref(db,rootPath(`progress/${identityKey()}`)),{name:displayName||"someone",goal:currentGoal,updated:now(),...values}); }

function populateLessonSelects(){
  const options=LESSONS.map((l,i)=>`<option value="${esc(l.id)}">${i+1}. ${esc(l.title)}</option>`).join("");
  ["quizLessonSelect","worksheetLessonSelect","suggestLesson","bookLesson"].forEach(id=>{const el=$(id);if(el)el.innerHTML=options;});
}
function renderEverything(){
  renderStats(); renderPath(); renderLessonOverview(); renderWeakWords(); renderMistakes(); renderQuizHistory(); renderWorksheetHistory(); renderHomework(); renderPartnerProgress(); renderSuggestions(); renderPhrasebook(); populatePartnerTargets();
}
function renderStats(){
  const me=mine();
  const complete=LESSONS.reduce((n,l)=>n+(lessonProgress(l.id).completed?1:0),0);
  const practiced=Object.values(me.mastery||{}).filter(v=>Number(v)>0).length;
  const quizzes=Object.values(me.quizzes||{}).filter(Boolean).length;
  const homeworkDone=Object.values(homeworkData).filter(hw=>hw&&hw.submissions&&hw.submissions[identityKey()]&&hw.submissions[identityKey()].text).length;
  const worksheets=Object.values(myWorksheets()).filter(Boolean).length;
  $("lessonsStat").textContent=`${complete} / ${LESSONS.length}`;
  $("wordsStat").textContent=String(practiced);
  $("quizzesStat").textContent=String(quizzes);
  $("assignmentsStat").textContent=String(homeworkDone+worksheets);
}
function recommendedLessonIndex(){ const idx=LESSONS.findIndex(l=>!lessonProgress(l.id).completed); return idx<0?LESSONS.length-1:idx; }
function renderPath(){
  const box=$("pathList"); if(!box)return; box.innerHTML="";
  const recommended=recommendedLessonIndex();
  LESSONS.forEach((lesson,index)=>{
    const p=lessonProgress(lesson.id),done=!!p.completed,current=index===currentLessonIndex;
    const wrap=document.createElement("div");wrap.className="pathNodeWrap";
    const btn=document.createElement("button");btn.className="pathNode "+(done?"done ":"")+(current?"current ":"")+(index===recommended&&!done?"recommended":"");btn.textContent=done?"✓":lesson.emoji;btn.title=lesson.title;btn.addEventListener("click",()=>selectLesson(index));
    const info=document.createElement("div");info.className="pathInfo";const best=Number(p.bestScore||0);info.innerHTML=`<strong>${index+1}. ${esc(lesson.title)}</strong><span class="${index===recommended&&!done?"recommended":""}">${done?`Completed${best?` · best recall ${best}%`:""}`:index===recommended?"Recommended next":"Available anytime"}</span>`;
    wrap.append(btn,info);box.appendChild(wrap);
  });
}
function selectLesson(index){
  currentLessonIndex=index;updateMyProgress({currentLesson:LESSONS[index].id});writePresence();renderPath();renderLessonOverview();
  if($("quizLessonSelect")) $("quizLessonSelect").value=LESSONS[index].id;
  if($("worksheetLessonSelect")) $("worksheetLessonSelect").value=LESSONS[index].id;
}
function direction(){ return currentGoal==="en"?"en":currentGoal==="both"?"mix":"pt"; }
function customPhraseRowsFor(lessonId){
  return Object.entries(phrasebookData).filter(([,v])=>v && (v.owner===identityKey()||(!v.owner&&v.by===identityKey())) && (v.lessonId||LESSONS[0].id)===lessonId);
}
function allLessonItems(lesson){
  const built=lesson.vocab.concat(lesson.phrases).map(([en,pt],i)=>({en,pt,key:`${lesson.id}_${slug(en)}_${i}`,lessonId:lesson.id,isPhrase:i>=lesson.vocab.length,custom:false}));
  const custom=customPhraseRowsFor(lesson.id).map(([id,v])=>({en:v.en,pt:v.pt,key:`custom_${id}`,lessonId:lesson.id,isPhrase:true,custom:true,note:v.note||""}));
  return built.concat(custom);
}
function masteryFor(item){ return Number((mine().mastery||{})[item.key]||0); }
function renderLessonOverview(){
  const box=$("lessonOverview");if(!box)return;
  const lesson=LESSONS[currentLessonIndex],p=lessonProgress(lesson.id),items=allLessonItems(lesson),done=!!p.completed;
  box.innerHTML=`<div class="lessonBanner"><div class="lessonEmoji">${lesson.emoji}</div><div><h2>${esc(lesson.title)}</h2><p>${esc(lesson.goal)}</p><div class="lessonMeta"><span class="tag">${items.length} words & phrases</span><span class="tag">${done?"Completed":"Not completed yet"}</span>${p.bestScore?`<span class="tag">Best independent recall ${Number(p.bestScore)}%</span>`:""}</div></div></div>
    <div class="lessonActions"><button class="btn primary" id="startLessonBtn">${done?"Study this lesson again":"Start guided lesson"}</button><button class="btn purple" id="lessonQuizBtn">✅ Quiz this lesson</button><button class="btn blue" id="lessonWorksheetBtn">📝 Make worksheet</button>${noAudio()?"":`<button class="btn" id="previewAudioBtn">🔊 Hear lesson words</button>`}</div>
    <h3 style="margin:0 0 4px">What you’ll do</h3><div class="skillGrid"><div class="skill"><strong>🧠 Learn first</strong><p>New material is shown before it is tested.</p></div><div class="skill"><strong>🧩 Build sentences</strong><p>Put useful phrases together in the right order.</p></div><div class="skill"><strong>⌨️ Recall</strong><p>Type answers from memory. Accents are optional.</p></div><div class="skill"><strong>🔎 Use clues</strong><p>Tap highlighted words when you need help; clue-assisted answers return later.</p></div></div>
    <div class="wordPreview">${items.slice(0,8).map(item=>`<span class="wordChip">${esc(currentGoal==="en"?item.pt:item.en)} <b>→</b> ${esc(currentGoal==="en"?item.en:item.pt)}</span>`).join("")}</div>
    <div class="tip"><strong>Language note:</strong> ${esc(lesson.tip)}</div>`;
  safeOn("startLessonBtn","click",()=>startLesson(currentLessonIndex));
  safeOn("lessonQuizBtn","click",()=>{$("quizLessonSelect").value=lesson.id;switchTab("quizzes");});
  safeOn("lessonWorksheetBtn","click",()=>{$("worksheetLessonSelect").value=lesson.id;switchTab("assignments");generateWorksheet();});
  safeOn("previewAudioBtn","click",()=>speakSequence(lesson.vocab.slice(0,6)));
}
async function speakSequence(rows){ for(const [en,pt] of rows){ const dir=direction()==="en"?"en":"pt"; await speakAndWait(dir==="en"?en:pt,dir==="en"?"en-US":"pt-BR"); await new Promise(r=>setTimeout(r,150)); } }

function dirForIndex(i){ const d=direction(); return d==="mix"?(i%2?"en":"pt"):d; }
function focusItems(lesson,count=3){
  const items=allLessonItems(lesson); const grouped=[...items].sort((a,b)=>masteryFor(a)-masteryFor(b));
  const lowest=grouped.slice(0,Math.max(count,6)); return shuffle(lowest).slice(0,Math.min(count,items.length));
}
function choicePool(item,dir,lesson){
  const answer=dir==="pt"?item.pt:item.en;
  const pool=shuffle(allLessonItems(lesson).map(x=>dir==="pt"?x.pt:x.en).filter(x=>normalize(x)!==normalize(answer)));
  return shuffle([answer,...pool.slice(0,3)]);
}
function buildExercise(item,type,dir,lesson){
  const actualDir=dir==="mix"?"pt":dir;
  const target=actualDir==="pt"?item.pt:item.en;
  if(type==="listen" && noAudio()) type="choice";
  if(type==="bank" && (!target.includes(" ") || target.includes("/"))) type="type";
  if(type==="cloze" && (!target.includes(" ") || target.includes("/"))) type="choice";
  if(type==="listen") return {type,item,direction:actualDir,lessonId:lesson.id,choices:choicePool(item,actualDir==="pt"?"en":"pt",lesson)};
  if(type==="choice") return {type,item,direction:actualDir,lessonId:lesson.id,choices:choicePool(item,actualDir,lesson)};
  if(type==="cloze") return buildCloze(item,actualDir,lesson);
  return {type,item,direction:actualDir,lessonId:lesson.id};
}
function buildCloze(item,dir,lesson){
  const target=dir==="pt"?item.pt:item.en;
  const words=target.replace(/[.,!?…]/g,"").split(/\s+/).filter(Boolean);
  const candidates=words.filter(w=>normalize(w).length>2);
  const missing=candidates[Math.floor(Math.random()*candidates.length)]||words[Math.max(0,words.length-1)];
  const blanked=target.replace(new RegExp(`\\b${missing.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b`,"i"),"_____");
  const pool=shuffle(allLessonItems(lesson).flatMap(x=>(dir==="pt"?x.pt:x.en).replace(/[.,!?…]/g,"").split(/\s+/)).filter(w=>normalize(w)!==normalize(missing)&&normalize(w).length>2));
  return {type:"cloze",item,direction:dir,lessonId:lesson.id,missing,blanked,choices:shuffle([missing,...pool.slice(0,3)])};
}
function buildLessonExercises(lesson){
  const items=allLessonItems(lesson); if(!items.length)return[];
  const focus=focusItems(lesson,3),extras=shuffle(items.filter(x=>!focus.some(f=>f.key===x.key))),ex=[];
  focus.forEach((item,i)=>{
    const dir=dirForIndex(i);
    ex.push({type:"introduce",item,direction:dir,lessonId:lesson.id});
    ex.push(buildExercise(item,i===0?"choice":i===1?"type":"bank",dir,lesson));
  });
  const matchItems=shuffle(items).slice(0,Math.min(4,items.length)); if(matchItems.length>=2) ex.push({type:"match",items:matchItems,direction:direction(),lessonId:lesson.id});
  focus.forEach((item,i)=>ex.push(buildExercise(item,["type","listen","cloze"][i],dirForIndex(i+3),lesson)));
  extras.slice(0,2).forEach((item,i)=>ex.push(buildExercise(item,i?"bank":"choice",dirForIndex(i+6),lesson)));
  return ex.slice(0,SESSION_SIZE);
}
function buildPracticeExercises(mode){
  const all=LESSONS.flatMap(allLessonItems); const mistakes=Object.values(mine().mistakes||{}).filter(Boolean);
  let source=[];
  if(mode==="mistakes") source=mistakes.map(m=>({...m,key:m.key||`${m.lessonId}_${slug(m.en)}`,isPhrase:(m.en||"").includes(" ")}));
  else if(mode==="weak") source=[...all].sort((a,b)=>masteryFor(a)-masteryFor(b)).slice(0,18);
  else source=shuffle(all).slice(0,18);
  if(!source.length)source=shuffle(all).slice(0,18);
  const ex=[];
  source.slice(0,10).forEach((item,i)=>{const lesson=lessonById(item.lessonId)||LESSONS[0];ex.push(buildExercise(item,["choice","type","bank","listen","cloze"][i%5],dirForIndex(i),lesson));});
  if(source.length>=4)ex.splice(5,0,{type:"match",items:shuffle(source).slice(0,4),direction:direction(),lessonId:source[0].lessonId});
  return ex.slice(0,SESSION_SIZE);
}
function buildQuizExercises(kind,lessonId){
  let pool=[]; let count=10;
  if(kind==="course"){pool=LESSONS.flatMap(allLessonItems);count=20;}
  else{
    const lesson=lessonById(lessonId)||LESSONS[currentLessonIndex];
    pool=allLessonItems(lesson);
    if(kind==="vocab")pool=pool.filter(x=>!x.isPhrase);
    if(kind==="sentences")pool=pool.filter(x=>x.isPhrase);
    if(!pool.length)pool=allLessonItems(lesson);
    count=kind==="vocab"?12:10;
  }
  const selected=[]; while(selected.length<count&&pool.length){selected.push(...shuffle(pool).slice(0,Math.min(pool.length,count-selected.length)));}
  return selected.slice(0,count).map((item,i)=>{
    const lesson=lessonById(item.lessonId)||LESSONS[0];
    const types=kind==="sentences"?["bank","cloze","type","choice"]:kind==="vocab"?["choice","type","listen"]:["choice","type","bank","listen","cloze"];
    return buildExercise(item,types[i%types.length],dirForIndex(i),lesson);
  });
}
function startLesson(index){ startSession("lesson",buildLessonExercises(LESSONS[index]),{lessonIndex:index,title:LESSONS[index].title}); }
function startPractice(mode){
  const exercises=buildPracticeExercises(mode); if(!exercises.length){toast("There is nothing to review yet");return;}
  startSession("practice",exercises,{mode,title:mode==="mistakes"?"Mistakes review":mode==="weak"?"Weak words review":"Mixed review"});
}
function startQuiz(kind){
  const lessonId=$("quizLessonSelect")?.value||LESSONS[currentLessonIndex].id;
  const exercises=buildQuizExercises(kind,lessonId); if(!exercises.length){toast("This quiz has no material yet");return;}
  const title=kind==="course"?"Full course quiz":kind==="vocab"?"Vocabulary quiz":kind==="sentences"?"Sentence quiz":"Quick quiz";
  startSession("quiz",exercises,{quizKind:kind,lessonId:kind==="course"?"course":lessonId,title});
}
function startSession(kind,exercises,meta={}){
  activeSession={kind,exercises,position:0,correct:0,assisted:0,wrong:0,graded:0,locked:false,selected:null,bank:[],matched:0,usedClue:false,...meta};
  showSession();renderExercise();
}
function showSession(){ $("normalView").hidden=true;$("courseHeader").hidden=true;$("roomBar").hidden=true;$("sessionView").hidden=false;window.scrollTo({top:0,behavior:"smooth"}); }
function closeSession(){
  if(!activeSession)return;
  const started=activeSession.position>0;
  if(started&&!confirm("Leave this session? The unfinished attempt will not be saved."))return;
  exitSession();
}
function exitSession(){activeSession=null;$("sessionView").hidden=true;$("normalView").hidden=false;$("courseHeader").hidden=false;$("roomBar").hidden=false;renderEverything();}
function switchTab(name){const tab=$("tabs").querySelector(`[data-tab="${name}"]`);if(tab)tab.click();}
function targetText(ex){return ex.direction==="pt"?ex.item.pt:ex.item.en;}
function sourceText(ex){return ex.direction==="pt"?ex.item.en:ex.item.pt;}
function targetLang(ex){return ex.direction==="pt"?"pt-BR":"en-US";}
function sourceLang(ex){return ex.direction==="pt"?"en-US":"pt-BR";}

function wordClue(token,ex){
  const key=normalize(token); if(!key)return"";
  return ex.direction==="pt"?(WORD_MAP_EN_PT[key]||""):(WORD_MAP_PT_EN[key]||"");
}
function clueMarkup(text,ex){
  return String(text).split(/(\s+)/).map(part=>{
    if(/^\s+$/.test(part))return part;
    const clean=part.replace(/^[^A-Za-zÀ-ÿ]+|[^A-Za-zÀ-ÿ]+$/g,"");
    const clue=wordClue(clean,ex);
    return clue?`<button class="clueToken" type="button" data-clue="${esc(clue)}" title="Show word clue">${esc(part)}</button>`:esc(part);
  }).join("");
}
function clueTools(ex,fullLabel="Show the whole phrase meaning"){
  return `<div class="cluePopup" id="cluePopup"></div><div class="assistNote">Tap highlighted words for a clue. Clue-assisted answers are tracked separately.</div><button class="fullClueBtn" id="fullClueBtn" type="button">${esc(fullLabel)}</button>`;
}
function wireClues(ex,fullText=targetText(ex)){
  $("exerciseCard").querySelectorAll("[data-clue]").forEach(btn=>btn.addEventListener("click",()=>{
    activeSession.usedClue=true;ex.usedClue=true;$("cluePopup").textContent=btn.dataset.clue;
  }));
  safeOn("fullClueBtn","click",()=>{activeSession.usedClue=true;ex.usedClue=true;$("cluePopup").textContent=fullText;});
}
function renderExercise(){
  if(!activeSession)return;
  if(activeSession.position>=activeSession.exercises.length){finishSession();return;}
  activeSession.locked=false;activeSession.selected=null;activeSession.bank=[];activeSession.matched=0;activeSession.usedClue=false;
  const ex=activeSession.exercises[activeSession.position];
  $("sessionProgress").style.width=`${Math.round((activeSession.position/Math.max(1,activeSession.exercises.length))*100)}%`;
  $("sessionCount").textContent=`${activeSession.position+1} / ${activeSession.exercises.length}`;
  const card=$("exerciseCard");
  if(ex.type==="introduce")renderIntroduce(card,ex);
  else if(ex.type==="choice")renderChoice(card,ex,false);
  else if(ex.type==="listen")renderChoice(card,ex,true);
  else if(ex.type==="type")renderType(card,ex);
  else if(ex.type==="bank")renderBank(card,ex);
  else if(ex.type==="cloze")renderCloze(card,ex);
  else if(ex.type==="match")renderMatch(card,ex);
}
function baseCheckBar(label="Check"){return `<div class="checkBar"><div class="feedbackMsg" id="feedbackMsg"></div><button class="btn primary" id="checkAnswer">${label}</button></div>`;}
function renderIntroduce(card,ex){
  card.innerHTML=`<div class="exerciseType">Learn first</div><div class="exercisePrompt">Study this ${ex.item.isPhrase?"phrase":"word"}</div><div class="teachingPair"><div><span>${ex.direction==="pt"?"English":"Português"}</span><strong>${esc(sourceText(ex))}</strong></div><div class="teachArrow">↓</div><div><span>${ex.direction==="pt"?"Português":"English"}</span><strong>${esc(targetText(ex))}</strong></div></div>${noAudio()?"":`<button class="speakerBig" id="introSpeak">🔊</button>`}<div class="teachNote">You are seeing this before it is tested. Later questions will ask you to recognize it, build it, and recall it without the full answer.</div>${baseCheckBar("Continue")}`;
  safeOn("introSpeak","click",()=>speak(targetText(ex),targetLang(ex)));
  safeOn("checkAnswer","click",()=>{if(activeSession.locked)return;activeSession.locked=true;activeSession.position++;renderExercise();});
}
function renderChoice(card,ex,listening){
  const expected=listening?sourceText(ex):targetText(ex);
  const prompt=listening?"Choose what this means":`Translate into ${ex.direction==="pt"?"Portuguese":"English"}`;
  card.innerHTML=`<div class="exerciseType">${listening?"Listening":"Multiple choice"}</div><div class="exercisePrompt">${prompt}</div>${listening?`<button class="speakerBig" id="listenBtn">🔊</button><div style="text-align:center;margin-bottom:10px"><button class="btn sm" id="cantListenBtn">I can’t listen right now</button></div>${clueTools(ex,"Show what was said")}`:`<div class="bigWord clueBar">${clueMarkup(sourceText(ex),ex)}</div>${clueTools(ex)}`}<div class="choiceGrid">${ex.choices.map(c=>`<button class="choice" data-choice="${esc(c)}">${esc(c)}</button>`).join("")}</div>${baseCheckBar()}`;
  if(listening){safeOn("listenBtn","click",()=>speak(targetText(ex),targetLang(ex)));setTimeout(()=>speak(targetText(ex),targetLang(ex)),220);safeOn("cantListenBtn","click",()=>{updateMyProgress({noAudio:true});ex.type="choice";ex.choices=choicePool(ex.item,ex.direction,lessonById(ex.lessonId)||LESSONS[0]);renderExercise();});wireClues(ex,targetText(ex));}
  else wireClues(ex,targetText(ex));
  card.querySelectorAll(".choice").forEach(btn=>btn.addEventListener("click",()=>{if(activeSession.locked)return;activeSession.selected=btn.dataset.choice;card.querySelectorAll(".choice").forEach(b=>b.classList.toggle("selected",b===btn));}));
  safeOn("checkAnswer","click",()=>{if(!activeSession.selected){toast("Choose an answer first");return;}gradeCurrent(normalize(activeSession.selected)===normalize(expected),ex,activeSession.selected,expected);});
}
function renderType(card,ex){
  card.innerHTML=`<div class="exerciseType">Write the answer</div><div class="exercisePrompt">Translate into ${ex.direction==="pt"?"Portuguese":"English"}</div><div class="bigWord clueBar">${clueMarkup(sourceText(ex),ex)}</div>${clueTools(ex)}<input class="input typeAnswer" id="typedAnswer" autocomplete="off" autocapitalize="sentences" placeholder="Type your answer…" />${baseCheckBar()}`;
  wireClues(ex,targetText(ex));const input=$("typedAnswer");input.focus();input.addEventListener("keydown",e=>{if(e.key==="Enter")$("checkAnswer").click();});
  safeOn("checkAnswer","click",()=>{const answer=input.value.trim();if(!answer){toast("Type an answer first");return;}gradeCurrent(isCloseAnswer(answer,targetText(ex)),ex,answer);});
}
function isCloseAnswer(given,expected){
  const a=normalize(given),b=normalize(expected);if(a===b)return true;
  const variants=String(expected).split(/\s*\/\s*|\s*;\s*/).map(normalize);return variants.includes(a);
}
function renderBank(card,ex){
  const target=targetText(ex).replace(/[.,!?…]/g,"");const words=shuffle(target.split(/\s+/).filter(Boolean));
  card.innerHTML=`<div class="exerciseType">Build the sentence</div><div class="exercisePrompt">Put the translation in order</div><div class="bigWord clueBar" style="font-size:34px">${clueMarkup(sourceText(ex),ex)}</div>${clueTools(ex)}<div class="wordBank" id="answerBank"><span class="bankPlaceholder">Choose words below</span></div><div class="bankWords">${words.map((w,i)=>`<button class="bankWord" data-i="${i}" data-word="${esc(w)}">${esc(w)}</button>`).join("")}</div>${baseCheckBar()}`;
  wireClues(ex,targetText(ex));
  const redraw=()=>{$("answerBank").innerHTML=activeSession.bank.length?activeSession.bank.map((x,i)=>`<button class="answerWord" data-remove="${i}">${esc(x.word)}</button>`).join(""):`<span class="bankPlaceholder">Choose words below</span>`;card.querySelectorAll("[data-remove]").forEach(b=>b.addEventListener("click",()=>{const [removed]=activeSession.bank.splice(Number(b.dataset.remove),1);card.querySelector(`[data-i="${removed.i}"]`).disabled=false;redraw();}));};
  card.querySelectorAll(".bankWord").forEach(btn=>btn.addEventListener("click",()=>{activeSession.bank.push({word:btn.dataset.word,i:Number(btn.dataset.i)});btn.disabled=true;redraw();}));
  safeOn("checkAnswer","click",()=>{if(!activeSession.bank.length){toast("Build the sentence first");return;}const answer=activeSession.bank.map(x=>x.word).join(" ");gradeCurrent(normalize(answer)===normalize(target),ex,answer,targetText(ex));});
}
function renderCloze(card,ex){
  card.innerHTML=`<div class="exerciseType">Complete the sentence</div><div class="exercisePrompt">Choose the missing word</div><div class="clozeSource clueBar">${clueMarkup(sourceText(ex),ex)}</div>${clueTools(ex)}<div class="clozeSentence">${esc(ex.blanked)}</div><div class="choiceGrid">${ex.choices.map(c=>`<button class="choice" data-choice="${esc(c)}">${esc(c)}</button>`).join("")}</div>${baseCheckBar()}`;
  wireClues(ex,targetText(ex));
  card.querySelectorAll(".choice").forEach(btn=>btn.addEventListener("click",()=>{if(activeSession.locked)return;activeSession.selected=btn.dataset.choice;card.querySelectorAll(".choice").forEach(b=>b.classList.toggle("selected",b===btn));}));
  safeOn("checkAnswer","click",()=>{if(!activeSession.selected){toast("Choose a word first");return;}gradeCurrent(normalize(activeSession.selected)===normalize(ex.missing),ex,activeSession.selected,ex.missing);});
}
function renderMatch(card,ex){
  const pairs=ex.items.map((item,i)=>({i,item}));const left=shuffle(pairs.map(p=>({side:"left",i:p.i,text:p.item.en}))),right=shuffle(pairs.map(p=>({side:"right",i:p.i,text:p.item.pt})));
  card.innerHTML=`<div class="exerciseType">Matching</div><div class="exercisePrompt">Match each pair</div><div class="matchGrid"><div>${left.map(x=>`<button class="matchItem" style="width:100%;margin-bottom:9px" data-side="${x.side}" data-pair="${x.i}">${esc(x.text)}</button>`).join("")}</div><div>${right.map(x=>`<button class="matchItem" style="width:100%;margin-bottom:9px" data-side="${x.side}" data-pair="${x.i}">${esc(x.text)}</button>`).join("")}</div></div>${baseCheckBar("Continue")}`;
  let selected=null;
  card.querySelectorAll(".matchItem").forEach(btn=>btn.addEventListener("click",()=>{
    if(btn.classList.contains("matched")||activeSession.locked)return;
    if(!selected){selected=btn;btn.classList.add("selected");return;}
    if(selected.dataset.side===btn.dataset.side){selected.classList.remove("selected");selected=btn;btn.classList.add("selected");return;}
    if(selected.dataset.pair===btn.dataset.pair){selected.classList.remove("selected");selected.classList.add("matched");btn.classList.add("matched");activeSession.matched++;selected=null;if(activeSession.matched===ex.items.length){$("feedbackMsg").textContent="All pairs matched";$("feedbackMsg").className="feedbackMsg good";}}
    else{const first=selected;selected=null;first.classList.remove("selected");first.classList.add("bad");btn.classList.add("bad");setTimeout(()=>{first.classList.remove("bad");btn.classList.remove("bad");},260);}
  }));
  safeOn("checkAnswer","click",()=>{if(activeSession.matched<ex.items.length){toast("Match all pairs first");return;}if(activeSession.locked)return;activeSession.locked=true;activeSession.graded++;activeSession.correct++;ex.items.forEach(recordIndependentCorrect);activeSession.position++;renderExercise();});
}
function gradeCurrent(correct,ex,given,expectedOverride){
  if(activeSession.locked)return;activeSession.locked=true;activeSession.graded++;
  const card=$("exerciseCard"),msg=$("feedbackMsg"),btn=$("checkAnswer"),expected=expectedOverride||targetText(ex),assisted=!!(activeSession.usedClue||ex.usedClue);
  card.querySelectorAll("button.choice,.bankWord,.answerWord").forEach(b=>b.disabled=true);
  if(correct){
    if(assisted){activeSession.assisted++;msg.textContent="Correct with a clue — this will return once more for independent recall.";msg.className="feedbackMsg good";if(activeSession.kind!=="quiz"&&!ex.retry)activeSession.exercises.push({...ex,retry:true,usedClue:false});}
    else{activeSession.correct++;msg.textContent="Correct";msg.className="feedbackMsg good";recordIndependentCorrect(ex.item);}
    btn.textContent="Continue";highlightChoice(expected,true);
  }else{
    activeSession.wrong++;msg.innerHTML=`Not quite. A correct answer is <strong>${esc(expected)}</strong>`;msg.className="feedbackMsg bad";btn.textContent="Continue";highlightChoice(expected,false);recordWrong(ex,given);if(activeSession.kind!=="quiz"&&!ex.retry)activeSession.exercises.push({...ex,retry:true,usedClue:false});
  }
  btn.onclick=()=>{activeSession.position++;renderExercise();};
}
function highlightChoice(answer,correct){$("exerciseCard").querySelectorAll(".choice").forEach(b=>{if(normalize(b.dataset.choice)===normalize(answer))b.classList.add("correct");else if(b.classList.contains("selected")&&!correct)b.classList.add("wrong");});}
function recordIndependentCorrect(item){
  if(!item)return;const strength=clamp(masteryFor(item)+1,0,5);set(ref(db,rootPath(`progress/${identityKey()}/mastery/${item.key}`)),strength);remove(ref(db,rootPath(`progress/${identityKey()}/mistakes/${item.key}`))).catch(()=>{});
}
function recordWrong(ex,given){
  if(!ex.item)return;const old=(mine().mistakes||{})[ex.item.key]||{};
  set(ref(db,rootPath(`progress/${identityKey()}/mistakes/${ex.item.key}`)),{key:ex.item.key,en:ex.item.en,pt:ex.item.pt,lessonId:ex.item.lessonId,count:Number(old.count||0)+1,lastGiven:given||"",lastWrong:now()});
}
async function finishSession(){
  const s=activeSession,graded=Math.max(1,s.graded),overall=Math.round(((s.correct+s.assisted)/graded)*100),independent=Math.round((s.correct/graded)*100);
  const values={lastStudyAt:now(),lastSessionAccuracy:overall,lastIndependentRecall:independent};
  if(s.kind==="lesson"){
    const lesson=LESSONS[s.lessonIndex],old=lessonProgress(lesson.id);
    values[`lessons/${lesson.id}/attempts`]=Number(old.attempts||0)+1;
    values[`lessons/${lesson.id}/bestScore`]=Math.max(Number(old.bestScore||0),independent);
    values[`lessons/${lesson.id}/lastAttempt`]=now();values[`lessons/${lesson.id}/completed`]=true;values[`lessons/${lesson.id}/completedAt`]=old.completedAt||now();
    const next=LESSONS.slice(s.lessonIndex+1).find(l=>!lessonProgress(l.id).completed)||LESSONS.find(l=>l.id!==lesson.id&&!lessonProgress(l.id).completed);if(next)values.currentLesson=next.id;
    await updateMyProgress(values);
  }else if(s.kind==="quiz"){
    await updateMyProgress(values);
    const qref=push(ref(db,rootPath(`progress/${identityKey()}/quizzes`)));
    await set(qref,{kind:s.quizKind,lessonId:s.lessonId,title:s.title,overall,independent,assisted:s.assisted,wrong:s.wrong,t:now()});
  }else await updateMyProgress(values);
  $("sessionProgress").style.width="100%";
  const heading=s.kind==="lesson"?"Lesson finished":s.kind==="quiz"?"Quiz finished":"Review finished";
  const note=s.kind==="quiz"?"The independent recall score excludes answers completed with clues.":s.wrong?"Missed items were saved for review and may have returned during this session.":"You completed the session without any artificial limits or penalties.";
  $("exerciseCard").innerHTML=`<div class="resultCard" style="display:flex;flex-direction:column;min-height:430px"><div class="resultEmoji">${s.kind==="quiz"?"✅":s.wrong?"📚":"🎉"}</div><h2>${heading}</h2><p class="muted">${note}</p><div class="resultStats"><div class="resultStat"><strong>${independent}%</strong><span>independent recall</span></div><div class="resultStat"><strong>${s.assisted}</strong><span>answers with clues</span></div><div class="resultStat"><strong>${s.wrong}</strong><span>items to review</span></div></div><div style="display:flex;gap:9px;flex-wrap:wrap;justify-content:center"><button class="btn primary" id="finishDone">Continue</button>${s.wrong?`<button class="btn purple" id="finishReview">Review mistakes</button>`:""}</div></div>`;
  safeOn("finishDone","click",exitSession);safeOn("finishReview","click",()=>{exitSession();switchTab("review");});
}

function renderWeakWords(){
  const box=$("weakWordsList");if(!box)return;const all=LESSONS.flatMap(allLessonItems).sort((a,b)=>masteryFor(a)-masteryFor(b)).slice(0,10);
  if(!all.length){box.innerHTML=`<div class="empty">Start a lesson to build a review list.</div>`;return;}
  box.innerHTML=all.map(item=>{const m=masteryFor(item);return `<div class="reviewRow"><span>🧠</span><div class="grow"><strong>${esc(currentGoal==="en"?item.pt:item.en)}</strong><div class="muted">${esc(currentGoal==="en"?item.en:item.pt)}</div></div><div class="masteryDots" title="Familiarity ${m}/5">${[1,2,3,4,5].map(n=>`<span class="${n<=m?"on":""}"></span>`).join("")}</div></div>`;}).join("");
}
function renderMistakes(){
  const box=$("mistakeList");if(!box)return;const rows=Object.values(mine().mistakes||{}).filter(Boolean).sort((a,b)=>(b.lastWrong||0)-(a.lastWrong||0));
  if(!rows.length){box.innerHTML=`<div class="empty">Nothing is waiting here. Mistakes will appear as study notes, not penalties.</div>`;return;}
  box.innerHTML=rows.map(m=>`<div class="mistakeRow"><div><strong>${esc(m.en)}</strong><small>${esc(lessonById(m.lessonId)?.title||"Course review")}</small></div><div class="pt">${esc(m.pt)}<small>reviewed after ${Number(m.count||1)} miss${Number(m.count||1)===1?"":"es"}</small></div><button class="btn sm danger" data-forget="${esc(m.key)}">Remove</button></div>`).join("");
  box.querySelectorAll("[data-forget]").forEach(b=>b.addEventListener("click",()=>remove(ref(db,rootPath(`progress/${identityKey()}/mistakes/${b.dataset.forget}`)))));
}
function renderQuizHistory(){
  const box=$("quizHistoryList");if(!box)return;const rows=Object.entries(mine().quizzes||{}).filter(([,v])=>v).sort((a,b)=>(b[1].t||0)-(a[1].t||0)).slice(0,10);
  if(!rows.length){box.innerHTML=`<div class="empty">No quizzes yet. Results will appear here without ranks or XP.</div>`;return;}
  box.innerHTML=rows.map(([,q])=>`<div class="historyRow"><span>✅</span><div class="grow"><strong>${esc(q.title||"Quiz")}</strong><small>${q.lessonId&&q.lessonId!=="course"?esc(lessonById(q.lessonId)?.title||"")+" · ":""}${timeLabel(q.t)} · ${Number(q.assisted||0)} with clues</small></div><span class="scoreBadge">${Number(q.independent||0)}% recall</span></div>`).join("");
}

function generateWorksheet(){
  const lessonId=$("worksheetLessonSelect")?.value||LESSONS[currentLessonIndex].id,lesson=lessonById(lessonId)||LESSONS[currentLessonIndex],items=shuffle(allLessonItems(lesson));
  if(!items.length){toast("This lesson has no worksheet material");return;}
  const dir=direction()==="en"?"en":"pt";
  const match=items.slice(0,Math.min(4,items.length)).map(item=>({item,choices:choicePool(item,dir,lesson)}));
  const translate=items.slice(4,7).length?items.slice(4,7):items.slice(0,3);
  const sentence=(items.find(x=>x.isPhrase)||items[0]);
  worksheetState={lessonId:lesson.id,dir,match,translate,sentence,writing:lesson.homework,createdAt:now(),savedId:null};
  renderWorksheet();$("printWorksheetBtn").disabled=false;
}
function renderWorksheet(){
  const box=$("worksheetArea");if(!box||!worksheetState){if(box)box.innerHTML="";return;}
  const ws=worksheetState,lesson=lessonById(ws.lessonId),source=item=>ws.dir==="pt"?item.en:item.pt,target=item=>ws.dir==="pt"?item.pt:item.en;
  const wordBank=shuffle([...ws.match.map(x=>target(x.item)),...ws.translate.map(target)]).slice(0,8);
  box.innerHTML=`<article class="worksheetSheet"><div class="worksheetHeader"><div><h3>${lesson.emoji} ${esc(lesson.title)} worksheet</h3><p class="muted" style="margin:4px 0 0">${ws.dir==="pt"?"English → Portuguese":"Portuguese → English"}</p></div><span class="tag">Name: ${esc(displayName||"________")}</span></div>
    <details><summary>Helpful word bank</summary><div class="wordPreview">${wordBank.map(w=>`<span class="wordChip">${esc(w)}</span>`).join("")}</div></details>
    <section class="worksheetSection"><h4>A. Choose the matching translation</h4>${ws.match.map((row,i)=>`<div class="worksheetQuestion" data-wq="m${i}"><label>${i+1}. ${esc(source(row.item))}</label><select class="select" data-match="${i}"><option value="">Choose…</option>${row.choices.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("")}</select><span class="worksheetAnswer" hidden></span></div>`).join("")}</section>
    <section class="worksheetSection"><h4>B. Translate from memory</h4>${ws.translate.map((item,i)=>`<div class="worksheetQuestion" data-wq="t${i}"><label>${i+1}. ${esc(source(item))}</label><input class="input" data-translate="${i}" placeholder="Write the translation"/><span class="worksheetAnswer" hidden></span></div>`).join("")}</section>
    <section class="worksheetSection"><h4>C. Write the complete sentence</h4><div class="worksheetQuestion" data-wq="s0"><label>${esc(source(ws.sentence))}</label><input class="input" data-sentence placeholder="Write the full translation"/><span class="worksheetAnswer" hidden></span></div></section>
    <section class="worksheetSection"><h4>D. Use the language yourself</h4><div class="worksheetQuestion"><label>${esc(ws.writing)}</label><textarea class="textarea" data-writing placeholder="Write your response here..."></textarea></div></section>
    <button class="btn primary full" id="checkWorksheetBtn">Check and save worksheet</button><div id="worksheetResult"></div></article>`;
  safeOn("checkWorksheetBtn","click",checkWorksheet);
}
async function checkWorksheet(){
  if(!worksheetState)return;const ws=worksheetState,source=item=>ws.dir==="pt"?item.en:item.pt,target=item=>ws.dir==="pt"?item.pt:item.en;let correct=0,total=0;const answers={match:[],translate:[],sentence:"",writing:""};
  ws.match.forEach((row,i)=>{total++;const el=document.querySelector(`[data-match="${i}"]`),given=el.value,ok=isCloseAnswer(given,target(row.item));answers.match.push(given);markWorksheetQuestion(`m${i}`,ok,target(row.item));if(ok)correct++;});
  ws.translate.forEach((item,i)=>{total++;const el=document.querySelector(`[data-translate="${i}"]`),given=el.value.trim(),ok=isCloseAnswer(given,target(item));answers.translate.push(given);markWorksheetQuestion(`t${i}`,ok,target(item));if(ok)correct++;});
  total++;const sentenceEl=document.querySelector("[data-sentence]"),sentence=sentenceEl.value.trim(),sentenceOk=isCloseAnswer(sentence,target(ws.sentence));answers.sentence=sentence;markWorksheetQuestion("s0",sentenceOk,target(ws.sentence));if(sentenceOk)correct++;
  answers.writing=document.querySelector("[data-writing]").value.trim();const score=Math.round((correct/Math.max(1,total))*100);
  const payload={lessonId:ws.lessonId,direction:ws.dir,score,correct,total,answers,writingPrompt:ws.writing,t:now()};
  if(ws.savedId)await set(ref(db,rootPath(`worksheets/${identityKey()}/${ws.savedId}`)),payload);else{const item=push(ref(db,rootPath(`worksheets/${identityKey()}`)));ws.savedId=item.key;await set(item,payload);}
  $("worksheetResult").innerHTML=`<div class="worksheetResult">Auto-graded section: ${correct}/${total} (${score}%). Your open writing was saved for you and your partner to review.</div>`;toast("Worksheet saved 📝");
}
function markWorksheetQuestion(key,ok,answer){const q=document.querySelector(`[data-wq="${key}"]`);if(!q)return;q.classList.remove("correct","incorrect");q.classList.add(ok?"correct":"incorrect");const note=q.querySelector(".worksheetAnswer");note.hidden=ok;note.textContent=ok?"":`Suggested answer: ${answer}`;}
function printWorksheet(){if(!worksheetState){toast("Create a worksheet first");return;}document.body.classList.add("printingWorksheet");window.print();setTimeout(()=>document.body.classList.remove("printingWorksheet"),300);}
function renderWorksheetHistory(){
  const box=$("worksheetHistoryList");if(!box)return;const rows=Object.entries(myWorksheets()).filter(([,v])=>v).sort((a,b)=>(b[1].t||0)-(a[1].t||0)).slice(0,10);
  if(!rows.length){box.innerHTML=`<div class="empty">No saved worksheets yet.</div>`;return;}
  box.innerHTML=rows.map(([,w])=>`<div class="historyRow"><span>📝</span><div class="grow"><strong>${esc(lessonById(w.lessonId)?.title||"Worksheet")}</strong><small>${timeLabel(w.t)} · ${Number(w.correct||0)}/${Number(w.total||0)} auto-graded answers</small></div><span class="scoreBadge">${Number(w.score||0)}%</span></div>`).join("");
}

async function addHomework(title,instructions,target){
  const itemRef=push(ref(db,rootPath("homework")));await set(itemRef,{title,instructions,target,createdBy:identityKey(),createdName:displayName||"someone",lessonId:LESSONS[currentLessonIndex].id,t:now()});toast("Homework added 📝");
}
function assignLessonHomework(){const l=LESSONS[currentLessonIndex];addHomework(`${l.emoji} ${l.title} homework`,l.homework,"both");}
function createHomework(){const title=$("hwTitle").value.trim(),instructions=$("hwInstructions").value.trim(),target=$("hwTarget").value;if(!title||!instructions){toast("Add a title and instructions");return;}addHomework(title,instructions,target);$("hwTitle").value="";$("hwInstructions").value="";}
function renderHomework(){
  const box=$("homeworkList");if(!box)return;const entries=Object.entries(homeworkData).filter(([,v])=>v&&(v.target!=="self"||v.createdBy===identityKey())).sort((a,b)=>(b[1].t||0)-(a[1].t||0));
  if(!entries.length){box.innerHTML=`<div class="empty">No homework yet. Add the selected lesson’s writing task or create your own.</div>`;return;}
  box.innerHTML=entries.map(([id,hw])=>{const submissions=Object.entries(hw.submissions||{}),mineSub=(hw.submissions||{})[identityKey()]||{};return `<article class="hwCard"><div class="hwHead"><span style="font-size:22px">📝</span><div class="hwMain"><div class="hwTitle">${esc(hw.title)}</div><div class="hwMeta">${targetLabel(hw.target)} · added by ${esc(hw.createdName||"someone")}</div></div>${hw.createdBy===identityKey()?`<button class="btn sm danger" data-delete-hw="${esc(id)}">Delete</button>`:""}</div><div class="hwInstructions">${esc(hw.instructions)}</div><textarea class="textarea" data-hw-answer="${esc(id)}" placeholder="Write your answer here…">${esc(mineSub.text||"")}</textarea><button class="btn purple sm" data-save-hw="${esc(id)}" style="margin-top:8px">Save my answer</button><div>${submissions.map(([key,sub])=>`<div class="submission"><strong>${esc(sub.name||"someone")}${key===identityKey()?" (you)":""}</strong><p>${esc(sub.text||"")}</p>${sub.feedback?`<div class="feedback">💛 ${esc(sub.feedback)}</div>`:""}${key!==identityKey()?`<div style="display:flex;gap:7px;margin-top:8px"><input class="input" style="padding:8px" data-feedback-input="${esc(id)}|${esc(key)}" value="${esc(sub.feedback||"")}" placeholder="Kind correction or encouragement"/><button class="btn sm" data-save-feedback="${esc(id)}|${esc(key)}">Save</button></div>`:""}</div>`).join("")}</div></article>`;}).join("");
  box.querySelectorAll("[data-save-hw]").forEach(b=>b.addEventListener("click",()=>saveHomeworkAnswer(b.dataset.saveHw)));box.querySelectorAll("[data-delete-hw]").forEach(b=>b.addEventListener("click",()=>remove(ref(db,rootPath(`homework/${b.dataset.deleteHw}`)))));box.querySelectorAll("[data-save-feedback]").forEach(b=>b.addEventListener("click",()=>saveFeedback(b.dataset.saveFeedback)));
}
function targetLabel(target){return target==="self"?"Personal homework":"Both learners can answer";}
function saveHomeworkAnswer(id){const text=document.querySelector(`[data-hw-answer="${CSS.escape(id)}"]`).value.trim();if(!text){toast("Write an answer first");return;}set(ref(db,rootPath(`homework/${id}/submissions/${identityKey()}`)),{name:displayName||"someone",text,t:now()});toast("Homework saved ✓");}
function saveFeedback(key){const [hwId,studentId]=key.split("|");const input=document.querySelector(`[data-feedback-input="${CSS.escape(key)}"]`);update(ref(db,rootPath(`homework/${hwId}/submissions/${studentId}`)),{feedback:input.value.trim(),feedbackBy:displayName||"someone",feedbackT:now()});toast("Feedback saved 💛");}

function populatePartnerTargets(){
  const select=$("suggestTarget");if(!select)return;const current=select.value;const rows=Object.entries(progressData).filter(([key,v])=>key!==identityKey()&&v&&v.name);
  select.innerHTML=rows.length?rows.map(([key,v])=>`<option value="${esc(key)}">${esc(v.name)}</option>`).join(""):`<option value="">No partner found yet</option>`;
  if(rows.some(([key])=>key===current))select.value=current;
}
function onlineIdentity(key){return Object.values(presenceData).some(v=>v&&(v.idk===key)&&now()-(v.t||0)<70000);}
function partnerAssignmentCount(key){const hw=Object.values(homeworkData).filter(x=>x&&x.submissions&&x.submissions[key]&&x.submissions[key].text).length;const ws=Object.values(worksheetData[key]||{}).filter(Boolean).length;return hw+ws;}
function renderPartnerProgress(){
  const box=$("partnerProgressList");if(!box)return;const rows=Object.entries(progressData).filter(([key,v])=>key!==identityKey()&&v&&v.name);
  if(!rows.length){box.innerHTML=`<div class="empty">Your partner’s progress appears after they open the course.</div>`;return;}
  box.innerHTML=rows.map(([key,v])=>{const done=Object.values(v.lessons||{}).filter(x=>x===true||(x&&x.completed)).length,quizzes=Object.values(v.quizzes||{}).filter(Boolean).length,words=Object.values(v.mastery||{}).filter(x=>Number(x)>0).length,current=lessonById(v.currentLesson)?.title||"Not started";return `<div class="partnerCard"><div class="partnerCardHead"><span>${onlineIdentity(key)?"🟢":"💞"}</span><div><strong>${esc(v.name)}</strong><small>${goalLabel(v.goal)} · currently ${esc(current)}</small></div></div><div class="partnerMetrics"><div><strong>${done}/${LESSONS.length}</strong><span>lessons</span></div><div><strong>${quizzes}</strong><span>quizzes</span></div><div><strong>${partnerAssignmentCount(key)}</strong><span>assignments</span></div></div><div class="muted">${words} words practiced</div></div>`;}).join("");
}
function goalLabel(goal){return goal==="en"?"learning English":goal==="both"?"practicing both":"learning Portuguese";}
async function sendSuggestion(){
  const to=$("suggestTarget").value,en=$("suggestEn").value.trim(),pt=$("suggestPt").value.trim(),lessonId=$("suggestLesson").value,note=$("suggestNote").value.trim();
  if(!to){toast("Your partner needs to open the course first");return;}if(!en||!pt){toast("Add both English and Portuguese");return;}
  const item=push(ref(db,rootPath("suggestions")));await set(item,{to,from:identityKey(),fromName:displayName||"someone",toName:progressData[to]?.name||"partner",en,pt,lessonId,note,status:"pending",t:now()});
  $("suggestEn").value="";$("suggestPt").value="";$("suggestNote").value="";toast("Phrase suggestion sent 💞");
}
function renderSuggestions(){
  const incoming=$("incomingSuggestions"),sent=$("sentSuggestions");if(!incoming||!sent)return;
  const entries=Object.entries(suggestionsData).filter(([,v])=>v);
  const inc=entries.filter(([,v])=>v.to===identityKey()).sort((a,b)=>(b[1].t||0)-(a[1].t||0));
  const out=entries.filter(([,v])=>v.from===identityKey()).sort((a,b)=>(b[1].t||0)-(a[1].t||0));
  incoming.innerHTML=inc.length?inc.map(([id,v])=>suggestionCard(id,v,true)).join(""):`<div class="empty">No phrase suggestions waiting.</div>`;
  sent.innerHTML=out.length?out.map(([id,v])=>suggestionCard(id,v,false)).join(""):`<div class="empty">You have not sent any suggestions.</div>`;
  incoming.querySelectorAll("[data-accept-suggestion]").forEach(b=>b.addEventListener("click",()=>acceptSuggestion(b.dataset.acceptSuggestion)));
  incoming.querySelectorAll("[data-dismiss-suggestion]").forEach(b=>b.addEventListener("click",()=>update(ref(db,rootPath(`suggestions/${b.dataset.dismissSuggestion}`)),{status:"dismissed",respondedAt:now()})));
}
function suggestionCard(id,v,incoming){return `<div class="suggestionCard"><div class="suggestionHead"><strong>${incoming?`From ${esc(v.fromName||"partner")}`:`To ${esc(v.toName||"partner")}`}</strong><span class="statusPill ${esc(v.status||"pending")}">${esc(v.status||"pending")}</span></div><div class="suggestionPair"><span>${esc(v.en)}</span><span>${esc(v.pt)}</span></div><div class="muted">${esc(lessonById(v.lessonId)?.title||"Lesson phrase")}${v.note?` · ${esc(v.note)}`:""}</div>${incoming&&(v.status||"pending")==="pending"?`<div class="suggestionActions"><button class="btn sm primary" data-accept-suggestion="${esc(id)}">Add to my lesson</button><button class="btn sm" data-dismiss-suggestion="${esc(id)}">Dismiss</button></div>`:""}</div>`;}
async function acceptSuggestion(id){
  const v=suggestionsData[id];if(!v)return;const item=push(ref(db,rootPath("phrasebook")));await set(item,{en:v.en,pt:v.pt,note:v.note||`Suggested by ${v.fromName||"partner"}`,owner:identityKey(),by:identityKey(),name:displayName||"someone",lessonId:v.lessonId||LESSONS[0].id,sourceSuggestion:id,t:now()});await update(ref(db,rootPath(`suggestions/${id}`)),{status:"accepted",respondedAt:now()});toast("Added to your lesson 💬");
}

function addPhrase(){
  const en=$("bookEn").value.trim(),pt=$("bookPt").value.trim(),note=$("bookNote").value.trim(),lessonId=$("bookLesson").value;
  if(!en||!pt){toast("Add both English and Portuguese");return;}
  const item=push(ref(db,rootPath("phrasebook")));set(item,{en,pt,note,owner:identityKey(),by:identityKey(),name:displayName||"someone",lessonId,t:now()});$("bookEn").value="";$("bookPt").value="";$("bookNote").value="";toast("Added to your lessons 💬");
}
function renderPhrasebook(){
  const box=$("phrasebookList");if(!box)return;const q=($("bookSearch")?.value||"").trim().toLowerCase();const rows=Object.entries(phrasebookData).filter(([,v])=>v&&(v.owner===identityKey()||(!v.owner&&v.by===identityKey()))&&(!q||`${v.en} ${v.pt} ${v.note||""}`.toLowerCase().includes(q))).sort((a,b)=>(b[1].t||0)-(a[1].t||0));
  if(!rows.length){box.innerHTML=`<div class="empty">Your custom phrase list is empty. Add something you genuinely want to say.</div>`;return;}
  box.innerHTML=rows.map(([id,v])=>`<div class="bookRow"><div><strong>${esc(v.en)}</strong> ${noAudio()?"":speakerButton(v.en,"en-US")}</div><div class="bookPt">${esc(v.pt)} ${noAudio()?"":speakerButton(v.pt,"pt-BR")}</div><div class="bookNote">${esc(lessonById(v.lessonId||LESSONS[0].id)?.title||"")}${v.note?` · ${esc(v.note)}`:""}</div><button class="btn sm danger" data-delete-book="${esc(id)}">Delete</button></div>`).join("");
  box.querySelectorAll("[data-say]").forEach(b=>b.addEventListener("click",()=>speak(b.dataset.say,b.dataset.lang)));box.querySelectorAll("[data-delete-book]").forEach(b=>b.addEventListener("click",()=>remove(ref(db,rootPath(`phrasebook/${b.dataset.deleteBook}`)))));
}

function speak(text,lang){
  if(noAudio()){toast("Audio is turned off in your course settings");return;}
  if(!("speechSynthesis" in window)){toast("Speech playback is not supported in this browser");return;}
  speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang=lang;u.rate=.84;const voices=speechSynthesis.getVoices();const exact=voices.find(v=>v.lang.toLowerCase()===lang.toLowerCase())||voices.find(v=>v.lang.toLowerCase().startsWith(lang.slice(0,2).toLowerCase()));if(exact)u.voice=exact;speechSynthesis.speak(u);
}
function speakAndWait(text,lang){return new Promise(resolve=>{if(noAudio()||!("speechSynthesis" in window)){resolve();return;}speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang=lang;u.rate=.84;u.onend=resolve;u.onerror=resolve;speechSynthesis.speak(u);});}
function speakerButton(text,lang){return `<button class="speak" data-say="${esc(text)}" data-lang="${lang}" title="Hear pronunciation">🔊</button>`;}

window.addEventListener("DOMContentLoaded",waitForRooms);
