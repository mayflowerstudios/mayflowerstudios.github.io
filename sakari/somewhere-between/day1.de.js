/* somewhere between — day1.de.js  (Deutsch) */

var SCENES={

  morning_1:{label:'morgen \xb7 6:47 Uhr',dep:0,anx:0,nrg:0,
    prose:[
      {text:"Dein Wecker hat vor dreiundzwanzig Minuten geklingelt. Du wei\xdft das, weil du die Zeit beobachtet hast, wie sie sich ver\xe4ndert — 6:24, 6:31, 6:38 und jetzt 6:47 — und jede Zahl f\xfchlt sich wie ein Vorwurf an. Die Decke ist wie immer. Das Licht, das durch den Vorhang dringt, hat die Farbe von etwas, \xfcber das du noch nicht nachdenken m\xf6chtest. Dein K\xf6rper hat heute Morgen ein bestimmtes Gewicht — nicht genau M\xfcdigkeit, eher als h\xe4tte die Schwerkraft eine pers\xf6nliche Entscheidung \xfcber dich getroffen."},
      {type:'thought',text:"wenn du lange genug hier bleibst, f\xe4ngt der tag vielleicht ohne dich an. vielleicht geht er einfach — weiter."},
      {text:"So sieht <span class='term' data-key='executive'>Aufstehen</span> von innen aus. Nicht der Akt selbst, sondern die zehn Minuten davor, wenn sich der Akt wie das Erklettern von etwas sehr Hohem ohne Halt anf\xfchlt. Du hast vier Wecker gestellt. Du wusstest, dass das passieren w\xfcrde. Du hast trotzdem vier Wecker gestellt."},
    ],
    choices:[
      {text:"Aufstehen. Die Beine \xfcber die Bettkante schwingen und nicht dar\xfcber nachdenken.",next:'morning_mirror',nrg:-8,dep:-5},
      {text:"Noch f\xfcnf Minuten. Einen weiteren Wecker stellen.",next:'morning_snooze',nrg:-5},
      {text:"Versuchen, alles durchzudenken, was heute zu tun ist — vielleicht motiviert das.",locked:true,reason:"du wei\xdft es besser. du hast es vorher versucht. an die Liste zu denken macht sie nicht kleiner. es l\xe4sst die Decke nur niedriger wirken.",spiral:'spiral_morning'},
    ]
  },

  morning_snooze:{label:'morgen \xb7 7:21 Uhr',dep:5,anx:5,nrg:0,
    prose:[
      {text:"Du hast das noch viermal gemacht. Es ist jetzt 7:21 Uhr. Das Zimmer ist heller als es sein sollte und dein K\xf6rper f\xfchlt sich schwerer an als vor einer Stunde — das ist die falsche Richtung. <span class='term' data-key='anhedonia'>Der Gedanke an den Tag</span> sitzt in deiner Brust wie etwas, das man falsch geschluckt hat."},
      {type:'thought',text:"das ist keine faulheit. du hast genug gelesen, um das zu wissen. es hilft nichts, das zu wissen."},
      {text:"Du k\xf6nntest weiterhin Wecker stellen. Es gibt eine Version dieses Morgens, in der du es noch zweimal machst und irgendwo eine Stunde zu sp\xe4t ankommst und den Rest des Tages damit verbringst, die Folgen zu managen. Du hast diese Version schon gelebt."},
    ],
    choices:[
      {text:"Okay. Diesmal wirklich. Aufstehen.",next:'morning_mirror',nrg:-8,dep:-5},
      {text:"Zuerst das Handy checken. Nur kurz.",next:'phone_check'},
    ]
  },

  morning_mirror:{label:'morgen \xb7 badezimmer',dep:0,anx:5,nrg:0,
    prose:[
      {text:"Du stehst vor dem Badezimmerspiegel. Du bist hierher gekommen, um Z\xe4hne zu putzen. Du hast Z\xe4hne geputzt. Du stehst noch hier. Du stehst jetzt seit acht Minuten hier, was du wei\xdft, weil du dein Handy checked hast, w\xe4hrend du hier standst, und es dann mit dem Display nach unten auf das Waschbecken gelegt hast, damit du aufh\xf6rst."},
      {type:'thought',text:"du siehst aus wie das, was du bist. m\xfcde. du fragst dich, wie viel davon anderen Menschen auff\xe4llt."},
      {text:"Das ist kein <span class='term' data-key='masking'>Eitelkeitsproblem</span>. Es ist eher so, dass die Person im Spiegel \xfcberpr\xfcft werden muss — best\xe4tigt werden muss —, bevor du sicher sein kannst, dass du als sie in die Welt gehen darfst. Manche Morgen dauert das zwei Minuten. Heute dauert es l\xe4nger."},
    ],
    choices:[
      {text:"Du siehst gut aus. H\xf6r auf. Geh.",locked:true,reason:"du wei\xdft, dass du das nicht glaubst. du hast versucht, es laut zu sagen. die W\xf6rter sitzen einfach da."},
      {text:"Das Outfit wechseln. Etwas, das mehr bedeckt.",next:'meds_check'},
      {text:"Maya schreiben. Fragen, ob das Outfit okay ist.",next:'text_maya_outfit',note:'APS'},
      {text:"H\xf6r auf dich anzuschauen und geh einfach.",locked:true,reason:"du versuchst das seit acht Minuten."},
    ]
  },

  text_maya_outfit:{label:'morgen \xb7 warten',dep:0,anx:10,nrg:-4,
    prose:[
      {text:"Du schickst das Foto. <span class='term' data-key='fp'>Maya</span> ist — sie ist die Person, deren Meinung gerade z\xe4hlt. Nicht nur beim Outfit. Bei den meisten Dingen. Du wei\xdft das \xfcber dich. Du wei\xdft, dass es ihr gegen\xfcber nicht fair ist. Du schickst das Foto trotzdem, weil die Alternative ist, weitere zehn Minuten vor dem Spiegel zu stehen."},
      {text:"Der Tipp-Indikator erscheint. Verschwindet. Erscheint wieder. Es sind jetzt vier Minuten vergangen. Sie antwortet normalerweise in unter einer Minute. Vier Minuten bedeuten etwas. Du gehst die M\xf6glichkeiten durch. Sie ist besch\xe4ftigt. Sie ist unter der Dusche. Sie hat die Nachricht gesehen und etwas gedacht, das sie nicht sagen wollte."},
      {type:'thought',text:"stop. du wei\xdft das nicht. aber vier minuten sind eine lange zeit."},
      {text:"Das ist <span class='term' data-key='hypervigilance'>Hypervigilanz</span>. Du kennst das Wort daf\xfcr. Das Wort senkt deinen Puls nicht."},
    ],
    choices:[
      {text:"Sie ist wahrscheinlich nur besch\xe4ftigt. Es ist fr\xfch. Warten.",locked:true,reason:"du wei\xdft, dass das wahrscheinlich stimmt. dein Gehirn hat bereits drei verschiedene Versionen davon geschrieben, was das Schweigen bedeutet, und entscheidet sich gerade dazwischen."},
      {text:"Eine Nachricht hinterherschicken. 'sorry vergiss es lol'",next:'maya_followup',note:'Angst/BPS',anx:5},
      {text:"Das Handy umdrehen und trotzdem fertig machen.",next:'getting_ready',nrg:-8,anx:5},
    ]
  },

  maya_followup:{label:'morgen \xb7 ihre antwort',dep:-5,anx:-10,nrg:0,
    prose:[
      {type:'msg',name:'Maya',text:"omg du siehst so gut aus?? warum fragst du \xfcberhaupt"},
      {text:"Die Erleichterung ist unverh\xe4ltnism\xe4\xdfig zur Frage, das wei\xdft du. Irgendwo im Hinterkopf wei\xdft du, dass die Erleichterung, die du gerade f\xfchlst, nicht ein normales Ma\xdf an Erleichterung \xfcber ein Outfit ist. Aber sie ist real. Deine Schultern fallen herab. Dein Kiefer entspannt sich. Du hast beide Dinge nicht bemerkt, bis sie aufh\xf6rten."},
      {type:'thought',text:"okay. okay, sie ist nicht sauer. halt das fest. lass es noch nicht los."},
      {text:"<span class='term' data-key='reassurance'>Bestätigung</span> funktioniert. Das ist der komplizierte Teil — sie funktioniert wirklich, kurzfristig. Die Angst sinkt. Du f\xfchlst dich besser. Und in zwanzig Minuten beginnt sie wieder zu schleichen, und die vor\xfcbergehende Erleichterung wird dich etwas gekostet haben, das du nicht bemerkt hast auszugeben."},
    ],
    choices:[
      {text:"'haha danke ❤️' antworten und die Erleichterung f\xfchlen.",next:'getting_ready'},
      {text:"Ihr vollst\xe4ndig glauben und loslassen.",locked:true,reason:"die Erleichterung beginnt sich bereits zu d\xfcnnen. was, wenn sie nur nett war, weil sie nett ist? was, wenn sie das Foto gar nicht richtig angeschaut hat?"},
    ]
  },

  phone_check:{label:'morgen \xb7 noch im bett',dep:0,anx:5,nrg:0,
    prose:[
      {type:'msg',name:'Maya \xb7 23:47 Uhr',text:"hey kommst du heute abend? sollte spa\xdf machen :)"},
      {text:"Du liest es dreimal. Beim zweiten Mal bemerkst du, dass sie einen Doppelpunkt-Klammer statt eines echten Emojis genommen hat, was nichts bedeuten kann. Es bedeutet normalerweise nichts. Nur dass sie normalerweise das Herzaugen-Emoji nimmt, und sie hat das um 23:47 Uhr geschickt, was sp\xe4t ist, und der <span class='term' data-key='splitting'>Ton ist anders</span> als wie sie normalerweise schreibt, und du wei\xdft, dass du das machst, du wei\xdft, dass du um 6:53 Uhr morgens Zeichensetzung interpretierst, aber du kannst nicht aufh\xf6ren."},
      {type:'thought',text:"vielleicht will sie nicht wirklich, dass du kommst. vielleicht fragt sie aus h\xf6flichkeit. vielleicht ist etwas passiert und du wei\xdft nicht was."},
      {text:"Das geht nicht um den Doppelpunkt-Klammer. Das wei\xdft du. Es ist nur die Sache, die dein Gehirn aufgegriffen und damit weggelaufen ist. Es brauchte etwas Unsicheres und hat es gefunden."},
    ],
    choices:[
      {text:"'ja! freue mich drauf :)' antworten und aufstehen.",next:'morning_mirror'},
      {text:"Fragen, ob sie okay ist. Sicherstellen, dass sie wirklich will, dass du kommst.",next:'maya_check',note:'BPS',anx:5},
      {text:"Normal antworten. Darauf vertrauen, dass sie es so meint.",locked:true,reason:"deine Brust ist eng und du wei\xdft nicht warum. etwas f\xfchlt sich falsch an und dein Gehirn l\xe4sst dich nicht so tun, als w\xe4re es das nicht, bis du best\xe4tigt hast, dass es das nicht ist."},
      {text:"Ihr schreiben, dass du dich nicht gut f\xfchlst. Du kannst sp\xe4ter entscheiden.",next:'skip_offer',note:'Vermeidung',dep:5},
    ]
  },

  maya_check:{label:'morgen \xb7 nachfragen',dep:0,anx:-5,nrg:0,
    prose:[
      {type:'msg',name:'Maya',text:"nat\xfcrlich!! warum nicht ❤️❤️❤️"},
      {text:"Sie ist gut drauf. Sie war immer gut drauf. Der Doppelpunkt-Klammer war nur ein Doppelpunkt-Klammer. Du wusstest das wahrscheinlich, und trotzdem tut die Best\xe4tigung etwas mit deinem K\xf6rper, das blo\xdfes <em>Wissen</em> nicht tut — es gibt eine k\xf6rperliche Lockerung, die nur geschieht, wenn jemand anderes die Worte laut sagt."},
      {type:'thought',text:"okay. sie ist okay. du bist okay. warum tust du ihr das immer an. sie muss so m\xfcde sein von deinem—"},
      {text:"Das ist <span class='term' data-key='abandonment'>die Schleife</span>. Du fragst. Sie best\xe4tigt. Die Best\xe4tigung funktioniert. Du f\xfchlst dich schlecht, weil du sie gebraucht hast. Das schlechte Gef\xfchl bringt die Angst zur\xfcck. Das bedeutet, du wirst wahrscheinlich sp\xe4ter wieder nachfragen."},
    ],
    choices:[
      {text:"'okay sorry haha' antworten und aufstehen.",next:'morning_mirror'},
      {text:"Dich vollst\xe4ndig beruhigt f\xfchlen.",locked:true,reason:"die Entschuldigung, die du gerade geschickt hast — was, wenn das zu viel war? was, wenn sie wegen heute abend okay ist, aber jetzt genervt wegen der Entschuldigung?"},
    ]
  },

  skip_offer:{label:'morgen \xb7 der ausweg',dep:5,anx:0,nrg:0,
    prose:[
      {type:'msg',name:'Maya',text:"neinnein du musst kommen :( ich hol dich buchst\xe4blich ab, wenn ich muss"},
      {text:"Sie meint es ernst. Das 'buchst\xe4blich', das traurige Gesicht — sie meint es ernst. Was du in Frage stellst, ist, ob du die Person sein m\xf6chtest, die sie abholen muss. Ob <span class='term' data-key='dpd'>'ich hol dich ab'</span> Liebe oder Pflicht ist, und ob die Unterscheidung eine Rolle spielt, wenn du diejenige bist, die getragen wird."},
      {type:'thought',text:"sie hat gesagt, sie will dich dabei haben. das reicht. das muss reichen."},
    ],
    choices:[
      {text:"Ihr sagen, du versuchst es. Das ist eine ehrliche Antwort.",next:'morning_mirror'},
      {text:"Okay sagen. Weil sie gefragt hat. Nicht weil du dich entschieden hast.",next:'morning_mirror',note:'APS'},
    ]
  },

  meds_check:{label:'morgen \xb7 das badregal',dep:0,anx:0,nrg:0,
    prose:[
      {text:"Deine Medikamente stehen auf dem Regal hinter dir. Du kannst sie im Spiegel sehen — die kleinen orangefarbenen Flaschen, die seit acht Monaten dort stehen. Du denkst die meisten Tage nicht dar\xfcber nach, was deine Therapeutin als gutes Zeichen bezeichnet. Heute schaust du sie an und denkst: <em>wirkt das hier</em>. Du hast diesen Gedanken etwa einmal alle zwei Wochen. Er f\xfchrt nie irgendwohin N\xfctzliches."},
      {type:'thought',text:"einfach nehmen. es sind vier sekunden. das hast du 168 mal gemacht."},
      {text:"Manche Tage bist du \xfcberzeugt, dass sie wirken, und hast Angst davor, was du ohne sie w\xe4rst. Manche Tage bist du \xfcberzeugt, dass sie nicht wirken, und du bist einfach so — mit oder ohne die Tabletten. Heute wei\xdft du es nicht. Du stehst dort und wei\xdft es nicht und die vier Sekunden vergehen und die Frage bleibt offen."},
    ],
    choices:[
      {text:"Sie nehmen. Vier Sekunden, fertig.",next:'getting_ready',dep:-5},
      {text:"Du bist schon sp\xe4t dran. Heute Abend nehmen.",next:'getting_ready',dep:5,note:'Risiko'},
      {text:"H\xf6r auf, dar\xfcber nachzudenken, ob sie wirken, und nimm sie einfach.",locked:true,reason:"du wei\xdft, dass das der richtige Gedanke ist. du kannst nicht aufh\xf6ren, zuerst den anderen zu haben."},
    ]
  },

  getting_ready:{label:'morgen \xb7 die t\xfcr',dep:0,anx:10,nrg:-4,
    prose:[
      {text:"Du bist fertig. Du stehst an der Haust\xfcr mit deinen Schl\xfcsseln. Die T\xfcr ist direkt dort. Du musst in vier Minuten gehen, um p\xfcnktlich anzukommen."},
      {type:'thought',text:"ist der herd aus. du hast ihn gecheckt. du hast ihn zweimal gecheckt. hast du ihn wirklich gecheckt oder hast du nur in seiner N\xe4he gestanden? da ist ein unterschied."},
      {text:"Du hast den Herd \xfcberpr\xfcft. Du wei\xdft, dass du ihn \xfcberpr\xfcft hast. Das Problem mit <span class='term' data-key='intrusive'>aufdringlichen Zweifeln</span> ist, dass 'etwas zu wissen' und 'in der Lage zu sein, so zu handeln, als ob man es wei\xdf' nicht dieselben kognitiven Schritte sind. Der Herd ist aus. Vielleicht musst du zur\xfckkehren und das best\xe4tigen, bevor dein K\xf6rper es glaubt."},
    ],
    choices:[
      {text:"Zur\xfcckkehren und den Herd noch einmal \xfcberpr\xfcfen.",next:'check_stove',nrg:-5,anx:-10},
      {text:"Du hast ihn \xfcberpr\xfcft. Du kannst gehen.",locked:true,reason:"du wei\xdft, dass du das gemacht hast. deine H\xe4nde erinnern sich daran. dein Gehirn interessiert nicht, was deine H\xe4nde erinnern."},
      {text:"Maya schreiben 'gehe jetzt los' — damit jemand es wei\xdf.",next:'commute',note:'APS'},
      {text:"Gehen. Einfach gehen.",next:'commute',nrg:-8},
    ]
  },

  check_stove:{label:'morgen \xb7 k\xfcche nochmal',dep:0,anx:-5,nrg:0,
    prose:[
      {text:"Aus. Alle aus. Nat\xfcrlich. Das wusstest du. Du \xfcberpr\xfcfst das Schloss an der Haust\xfcr — Klinke, Riegel, Klinke nochmal — und gehst."},
      {type:'thought',text:"so sind eben morgen. du musst nur dort hinkommen. sobald du dort bist, ist es leichter."},
    ],
    choices:[{text:"Gehen. Du wirst neun Minuten zu sp\xe4t sein.",next:'commute',nrg:-5}]
  },

  commute:{label:'morgen \xb7 drau\xdfen',dep:0,anx:10,nrg:-5,
    prose:[
      {text:"Die Luft ist kalt. Du hast vergessen, wie kalt es morgens ist. Du wirst acht Minuten zu sp\xe4t sein, was nicht viel ist, was du wei\xdft, dass es nicht viel ist — aber du wirst durch einen Raum voller Menschen laufen m\xfcssen, die bemerken werden, dass die T\xfcr sich \xf6ffnet, und aufschauen und dich zu sp\xe4t hereinkommen sehen werden. Und du wirst jeden dieser Blicke einzeln sp\xfcren und sie den ganzen Rest des Morgens mit dir tragen."},
      {type:'thought',text:"sie werden denken, du bist unzuverl\xe4ssig. sie denken das schon eine weile. du gibst ihnen gr\xfcnde."},
      {text:"Es gibt etwas, das in deiner Brust passiert, wenn du zu sp\xe4t bist — ein Zusammenziehen um das Brustbein, das nicht ganz Schmerz ist, aber die Qualit\xe4ten des Schmerzes hat, seine Hartn\xe4ckigkeit. <span class='term' data-key='emotional_intensity'>Die Gleichung davon</span> — zu sp\xe4t, angeschaut, beurteilt — verarbeitet dein Nervensystem als etwas viel Gr\xf6\xdferes, als es ist. Das wei\xdft du. Du l\xe4ufst schneller als n\xf6tig."},
    ],
    choices:[
      {text:"Acht Minuten sind nichts. Das passiert jedem.",locked:true,reason:"es passiert tats\xe4chlich jedem. du bist gerade nicht jeder. dein Puls ist erh\xf6ht, seit du das Haus verlassen hast."},
      {text:"Maya schreiben 'komme zu sp\xe4t, sag mir, dass das okay ist'",next:'arrive',note:'APS',anx:-10},
      {text:"Koph\xf6rer rein. Nicht daran denken, bis du dort bist.",next:'arrive',nrg:-5},
    ]
  },

  arrive:{label:'morgen \xb7 ankunft',dep:-5,anx:-5,nrg:0,
    prose:[
      {text:"Du schaffst es. Neun Minuten zu sp\xe4t. Niemand schaut auf. Du setzt dich. Du \xf6ffnest deinen Laptop. Der Morgen k\xfcmmert sich nicht darum, dass er dich neunzig Minuten mentaler Energie gekostet hat, um hierher zu kommen. Er macht einfach weiter."},
      {type:'thought',text:"nat\xfcrlich hat niemand aufgeschaut. das wei\xdft du immer und es hilft nie."},
      {text:"Das ist der unsichtbare Teil — der Teil, der nicht zeigt, wie du aussiehst oder wie du arbeitest. All diese Arbeit, nur um anzukommen. Der Tag hat noch nicht richtig begonnen, und du hast bereits etwas Bedeutendes ausgegeben."},
    ],
    choices:[{text:"Weiter zum Mittag \u2192",next:'midday_1'}]
  },

  midday_1:{label:'mittag \xb7 bei der arbeit',dep:5,anx:5,nrg:-10,
    prose:[
      {text:"Es sind drei Stunden vergangen. Irgendwo im Raum lachen zwei Menschen \xfcber etwas — kurz, fl\xfcchtig, ein echtes Lachen. Du warst nicht dabei. Du wei\xdft nicht, warum dein Magen so sinkt, wenn das passiert."},
      {type:'thought',text:"wor\xfcber haben sie gelacht. war es etwas, was du vorhin gesagt hast. du hast etwas \xfcber das Johnson-Briefing gesagt, du hast gesagt, es w\xe4re 'eine menge', war das—"},
      {text:"Das ist <span class='term' data-key='hypervigilance'>Hypervigilanz</span> im sozialen Raum. Dein Nervensystem hat Bedrohungserkennungsressourcen einem Lachen zugewiesen, bei dem du nicht dabei warst, und muss jetzt die Frage l\xf6sen, bevor es sich entspannen kann. Die Antwort ist fast sicher nein. 'Fast sicher' ist nicht 'definitiv'."},
    ],
    choices:[
      {text:"Es ist nichts. Zur\xfcck auf den Bildschirm schauen.",locked:true,reason:"du hast dir das in den letzten drei\xdfig Sekunden dreimal gesagt. dein Gehirn ist mit der Frage noch nicht fertig."},
      {text:"Einen kleinen Kommentar machen. Die Stimmung testen.",next:'midday_check',note:'BPS/Angst',anx:-10},
      {text:"Koph\xf6rer rein.",next:'midday_flat',dep:5},
    ]
  },

  midday_check:{label:'mittag \xb7 nachfragen',dep:0,anx:-5,nrg:-5,
    prose:[
      {text:"Du sagst etwas Kleines und beide lachen und einer sagt <em>\"oh absolut\"</em> und wendet sich wieder seinem Bildschirm zu. Sie haben \xfcber etwas in einer Serie geredet. Es hatte nichts mit dir zu tun."},
      {type:'thought',text:"siehst du. okay. nichts. aber jetzt bist du ver\xe4rgert \xfcber dich selbst, weil du nachfragen musstest. was bedeutet, dass du eigentlich immer noch nicht okay bist. du hast nur die unmittelbare Bedrohungsstufe best\xe4tigt."},
    ],
    choices:[{text:"Zur\xfcck zur Arbeit.",next:'midday_flat'}]
  },

  midday_flat:{label:'mittag \xb7 mittagspause',dep:5,anx:0,nrg:-10,
    prose:[
      {text:"Mittagspause. Vierzig Minuten. Die anderen gehen irgendwo die Stra\xdfe runter. Niemand hat gefragt, ob du mitkommst, was bedeuten k\xf6nnte, dass sie davon ausgegangen sind, du w\xfcrdest Nein sagen, was bedeuten k\xf6nnte—"},
      {type:'thought',text:"stop. iss etwas. du hast noch nichts gegessen. das macht alles schlimmer."},
      {text:"Du isst an deinem Schreibtisch. Du isst, ohne etwas zu schmecken. Das ist die <span class='term' data-key='anhedonia'>Flachheit</span> — nicht genau Traurigkeit, nichts Dramatisches genug, um das Gewicht davon zu rechtfertigen. Nur eine Abwesenheit. Essen hat eine Textur. Du bemerkst die Textur. Das ist alles, was es heute hat."},
      {text:"Irgendwo zwischen dem Sandwich und dem Nachmittag merkst du, dass du elf Minuten lang auf dieselbe Zeile einer E-Mail gestarrt hast. Du bist nirgendwo hingegangen. Du warst nur — nicht hier. <span class='term' data-key='dissociation'>Nirgendwo im Besonderen.</span>"},
      {type:'thought',text:"du bist hier. du bist an deinem Schreibtisch. es ist 13:14 Uhr. das ist, wo du bist."},
    ],
    choices:[
      {text:"Um 14 Uhr ist ein Teammeeting. Etwas zum Sagen vorbereiten.",locked:true,reason:"du kannst den Teil von dir nicht finden, der wissen w\xfcrde, was zu sagen ist. du wirst gehen und zuh\xf6ren und nicken und das muss genug sein.",egGate:20},
      {text:"Um 14 Uhr ist ein Teammeeting. Du wirst hingehen und es \xfcberstehen.",next:'midday_meeting'},
      {text:"Auf die E-Mail antworten, die du angeglotz hast.",next:'midday_meeting',nrg:-5},
    ]
  },

  midday_meeting:{label:'mittag \xb7 14:00 Uhr',dep:0,anx:10,nrg:-8,
    prose:[
      {text:"Das Meeting. Du bist im Meeting. Jemand spricht \xfcber die Quartalszahlen. Du spielst die K\xf6rperhaltung von jemandem, der mit den Quartalszahlen besch\xe4ftigt ist. Dein Gesicht macht die Sache, die dein Gesicht in Meetings macht. Du machst das lange genug, dass die Darstellung keine gro\xdfe bewusste Anstrengung mehr braucht, was sowohl eine F\xe4higkeit als auch ein Kostenpunkt ist."},
      {text:"Dein Vorgesetzter fragt, ob du etwas hinzuzuf\xfcgen hast. Alle schauen dich an. Du hast ungef\xe4hr drei Sekunden, bevor die Pause bemerkenswert wird."},
      {type:'thought',text:"sag etwas. irgendetwas. du wei\xdft genug \xfcber die quartalszahlen, um etwas zu sagen."},
    ],
    choices:[
      {text:"Etwas Kurzes und Sinnvolles \xfcber Q3 sagen.",next:'meeting_speaks',nrg:-6},
      {text:"'Nichts von mir dazu, klingt gut' sagen",next:'meeting_silent',note:'Masking'},
      {text:"Wirklich mitmachen. Die Prognosen in Frage stellen, die du f\xfcr falsch h\xe4ltst.",locked:true,reason:"du hast den Gedanken. du kannst ihn gerade nicht von deinem Kopf in deinen Mund bringen. der raum ist zu laut in deinem kopf."},
    ]
  },

  meeting_speaks:{label:'mittag \xb7 nach dem meeting',dep:-5,anx:-5,nrg:0,
    prose:[
      {text:"Du sagst die Sache. Es ist okay. Es ist sogar leicht gut — jemand schreibt es auf. Dein Vorgesetzter nickt. Das Meeting geht weiter. Nichts Schlimmes ist passiert."},
      {type:'thought',text:"okay. du hast das gemacht. du hast die sache gesagt und es war okay. du kannst das."},
      {text:"Die Erleichterung h\xe4lt ungef\xe4hr vier Minuten an. Dann beginnt dein Gehirn, das Gesagte auf Fehler zu \xfcberpr\xfcfen. Es wird damit den ganzen Nachmittag fortfahren."},
    ],
    choices:[{text:"Weiter zum sp\xe4ten Nachmittag \u2192",next:'split_setup'}]
  },

  meeting_silent:{label:'mittag \xb7 nach dem meeting',dep:5,anx:0,nrg:0,
    prose:[
      {text:"'Nichts zu erg\xe4nzen.' Dein Vorgesetzter nickt und geht weiter. Das Meeting endet. Du bist f\xfcnfzig Minuten in diesem Raum gewesen und hast keine Spur von dir darin hinterlassen. Was manchmal genau das ist, was du brauchst, und was sich heute wie ein kleines Verschwinden anf\xfchlt."},
      {type:'thought',text:"du warst dabei. das z\xe4hlt. dabei zu sein z\xe4hlt."},
    ],
    choices:[{text:"Weiter zum sp\xe4ten Nachmittag \u2192",next:'split_setup'}]
  },

  split_setup:{label:'sp\xe4ter nachmittag \xb7 16:38 Uhr',dep:0,anx:5,nrg:-5,
    prose:[
      {text:"Du schlie\xdfst etwas ab, als Mayas Name auf deinem Handy erscheint. Du bemerkst, wie dein K\xf6rper reagiert, wenn ihr Name erscheint — ein kleines unwillk\xfcrliches Hochgef\xfchl, eine Helligkeit. So f\xfchlt es sich an, eine <span class='term' data-key='fp'>Lieblingsperson</span> zu haben, an einem guten Tag. Ihr Name erscheint und der Raum wird etwas weniger grau."},
      {type:'msg',name:'Maya \xb7 16:38 Uhr',text:"hey kurze frage - kommst du heute abend noch oder nicht"},
      {text:"Du liest es zweimal. Beim ersten Mal registrierst du die W\xf6rter. Beim zweiten Mal registrierst du 'oder nicht'."},
      {type:'thought',text:"oder nicht. sie hat 'oder nicht' geschrieben. sie hat diese zwei w\xf6rter getippt und abgeschickt. sie h\xe4tte sagen k\xf6nnen 'gib bescheid!' sie h\xe4tte sagen k\xf6nnen 'hoffe so :)'. sie hat 'oder nicht' geschrieben."},
    ],
    choices:[
      {text:"Sie hat 'oder nicht' geschrieben, weil es eine Frage ist, keine Einladung zum Absagen. Normal antworten.",locked:true,reason:"du wei\xdft das. du versuchst das festzuhalten. dein Gehirn hat entschieden, dass 'oder nicht' Daten sind, und es ist noch nicht fertig damit, die Daten zu verarbeiten."},
      {text:"Es nochmal lesen und sehen, ob sich die Bedeutung \xe4ndert.",next:'split_happening',anx:10},
    ]
  },

  split_happening:{label:'sp\xe4ter nachmittag \xb7 das splitting',dep:0,anx:15,nrg:-10,isSplit:true,
    prose:[
      {text:"Du liest es nochmal. Es hilft nicht. Etwas passiert in deinem K\xf6rper, wenn der Wechsel eintritt — ein R\xfcckzug, ein Zusammenziehen nach innen, wie ein k\xf6rperliches Anspannen. Etwas hat sich in der Qualit\xe4t der Nachricht ver\xe4ndert — nicht die W\xf6rter, die W\xf6rter sind dieselben, aber die W\xe4rme ist aus ihnen gewichen. <span class='term' data-key='splitting'>So f\xfchlt sich Splitting an</span>: keine Entscheidung, kein Gedanke, aus dem man sich herausargumentieren kann. Eher wie ein sich ver\xe4nderndes Licht. Maya, die heute Morgen das Herzaugen-Emoji geschickt hat, und die Person, die um 16:38 Uhr 'oder nicht' geschickt hat, sind in diesem Moment zwei verschiedene Menschen."},
      {type:'msg',name:'Maya',cold:true,text:"hey kurze frage - kommst du heute abend noch oder nicht"},
      {text:"Die kalte Version von ihr ist auf eine Art vertrauter. Die kalte Version von ihr ist diejenige, auf die du gewartet hast. Die warme Version war geliehene Zeit; das hier ist das, was du wusstest, dass kommen w\xfcrde. Du wei\xdft — der Teil von dir, der noch auf Wissen zugreifen kann — dass das nicht real ist. Dass Maya sich nicht ver\xe4ndert hat. Dass <span class='term' data-key='object_constancy'>die warme Version von ihr noch existiert</span>. Du kannst das gerade nicht f\xfchlen. Es zu wissen und es zu f\xfchlen sind verschiedene L\xe4nder."},
      {type:'thought',text:"sie will, dass du nein sagst. sie gibt dir eine m\xf6glichkeit rauszukommen, weil sie will, dass du sie nutzt. sie hat dich wochenlang h\xf6flich toleriert und das ist die nachricht, in der sie aufh\xf6rt."},
    ],
    choices:[
      {text:"Die normale Nachricht schicken. Ihr nicht zeigen, was passiert.",next:'split_reply_normal',wanted:"ich habe angst, etwas falsch gemacht zu haben, und wei\xdf nicht was. bist du okay mit mir? sind wir okay?"},
      {text:"Sie direkt fragen, ob sie wirklich will, dass du kommst.",next:'split_reply_check',note:'BPS',anx:5},
      {text:"Ihr sagen, du kommst nicht.",next:'split_withdraw',dep:10},
    ]
  },

  split_reply_normal:{label:'sp\xe4ter nachmittag \xb7 danach',dep:0,anx:-5,nrg:0,
    prose:[
      {type:'msg',name:'Maya',text:"yay!! ok bis um 20 Uhr ❤️"},
      {text:"Sie schickt das Herz. Das Herz ist warm. Das Herz geht einigerma\xdfen dazu \xfcber, 'oder nicht' wie das zu f\xfchlen, was es war, was ein l\xe4ssiger Ausdruck war, was nichts war. Dein Nervensystem glaubt das noch nicht vollst\xe4ndig. Aber es nimmt die Beweise an."},
      {type:'thought',text:"siehst du. sie ist okay. sie war immer okay. das hast du gewusst. du hast zwanzig minuten lang nicht gewusst und wei\xdft es jetzt wieder."},
      {text:"So f\xfchlt es sich an, <span class='term' data-key='object_constancy'>aus einem Splitting zur\xfcckzukehren</span> — kein Schnappzur\xfcck, sondern ein langsames Wiedererw\xe4rmen, Beweise, die eine Nachricht nach der anderen ankommen, die W\xe4rme kehrt ungleichm\xe4\xdfig zur\xfcck. Du wirst heute Abend ein bisschen unsicher um sie herum sein. Du wirst ihre Gesichtsz\xfcge mehr beobachten, als du solltest. Aber das Schlimmste ist vor\xfcber."},
    ],
    choices:[{text:"Fertig machen \u2192",next:'dpd_decision'}]
  },

  split_reply_check:{label:'sp\xe4ter nachmittag \xb7 nachfragen',dep:0,anx:0,nrg:0,
    prose:[
      {type:'msg',name:'Du',text:"haha random q - du willst, dass ich wirklich komme, oder? du fragst nicht nur so aus h\xf6flichkeit"},
      {type:'msg',name:'Maya',text:"??? ja nat\xfcrlich?? warum sollte ich nicht wollen, dass du kommst"},
      {type:'msg',name:'Maya',text:"warte bist du okay"},
      {text:"Drei Nachrichten. Die letzte — 'bist du okay' — landet irgendwo Kompliziertes. Sie hat es bemerkt. Sie hat es bemerkt und gefragt. Der Teil von dir, der sicher war, dass sie sich zur\xfcckzieht, hat darauf keine Antwort. Die Gewissheit zieht sich jetzt zur\xfcck, leise, so wie sie es immer tut, wenn sie von der Realit\xe4t widerlegt wird. Sie entschuldigt sich nicht, wenn sie geht. Sie geht einfach."},
      {type:'thought',text:"sie hat gefragt, ob du okay bist. sie hat gefragt. die kalte version von ihr w\xfcrde nicht fragen."},
    ],
    choices:[
      {text:"Ihr sagen, du bist okay, bist nur komisch, bis um 20 Uhr.",next:'split_reply_normal'},
      {text:"Ihr ehrlich sagen: du hattest einen Moment, du bist jetzt okay.",next:'split_honest_reply'},
    ]
  },

  split_honest_reply:{label:'sp\xe4ter nachmittag \xb7 ehrlichkeit',dep:-5,anx:-5,nrg:0,
    prose:[
      {type:'msg',name:'Du',text:"ich hatte f\xfcnf komische minuten, wo ich mich \xfcberzeugt hatte, dass du nicht willst, dass ich komme. ich bin jetzt okay. sorry"},
      {type:'msg',name:'Maya',text:"omg nein entschuldige dich nicht. ich hasse, dass du das durchgemacht hast. ich h\xe4tte es anders formulieren sollen"},
      {type:'msg',name:'Maya',text:"ich will dich immer dabei haben. das ist einfach so okay"},
      {type:'thought',text:"sie hat gesagt 'das ist einfach so'. halte das fest. sie hat gesagt, es ist selbstverst\xe4ndlich."},
      {text:"Du sitzt einen Moment lang damit. Sie hat es nicht seltsam gemacht. Sie ist nicht m\xfcde von dir geworden, weil du es gebraucht hast. Sie hat einfach — geantwortet. Das ist es, was sichere Menschen tun. Das wei\xdft du. Manchmal \xfcberrascht es dich trotzdem."},
    ],
    choices:[{text:"Fertig machen \u2192",next:'dpd_decision'}]
  },

  split_withdraw:{label:'sp\xe4ter nachmittag \xb7 r\xfcckzug',dep:10,anx:-10,nrg:5,
    prose:[
      {type:'msg',name:'Du',text:"ich f\xfchle mich eigentlich nicht gut, glaube ich lasse es heute abend sein, sorry"},
      {type:'msg',name:'Maya',text:"oh nein :( alles okay? brauchst du irgendwas?"},
      {text:"Sie fragt, ob du etwas brauchst. Die Frage hat die Form von F\xfcrsorge. Du kannst gerade nicht sagen, ob es F\xfcrsorge ist oder die Darstellung von F\xfcrsorge, die sie jedem gegen\xfcber zeigen w\xfcrde, der bei ihr absagen w\xfcrde. Du wei\xdft intellektuell, dass Maya nicht spielt. Du kannst das gerade nicht f\xfchlen."},
      {type:'thought',text:"du hast das richtige getan. du warst zu nah am rand. du kannst es sp\xe4ter erkl\xe4ren."},
      {text:"Die Erleichterung des Absagens ist real und unmittelbar und beginnt bereits an den R\xe4ndern zu s\xe4uern. <span class='term' data-key='abandonment'>Bis morgen</span> wirst du dich davon \xfcberzeugt haben, dass das der Beginn ihres R\xfcckzugs war. Aber heute Abend hast du dein Zimmer und die Ruhe, und das wird reichen m\xfcssen."},
    ],
    choices:[{text:"Nach Hause gehen \u2192",next:'end_day_alone'}]
  },

  dpd_decision:{label:'sp\xe4ter nachmittag \xb7 fertig machen',dep:0,anx:5,nrg:-5,
    prose:[
      {text:"Du stehst vor deinem Kleiderschrank. Du stehst jetzt seit zw\xf6lf Minuten hier. Das ist nicht das Spiegel-Ding — du schaust dich nicht an. Du schaust dir die Optionen an. Es sind vierzehn Kleidungsst\xfccke sichtbar. Du kannst keines ausw\xe4hlen. Das ist keine Unentschlossenheit, so wie Menschen es normalerweise meinen. Das ist etwas Strukturelleres als das — eine <span class='term' data-key='dpd'>echte Abwesenheit von Pr\xe4ferenz</span>, oder vielmehr Pr\xe4ferenz, die irgendwo existiert, aber nicht ohne jemanden, der sie \xfcber die Oberfl\xe4che bringt, auftauchen kann."},
      {type:'thought',text:"es ist egal, was du anziehst. es ist wichtig, was du anziehst. du brauchst jemanden, der dir sagt, dass es egal ist, was du anziehst."},
      {text:"Du warst schon einmal hier. Die Entscheidung ist einfach — es ist ein entspannter Abend, Jeans und irgendetwas sind in Ordnung. Das wei\xdft du. Das Wissen hilft nicht. Was du brauchst, ist, dass jemand sagt: <em>das da</em>. Und dann k\xf6nntest du dich bewegen."},
    ],
    choices:[
      {text:"Etwas aussuchen. Irgendetwas. Das hast du schon einmal gemacht.",locked:true,reason:"du wei\xdft, dass du das hast. du versuchst, auf diese F\xe4higkeit zuzugreifen, und sie ist gerade nicht verf\xfcgbar."},
      {text:"Maya ein Foto von zwei Optionen schicken. Sie bitten zu w\xe4hlen.",next:'dpd_resolved',note:'APS',anx:-10},
      {text:"Deine Mutter anrufen. Ihr sagen, du brauchst sie f\xfcr eine kleine Entscheidung.",next:'dpd_resolved_mum',note:'APS'},
      {text:"Hier stehen bleiben, bis dein K\xf6rper irgendwie selbst w\xe4hlt.",next:'dpd_stall',nrg:-10},
    ]
  },

  dpd_resolved:{label:'sp\xe4ter nachmittag \xb7 gel\xf6st',dep:0,anx:-10,nrg:5,
    prose:[
      {type:'msg',name:'Maya',text:"das schwarze nat\xfcrlich!! warum besitzt du das andere \xfcberhaupt"},
      {text:"Das Schwarze. Du ziehst das Schwarze an. Es dauert vier Sekunden. Dein K\xf6rper bewegt sich ohne die zw\xf6lf Minuten Reibung, die er vorher hatte, weil jemand anderes die Entscheidung absorbiert und sie dir als Antwort zur\xfcckgegeben hat, und Antworten sind Dinge, auf die du reagieren kannst. So f\xfchlt sich <span class='term' data-key='dpd'>die Abh\xe4ngigkeit von innen an</span> — keine Schw\xe4che, keine Wahl, sondern die Erfahrung einer T\xfcr, die sich nur von einer Seite \xf6ffnet."},
      {type:'thought',text:"du gehst. du machst dich fertig. das ist alles, was das ist. einfach weiterbewegen."},
    ],
    choices:[{text:"Zu Maya fahren \u2192",next:'evening_arrival'}]
  },

  dpd_resolved_mum:{label:'sp\xe4ter nachmittag \xb7 der anruf',dep:-5,anx:-5,nrg:0,
    prose:[
      {text:"Deine Mutter geht beim zweiten Klingeln ran. Du erkl\xe4rst ihr, dass du nicht entscheiden kannst, was du anziehen sollst, und sie bitten musst zu w\xe4hlen. Sie fragt nicht warum. Sie bittet dich, die Optionen zu beschreiben. Sie w\xe4hlt das Blaue ohne zu z\xf6gern. Du ziehst das Blaue an."},
      {type:'thought',text:"sie hat einfach — gew\xe4hlt. sie hat kein gro\xdfes ding draus gemacht. sie hat einfach gew\xe4hlt."},
      {text:"Es gibt Menschen, die von diesem Anruf frustriert w\xe4ren. Deine Mutter ist keiner von ihnen. Das liegt entweder daran, dass sie versteht, oder daran, dass sie gelernt hat. So oder so hat sie das Blaue gew\xe4hlt, und du bewegst dich jetzt, und die zw\xf6lf gefrorenen Minuten liegen hinter dir."},
    ],
    choices:[{text:"Zu Maya fahren \u2192",next:'evening_arrival'}]
  },

  dpd_stall:{label:'sp\xe4ter nachmittag \xb7 stocken',dep:5,anx:5,nrg:0,
    prose:[
      {text:"Du stehst dort, bis das Stehen unertr\xe4glich wird, und dann greifst du nach dem N\xe4chsten und ziehst es an. Es ist in Ordnung. Es war immer in Ordnung. Du hast zweiundzwanzig Minuten daf\xfcr aufgewendet. Du wirst zu sp\xe4t sein."},
      {type:'thought',text:"es ist okay. es ist ein oberteil. es ist okay. du gehst."},
    ],
    choices:[{text:"Gehen. Du bist sp\xe4t.",next:'evening_arrival',nrg:-5}]
  },

  evening_arrival:{label:'abend \xb7 bei maya',dep:0,anx:5,nrg:-5,
    prose:[
      {text:"Du kommst an. Maya \xf6ffnet die T\xfcr und sie sieht aus wie sie selbst — wie die warme Version von ihr, die die echte Version ist, die einzige Version, die je real war — und der letzte Rest des Splittings l\xf6st sich in ungef\xe4hr vier Sekunden auf."},
      {text:"Ihre Wohnung ist warm und laut mit anderen Menschen, und in den ersten zehn Minuten kalibrierst du dich — den Raum lesen, deinen Ton finden, herausfinden, mit wem zu reden sicher ist und wer zu viel Energie ben\xf6tigen wird. Du bist gut darin. Du machst das dein ganzes Leben lang."},
      {type:'thought',text:"du schaffst das. du bist hier. du hast es hierher geschafft und du schaffst das."},
    ],
    choices:[
      {text:"Einen Platz in Mayas N\xe4he finden und dort bleiben.",next:'evening_close',note:'APS'},
      {text:"Mit jemandem Neuen reden. Die M\xfche aufwenden.",next:'evening_effort',nrg:-8},
      {text:"In der K\xfcche helfen. N\xfctzlich und wenig anstrengend.",next:'evening_kitchen'},
    ]
  },

  evening_close:{label:'abend \xb7 nah bei ihr',dep:-5,anx:-5,nrg:0,
    prose:[
      {text:"Du bleibst den gr\xf6\xdften Teil des Abends in Mayas N\xe4he. Sie scheint es nicht zu st\xf6ren. Sie bezieht dich in Gespr\xe4che ein, ber\xfchrt deinen Arm, wenn sie einen Punkt macht, lacht \xfcber Dinge, die du sagst. Der Abend ist warm. Du bist warm darin."},
      {text:"Du bist dir auf einem niedrigen Niveau bewusst, dass du die ganze Nacht um ihre N\xe4he herum organisiert hast. Du bist dir bewusst, dass das das <span class='term' data-key='dpd'>Muster</span> ist. Du bist dir auch bewusst, dass es funktioniert — du bist pr\xe4sent, du bist dabei, du verbringst nicht die ganze Nacht in deinem Kopf. Manchmal ist das, was funktioniert, das, was funktioniert."},
      {type:'thought',text:"das ist sch\xf6n. du hast eine sch\xf6ne zeit. lass das wahr sein."},
    ],
    choices:[{text:"Sp\xe4ter am abend \u2192",next:'evening_moment'}]
  },

  evening_effort:{label:'abend \xb7 die m\xfche',dep:0,anx:5,nrg:0,
    prose:[
      {text:"Du redest mit jemandem Neuen — einer Freundin von Maya, die du einmal zuvor getroffen hast. Sie ist leicht im Gespr\xe4ch. Du erinnerst dich irgendwo nach der f\xfcnfzehnten Minute daran, dass du das kannst, dass du eigentlich ganz gut darin bist, wenn du nicht zu ersch\xf6pft bist. Das Gespr\xe4ch findet eine Form."},
      {text:"Die Kosten sind real — du kannst es als eine Art Subtraktion sp\xfcren, die hinter dem Gesicht geschieht, das du pr\xe4sentierst. Aber du bist hier. Du bist dabei. Das ist etwas."},
    ],
    choices:[{text:"Sp\xe4ter am abend \u2192",next:'evening_moment'}]
  },

  evening_kitchen:{label:'abend \xb7 k\xfcche',dep:-5,anx:-10,nrg:5,
    prose:[
      {text:"Die K\xfcche ist ruhiger. Es gibt Aufgaben. Du w\xe4schst Dinge, f\xfcllst Dinge auf, existierst n\xfctzlich in einem kleinen Raum mit einem klaren Zweck. Zwei Menschen kommen rein und raus und du redest mit ihnen und die Gespr\xe4che sind kurz und vollst\xe4ndig und erfordern nicht, dass du etwas aufrechterh\xe4ltst."},
      {type:'thought',text:"das ist okay. du darfst den abend so verbringen. nicht jeder abend muss die andere art sein."},
    ],
    choices:[{text:"Sp\xe4ter am abend \u2192",next:'evening_moment'}]
  },

  evening_moment:{label:'abend \xb7 21:47 Uhr',dep:-10,anx:-10,nrg:0,
    prose:[
      {text:"Es gibt einen Moment — nicht geplant, nicht verdient, einfach angekommen — wo du auf Mayas Couch sitzt mit einem Drink, den du kaum ber\xfchrt hast, und jemand im Raum sagt etwas Lustiges und Maya lacht und der Raum hat die richtige Temperatur und du bist, jetzt, in diesem Moment, einfach — hier."},
      {text:"Nicht performativ hier. Nicht \xfcberwachend hier. Nicht Energie aufwendend, um die Erfahrung des Hier-seins zu managen. Einfach pr\xe4sent, so wie du dir vorstellst, dass andere Menschen die meiste Zeit pr\xe4sent sind und wie du es manchmal bist, wenn die Bedingungen genau richtig sind."},
      {type:'thought',text:"halte das fest. das ist real. das ist heute passiert. das bist auch du."},
      {text:"Du wei\xdft nicht, wie lange es dauert. Das spielt keine Rolle. Was z\xe4hlt, ist, dass es passiert ist, dass es heute inmitten all der anderen Momente einen Moment gab, in dem das Gewicht sich hob und du einfach eine Person in einem Raum warst mit Menschen, die sie liebt, und es genug war."},
    ],
    choices:[{text:"Nach Hause gehen \u2192",next:'walk_home'}]
  },

  walk_home:{label:'nacht \xb7 der heimweg',dep:0,anx:5,nrg:-5,
    prose:[
      {text:"Du gehst kurz nach 22 Uhr. Die Koph\xf6rer sind drin, aber du h\xf6rst nicht wirklich zu. Der Heimweg ist, wenn die \xdcberpr\xfcfung beginnt. Sie beginnt immer auf dem Heimweg."},
      {text:"Erster Durchlauf: die \xfcbergeordnete Form. Es war ein guter Abend. Du warst f\xfcr Teile davon pr\xe4sent. Es gab einen Moment auf der Couch — dieser eigentliche Moment — der real war. Maya hat \xfcber Dinge gelacht, die du gesagt hast. Niemand hat unbequem gewirkt, als du dich in ihre N\xe4he gesetzt hast."},
      {text:"Zweiter Durchlauf: die Besonderheiten. Da war die Sache, die du \xfcber den Film gesagt hast. Du hast die Person, die du es gesagt hast, auf eine Reaktion beobachtet und konntest sie nicht lesen. Und am Ende des Abends, als du Maya zum Abschied gedrückt hast, wirkte sie leicht abgelenkt. Sie hat gesagt, sie hat morgen Arbeit. Sie war wahrscheinlich nur m\xfcde. Sie war wahrscheinlich—"},
      {type:'thought',text:"sie war wahrscheinlich nur m\xfcde. sie hat gesagt, sie hat morgen arbeit. sie war nur m\xfcde."},
    ],
    choices:[
      {text:"Sie war m\xfcde. Du hattest einen guten Abend. Loslassen.",next:'end_day',anx:-5},
      {text:"Ihr schreiben. Ein schnelles 'der abend war so sch\xf6n', damit du wei\xdft, dass sie okay ist.",next:'walk_home_text',note:'BPS/Angst',anx:-10},
      {text:"Nicht schreiben. Mit der Ungewissheit sitzen.",locked:true,reason:"du kennst dich selbst. du wei\xdft, wie das endet, wenn du es nicht aufl\xf6st. du kannst ihr entweder jetzt schreiben oder um 2 Uhr nachts."},
    ]
  },

  walk_home_text:{label:'nacht \xb7 die nachricht',dep:-5,anx:-10,nrg:0,
    prose:[
      {type:'msg',name:'Du',text:"heute abend war so sch\xf6n, danke, dass ich dabei sein durfte ❤️"},
      {type:'msg',name:'Maya',text:"wirklich!! so froh, dass du gekommen bist :) schlaf gut xx"},
      {text:"Sie antwortet in vier Minuten. Die vier Minuten kosten dich, aber die Antwort landet klar und warm und du tr\xe4gst sie den Rest des Weges nach Hause wie etwas in beiden H\xe4nden Gehaltenes, vorsichtig, damit du nichts verschüttest."},
      {type:'thought',text:"siehst du. sie war nur m\xfcde. du kannst es jetzt ablegen. sie hat gesagt, es war sch\xf6n."},
    ],
    choices:[{text:"Nach Hause gehen.",next:'end_day'}]
  },

  end_day_alone:{label:'nacht \xb7 zuhause',dep:5,anx:-5,nrg:5,
    prose:[
      {text:"Du bist um 20 Uhr zu Hause. Dein Zimmer ist wie du es verlassen hast. Ruhig. Sicher, im unmittelbaren Sinne — hier wird dir nichts abverlangt."},
      {text:"Du wirst Maya morgen schreiben. Du wirst sagen, dass du dich nicht gut gef\xfchlt hast, was stimmt. Du wirst dich entschuldigen, was auch stimmt, obwohl du dich f\xfcr etwas Spezifischeres als Unwohlsein entschuldigst. Sie wird sagen, dass es okay ist. Es wird wahrscheinlich okay sein."},
      {type:'thought',text:"du hast dich heute abend gesch\xfctzt. das ist erlaubt. du darfst das tun."},
      {text:"Der Abend, zu dem du nicht gegangen bist, findet irgendwo ohne dich statt, und du bist hier in der Stille, und beides ist gleichzeitig wahr. Morgen ist eine andere Rechnung."},
    ],
    choices:[{text:"Versuchen zu schlafen.",next:'try_sleep'}]
  },

  end_day:{label:'nacht \xb7 zuhause',dep:-5,anx:-5,nrg:-5,
    prose:[
      {text:"Du bist zu Hause. Nach zehn Uhr. Du hast den Abend dreimal auf dem R\xfckweg \xfcberpr\xfcft — was du gesagt hast, wie es angekommen ist, der eine Moment, wo du still geworden bist und gehofft hast, dass sie es nicht bemerkt hat. Sie hat es wahrscheinlich nicht bemerkt. Vielleicht schon."},
      {text:"Dein Bett. Die Decke wieder. Dieselbe Decke wie heute Morgen, nur ist es jetzt dunkel und der Tag liegt hinter dir statt vor dir, was ver\xe4ndert, was es bedeutet, hier zu liegen."},
      {type:'thought',text:"du bist aufgestanden. du bist dorthin gelangt. du bist nach hause gekommen. das ist alles von heute. das muss genug sein."},
      {text:"Morgen ist ein anderer Morgen. Das ist entweder tröstlich oder erschreckend, je nachdem, wie du es h\xe4ltst. Gerade, um 22:38 Uhr, ist es gr\xf6\xdftenteils einfach wahr."},
    ],
    choices:[{text:"Versuchen zu schlafen.",next:'try_sleep'}]
  },

  try_sleep:{label:'nacht \xb7 23:52 Uhr',dep:0,anx:5,nrg:0,
    prose:[
      {text:"Licht aus. Augen offen. Das ist der Teil, vor dem niemand warnt. Nicht das Aufstehen, nicht die soziale Kalibrierung, nicht der Herd oder das Splitting oder die Kleiderschrankl\xe4hmung. Dieser Teil. Der horizontale Teil, im Dunkeln, wenn es nichts zu tun gibt als in deinem eigenen Kopf zu sein, ungestört."},
      {type:'thought',text:"okay. schlafen jetzt. du wirst jetzt schlafen."},
      {text:"Dein Gehirn beginnt, den Tag abzulegen. Das ist normal. Das ist es, was Gehirne tun. Deins legt gr\xfcndlicher ab als die meisten und vergleicht dabei. Es findet den Filmkommentar. Es findet den Moment, wo du still geworden bist. Es findet Mayas Umarmung am Ende des Abends und legt sie ab unter: <em>leicht abgelenkt — m\xf6gliche Bedeutung — in vierzig Minuten nochmal \xfcberpr\xfcfen.</em>"},
      {type:'thought',text:"stop. das hast du bereits gekl\xe4rt. sie hat zur\xfcckgeschrieben. sie hat gesagt, es war sch\xf6n."},
      {text:"Du wei\xdft all das. Es zu wissen beendet das Ablegen nicht. Das Gehirn ist nicht an dem Urteil interessiert. Es ist an den Beweisen interessiert. Es wird weiterhin Beweise sammeln. Du hast ungef\xe4hr vier bis sechs Stunden davon vor dir, an welchem Punkt die Ersch\xf6pfung die Entscheidung treffen wird, die dein Gehirn nicht treffen kann."},
    ],
    choices:[
      {text:"Die Atemz\xfcge z\xe4hlen. Etwas, das deine Therapeutin dir beigebracht hat.",next:'sleep_breathe',dep:-5},
      {text:"Das Handy nehmen. Nicht wirklich etwas lesen, nur — das blaue Licht.",next:'sleep_phone',note:'Vermeidung',anx:-10},
      {text:"Hier liegen und es durchstehen.",next:'sleep_wait'},
      {text:"Das Licht anmachen und einiges aufschreiben.",next:'sleep_write',dep:-5},
      {text:"Dir erlauben, dar\xfcber nachzudenken, was Maya wirklich sieht, wenn sie dich anschaut.",spiral:'spiral_shame',note:'BPS-Scham'},
    ]
  },

  sleep_breathe:{label:'nacht \xb7 atmen',dep:-5,anx:-5,nrg:0,
    prose:[
      {text:"Vier einatmen. Sieben halten. Acht ausatmen. Du hast das oft genug gemacht, dass das Z\xe4hlen jetzt automatisch kommt, was lange gedauert hat und, glaubst du, eine Leistung ist. Deine Therapeutin sagt, es aktiviert das parasympathische Nervensystem. Du sagst: Mir ist egal, was es aktiviert, es funktioniert manchmal."},
      {text:"Es funktioniert heute Nacht, schlie\xdflich. Das Ablegen verlangsamt sich. Der Filmkommentar wird kleiner. Mayas Umarmung ist nur eine Umarmung — sie war m\xfcde, sie hat gesagt, sie ist m\xfcde. Du bist in deinem Bett und das Bett ist vertraut und der Tag liegt endlich hinter dir."},
      {type:'thought',text:"du bist okay. der tag ist vorbei. du kannst es ablegen."},
    ],
    choices:[{text:"Schlafen.",next:'__epilogue__'}]
  },

  sleep_phone:{label:'nacht \xb7 bildschirmlicht',dep:0,anx:0,nrg:0,
    prose:[
      {text:"Der Bildschirm ist sehr hell. Du drehst die Helligkeit herunter. Du liest nicht wirklich etwas, du scrollst nicht wirklich — existierst nur im blauen Licht und l\xe4sst es den Raum f\xfcllen, wo die Gedanken waren. Es funktioniert als Strategie in der gleichen Weise, wie Stillstehen funktioniert, wenn du frierst. Technisch wahr. Nicht eigentlich okay."},
      {type:'thought',text:"du wirst morgen daf\xfcr bezahlen. das wei\xdft du. lege es ab und schlafe."},
      {text:"Vierzig Minuten sp\xe4ter schmerzen deine Augen und das Ablegen hat sich genug verlangsamt, dass Schlaf m\xf6glich erscheint. Du legst das Handy mit dem Display nach unten auf den Nachttisch. Du machst dir eine Notiz, morgen besser zu machen. Diese Notiz machst du die meisten N\xe4chte."},
    ],
    choices:[{text:"Schlafen.",next:'__epilogue__',dep:5}]
  },

  sleep_wait:{label:'nacht \xb7 warten',dep:5,anx:0,nrg:0,
    prose:[
      {text:"Du liegst dort. Die Gedanken tun, was Gedanken tun. Du versuchst, sie zu beobachten, ohne in ihnen gefangen zu werden — nicht jedem bis zu seinem Ende zu folgen, nur zuzuschauen, wie sie vergehen. Das ist das Ziel. Das ist viel schwerer, als es klingt, was Menschen \xfcber Meditation sagen, als w\xe4re es eine leichte Unannehmlichkeit und nicht die schwierigste kognitive Aufgabe, die du je versucht hast."},
      {type:'thought',text:"du musst das alles heute nacht nicht l\xf6sen. nichts davon muss heute nacht gel\xf6st werden."},
      {text:"Gegen 1:40 Uhr geht dem Gehirn das Material aus. Du schlafen. Morgen wird anders sein, oder nicht, oder wird anders auf eine andere Weise anders sein. So oder so ist genau dieser Tag vorbei, und das ist etwas."},
    ],
    choices:[{text:"Schlafen.",next:'__epilogue__'}]
  },

  sleep_write:{label:'nacht \xb7 aufschreiben',dep:-10,anx:-5,nrg:0,
    prose:[
      {text:"Du machst die Lampe an. Das Notizbuch ist in der Schublade — immer in der Schublade, der Vorschlag deiner Therapeutin von vor acht Monaten, den du beibehalten hast. Du schreibst: <em>filmkommentar. konnte die reaktion nicht lesen. maya umarmung — wahrscheinlich m\xfcde. hat zur\xfcckgeschrieben, sagte sch\xf6n.</em>"},
      {text:"Der Akt des Schreibens macht sie irgendwie kleiner. Sie existieren jetzt au\xdferhalb deines Kopfes, dokumentiert, irgendwo abgelegt, wo du sie finden kannst, wenn du es brauchst. Was bedeutet, dass dein Kopf sie nicht mehr halten muss. Dein Kopf ist ohne sie ein wenig ruhiger."},
      {type:'thought',text:"okay. es ist jetzt drau\xdfen. es ist aufgeschrieben. du kannst schlafen."},
    ],
    choices:[{text:"Schlafen.",next:'__epilogue__',dep:-5}]
  },

};

