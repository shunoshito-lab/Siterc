/* ============================================================
   RADIO CARDUCCI — L'ANGOLINO (Emergenza Emergenti / Cose da Nerd)
   Due programmi, due colori: rosso RC per gli emergenti, viola per i nerd.
   Puntate dal feed su R2, canovacci dai PDF in assets/canovacci/.
   Quando una puntata suona, tutto si muove a tempo: onde dietro al titolo,
   barre sulla puntata in riproduzione, titolo che pulsa sulla cassa.
   ============================================================ */
(function () {
  'use strict';

  const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PROG = {
    'emergenza-emergenti': {
      nome: 'emergenza <em>emergenti.</em>',
      desc: "Gli artisti che nessuno conosce ancora. Intervistati qui, con le loro canzoni. Premi play: tutto quello che vedi si muove con la musica.",
      feed: 'emergenza-emergenti'
    },
    'cose-da-nerd': {
      nome: 'cose da <em>nerd.</em>',
      desc: 'Demoscene, anime, videogiochi, internet vecchia. Le puntate e i canovacci di quello che abbiamo raccontato.',
      feed: 'cose-da-nerd'
    }
  };
  const R2 = 'https://pub-7bdb71d3a8a643899d66d0b611b8b049.r2.dev';

  let root, stage, canvas, titleEl, descEl, epsEl, docsEl, tabs;
  let prog = 'emergenza-emergenti';
  const cache = {};
  let canovacci = [];
  let audio = null, playing = null, raf = null;
  // livello del suono: con l'analyser è vero, altrimenti un finto battito
  let an = null, data = null, ctx = null;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function dataIt(s) {
    const d = new Date(s);
    if (isNaN(d)) return '';
    const mesi = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
    return d.getDate() + ' ' + mesi[d.getMonth()] + ' ' + d.getFullYear();
  }

  function durata(sec) {
    if (!sec) return '';
    const m = Math.round(sec / 60);
    return m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + "'" : m + " min";
  }

  // ── Puntate dal feed RSS ──
  async function puntate(slug) {
    if (cache[slug]) return cache[slug];
    try {
      const r = await fetch(`${R2}/${slug}/feed.xml`, { cache: 'no-store' });
      if (!r.ok) throw new Error(r.status);
      const xml = new DOMParser().parseFromString(await r.text(), 'text/xml');
      const list = Array.from(xml.querySelectorAll('item')).map(it => {
        const g = t => (it.querySelector(t) || {}).textContent || '';
        const enc = it.querySelector('enclosure');
        const dur = g('duration').split(':').reduce((a, b) => a * 60 + (+b || 0), 0);
        return { titolo: g('title'), data: g('pubDate'), audio: enc ? enc.getAttribute('url') : '', durata: dur,
          desc: g('description').replace(/<[^>]*>/g, '').trim() };
      }).filter(e => e.audio);
      cache[slug] = list;
      return list;
    } catch (e) {
      cache[slug] = [];
      return [];
    }
  }

  async function indiceCanovacci() {
    if (canovacci.length) return canovacci;
    try {
      const r = await fetch('assets/canovacci/indice.json', { cache: 'no-store' });
      canovacci = r.ok ? ((await r.json()).canovacci || []) : [];
    } catch (e) { canovacci = []; }
    return canovacci;
  }

  // ── Audio delle puntate: uno alla volta, con analyser ──
  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio();
    audio.preload = 'none';
    audio.crossOrigin = 'anonymous';
    audio.addEventListener('ended', () => setPlaying(null));
    audio.addEventListener('pause', () => { if (!audio.ended) setPlaying(playing, false); });
    return audio;
  }

  function connectAnalyser() {
    if (an || !window.RCSamples) return;
    const c = RCSamples.ctx && RCSamples.ctx();
    if (!c || c.state !== 'running') return;
    try {
      const src = c.createMediaElementSource(audio);
      an = c.createAnalyser();
      an.fftSize = 512;
      an.smoothingTimeConstant = 0.75;
      src.connect(an);
      an.connect(c.destination);
      data = new Uint8Array(an.frequencyBinCount);
      ctx = c;
    } catch (e) { an = null; }
  }

  function livelli(t) {
    if (an) {
      an.getByteFrequencyData(data);
      let sum = 0, bass = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      for (let i = 1; i < 12; i++) bass += data[i];
      return { lv: Math.min(1, Math.sqrt(sum / data.length) / 255 * 1.8), bs: Math.min(1, bass / (11 * 255)) };
    }
    // niente analyser (telefoni, iOS): battito finto a 100 bpm
    const b = Math.max(0, Math.sin(t * Math.PI * 2 * (100 / 60)));
    return { lv: 0.35 + b * 0.3, bs: b * 0.8 };
  }

  function setPlaying(ep, start) {
    const was = playing;
    if (ep && start !== false) {
      ensureAudio();
      if (!was || was.audio !== ep.audio) { audio.src = ep.audio; audio.currentTime = 0; }
      document.querySelectorAll('audio').forEach(a => { if (a !== audio) a.pause(); });
      audio.play().then(connectAnalyser).catch(() => {});
      playing = ep;
    } else {
      if (audio) audio.pause();
      if (start !== false) playing = null;
    }
    root.classList.toggle('angolo--live', !!playing && audio && !audio.paused);
    renderEps();
    loop(!!playing && audio && !audio.paused);
  }

  // ── Disegno reattivo ──
  function loop(on) {
    cancelAnimationFrame(raf);
    if (!on || REDUCED) {
      root.style.removeProperty('--beat');
      const c2 = canvas.getContext('2d');
      c2.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const c2 = canvas.getContext('2d');
    const t0 = performance.now();
    const draw = now => {
      const t = (now - t0) / 1000;
      const { lv, bs } = livelli(t);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
      c2.setTransform(dpr, 0, 0, dpr, 0, 0);
      c2.clearRect(0, 0, w, h);
      const col = getComputedStyle(root).getPropertyValue('--prog-c').trim() || '#db3849';
      // tre onde che si inseguono, ampiezza sul volume
      for (let k = 0; k < 3; k++) {
        c2.beginPath();
        c2.strokeStyle = col;
        c2.globalAlpha = 0.5 - k * 0.14;
        c2.lineWidth = k === 0 ? 2 : 1;
        const amp = (12 + lv * 70) * (1 - k * 0.22);
        for (let x = 0; x <= w; x += 6) {
          const y = h / 2 + Math.sin(x * 0.012 + t * (2.2 + k * 0.5)) * amp * Math.sin(x / w * Math.PI);
          x === 0 ? c2.moveTo(x, y) : c2.lineTo(x, y);
        }
        c2.stroke();
      }
      c2.globalAlpha = 1;
      // la cassa fa pulsare titolo e barre (variabile CSS)
      root.style.setProperty('--beat', (1 + bs * 0.05).toFixed(3));
      root.style.setProperty('--lv', lv.toFixed(3));
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
  }

  // ── Liste ──
  function renderEps() {
    const list = cache[PROG[prog].feed] || [];
    if (!list.length) {
      epsEl.innerHTML = `<li class="angolo__empty">Le puntate di questo programma non sono ancora on line.</li>`;
      return;
    }
    epsEl.innerHTML = list.map((e, i) => {
      const on = playing && playing.audio === e.audio && audio && !audio.paused;
      return `<li class="angolo__ep${on ? ' angolo__ep--on' : ''}">
        <button class="angolo__play" type="button" data-i="${i}" aria-label="${on ? 'Metti in pausa' : 'Ascolta'} ${esc(e.titolo)}">
          <span class="angolo__bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        </button>
        <div class="angolo__ep-body">
          <div class="angolo__ep-title">${esc(e.titolo)}</div>
          <div class="angolo__ep-meta">${esc(dataIt(e.data))}${e.durata ? ' · ' + durata(e.durata) : ''}</div>
        </div>
      </li>`;
    }).join('');
    epsEl.querySelectorAll('.angolo__play').forEach(b => b.addEventListener('click', () => {
      const ep = list[+b.dataset.i];
      const on = playing && playing.audio === ep.audio && audio && !audio.paused;
      setPlaying(on ? null : ep, !on);
    }));
  }

  function renderDocs() {
    const list = canovacci.filter(c => c.programma === prog);
    if (!list.length) {
      docsEl.innerHTML = `<li class="angolo__empty">Nessun canovaccio pubblicato per ora.</li>`;
      return;
    }
    docsEl.innerHTML = list.map(c => `<li class="angolo__doc">
      <a href="assets/canovacci/${encodeURIComponent(c.file)}" target="_blank" rel="noopener">
        <span class="angolo__doc-title">${esc(c.titolo)}</span>
        <span class="angolo__doc-meta">${esc(dataIt(c.data))}${c.ospite ? ' · ospite ' + esc(c.ospite) : ''}${c.conduzione ? ' · ' + esc(c.conduzione) : ''}</span>
        ${c.talk && c.talk.length ? `<span class="angolo__doc-talk">${c.talk.map(t => `<i>${esc(t)}</i>`).join('')}</span>` : ''}
        <span class="angolo__doc-open">APRI IL PDF →</span>
      </a></li>`).join('');
  }

  async function show(id) {
    prog = id;
    root.dataset.prog = id;
    tabs.forEach(t => {
      const on = t.dataset.prog === id;
      t.classList.toggle('angolo__tab--active', on);
      t.setAttribute('aria-selected', String(on));
    });
    titleEl.innerHTML = PROG[id].nome;
    descEl.textContent = PROG[id].desc;
    if (window.RCMega) titleEl.textContent = titleEl.textContent; // gli accenti li sistema rc-moliga.js
    epsEl.innerHTML = `<li class="angolo__empty">Caricamento puntate...</li>`;
    stage.classList.remove('angolo__stage--cut');
    void stage.offsetWidth;
    stage.classList.add('angolo__stage--cut');
    renderDocs();
    await puntate(PROG[id].feed);
    if (prog === id) renderEps();
  }

  function init() {
    root = document.querySelector('#angolo .angolo');
    if (!root) return;
    stage = root.querySelector('.angolo__stage');
    canvas = root.querySelector('.angolo__viz');
    titleEl = root.querySelector('.angolo__title');
    descEl = root.querySelector('.angolo__desc');
    epsEl = root.querySelector('#angolo-eps');
    docsEl = root.querySelector('#angolo-docs');
    tabs = Array.from(root.querySelectorAll('.angolo__tab'));
    tabs.forEach(t => t.addEventListener('click', () => show(t.dataset.prog)));
    indiceCanovacci().then(() => { renderDocs(); });
    show(prog);
  }

  window.RCAngolo = { get playing() { return playing; }, setPlaying };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
