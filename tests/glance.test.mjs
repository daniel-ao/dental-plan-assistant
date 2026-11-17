// Page-one "plan at a glance" (src/glance.js): the charts, timeline and cost bar may only show
// what the engine produced. Tooth numbers come from the dictation; amounts are the stage subtotals.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan } from '../src/engine/plan.js';
import { SAMPLES } from '../src/samples.js';
import { toothStates, stageShares, iconFor, stageColour, STAGE_COLOURS, UPPER, LOWER } from '../src/glance.js';

const solved = text => {
  const answers = {}; let r;
  for (let k = 0; k < 8; k++) {
    r = buildPlan(text, answers, { patientName: 'Test' });
    if (!r.open.length) break;
    for (const q of r.open) answers[q.id] = q.options.length ? q.options[0].value : '2';
  }
  return r.plan;
};

test('the chart covers all 32 adult teeth once', () => {
  const all = [...UPPER, ...LOWER];
  assert.equal(all.length, 32);
  assert.equal(new Set(all).size, 32);
});

test('only dictated teeth are marked, each with the stage that first mentions it', () => {
  for (const s of SAMPLES) {
    for (const plan of [buildPlan(s.text, {}, { patientName: 'T' }).plan, solved(s.text)]) {
      const dictated = new Map();
      plan.stages.forEach((st, i) => st.items.forEach(it => (it.teeth || []).forEach(t => { if (!dictated.has(+t)) dictated.set(+t, i); })));
      const states = toothStates(plan);
      assert.deepEqual(Object.keys(states).map(Number).sort(), [...dictated.keys()].sort(), s.label);
      for (const [t, st] of Object.entries(states)) assert.equal(st.stage, dictated.get(+t), `${s.label} tooth ${t}`);
    }
  }
});

test('implant sites show as a gap today and as new teeth after treatment', () => {
  const plan = solved(SAMPLES[1].text); // implants at 45, 35, 37 then 15, 16
  const st = toothStates(plan);
  for (const t of [45, 35, 37]) assert.deepEqual([st[t].today, st[t].after, st[t].stage], ['gap', 'new', 0]);
  for (const t of [15, 16]) assert.deepEqual([st[t].today, st[t].after, st[t].stage], ['gap', 'new', 2]);
});

test('extractions without an implant stay a gap; other teeth show as treated', () => {
  const plan = { stages: [{ items: [{ group: 'extraction', teeth: ['11'] }, { group: 'unpriced', teeth: ['43'] }, { group: 'xray', teeth: ['99'] }] }] };
  const st = toothStates(plan);
  assert.deepEqual(st[11], { stage: 0, today: 'gap', after: 'gap' });
  assert.deepEqual(st[43], { stage: 0, today: 'treat', after: 'treat' });
  assert.equal(st[99], undefined, 'invalid FDI numbers are ignored');
});

test('timeline amounts are the engine subtotals, and shares add up to the total', () => {
  for (const s of SAMPLES) {
    const plan = solved(s.text);
    const sh = stageShares(plan);
    assert.deepEqual(sh.map(x => x.due), plan.stages.map(x => x.subtotal), s.label);
    const sum = sh.reduce((a, x) => a + x.due, 0);
    assert.ok(Math.abs(sum - plan.total) < 0.005, `${s.label}: ${sum} vs ${plan.total}`);
    if (plan.total > 0) assert.ok(Math.abs(sh.reduce((a, x) => a + x.share, 0) - 1) < 1e-9, s.label);
    else assert.ok(sh.every(x => x.share === 0), s.label);
  }
});

test('each stage gets its own colour and every treatment type an icon', () => {
  assert.notDeepEqual(stageColour(0), stageColour(1));
  assert.deepEqual(stageColour(STAGE_COLOURS.length), stageColour(0));
  assert.equal(iconFor('implant'), 'implant');
  assert.equal(iconFor('tempcrown'), 'crown');
  assert.equal(iconFor('extraction'), 'extraction');
  assert.equal(iconFor('hygiene'), 'cleaning');
  assert.equal(iconFor('xray'), 'xray');
  assert.equal(iconFor('sedation'), 'care');
});