var SPIRALS={
  spiral_morning:{
    lines:[
      "die pr\xe4sentation ist um 10 Uhr. du hast dich nicht genug darauf vorbereitet.",
      "hast du auf diese E-Mail von dienstag geantwortet? du denkst schon. du bist nicht sicher.",
      "wird Maya m\xfcde davon, wie viel du gerade brauchst? du warst in letzter zeit viel.",
      "der herd. du solltest den herd \xfcberpr\xfcfen, bevor du gehst. du bist noch nicht gegangen, aber — der herd.",
      "du wirst zu sp\xe4t sein. du bist immer zu sp\xe4t. die leute haben bemerkt, dass du immer zu sp\xe4t bist.",
      "wenn die pr\xe4sentation heute schlecht l\xe4uft, dann — du bist noch nicht mal aufgestanden.",
    ],
    dismiss:"atmen. zur\xfcckkommen."
  },
  spiral_shame:{
    lines:[
      "sie ist deine freundin, weil sie das entschieden hat, bevor sie wusste, wie du bist.",
      "jedes mal, wenn du nachfragst, jedes mal, wenn sie etwas ausw\xe4hlen, best\xe4tigen oder dir sagen muss, dass alles okay ist — sie sieht es.",
      "sie ist nett genug, nichts zu sagen. das ist etwas anderes, als dass es nicht da ist.",
      "du hast heute zwanzig minuten damit verbracht, \xfcberzeugt zu sein, dass sie nicht will, dass du zu ihrer eigenen party kommst.",
      "du hast sie gebraucht, um dein outfit auszuw\xe4hlen.",
      "und dann hattest du eine sch\xf6ne zeit, und bevor du \xfcberhaupt zu hause warst, hast du bereits versucht sicherzustellen, dass es nicht weggenommen werden konnte.",
      "du bist viel arbeit. du warst schon immer viel arbeit.",
    ],
    dismiss:"das ist die st\xf6rung, die redet. sie ist laut und klingt wahr. sie ist nicht wahr.",
    note:"das ist BPS-Scham. sie kommt ohne vorwarnung und klingt wie fakten. das sind keine fakten."
  }
};
