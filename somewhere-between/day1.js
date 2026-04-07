/* ══════════════════════════════════════════════════════
   somewhere between — day1.js

   All scenes and spirals for day one.

   ── ADDING MORE TO DAY 1 ────────────────────────────
   Add new scene objects to SCENES. Use any existing
   scene as a template. A scene can reference any other
   scene as a `next` target, including ones in day2.js
   once that file exists.

   ── ADDING DAY 2 ────────────────────────────────────
   1. Create somewhere-between/day2.js using this file
      as a template.
   2. In day2.js, add your scenes to SCENES using
      Object.assign(SCENES, { your_new_scenes });
      and your spirals similarly.
   3. Add the following to somewhere-between.html
      before engine.js loads:
      <script src="somewhere-between/day2.js"></script>
   4. Change the last choice of the final day1 scene
      (currently sleep_write/sleep_breathe etc) from
      next:'__epilogue__' to next:'day2_start_scene_id'

   ── SCENE FORMAT ────────────────────────────────────
   scene_id: {
     label: 'time · context',       // shown at top of page
     dep: 0,                          // depression delta on entry
     anx: 0,                          // anxiety delta on entry
     nrg: 0,                          // energy delta on entry
     prose: [
       {text: "narrative paragraph"},
       {type:'thought', text: "inner voice"},
       {type:'msg', name:'Person', text: "message"},
       {type:'msg', name:'Person', cold:true, text: "cold msg"},
       {type:'wanted', wanted:"...", sent:"..."},
     ],
     choices: [
       {text:"label", next:'scene_id'},
       {text:"label", next:'scene_id', nrg:-10, dep:5, anx:-5},
       {text:"label", locked:true, reason:"why not"},
       {text:"label", locked:true, egGate:30},   // locked if nrg < 30
       {text:"label", spiral:'spiral_key'},      // triggers spiral
       {text:"label", next:'scene_id', note:'BPD'}, // disorder tag
     ]
   }

   ── SPIRAL FORMAT ───────────────────────────────────
   spiral_key: {
     lines: ["thought one", "thought two", ...],
     dismiss: "text on the dismiss button",
     note: "optional explanation shown after lines"  // optional
   }
   ══════════════════════════════════════════════════════ */

