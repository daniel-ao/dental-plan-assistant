// Treatment Planning Agent + Validation & Questioning Agent.
// buildPlan is a pure function: (transcript, answers) -> { plan, questions, open }.
//
// Pricing contract (enforced here and by tests/pricing.test.mjs):
//  * a line is priced ONLY from (a) a price-list item, at its exact list price, or (b) a price the
//    dentist explicitly dictated or typed, labelled priceSource 'dentist';
//  * anything ambiguous (system, crown type, quantity, dictated price vs list) becomes a question and
//    the line stays "TBC" (excluded from the total) until it is answered. Nothing is guessed.
import { extract, byId, IMPLANT_SYSTEMS, CROWNS, FAMILY_RE, familyOf, eur, itemLabel, codeOf } from './extract.js?v=5';
import { CATALOG } from '../catalog.js?v=5';

const PRIORITY = { high: 0, medium: 1, low: 2 };
const QTY_REQUIRED = ['implant', 'abutment', 'tempcrown', 'crown', 'gingival', 'scan'];
const uniq = a => [...new Set(a)];
const distinctPrices = ids => uniq(ids.map(id => byId[id].price));
const optId = id => ({ value: `id:${id}`, label: itemLabel(id) });

export function buildPlan(transcript, answers = {}, meta = {}) {
  const ex = extract(transcript || '');
  const Q = [];
  const ask = q => { if (!Q.some(x => x.id === q.id)) { q.answer = answers[q.id]; Q.push(q); } return answers[q.id]; };

  // ---------- Patient ----------
  const patientName = meta.patientName?.trim() || answers['patient.name'];
  if (!meta.patientName?.trim()) ask({ id: 'patient.name', priority: 'high', category: 'Patient', text: 'What is the patient\'s full name?', options: [], free: true });

  // ---------- Implant system (exact price-list items) ----------
  const hasImplantWork = ex.items.some(i => ['implant', 'crown'].includes(i.group));
  let implantId = null;
  if (hasImplantWork) {
    const fams = Object.keys(FAMILY_RE).filter(f => f !== 'korean' && FAMILY_RE[f].test(transcript));
    let cands = IMPLANT_SYSTEMS.filter(s => !fams.length || fams.includes(s.family));
    const specific = cands.filter(s => s.words.test(transcript) && s.family !== 'megagen' || (s.family === 'megagen' && s.words.test(transcript) && !/megagen(?! ?(st|anyone|anyridge))/i.test(s.words.source) ));
    if (specific.length === 1) cands = specific;
    if (distinctPrices(cands.map(c => c.id)).length === 1) implantId = cands[0].id;
    else {
      const hint = uniq(ex.dictatedPrices.filter(p => p.noun === 'implant').flatMap(p => [p.price, p.alt]).filter(Boolean)).map(v => IMPLANT_SYSTEMS.find(s => byId[s.id].price === v)).filter(Boolean).map(s => `dictated ${eur(byId[s.id].price)} = ${byId[s.id].name}`);
      const a = ask({ id: 'implant.system', priority: 'high', category: 'Components', text: (hint.length ? `(${hint.join('; ')}) ` : '') + (fams.length ? `Which ${fams.join('/')} implant from the price list?` : 'Which implant system should be quoted? (sets implant and crown prices from the price list)'), options: cands.map(c => optId(c.id)) });
      if (a) implantId = a.replace('id:', '');
    }
  }
  const family = implantId ? familyOf(implantId) : null;

  // ---------- Crown type (exact price-list items for that implant family) ----------
  let crownId = null;
  const crownItems = ex.items.filter(i => i.group === 'crown');
  if (crownItems.length && family) {
    let cands = CROWNS[family] || [];
    const flags = crownItems.flatMap(i => i.flags);
    if (flags.includes('ST')) cands = cands.filter(id => /^ST /.test(byId[id].name));
    else if (flags.includes('ML')) cands = cands.filter(id => !/^ST /.test(byId[id].name));
    if (cands.length && distinctPrices(cands).length === 1) crownId = cands[0];
    else if (cands.length) {
      const ceramic = flags.includes('ceramicDictated') ? ' "Ceramic" was dictated, but the price list only has zirconia crowns on implants.' : '';
      const a = ask({ id: 'crown.type', priority: 'high', category: 'Components', text: `Which crown on ${byId[implantId].name.replace(/ implant placement.*/, '')} implants?${ceramic}`, options: cands.map(optId) });
      if (a) crownId = a.replace('id:', '');
    }
  }

  // ---------- Global discount ----------
  const gd = ex.globalHints.find(h => h.kind === 'globalDiscount');
  const globalScope = gd ? ask({ id: 'discount.scope', priority: 'high', category: 'Pricing', text: `A ${gd.pct}% discount was dictated ("${gd.source}"). Apply it to which items?`, options: [{ value: 'all', label: `All items (-${gd.pct}%)` }, { value: 'mentioned', label: 'Only items where the discount was explicitly mentioned' }] }) : null;

  // ---------- Dictated unit prices for implants / crowns / bone grafting ----------
  const dictated = {};   // noun -> { value|null (null = question open) }
  const listMatch = (v, kind) => CATALOG.filter(c => c.price === v && (kind === 'implant' ? /implant placement/i.test(c.name) : kind === 'crown' ? /crown on .*implant/i.test(c.name) : /bone|lamina/i.test(c.name)));
  for (const noun of ['implant', 'crown', 'bone']) {
    const list = ex.dictatedPrices.filter(p => p.noun === noun);
    if (!list.length) continue;
    const values = uniq(list.flatMap(p => [p.price, p.alt, p.max].filter(v => v != null)));
    const selId = noun === 'implant' ? implantId : noun === 'crown' ? crownId : null;
    const lp = selId ? byId[selId].price : null;
    if (values.length === 1 && values[0] === lp) { dictated[noun] = { value: lp, source: 'list' }; continue; }
    const opts = values.map(v => { const m = listMatch(v, noun); return { value: String(v), label: `${eur(v)} – dictated${m.length ? ` (= ${m[0].name} in price list)` : ' (not in price list)'}` }; });
    if (lp != null && !values.includes(lp)) opts.push({ value: String(lp), label: `${eur(lp)} – price list (${byId[selId].name})` });
    const range = list.find(p => p.max);
    const text = range ? `${noun === 'bone' ? 'Bone grafting' : noun} was dictated as a range (${eur(range.price)}–${eur(range.max)}${range.perSide ? ' per side' : ''}). Which unit price should be quoted?`
      : values.length > 1 ? `Different ${noun} prices were dictated (${values.map(eur).join(', ')}). Which unit price applies?`
      : `The dictated ${noun} price ${eur(values[0])} differs from the price list${lp != null ? ` (${eur(lp)})` : ''}. Which applies?`;
    const a = ask({ id: `price.${noun}`, priority: 'high', category: 'Pricing', text, options: opts, free: true });
    dictated[noun] = a != null ? { value: +a, source: lp != null && +a === lp ? 'list' : 'dentist' } : { value: null };
    if (noun === 'bone' && list.some(p => p.perSide)) {
      const s = ask({ id: 'bone.sides', priority: 'medium', category: 'Clinical', text: 'Bone grafting is priced per side. On how many sides?', options: [{ value: '1', label: '1 side' }, { value: '2', label: '2 sides' }] });
      dictated.bone.sides = s != null ? +s : null;
    }
  }

  // ---------- Duplicate catalog entries for temporary crowns ----------
  let tempId = 'P141';
  if (ex.items.some(i => i.group === 'tempcrown')) {
    const a = ask({ id: 'tempcrown.variant', priority: 'low', category: 'Pricing', text: '"Temporary crown on implant" appears twice in the price list with different prices. Which line should be used?', options: [{ value: 'id:P141', label: `${eur(51.37)} – Implantology, code 6.22` }, { value: 'id:P187', label: `${eur(50.97)} – Implant prosthetics, code 6.22` }] });
    if (a) tempId = a.replace('id:', '');
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

    // de-duplicate repeated mentions of the same implant / crown order inside a stage
    let items = s.items;
    for (const g of ['implant', 'crown']) {
      const same = items.filter(i => i.group === g);
      if (same.length > 1) {
        const keep = same.find(i => i.teeth.length) || same[0];
        for (const o of same) if (o !== keep) { if (o.range && !keep.range) keep.range = o.range; keep.flags = uniq([...keep.flags, ...o.flags]); keep.source += ' / ' + o.source; if (o.qty && !keep.qty) keep.qty = o.qty; }
        if (keep.range && keep.teeth.length) keep.range = null;
        items = items.filter(i => i.group !== g || i === keep);
      }
    }
    const implantsThisStage = items.filter(i => i.group === 'implant').reduce((a, i) => a + (i.qty || 0), 0);

    const globalPct = it => (gd && !it.flags.includes('freeOfCharge') && (globalScope === 'all' || (globalScope === 'mentioned' && (it.flags.includes('servicemanMention') || it.discountPct))) ? gd.pct : 0);
    for (const it of items) {
      const qid = it.key;
      const item = { ...it, name: '', unitPrice: null, priceSource: null, status: 'ok', note: '', code: null, section: null };
      const tbc = why => { item.status = 'tbc'; item.note = item.note ? `${item.note}; ${why}` : why; };

      // --- catalog item ---
      if (it.group === 'implant') { item.catalogId = implantId; if (!implantId) tbc('implant system to confirm'); }
      if (it.group === 'crown') { item.catalogId = crownId; if (!crownId) tbc(implantId ? 'crown type to confirm' : 'implant system to confirm'); }
      if (it.group === 'tempcrown') item.catalogId = tempId;
      if (!item.catalogId && it.candidates) {
        const a = ask({ id: `${qid}.item`, priority: 'high', category: 'Pricing', text: `"${it.source}" matches several price-list items. Which one?`, options: it.candidates.map(optId) });
        if (a) item.catalogId = a.replace('id:', ''); else { item.name = `${byId[it.candidates[0]].name.split(' ')[0]} ${it.group === 'sinus' ? 'lift' : 'grafting'} (price-list item to confirm)`; tbc('price-list item to confirm'); }
      }
      if (it.choice === 'srp') {
        const a = ask({ id: `${qid}.srp`, priority: 'medium', category: 'Pricing', text: `"${it.source}" – the price list has no per-segment SRP. Which price-list item?`, options: [{ value: 'P052', label: `SRP, one jaw – ${eur(byId.P052.price)}` }, { value: '8', label: `SRP, one tooth × 8 (full quadrant) – ${eur(byId.P051.price * 8)}` }], free: true });
        if (a === 'P052') { item.catalogId = 'P052'; item.qty = 1; } else if (a != null && +a > 0) { item.catalogId = 'P051'; item.qty = +a; } else tbc('price-list item to confirm');
      }
      if (it.choice === 'sedation') {
        let hours = it.flags.includes('sedationOptional') || it.hours == null ? null : it.hours;
        if (hours == null) {
          const a = ask({ id: `${qid}.sedation`, priority: 'high', category: 'Clinical', text: `"${it.source}" – is sedation included, and for how long?`, options: [{ value: '0', label: 'Without sedation' }, ...[1, 2, 3, 4].map(h => ({ value: String(h), label: `${h} h – ${eur(byId.P204.price + byId.P205.price * (h - 1))}` }))] });
          if (a != null) hours = +a;
        }
        if (hours === 0) continue;
        if (hours) {
          const d = Math.max(item.discountPct, globalPct(it)), st8 = gd && globalScope == null ? 'tbc' : 'ok';
          stage.items.push(price({ ...item, key: qid + 'a', catalogId: 'P204', qty: 1, discountPct: d, status: st8 }));
          if (hours > 1) stage.items.push(price({ ...item, key: qid + 'b', catalogId: 'P205', qty: hours - 1, discountPct: d, status: st8 }));
          continue;
        }
        item.name = 'Sedation with anaesthesiologist (duration to confirm)';
        tbc('duration to confirm');
      }

      // --- quantity ---
      if (it.group === 'implant' && it.range) {
        const a = ask({ id: `${qid}.qty`, priority: 'high', category: 'Clinical', text: `"${it.source}" – how many implants exactly?`, options: it.range.map(v => ({ value: String(v), label: `${v} implants` })) });
        item.qty = a != null ? +a : null;
      }
      if (it.group === 'implant' && it.flags.includes('perSide') && it.qty) {
        const a = ask({ id: `${qid}.perside`, priority: 'high', category: 'Clinical', text: `"${it.source}" – ${it.qty} implants per side. How many implants in total?`, options: [{ value: String(it.qty), label: `${it.qty} (one side)` }, { value: String(it.qty * 2), label: `${it.qty * 2} (both sides)` }], free: true });
        item.qty = a != null ? +a : null;
      }
      if (it.group === 'gingival' && it.flags.includes('eachImplant')) item.qty = implantsPlaced + implantsThisStage || null;
      if (it.group === 'sealing') {
        const crown = stage.items.find(x => x.group === 'crown');
        item.qty = crown?.qty ?? null;
        if (!crown || crown.status === 'tbc') tbc('one per crown – follows the crown quantity');
      }
      if (item.qty == null && QTY_REQUIRED.includes(it.group) && !(it.range && it.group === 'implant')) {
        const so = implantsPlaced + (it.group === 'implant' ? 0 : implantsThisStage);
        const a = ask({ id: `${qid}.qty`, priority: 'high', category: 'Clinical', text: `"${it.source}" – what quantity?`, options: so ? [{ value: String(so), label: `${so} (implants planned so far)` }] : [], free: true });
        item.qty = a != null ? +a : null;
      }
      if (['crown', 'tempcrown'].includes(it.group) && item.qty && implantsPlaced + implantsThisStage && item.qty > implantsPlaced + implantsThisStage) {
        const n = implantsPlaced + implantsThisStage;
        const a = ask({ id: `${qid}.count`, priority: 'high', category: 'Consistency', text: `"${it.source}": ${item.qty} ${it.group === 'crown' ? 'crowns' : 'temporary crowns'}, but only ${n} implants are planned by Stage ${number}. How many?`, options: [{ value: String(n), label: `${n} (one per implant)` }, { value: String(item.qty), label: `${item.qty} (as dictated)` }], free: true });
        if (a != null) item.qty = +a; else tbc('quantity to confirm');
      }
      if (it.group === 'implant') implantsPlaced += item.qty || 0;
      if (item.qty == null && !QTY_REQUIRED.includes(it.group) && it.group !== 'sealing') item.qty = 1;

      // --- dictated prices ---
      const noun = it.group === 'implant' ? 'implant' : it.group === 'crown' ? 'crown' : it.group === 'bone' && dictated.bone ? 'bone' : null;
      if (noun && dictated[noun]) {
        if (dictated[noun].value == null) tbc('price to confirm');
        else if (dictated[noun].source === 'dentist') { item.unitPrice = dictated[noun].value; item.priceSource = 'dentist'; }
        if (noun === 'bone' && dictated.bone.sides !== undefined) { if (dictated.bone.sides == null) tbc('number of sides to confirm'); else item.qty = dictated.bone.sides; }
      }
      if (it.dictatedPrice != null && item.catalogId && byId[item.catalogId].price !== it.dictatedPrice) {
        const lp = byId[item.catalogId].price, same = CATALOG.filter(c => c.price === it.dictatedPrice).slice(0, 3);
        const a = ask({ id: `${qid}.price`, priority: 'high', category: 'Pricing', text: `"${it.source}": ${eur(it.dictatedPrice)} was dictated, but "${byId[item.catalogId].name}" costs ${eur(lp)} in the price list.${same.length ? ` Items at ${eur(it.dictatedPrice)} in the list: ${same.map(c => c.name).join('; ')}.` : ''} Which applies?`, options: [optId(item.catalogId), ...same.map(c => optId(c.id)), { value: `eur:${it.dictatedPrice}`, label: `${eur(it.dictatedPrice)} – dentist price (not a list price for this item)` }] });
        if (a == null) tbc('price to confirm');
        else if (a.startsWith('id:')) item.catalogId = a.slice(3);
        else { item.unitPrice = +a.slice(4); item.priceSource = 'dentist'; }
      }

      // --- discounts & inclusion ---
      if (it.flags.includes('discountUnspecified')) {
        const a = ask({ id: `${qid}.discount`, priority: 'medium', category: 'Pricing', text: `"${it.source}" – a discount was mentioned without a percentage. Which discount?`, options: ['0', '10', '20', '30', '50'].map(v => ({ value: v, label: `${v}%` })), free: true });
        if (a != null) item.discountPct = +a; else tbc('discount % to confirm');
      }
      if (it.flags.includes('tentative')) {
        const a = ask({ id: `${qid}.include`, priority: 'medium', category: 'Clinical', text: `"${it.source}" was dictated as a possibility. Quote "${byId[item.catalogId]?.name || it.source}"?`, options: [{ value: 'yes', label: 'Include' }, { value: 'no', label: 'Exclude (mention as option only)' }] });
        if (a === 'no') continue; if (a == null) tbc('inclusion to confirm');
      }
      if (it.group === 'extraction' && ex.negations.length) {
        const a = ask({ id: 'contradiction', priority: 'high', category: 'Consistency', text: `Contradictory statements about extraction: "${it.source}" vs "${ex.negations[0]}". Include extractions?`, options: [{ value: 'no', label: 'No extraction' }, { value: 'yes', label: 'Yes, include extraction' }] });
        if (a === 'no') continue; if (a == null) tbc('contradiction to resolve');
      }
      if (it.flags.includes('notInPriceList')) {
        const a = ask({ id: `${qid}.manual`, priority: 'medium', category: 'Pricing', text: `"${it.source}" is not in the clinic price list. Enter a price in EUR, or exclude it from the quote.`, options: [{ value: '0', label: 'Exclude from quote' }], free: true });
        if (a != null && +a === 0) continue;
        item.name = it.source.replace(/^\W+/, '');
        if (a != null) { item.unitPrice = +a; item.priceSource = 'dentist'; } else tbc('not in price list');
      }
      item.discountPct = Math.max(item.discountPct, globalPct(it));
      if (gd && globalScope == null && !it.flags.includes('freeOfCharge')) tbc('discount scope to confirm');
      if (it.flags.includes('freeOfCharge')) item.note = 'Free of charge (programme)';
      stage.items.push(price(item));
    }
    stage.title = titleFor(stage);
    return stage;
  });

  for (let i = stages.length - 1; i > 0; i--) if (answers[`stage.dup.${i}`] === 'merge') { stages[i - 1].items.push(...stages[i].items); stages.splice(i, 1); }
  stages.forEach((s, i) => (s.number = i + 1));

  const plan = {
    patientName: patientName || '', dentist: meta.dentist || '', clinic: meta.clinic || 'Clinic', date: meta.date || new Date().toISOString().slice(0, 10),
    notes: ex.notes, stages, brand: implantId ? byId[implantId].name.replace(/ implant placement.*/, '') : null,
  };
  computeTotals(plan);
  const questions = Q.sort((a, b) => PRIORITY[a.priority] - PRIORITY[b.priority]);
  return { plan, questions, open: questions.filter(q => q.answer == null) };
}

