/* ============================================================
   RADIO CARDUCCI — IL GATTO
   Corre sul fondo della pagina dietro a Spigolo. Quando lo
   raggiunge, il pappagallo si alza in volo e si ricomincia.
   Disegnato a mano sui colori del marchio: il modello 3D che
   ci siamo passati e' servito solo come posa di riferimento.
   ============================================================ */
(function () {
  'use strict';

  const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  if (REDUCED || !FINE) return;

  const SVG = `
<svg viewBox="0 0 160 96" aria-hidden="true" focusable="false">
  <!-- coda -->
  <path class="g__coda" fill="#f4f4f5" d="M28 48 C10 44 4 28 12 16 C16 24 22 30 30 32 Z"/>
  <!-- zampe dietro -->
  <g class="g__zampa" id="g-pd1"><path fill="#991c3b" d="M44 52 h11 l3 28 h-11 Z"/><path fill="#1e1e1e" d="M44 76 h14 v8 h-14 Z"/></g>
  <g class="g__zampa" id="g-pd2"><path fill="#db3849" d="M56 52 h11 l2 28 h-11 Z"/><path fill="#1e1e1e" d="M56 76 h14 v8 h-14 Z"/></g>
  <!-- corpo -->
  <path fill="#f4f4f5" d="M34 34 C44 24 72 20 100 24 C120 27 134 34 138 44
    C142 56 134 64 118 64 L52 64 C38 64 30 54 30 44 Z"/>
  <!-- fascia rossa: il collare della radio -->
  <path fill="#db3849" d="M112 26 l10 3 l-5 34 l-10 -2 Z"/>
  <!-- zampe davanti -->
  <g class="g__zampa" id="g-pa1"><path fill="#991c3b" d="M100 52 h10 l3 28 h-11 Z"/><path fill="#1e1e1e" d="M99 76 h14 v8 h-14 Z"/></g>
  <g class="g__zampa" id="g-pa2"><path fill="#f4f4f5" d="M112 52 h10 l2 28 h-10 Z"/><path fill="#1e1e1e" d="M111 76 h14 v8 h-14 Z"/></g>
  <!-- testa -->
  <path fill="#f4f4f5" d="M124 18 L136 6 L140 22 L150 10 L154 28 C158 34 156 44 148 48
    C138 52 126 46 124 36 Z"/>
  <!-- orecchie scure dentro -->
  <path fill="#991c3b" d="M133 12 L137 20 L132 20 Z"/>
  <path fill="#991c3b" d="M149 16 L151 26 L146 22 Z"/>
  <!-- muso -->
  <circle id="g-occhio" cx="145" cy="31" r="3.4" fill="#1e1e1e"/>
  <path fill="#db3849" d="M152 36 l6 2 l-4 4 Z"/>
</svg>`;

  const el = document.createElement('div');
  el.className = 'gt';
  el.innerHTML = SVG;
  document.body.appendChild(el);

  const zampe = ['g-pa1', 'g-pa2', 'g-pd1', 'g-pd2'].map(id => el.querySelector('#' + id));
  const occhio = el.querySelector('#g-occhio');

  // quanto spazio occupa la barra del player, cosi' il gatto ci cammina sopra
  function suolo() {
    const bar = document.querySelector('.player-bar');
    const h = bar && bar.offsetHeight ? bar.offsetHeight : 0;
    return innerHeight - h - 56;
  }

  const G = {
    x: -200, y: 0, vx: 0,
    verso: 1,      // 1 guarda a destra
    passo: 0,
    fermo: 0,
    visto: false
  };
  G.y = suolo();

  let ultimo = performance.now();
  function giro(ora) {
    const dt = Math.min(34, ora - ultimo) / 16.67;
    ultimo = ora;

    const sp = window.RCSpigolo;
    if (!sp || !sp.visto) { requestAnimationFrame(giro); return; }
    if (!G.visto) { G.visto = true; G.x = sp.x - 320; el.classList.add('gt--on'); }

    // insegue la verticale del pappagallo, restando per terra
    const bersaglio = sp.x - 70 * G.verso;
    const dx = bersaglio - G.x;
    const vicino = Math.abs(dx) < 26;
    G.vx += ((vicino ? 0 : Math.sign(dx) * Math.min(9, Math.abs(dx) * 0.07)) - G.vx) * 0.12 * dt;
    G.x += G.vx * dt;
    if (Math.abs(G.vx) > 0.4) G.verso = G.vx > 0 ? 1 : -1;
    G.y += (suolo() - G.y) * 0.1 * dt;

    // quando arriva sotto al pappagallo posato, lo fa alzare in volo
    if (sp.posato && Math.abs(sp.x - G.x) < 90) {
      G.fermo += dt;
      if (G.fermo > 130 && sp.decolla) { sp.decolla('il gatto'); G.fermo = 0; }
    } else G.fermo = 0;

    const corre = Math.abs(G.vx);
    G.passo += (0.1 + corre * 0.075) * dt;

    el.style.transform = 'translate3d(' + (G.x - 80) + 'px,' + (G.y - 58) + 'px,0) scaleX(' + G.verso + ')';

    // corsa: le zampe vanno a coppie incrociate, il corpo sobbalza
    const amp = Math.min(34, 6 + corre * 5);
    const f = [0, Math.PI, Math.PI * 0.85, Math.PI * 1.85];
    for (let i = 0; i < 4; i++) {
      zampe[i].style.transform = 'rotate(' + (Math.sin(G.passo + f[i]) * amp).toFixed(1) + 'deg)';
    }
    el.style.setProperty('--sob', (Math.abs(Math.sin(G.passo)) * Math.min(3, corre) * 0.9).toFixed(2) + 'px');

    // l'occhio punta il pappagallo
    const oy = Math.max(-2, Math.min(2, (sp.y - G.y) / 160));
    occhio.setAttribute('cy', (31 + oy).toFixed(2));

    requestAnimationFrame(giro);
  }
  requestAnimationFrame(giro);
})();
