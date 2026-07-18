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
const FOCUS_ITEMS = 3;
const MAX_SESSION_EXERCISES = 14;
const REVIEW_INTERVALS = [0, 1, 3, 7, 14, 30];

const params = new URLSearchParams(location.search);
const presetRoom = cleanRoom(params.get("room"));
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getDatabase(app);

let ROOM = null;
let roomEntered = false;
let currentLessonIndex = 0;
let progressData = {};
let suggestionsData = {};
let currentGoal = "pt";
let currentTab = "learn";
let connected = false;
let activeSession = null;
let displayName = localStorage.getItem("lc_name") || "";
let myId = localStorage.getItem("lc_device_id");
if (!myId) {
  myId = "lc" + Math.random().toString(36).slice(2, 10);
  localStorage.setItem("lc_device_id", myId);
}

const identityKey = () => (window.MFAuth && MFAuth.uid) ? MFAuth.uid : myId;
const rootPath = sub => `together/${ROOM}/language${sub ? "/" + sub : ""}`;
const lessonById = id => LESSONS.find(l => l.id === id);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const shuffle = arr => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};
const normalize = value => String(value || "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[’']/g, "")
  .replace(/[^a-z0-9\s]/g, " ")
  .replace(/\s+/g, " ")
  .trim();
const slug = value => normalize(value).replace(/\s+/g, "_").slice(0, 90);
const mine = () => progressData[identityKey()] || {};
const noAudio = () => !!(mine().settings && mine().settings.noAudio);
const hearts = () => Number.isFinite(Number(mine().hearts)) ? Number(mine().hearts) : MAX_HEARTS;
const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }).format(new Date());
const yesterdayKey = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return new Intl.DateTimeFormat("en-CA", { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }).format(d);
};
const on = (id, event, handler) => {
  const element = $(id);
  if (element) element.addEventListener(event, handler);
};

function answerAlternatives(value) {
  return String(value || "")
    .split(/\s*\/\s*/)
    .map(v => v.trim())
    .filter(Boolean);
}
function primaryAnswer(value) {
  return answerAlternatives(value)[0] || String(value || "").trim();
}
function answerMatches(given, expected) {
  const normalized = normalize(given);
  return answerAlternatives(expected).some(option => normalize(option) === normalized);
}
function directionFor(index = 0) {
  if (currentGoal === "en") return "en";
  if (currentGoal === "both") return index % 2 ? "en" : "pt";
  return "pt";
}
function sourceText(ex) {
  return ex.direction === "pt" ? ex.item.en : ex.item.pt;
}
function targetText(ex) {
  return ex.direction === "pt" ? ex.item.pt : ex.item.en;
}
function sourceLang(ex) {
  return ex.direction === "pt" ? "en-US" : "pt-BR";
}
function targetLang(ex) {
  return ex.direction === "pt" ? "pt-BR" : "en-US";
}
function goalLabel(goal) {
  return goal === "en" ? "learning English" : goal === "both" ? "practicing both" : "learning Portuguese";
}
function lessonProgress(id) {
  const raw = (mine().lessons || {})[id];
  return raw === true ? { completed: true, stars: 1, bestScore: 100, legacy: true } : (raw || {});
}
function masteryFor(item) {
  if (activeSession && activeSession.masteryCache && Object.prototype.hasOwnProperty.call(activeSession.masteryCache, item.key)) {
    return Number(activeSession.masteryCache[item.key] || 0);
  }
  return Number((mine().mastery || {})[item.key] || 0);
}
function reviewFor(item) {
  return (mine().review || {})[item.key] || {};
}
function dueForReview(item) {
  const state = reviewFor(item);
  return !state.dueAt || Number(state.dueAt) <= now();
}
function customPhraseRows(owner = mine()) {
  return Object.entries(owner.customPhrases || {})
    .filter(([, value]) => value && value.en && value.pt)
    .map(([id, value]) => ({ id, ...value }));
}
function builtInLessonItems(lesson) {
  return lesson.vocab.concat(lesson.phrases).map(([en, pt], index) => ({
    en,
    pt,
    key: `${lesson.id}_${slug(en)}_${index}`,
    lessonId: lesson.id,
    isPhrase: index >= lesson.vocab.length,
    custom: false
  }));
}
function allLessonItems(lesson, owner = mine()) {
  const custom = customPhraseRows(owner)
    .filter(item => item.lessonId === lesson.id)
    .map(item => ({
      en: item.en,
      pt: item.pt,
      key: `custom_${item.id}`,
      lessonId: item.lessonId,
      isPhrase: true,
      custom: true,
      customId: item.id,
      note: item.note || ""
    }));
  return builtInLessonItems(lesson).concat(custom);
}
function allUnlockedItems() {
  return LESSONS.filter((_, index) => isLessonUnlocked(index)).flatMap(lesson => allLessonItems(lesson));
}
function isSeen(item) {
  return !!((mine().seen || {})[item.key]);
}
function isLessonUnlocked(index) {
  if (index === 0) return true;
  return !!lessonProgress(LESSONS[index - 1].id).completed;
}

