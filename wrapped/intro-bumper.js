/* ============================================================
   WRAPPED — apertura a bumper
   Schermo nero, tre righe secche, poi taglio sull'intro.
   Si salta con un clic o un tasto. Con "riduci movimento" non parte.
   ============================================================ */
(function () {
  'use strict';
  const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NAME = (new URLSearchParams(location.search).get('name') || '').trim() || 'Simone P.';
  // Moliga non ha i numeri: si scrivono in lettere
  const LINES = ['venticinque brani.', 'una persona.', '<em>zero scuse.</em>'];

  function riseTitle() {
    const title = document.querySelector('.intro-title');
    if (!title) return;
    title.classList.add('wr-rise');
    title.querySelectorAll('.intro-line:not(.intro-name-line)').forEach(line => {
      if (line.querySelector('.wr-in')) return;
      const inner = document.createElement('span');
      inner.className = 'wr-in';
      while (line.firstChild) inner.appendChild(line.firstChild);
      line.appendChild(inner);
    });
    requestAnimationFrame(() => requestAnimationFrame(() => title.classList.add('wr-rise--on')));
  }

  function boot() {
    if (REDUCED) return;
    const b = document.createElement('div');
    b.className = 'wr-bumper';
    b.setAttribute('role', 'presentation');
    b.innerHTML = `
      <div class="wr-bumper__top"><span>RC / WRAPPED</span><span>${NAME.replace(/[<>&]/g, '')}</span></div>
      <p class="wr-bumper__txt">${LINES.map(l => `<span>${l}</span>`).join('')}</p>
      <div class="wr-bumper__bot"><span>WEB ONLY</span><span>CLICCA PER SALTARE</span></div>`;
    document.body.appendChild(b);
    const spans = b.querySelectorAll('.wr-bumper__txt span');
    const timers = [];
    spans.forEach((s, i) => timers.push(setTimeout(() => s.classList.add('on'), 250 + i * 380)));
    let done = false;
    const cut = () => {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      b.hidden = true;
      b.remove();
      riseTitle();
    };
    timers.push(setTimeout(cut, 250 + LINES.length * 380 + 700));
    b.addEventListener('click', cut);
    document.addEventListener('keydown', cut, { once: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
