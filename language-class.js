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
let myId = localStorage.getItem("lc_device_id");
if (!myId){ myId = "lc" + Math.random().toString(36).slice(2, 10); localStorage.setItem("lc_device_id", myId); }
const identityKey = () => (window.MFAuth && MFAuth.uid) ? MFAuth.uid : myId;
const rootPath = sub => `together/${ROOM}/language${sub ? "/" + sub : ""}`;
const roomPath = sub => `together/${ROOM}/${sub}`;

function waitForRooms(tries = 0){
  if (window.MFRooms && MFRooms.whenReady){
    MFRooms.whenReady(() => gateAndEnter(presetRoom));
    return;
  }
  if (tries > 100){ location.href = "/together.html"; return; }
  setTimeout(() => waitForRooms(tries + 1), 100);
}

async function gateAndEnter(room){
  if (!room){ location.href = "/together.html"; return; }
  try {
    const info = await MFRooms.get(room);
    if (!info){ bounce("missing", room); return; }
    if (info.type !== "learn"){ location.href = MFRooms.urlFor(info); return; }
    const access = await MFRooms.canEnter(info);
    if (!access.ok){ bounce(access.reason, room); return; }
    try { await MFRooms.touch(room); } catch(_){}
    enterRoom(room);
  } catch (err){ console.error(err); bounce("missing", room); }
}
function bounce(reason, room){
  location.href = `/together.html?denied=${encodeURIComponent(reason || "missing")}&room=${encodeURIComponent(room || "")}`;
}

function trackIdentity(){
  let tries = 0;
  const iv = setInterval(() => {
    if (!window.MFAuth){ if (++tries > 150) clearInterval(iv); return; }
    clearInterval(iv);
    if (!MFAuth.isConfigured()) return;
    MFAuth.onChange(user => {
      const input = $("nameInput");
      if (user && MFAuth.name()){
        displayName = MFAuth.name();
        input.value = displayName;
        input.readOnly = true;
      } else {
        input.value = displayName;
        input.readOnly = false;
      }
      if (ROOM) writePresence();
    });
  }, 100);
}
trackIdentity();

function enterRoom(room){
  if (roomEntered) return;
  roomEntered = true;
  ROOM = room;
  $("gateView").hidden = true;
  $("roomView").hidden = false;
  $("roomBar").hidden = false;
  $("nameInput").value = displayName;
  const u = new URL(location.href); u.searchParams.set("room", room); history.replaceState(null, "", u);
  setupTabs();
  setupPresence();
  setupSharedState();
  setupActions();
  renderEverything();
}

function setupTabs(){
  $("tabs").querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => {
    $("tabs").querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t === tab));
    document.querySelectorAll(".panel").forEach(panel => panel.classList.toggle("active", panel.dataset.panel === tab.dataset.tab));
    try { currentTab = tab.dataset.tab; update(ref(db, roomPath(`presence/${myId}`)), { tab: currentTab, t: now() }); } catch(_){}
  }));
}

let connected = false;
let currentTab = "classroom";
function paintConnection(){
  $("connDot").className = "dot " + (connected ? "on" : "off");
  const identities = new Set(Object.entries(presenceData).filter(([,v]) => v && now() - (v.t || 0) < 70000).map(([id,v]) => v.idk || id));
  $("connText").textContent = connected ? (identities.size > 1 ? `Connected · ${identities.size} here` : "Connected · waiting for your person") : "Offline";
}
function writePresence(){
  if (!ROOM) return;
  const p = ref(db, roomPath(`presence/${myId}`));
  set(p, { name: displayName || "someone", idk: identityKey(), tab: currentTab, joined: serverTimestamp(), t: now() });
  onDisconnect(p).remove();
}
function setupPresence(){
  writePresence();
  setInterval(writePresence, 20000);
  onValue(ref(db, ".info/connected"), snap => { connected = snap.val() === true; paintConnection(); if (connected) writePresence(); });
  onValue(ref(db, roomPath("presence")), snap => {
    const raw = snap.val() || {};
    const fresh = {};
    Object.entries(raw).forEach(([id,v]) => {
      if (id === myId || now() - ((v && v.t) || 0) < 70000) fresh[id] = v;
      else remove(ref(db, roomPath(`presence/${id}`))).catch(() => {});
    });
    presenceData = fresh;
    renderPresence();
    paintConnection();
  });
}

