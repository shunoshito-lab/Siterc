/* ============================================================
   RADIO CARDUCCI — LA R (mascotte), SUONI, AUDIO REATTIVO
   Modulo a parte: si appoggia a site.js ma non lo modifica.
   - RCAudioReactive: legge il volume reale della diretta (solo desktop)
   - RCSfx: suonini sintetizzati per hover/click (niente file da scaricare)
   - RCMascotte: la R in basso a destra che guarda il mouse, balla con la
     musica e parla nel fumetto con una voce "a sillabe" sintetizzata
   - Scramble dei titoletti di sezione quando entrano in vista
   ============================================================ */
(function () {
  'use strict';

  const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DESKTOP = window.matchMedia && window.matchMedia('(min-width: 769px) and (hover: hover) and (pointer: fine)').matches;
  // iOS: far passare la diretta da Web Audio rompe la riproduzione a schermo bloccato.
  const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function store(key, val) {
    try {
      if (val === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, val);
    } catch (e) { return null; }
  }

  // ── Un solo AudioContext, sbloccato al primo gesto dell'utente ──
  let ctx = null;
  function getCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    return ctx;
  }
  function unlock() {
    const c = getCtx();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
  }
  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, unlock, { passive: true }));

  function anyAudioPlaying() {
    return Array.from(document.querySelectorAll('audio')).some(a => !a.paused) ||
      (typeof BgMusic !== 'undefined' && BgMusic.isPlaying);
  }

  // ═══════════════════════════════════════════════════════════════
  // AUDIO REATTIVO — volume reale della diretta
  // ═══════════════════════════════════════════════════════════════
  const RCAudioReactive = window.RCAudioReactive = {
    enabled: false,   // true quando l'analyser è collegato
    level: 0,         // 0..1, volume complessivo smussato
    bass: 0,          // 0..1, bassi smussati (per i "salti")
    db: -60,
    _analyser: null,
    _data: null,
    _raf: null,

    init() {
      const audio = document.getElementById('rc-audio');
      if (!audio || IOS || !DESKTOP) return;
      audio.addEventListener('play', () => this._connect(audio));
      audio.addEventListener('playing', () => this._start());
      audio.addEventListener('pause', () => this._stop());
    },

    _connect(audio) {
      if (this.enabled) return;
      const c = getCtx();
      // Se il contesto non è attivo, collegarlo renderebbe muta la diretta: meglio niente.
      if (!c || c.state !== 'running') return;
      try {
        const src = c.createMediaElementSource(audio);
        const an = c.createAnalyser();
        an.fftSize = 512;
        an.smoothingTimeConstant = 0.75;
        src.connect(an);
        an.connect(c.destination);
        this._analyser = an;
        this._data = new Uint8Array(an.frequencyBinCount);
        this.enabled = true;
      } catch (e) {
        this.enabled = false;
      }
    },

    _start() {
      if (!this.enabled || this._raf) return;
      const tick = () => {
        const d = this._data;
        this._analyser.getByteFrequencyData(d);
        let sum = 0, bass = 0;
        for (let i = 0; i < d.length; i++) sum += d[i] * d[i];
        for (let i = 1; i < 12; i++) bass += d[i];
        const rms = Math.sqrt(sum / d.length) / 255;
        this.level += (Math.min(1, rms * 1.8) - this.level) * 0.2;
        this.bass += (Math.min(1, bass / (11 * 255)) - this.bass) * 0.35;
        this.db = rms > 0 ? Math.max(-60, 20 * Math.log10(rms)) : -60;
        this._raf = requestAnimationFrame(tick);
      };
      this._raf = requestAnimationFrame(tick);
    },

    _stop() {
      cancelAnimationFrame(this._raf);
      this._raf = null;
      this.level = 0;
      this.bass = 0;
      this.db = -60;
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // SUONI UI — sintetizzati, zitti quando sta suonando qualcosa
  // ═══════════════════════════════════════════════════════════════
  const RCSfx = window.RCSfx = {
    muted: store('rc_sounds_muted') === 'true',

    setMuted(m) {
      this.muted = m;
      store('rc_sounds_muted', String(m));
      document.dispatchEvent(new CustomEvent('rc:sounds', { detail: { muted: m } }));
    },

    _ok() {
      const c = ctx;
      return !this.muted && c && c.state === 'running' && !anyAudioPlaying();
    },

    _blip(freq, dur, vol, type, freqEnd) {
      const c = ctx;
      const t = c.currentTime;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(c.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    },

    hover() { if (this._ok()) this._blip(1900 + Math.random() * 300, 0.03, 0.018, 'sine'); },
    click() { if (this._ok()) this._blip(520, 0.07, 0.05, 'triangle', 980); },
    pop()   { if (this._ok()) this._blip(300, 0.12, 0.05, 'sine', 900); },

    init() {
      if (!DESKTOP) return;
      const SEL = '.btn, .nav-links a, .nav__explore, .player-bar__play, .rc-mascot__body, button';
      let last = null;
      document.addEventListener('mouseover', e => {
        const el = e.target.closest && e.target.closest(SEL);
        if (el && el !== last) this.hover();
        last = el;
      });
      document.addEventListener('click', e => {
        if (e.target.closest && e.target.closest(SEL)) this.click();
      });
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // VOCE A SILLABE — ogni lettera è un "bip" con la formante della vocale
  // ═══════════════════════════════════════════════════════════════
  const FORMANTS = { a: [800, 1200], e: [500, 1800], i: [320, 2300], o: [480, 900], u: [360, 800] };
  const VOICE_BASE = 260;

  function syllable(ch) {
    const c = ctx;
    const t = c.currentTime;
    const lower = ch.toLowerCase();
    const f = FORMANTS[lower] || FORMANTS['aeiou'[lower.charCodeAt(0) % 5]];
    const pitch = VOICE_BASE * (1 + ((lower.charCodeAt(0) * 7) % 13) / 40) * (ch === ch.toUpperCase() && ch !== lower ? 1.15 : 1);
    const dur = 0.06;

    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(pitch * 1.06, t);
    o.frequency.exponentialRampToValueAtTime(pitch, t + dur);

    const out = c.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.09, t + 0.008);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    f.forEach((freq, i) => {
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = freq;
      bp.Q.value = 6;
      const g = c.createGain();
      g.gain.value = i === 0 ? 1 : 0.5;
      o.connect(bp).connect(g).connect(out);
    });
    out.connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // ═══════════════════════════════════════════════════════════════
  // LA R
  // ═══════════════════════════════════════════════════════════════
  const LINES = {
    intro: [
      'Ciao! Sono la R di Radio Carducci. Se ti perdi, cliccami.',
      'Eccoti. Io sono la R, guardo tutto. Letteralmente.'
    ],
    '#palinsesto': ['Questo è il palinsesto. Quello in rosso è in onda adesso: non fare finta di non vederlo.'],
    '#podcast': ['I podcast: tutte le puntate che ti sei perso perché avevi la verifica.'],
    '#team': ['Questa è la redazione. Sì, dal vivo siamo ancora più belli.'],
    '#dediche': ['Vuoi dedicare una canzone a qualcuno? Coraggio, il nome lo puoi anche non mettere.'],
    '#preferiti': ['I brani più amati del Wrapped. Metti un cuore, che a noi fa piacere.'],
    '#manifesto': ['Chi siamo? Studenti, un microfono e decisamente troppe idee.'],
    live: ['Sei in diretta! Alza il volume e ballo anch\'io.', 'In onda! Senti come vibro?'],
    offline: ['La diretta sta dormendo. Intanto ci sono i podcast, eh.'],
    poke: [
      'Ehi, non si tocca!',
      'Clicca su "Ascolta ora" e vedi come ballo.',
      'Lo sapevi che il palinsesto si aggiorna da solo? Magia. Più o meno.',
      'Ho un occhio solo ma ci vedo benissimo.',
      'Scendi giù: ci sono podcast, team e dediche.',
      'Se mi clicchi ancora divento rossa. Ah no, lo sono già.'
    ]
  };

  // La R è la stessa del logo nella nav: la clono, così resta sempre identica.
  function buildRSvg() {
    const src = document.getElementById('nav-animated-logo');
    if (!src) return null;
    const svg = src.cloneNode(true);
    svg.removeAttribute('id');
    svg.removeAttribute('class');
    svg.removeAttribute('role');
    svg.setAttribute('aria-hidden', 'true');
    svg.querySelectorAll('defs').forEach(d => d.remove());
    const map = { hr: 'm-red', hw: 'm-white', hi: 'm-iris' };
    svg.querySelectorAll('[class]').forEach(n => n.setAttribute('class', map[n.getAttribute('class')] || ''));
    const iris = svg.querySelector('#nav-animated-iris');
    if (iris) { iris.removeAttribute('id'); iris.classList.add('rc-mascot__iris'); }
    return svg;
  }

  const RCMascotte = window.RCMascotte = {
    el: null, body: null, bubble: null, text: null, iris: null, soundBtn: null,
    busy: false, lastSaid: 0, queue: [], seen: new Set(),

    init() {
      if (!DESKTOP || store('rc_mascot_hidden') === 'true') return;
      if (!this._build()) return;
      this._eyes();
      this._dance();
      this._sections();
      this._radioEvents();

      // Il primo saluto aspetta che il tutorial sia finito (o assente).
      const greet = () => {
        if (document.querySelector('.tutorial-overlay')) return setTimeout(greet, 1500);
        if (sessionStorage.getItem('rc_mascot_greeted')) return;
        try { sessionStorage.setItem('rc_mascot_greeted', '1'); } catch (e) {}
        this.say(pick(LINES.intro));
      };
      setTimeout(greet, 2500);
    },

    _build() {
      const svg = buildRSvg();
      if (!svg) return false;
      const el = document.createElement('div');
      el.className = 'rc-mascot';
      el.innerHTML = `
        <div class="rc-mascot__bubble" role="status" aria-live="polite" hidden>
          <span class="rc-mascot__name">LA R</span>
          <p class="rc-mascot__text"></p>
          <button class="rc-mascot__close" type="button" aria-label="Chiudi il fumetto">×</button>
        </div>
        <button class="rc-mascot__body" type="button" aria-label="La R di Radio Carducci: cliccala per un consiglio">
          <span class="rc-mascot__shadow" aria-hidden="true"></span>
        </button>
        <div class="rc-mascot__tools">
          <button class="rc-mascot__tool rc-mascot__sound" type="button"></button>
          <button class="rc-mascot__tool rc-mascot__hide" type="button" aria-label="Nascondi la R" title="Nascondi la R">${ICON_HIDE}</button>
        </div>`;
      el.querySelector('.rc-mascot__body').prepend(svg);
      document.body.appendChild(el);

      this.el = el;
      this.body = el.querySelector('.rc-mascot__body');
      this.bubble = el.querySelector('.rc-mascot__bubble');
      this.text = el.querySelector('.rc-mascot__text');
      this.iris = el.querySelector('.rc-mascot__iris');
      this.soundBtn = el.querySelector('.rc-mascot__sound');
      this._syncSoundBtn();

      this.body.addEventListener('click', () => {
        this.el.classList.remove('rc-mascot--poked');
        void this.el.offsetWidth;
        this.el.classList.add('rc-mascot--poked');
        RCSfx.pop();
        this.say(pick(LINES.poke), true);
      });
      el.querySelector('.rc-mascot__close').addEventListener('click', () => this.hideBubble());
      this.soundBtn.addEventListener('click', () => RCSfx.setMuted(!RCSfx.muted));
      document.addEventListener('rc:sounds', () => this._syncSoundBtn());
      el.querySelector('.rc-mascot__hide').addEventListener('click', () => {
        store('rc_mascot_hidden', 'true');
        el.remove();
      });
      return true;
    },

    _syncSoundBtn() {
      const m = RCSfx.muted;
      this.soundBtn.innerHTML = m ? ICON_MUTED : ICON_SOUND;
      this.soundBtn.setAttribute('aria-label', m ? 'Attiva i suoni del sito' : 'Disattiva i suoni del sito');
      this.soundBtn.title = m ? 'Suoni spenti' : 'Suoni accesi';
    },

    // ── Fumetto con testo lettera per lettera e voce ──
    say(line, force) {
      if (!this.el) return;
      const now = Date.now();
      if (this.busy) { if (!this.queue.includes(line)) this.queue.push(line); return; }
      if (!force && now - this.lastSaid < 6000) { this.queue.push(line); setTimeout(() => this._next(), 6000); return; }
      this.busy = true;
      this.lastSaid = now;
      clearTimeout(this._hideT);
      this.bubble.hidden = false;
      requestAnimationFrame(() => this.bubble.classList.add('rc-mascot__bubble--open'));
      this.text.setAttribute('aria-label', line);

      if (REDUCED) {
        this.text.textContent = line;
        this._done();
        return;
      }

      this.text.textContent = '';
      this.el.classList.add('rc-mascot--talking');
      let i = 0;
      const voiceOn = () => !RCSfx.muted && ctx && ctx.state === 'running' && !anyAudioPlaying();
      const step = () => {
        if (i >= line.length) { this._done(); return; }
        const ch = line[i++];
        this.text.textContent += ch;
        if (/[a-zà-ù]/i.test(ch) && i % 2 === 0 && voiceOn()) syllable(ch);
        setTimeout(step, /[.,!?:]/.test(ch) ? 190 : 34);
      };
      step();
    },

    _done() {
      this.el.classList.remove('rc-mascot--talking');
      clearTimeout(this._hideT);
      this._hideT = setTimeout(() => this.hideBubble(), 7000);
      this.busy = false;
    },

    _next() {
      if (!this.busy && this.queue.length) this.say(this.queue.shift(), true);
    },

    hideBubble() {
      this.bubble.classList.remove('rc-mascot__bubble--open');
      setTimeout(() => {
        if (!this.bubble.classList.contains('rc-mascot__bubble--open')) this.bubble.hidden = true;
        this._next();
      }, 300);
    },

    // ── Occhio che segue il mouse + battito di ciglia (come il logo della nav) ──
    _eyes() {
      const iris = this.iris, svg = this.body.querySelector('svg');
      const EX = 84.9, EY = 13.5, MX = 2.5, MY = 1.8;
      let tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
      const tick = () => {
        cx += (tx - cx) * 0.14; cy += (ty - cy) * 0.14;
        iris.setAttribute('cx', EX + cx); iris.setAttribute('cy', EY + cy);
        raf = (Math.abs(cx - tx) > 0.004 || Math.abs(cy - ty) > 0.004) ? requestAnimationFrame(tick) : null;
      };
      document.addEventListener('mousemove', e => {
        const r = svg.getBoundingClientRect();
        const dx = e.clientX - (r.left + EX * r.width / 101.34);
        const dy = e.clientY - (r.top + EY * r.height / 93.08);
        const f = Math.min(Math.hypot(dx, dy) / 400, 1), a = Math.atan2(dy, dx);
        tx = Math.cos(a) * MX * f; ty = Math.sin(a) * MY * f;
        if (!raf) raf = requestAnimationFrame(tick);
      });
      const blink = () => {
        iris.setAttribute('ry', '0.35');
        setTimeout(() => iris.setAttribute('ry', '4.2'), 110);
        setTimeout(blink, 2500 + Math.random() * 4500);
      };
      setTimeout(blink, 1800);
    },

    // ── Balla: con l'analyser usa i bassi veri, altrimenti un ritmo finto quando suona ──
    _dance() {
      if (REDUCED) return;
      const svg = this.body.querySelector('svg');
      const shadow = this.body.querySelector('.rc-mascot__shadow');
      let t = 0, hop = 0, vel = 0;
      const loop = () => {
        const audio = document.getElementById('rc-audio');
        const playing = anyAudioPlaying();
        t += 1 / 60;
        let target = 0;
        if (playing) {
          target = RCAudioReactive.enabled
            ? RCAudioReactive.bass
            : Math.max(0, Math.sin(t * Math.PI * 2 * (118 / 60))) * 0.55; // ~118 bpm finti
        }
        // Molla smorzata: salta e torna giù con un po' di rimbalzo
        vel += (target - hop) * 0.25;
        vel *= 0.72;
        hop += vel;
        const lift = hop * 14;
        const squash = 1 + hop * 0.08;
        const tilt = playing ? Math.sin(t * 3.1) * 4 : Math.sin(t * 1.3) * 1.5;
        svg.style.transform = `translateY(${-lift}px) rotate(${tilt}deg) scale(${1 / squash}, ${squash})`;
        shadow.style.transform = `translateX(-50%) scale(${1 - hop * 0.3})`;
        shadow.style.opacity = String(0.45 - hop * 0.2);
        this.el.classList.toggle('rc-mascot--dancing', playing);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    },

    // ── Commento la prima volta che entri in una sezione ──
    _sections() {
      const io = new IntersectionObserver(entries => {
        entries.forEach(en => {
          const key = '#' + en.target.id;
          if (!en.isIntersecting || this.seen.has(key)) return;
          if (getComputedStyle(en.target).display === 'none') return;
          this.seen.add(key);
          io.unobserve(en.target);
          if (document.querySelector('.tutorial-overlay')) return;
          this.say(pick(LINES[key]));
        });
      }, { threshold: 0.35 });
      Object.keys(LINES).filter(k => k[0] === '#').forEach(sel => {
        const s = document.querySelector(sel);
        if (s) io.observe(s);
      });
    },

    _radioEvents() {
      const audio = document.getElementById('rc-audio');
      if (!audio) return;
      let saidLive = false;
      audio.addEventListener('playing', () => {
        if (saidLive) return;
        saidLive = true;
        this.say(pick(LINES.live), true);
      });
      audio.addEventListener('error', () => {
        if (audio.getAttribute('src')) this.say(pick(LINES.offline), true);
      });
    }
  };

  const ICON = d => `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICON_SOUND = ICON('<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/>');
  const ICON_MUTED = ICON('<path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/>');
  const ICON_HIDE = ICON('<path d="m7 7 10 10"/><path d="M17 7v10H7"/>');

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // ═══════════════════════════════════════════════════════════════
  // SCRAMBLE dei titoletti (BACHECA · AVVISI, ecc.) quando entrano in vista
  // ═══════════════════════════════════════════════════════════════
  function initScramble() {
    if (REDUCED) return;
    const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/·#*+';
    const targets = document.querySelectorAll('.section-label > span:first-child');
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        scramble(en.target);
      });
    }, { threshold: 0.6 });
    targets.forEach(t => io.observe(t));

    function scramble(el) {
      const final = el.textContent;
      el.setAttribute('aria-label', final);
      const start = performance.now(), DUR = 700;
      const frame = now => {
        const p = Math.min(1, (now - start) / DUR);
        const fixed = Math.floor(p * final.length);
        let out = final.slice(0, fixed);
        for (let i = fixed; i < final.length; i++) {
          out += final[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
        el.textContent = out;
        if (p < 1) requestAnimationFrame(frame);
        else { el.textContent = final; el.removeAttribute('aria-label'); }
      };
      requestAnimationFrame(frame);
    }
  }

  function boot() {
    RCAudioReactive.init();
    RCSfx.init();
    RCMascotte.init();
    initScramble();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
