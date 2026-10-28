/* ============================================================
   RADIO CARDUCCI — ORA E ALMANACCO NELLA MODALITÀ ESPLORA
   Ora locale, data di oggi e una voce dell'almanacco che cambia
   ogni 15 minuti: accadde oggi, nati oggi, santi e ricorrenze.
   I dati vengono dalla pagina del giorno di Wikipedia in italiano
   (es. "28 ottobre"), letti dal browser e ricordati per la giornata:
   valgono per ogni anno, quindi non c'è niente da rifare.
   ============================================================ */
(function () {
  'use strict';

  const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto',
    'settembre', 'ottobre', 'novembre', 'dicembre'];
  const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
  const SEZIONI = { eventi: 'ACCADDE OGGI', nati: 'NATI OGGI', morti: 'SCOMPARSI OGGI', santi: 'SI FESTEGGIA' };

  let box = null, timer = null, data = null, dataKey = '';

  function ls(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; }
  }

  function pageTitle(d) { return d.getDate() + '_' + MESI[d.getMonth()]; }

  // ── Lettura della pagina del giorno (HTML Parsoid della REST API) ──
  function parse(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const out = { eventi: [], nati: [], morti: [], santi: [] };
    doc.querySelectorAll('h2').forEach(h => {
      const id = (h.id || h.textContent).toLowerCase();
      let kind = null;
      if (/^eventi/.test(id)) kind = 'eventi';
      else if (/^nati/.test(id)) kind = 'nati';
      else if (/^morti/.test(id)) kind = 'morti';
      else if (/^(feste|ricorrenze)/.test(id)) kind = 'santi';
      if (!kind) return;
      const sec = h.closest('section') || h.parentElement;
      sec.querySelectorAll('li').forEach(li => {
        if (li.querySelector('li')) return; // solo le voci finali, non i contenitori
        let txt = li.textContent.replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim();
        if (!txt || txt.length > 220) return;
        // l'anno sta nel <li> padre quando gli eventi dello stesso anno sono raggruppati
        const parentLi = li.parentElement && li.parentElement.closest('li');
        let year = '';
        const m = txt.match(/^(\d{1,4}(?:\s*a\.\s*C\.)?)\s*[-–—:]\s*(.+)$/);
        if (m) { year = m[1]; txt = m[2]; }
        else if (parentLi) {
          const pm = parentLi.firstChild && parentLi.firstChild.textContent.match(/^\s*(\d{1,4})/);
          if (pm) year = pm[1];
        }
        if (kind !== 'santi' && !year) return;
        out[kind].push({ year, text: txt.replace(/\s*\.$/, '') });
      });
    });
    return out;
  }

  async function load(d) {
    const key = 'rc_almanacco_' + (d.getMonth() + 1) + '-' + d.getDate();
    if (dataKey === key && data) return data;
    try {
      const cached = JSON.parse(ls(key) || 'null');
      if (cached && cached.eventi) { data = cached; dataKey = key; return data; }
    } catch (e) {}
    try {
      const r = await fetch('https://it.wikipedia.org/api/rest_v1/page/html/' + encodeURIComponent(pageTitle(d)));
      if (!r.ok) throw new Error(r.status);
      data = parse(await r.text());
      dataKey = key;
      ls(key, JSON.stringify(data));
    } catch (e) {
      data = null;
    }
    return data;
  }

  // ── Una voce diversa ogni quarto d'ora, sempre la stessa per lo stesso quarto ──
  function slot(d) { return d.getHours() * 4 + Math.floor(d.getMinutes() / 15); }

  function voce(d) {
    if (!data) return null;
    // giro: tre eventi, un nato, un santo/ricorrenza, un evento, uno scomparso…
    const giro = ['eventi', 'eventi', 'nati', 'eventi', 'santi', 'eventi', 'morti'];
    const s = slot(d);
    for (let k = 0; k < giro.length; k++) {
      const kind = giro[(s + k) % giro.length];
      const list = data[kind];
      if (list && list.length) {
        const item = list[(s * 7 + d.getDate()) % list.length];
        return { label: SEZIONI[kind], year: item.year, text: item.text };
      }
    }
    return null;
  }

  function frasePiano(d) {
    // senza Wikipedia: una frase della R per la fascia oraria
    const b = window.RC_FRASI || {};
    const h = d.getHours();
    const g = h >= 5 && h < 12 ? 'mattina' : h < 18 ? 'pomeriggio' : h < 23 ? 'sera' : 'notte';
    const list = b[g] || ['la radio va avanti anche quando tu studi.'];
    return { label: 'RC / ESPLORA', year: '', text: list[slot(d) % list.length].replace('{ora}', clock(d)) };
  }

  function clock(d) { return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

  function render() {
    if (!box) return;
    const d = new Date();
    box.querySelector('.rc-focus__clock').textContent = clock(d);
    box.querySelector('.rc-focus__date').textContent = (GIORNI[d.getDay()] + ' ' + d.getDate() + ' ' + MESI[d.getMonth()]).toUpperCase();
    const s = slot(d);
    if (box._slot === s && box._hadData === !!data) return;
    box._slot = s;
    box._hadData = !!data;
    const v = voce(d) || frasePiano(d);
    box.querySelector('.rc-focus__label').textContent = v.label;
    box.querySelector('.rc-focus__year').textContent = v.year;
    box.querySelector('.rc-focus__text').textContent = v.text;
    box.querySelector('.rc-focus__src').hidden = !data;
    box.classList.remove('rc-focus--cut');
    void box.offsetWidth;
    box.classList.add('rc-focus--cut');
  }

  function start() {
    if (box) return;
    box = document.createElement('aside');
    box.className = 'rc-focus';
    box.setAttribute('aria-live', 'polite');
    box.innerHTML = `
      <div class="rc-focus__clock">--:--</div>
      <div class="rc-focus__date"></div>
      <div class="rc-focus__entry">
        <span class="rc-focus__label"></span>
        <span class="rc-focus__year"></span>
        <p class="rc-focus__text"></p>
      </div>
      <div class="rc-focus__src" hidden>ALMANACCO · FONTE: WIKIPEDIA</div>`;
    document.body.appendChild(box);
    render();
    load(new Date()).then(() => { box && (box._slot = -1); render(); });
    timer = setInterval(() => {
      const d = new Date();
      if (d.getHours() === 0 && d.getMinutes() === 0) load(d).then(render);
      render();
    }, 1000);
  }

  function stop() {
    clearInterval(timer);
    timer = null;
    if (box) box.remove();
    box = null;
  }

  function init() {
    // la modalità Esplora mette la classe theme-explore sul body
    new MutationObserver(() => {
      document.body.classList.contains('theme-explore') ? start() : stop();
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  window.RCFocus = { parse, load, voce };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
