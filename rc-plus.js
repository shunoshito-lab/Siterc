/* ============================================================
   RADIO CARDUCCI — STUDI, BUMPER, REVEAL
   - Studi: due foto con punti cliccabili; la R racconta cosa c'è
   - Bumper: frasi secche stile Adult Swim tra una sezione e l'altra
   - [data-rise]: titoli che salgono parola per parola, a taglio secco
   ============================================================ */
(function () {
  'use strict';

  const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function onVisible(el, cb, threshold) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        cb(en.target);
      });
    }, { threshold: threshold || 0.4 });
    io.observe(el);
  }

  // ═══════════════════════════════════════════════════════════════
  // STUDI
  // ═══════════════════════════════════════════════════════════════
  function initStudi() {
    const root = document.querySelector('#studi .studi');
    if (!root) return;
    const stage = root.querySelector('.studi__stage');
    const badge = root.querySelector('.studi__badge');
    const caption = root.querySelector('.studi__caption');
    const tabs = root.querySelectorAll('.studi__tab');
    const rooms = root.querySelectorAll('.studi__room');
    const photos = root.querySelectorAll('.studi__photo');
    const BADGES = { regia: 'STUDIO 01 · ON AIR', redazione: 'STUDIO 02 · REDAZIONE' };
    let markers = [];

    function clearActive() {
      root.querySelectorAll('.studi__spot--active').forEach(b => b.classList.remove('studi__spot--active'));
      markers.forEach(m => m.classList.remove('studi__marker--active'));
      stage.classList.remove('studi__stage--focus');
      caption.textContent = '';
      caption.classList.remove('studi__caption--on');
    }

    function placeMarkers(room) {
      markers.forEach(m => m.remove());
      markers = [];
      room.querySelectorAll('.studi__spot').forEach((btn, i) => {
        const m = document.createElement('button');
        m.type = 'button';
        m.className = 'studi__marker';
        m.style.left = btn.dataset.x + '%';
        m.style.top = btn.dataset.y + '%';
        m.textContent = String(i + 1).padStart(2, '0');
        m.setAttribute('aria-label', btn.textContent);
        m.addEventListener('click', () => activate(btn, m));
        btn.addEventListener('click', () => activate(btn, m));
        stage.appendChild(m);
        markers.push(m);
      });
    }

    function activate(btn, marker) {
      const wasActive = btn.classList.contains('studi__spot--active');
      clearActive();
      if (wasActive) return;
      const text = btn.parentElement.querySelector('.studi__spot-text').textContent.trim();
      btn.classList.add('studi__spot--active');
      marker.classList.add('studi__marker--active');
      stage.classList.add('studi__stage--focus');
      caption.textContent = text;
      caption.classList.add('studi__caption--on');
      if (window.RCMascotte && RCMascotte.el) RCMascotte.say(text, true);
    }

    function show(id) {
      tabs.forEach(t => {
        const on = t.dataset.studio === id;
        t.classList.toggle('studi__tab--active', on);
        t.setAttribute('aria-selected', String(on));
      });
      rooms.forEach(r => { r.hidden = r.dataset.studio !== id; r.classList.toggle('studi__room--active', !r.hidden); });
      photos.forEach(p => p.classList.toggle('studi__photo--active', p.dataset.studio === id));
      badge.textContent = BADGES[id];
      stage.dataset.studio = id;
      clearActive();
      // taglio da regia: la foto nuova entra con una tendina secca
      stage.classList.remove('studi__stage--cut');
      void stage.offsetWidth;
      stage.classList.add('studi__stage--cut');
      placeMarkers(root.querySelector(`.studi__room[data-studio="${id}"]`));
    }

    tabs.forEach(t => {
      t.addEventListener('click', () => show(t.dataset.studio));
      t.addEventListener('keydown', e => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const other = Array.from(tabs).find(x => x !== t);
        other.focus();
        show(other.dataset.studio);
      });
    });
    root.classList.add('studi--js');
    placeMarkers(root.querySelector('.studi__room--active'));
  }

  // ═══════════════════════════════════════════════════════════════
  // BUMPER — copy bank dal README del brand
  // Ogni riga va a capo dove respira; *parola* = in rosso
  // ═══════════════════════════════════════════════════════════════
  const BUMPERS = [
    { t: 'sbagliamo,/in/*diretta.*', meta: 'WEB ONLY' },
    { t: 'tre minuti/di pubblicità./*zero*/pubblicità.', meta: 'WEB ONLY' },
    { t: 'niente/scaletta./un\'ora./*vediamo.*', meta: 'IN DIRETTA' },
    { t: 'non è una radio/scolastica./è una radio che capita/in una *scuola.*', meta: 'WEB ONLY' },
    { t: 'ci hanno detto/che facciamo/troppo rumore./*alziamo.*', meta: 'GRAZIE DEL FEEDBACK' },
    { t: 'non leggiamo/piatto./non lo sapremmo/*fare.*', meta: 'WEB ONLY' },
    { t: 'il microfono/è aperto./non è un invito./è un *avviso.*', meta: 'ON AIR' },
    { t: 'abbiamo provato/a fare le cose/per bene./*non funziona.*', meta: 'WEB ONLY' },
    { t: 'opinioni nette./ricevute buone./rimborsi *zero.*', meta: 'WEB ONLY' }
  ];

  function renderBumperText(el, src) {
    el.innerHTML = '';
    src.split('/').forEach(line => {
      const span = document.createElement('span');
      span.className = 'rc-bumper__line';
      span.innerHTML = mega(line)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>');
      el.appendChild(span);
    });
    return el.querySelectorAll('.rc-bumper__line');
  }

  function initBumpers() {
    document.querySelectorAll('.rc-bumper').forEach(b => {
      const txt = b.querySelector('.rc-bumper__txt');
      const num = b.querySelector('.rc-bumper__num');
      const meta = b.querySelector('.rc-bumper__meta');
      let idx = parseInt(b.dataset.bumperStart, 10) || 0;
      let timers = [];

      function play(animate) {
        timers.forEach(clearTimeout);
        timers = [];
        const item = BUMPERS[idx % BUMPERS.length];
        num.textContent = String((idx % BUMPERS.length) + 1).padStart(3, '0');
        meta.textContent = item.meta;
        const lines = renderBumperText(txt, item.t);
        txt.setAttribute('aria-label', item.t.replace(/\*/g, '').replace(/\//g, ' '));
        if (!animate || REDUCED) { lines.forEach(l => l.classList.add('rc-bumper__line--on')); return; }
        // Le righe arrivano a scatti, come i cartelli tra un programma e l'altro
        lines.forEach((l, i) => timers.push(setTimeout(() => l.classList.add('rc-bumper__line--on'), 160 + i * 220)));
      }

      play(false);
      b.classList.add('rc-bumper--ready');
      onVisible(b, () => play(true), 0.5);

      b.querySelector('.rc-bumper__next').addEventListener('click', () => {
        idx++;
        if (window.RCSamples) RCSamples.play('dropTheBeat', { vol: 0.55, gap: 1500 });
        b.classList.add('rc-bumper--blank');
        setTimeout(() => { b.classList.remove('rc-bumper--blank'); play(true); }, 140);
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // RISE — parola per parola, dal basso, con maschera
  // ═══════════════════════════════════════════════════════════════
  function initRise() {
    document.querySelectorAll('[data-rise]').forEach(el => {
      if (REDUCED) return;
      const label = el.textContent.trim();
      let n = 0;
      const wrap = node => {
        Array.from(node.childNodes).forEach(child => {
          if (child.nodeType === 3) {
            const frag = document.createDocumentFragment();
            child.textContent.split(/(\s+)/).forEach(part => {
              if (!part) return;
              if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
              const w = document.createElement('span');
              w.className = 'rise-w';
              const i = document.createElement('span');
              i.className = 'rise-i';
              i.style.transitionDelay = (n++ * 45) + 'ms';
              i.textContent = part;
              w.appendChild(i);
              frag.appendChild(w);
            });
            child.replaceWith(frag);
          } else if (child.nodeType === 1) {
            wrap(child);
          }
        });
      };
      wrap(el);
      el.setAttribute('aria-label', label);
      el.classList.add('rise--ready');
      onVisible(el, () => el.classList.add('rise--on'), 0.6);
    });
  }

  // Accenti in Moliga: ci pensa rc-moliga.js (qui serve solo per i bumper)
  const mega = str => (window.RCMega ? window.RCMega(str) : String(str));

  // ═══════════════════════════════════════════════════════════════
  // BADGE LIVE VIVI — con la diretta accesa: "IN DIRETTA ORA" e un
  // VU meter a 3 barre che segue il volume vero (RCAudioReactive)
  // ═══════════════════════════════════════════════════════════════
  function initLiveBadges() {
    const audio = document.getElementById('rc-audio');
    if (!audio) return;
    const badges = Array.from(document.querySelectorAll('.rc-live'))
      .filter(b => /^(LIVE|ON AIR)$/i.test(b.textContent.trim()) && !b.closest('.studi'));
    badges.forEach(b => {
      b.dataset.off = b.textContent.trim();
      b.innerHTML = `<span class="rc-live__vu" aria-hidden="true"><i></i><i></i><i></i></span><span class="rc-live__txt">${b.dataset.off}</span>`;
    });
    // anche dove manca la copertina: niente icone né loghi, un VU meter
    document.querySelectorAll('.player-bar__cover-placeholder, .np-overlay__cover-placeholder').forEach(ph => {
      ph.innerHTML = '<span class="rc-cover-vu" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
    });
    const bars = badges.map(b => Array.from(b.querySelectorAll('.rc-live__vu i')))
      .concat(Array.from(document.querySelectorAll('.rc-cover-vu')).map(v => Array.from(v.querySelectorAll('i'))));
    let raf = null, t = 0;
    const frame = () => {
      t += 1;
      const R = window.RCAudioReactive;
      const real = R && R.enabled;
      const lv = real ? R.level : 0.45 + Math.sin(t / 7) * 0.2;
      const bs = real ? R.bass : 0.5 + Math.sin(t / 4.3) * 0.3;
      const hs = [bs, lv * 1.2, (lv + bs) / 2 * 0.9 + (REDUCED ? 0 : Math.random() * 0.15), lv * 0.8 + bs * 0.3];
      bars.forEach(group => group.forEach((el, i) => { el.style.transform = `scaleY(${Math.max(0.15, Math.min(1, hs[i % 4]))})`; }));
      raf = requestAnimationFrame(frame);
    };
    const set = on => {
      document.body.classList.toggle('rc-on-air', on);
      badges.forEach(b => { b.querySelector('.rc-live__txt').textContent = on ? 'IN DIRETTA ORA' : b.dataset.off; });
      cancelAnimationFrame(raf);
      if (on && !REDUCED) raf = requestAnimationFrame(frame);
    };
    audio.addEventListener('playing', () => set(true));
    ['pause', 'ended', 'error'].forEach(ev => audio.addEventListener(ev, () => set(false)));
  }

  function boot() {
    initLiveBadges();
    initStudi();
    initBumpers();
    initRise();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