const EN_TO_PT = {
  "i":"eu", "im":"eu estou / eu sou", "you":"você / te", "your":"seu / sua", "youre":"você é / você está",
  "my":"meu / minha", "me":"me / mim", "we":"nós / a gente", "were":"nós estamos", "they":"eles / elas",
  "how":"como", "what":"o que / qual", "where":"onde", "when":"quando", "why":"por que", "who":"quem",
  "am":"estou / sou", "are":"está / são", "is":"é / está", "was":"era / estava", "will":"vai / vou",
  "can":"pode", "could":"poderia", "do":"faz / auxiliar", "did":"fez / auxiliar", "have":"ter / já",
  "not":"não", "no":"não", "yes":"sim", "the":"o / a", "a":"um / uma", "an":"um / uma",
  "to":"para / a", "for":"para / por", "of":"de", "from":"de", "in":"em", "on":"em", "at":"em / às",
  "with":"com", "and":"e", "or":"ou", "but":"mas", "this":"isso / este", "that":"isso / aquilo", "it":"isso",
  "hello":"olá", "hi":"oi", "good":"bom / boa", "morning":"manhã", "afternoon":"tarde", "evening":"noite",
  "night":"noite", "please":"por favor", "thank":"obrigada", "thanks":"obrigada", "welcome":"de nada / bem-vinda",
  "name":"nome", "nice":"prazer / legal", "meet":"conhecer", "talk":"falar", "later":"mais tarde",
  "love":"amor / amar", "baby":"bebê / amor", "beautiful":"linda", "cute":"fofa", "kiss":"beijo",
  "hug":"abraço / abraçar", "come":"vem", "give":"dar", "wish":"queria", "make":"faz", "makes":"faz",
  "happy":"feliz", "favorite":"favorita", "person":"pessoa", "today":"hoje", "now":"agora", "busy":"ocupada",
  "tired":"cansada", "hungry":"com fome", "sleepy":"com sono", "working":"trabalhando", "sleep":"dormir",
  "slept":"dormiu", "well":"bem", "eaten":"comido", "yet":"já / ainda", "doing":"fazendo", "free":"livre",
  "tell":"conta", "about":"sobre", "day":"dia", "miss":"sentir saudade", "here":"aqui", "everything":"tudo",
  "okay":"bem", "understand":"entender", "feel":"sentir", "proud":"orgulho / orgulhosa", "food":"comida",
  "eat":"comer", "want":"querer", "delicious":"delicioso", "some":"um pouco / algum", "coffee":"café",
  "cook":"cozinhar", "home":"casa", "bed":"cama", "shower":"banho", "clean":"limpar", "rest":"descansar",
  "wake":"acordar", "just":"acabei de / só", "taking":"tomando", "need":"preciso", "house":"casa",
  "lie":"deitar", "getting":"ficando / se preparando", "ready":"pronta", "yesterday":"ontem", "tomorrow":"amanhã",
  "week":"semana", "weekend":"fim de semana", "time":"horário / tempo", "works":"funciona", "call":"ligar",
  "eight":"oito", "mine":"meu / minha", "wait":"esperar", "game":"jogo", "team":"equipe / time",
  "win":"ganhar", "lose":"perder", "help":"ajuda", "left":"esquerda", "right":"direita", "behind":"atrás",
  "close":"perto / por pouco", "play":"jogar", "more":"mais", "airport":"aeroporto", "flight":"voo",
  "arrives":"chega", "ticket":"passagem", "passport":"passaporte", "suitcase":"mala", "hotel":"hotel",
  "reservation":"reserva", "bathroom":"banheiro", "text":"manda mensagem", "arrive":"chegar", "finally":"finalmente",
  "together":"juntas", "say":"dizer", "again":"de novo", "speak":"falar", "slowly":"devagar", "mean":"significar",
  "know":"saber", "word":"palavra", "try":"tentar", "learning":"aprendendo"
};
const PT_TO_EN = {
  "eu":"I", "voce":"you", "você":"you", "te":"you / to you", "meu":"my / mine", "minha":"my / mine",
  "seu":"your / yours", "sua":"your / yours", "estou":"I am", "sou":"I am", "esta":"is / are", "está":"is / are",
  "e":"and / is", "é":"is", "sao":"are", "são":"are", "como":"how", "qual":"what / which", "o":"the / what",
  "que":"what / that", "onde":"where", "quando":"when", "por":"for / by", "porque":"because / why",
  "favor":"favor", "nao":"no / not", "não":"no / not", "sim":"yes", "de":"of / from", "com":"with",
  "para":"for / to", "a":"the / to", "as":"the / at", "às":"at", "em":"in / on", "ou":"or",
  "mas":"but", "isso":"this / that", "ola":"hello", "olá":"hello", "oi":"hi", "bom":"good", "boa":"good",
  "dia":"day / morning", "manha":"morning", "manhã":"morning", "tarde":"afternoon / later", "noite":"night / evening",
  "obrigada":"thank you", "obrigado":"thank you", "nada":"nothing / welcome", "nome":"name", "prazer":"pleasure / nice",
  "conhecer":"meet / know", "falo":"I talk", "falar":"talk / speak", "mais":"more / later", "amor":"love",
  "bebe":"baby", "bebê":"baby", "linda":"beautiful", "fofa":"cute", "beijo":"kiss", "abraco":"hug", "abraço":"hug",
  "vem":"come", "dar":"give", "queria":"I wish / wanted", "poder":"can / could", "abracar":"hug", "abraçar":"hug",
  "faz":"makes / does", "feliz":"happy", "favorita":"favorite", "pessoa":"person", "hoje":"today", "agora":"now",
  "ocupada":"busy", "cansada":"tired", "fome":"hunger / hungry", "sono":"sleepiness / sleepy", "trabalhando":"working",
  "dormiu":"slept", "bem":"well / okay", "ja":"already / yet", "já":"already / yet", "comeu":"ate", "fazendo":"doing",
  "livre":"free", "conta":"tell", "sobre":"about", "saudade":"missing / longing", "aqui":"here", "pode":"can",
  "tudo":"everything", "vai":"will / goes", "ficar":"become / stay", "entendo":"I understand", "sente":"feels",
  "orgulho":"pride / proud", "comida":"food", "comer":"eat", "quero":"I want", "quer":"want", "delicioso":"delicious",
  "cafe":"coffee", "café":"coffee", "cozinhar":"cook", "casa":"home / house", "cama":"bed", "banho":"shower",
  "limpar":"clean", "descansar":"rest", "acordar":"wake up", "acabei":"I just finished", "tomando":"taking",
  "preciso":"I need", "deitar":"lie down", "preparando":"getting ready", "dormir":"sleep", "ontem":"yesterday",
  "amanha":"tomorrow", "amanhã":"tomorrow", "semana":"week", "horario":"time", "horário":"time", "tempo":"time",
  "funciona":"works", "vamos":"let's / we go", "neste":"this / in this", "ligar":"call", "oito":"eight", "mal":"hardly",
  "esperar":"wait", "jogo":"game", "equipe":"team", "time":"team", "ganhar":"win", "perder":"lose", "ajuda":"help",
  "esquerda":"left", "direita":"right", "atras":"behind", "atrás":"behind", "pouco":"little", "jogar":"play",
  "aeroporto":"airport", "voo":"flight", "chega":"arrives", "passagem":"ticket", "passaporte":"passport", "mala":"suitcase",
  "hotel":"hotel", "reserva":"reservation", "banheiro":"bathroom", "manda":"send", "mensagem":"message", "chegar":"arrive",
  "finalmente":"finally", "juntas":"together", "repetir":"repeat", "fale":"speak", "devagar":"slowly", "significa":"means",
  "ainda":"still / yet", "sei":"I know", "palavra":"word", "deixa":"let", "tentar":"try", "novo":"new / again",
  "aprendendo":"learning"
};

function clueForWord(word, lang) {
  const key = normalize(word);
  if (!key) return "";
  return lang.startsWith("pt") ? (PT_TO_EN[key] || "") : (EN_TO_PT[key] || "");
}
function clueSentenceHtml(text, lang) {
  const pieces = String(text || "").split(/(\s+)/);
  let tokenIndex = 0;
  return pieces.map(piece => {
    if (/^\s+$/.test(piece)) return piece;
    const clean = piece.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    if (!clean) return esc(piece);
    const clue = clueForWord(clean, lang);
    if (!clue) return esc(piece);
    const prefix = piece.slice(0, piece.indexOf(clean));
    const suffix = piece.slice(piece.indexOf(clean) + clean.length);
    const index = tokenIndex++;
    return `${esc(prefix)}<button class="clueWord" type="button" data-clue-word="${esc(clean)}" data-clue="${esc(clue)}" data-token="${index}">${esc(clean)}</button>${esc(suffix)}`;
  }).join("");
}
function clueBlock(ex, text = sourceText(ex)) {
  return `<div class="bigWord clueSentence">${clueSentenceHtml(primaryAnswer(text), sourceLang(ex))}</div>
    <div class="clueGuide">Tap a <span>highlighted word</span> for a small clue.</div>
    <button class="fullClueBtn" id="fullClueBtn" type="button">Show the whole phrase meaning</button>
    <div id="clueBubble" hidden></div>`;
}
function wireClues(ex) {
  const card = $("exerciseCard");
  card.querySelectorAll("[data-clue]").forEach(button => button.addEventListener("click", () => {
    ex.assisted = true;
    const bubble = $("clueBubble");
    bubble.hidden = false;
    bubble.className = "clueBubble";
    bubble.innerHTML = `<strong>${esc(button.dataset.clueWord)}</strong><span>${esc(button.dataset.clue)}</span><small>Using a clue gives partial credit, and this item will return later.</small>`;
  }));
  on("fullClueBtn", "click", () => {
    ex.assisted = true;
    const bubble = $("clueBubble");
    bubble.hidden = false;
    bubble.className = "clueBubble";
    bubble.innerHTML = `<strong>Whole phrase</strong><span>${esc(primaryAnswer(targetText(ex)))}</span><small>You can still answer, but the course will ask this again without help.</small>`;
  });
}

function waitForRooms(tries = 0) {
  if (window.MFRooms && MFRooms.whenReady) {
    MFRooms.whenReady(() => gateAndEnter(presetRoom));
    return;
  }
  if (tries > 100) {
    location.href = "/together.html";
    return;
  }
  setTimeout(() => waitForRooms(tries + 1), 100);
}
async function gateAndEnter(room) {
  if (!room) {
    location.href = "/together.html";
    return;
  }
  try {
    const info = await MFRooms.get(room);
    if (!info) return bounce("missing", room);
    if (info.type !== "learn") {
      location.href = MFRooms.urlFor(info);
      return;
    }
    const access = await MFRooms.canEnter(info);
    if (!access.ok) return bounce(access.reason, room);
    try { await MFRooms.touch(room); } catch (_) {}
    enterRoom(room);
  } catch (error) {
    console.error(error);
    bounce("missing", room);
  }
}
function bounce(reason, room) {
  location.href = `/together.html?denied=${encodeURIComponent(reason || "missing")}&room=${encodeURIComponent(room || "")}`;
}
function trackIdentity() {
  let tries = 0;
  const interval = setInterval(() => {
    if (!window.MFAuth) {
      if (++tries > 150) clearInterval(interval);
      return;
    }
    clearInterval(interval);
    if (!MFAuth.isConfigured()) return;
    MFAuth.onChange(user => {
      const input = $("nameInput");
      if (user && MFAuth.name()) {
        displayName = MFAuth.name();
        if (input) {
          input.value = displayName;
          input.readOnly = true;
        }
      } else if (input) {
        input.value = displayName;
        input.readOnly = false;
      }
      if (ROOM) ensureProfile();
    });
  }, 100);
}
trackIdentity();

