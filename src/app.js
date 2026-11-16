// UI orchestrator: wires the agents together and owns state, versions and the approval gate.
import { buildPlan } from './engine/plan.js';
import { applyCorrection } from './engine/revise.js';
import { guardText } from './engine/guard.js';
import { renderPdf } from './pdf.js';
import { SAMPLES } from './samples.js';

const $ = id => document.getElementById(id);
const eur = n => (n == null ? 'TBC' : '€' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const ICON = {
  lock: '<svg class="ic" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  check: '<svg class="ic" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
};

const S = { answers: {}, pending: {}, corrections: [], versions: [], images: [], current: null, status: 'Draft', approvedVersion: null, guard: [] };
const STATUS_STEP = { 'Draft': 1, 'Missing Information': 2, 'Awaiting Dentist Review': 3, 'Changes Requested': 3, 'Approved': 4, 'Sent to Patient': 4 };

function setStatus(s) {
  S.status = s; $('status').textContent = s;
  const step = STATUS_STEP[s];
  document.querySelectorAll('#steps li').forEach(li => { const n = +li.dataset.s; li.className = n === step ? 'on' : n < step ? 'done' : ''; });
}

// ---------- Voice (Transcription Agent) ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
function attachMic(btn, target, append = true) {
  let rec = null, base = '';
  btn.onclick = () => {
    if (!SR) { $('micHint').textContent = 'Voice capture is not supported in this browser (use Chrome / Edge / Safari). You can type or paste the dictation instead.'; return; }
    if (rec) { rec.stop(); return; }
    rec = new SR(); rec.lang = $('lang').value; rec.continuous = true; rec.interimResults = true;
    base = append && target.value ? target.value.trimEnd() + '\n' : '';
    rec.onresult = e => { let txt = ''; for (const r of e.results) txt += r[0].transcript; target.value = base + txt.replace(/\b(stage \w+)/gi, '\n$1'); };
    rec.onerror = e => { $('micHint').textContent = 'Microphone error: ' + e.error + '. You can type instead.'; };
    rec.onend = () => { btn.classList.remove('rec'); btn.innerHTML = btn === $('mic') ? '<span>●</span> Record' : '<span>●</span> Speak'; rec = null; };
    rec.start(); btn.classList.add('rec'); btn.innerHTML = '<span>■</span> Stop';
  };
}
attachMic($('mic'), $('transcript'));
attachMic($('mic2'), $('correction'), false);

// ---------- Samples & images ----------
SAMPLES.forEach((s, i) => $('sample').insertAdjacentHTML('beforeend', `<option value="${i}">${esc(s.label)}</option>`));
$('sample').onchange = e => { const s = SAMPLES[e.target.value]; if (s) { $('transcript').value = s.text; $('patient').value = s.label.startsWith('Demo') ? 'Jane Doe' : ''; } };
$('img').onchange = async e => {
  for (const f of e.target.files) {
    const dataUrl = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });
    S.images.push({ name: f.name.replace(/[^\w. -]/g, '_'), caption: f.name.replace(/\.[^.]+$/, '').replace(/[^\w. -]/g, ' '), dataUrl });
  }
  $('images').innerHTML = S.images.map(i => `<img src="${i.dataUrl}" alt="${esc(i.caption)}" title="${esc(i.caption)}">`).join('');
};

// ---------- Pipeline ----------
function meta() { return { patientName: $('patient').value, dentist: $('dentist').value, clinic: $('clinic').value, date: new Date().toISOString().slice(0, 10) }; }
function run(summary) {
  const g = guardText($('transcript').value);
  S.guard = g.findings;
  const res = buildPlan(g.text, S.answers, meta());
  let plan = res.plan;
  const changes = [];
  for (const c of S.corrections) changes.push(...applyCorrection(plan, c).changes);
  if (S.answers['patient.name']) plan.patientName = S.answers['patient.name'];
  S.current = { plan, questions: res.questions, open: res.open };
  const open = res.open.concat(S.guard.map(f => ({ priority: 'high', text: `Suspicious instruction ignored (${f.why}): "${f.snippet}"` })));
  const v = { n: S.versions.length + 1, plan: structuredClone(plan), open, summary, at: new Date().toISOString(), by: $('dentist').value || 'Dentist' };
  v.doc = renderPdf(plan, { version: v.n, status: open.length ? 'Missing information' : 'Awaiting dentist review', open, images: S.images });
  v.url = URL.createObjectURL(v.doc.output('blob'));
  S.versions.push(v); S.approvedVersion = null;
  setStatus(res.open.length ? 'Missing Information' : 'Awaiting Dentist Review');
  render(); showVersion(v.n);
}

