/* ══════════════════════════════════════════════════════
   Sakari — contribute.js

   A trauma-informed system that lets people share their own
   lived experience of BPD, DPD, anxiety, depression and related
   conditions, so the stories can be written with more accuracy
   and care.

   ── HOW IT FITS ─────────────────────────────────────
   This module is self-contained. It does NOT modify engine.js.
   It injects:
     - a "share your experience" entry point on the hub
     - a full-screen contribution view styled to match Sakari
     - a structured + free-text form, framed around helping a
       writer understand (not recounting trauma)
   It reuses the engine's theme + i18n systems (skSetTheme, ui()).

   ── WIRING THE BACKEND (the one thing left to you) ──
   All submissions flow through ONE function: submitExperience(payload).
   Right now it is STUBBED — it validates, logs, and resolves as if
   sent, but sends nothing over the network. To go live, replace the
   body of skSendToBackend() with your chosen destination.

   Design choices baked in for safety (keep these):
     - No accounts, no email, no name field, no IP collection.
       If you never collect it, you can never leak it.
     - Crisis resources are shown before and after the form.
     - Plain-language consent must be checked before sending.
     - A submit-only path is assumed: the client can write, never read.

   ── ADDING/EDITING PROMPTS ──────────────────────────
   Structured questions live in SK_CONTRIB_FIELDS below. Each entry
   is localized via the SK_CONTRIB_UI strings. Add a field by adding
   an object here and matching labels in each language block.
   ══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── UI STRINGS (matches SAKARI_UI conventions) ──────── */
  var SK_CONTRIB_UI = {
    en: {
      hubCta: 'share your experience',
      hubBlurb: 'Sakari\u2019s stories try to show these conditions honestly, from the inside. If you live with BPD, dependent personality disorder, anxiety, depression, or something near them, you can help make them more accurate \u2014 in your own words, anonymously.',
      title: 'share your experience',
      intro: 'This helps the people writing Sakari understand what these conditions actually feel like, so the stories ring true instead of relying on clich\u00e9. You don\u2019t have to relive anything. Share only what you\u2019re comfortable sharing, and stop whenever you want.',
      anonNote: 'Anonymous. No name, no email, no account. We don\u2019t want anything that could identify you.',
      notSupport: 'This is not a way to reach support, and no one will reply to what you write here. If you need someone right now, please use the resources below.',
      sectionStructured: 'a few gentle questions',
      sectionWords: 'in your own words',
      optionalAll: 'Every field is optional. Skip anything that doesn\u2019t fit.',
      conditionLabel: 'which of these do you have experience with?',
      conditionHint: 'select any that apply',
      intensityLabel: 'on a hard day, how much does it shape things?',
      intensityHint: 'a rough sense \u2014 there\u2019s no right answer',
      intensityLevels: ['barely', 'some', 'a lot', 'most of the day', 'everything'],
      patternLabel: 'a pattern you notice in yourself',
      patternPlaceholder: 'e.g. \u201cwhen someone takes a while to reply, my brain writes three versions of what their silence means\u201d',
      feelLabel: 'what it feels like from the inside',
      feelPlaceholder: 'the part that\u2019s hard to explain to people who haven\u2019t felt it',
      triggerLabel: 'something small that sets it off',
      triggerPlaceholder: 'the everyday things, not just the big ones',
      lockedLabel: 'a moment a choice felt genuinely unavailable',
      lockedPlaceholder: 'something you couldn\u2019t do, even though you knew you \u201cshould\u201d \u2014 and what that was like',
      wrongLabel: 'what stories usually get wrong about this',
      wrongPlaceholder: 'the thing you wish writers understood',
      helpsLabel: 'something that actually helps, in the moment',
      helpsPlaceholder: 'optional \u2014 only if you want to share it',
      consentHeader: 'before you send',
      consentText: 'I understand this is anonymous, that what I share may inform fictional stories about these experiences, that it won\u2019t be published word-for-word, and that this isn\u2019t a substitute for support.',
      ageText: 'I am 18 or older.',
      submit: 'send anonymously',
      sending: 'sending\u2026',
      cancel: 'never mind',
      back: '\u2190 back to stories',
      thanksTitle: 'thank you.',
      thanksBody: 'What you shared will help these stories tell the truth a little better. Take care of yourself today.',
      thanksAgain: 'share something else',
      thanksHome: 'back to stories',
      errConsent: 'Please confirm the two checkboxes so we know you understand.',
      errEmpty: 'Add at least one note before sending \u2014 even a single line helps.',
      errSend: 'Something went wrong sending that. Nothing was saved. You can try again, or come back later.',
      crisisHeader: 'if you\u2019re struggling right now',
    },
    de: {
      hubCta: 'teile deine erfahrung',
      hubBlurb: 'Sakaris Geschichten versuchen, diese Erkrankungen ehrlich und von innen zu zeigen. Wenn du mit BPS, abh\u00e4ngiger Pers\u00f6nlichkeitsst\u00f6rung, Angst oder Depression lebst, kannst du helfen, sie genauer zu machen \u2014 in deinen eigenen Worten, anonym.',
      title: 'teile deine erfahrung',
      intro: 'Das hilft den Menschen, die Sakari schreiben, zu verstehen, wie sich diese Erkrankungen wirklich anf\u00fchlen, damit die Geschichten wahr klingen statt klischeehaft. Du musst nichts noch einmal durchleben. Teile nur, was sich gut anf\u00fchlt, und h\u00f6r auf, wann immer du willst.',
      anonNote: 'Anonym. Kein Name, keine E-Mail, kein Konto. Wir wollen nichts, das dich identifizieren k\u00f6nnte.',
      notSupport: 'Dies ist kein Weg, Hilfe zu erreichen, und niemand wird auf das antworten, was du hier schreibst. Wenn du gerade jetzt jemanden brauchst, nutze bitte die Ressourcen unten.',
      sectionStructured: 'ein paar behutsame fragen',
      sectionWords: 'in deinen eigenen worten',
      optionalAll: 'Jedes Feld ist freiwillig. \u00dcberspring alles, was nicht passt.',
      conditionLabel: 'womit hast du erfahrung?',
      conditionHint: 'w\u00e4hle alles aus, was zutrifft',
      intensityLabel: 'an einem schweren tag \u2014 wie sehr pr\u00e4gt es alles?',
      intensityHint: 'nur ein grobes gef\u00fchl \u2014 es gibt keine richtige antwort',
      intensityLevels: ['kaum', 'etwas', 'stark', 'fast den ganzen tag', 'alles'],
      patternLabel: 'ein muster, das du an dir bemerkst',
      patternPlaceholder: 'z.\u202fB. \u201ewenn jemand lange braucht zu antworten, schreibt mein kopf drei versionen, was das schweigen bedeutet\u201c',
      feelLabel: 'wie es sich von innen anf\u00fchlt',
      feelPlaceholder: 'der teil, der schwer zu erkl\u00e4ren ist',
      triggerLabel: 'etwas kleines, das es ausl\u00f6st',
      triggerPlaceholder: 'die allt\u00e4glichen dinge, nicht nur die gro\u00dfen',
      lockedLabel: 'ein moment, in dem eine wahl wirklich unm\u00f6glich war',
      lockedPlaceholder: 'etwas, das du nicht tun konntest, obwohl du wusstest, du \u201esolltest\u201c',
      wrongLabel: 'was geschichten daran meist falsch machen',
      wrongPlaceholder: 'das, was autoren verstehen sollten',
      helpsLabel: 'etwas, das im moment wirklich hilft',
      helpsPlaceholder: 'freiwillig \u2014 nur wenn du es teilen m\u00f6chtest',
      consentHeader: 'bevor du sendest',
      consentText: 'Ich verstehe, dass dies anonym ist, dass das Geteilte fiktive Geschichten beeinflussen kann, dass es nicht w\u00f6rtlich ver\u00f6ffentlicht wird und dass dies kein Ersatz f\u00fcr Unterst\u00fctzung ist.',
      ageText: 'Ich bin 18 Jahre oder \u00e4lter.',
      submit: 'anonym senden',
      sending: 'senden\u2026',
      cancel: 'doch nicht',
      back: '\u2190 zur\u00fcck zu den geschichten',
      thanksTitle: 'danke.',
      thanksBody: 'Was du geteilt hast, hilft diesen Geschichten, die Wahrheit ein wenig besser zu erz\u00e4hlen. Pass heute gut auf dich auf.',
      thanksAgain: 'etwas anderes teilen',
      thanksHome: 'zur\u00fcck zu den geschichten',
      errConsent: 'Bitte best\u00e4tige die beiden K\u00e4stchen, damit wir wissen, dass du es verstehst.',
      errEmpty: 'F\u00fcg vor dem Senden mindestens eine Notiz hinzu \u2014 schon eine Zeile hilft.',
      errSend: 'Beim Senden ist etwas schiefgegangen. Nichts wurde gespeichert. Versuch es erneut oder komm sp\u00e4ter wieder.',
      crisisHeader: 'wenn es dir gerade schlecht geht',
    },
    pt: {
      hubCta: 'compartilhe sua experi\u00eancia',
      hubBlurb: 'As hist\u00f3rias de Sakari tentam mostrar essas condi\u00e7\u00f5es com honestidade, por dentro. Se voc\u00ea vive com TPB, transtorno de personalidade dependente, ansiedade ou depress\u00e3o, pode ajudar a torn\u00e1-las mais precisas \u2014 com suas pr\u00f3prias palavras, de forma an\u00f4nima.',
      title: 'compartilhe sua experi\u00eancia',
      intro: 'Isso ajuda quem escreve Sakari a entender como essas condi\u00e7\u00f5es realmente s\u00e3o por dentro, para que as hist\u00f3rias soem verdadeiras em vez de clich\u00ea. Voc\u00ea n\u00e3o precisa reviver nada. Compartilhe apenas o que for confort\u00e1vel e pare quando quiser.',
      anonNote: 'An\u00f4nimo. Sem nome, sem e-mail, sem conta. N\u00e3o queremos nada que possa identificar voc\u00ea.',
      notSupport: 'Isto n\u00e3o \u00e9 uma forma de obter apoio, e ningu\u00e9m vai responder ao que voc\u00ea escrever aqui. Se precisar de algu\u00e9m agora, use os recursos abaixo.',
      sectionStructured: 'algumas perguntas suaves',
      sectionWords: 'com suas pr\u00f3prias palavras',
      optionalAll: 'Todos os campos s\u00e3o opcionais. Pule o que n\u00e3o se aplicar.',
      conditionLabel: 'com quais delas voc\u00ea tem experi\u00eancia?',
      conditionHint: 'selecione todas que se aplicam',
      intensityLabel: 'em um dia dif\u00edcil, o quanto isso molda as coisas?',
      intensityHint: 'uma no\u00e7\u00e3o aproximada \u2014 n\u00e3o h\u00e1 resposta certa',
      intensityLevels: ['quase nada', 'um pouco', 'muito', 'quase o dia todo', 'tudo'],
      patternLabel: 'um padr\u00e3o que voc\u00ea nota em si',
      patternPlaceholder: 'ex.: \u201cquando algu\u00e9m demora a responder, minha mente escreve tr\u00eas vers\u00f5es do que o sil\u00eancio significa\u201d',
      feelLabel: 'como \u00e9 por dentro',
      feelPlaceholder: 'a parte dif\u00edcil de explicar para quem n\u00e3o sentiu',
      triggerLabel: 'algo pequeno que dispara isso',
      triggerPlaceholder: 'as coisas do dia a dia, n\u00e3o s\u00f3 as grandes',
      lockedLabel: 'um momento em que uma escolha foi realmente imposs\u00edvel',
      lockedPlaceholder: 'algo que voc\u00ea n\u00e3o conseguiu fazer, mesmo sabendo que \u201cdeveria\u201d',
      wrongLabel: 'o que as hist\u00f3rias costumam errar sobre isso',
      wrongPlaceholder: 'o que voc\u00ea gostaria que os autores entendessem',
      helpsLabel: 'algo que realmente ajuda, no momento',
      helpsPlaceholder: 'opcional \u2014 s\u00f3 se quiser compartilhar',
      consentHeader: 'antes de enviar',
      consentText: 'Entendo que isto \u00e9 an\u00f4nimo, que o que compartilho pode inspirar hist\u00f3rias fict\u00edcias, que n\u00e3o ser\u00e1 publicado palavra por palavra e que isto n\u00e3o substitui apoio.',
      ageText: 'Tenho 18 anos ou mais.',
      submit: 'enviar anonimamente',
      sending: 'enviando\u2026',
      cancel: 'deixa pra l\u00e1',
      back: '\u2190 voltar \u00e0s hist\u00f3rias',
      thanksTitle: 'obrigado.',
      thanksBody: 'O que voc\u00ea compartilhou vai ajudar estas hist\u00f3rias a contar a verdade um pouco melhor. Cuide-se hoje.',
      thanksAgain: 'compartilhar outra coisa',
      thanksHome: 'voltar \u00e0s hist\u00f3rias',
      errConsent: 'Confirme as duas caixas para sabermos que voc\u00ea entendeu.',
      errEmpty: 'Adicione ao menos uma nota antes de enviar \u2014 at\u00e9 uma linha ajuda.',
      errSend: 'Algo deu errado no envio. Nada foi salvo. Voc\u00ea pode tentar de novo ou voltar mais tarde.',
      crisisHeader: 'se voc\u00ea est\u00e1 sofrendo agora',
    },
  };

  function cu(key) {
    var l = (typeof SAKARI !== 'undefined' && SAKARI.lang) ? SAKARI.lang : 'en';
    var pack = SK_CONTRIB_UI[l] || SK_CONTRIB_UI.en;
    return pack[key] !== undefined ? pack[key] : (SK_CONTRIB_UI.en[key] !== undefined ? SK_CONTRIB_UI.en[key] : '');
  }

  /* condition checkboxes — value is a stable code; label is localized */
  var SK_CONDITIONS = [
    { code: 'bpd', label: { en: 'BPD', de: 'BPS', pt: 'TPB' } },
    { code: 'dpd', label: { en: 'dependent personality disorder', de: 'abh\u00e4ngige Pers\u00f6nlichkeitsst\u00f6rung', pt: 'transtorno de personalidade dependente' } },
    { code: 'anxiety', label: { en: 'anxiety', de: 'Angst', pt: 'ansiedade' } },
    { code: 'depression', label: { en: 'depression', de: 'Depression', pt: 'depress\u00e3o' } },
    { code: 'other', label: { en: 'something else', de: 'etwas anderes', pt: 'outra coisa' } },
  ];
  function condLabel(c) {
    var l = (typeof SAKARI !== 'undefined' && SAKARI.lang) ? SAKARI.lang : 'en';
    return c.label[l] || c.label.en;
  }

  /* free-text fields, in display order. key = payload key. */
  var SK_CONTRIB_FIELDS = [
    { key: 'pattern', labelKey: 'patternLabel', phKey: 'patternPlaceholder', rows: 3 },
    { key: 'feel', labelKey: 'feelLabel', phKey: 'feelPlaceholder', rows: 3 },
    { key: 'trigger', labelKey: 'triggerLabel', phKey: 'triggerPlaceholder', rows: 2 },
    { key: 'locked', labelKey: 'lockedLabel', phKey: 'lockedPlaceholder', rows: 3 },
    { key: 'wrong', labelKey: 'wrongLabel', phKey: 'wrongPlaceholder', rows: 2 },
    { key: 'helps', labelKey: 'helpsLabel', phKey: 'helpsPlaceholder', rows: 2 },
  ];

  var SK_MAXLEN = 2000; // per free-text field

  /* ── STYLES ──────────────────────────────────────────── */
  function injectContribStyles() {
    if (document.getElementById('sk-contrib-styles')) return;
    var s = document.createElement('style');
    s.id = 'sk-contrib-styles';
    s.textContent =
      '#sk-contribute{position:fixed;inset:0;z-index:520;display:none;overflow-y:auto;' +
        'background:var(--sk-bg,#0e0c0b);color:var(--sk-text,#e8ddd4);font-family:\'Lora\',serif;}' +
      '#sk-contribute.on{display:block;}' +
      '.skc-wrap{max-width:680px;margin:0 auto;padding:64px 24px 96px;}' +
      '.skc-back{background:none;border:none;color:var(--sk-muted,#8a7a70);font-family:inherit;font-size:13px;cursor:pointer;padding:8px 0;margin-bottom:24px;letter-spacing:.02em;transition:color .18s;}' +
      '.skc-back:hover{color:var(--sk-accent,#d4899a);}' +
      '.skc-h1{font-size:34px;font-weight:500;letter-spacing:-.01em;margin:0 0 18px;color:var(--sk-text);}' +
      '.skc-intro{font-size:16px;line-height:1.7;color:var(--sk-text);opacity:.92;margin:0 0 18px;}' +
      '.skc-meta{font-size:13px;line-height:1.6;color:var(--sk-muted);margin:0 0 10px;}' +
      '.skc-crisis{font-size:13px;line-height:1.65;background:var(--sk-status-bar,#1a1512);border:1px solid var(--sk-border,#2e2218);border-radius:8px;padding:14px 16px;margin:22px 0;color:var(--sk-text);}' +
      '.skc-crisis strong{display:block;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--sk-accent,#d4899a);margin-bottom:7px;font-weight:500;}' +
      '.skc-crisis a{color:var(--sk-link,#c47888);}' +
      '.skc-section{margin:38px 0 6px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--sk-accent,#d4899a);font-weight:500;}' +
      '.skc-optional{font-size:12px;color:var(--sk-muted);margin:0 0 18px;font-style:italic;}' +
      '.skc-field{margin:0 0 22px;}' +
      '.skc-label{display:block;font-size:15px;color:var(--sk-text);margin-bottom:4px;}' +
      '.skc-hint{display:block;font-size:12px;color:var(--sk-muted);margin-bottom:8px;}' +
      '.skc-input,.skc-textarea{width:100%;box-sizing:border-box;background:var(--sk-status-bar,#1a1512);color:var(--sk-text);' +
        'border:1px solid var(--sk-border,#2e2218);border-radius:7px;padding:11px 13px;font-family:inherit;font-size:15px;line-height:1.55;' +
        'transition:border-color .18s;resize:vertical;}' +
      '.skc-textarea:focus,.skc-input:focus{outline:none;border-color:var(--sk-accent,#d4899a);}' +
      '.skc-input::placeholder,.skc-textarea::placeholder{color:var(--sk-muted);opacity:.7;}' +
      '.skc-count{display:block;text-align:right;font-size:11px;color:var(--sk-muted);margin-top:3px;height:13px;}' +
      '.skc-checks{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;}' +
      '.skc-chip{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--sk-border,#2e2218);border-radius:20px;padding:7px 14px;cursor:pointer;font-size:14px;color:var(--sk-text);transition:border-color .18s,background .18s;user-select:none;}' +
      '.skc-chip:hover{border-color:var(--sk-accent,#d4899a);}' +
      '.skc-chip input{accent-color:var(--sk-accent,#d4899a);margin:0;}' +
      '.skc-chip.checked{border-color:var(--sk-accent,#d4899a);background:color-mix(in srgb,var(--sk-accent,#d4899a) 12%,transparent);}' +
      '.skc-scale{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px;}' +
      '.skc-scale button{flex:1;min-width:72px;background:var(--sk-status-bar,#1a1512);border:1px solid var(--sk-border,#2e2218);color:var(--sk-text);' +
        'font-family:inherit;font-size:12px;padding:9px 6px;border-radius:6px;cursor:pointer;transition:border-color .18s,background .18s;}' +
      '.skc-scale button:hover{border-color:var(--sk-accent,#d4899a);}' +
      '.skc-scale button.active{border-color:var(--sk-accent,#d4899a);background:color-mix(in srgb,var(--sk-accent,#d4899a) 14%,transparent);color:var(--sk-accent,#d4899a);}' +
      '.skc-consent{margin:30px 0 0;padding:18px 18px 4px;background:var(--sk-status-bar,#1a1512);border:1px solid var(--sk-border,#2e2218);border-radius:8px;}' +
      '.skc-consent .skc-section{margin-top:0;}' +
      '.skc-consent-row{display:flex;gap:11px;align-items:flex-start;margin-bottom:16px;font-size:14px;line-height:1.55;color:var(--sk-text);cursor:pointer;}' +
      '.skc-consent-row input{margin-top:3px;flex:0 0 auto;accent-color:var(--sk-accent,#d4899a);width:16px;height:16px;}' +
      '.skc-actions{display:flex;gap:14px;align-items:center;margin-top:26px;flex-wrap:wrap;}' +
      '.skc-submit{background:var(--sk-accent,#d4899a);color:#16100e;border:none;font-family:inherit;font-size:15px;font-weight:600;letter-spacing:.02em;' +
        'padding:13px 26px;border-radius:7px;cursor:pointer;transition:opacity .18s,transform .12s;}' +
      '.skc-submit:hover{opacity:.9;}' +
      '.skc-submit:active{transform:translateY(1px);}' +
      '.skc-submit[disabled]{opacity:.5;cursor:default;}' +
      '.skc-cancel{background:none;border:none;color:var(--sk-muted);font-family:inherit;font-size:14px;cursor:pointer;transition:color .18s;}' +
      '.skc-cancel:hover{color:var(--sk-accent,#d4899a);}' +
      '.skc-error{color:var(--sk-reason,#b06878);font-size:14px;margin:16px 0 0;line-height:1.5;}' +
      '.skc-thanks{text-align:center;padding:80px 0 40px;}' +
      '.skc-thanks h2{font-size:32px;font-weight:500;margin:0 0 16px;color:var(--sk-text);}' +
      '.skc-thanks p{font-size:16px;line-height:1.7;color:var(--sk-text);opacity:.9;max-width:460px;margin:0 auto 28px;}' +
      '.skc-thanks-actions{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;}' +
      /* hub entry point */
      '.skc-hub-card{margin-top:18px;border:1px solid var(--border,#2e2218);border-radius:12px;padding:22px 24px;background:rgba(212,137,154,.05);}' +
      '.skc-hub-card h3{margin:0 0 8px;font-size:18px;font-weight:500;}' +
      '.skc-hub-card p{margin:0 0 16px;font-size:14px;line-height:1.65;opacity:.85;}' +
      '.skc-hub-btn{display:inline-block;background:none;border:1px solid currentColor;color:#d4899a;font-family:inherit;font-size:14px;' +
        'padding:9px 18px;border-radius:7px;cursor:pointer;transition:opacity .18s;}' +
      '.skc-hub-btn:hover{opacity:.78;}' +
      '@media (prefers-reduced-motion: reduce){' +
        '#sk-contribute *{transition:none !important;}.skc-submit:active{transform:none;}}' +
      '@media (max-width:560px){.skc-h1{font-size:27px;}.skc-wrap{padding:40px 18px 80px;}}';
    document.head.appendChild(s);
  }

  /* ── CRISIS BLOCK (reuses engine i18n if present) ────── */
  function crisisHtml() {
    var body = (typeof ui === 'function') ? ui('crisis') : '';
    if (!body) {
      body = 'If you are in crisis: <strong>988 Suicide &amp; Crisis Lifeline</strong> \u2014 call or text ' +
        '<a href="tel:988">988</a> (US). International: <a href="https://findahelpline.com" target="_blank" rel="noopener">findahelpline.com</a>.';
    }
    return '<div class="skc-crisis"><strong>' + cu('crisisHeader') + '</strong>' + body + '</div>';
  }

  /* ── RENDER THE FORM ─────────────────────────────────── */
  function renderContributeForm() {
    var view = document.getElementById('sk-contribute');
    if (!view) return;

    var condChips = SK_CONDITIONS.map(function (c) {
      return '<label class="skc-chip" data-cond="' + c.code + '">' +
        '<input type="checkbox" value="' + c.code + '"> ' + condLabel(c) + '</label>';
    }).join('');

    var intensityLevels = cu('intensityLevels');
    var scaleBtns = intensityLevels.map(function (lvl, i) {
      return '<button type="button" data-val="' + i + '">' + lvl + '</button>';
    }).join('');

    var fieldsHtml = SK_CONTRIB_FIELDS.map(function (f) {
      return '<div class="skc-field">' +
        '<label class="skc-label" for="skc-' + f.key + '">' + cu(f.labelKey) + '</label>' +
        '<textarea class="skc-textarea" id="skc-' + f.key + '" rows="' + f.rows + '" maxlength="' + SK_MAXLEN + '" ' +
          'placeholder="' + cu(f.phKey).replace(/"/g, '&quot;') + '"></textarea>' +
        '<span class="skc-count" id="skc-count-' + f.key + '"></span>' +
      '</div>';
    }).join('');

    view.innerHTML =
      '<div class="skc-wrap">' +
        '<button class="skc-back" onclick="skContributeClose()">' + cu('back') + '</button>' +
        '<h1 class="skc-h1">' + cu('title') + '</h1>' +
        '<p class="skc-intro">' + cu('intro') + '</p>' +
        '<p class="skc-meta">' + cu('anonNote') + '</p>' +
        '<p class="skc-meta">' + cu('notSupport') + '</p>' +
        crisisHtml() +

        '<div class="skc-section">' + cu('sectionStructured') + '</div>' +
        '<p class="skc-optional">' + cu('optionalAll') + '</p>' +

        '<div class="skc-field">' +
          '<label class="skc-label">' + cu('conditionLabel') + '</label>' +
          '<span class="skc-hint">' + cu('conditionHint') + '</span>' +
          '<div class="skc-checks" id="skc-conditions">' + condChips + '</div>' +
        '</div>' +

        '<div class="skc-field">' +
          '<label class="skc-label">' + cu('intensityLabel') + '</label>' +
          '<span class="skc-hint">' + cu('intensityHint') + '</span>' +
          '<div class="skc-scale" id="skc-intensity">' + scaleBtns + '</div>' +
        '</div>' +

        '<div class="skc-section">' + cu('sectionWords') + '</div>' +
        fieldsHtml +

        '<div class="skc-consent">' +
          '<div class="skc-section">' + cu('consentHeader') + '</div>' +
          '<label class="skc-consent-row"><input type="checkbox" id="skc-consent"> <span>' + cu('consentText') + '</span></label>' +
          '<label class="skc-consent-row"><input type="checkbox" id="skc-age"> <span>' + cu('ageText') + '</span></label>' +
        '</div>' +

        '<div class="skc-actions">' +
          '<button class="skc-submit" id="skc-submit" onclick="skContributeSubmit()">' + cu('submit') + '</button>' +
          '<button class="skc-cancel" onclick="skContributeClose()">' + cu('cancel') + '</button>' +
        '</div>' +
        '<p class="skc-error" id="skc-error" style="display:none"></p>' +
      '</div>';

    wireFormInteractions();
  }

  function wireFormInteractions() {
    // condition chips toggle a 'checked' class for styling
    var condWrap = document.getElementById('skc-conditions');
    if (condWrap) {
      condWrap.querySelectorAll('.skc-chip').forEach(function (chip) {
        var box = chip.querySelector('input');
        chip.addEventListener('click', function (e) {
          if (e.target !== box) box.checked = !box.checked;
          chip.classList.toggle('checked', box.checked);
        });
      });
    }
    // intensity scale single-select
    var scale = document.getElementById('skc-intensity');
    if (scale) {
      scale.querySelectorAll('button').forEach(function (b) {
        b.addEventListener('click', function () {
          var was = b.classList.contains('active');
          scale.querySelectorAll('button').forEach(function (x) { x.classList.remove('active'); });
          if (!was) b.classList.add('active'); // allow unselect
        });
      });
    }
    // char counters
    SK_CONTRIB_FIELDS.forEach(function (f) {
      var ta = document.getElementById('skc-' + f.key);
      var ct = document.getElementById('skc-count-' + f.key);
      if (ta && ct) {
        var upd = function () { ct.textContent = ta.value.length ? (ta.value.length + ' / ' + SK_MAXLEN) : ''; };
        ta.addEventListener('input', upd);
      }
    });
  }

  /* ── COLLECT + VALIDATE ──────────────────────────────── */
  function collectPayload() {
    var conditions = [];
    var condWrap = document.getElementById('skc-conditions');
    if (condWrap) condWrap.querySelectorAll('input:checked').forEach(function (b) { conditions.push(b.value); });

    var intensity = null;
    var active = document.querySelector('#skc-intensity button.active');
    if (active) intensity = parseInt(active.getAttribute('data-val'), 10);

    var texts = {};
    var anyText = false;
    SK_CONTRIB_FIELDS.forEach(function (f) {
      var ta = document.getElementById('skc-' + f.key);
      var v = ta ? ta.value.trim() : '';
      if (v) { texts[f.key] = v.slice(0, SK_MAXLEN); anyText = true; }
    });

    return {
      payload: {
        v: 1,
        kind: 'sakari-experience',
        lang: (typeof SAKARI !== 'undefined' && SAKARI.lang) ? SAKARI.lang : 'en',
        conditions: conditions,
        intensity: intensity,
        texts: texts,
        submittedAt: new Date().toISOString(),
      },
      anyText: anyText,
      hasStructured: conditions.length > 0 || intensity !== null,
    };
  }

  function showError(msg) {
    var el = document.getElementById('skc-error');
    if (!el) return;
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
  }

  /* ── SUBMIT ──────────────────────────────────────────── */
  window.skContributeSubmit = function () {
    showError('');
    var consent = document.getElementById('skc-consent');
    var age = document.getElementById('skc-age');
    if (!consent || !consent.checked || !age || !age.checked) {
      showError(cu('errConsent'));
      return;
    }
    var collected = collectPayload();
    if (!collected.anyText && !collected.hasStructured) {
      showError(cu('errEmpty'));
      return;
    }

    var btn = document.getElementById('skc-submit');
    var origText = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = cu('sending'); }

    submitExperience(collected.payload).then(function () {
      renderThanks();
    }).catch(function (err) {
      if (typeof console !== 'undefined') console.error('Sakari contribute: send failed', err);
      showError(cu('errSend'));
      if (btn) { btn.disabled = false; btn.textContent = origText; }
    });
  };

  /* ── THE SINGLE BACKEND SEAM ─────────────────────────── */
  /* submitExperience validates the shape and hands off to
     skSendToBackend(). Replace ONLY skSendToBackend to go live. */
  function submitExperience(payload) {
    if (!payload || payload.kind !== 'sakari-experience') {
      return Promise.reject(new Error('invalid payload'));
    }
    return skSendToBackend(payload);
  }

  /* ████████████████████████████████████████████████████████
     STUB — sends nothing. Replace the body with your backend.

     Example (third-party insert-only REST endpoint):
       return fetch('https://YOUR-ENDPOINT', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json',
                    'apikey': 'YOUR_SUBMIT_ONLY_KEY' },
         body: JSON.stringify(payload),
       }).then(function (r) {
         if (!r.ok) throw new Error('HTTP ' + r.status);
         return r.json();
       });

     Keep the key submit/insert-only so a leaked client key can
     never read or delete existing submissions.
     ████████████████████████████████████████████████████████ */
  function skSendToBackend(payload) {
    return new Promise(function (resolve) {
      if (typeof console !== 'undefined') {
        console.log('[Sakari contribute] STUB — not sent anywhere. Payload:', payload);
      }
      setTimeout(resolve, 450); // simulate latency so the UI flow is real
    });
  }

  /* ── THANKS / RESET ──────────────────────────────────── */
  function renderThanks() {
    var view = document.getElementById('sk-contribute');
    if (!view) return;
    view.innerHTML =
      '<div class="skc-wrap"><div class="skc-thanks">' +
        '<h2>' + cu('thanksTitle') + '</h2>' +
        '<p>' + cu('thanksBody') + '</p>' +
        crisisHtml() +
        '<div class="skc-thanks-actions">' +
          '<button class="skc-hub-btn" onclick="skContributeOpen()">' + cu('thanksAgain') + '</button>' +
          '<button class="skc-cancel" onclick="skContributeClose()">' + cu('thanksHome') + '</button>' +
        '</div>' +
      '</div></div>';
    try { window.scrollTo({ top: 0, behavior: skcReduced() ? 'auto' : 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
  }
  function skcReduced() {
    try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  }

  /* ── OPEN / CLOSE ────────────────────────────────────── */
  window.skContributeOpen = function () {
    ensureContributeView();
    renderContributeForm();
    var hub = document.getElementById('sk-hub');
    var player = document.getElementById('sk-player');
    if (hub) hub.style.display = 'none';
    if (player) player.style.display = 'none';
    var view = document.getElementById('sk-contribute');
    view.classList.add('on');
    try { history.pushState({ contribute: true }, '', '?contribute=1'); } catch (e) {}
    try { window.scrollTo(0, 0); } catch (e) {}
  };
  window.skContributeClose = function () {
    var view = document.getElementById('sk-contribute');
    if (view) view.classList.remove('on');
    try { history.pushState({}, '', window.location.pathname); } catch (e) {}
    // return to the hub (the engine owns hub/player visibility)
    if (typeof showHub === 'function') { showHub(); }
    else {
      var hub = document.getElementById('sk-hub');
      if (hub) hub.style.display = 'block';
    }
  };

  function ensureContributeView() {
    if (document.getElementById('sk-contribute')) return;
    injectContribStyles();
    var view = document.createElement('div');
    view.id = 'sk-contribute';
    view.setAttribute('role', 'region');
    view.setAttribute('aria-label', cu('title'));
    document.body.appendChild(view);
  }

  /* ── HUB ENTRY POINT ─────────────────────────────────── */
  /* Adds a card to the hub once the engine has populated it.
     Placed after the story grid's section so it reads as a
     natural invitation, not an ad. */
  function injectHubEntry() {
    var grid = document.getElementById('sk-story-grid');
    if (!grid) return false;
    var section = grid.closest('.stories-section') || grid.parentNode;
    if (!section || document.getElementById('skc-hub-entry')) return true;
    var card = document.createElement('div');
    card.id = 'skc-hub-entry';
    card.className = 'skc-hub-card reveal';
    card.innerHTML =
      '<h3>' + cu('hubCta') + '</h3>' +
      '<p>' + cu('hubBlurb') + '</p>' +
      '<button class="skc-hub-btn" onclick="skContributeOpen()">' + cu('hubCta') + ' \u2192</button>';
    section.parentNode.insertBefore(card, section.nextSibling);
    return true;
  }

  /* ── BOOT ────────────────────────────────────────────── */
  function boot() {
    injectContribStyles();
    ensureContributeView();
    // The engine fills the hub asynchronously; poll briefly for the grid.
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (injectHubEntry() || tries > 40) clearInterval(iv);
    }, 150);
    // deep link: ?contribute=1 opens the form directly
    try {
      var p = new URLSearchParams(window.location.search);
      if (p.get('contribute') === '1') { setTimeout(window.skContributeOpen, 200); }
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // expose for re-rendering on language change if engine calls it
  window.skContributeRefresh = function () {
    var view = document.getElementById('sk-contribute');
    if (view && view.classList.contains('on')) renderContributeForm();
    var entry = document.getElementById('skc-hub-entry');
    if (entry) { entry.remove(); injectHubEntry(); }
  };
})();