function enterRoom(room) {
  if (roomEntered) return;
  roomEntered = true;
  ROOM = room;
  $("gateView").hidden = true;
  $("roomView").hidden = false;
  $("roomBar").hidden = false;
  $("nameInput").value = displayName;
  const url = new URL(location.href);
  url.searchParams.set("room", room);
  history.replaceState(null, "", url);
  setupTabs();
  setupConnection();
  setupSharedState();
  setupActions();
  populateLessonSelects();
  renderEverything();
}
function setupTabs() {
  $("tabs").querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => {
    currentTab = tab.dataset.tab;
    $("tabs").querySelectorAll(".tab").forEach(item => item.classList.toggle("active", item === tab));
    document.querySelectorAll(".panel").forEach(panel => panel.classList.toggle("active", panel.dataset.panel === currentTab));
    if (currentTab === "partner") renderPartner();
    if (currentTab === "phrasebook") renderPhrasebook();
  }));
}
function switchTab(name) {
  const tab = $("tabs").querySelector(`[data-tab="${name}"]`);
  if (tab) tab.click();
}
function setupConnection() {
  onValue(ref(db, ".info/connected"), snapshot => {
    connected = snapshot.val() === true;
    $("connDot").className = "dot " + (connected ? "on" : "off");
    $("connText").textContent = connected ? "Progress synced" : "Offline";
  });
}
function setupSharedState() {
  onValue(ref(db, rootPath("progress")), snapshot => {
    progressData = snapshot.val() || {};
    const me = mine();
    currentGoal = me.goal || currentGoal;
    if (me.currentLesson) {
      const index = LESSONS.findIndex(lesson => lesson.id === me.currentLesson);
      if (index >= 0) currentLessonIndex = index;
    }
    $("goalSelect").value = currentGoal;
    $("noAudioToggle").checked = noAudio();
    renderEverything();
  });
  onValue(ref(db, rootPath("suggestions")), snapshot => {
    suggestionsData = snapshot.val() || {};
    renderPartner();
  });
  ensureProfile();
}
async function ensureProfile() {
  if (!ROOM) return;
  const profileRef = ref(db, rootPath(`progress/${identityKey()}`));
  const snapshot = await get(profileRef);
  const defaults = {
    name: displayName || "someone",
    goal: currentGoal,
    hearts: MAX_HEARTS,
    xp: 0,
    streak: 0,
    currentLesson: LESSONS[0].id,
    settings: { noAudio: false },
    updated: now()
  };
  if (!snapshot.exists()) await set(profileRef, defaults);
  else await update(profileRef, { name: displayName || snapshot.val().name || "someone", updated: now() });
}
function updateMyProgress(values) {
  return update(ref(db, rootPath(`progress/${identityKey()}`)), {
    name: displayName || "someone",
    goal: currentGoal,
    updated: now(),
    ...values
  });
}
function setupActions() {
  on("copyRoomBtn", "click", async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      toast("Partner invite copied 🔗");
    } catch (_) {
      toast(location.href);
    }
  });
  on("nameInput", "input", event => {
    if (event.target.readOnly) return;
    displayName = event.target.value.slice(0, 24) || "someone";
    localStorage.setItem("lc_name", displayName);
    updateMyProgress({ name: displayName });
  });
  on("goalSelect", "change", event => {
    currentGoal = event.target.value;
    updateMyProgress({ goal: currentGoal });
    renderEverything();
  });
  on("noAudioToggle", "change", event => {
    updateMyProgress({ "settings/noAudio": !!event.target.checked });
    toast(event.target.checked ? "Audio exercises are off 🔇" : "Audio exercises are on 🔊");
  });
  on("closeSession", "click", closeSession);
  on("smartPracticeBtn", "click", () => startPractice("weak"));
  on("randomPracticeBtn", "click", () => startPractice("mixed"));
  on("practiceMistakesBtn", "click", () => startPractice("mistakes"));
  on("refillHeartsBtn", "click", () => startPractice("hearts"));
  on("sendSuggestion", "click", sendSuggestion);
  on("addPhrase", "click", addCustomPhrase);
  on("bookSearch", "input", renderPhrasebook);
}
function populateLessonSelects() {
  const options = LESSONS.map(lesson => `<option value="${esc(lesson.id)}">${lesson.emoji} ${esc(lesson.title)}</option>`).join("");
  if ($("suggestLesson")) $("suggestLesson").innerHTML = options;
  if ($("bookLesson")) $("bookLesson").innerHTML = options;
}

function renderEverything() {
  renderStats();
  renderPath();
  renderLessonOverview();
  renderWeakWords();
  renderMistakes();
  renderPartner();
  renderPhrasebook();
}
function renderStats() {
  const items = allUnlockedItems();
  const masteryTotal = items.reduce((sum, item) => sum + masteryFor(item), 0);
  const mastery = items.length ? Math.round((masteryTotal / (items.length * 5)) * 100) : 0;
  $("streakStat").textContent = Number(mine().streak || 0);
  $("xpStat").textContent = `${Number(mine().xp || 0)} XP`;
  $("heartsStat").textContent = `${hearts()} / ${MAX_HEARTS}`;
  $("masteryStat").textContent = `${mastery}%`;
}
function renderPath() {
  const box = $("pathList");
  if (!box) return;
  box.innerHTML = "";
  LESSONS.forEach((lesson, index) => {
    const progress = lessonProgress(lesson.id);
    const unlocked = isLessonUnlocked(index);
    const done = !!progress.completed;
    const current = index === currentLessonIndex;
    const due = unlocked && allLessonItems(lesson).some(item => masteryFor(item) > 0 && dueForReview(item));
    const wrap = document.createElement("div");
    wrap.className = "pathNodeWrap";
    const button = document.createElement("button");
    button.className = `pathNode ${done ? "done " : ""}${current ? "current " : ""}${due && done && !current ? "review " : ""}${!unlocked ? "locked" : ""}`;
    button.disabled = !unlocked;
    button.textContent = !unlocked ? "🔒" : due && done && !current ? "↻" : done ? "✓" : lesson.emoji;
    button.title = due ? `${lesson.title} — review due` : lesson.title;
    button.addEventListener("click", () => selectLesson(index));
    const stars = Number(progress.stars || 0);
    const customCount = allLessonItems(lesson).filter(item => item.custom).length;
    const info = document.createElement("div");
    info.className = "pathInfo";
    info.innerHTML = `<strong>${index + 1}. ${esc(lesson.title)}</strong><span>${!unlocked ? "Complete the lesson above" : due && done ? "Review is due" : done ? `Best: ${Number(progress.bestScore || 0)}% · <span class="stars">${"★".repeat(stars)}${"☆".repeat(3 - stars)}</span>` : `New lesson${customCount ? ` · ${customCount} custom` : ""}`}</span>`;
    wrap.append(button, info);
    box.appendChild(wrap);
  });
}
function selectLesson(index) {
  if (!isLessonUnlocked(index)) {
    toast("Complete the previous lesson first 🔒");
    return;
  }
  currentLessonIndex = index;
  updateMyProgress({ currentLesson: LESSONS[index].id });
  renderPath();
  renderLessonOverview();
}
function selectFocusItems(lesson, count = FOCUS_ITEMS) {
  const items = allLessonItems(lesson);
  return [...items]
    .map(item => ({
      item,
      rank: (dueForReview(item) ? -100 : 0) + masteryFor(item) * 12 + (item.custom ? -8 : 0) + Math.random() * 4
    }))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, Math.min(count, items.length))
    .map(entry => entry.item);
}
function renderLessonOverview() {
  const box = $("lessonOverview");
  if (!box) return;
  const lesson = LESSONS[currentLessonIndex];
  const progress = lessonProgress(lesson.id);
  const unlocked = isLessonUnlocked(currentLessonIndex);
  const score = Number(progress.bestScore || 0);
  const done = !!progress.completed;
  const items = allLessonItems(lesson);
  const focus = selectFocusItems(lesson);
  const dueCount = items.filter(item => masteryFor(item) > 0 && dueForReview(item)).length;
  const customCount = items.filter(item => item.custom).length;
  const languageLabel = currentGoal === "en" ? "Portuguese → English" : currentGoal === "both" ? "Both directions" : "English → Portuguese";
  box.innerHTML = `
    <div class="lessonBanner"><div class="lessonEmoji">${lesson.emoji}</div><div><h2>${currentLessonIndex + 1}. ${esc(lesson.title)}</h2><p>${esc(lesson.goal)}</p><div class="lessonMeta"><span class="tag">${items.length} course items</span><span class="tag">${languageLabel}</span><span class="tag">${dueCount ? `${dueCount} due for review` : "3-item focus"}</span>${customCount ? `<span class="tag">${customCount} personal phrase${customCount === 1 ? "" : "s"}</span>` : ""}</div></div></div>
    <div class="progressTrack"><div class="progressFill" style="width:${done ? 100 : score}%"></div></div><div class="progressText"><span>${done ? "Lesson complete" : "Best lesson score"}</span><span>${done ? `${Number(progress.stars || 1)} star${Number(progress.stars || 1) === 1 ? "" : "s"}` : `${score}%`}</span></div>
    <div class="activeLessonCallout"><strong>Next session</strong><span>You will learn and practice only ${focus.length} focus items, moving from clues and recognition to sentence building and unaided recall.</span></div>
    <div class="lessonActions"><button class="btn primary" id="startLessonBtn" ${unlocked ? "" : "disabled"}>${done ? (dueCount ? "Review lesson" : "Practice again") : "Start lesson"}</button>${noAudio() ? "" : `<button class="btn blue" id="previewAudioBtn">🔊 Hear focus words</button>`}</div>
    <h3 style="margin:0 0 4px">Your next focus</h3><div class="wordPreview">${focus.map(item => `<span class="wordChip">${esc(item.en)} · <b>${esc(item.pt)}</b>${item.custom ? " ✨" : ""}</span>`).join("")}</div>
    <div class="skillGrid"><div class="skill"><strong>1. Learn</strong><p>New material is shown with word-by-word clues before it is scored.</p></div><div class="skill"><strong>2. Recognize</strong><p>Select the right meaning among believable alternatives.</p></div><div class="skill"><strong>3. Build</strong><p>Put the target sentence together in the correct order.</p></div><div class="skill"><strong>4. Recall</strong><p>Type it without clues to prove it stuck.</p></div></div>
    <div class="tip"><strong>Language note:</strong> ${esc(lesson.tip)}</div>`;
  on("startLessonBtn", "click", () => startLesson(currentLessonIndex));
  on("previewAudioBtn", "click", () => speakSequence(focus));
}
async function speakSequence(items) {
  for (const item of items) {
    const dir = directionFor(0);
    const text = dir === "pt" ? primaryAnswer(item.pt) : primaryAnswer(item.en);
    await speakAndWait(text, dir === "pt" ? "pt-BR" : "en-US");
    await new Promise(resolve => setTimeout(resolve, 180));
  }
}

