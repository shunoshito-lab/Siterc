/* ============================================================
   RADIO CARDUCCI — SPIGOLO
   Un pappagallo che vola dietro al cursore. Quando clicchi un
   tasto si posa sul bordo e la coda diventa l'equalizzatore
   nella meta' bassa del tasto: barre che seguono la diretta.
   Solo con mouse vero, mai sul telefono. Quattro colori.
   ============================================================ */
(function () {
  'use strict';

  const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  if (REDUCED || !FINE) return;

  const NBARRE = 9;
  const SELEZIONE = 'button, .btn, [role="button"], .nav-link, .team-filter, a.cta, .player-bar__btn';

  // ── disegno ────────────────────────────────────────────────
  // Pappagallo di fronte, a segmenti dritti: la stessa mano
  // spigolosa del resto del marchio. Le iridi hanno un id.
  const SVG = `
<svg viewBox="0 0 100 130" aria-hidden="true" focusable="false">
  <!-- coda corta: in volo si vede, posato la sostituisce l'equalizzatore -->
  <g class="sp__tail">
    <path fill="#991c3b" d="M44 98 C36 112 24 124 8 130 C16 116 28 104 42 96 Z"/>
    <path fill="#db3849" d="M52 100 C50 114 44 124 32 130 C34 116 40 106 48 98 Z"/>
  </g>
  <!-- ala dietro: si vede solo in volo -->
  <path class="sp__wing sp__wing--back" id="sp-wb" fill="#991c3b"
    d="M44 48 C30 52 20 66 22 82 C24 94 34 100 44 96 C38 84 38 62 44 48 Z"/>
  <!-- zampe -->
  <path fill="#1e1e1e" d="M50 94 h4 v14 c0 2 2 3 4 3 h5 v4 h-7 c-4 0 -6 -3 -6 -7 Z"/>
  <path fill="#1e1e1e" d="M59 94 h4 v13 c0 2 2 3 4 3 h4 v4 h-6 c-4 0 -6 -3 -6 -7 Z"/>
  <!-- sagoma: cresta, testa, corpo -->
  <path fill="#db3849" d="M62 16
    C58 8 48 2 38 4 C46 8 50 14 52 20
    C48 12 40 8 32 10 C40 14 44 20 46 26
    C40 20 34 20 30 24 C36 26 40 32 40 38
    C32 48 26 62 28 78 C30 96 42 106 56 106
    C68 106 76 96 76 82 C76 70 71 62 71 54
    C71 46 74 40 74 34 C74 24 70 16 62 16 Z"/>
  <!-- becco uncinato -->
  <path class="sp__beak" fill="#f4f4f5" d="M70 26 C81 26 88 32 88 40 C88 48 81 54 73 53 C77 45 76 34 70 26 Z"/>
  <path fill="#1e1e1e" d="M75 47 C81 46 85 48 84 51 C82 54 76 54 73 52 Z"/>
  <circle cx="78" cy="33" r="1.8" fill="#1e1e1e"/>
  <!-- occhio -->
  <circle class="sp__white" cx="62" cy="33" r="5.6" fill="#f4f4f5"/>
  <circle id="sp-iris" cx="63" cy="34" r="2.7" fill="#1e1e1e"/>
  <!-- ala davanti -->
  <g class="sp__wing" id="sp-wf">
    <path fill="#991c3b" d="M42 46 C58 48 70 62 70 78 C70 92 60 102 48 102 C54 88 54 62 42 46 Z"/>
    <path class="sp__feather" fill="#f4f4f5" d="M50 62 C58 66 63 72 65 80 L62 81 C60 73 55 67 48 64 Z"/>
    <path class="sp__feather" fill="#f4f4f5" d="M53 78 C59 81 62 86 63 91 L60 92 C59 87 56 83 51 80 Z"/>
  </g>
</svg>`;

  // ── stato ──────────────────────────────────────────────────
  const el = document.createElement('div');
  el.className = 'sp';
  el.innerHTML = SVG;
  document.body.appendChild(el);

  const eq = document.createElement('div');
  eq.className = 'sp-eq';
  for (let i = 0; i < NBARRE; i++) {
    const b = document.createElement('i');
    b.className = 'sp-eq__bar';
    eq.appendChild(b);
  }
  document.body.appendChild(eq);
  const barre = Array.prototype.slice.call(eq.children);

  const wf = el.querySelector('#sp-wf');
  const wb = el.querySelector('#sp-wb');
  const iris = el.querySelector('#sp-iris');

  const S = window.RCSpigolo = {
    x: innerWidth * 0.5, y: -100,   // dove sta
    vx: 0, vy: 0,
    tx: innerWidth * 0.5, ty: -100, // dove vuole andare
    mx: innerWidth * 0.5, my: innerHeight * 0.5,
    rot: 0, flap: 0,
    posato: null,                   // il tasto su cui sta
    daQuando: 0,
    visto: false
  };

  // Mentre vola sta un po' sopra e dietro al cursore: non lo copre.
  const OFF_X = 0, OFF_Y = -18;
  const LARG = 64, ALT = 72, PIEDI = 0.9;  // le zampe stanno al 90% dell'altezza

  addEventListener('pointermove', e => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    S.mx = e.clientX; S.my = e.clientY;
    if (!S.visto) { S.visto = true; el.classList.add('sp--on'); S.x = S.mx; S.y = S.my - 160; }
    if (S.posato) {
      // alcuni tasti vengono ridisegnati al clic: ritrovo il gemello
      if (!document.contains(S.posato)) {
        const g = Array.prototype.find.call(document.querySelectorAll(SELEZIONE),
          n => chiave(n) === S.chiave);
        if (g) S.posato = g; else decolla('nodo sparito');
      }
    }
    if (S.posato) {
      const r = S.posato.getBoundingClientRect();
      const dist = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
      if (dist > 160) decolla('lontano');   // ti sei allontanato: riparte
    }
  }, { passive: true });

  addEventListener('pointerdown', e => {
    const t = e.target && e.target.closest ? e.target.closest(SELEZIONE) : null;
    if (t && t.offsetParent !== null) posa(t);
    else if (S.posato) decolla('altro clic');
  }, { passive: true, capture: true });

  // scorrendo resta aggrappato: si alza solo se il tasto esce dallo schermo

  // un tasto ridisegnato cambia nodo ma non classe ne' prima parola
  function chiave(n) {
    const t = (n.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    return (n.className || '') + '|' + t.split(' ')[0];
  }

  function posa(t) {
    S.posato = t;
    S.chiave = chiave(t);
    S.daQuando = performance.now();
    el.classList.add('sp--perch');
    eq.classList.add('sp-eq--on');
  }

  S.decolla = decolla;
  function decolla(perche) {
    if (window.__spDbg) window.__spDbg.push(perche + ' @' + Math.round(performance.now()));
    S.posato = null;
    el.classList.remove('sp--perch');
    eq.classList.remove('sp-eq--on');
  }

  // ── spettro: la diretta se c'e', altrimenti un respiro finto ──
  const dati = new Float32Array(NBARRE);
  function spettro(t) {
    const R = window.RCAudioReactive;
    if (R && R.enabled && R._analyser && R._data) {
      R._analyser.getByteFrequencyData(R._data);
      const d = R._data, passo = Math.floor(d.length / 2 / NBARRE) || 1;
      for (let i = 0; i < NBARRE; i++) {
        let s = 0;
        for (let k = 0; k < passo; k++) s += d[i * passo + k];
        dati[i] += ((s / passo / 255) - dati[i]) * 0.3;
      }
      return;
    }
    // niente analyser: onda lenta, cosi' le barre non stanno ferme
    for (let i = 0; i < NBARRE; i++) {
      const v = 0.34 + Math.sin(t / 420 + i * 0.7) * 0.18 + Math.sin(t / 137 + i) * 0.07;
      dati[i] += (v - dati[i]) * 0.18;
    }
  }

  // ── ciclo ──────────────────────────────────────────────────
  let ultimo = performance.now();
  function giro(ora) {
    const dt = Math.min(34, ora - ultimo) / 16.67;
    ultimo = ora;

    if (S.posato) {
      // alcuni tasti vengono ridisegnati al clic: ritrovo il gemello
      if (!document.contains(S.posato)) {
        const g = Array.prototype.find.call(document.querySelectorAll(SELEZIONE),
          n => chiave(n) === S.chiave);
        if (g) S.posato = g; else decolla('nodo sparito');
      }
    }
    if (S.posato) {
      const r = S.posato.getBoundingClientRect();
      const fuori = r.bottom < 8 || r.top > innerHeight - 8;
      if (r.width === 0 || fuori || ora - S.daQuando > 9000) decolla(r.width===0?'largo 0':fuori?'fuori':'tempo');
      else {
        // le zampe sul bordo alto del tasto, il corpo sopra il testo
        S.tx = r.left + r.width / 2;
        S.ty = r.top + 3;          // le zampe appoggiate sul bordo alto
        // la coda: meta' bassa del tasto
        eq.style.left = r.left + 'px';
        eq.style.top = (r.top + r.height * 0.5) + 'px';
        eq.style.width = r.width + 'px';
        eq.style.height = (r.height * 0.5) + 'px';
      }
    }
    if (!S.posato) { S.tx = S.mx + OFF_X; S.ty = S.my + OFF_Y; }

    // molla: insegue senza rimbalzare
    const k = S.posato ? 0.22 : 0.14, smorzo = S.posato ? 0.62 : 0.76;
    S.vx = (S.vx + (S.tx - S.x) * k * dt) * smorzo;
    S.vy = (S.vy + (S.ty - S.y) * k * dt) * smorzo;
    S.x += S.vx * dt; S.y += S.vy * dt;

    const vel = Math.hypot(S.vx, S.vy);
    const rotVoluta = S.posato ? 0 : Math.max(-18, Math.min(18, S.vx * 1.1));
    S.rot += (rotVoluta - S.rot) * 0.18 * dt;
    el.style.transform = 'translate3d(' + (S.x - LARG / 2) + 'px,' + (S.y - ALT * PIEDI) + 'px,0) rotate(' + S.rot.toFixed(2) + 'deg)';

    // ali: battono forte quando corre, quasi ferme quando e' posato
    S.flap += (S.posato ? 0.05 : 0.17 + Math.min(0.3, vel * 0.02)) * dt;
    const batti = Math.sin(S.flap);
    const apri = S.posato ? 2 + batti * 2 : 14 + batti * 28;
    wf.style.transform = 'rotate(' + apri + 'deg)';
    wb.style.transform = 'rotate(' + (-apri * 0.8) + 'deg)';

    // occhi: guardano sempre il cursore
    const dx = Math.max(-1, Math.min(1, (S.mx - S.x) / 240));
    const dy = Math.max(-1, Math.min(1, (S.my - S.y) / 240));
    iris.setAttribute('cx', (63 + dx * 2.2).toFixed(2));
    iris.setAttribute('cy', (34 + dy * 1.8).toFixed(2));

    // coda-equalizzatore: barre a ventaglio, come nell'originale
    if (S.posato) {
      spettro(ora);
      for (let i = 0; i < NBARRE; i++) {
        const ang = (i - (NBARRE - 1) / 2) * 11;
        const lung = 0.34 + dati[i] * 0.95;
        barre[i].style.transform = 'rotate(' + ang + 'deg) scaleY(' + lung.toFixed(3) + ')';
      }
    }

    requestAnimationFrame(giro);
  }
  requestAnimationFrame(giro);
})();
