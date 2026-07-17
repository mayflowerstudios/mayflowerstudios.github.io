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


const MANUAL_CLUE_PAIRS = [
  ["I","eu"],["I am","estou"],["I'm","estou"],["I'll","vou"],["I want","quero"],["I need","preciso"],["I know","sei"],["I just","acabei de"],
  ["me","me"],["me","mim"],["my","meu"],["my","minha"],["mine","meu"],["mine","minha"],
  ["you","você"],["you all","vocês"],["you are","você está"],["you are","você é"],["you're","você está"],["you're","você é"],["your","seu"],["your","sua"],
  ["we","nós"],["we are","estamos"],["we're","estamos"],["they","eles"],["they","elas"],["it","isso"],["this","isso"],["that","aquilo"],
  ["what","o que"],["what","qual"],["what is","o que é"],["what is","qual é"],["which","qual"],["how","como"],["where","onde"],["when","quando"],["why","por que"],["who","quem"],
  ["is","é"],["is","está"],["are","está"],["are","são"],["am","estou"],["am","sou"],["was","estava"],["was","foi"],["were","estavam"],["were","eram"],
  ["do","fazer"],["does","faz"],["doing","fazendo"],["did","fez"],["have","ter"],["have","tenho"],["has","tem"],
  ["want","querer"],["want","quer"],["wants","quer"],["need","precisar"],["need","preciso"],["can","poder"],["can","pode"],["could","poderia"],
  ["will","vai"],["will","vou"],["would","iria"],["would like","gostaria"],["would like","queria"],["wanted","queria"],["to you","te"],["you","te"],["to hug","abraçar"],["let's","vamos"],["please","por favor"],
  ["with","com"],["with me","comigo"],["with you","com você"],["for","para"],["for","por"],["for you","para você"],["from","de"],["to","para"],["about","sobre"],["of","de"],
  ["in","em"],["on","em"],["on","sobre"],["at","em"],["at","às"],["and","e"],["or","ou"],["but","mas"],["because","porque"],
  ["not","não"],["no","não"],["yes","sim"],["the","o"],["the","a"],["the","os"],["the","as"],["a","um"],["a","uma"],["one","um"],["one","uma"],
  ["some","algum"],["some","um pouco"],["more","mais"],["very","muito"],["little","pouco"],["again","de novo"],["already","já"],["yet","já"],["yet","ainda"],["still","ainda"],
  ["well","bem"],["good","bom"],["good","boa"],["nice","legal"],["later","mais tarde"],["after","depois"],["finally","finalmente"],["together","juntas"],
  ["today","hoje"],["tomorrow","amanhã"],["yesterday","ontem"],["now","agora"],["morning","manhã"],["afternoon","tarde"],["night","noite"],["time","horário"],["time","tempo"],
  ["free","livre"],["busy","ocupada"],["tired","cansada"],["hungry","com fome"],["sleepy","com sono"],["happy","feliz"],["sad","triste"],["worried","preocupada"],["calm","calma"],["angry","brava"],["afraid","com medo"],["safe","segura"],["proud","orgulhosa"],
  ["love","amor"],["love you","te amo"],["beautiful","linda"],["cute","fofa"],["favorite","favorita"],["person","pessoa"],["name","nome"],["kiss","beijo"],["hug","abraço"],["girlfriend","namorada"],
  ["talk","falar"],["talk","conversar"],["speak","falar"],["say","dizer"],["tell","contar"],["tell me","me conta"],["ask","perguntar"],["call you","te ligar"],
  ["understand","entender"],["explain","explicar"],["repeat","repetir"],["mean","significar"],["means","significa"],["meaning","significado"],["know","saber"],["learn","aprender"],["learning","aprendendo"],["try","tentar"],["help","ajuda"],["help","ajudar"],["wait","esperar"],
  ["sleep","dormir"],["slept","dormiu"],["wake up","acordar"],["woke up","acordei"],["eat","comer"],["ate","comeu"],["eaten","comido"],["cook","cozinhar"],["drink","beber"],
  ["work","trabalhar"],["working","trabalhando"],["play","jogar"],["come","vir"],["come","vem"],["give","dar"],["give me","me dar"],["make","fazer"],["makes","faz"],["feel","sentir"],["feels","sente"],["arrive","chegar"],["arrives","chega"],["see","ver"],["see you","te ver"],
  ["here","aqui"],["there","ali"],["word","palavra"],["sentence","frase"],["mistake","erro"],["slowly","devagar"],["more slowly","mais devagar"],
  ["okay","tudo bem"],["be okay","ficar tudo bem"],["I can't wait","mal posso esperar"],["can't","não posso"],["don't","não"],["doesn't","não"],
  ["bathroom","banheiro"],["house","casa"],["bed","cama"],["shower","banho"],["food","comida"],["coffee","café"],["flight","voo"],["reservation","reserva"],["game","jogo"],
  ["eight","oito"],["day","dia"],["weekend","fim de semana"],["right","direita"],["left","esquerda"],["behind you","atrás de você"]
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
let suggestionData = {};
let currentGoal = "pt";
let displayName = localStorage.getItem("lc_name") || "";
let currentTab = "learn";
let connected = false;
let activeSession = null;
let noAudio = localStorage.getItem("lc_no_audio") === "true";
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
  $("connText").textContent=connected?"Progress synced":"Offline";
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
    if(typeof me.noAudio === "boolean") noAudio=me.noAudio;
    if(me.currentLesson){ const idx=LESSONS.findIndex(l=>l.id===me.currentLesson); if(idx>=0) currentLessonIndex=idx; }
    $("goalSelect").value=currentGoal;
    if($("noAudioToggle")) $("noAudioToggle").checked=noAudio;
    renderEverything();
  });
  onValue(ref(db,rootPath("suggestions")),snap=>{suggestionData=snap.val()||{};renderPartner();});
  get(ref(db,rootPath(`progress/${identityKey()}`))).then(s=>{
    if(!s.exists()) update(ref(db,rootPath(`progress/${identityKey()}`)),{name:displayName||"someone",goal:currentGoal,noAudio,hearts:MAX_HEARTS,xp:0,streak:0,currentLesson:LESSONS[0].id,updated:now()});
  });
}
function setupActions(){
  $("copyRoomBtn").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(location.href);toast("Partner invite copied 🔗");}catch(_){toast(location.href);}});
  $("nameInput").addEventListener("input",e=>{if(e.target.readOnly)return;displayName=e.target.value.slice(0,24)||"someone";localStorage.setItem("lc_name",displayName);writePresence();updateMyProgress({name:displayName});});
  $("goalSelect").addEventListener("change",e=>{currentGoal=e.target.value;updateMyProgress({name:displayName||"someone",goal:currentGoal});renderLessonOverview();renderPhrasebook();});
  $("noAudioToggle").addEventListener("change",e=>setNoAudio(e.target.checked));
  $("closeSession").addEventListener("click",closeSession);
  $("smartPracticeBtn").addEventListener("click",()=>startPractice("weak"));
  $("randomPracticeBtn").addEventListener("click",()=>startPractice("mixed"));
  $("practiceMistakesBtn").addEventListener("click",()=>startPractice("mistakes"));
  $("refillHeartsBtn").addEventListener("click",()=>startPractice("hearts"));
  $("sendSuggestion").addEventListener("click",sendSuggestion);
  $("addPhrase").addEventListener("click",addPhrase);
  $("bookSearch").addEventListener("input",renderPhrasebook);
  populateLessonSelects();
}
function updateMyProgress(values){ return update(ref(db,rootPath(`progress/${identityKey()}`)),{name:displayName||"someone",goal:currentGoal,noAudio,updated:now(),...values}); }
function setNoAudio(value){
  noAudio=!!value; localStorage.setItem("lc_no_audio",String(noAudio));
  if($("noAudioToggle")) $("noAudioToggle").checked=noAudio;
  updateMyProgress({noAudio});
  if(activeSession && noAudio){
    activeSession.exercises=activeSession.exercises.map(ex=>ex.type==="listen"?buildExercise(ex.item,"choice",ex.direction,lessonById(ex.item.lessonId)||LESSONS[0]):ex);
  }
  renderLessonOverview();
  toast(noAudio?"Audio exercises replaced with visual practice 🔇":"Audio exercises enabled 🔊");
}
function populateLessonSelects(){
  const options=LESSONS.map((l,i)=>`<option value="${l.id}">${i+1}. ${esc(l.title)}</option>`).join("");
  if($("bookLesson")) $("bookLesson").innerHTML=options;
  if($("suggestLesson")) $("suggestLesson").innerHTML=options;
}