function choicePool(item, direction, lesson, answerSide = "target") {
  const useTarget = answerSide === "target";
  const answer = useTarget
    ? primaryAnswer(direction === "pt" ? item.pt : item.en)
    : primaryAnswer(direction === "pt" ? item.en : item.pt);
  const values = allLessonItems(lesson).map(candidate => useTarget
    ? primaryAnswer(direction === "pt" ? candidate.pt : candidate.en)
    : primaryAnswer(direction === "pt" ? candidate.en : candidate.pt));
  const candidates = shuffle(values.filter(value => normalize(value) !== normalize(answer)));
  return shuffle([answer, ...candidates.slice(0, 3)]);
}
function makeExercise(item, type, direction, lesson, extra = {}) {
  let finalType = type;
  const target = primaryAnswer(direction === "pt" ? item.pt : item.en);
  if (finalType === "listen" && noAudio()) finalType = "choice";
  if (finalType === "bank" && target.split(/\s+/).length < 2) finalType = "cloze";
  return {
    type: finalType,
    item,
    direction,
    lessonId: lesson.id,
    scoreId: extra.scoreId || `${item.key}_${type}_${Math.random().toString(36).slice(2, 7)}`,
    retryCount: extra.retryCount || 0,
    assisted: false,
    ...extra
  };
}
function buildLessonExercises(lesson) {
  const focus = selectFocusItems(lesson);
  const exercises = [];
  focus.forEach((item, index) => {
    const direction = directionFor(index);
    if (!isSeen(item) || masteryFor(item) === 0) exercises.push(makeExercise(item, "teach", direction, lesson));
  });
  focus.forEach((item, index) => exercises.push(makeExercise(item, "choice", directionFor(index), lesson)));
  if (focus.length >= 2) exercises.push({
    type: "match",
    items: focus,
    direction: directionFor(0),
    scoreId: `match_${lesson.id}_${Date.now()}`,
    retryCount: 0,
    assisted: false
  });
  focus.forEach((item, index) => {
    const direction = directionFor(index);
    const type = item.isPhrase ? (index % 2 ? "cloze" : "bank") : (index % 2 ? "type" : "cloze");
    exercises.push(makeExercise(item, type, direction, lesson));
  });
  focus.slice(0, 2).forEach((item, index) => exercises.push(makeExercise(item, "type", directionFor(index + 1), lesson, { finalRecall: true })));
  if (!noAudio() && focus.length) exercises.splice(Math.min(4, exercises.length), 0, makeExercise(focus[0], "listen", directionFor(0), lesson));
  return exercises.slice(0, MAX_SESSION_EXERCISES);
}
function practiceSource(mode) {
  const all = allUnlockedItems();
  const mistakes = Object.values(mine().mistakes || {}).filter(Boolean).map(value => ({ ...value, isPhrase: primaryAnswer(value.en).includes(" ") || primaryAnswer(value.pt).includes(" ") }));
  if (mode === "mistakes") return mistakes;
  if (mode === "weak" || mode === "hearts") {
    return [...all].sort((a, b) => {
      const dueA = dueForReview(a) ? -50 : 0;
      const dueB = dueForReview(b) ? -50 : 0;
      return (dueA + masteryFor(a) * 10) - (dueB + masteryFor(b) * 10);
    });
  }
  return shuffle(all);
}
function buildPracticeExercises(mode) {
  const source = practiceSource(mode).slice(0, 6);
  if (!source.length) return [];
  const exercises = [];
  source.forEach((item, index) => {
    const lesson = lessonById(item.lessonId) || LESSONS[0];
    if ((!isSeen(item) || masteryFor(item) === 0) && index < 2) exercises.push(makeExercise(item, "teach", directionFor(index), lesson));
    const types = ["choice", "cloze", "type", "bank", "choice", "type"];
    exercises.push(makeExercise(item, types[index % types.length], directionFor(index), lesson));
  });
  if (source.length >= 3) exercises.splice(Math.min(5, exercises.length), 0, {
    type: "match",
    items: source.slice(0, 4),
    direction: directionFor(0),
    scoreId: `practice_match_${Date.now()}`,
    retryCount: 0,
    assisted: false
  });
  return exercises.slice(0, MAX_SESSION_EXERCISES);
}
function createSession(kind, mode, exercises, lessonIndex = null) {
  activeSession = {
    kind,
    mode,
    lessonIndex,
    exercises,
    position: 0,
    hearts: hearts(),
    xp: 0,
    wrong: 0,
    assistedCorrect: 0,
    locked: false,
    selected: null,
    bank: [],
    scores: {},
    masteryCache: { ...(mine().mastery || {}) }
  };
}
function startLesson(index) {
  if (!isLessonUnlocked(index)) return toast("Complete the previous lesson first");
  if (hearts() <= 0) {
    toast("Practice to refill your hearts first ❤️");
    switchTab("practice");
    return;
  }
  createSession("lesson", "lesson", buildLessonExercises(LESSONS[index]), index);
  showSession();
  renderExercise();
}
function startPractice(mode) {
  const exercises = buildPracticeExercises(mode);
  if (!exercises.length) return toast("Start a lesson first so there is something to practice");
  createSession("practice", mode, exercises);
  showSession();
  renderExercise();
}
function showSession() {
  $("normalView").hidden = true;
  $("courseHeader").hidden = true;
  $("roomBar").hidden = true;
  $("sessionView").hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function closeSession() {
  if (!activeSession) return;
  const started = activeSession.position > 0;
  if (started && !confirm("Leave this session? Your unfinished attempt will not be scored.")) return;
  activeSession = null;
  $("sessionView").hidden = true;
  $("normalView").hidden = false;
  $("courseHeader").hidden = false;
  $("roomBar").hidden = false;
  renderEverything();
}
function baseCheckBar(label = "Check") {
  return `<div class="checkBar"><div class="feedbackMsg" id="feedbackMsg"></div><button class="btn primary" id="checkAnswer">${label}</button></div>`;
}
function renderExercise() {
  if (!activeSession) return;
  if (activeSession.position >= activeSession.exercises.length) return finishSession();
  activeSession.locked = false;
  activeSession.selected = null;
  activeSession.bank = [];
  const ex = activeSession.exercises[activeSession.position];
  ex.assisted = false;
  $("sessionProgress").style.width = `${Math.round((activeSession.position / activeSession.exercises.length) * 100)}%`;
  $("sessionHearts").textContent = `❤️ ${activeSession.hearts}`;
  const card = $("exerciseCard");
  if (ex.type === "teach") renderTeach(card, ex);
  else if (ex.type === "choice") renderChoice(card, ex);
  else if (ex.type === "listen") renderListening(card, ex);
  else if (ex.type === "type") renderType(card, ex);
  else if (ex.type === "bank") renderBank(card, ex);
  else if (ex.type === "cloze") renderCloze(card, ex);
  else if (ex.type === "match") renderMatch(card, ex);
}
function renderTeach(card, ex) {
  card.innerHTML = `<div class="exerciseType">Learn before you answer</div><div class="exercisePrompt">Study this ${ex.item.isPhrase ? "phrase" : "word"}</div>
    <div class="teachingPair"><div><span>${ex.direction === "pt" ? "English" : "Português"}</span><strong>${esc(primaryAnswer(sourceText(ex)))}</strong></div><div class="teachArrow">↓</div><div><span>${ex.direction === "pt" ? "Português" : "English"}</span><strong>${esc(primaryAnswer(targetText(ex)))}</strong></div></div>
    ${noAudio() ? "" : `<button class="speakerBig" id="teachSpeak" type="button">🔊</button>`}
    <div class="teachNote">This screen does not award mastery. The next questions will make you recognize, build, and recall it.</div>${baseCheckBar("Practice it")}`;
  on("teachSpeak", "click", () => speak(primaryAnswer(targetText(ex)), targetLang(ex)));
  on("checkAnswer", "click", async () => {
    if (activeSession.locked) return;
    activeSession.locked = true;
    await set(ref(db, rootPath(`progress/${identityKey()}/seen/${ex.item.key}`)), true);
    activeSession.position++;
    renderExercise();
  });
}
function renderChoice(card, ex) {
  const lesson = lessonById(ex.lessonId) || LESSONS[0];
  const choices = choicePool(ex.item, ex.direction, lesson, "target");
  card.innerHTML = `<div class="exerciseType">Choose the meaning</div><div class="exercisePrompt">Translate into ${ex.direction === "pt" ? "Portuguese" : "English"}</div>${clueBlock(ex)}
    <div class="choiceGrid">${choices.map(choice => `<button class="choice" type="button" data-choice="${esc(choice)}">${esc(choice)}</button>`).join("")}</div>${baseCheckBar()}`;
  wireClues(ex);
  wireChoices();
  on("checkAnswer", "click", () => {
    if (!activeSession.selected) return toast("Choose an answer first");
    gradeCurrent(answerMatches(activeSession.selected, targetText(ex)), ex, activeSession.selected);
  });
}
function renderListening(card, ex) {
  const lesson = lessonById(ex.lessonId) || LESSONS[0];
  const choices = choicePool(ex.item, ex.direction, lesson, "source");
  card.innerHTML = `<div class="exerciseType">Listening</div><div class="exercisePrompt">What does this mean?</div><button class="speakerBig" id="listenBtn" type="button">🔊</button>
    <button class="hintBtn" id="cantListenBtn" type="button">I can’t listen right now</button>
    <div class="choiceGrid">${choices.map(choice => `<button class="choice" type="button" data-choice="${esc(choice)}">${esc(choice)}</button>`).join("")}</div>${baseCheckBar()}`;
  const play = () => speak(primaryAnswer(targetText(ex)), targetLang(ex));
  on("listenBtn", "click", play);
  setTimeout(play, 250);
  on("cantListenBtn", "click", async () => {
    await updateMyProgress({ "settings/noAudio": true });
    ex.type = "choice";
    renderExercise();
    toast("Audio exercises are now disabled 🔇");
  });
  wireChoices();
  on("checkAnswer", "click", () => {
    if (!activeSession.selected) return toast("Choose an answer first");
    gradeCurrent(answerMatches(activeSession.selected, sourceText(ex)), ex, activeSession.selected, sourceText(ex));
  });
}
function renderType(card, ex) {
  card.innerHTML = `<div class="exerciseType">Type the translation</div><div class="exercisePrompt">Translate into ${ex.direction === "pt" ? "Portuguese" : "English"}</div>${clueBlock(ex)}
    <input class="input typeAnswer" id="typedAnswer" autocomplete="off" autocapitalize="sentences" placeholder="Type your answer…" />
    <div class="hintText">Accents, capitalization, and punctuation are optional.</div>${baseCheckBar()}`;
  wireClues(ex);
  const input = $("typedAnswer");
  input.focus();
  input.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      $("checkAnswer").click();
    }
  });
  on("checkAnswer", "click", () => {
    const answer = input.value.trim();
    if (!answer) return toast("Type an answer first");
    gradeCurrent(answerMatches(answer, targetText(ex)), ex, answer);
  });
}
function wordsForBank(answer) {
  return primaryAnswer(answer).replace(/([!?.,])/g, " $1 ").split(/\s+/).filter(Boolean);
}
function renderBank(card, ex) {
  const targetWords = wordsForBank(targetText(ex));
  const lesson = lessonById(ex.lessonId) || LESSONS[0];
  const distractors = shuffle(allLessonItems(lesson).flatMap(item => wordsForBank(ex.direction === "pt" ? item.pt : item.en)))
    .filter(word => !targetWords.some(target => normalize(target) === normalize(word)))
    .slice(0, Math.min(3, Math.max(1, targetWords.length - 1)));
  const bankWords = shuffle(targetWords.concat(distractors)).map((word, index) => ({ word, id: index }));
  card.innerHTML = `<div class="exerciseType">Build the sentence</div><div class="exercisePrompt">Put this into ${ex.direction === "pt" ? "Portuguese" : "English"}</div>${clueBlock(ex)}
    <div class="wordBank" id="answerBank"><span class="bankPlaceholder">Tap words below to build your answer</span></div>
    <div class="bankWords">${bankWords.map(token => `<button class="bankWord" type="button" data-bank-id="${token.id}" data-word="${esc(token.word)}">${esc(token.word)}</button>`).join("")}</div>${baseCheckBar()}`;
  wireClues(ex);
  const redraw = () => {
    const answerBank = $("answerBank");
    answerBank.innerHTML = activeSession.bank.length
      ? activeSession.bank.map((token, index) => `<button class="answerWord" type="button" data-remove="${index}">${esc(token.word)}</button>`).join("")
      : `<span class="bankPlaceholder">Tap words below to build your answer</span>`;
    answerBank.querySelectorAll("[data-remove]").forEach(button => button.addEventListener("click", () => {
      const [removed] = activeSession.bank.splice(Number(button.dataset.remove), 1);
      const original = card.querySelector(`[data-bank-id="${removed.id}"]`);
      if (original) original.disabled = false;
      redraw();
    }));
  };
  card.querySelectorAll(".bankWord").forEach(button => button.addEventListener("click", () => {
    activeSession.bank.push({ word: button.dataset.word, id: Number(button.dataset.bankId) });
    button.disabled = true;
    redraw();
  }));
  on("checkAnswer", "click", () => {
    if (!activeSession.bank.length) return toast("Build the sentence first");
    const answer = activeSession.bank.map(token => token.word).join(" ").replace(/\s+([!?.,])/g, "$1");
    gradeCurrent(answerMatches(answer, targetText(ex)), ex, answer);
  });
}
function renderCloze(card, ex) {
  const target = primaryAnswer(targetText(ex));
  const words = target.split(/\s+/).filter(Boolean);
  const blankIndex = words.length > 2 ? Math.floor(words.length / 2) : Math.max(0, words.length - 1);
  const answer = words[blankIndex];
  const shown = words.map((word, index) => index === blankIndex ? "_____" : word).join(" ");
  const lesson = lessonById(ex.lessonId) || LESSONS[0];
  const distractors = shuffle(allLessonItems(lesson).flatMap(item => primaryAnswer(ex.direction === "pt" ? item.pt : item.en).split(/\s+/)))
    .filter(word => normalize(word) !== normalize(answer))
    .slice(0, 3);
  const choices = shuffle([answer, ...distractors]);
  card.innerHTML = `<div class="exerciseType">Complete the sentence</div><div class="exercisePrompt">Choose the missing word</div>
    <div class="clozeSource">${clueSentenceHtml(primaryAnswer(sourceText(ex)), sourceLang(ex))}</div><div class="clueGuide">Tap a <span>highlighted word</span> for a clue.</div><button class="fullClueBtn" id="fullClueBtn" type="button">Show the whole phrase meaning</button><div id="clueBubble" hidden></div>
    <div class="clozeSentence">${esc(shown)}</div><div class="choiceGrid">${choices.map(choice => `<button class="choice" type="button" data-choice="${esc(choice)}">${esc(choice)}</button>`).join("")}</div>${baseCheckBar()}`;
  wireClues(ex);
  wireChoices();
  on("checkAnswer", "click", () => {
    if (!activeSession.selected) return toast("Choose a word first");
    gradeCurrent(normalize(activeSession.selected) === normalize(answer), ex, activeSession.selected, answer);
  });
}
function renderMatch(card, ex) {
  ex.matchErrors = 0;
  ex.matched = 0;
  const pairs = ex.items.map((item, index) => ({
    id: index,
    left: primaryAnswer(ex.direction === "en" ? item.pt : item.en),
    right: primaryAnswer(ex.direction === "en" ? item.en : item.pt)
  }));
  const left = shuffle(pairs.map(pair => ({ pair: pair.id, text: pair.left, side: "left" })));
  const right = shuffle(pairs.map(pair => ({ pair: pair.id, text: pair.right, side: "right" })));
  card.innerHTML = `<div class="exerciseType">Match the pairs</div><div class="exercisePrompt">Connect each meaning</div><div class="matchGrid">${left.concat(right).map(item => `<button class="matchItem" type="button" data-pair="${item.pair}" data-side="${item.side}">${esc(item.text)}</button>`).join("")}</div>${baseCheckBar("Finish")}`;
  let selected = null;
  card.querySelectorAll(".matchItem").forEach(button => button.addEventListener("click", () => {
    if (button.classList.contains("matched") || activeSession.locked) return;
    if (!selected) {
      selected = button;
      button.classList.add("selected");
      return;
    }
    if (selected === button) {
      selected.classList.remove("selected");
      selected = null;
      return;
    }
    if (selected.dataset.side === button.dataset.side) {
      selected.classList.remove("selected");
      selected = button;
      button.classList.add("selected");
      return;
    }
    if (selected.dataset.pair === button.dataset.pair) {
      selected.classList.remove("selected");
      selected.classList.add("matched");
      button.classList.add("matched");
      selected = null;
      ex.matched++;
      if (ex.matched === pairs.length) {
        $("feedbackMsg").textContent = ex.matchErrors ? "All matched. A few needed another try." : "Perfect matches!";
        $("feedbackMsg").className = "feedbackMsg good";
      }
    } else {
      ex.matchErrors++;
      const first = selected;
      selected = null;
      first.classList.remove("selected");
      first.classList.add("bad");
      button.classList.add("bad");
      setTimeout(() => {
        first.classList.remove("bad");
        button.classList.remove("bad");
      }, 300);
    }
  }));
  on("checkAnswer", "click", () => {
    if (ex.matched < pairs.length) return toast("Match every pair first");
    if (activeSession.locked) return;
    activeSession.locked = true;
    const score = ex.matchErrors === 0 ? 1 : ex.matchErrors <= 2 ? 0.75 : 0.5;
    setScore(ex, score);
    activeSession.xp += score === 1 ? 10 : 6;
    $("checkAnswer").textContent = "Continue";
    $("checkAnswer").onclick = () => advanceExercise();
  });
}
function wireChoices() {
  $("exerciseCard").querySelectorAll(".choice").forEach(button => button.addEventListener("click", () => {
    if (activeSession.locked) return;
    activeSession.selected = button.dataset.choice;
    $("exerciseCard").querySelectorAll(".choice").forEach(choice => choice.classList.toggle("selected", choice === button));
  }));
}
function setScore(ex, value) {
  const previous = Number(activeSession.scores[ex.scoreId] || 0);
  activeSession.scores[ex.scoreId] = Math.max(previous, value);
}
function typedDifference(given, expected) {
  const givenWords = normalize(given).split(" ").filter(Boolean);
  const expectedWords = normalize(primaryAnswer(expected)).split(" ").filter(Boolean);
  const missing = expectedWords.filter(word => !givenWords.includes(word));
  const extra = givenWords.filter(word => !expectedWords.includes(word));
  const parts = [];
  if (missing.length) parts.push(`Missing: ${missing.join(", ")}`);
  if (extra.length) parts.push(`Extra: ${extra.join(", ")}`);
  return parts.join(" · ");
}
function phraseBreakdown(ex) {
  const target = primaryAnswer(targetText(ex));
  const lang = targetLang(ex);
  const bits = target.split(/\s+/).map(word => {
    const clue = clueForWord(word.replace(/[^\p{L}\p{N}]/gu, ""), lang);
    return clue ? `<b>${esc(word)}</b> = ${esc(clue)}` : `<b>${esc(word)}</b>`;
  });
  return bits.join(" · ");
}
function gradeCurrent(correct, ex, given, expectedOverride) {
  if (activeSession.locked) return;
  activeSession.locked = true;
  const expected = expectedOverride || targetText(ex);
  const card = $("exerciseCard");
  card.querySelectorAll("button.choice,.bankWord,.answerWord,.clueWord,.fullClueBtn").forEach(button => button.disabled = true);
  const message = $("feedbackMsg");
  const checkButton = $("checkAnswer");
  if (correct) {
    const assisted = !!ex.assisted;
    const score = assisted ? 0.5 : (ex.retryCount ? 0.75 : 1);
    setScore(ex, score);
    recordCorrect(ex, assisted);
    message.innerHTML = assisted
      ? `Correct with a clue. <span class="feedbackTranslation">${esc(primaryAnswer(targetText(ex)))} = ${esc(primaryAnswer(sourceText(ex)))}</span>`
      : `Correct! <span class="feedbackTranslation">${esc(primaryAnswer(targetText(ex)))} = ${esc(primaryAnswer(sourceText(ex)))}</span>`;
    message.className = "feedbackMsg good";
    highlightChoice(expected, true);
    if (assisted && ex.retryCount < 1) queueRetry(ex, true);
  } else {
    setScore(ex, 0);
    recordWrong(ex, given);
    const difference = ex.type === "type" || ex.type === "bank" ? typedDifference(given, expected) : "";
    message.innerHTML = `Not quite. Correct answer: <strong>${esc(primaryAnswer(expected))}</strong>${difference ? `<br><span class="feedbackTranslation">${esc(difference)}</span>` : ""}<br><span class="feedbackTranslation">${phraseBreakdown(ex)}</span>`;
    message.className = "feedbackMsg bad";
    highlightChoice(expected, false);
    if (ex.retryCount < 2) queueRetry(ex, false);
  }
  checkButton.textContent = "Continue";
  checkButton.onclick = () => advanceExercise();
}
function highlightChoice(expected, correct) {
  $("exerciseCard").querySelectorAll(".choice").forEach(button => {
    if (answerMatches(button.dataset.choice, expected)) button.classList.add("correct");
    else if (button.classList.contains("selected") && !correct) button.classList.add("wrong");
  });
}
function queueRetry(ex, assisted) {
  const lesson = lessonById(ex.lessonId) || LESSONS[0];
  const retryTypes = ex.item.isPhrase ? ["cloze", "bank", "type"] : ["choice", "type", "cloze"];
  let retryType = retryTypes[(ex.retryCount + (assisted ? 1 : 0)) % retryTypes.length];
  if (retryType === "bank" && primaryAnswer(targetText(ex)).split(/\s+/).length < 2) retryType = "type";
  const retry = makeExercise(ex.item, retryType, ex.direction, lesson, {
    scoreId: ex.scoreId,
    retryCount: ex.retryCount + 1,
    retryOf: ex.type,
    finalRecall: true
  });
  activeSession.exercises.push(retry);
}
function nextReviewDue(strength) {
  const days = REVIEW_INTERVALS[clamp(strength, 0, REVIEW_INTERVALS.length - 1)];
  return now() + days * 24 * 60 * 60 * 1000;
}
function recordCorrect(ex, assisted) {
  if (!ex.item) return;
  const current = masteryFor(ex.item);
  const strength = assisted ? current : clamp(current + 1, 0, 5);
  activeSession.masteryCache[ex.item.key] = strength;
  if (assisted) activeSession.assistedCorrect++;
  activeSession.xp += assisted ? 5 : ex.retryCount ? 7 : 10;
  const updates = {};
  updates[`mastery/${ex.item.key}`] = strength;
  updates[`review/${ex.item.key}`] = {
    strength,
    dueAt: assisted ? now() : nextReviewDue(strength),
    lastSeen: now(),
    lastResult: assisted ? "assisted" : "correct",
    lastType: ex.type
  };
  updates[`seen/${ex.item.key}`] = true;
  updateMyProgress(updates);
  if (!assisted) remove(ref(db, rootPath(`progress/${identityKey()}/mistakes/${ex.item.key}`))).catch(() => {});
}
function recordWrong(ex, given) {
  activeSession.wrong++;
  activeSession.hearts = Math.max(0, activeSession.hearts - 1);
  $("sessionHearts").textContent = `❤️ ${activeSession.hearts}`;
  if (ex.item) {
    const current = masteryFor(ex.item);
    const strength = Math.max(0, current - 1);
    activeSession.masteryCache[ex.item.key] = strength;
    const old = (mine().mistakes || {})[ex.item.key] || {};
    const updates = {};
    updates[`mastery/${ex.item.key}`] = strength;
    updates[`review/${ex.item.key}`] = { strength, dueAt: now(), lastSeen: now(), lastResult: "wrong", lastType: ex.type };
    updates[`mistakes/${ex.item.key}`] = {
      key: ex.item.key,
      en: ex.item.en,
      pt: ex.item.pt,
      lessonId: ex.item.lessonId,
      count: Number(old.count || 0) + 1,
      lastGiven: given || "",
      lastWrong: now()
    };
    updates.hearts = activeSession.hearts;
    updateMyProgress(updates);
  } else updateMyProgress({ hearts: activeSession.hearts });
}
function advanceExercise() {
  if (!activeSession) return;
  if (activeSession.hearts <= 0 && activeSession.kind === "lesson") return renderOutOfHearts();
  activeSession.position++;
  renderExercise();
}
function renderOutOfHearts() {
  $("exerciseCard").innerHTML = `<div class="resultCard" style="display:flex;flex-direction:column;min-height:410px"><div class="resultEmoji">💔</div><h2>You’re out of hearts</h2><p class="muted">Your mistakes and due reviews were saved. A short practice session will refill your hearts.</p><button class="btn primary" id="goPractice" style="margin-top:20px">Practice to refill</button></div>`;
  on("goPractice", "click", () => {
    activeSession = null;
    $("sessionView").hidden = true;
    $("normalView").hidden = false;
    $("courseHeader").hidden = false;
    $("roomBar").hidden = false;
    switchTab("practice");
    renderEverything();
  });
}
async function finishSession() {
  const session = activeSession;
  const scoreValues = Object.values(session.scores);
  const accuracy = scoreValues.length ? Math.round((scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length) * 100) : 100;
  const xpEarned = session.xp + (accuracy === 100 ? 20 : accuracy >= 80 ? 10 : 0);
  const me = mine();
  const today = todayKey();
  const last = me.lastPracticeDate || "";
  let streak = Number(me.streak || 0);
  if (last !== today) streak = last === yesterdayKey() ? streak + 1 : 1;
  const values = {
    xp: Number(me.xp || 0) + xpEarned,
    streak,
    lastPracticeDate: today,
    hearts: session.kind === "practice" && session.mode === "hearts" ? MAX_HEARTS : session.hearts,
    lastSessionAccuracy: accuracy
  };
  let passed = true;
  if (session.kind === "lesson") {
    const lesson = LESSONS[session.lessonIndex];
    const old = lessonProgress(lesson.id);
    passed = accuracy >= 70;
    const stars = accuracy >= 95 ? 3 : accuracy >= 82 ? 2 : passed ? 1 : 0;
    values[`lessons/${lesson.id}/attempts`] = Number(old.attempts || 0) + 1;
    values[`lessons/${lesson.id}/bestScore`] = Math.max(Number(old.bestScore || 0), accuracy);
    values[`lessons/${lesson.id}/stars`] = Math.max(Number(old.stars || 0), stars);
    values[`lessons/${lesson.id}/lastAttempt`] = now();
    if (passed || old.completed) {
      values[`lessons/${lesson.id}/completed`] = true;
      values[`lessons/${lesson.id}/completedAt`] = old.completedAt || now();
    }
    if (passed) {
      const next = LESSONS[session.lessonIndex + 1];
      if (next) values.currentLesson = next.id;
    }
  }
  await updateMyProgress(values);
  $("sessionProgress").style.width = "100%";
  $("exerciseCard").innerHTML = `<div class="resultCard" style="display:flex;flex-direction:column;min-height:430px"><div class="resultEmoji">${passed ? accuracy >= 90 ? "🏆" : "🎉" : "📚"}</div><h2>${session.kind === "practice" ? "Practice complete!" : passed ? "Lesson complete!" : "Almost there"}</h2><p class="muted">${session.kind === "lesson" && !passed ? "You need 70% to unlock the next lesson. Clue-assisted answers received partial credit, and missed items are due for review now." : `${session.assistedCorrect ? `${session.assistedCorrect} answer${session.assistedCorrect === 1 ? " used" : "s used"} clues and will return sooner. ` : ""}Your review schedule has been updated from what you actually recalled.`}</p><div class="resultStats"><div class="resultStat"><strong>${accuracy}%</strong><span>learning score</span></div><div class="resultStat"><strong>+${xpEarned}</strong><span>XP earned</span></div><div class="resultStat"><strong>${session.wrong}</strong><span>mistakes saved</span></div></div><button class="btn primary" id="finishDone">${session.kind === "lesson" && !passed ? "Review mistakes" : "Continue"}</button></div>`;
  on("finishDone", "click", () => {
    activeSession = null;
    $("sessionView").hidden = true;
    $("normalView").hidden = false;
    $("courseHeader").hidden = false;
    $("roomBar").hidden = false;
    if (session.kind === "lesson" && !passed) switchTab("mistakes");
    renderEverything();
  });
}