function setupSharedState(){
  onValue(ref(db, rootPath("settings/currentLesson")), snap => {
    const id = snap.val();
    const idx = LESSONS.findIndex(l => l.id === id);
    currentLessonIndex = idx >= 0 ? idx : 0;
    renderLessonList(); renderLesson(); renderStats(); resetFlashDeck(); renderChallenge();
  });
  onValue(ref(db, rootPath("progress")), snap => {
    progressData = snap.val() || {};
    const mine = progressData[identityKey()] || {};
    currentGoal = mine.goal || currentGoal;
    $("goalSelect").value = currentGoal;
    renderLessonList(); renderStats(); renderScoreboard();
  });
  onValue(ref(db, rootPath("homework")), snap => { homeworkData = snap.val() || {}; renderHomework(); });
  onValue(ref(db, rootPath("phrasebook")), snap => { phrasebookData = snap.val() || {}; renderPhrasebook(); });
  get(ref(db, rootPath("settings/currentLesson"))).then(s => { if (!s.exists()) set(ref(db, rootPath("settings/currentLesson")), LESSONS[0].id); });
}

function setupActions(){
  $("copyRoomBtn").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(location.href); toast("Class link copied 🔗"); }
    catch(_) { toast(location.href); }
  });
  $("nameInput").addEventListener("input", e => {
    if (e.target.readOnly) return;
    displayName = e.target.value.slice(0,24) || "someone";
    localStorage.setItem("lc_name", displayName);
    writePresence();
  });
  $("goalSelect").addEventListener("change", e => {
    currentGoal = e.target.value;
    update(ref(db, rootPath(`progress/${identityKey()}`)), { name:displayName || "someone", goal:currentGoal, updated:now() });
    setDirectionsFromGoal();
  });
  $("flashcard").addEventListener("click", () => $("flashcard").classList.toggle("flipped"));
  $("flashPrev").addEventListener("click", () => moveFlash(-1));
  $("flashNext").addEventListener("click", () => moveFlash(1));
  $("flashShuffle").addEventListener("click", () => { shuffle(flashDeck); flashIndex = 0; renderFlash(); });
  $("flashSpeak").addEventListener("click", speakFlash);
  wireSegments("flashDirection", dir => { flashDirection = dir; resetFlashDeck(); });
  wireSegments("quizDirection", dir => { quizDirection = dir; });
  $("newChallenge").addEventListener("click", renderChallenge);
  $("startQuiz").addEventListener("click", startQuiz);
  $("assignLessonHomework").addEventListener("click", assignLessonHomework);
  $("createHomework").addEventListener("click", createHomework);
  $("addPhrase").addEventListener("click", addPhrase);
  $("bookSearch").addEventListener("input", renderPhrasebook);
}
function wireSegments(id, cb){
  $(id).querySelectorAll(".seg").forEach(btn => btn.addEventListener("click", () => {
    $(id).querySelectorAll(".seg").forEach(b => b.classList.toggle("active", b === btn));
    cb(btn.dataset.direction);
  }));
}
function setDirectionsFromGoal(){
  const dir = currentGoal === "en" ? "en" : currentGoal === "both" ? "mix" : "pt";
  flashDirection = dir; quizDirection = dir;
  ["flashDirection","quizDirection"].forEach(id => $(id).querySelectorAll(".seg").forEach(b => b.classList.toggle("active", b.dataset.direction === dir)));
  resetFlashDeck();
}

function renderEverything(){
  renderLessonList(); renderLesson(); renderStats(); renderPresence(); resetFlashDeck(); renderChallenge(); renderScoreboard(); renderHomework(); renderPhrasebook(); setDirectionsFromGoal();
}

function renderPresence(){
  const freshest = new Map();
  Object.entries(presenceData).forEach(([id,v]) => {
    if (!v || now() - (v.t || 0) >= 70000) return;
    const key = v.idk || id;
    const old = freshest.get(key);
    if (!old || (v.t || 0) > (old.v.t || 0)) freshest.set(key, {id,v});
  });
  const box = $("whoHere"); box.innerHTML = "";
  freshest.forEach(({id,v},key) => {
    const chip = document.createElement("span");
    chip.className = "whoChip" + (key === identityKey() ? " me" : "");
    chip.textContent = (v.name || "someone") + (key === identityKey() ? " (you)" : "");
    box.appendChild(chip);
  });
  $("waitNote").style.display = freshest.size < 2 ? "block" : "none";
}

