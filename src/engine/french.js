// French dictation support (deterministic, rule-based).
// The extraction rules in extract.js are written for English clinical phrasing. Rather than duplicating
// every rule, a French transcript is first rewritten phrase by phrase into the English wording those rules
// already understand ("couronnes zircone sur 7 implants" -> "zirconia crowns on 7 implants"), so a French
// note produces exactly the same plan as the same note in English. Only clinical words, numbers, prices,
// stages and timing are rewritten; everything else is left as dictated, and the dentist's own French
// lines are put back on the plan wherever a line was kept as-is (notes, item sources, unpriced lines).
// Prices still come only from the clinic price list: this file never touches a price-list item.

const L = '\\p{L}\\d';
// Whole-word regex that also works with accented letters (\b does not in JS).
// (No trailing guard when the pattern already ends in a lookahead or a space.)
// Spaces in a pattern also match line breaks (a phrase can wrap onto the next line).
const W = (p, flags = 'giu', tail = !/(\(\?=.*\)|\\s\*| )$/.test(p)) =>
  new RegExp(`(?<![${L}])(?:${p.replace(/ (?![*?+]|$)/g, '\\s+')})${tail ? `(?![${L}])` : ''}`, flags);
const V = p => W(p, 'iu', false); // correction verbs: no trailing guard
const keepCase = (src, rep) => (/^\p{Lu}/u.test(src) && rep ? rep[0].toUpperCase() + rep.slice(1) : rep);

const UNITS = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9 };
// FDI tooth numbers spoken in words: "quarante-cinq" -> 45, "vingt et un" -> 21, "seize" -> 16.
const TEENS = { onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16, 'dix[- ]sept': 17, 'dix[- ]huit': 18 };
const TENS = { vingt: 2, trente: 3, quarante: 4 };

const COUNTED = 'implants?|couronnes?|dents?|vis|piliers?|segments?|sextants?|sites?|mod[eè]les?|packs?|kits?|mois|semaines?|jours?|heures?|c[oô]t[ée]s?|x(?![\\p{L}])|greffes?|scans?|anesth[ée]sies?|extractions?|provisoires?';

