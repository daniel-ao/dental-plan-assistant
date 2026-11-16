// Clinical Information Extraction Agent (deterministic, rule-based).
// Turns a dictated transcript into stages + line items, keeping the source text of every item.
// It NEVER invents a price: an item is priced only from the clinic price list or a dictated amount.
import { CATALOG } from '../catalog.js';

export const byId = Object.fromEntries(CATALOG.map(c => [c.id, c]));
const WORDNUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, a: 1, an: 1, single: 1, each: null };
export const toNum = s => (s == null ? null : (WORDNUM[String(s).toLowerCase()] ?? (isNaN(+s) ? null : +s)));
const N = '(\\d+|one|two|three|four|five|six|seven|eight)';

export const BRANDS = {
  straumann: { implant: 'P126', crown: 'P124', label: 'Straumann' },
  osstem: { implant: 'P125', crown: 'P123', label: 'Osstem' },
  megagen: { implant: 'P165', crown: 'P186', label: 'Megagen AnyOne' },
  nobel: { implant: 'P172', crown: 'P199', label: 'Nobel' },
};
export const brandOptions = kind => Object.entries(BRANDS).map(([k, b]) => ({ value: k, label: `${b.label} – €${byId[b[kind]].price}` }));

// Rule table: first rule of each group wins inside one fragment.
export const RULES = [
  { group: 'kit', re: /hygiene kit/i, id: 'P001', qty: new RegExp(`${N}\\s*(?:x\\s*)?single-use`, 'i') },
  { group: 'hygiene', re: /(pre-?operative|professional)?\s*hygiene(?! kit)/i, id: 'P031' },
  { group: 'steril', re: /sterili[sz]ation pack/i, id: 'P113', qty: new RegExp(`${N}\\s*sterili`, 'i') },
  { group: 'srp', re: /\bSRP\b|scaling and root planing/i, id: null, choice: 'srp' },
  { group: 'sinus', re: /sinus lift/i, resolve: f => /before/i.test(f) ? 'P134' : /2\s*[–-]\s*3/.test(f) ? 'P137' : /\b4\b|four/i.test(f) ? 'P180' : 'P136' },
  { group: 'lamina', re: /lamina/i, id: 'P139' },
  { group: 'bone', re: /bone (graft|augmentation)/i, resolve: f =>
      /extraction/i.test(f) ? 'P164' : /during|around one implant|at implant/i.test(f) ? (/one implant/i.test(f) ? 'P130' : 'P131') : /one (implant )?site/i.test(f) ? 'P132' : 'P133' },
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
    return { declared: +m[1], body: m[2] };
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
const pctIn = f => { const m = f.match(/(\d+)\s*%/); return m ? +m[1] : null; };

export function extract(text) {
  const { preamble, stages } = splitStages(text);
  const all = [], notes = [], dictatedPrices = [], globalHints = [];
  const pre = preamble.trim();
  if (pre) for (const f of fragments(pre)) {
    if (/\(-?\d+%\)|-\d+%/.test(f)) globalHints.push({ kind: 'globalDiscount', pct: pctIn(f), source: f });
    else if (!/^dentist notes|^=+$|^-+$|^patient\s*\d/i.test(f)) notes.push(f);
  }
  const outStages = stages.map((s, si) => {
    const firstLine = s.body.split('\n')[0];
    const st = { index: si, declared: s.declared, interval: intervalIn(firstLine), title: '', items: [] };
    if (/1st visit|first visit/i.test(firstLine)) st.interval = 'First visit';
    for (const f of fragments(s.body)) {
      // dictated "X EUR per noun" prices
      const per = [...f.matchAll(/(\d[\d,.]*)\s*(?:[–-]\s*(\d[\d,.]*))?\s*(?:€|eur)\s*(?:per|each|\/)\s*(implant|crown|side)/gi)];
      const pre2 = [...f.matchAll(/(implants?|crowns?|bone grafting)\s*(?:at\s*)?(\d[\d,.]*)\s*(?:[–-]\s*(\d[\d,.]*))?\s*(?:€|eur)(?:\s*and\s*(\d[\d,.]*)\s*(?:€|eur))?/gi)];
      for (const m of per) dictatedPrices.push({ noun: m[3].toLowerCase(), price: +m[1].replace(/,/g, ''), max: m[2] ? +m[2].replace(/,/g, '') : null, source: f });
      for (const m of pre2) {
        const noun = /implant/i.test(m[1]) ? 'implant' : /crown/i.test(m[1]) ? 'crown' : 'bone';
        dictatedPrices.push({ noun, price: +m[2].replace(/,/g, ''), max: m[3] ? +m[3].replace(/,/g, '') : null, alt: m[4] ? +m[4].replace(/,/g, '') : null, source: f });
      }
      if (per.length || pre2.length) { notes.push(f); continue; }
      const hits = matchFragment(f);
      if (!hits.length) { if (f.length > 2 && !/^\(sic/i.test(f)) notes.push(f); continue; }
      for (const r of hits) {
        const qm = r.qty && f.match(r.qty);
        let qty = qm ? toNum(qm[1] || qm[2]) : null;
        const teeth = ['implant', 'extraction', 'unpriced'].includes(r.group) ? teethIn(f) : [];
        const item = {
          key: `s${si}-${r.group}-${st.items.length}`, group: r.group, source: f, teeth,
          catalogId: r.resolve ? r.resolve(f) : (r.id ?? null), choice: r.choice || null,
          qty, unitPrice: null, priceSource: null, discountPct: 0, flags: [],
        };
        if (r.unpriced) item.flags.push('notInPriceList');
        if (r.eachImplant && r.eachImplant.test(f)) item.flags.push('eachImplant');
        if (r.qtyFromGroup) item.flags.push('qtyFromCrowns');
        if (item.qty == null && teeth.length && r.group === 'implant') item.qty = teeth.length;
        if (/(\d)\s*(?:–|-|or)\s*(\d)\s*implants/i.test(f) && r.group === 'implant') { const m = f.match(/(\d)\s*(?:–|-|or)\s*(\d)\s*implants/i); item.range = [+m[1], +m[2]]; item.qty = null; }
        if (/free of charge/i.test(f)) { item.discountPct = 100; item.flags.push('freeOfCharge'); }
        else if (pctIn(f) != null) item.discountPct = pctIn(f);
        else if (/with (a )?discount|discount on/i.test(f)) item.flags.push('discountUnspecified');
        if (/serviceman/i.test(f)) item.flags.push('servicemanMention');
        if (/possibly|maybe|\bor\b.*\?/i.test(f) && r.group !== 'implant') item.flags.push('tentative');
        if (r.group === 'sedation') { const h = f.match(/(\d+(?:\.\d+)?)\s*h/i); item.hours = h ? +h[1] : null; if (/without sedation/i.test(f)) item.flags.push('sedationOptional'); }
        const p = priceIn(f); if (p != null) item.dictatedPrice = p;
        st.items.push(item); all.push(item);
      }
    }
    return st;
  });
  // Negated mentions that conflict with affirmative ones (e.g. "need extraction" vs "do not need extraction")
  const negations = [];
  for (const line of text.split(/\n|•/)) if (/do not need|don't need|no need/i.test(line)) negations.push(line.trim());
  return { stages: outStages, notes, dictatedPrices, globalHints, negations, items: all };
}
