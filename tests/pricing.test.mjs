// Price-list integrity: every euro on a plan must come from data/Dental_Price_List_EUR.xlsx
// or from a price the dentist explicitly dictated/typed. Read the xlsx directly (no generator in the loop).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readPriceList } from './xlsx.mjs';
import { CATALOG } from '../src/catalog.js';
import { buildPlan } from '../src/engine/plan.js';
import { SAMPLES } from '../src/samples.js';

const rows = readPriceList(new URL('../data/Dental_Price_List_EUR.xlsx', import.meta.url).pathname).slice(1);
const priced = rows.filter(r => r[2] != null);
const byId = Object.fromEntries(CATALOG.map(c => [c.id, c]));
const r2 = n => Math.round(n * 100) / 100;

test('catalog.js matches the client xlsx row for row (name, code, price, section)', () => {
  assert.equal(CATALOG.length, priced.length);
  let section = null, k = 0;
  for (const [name, code, price] of rows) {
    if (price == null) { section = name; continue; }
    const c = CATALOG[k++];
    assert.equal(c.name, name.trim(), `row ${k}`);
    assert.equal(c.price, r2(price), `${name}`);
    assert.equal(c.category, section, `${name}`);
    assert.equal(c.code == null ? null : String(c.code), code == null ? null : String(code), `${name}`);
  }
});

// Answer every open question with option #pick (first or last), repeating until no new questions appear.
function solve(text, pick) {
  const answers = {};
  let r;
  for (let k = 0; k < 8; k++) {
    r = buildPlan(text, answers, { patientName: 'Test' });
    if (!r.open.length) break;
    for (const q of r.open) answers[q.id] = q.options.length ? q.options[pick === 'last' ? q.options.length - 1 : 0].value : '2';
  }
  return { ...r, answers };
}

function assertPlanPricing(plan, answers, label) {
  const dentistValues = new Set(Object.values(answers).flatMap(v => [Number(String(v).replace(/^eur:/, ''))]));
  let total = 0, tbc = 0;
  for (const s of plan.stages) {
    let sub = 0;
    for (const i of s.items) {
      const where = `${label} / stage ${s.number} / ${i.name}`;
      if (i.status === 'tbc') { assert.equal(i.lineTotal, null, where); tbc++; continue; }
      assert.ok(i.qty > 0 && Number.isFinite(i.qty), `${where}: qty ${i.qty}`);
      assert.ok(i.discountPct >= 0 && i.discountPct <= 100, where);
      if (i.priceSource === 'list') {
        assert.ok(byId[i.catalogId], `${where}: list price without catalog id`);
        assert.equal(i.unitPrice, byId[i.catalogId].price, `${where}: unit price differs from price list`);
        assert.equal(i.name, byId[i.catalogId].name, `${where}: name differs from price list`);
      } else {
        assert.equal(i.priceSource, 'dentist', where);
        assert.ok(dentistValues.has(i.unitPrice), `${where}: dentist price ${i.unitPrice} was never dictated/answered`);
      }
      assert.equal(i.lineTotal, r2(i.qty * i.unitPrice * (1 - i.discountPct / 100)), `${where}: line total`);
      sub += i.lineTotal;
    }
    assert.equal(s.subtotal, r2(sub), `${label} stage ${s.number} subtotal`);
    total += s.subtotal;
  }
  assert.equal(plan.total, r2(total), `${label} total`);
  assert.equal(plan.tbcCount, tbc, `${label} TBC count`);
}

for (const s of SAMPLES) for (const pick of ['first', 'last']) {
  test(`${s.label}: every line priced from the list or an explicit dentist answer (${pick} options)`, () => {
    const { plan, answers, open } = solve(s.text, pick);
    assert.equal(open.length, 0, `unanswered: ${open.map(q => q.id)}`);
    assertPlanPricing(plan, answers, s.label);
  });
  test(`${s.label}: before any answer, nothing ambiguous is priced`, () => {
    const { plan } = buildPlan(s.text, {}, {});
    assertPlanPricing(plan, {}, s.label + ' (unanswered)');
    for (const st of plan.stages) for (const i of st.items) {
      if (i.priceSource === 'dentist') assert.fail(`${i.name}: dentist price before any answer`);
    }
  });
}

test('implant system is never guessed: without a dictated brand the implant line is TBC', () => {
  const { plan, open } = buildPlan(SAMPLES.find(s => s.label.startsWith('Patient 1')).text, {}, { patientName: 'x' });
  const imp = plan.stages[0].items.find(i => i.group === 'implant');
  assert.equal(imp.status, 'tbc'); assert.equal(imp.lineTotal, null);
  assert.ok(open.some(q => q.id === 'implant.system'));
});

test('crown type with different list prices (ML €450 vs ST €340) is asked, not assumed', () => {
  const { open } = buildPlan('Stage 1: Straumann implants at sites 15 and 16. Stage 2 - after 3 months: zirconia crowns on 2 implants.', {}, { patientName: 'x' });
  const q = open.find(q => q.id === 'crown.type');
  assert.ok(q);
  assert.deepEqual(q.options.map(o => o.value).sort(), ['id:P124', 'id:P185', 'id:P196']);
});

test('hand-checked total: PRD molar example priced only from the xlsx', () => {
  const demo = SAMPLES[0].text;
  const { plan, open } = buildPlan(demo, { 'implant.system': 'id:P125', 'crown.type': 'id:P123', 'interval.1': '3 months', 'interval.2': '1 month' }, { patientName: 'Jane' });
  assert.equal(open.length, 0);
  // radiograph 4.18 + pre-op hygiene 14.34 + Osstem implant 460 + healing abutment 65 + zirconia crown on Osstem 360 + sealing 14.34
  assert.equal(plan.total, 917.86);
});

test('hand-checked total: Patient 3 serviceman, -30% on everything, bone graft per price list', () => {
  const t = SAMPLES.find(s => s.label.startsWith('Patient 3')).text;
  let { questions } = buildPlan(t, {}, {});
  const ans = { 'discount.scope': 'all', 'implant.system': 'id:P125', 'tempcrown.variant': 'id:P141' };
  const boneQ = () => buildPlan(t, ans, {}).questions.find(q => /\.item$/.test(q.id) && /bone/i.test(q.text));
  ans[boneQ().id] = 'id:P133';                       // pre-implant bone grafting, multiple sites (830)
  const priceQ = buildPlan(t, ans, {}).questions.find(q => /\.price$/.test(q.id));
  ans[priceQ.id] = 'id:P133';                        // keep the price-list price, not the dictated 630
  const sed = buildPlan(t, ans, {}).questions.find(q => /sedation/.test(q.id)); ans[sed.id] = '1';
  const tq = buildPlan(t, ans, {}).questions.find(q => /tempcrown.*qty/.test(q.id)); ans[tq.id] = '4';
  const { plan, open } = buildPlan(t, ans, { patientName: 'x' });
  assert.deepEqual(open.filter(q => !/interval/.test(q.id)).map(q => q.id), []);
  // stage 1: (14.34 + 61.73 + 830 + 4*460 + 179.20) * 0.7 ; stage 2: (4*65 + 4*65 + 4*51.37) * 0.7
  const s1 = [14.34, 61.73, 830, 1840, 179.2].reduce((a, v) => a + Math.round(v * 0.7 * 100) / 100, 0);
  const s2 = [260, 260, 205.48].reduce((a, v) => a + Math.round(v * 0.7 * 100) / 100, 0);
  assert.equal(plan.total, r2(s1 + s2));
});
