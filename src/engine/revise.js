// Revision Agent: applies natural-language corrections (voice or text) as field-level patches.
// Unrelated fields are never touched; every command returns a human-readable change summary.
import { CATALOG } from '../catalog.js';
import { matchFragment, byId, BRANDS } from './extract.js';
import { computeTotals } from './plan.js';

const words = s => s.toLowerCase().match(/[a-z]{4,}/g) || [];
export function findItems(plan, text) {
  const tooth = (text.match(/\b(?:tooth|site)\s*([1-4][1-8])\b/i) || [])[1];
  const w = words(text).filter(x => !['change', 'price', 'remove', 'stage', 'tooth', 'should', 'instead', 'also'].includes(x));
  let best = [], score = 0;
  for (const s of plan.stages) for (const i of s.items) {
    let sc = words(i.name + ' ' + i.source).filter(x => w.some(y => x.startsWith(y.slice(0, 5)))).length;
    if (tooth && i.teeth?.includes(tooth)) sc += 2;
    if (sc && /implant/i.test(text) && !/crown/i.test(text) && i.group === 'implant') sc += 2;
    if (sc && /crown/i.test(text) && i.group === 'crown') sc += 2;
    if (sc > score) { score = sc; best = [{ s, i }]; } else if (sc === score && sc > 0) best.push({ s, i });
  }
  return best;
}

export function applyCorrection(plan, raw) {
  const changes = [];
  const cmds = raw.split(/(?<=[.!])\s+|\s+and also\s+|;\s*/i).map(c => c.trim().replace(/^(?:also|and|then|please),?\s+/i, '')).filter(Boolean);
  for (const cmd of cmds) {
    let m;
    if ((m = cmd.match(/(?:change|set) (?:the )?price of (?:the )?(.+?) to €?\s*([\d.,]+)\s*(?:€|eur)?/i))) {
      for (const { i } of findItems(plan, m[1])) { const old = i.unitPrice; i.unitPrice = +m[2].replace(',', ''); i.priceSource = 'dentist'; i.status = 'ok'; changes.push(`Price of "${i.name}": ${old ?? 'TBC'} → €${i.unitPrice}`); }
    } else if ((m = cmd.match(/(?:apply|set|give) (?:a )?(\d+)\s*% discount (?:on|to|for) (?:the )?(.+)/i))) {
      for (const { i } of findItems(plan, m[2])) { i.discountPct = +m[1]; changes.push(`Discount on "${i.name}" set to ${m[1]}%`); }
    } else if ((m = cmd.match(/^(?:please )?(?:remove|delete|drop) (?:the )?(.+)/i))) {
      for (const { s, i } of findItems(plan, m[1])) { s.items = s.items.filter(x => x !== i); changes.push(`Removed "${i.name}" from Stage ${s.number}`); }
    } else if ((m = cmd.match(/move (?:the )?(.+?) to stage (\d+)/i))) {
      const target = plan.stages[+m[2] - 1] || addStage(plan);
      for (const { s, i } of findItems(plan, m[1])) { s.items = s.items.filter(x => x !== i); target.items.push(i); changes.push(`Moved "${i.name}" to Stage ${target.number}`); }
    } else if ((m = cmd.match(/(?:set|change) (?:the )?interval (?:of|for|before) stage (\d+) to (.+)/i))) {
      const s = plan.stages[+m[1] - 1]; if (s) { s.interval = `After ${m[2].replace(/[.]$/, '')}`; changes.push(`Stage ${s.number} interval → ${s.interval}`); }
    } else if ((m = cmd.match(/(?:crowns?|implants?).*?(?:should be|to|with|instead)\s+(?:a |an )?(straumann|osstem|megagen|nobel|zirconia)/i)) || (m = cmd.match(/(?:switch|change) (?:to )?(straumann|osstem|megagen|nobel)/i))) {
      const key = m[1].toLowerCase();
      for (const s of plan.stages) for (const i of s.items) {
        if (key === 'zirconia') { if (i.group === 'crown' && !/zirconia/i.test(i.name)) { i.name = 'Zirconia ' + i.name; changes.push(`Crown material set to zirconia`); } continue; }
        const b = BRANDS[key]; const slot = i.group === 'implant' ? 'implant' : i.group === 'crown' ? 'crown' : null;
        if (slot && (!/crown/i.test(cmd) || slot === 'crown') ) { i.catalogId = b[slot]; i.name = byId[b[slot]].name; i.unitPrice = byId[b[slot]].price; i.priceSource = 'list'; i.status = 'ok'; changes.push(`${slot} → ${i.name} (€${i.unitPrice})`); }
      }
      if (key === 'zirconia' && !changes.length) changes.push('Crowns are already zirconia – no change');
    } else if ((m = cmd.match(/^(?:please )?add (?:a |an |the )?(.+?)(?:\s+(?:procedure|item))?(?:\s+(?:to|in) stage (\d+)|\s+as a (?:separate|new) stage)?[.]?$/i))) {
      const hit = matchFragment(m[1])[0];
      const id = hit?.resolve ? hit.resolve(m[1]) : hit?.id;
      const target = m[2] ? (plan.stages[+m[2] - 1] || addStage(plan)) : /separate|new stage/i.test(cmd) ? addStage(plan, 1) : plan.stages[plan.stages.length - 1];
      const qty = +(m[1].match(/^(\d+)/) || [])[1] || 1;
      const c = id ? byId[id] : null;
      target.items.push({ key: 'rev-' + Date.now() + Math.random(), group: hit?.group || 'manual', source: cmd, name: c ? c.name : m[1], catalogId: id || null, qty, unitPrice: c ? c.price : null, priceSource: c ? 'list' : null, discountPct: 0, teeth: [], flags: [], status: c ? 'ok' : 'tbc' });
      changes.push(`Added "${c ? c.name : m[1]}"${c ? ` (€${c.price})` : ' (price TBC – not in price list)'} to Stage ${target.number}`);
    } else if ((m = cmd.match(/patient(?:'s)?(?: name)? is (.+)/i))) {
      plan.patientName = m[1].replace(/[.]$/, ''); changes.push(`Patient name → ${plan.patientName}`);
    } else if (/^change the treatment for/i.test(cmd)) { /* context sentence, no field change */ }
    else changes.push(`Not understood (no change): "${cmd}"`);
  }
  plan.stages.forEach((s, i) => (s.number = i + 1));
  computeTotals(plan);
  return { plan, changes };
}

function addStage(plan, afterFirst) {
  const s = { number: 0, title: 'Additional stage', interval: 'To be scheduled', items: [] };
  if (afterFirst) plan.stages.splice(1, 0, s); else plan.stages.push(s);
  plan.stages.forEach((x, i) => (x.number = i + 1));
  return s;
}
export { CATALOG };
