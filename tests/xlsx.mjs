// Minimal, dependency-free .xlsx reader used by the tests to check src/catalog.js against the
// ORIGINAL client price list (data/Dental_Price_List_EUR.xlsx), independently of the Python generator.
import fs from 'node:fs';
import zlib from 'node:zlib';

function unzip(buf) {
  const files = {};
  let eocd = buf.length - 22;
  while (buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  let p = buf.readUInt32LE(eocd + 16);
  const n = buf.readUInt16LE(eocd + 10);
  for (let i = 0; i < n; i++) {
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const dataStart = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(dataStart, dataStart + csize);
    files[name] = method === 8 ? zlib.inflateRawSync(data).toString('utf8') : data.toString('utf8');
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}
const decode = s => s.replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

export function readPriceList(path) {
  const f = unzip(fs.readFileSync(path));
  const shared = [...(f['xl/sharedStrings.xml'] || '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => decode([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join('')));
  const sheetName = Object.keys(f).find(k => /^xl\/worksheets\/sheet1\.xml$/.test(k));
  const rows = [];
  for (const r of f[sheetName].matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {};
    for (const c of r[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const [, col, attrs, inner = ''] = c;
      const v = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      const inline = (inner.match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1];
      cells[col] = /t="s"/.test(attrs) ? shared[+v] : /t="inlineStr"/.test(attrs) ? decode(inline) : v == null ? null : /t="str"/.test(attrs) ? decode(v) : +v;
    }
    rows.push([cells.A ?? null, cells.B ?? null, cells.C ?? null]);
  }
  return rows;
}