function renderEverything(){ renderStats();renderPath();renderLessonOverview();renderWeakWords();renderMistakes();renderPartner();renderPhrasebook(); }
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
  const learned=allLessonItems(lesson).length; const customCount=customItemsForLesson(lesson.id).length;
  const langLabel=currentGoal==="en"?"Portuguese → English":currentGoal==="both"?"Both directions":"English → Portuguese";
  box.innerHTML=`
    <div class="lessonBanner"><div class="lessonEmoji">${lesson.emoji}</div><div><h2>${currentLessonIndex+1}. ${esc(lesson.title)}</h2><p>${esc(lesson.goal)}</p><div class="lessonMeta"><span class="tag">${learned} words & phrases</span><span class="tag">${langLabel}</span><span class="tag">${noAudio?"Audio-free":"Audio included"}</span>${customCount?`<span class="tag">${customCount} custom</span>`:""}</div></div></div>
    <div class="progressTrack"><div class="progressFill" style="width:${done?100:score}%"></div></div><div class="progressText"><span>${done?"Lesson complete":"Best lesson score"}</span><span>${done?`${Number(p.stars||1)} star${Number(p.stars||1)===1?"":"s"}`:`${score}%`}</span></div>
    <div class="lessonActions"><button class="btn primary" id="startLessonBtn" ${unlocked?"":"disabled"}>${done?"Practice again":"Start lesson"}</button>${noAudio?`<button class="btn purple" id="enableAudioBtn">🔇 Audio exercises off</button>`:`<button class="btn purple" id="previewAudioBtn">🔊 Hear lesson words</button>`}</div>
    <h3 style="margin:0 0 4px">What you’ll actually do</h3><div class="skillGrid"><div class="skill"><strong>💡 Tap-for-meaning clues</strong><p>Tap highlighted words for small translation clues. Anything answered with help returns later.</p></div><div class="skill"><strong>${noAudio?"👀 Meaning recognition":"👂 Listening"}</strong><p>${noAudio?"Choose meanings from written prompts instead of relying on sound.":"Hear words naturally and identify what was said."}</p></div><div class="skill"><strong>🧩 Sentence building</strong><p>Put complete phrases together in the right order.</p></div><div class="skill"><strong>⌨️ Typed recall</strong><p>Type translations from memory. Accents and punctuation are optional.</p></div><div class="skill"><strong>🔗 Matching</strong><p>Connect English and Portuguese without revealing cards.</p></div></div>
    <h3 style="margin:19px 0 4px">Lesson vocabulary</h3><div class="wordPreview">${allLessonItems(lesson).slice(0,10).map(item=>`<span class="wordChip">${esc(item.en)} · <b>${esc(item.pt)}</b>${item.custom?" ✨":""}</span>`).join("")}</div>
    <div class="tip"><strong>Language note:</strong> ${esc(lesson.tip)}<br><br><strong>Typing:</strong> You never lose a heart for missing an accent mark.<br><br><strong>Knowing it:</strong> New words are taught first. Answers completed with clues receive half credit and return later for an independent answer.</div>`;
  $("startLessonBtn").addEventListener("click",()=>startLesson(currentLessonIndex));
  if($("previewAudioBtn")) $("previewAudioBtn").addEventListener("click",()=>speakSequence(lesson.vocab.slice(0,5)));
  if($("enableAudioBtn")) $("enableAudioBtn").addEventListener("click",()=>setNoAudio(false));
}
async function speakSequence(rows){ for(const [en,pt] of rows){ const text=direction()==="en"?en:pt; await speakAndWait(text,direction()==="en"?"en-US":"pt-BR"); await new Promise(r=>setTimeout(r,180)); } }