function renderWeakWords() {
  const box = $("weakWordsList");
  if (!box) return;
  const items = [...allUnlockedItems()].sort((a, b) => {
    const dueA = dueForReview(a) ? -50 : 0;
    const dueB = dueForReview(b) ? -50 : 0;
    return (dueA + masteryFor(a) * 10) - (dueB + masteryFor(b) * 10);
  }).slice(0, 8);
  if (!items.length) {
    box.innerHTML = `<div class="empty">Start your first lesson to build a review list.</div>`;
    return;
  }
  box.innerHTML = items.map(item => {
    const mastery = masteryFor(item);
    const due = mastery > 0 && dueForReview(item);
    return `<div class="reviewRow"><span>${due ? "⏰" : "🧠"}</span><div class="grow"><strong>${esc(currentGoal === "en" ? item.pt : item.en)}${item.custom ? " ✨" : ""}</strong><div class="muted">${esc(currentGoal === "en" ? item.en : item.pt)} · ${due ? "review due" : mastery ? "building memory" : "not learned yet"}</div></div><div class="masteryDots">${[1,2,3,4,5].map(level => `<span class="${level <= mastery ? "on" : ""}"></span>`).join("")}</div></div>`;
  }).join("");
}
function renderMistakes() {
  const box = $("mistakeList");
  if (!box) return;
  const rows = Object.values(mine().mistakes || {}).filter(Boolean).sort((a, b) => (b.lastWrong || 0) - (a.lastWrong || 0));
  if (!rows.length) {
    box.innerHTML = `<div class="empty">No saved mistakes yet. New or suspiciously brilliant. 🌟</div>`;
    return;
  }
  box.innerHTML = rows.map(item => `<div class="mistakeRow"><div><strong>${esc(item.en)}</strong><small>${esc(lessonById(item.lessonId)?.title || "Course review")}</small></div><div class="pt">${esc(item.pt)}<small>Your last answer: ${esc(item.lastGiven || "—")} · missed ${Number(item.count || 1)} time${Number(item.count || 1) === 1 ? "" : "s"}</small></div><button class="btn sm danger" data-forget="${esc(item.key)}">Remove</button></div>`).join("");
  box.querySelectorAll("[data-forget]").forEach(button => button.addEventListener("click", () => remove(ref(db, rootPath(`progress/${identityKey()}/mistakes/${button.dataset.forget}`)))));
}

