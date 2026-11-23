// French dictation: a French note must give the same plan as the same note in English, priced only
// from the clinic price list, and French corrections must patch the same fields as English ones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan } from '../src/engine/plan.js';
import { applyCorrection } from '../src/engine/revise.js';
import { looksFrench, frenchToEngine } from '../src/engine/french.js';
import { CATALOG } from '../src/catalog.js';
import { SAMPLES } from '../src/samples.js';
import { FR, FR_DEMO, FR_VOICE } from './fr_notes.mjs';

const byId = Object.fromEntries(CATALOG.map(c => [c.id, c]));
const EN = n => SAMPLES.find(s => s.label.startsWith(`Patient ${n}`)).text;
const shape = plan => plan.stages.map(s => ({
  interval: s.interval,
  items: s.items.map(i => ({ id: i.catalogId, group: i.group, qty: i.qty, pct: i.discountPct, teeth: i.teeth, status: i.status, unitPrice: i.unitPrice })),
}));
function solve(text) {
  const answers = {};
  let r;
  for (let k = 0; k < 8; k++) {
    r = buildPlan(text, answers, { patientName: 'Test' });
    if (!r.open.length) break;
    for (const q of r.open) answers[q.id] = q.options.length ? q.options[0].value : '2';
  }
  return { ...r, answers };
}
const items = plan => plan.stages.flatMap(s => s.items);

test('English notes are not treated as French, French notes are', () => {
  for (const s of SAMPLES.filter(s => !/français/.test(s.label))) assert.equal(looksFrench(s.text), false, s.label);
  for (const n of [1, 2, 3, 4, 5]) assert.equal(looksFrench(FR[n]), true, `patient ${n}`);
  assert.ok(looksFrench(FR_VOICE));
});

for (const n of [1, 2, 3, 4, 5]) {
  test(`Patient ${n} dictated in French gives the same plan and questions as in English`, () => {
    const en = buildPlan(EN(n), {}, { patientName: 'x' }), fr = buildPlan(FR[n], {}, { patientName: 'x' });
    assert.deepEqual(shape(fr.plan), shape(en.plan));
    assert.deepEqual(fr.open.map(q => q.id), en.open.map(q => q.id));
    assert.deepEqual(fr.open.map(q => q.options.map(o => o.value)), en.open.map(q => q.options.map(o => o.value)));
  });
  test(`Patient ${n} in French: once every question is answered, same lines and total as in English`, () => {
    const en = solve(EN(n)), fr = solve(FR[n]);
    assert.equal(fr.open.length, 0);
    assert.deepEqual(fr.answers, en.answers);
    assert.deepEqual(shape(fr.plan), shape(en.plan));
    assert.equal(fr.plan.total, en.plan.total);
    for (const i of items(fr.plan)) if (i.priceSource === 'list') assert.equal(i.unitPrice, byId[i.catalogId].price, i.name);
  });
}

test('French demo note gives the same plan as the English demo', () => {
  const a = { 'implant.system': 'id:P125', 'crown.type': 'id:P123', 'interval.1': '3 months', 'interval.2': '1 month' };
  const en = buildPlan(SAMPLES[0].text, a, { patientName: 'x' }), fr = buildPlan(FR_DEMO, a, { patientName: 'x' });
  assert.deepEqual(shape(fr.plan), shape(en.plan));
  assert.equal(fr.plan.total, en.plan.total);
});

test('raw French voice transcript (no punctuation, numbers in words) is split into the right items', () => {
  const r = buildPlan(FR_VOICE, { 'implant.system': 'id:P125', 'crown.type': 'id:P123' }, { patientName: 'x' });
  const [s1, s2, s3] = r.plan.stages;
  assert.equal(r.plan.stages.length, 3);
  assert.deepEqual(s1.items.map(i => i.catalogId).sort(), ['P013', 'P014', 'P031', 'P089', 'P125', 'P204', 'P205'].sort());
  assert.equal(s1.items.find(i => i.catalogId === 'P031').discountPct, 10); // "hygiène ... avec une remise de 10 %"
  assert.equal(s1.items.find(i => i.catalogId === 'P089').discountPct, 0);  // the discount does not leak to the extraction
  assert.deepEqual(s1.items.find(i => i.group === 'implant').teeth, ['36']);
  assert.equal(s1.items.find(i => i.catalogId === 'P205').qty, 1);          // sedation 2 h = first hour + 1
  assert.equal(s2.interval, 'After 3 months');
  assert.deepEqual(s2.items.map(i => [i.catalogId, i.qty]), [['P128', 1], ['P200', 1]]);
  assert.equal(s3.interval, 'After 1 month');
  assert.deepEqual(s3.items.map(i => [i.catalogId, i.qty]), [['P123', 1], ['P120', 1]]);
  assert.equal(r.open.length, 0);
});

