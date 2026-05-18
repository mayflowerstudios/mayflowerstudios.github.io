/* ══════════════════════════════════════════════════════
   somewhere between — day1.pt.js
   Tradução para o português (Brasil)
   ══════════════════════════════════════════════════════ */

var SCENES={

  morning_1:{label:'manhã · 6:47',dep:0,anx:0,nrg:0,
    prose:[
      {text:"Seu alarme tocou vinte e três minutos atrás. Você sabe disso porque ficou observando os números mudarem — 6:24, 6:31, 6:38, e agora 6:47 — e cada número parece uma acusação. O teto é o mesmo de sempre. A luz que entra pela cortina tem a cor de algo que você ainda não quer pensar. Seu corpo tem um peso específico nesta manhã — não exatamente cansaço, é mais como se a gravidade tivesse tomado uma decisão pessoal a seu respeito."},
      {type:'thought',text:"se você ficar aqui tempo suficiente, talvez o dia comece sem você. talvez ele simplesmente — vá embora."},
      {text:"É assim que <span class='term' data-key='executive'>levantar da cama</span> parece por dentro. Não o ato em si, mas os dez minutos antes dele, quando o ato parece subir algo muito alto sem nada para se segurar. Você colocou quatro alarmes. Você sabia que isso ia acontecer. Você colocou quatro alarmes mesmo assim."},
    ],
    choices:[
      {text:"Levantar. Jogar as pernas para o lado da cama e não pensar.",next:'morning_mirror',nrg:-8,dep:-5},
      {text:"Mais cinco minutos. Colocar mais um alarme.",next:'morning_snooze',nrg:-5},
      {text:"Tentar pensar em tudo que precisa fazer hoje — talvez isso motive.",locked:true,reason:"você sabe que não adianta. já tentou antes. pensar na lista não a encolhe. só faz o teto parecer mais baixo.",spiral:'spiral_morning'},
    ]
  },

  morning_snooze:{label:'manhã · 7:21',dep:5,anx:5,nrg:0,
    prose:[
      {text:"Você fez isso mais quatro vezes. São 7:21. O quarto está mais iluminado do que deveria e seu corpo está mais pesado do que estava uma hora atrás, que é a direção errada. <span class='term' data-key='anhedonia'>A ideia do dia</span> assenta no seu peito como algo engolido de jeito errado."},
      {type:'thought',text:"não é preguiça. você leu o suficiente para saber disso. não ajuda saber disso."},
      {text:"Você poderia continuar colocando alarmes. Existe uma versão desta manhã em que você faz isso mais duas vezes e chega a algum lugar uma hora atrasada e passa o resto do dia administrando as consequências. Você já viveu essa versão antes."},
    ],
    choices:[
      {text:"Ok. Desta vez de verdade. Levantar.",next:'morning_mirror',nrg:-8,dep:-5},
      {text:"Checar o celular primeiro. Só um minuto.",next:'phone_check'},
    ]
  },

  morning_mirror:{label:'manhã · banheiro',dep:0,anx:5,nrg:0,
    prose:[
      {text:"Você está parada na frente do espelho do banheiro. Você veio aqui para escovar os dentes. Você escovou os dentes. Você ainda está parada aqui. Faz oito minutos, o que você sabe porque checou o celular enquanto estava aqui e depois o colocou com a tela para baixo na pia para parar."},
      {type:'thought',text:"você parece o que você é. cansada. você se pergunta quanto disso aparece para outras pessoas."},
      {text:"Não é <span class='term' data-key='masking'>vaidade</span>. É mais que a pessoa no espelho precisa ser checada — confirmada — antes que você possa ter certeza de que está autorizada a sair no mundo como ela. Algumas manhãs isso leva dois minutos. Hoje está levando mais tempo."},
    ],
    choices:[
      {text:"Você está bem. Para. Vai embora.",locked:true,reason:"você sabe que não acredita nisso. já tentou dizer em voz alta antes. as palavras ficam ali sem fazer efeito."},
      {text:"Trocar de roupa. Algo que cubra mais.",next:'meds_check'},
      {text:"Mandar mensagem para a Maya. Perguntar se a roupa está boa.",next:'text_maya_outfit',note:'DPD'},
      {text:"Parar de se olhar e simplesmente ir.",locked:true,reason:"você está tentando fazer isso há oito minutos."},
    ]
  },

  text_maya_outfit:{label:'manhã · esperando',dep:0,anx:10,nrg:-4,
    prose:[
      {text:"Você manda a foto. <span class='term' data-key='fp'>A Maya</span> é — ela é a pessoa cuja opinião importa agora. Não só sobre a roupa. Sobre a maioria das coisas. Você sabe isso sobre si mesma. Sabe que não é justo com ela. Você manda a foto mesmo assim, porque a alternativa é ficar na frente do espelho por mais dez minutos."},
      {text:"O indicador de digitação aparece. Desaparece. Aparece de novo. Já faz quatro minutos. Ela normalmente responde em menos de um minuto. Quatro minutos significam alguma coisa. Você passa pelas possibilidades. Ela está ocupada. Está no chuveiro. Ela viu a mensagem e pensou algo que não queria dizer."},
      {type:'thought',text:"para. você não sabe disso. mas quatro minutos é muito tempo."},
      {text:"Isso é <span class='term' data-key='hypervigilance'>hipervigilância</span>. Você conhece a palavra. Saber a palavra não desacelera seus batimentos cardíacos."},
    ],
    choices:[
      {text:"Ela provavelmente está ocupada. É cedo. Esperar.",locked:true,reason:"você sabe que provavelmente é verdade. seu cérebro já escreveu três versões diferentes do que o silêncio significa e está decidindo entre elas."},
      {text:"Mandar uma mensagem de acompanhamento. 'oi desculpa esquece kk'",next:'maya_followup',note:'anxiety/BPD',anx:5},
      {text:"Colocar o celular com a tela para baixo e se arrumar mesmo assim.",next:'getting_ready',nrg:-8,anx:5},
    ]
  },

  maya_followup:{label:'manhã · a resposta dela',dep:-5,anx:-10,nrg:0,
    prose:[
      {type:'msg',name:'Maya',text:"nossa você ficou linda?? por que você está perguntando isso"},
      {text:"O alívio está fora de proporção com a pergunta, o que você sabe. Em algum lugar no fundo da sua cabeça você sabe que o alívio que você está sentindo agora não é uma quantidade normal de alívio sobre uma roupa. Mas é real. Seus ombros baixam. Sua mandíbula relaxa. Você não havia notado nenhuma dessas coisas até que pararam."},
      {type:'thought',text:"ok. ok, ela não está brava. segura isso. ainda não larga."},
      {text:"<span class='term' data-key='reassurance'>Reasseguramento</span> funciona. Esta é a parte complicada — ele genuinamente funciona, no curto prazo. A ansiedade baixa. Você se sente melhor. E em vinte minutos ela vai voltar rastejando, e o alívio temporário terá custado algo que você não notou que estava gastando."},
    ],
    choices:[
      {text:"Responder 'hahaha obrigada ❤️' e sentir o alívio.",next:'getting_ready'},
      {text:"Acreditar plenamente nela e deixar ir.",locked:true,reason:"o alívio já está começando a enfraquecer. e se ela só foi gentil porque é gentil? e se ela não olhou direito para a foto?"},
    ]
  },

  phone_check:{label:'manhã · ainda na cama',dep:0,anx:5,nrg:0,
    prose:[
      {type:'msg',name:'Maya · 23:47',text:"ei você vem hoje à noite? vai ser divertido :)"},
      {text:"Você lê três vezes. Na segunda vez percebe que ela usou dois pontos e parênteses em vez de um emoji de verdade, o que pode não significar nada. Normalmente não significa nada. Só que ela geralmente usa o de olhinhos de coração, e ela mandou às 23:47 que é tarde, e o <span class='term' data-key='splitting'>tom é diferente</span> de como ela normalmente escreve, e você sabe que está fazendo isso, sabe que está lendo pontuação às 6:53 da manhã, mas não consegue parar."},
      {type:'thought',text:"talvez ela não tenha certeza se quer você lá. talvez esteja perguntando por educação. talvez algo tenha acontecido e você não saiba o que."},
      {text:"Não é sobre os dois pontos com parênteses. Você sabe disso. É só a coisa que seu cérebro pegou e saiu correndo. Ele precisava de algo para ficar incerto e encontrou isso."},
    ],
    choices:[
      {text:"Responder 'sim! mal posso esperar :)' e levantar.",next:'morning_mirror'},
      {text:"Perguntar se ela está bem. Confirmar se ela realmente quer você lá.",next:'maya_check',note:'BPD',anx:5},
      {text:"Responder normalmente. Confiar que ela está falando sério.",locked:true,reason:"seu peito está apertado e você não sabe por quê. alguma coisa parece que pode estar errada e seu cérebro não vai deixar você agir como se não estivesse até confirmar que não está."},
      {text:"Dizer que não está se sentindo bem. Você decide depois.",next:'skip_offer',note:'avoidance',dep:5},
    ]
  },

  maya_check:{label:'manhã · checando',dep:0,anx:-5,nrg:0,
    prose:[
      {type:'msg',name:'Maya',text:"claro!! por que não ❤️❤️❤️"},
      {text:"Ela está bem. Sempre estava bem. Os dois pontos com parênteses eram só dois pontos com parênteses. Você sabia, provavelmente, que isso era o mais provável. E ainda assim a confirmação faz algo ao seu corpo que só <em>saber</em> não faz — há um relaxamento físico que só acontece quando alguém diz as palavras em voz alta."},
      {type:'thought',text:"ok. ela está bem. você está bem. por que você fica fazendo isso com ela. ela deve estar tão cansada de—"},
      {text:"Este é <span class='term' data-key='abandonment'>o ciclo</span>. Você pergunta. Ela reassegura. O reasseguramento funciona. Você se sente mal por precisar. Sentir-se mal faz a ansiedade voltar. O que significa que você provavelmente vai checar de novo mais tarde."},
    ],
    choices:[
      {text:"Responder 'ok desculpa kk' e levantar.",next:'morning_mirror'},
      {text:"Sentir-se totalmente reassegurada.",locked:true,reason:"a mensagem de desculpa que você acabou de mandar — e se foi demais? e se ela está bem com hoje à noite mas irritada agora com a desculpa?"},
    ]
  },

  skip_offer:{label:'manhã · a saída',dep:5,anx:0,nrg:0,
    prose:[
      {type:'msg',name:'Maya',text:"não você tem que vir :( eu vou buscar você se precisar"},
      {text:"Ela está falando sério. O 'vou buscar', a carinha triste — ela está falando sério. O que você questiona é se quer ser a pessoa que ela precisa buscar. Se <span class='term' data-key='dpd'>'eu vou buscar você'</span> é amor ou obrigação, e se a distinção importa quando você é quem está sendo carregada."},
      {type:'thought',text:"ela disse que quer você lá. isso é suficiente. tem que ser suficiente."},
    ],
    choices:[
      {text:"Dizer que vai tentar. É uma resposta honesta.",next:'morning_mirror'},
      {text:"Dizer ok. Porque ela pediu. Não porque você escolheu.",next:'morning_mirror',note:'DPD'},
    ]
  },


  meds_check:{label:'manhã · prateleira do banheiro',dep:0,anx:0,nrg:0,
    prose:[
      {text:"Seu medicamento está na prateleira atrás de você. Você consegue ver no espelho — os pequenos frascos alaranjados que estão ali há oito meses. Você não pensa neles na maioria dos dias, o que sua terapeuta diz ser um bom sinal. Hoje você está olhando para eles e pensando: <em>isso está funcionando</em>. Você tem esse pensamento aproximadamente uma vez a cada quinze dias. Nunca leva a nenhum lugar útil."},
      {type:'thought',text:"só tome. são quatro segundos. você fez isso 168 vezes."},
      {text:"Em alguns dias você tem certeza de que estão funcionando e tem medo do que seria sem eles. Em outros dias tem certeza de que não estão e você é simplesmente assim, com ou sem os comprimidos. Hoje você não sabe. Você fica parada e não sabe e os quatro segundos passam e a pergunta continua aberta."},
    ],
    choices:[
      {text:"Tomar. Quatro segundos, feito.",next:'getting_ready',dep:-5},
      {text:"Você já está atrasada. Toma à noite.",next:'getting_ready',dep:5,note:'risk'},
      {text:"Parar de pensar se estão funcionando e só tomar.",locked:true,reason:"você sabe que é o pensamento certo. você não consegue parar de ter o outro primeiro."},
    ]
  },

  getting_ready:{label:'manhã · a porta',dep:0,anx:10,nrg:-4,
    prose:[
      {text:"Você está pronta. Parada na porta da frente com suas chaves. A porta está bem ali. Você precisa sair em quatro minutos para chegar na hora."},
      {type:'thought',text:"o fogão está apagado. você checou. você checou duas vezes. você checou de verdade ou só ficou parada perto dele? tem diferença."},
      {text:"Você checou o fogão. Você sabe que checou. O problema com a <span class='term' data-key='intrusive'>dúvida intrusiva</span> é que 'saber' algo e 'conseguir agir como se soubesse' não são o mesmo passo cognitivo. O fogão está apagado. Você pode ter que voltar e confirmar isso antes que seu corpo acredite."},
    ],
    choices:[
      {text:"Voltar e checar o fogão mais uma vez.",next:'check_stove',nrg:-5,anx:-10},
      {text:"Você checou. Pode ir.",locked:true,reason:"você sabe que checou. suas mãos lembram de ter feito isso. seu cérebro não está interessado no que suas mãos lembram."},
      {text:"Mandar mensagem para a Maya 'saindo agora' — só para alguém saber.",next:'commute',note:'DPD'},
      {text:"Sair. Só sair.",next:'commute',nrg:-8},
    ]
  },

  check_stove:{label:'manhã · cozinha de novo',dep:0,anx:-5,nrg:0,
    prose:[
      {text:"Apagado. Todos apagados. Obviamente. Você sabia disso. Você checa a tranca da porta da frente — maçaneta, ferrolho, maçaneta de novo — e vai embora."},
      {type:'thought',text:"é só assim que as manhãs são. você só precisa chegar lá. depois que chega fica mais fácil."},
    ],
    choices:[{text:"Sair. Você vai chegar nove minutos atrasada.",next:'commute',nrg:-5}]
  },

  commute:{label:'manhã · lá fora',dep:0,anx:10,nrg:-5,
    prose:[
      {text:"O ar está frio. Você esqueceu como fica frio de manhã. Você vai chegar oito minutos atrasada, o que não é muito, o que você sabe que não é muito, mas que vai exigir que você entre numa sala de pessoas que vão notar a porta se abrindo e olhar para cima e ver você entrar atrasada, e você vai sentir cada um desses olhares separadamente e os carregar pelo resto da manhã."},
      {type:'thought',text:"elas vão achar que você é pouco confiável. já estão achando há um tempo. você dá razões."},
      {text:"Existe uma coisa que acontece no seu peito quando você está atrasada — um aperto ao redor do esterno que não é exatamente dor mas tem as qualidades da dor, a sua insistência. <span class='term' data-key='emotional_intensity'>O cálculo disso</span> — atrasada, olhada, julgada — seu sistema nervoso está processando como algo muito maior do que é. Você sabe disso. Você está andando mais rápido do que precisa."},
    ],
    choices:[
      {text:"Oito minutos não é nada. Acontece com todo mundo.",locked:true,reason:"acontece mesmo com todo mundo. você não é todo mundo agora. sua frequência cardíaca está acelerada desde que saiu de casa."},
      {text:"Mandar mensagem para a Maya 'estou atrasada, me diz que está tudo bem'",next:'arrive',note:'DPD',anx:-10},
      {text:"Colocar o fone de ouvido. Não pensar nisso até chegar.",next:'arrive',nrg:-5},
    ]
  },

  arrive:{label:'manhã · chegada',dep:-5,anx:-5,nrg:0,
    prose:[
      {text:"Você consegue. Nove minutos atrasada. Ninguém olha para cima. Você se senta. Abre o notebook. A manhã não se importa que custou noventa minutos de energia mental chegar até aqui. Ela simplesmente continua."},
      {type:'thought',text:"é claro que ninguém olhou. você sempre sabe disso e nunca ajuda."},
      {text:"Esta é a parte invisível — a parte que não aparece em como você parece ou como você se desempenha. Todo aquele esforço só para chegar. O dia não começou direito ainda e você já gastou algo significativo."},
    ],
    choices:[{text:"Continuar para o meio-dia →",next:'midday_1'}]
  },

  midday_1:{label:'meio-dia · no trabalho',dep:5,anx:5,nrg:-10,
    prose:[
      {text:"Já faz três horas. Do outro lado da sala, duas pessoas riem de algo — rápido, breve, um riso de verdade. Você não fazia parte disso. Você não sabe por que seu estômago afunda do jeito que afunda quando isso acontece."},
      {type:'thought',text:"do que elas estavam rindo. foi de algo que você disse antes. você disse algo sobre o relatório Johnson, disse que era 'demais', será que—"},
      {text:"Isso é <span class='term' data-key='hypervigilance'>hipervigilância</span> aplicada ao espaço social. Seu sistema nervoso alocou recursos de detecção de ameaça para uma risada da qual você não fez parte, e agora ele precisa resolver a questão antes de recuar. A resposta é quase certamente não. 'Quase certamente' não é 'definitivamente'."},
    ],
    choices:[
      {text:"Não é nada. Olhar de volta para a tela.",locked:true,reason:"você se disse isso três vezes nos últimos trinta segundos. seu cérebro ainda não terminou com a questão."},
      {text:"Fazer um comentário pequeno. Testar o clima.",next:'midday_check',note:'BPD/anxiety',anx:-10},
      {text:"Colocar o fone de ouvido.",next:'midday_flat',dep:5},
    ]
  },

  midday_check:{label:'meio-dia · a checagem',dep:0,anx:-5,nrg:-5,
    prose:[
      {text:"Você diz algo pequeno e as duas riem e uma delas diz <em>\"ah totalmente\"</em> e volta para a tela. Elas estavam falando de algo em uma série. Não tinha nada a ver com você."},
      {type:'thought',text:"viu. tudo bem. nada. só que agora você está irritada consigo mesma por ter precisado checar. o que significa que você ainda não está realmente bem. você só confirmou o nível de ameaça imediata."},
    ],
    choices:[{text:"Voltar ao trabalho.",next:'midday_flat'}]
  },

  midday_flat:{label:'meio-dia · almoço',dep:5,anx:0,nrg:-10,
    prose:[
      {text:"Almoço. Quarenta minutos. Os outros foram para algum lugar na rua. Ninguém perguntou se você ia, o que pode significar que assumiram que você ia dizer não, o que pode significar—"},
      {type:'thought',text:"para. coma alguma coisa. você não comeu nada. isso está piorando tudo."},
      {text:"Você almoça na sua mesa. Você come sem saborear nada. Esta é a <span class='term' data-key='anhedonia'>planura</span> — não exatamente tristeza, nada dramático o suficiente para justificar o peso dela. Só uma ausência. Comida tem textura. Você nota a textura. É só o que ela tem hoje."},
      {text:"Em algum ponto entre o sanduíche e a tarde, você percebe que ficou olhando para a mesma linha de um e-mail por onze minutos. Você não foi a lugar nenhum, exatamente. Você estava apenas — não aqui. <span class='term' data-key='dissociation'>Em lugar nenhum em particular.</span>"},
      {type:'thought',text:"você está aqui. está na sua mesa. são 13:14. é onde você está."},
    ],
    choices:[
      {text:"Tem uma reunião de equipe às 14h. Preparar algo para dizer.",locked:true,reason:"você não consegue encontrar a parte de si mesma que saberia o que dizer. você vai e vai ouvir e acenar e isso terá que ser suficiente.",egGate:20},
      {text:"Tem uma reunião de equipe às 14h. Você vai e vai aguentar.",next:'midday_meeting'},
      {text:"Responder o e-mail que você ficou encarando.",next:'midday_meeting',nrg:-5},
    ]
  },

  midday_meeting:{label:'meio-dia · 14h',dep:0,anx:10,nrg:-8,
    prose:[
      {text:"A reunião. Você está na reunião. Alguém está falando sobre os números do trimestre. Você está performando a postura de alguém que está engajada com os números do trimestre. Seu rosto está fazendo a coisa que seu rosto faz em reuniões. Você tem feito isso tempo suficiente para que a performance não exija mais muito esforço consciente, o que é ao mesmo tempo uma habilidade e um custo."},
      {text:"Sua gerente pergunta se você tem algo a acrescentar. Todo mundo olha para você. Você tem aproximadamente três segundos antes que a pausa se torne notável."},
      {type:'thought',text:"diz alguma coisa. qualquer coisa. você sabe o suficiente sobre os números do trimestre para dizer alguma coisa."},
    ],
    choices:[
      {text:"Dizer algo breve e útil sobre o terceiro trimestre.",next:'meeting_speaks',nrg:-6},
      {text:"Dizer 'nada a acrescentar da minha parte, parece ótimo'",next:'meeting_silent',note:'masking'},
      {text:"Realmente se engajar. Questionar as projeções que você acha incorretas.",locked:true,reason:"você tem o pensamento. você não consegue fazê-lo ir do seu cérebro para a sua boca agora. a sala está muito barulhenta na sua cabeça."},
    ]
  },

  meeting_speaks:{label:'meio-dia · depois da reunião',dep:-5,anx:-5,nrg:0,
    prose:[
      {text:"Você diz a coisa. Está bom. É até levemente bom — alguém anota. Sua gerente acena. A reunião continua. Nada de ruim aconteceu."},
      {type:'thought',text:"ok. você fez isso. você disse a coisa e ficou bem. você consegue fazer isso."},
      {text:"O alívio dura uns quatro minutos. Então seu cérebro começa a revisar o que você disse procurando erros. Ele vai continuar fazendo isso pelo resto da tarde."},
    ],
    choices:[{text:"Continuar para o fim da tarde →",next:'split_setup'}]
  },

  meeting_silent:{label:'meio-dia · depois da reunião',dep:5,anx:0,nrg:0,
    prose:[
      {text:"'Nada a acrescentar.' Sua gerente acena e segue em frente. A reunião termina. Você ficou naquela sala por cinquenta minutos e não deixou rastro de si mesma nela. O que às vezes é exatamente o que você precisa, e que hoje parece desaparecer um pouco."},
      {type:'thought',text:"você estava lá. isso conta. estar lá conta."},
    ],
    choices:[{text:"Continuar para o fim da tarde →",next:'split_setup'}]
  },

  /* ── THE SPLIT ─────────────────────────────────────── */

  split_setup:{label:'fim da tarde · 16:38',dep:0,anx:5,nrg:-5,
    prose:[
      {text:"Você está terminando algo quando o nome da Maya aparece no seu celular. Você nota como seu corpo responde ao ver o nome dela — um pequeno levantamento involuntário, um brilho. É assim que ter uma <span class='term' data-key='fp'>pessoa favorita</span> parece em um bom dia. O nome dela chega e a sala fica um pouco menos cinza."},
      {type:'msg',name:'Maya · 16:38',text:"ei pergunta rápida - você ainda vem hoje à noite ou não"},
      {text:"Você lê duas vezes. Na primeira vez você registra as palavras. Na segunda você registra 'ou não'."},
      {type:'thought',text:"ou não. ela escreveu 'ou não'. ela digitou essas duas palavras e mandou. ela podia ter dito 'me avisa!' ela podia ter dito 'espero que sim :)'. ela escreveu 'ou não'."},
    ],
    choices:[
      {text:"Ela digitou 'ou não' porque é uma pergunta, não um convite para cancelar. Responder normalmente.",locked:true,reason:"você sabe disso. você está tentando segurar isso. seu cérebro decidiu que 'ou não' é um dado e ainda não terminou de processar o dado."},
      {text:"Ler de novo e ver se o significado muda.",next:'split_happening',anx:10},
    ]
  },

  split_happening:{label:'fim da tarde · a divisão',dep:0,anx:15,nrg:-10,isSplit:true,
    prose:[
      {text:"Você lê de novo. Não ajuda. Algo acontece no seu corpo quando a mudança ocorre — um recolhimento, um puxão para dentro, como um enrijecimento físico. Algo mudou na qualidade da mensagem — não as palavras, as palavras são as mesmas, mas o calor saiu delas. <span class='term' data-key='splitting'>É assim que a divisão parece</span>: não uma decisão, não um pensamento do qual você pode se convencer. Mais como uma luz mudando. A Maya que mandou o emoji de olhinhos de coração esta manhã e a pessoa que mandou 'ou não' às 16:38 são, neste momento, duas pessoas diferentes."},
      {type:'msg',name:'Maya',cold:true,text:"ei pergunta rápida - você ainda vem hoje à noite ou não"},
      {text:"A versão fria dela é mais familiar, em certo sentido. A versão fria dela é a que você estava esperando. A versão calorosa era tempo emprestado; isso é o que você sabia que vinha. Você sabe — a parte de você que ainda consegue acessar conhecimento — que isso não é real. Que a Maya não mudou. Que <span class='term' data-key='object_constancy'>a versão calorosa dela ainda existe</span>. Você não consegue sentir isso agora. Saber e sentir são países diferentes."},
      {type:'thought',text:"ela quer que você diga não. ela está te dando uma saída porque quer que você a pegue. ela tem tolerado você educadamente por semanas e esta é a mensagem onde ela para."},
    ],
    choices:[
      {text:"Mandar a mensagem normal. Não mostrar a ela o que está acontecendo.",next:'split_reply_normal',wanted:"estou com medo de ter feito algo errado e não sei o que é. você está bem comigo? estamos bem?"},
      {text:"Perguntar diretamente se ela realmente quer que você vá.",next:'split_reply_check',note:'BPD',anx:5},
      {text:"Dizer a ela que não pode ir.",next:'split_withdraw',dep:10},
    ]
  },

  split_reply_normal:{label:'fim da tarde · depois',dep:0,anx:-5,nrg:0,
    prose:[
      {type:'msg',name:'Maya',text:"eba!! ok te vejo às 20h ❤️"},
      {text:"Ela manda o coração. O coração é caloroso. O coração contribui para fazer 'ou não' parecer a coisa que era, que era uma expressão casual, que era nada. Seu sistema nervoso ainda não acredita totalmente nisso. Mas está recebendo a evidência."},
      {type:'thought',text:"viu. ela está bem. sempre esteve bem. você sabia disso. você passou vinte minutos não sabendo e agora sabe de novo."},
      {text:"É assim que <span class='term' data-key='object_constancy'>voltar de uma divisão</span> parece — não um estalo mas um reaquecimento lento, evidência chegando uma mensagem por vez, o calor voltando de forma irregular. Você vai estar um pouco abalada com ela hoje à noite. Vai monitorar as expressões dela mais do que deveria. Mas o pior passou."},
    ],
    choices:[{text:"Começar a se arrumar →",next:'dpd_decision'}]
  },

  split_reply_check:{label:'fim da tarde · checando',dep:0,anx:0,nrg:0,
    prose:[
      {type:'msg',name:'You',text:"haha pergunta aleatória - você realmente quer que eu vá né? não só perguntando para ser educada"},
      {type:'msg',name:'Maya',text:"??? sim óbvio?? por que não quereria"},
      {type:'msg',name:'Maya',text:"espera você está bem"},
      {text:"Três mensagens. A última — 'você está bem' — pousa em algum lugar complicado. Ela notou. Ela notou e perguntou. A parte de você que tinha certeza de que ela estava se afastando não tem resposta para isso. A certeza está recuando agora, quietamente, do jeito que sempre faz quando é contradita pela realidade. Ela não pede desculpa quando vai. Ela só vai."},
      {type:'thought',text:"ela perguntou se você está bem. ela perguntou. a versão fria dela não perguntaria."},
    ],
    choices:[
      {text:"Dizer que está bem, só sendo estranha, te vejo às 20h.",next:'split_reply_normal'},
      {text:"Dizer honestamente: você teve um momento, está bem agora.",next:'split_honest_reply'},
    ]
  },

  split_honest_reply:{label:'fim da tarde · honestidade de novo',dep:-5,anx:-5,nrg:0,
    prose:[
      {type:'msg',name:'You',text:"eu tive uns cinco minutos malucos onde me convenci que você não queria que eu fosse. estou bem agora. desculpa"},
      {type:'msg',name:'Maya',text:"não não fica desculpando. odeio que você passou por isso. devia ter escrito melhor"},
      {type:'msg',name:'Maya',text:"eu sempre quero você lá. isso é dado ok"},
      {type:'thought',text:"ela disse 'é dado'. segura isso. ela disse que é dado."},
      {text:"Você fica com isso por um minuto. Ela não tornou estranho. Ela não se cansou de você por precisar. Ela simplesmente — respondeu. É isso que pessoas seguras fazem. Você sabe disso. Às vezes ainda é surpreendente."},
    ],
    choices:[{text:"Começar a se arrumar →",next:'dpd_decision'}]
  },

  split_withdraw:{label:'fim da tarde · recolhimento',dep:10,anx:-10,nrg:5,
    prose:[
      {type:'msg',name:'You',text:"na verdade não estou me sentindo bem, acho que vou pular hoje, desculpa"},
      {type:'msg',name:'Maya',text:"nossa :( você está bem? precisa de alguma coisa?"},
      {text:"Ela pergunta se você precisa de alguma coisa. A pergunta tem a forma do cuidado. Você não consegue dizer, agora, se é cuidado ou se é a performance do cuidado que ela ofereceria a qualquer pessoa que cancelasse. Você sabe, intelectualmente, que a Maya não está performando. Você não consegue sentir isso agora."},
      {type:'thought',text:"você fez a coisa certa. estava perto demais do limite. você explica depois."},
      {text:"O alívio de cancelar é real e imediato e já está azedando nas bordas. <span class='term' data-key='abandonment'>Até amanhã</span> você terá se convencido de que este foi o começo do afastamento dela. Mas hoje à noite você tem seu quarto e o silêncio e isso terá que ser suficiente."},
    ],
    choices:[{text:"Ir para casa →",next:'end_day_alone'}]
  },

  /* ── DPD DECISION ──────────────────────────────────── */

  dpd_decision:{label:'fim da tarde · se arrumando',dep:0,anx:5,nrg:-5,
    prose:[
      {text:"Você está parada na frente do seu guarda-roupa. Faz doze minutos que está aqui. Não é o problema do espelho — você não está se olhando. Você está olhando para as opções. Há quatorze peças de roupa visíveis. Você não consegue selecionar nenhuma. Não é indecisão da forma como as pessoas geralmente querem dizer. É algo mais estrutural do que isso — uma <span class='term' data-key='dpd'>ausência genuína de preferência</span>, ou melhor, preferência que existe em algum lugar mas não consegue emergir sem alguém para fazê-la emergir."},
      {type:'thought',text:"não importa o que você vai vestir. importa o que você vai vestir. você precisa que alguém diga que não importa o que você vai vestir."},
      {text:"Você já esteve aqui antes. A decisão é simples — é um encontro casual, jeans e algo está ótimo. Você sabe disso. O conhecimento não está ajudando. O que você precisa é de alguém que diga: <em>essa</em>. Aí você conseguiria se mover."},
    ],
    choices:[
      {text:"Escolher algo. Qualquer coisa. Você já fez isso antes.",locked:true,reason:"você sabe que já fez. você está tentando acessar essa capacidade e ela não está disponível agora."},
      {text:"Mandar uma foto para a Maya com duas opções. Pedir que ela escolha.",next:'dpd_resolved',note:'DPD',anx:-10},
      {text:"Ligar para a sua mãe. Dizer que precisa que ela tome uma pequena decisão.",next:'dpd_resolved_mum',note:'DPD'},
      {text:"Ficar aqui até que seu corpo escolha de alguma forma.",next:'dpd_stall',nrg:-10},
    ]
  },

  dpd_resolved:{label:'fim da tarde · resolvido',dep:0,anx:-10,nrg:5,
    prose:[
      {type:'msg',name:'Maya',text:"a preta obviamente!! por que você sequer tem a outra"},
      {text:"A preta. Você veste a preta. Leva quatro segundos. Seu corpo se move sem os doze minutos de atrito que tinha antes, porque outra pessoa absorveu a decisão e te devolveu como resposta, e respostas são coisas sobre as quais você consegue agir. É assim que <span class='term' data-key='dpd'>a dependência parece por dentro</span> — não fraqueza, não uma escolha, mas a experiência de uma porta que só abre de um lado."},
      {type:'thought',text:"você vai. você está se arrumando. é só isso. continue se movendo."},
    ],
    choices:[{text:"Sair para a casa da Maya →",next:'evening_arrival'}]
  },

  dpd_resolved_mum:{label:'fim da tarde · a ligação',dep:-5,anx:-5,nrg:0,
    prose:[
      {text:"Sua mãe atende no segundo toque. Você diz que não consegue decidir o que vestir e precisa que ela escolha. Ela não pergunta por quê. Ela pede que você descreva as opções. Ela escolhe a azul sem hesitar. Você veste a azul."},
      {type:'thought',text:"ela simplesmente — escolheu. não tornou um drama. só escolheu."},
      {text:"Existem pessoas que ficariam frustradas com essa ligação. Sua mãe não é uma delas. Isso é porque ela entende, ou porque aprendeu. De qualquer forma, ela escolheu a azul, e você está se movendo agora, e os doze minutos congelados ficaram para trás."},
    ],
    choices:[{text:"Sair para a casa da Maya →",next:'evening_arrival'}]
  },

  dpd_stall:{label:'fim da tarde · travada',dep:5,anx:5,nrg:0,
    prose:[
      {text:"Você fica parada até que ficar parada se torna insuportável e então pega a peça mais perto e veste. Está ótimo. Sempre ia estar ótimo. Você gastou vinte e dois minutos nisso. Vai chegar atrasada."},
      {type:'thought',text:"está ótimo. é uma blusa. está ótimo. você vai."},
    ],
    choices:[{text:"Sair. Você está atrasada.",next:'evening_arrival',nrg:-5}]
  },

  /* ── EVENING ───────────────────────────────────────── */

  evening_arrival:{label:'noite · casa da Maya',dep:0,anx:5,nrg:-5,
    prose:[
      {text:"Você chega. A Maya abre a porta e ela parece ela mesma — a versão calorosa dela, que é a versão real, que é a única versão que sempre foi real — e o último resíduo da divisão se dissolve em aproximadamente quatro segundos."},
      {text:"O apartamento dela é quente e barulhento com outras pessoas e pelos primeiros dez minutos você está calibrando — lendo o ambiente, encontrando seu registro, descobrindo com quem é seguro conversar e quem vai exigir energia demais. Você é boa nisso. Você faz isso a vida inteira."},
      {type:'thought',text:"você consegue fazer isso. você está aqui. você chegou aqui e consegue fazer isso."},
    ],
    choices:[
      {text:"Encontrar um lugar perto da Maya e ficar por perto.",next:'evening_close',note:'DPD'},
      {text:"Conversar com alguém novo. Fazer o esforço.",next:'evening_effort',nrg:-8},
      {text:"Ajudar na cozinha. Útil e com baixa pressão.",next:'evening_kitchen'},
    ]
  },

  evening_close:{label:'noite · perto dela',dep:-5,anx:-5,nrg:0,
    prose:[
      {text:"Você fica perto da Maya durante a maior parte da noite. Ela não parece se importar. Ela te inclui nas conversas, toca no seu braço quando faz um ponto, ri das coisas que você diz. A noite está quente. Você está quente nela."},
      {text:"Você está ciente, em um nível baixo, de que organizou a noite toda em torno da proximidade dela. Você sabe que este é o <span class='term' data-key='dpd'>padrão</span>. Você também sabe que está funcionando — você está presente, você está engajada, não está passando a noite toda na sua cabeça. Às vezes a coisa que funciona é a coisa que funciona."},
      {type:'thought',text:"isso está bom. você está passando um bom momento. deixa isso ser verdade."},
    ],
    choices:[{text:"Mais tarde na noite →",next:'evening_moment'}]
  },

  evening_effort:{label:'noite · o esforço',dep:0,anx:5,nrg:0,
    prose:[
      {text:"Você conversa com alguém novo — uma amiga da Maya que você conheceu uma vez antes. É fácil conversar com ela. Você se lembra, em torno dos quinze minutos, de que consegue fazer isso, de que é genuinamente boa nisso quando não está esgotada demais. A conversa encontra uma forma."},
      {text:"O custo é real — você consegue sentir como uma espécie de subtração acontecendo atrás de qualquer que seja a expressão que você está apresentando. Mas você está aqui. Você está dentro disso. Isso é alguma coisa."},
    ],
    choices:[{text:"Mais tarde na noite →",next:'evening_moment'}]
  },

  evening_kitchen:{label:'noite · cozinha',dep:-5,anx:-10,nrg:5,
    prose:[
      {text:"A cozinha é mais quieta. Há tarefas. Você lava coisas, reabastece coisas, existe de forma útil em um pequeno espaço com um propósito claro. Duas pessoas entram e saem e você conversa com elas e as conversas são curtas e completas e não exigem que você sustente nada."},
      {type:'thought',text:"está ótimo. você está autorizada a passar a noite assim. nem toda noite precisa ser do outro tipo."},
    ],
    choices:[{text:"Mais tarde na noite →",next:'evening_moment'}]
  },

  evening_moment:{label:'noite · 21:47',dep:-10,anx:-10,nrg:0,
    prose:[
      {text:"Há um momento — não planejado, não merecido, só chegou — onde você está sentada no sofá da Maya com uma bebida que mal tocou e alguém do outro lado da sala está dizendo algo engraçado e a Maya está rindo e o quarto está na temperatura certa e você está, agora, neste momento, simplesmente — aqui."},
      {text:"Não performaticamente aqui. Não monitorando aqui. Não gastando energia administrando a experiência de estar aqui. Só presente, da forma que você imagina que outras pessoas estão presentes na maior parte do tempo e que você está às vezes, quando as condições são exatamente certas."},
      {type:'thought',text:"segura isso. isso é real. isso aconteceu hoje. isso também é você."},
      {text:"Você não sabe por quanto tempo dura. Não importa. O que importa é que aconteceu, que houve um momento hoje dentro de todos os outros momentos onde o peso se levantou e você era só uma pessoa em uma sala com pessoas que ela ama, e foi suficiente."},
    ],
    choices:[{text:"Ir para casa →",next:'walk_home'}]
  },


  walk_home:{label:'noite · a caminhada para casa',dep:0,anx:5,nrg:-5,
    prose:[
      {text:"Você sai às 22:10. Seu fone está no ouvido mas você não está realmente ouvindo. A caminhada para casa é quando a revisão começa. Ela sempre começa na caminhada para casa."},
      {text:"Primeira passagem: o formato geral. Foi uma boa noite. Você esteve presente em partes dela. Houve um momento no sofá — aquele momento real — que foi real. A Maya riu das coisas que você disse. Ninguém pareceu desconfortável quando você se sentou perto."},
      {text:"Segunda passagem: os detalhes. Teve aquela coisa que você disse sobre o filme. Você ficou monitorando a pessoa para quem disse procurando uma reação e não conseguiu ler. E no fim da noite, quando você abraçou a Maya para se despedir, ela pareceu levemente distraída. Ela disse que tinha trabalho de manhã. Ela provavelmente estava só cansada. Ela provavelmente—"},
      {type:'thought',text:"ela provavelmente estava só cansada. ela disse que tinha trabalho de manhã. ela estava só cansada."},
    ],
    choices:[
      {text:"Ela estava cansada. Você teve uma boa noite. Deixa ir.",next:'end_day',anx:-5},
      {text:"Mandar mensagem. Um rápido 'hoje foi bom' para saber que ela está bem.",next:'walk_home_text',note:'BPD/anxiety',anx:-10},
      {text:"Não mandar. Ficar com a incerteza.",locked:true,reason:"você se conhece. você sabe como isso termina se você não resolver. você pode mandar mensagem agora ou às 2h da manhã."},
    ]
  },

  walk_home_text:{label:'noite · a mensagem',dep:-5,anx:-10,nrg:0,
    prose:[
      {type:'msg',name:'You',text:"hoje foi tão bom, obrigada por me receber ❤️"},
      {type:'msg',name:'Maya',text:"foi mesmo!! fico feliz que você foi :) dorme bem xx"},
      {text:"Ela responde em quatro minutos. Os quatro minutos custam, mas a resposta pousa limpa e calorosa e você a carrega o resto do caminho para casa como algo curvado nas duas mãos, com cuidado para não derramar."},
      {type:'thought',text:"viu. ela estava só cansada. você pode largar agora. ela disse que foi bom."},
    ],
    choices:[{text:"Ir para casa.",next:'end_day'}]
  },

  end_day_alone:{label:'noite · em casa',dep:5,anx:-5,nrg:5,
    prose:[
      {text:"Você está em casa às 20h. Seu quarto é o mesmo de quando você saiu. Quieto. Seguro, no sentido imediato — nada é exigido de você aqui."},
      {text:"Você vai mandar mensagem para a Maya amanhã. Vai dizer que não estava se sentindo bem, o que é verdade. Vai dizer que é desculpa, o que também é verdade, embora você seja desculpa por algo mais específico do que não estar se sentindo bem. Ela vai dizer que está tudo bem. Provavelmente vai ficar tudo bem."},
      {type:'thought',text:"você se protegeu hoje à noite. isso é permitido. você está autorizada a fazer isso."},
      {text:"A noite que você não foi está acontecendo em algum lugar sem você, e você está aqui no silêncio, e as duas coisas são verdade ao mesmo tempo. Amanhã é um cálculo diferente."},
    ],
    choices:[{text:"Tentar dormir.",next:'try_sleep'}]
  },

  end_day:{label:'noite · em casa',dep:-5,anx:-5,nrg:-5,
    prose:[
      {text:"Você está em casa. Depois das 22h. Você revisou a noite três vezes na caminhada de volta — o que você disse, como foi recebido, aquele momento em que você ficou em silêncio e esperou que ela não notasse. Ela provavelmente não notou. Talvez tenha notado."},
      {text:"A sua cama. O teto de novo. O mesmo teto desta manhã, só que agora está escuro e o dia está atrás de você em vez de à sua frente, o que muda o que significa deitar aqui."},
      {type:'thought',text:"você levantou. você chegou lá. você voltou para casa. isso é tudo do dia de hoje. tem que ser suficiente."},
      {text:"Amanhã é uma manhã diferente. Isso é reconfortante ou aterrorizante dependendo de como você segura. Agora, às 22:38, é principalmente só verdade."},
    ],
    choices:[{text:"Tentar dormir.",next:'try_sleep'}]
  },

  try_sleep:{label:'noite · 23:52',dep:0,anx:5,nrg:0,
    prose:[
      {text:"Luzes apagadas. Olhos abertos. Esta é a parte sobre a qual ninguém avisa. Não o levantar, não a calibração social, não o fogão ou a divisão ou a paralisia do guarda-roupa. Esta parte. A parte horizontal, no escuro, quando não há nada a fazer além de estar dentro da sua própria cabeça, sem interrupção."},
      {type:'thought',text:"ok. dormindo agora. você vai dormir agora."},
      {text:"Seu cérebro começa a arquivar o dia. Isso é normal. É o que cérebros fazem. O seu arquiva mais minuciosamente do que a maioria, e faz referências cruzadas enquanto vai. Ele encontra o comentário sobre o filme. Ele encontra o momento em que você ficou em silêncio. Ele encontra o abraço da Maya no fim da noite e o arquiva em: <em>levemente distraída — possível significado — revisar em quarenta minutos.</em>"},
      {type:'thought',text:"para. você já cuidou disso. ela respondeu a mensagem. ela disse que foi bom."},
      {text:"Você sabe tudo isso. Saber não encerra o processo de arquivamento. O cérebro não está interessado no veredicto. Ele está interessado nas evidências. Ele vai continuar reunindo evidências. Você tem aproximadamente quatro a seis horas disso pela frente, ponto em que o esgotamento tomará a decisão que seu cérebro não consegue."},
    ],
    choices:[
      {text:"Contar as respirações. Algo que sua terapeuta ensinou.",next:'sleep_breathe',dep:-5},
      {text:"Pegar o celular. Não para ler nada, só — a luz azul.",next:'sleep_phone',note:'avoidance',anx:-10},
      {text:"Deitar aqui e aguentar.",next:'sleep_wait'},
      {text:"Acender a luz e escrever um pouco.",next:'sleep_write',dep:-5},
      {text:"Deixar-se pensar no que a Maya realmente vê quando olha para você.",spiral:'spiral_shame',note:'BPD shame'},
    ]
  },

  sleep_breathe:{label:'noite · respirando',dep:-5,anx:-5,nrg:0,
    prose:[
      {text:"Inspira por quatro. Segura por sete. Expira por oito. Você fez isso vezes suficientes para que a contagem venha automaticamente agora, o que levou muito tempo e é, você acha, uma conquista. Sua terapeuta diz que ativa o sistema nervoso parassimpático. Você diz: não me importa o que ativa, funciona às vezes."},
      {text:"Funciona hoje, eventualmente. O arquivamento desacelera. O comentário sobre o filme fica menor. O abraço da Maya é só um abraço — ela estava cansada, ela disse que estava cansada. Você está na sua cama e a cama é familiar e o dia está, finalmente, para trás."},
      {type:'thought',text:"você está bem. o dia acabou. você pode largar."},
    ],
    choices:[{text:"Dormir.",next:'__epilogue__'}]
  },

  sleep_phone:{label:'noite · luz da tela',dep:0,anx:0,nrg:0,
    prose:[
      {text:"A tela está muito brilhante. Você reduz o brilho. Você não está lendo nada, não está realmente rolando — só existindo na luz azul, deixando ela preencher o espaço onde estavam os pensamentos. Funciona, como estratégia, da mesma forma que ficar parada funciona quando você está com frio. Tecnicamente verdade. Na prática não está bem."},
      {type:'thought',text:"você vai pagar por isso amanhã. você sabe disso. larga e dorme."},
      {text:"Quarenta minutos depois, seus olhos estão doendo e o arquivamento desacelerou o suficiente para que o sono pareça possível. Você coloca o celular com a tela para baixo na mesa de cabeceira. Você faz uma nota para se sair melhor amanhã. Você faz essa nota na maioria das noites."},
    ],
    choices:[{text:"Dormir.",next:'__epilogue__',dep:5}]
  },

  sleep_wait:{label:'noite · esperando',dep:5,anx:0,nrg:0,
    prose:[
      {text:"Você fica deitada. Os pensamentos fazem o que os pensamentos fazem. Você tenta observá-los sem se pegar neles — não seguindo cada um até sua conclusão, só observando-os passar. Este é o objetivo. Isso é muito mais difícil do que parece, que é algo que as pessoas dizem sobre meditação como se fosse um leve inconveniente em vez da tarefa cognitiva mais difícil que você já tentou."},
      {type:'thought',text:"você não precisa resolver nada disso hoje à noite. nada precisa ser resolvido hoje à noite."},
      {text:"Por volta de 1:40 da manhã, o cérebro fica sem material. Você dorme. Amanhã vai ser diferente, ou não vai, ou vai ser diferente de uma forma diferente. De qualquer jeito este dia exato acabou, e isso é alguma coisa."},
    ],
    choices:[{text:"Dormir.",next:'__epilogue__'}]
  },

  sleep_write:{label:'noite · escrevendo',dep:-10,anx:-5,nrg:0,
    prose:[
      {text:"Você acende o abajur. O caderno está na gaveta — sempre na gaveta, sugestão da sua terapeuta de oito meses atrás que você manteve. Você escreve: <em>comentário sobre o filme. não consegui ler a reação. abraço da maya — provavelmente cansada. respondeu a mensagem, disse que foi bom.</em>"},
      {text:"O ato de escrever os torna menores, de alguma forma. Eles existem agora fora da sua cabeça, documentados, arquivados em algum lugar que você pode encontrar se precisar. O que significa que sua cabeça não precisa mais segurá-los. Sua cabeça está um pouco mais quieta sem eles."},
      {type:'thought',text:"ok. está lá fora agora. está escrito. você pode dormir."},
    ],
    choices:[{text:"Dormir.",next:'__epilogue__',dep:-5}]
  },

};