function partnerEntries() {
  return Object.entries(progressData).filter(([key, value]) => key !== identityKey() && value && value.name);
}
function renderPartner() {
  const box = $("partnerProgressList");
  if (!box) return;
  const partners = partnerEntries();
  box.innerHTML = partners.length ? partners.map(([key, value]) => {
    const completed = Object.values(value.lessons || {}).filter(item => item === true || (item && item.completed)).length;
    const current = lessonById(value.currentLesson);
    return `<div class="partnerCard"><div class="partnerCardHead"><span>💞</span><div><strong>${esc(value.name)}</strong><small>${goalLabel(value.goal)}</small></div></div><div class="partnerMetrics"><div><strong>${completed}/${LESSONS.length}</strong><span>lessons</span></div><div><strong>${Number(value.xp || 0)}</strong><span>XP</span></div><div><strong>${Number(value.streak || 0)}</strong><span>day streak</span></div></div><div class="muted">Current lesson: ${current ? `${current.emoji} ${esc(current.title)}` : "Not started"}</div></div>`;
  }).join("") : `<div class="empty">Invite your partner with the class link. Your courses stay separate once they join.</div>`;

  const target = $("suggestTarget");
  if (target) {
    const previous = target.value;
    target.innerHTML = partners.length ? partners.map(([key, value]) => `<option value="${esc(key)}">${esc(value.name)}</option>`).join("") : `<option value="">No partner available</option>`;
    if (partners.some(([key]) => key === previous)) target.value = previous;
    $("sendSuggestion").disabled = !partners.length;
  }
  renderSuggestions();
}
async function sendSuggestion() {
  const toId = $("suggestTarget").value;
  const en = $("suggestEn").value.trim();
  const pt = $("suggestPt").value.trim();
  const note = $("suggestNote").value.trim();
  const lessonId = $("suggestLesson").value;
  if (!toId) return toast("Choose a partner first");
  if (!en || !pt) return toast("Add both English and Portuguese");
  const suggestionRef = push(ref(db, rootPath("suggestions")));
  await set(suggestionRef, {
    fromId: identityKey(),
    fromName: displayName || "someone",
    toId,
    toName: progressData[toId]?.name || "partner",
    en,
    pt,
    note,
    lessonId,
    status: "pending",
    t: now()
  });
  $("suggestEn").value = "";
  $("suggestPt").value = "";
  $("suggestNote").value = "";
  toast("Phrase suggestion sent 💞");
}
function renderSuggestions() {
  const incomingBox = $("incomingSuggestions");
  const sentBox = $("sentSuggestions");
  if (!incomingBox || !sentBox) return;
  const rows = Object.entries(suggestionsData).filter(([, value]) => value);
  const incoming = rows.filter(([, value]) => value.toId === identityKey()).sort((a, b) => (b[1].t || 0) - (a[1].t || 0));
  const sent = rows.filter(([, value]) => value.fromId === identityKey()).sort((a, b) => (b[1].t || 0) - (a[1].t || 0));
  incomingBox.innerHTML = incoming.length ? incoming.map(([id, item]) => suggestionHtml(id, item, true)).join("") : `<div class="empty">No phrase suggestions for you yet.</div>`;
  sentBox.innerHTML = sent.length ? sent.map(([id, item]) => suggestionHtml(id, item, false)).join("") : `<div class="empty">You have not suggested any phrases yet.</div>`;
  incomingBox.querySelectorAll("[data-accept-suggestion]").forEach(button => button.addEventListener("click", () => acceptSuggestion(button.dataset.acceptSuggestion)));
  incomingBox.querySelectorAll("[data-dismiss-suggestion]").forEach(button => button.addEventListener("click", () => respondSuggestion(button.dataset.dismissSuggestion, "dismissed")));
  sentBox.querySelectorAll("[data-delete-suggestion]").forEach(button => button.addEventListener("click", () => remove(ref(db, rootPath(`suggestions/${button.dataset.deleteSuggestion}`)))));
}
function suggestionHtml(id, item, incoming) {
  const lesson = lessonById(item.lessonId);
  const status = item.status || "pending";
  return `<div class="suggestionCard"><div class="suggestionHead"><strong>${incoming ? `From ${esc(item.fromName || "partner")}` : `To ${esc(item.toName || "partner")}`}</strong><span class="statusPill ${esc(status)}">${esc(status)}</span></div><div class="suggestionPair"><span>${esc(item.en)}</span><span>${esc(item.pt)}</span></div><div class="muted">${lesson ? `${lesson.emoji} ${esc(lesson.title)}` : "Course phrase"}${item.note ? ` · ${esc(item.note)}` : ""}</div>${incoming && status === "pending" ? `<div class="suggestionActions"><button class="btn primary sm" data-accept-suggestion="${esc(id)}">Add to my lesson</button><button class="btn danger sm" data-dismiss-suggestion="${esc(id)}">Dismiss</button></div>` : !incoming ? `<div class="suggestionActions"><button class="btn sm danger" data-delete-suggestion="${esc(id)}">Delete</button></div>` : ""}</div>`;
}
async function acceptSuggestion(id) {
  const item = suggestionsData[id];
  if (!item || item.toId !== identityKey()) return;
  const phraseRef = push(ref(db, rootPath(`progress/${identityKey()}/customPhrases`)));
  await set(phraseRef, {
    en: item.en,
    pt: item.pt,
    note: item.note || `Suggested by ${item.fromName || "partner"}`,
    lessonId: item.lessonId || LESSONS[0].id,
    addedBy: item.fromId,
    addedName: item.fromName || "partner",
    fromSuggestion: id,
    t: now()
  });
  await respondSuggestion(id, "accepted");
  toast("Added to your lesson ✨");
}
function respondSuggestion(id, status) {
  return update(ref(db, rootPath(`suggestions/${id}`)), { status, respondedAt: now() });
}

