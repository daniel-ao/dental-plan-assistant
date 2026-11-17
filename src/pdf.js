// Document Generation Agent: structured plan -> branded, patient-friendly PDF (jsPDF + autotable).
// Visual language follows the app's bright clinical palette (src/styles.css): white sheet, deep navy
// ink, clinical blue accent, mint for approved, amber for anything still to confirm.
// Every amount printed here comes straight from the plan; the PDF never computes or rounds prices
// differently from the engine, and every price-list line shows its section and code.

import { stageColour, toothStates, stageShares, iconFor, UPPER, LOWER } from './glance.js?v=7';

const C = {
  ink: [11, 37, 64], muted: [79, 100, 120], line: [213, 230, 242], sunk: [234, 245, 253], paper: [244, 250, 255],
  save: [0, 122, 78], idle: [226, 232, 238],
  accent: [10, 132, 255], btn: [0, 102, 224], mint: [214, 247, 236], mintInk: [8, 119, 90], warn: [154, 91, 0], warnBg: [255, 244, 220],
};
const M = 44; // page margin (pt)
const eur = n => (n == null ? 'To confirm' : '€' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const fmtDate = d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

// The app's tooth mark (same path as the header logo in index.html), drawn as vector curves.
const TOOTH = 'M7 3C4.5 3 3 5 3 7.5c0 2 .8 3.4 1.4 5 .6 1.7.8 3.6 1.3 5.5.4 1.5.9 3 2 3 1.3 0 1.4-2 1.8-3.8.3-1.4.8-2.7 2.5-2.7s2.2 1.3 2.5 2.7c.4 1.8.5 3.8 1.8 3.8 1.1 0 1.6-1.5 2-3 .5-1.9.7-3.8 1.3-5.5.6-1.6 1.4-3 1.4-5C21 5 19.5 3 17 3c-2 0-3 1-5 1S9 3 7 3z';
// Draws the tooth mark scaled to `size`, top-left at (x, y). `flip` turns it roots-up (upper jaw).
// style: 'F' fill, 'S' stroke, 'FD' both (colours set by the caller).
function drawToothShape(doc, x, y, size, flip = false, style = 'F', w = size) {
  const kx = w / 24, ky = size / 24, tok = TOOTH.match(/[a-zA-Z]|-?\d*\.?\d+/g);
  let i = 0, cx = 0, cy = 0, cmd = '', prev2 = null;
  const segs = []; let start = null;
  const num = () => +tok[i++];
  while (i < tok.length) {
    if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++];
    if (cmd === 'M') { cx = num(); cy = num(); start = [cx, cy]; cmd = 'L'; continue; }
    if (cmd === 'z' || cmd === 'Z') break;
    let pts;
    if (cmd === 'C' || cmd === 'c') { const r = cmd === 'c'; const p = [num(), num(), num(), num(), num(), num()]; pts = r ? p.map((v, j) => v + (j % 2 ? cy : cx)) : p; }
    else { const r = cmd === 's'; const p = [num(), num(), num(), num()]; const q = r ? p.map((v, j) => v + (j % 2 ? cy : cx)) : p; const c1 = prev2 ? [2 * cx - prev2[0], 2 * cy - prev2[1]] : [cx, cy]; pts = [...c1, ...q]; }
    segs.push([pts[0] - cx, pts[1] - cy, pts[2] - cx, pts[3] - cy, pts[4] - cx, pts[5] - cy]);
    prev2 = [pts[2], pts[3]]; cx = pts[4]; cy = pts[5];
  }
  // the path spans y 3..21 of its 24-unit box; flipping mirrors it inside the same box
  const sy = flip ? -ky : ky, oy = flip ? y + 24 * ky - start[1] * ky : y + start[1] * ky;
  doc.lines(segs, x + start[0] * kx, oy, [kx, sy], style, true);
}
const drawTooth = (doc, x, y, size) => drawToothShape(doc, x, y, size, false, 'F');

const tint = (c, a) => c.map(v => Math.round(255 - (255 - v) * a));