function renderLessonList(){
  const mine = progressData[identityKey()] || {};
  const completed = mine.lessons || {};
  const box = $("lessonList"); box.innerHTML = "";
  LESSONS.forEach((lesson, index) => {
    const btn = document.createElement("button");
    btn.className = "lessonBtn" + (index === currentLessonIndex ? " active" : "");
    btn.innerHTML = `<span class="num">${lesson.emoji}</span><span class="lt">${index + 1}. ${esc(lesson.title)}</span><span class="done">${completed[lesson.id] ? "✓" : ""}</span>`;
    btn.addEventListener("click", () => set(ref(db, rootPath("settings/currentLesson")), lesson.id));
    box.appendChild(btn);
  });
}
function speakerButton(text, lang){ return `<button class="speak" data-say="${esc(text)}" data-lang="${lang}" title="Hear pronunciation">🔊</button>`; }
function renderLesson(){
  const lesson = LESSONS[currentLessonIndex];
  const done = !!(((progressData[identityKey()] || {}).lessons || {})[lesson.id]);
  $("lessonStat").textContent = `Lesson ${currentLessonIndex + 1} of ${LESSONS.length}`;
  $("lessonContent").innerHTML = `
    <div class="lessonHero"><span class="lessonEmoji">${lesson.emoji}</span><div><h2>${esc(lesson.title)}</h2><div class="goal">${esc(lesson.goal)}</div></div></div>
    <div class="tip"><strong>Language note:</strong> ${esc(lesson.tip)}</div>
    <div class="sectionTitle"><h3>Core vocabulary</h3><span class="muted">tap 🔊 to hear it</span></div>
    <div class="vocabTable">${lesson.vocab.map(([en,pt]) => `<div class="vocabRow"><span class="word">${esc(en)}</span>${speakerButton(en,"en-US")}<span class="arrow">↔</span><span class="word">${esc(pt)}</span>${speakerButton(pt,"pt-BR")}</div>`).join("")}</div>
    <div class="sectionTitle"><h3>Useful phrases</h3></div>
    <div class="phraseGrid">${lesson.phrases.map(([en,pt]) => `<div class="phrase"><div class="en"><span>${esc(en)}</span>${speakerButton(en,"en-US")}</div><div class="pt"><span>${esc(pt)}</span>${speakerButton(pt,"pt-BR")}</div></div>`).join("")}</div>
    <div class="sectionTitle"><h3>Talk together</h3></div>
    <div class="challenge"><strong>Conversation challenge</strong>${esc(lesson.challenge)}</div>
    <div class="lessonFoot"><span class="muted">Completing a lesson is personal—your partner keeps their own progress.</span><button class="btn ${done ? "green" : "primary"}" id="completeLesson">${done ? "✓ Lesson completed" : "Mark lesson complete"}</button></div>`;
  $("lessonContent").querySelectorAll("[data-say]").forEach(btn => btn.addEventListener("click", () => speak(btn.dataset.say, btn.dataset.lang)));
  $("completeLesson").addEventListener("click", toggleLessonComplete);
  $("pronunciationTip").textContent = lesson.tip;
}
function toggleLessonComplete(){
  const lesson = LESSONS[currentLessonIndex];
  const done = !!((((progressData[identityKey()] || {}).lessons || {})[lesson.id]));
  set(ref(db, rootPath(`progress/${identityKey()}/lessons/${lesson.id}`)), done ? null : true);
  update(ref(db, rootPath(`progress/${identityKey()}`)), { name:displayName || "someone", goal:currentGoal, updated:now() });
  toast(done ? "Lesson reopened" : "Lesson complete 🎉");
}
function renderStats(){
  const mine = progressData[identityKey()] || {};
  const completed = Object.values(mine.lessons || {}).filter(Boolean).length;
  const points = Number(mine.quizPoints || 0);
  $("myProgressStat").textContent = `${completed} complete`;
  $("classScoreStat").textContent = `${points} quiz point${points === 1 ? "" : "s"}`;
}