async function addCustomPhrase() {
  const en = $("bookEn").value.trim();
  const pt = $("bookPt").value.trim();
  const note = $("bookNote").value.trim();
  const lessonId = $("bookLesson").value;
  if (!en || !pt) return toast("Add both English and Portuguese");
  const phraseRef = push(ref(db, rootPath(`progress/${identityKey()}/customPhrases`)));
  await set(phraseRef, { en, pt, note, lessonId, addedBy: identityKey(), addedName: displayName || "you", t: now() });
  $("bookEn").value = "";
  $("bookPt").value = "";
  $("bookNote").value = "";
  toast("Added to your lesson ✨");
}
function renderPhrasebook() {
  const box = $("phrasebookList");
  if (!box) return;
  const query = normalize($("bookSearch")?.value || "");
  const rows = customPhraseRows().filter(item => !query || normalize(`${item.en} ${item.pt} ${item.note || ""}`).includes(query)).sort((a, b) => (b.t || 0) - (a.t || 0));
  if (!rows.length) {
    box.innerHTML = `<div class="empty">${query ? "Nothing matches that search." : "No personal lesson phrases yet. Add one yourself or accept one from your partner."}</div>`;
    return;
  }
  box.innerHTML = rows.map(item => {
    const lesson = lessonById(item.lessonId);
    return `<div class="bookRow"><div><strong>${esc(item.en)}</strong>${noAudio() ? "" : ` <button class="speak" data-say="${esc(item.en)}" data-lang="en-US">🔊</button>`}</div><div class="bookPt">${esc(item.pt)}${noAudio() ? "" : ` <button class="speak" data-say="${esc(item.pt)}" data-lang="pt-BR">🔊</button>`}</div><div class="bookNote">${lesson ? `${lesson.emoji} ${esc(lesson.title)}` : "Course"}${item.note ? `<br>${esc(item.note)}` : ""}</div><button class="btn sm danger" data-delete-phrase="${esc(item.id)}">Delete</button></div>`;
  }).join("");
  box.querySelectorAll("[data-say]").forEach(button => button.addEventListener("click", () => speak(button.dataset.say, button.dataset.lang)));
  box.querySelectorAll("[data-delete-phrase]").forEach(button => button.addEventListener("click", () => remove(ref(db, rootPath(`progress/${identityKey()}/customPhrases/${button.dataset.deletePhrase}`)))));
}

function speak(text, lang) {
  if (noAudio()) return toast("Audio is disabled in your course settings");
  if (!("speechSynthesis" in window)) return toast("Speech playback is not supported in this browser");
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.84;
  const voices = speechSynthesis.getVoices();
  const exact = voices.find(voice => voice.lang.toLowerCase() === lang.toLowerCase()) || voices.find(voice => voice.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
  if (exact) utterance.voice = exact;
  speechSynthesis.speak(utterance);
}
function speakAndWait(text, lang) {
  return new Promise(resolve => {
    if (noAudio() || !("speechSynthesis" in window)) return resolve();
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.84;
    utterance.onend = resolve;
    utterance.onerror = resolve;
    speechSynthesis.speak(utterance);
  });
}

window.addEventListener("DOMContentLoaded", waitForRooms);