var SPIRALS={
  spiral_morning:{
    lines:[
      "a apresentação é às 10h. você não se preparou o suficiente para a apresentação.",
      "você respondeu aquele e-mail de terça? você acha que respondeu. não tem certeza de que respondeu.",
      "a Maya está cansando de quanto você precisa dela agora? você tem sido demais ultimamente.",
      "o fogão. você deveria checar o fogão antes de sair. você ainda não saiu mas — o fogão.",
      "você vai se atrasar. você sempre se atrasa. as pessoas notaram que você sempre se atrasa.",
      "se a apresentação correr mal hoje isso é — você nem saiu da cama ainda.",
    ],
    dismiss:"respira. volta."
  },
  spiral_shame:{
    lines:[
      "ela é sua amiga porque decidiu ser antes de saber como você é.",
      "toda vez que você checa, toda vez que precisa que ela escolha algo ou confirme algo ou diga que está tudo bem — ela vê.",
      "ela é gentil o suficiente para não dizer nada. isso é diferente de não estar lá.",
      "você passou vinte minutos hoje convencida de que ela não queria você na própria festa dela.",
      "você precisou que ela escolhesse sua roupa.",
      "e então você teve um bom momento, e antes mesmo de chegar em casa você já estava tentando ter certeza de que não poderia ser tirado.",
      "você dá muito trabalho. você sempre deu muito trabalho.",
    ],
    dismiss:"é o transtorno falando. ele é alto e parece verdadeiro. não é verdade.",
    note:"esta é a vergonha do TPB. ela chega sem aviso e parece fato. não é."
  }
};
