// Treatment Planning Agent + Validation & Questioning Agent.
// buildPlan is a pure function: (transcript, answers) -> { plan, questions }.
// Answers are applied as field-level patches; unanswered questions leave items "TBC" (never guessed).
import { extract, byId, BRANDS, brandOptions } from './extract.js';

const eur = n => `€${(+n).toFixed(2)}`;
const PRIORITY = { high: 0, medium: 1, low: 2 };

export function buildPlan(transcript, answers = {}, meta = {}) {
  const ex = extract(transcript || '');
  const Q = [];
  const ask = q => { q.answer = answers[q.id]; Q.push(q); return q.answer; };
  const ans = id => answers[id];

  // ---------- Patient ----------
  const patientName = meta.patientName?.trim() || ans('patient.name');
  if (!meta.patientName?.trim()) ask({ id: 'patient.name', priority: 'high', category: 'Patient', text: 'What is the patient\'s full name?', options: [], free: true });

  // ---------- Brand (implants & implant crowns) ----------
  const brandWord = Object.keys(BRANDS).find(b => new RegExp(b, 'i').test(transcript));
  const needsBrand = ex.items.some(i => i.choice === 'implant' || i.choice === 'crown');
  let brand = brandWord;
  if (needsBrand && !brandWord) brand = ask({ id: 'brand', priority: 'high', category: 'Components', text: 'Which implant system should be used? (determines implant and crown prices)', options: brandOptions('implant') });
  if (needsBrand && /korean/i.test(transcript) && brandWord) ask({ id: 'brand.korean', priority: 'low', category: 'Components', text: `Dictation mentions both ${BRANDS[brandWord].label} and Korean implants. Confirm the system to quote:`, options: brandOptions('implant') });
  if (ans('brand.korean')) brand = ans('brand.korean');

  // ---------- Global discount ----------
  const gd = ex.globalHints.find(h => h.kind === 'globalDiscount');
  let globalScope = null;
  if (gd) globalScope = ask({ id: 'discount.scope', priority: 'high', category: 'Pricing', text: `A ${gd.pct}% discount was dictated ("${gd.source}"). Apply it to which items?`, options: [{ value: 'all', label: `All items (−${gd.pct}%)` }, { value: 'mentioned', label: 'Only items where the discount was explicitly mentioned' }] });

  // ---------- Dictated prices ----------
  const dp = n => ex.dictatedPrices.filter(p => p.noun === n);
  const priceFor = {};
  for (const noun of ['implant', 'crown']) {
    const list = dp(noun);
    if (!list.length) continue;
    const values = [...new Set(list.flatMap(p => [p.price, p.alt].filter(Boolean)))];
    const listPrice = brand && BRANDS[brand] ? byId[BRANDS[brand][noun]].price : null;
    if (values.length === 1 && values[0] === listPrice) { priceFor[noun] = values[0]; continue; }
    const opts = values.map(v => ({ value: String(v), label: `${eur(v)} (dictated)` }));
    if (listPrice != null && !values.includes(listPrice)) opts.push({ value: String(listPrice), label: `${eur(listPrice)} (clinic price list)` });
    const a = ask({ id: `price.${noun}`, priority: 'high', category: 'Pricing', text: values.length > 1 ? `Conflicting ${noun} prices were dictated (${values.map(eur).join(', ')}). Which unit price applies?` : `Dictated ${noun} price ${eur(values[0])} differs from the price list. Which applies?`, options: opts, free: true });
    if (a) priceFor[noun] = +a;
  }
  if (dp('bone').some(p => p.max)) {
    const p = dp('bone').find(p => p.max);
    const a = ask({ id: 'price.bone', priority: 'medium', category: 'Pricing', text: `Bone grafting was dictated as a range (${eur(p.price)}–${eur(p.max)} per side). Which amount should be quoted per side?`, options: [{ value: String(p.price), label: eur(p.price) }, { value: String(p.max), label: eur(p.max) }], free: true });
    if (a) priceFor.bone = +a;
  }

  // ---------- Stages ----------
  const seen = new Set();
  let implantsPlaced = 0;
  const stages = ex.stages.map((s, si) => {
    const number = si + 1;
    const stage = { number, declared: s.declared, title: '', interval: s.interval, items: [] };
    if (s.declared && seen.has(s.declared)) ask({ id: `stage.dup.${si}`, priority: 'medium', category: 'Structure', text: `"Stage ${s.declared}" was dictated twice. The second one is shown as Stage ${number}. Is that correct?`, options: [{ value: 'yes', label: `Yes, keep as Stage ${number}` }, { value: 'merge', label: `Merge into Stage ${number - 1}` }] });
    seen.add(s.declared);
    if (number > 1 && !s.interval) {
      const a = ask({ id: `interval.${si}`, priority: 'medium', category: 'Timeline', text: `What is the interval before Stage ${number}?`, options: ['2 weeks', '1 month', '3 months', '3–4 months', '4–6 months'].map(v => ({ value: v, label: v })), free: true });
      if (a) stage.interval = `After ${a}`;
    }
    if (number === 1 && !stage.interval) stage.interval = 'Day 1';

    // de-duplicate repeated mentions of the same implant / crown order inside a stage (free-text notes)
    for (const g of ['implant', 'crown']) {
      const same = s.items.filter(i => i.group === g);
      if (same.length > 1) {
        const keep = same.find(i => i.teeth.length) || same[0];
        for (const o of same) if (o !== keep) {
          if (o.range && !keep.range) keep.range = o.range;
          keep.flags.push(...o.flags); keep.source += ' / ' + o.source;
          if (o.qty && !keep.qty) keep.qty = o.qty;
        }
        if (keep.range && keep.teeth.length) keep.range = null;
        keep.flags = [...new Set(keep.flags)];
        s.items = s.items.filter(i => i.group !== g || i === keep);
      }
    }
    for (const it of s.items) {
      const item = { ...it, name: '', unitPrice: null, priceSource: null, status: 'ok', note: '' };
      const qid = it.key;
      // choices
      if (it.choice === 'implant') {
        item.catalogId = brand ? BRANDS[brand].implant : null;
        if (it.range) { const a = ask({ id: `${qid}.qty`, priority: 'high', category: 'Clinical', text: `"${it.source}" – how many implants exactly?`, options: it.range.map(v => ({ value: String(v), label: `${v} implants` })) }); if (a) item.qty = +a; }
        if (item.qty == null && !it.range) { const a = ask({ id: `${qid}.qty`, priority: 'high', category: 'Clinical', text: `"${it.source}" – how many implants?`, options: [], free: true }); if (a) item.qty = +a; }
        if (!it.teeth.length) { const a = ask({ id: `${qid}.teeth`, priority: 'medium', category: 'Clinical', text: `Which tooth sites (FDI) for "${it.source}"?`, options: [], free: true }); if (a) item.teeth = a.split(/[\s,]+/).filter(Boolean); }
        if (priceFor.implant != null) { item.unitPrice = priceFor.implant; item.priceSource = 'dentist'; }
        implantsPlaced += item.qty || 0;
      }
      if (it.choice === 'crown') {
        item.catalogId = brand ? BRANDS[brand].crown : null;
        if (priceFor.crown != null) { item.unitPrice = priceFor.crown; item.priceSource = 'dentist'; }
        if (item.qty == null) item.qty = implantsPlaced || null;
        if (item.qty && implantsPlaced && item.qty > implantsPlaced) {
          const a = ask({ id: `${qid}.count`, priority: 'high', category: 'Consistency', text: `"${it.source}": ${item.qty} crowns, but only ${implantsPlaced} implants are planned so far. How many crowns?`, options: [{ value: String(implantsPlaced), label: `${implantsPlaced} (one per implant)` }, { value: String(item.qty), label: `${item.qty} (as dictated)` }], free: true });
          if (a) item.qty = +a;
        }
      }
      if (it.group === 'tempcrown' && item.qty && implantsPlaced && item.qty > implantsPlaced) {
        const a = ask({ id: `${qid}.count`, priority: 'high', category: 'Consistency', text: `"${it.source}": temporary crowns on ${item.qty} implants, but ${implantsPlaced} implants are placed by Stage ${number}. How many temporary crowns?`, options: [{ value: String(implantsPlaced), label: `${implantsPlaced} (implants placed so far)` }, { value: String(item.qty), label: `${item.qty} (as dictated)` }], free: true });
        if (a) item.qty = +a;
      }
      if (it.choice === 'srp') {
        const a = ask({ id: `${qid}.srp`, priority: 'medium', category: 'Pricing', text: `"${it.source}" – SRP per segment is not in the price list. Which item should be used?`, options: [{ value: 'P052', label: `SRP, one jaw – ${eur(byId.P052.price)}` }, { value: 'P051x6', label: `SRP, one tooth × 6 – ${eur(byId.P051.price * 6)}` }] });
        if (a === 'P052') { item.catalogId = 'P052'; item.qty = 1; } else if (a) { item.catalogId = 'P051'; item.qty = 6; }
      }
      if (it.choice === 'sedation') {
        let hours = it.hours;
        if (it.flags.includes('sedationOptional') || hours == null) {
          const a = ask({ id: `${qid}.sedation`, priority: 'high', category: 'Clinical', text: `"${it.source}" – is sedation included, and for how long?`, options: [{ value: '0', label: 'Without sedation' }, ...[1, 2, 3, 4].map(h => ({ value: String(h), label: `${h} h – ${eur(byId.P204.price + byId.P205.price * (h - 1))}` }))] });
          hours = a != null ? +a : null;
          if (a == null) item.status = 'tbc';
        }
        if (hours === 0) continue;
        if (hours) {
          stage.items.push({ ...item, key: qid + 'a', name: byId.P204.name, catalogId: 'P204', qty: 1, unitPrice: byId.P204.price, priceSource: 'list', status: 'ok' });
          if (hours > 1) stage.items.push({ ...item, key: qid + 'b', name: byId.P205.name, catalogId: 'P205', qty: hours - 1, unitPrice: byId.P205.price, priceSource: 'list', status: 'ok' });
          continue;
        }
        item.name = 'Sedation (duration to confirm)';
      }
      if (it.group === 'bone' && priceFor.bone) { item.unitPrice = priceFor.bone; item.priceSource = 'dentist'; if (/per side/i.test(transcript)) item.qty = item.qty || 2; }
      if (it.group === 'gingival' && it.flags.includes('eachImplant')) item.qty = implantsPlaced || item.qty;
      if (it.group === 'sealing') { const c = stage.items.find(x => x.choice === 'crown'); item.qty = c?.qty ?? item.qty; }
      if (it.dictatedPrice != null && item.catalogId && byId[item.catalogId].price !== it.dictatedPrice) {
        const lp = byId[item.catalogId].price;
        const a = ask({ id: `${qid}.price`, priority: 'high', category: 'Pricing', text: `"${it.source}": dictated ${eur(it.dictatedPrice)} but the price list says ${eur(lp)} for "${byId[item.catalogId].name}". Which applies?`, options: [{ value: String(it.dictatedPrice), label: `${eur(it.dictatedPrice)} (dictated)` }, { value: String(lp), label: `${eur(lp)} (price list)` }] });
        if (a) { item.unitPrice = +a; item.priceSource = +a === lp ? 'list' : 'dentist'; }
      }
      if (it.flags.includes('discountUnspecified')) {
        const a = ask({ id: `${qid}.discount`, priority: 'medium', category: 'Pricing', text: `"${it.source}" – a discount was mentioned without a percentage. Which discount?`, options: ['0', '10', '20', '30', '50'].map(v => ({ value: v, label: `${v}%` })), free: true });
        if (a != null) item.discountPct = +a; else item.status = 'tbc';
      }
      if (it.flags.includes('tentative')) {
        const a = ask({ id: `${qid}.include`, priority: 'medium', category: 'Clinical', text: `"${it.source}" was dictated as a possibility. Include it in the quote?`, options: [{ value: 'yes', label: 'Include' }, { value: 'no', label: 'Exclude (mention as option only)' }] });
        if (a === 'no') continue; if (a == null) item.status = 'tbc';
      }
      if (it.flags.includes('notInPriceList')) {
        const a = ask({ id: `${qid}.manual`, priority: 'medium', category: 'Pricing', text: `"${it.source}" is not in the clinic price list. Enter a price in EUR, or 0 to exclude from the quote.`, options: [{ value: '0', label: 'Exclude from quote' }], free: true });
        if (a != null && +a === 0) continue;
        if (a != null) { item.unitPrice = +a; item.priceSource = 'dentist'; }
        item.name = it.source.replace(/^\W+/, '');
      }
      if (gd && (globalScope === 'all' || (globalScope === 'mentioned' && it.flags.includes('servicemanMention'))) && !it.flags.includes('freeOfCharge')) item.discountPct = Math.max(item.discountPct, gd.pct);
      if (it.flags.includes('freeOfCharge')) item.note = 'Free of charge (programme)';

      if (item.catalogId && !item.name) item.name = byId[item.catalogId].name;
      if (!item.name) item.name = it.source;
      if (item.catalogId && item.unitPrice == null) { item.unitPrice = byId[item.catalogId].price; item.priceSource = 'list'; }
      if (item.qty == null) item.qty = 1;
      if (item.unitPrice == null) item.status = 'tbc';
      stage.items.push(item);
    }
    stage.title = titleFor(stage);
    return stage;
  });

  // merge duplicate stage if requested
  for (let i = stages.length - 1; i > 0; i--) if (ans(`stage.dup.${i}`) === 'merge') { stages[i - 1].items.push(...stages[i].items); stages.splice(i, 1); }
  stages.forEach((s, i) => (s.number = i + 1));

  if (ex.negations.length) ask({ id: 'contradiction', priority: 'high', category: 'Consistency', text: `Contradictory statement detected: "${ex.negations[0]}". Should any extraction be included?`, options: [{ value: 'no', label: 'No extraction' }, { value: 'yes', label: 'Yes, add extractions (specify via correction)' }] });

  const plan = { patientName: patientName || '', dentist: meta.dentist || '', clinic: meta.clinic || 'Clinic', date: meta.date || new Date().toISOString().slice(0, 10), notes: ex.notes, stages, brand: brand ? BRANDS[brand]?.label : null };
  computeTotals(plan);
  const questions = Q.sort((a, b) => PRIORITY[a.priority] - PRIORITY[b.priority]);
  return { plan, questions, open: questions.filter(q => q.answer == null) };
}

function titleFor(stage) {
  const g = new Set(stage.items.map(i => i.group));
  if (g.has('implant')) return 'Implant placement';
  if (g.has('crown')) return 'Final restoration (crowns)';
  if (g.has('tempcrown') || g.has('abutment')) return 'Healing abutments & temporary crowns';
  if (g.has('bone') || g.has('lamina')) return 'Bone augmentation';
  return 'Treatment';
}

export function computeTotals(plan) {
  let total = 0, tbc = 0;
  for (const s of plan.stages) {
    s.subtotal = 0;
    for (const i of s.items) {
      i.lineTotal = i.unitPrice == null ? null : round(i.qty * i.unitPrice * (1 - (i.discountPct || 0) / 100));
      if (i.lineTotal == null) tbc++; else s.subtotal += i.lineTotal;
    }
    s.subtotal = round(s.subtotal); total += s.subtotal;
  }
  plan.total = round(total); plan.tbcCount = tbc;
  return plan;
}
export const round = n => Math.round(n * 100) / 100;
