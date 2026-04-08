/* ══════════════════════════════════════════════════════
   a day off from night shift — meta.js
   ══════════════════════════════════════════════════════ */

SAKARI.stories['a-day-off-from-night-shift'] = {
  id:       'a-day-off-from-night-shift',
  title:    'a day off from night shift',
  subtitle: 'an interactive story',
  tags: [
    { text: 'BPD',            style: 'rose'   },
    { text: 'DPD',            style: 'violet' },
    { text: 'depression',     style: ''       },
    { text: 'fibromyalgia',   style: ''       },
  ],
  desc: 'A day off. No alarm. No structure. An apartment, a project no one responded to, a person who went to sleep, a drawer that got closed. One quiet day in a life where quiet costs something.',
  cw:   'Depression, BPD, DPD, chronic pain, alcohol use, references to passive suicidal ideation and a safety plan. Crisis resources included.',
  initialDep: 55,
  initialAnx: 45,
  initialNrg: 65,
  startScene: 'wren_start',
  days: [
    { label: 'a day off', files: ['glossary.js', 'wren.js'] },
  ],
  epilogue: [
    { type: 'p',       text: 'That\'s a day off. One of the quiet ones — no crisis, no emergency, nothing that would make a good story if you tried to explain it to someone. Just the weight of ordinary things being heavier than they look from the outside.' },
    { type: 'thought', text: 'you made it through. that\'s what today was. you made it to the end of it.' },
    { type: 'p',       text: 'Depression, BPD, DPD, fibromyalgia. None of them arrived dramatically today. They arrived in the nine minutes before getting up. In the phone-checking. In the four hours that dissolved. In the server that stayed silent. In the specific quality of the quiet after someone went to sleep. In the nightstand. In the crying in the kitchen, which happened and was done.' },
    { type: 'p',       text: 'The locked choices are the point. Those weren\'t things she chose not to do. They were things that weren\'t available — routes her brain had marked impassable before she even reached them.' },
    { type: 'p',       text: 'If this day felt familiar: the amount of work it takes to get through a day like this — quiet, nothing-happened, just-getting-by — is real work. The drawer being closed is real work. Em watching the show is a real thing. Both of those are true at the same time.' },
    { type: 'thought', text: 'thank you for spending a day here.' },
  ],
  hidden:  true,   // set to false to show on hub
  loaded:  false,
  scenes:  null,
  spirals: null,
  glossary: null,
};
