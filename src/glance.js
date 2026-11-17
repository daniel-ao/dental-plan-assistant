// Page-one "plan at a glance" data for the patient PDF (pure functions, unit-tested).
// Everything here is derived from the plan the engine built: tooth numbers come only from what the
// dentist dictated, and every amount is a stage subtotal or total already computed by the engine.
// Nothing is estimated, rounded differently or added.

// One colour per stage, used on the teeth, the timeline, the cost bar and the stage tables.
// Chosen for contrast on white (all ≥ 4.5:1 for white text on the colour).
export const STAGE_COLOURS = [
  [0, 102, 224],   // blue
  [0, 128, 116],   // teal
  [111, 66, 230],  // violet
  [184, 84, 0],    // amber
  [196, 38, 112],  // rose
  [0, 105, 145],   // ocean
];
export const stageColour = i => STAGE_COLOURS[i % STAGE_COLOURS.length];

// FDI layout, as the patient looks at a chart of their own mouth (their right on the left).
export const UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
export const LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

// Small, simple icon per type of treatment.
const ICONS = {
  implant: 'implant', abutment: 'implant',
  crown: 'crown', tempcrown: 'crown', sealing: 'crown',
  extraction: 'extraction',
  hygiene: 'cleaning', srp: 'cleaning',
  xray: 'xray', scan: 'xray',
};
export const iconFor = group => ICONS[group] || 'care';

// Tooth states for the "Today" and "After treatment" charts.
//   today: 'gap'   = implant site or tooth to be removed (no tooth there, or not for long)
//          'treat' = a natural tooth that is treated in the plan
//   after: 'new'   = implant placed (and later restored)
//          'gap'   = tooth removed with no implant planned on that site
//          'treat' = treated natural tooth
// Each treated tooth carries the index of the first stage that mentions it.
export function toothStates(plan) {
  const seen = new Map(); // tooth -> { stage, kinds:Set }
  plan.stages.forEach((s, si) => {
    for (const it of s.items) {
      for (const t of it.teeth || []) {
        const n = Number(t);
        if (!(n >= 11 && n <= 48 && n % 10 >= 1 && n % 10 <= 8)) continue;
        if (!seen.has(n)) seen.set(n, { stage: si, kinds: new Set() });
        seen.get(n).kinds.add(it.group);
      }
    }
  });
  const out = {};
  for (const [n, { stage, kinds }] of seen) {
    const implant = kinds.has('implant') || kinds.has('abutment');
    const removed = kinds.has('extraction');
    out[n] = {
      stage,
      today: implant || removed ? 'gap' : 'treat',
      after: implant ? 'new' : removed ? 'gap' : 'treat',
    };
  }
  return out;
}

// What is due at each stage and its share of the total, straight from the engine's subtotals.
export function stageShares(plan) {
  const total = plan.stages.reduce((a, s) => a + (s.subtotal || 0), 0);
  return plan.stages.map((s, i) => ({
    index: i,
    number: s.number,
    title: s.title,
    interval: s.interval || null,
    due: s.subtotal || 0,
    toConfirm: s.items.filter(it => it.status === 'tbc').length,
    share: total > 0 ? (s.subtotal || 0) / total : 0,
  }));
}
