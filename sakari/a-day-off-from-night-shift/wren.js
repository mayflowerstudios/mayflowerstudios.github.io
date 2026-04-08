/* ══════════════════════════════════════════════════════
   somewhere between — wren.js

   A day off. No alarm. The apartment. Cass. The project
   that no one uses. The nightstand. The drinking.

   Character name: Wren
   Favourite person: Cass
   Young person she looks out for: Em
   Creative project: Hollowmere (Discord RPG bot)
   ══════════════════════════════════════════════════════ */

var SCENES={

  wren_start:{label:'morning · day off · 10:14am',dep:5,anx:0,nrg:0,
    prose:[
      {text:"There's no alarm. That's the first thing — no alarm, no reason to be awake, nowhere to be. This is supposed to be a good thing. You lie here and try to locate the good thing."},
      {type:'thought',text:"it's quiet. you should be grateful it's quiet. why isn't the quiet enough."},
      {text:"The problem with days off is that they're yours. No structure handed to you, no tasks that exist before you make them, no reason to get up that isn't invented. You've been awake for twenty minutes and the day is already sitting on your chest with the full weight of its openness."},
      {type:'thought',text:"check your phone. maybe she messaged."},
    ],
    choices:[
      {text:"Check if Cass messaged. Just to see.",next:'wren_phone_check',note:'DPD/BPD',anx:5},
      {text:"Get up first. Don't start with the phone.",locked:true,reason:"you know you're going to check it. you've been not-checking it since you woke up. you're going to check it."},
    ]
  },

  wren_phone_check:{label:'morning · the check',dep:0,anx:0,nrg:0,
    prose:[
      {text:"Nothing. She sent a 'goodnight' at 11:47pm and that's the last message in the thread. That was ten hours ago. She's probably busy. She works. She has a life that has other people in it, other obligations, things that have nothing to do with whether or not your morning starts okay."},
      {type:'thought',text:"she'll message when she can. you know this. she always does."},
      {text:"You put the phone face-down on the mattress. You pick it up again. You put it face-down. This is a <span class='term' data-key='reassurance'>loop you already know</span> the shape of. The problem isn't that you know — it's that knowing only gets you as far as putting the phone down. It doesn't stop you picking it up."},
    ],
    choices:[
      {text:"Make coffee. Leave the phone in the bedroom.",next:'wren_morning_flat',nrg:-5},
      {text:"Send a 'morning :)'. Just so she knows you're awake.",next:'wren_good_morning',note:'BPD',anx:-5},
    ]
  },

  wren_good_morning:{label:'morning · sent',dep:0,anx:0,nrg:0,
    prose:[
      {type:'msg',name:'You',text:"morning :)"},
      {text:"The message sends. You put the phone down. You feel better for approximately ninety seconds, and then you feel slightly worse — not because anything bad happened, but because now the waiting is official. Before, you were just lying here. Now you're lying here waiting for something specific."},
      {type:'thought',text:"she might be in the shower. she might be at work early. she doesn't owe you a response by any particular time."},
      {text:"All of that is true. None of it stops the waiting from feeling like something is being withheld."},
    ],
    choices:[
      {text:"Get up. Make something to eat.",next:'wren_morning_flat',nrg:-5},
    ]
  },

  wren_morning_flat:{label:'morning · kitchen',dep:5,anx:0,nrg:0,
    prose:[
      {text:"You make coffee. You stand in the kitchen and drink it without tasting it. This is the <span class='term' data-key='anhedonia'>flatness</span> — not misery, not crisis, just an absence where the texture of things is supposed to be. The coffee is hot. That's what you register. Hot, and then not hot anymore."},
      {text:"Today is yours. You could work on Hollowmere. You've been meaning to add the weather system for two weeks and you have the time right now, you have all the time right now, the whole day is available and empty and waiting."},
      {type:'thought',text:"you should eat something first. you should probably eat something."},
      {text:"You're not hungry. You're also not not-hungry. Hunger is a sensation and you'd have to be more present than you currently are to notice sensations. You have coffee. That's approximately eating."},
    ],
    choices:[
      {text:"Open the laptop. Work on Hollowmere. Give the day a shape.",next:'wren_project_start'},
      {text:"Go back to bed. Just for another hour.",next:'wren_back_to_bed',dep:5,nrg:5},
    ]
  },

  wren_back_to_bed:{label:'morning · back in bed',dep:5,anx:0,nrg:0,
    prose:[
      {text:"The sheets are still warm. You lie back down and pick up your phone and scroll through things without reading them. An hour passes. Another. The light in the room changes."},
      {type:'thought',text:"okay. you need to get up. you've been in here long enough. you know how this ends if you stay."},
      {text:"You do know how this ends. You've lived the version where one hour becomes four and then it's past 3pm and the day has closed without you and you spend the evening managing the guilt of the wasted day on top of whatever else you were already carrying. You don't want to live that version today."},
    ],
    choices:[
      {text:"Get up. For real.",next:'wren_project_start',nrg:-5},
    ]
  },

  wren_project_start:{label:'afternoon · the project',dep:-5,anx:0,nrg:-5,
    prose:[
      {text:"Hollowmere opens in three terminals and a browser tab and a documentation page you wrote yourself four months ago when you knew exactly what you were building and why. You read the documentation. You know exactly what you were building and why. You open the right file and start."},
      {text:"This is the part nobody sees. Not the finished thing, not the version that runs — this part. The hours in a quiet apartment where it's just you and the problem and a steadily cooling cup of coffee. It's satisfying in a way that's hard to explain to people who don't do it. It's satisfying in a way that requires no one to witness."},
      {type:'thought',text:"you made something real. you keep making real things. that matters even when it doesn't feel like it does."},
      {text:"By early afternoon the weather system works. You test it. It works. You fix two things you noticed while testing and it works again, better. You sit back in your chair and feel, for a few minutes, the specific quality of this — the thing that was an idea this morning and now exists."},
    ],
    choices:[
      {text:"Post an update. Let the server see it.",next:'wren_post_update',dep:-5},
      {text:"Test it a few more times. Make sure it's right before showing anyone.",next:'wren_test_more',nrg:-5},
    ]
  },

  wren_test_more:{label:'afternoon · more testing',dep:0,anx:0,nrg:0,
    prose:[
      {text:"You test it six more times. It's right. It was right three tests ago but you needed to be sure — or more accurately, you needed to run out of reasons to wait, because showing something to people is a different act than building it and requires a different kind of nerve."},
      {type:'thought',text:"it's fine. it's good. you know it's good. just post it."},
    ],
    choices:[
      {text:"Post the update.",next:'wren_post_update'},
    ]
  },

  wren_post_update:{label:'afternoon · waiting again',dep:0,anx:5,nrg:0,
    prose:[
      {text:"You post it. Screenshot of the command running, brief description of what the weather system does, the work you put in. You close the laptop. You put your phone down. You feel proud — a real, clean pride, the kind that lives in your chest rather than your head."},
      {text:"You open your phone twenty minutes later. The update has been seen. Twelve people have been online since you posted it. There are no responses."},
      {type:'thought',text:"it's fine. people are busy. they'll see it."},
      {text:"Forty minutes. Then an hour. The server is active — you can see the activity indicator, the names cycling through voice channels. Hollowmere exists and runs and people are using it and not one of them has said anything about the weather system. About the hours this morning. About the fact that you made something real again."},
      {type:'thought',text:"why do you keep doing this to yourself. you know this is how it goes. you make something and you wait for it to matter to someone and it doesn't and you feel stupid for expecting it to."},
    ],
    choices:[
      {text:"Close the server tab. You built it for you. That has to be enough.",locked:true,reason:"you know that's the right thought. you cannot locate the part of yourself that believes it right now."},
      {text:"Post something else — maybe the explanation wasn't clear.",next:'wren_second_post',anx:5,dep:5},
      {text:"Close the laptop. Stop checking.",next:'wren_early_evening',dep:10},
    ]
  },

  wren_second_post:{label:'afternoon · the second post',dep:5,anx:5,nrg:-5,
    prose:[
      {text:"You write a longer explanation. You explain the mechanic, the edge cases, the reason it matters for the game world. You post it. It gets two thumbs-up reactions in the next ten minutes — people you've never spoken to in the server, quick and reflexive, the kind of reaction people give to acknowledge something without engaging with it."},
      {type:'thought',text:"two. two people. you spent four hours on this today and two people—"},
      {text:"You close the laptop. The pride from this morning is still there somewhere, technically — you built the thing, the thing works — but something has been laid over the top of it, something dulling. This is the pattern you've tried to explain to people who don't understand why you make things if it makes you feel like this. The answer is that the making part feels like the other answer. Until the silence after."},
    ],
    choices:[
      {text:"Go make something to eat. The day isn't over.",next:'wren_early_evening'},
    ]
  },

  /* ── FIBROMYALGIA FLARE ──────────────────────────── */

  wren_early_evening:{label:'evening · the ache',dep:0,anx:0,nrg:-10,
    prose:[
      {text:"The pain is there when you stand up. Not the sharp kind — the other kind. The kind that settles in slowly over hours until it's everywhere at once, a low-level insistence that lives in your joints and muscles and makes the ordinary weight of your body feel like too much to carry at normal speed."},
      {text:"This is the fibromyalgia doing what it does. You know this. There's no fixing it today — today is a flare day, which you would have told yourself earlier but the morning didn't feel like a flare day until it was the evening. You move slower. You stop at the counter. You wait for the worst of it to back off a little."},
      {type:'thought',text:"it's fine. you've done worse than this. you just need to eat something and sit down."},
      {text:"Once you called in sick because of this. The guilt lasted for days — the idea that you'd taken a sick day for something <em>invisible</em>, something no one would see on an X-ray or a scan, something you'd have to explain in terms most people have to decide whether to believe. Money you didn't make that week. <span class='term' data-key='executive'>The math your brain runs</span> on those days: pain on one side, cost of care on the other, and the cost of care winning every time by default."},
    ],
    choices:[
      {text:"Eat something. Sit down.",next:'wren_evening',nrg:5},
    ]
  },

  /* ── CASS ─────────────────────────────────────────── */

  wren_evening:{label:'evening · 7:53pm',dep:0,anx:5,nrg:0,
    prose:[
      {text:"Cass messages at 7:53. Your body does what your body does when her name appears — a loosening, something dropping from your shoulders before you've even read the message. This is what having a <span class='term' data-key='fp'>favourite person</span> does to your nervous system. Her name arrives and the room shifts half a degree warmer."},
      {type:'msg',name:'Cass · 7:53pm',text:"sorry i've been quiet today!! how was your day off"},
      {type:'thought',text:"she asked. she remembered it was your day off and she asked."},
      {text:"You think about what to say. The real answer exists in a list that includes: I barely left the apartment. I made something and no one cared. My bones hurt. I've been waiting for this message since 10am. The real answer has a lot of things in it that you don't say."},
    ],
    choices:[
      {type:'wanted',wanted:"today was kind of hard. i built something and it hurt when no one responded and my pain is bad and i've been waiting for you all day and i don't know how to say any of that without sounding like i'm asking you to fix it.",sent:"haha it was okay, worked on hollowmere a bit! how was yours"},
      {text:"Actually tell her some of it. She asked.",next:'wren_honest_cass',note:'vulnerability'},
      {text:"Tell her the short version. It's easier.",next:'wren_short_version'},
    ]
  },

  wren_honest_cass:{label:'evening · telling her',dep:-5,anx:-5,nrg:0,
    prose:[
      {type:'msg',name:'You',text:"it was kind of quiet. i built something new for hollowmere but got in my head about the response. fibro was bad today too"},
      {type:'msg',name:'Cass',text:"oh no :( im sorry. that's a lot for one day"},
      {type:'msg',name:'Cass',text:"for what it's worth, the fact that you built something while feeling like that?? that's genuinely impressive"},
      {type:'thought',text:"she said genuinely. she used the word genuinely."},
      {text:"The relief of this — being partially known, having some of the real thing received and not discarded — is different from the relief of a normal reassurance. It has a slightly longer half-life. You carry it around the rest of the evening as a fact rather than a feeling, something that exists independent of whether you keep checking for it."},
    ],
    choices:[
      {text:"Keep talking to her for a while.",next:'wren_cass_evening'},
    ]
  },

  wren_short_version:{label:'evening · keeping it brief',dep:0,anx:0,nrg:0,
    prose:[
      {type:'msg',name:'You',text:"haha it was okay, worked on hollowmere a bit! how was yours"},
      {type:'msg',name:'Cass',text:"productive! long day though. gonna wind down soon i think"},
      {type:'thought',text:"winding down. okay. so not long."},
      {text:"'Winding down soon' has a clock attached to it. You do the math. Thirty minutes, maybe an hour. This is not a lot of time and you know you're already spending the time you have doing this calculation instead of talking to her, which means the time you have is getting shorter and you're the one making it shorter."},
    ],
    choices:[
      {text:"Just talk to her. Stop doing the math.",next:'wren_cass_evening',anx:5},
    ]
  },

  wren_cass_evening:{label:'evening · 9:31pm',dep:0,anx:5,nrg:0,
    prose:[
      {text:"You talk for an hour and a half. She makes you laugh twice — actual laugh, the kind that surprises you — and asks about the weather system and actually wants to know how it works, and by 9pm the apartment feels less like a container and more like a place you live."},
      {text:"At 9:31 she says she has to sleep. She has an early morning. She says she'll talk to you tomorrow."},
      {type:'msg',name:'Cass · 9:31pm',text:"okay i'm falling asleep lol, talk tomorrow? ❤️"},
      {type:'thought',text:"tomorrow. it's fine. she said tomorrow. she said the heart."},
      {text:"The thing that happens next is not about Cass. You know this. You know that what's coming is yours — <span class='term' data-key='abandonment'>the drop</span>, the specific quality of the quiet after she goes, the room that was warm a moment ago and is now just a room. She didn't leave. She went to sleep. Those are different things and they feel the same right now."},
    ],
    choices:[
      {text:"Reply 'okay, sleep well ❤️' and sit with it.",next:'wren_after_cass'},
      {text:"Send one more message. Just to extend it a minute.",next:'wren_one_more',note:'BPD/DPD',anx:-5},
    ]
  },

  wren_one_more:{label:'evening · one more',dep:0,anx:0,nrg:0,
    prose:[
      {type:'msg',name:'You',text:"okay!! hope tomorrow's not too rough ❤️"},
      {type:'msg',name:'Cass',text:"thanks :) night!!"},
      {text:"And then she's gone. You got one more message. It was warm and brief and it didn't change anything, which is not a criticism of Cass or the message, which is just the nature of this — no amount of messages changes the fact that eventually she's going to go to sleep and you're going to be in the apartment alone. One more message only ever delays that by ninety seconds. You knew this. You sent it anyway."},
    ],
    choices:[
      {text:"Sit with the quiet.",next:'wren_after_cass'},
    ]
  },

  wren_after_cass:{label:'evening · after',dep:10,anx:0,nrg:0,
    prose:[
      {text:"The apartment is quiet. It was quiet all day too, but this is a different quality of quiet — the kind that has a shape to it, an outline, because something was here and now isn't."},
      {text:"You know this is the part that isn't her fault. You've been over this enough times to have filed it: she goes to bed, you feel abandoned, the feeling is not evidence of anything. You <em>know</em> this. You also feel, right now, very alone in an apartment on a day that cost more than it gave."},
      {type:'thought',text:"this is just what nights are. it's not her. you know it's not her."},
      {text:"There's a bottle on the kitchen counter. Not a lot left in it, but some. There's also the thing on your nightstand — the small orange bottles that live there as a specific kind of insurance policy, the ones you've never fully decided what to do with, the ones your therapist doesn't ask about directly and you don't bring up directly and both of you orbit around like something that can be left unnamed as long as neither of you says it."},
    ],
    choices:[
      {text:"Make tea. Don't think about either of them.",next:'wren_tea',dep:-5,anx:-5},
      {text:"Pour a drink. Something to make the edges less sharp.",next:'wren_drink',note:'coping',dep:5},
      {text:"Check on Em. She messaged earlier.",next:'wren_em'},
    ]
  },

  /* ── EM ───────────────────────────────────────────── */

  wren_em:{label:'evening · Em',dep:-10,anx:-5,nrg:0,
    prose:[
      {text:"Em messaged at 4pm — something small, something about a show she watched, the kind of message that's also a check-in but doesn't announce itself as one. This is how she communicates. You've learned to read the shape of her messages as well as their content."},
      {type:'msg',name:'Em · 4:07pm',text:"ok so i watched the first three episodes of the show you recommended and i hate you for it because now i have to watch the rest"},
      {type:'thought',text:"she watched it. she actually watched it."},
      {text:"There is a specific warmth that comes from this — from being the person someone brings their good things to. You didn't earn it by being stable or consistent or a person with everything figured out. She just decided you were safe. She keeps deciding that. On the worst days, this is one of the things you hold onto: that she texts you when something good happens, the same way she texts you when something doesn't."},
      {type:'msg',name:'You',text:"i told you!! it only gets worse. how far did you get"},
    ],
    choices:[
      {text:"Talk to her for a while.",next:'wren_em_chat'},
    ]
  },

  wren_em_chat:{label:'evening · Em (cont.)',dep:-5,anx:-10,nrg:0,
    prose:[
      {text:"You talk for forty minutes. She's funny in the specific way teenagers are funny when they don't know they're being funny, which is the best kind. You stop noticing the quiet. You stop doing the mental arithmetic about Cass. Em asks how your day was and you say 'pretty okay actually' and mean it, which is not what you would have said an hour ago."},
      {type:'thought',text:"you matter to her. she talks to you because she wants to. that's real. hold that."},
      {text:"She signs off to do homework. You sit with the warm feeling for a while before the rest of the evening reasserts itself. It's 10:45pm. The apartment is quiet again. The bottle is still on the counter."},
    ],
    choices:[
      {text:"Make tea. Go to bed.",next:'wren_tea',dep:-5},
      {text:"Pour a drink. You've earned at least that.",next:'wren_drink',note:'coping'},
    ]
  },

  /* ── THE DRINK ────────────────────────────────────── */

  wren_drink:{label:'night · the drink',dep:5,anx:-10,nrg:0,
    prose:[
      {text:"You pour it. Settle onto the couch. Let it do what it does — soften the edges, turn down the volume on the parts of the evening that are still running in your head. It works. That's the honest answer. In the short term it works, and the short term is what you have right now."},
      {text:"The part of you that knows things knows: this is stress relief the way eating paper would be stress relief. It occupies the motion without addressing the hunger. It is a way to get through the night without being present for the night, which is sometimes exactly what you can manage."},
      {type:'thought',text:"you're not doing anything wrong. you're just sitting here. you're fine."},
      {text:"At some point you're crying. Not dramatically — just sitting there with a drink and a wet face, which is its own distinct category of bad night. Not the worst kind. Not the kind that requires action. Just the kind that has to happen sometimes, quietly, in a kitchen with the lights low."},
    ],
    choices:[
      {text:"Let it pass. It always passes.",next:'wren_nightstand'},
      {text:"Text Cass. Even though she's asleep.",next:'wren_text_sleeping',note:'BPD'},
    ]
  },

  wren_text_sleeping:{label:'night · the text she won\'t see',dep:0,anx:0,nrg:0,
    prose:[
      {type:'msg',name:'You',text:"i know you're asleep, i just wanted to say tonight was nice. even the short bit. okay goodnight ❤️"},
      {text:"You send it to an empty chat window. She's asleep. She'll see it tomorrow. There's something about sending a message you know won't be answered tonight that is its own small mercy — the gesture of reaching without the waiting for a response, without the loop. You sent it. That's enough."},
      {type:'thought',text:"she'll see it tomorrow. she'll respond tomorrow. that's enough for tonight."},
    ],
    choices:[
      {text:"Go to bed.",next:'wren_nightstand'},
    ]
  },

  wren_tea:{label:'night · tea',dep:0,anx:-5,nrg:0,
    prose:[
      {text:"Kettle. Mug. The particular sound the kettle makes right before it boils, which is a sound you know as well as any sound you know. Holding a warm mug is — it's something. It doesn't fix anything. It is warm and you are holding it and that is a small real thing in a room full of less solid things."},
      {type:'thought',text:"you made it through today. it was a hard day and you're still here. that's what matters right now."},
    ],
    choices:[
      {text:"Go to bed.",next:'wren_nightstand'},
    ]
  },

  /* ── THE NIGHTSTAND ───────────────────────────────── */

  wren_nightstand:{label:'night · 11:43pm',dep:0,anx:10,nrg:0,
    prose:[
      {text:"Your bedroom. The nightstand. You sit on the edge of the bed and look at the small orange bottles the way you look at them some nights — not reaching for them, not doing anything, just acknowledging their presence the way you acknowledge the presence of a door. They're there. You know they're there. You've had a plan for them, loosely, the way you'd have a plan for any emergency exit — something to know about, something that exists, not necessarily something for today."},
      {type:'thought',text:"not tonight. tonight was hard but it wasn't that. tonight you texted em and she watched the show. cass said heart. that was today."},
      {text:"This is the part your therapist doesn't know the details of and you haven't corrected. Not because you're hiding it exactly — more because the explaining would require a vocabulary that makes it sound more acute than it usually is. Most nights you just look at them. Most nights you close the drawer. That's what happening right now is: <em>most nights</em>. The drawer closes."},
    ],
    choices:[
      {text:"Close the drawer. You know what tonight is.",next:'wren_try_sleep',dep:-5},
      {text:"Sit with it a little longer. You just need a minute.",spiral:'spiral_wren_nightstand'},
    ]
  },

  wren_try_sleep:{label:'night · lying down',dep:0,anx:5,nrg:0,
    prose:[
      {text:"Lights off. The ceiling is different at night — shadow and shape rather than the flat surface you stared at this morning. You've been looking at this ceiling for long enough to know its geography."},
      {text:"The day files itself. The weather system. The silence after. Cass's name at 7:53, the warmth of it. Em watching the show. The crying in the kitchen, which happened and is done. The drawer, closed."},
      {type:'thought',text:"you made it. that's today. you made it to the end of it."},
      {text:"There are people who have days like this and don't know the vocabulary for what they're having. Who think the waiting for messages and the inability to choose a direction and the drop when someone goes to sleep are personality flaws rather than named things — <span class='term' data-key='fp'>diagnosable</span>, <span class='term' data-key='dpd'>documented</span>, <span class='term' data-key='abandonment'>studied</span>. You know the vocabulary. Knowing it doesn't make today shorter. It makes it slightly less lonely to have had."},
    ],
    choices:[
      {text:"Count your breaths. Four in, hold seven, out eight.",next:'wren_sleep_breathe',dep:-5},
      {text:"Think about what Cass will say when she sees the message tomorrow.",next:'wren_sleep_cass',anx:5},
      {text:"Write something down. Get it outside your head.",next:'wren_sleep_write',dep:-5},
      {text:"You're too tired to manage it. Just lie here.",next:'wren_sleep_wait'},
      {text:"Think about what Em said about the show.",next:'wren_sleep_em',dep:-10},
      {text:"Let yourself follow the thought that started earlier. The one about whether there's any version of this that gets easier.",spiral:'spiral_wren_future'},
    ]
  },

  wren_sleep_breathe:{label:'night · breathing',dep:-5,anx:-5,nrg:0,
    prose:[
      {text:"In for four. Hold for seven. Out for eight. The ceiling. The dark. The sound of the building — pipes, somewhere, the ambient weight of a structure that contains many lives, none of which are aware of yours right now, all of which are just being lived in adjacent rooms."},
      {type:'thought',text:"you're here. this is just the ceiling. the drawer is closed."},
      {text:"Eventually the day loosens its grip. Not because it resolved — nothing resolved, the server is still quiet, the nightstand is still what it is — but because the body has a limit to how long it can hold things at full tension. Sometime around 1am, exhaustion makes the decision."},
    ],
    choices:[{text:"Sleep.",next:'__epilogue__'}]
  },

  wren_sleep_cass:{label:'night · tomorrow morning',dep:-5,anx:0,nrg:0,
    prose:[
      {text:"She'll wake up and see it. She'll probably reply before she's even out of bed. She'll say something small and warm — she usually does. The message exists in her inbox right now, waiting to be read by a version of her that's asleep and doesn't know it's there yet."},
      {type:'thought',text:"she'll see it. it'll be the first thing. okay. okay that's enough."},
      {text:"This is a coping mechanism your brain invented because it works better than most of the alternatives: give the waiting a shape, give it an endpoint, and the gap between now and the endpoint becomes containable. Tomorrow morning. She'll see it tomorrow morning. You can wait until tomorrow morning."},
    ],
    choices:[{text:"Sleep.",next:'__epilogue__',dep:-5}]
  },

  wren_sleep_write:{label:'night · the notebook',dep:-5,anx:-5,nrg:0,
    prose:[
      {text:"Lamp on. The notebook from the drawer — the other drawer, the good drawer. You write: <em>built the weather system. no one responded. fibro was bad. cass messaged. em watched the show. the drawer is closed. i made it through today.</em>"},
      {text:"You reread it. It's an honest list. The things that happened, in order, without commentary. The drawer is closed exists next to em watched the show and neither of them is less true for the presence of the other."},
      {type:'thought',text:"okay. it's written. it's outside. that's today."},
    ],
    choices:[{text:"Sleep.",next:'__epilogue__',dep:-5}]
  },

  wren_sleep_wait:{label:'night · waiting it out',dep:5,anx:0,nrg:0,
    prose:[
      {text:"You lie there and let it run. The brain needs to file what it needs to file and you don't have the energy to manage the process right now. You are too tired to be strategic about it. You let the day pass through you in whatever order it wants."},
      {type:'thought',text:"it doesn't have to be resolved tonight. nothing needs to be resolved tonight."},
      {text:"Eventually the ceiling is just a ceiling and sleep arrives the way it does when you stop trying to get there — sideways, through the gap you stopped guarding."},
    ],
    choices:[{text:"Sleep.",next:'__epilogue__'}]
  },

  wren_sleep_em:{label:'night · the show',dep:-10,anx:-10,nrg:0,
    prose:[
      {text:"She watched three episodes. She texted you to complain about it because when something gets its hooks into her she brings it to you. You think about the next time she messages — the update, probably, the indignant recap of something that happened in episode four. You're going to enjoy that conversation."},
      {type:'thought',text:"that's a real thing. that's happening. you have something to look forward to."},
      {text:"You don't look forward to things much. You've learned to be careful with hope because of what happens when it doesn't land. But this is small — a text, a fifteen-year-old complaining about a show — and small things are easier to hold. Small things are harder to lose."},
    ],
    choices:[{text:"Sleep.",next:'__epilogue__',dep:-5}]
  },

};

