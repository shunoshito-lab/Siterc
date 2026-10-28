// Genera i PDF dei canovacci in stile Radio Carducci (vedi LEGGIMI.md).
// Usa il Chromium di Playwright per stampare una pagina HTML in PDF.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATI = path.join(ROOT, 'canovacci', 'dati');
const OUT = path.join(ROOT, 'assets', 'canovacci');

const PROGRAMMI = {
  'emergenza-emergenti': { nome: 'Emergenza Emergenti.', colore: '#db3849', scuro: '#991c3b' },
  'cose-da-nerd': { nome: 'Cose da Nerd.', colore: '#8402fc', scuro: '#4d0194' }
};

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// I canovacci sono documenti di lavoro: niente commenti interni, solo il contenuto.
const rich = esc;
// Moliga non ha accenti: vocale + apostrofo
const mega = s => String(s).replace(/[àèéìòù]/g, c => ({ 'à': "a'", 'è': "e'", 'é': "e'", 'ì': "i'", 'ò': "o'", 'ù': "u'" }[c]));

function dataIt(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const mesi = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  return `${d} ${mesi[m - 1]} ${y}`;
}

function html(c) {
  const p = PROGRAMMI[c.programma];
  const fonts = pathToFileURL(path.join(ROOT, 'fonts')).href;
  let n = 0;
  const blocchi = c.blocchi.map(b => {
    if (b.tipo === 'talk') {
      n++;
      return `<section class="talk">
        <div class="num">${String(n).padStart(2, '0')}</div>
        <div class="body">
          <div class="lab">TALK ${n}</div>
          <h2>${esc(b.titolo)}</h2>
          ${(b.testo || []).map(t => `<p>${rich(t)}</p>`).join('')}
          ${b.brano ? `<div class="brano"><span>CANZONE</span> ${esc(b.brano)}</div>` : ''}
        </div></section>`;
    }
    if (b.tipo === 'scheda') {
      return `<section class="scheda">
        <div class="lab">RADIO CARDUCCI / SCHEDA OSPITE</div>
        <h2 class="mega">${esc(mega(b.titolo))}</h2>
        ${b.sottotitolo ? `<p class="sub">${rich(b.sottotitolo)}</p>` : ''}
        ${(b.sezioni || []).map(s => `<div class="sez"><div class="lab">${esc(s.titolo)}</div><ul>${s.voci.map(v => `<li>${rich(v)}</li>`).join('')}</ul></div>`).join('')}
      </section>`;
    }
    return '';
  }).join('');
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>${esc(c.titolo)}</title><style>
  @font-face { font-family: Moliga; src: url('${fonts}/Moliga-Demo-Regular.otf'); }
  @font-face { font-family: BLMelody; src: url('${fonts}/BLMelody-Regular.woff2'); }
  @font-face { font-family: BLMelody; font-weight: 700; src: url('${fonts}/BLMelody-Bold.woff2'); }
  @font-face { font-family: Mont; font-weight: 100 900; src: url('${fonts}/Montserrat.ttf'); }
  @page { size: A4; margin: 18mm 16mm 20mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: BLMelody, Mont, sans-serif; font-size: 10.5pt; line-height: 1.5; color: #1e1e1e; }
  .lab { font-family: Mont, sans-serif; font-weight: 800; font-size: 7.5pt; letter-spacing: .16em; text-transform: uppercase; color: #6b6b6b; }
  header { border-left: 8px solid ${p.colore}; padding: 2mm 0 2mm 6mm; margin-bottom: 9mm; }
  header .prog { font-family: Moliga, sans-serif; font-size: 34pt; line-height: 1; color: ${p.colore}; margin: 2mm 0; }
  header h1 { font-family: Mont, sans-serif; font-weight: 900; font-size: 20pt; line-height: 1.1; margin: 2mm 0 3mm; }
  header .meta { display: flex; flex-wrap: wrap; gap: 2mm 7mm; font-family: Mont, sans-serif; font-size: 8.5pt; }
  header .meta b { color: ${p.colore}; font-weight: 800; letter-spacing: .08em; }
  header .intro { margin-top: 3mm; color: #444; }
  .talk { display: grid; grid-template-columns: 16mm 1fr; gap: 4mm; padding: 5mm 0; border-top: 1px solid #ddd; break-inside: avoid-page; }
  .num { font-family: Mont, sans-serif; font-weight: 900; font-size: 22pt; color: ${p.colore}; line-height: 1; }
  h2 { font-family: Mont, sans-serif; font-weight: 800; font-size: 13pt; margin: 1mm 0 2mm; }
  p { margin: 0 0 2.2mm; }
  .brano { margin-top: 3mm; padding: 2mm 3mm; background: #1e1e1e; color: #f4f4f5; font-family: Mont, sans-serif; font-size: 8.5pt; font-weight: 700; }
  .brano span { color: ${p.colore}; letter-spacing: .14em; margin-right: 2mm; }
  .scheda { break-before: page; }
  .scheda .mega { font-family: Moliga, sans-serif; font-weight: 400; font-size: 30pt; color: ${p.colore}; margin: 2mm 0; }
  .scheda .sub { color: #444; }
  .sez { margin-top: 5mm; }
  .sez ul { margin: 1.5mm 0 0; padding-left: 4mm; }
  .sez li { margin-bottom: 1.2mm; }

  </style></head><body>
  <header>
    <div class="lab">RADIO CARDUCCI / CANOVACCIO</div>
    <div class="prog">${esc(mega(p.nome))}</div>
    <h1>${esc(c.titolo)}</h1>
    <div class="meta">
      ${c.data ? `<span><b>IN ONDA</b> ${dataIt(c.data)}</span>` : ''}
      ${c.conduzione ? `<span><b>CONDUZIONE</b> ${esc(c.conduzione)}</span>` : ''}
      ${c.ospite ? `<span><b>OSPITE</b> ${esc(c.ospite)}</span>` : ''}
    </div>
    ${c.intro ? `<p class="intro">${rich(c.intro)}</p>` : ''}
  </header>
  ${blocchi}
  </body></html>`;
}

const files = fs.readdirSync(DATI).filter(f => f.endsWith('.json')).sort();
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
const indice = [];
for (const f of files) {
  const c = JSON.parse(fs.readFileSync(path.join(DATI, f), 'utf8'));
  const slug = f.replace(/\.json$/, '');
  const tmp = path.join(OUT, `.${slug}.html`);
  fs.writeFileSync(tmp, html(c));
  await page.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const piede = `<div style="width:100%;margin:0 16mm;display:flex;justify-content:space-between;
    font-family:sans-serif;font-size:7pt;letter-spacing:.16em;text-transform:uppercase;color:#8a8a94;">
    <span>RADIO CARDUCCI / CANOVACCIO</span><span>WEB ONLY · <span class="pageNumber"></span></span></div>`;
  await page.pdf({ path: path.join(OUT, `${slug}.pdf`), format: 'A4', printBackground: true, preferCSSPageSize: true,
    displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: piede });
  fs.unlinkSync(tmp);
  indice.push({ file: `${slug}.pdf`, programma: c.programma, titolo: c.titolo, data: c.data || '', ospite: c.ospite || '',
    conduzione: c.conduzione || '', talk: c.blocchi.filter(b => b.tipo === 'talk').map(b => b.titolo) });
  console.log('ok', slug);
}
await browser.close();
indice.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
fs.writeFileSync(path.join(OUT, 'indice.json'), JSON.stringify({ canovacci: indice }, null, 1));