test('tooth numbers spoken in words and French number formats are understood', () => {
  assert.match(frenchToEngine('implants en quarante-cinq, trente-cinq et vingt et un'), /at site 45, 35 and 21/);
  assert.match(frenchToEngine('extraction de la dix-huit'), /extraction on tooth 18/);
  assert.match(frenchToEngine('Greffe osseuse 1 200 à 1 400 € par côté'), /bone grafting 1200–1400 € per side/i);
  assert.match(frenchToEngine('implants à 630,50 euros pièce'), /implants at 630\.50 EUR each/i);
  assert.match(frenchToEngine('remise de 30 pour cent'), /a 30% discount/);
  const r = buildPlan('Étape 1 : pose de deux implants Osstem en quarante-six et quarante-sept.', {}, { patientName: 'x' });
  const imp = items(r.plan).find(i => i.group === 'implant');
  assert.deepEqual([imp.catalogId, imp.qty, imp.teeth], ['P125', 2, ['46', '47']]);
});

test('French notes, item sources and unpriced lines keep the dentist\'s own words', () => {
  const r4 = buildPlan(FR[4], {}, {});
  assert.ok(r4.plan.notes.includes('Le patient joue du saxophone (loisir)'));
  assert.ok(r4.plan.notes.includes('Prothésiste : Mariana'));
  assert.ok(items(r4.plan).some(i => i.group === 'unpriced' && i.name === 'Éventuellement meulage de la dent du bas – 43'));
  const r5 = buildPlan(FR[5], {}, {});
  assert.ok(r5.plan.notes.includes("Pas d'os dans le segment 4"));
  assert.ok(items(r5.plan).some(i => i.name === 'Hébergement du patient (chambres)'));
  const r3 = buildPlan(FR[3], {}, {});
  assert.ok(r3.open.some(q => q.text.includes('"greffe osseuse dans le segment 1 au prix du tarif de 630 €" matches several price-list items')));
});

test('a dictated French price is never used silently: it is asked against the list price', () => {
  const r = buildPlan("Étape 1 : pose d'un implant Osstem en 26 au prix de 500 €.", {}, { patientName: 'x' });
  const imp = items(r.plan).find(i => i.group === 'implant');
  assert.equal(imp.status, 'tbc');
  assert.ok(r.open.some(q => /€500\.00 was dictated/.test(q.text)));
});

// ---------- corrections ----------
const demoPlan = () => buildPlan(FR_DEMO, { 'implant.system': 'id:P125', 'crown.type': 'id:P123', 'interval.1': '3 months', 'interval.2': '1 month' }, { patientName: 'x' }).plan;
const CASES = [
  ['Supprime la radiographie.', /Removed "Dental radiograph" from Stage 1/],
  ["Enlève l'hygiène préopératoire", /Removed "Pre-operative professional hygiene"/],
  ["Supprime l'implant de la 16", /Removed "Osstem implant placement/],
  ['Déplace la vis de cicatrisation en étape 3.', /Moved "Healing abutment placement" to Stage 3/],
  ["Déplace l'hygiène à l'étape 2", /Moved "Pre-operative professional hygiene" to Stage 2/],
  ["Change le prix de l'implant à 1200 €.", /Price of "Osstem implant placement \(Korea\)": 460 → €1200/],
  ["Le prix de l'implant est de 900 euros", /→ €900/],
  ['Applique une remise de 20 % sur la couronne.', /Discount on "Zirconia crown on Osstem implant" set to 20%/],
  ["Mets 15 % de remise sur l'implant", /Discount on "Osstem implant placement \(Korea\)" set to 15%/],
  ["Ajoute un guide chirurgical à l'étape 1", /Added "Surgical guide for 3–4 implants" \(€120\) to Stage 1/],
  ['Ajoute une greffe osseuse comme nouvelle étape.', /Added "bone grafting" – price-list variant to confirm: .* to Stage 2/],
  ["Le patient s'appelle Jean Dupont.", /Patient name → Jean Dupont/],
  ["Change l'intervalle de l'étape 2 à 4 mois.", /Stage 2 interval → After 4 months/],
  ['Passe les implants en Straumann BLT.', /Implant → Straumann BLT implant placement/],
  ['Les couronnes doivent être en zircone ST', /Crown → ST zirconia crown on Osstem implant \(€310\)/],
];
for (const [cmd, expected] of CASES) test(`French correction: "${cmd}"`, () => {
  const { changes } = applyCorrection(demoPlan(), cmd);
  assert.match(changes.join(' | '), expected);
  assert.doesNotMatch(changes.join(' | '), /Not understood/);
});

test('French corrections: two commands in one sentence, unrelated lines untouched', () => {
  const plan = demoPlan();
  const before = JSON.stringify(plan.stages[1].items);
  const { changes } = applyCorrection(plan, 'Supprime la radiographie et aussi déplace la couronne en étape 1.');
  assert.equal(changes.length, 2);
  assert.ok(!items(plan).some(i => i.catalogId === 'P014'));
  assert.ok(plan.stages[0].items.some(i => i.group === 'crown'));
  assert.equal(JSON.stringify(plan.stages[1].items), before);
});

test('French corrections never invent a price: unknown items stay to confirm', () => {
  const plan = demoPlan();
  const { changes } = applyCorrection(plan, 'Ajoute un blanchiment des dents.');
  assert.match(changes[0], /price TBC – not in price list|price-list variant to confirm/);
  const added = plan.stages.at(-1).items.at(-1);
  assert.equal(added.unitPrice, null);
  assert.equal(added.status, 'tbc');
});
