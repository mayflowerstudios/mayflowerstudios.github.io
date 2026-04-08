/* ══════════════════════════════════════════════════════
   Sakari — stories.js

   To add a new story:
   1. Create a folder under sakari/ with a slug name
   2. Add that slug to this array
   3. The hub picks it up automatically

   Folder must contain:
     meta.js       — story metadata
     glossary.js   — var GLOSSARY = { key: {title,body}, ... }
     [scene files] — listed in meta.js under days[].files
   ══════════════════════════════════════════════════════ */

var SAKARI_STORY_IDS = [
  'somewhere-between',
  'a-day-off-from-night-shift',
];
