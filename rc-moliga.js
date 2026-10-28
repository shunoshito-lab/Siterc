/* ============================================================
   RADIO CARDUCCI — MOLIGA SENZA ACCENTI
   Moliga non ha le vocali accentate: ovunque un testo sia scritto
   in Moliga, à → a', è → e', ì → i', ò → o', ù → u' (é → e').
   Non serve una lista di classi: guarda il font vero di ogni testo,
   anche quelli che arrivano dopo (config, brani, Wrapped).
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
    if (!HAS.test(node.nodeValue)) return;
    if (!isMoliga(node.parentElement)) return;
    node.nodeValue = fix(node.nodeValue);
  }

  function scan(root) {
    if (!root) return;
    if (root.nodeType === 3) { fixText(root); return; }
    if (root.nodeType !== 1 || /^(SCRIPT|STYLE|TEXTAREA|INPUT)$/.test(root.tagName)) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => HAS.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    });
    const list = [];
    let n;
    while ((n = w.nextNode())) list.push(n);
    list.forEach(fixText);
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