// Ordered rewrite table: [French pattern (whole words, case-insensitive), English replacement].
// Longer / more specific phrases come first.
const PHRASES = [
  // --- stages & timing ---
  ["(?:1re|1ère|1ere|premi[eè]re) (?:visite|s[ée]ance|consultation)", '1st visit'],
  ['(?:apr[eè]s|au bout d[e\']|dans|d\'ici)\\s*(?:environ\\s*)?(?=\\d)', 'after '],
  ['environ', 'approximately'],
  ['(?<![\\d.])(?<=1 )mois', 'month'], ['mois', 'months'], ['semaines?', 'weeks'], ['jours?', 'days'], ['heures?', 'h'],
  // --- consumables & hygiene ---
  ["kits? (?:d'hygi[eè]ne )?(?:[àa] )?usage unique|kits? d'hygi[eè]ne(?: (?:[àa] )?usage unique)?", 'single-use hygiene kit'],
  ['(?:packs?|kits?|sachets?|sets?) (?:de |d[\'e] )?st[ée]rili[sz]ation', 'sterilisation pack'],
  ['(?:d[ée]tartrage[- ]et[- ]|d[ée]tartrage[- ])?surfa[çc]age(?: radiculaire)?', 'scaling and root planing'],
  ['sextants?', 'segment'],
  ['hygi[eè]ne (?:pr[ée][- ]?op[ée]ratoire|professionnelle)|d[ée]tartrage', 'pre-operative hygiene'],
  // --- surgery ---
  ['(?:sinus lift|soulev[ée] (?:de|du) sinus|[ée]l[ée]vation (?:du (?:plancher )?)?(?:sinus|sinusienne)(?: maxillaire)?|comblement sinusien|greffe sinusienne)(?: (?:ferm[ée]|par voie crestale|crestal))', 'closed sinus lift'],
  ['sinus lift|soulev[ée] (?:de|du) sinus|[ée]l[ée]vation (?:du (?:plancher )?)?(?:sinus|sinusienne)(?: maxillaire)?|comblement sinusien|greffe sinusienne', 'sinus lift'],
  ["(?:pendant|lors de|au moment de|au cours de) la pose (?:des |de |d')?(\\d+|one) implants?", 'during placement of $1 implants'],
  ["(?:pendant|lors de|au moment de|au cours de) la pose(?: (?:des|de l'|d'|du)\\s*implants?)?", 'during implant placement'],
  ["(?:avant|pr[ée]alablement [àa]) la pose (?:des|de l'|d'|du)\\s*implants?", 'before implant placement'],
  ['(?:greffe|augmentation|reconstruction) osseuse pr[ée]alable|greffe d\'os pr[ée]alable', 'prior bone grafting'],
  ["(?:l')?(?:greffe osseuse|greffe d'os|greffe de l'os|ROG|r[ée]g[ée]n[ée]ration osseuse(?: guid[ée]e)?)", 'bone grafting'],
  ["(?:l')?(?:augmentation|reconstruction) osseuse", 'bone augmentation'],
  ['comblement (?:osseux|alv[ée]olaire)|pr[ée]servation alv[ée]olaire', 'bone grafting'],
  ["autour d'(?:un|une|one) (?:seul )?implant", 'around one implant'],
  ['autour de chaque implant', 'around each implant'],
  ['autour (?:des|de)', 'around'],
  ['(?:technique (?:de la |du )?)?lamina|technique de la coque', 'lamina'], ['coque osseuse', 'bone shell'],
  ["(?:vis|piliers?) de cicatrisation", 'healing abutments'],
  ['vis de couverture|vis de fermeture', 'cover screws'],
  ['greffes? (?:gingivales?|de gencive|de tissus? (?:mous?|conjonctifs?)|conjonctives?)', 'gingival grafting'],
  ['anesth[ée]sies? locales?', 'local anaesthesia'],
  ['sans s[ée]dation', 'without sedation'],
  ['s[ée]dation(?: consciente| intraveineuse)?', 'sedation'],
  ["guide chirurgical", 'surgical guide'],
  ['(?:radio(?:graphie)?s?|clich[ée]s?)(?: (?:panoramiques?|dentaires?|r[ée]tro[- ]alv[ée]olaires?))?|panoramiques? dentaires?|panoramiques?', 'dental radiograph'],
  // --- extractions ---
  ["(?:n'ont|n'a|ne doivent|ne doit) pas (?:besoin d'[êe]tre|[êe]tre) extraites?|pas besoin d'(?:extraire|extraction)|(?:ne pas|ne rien) extraire|inutile d'extraire|aucune extraction", 'do not need to be extracted'],
  ['doivent [êe]tre extraites?|doit [êe]tre extraite?', 'need to be extracted'],
  ['extraire les', 'extract the'], ['extraire', 'extract'], ['avulsions?', 'extraction'],
  ['dents? de devant|incisives|dents? ant[ée]rieures?', 'front teeth'],
  ["(?:elle|il) (?:a )?dit|(?:le|la) patiente? (?:a )?dit", 'she said'],
  ["(?:le|la) patiente? (?:veut|souhaite)", 'patient wants'],
  ["n'aime pas", "doesn't like"],
  // --- prosthetics ---
  ["(?:l')?(?:obturation|fermeture|scellement|comblement) (?:des|du) puits (?:d'acc[eè]s|de vissage)(?: (?:des|de la) vis)?", 'sealing of the screw-access channels'],
  ['(?:par|chaque) implant', 'per implant'], ['(?:par|chaque) couronne', 'per crown'], ['(?:par|chaque) c[oô]t[ée]', 'per side'],
  ['couronnes? provisoires?|provisoires? sur implants?', 'temporary crowns'],
  ['provisoires?', 'temporaries'],
  ['implants? (?:en |de )?zircone|implants? c[ée]ramiques?', 'zirconia implant'],
  ['couronnes? (?:en |tout )?zircone', 'zirconia crowns'],
  ['couronnes? (?:en )?(?:c[ée]ramique|c[ée]ramo[- ]m[ée]tallique|c[ée]ramo[- ]c[ée]ramique)', 'ceramic crown'],
  ['couronnes? (?:d[ée]finitives?|permanentes?|finales?)', 'final crowns'],
  ['couronnes', 'crowns'], ['couronne', 'crown'],
  ['zircone', 'zirconia'],
  ["mod[eè]les?(?: d'[ée]tude| en pl[âa]tre)?", 'model'],
  ["(?:scans?|scanner|empreintes? (?:num[ée]riques?|optiques?))\\s+(?:de|des|du|d')\\s*", 'scan of '],
  ["(?:scans?|empreintes? (?:num[ée]riques?|optiques?))(?= (?:sur|des|de)?\\s*implants?)", 'implant scan'],
  ['col de l\'implant', 'implant neck'], ['peut se fissurer|risque de (?:se )?fissurer|peut casser', 'may crack'],
  ['cor[ée]ens?|cor[ée]ennes?', 'Korean'],
  // --- unpriced ---
  ['meulage|coronoplastie|remodelage|meuler|remodeler', 'reshape (grind)'],
  ["h[ée]bergement|logement", 'accommodation'],
  ['soins conservateurs|traitements? conservateurs?|soins dentaires|soins restaurateurs', 'restorative (therapeutic) treatment'],
  // --- placement verbs ---
  ["pose d'(?:un|une|one)", 'placement of one'], ['pose (?:de|des)', 'placement of'], ['poser', 'place'],
  // --- discounts / free ---
  ['militaires?', 'military serviceman'],
  ['gratuite?s?|offerte?s?|sans frais|pris(?:e)? en charge (?:[àa] )?100\\s*%', 'free of charge'],
  ['dans le cadre du programme', 'under the programme'],
  ['avec (?:une |la )?(?:remise|r[ée]duction|ristourne)(?= *(?:$|[,.;)\\n–-]))', 'with discount'],
  ['(?:une |la )?(?:remise|r[ée]duction|ristourne|rabais) (?:de )?(\\d+%)', 'a $1 discount'],
  ['(?:une |la )?(?:remise|r[ée]duction|ristourne|rabais) (?:sur|pour)', 'discount on'],
  ['remise|r[ée]duction|ristourne|rabais', 'discount'],
  // --- uncertainty ---
  ['[ée]ventuellement|peut-[êe]tre|possiblement|[àa] envisager', 'possibly'],
  // --- prices ---
  ['(?:au prix de |[àa] )(?=\\d[\\d.,]*\\s*(?:€|EUR))', 'at '],
  ['pi[eè]ce|chacune?|l\'unit[ée]|(?:par )?unit[ée]', 'each'],
  ['c[oô]t[ée]s?', 'side'],
  // --- teeth & connectors ---
  ['dents', 'teeth'], ['dent', 'tooth'],
  ['(?:sur|de|à|a) (?:la|le) (?=[1-4][1-8](?![\\d]))', 'on tooth '],
  ['(?:en|au niveau de la|au niveau du|au niveau des) (?=[1-4][1-8](?![\\d]))', 'at site '],
  ['sur (?:les|des)? ?(?=(?:\\d+|one) implants?)', 'on '],
  ['sur (?:les|des) implants', 'on the implants'],
  ['sur implants?', 'on implants'],
  ['hygi[eè]ne', 'hygiene'],
  ['avec', 'with'], ['et aussi', 'and also'], ['et', 'and'], ['ou', 'or'],
];
const RX = PHRASES.map(([p, r]) => [W(p), r]);

