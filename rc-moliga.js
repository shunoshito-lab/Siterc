/* ============================================================
   RADIO CARDUCCI — MOLIGA SENZA ACCENTI
   Moliga non ha le vocali accentate: ovunque un testo sia scritto
   in Moliga, à → a', è → e', ì → i', ò → o', ù → u' (é → e').
   Non serve una lista di classi: guarda il font vero di ogni testo,
   anche quelli che arrivano dopo (config, brani, Wrapped).
   Toglie anche le emoji da tutti i testi, comprese quelle che arrivano
   dal config remoto (bio, bacheca): sul sito non ne vogliamo.
   Caricato sia dal sito sia dal Wrapped.
   ============================================================ */
(function () {
  'use strict';

  const MAP = { 'à': "a'", 'è': "e'", 'é': "e'", 'ì': "i'", 'ò': "o'", 'ù': "u'",
    'À': "A'", 'È': "E'", 'É': "E'", 'Ì': "I'", 'Ò': "O'", 'Ù': "U'" };
  const HAS = /[àèéìòùÀÈÉÌÒÙ]/;
  const ALL = /[àèéìòùÀÈÉÌÒÙ]/g;

  const fix = window.RCMega = s => String(s == null ? '' : s).replace(ALL, c => MAP[c]);

  function isMoliga(el) {
    if (!el || el.nodeType !== 1) return false;
    try { return /moliga/i.test(getComputedStyle(el).fontFamily.split(',')[0]); } catch (e) { return false; }
  }

  function fixText(node) {
    fixEmoji(node);
    if (!HAS.test(node.nodeValue)) return;
    if (!isMoliga(node.parentElement)) return;
    node.nodeValue = fix(node.nodeValue);
  }

  function scan(root) {
    if (!root) return;
    if (root.nodeType === 3) { fixText(root); return; }
    if (root.nodeType !== 1 || /^(SCRIPT|STYLE|TEXTAREA|INPUT)$/.test(root.tagName)) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const list = [];
    let n;
    while ((n = w.nextNode())) list.push(n);
    list.forEach(fixText);
  }

  // ── Niente emoji sul sito (regola del brand). Le frecce e i segni
  //    tipografici (-> ↗ · × ✦ —) restano: non sono emoji.
  const EMOJI = /[\u{1F000}-\u{1FAFF}\u{1F004}\u{1F0CF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2460}-\u{24FF}\u{25A0}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu;
  const TIENI = /[\u2192\u2190\u2191\u2193\u2197\u2198\u2196\u2199\u2194\u00D7\u2726\u2727\u25CF\u25A0\u25B6\u25C0]/;
  function senzaEmoji(t) {
    if (!EMOJI.test(t)) { EMOJI.lastIndex = 0; return t; }
    EMOJI.lastIndex = 0;
    return t.replace(EMOJI, c => (TIENI.test(c) ? c : '')).replace(/ {2,}/g, ' ').replace(/ ([,.;:!?])/g, '$1');
  }
  function fixEmoji(node) {
    const v = node.nodeValue;
    const n = senzaEmoji(v);
    if (n !== v) node.nodeValue = n;
  }

  function boot() {
    scan(document.body);
    // i font arrivano dopo: un secondo giro quando sono caricati
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => scan(document.body));
    new MutationObserver(list => {
      list.forEach(m => {
        if (m.type === 'characterData') fixText(m.target);
        else m.addedNodes.forEach(scan);
      });
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