function speak(text, lang){
  if (!("speechSynthesis" in window)){ toast("Speech playback isn’t supported in this browser"); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = lang; u.rate = .84;
  const voices = speechSynthesis.getVoices();
  const exact = voices.find(v => v.lang.toLowerCase() === lang.toLowerCase()) || voices.find(v => v.lang.toLowerCase().startsWith(lang.slice(0,2).toLowerCase()));
  if (exact) u.voice = exact;
  speechSynthesis.speak(u);
}

let flashDirection = "pt", flashDeck = [], flashIndex = 0;
function resetFlashDeck(){
  const lesson = LESSONS[currentLessonIndex];
  flashDeck = lesson.vocab.concat(lesson.phrases).map(([en,pt]) => ({en,pt}));
  flashIndex = Math.min(flashIndex, Math.max(0, flashDeck.length - 1));
  renderFlash();
}
function directionForCard(){ return flashDirection === "mix" ? (flashIndex % 2 ? "en" : "pt") : flashDirection; }
function renderFlash(){
  if (!flashDeck.length) return;
  const item = flashDeck[flashIndex], dir = directionForCard();
  $("flashcard").classList.remove("flipped");
  $("flashLabel").textContent = dir === "pt" ? "Translate into Portuguese" : "Translate into English";
  $("flashWord").textContent = dir === "pt" ? item.en : item.pt;
  $("flashAnswer").textContent = dir === "pt" ? item.pt : item.en;
}
function moveFlash(delta){ flashIndex = (flashIndex + delta + flashDeck.length) % flashDeck.length; renderFlash(); }
function shuffle(arr){ for (let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; }
function speakFlash(){
  const item = flashDeck[flashIndex], dir = directionForCard(), flipped = $("flashcard").classList.contains("flipped");
  const text = flipped ? (dir === "pt" ? item.pt : item.en) : (dir === "pt" ? item.en : item.pt);
  speak(text, flipped ? (dir === "pt" ? "pt-BR" : "en-US") : (dir === "pt" ? "en-US" : "pt-BR"));
}
function renderChallenge(){
  const lesson = LESSONS[currentLessonIndex];
  const extras = [lesson.challenge, `Choose three phrases from “${lesson.title}” and use each one in a new sentence about your real relationship.`, `One person asks five questions in English. The other answers in Portuguese. Then swap languages.`, `Tell a tiny two-minute story using at least four words from this lesson. Your partner may only help by asking questions.`];
  $("conversationChallenge").innerHTML = `<strong>Try this together</strong>${esc(extras[Math.floor(Math.random()*extras.length)])}`;
}

let quizDirection = "pt", quizItems = [], quizPosition = 0, quizCorrect = 0, quizLocked = false;
function buildQuizQuestion(item, direction){
  const lesson = LESSONS[currentLessonIndex];
  const pool = lesson.vocab.concat(lesson.phrases).map(([en,pt]) => ({en,pt}));
  const answer = direction === "pt" ? item.pt : item.en;
  const choices = [answer];
  const candidates = shuffle(pool.map(x => direction === "pt" ? x.pt : x.en).filter(x => x !== answer));
  for (const candidate of candidates){ if (!choices.includes(candidate)) choices.push(candidate); if (choices.length === 4) break; }
  return { item, direction, answer, choices: shuffle(choices) };
}
function startQuiz(){
  const pool = shuffle(LESSONS[currentLessonIndex].vocab.concat(LESSONS[currentLessonIndex].phrases).map(([en,pt]) => ({en,pt})));
  quizItems = pool.slice(0,8).map((item,i) => buildQuizQuestion(item, quizDirection === "mix" ? (i%2 ? "en" : "pt") : quizDirection));
  quizPosition = 0; quizCorrect = 0; quizLocked = false;
  $("startQuiz").style.display = "none";
  renderQuizQuestion();
}
function renderQuizQuestion(){
  const area = $("quizArea");
  if (quizPosition >= quizItems.length){ finishQuiz(); return; }
  const q = quizItems[quizPosition];
  const prompt = q.direction === "pt" ? q.item.en : q.item.pt;
  area.innerHTML = `<div class="quizPrompt"><div class="qLabel">Question ${quizPosition+1} of ${quizItems.length} · ${q.direction === "pt" ? "English → Portuguese" : "Portuguese → English"}</div><div class="qWord">${esc(prompt)}</div></div><div class="answers">${q.choices.map(c => `<button class="answerBtn" data-choice="${esc(c)}">${esc(c)}</button>`).join("")}</div><div class="muted" style="text-align:center;margin:10px 0 14px">Score: ${quizCorrect}/${quizPosition}</div>`;
  area.querySelectorAll(".answerBtn").forEach(btn => btn.addEventListener("click", () => answerQuiz(btn)));
}
function answerQuiz(btn){
  if (quizLocked) return;
  quizLocked = true;
  const q = quizItems[quizPosition];
  const chosen = btn.dataset.choice;
  if (chosen === q.answer){ quizCorrect++; btn.classList.add("good"); }
  else {
    btn.classList.add("bad");
    $("quizArea").querySelectorAll(".answerBtn").forEach(b => { if (b.dataset.choice === q.answer) b.classList.add("good"); });
  }
  $("quizArea").querySelectorAll(".answerBtn").forEach(b => b.disabled = true);
  setTimeout(() => { quizPosition++; quizLocked = false; renderQuizQuestion(); }, 850);
}
async function finishQuiz(){
  const points = quizCorrect;
  const key = identityKey();
  const mine = progressData[key] || {};
  const newTotal = Number(mine.quizPoints || 0) + points;
  const attempts = Number(mine.quizAttempts || 0) + 1;
  await update(ref(db, rootPath(`progress/${key}`)), { name:displayName || "someone", goal:currentGoal, quizPoints:newTotal, quizAttempts:attempts, lastQuiz:points, updated:now() });
  $("quizArea").innerHTML = `<div class="quizPrompt"><div class="qLabel">Quiz complete</div><div class="qWord">${quizCorrect} / ${quizItems.length}</div><p class="muted" style="margin:10px 0 0">${quizCorrect >= 7 ? "Amazing—this lesson is sticking. 🌟" : quizCorrect >= 5 ? "Nice work. Review the missed cards and try again." : "Learning is allowed to look messy. Flip through the cards, then come back."}</p></div>`;
  $("startQuiz").style.display = "inline-flex";
  $("startQuiz").textContent = "Try another quiz";
}
function renderScoreboard(){
  const rows = Object.entries(progressData).filter(([,v]) => v && v.name).sort((a,b) => Number(b[1].quizPoints||0)-Number(a[1].quizPoints||0));
  $("scoreboard").innerHTML = rows.length ? rows.map(([key,v]) => `<div class="scoreRow"><span>🧠</span><span class="who">${esc(v.name)}${key===identityKey()?" (you)":""}<br><small class="muted">${Number(v.quizAttempts||0)} quizzes · ${goalLabel(v.goal)}</small></span><span class="score">${Number(v.quizPoints||0)} pts</span></div>`).join("") : `<div class="empty">No quiz scores yet. Be the first brave student. 📚</div>`;
}
function goalLabel(goal){ return goal === "en" ? "learning English" : goal === "both" ? "practicing both" : "learning Portuguese"; }

async function addHomework(title,instructions,target){
  const itemRef = push(ref(db, rootPath("homework")));
  await set(itemRef, { title, instructions, target, createdBy:identityKey(), createdName:displayName || "someone", lessonId:LESSONS[currentLessonIndex].id, t:now() });
  toast("Homework assigned 📝");
}
function assignLessonHomework(){
  const l = LESSONS[currentLessonIndex];
  addHomework(`${l.emoji} ${l.title} assignment`, l.homework, "both");
}
function createHomework(){
  const title = $("hwTitle").value.trim(), instructions = $("hwInstructions").value.trim(), target = $("hwTarget").value;
  if (!title || !instructions){ toast("Add a title and instructions"); return; }
  addHomework(title,instructions,target);
  $("hwTitle").value = ""; $("hwInstructions").value = "";
}
function renderHomework(){
  const box = $("homeworkList");
  const entries = Object.entries(homeworkData).filter(([,v]) => v).sort((a,b)=>(b[1].t||0)-(a[1].t||0));
  if (!entries.length){ box.innerHTML = `<div class="empty">No homework yet. Assign the current lesson’s activity when you’re ready. ✏️</div>`; return; }
  box.innerHTML = entries.map(([id,hw]) => {
    const submissions = Object.entries(hw.submissions || {});
    const mine = (hw.submissions || {})[identityKey()] || {};
    return `<article class="hwCard" data-hw="${esc(id)}">
      <div class="hwHead"><span style="font-size:23px">📝</span><div class="hwMain"><div class="hwTitle">${esc(hw.title)}</div><div class="hwMeta">${targetLabel(hw.target)} · assigned by ${esc(hw.createdName||"someone")}</div></div>${hw.createdBy===identityKey()?`<button class="btn sm" data-delete-hw="${esc(id)}">Delete</button>`:""}</div>
      <div class="hwInstructions">${esc(hw.instructions)}</div>
      <textarea class="textarea" data-hw-answer="${esc(id)}" placeholder="Write your answer here…">${esc(mine.text||"")}</textarea>
      <button class="btn primary sm" data-save-hw="${esc(id)}" style="margin-top:8px">Save my answer</button>
      <div class="submissionList">${submissions.map(([key,sub]) => `<div class="submission"><strong>${esc(sub.name||"someone")}${key===identityKey()?" (you)":""}</strong><p>${esc(sub.text||"")}</p>${sub.feedback?`<div class="feedback">💛 ${esc(sub.feedback)}</div>`:""}${key!==identityKey()?`<div style="display:flex;gap:7px;margin-top:9px"><input class="input" style="padding:8px 10px" data-feedback-input="${esc(id)}|${esc(key)}" value="${esc(sub.feedback||"")}" placeholder="Leave a kind correction or encouragement"/><button class="btn sm" data-save-feedback="${esc(id)}|${esc(key)}">Save</button></div>`:""}</div>`).join("")}</div>
    </article>`;
  }).join("");
  box.querySelectorAll("[data-save-hw]").forEach(btn => btn.addEventListener("click", () => saveHomeworkAnswer(btn.dataset.saveHw)));
  box.querySelectorAll("[data-delete-hw]").forEach(btn => btn.addEventListener("click", () => remove(ref(db, rootPath(`homework/${btn.dataset.deleteHw}`)))));
  box.querySelectorAll("[data-save-feedback]").forEach(btn => btn.addEventListener("click", () => saveFeedback(btn.dataset.saveFeedback)));
}
function targetLabel(target){ return target === "pt" ? "For the Portuguese learner" : target === "en" ? "For the English learner" : "For both of you"; }
function saveHomeworkAnswer(id){
  const text = document.querySelector(`[data-hw-answer="${CSS.escape(id)}"]`).value.trim();
  if (!text){ toast("Write an answer first"); return; }
  set(ref(db, rootPath(`homework/${id}/submissions/${identityKey()}`)), { name:displayName || "someone", text, t:now() });
  toast("Homework saved ✓");
}
function saveFeedback(key){
  const [hwId,studentId] = key.split("|");
  const input = document.querySelector(`[data-feedback-input="${CSS.escape(key)}"]`);
  update(ref(db, rootPath(`homework/${hwId}/submissions/${studentId}`)), { feedback:input.value.trim(), feedbackBy:displayName || "someone", feedbackT:now() });
  toast("Feedback saved 💛");
}

function addPhrase(){
  const en = $("bookEn").value.trim(), pt = $("bookPt").value.trim(), note = $("bookNote").value.trim();
  if (!en || !pt){ toast("Add both the English and Portuguese"); return; }
  const item = push(ref(db, rootPath("phrasebook")));
  set(item, { en, pt, note, by:identityKey(), name:displayName || "someone", t:now() });
  $("bookEn").value = ""; $("bookPt").value = ""; $("bookNote").value = "";
  toast("Added to your phrasebook 💬");
}
function renderPhrasebook(){
  const q = ($("bookSearch")?.value || "").trim().toLowerCase();
  const rows = Object.entries(phrasebookData).filter(([,v]) => v && (!q || `${v.en} ${v.pt} ${v.note||""}`.toLowerCase().includes(q))).sort((a,b)=>(b[1].t||0)-(a[1].t||0));
  const box = $("phrasebookList");
  if (!rows.length){ box.innerHTML = `<div class="empty">${q ? "Nothing matches that search." : "Your shared phrasebook is empty. Add the first phrase you want to remember together. 💞"}</div>`; return; }
  box.innerHTML = rows.map(([id,v]) => `<div class="bookRow"><div class="bookEn">${esc(v.en)} ${speakerButton(v.en,"en-US")}</div><div class="bookPt">${esc(v.pt)} ${speakerButton(v.pt,"pt-BR")}</div><div class="bookNote">${esc(v.note||`added by ${v.name||"someone"}`)}</div>${v.by===identityKey()?`<button class="btn sm" data-delete-book="${esc(id)}">Delete</button>`:"<span></span>"}</div>`).join("");
  box.querySelectorAll("[data-say]").forEach(btn => btn.addEventListener("click", () => speak(btn.dataset.say, btn.dataset.lang)));
  box.querySelectorAll("[data-delete-book]").forEach(btn => btn.addEventListener("click", () => remove(ref(db, rootPath(`phrasebook/${btn.dataset.deleteBook}`)))));
}

window.addEventListener("DOMContentLoaded", waitForRooms);