var SPIRALS={

  spiral_wren_nightstand:{
    lines:[
      "today was a day off and you spent it alone and made something for people who didn't notice.",
      "your bones hurt and you cried in the kitchen and you're thirty-something and this is still your life.",
      "cass went to sleep and the apartment went quiet and nothing you did changed that.",
      "em is fifteen and handling things better than you are.",
      "the bottles are right there. they've been right there for months. that's not nothing.",
      "you know what a plan is. you know you have one. even if you haven't said it out loud.",
      "you made it through today. that's what tonight is. you just have to make it through tonight.",
    ],
    dismiss:"close the drawer. you made it through today. tonight is not different.",
    note:"if tonight is different — if it's not 'most nights' — the crisis line is 988. you're allowed to call it. it exists for nights exactly like this one."
  },

  spiral_wren_future:{
    lines:[
      "what if the numbness is just — what you are now. what if you adjusted to it without noticing.",
      "what if cass figures out eventually that the amount you need is more than it's fair to ask.",
      "what if the server stays quiet and hollowmere stays something only you care about.",
      "what if knowing the vocabulary for all of this — fp, dpd, abandonment fear — what if that's as good as it gets.",
      "what if it isn't, though.",
      "what if today was just a hard day and not evidence.",
      "what if em watching the show is evidence too.",
    ],
    dismiss:"one day is not a diagnosis. come back.",
    note:"the spiral is not telling you the future. it's telling you how tonight feels. those are different things."
  },

};
