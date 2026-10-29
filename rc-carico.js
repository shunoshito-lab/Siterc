/* ============================================================
   RADIO CARDUCCI — LA BARCA DEL CARICAMENTO
   Quando qualcosa si carica, esce un rimorchiatore che becheggia
   sulle onde e una frase di mare. Disegnata a mano sui colori
   del marchio: il modello 3D che ci siamo passati e' servito
   solo come riferimento di forma.
   API:  RCCarico.apri()  .progresso(0..1)  .chiudi()
   ============================================================ */
(function () {
  'use strict';

  const FRASI = [
    "STIAMO CAVALCANDO L'ONDA PER TE",
    'IL MARE E’ MOSSO, IL SEGNALE NO',
    'TENIAMO LA ROTTA',
    'ANCORA DUE BRACCIATE',
    'IL VENTO GIRA A NOSTRO FAVORE',
    'STIAMO TIRANDO SU LE RETI',
    'ROTTA SU RADIO CARDUCCI',
    'ONDE CORTE, PAZIENZA LUNGA',
    'IL FARO E’ GIA’ IN VISTA',
    'SI SALPA',
    'STIAMO SINTONIZZANDO LA RISACCA',
    'UN’ULTIMA ONDA E SIAMO A RIVA'
  ];

  const SVG = `
<svg class="crc__scena" viewBox="0 0 320 150" aria-hidden="true" focusable="false">
  <g class="crc__barca">
    <!-- fumo -->
    <circle class="crc__fumo" cx="150" cy="40" r="5" fill="#f4f4f5" opacity="0.5"/>
    <circle class="crc__fumo crc__fumo--2" cx="150" cy="40" r="4" fill="#f4f4f5" opacity="0.35"/>
    <!-- ciminiera -->
    <path fill="#db3849" d="M142 38 h16 v22 h-16 Z"/>
    <path fill="#f4f4f5" d="M142 44 h16 v6 h-16 Z"/>
    <!-- cabina -->
    <path fill="#f4f4f5" d="M120 58 h44 v22 h-44 Z"/>
    <path fill="#1e1e1e" d="M126 64 h10 v9 h-10 Z"/>
    <path fill="#1e1e1e" d="M142 64 h10 v9 h-10 Z"/>
    <!-- scafo -->
    <path fill="#db3849" d="M96 80 h96 l-12 24 h-72 Z"/>
    <path fill="#991c3b" d="M96 80 h96 l-3 6 h-90 Z"/>
    <!-- parabordi -->
    <circle cx="104" cy="90" r="3" fill="#1e1e1e"/>
    <circle cx="184" cy="90" r="3" fill="#1e1e1e"/>
  </g>
  <!-- onde: tre strati che scorrono -->
  <g class="crc__mare">
    <path class="crc__onda crc__onda--3" fill="#991c3b" d="M0 112 q20 -8 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 v50 H0 Z"/>
    <path class="crc__onda crc__onda--2" fill="#db3849" d="M0 120 q20 -8 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 v50 H0 Z"/>
    <path class="crc__onda crc__onda--1" fill="#f4f4f5" d="M0 130 q20 -7 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 v40 H0 Z"/>
  </g>
</svg>`;

  let el = null, barra = null, testo = null, aperto = false, iFrase = 0, timer = 0;

  function costruisci() {
    if (el) return;
    el = document.createElement('div');
    el.className = 'crc';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = SVG +
      '<p class="crc__frase"></p>' +
      '<div class="crc__barra"><i></i></div>';
    document.body.appendChild(el);
    testo = el.querySelector('.crc__frase');
    barra = el.querySelector('.crc__barra i');
  }

  const RCCarico = window.RCCarico = {
    apri(frase) {
      costruisci();
      aperto = true;
      iFrase = Math.floor(Math.random() * FRASI.length);
      testo.textContent = frase || FRASI[iFrase];
      barra.style.transform = 'scaleX(0)';
      el.classList.add('crc--on');
      clearInterval(timer);
      // una frase nuova ogni tre secondi: l'attesa si fa piu' corta
      if (!frase) timer = setInterval(() => {
        iFrase = (iFrase + 1) % FRASI.length;
        testo.style.opacity = '0';
        setTimeout(() => { testo.textContent = FRASI[iFrase]; testo.style.opacity = ''; }, 200);
      }, 3000);
      return this;
    },

    progresso(q) {
      if (!el) return this;
      const v = Math.max(0, Math.min(1, q || 0));
      barra.style.transform = 'scaleX(' + v.toFixed(3) + ')';
      return this;
    },

    chiudi() {
      if (!el || !aperto) return this;
      aperto = false;
      clearInterval(timer);
      barra.style.transform = 'scaleX(1)';
      setTimeout(() => el.classList.remove('crc--on'), 220);
      return this;
    },

    frasi: FRASI
  };
})();