$('build').onclick = () => {
  if (!$('transcript').value.trim()) { $('transcript').focus(); return; }
  S.answers = {}; S.pending = {}; S.corrections = []; S.versions = []; run('Initial plan generated from dictation');
};
$('applyAnswers').onclick = () => {
  const n = Object.keys(S.pending).length; if (!n) return;
  Object.assign(S.answers, S.pending); S.pending = {};
  run(`${n} clarifying answer(s) applied`);
};
$('applyCorrection').onclick = () => {
  const g = guardText($('correction').value.trim());
  if (!g.text.trim() && !g.findings.length) return;
  const blocked = g.findings.length ? `Correction partly blocked (${g.findings.map(f => f.why).join(', ')}). Approval and sending can only be done with the buttons.` : '';
  if (blocked && !g.text.trim()) { alertBox(blocked); return; }
  const preview = applyCorrection(structuredClone(S.current.plan), g.text);
  S.corrections.push(g.text); $('correction').value = '';
  setStatus('Changes Requested');
  run('Correction: ' + preview.changes.join('; '));
  if (blocked) $('diff').insertAdjacentHTML('afterbegin', `<p class="alert">${esc(blocked)}</p>`);
};
$('reset').onclick = () => { Object.assign(S, { answers: {}, pending: {}, corrections: [], versions: [], images: [], current: null, approvedVersion: null }); $('transcript').value = ''; $('images').innerHTML = ''; $('sample').value = ''; setStatus('Draft'); render(); $('pdf').style.display = 'none'; $('pdfEmpty').style.display = 'block'; };

// ---------- Approval gate (Delivery Agent) ----------
$('approve').onclick = () => {
  const v = S.versions.at(-1);
  if (v.open.length && !confirm(`Version ${v.n} still has ${v.open.length} open question(s). Approve anyway?`)) return;
  v.approvedAt = new Date().toISOString();
  v.doc = renderPdf(v.plan, { version: v.n, status: 'Approved', approvedAt: v.approvedAt, open: [], images: S.images });
  v.url = URL.createObjectURL(v.doc.output('blob'));
  S.approvedVersion = v.n; setStatus('Approved'); render(); showVersion(v.n);
};
const fname = v => `treatment-plan_${(v.plan.patientName || 'patient').replace(/\W+/g, '-')}_v${v.n}.pdf`;
$('download').onclick = () => { const v = S.versions.find(x => x.n === S.approvedVersion); if (v) v.doc.save(fname(v)); };
$('send').onclick = () => {
  const v = S.versions.find(x => x.n === S.approvedVersion); if (!v) return;
  v.doc.save(fname(v)); v.sentAt = new Date().toISOString(); setStatus('Sent to Patient'); render();
  location.href = `mailto:?subject=${encodeURIComponent('Your treatment plan')}&body=${encodeURIComponent(`Dear ${v.plan.patientName || 'patient'},\n\nPlease find attached your personalised treatment plan (version ${v.n}, total ${eur(v.plan.total)}).\n\nKind regards,\n${v.plan.dentist}`)}`;
};
function alertBox(msg) { $('diff').innerHTML = `<p class="alert">${esc(msg)}</p>`; }

