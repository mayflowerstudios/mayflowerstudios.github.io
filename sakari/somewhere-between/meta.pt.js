/* somewhere between — meta.pt.js
   Patches story metadata into Portuguese. Loaded before day files. */
(function(){
  var m=SAKARI.stories['somewhere-between'];if(!m)return;
  m.title    = 'em algum lugar entre';
  m.subtitle = 'uma história interativa';
  m.desc     = 'Um dia na vida de uma garota navegando com TPB, transtorno de personalidade dependente, ansiedade e depressão — contado de dentro. Algumas escolhas estão bloqueadas. Não pela história. Pelo cérebro.';
  m.note     = 'Esta é uma versão beta — um único dia, uma amostra do que é o Sakari. Mais está por vir.';
  m.cw       = 'Representações realistas de dificuldades de saúde mental, incluindo pensamentos intrusivos, desregulação emocional, divisão e dissociação.';
  m.epilogue = [
    {type:'p',    text:'Este é um dia. Não o pior, não o melhor. Um dia que teve um custo específico e terminou com você na sua cama, que é onde a maioria dos dias termina, o que por si só já é alguma coisa.'},
    {type:'thought',text:'você sobreviveu. você consegue, na maioria dos dias. só custa mais do que as pessoas sabem.'},
    {type:'p',    text:'TPB, transtorno de personalidade dependente, ansiedade e depressão não parecem com o que as pessoas esperam. Eles parecem chegar nove minutos atrasada e passar uma hora com medo disso. Parecem doze minutos diante de um guarda-roupa. Parecem ler as mesmas duas palavras — "ou não" — até que elas signifiquem algo que não significam. Parecem uma pessoa em uma reunião, representando a postura de quem está engajada. Parecem alguém que, pela medida de qualquer outra pessoa, teve uma ótima noite e ainda assim a repassa três vezes no caminho para casa.'},
    {type:'p',    text:'Se você tem esses transtornos, ou acha que pode ter: você não é demais. Você não está quebrada. As coisas que são difíceis para você são genuinamente difíceis — não porque você é fraca, mas porque você está fazendo significativamente mais trabalho cognitivo e emocional do que a maioria das pessoas faz só para atravessar uma manhã. Isso não é metáfora. É fisiologia.'},
    {type:'p',    text:'Se alguém que você conhece pode ter esses transtornos: as escolhas bloqueadas são exatamente o ponto. Essas não eram opções que elas escolheram não aproveitar. Eram opções que o cérebro delas tornou genuinamente inacessíveis. O checar, o buscar reasseguração, a incapacidade de escolher uma blusa — nada disso é manipulação, nada disso é busca por atenção. É uma pessoa fazendo o melhor que pode com um cérebro que está trabalhando muito contra ela.'},
    {type:'thought',text:'obrigada por passar um dia aqui.'},
  ];
})();