// Attach name, code, section and list price; never overwrite a dentist price; unresolved -> TBC.
function price(item) {
  const c = item.catalogId && byId[item.catalogId];
  if (c) {
    item.name = item.name && item.group === 'sedation' && !item.catalogId ? item.name : c.name;
    item.code = codeOf(c.id); item.section = c.category;
    if (item.priceSource !== 'dentist') { item.unitPrice = c.price; item.priceSource = 'list'; }
  }
  if (!item.name) item.name = item.source;
  if (item.unitPrice == null || item.qty == null) {
    item.status = 'tbc';
    if (!item.note) item.note = item.qty == null ? 'quantity to confirm' : 'price-list item to confirm';
  }
  return item;
}

function titleFor(stage) {
  const g = new Set(stage.items.map(i => i.group));
  if (g.has('implant')) return 'Implant placement';
  if (g.has('crown')) return 'Final crowns';
  if (g.has('tempcrown') || g.has('abutment')) return 'Healing abutments & temporary crowns';
  if (g.has('bone') || g.has('lamina') || g.has('sinus')) return 'Bone augmentation';
  return 'Treatment';
}

export function computeTotals(plan) {
  let total = 0, tbc = 0, gross = 0;
  for (const s of plan.stages) {
    s.subtotal = 0;
    for (const i of s.items) {
      const ok = i.status !== 'tbc' && i.unitPrice != null && i.qty != null;
      i.lineTotal = ok ? round(i.qty * i.unitPrice * (1 - (i.discountPct || 0) / 100)) : null;
      if (i.lineTotal == null) tbc++; else { s.subtotal += i.lineTotal; gross += round(i.qty * i.unitPrice); }
    }
    s.subtotal = round(s.subtotal); total += s.subtotal;
  }
  plan.total = round(total); plan.gross = round(gross); plan.discountTotal = round(gross - total); plan.tbcCount = tbc;
  return plan;
}
export const round = n => Math.round(n * 100) / 100;
