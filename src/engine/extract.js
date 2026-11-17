// Clinical Information Extraction Agent (deterministic, rule-based).
// Turns a dictated transcript into stages + line items, keeping the source text of every item.
// It NEVER invents a price: an item is priced only from the clinic price list or a dictated amount.
import { CATALOG } from '../catalog.js?v=7';

export const byId = Object.fromEntries(CATALOG.map(c => [c.id, c]));
const WORDNUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, a: 1, an: 1, single: 1, each: null };
export const toNum = s => (s == null ? null : (WORDNUM[String(s).toLowerCase()] ?? (isNaN(+s) ? null : +s)));
const N = '(\\d+|one|two|three|four|five|six|seven|eight)';

// Implant systems exactly as listed in the clinic price list (Implantology section).
export const IMPLANT_SYSTEMS = [
  { id: 'P125', family: 'osstem', words: /osstem(?!\s*soi)/i }, { id: 'P173', family: 'osstem', words: /\bsoi\b/i },
  { id: 'P165', family: 'megagen', words: /anyone/i }, { id: 'P166', family: 'megagen', words: /megagen st\b/i },
  { id: 'P167', family: 'megagen', words: /megagen(?! ?(st|anyone|anyridge))/i }, { id: 'P168', family: 'megagen', words: /anyridge/i },
  { id: 'P126', family: 'straumann', words: /\bblt\b/i }, { id: 'P127', family: 'straumann', words: /sla ?active/i },
  { id: 'P172', family: 'nobel', words: /nobel/i }, { id: 'P169', family: 'zirconia', words: /zirconia implant/i },
];
// Crowns on implants per implant family (Implantology + Implant prosthetics sections).
export const CROWNS = { osstem: ['P123', 'P184', 'P197'], straumann: ['P124', 'P185', 'P196'], megagen: ['P186', 'P195'], nobel: ['P199'], zirconia: [] };
export const FAMILY_RE = { straumann: /straumann/i, osstem: /osstem/i, megagen: /megagen/i, nobel: /nobel/i, korean: /korean/i };
export const familyOf = id => IMPLANT_SYSTEMS.find(x => x.id === id)?.family;
export const eur = n => `€${Number(n).toFixed(2)}`;
export const itemLabel = id => `${byId[id].name} – ${eur(byId[id].price)}`;
export const codeOf = id => (byId[id]?.code ? String(byId[id].code).replace(/\.$/, '') : null);