const looksRe = W('[ée]tape|couronnes?|greffe|cicatrisation|s[ée]dation|hygi[eè]ne|apr[eè]s|mois|avec|pour|sur|les|des|une|dents?|pose|remise|extraire|provisoires?|supprimer?|enl[eè]ve|retire|d[ée]place|ajoute|mets|applique|prix|patiente?|devis');
const enRe = /\b(stage|crowns?|graft|healing|the|with|after|months|teeth|tooth|placement|remove|move|add|price|discount)\b/gi;
export function looksFrench(text = '') {
  const fr = (String(text).match(looksRe) || []).length, en = (String(text).match(enRe) || []).length;
  return fr >= 1 && fr > en;
}

function numbers(t, segment = true) {
  // spoken punctuation
  t = t.replace(W('point [àa] la ligne|nouvelle ligne|[àa] la ligne'), '\n').replace(W('virgule'), ',').replace(W('deux[- ]points'), ':').replace(W('point final'), '.');
  // spoken FDI tooth numbers and spelled-out quantities
  for (const [w, n] of Object.entries(TEENS)) t = t.replace(W(w), String(n));
  for (const [tw, d] of Object.entries(TENS)) {
    t = t.replace(W(`${tw}(?:[- ]et[- ]|-)(un|deux|trois|quatre|cinq|six|sept|huit)`), (m, u) => String(d * 10 + UNITS[u.toLowerCase()]));
  }
  t = t.replace(W(`(un|une)(?=\\s+(?:mois|semaines?|jours?|heures?|an|ann[ée]e))`), '1');
  t = t.replace(W(`(un|une|deux|trois|quatre|cinq|six|sept|huit)(?=\\s+(?:${COUNTED}))`), (m, u) => (UNITS[u.toLowerCase()] === 1 ? 'one' : String(UNITS[u.toLowerCase()])));
  t = t.replace(W('(?:[ée]tape|phase|stade) (un|une|deux|trois|quatre|cinq|six|sept|huit)'), (m, u) => `étape ${UNITS[u.toLowerCase()]}`);
  // "1 200 €" -> 1200, "630,50 €" -> 630.50, euros -> EUR, "30 %" / "30 pour cent" -> 30%
  t = t.replace(/(?<![\d.,])(\d{1,3})[   ](\d{3})(?!\d)/g, '$1$2');
  t = t.replace(/(\d+),(\d{1,2})(?=\s*(?:€|euros?\b|EUR\b))/gi, '$1.$2');
  t = t.replace(W('euros?'), 'EUR');
  t = t.replace(/(\d+)\s*(?:%|pour ?cent\b|pourcents?\b)/gi, '$1%');
  // "2 à 3 implants", "4 à 6 mois", "1200 à 1400 EUR" -> ranges; "2 ou 3 implants" -> "2 or 3"
  t = t.replace(/(\d[\d.]*)\s*(?:à|a|-)\s*(\d[\d.]*)(?=\s*(?:€|EUR|%|mois|semaines?|jours?|heures?|h\b|implants?|dents?))/giu, '$1–$2');
  return t;
}

