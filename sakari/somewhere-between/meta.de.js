/* somewhere between — meta.de.js
   Patches story metadata into German. Loaded before day files. */
(function(){
  var m=SAKARI.stories['somewhere-between'];if(!m)return;
  m.title    = 'irgendwo dazwischen';
  m.subtitle = 'eine interaktive Geschichte';
  m.desc     = 'Ein Tag im Leben eines Mädchens, das mit BPS, abhängiger Persönlichkeitsstörung, Angst und Depression navigiert — von innen erzählt. Manche Entscheidungen sind gesperrt. Nicht von der Geschichte. Vom Gehirn.';
  m.note     = 'Dies ist eine Beta-Version — ein einziger Tag, ein Einblick in das, was Sakari ist. Mehr folgt.';
  m.cw       = 'Realistische Darstellungen psychischer Erkrankungen, einschließlich aufdringlicher Gedanken, emotionaler Dysregulation, Splitting und Dissoziation.';
  m.epilogue = [
    {type:'p',    text:'Das ist ein Tag. Nicht der schlimmste, nicht der beste. Ein Tag, der einen bestimmten Preis hatte und damit endete, dass du in deinem Bett lagst — was so ist, wie die meisten Tage enden, was an sich schon etwas ist.'},
    {type:'thought',text:'du hast es überlebt. das tust du meistens. es kostet nur mehr, als die meisten wissen.'},
    {type:'p',    text:'BPS, abhängige Persönlichkeitsstörung, Angst und Depression sehen nicht so aus, wie Menschen es erwarten. Sie sehen so aus, als würde man neun Minuten zu spät kommen und eine Stunde damit verbringen, es zu befürchten. Sie sehen aus wie zwölf Minuten vor einem Kleiderschrank. Wie das Lesen derselben zwei Wörter — „oder nicht" — bis sie etwas bedeuten, das sie nicht bedeuten. Wie eine Person in einem Meeting, die die Körperhaltung von Engagement vorspielt. Wie jemand, der nach allen anderen Maßstäben einen wunderbaren Abend hat und ihn trotzdem dreimal auf dem Heimweg durchgeht.'},
    {type:'p',    text:'Wenn du diese Erkrankungen hast oder vermutest, dass du sie haben könntest: Du bist nicht zu viel. Du bist nicht kaputt. Die Dinge, die schwer für dich sind, sind wirklich schwer — nicht weil du schwach bist, sondern weil du erheblich mehr kognitive und emotionale Arbeit leistest als die meisten Menschen, nur um durch einen Morgen zu kommen. Das ist keine Metapher. Das ist Physiologie.'},
    {type:'p',    text:'Wenn jemand, den du kennst, diese Erkrankungen haben könnte: Die gesperrten Entscheidungen sind der Kern der Sache. Das waren keine Optionen, die sie gewählt haben, nicht wahrzunehmen. Das waren Optionen, die ihr Gehirn wirklich unzugänglich gemacht hat. Das Kontrollieren, das Suchen nach Bestätigung, die Unfähigkeit, ein Oberteil auszuwählen — nichts davon ist manipulativ, nichts davon ist auf Aufmerksamkeit ausgerichtet. Es ist ein Mensch, der das Beste tut, was er kann, mit einem Gehirn, das sehr hart gegen ihn arbeitet.'},
    {type:'thought',text:'danke, dass du hier einen tag verbracht hast.'},
  ];
})();