// Rule table: first rule of each group wins inside one fragment.
export const RULES = [
  { group: 'kit', re: /hygiene kit/i, id: 'P001', qty: new RegExp(`${N}\\s*(?:x\\s*)?single-use`, 'i') },
  { group: 'hygiene', re: /(pre-?operative|professional)?\s*hygiene(?! kit)/i, id: 'P031' },
  { group: 'steril', re: /sterili[sz]ation pack/i, id: 'P113', qty: new RegExp(`${N}\\s*sterili`, 'i') },
  { group: 'srp', re: /\bSRP\b|scaling and root planing/i, id: null, choice: 'srp' },
  // Procedures with several price-list variants: resolve only when the dictation determines the variant,
  // otherwise return null and let the questioning agent offer the exact candidates.
  { group: 'sinus', re: /sinus lift/i, candidates: ['P136', 'P137', 'P180', 'P134', 'P135', 'P178', 'P179', 'P140'], resolve: f => {
      const n = /2\s*[–-]\s*3/.test(f) ? 23 : /\b(one|1)\b(?! segment)/i.test(f) ? 1 : /\b(two|2)\b/i.test(f) ? 2 : /\b(three|3)\b/i.test(f) ? 3 : /\b(four|4)\b/i.test(f) ? 4 : null;
      if (/closed/i.test(f)) return 'P140';
      if (/during/i.test(f)) return { 1: 'P136', 23: 'P137', 2: 'P137', 3: 'P137', 4: 'P180' }[n] || null;
      if (/before|prior/i.test(f)) return { 1: 'P134', 2: 'P135', 3: 'P178', 4: 'P179' }[n] || null;
      return null; } },
  { group: 'lamina', re: /lamina/i, candidates: ['P139', 'P138', 'P181', 'P182'], resolve: f => {
      const during = /during|at implant/i.test(f);
      if (/1\s*[–-]\s*2/.test(f)) return during ? 'P181' : 'P139';
      if (/2\s*[–-]\s*3/.test(f) && !during) return 'P138';
      if (/3\s*[–-]\s*4/.test(f) && during) return 'P182';
      return null; } },
  { group: 'bone', re: /bone (graft|augmentation)/i, candidates: ['P130', 'P131', 'P132', 'P133', 'P164'], resolve: f =>
      /extraction/i.test(f) ? 'P164'
      : /during|at implant/i.test(f) ? (/one implant/i.test(f) ? 'P130' : /(multiple|several|\d+|two|three|four) implants/i.test(f) ? 'P131' : null)
      : /before|prior|pre-implant/i.test(f) ? (/one (implant )?site/i.test(f) ? 'P132' : /multiple|sites/i.test(f) ? 'P133' : null) : null },
  { group: 'abutment', re: /healing abutments?/i, id: 'P128', qty: new RegExp(`on\\s*${N}\\s*implants?`, 'i') },
  { group: 'gingival', re: /gingival (\(soft-tissue\) )?graft|soft-tissue graft/i, id: 'P147', qty: new RegExp(`(?:around\\s*${N}\\s*implants?|${N}\\s*x\\s*gingival)`, 'i'), eachImplant: /each implant/i },
  { group: 'scan', re: /scan of|implant scan/i, id: 'P200', qty: new RegExp(`scan of\\s*${N}`, 'i') },
  { group: 'tempcrown', re: /temporar(y crowns?|ies)/i, id: 'P141', qty: new RegExp(`on\\s*${N}\\s*implants?`, 'i') },
  { group: 'model', re: /\bmodel\b/i, id: 'P183', qty: new RegExp(`${N}\\s*model`, 'i') },
  { group: 'crown', re: /(zirconia|ceramic|final|permanent)?\s*crowns?\b/i, notIf: /temporar|sealing|screw/i, choice: 'crown', qty: new RegExp(`crowns? on\\s*${N}`, 'i') },
  { group: 'sealing', re: /sealing|screw[- ]access/i, id: 'P120', qtyFromGroup: 'crown' },
  { group: 'anaesth', re: /local an(a)?esthesia/i, id: 'P099', qty: new RegExp(`${N}\\s*x\\s*local`, 'i') },
  { group: 'sedation', re: /sedation/i, choice: 'sedation' },
  { group: 'implant', re: /implants?\b/i, notIf: /abutment|sealing|screw|crowns? on|scan of|grafting around|sinus lift|bone graft|neck may crack|per implant|implants? \d+ ?eur|at \d+ ?eur|plays/i, choice: 'implant',
    qty: new RegExp(`${N}\\s*(?:or\\s*\\d\\s*)?implants`, 'i') },
  { group: 'extraction', re: /extract/i, notIf: /do not|don't|no need/i, id: 'P089', qty: new RegExp(`(?:extract\\w*\\s*(?:the\\s*)?)${N}`, 'i') },
  { group: 'guide', re: /surgical guide/i, id: 'P118' },
  { group: 'xray', re: /x-?ray|radiograph/i, id: 'P014' },
  { group: 'consult', re: /consultation/i, id: 'P013' },
  { group: 'unpriced', re: /reshape|grind|accommodation|restorative|therapeutic treatment/i, id: null, unpriced: true },
];

const stripNoise = s => s.replace(/\d[\d,.]*\s*(€|eur)/gi, ' ').replace(/[-–]?\d+\s*%/g, ' ').replace(/\d+\s*(h|hours?|months?|weeks?|days?)\b/gi, ' ');
export function teethIn(text) {
  const t = stripNoise(text);
  if (!/site|tooth|teeth|implant|–\s*\d\d|at \d\d/i.test(text)) return [];
  return [...new Set((t.match(/\b[1-4][1-8]\b/g) || []))];
}

export function intervalIn(text) {
  const m = text.match(/after\s*(?:approximately\s*)?(\d+(?:\s*(?:[–-]|to)\s*\d+)?)\s*(months?|weeks?|days?)/i);
  return m ? `After ${m[1].replace(/\s*(?:to|-)\s*/, '–').replace(/\s/g, '')} ${m[2]}` : null;
}

// Split transcript into stages
export function splitStages(text) {
  const norm = text.replace(/\r/g, '')
    .replace(/(^|[\s.:;])((?:stage|étape|phase)\s*(\d+)\b)(?=\s*(?:[:–\-(]|\n|$))/gim, (m, p, h, n) => `${p}\n§STAGE ${n}§`)
    .replace(/^\s*[•\-*]?\s*(1st visit|first visit)/gim, '\n§STAGE 0§ $1')
    .replace(/^\s*[•\-*]?\s*(after\s*\d+(?:\s*[–-]\s*\d+)?\s*months?:?)/gim, '\n§STAGE 0§ $1');
  const parts = norm.split('§STAGE ');
  const preamble = parts.shift();
  const stages = parts.map(p => {
    const m = p.match(/^(\d+)§([\s\S]*)$/);
    return { declared: +m[1], implicit: +m[1] === 0, body: m[2] };
  });
  if (!stages.length) return { preamble: '', stages: [{ declared: 1, body: preamble }] };
  return { preamble, stages };
}

export function fragments(body) {
  const out = [];
  const bulleted = /[•\-*]\s/.test(body);
  const src = bulleted ? body : body.replace(/\s*\n\s*/g, ' ');
  for (let line of src.split(/\n|•/)) {
    line = line.trim();
    if (!line) continue;
    const long = !bulleted || line.length > 140;
    const sentences = long ? line.split(/(?<=\.)\s+(?=[A-Z])/) : [line];
    for (const s of sentences) {
      const parts = s.split(/\s\+\s/);
      for (const p of parts) {
        const sub = long ? p.split(/,(?!\s*\d)\s*(?!and\b)/) : [p];
        for (let f of sub) { f = f.replace(/^[\s:–"-]+|[\s."]+$/g, ''); if (f) out.push(f); }
      }
    }
  }
  return out;
}

export function matchFragment(f) {
  const hits = [], groups = new Set();
  for (const r of RULES) {
    if (groups.has(r.group)) continue;
    if (!r.re.test(f) || (r.notIf && r.notIf.test(f))) continue;
    if (r.group === 'crown' && !/crowns? on|zirconia crowns?|ceramic crown|final crown/i.test(f)) continue;
    if (r.group === 'implant' && groups.has('crown')) continue;
    groups.add(r.group); hits.push(r);
  }
  return hits;
}

const priceIn = f => { const m = f.match(/(\d[\d,.]*)\s*(?:€|eur)/i); return m ? +m[1].replace(/,/g, '') : null; };
const TEETH_GROUPS = ['implant', 'extraction', 'unpriced', 'abutment', 'gingival', 'tempcrown', 'crown', 'scan'];
const QTY_FROM_TEETH = ['implant', 'extraction', 'abutment', 'gingival', 'tempcrown', 'crown', 'scan'];
const pctIn = f => { const m = f.match(/(\d+)\s*%/); return m ? +m[1] : null; };

const JUNK_NOTE = /^(after|in stage|stage)\b.{0,25}$|^\(sic|^=+$|^-+$|^dentist notes|^patient\s*\d/i;

export function extract(text) {
  const { preamble, stages } = splitStages(text);
  const all = [], notes = [], dictatedPrices = [], globalHints = [];
  // Free-form notes (only "1st visit" / "After N months" bullets) have implicit stages: only the
  // timeline bullet itself belongs to the stage; every other bullet is routed to the stage it is about.
  const implicitMode = stages.length > 0 && stages.every(s => s.implicit);
  const loose = [];

  function processFragment(f, sink, si) {
    const per = [...f.matchAll(/(\d[\d,.]*)\s*(?:[–-]\s*(\d[\d,.]*))?\s*(?:€|eur)\s*(?:per|each|\/)\s*(implant|crown|side)/gi)];
    const pre2 = [...f.matchAll(/(implants?|crowns?|bone grafting)\s*(?:at\s*)?(\d[\d,.]*)\s*(?:[–-]\s*(\d[\d,.]*))?\s*(?:€|eur)(?:\s*and\s*(\d[\d,.]*)\s*(?:€|eur))?/gi)];
    for (const m of per) dictatedPrices.push({ noun: m[3].toLowerCase() === 'side' ? 'bone' : m[3].toLowerCase(), price: +m[1].replace(/,/g, ''), max: m[2] ? +m[2].replace(/,/g, '') : null, perSide: /side/i.test(m[3]), source: f });
    for (const m of pre2) {
      const noun = /implant/i.test(m[1]) ? 'implant' : /crown/i.test(m[1]) ? 'crown' : 'bone';
      dictatedPrices.push({ noun, price: +m[2].replace(/,/g, ''), max: m[3] ? +m[3].replace(/,/g, '') : null, alt: m[4] ? +m[4].replace(/,/g, '') : null, perSide: /per side/i.test(f), source: f });
    }
    if (per.length || pre2.length) { notes.push(f); return; }
    const hits = matchFragment(f);
    if (!hits.length) { if (f.length > 2 && !JUNK_NOTE.test(f)) notes.push(f); return; }
    for (const r of hits) {
      const qm = r.qty && f.match(r.qty);
      const teeth = TEETH_GROUPS.includes(r.group) ? teethIn(f) : [];
      const item = {
        key: `s${si}-${r.group}-${sink.length}`, group: r.group, source: f, teeth,
        catalogId: r.resolve ? r.resolve(f) : (r.id ?? null), choice: r.choice || null, candidates: r.candidates || null,
        qty: qm ? toNum(qm[1] || qm[2]) : null, unitPrice: null, priceSource: null, discountPct: 0, flags: [],
      };
      if (r.unpriced) item.flags.push('notInPriceList');
      if (r.eachImplant && r.eachImplant.test(f)) item.flags.push('eachImplant');
      if (item.qty == null && teeth.length && QTY_FROM_TEETH.includes(r.group)) item.qty = teeth.length;
      if (/per side/i.test(f)) item.flags.push('perSide');
      const rm = f.match(/(\d)\s*(?:–|-|or)\s*(\d)\s*implants/i);
      if (rm && r.group === 'implant') { item.range = [+rm[1], +rm[2]]; item.qty = null; }
      if (/free of charge/i.test(f)) { item.discountPct = 100; item.flags.push('freeOfCharge'); }
      else if (pctIn(f) != null) item.discountPct = pctIn(f);
      else if (/with (a )?discount|discount on/i.test(f)) item.flags.push('discountUnspecified');
      if (/serviceman/i.test(f)) item.flags.push('servicemanMention');
      if (/possibly|maybe|\bor\b.*\?/i.test(f) && r.group !== 'implant') item.flags.push('tentative');
      if (/ceramic/i.test(f)) item.flags.push('ceramicDictated');
      if (/\bML\b/.test(f)) item.flags.push('ML'); if (/\bST\b/.test(f)) item.flags.push('ST');
      if (r.group === 'sedation') { const h = f.match(/(\d+(?:\.\d+)?)\s*h/i); item.hours = h ? +h[1] : null; if (/without sedation/i.test(f)) item.flags.push('sedationOptional'); }
      if (r.group === 'extraction' && /she said|patient (said|wants)|doesn't like/i.test(f)) item.flags.push('patientWish');
      const pm = f.match(/(\d[\d,.]*)\s*(?:€|eur)/i); if (pm) item.dictatedPrice = +pm[1].replace(/,/g, '');
      sink.push(item);
    }
  }

  const pre = preamble.trim();
  if (pre) for (const f of fragments(pre)) {
    if (/\(-?\d+%\)|-\d+%/.test(f)) globalHints.push({ kind: 'globalDiscount', pct: pctIn(f), source: f });
    else if (implicitMode) processFragment(f, loose, 0);
    else if (!JUNK_NOTE.test(f)) notes.push(f);
  }
  const outStages = stages.map((s, si) => {
    const [firstLine, ...rest] = s.body.replace(/^\s+/, '').split('\n');
    const st = { index: si, declared: s.declared, interval: intervalIn(firstLine), title: '', items: [] };
    if (/1st visit|first visit/i.test(firstLine)) st.interval = 'First visit';
    for (const f of fragments(implicitMode ? firstLine : s.body)) processFragment(f, st.items, si);
    if (implicitMode) for (const f of fragments(rest.join('\n'))) processFragment(f, loose, si);
    return st;
  });

  // Route loose items to the stage they belong to, merging repeated mentions of the same procedure.
  const BONE = ['bone', 'lamina', 'sinus'];
  const PROSTH = ['abutment', 'crown', 'tempcrown', 'scan', 'gingival'];
  for (const it of loose) {
    const has = g => outStages.find(st => st.items.some(i => g.includes(i.group)));
    const target = has([it.group]) || (BONE.includes(it.group) && has(BONE)) || (PROSTH.includes(it.group) && has(['implant'])) || outStages[0];
    const same = it.group !== 'unpriced' && target.items.find(i => i.group === it.group && i.catalogId === it.catalogId);
    if (same) {
      same.source += ' / ' + it.source;
      same.flags = [...new Set([...same.flags, ...it.flags])];
      same.teeth = [...new Set([...same.teeth, ...it.teeth])];
      if (same.qty == null) same.qty = it.qty;
      if (it.range && !same.range) same.range = it.range;
      if (it.dictatedPrice != null && same.dictatedPrice == null) same.dictatedPrice = it.dictatedPrice;
    } else { it.key = `s${target.index}-${it.group}-loose${target.items.length}`; target.items.push(it); }
  }
  for (const st of outStages) all.push(...st.items);

  const negations = [];
  for (const line of text.split(/\n|•/)) if (/do not need|don't need|no need/i.test(line)) negations.push(line.trim());
  return { stages: outStages, notes, dictatedPrices, globalHints, negations, items: all, implicitMode };
}
