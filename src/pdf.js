// Document Generation Agent: structured plan -> branded, patient-friendly PDF (jsPDF + autotable).
const eur = n => (n == null ? 'TBC' : '€' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const TEAL = [13, 148, 136], INK = [15, 23, 42], MUTED = [100, 116, 139];

export function renderPdf(plan, { version, status, approvedAt, open = [], images = [] }) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(...TEAL); doc.rect(0, 0, W, 78, 'F');
  doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
  doc.text(plan.clinic || 'Dental Clinic', 40, 38);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.text('Personalised treatment plan & estimate', 40, 58);
  doc.setFontSize(9); doc.text(`Version ${version}  ·  ${status}`, W - 40, 38, { align: 'right' });
  doc.text(new Date().toLocaleString('en-GB'), W - 40, 54, { align: 'right' });

  doc.setTextColor(...INK); doc.setFontSize(10);
  let y = 104;
  const kv = [['Patient', plan.patientName || 'TBC'], ['Dentist', plan.dentist || 'TBC'], ['Consultation date', plan.date], ['Implant system', plan.brand || '—']];
  kv.forEach(([k, v], i) => { const x = 40 + (i % 2) * 260, yy = y + Math.floor(i / 2) * 16; doc.setTextColor(...MUTED); doc.text(k, x, yy); doc.setTextColor(...INK); doc.text(String(v), x + 95, yy); });
  y += 44;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('Treatment overview', 40, y); y += 16;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  const overview = `Your treatment is organised in ${plan.stages.length} stage${plan.stages.length > 1 ? 's' : ''}. Each stage lists the procedures, the affected teeth, the expected timing and the cost from the clinic price list. Total estimated cost: ${eur(plan.total)}${plan.tbcCount ? ` (plus ${plan.tbcCount} item(s) still to be confirmed)` : ''}.`;
  doc.text(doc.splitTextToSize(overview, W - 80), 40, y); y += 40;

  if (plan.notes?.length) {
    doc.setFont('helvetica', 'bold'); doc.text('Clinical observations dictated by the dentist', 40, y); y += 14; doc.setFont('helvetica', 'normal');
    const t = doc.splitTextToSize(plan.notes.map(n => '• ' + n).join('\n'), W - 80); doc.text(t, 40, y); y += t.length * 12 + 8;
  }

  for (const s of plan.stages) {
    doc.autoTable({
      startY: y, margin: { left: 40, right: 40 },
      head: [[{ content: `Stage ${s.number} — ${s.title}`, colSpan: 4, styles: { fillColor: TEAL } }, { content: s.interval || 'Timing TBC', colSpan: 2, styles: { fillColor: TEAL, halign: 'right' } }],
             ['Procedure', 'Teeth', 'Qty', 'Unit price', 'Discount', 'Amount']],
      body: s.items.map(i => [i.name + (i.note ? `\n${i.note}` : '') + (i.status === 'tbc' ? '\n⚠ to be confirmed' : ''), (i.teeth || []).join(', '), i.qty, eur(i.unitPrice), i.discountPct ? `${i.discountPct}%` : '', eur(i.lineTotal)]),
      foot: [[{ content: `Stage ${s.number} subtotal`, colSpan: 5 }, eur(s.subtotal)]],
      styles: { fontSize: 8.5, cellPadding: 4, textColor: INK }, headStyles: { fillColor: [241, 245, 249], textColor: INK }, footStyles: { fillColor: [240, 253, 250], textColor: INK },
      columnStyles: { 0: { cellWidth: 230 }, 2: { halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'center' }, 5: { halign: 'right' } },
    });
    y = doc.lastAutoTable.finalY + 14;
  }
  if (y > 720) { doc.addPage(); y = 60; }
  doc.setFillColor(15, 23, 42); doc.roundedRect(40, y, W - 80, 34, 6, 6, 'F');
  doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text('Total estimated cost', 54, y + 22); doc.text(eur(plan.total), W - 54, y + 22, { align: 'right' }); y += 54;
  doc.setTextColor(...INK);

  if (open.length) {
    if (y > 680) { doc.addPage(); y = 60; }
    doc.setFillColor(255, 247, 237); const lines = open.map(q => `• [${q.priority}] ${q.text}`);
    const txt = doc.splitTextToSize(lines.join('\n'), W - 100);
    doc.roundedRect(40, y, W - 80, txt.length * 11 + 30, 6, 6, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(194, 65, 12); doc.text(`Open questions for the dentist (${open.length}) — not patient-ready`, 52, y + 18);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...INK); doc.text(txt, 52, y + 32); y += txt.length * 11 + 44;
  }
  for (const img of images) {
    doc.addPage(); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('Imaging: ' + (img.caption || img.name), 40, 60);
    try { const p = doc.getImageProperties(img.dataUrl); const w = W - 80, h = Math.min(600, (p.height / p.width) * w); doc.addImage(img.dataUrl, 40, 80, w, h); } catch { doc.text('(image could not be embedded)', 40, 90); }
    y = 760;
  }
  if (y > 700) { doc.addPage(); y = 60; }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED);
  doc.text(doc.splitTextToSize('Important: this estimate is based on the clinical assessment at the date above. Prices come from the clinic price list or were explicitly set by the dentist; items marked "to be confirmed" are not included in the total. Timing is indicative and depends on healing. This document is valid only once approved by the treating dentist.', W - 80), 40, y + 10);
  doc.setFontSize(10); doc.setTextColor(...(approvedAt ? TEAL : [194, 65, 12])); doc.setFont('helvetica', 'bold');
  doc.text(approvedAt ? `Approved by ${plan.dentist || 'the dentist'} on ${new Date(approvedAt).toLocaleString('en-GB')}` : 'DRAFT — awaiting dentist approval. Not to be sent to the patient.', 40, y + 56);
  if (!approvedAt) { const n = doc.getNumberOfPages(); for (let p = 1; p <= n; p++) { doc.setPage(p); doc.setTextColor(230); doc.setFontSize(70); doc.text('DRAFT', W / 2, 480, { align: 'center', angle: 35 }); } }
  return doc;
}