// One dental chart (upper and lower arch) for "today" or "after treatment".
function drawChart(doc, x, y, w, mode, teeth, title) {
  doc.setDrawColor(213, 230, 242); doc.setLineWidth(0.8); doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, w, 104, 6, 6, 'FD');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(79, 100, 120);
  doc.text(title.toUpperCase(), x + 10, y + 13);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6);
  doc.text('Right', x + 10, y + 57); doc.text('Left', x + w - 10, y + 57, { align: 'right' });
  const pad = 10, gap = 4, cell = (w - 2 * pad - gap) / 16, mid = x + w / 2;
  const sizeOf = n => ({ 1: 0.8, 2: 0.74, 3: 0.82, 4: 0.86, 5: 0.86, 6: 1, 7: 1, 8: 0.95 })[n % 10];
  const row = (list, top, flip) => list.forEach((n, k) => {
    const cxm = x + pad + k * cell + (k >= 8 ? gap : 0) + cell / 2;
    const d = (cxm - mid) / (w / 2);                 // -1 … 1 from the middle
    const lift = 7 * d * d;                          // gentle smile curve
    const h = 21 * sizeOf(n), tw = Math.min(cell - 1, h * 0.9);
    const ty = flip ? top - lift : top + 21 - h + lift;
    const t = teeth[n], st = t ? t[mode] : null;
    const col = t ? stageColour(t.stage) : null;
    if (st === 'gap') {
      doc.setDrawColor(...(mode === 'today' ? col : [140, 156, 172])); doc.setLineWidth(0.7); doc.setLineDashPattern([1.2, 1.2], 0);
      drawToothShape(doc, cxm - tw / 2, ty, h, flip, 'S', tw); doc.setLineDashPattern([], 0);
    } else if (st === 'treat' && mode === 'today') {
      doc.setFillColor(...tint(col, 0.25)); doc.setDrawColor(...col); doc.setLineWidth(0.9);
      drawToothShape(doc, cxm - tw / 2, ty, h, flip, 'FD', tw);
    } else if (st) {
      doc.setFillColor(...col); drawToothShape(doc, cxm - tw / 2, ty, h, flip, 'F', tw);
    } else {
      doc.setFillColor(226, 232, 238); drawToothShape(doc, cxm - tw / 2, ty, h, flip, 'F', tw);
    }
    if (t) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5); doc.setTextColor(...col);
      doc.text(String(n), cxm, flip ? ty - 2.5 : ty + h + 6, { align: 'center' });
    }
  });
  row(UPPER, y + 30, true);
  row(LOWER, y + 60, false);
}

// Small treatment icons, drawn as vector shapes in the stage colour. (x, y) is the top-left of an s×s box.
function drawIcon(doc, kind, x, y, s, col) {
  doc.setFillColor(...col); doc.setDrawColor(...col); doc.setLineWidth(s * 0.09);
  const cx = x + s / 2;
  if (kind === 'implant') {
    doc.roundedRect(cx - s * 0.36, y, s * 0.72, s * 0.24, s * 0.08, s * 0.08, 'F');          // crown cap
    doc.lines([[s * 0.44, 0], [-s * 0.08, s * 0.5], [-s * 0.14, s * 0.18], [-s * 0.14, -s * 0.18]], cx - s * 0.22, y + s * 0.3, [1, 1], 'F', true); // screw body
    doc.setDrawColor(255, 255, 255); doc.setLineWidth(s * 0.07);
    for (const k of [0.44, 0.6, 0.76]) doc.line(cx - s * 0.24, y + s * k, cx + s * 0.24, y + s * k);       // threads
  } else if (kind === 'crown') {
    drawToothShape(doc, x, y - s * 0.06, s, false, 'F');
  } else if (kind === 'extraction') {
    doc.setLineWidth(s * 0.08); drawToothShape(doc, x - s * 0.08, y + s * 0.16, s * 0.84, false, 'S');
    doc.setLineWidth(s * 0.1); doc.line(x + s * 0.86, y + s * 0.6, x + s * 0.86, y + s * 0.04);
    doc.lines([[s * 0.13, s * 0.17], [-s * 0.26, 0]], x + s * 0.86, y - s * 0.04, [1, 1], 'F', true);
  } else if (kind === 'cleaning') {
    const star = (sx, sy, r) => doc.lines([[r * 0.28, r * 0.72], [r * 0.72, r * 0.28], [-r * 0.72, r * 0.28], [-r * 0.28, r * 0.72], [-r * 0.28, -r * 0.72], [-r * 0.72, -r * 0.28], [r * 0.72, -r * 0.28]], sx, sy - r, [1, 1], 'F', true);
    star(x + s * 0.42, y + s * 0.56, s * 0.44); star(x + s * 0.86, y + s * 0.18, s * 0.2);
  } else if (kind === 'xray') {
    doc.setLineWidth(s * 0.08); doc.roundedRect(x + s * 0.04, y + s * 0.04, s * 0.92, s * 0.92, s * 0.14, s * 0.14, 'S');
    drawToothShape(doc, x + s * 0.24, y + s * 0.2, s * 0.56, false, 'F');
  } else {
    const a = s * 0.12;
    doc.rect(cx - a, y + s * 0.14, 2 * a, s * 0.72, 'F');
    doc.rect(x + s * 0.14, y + s / 2 - a, s * 0.72, 2 * a, 'F');
  }
}