// ---------- Rendering ----------
function render() {
  const c = S.current, last = S.versions.at(-1);
  $('applyAnswers').disabled = !c; $('applyCorrection').disabled = !c;
  $('approve').disabled = !last || S.approvedVersion === last.n;
  $('approve').textContent = last ? `Approve v${last.n}` : 'Approve';
  const approved = !!S.approvedVersion && S.approvedVersion === last?.n;
  $('download').disabled = !approved; $('send').disabled = !approved;
  $('gate').className = 'gate' + (approved ? ' ok' : '');
  $('gate').innerHTML = approved ? `${ICON.check}<span>v${S.approvedVersion} is approved (${esc(last.by)}). Download and sending are unlocked.</span>` : `${ICON.lock}<span>Download and sending unlock only after explicit dentist approval of the latest version.</span>`;
  if (!c) { $('summary').innerHTML = 'No plan yet. Dictate the treatment or load a sample, then press Build plan.'; $('questions').innerHTML = ''; $('plan').innerHTML = ''; $('versions').innerHTML = ''; $('diff').innerHTML = ''; return; }
  const p = c.plan;
  $('summary').className = 'summary';
  $('summary').innerHTML = `<div class="pill main"><small>Total estimate${p.tbcCount ? ', excluding TBC' : ''}</small><b>${eur(p.total)}</b></div><div class="pill"><small>Stages</small><b>${p.stages.length}</b></div><div class="pill${p.tbcCount ? ' attn' : ''}"><small>Items TBC</small><b>${p.tbcCount}</b></div><div class="pill${c.open.length + S.guard.length ? ' attn' : ''}"><small>Open questions</small><b>${c.open.length + S.guard.length}</b></div>`;
  const guardHtml = S.guard.map(f => `<div class="q"><div class="meta">high · security</div><p>Suspicious instruction ignored (${esc(f.why)}): “${esc(f.snippet)}”. It was treated as data and not acted on.</p></div>`).join('');
  $('questions').innerHTML = guardHtml + c.questions.map(q => {
    const val = S.pending[q.id] ?? q.answer;
    return `<div class="q ${q.priority} ${q.answer != null ? 'answered' : ''}" data-q="${esc(q.id)}"><div class="meta">${q.priority} · ${esc(q.category)}${q.answer != null ? ' · answered' : ''}</div><p>${esc(q.text)}</p>
      <div class="opts">${q.options.map(o => `<button data-v="${esc(o.value)}" class="${val === o.value ? 'sel' : ''}">${esc(o.label)}</button>`).join('')}${q.free || !q.options.length ? `<input placeholder="Type answer…" value="${val != null && !q.options.some(o => o.value === val) ? esc(val) : ''}">` : ''}</div></div>`;
  }).join('') || '<p class="muted">No open questions. The plan is complete and ready for review.</p>';
  document.querySelectorAll('.q[data-q]').forEach(el => {
    const id = el.dataset.q;
    el.querySelectorAll('button').forEach(b => b.onclick = () => { S.pending[id] = b.dataset.v; el.querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b)); });
    const inp = el.querySelector('input'); if (inp) inp.oninput = () => { if (inp.value.trim()) S.pending[id] = inp.value.trim(); else delete S.pending[id]; };
  });
  $('plan').innerHTML = p.stages.map(s => `<div class="stagehead">Stage ${s.number} · ${esc(s.title)} <span class="muted">· ${esc(s.interval || 'timing TBC')}</span></div>
    <table><tr><th>Procedure</th><th>Teeth</th><th>Qty</th><th>Unit</th><th>Disc.</th><th>Amount</th></tr>${s.items.map(i => `<tr class="${i.status === 'tbc' ? 'tbc' : ''}" title="Source: ${esc(i.source)}"><td>${esc(i.name)}${i.priceSource === 'dentist' ? ' <small class="muted">(dentist price)</small>' : ''}</td><td>${esc((i.teeth || []).join(', '))}</td><td>${i.qty}</td><td class="r">${eur(i.unitPrice)}</td><td>${i.discountPct ? i.discountPct + '%' : ''}</td><td class="r">${eur(i.lineTotal)}</td></tr>`).join('')}
    <tr><td colspan="5"><b>Subtotal</b></td><td class="r"><b>${eur(s.subtotal)}</b></td></tr></table>`).join('');
  $('versions').innerHTML = S.versions.slice().reverse().map(v => `<li data-v="${v.n}" class="${v.n === last.n ? 'cur' : ''}"><span><b>v${v.n}</b> · ${esc(v.summary)}<br><small>${new Date(v.at).toLocaleTimeString()} · ${esc(v.by)} · ${eur(v.plan.total)} · ${v.open.length} open${v.approvedAt ? ' · <span class="ok">approved</span>' : ''}${v.sentAt ? ' · sent' : ''}</small></span></li>`).join('');
  document.querySelectorAll('#versions li').forEach(li => li.onclick = () => showVersion(+li.dataset.v));
}

function showVersion(n) {
  const v = S.versions.find(x => x.n === n); if (!v) return;
  $('pdf').src = v.url; $('pdf').style.display = 'block'; $('pdfEmpty').style.display = 'none';
  const prev = S.versions.find(x => x.n === n - 1);
  $('diff').innerHTML = prev ? `<b>Changes v${prev.n} → v${v.n}</b><ul>${diffPlans(prev, v).map(d => `<li>${esc(d)}</li>`).join('') || '<li>No field changes</li>'}</ul>` : '';
}
function diffPlans(a, b) {
  const out = [], key = p => { const m = new Map(); p.stages.forEach(s => s.items.forEach(i => m.set(`S${s.number} ${i.name}`, i))); return m; };
  const A = key(a.plan), B = key(b.plan);
  for (const [k, i] of B) { const o = A.get(k); if (!o) out.push(`+ ${k} (${i.qty} × ${eur(i.unitPrice)})`); else if (o.qty !== i.qty || o.unitPrice !== i.unitPrice || o.discountPct !== i.discountPct) out.push(`~ ${k}: ${o.qty}×${eur(o.unitPrice)} −${o.discountPct}% → ${i.qty}×${eur(i.unitPrice)} −${i.discountPct}%`); }
  for (const k of A.keys()) if (!B.has(k)) out.push(`− ${k}`);
  a.plan.stages.forEach((s, i) => { const t = b.plan.stages[i]; if (t && s.interval !== t.interval) out.push(`Stage ${i + 1} timing: ${s.interval || 'TBC'} → ${t.interval}`); });
  if (a.plan.total !== b.plan.total) out.push(`Total: ${eur(a.plan.total)} → ${eur(b.plan.total)}`);
  out.push(`Open questions: ${a.open.length} → ${b.open.length}`);
  return out;
}
render();