var SCENES={

  morning_1:{label:'morning · 6:47 am',dep:0,anx:0,nrg:0,
    prose:[
      {text:"Your alarm went off twenty-three minutes ago. You know this because you've been watching the time change — 6:24, 6:31, 6:38, and now 6:47 — and each number feels like an accusation. The ceiling is the same as it always is. The light coming through the curtain is the colour of something you don't want to think about yet. Your body has a specific weight this morning — not tiredness exactly, more like gravity has made a personal decision about you."},
      {type:'thought',text:"if you stay here long enough, maybe the day will start without you. maybe it'll just — go."},
      {text:"This is what <span class='term' data-key='executive'>getting up</span> looks like from the inside. Not the act itself, but the ten minutes before it when the act feels like climbing something very tall with nothing to hold onto. You set four alarms. You knew this would happen. You set four alarms anyway."},
    ],
    choices:[
      {text:"Get up. Swing your legs over the side of the bed and don't think about it.",next:'morning_mirror',nrg:-8,dep:-5},
      {text:"Five more minutes. Set another alarm.",next:'morning_snooze',nrg:-5},
      {text:"Try to think through everything you need to do today — maybe that'll motivate you.",locked:true,reason:"you know better than this. you've tried it before. thinking about the list doesn't shrink it. it just makes the ceiling feel lower.",spiral:'spiral_morning'},
    ]
  },

  morning_snooze:{label:'morning · 7:21 am',dep:5,anx:5,nrg:0,
    prose:[
      {text:"You've done this four more times. It's 7:21 now. The room is brighter than it should be and your body feels heavier than it did an hour ago, which is the wrong direction. <span class='term' data-key='anhedonia'>The idea of the day</span> sits in your chest like something swallowed wrong."},
      {type:'thought',text:"this isn't laziness. you've read enough to know that. it doesn't help to know that."},
      {text:"You could keep setting alarms. There's a version of this morning where you do it twice more and arrive somewhere an hour late and spend the rest of the day managing the fallout. You've lived that version before."},
    ],
    choices:[
      {text:"Okay. For real this time. Get up.",next:'morning_mirror',nrg:-8,dep:-5},
      {text:"Check your phone first. Just for a minute.",next:'phone_check'},
    ]
  },

  morning_mirror:{label:'morning · bathroom',dep:0,anx:5,nrg:0,
    prose:[
      {text:"You're standing in front of the bathroom mirror. You came in here to brush your teeth. You have brushed your teeth. You are still standing here. You've been standing here for eight minutes, which you know because you checked your phone while standing here and then put it face-down on the sink so you'd stop."},
      {type:'thought',text:"you look like what you are. tired. you wonder how much of that shows to other people."},
      {text:"This is not a <span class='term' data-key='masking'>vanity thing</span>. It's more that the person in the mirror needs to be checked — confirmed — before you can be sure you're allowed to go out into the world as her. Some mornings this takes two minutes. Today it is taking longer."},
    ],
    choices:[
      {text:"You look fine. Stop it. Leave.",locked:true,reason:"you know you don't believe this. you've tried saying it out loud before. the words just sit there."},
      {text:"Change your outfit. Something that covers more.",next:'meds_check'},
      {text:"Text Maya. Ask if the outfit looks okay.",next:'text_maya_outfit',note:'DPD'},
      {text:"Stop looking at yourself and just go.",locked:true,reason:"you've been trying to do this for eight minutes."},
    ]
  },

  text_maya_outfit:{label:'morning · waiting',dep:0,anx:10,nrg:-4,
    prose:[
      {text:"You send the photo. <span class='term' data-key='fp'>Maya</span> is — she's the person whose opinion matters right now. Not just about the outfit. About most things. You know this about yourself. You know it isn't fair to her. You send the photo anyway because the alternative is standing in front of the mirror for another ten minutes."},
      {text:"The typing indicator appears. Disappears. Appears again. It's been four minutes. She usually responds in under a minute. Four minutes means something. You go through the possibilities. She's busy. She's in the shower. She saw the message and thought something she didn't want to say."},
      {type:'thought',text:"stop. you don't know that. but four minutes is a long time."},
      {text:"This is <span class='term' data-key='hypervigilance'>hypervigilance</span>. You know the word for it. Knowing the word doesn't slow your heart rate down."},
    ],
    choices:[
      {text:"She's probably just busy. It's early. Wait.",locked:true,reason:"you know this is probably true. your brain has already written three different versions of what the silence means and is deciding between them."},
      {text:"Send a follow-up. 'sorry ignore me lol'",next:'maya_followup',note:'anxiety/BPD',anx:5},
      {text:"Put the phone face-down and get ready anyway.",next:'getting_ready',nrg:-8,anx:5},
    ]
  },

  maya_followup:{label:'morning · her response',dep:-5,anx:-10,nrg:0,
    prose:[
      {type:'msg',name:'Maya',text:"omg you look so good?? why are you even asking"},
      {text:"The relief is out of proportion to the question, which you know. Somewhere in the back of your head you know that the relief you're feeling right now is not a normal amount of relief about an outfit. But it's real. Your shoulders drop. Your jaw unclenches. You didn't notice either of those things were happening until they stopped."},
      {type:'thought',text:"okay. okay, she's not mad. hold onto that. don't let it go yet."},
      {text:"<span class='term' data-key='reassurance'>Reassurance</span> works. That's the complicated part — it genuinely works, in the short term. The anxiety goes down. You feel better. And in twenty minutes it'll start creeping back, and the temporary relief will have cost you something you didn't notice you were spending."},
    ],
    choices:[
      {text:"Reply 'haha thank you ❤️' and feel the relief.",next:'getting_ready'},
      {text:"Believe her fully and let it go.",locked:true,reason:"the relief is already starting to thin. what if she was just being kind because she's kind? what if she didn't actually look at the photo?"},
    ]
  },

  phone_check:{label:'morning · in bed still',dep:0,anx:5,nrg:0,
    prose:[
      {type:'msg',name:'Maya · 11:47pm',text:"hey are you coming tonight? should be fun :)"},
      {text:"You read it three times. The second time you notice she used a colon-bracket instead of an actual emoji, which could mean nothing. It usually means nothing. Except she normally uses the heart-eyes one, and she sent this at 11:47 which is late, and the <span class='term' data-key='splitting'>tone is different</span> from how she usually texts, and you know you're doing it, you know you're reading into punctuation at 6:53 in the morning, but you can't stop."},
      {type:'thought',text:"maybe she's not sure she wants you there. maybe she's asking to be polite. maybe something happened and you don't know what."},
      {text:"This is not about the colon-bracket. You know that. It's just the thing your brain picked up and ran with. It needed something to be uncertain about and it found it."},
    ],
    choices:[
      {text:"Reply 'yeah! can't wait :)' and get up.",next:'morning_mirror'},
      {text:"Ask if she's okay. Check that she actually wants you there.",next:'maya_check',note:'BPD',anx:5},
      {text:"Reply normally. Trust that she means it.",locked:true,reason:"your chest is tight and you don't know why. something feels like it might be wrong and your brain won't let you act like it isn't until you've confirmed it isn't."},
      {text:"Tell her you're not feeling well. You can decide later.",next:'skip_offer',note:'avoidance',dep:5},
    ]
  },

  maya_check:{label:'morning · checking',dep:0,anx:-5,nrg:0,
    prose:[
      {type:'msg',name:'Maya',text:"of course!! why wouldn't i ❤️❤️❤️"},
      {text:"She's fine. She was always fine. The colon-bracket was just a colon-bracket. You knew, probably, that this was most likely. And still the confirmation does something to your body that just <em>knowing</em> doesn't do — there's a physical loosening that only happens when someone else says the words out loud."},
      {type:'thought',text:"okay. she's fine. you're fine. why do you keep doing this to her. she must be so tired of your—"},
      {text:"This is <span class='term' data-key='abandonment'>the loop</span>. You ask. She reassures. The reassurance works. You feel bad for needing it. Feeling bad makes the anxiety come back. Which means you'll probably check again later."},
    ],
    choices:[
      {text:"Reply 'okay sorry haha' and get up.",next:'morning_mirror'},
      {text:"Feel fully reassured.",locked:true,reason:"the apology you just sent — what if that was too much? what if she's fine about tonight but annoyed now about the apology?"},
    ]
  },

  skip_offer:{label:'morning · the out',dep:5,anx:0,nrg:0,
    prose:[
      {type:'msg',name:'Maya',text:"nooo you have to come :( i'll literally come get you if i have to"},
      {text:"She means it. The 'literally', the sad face — she means it. What you question is whether you want to be the person she has to come get. Whether <span class='term' data-key='dpd'>'i'll come get you'</span> is love or duty, and whether the distinction matters when you're the one being carried."},
      {type:'thought',text:"she said she wants you there. that's enough. that has to be enough."},
    ],
    choices:[
      {text:"Tell her you'll try. That's an honest answer.",next:'morning_mirror'},
      {text:"Say okay. Because she asked. Not because you chose to.",next:'morning_mirror',note:'DPD'},
    ]
  },


  meds_check:{label:'morning · bathroom shelf',dep:0,anx:0,nrg:0,
    prose:[
      {text:"Your medication is on the shelf behind you. You can see it in the mirror — the small orange bottles that have been there for eight months. You don't think about them most days, which your therapist says is a good sign. Today you're looking at them and thinking: <em>is this working</em>. You have this thought approximately once a fortnight. It never leads anywhere useful."},
      {type:'thought',text:"just take them. it's four seconds. you've done this 168 times."},
      {text:"Some days you're certain they're working and terrified of what you'd be without them. Some days you're certain they're not and you're just this, with or without the pills. Today you don't know. You stand there and you don't know and the four seconds pass and the question is still open."},
    ],
    choices:[
      {text:"Take them. Four seconds, done.",next:'getting_ready',dep:-5},
      {text:"You're already running late. Take them tonight.",next:'getting_ready',dep:5,note:'risk'},
      {text:"Stop thinking about whether they're working and just take them.",locked:true,reason:"you know this is the right thought. you cannot stop having the other one first."},
    ]
  },

  getting_ready:{label:'morning · the door',dep:0,anx:10,nrg:-4,
    prose:[
      {text:"You're ready. Standing at the front door with your keys. The door is right there. You have to leave in four minutes to arrive on time."},
      {type:'thought',text:"is the stove off. you checked it. you checked it twice. did you actually check it or did you just stand near it? there's a difference."},
      {text:"You checked the stove. You know you checked it. The problem with <span class='term' data-key='intrusive'>intrusive doubt</span> is that 'knowing' something and 'being able to act as though you know it' are not the same cognitive step. The stove is off. You might have to go back and confirm that before your body believes it."},
    ],
    choices:[
      {text:"Go back and check the stove one more time.",next:'check_stove',nrg:-5,anx:-10},
      {text:"You checked it. You can leave.",locked:true,reason:"you know you did. your hands remember doing it. your brain is not interested in what your hands remember."},
      {text:"Text Maya 'leaving now' — just so someone knows.",next:'commute',note:'DPD'},
      {text:"Leave. Just leave.",next:'commute',nrg:-8},
    ]
  },

  check_stove:{label:'morning · kitchen again',dep:0,anx:-5,nrg:0,
    prose:[
      {text:"Off. All of them off. Obviously. You knew this. You check the lock on the front door — handle, deadbolt, handle again — and go."},
      {type:'thought',text:"this is just what mornings are. you just need to get there. once you get there it's easier."},
    ],
    choices:[{text:"Leave. You're going to be nine minutes late.",next:'commute',nrg:-5}]
  },

  commute:{label:'morning · outside',dep:0,anx:10,nrg:-5,
    prose:[
      {text:"The air is cold. You forgot how cold it gets in the morning. You're going to be eight minutes late, which is not a lot, which you know is not a lot, but which will require you to walk through a room of people who will notice the door opening and look up and see you walk in late, and you will feel each of those looks separately and carry them for the rest of the morning."},
      {type:'thought',text:"they'll think you're unreliable. they've been thinking it for a while. you give them reasons."},
      {text:"There is a thing that happens in your chest when you're late — a tightening around the sternum that isn't quite pain but has pain's qualities, its insistence. <span class='term' data-key='emotional_intensity'>The math of this</span> — late, looked at, judged — your nervous system is processing as something much larger than it is. You know this. You are walking faster than you need to."},
    ],
    choices:[
      {text:"Eight minutes is nothing. It happens to everyone.",locked:true,reason:"it does happen to everyone. you are not everyone right now. your heart rate has been elevated since you left the house."},
      {text:"Text Maya 'running late, tell me it's fine'",next:'arrive',note:'DPD',anx:-10},
      {text:"Put your headphones in. Don't think about it until you get there.",next:'arrive',nrg:-5},
    ]
  },

  arrive:{label:'morning · arrival',dep:-5,anx:-5,nrg:0,
    prose:[
      {text:"You make it. Nine minutes late. No one looks up. You sit down. You open your laptop. The morning doesn't care that it cost you ninety minutes of mental energy to get here. It just continues."},
      {type:'thought',text:"of course no one looked up. you always know that and it never helps."},
      {text:"This is the invisible part — the part that doesn't show up in how you look or how you perform. All of that effort just to arrive. The day hasn't properly started yet and you've already spent something significant."},
    ],
    choices:[{text:"Continue to midday →",next:'midday_1'}]
  },

  midday_1:{label:'midday · at work',dep:5,anx:5,nrg:-10,
    prose:[
      {text:"It's been three hours. Somewhere across the room, two people laugh at something — quickly, briefly, a real laugh. You weren't part of it. You don't know why your stomach drops the way it does when it happens."},
      {type:'thought',text:"what were they laughing at. was it something you said earlier. you said something about the Johnson brief, you said it was 'a lot', was that—"},
      {text:"This is <span class='term' data-key='hypervigilance'>hypervigilance</span> applied to social space. Your nervous system has assigned threat-detection resources to a laugh you weren't included in, and now it needs to resolve the question before it can stand down. The answer is almost certainly no. 'Almost certainly' is not 'definitely'."},
    ],
    choices:[
      {text:"It's nothing. Look back at your screen.",locked:true,reason:"you've told yourself this three times in the last thirty seconds. your brain is not done with the question yet."},
      {text:"Make a small comment. Test the temperature.",next:'midday_check',note:'BPD/anxiety',anx:-10},
      {text:"Put your headphones in.",next:'midday_flat',dep:5},
    ]
  },

  midday_check:{label:'midday · the check',dep:0,anx:-5,nrg:-5,
    prose:[
      {text:"You say something small and they both laugh and one of them says <em>\"oh completely\"</em> and turns back to their screen. They were talking about something in a show. It had nothing to do with you."},
      {type:'thought',text:"see. fine. nothing. except now you're annoyed at yourself for needing to check. which means you're still not actually fine. you've just confirmed the immediate threat level."},
    ],
    choices:[{text:"Go back to work.",next:'midday_flat'}]
  },

  midday_flat:{label:'midday · lunch',dep:5,anx:0,nrg:-10,
    prose:[
      {text:"Lunch. Forty minutes. The others are going somewhere down the street. No one asked if you were coming, which could mean they assumed you'd say no, which could mean—"},
      {type:'thought',text:"stop. eat something. you haven't eaten anything. that's making everything worse."},
      {text:"You eat at your desk. You eat without tasting anything. This is the <span class='term' data-key='anhedonia'>flatness</span> — not sadness exactly, nothing dramatic enough to justify the weight of it. Just an absence. Food has a texture. You note the texture. That's all it has today."},
      {text:"Somewhere between the sandwich and the afternoon, you realise you've been staring at the same line of an email for eleven minutes. You didn't go anywhere, exactly. You were just — not here. <span class='term' data-key='dissociation'>Not anywhere in particular.</span>"},
      {type:'thought',text:"you're here. you're at your desk. it's 1:14pm. that's where you are."},
    ],
    choices:[
      {text:"There's a team meeting at 2. Prepare something to say.",locked:true,reason:"you can't find the part of yourself that would know what to say. you'll go and listen and nod and that will have to be enough.",egGate:20},
      {text:"There's a team meeting at 2. You'll go and get through it.",next:'midday_meeting'},
      {text:"Reply to the email you've been staring at.",next:'midday_meeting',nrg:-5},
    ]
  },

  midday_meeting:{label:'midday · 2:00pm',dep:0,anx:10,nrg:-8,
    prose:[
      {text:"The meeting. You're in the meeting. Someone is talking about the quarterly numbers. You are performing the posture of someone who is engaged with the quarterly numbers. Your face is doing the thing your face does in meetings. You have been doing this for long enough that the performance doesn't require much conscious effort anymore, which is both a skill and a cost."},
      {text:"Your manager asks if you have anything to add. Everyone looks at you. You have approximately three seconds before the pause becomes notable."},
      {type:'thought',text:"say something. anything. you know enough about the quarterly numbers to say something."},
    ],
    choices:[
      {text:"Say something brief and useful about Q3.",next:'meeting_speaks',nrg:-6},
      {text:"Say 'nothing to add from me, sounds good'",next:'meeting_silent',note:'masking'},
      {text:"Actually engage. Push back on the projections you think are off.",locked:true,reason:"you have the thought. you cannot get it from your brain to your mouth right now. the room is too loud in your head."},
    ]
  },

  meeting_speaks:{label:'midday · after the meeting',dep:-5,anx:-5,nrg:0,
    prose:[
      {text:"You say the thing. It's fine. It's even slightly good — someone writes it down. Your manager nods. The meeting continues. Nothing bad happened."},
      {type:'thought',text:"okay. you did that. you said the thing and it was fine. you can do this."},
      {text:"The relief lasts about four minutes. Then your brain starts reviewing what you said for errors. It will keep doing this for the rest of the afternoon."},
    ],
    choices:[{text:"Continue to late afternoon →",next:'split_setup'}]
  },

  meeting_silent:{label:'midday · after the meeting',dep:5,anx:0,nrg:0,
    prose:[
      {text:"'Nothing to add.' Your manager nods and moves on. The meeting ends. You've been in that room for fifty minutes and left no trace of yourself in it. Which is sometimes exactly what you need, and which today feels like disappearing a little."},
      {type:'thought',text:"you were there. that counts. being there counts."},
    ],
    choices:[{text:"Continue to late afternoon →",next:'split_setup'}]
  },

  /* ── THE SPLIT ─────────────────────────────────────── */

  split_setup:{label:'late afternoon · 4:38pm',dep:0,anx:5,nrg:-5,
    prose:[
      {text:"You're finishing something when Maya's name appears on your phone. You notice the way your body responds to seeing her name — a small involuntary lift, a brightness. This is what having a <span class='term' data-key='fp'>favourite person</span> feels like on a good day. Her name arrives and the room gets slightly less grey."},
      {type:'msg',name:'Maya · 4:38pm',text:"hey quick q - are you still coming tonight or no"},
      {text:"You read it twice. The first time you register the words. The second time you register 'or no'."},
      {type:'thought',text:"or no. she wrote 'or no'. she typed those two words and sent them. she could have said 'let me know!' she could have said 'hope so :)'. she wrote 'or no'."},
    ],
    choices:[
      {text:"She typed 'or no' because it's a question, not an invitation to cancel. Reply normally.",locked:true,reason:"you know this. you are trying to hold this. your brain has decided that 'or no' is data and it is not done processing the data."},
      {text:"Read it again and see if the meaning changes.",next:'split_happening',anx:10},
    ]
  },

  split_happening:{label:'late afternoon · the split',dep:0,anx:15,nrg:-10,isSplit:true,
    prose:[
      {text:"You read it again. It doesn't help. Something happens in your body when the shift occurs — a withdrawal, a pulling inward, like a physical bracing. Something has shifted in the quality of the message — not the words, the words are the same, but the warmth has gone out of them. <span class='term' data-key='splitting'>This is what splitting feels like</span>: not a decision, not a thought you can argue yourself out of. More like a light changing. The Maya who sent the heart-eyes emoji this morning and the person who sent 'or no' at 4:38pm are, in this moment, two different people."},
      {type:'msg',name:'Maya',cold:true,text:"hey quick q - are you still coming tonight or no"},
      {text:"The cold version of her is more familiar, in some ways. The cold version of her is the one you've been waiting for. The warm version was borrowed time; this is what you knew was coming. You know — the part of you that can still access knowledge — that this is not real. That Maya hasn't changed. That <span class='term' data-key='object_constancy'>the warm version of her still exists</span>. You cannot feel that right now. Knowing it and feeling it are different countries."},
      {type:'thought',text:"she wants you to say no. she's giving you an out because she wants you to take it. she's been politely tolerating you for weeks and this is the message where she stops."},
      {type:'wanted',wanted:"i'm scared i've done something wrong and i don't know what it is. are you okay with me? are we okay?"},
    ],
    choices:[
      {text:"Send the normal message. Don't show her what's happening.",next:'split_reply_normal'},
      {text:"Ask her directly if she actually wants you there.",next:'split_reply_check',note:'BPD',anx:5},
      {text:"Tell her you can't make it.",next:'split_withdraw',dep:10},
    ]
  },

  split_reply_normal:{label:'late afternoon · after',dep:0,anx:-5,nrg:0,
    prose:[
      {type:'wanted',sent:"yeah still coming :) see you there"},
      {type:'msg',name:'Maya',text:"yay!! ok see you at 8 ❤️"},
      {text:"She sends the heart. The heart is warm. The heart goes some way toward making 'or no' feel like the thing it was, which was a casual phrase, which was nothing. Your nervous system doesn't fully believe this yet. But it's receiving the evidence."},
      {type:'thought',text:"see. she's fine. she was always fine. you knew that. you spent twenty minutes not knowing that and now you know it again."},
      {text:"This is what <span class='term' data-key='object_constancy'>coming back from a split</span> feels like — not a snap back but a slow re-warming, evidence arriving one message at a time, the warmth returning unevenly. You'll be a little shaky around her tonight. You'll monitor her expressions more than you should. But the worst of it is over."},
    ],
    choices:[{text:"Start getting ready →",next:'dpd_decision'}]
  },

  split_reply_check:{label:'late afternoon · checking',dep:0,anx:0,nrg:0,
    prose:[
      {type:'msg',name:'You',text:"lol random q - you do actually want me to come right? not just asking to be nice"},
      {type:'msg',name:'Maya',text:"??? yes obviously?? why would i not want you there"},
      {type:'msg',name:'Maya',text:"wait are you okay"},
      {text:"Three messages. The last one — 'are you okay' — lands somewhere complicated. She noticed. She noticed and she asked. The part of you that was certain she was pulling away has no response to this. The certainty is retreating now, quietly, the way it always does when it gets contradicted by reality. It doesn't apologise when it goes. It just leaves."},
      {type:'thought',text:"she asked if you're okay. she asked. the cold version of her wouldn't ask."},
    ],
    choices:[
      {text:"Tell her you're fine, just being weird, see you at 8.",next:'split_reply_normal'},
      {text:"Tell her honestly: you had a moment, you're okay now.",next:'split_honest_reply'},
    ]
  },

  split_honest_reply:{label:'late afternoon · honesty again',dep:-5,anx:-5,nrg:0,
    prose:[
      {type:'msg',name:'You',text:"i had a weird five minutes where i convinced myself you didn't want me there. i'm okay now. sorry"},
      {type:'msg',name:'Maya',text:"omg no don't apologise. i hate that you went through that. i should have worded it better"},
      {type:'msg',name:'Maya',text:"i always want you there. that's just a given ok"},
      {type:'thought',text:"she said 'that's just a given'. hold onto that. she said it's a given."},
      {text:"You sit with this for a minute. She didn't make it weird. She didn't get tired of you for needing it. She just — answered. This is what safe people do. You know this. Sometimes it's still surprising."},
    ],
    choices:[{text:"Start getting ready →",next:'dpd_decision'}]
  },

  split_withdraw:{label:'late afternoon · withdrawal',dep:10,anx:-10,nrg:5,
    prose:[
      {type:'msg',name:'You',text:"actually not feeling great, think i'm going to skip tonight, sorry"},
      {type:'msg',name:'Maya',text:"oh no :( are you okay? do you need anything?"},
      {text:"She asks if you need anything. The question has the shape of care. You can't tell, right now, whether it is care or whether it is the performance of care she'd offer anyone who cancelled on her. You know, intellectually, that Maya is not performing. You cannot feel that right now."},
      {type:'thought',text:"you did the right thing. you were too close to the edge. you can explain later."},
      {text:"The relief of cancelling is real and immediate and already curdling at the edges. <span class='term' data-key='abandonment'>By tomorrow</span> you'll have convinced yourself that this was the beginning of her withdrawing. But tonight you have your bedroom and the quiet and that will have to be enough."},
    ],
    choices:[{text:"Go home →",next:'end_day_alone'}]
  },

  /* ── DPD DECISION ──────────────────────────────────── */

  dpd_decision:{label:'late afternoon · getting ready',dep:0,anx:5,nrg:-5,
    prose:[
      {text:"You're standing in front of your wardrobe. You've been standing here for twelve minutes. This is not the mirror thing — you're not looking at yourself. You're looking at the options. There are fourteen items of clothing visible. You cannot select one. This is not indecision in the way people usually mean it. This is something more structural than that — a <span class='term' data-key='dpd'>genuine absence of preference</span>, or rather, preference that exists somewhere but cannot surface without someone to surface it for."},
      {type:'thought',text:"it doesn't matter what you wear. it matters what you wear. you need someone to tell you it doesn't matter what you wear."},
      {text:"You've been here before. The decision is simple — it's a casual evening, jeans and something are fine. You know this. The knowledge is not helping. What you need is someone to say: <em>that one</em>. And then you could move."},
    ],
    choices:[
      {text:"Pick something. Anything. You've done this before.",locked:true,reason:"you know you have. you're trying to access that capacity and it isn't available right now."},
      {text:"Text Maya a photo of two options. Ask her to pick.",next:'dpd_resolved',note:'DPD',anx:-10},
      {text:"Call your mum. Tell her you need her to make a small decision for you.",next:'dpd_resolved_mum',note:'DPD'},
      {text:"Stand here until your body picks for you somehow.",next:'dpd_stall',nrg:-10},
    ]
  },

  dpd_resolved:{label:'late afternoon · resolved',dep:0,anx:-10,nrg:5,
    prose:[
      {type:'msg',name:'Maya',text:"the black one obviously!! why do you even own the other one"},
      {text:"The black one. You put on the black one. It takes four seconds. Your body moves without the twelve minutes of friction it had before, because someone else absorbed the decision and gave it back to you as an answer, and answers are things you can act on. This is what <span class='term' data-key='dpd'>the dependency feels like from the inside</span> — not weakness, not a choice, but the experience of a door that only opens from one side."},
      {type:'thought',text:"you're going. you're getting ready. that's all this is. just keep moving."},
    ],
    choices:[{text:"Leave for Maya's →",next:'evening_arrival'}]
  },

  dpd_resolved_mum:{label:'late afternoon · the call',dep:-5,anx:-5,nrg:0,
    prose:[
      {text:"Your mum picks up on the second ring. You tell her you can't decide what to wear and need her to pick. She doesn't ask why. She asks you to describe the options. She picks the blue one without hesitating. You put the blue one on."},
      {type:'thought',text:"she just — picked. she didn't make it a thing. she just picked."},
      {text:"There are people who would be frustrated by this call. Your mum is not one of them. This is either because she understands, or because she's learned. Either way, she picked the blue one, and you're moving now, and the twelve frozen minutes are behind you."},
    ],
    choices:[{text:"Leave for Maya's →",next:'evening_arrival'}]
  },

  dpd_stall:{label:'late afternoon · stuck',dep:5,anx:5,nrg:0,
    prose:[
      {text:"You stand there until the standing there becomes unbearable and then you grab the nearest thing and put it on. It's fine. It was always going to be fine. You've spent twenty-two minutes on this. You are going to be late."},
      {type:'thought',text:"it's fine. it's a top. it's fine. you're going."},
    ],
    choices:[{text:"Leave. You're late.",next:'evening_arrival',nrg:-5}]
  },

  /* ── EVENING ───────────────────────────────────────── */

  evening_arrival:{label:'evening · Maya\'s',dep:0,anx:5,nrg:-5,
    prose:[
      {text:"You get there. Maya opens the door and she looks like herself — like the warm version of her, which is the real version, which is the only version that was ever real — and the last residue of the split dissolves in approximately four seconds."},
      {text:"Her flat is warm and loud with other people and for the first ten minutes you're calibrating — reading the room, finding your register, figuring out who is safe to talk to and who will require too much energy. You're good at this. You've been doing it your whole life."},
      {type:'thought',text:"you can do this. you're here. you made it here and you can do this."},
    ],
    choices:[
      {text:"Find a spot near Maya and stay close.",next:'evening_close',note:'DPD'},
      {text:"Talk to someone new. Make the effort.",next:'evening_effort',nrg:-8},
      {text:"Help in the kitchen. Useful and low-pressure.",next:'evening_kitchen'},
    ]
  },

  evening_close:{label:'evening · close to her',dep:-5,anx:-5,nrg:0,
    prose:[
      {text:"You stay near Maya most of the evening. She doesn't seem to mind. She includes you in conversations, touches your arm when she makes a point, laughs at things you say. The evening is warm. You are warm in it."},
      {text:"You're aware, at a low level, that you've organised the whole night around her proximity. You're aware this is the <span class='term' data-key='dpd'>pattern</span>. You're also aware that it's working — you're present, you're engaged, you're not spending the whole night in your head. Sometimes the thing that works is the thing that works."},
      {type:'thought',text:"this is nice. you're having a nice time. let that be true."},
    ],
    choices:[{text:"Later in the evening →",next:'evening_moment'}]
  },

  evening_effort:{label:'evening · the effort',dep:0,anx:5,nrg:0,
    prose:[
      {text:"You talk to someone new — a friend of Maya's you've met once before. She's easy to talk to. You remember, somewhere around the fifteen-minute mark, that you can do this, that you're actually decent at this when you're not too depleted. The conversation finds a shape."},
      {text:"The cost is real — you can feel it as a kind of subtraction happening behind whatever face you're presenting. But you're here. You're in it. That's something."},
    ],
    choices:[{text:"Later in the evening →",next:'evening_moment'}]
  },

  evening_kitchen:{label:'evening · kitchen',dep:-5,anx:-10,nrg:5,
    prose:[
      {text:"The kitchen is quieter. There are tasks. You wash things, refill things, exist usefully in a small space with a clear purpose. Two people come in and out and you talk to them and the conversations are short and complete and don't require you to sustain anything."},
      {type:'thought',text:"this is fine. you're allowed to do the evening this way. not every evening has to be the other kind."},
    ],
    choices:[{text:"Later in the evening →",next:'evening_moment'}]
  },

  evening_moment:{label:'evening · 9:47pm',dep:-10,anx:-10,nrg:0,
    prose:[
      {text:"There's a moment — not planned, not earned, just arrived — where you're sitting on Maya's couch with a drink you've barely touched and someone across the room is saying something funny and Maya is laughing and the room is the right temperature and you are, right now, in this moment, just — here."},
      {text:"Not performing here. Not monitoring here. Not spending energy managing the experience of being here. Just present, in the way that you imagine other people are present most of the time and you are present sometimes, when the conditions are exactly right."},
      {type:'thought',text:"hold onto this. this is real. this happened today. this is also you."},
      {text:"You don't know how long it lasts. It doesn't matter. What matters is that it happened, that there was a moment today inside all the other moments where the weight lifted and you were just a person in a room with people she loves, and it was enough."},
    ],
    choices:[{text:"Go home →",next:'walk_home'}]
  },


  walk_home:{label:'night · the walk home',dep:0,anx:5,nrg:-5,
    prose:[
      {text:"You leave at ten past ten. Your headphones are in but you're not really listening. The walk home is when the review starts. It always starts on the walk home."},
      {text:"First pass: the overall shape. It was a good evening. You were present for parts of it. There was a moment on the couch — that actual moment — that was real. Maya laughed at things you said. No one looked uncomfortable when you sat near them."},
      {text:"Second pass: the specifics. There was that thing you said about the film. You watched the person you said it to for a reaction and couldn't read it. And at the end of the night, when you hugged Maya goodbye, she seemed slightly distracted. She said she had work in the morning. She was probably just tired. She was probably—"},
      {type:'thought',text:"she was probably just tired. she said she had work in the morning. she was just tired."},
    ],
    choices:[
      {text:"She was tired. You had a good evening. Let it go.",next:'end_day',anx:-5},
      {text:"Text her. A quick 'tonight was nice' so you know she's okay.",next:'walk_home_text',note:'BPD/anxiety',anx:-10},
      {text:"Don't text. Sit with the uncertainty.",locked:true,reason:"you know yourself. you know how this ends if you don't resolve it. you can either text her now or text her at 2am."},
    ]
  },

  walk_home_text:{label:'night · the text',dep:-5,anx:-10,nrg:0,
    prose:[
      {type:'msg',name:'You',text:"tonight was so nice, thank you for having me ❤️"},
      {type:'msg',name:'Maya',text:"it really was!! so glad you came :) sleep well xx"},
      {text:"She responds in four minutes. The four minutes costs you, but the response lands clean and warm and you carry it the rest of the way home like something cupped in both hands, careful not to spill it."},
      {type:'thought',text:"see. she was just tired. you can put it down now. she said it was nice."},
    ],
    choices:[{text:"Go home.",next:'end_day'}]
  },

  end_day_alone:{label:'night · home',dep:5,anx:-5,nrg:5,
    prose:[
      {text:"You're home by 8pm. Your bedroom is the same as you left it. Quiet. Safe, in the immediate sense — nothing is required of you here."},
      {text:"You'll text Maya tomorrow. You'll say you weren't feeling well, which is true. You'll say you're sorry, which is also true, though you're sorry for a more specific thing than feeling unwell. She'll say it's fine. It will probably be fine."},
      {type:'thought',text:"you protected yourself tonight. that's allowed. you're allowed to do that."},
      {text:"The evening you didn't go to is happening somewhere without you, and you're here in the quiet, and both of those things are true at the same time. Tomorrow is a different calculation."},
    ],
    choices:[{text:"Try to sleep.",next:'try_sleep'}]
  },

  end_day:{label:'night · home',dep:-5,anx:-5,nrg:-5,
    prose:[
      {text:"You're home. Past ten. You went over the evening three times on the walk back — what you said, how it landed, the one moment where you went quiet and hoped she didn't notice. She probably didn't notice. She might have."},
      {text:"Your bed. The ceiling again. The same ceiling from this morning, except now it's dark and the day is behind you instead of in front of you, which changes what it means to lie here."},
      {type:'thought',text:"you got up. you got there. you came home. that is everything today. it has to be enough."},
      {text:"Tomorrow is a different morning. That's either comforting or terrifying depending on how you hold it. Right now, at 10:38pm, it's mostly just true."},
    ],
    choices:[{text:"Try to sleep.",next:'try_sleep'}]
  },

  try_sleep:{label:'night · 11:52pm',dep:0,anx:5,nrg:0,
    prose:[
      {text:"Lights off. Eyes open. This is the part nobody warns you about. Not the getting up, not the social calibration, not the stove or the split or the wardrobe paralysis. This part. The horizontal part, in the dark, when there's nothing to do but be inside your own head, uninterrupted."},
      {type:'thought',text:"okay. sleeping now. you're going to sleep now."},
      {text:"Your brain starts filing the day. This is normal. This is what brains do. Yours files more thoroughly than most, and cross-references as it goes. It finds the film comment. It finds the moment you went quiet. It finds Maya's hug at the end of the night and files it under: <em>slightly distracted — possible significance — review again in forty minutes.</em>"},
      {type:'thought',text:"stop. you already dealt with this. she texted back. she said it was nice."},
      {text:"You know all of this. Knowing it doesn't end the filing process. The brain is not interested in the verdict. It's interested in the evidence. It will continue to gather evidence. You have approximately four to six hours of this ahead of you, at which point exhaustion will make the decision your brain cannot."},
    ],
    choices:[
      {text:"Count your breaths. Something your therapist taught you.",next:'sleep_breathe',dep:-5},
      {text:"Pick up your phone. Not reading anything, just — the blue light.",next:'sleep_phone',note:'avoidance',anx:-10},
      {text:"Lie here and ride it out.",next:'sleep_wait'},
      {text:"Turn the light on and write some of it down.",next:'sleep_write',dep:-5},
      {text:"Let yourself think about what Maya actually sees when she looks at you.",spiral:'spiral_shame',note:'BPD shame'},
    ]
  },

  sleep_breathe:{label:'night · breathing',dep:-5,anx:-5,nrg:0,
    prose:[
      {text:"In for four. Hold for seven. Out for eight. You've done this enough times that the counting comes automatically now, which took a long time and is, you think, an accomplishment. Your therapist says it activates the parasympathetic nervous system. You say: I don't care what it activates, it works sometimes."},
      {text:"It works tonight, eventually. The filing slows. The film comment gets smaller. Maya's hug is just a hug — she was tired, she said she was tired. You are in your bed and the bed is familiar and the day is, at last, behind you."},
      {type:'thought',text:"you're okay. the day is done. you can put it down."},
    ],
    choices:[{text:"Sleep.",next:'__epilogue__'}]
  },

  sleep_phone:{label:'night · screen light',dep:0,anx:0,nrg:0,
    prose:[
      {text:"The screen is very bright. You turn the brightness down. You're not reading anything, not really scrolling — just existing in the blue light, letting it fill up the space where the thoughts were. It works, as a strategy, in the same way standing still works when you're cold. Technically true. Not actually okay."},
      {type:'thought',text:"you'll pay for this tomorrow. you know that. put it down and sleep."},
      {text:"Forty minutes later, your eyes are aching and the filing has slowed enough that sleep feels possible. You put the phone face-down on the bedside table. You make a note to do better tomorrow. You make this note most nights."},
    ],
    choices:[{text:"Sleep.",next:'__epilogue__',dep:5}]
  },

  sleep_wait:{label:'night · waiting',dep:5,anx:0,nrg:0,
    prose:[
      {text:"You lie there. The thoughts do what thoughts do. You try to observe them without getting caught in them — not following each one to its conclusion, just watching them pass. This is the goal. This is much harder than it sounds, which is something people say about meditation like it's a mild inconvenience rather than the hardest cognitive task you've ever attempted."},
      {type:'thought',text:"you don't have to resolve any of this tonight. none of it needs resolving tonight."},
      {text:"Around 1:40am, the brain runs out of material. You sleep. Tomorrow will be different, or it won't, or it will be different in a different way. Either way this exact day is over, and that is something."},
    ],
    choices:[{text:"Sleep.",next:'__epilogue__'}]
  },

  sleep_write:{label:'night · writing it down',dep:-10,anx:-5,nrg:0,
    prose:[
      {text:"You turn the lamp on. The notebook is in the drawer — always in the drawer, your therapist's suggestion from eight months ago that you kept. You write: <em>film comment. couldn't read the reaction. maya hug — probably tired. texted back, said nice.</em>"},
      {text:"The act of writing makes them smaller, somehow. They exist now outside your head, documented, filed somewhere you can find them if you need to. Which means your head doesn't have to hold them anymore. Your head is a little quieter without them."},
      {type:'thought',text:"okay. it's outside now. it's written down. you can sleep."},
    ],
    choices:[{text:"Sleep.",next:'__epilogue__',dep:-5}]
  },

};

var SPIRALS={
  spiral_morning:{
    lines:[
      "the presentation is at 10. you haven't prepared enough for the presentation.",
      "did you reply to that email from tuesday? you think you did. you're not sure you did.",
      "is Maya getting tired of how much you need right now? you've been a lot lately.",
      "the stove. you should check the stove before you leave. you haven't left yet but — the stove.",
      "you're going to be late. you're always late. people have noticed that you're always late.",
      "if the presentation goes badly today that's — you haven't even gotten out of bed yet.",
    ],
    dismiss:"breathe. come back."
  },
  spiral_shame:{
    lines:[
      "she's your friend because she decided to be before she knew what you were like.",
      "every time you check in, every time you need her to pick something or confirm something or tell you it's okay — she sees it.",
      "she's kind enough not to say anything. that's different from it not being there.",
      "you spent twenty minutes today convinced she didn't want you at her own party.",
      "you needed her to pick your outfit.",
      "and then you had a good time, and before you were even home you were already trying to make sure it couldn't be taken away.",
      "you are a lot of work. you have always been a lot of work.",
    ],
    dismiss:"that is the disorder talking. it is loud and it sounds true. it is not true.",
    note:"this is BPD shame. it arrives without warning and it sounds like facts. it isn't."
  }
};
