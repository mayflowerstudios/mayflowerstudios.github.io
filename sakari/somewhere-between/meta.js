/* ══════════════════════════════════════════════════════
   somewhere between — meta.js
   ══════════════════════════════════════════════════════ */

SAKARI.stories['somewhere-between'] = {
  id:       'somewhere-between',
  title:    'somewhere between',
  subtitle: 'an interactive story',
  tags: [
    { text: 'BPD',        style: 'rose'   },
    { text: 'DPD',        style: 'violet' },
    { text: 'anxiety',    style: ''       },
    { text: 'depression', style: ''       },
  ],
  langs: [
    { code: 'en', label: 'English'   },
    { code: 'de', label: 'Deutsch'   },
    { code: 'pt', label: 'Português' },
  ],
  desc: 'A day in the life of a girl navigating BPD, dependent personality disorder, anxiety, and depression — told from the inside. Some choices are locked. Not by the story. By the brain.',
  note: 'This is a beta — a single day, a sample of what Sakari is. More is coming.',
  cw:   'Realistic depictions of mental health struggles including intrusive thoughts, emotional dysregulation, splitting, and dissociation.',
  initialDep: 55,
  initialAnx: 70,
  initialNrg: 80,
  startScene: 'morning_1',
  days: [
    { label: 'day one', files: ['glossary.js', 'day1.js'] },
  ],
  epilogue: [
    { type: 'p',       text: 'This is one day. Not the worst one, not the best one. A day that cost a specific amount and ended with you in your bed, which is where most days end, which is something.' },
    { type: 'thought', text: 'you survived it. you do, most days. it just costs more than people know.' },
    { type: 'p',       text: 'BPD, dependent personality disorder, anxiety, and depression don\'t look like what people expect them to look like. They look like being nine minutes late and spending an hour dreading it. They look like twelve minutes in front of a wardrobe. They look like reading the same two words — "or no" — until they mean something they don\'t mean. They look like a person in a meeting, performing the posture of engagement. They look like someone having a perfectly good evening by anyone else\'s measure, and still going over it three times on the way home.' },
    { type: 'p',       text: 'If you have these disorders, or think you might: you are not too much. You are not broken. The things that are hard for you are genuinely hard — not because you\'re weak, but because you\'re doing significantly more cognitive and emotional work than most people do just to get through a morning. That\'s not a metaphor. That\'s physiology.' },
    { type: 'p',       text: 'If someone you know might have these disorders: the locked choices are the whole point. Those weren\'t options they chose not to take. Those were options their brain made genuinely unavailable. The checking, the reassurance-seeking, the inability to pick a top — none of it is manipulative, none of it is attention-seeking. It\'s a person doing the best they can with a brain that is working very hard against them.' },
    { type: 'thought', text: 'thank you for spending a day here.' },
  ],
  loaded:  false,
  scenes:  null,
  spirals: null,
  glossary: null,
};
