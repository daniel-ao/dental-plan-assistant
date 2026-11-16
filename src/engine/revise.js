// Revision Agent: applies natural-language corrections (voice or text) as field-level patches.
// Unrelated fields are never touched; every command returns a human-readable change summary.
import { CATALOG } from '../catalog.js';
import { matchFragment, byId, IMPLANT_SYSTEMS, CROWNS, familyOf, codeOf } from './extract.js';
import { computeTotals } from './plan.js';

const words = s => s.toLowerCase().match(/[a-z]{4,}/g) || [];
export function findItems(plan, text) {
  const tooth = (text.match(/\b(?:tooth|site)\s*([1-4][1-8])\b/i) || [])[1];
  const w = words(text).filter(x => !['change', 'price', 'remove', 'stage', 'tooth', 'should', 'instead', 'also'].includes(x));
  let best = [], score = 0;
  for (const s of plan.stages) for (const i of s.items) {
    const iw = words(i.name + ' ' + i.source);
    let sc = w.filter(y => iw.some(x => x.startsWith(y.slice(0, 5)))).length; // query words found in the item
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
    } else if (/\b(straumann|osstem|megagen|nobel|anyone|anyridge|soi|blt|zirconia|ceramic|\bML\b|\bST\b)\b/i.test(cmd) && /crown|implant|switch|change|should be/i.test(cmd)) {
      // Implant system / crown type changes: always to an exact price-list item, never a made-up price.
      const crownOnly = /crown/i.test(cmd) && !/implants? (system|brand)|switch implants?/i.test(cmd);
      const sys = IMPLANT_SYSTEMS.filter(x => (x.words.test(cmd) || new RegExp(x.family, 'i').test(cmd)));
      const sysPrices = [...new Set(sys.map(x => byId[x.id].price))];
      let implantId = null;
      if (!crownOnly && sys.length) {
        const exact = sys.filter(x => x.words.test(cmd));
        implantId = exact.length === 1 ? exact[0].id : sysPrices.length === 1 ? sys[0].id : null;
        if (!implantId) changes.push(`Not applied: specify the implant (${sys.map(x => `${byId[x.id].name} €${byId[x.id].price}`).join('; ')})`);
      }
      const all = plan.stages.flatMap(s => s.items);
      if (implantId) for (const i of all.filter(i => i.group === 'implant')) { setItem(i, implantId); changes.push(`Implant → ${i.name} (€${i.unitPrice})`); }
      const fam = familyOf(implantId) || familyOf(all.find(i => i.group === 'implant')?.catalogId) || (sys[0] && sys[0].family);
      const crownsList = CROWNS[fam] || [];
      let crownIds = crownsList;
      if (/\bST\b/.test(cmd)) crownIds = crownsList.filter(id => /^ST /.test(byId[id].name));
      else if (/\bML\b/.test(cmd)) crownIds = crownsList.filter(id => /^ML /.test(byId[id].name));
      const crownPrices = [...new Set(crownIds.map(id => byId[id].price))];
      const crowns = all.filter(i => i.group === 'crown');
      if (crowns.length && (crownOnly || implantId)) {
        if (/ceramic/i.test(cmd)) changes.push('Not applied: the price list has no ceramic crowns on implants, only zirconia (ML or ST)');
        else if (crownIds.length && crownPrices.length === 1) for (const i of crowns) { setItem(i, crownIds[0]); changes.push(`Crown → ${i.name} (€${i.unitPrice})`); }
        else if (crownIds.length) changes.push(`Not applied: specify the crown (${crownIds.map(id => `${byId[id].name} €${byId[id].price}`).join('; ')})`);
        else changes.push('Not applied: no matching crown in the price list');
      }
      if (!changes.length) changes.push(`No change: "${cmd}"`);
    } else if ((m = cmd.match(/^(?:please )?add (?:a |an |the )?(.+?)(?:\s+(?:procedure|item))?(?:\s+(?:to|in) stage (\d+)|\s+as a (?:separate|new) stage)?[.]?$/i))) {
      const hit = matchFragment(m[1])[0];
      const id = hit?.resolve ? hit.resolve(m[1]) : hit?.id;
      const variants = !id && hit?.candidates ? ` – price-list variant to confirm: ${hit.candidates.map(x => `${byId[x].name} €${byId[x].price}`).join('; ')}` : '';
      const target = m[2] ? (plan.stages[+m[2] - 1] || addStage(plan)) : /separate|new stage/i.test(cmd) ? addStage(plan, 1) : plan.stages[plan.stages.length - 1];
      const qty = +(m[1].match(/^(\d+)/) || [])[1] || 1;
      const c = id ? byId[id] : null;
      target.items.push({ key: 'rev-' + Date.now() + Math.random(), group: hit?.group || 'manual', source: cmd, name: c ? c.name : m[1], catalogId: id || null, qty, unitPrice: c ? c.price : null, priceSource: c ? 'list' : null, discountPct: 0, teeth: [], flags: [], status: c ? 'ok' : 'tbc', code: c ? codeOf(id) : null, section: c?.category || null, note: c ? '' : 'price-list item to confirm' });
      changes.push(`Added "${c ? c.name : m[1]}"${c ? ` (€${c.price})` : variants || ' (price TBC – not in price list)'} to Stage ${target.number}`);
    } else if ((m = cmd.match(/patient(?:'s)?(?: name)? is (.+)/i))) {
      plan.patientName = m[1].replace(/[.]$/, ''); changes.push(`Patient name → ${plan.patientName}`);
    } else if (/^change the treatment for/i.test(cmd)) { /* context sentence, no field change */ }
    else changes.push(`Not understood (no change): "${cmd}"`);
  }
  plan.stages.forEach((s, i) => (s.number = i + 1));
  computeTotals(plan);
  return { plan, changes };
}

function setItem(i, id) {
  const c = byId[id];
  Object.assign(i, { catalogId: id, name: c.name, unitPrice: c.price, priceSource: 'list', status: 'ok', code: codeOf(id), section: c.category });
}

function addStage(plan, afterFirst) {
  const s = { number: 0, title: 'Additional stage', interval: 'To be scheduled', items: [] };
  if (afterFirst) plan.stages.splice(1, 0, s); else plan.stages.push(s);
  plan.stages.forEach((x, i) => (x.number = i + 1));
  return s;
}
export { CATALOG };