// Rewrite one French dictation into the engine's English phrasing (line structure is preserved).
export function frenchToEngine(text = '', { segment = true } = {}) {
  let t = String(text).replace(/[’`]/g, "'").replace(/[«»“”]/g, '"').replace(/\s+([:;!?])/g, '$1');
  t = numbers(t, segment);
  // stages: "Étape 2" -> "Stage 2"; a stage heading at the start of a line or sentence gets a ":" so that
  // run-on voice transcripts ("étape 2 après 3 mois vis de ...") still start a new stage.
  t = t.replace(/(^|[\n.;!?]\s*|^\s*[•\-*]\s*)(?:l'|la |le )?(?:[ée]tape|phase|stade)\s*(\d+)(?!\s*[:–\-(])/gimu, '$1Stage $2:');
  t = t.replace(W('(?:l\'|la |le )?(?:[ée]tape|phase|stade)\\s*(?=\\d)'), m => keepCase(m, 'stage '));
  for (const [re, rep] of RX) t = t.replace(re, (...a) => {
    const m = a[0], groups = a.slice(1, -2);
    return keepCase(m, rep.replace(/\$(\d)/g, (_, k) => groups[k - 1] ?? ''));
  });
  // Voice transcripts come without punctuation: start a new fragment before each treatment so that
  // "couronne zircone sur un implant obturation du puits" gives two items, not one.
  if (segment) t = t.split('\n').map(l => (/[,.;•+]/.test(l) ? l : l.replace(HEADS, ', '))).join('\n').replace(/:\s*,\s*/g, ': ');
  return t;
}
const HEADS = /(?<=\S)(?<!\b(?:and|of|the|during|before|one|\d))\s+(?=(consultation|dental radiograph|pre-operative hygiene|scaling and root planing|extract|placement of|sedation|without sedation|healing abutments|scan of|zirconia crowns|ceramic crown|final crowns|temporary crowns|temporaries|sealing of|gingival grafting|bone grafting|bone augmentation|prior bone|sinus lift|closed sinus|lamina|local anaesthesia|\d+ x local|single-use hygiene kit|(?:\d+ |one )?sterilisation pack|surgical guide|(?:\d+ |one )?model)\w*\b)/gi;

// French correction commands -> the English commands applyCorrection understands.
const VERB = [
  [V("(?:supprimer?|supprimez|enl[eè]ve[rz]?|retire[rz]?|efface[rz]?|annule[rz]?)(?: (?:le|la|les|l'|un|une))?\\s*"), 'remove the '],
  [V("(?:d[ée]place[rz]?|bouge[rz]?|mets|mettez|mettre|passe[rz]?)\\s+(?:le |la |les |l')?(.+?)\\s+(?:en|[àa]|dans|vers)\\s+(?:l'|la |le )?(?:[ée]tape|stage)\\s*(\\d+)"), 'move the $1 to stage $2'],
  [V("(?:change[rz]?|modifie[rz]?|mets|mettez|passe[rz]?)\\s+(?:le )?prix (?:de |du |des |d')?(?:la |le |les |l')?(.+?)\\s+(?:[àa]|at|en|pour)\\s+(\\d[\\d.,]*)\\s*(?:€|EUR)?"), 'change the price of the $1 to $2'],
  [V("le prix (?:de |du |des |d')?(?:la |le |les |l')?(.+?)\\s+(?:est|passe [àa]|devient)\\s+(?:de )?(\\d[\\d.,]*)\\s*(?:€|EUR)?"), 'change the price of the $1 to $2'],
  [V("(?:applique[rz]?|mets|mettez|fais|faites|accorde[rz]?|donne[rz]?)\\s+(?:a|une|la)\\s+(\\d+)%\\s+discount\\s+(?:on|sur|pour|[àa])\\s+(?:la |le |les |l')?"), 'apply $1% discount on the '],
  [V("(?:applique[rz]?|mets|mettez|fais|faites|accorde[rz]?|donne[rz]?)\\s+(?:a\\s+)?(\\d+)%\\s+(?:de\\s+)?discount\\s+(?:on|sur|pour|[àa])\\s+(?:la |le |les |l')?"), 'apply $1% discount on the '],
  [V("(?:change[rz]?|modifie[rz]?|mets|mettez)\\s+(?:l')?intervalle (?:de |avant |pour )?(?:l')?(?:stage)\\s*(\\d+)\\s+(?:[àa]|en|:)\\s*"), 'set interval of stage $1 to '],
  [V("(?:l')?intervalle (?:de |avant |pour )?(?:l')?(?:stage)\\s*(\\d+)\\s*(?:est de|:|=)\\s*"), 'set interval of stage $1 to '],
  [V("(?:ajoute[rz]?|rajoute[rz]?)\\s+(?:une |un |one |le |la |les |des |l')?(.+?)\\s+(?:en|[àa]|dans)\\s+(?:l'|la |le )?stage\\s*(\\d+)"), 'add $1 to stage $2'],
  [V("(?:ajoute[rz]?|rajoute[rz]?)\\s+(?:une |un |one |le |la |les |des |l')?(.+?)\\s+(?:comme|en|dans) (?:une )?(?:(?:nouvelle|autre) (?:[ée]tape|stage)|(?:[ée]tape|stage) (?:s[ée]par[ée]e|[àa] part))"), 'add $1 as a separate stage'],
  [V("(?:ajoute[rz]?|rajoute[rz]?)\\s+(?:une |un |one |le |la |les |des |l')?"), 'add '],
  [V("(?:le |la )?(?:patiente? s'appelle|nom (?:du|de la) patiente? (?:est|:)|patiente? :)\\s*"), 'patient is '],
  [V("(?:remplace[rz]?|passe[rz]?|change[rz]?)\\s+(?:les |la |le )?(implants?|crowns?)?\\s*(?:en|par|pour|à|vers)\\s+"), 'switch $1 to '],
  [V("(?:doivent|doit) [êe]tre"), 'should be'],
  [V('puis|ensuite'), 'then'],
];
export function frenchCorrectionToEngine(text = '') {
  // Each sentence / "et aussi" chunk is one command.
  let t = String(text).replace(/[’`]/g, "'")
    .replace(V("(?:change[rz]?|modifie[rz]?|mets|mettez)?\\s*(?:l')?intervalle (?:de |avant |pour )?(?:l'|la |le )?(?:[ée]tape|phase)\\s*(\\d+)\\s*(?:[àa]|en|:|est de|=)\\s*"), 'set interval of stage $1 to ');
  t = frenchToEngine(t, { segment: false });
  t = t.replace(/\s+and also\s+/gi, '; ').replace(/,\s*(?:then|and)\s+/gi, '; ');
  return t.split(/(?<=[.!])\s+|;\s*/).map(cmd => {
    for (const [re, rep] of VERB) cmd = cmd.replace(re, (...a) => { const g = a.slice(1, -2); return rep.replace(/\$(\d)/g, (_, k) => g[k - 1] ?? ''); });
    return cmd.replace(/\bthe (?:la |le |les |l')/gi, 'the ').replace(/\bremove the (?:de |du |des )/i, 'remove the ');
  }).join('. ').replace(/\.\.\s/g, '. ');
}

// Same fragment cleanup as extract.fragments(), so the dentist's own words can be found again.
const STAGE_HEAD = /^\s*(?:stage|[ée]tape|phase|stade)\s*\d+\s*[:–-]?\s*/iu;
const clean = s => s.replace(STAGE_HEAD, '').replace(/^[\s•*:–"«»-]+|[\s."«»]+$/g, '');
const key = s => clean(s).replace(/\s+/g, ' ').toLowerCase();
const LEVELS = [s => s.split(/\n|•/), s => s.split(/(?<=\.)\s+/), s => s.split(/\s\+\s/), s => s.split(/,(?!\s*\d)/)];

// Translate a French transcript and keep a way back to the dentist's own words: lines, sentences and
// comma-separated pieces are paired with their translation wherever both split the same way.
export function prepareFrench(text = '') {
  const original = String(text);
  const translated = frenchToEngine(original);
  const back = new Map();
  const pair = (o, t, level) => {
    if (level > 0 && key(t)) back.set(key(t), clean(o));
    if (level >= LEVELS.length) return;
    const a = LEVELS[level](o), b = LEVELS[level](t);
    if (a.length === b.length) a.forEach((x, k) => pair(x, b[k], level + 1));
  };
  // line by line (each line translated on its own, so voice segmentation cannot shift the pieces) ...
  for (const line of original.split('\n')) pair(line, frenchToEngine(line, { segment: false }), 1);
  // ... and as running text, for sentences that wrap over several lines.
  pair(original.replace(/\s*\n\s*/g, ' '), frenchToEngine(original, { segment: false }).replace(/\s*\n\s*/g, ' '), 1);
  const restore = s => (s == null ? s : String(s).split(' / ').map(p => back.get(key(p)) ?? p).join(' / '));
  return { text: translated, restore };
}