export function renderPdf(plan, { version, status, approvedAt, open = [], images = [] }) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), CW = W - 2 * M;
  const approved = !!approvedAt;
  const set = (font = 'helvetica', style = 'normal', size = 10, color = C.ink) => { doc.setFont(font, style); doc.setFontSize(size); doc.setTextColor(...color); };
  const ensure = (y, need) => (y + need > H - 70 ? (doc.addPage(), 60) : y);

  // ---------- Header ----------
  doc.setFillColor(...C.btn); drawTooth(doc, M, 40, 26);
  set('times', 'bold', 20); doc.text(plan.clinic || 'Dental clinic', M + 34, 58);
  set('helvetica', 'normal', 9, C.muted); doc.text('Personalised treatment plan & cost estimate', M + 34, 72);
  // status pill
  const pill = approved ? 'APPROVED' : open.length ? 'DRAFT · INFORMATION MISSING' : 'DRAFT · AWAITING DENTIST REVIEW';
  set('helvetica', 'bold', 7.5, approved ? C.mintInk : C.warn);
  const pw = doc.getTextWidth(pill) + 16;
  doc.setFillColor(...(approved ? C.mint : C.warnBg)); doc.roundedRect(W - M - pw, 40, pw, 16, 8, 8, 'F');
  doc.text(pill, W - M - pw / 2, 50.5, { align: 'center' });
  set('helvetica', 'normal', 8.5, C.muted);
  doc.text(`Version ${version}  ·  ${fmtDate(Date.now())}`, W - M, 70, { align: 'right' });
  doc.setDrawColor(...C.accent); doc.setLineWidth(1.5); doc.line(M, 86, W - M, 86);

  // ---------- Patient card ----------
  let y = 102;
  doc.setFillColor(...C.sunk); doc.roundedRect(M, y, CW, 50, 6, 6, 'F');
  const fields = [['PATIENT', plan.patientName || 'To confirm'], ['DENTIST', plan.dentist || '—'], ['CONSULTATION', fmtDate(plan.date)], ['IMPLANT SYSTEM', plan.brand || '—']];
  fields.forEach(([k, v], i) => {
    const x = M + 14 + i * (CW - 28) / 4;
    set('helvetica', 'bold', 6.5, C.muted); doc.text(k, x, y + 20);
    set('helvetica', 'bold', 10, C.ink); doc.text(doc.splitTextToSize(String(v), (CW - 28) / 4 - 8)[0], x, y + 35);
  });
  y += 66;

  // =================== Page one: the plan at a glance ===================
  const shares = stageShares(plan);
  const teeth = toothStates(plan);

  // ---------- Total, stages, pricing ----------
  const tiles = [
    ['ESTIMATED TOTAL', eur(plan.total), C.btn, 16],
    ['STAGES', String(plan.stages.length), C.ink, 16],
    [plan.tbcCount ? 'ITEMS TO CONFIRM' : 'PRICING', plan.tbcCount ? `${plan.tbcCount} not included` : 'Complete', plan.tbcCount ? C.warn : C.mintInk, 12],
  ];
  const tw = (CW - 16) / 3;
  tiles.forEach(([k, v, col, size], i) => {
    const x = M + i * (tw + 8);
    doc.setDrawColor(...C.line); doc.setLineWidth(0.8); doc.setFillColor(255, 255, 255); doc.roundedRect(x, y, tw, 46, 6, 6, 'FD');
    set('helvetica', 'bold', 6.5, C.muted); doc.text(k, x + 12, y + 16);
    set('helvetica', 'bold', size, col); doc.text(v, x + 12, y + 36);
  });
  y += 54;

  // ---------- "You save" ribbon (only when the plan has a discount or a free item) ----------
  if (plan.discountTotal > 0) {
    const label = `You save ${eur(plan.discountTotal)}`;
    const sub = 'with the discounts in this plan';
    set('helvetica', 'bold', 10.5, [255, 255, 255]);
    const lw = doc.getTextWidth(label);
    set('helvetica', 'normal', 8.5);
    const rw = lw + doc.getTextWidth(sub) + 44;
    doc.setFillColor(...C.save);
    doc.lines([[rw, 0], [-9, 11], [9, 11], [-rw, 0]], M, y, [1, 1], 'F', true);
    doc.setFillColor(255, 255, 255); doc.circle(M + 12, y + 11, 4.2, 'F');
    doc.setFillColor(...C.save); doc.circle(M + 12, y + 11, 1.6, 'F');
    set('helvetica', 'bold', 10.5, [255, 255, 255]); doc.text(label, M + 22, y + 14.6);
    set('helvetica', 'normal', 8.5, [255, 255, 255]); doc.text(sub, M + 28 + lw, y + 14.6);
    y += 50;
  } else y += 26;

  // ---------- Today and after treatment ----------
  if (Object.keys(teeth).length) {
    set('times', 'bold', 13); doc.text('Your teeth: today and after treatment', M, y); y += 10;
    const half = (CW - 16) / 2;
    drawChart(doc, M, y, half, 'today', teeth, 'Today');
    drawChart(doc, M + half + 16, y, half, 'after', teeth, 'After treatment');
    y += 120;
    // legend
    let lx = M;
    set('helvetica', 'normal', 7.5, C.muted);
    shares.forEach(s => {
      if (!Object.values(teeth).some(t => t.stage === s.index)) return;
      doc.setFillColor(...stageColour(s.index)); drawToothShape(doc, lx, y - 7, 8, false, 'F');
      set('helvetica', 'normal', 7.5, C.ink); doc.text(`Stage ${s.number}`, lx + 11, y); lx += doc.getTextWidth(`Stage ${s.number}`) + 22;
    });
    doc.setDrawColor(...C.muted); doc.setLineWidth(0.6); doc.setLineDashPattern([1.2, 1.2], 0);
    drawToothShape(doc, lx, y - 7, 8, false, 'S'); doc.setLineDashPattern([], 0);
    set('helvetica', 'normal', 7.5, C.ink); doc.text('No tooth, or tooth to be removed', lx + 11, y); lx += doc.getTextWidth('No tooth, or tooth to be removed') + 22;
    doc.setFillColor(...C.idle); drawToothShape(doc, lx, y - 7, 8, false, 'F');
    doc.text('Not treated', lx + 11, y);
    y += 26;
  }

  // ---------- Timeline with what is due at each stage ----------
  set('times', 'bold', 13, C.ink); doc.text('Your treatment step by step', M, y); y += 16;
  {
    const perRow = Math.min(shares.length, 5);
    const colW = CW / perRow;
    let rowTop = y, rowH = 0;
    shares.forEach((s, i) => {
      const col = i % perRow;
      if (col === 0 && i) { rowTop += rowH + 12; rowH = 0; }
      const cx = M + col * colW, cy = rowTop + 10;
      const colour = stageColour(s.index);
      // connector to the next stage on the same row
      if (col < perRow - 1 && i < shares.length - 1) { doc.setDrawColor(...C.line); doc.setLineWidth(2); doc.line(cx + 22, cy, cx + colW - 4, cy); }
      doc.setFillColor(...colour); doc.circle(cx + 10, cy, 10, 'F');
      set('helvetica', 'bold', 9.5, [255, 255, 255]); doc.text(String(s.number), cx + 10, cy + 3.4, { align: 'center' });
      let ty = cy + 24;
      set('helvetica', 'bold', 7, colour); doc.text(`STAGE ${s.number}`, cx, ty); ty += 11;
      set('helvetica', 'bold', 8.5, C.ink);
      const tl = doc.splitTextToSize(s.title, colW - 10).slice(0, 2); doc.text(tl, cx, ty); ty += tl.length * 10;
      set('helvetica', 'normal', 7.5, C.muted); doc.text(s.interval || 'Timing to confirm', cx, ty); ty += 14;
      set('helvetica', 'bold', 11, colour); doc.text(eur(s.due), cx, ty); ty += 10;
      if (s.toConfirm) { set('helvetica', 'normal', 7, C.warn); doc.text(`+ ${s.toConfirm} to confirm`, cx, ty); ty += 9; }
      rowH = Math.max(rowH, ty - rowTop);
    });
    y = rowTop + rowH + 18;
  }

  // ---------- Cost bar by stage ----------
  if (plan.total > 0) {
    set('times', 'bold', 13, C.ink); doc.text('Where the cost goes', M, y); y += 12;
    const bh = 16;
    doc.setFillColor(...C.sunk); doc.roundedRect(M, y, CW, bh, 8, 8, 'F');
    // clip to the rounded bar so the end segments keep their round corners
    doc.saveGraphicsState();
    doc.roundedRect(M, y, CW, bh, 8, 8, null); doc.clip(); doc.discardPath();
    let bx = M;
    shares.forEach(s => {
      const w = s.share * CW; if (w <= 0) return;
      doc.setFillColor(...stageColour(s.index)); doc.rect(bx, y, w, bh, 'F');
      if (w > 34) { set('helvetica', 'bold', 7.5, [255, 255, 255]); doc.text(`${Math.round(s.share * 100)}%`, bx + w / 2, y + 10.8, { align: 'center' }); }
      bx += w;
    });
    doc.restoreGraphicsState();
    y += bh + 12;
    let lx = M;
    shares.forEach(s => {
      if (!(s.share > 0)) return;
      const t = `Stage ${s.number}: ${eur(s.due)}`;
      set('helvetica', 'normal', 7.5, C.ink);
      if (lx + doc.getTextWidth(t) + 14 > W - M) { lx = M; y += 12; }
      doc.setFillColor(...stageColour(s.index)); doc.circle(lx + 3, y - 2.5, 3, 'F');
      doc.text(t, lx + 9, y); lx += doc.getTextWidth(t) + 22;
    });
    y += 14;
  }
  set('helvetica', 'normal', 7.5, C.muted);
  doc.text('The full list of procedures and prices for each stage follows on the next pages.', M, Math.min(y + 4, H - 56));

  // =================== Next pages: stage by stage ===================
  doc.addPage(); y = 60;

  // ---------- Stages ----------
  set('times', 'bold', 13); doc.text('Stage by stage', M, y); y += 8;
  for (const [si, s] of plan.stages.entries()) {
    const colour = stageColour(si);
    y = ensure(y, 90);
    y += 14;
    doc.setFillColor(...colour); doc.circle(M + 9, y, 9, 'F');
    set('helvetica', 'bold', 9, [255, 255, 255]); doc.text(String(s.number), M + 9, y + 3.2, { align: 'center' });
    set('helvetica', 'bold', 11.5, C.ink); doc.text(s.title, M + 26, y + 4);
    set('helvetica', 'normal', 9, C.muted); doc.text(s.interval || 'Timing to confirm', W - M, y + 4, { align: 'right' });
    const rows = s.items.map(i => {
      const meta = i.priceSource === 'dentist' ? 'Price set by the dentist' : i.section ? `Price list · ${i.section}${i.code ? ` · code ${i.code}` : ''}` : '';
      return { i, meta, cells: [i.name + '\n ', (i.teeth || []).join(', ') || '—', String(i.qty ?? '?'), eur(i.unitPrice), i.discountPct ? `-${i.discountPct}%` : '', i.status === 'tbc' ? 'To confirm' : eur(i.lineTotal)] };
    });
    doc.autoTable({
      startY: y + 14, margin: { left: M, right: M, bottom: 60 }, theme: 'plain', showFoot: 'lastPage',
      head: [['Procedure', 'Teeth', 'Qty', 'Unit price', 'Disc.', 'Amount']],
      body: rows.map(r => r.cells),
      foot: [[{ content: `Stage ${s.number} subtotal`, colSpan: 5, styles: { halign: 'right' } }, { content: eur(s.subtotal), styles: { halign: 'right' } }]],
      styles: { font: 'helvetica', fontSize: 8.5, textColor: C.ink, cellPadding: { top: 5, bottom: 5, left: 4, right: 4 }, lineColor: C.line, overflow: 'linebreak', valign: 'top' },
      headStyles: { fontStyle: 'bold', fontSize: 7, textColor: C.muted, lineWidth: { bottom: 1.5 }, lineColor: colour },
      bodyStyles: { lineWidth: { bottom: 0.5 }, minCellHeight: 32 },
      footStyles: { fontStyle: 'bold', fontSize: 9, textColor: C.ink, fillColor: C.paper },
      columnStyles: { 0: { cellWidth: 237, cellPadding: { top: 5, bottom: 5, left: 22, right: 4 } }, 1: { cellWidth: 58 }, 2: { cellWidth: 30, halign: 'center' }, 3: { cellWidth: 64, halign: 'right' }, 4: { cellWidth: 40, halign: 'center' }, 5: { cellWidth: 78, halign: 'right' } },
      didParseCell: d => {
        if (d.section === 'head') { d.cell.text = d.cell.text.map(t => t.toUpperCase()); if (d.column.index >= 3 && d.column.index !== 4) d.cell.styles.halign = 'right'; if ([2, 4].includes(d.column.index)) d.cell.styles.halign = 'center'; }
        if (d.section === 'body') {
          const r = rows[d.row.index]; if (!r) return;
          if (r.i.status === 'tbc') { d.cell.styles.fillColor = C.warnBg; if (d.column.index === 5) { d.cell.styles.textColor = C.warn; d.cell.styles.fontStyle = 'bold'; } }
          if (d.column.index === 0) d.cell.styles.fontStyle = 'bold';
          if (d.column.index === 4 && r.i.discountPct) { d.cell.styles.textColor = C.save; d.cell.styles.fontStyle = 'bold'; }
        }
      },
      didDrawCell: d => {
        if (d.section === 'body' && d.column.index === 0) {
          const r = rows[d.row.index]; if (!r) return;
          const nameLines = doc.splitTextToSize(r.i.name, d.cell.width - 26).length;
          drawIcon(doc, iconFor(r.i.group), d.cell.x + 5, d.cell.y + 4.5, 11, colour);
          set('helvetica', 'normal', 7, r.i.status === 'tbc' ? C.warn : C.muted);
          doc.text(r.i.status === 'tbc' && r.i.note ? `To confirm: ${r.i.note}` : r.meta + (r.i.note ? ` · ${r.i.note}` : ''), d.cell.x + 22, d.cell.y + 5 + nameLines * 10.2 + 6.5);
        }
      },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // ---------- Totals ----------
  y = ensure(y, 110);
  const bx = W - M - 250;
  const line = (label, value, bold, color = C.ink) => { set('helvetica', bold ? 'bold' : 'normal', bold ? 10 : 9, color); doc.text(label, bx + 14, y); doc.text(value, W - M - 14, y, { align: 'right' }); y += 15; };
  doc.setFillColor(...C.sunk); doc.roundedRect(bx, y, 250, plan.tbcCount ? 92 : 78, 6, 6, 'F');
  y += 20;
  line('Price-list total', eur(plan.gross));
  if (plan.discountTotal) line('You save', `-${eur(plan.discountTotal)}`, true, C.save); else line('Discounts', eur(0));
  doc.setDrawColor(...C.line); doc.line(bx + 14, y - 6, W - M - 14, y - 6); y += 6;
  set('helvetica', 'bold', 13, C.btn); doc.text('Estimated total', bx + 14, y); doc.text(eur(plan.total), W - M - 14, y, { align: 'right' }); y += 16;
  if (plan.tbcCount) { set('helvetica', 'normal', 7.5, C.warn); doc.text(`+ ${plan.tbcCount} item(s) to confirm, not included above`, bx + 14, y); y += 10; }
  y += 18;

  // ---------- Dentist notes ----------
  const notes = (plan.notes || []).filter(n => n.length > 3);
  if (notes.length) {
    y = ensure(y, 60);
    set('times', 'bold', 12); doc.text('Notes from your dentist', M, y); y += 14;
    set('helvetica', 'normal', 8.5, C.ink);
    for (const n of notes) { const t = doc.splitTextToSize(n, CW - 14); y = ensure(y, t.length * 11); doc.setFillColor(...C.accent); doc.circle(M + 3, y - 3, 1.6, 'F'); doc.text(t, M + 12, y); y += t.length * 11 + 2; }
    y += 10;
  }

  // ---------- Open questions (internal, drafts only) ----------
  if (!approved && open.length) {
    const lines = open.flatMap(q => doc.splitTextToSize(`[${q.priority}] ${q.text}`, CW - 32));
    const h = Math.min(lines.length, 40) * 9.6 + 44;
    y = ensure(y, Math.min(h, 300));
    doc.setFillColor(...C.warnBg); doc.roundedRect(M, y, CW, h, 6, 6, 'F');
    set('helvetica', 'bold', 9.5, C.warn); doc.text(`For the dentist: ${open.length} question(s) to answer before this plan can be approved`, M + 14, y + 20);
    set('helvetica', 'normal', 8, C.ink); doc.text(lines.slice(0, 40), M + 14, y + 36);
    if (lines.length > 40) doc.text(`… and ${lines.length - 40} more lines in the app`, M + 14, y + h - 6);
    y += h + 16;
  }

  // ---------- Imaging ----------
  for (const img of images) {
    doc.addPage(); set('times', 'bold', 14); doc.text('Imaging', M, 64);
    set('helvetica', 'normal', 9, C.muted); doc.text(img.caption || img.name, M, 80);
    try { const p = doc.getImageProperties(img.dataUrl); const w = CW, h = Math.min(H - 200, (p.height / p.width) * w); doc.addImage(img.dataUrl, M, 94, w, h); }
    catch { doc.text('(image could not be embedded)', M, 100); }
    y = H;
  }

  // ---------- Important information + approval ----------
  y = ensure(y, 150);
  set('times', 'bold', 12); doc.text('Important information', M, y); y += 13;
  set('helvetica', 'normal', 8, C.muted);
  const info = doc.splitTextToSize('This estimate is based on the clinical assessment on the consultation date. Every price comes from the clinic price list or was set explicitly by your dentist; items marked "To confirm" are not included in the total. Timings are indicative and depend on healing. The plan is valid only once approved by the treating dentist.', CW);
  doc.text(info, M, y); y += info.length * 10 + 14;
  const half = (CW - 16) / 2;
  doc.setDrawColor(...C.line); doc.setLineWidth(0.8);
  doc.setFillColor(...(approved ? C.mint : C.warnBg)); doc.roundedRect(M, y, half, 58, 6, 6, 'F');
  set('helvetica', 'bold', 7, approved ? C.mintInk : C.warn); doc.text('DENTIST APPROVAL', M + 12, y + 16);
  set('helvetica', 'bold', 9.5, approved ? C.mintInk : C.warn);
  doc.text(approved ? `Approved by ${plan.dentist || 'the dentist'}` : 'Not yet approved', M + 12, y + 32);
  set('helvetica', 'normal', 8, approved ? C.mintInk : C.warn);
  doc.text(approved ? fmtDate(approvedAt) : 'Do not send to the patient', M + 12, y + 45);
  doc.roundedRect(M + half + 16, y, half, 58, 6, 6, 'D');
  set('helvetica', 'bold', 7, C.muted); doc.text('PATIENT ACCEPTANCE', M + half + 28, y + 16);
  doc.line(M + half + 28, y + 44, M + half + 16 + half * 0.6, y + 44); doc.line(M + half + 16 + half * 0.66, y + 44, W - M - 12, y + 44);
  set('helvetica', 'normal', 7, C.muted); doc.text('Signature', M + half + 28, y + 52); doc.text('Date', M + half + 16 + half * 0.66, y + 52);

  // ---------- Footer + watermark on every page ----------
  const n = doc.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    doc.setPage(p);
    doc.setDrawColor(...C.line); doc.setLineWidth(0.6); doc.line(M, H - 40, W - M, H - 40);
    set('helvetica', 'normal', 7.5, C.muted);
    doc.text(`${plan.clinic || 'Clinic'}  ·  ${plan.patientName || 'Patient'}  ·  Treatment plan v${version}${approved ? '' : '  ·  DRAFT'}`, M, H - 26);
    doc.text(`Page ${p} of ${n}`, W - M, H - 26, { align: 'right' });
    if (!approved) {
      doc.saveGraphicsState(); doc.setGState(new doc.GState({ opacity: 0.06 }));
      set('helvetica', 'bold', 110, C.warn); doc.text('DRAFT', W / 2, H / 2 + 60, { align: 'center', angle: 30 });
      doc.restoreGraphicsState();
    }
  }
  return doc;
}