function customItemsForLesson(lessonId){
  return Object.entries(mine().customPhrases||{}).filter(([,v])=>v&&v.lessonId===lessonId&&v.en&&v.pt).map(([id,v])=>({en:v.en,pt:v.pt,key:`custom_${id}`,lessonId,isPhrase:true,custom:true,note:v.note||""}));
}
function allLessonItems(lesson){
  const base=lesson.vocab.concat(lesson.phrases).map(([en,pt],i)=>({en,pt,key:`${lesson.id}_${slug(en)}_${i}`,lessonId:lesson.id,isPhrase:i>=lesson.vocab.length}));
  return base.concat(customItemsForLesson(lesson.id));
}
function prioritizedLessonItems(lesson){
  const all=allLessonItems(lesson),custom=shuffle(all.filter(x=>x.custom)),base=shuffle(all.filter(x=>!x.custom));
  custom.slice(0,3).forEach((item,i)=>base.splice(Math.min(1+i*3,base.length),0,item));
  return base;
}
function masteryFor(item){ return Number((mine().mastery||{})[item.key]||0); }
function buildLessonExercises(lesson){
  const items=prioritizedLessonItems(lesson); const dir=direction(); const exercises=[];
  const pattern=noAudio?["choice","type","bank","choice"]:["choice","listen","type","bank"];
  items.slice(0,10).forEach((item,i)=>exercises.push(buildExercise(item,pattern[i%pattern.length],dir==="mix"?(i%2?"en":"pt"):dir,lesson)));
  if(items.length>=4) exercises.splice(5,0,{type:"match",items:shuffle(items).slice(0,4),direction:dir});
  const extra=items.find(x=>x.isPhrase)||items[0];
  if(extra) exercises.push(buildExercise(extra,noAudio?"type":"listen",dir==="mix"?"pt":dir,lesson));
  return exercises.slice(0,SESSION_SIZE);
}
function buildExercise(item,type,dir,lesson){
  const actualDir=dir==="mix"?"pt":dir;
  if(noAudio && type==="listen") type="choice";
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
  const dir=direction(),pattern=noAudio?["choice","type","bank"]:["choice","listen","type","bank"],exercises=[];
  source.slice(0,10).forEach((item,i)=>{const lesson=lessonById(item.lessonId)||LESSONS[0];exercises.push(buildExercise(item,pattern[i%pattern.length],dir==="mix"?(i%2?"en":"pt"):dir,lesson));});
  if(source.length>=4) exercises.splice(5,0,{type:"match",items:shuffle(source).slice(0,4),direction:dir});
  return exercises.slice(0,SESSION_SIZE-1);
}
function startLesson(index){
  if(!isLessonUnlocked(index)){toast("Complete the previous lesson first");return;}
  if(hearts()<=0){toast("Practice to refill your hearts first ❤️");switchTab("practice");return;}
  activeSession={kind:"lesson",lessonIndex:index,mode:"lesson",exercises:buildLessonExercises(LESSONS[index]),position:0,correct:0,wrong:0,xp:0,hearts:hearts(),locked:false,selected:null,bank:[],matched:0,introduced:{},teachCount:0,hintUsed:false,justTaught:false,independentCorrect:0,assistedCorrect:0};
  showSession();renderExercise();
}
function startPractice(mode){
  const exercises=buildPracticeExercises(mode);
  if(!exercises.length){toast("Complete a lesson first so there is something to practice");return;}
  activeSession={kind:"practice",mode,exercises,position:0,correct:0,wrong:0,xp:0,hearts:hearts(),locked:false,selected:null,bank:[],matched:0,introduced:{},teachCount:0,hintUsed:false,justTaught:false,independentCorrect:0,assistedCorrect:0};
  showSession();renderExercise();
}
function showSession(){ $("normalView").hidden=true;$("courseHeader").hidden=true;$("roomBar").hidden=true;$("sessionView").hidden=false;window.scrollTo({top:0,behavior:"smooth"}); }
function closeSession(){ if(!activeSession)return; const started=activeSession.position>0; if(started&&!confirm("Leave this lesson? Your unfinished attempt will not be scored."))return; activeSession=null;$("sessionView").hidden=true;$("normalView").hidden=false;$("courseHeader").hidden=false;$("roomBar").hidden=false;renderEverything(); }
function switchTab(name){ const tab=$("tabs").querySelector(`[data-tab="${name}"]`); if(tab)tab.click(); }
function targetText(ex){ return ex.direction==="pt"?ex.item.pt:ex.item.en; }
function sourceText(ex){ return ex.direction==="pt"?ex.item.en:ex.item.pt; }
function targetLang(ex){ return ex.direction==="pt"?"pt-BR":"en-US"; }
function sourceLang(ex){ return ex.direction==="pt"?"en-US":"pt-BR"; }
function addClue(map,key,value){
  const cleanKey=normalize(key); if(!cleanKey||!value)return;
  const current=map.get(cleanKey)||[];
  if(!current.some(v=>normalize(v)===normalize(value)))current.push(value);
  map.set(cleanKey,current);
}
function clueMaps(ex){
  const en=new Map(),pt=new Map();
  const addPair=(english,portuguese)=>{addClue(en,english,portuguese);addClue(pt,portuguese,english);};
  MANUAL_CLUE_PAIRS.forEach(([english,portuguese])=>addPair(english,portuguese));
  LESSONS.forEach(lesson=>lesson.vocab.forEach(([english,portuguese])=>addPair(english,portuguese)));
  if(ex&&ex.item){
    const enWords=normalize(ex.item.en).split(" ").filter(Boolean).length;
    const ptWords=normalize(ex.item.pt).split(" ").filter(Boolean).length;
    if(enWords<=3&&ptWords<=3)addPair(ex.item.en,ex.item.pt);
  }
  return {en,pt};
}
function cluedText(text,lang,ex){
  const source=String(text||"");
  const words=[...source.matchAll(/[\p{L}\p{N}]+(?:[’'][\p{L}\p{N}]+)?/gu)].map(m=>({text:m[0],start:m.index,end:m.index+m[0].length}));
  if(!words.length)return esc(source);
  const map=clueMaps(ex)[lang]||new Map(); let cursor=0,i=0,html="",found=0;
  while(i<words.length){
    let match=null;
    for(let size=Math.min(4,words.length-i);size>=1;size--){
      const key=normalize(words.slice(i,i+size).map(w=>w.text).join(" "));
      const values=map.get(key);
      if(values&&values.length){match={size,values,key};break;}
    }
    if(!match){i++;continue;}
    const first=words[i],last=words[i+match.size-1];
    html+=esc(source.slice(cursor,first.start));
    const visible=source.slice(first.start,last.end),clue=match.values.slice(0,3).join(" / ");
    html+=`<button type="button" class="clueWord" data-term="${esc(visible)}" data-clue="${esc(clue)}" title="Tap for meaning">${esc(visible)}</button>`;
    cursor=last.end;i+=match.size;found++;
  }
  html+=esc(source.slice(cursor));
  return found?html:esc(source);
}
function cluePrompt(ex,style=""){
  const lang=ex.direction==="pt"?"en":"pt";
  return `<div class="bigWord clueSentence"${style?` style="${style}"`:""}>${cluedText(sourceText(ex),lang,ex)}</div><div class="clueGuide">Tap the <span>highlighted words</span> for a meaning clue.</div><button type="button" class="fullClueBtn" data-full-clue="${esc(targetText(ex))}">Show the whole phrase meaning</button><div class="clueBubble" id="clueBubble" hidden></div>`;
}
function wireClues(card){
  const bubble=card.querySelector("#clueBubble");
  const reveal=(term,clue,full=false)=>{
    if(activeSession)activeSession.hintUsed=true;
    if(!bubble)return;
    bubble.hidden=false;
    bubble.innerHTML=`<strong>${full?"Whole phrase":esc(term)}</strong><span>${esc(clue)}</span>${full?"<small>This answer will return later so you can prove it without the clue.</small>":""}`;
  };
  card.querySelectorAll(".clueWord").forEach(btn=>btn.addEventListener("click",()=>reveal(btn.dataset.term,btn.dataset.clue)));
  card.querySelectorAll("[data-full-clue]").forEach(btn=>btn.addEventListener("click",()=>reveal("",btn.dataset.fullClue,true)));
}
function shouldTeachExercise(ex){
  return !!(ex&&ex.item&&ex.type!=="match"&&!ex.retry&&masteryFor(ex.item)===0&&!activeSession.introduced[ex.item.key]&&activeSession.teachCount<4);
}
function renderTeachingCard(card,ex){
  const sourceLabel=ex.direction==="pt"?"English":"Português";
  const targetLabel=ex.direction==="pt"?"Português":"English";
  card.innerHTML=`<div class="exerciseType">New ${ex.item.isPhrase?"phrase":"word"}</div><div class="exercisePrompt">Learn this before we test it</div><div class="teachingPair"><div><span>${sourceLabel}</span><strong>${cluedText(sourceText(ex),ex.direction==="pt"?"en":"pt",ex)}</strong></div><div class="teachArrow">↓</div><div><span>${targetLabel}</span><strong>${cluedText(targetText(ex),ex.direction==="pt"?"pt":"en",ex)}</strong></div></div><div class="clueGuide">Tap highlighted parts to see how the sentence breaks down.</div><div class="clueBubble" id="clueBubble" hidden></div>${noAudio?"":`<button class="btn sm" id="teachSpeak" style="align-self:center;margin-top:13px">🔊 Hear it</button>`}<div class="teachNote">You will answer this now, then see it again later without the teaching card.</div><div class="checkBar"><div class="feedbackMsg"></div><button class="btn primary" id="practiceNewItem">Practice this</button></div>`;
  wireClues(card);
  if($("teachSpeak"))$("teachSpeak").addEventListener("click",()=>speak(targetText(ex),targetLang(ex)));
  $("practiceNewItem").addEventListener("click",()=>{activeSession.introduced[ex.item.key]=true;activeSession.teachCount++;renderExercise(true);});
}
function renderExercise(skipTeach=false){
  if(!activeSession)return;
  if(activeSession.position>=activeSession.exercises.length){finishSession();return;}
  activeSession.locked=false;activeSession.selected=null;activeSession.bank=[];activeSession.matched=0;activeSession.hintUsed=false;activeSession.justTaught=!!skipTeach;
  const ex=activeSession.exercises[activeSession.position];
  $("sessionProgress").style.width=`${Math.round((activeSession.position/activeSession.exercises.length)*100)}%`;$("sessionHearts").textContent=`❤️ ${activeSession.hearts}`;
  const card=$("exerciseCard");
  if(!skipTeach&&shouldTeachExercise(ex)){renderTeachingCard(card,ex);return;}
  if(ex.type==="choice") renderChoice(card,ex,false);
  else if(ex.type==="listen") renderChoice(card,ex,true);
  else if(ex.type==="type") renderType(card,ex);
  else if(ex.type==="bank") renderBank(card,ex);
  else if(ex.type==="match") renderMatch(card,ex);
}
function baseCheckBar(label="Check"){ return `<div class="checkBar"><div class="feedbackMsg" id="feedbackMsg"></div><button class="btn primary" id="checkAnswer">${label}</button></div>`; }
function renderChoice(card,ex,listening){
  const prompt=listening?"What does this mean?":`Translate into ${ex.direction==="pt"?"Portuguese":"English"}`;
  card.innerHTML=`<div class="exerciseType">${listening?"Listening":"Multiple choice"}</div><div class="exercisePrompt">${prompt}</div>${listening?`<button class="speakerBig" id="listenBtn">🔊</button><button class="btn sm" id="cantListenBtn" style="align-self:center;margin-top:-8px;margin-bottom:14px">I can’t listen right now</button>`:cluePrompt(ex)}<div class="choiceGrid">${ex.choices.map(c=>`<button class="choice" data-choice="${esc(c)}">${esc(c)}</button>`).join("")}</div>${baseCheckBar()}`;
  if(listening){
    $("listenBtn").addEventListener("click",()=>speak(targetText(ex),targetLang(ex)));
    $("cantListenBtn").addEventListener("click",()=>{setNoAudio(true);renderExercise();});
    setTimeout(()=>{if(!noAudio)speak(targetText(ex),targetLang(ex));},250);
  }else wireClues(card);
  card.querySelectorAll(".choice").forEach(btn=>btn.addEventListener("click",()=>{if(activeSession.locked)return;activeSession.selected=btn.dataset.choice;card.querySelectorAll(".choice").forEach(b=>b.classList.toggle("selected",b===btn));}));
  $("checkAnswer").addEventListener("click",()=>{if(!activeSession.selected){toast("Choose an answer first");return;}const expected=listening?sourceText(ex):targetText(ex);gradeCurrent(normalize(activeSession.selected)===normalize(expected),ex,activeSession.selected,expected);});
}
function renderType(card,ex){
  card.innerHTML=`<div class="exerciseType">Write the answer</div><div class="exercisePrompt">Translate into ${ex.direction==="pt"?"Portuguese":"English"}</div>${cluePrompt(ex)}<input class="input typeAnswer" id="typedAnswer" autocomplete="off" autocapitalize="sentences" placeholder="Type your answer…" /><div class="exerciseSub" style="margin-top:9px;margin-bottom:0;text-align:center">Accents and punctuation are optional.</div>${baseCheckBar()}`;
  wireClues(card);
  const input=$("typedAnswer");input.focus();input.addEventListener("keydown",e=>{if(e.key==="Enter")$("checkAnswer").click();});
  $("checkAnswer").addEventListener("click",()=>{const answer=input.value.trim();if(!answer){toast("Type an answer first");return;}gradeCurrent(isCloseAnswer(answer,targetText(ex)),ex,answer);});
}
function isCloseAnswer(given,expected){ const a=normalize(given),b=normalize(expected); if(a===b)return true; const variants=String(expected).split(/\s*\/\s*|\s*;\s*/).map(normalize); return variants.includes(a); }
function renderBank(card,ex){
  const words=shuffle(targetText(ex).replace(/[.,!?]/g,"").split(/\s+/).filter(Boolean));
  card.innerHTML=`<div class="exerciseType">Build the sentence</div><div class="exercisePrompt">Translate this sentence</div>${cluePrompt(ex,"font-size:34px")}<div class="wordBank" id="answerBank"><span class="bankPlaceholder">Build your answer here</span></div><div class="bankWords">${words.map((w,i)=>`<button class="bankWord" data-i="${i}" data-word="${esc(w)}">${esc(w)}</button>`).join("")}</div>${baseCheckBar()}`;
  wireClues(card);
  const redraw=()=>{$("answerBank").innerHTML=activeSession.bank.length?activeSession.bank.map((x,i)=>`<button class="answerWord" data-remove="${i}">${esc(x.word)}</button>`).join(""):`<span class="bankPlaceholder">Build your answer here</span>`;card.querySelectorAll("[data-remove]").forEach(b=>b.addEventListener("click",()=>{const [removed]=activeSession.bank.splice(Number(b.dataset.remove),1);card.querySelector(`[data-i="${removed.i}"]`).disabled=false;redraw();}));};
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
function gradeCurrent(correct,ex,given,expectedOverride){
  if(activeSession.locked)return;activeSession.locked=true;
  const card=$("exerciseCard"),msg=$("feedbackMsg"),btn=$("checkAnswer");
  card.querySelectorAll("button.choice,.bankWord,.answerWord,.clueWord,.fullClueBtn").forEach(b=>b.disabled=true);
  const expected=expectedOverride||targetText(ex),assisted=!!(activeSession.hintUsed||activeSession.justTaught);
  if(correct){
    if(assisted){
      msg.textContent=activeSession.justTaught?"Correct! We’ll bring it back later without the teaching card. +5 XP":"Correct with a clue. It will return later so it sticks. +5 XP";
      msg.className="feedbackMsg good";btn.textContent="Continue";highlightChoice(expected,true);recordCorrect(ex,true);
      if(!ex.assistedRetry)activeSession.exercises.push({...ex,retry:true,assistedRetry:true});
    }else{
      msg.textContent="Correct from memory! +10 XP";msg.className="feedbackMsg good";btn.textContent="Continue";highlightChoice(expected,true);recordCorrect(ex,false);
    }
  }else{
    msg.innerHTML=`Not quite. Correct answer: <strong>${esc(expected)}</strong>`;msg.className="feedbackMsg bad";btn.textContent="Continue";highlightChoice(expected,false);recordWrong(ex,given);if(!ex.retry)activeSession.exercises.push({...ex,retry:true});
  }
  btn.onclick=()=>completeExercise(correct,ex);
}
function highlightChoice(answer,correct){ $("exerciseCard").querySelectorAll(".choice").forEach(b=>{if(normalize(b.dataset.choice)===normalize(answer))b.classList.add("correct");else if(b.classList.contains("selected")&&!correct)b.classList.add("wrong");}); }
function recordCorrect(ex,assisted=false){ activeSession.correct++;activeSession.xp+=assisted?5:10;if(assisted)activeSession.assistedCorrect++;else activeSession.independentCorrect++;if(ex.item&&!assisted){const strength=clamp(masteryFor(ex.item)+1,0,5);set(ref(db,rootPath(`progress/${identityKey()}/mastery/${ex.item.key}`)),strength);remove(ref(db,rootPath(`progress/${identityKey()}/mistakes/${ex.item.key}`))).catch(()=>{});} }
function recordWrong(ex,given){
  activeSession.wrong++;activeSession.hearts=Math.max(0,activeSession.hearts-1);$("sessionHearts").textContent=`❤️ ${activeSession.hearts}`;
  if(ex.item){const old=(mine().mistakes||{})[ex.item.key]||{};set(ref(db,rootPath(`progress/${identityKey()}/mastery/${ex.item.key}`)),Math.max(0,masteryFor(ex.item)-1));set(ref(db,rootPath(`progress/${identityKey()}/mistakes/${ex.item.key}`)),{key:ex.item.key,en:ex.item.en,pt:ex.item.pt,lessonId:ex.item.lessonId,count:Number(old.count||0)+1,lastGiven:given||"",lastWrong:now()});}
  updateMyProgress({hearts:activeSession.hearts});
}
function completeExercise(correct,ex){
  if(!activeSession)return;
  if(ex.type==="match"){activeSession.correct++;activeSession.xp+=5;}
  if(activeSession.hearts<=0 && activeSession.kind==="lesson"){renderOutOfHearts();return;}
  activeSession.position++;renderExercise();
}
function renderOutOfHearts(){
  $("exerciseCard").innerHTML=`<div class="resultCard" style="display:flex;flex-direction:column;min-height:410px"><div class="resultEmoji">💔</div><h2>You’re out of hearts</h2><p class="muted">Your mistakes were saved. Do a short practice session to refill your hearts, then try the lesson again.</p><button class="btn primary" id="goPractice" style="margin-top:20px">Practice to refill</button></div>`;
  $("goPractice").addEventListener("click",()=>{activeSession=null;$("sessionView").hidden=true;$("normalView").hidden=false;$("courseHeader").hidden=false;$("roomBar").hidden=false;switchTab("practice");renderEverything();});
}
async function finishSession(){
  const s=activeSession,total=s.exercises.length,answered=s.independentCorrect+s.assistedCorrect+s.wrong,accuracy=Math.round(((s.independentCorrect+(s.assistedCorrect*.5))/Math.max(1,answered))*100),xpEarned=s.xp+(accuracy===100?20:accuracy>=80?10:0);
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
  $("exerciseCard").innerHTML=`<div class="resultCard" style="display:flex;flex-direction:column;min-height:430px"><div class="resultEmoji">${passed?accuracy>=90?"🏆":"🎉":"📚"}</div><h2>${s.kind==="practice"?"Practice complete!":passed?"Lesson complete!":"Almost there"}</h2><p class="muted">${s.kind==="lesson"&&!passed?"You need 70% to unlock the next lesson. Your mistakes are ready for review.":"Your score gives full credit only for answers recalled without clues. Clue-assisted answers count as practice and return later."}</p><div class="resultStats"><div class="resultStat"><strong>${accuracy}%</strong><span>accuracy</span></div><div class="resultStat"><strong>+${xpEarned}</strong><span>XP earned</span></div><div class="resultStat"><strong>${s.wrong}</strong><span>mistakes saved</span></div></div><button class="btn primary" id="finishDone">${s.kind==="lesson"&&!passed?"Review and try again":"Continue"}</button></div>`;
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
function renderPartner(){
  const progressBox=$("partnerProgressList"),target=$("suggestTarget");
  const partners=Object.entries(progressData).filter(([key,v])=>key!==identityKey()&&v&&v.name);
  if(target){
    const old=target.value;
    target.innerHTML=partners.length?partners.map(([key,v])=>`<option value="${esc(key)}">${esc(v.name)}</option>`).join(""):`<option value="">No partner has opened the course yet</option>`;
    if(partners.some(([key])=>key===old)) target.value=old;
    target.disabled=!partners.length;
  }
  if(progressBox){
    progressBox.innerHTML=partners.length?partners.map(([key,v])=>{
      const done=Object.values(v.lessons||{}).filter(x=>x===true||(x&&x.completed)).length;
      const lesson=lessonById(v.currentLesson)||LESSONS[Math.min(done,LESSONS.length-1)];
      return `<div class="partnerCard"><div class="partnerHead"><span style="font-size:26px">💞</span><div class="grow"><strong>${esc(v.name)}</strong><div class="muted">${goalLabel(v.goal)} · currently on ${esc(lesson.title)}</div></div></div><div class="partnerMetrics"><div class="partnerMetric"><strong>${done}/${LESSONS.length}</strong><span>lessons</span></div><div class="partnerMetric"><strong>${Number(v.xp||0)}</strong><span>XP</span></div><div class="partnerMetric"><strong>${Number(v.streak||0)}</strong><span>day streak</span></div></div></div>`;
    }).join(""):`<div class="empty">Your partner’s progress will appear after they open this course with their own account or device.</div>`;
  }
  renderSuggestions();
}
function goalLabel(goal){return goal==="en"?"learning English":goal==="both"?"practicing both":"learning Portuguese";}
async function sendSuggestion(){
  const to=$("suggestTarget").value,en=$("suggestEn").value.trim(),pt=$("suggestPt").value.trim(),lessonId=$("suggestLesson").value,note=$("suggestNote").value.trim();
  if(!to){toast("Your partner needs to open the course first");return;}
  if(!en||!pt){toast("Add both the English and Portuguese");return;}
  const target=progressData[to]||{};const item=push(ref(db,rootPath("suggestions")));
  await set(item,{from:identityKey(),fromName:displayName||"someone",to,toName:target.name||"partner",en,pt,lessonId,note,status:"pending",t:now()});
  $("suggestEn").value="";$("suggestPt").value="";$("suggestNote").value="";toast("Phrase sent to your partner 💞");
}
function suggestionCard(id,v,incoming){
  const lesson=lessonById(v.lessonId)||LESSONS[0],status=v.status||"pending";
  return `<div class="suggestionCard"><div style="display:flex;justify-content:space-between;gap:10px"><strong>${incoming?`From ${esc(v.fromName||"your partner")}`:`To ${esc(v.toName||"your partner")}`}</strong><span class="statusTag">${esc(status)}</span></div><div class="suggestionPair"><div>${esc(v.en)}</div><div class="pt">${esc(v.pt)}</div></div>${v.note?`<div class="suggestionMeta">${esc(v.note)}</div>`:""}<div class="suggestionMeta">Lesson ${LESSONS.indexOf(lesson)+1}: ${esc(lesson.title)}</div>${incoming&&status==="pending"?`<div class="suggestionActions"><button class="btn primary sm" data-accept-suggestion="${esc(id)}">Add to my lesson</button><button class="btn danger sm" data-dismiss-suggestion="${esc(id)}">Dismiss</button></div>`:""}</div>`;
}
function renderSuggestions(){
  const incomingBox=$("incomingSuggestions"),sentBox=$("sentSuggestions"); if(!incomingBox||!sentBox)return;
  const rows=Object.entries(suggestionData).filter(([,v])=>v).sort((a,b)=>(b[1].t||0)-(a[1].t||0));
  const incoming=rows.filter(([,v])=>v.to===identityKey()),sent=rows.filter(([,v])=>v.from===identityKey());
  incomingBox.innerHTML=incoming.length?incoming.map(([id,v])=>suggestionCard(id,v,true)).join(""):`<div class="empty">No phrase suggestions for you yet.</div>`;
  sentBox.innerHTML=sent.length?sent.map(([id,v])=>suggestionCard(id,v,false)).join(""):`<div class="empty">You haven’t suggested any phrases yet.</div>`;
  incomingBox.querySelectorAll("[data-accept-suggestion]").forEach(b=>b.addEventListener("click",()=>acceptSuggestion(b.dataset.acceptSuggestion)));
  incomingBox.querySelectorAll("[data-dismiss-suggestion]").forEach(b=>b.addEventListener("click",()=>update(ref(db,rootPath(`suggestions/${b.dataset.dismissSuggestion}`)),{status:"dismissed",respondedAt:now()})));
}
async function acceptSuggestion(id){
  const v=suggestionData[id];if(!v||v.to!==identityKey())return;
  await set(ref(db,rootPath(`progress/${identityKey()}/customPhrases/${id}`)),{en:v.en,pt:v.pt,note:v.note||"",lessonId:v.lessonId||LESSONS[0].id,fromName:v.fromName||"partner",addedAt:now()});
  await update(ref(db,rootPath(`suggestions/${id}`)),{status:"accepted",respondedAt:now()});
  toast("Added to your lesson ✨");renderEverything();
}

function speak(text,lang){
  if(!("speechSynthesis" in window)){toast("Speech playback isn’t supported in this browser");return;}
  speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang=lang;u.rate=.84;const voices=speechSynthesis.getVoices();const exact=voices.find(v=>v.lang.toLowerCase()===lang.toLowerCase())||voices.find(v=>v.lang.toLowerCase().startsWith(lang.slice(0,2).toLowerCase()));if(exact)u.voice=exact;speechSynthesis.speak(u);
}
function speakAndWait(text,lang){return new Promise(resolve=>{if(!("speechSynthesis" in window)){resolve();return;}speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang=lang;u.rate=.84;u.onend=resolve;u.onerror=resolve;speechSynthesis.speak(u);});}
function speakerButton(text,lang){return `<button class="speak" data-say="${esc(text)}" data-lang="${lang}" title="Hear pronunciation">🔊</button>`;}

function addPhrase(){
  const en=$("bookEn").value.trim(),pt=$("bookPt").value.trim(),note=$("bookNote").value.trim(),lessonId=$("bookLesson").value;
  if(!en||!pt){toast("Add both English and Portuguese");return;}
  const item=push(ref(db,rootPath(`progress/${identityKey()}/customPhrases`)));
  set(item,{en,pt,note,lessonId,fromName:displayName||"you",addedAt:now()});
  $("bookEn").value="";$("bookPt").value="";$("bookNote").value="";toast("Added to your lesson ✨");
}
function renderPhrasebook(){
  const box=$("phrasebookList");if(!box)return;const q=($("bookSearch")?.value||"").trim().toLowerCase();
  const rows=Object.entries(mine().customPhrases||{}).filter(([,v])=>v&&(!q||`${v.en} ${v.pt} ${v.note||""} ${lessonById(v.lessonId)?.title||""}`.toLowerCase().includes(q))).sort((a,b)=>(b[1].addedAt||0)-(a[1].addedAt||0));
  if(!rows.length){box.innerHTML=`<div class="empty">${q?"Nothing matches that search.":"You have no custom phrases yet. Add one yourself or accept one from your partner."}</div>`;return;}
  box.innerHTML=rows.map(([id,v])=>{const lesson=lessonById(v.lessonId)||LESSONS[0];return `<div class="bookRow"><div><strong>${esc(v.en)}</strong> ${noAudio?"":speakerButton(v.en,"en-US")}</div><div class="bookPt">${esc(v.pt)} ${noAudio?"":speakerButton(v.pt,"pt-BR")}</div><div class="bookNote">Lesson ${LESSONS.indexOf(lesson)+1}: ${esc(lesson.title)}${v.note?` · ${esc(v.note)}`:""}</div><button class="btn sm danger" data-delete-custom="${esc(id)}">Remove</button></div>`;}).join("");
  box.querySelectorAll("[data-say]").forEach(b=>b.addEventListener("click",()=>speak(b.dataset.say,b.dataset.lang)));
  box.querySelectorAll("[data-delete-custom]").forEach(b=>b.addEventListener("click",()=>remove(ref(db,rootPath(`progress/${identityKey()}/customPhrases/${b.dataset.deleteCustom}`)))));
}

window.addEventListener("DOMContentLoaded",waitForRooms);
