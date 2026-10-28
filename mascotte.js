/* ============================================================
   RADIO CARDUCCI — LA R (mascotte), SUONI, AUDIO REATTIVO
   Modulo a parte: si appoggia a site.js ma non lo modifica.
   - RCAudioReactive: legge il volume reale della diretta (solo desktop)
   - RCSfx: suonini sintetizzati per hover/click (niente file da scaricare)
   - RCMascotte: la R in basso a destra. Occhio con saccadi e pupilla,
     balla con la musica, parla nel fumetto con voce "a sillabe",
     commenta il brano in onda e consiglia in base a preferiti e ascolti.
     Le frasi stanno in mascotte-frasi.js (caricato prima di questo file).
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
      if (val === null) localStorage.removeItem(key);
      else localStorage.setItem(key, val);
    } catch (e) { return null; }
  }

  // ── Un solo AudioContext, sbloccato al primo gesto dell'utente ──
  let ctx = null;
  function getCtx() {
    // stesso contesto audio dei campioni (rc-sfx.js), se c'è
    if (!ctx && window.RCSamples) ctx = RCSamples.ctx();
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
      // il clic sui pulsanti lo suona rc-sfx.js con i campioni dei tasti
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
    out.gain.exponentialRampToValueAtTime(0.025, t + 0.008);
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

  // La voce della R: il campione pixel-text, con il tono che cambia a ogni lettera.
  // Se il campione non è ancora caricato, si usa la voce sintetizzata.
  // Volume basso apposta: è un commento, non deve coprire la pagina
  const VOICE_VOL = 0.12;
  function speak(ch) {
    const code = ch.toLowerCase().charCodeAt(0);
    const vowel = 'aeiouàèéìòù'.includes(ch.toLowerCase());
    const rate = 0.86 + ((code * 7) % 13) / 30 + (vowel ? 0.06 : 0);
    if (window.RCSamples && RCSamples.ready('text') && RCSamples.play('text', { rate, vol: VOICE_VOL, gap: 0 })) return;
    syllable(ch);
  }

  // ═══════════════════════════════════════════════════════════════
  // FRASI — pesca senza ripetersi, riempie i segnaposto
  // ═══════════════════════════════════════════════════════════════
  const Frasi = {
    recent: [],

    _bank() { return window.RC_FRASI || {}; },

    _fill(s, vars) {
      return s.replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null && vars[k] !== '') ? vars[k] : m)
        .replace(/\s+/g, ' ').trim();
    },

    _ok(s) { return !/\{\w+\}/.test(s) && !this.recent.includes(s); },

    _remember(s) {
      this.recent.push(s);
      if (this.recent.length > 40) this.recent.shift();
    },

    // Una frase dal gruppo; i segnaposto mancanti scartano la frase
    get(group, vars) {
      const list = (this._bank()[group] || []).map(s => this._fill(s, vars)).filter(s => !/\{\w+\}/.test(s));
      if (!list.length) return null;
      const fresh = list.filter(s => !this.recent.includes(s));
      const s = pick(fresh.length ? fresh : list);
      this._remember(s);
      return s;
    },

    // Commento al cambio brano: apertura + corpo + chiusura (15 × 12 × 10 combinazioni)
    brano(vars) {
      const b = this._bank().brano;
      if (!b) return null;
      for (let i = 0; i < 12; i++) {
        const s = this._fill([pick(b.openers), pick(b.bodies), pick(b.closers)].join(' '), vars);
        if (this._ok(s)) { this._remember(s); return s; }
      }
      return null;
    },

    // Solo l'apertura ("parte {titolo}."): per i fumetti con invito, che devono restare corti
    opener(vars) {
      const b = this._bank().brano;
      if (!b) return null;
      const list = b.openers.map(o => this._fill(o, vars)).filter(o => !/\{\w+\}/.test(o));
      return list.length ? pick(list) : null;
    },

    countAll() {
      const bank = this._bank();
      let n = 0;
      Object.keys(bank).forEach(k => {
        if (Array.isArray(bank[k])) n += bank[k].length;
      });
      const b = bank.brano;
      if (b) n += b.openers.length * b.bodies.length * b.closers.length;
      return n;
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // ASCOLTI — cosa hai sentito qui (artisti e brani), in localStorage
  // RCAccount (rc-account.js) lo sincronizza col server quando sei loggato
  // ═══════════════════════════════════════════════════════════════
  const Ascolti = window.RCAscolti = {
    KEY: 'rc_listen_history',

    load() {
      try {
        const d = JSON.parse(store(this.KEY) || 'null');
        if (d && d.artists && d.tracks) return d;
      } catch (e) {}
      return { artists: {}, tracks: {}, updatedAt: 0 };
    },

    save(d) {
      d.updatedAt = Date.now();
      store(this.KEY, JSON.stringify(d));
      document.dispatchEvent(new CustomEvent('rc:history-updated'));
    },

    add(artist, title) {
      const d = this.load();
      const a = norm(artist), t = norm(artist + ' - ' + title);
      if (a) d.artists[a] = (d.artists[a] || 0) + 1;
      if (t) d.tracks[t] = (d.tracks[t] || 0) + 1;
      // Tiene solo i 300 brani più sentiti, per non riempire lo storage
      const keys = Object.keys(d.tracks);
      if (keys.length > 300) {
        keys.sort((x, y) => d.tracks[x] - d.tracks[y]).slice(0, keys.length - 300).forEach(k => delete d.tracks[k]);
      }
      this.save(d);
    },

    artistCount(artist) { return this.load().artists[norm(artist)] || 0; },
    trackCount(artist, title) { return this.load().tracks[norm(artist + ' - ' + title)] || 0; }
  };

  function likedTracks() {
    try { return JSON.parse(store('rc_liked_tracks') || '[]') || []; } catch (e) { return []; }
  }
  function isLiked(artist, title) {
    const t = norm(title), a = norm(artist);
    return likedTracks().some(x => norm(x.title) === t && (!a || norm(x.artist).includes(a) || a.includes(norm(x.artist))));
  }
  function likesArtist(artist) {
    const a = norm(artist);
    return !!a && likedTracks().some(x => norm(x.artist) === a);
  }
  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\(.*?\)|\[.*?\]/g, '').replace(/feat\..*$/, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Ritardo tra metadati e quello che si sente davvero (stream + buffer)
  function streamDelayMs() {
    const audio = document.getElementById('rc-audio');
    if (!audio || audio.paused) return 0;
    let buffer = 0;
    try {
      if (audio.buffered.length) buffer = Math.max(0, audio.buffered.end(audio.buffered.length - 1) - audio.currentTime);
    } catch (e) {}
    const np = window.NowPlaying;
    const base = (np && typeof np.streamLatencyMs === 'number') ? np.streamLatencyMs : 5000;
    return Math.min(20000, base + buffer * 1000);
  }
  window.RCStreamDelayMs = streamDelayMs;

  function liveIsPlaying() {
    const a = document.getElementById('rc-audio');
    return !!(a && !a.paused);
  }

  // ═══════════════════════════════════════════════════════════════
  // OCCHIO — saccadi, inseguimento lento, micro-movimenti, pupilla
  // Unità: quelle dell'SVG del logo (viewBox 101.34 × 93.08)
  // ═══════════════════════════════════════════════════════════════
  function createEye(svg, iris, opts) {
    const EX = 84.9, EY = 13.5;          // centro della sclera
    const MX = 4.6, MY = 3.0;            // escursione massima dell'iride
    const RX = 2.5, RY = 4.2;            // iride a riposo
    const state = {
      p: { x: 0, y: 0 }, v: { x: 0, y: 0 },   // posizione e velocità dell'iride
      goal: { x: 0, y: 0 },                   // dove sta guardando adesso
      want: { x: 0, y: 0 },                   // dove vorrebbe guardare
      mode: 'pursuit',
      saccadeAt: 0, nextMicro: 0, micro: { x: 0, y: 0 },
      blink: 1, blinkT: -1, nextBlink: performance.now() + 1500,
      dilate: 1, lean: 0,
      mouse: { x: -1, y: -1, t: 0, speed: 0 },
      override: null, overrideUntil: 0,
      wanderAt: 0, fps: 60, lagMs: 0
    };

    function eyeCenterPx() {
      const r = svg.getBoundingClientRect();
      return { x: r.left + EX * r.width / 101.34, y: r.top + EY * r.height / 93.08, w: r.width };
    }

    // Da un punto dello schermo alla posizione dell'iride (più lontano = più al bordo)
    function gazeFor(px, py) {
      const c = eyeCenterPx();
      const dx = px - c.x, dy = py - c.y;
      const d = Math.hypot(dx, dy);
      if (d < 1) return { x: 0, y: 0, d: 0 };
      const f = 1 - Math.exp(-d / 160);
      return { x: dx / d * MX * f, y: dy / d * MY * f, d };
    }

    let lastMoveT = 0, lastX = 0, lastY = 0;
    document.addEventListener('mousemove', e => {
      const now = performance.now();
      const dt = Math.max(1, now - lastMoveT);
      const sp = Math.hypot(e.clientX - lastX, e.clientY - lastY) / dt * 1000;
      state.mouse.speed = state.mouse.speed * 0.7 + sp * 0.3;
      lastX = e.clientX; lastY = e.clientY; lastMoveT = now;
      state.mouse.x = e.clientX; state.mouse.y = e.clientY; state.mouse.t = now;
    }, { passive: true });
    document.addEventListener('mouseleave', () => { state.mouse.t = performance.now() - 2500; });

    function blinkNow() { if (state.blinkT < 0) state.blinkT = 0; }

    function update(now, dt) {
      // 1. Cosa vuole guardare
      let target;
      const sinceMouse = now - state.mouse.t;
      if (state.override && now < state.overrideUntil) {
        target = gazeFor(state.override.x, state.override.y);
      } else if (state.mouse.x >= 0 && sinceMouse < 3500) {
        target = gazeFor(state.mouse.x, state.mouse.y);
      } else {
        // Fermo: si guarda in giro, ogni tanto guarda te (dritto)
        if (now > state.wanderAt) {
          state.wanderAt = now + 700 + Math.random() * 1800;
          state.wander = Math.random() < 0.3
            ? { x: 0, y: 0 }
            : { x: (Math.random() * 2 - 1) * MX * 0.8, y: (Math.random() * 2 - 1) * MY * 0.7 };
        }
        target = state.wander || { x: 0, y: 0 };
      }
      state.want.x = target.x; state.want.y = target.y;

      // 2. Saccade o inseguimento: salti netti se il bersaglio cambia molto o va veloce
      const jump = Math.hypot(state.want.x - state.goal.x, state.want.y - state.goal.y);
      const fast = state.mouse.speed > 900;
      if (jump > 0.9 || (fast && jump > 0.35)) {
        if (state.mode !== 'saccade-wait') {
          state.mode = 'saccade-wait';
          state.saccadeAt = now + 35 + Math.random() * 45; // latenza quasi umana, ma reattiva
          if (jump > 3.2 && Math.random() < 0.25) blinkNow(); // i salti grossi a volte fanno sbattere le palpebre
        }
      } else if (state.mode === 'pursuit') {
        state.goal.x = state.want.x; state.goal.y = state.want.y;
      }
      if (state.mode === 'saccade-wait' && now >= state.saccadeAt) {
        state.goal.x = state.want.x; state.goal.y = state.want.y;
        state.mode = 'saccade';
        state.saccadeStart = now;
      }
      if (state.mode === 'saccade' && now - state.saccadeStart > 90) state.mode = 'pursuit';

      // 3. Micro-saccadi e tremolio durante la fissazione
      if (now > state.nextMicro) {
        state.nextMicro = now + 350 + Math.random() * 900;
        state.micro = { x: (Math.random() * 2 - 1) * 0.22, y: (Math.random() * 2 - 1) * 0.18 };
      }
      const tremor = Math.sin(now / 37) * 0.03 + Math.sin(now / 53) * 0.03;

      // 4. Molla smorzata: rigida nelle saccadi, morbida nell'inseguimento
      const k = state.mode === 'saccade' ? 2600 : 900;
      const c = 2 * Math.sqrt(k) * (state.mode === 'saccade' ? 0.78 : 0.95);
      const s = dt / 1000;
      ['x', 'y'].forEach(ax => {
        const g = state.goal[ax] + state.micro[ax] + (ax === 'x' ? tremor : tremor * 0.7);
        const a = k * (g - state.p[ax]) - c * state.v[ax];
        state.v[ax] += a * s;
        state.p[ax] += state.v[ax] * s;
      });
      // dentro la sclera
      const ox = state.p.x / MX, oy = state.p.y / MY, o = Math.hypot(ox, oy);
      if (o > 1) { state.p.x /= o; state.p.y /= o; }

      // 5. Palpebre: casuali, a volte doppie
      if (state.blinkT < 0 && now > state.nextBlink) {
        blinkNow();
        state.nextBlink = now + 1800 + Math.random() * 4200;
        state.doubleBlink = Math.random() < 0.2;
      }
      if (state.blinkT >= 0) {
        state.blinkT += dt;
        const T = state.blinkT;
        state.blink = T < 60 ? 1 - T / 60 * 0.92 : T < 150 ? 0.08 + (T - 60) / 90 * 0.92 : 1;
        if (T >= 150) {
          state.blinkT = -1; state.blink = 1;
          if (state.doubleBlink) { state.doubleBlink = false; setTimeout(blinkNow, 110); }
        }
      }

      // 6. Pupilla: si allarga se il mouse è vicino o la musica è forte
      const near = state.mouse.x >= 0 && sinceMouse < 3500 ? gazeFor(state.mouse.x, state.mouse.y).d : 999;
      const want = 1 + (near < 140 ? (1 - near / 140) * 0.16 : 0) + (RCAudioReactive.bass || 0) * 0.08;
      state.dilate += (want - state.dilate) * Math.min(1, s * 6);

      // 7. La testa si piega un po' verso dove guarda
      const leanWant = state.p.x / MX * 4;
      state.lean += (leanWant - state.lean) * Math.min(1, s * 5);

      iris.setAttribute('cx', (EX + state.p.x).toFixed(3));
      iris.setAttribute('cy', (EY + state.p.y).toFixed(3));
      iris.setAttribute('rx', (RX * state.dilate).toFixed(3));
      iris.setAttribute('ry', (RY * state.dilate * state.blink).toFixed(3));

      state.fps = state.fps * 0.95 + (1000 / Math.max(1, dt)) * 0.05;
      state.lagMs = Math.hypot(state.goal.x - state.p.x, state.goal.y - state.p.y) > 0.3 ? (state.lagMs + dt) : 0;
    }

    return {
      state,
      update,
      blink: blinkNow,
      lookAt(x, y, ms) { state.override = { x, y }; state.overrideUntil = performance.now() + (ms || 600); }
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // LA R
  // ═══════════════════════════════════════════════════════════════
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
    el: null, body: null, bubble: null, text: null, cta: null, soundBtn: null, eye: null,
    busy: false, lastSaid: 0, queue: [], seen: new Set(), firstTrack: true, lastIdleSay: 0,

    init() {
      let nascosta = false;
      try { nascosta = sessionStorage.getItem('rc_mascot_hidden') === 'true'; } catch (e) {}
      // La vecchia versione la nascondeva per sempre: si ripulisce.
      store('rc_mascot_hidden', null);
      if (!DESKTOP || nascosta) return;
      if (!this._build()) return;
      this.eye = createEye(this.body.querySelector('svg'), this.el.querySelector('.rc-mascot__iris'));
      this._loop();
      this._sections();
      this._radioEvents();
      this._hookNowPlaying();
      this._behaviour();

      // Il primo saluto aspetta che il tutorial sia finito (o assente).
      const greet = () => {
        if (document.querySelector('.tutorial-overlay')) return setTimeout(greet, 1500);
        if (sessionStorage.getItem('rc_mascot_greeted')) return;
        try { sessionStorage.setItem('rc_mascot_greeted', '1'); } catch (e) {}
        const visits = (parseInt(store('rc_mascot_visits') || '0', 10) || 0) + 1;
        store('rc_mascot_visits', String(visits));
        const nome = window.RCAccount && RCAccount.name ? RCAccount.name() : '';
        this.say(Frasi.get(visits > 1 ? 'ritorno' : 'intro', { nome }) || Frasi.get('intro'));
        setTimeout(() => this.say(Frasi.get(timeGroup(), { ora: clock() })), 9000);
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
          <button class="rc-mascot__cta" type="button" hidden>METTI LA DIRETTA →</button>
          <button class="rc-mascot__close" type="button" aria-label="Chiudi il fumetto">×</button>
        </div>
        <button class="rc-mascot__body" type="button" aria-label="La R di Radio Carducci: cliccala per un consiglio">
          <span class="rc-mascot__shadow" aria-hidden="true"></span>
        </button>
        <div class="rc-mascot__tools">
          <button class="rc-mascot__tool rc-mascot__voice" type="button"></button>
          <button class="rc-mascot__tool rc-mascot__sound" type="button"></button>
          <button class="rc-mascot__tool rc-mascot__hide" type="button">NASCONDI</button>
        </div>`;
      el.querySelector('.rc-mascot__body').prepend(svg);
      document.body.appendChild(el);

      this.el = el;
      this.body = el.querySelector('.rc-mascot__body');
      this.bubble = el.querySelector('.rc-mascot__bubble');
      this.text = el.querySelector('.rc-mascot__text');
      this.cta = el.querySelector('.rc-mascot__cta');
      this.soundBtn = el.querySelector('.rc-mascot__sound');
      this.voiceBtn = el.querySelector('.rc-mascot__voice');
      this._syncSoundBtn();

      let pokes = [];
      this.body.addEventListener('click', () => {
        const nowP = Date.now();
        pokes = pokes.filter(t => nowP - t < 2500).concat(nowP);
        this.el.classList.remove('rc-mascot--poked');
        void this.el.offsetWidth;
        this.el.classList.add('rc-mascot--poked');
        this.eye.blink();
        // A volte, invece della battuta, propone la diretta
        if (pokes.length >= 3) {
          pokes = [];
          if (window.RCSamples) RCSamples.play('haha', { vol: 0.6 });
          this.say(Frasi.get('pokeRaffica'), true, { interrupt: true });
          return;
        }
        if (window.RCSamples && Math.random() < 0.3) RCSamples.play('a', { vol: 0.6 });
        if (!liveIsPlaying() && Math.random() < 0.25) this.say(Frasi.get('ctaDiretta'), true, { cta: true });
        else this.say(Frasi.get('poke'), true);
      });
      this.cta.addEventListener('click', () => {
        const play = document.querySelector('.player-bar__play');
        if (play && !liveIsPlaying()) play.click();
        this.cta.hidden = true;
      });
      el.querySelector('.rc-mascot__close').addEventListener('click', () => this.hideBubble());
      this.soundBtn.addEventListener('click', () => RCSfx.setMuted(!RCSfx.muted));
      el.querySelector('.rc-mascot__hide').title = 'La R torna alla prossima visita';
      this.voiceBtn.addEventListener('click', () => {
        store('rc_voice_muted', String(!voiceMuted()));
        this._syncSoundBtn();
      });
      document.addEventListener('rc:sounds', () => this._syncSoundBtn());
      el.querySelector('.rc-mascot__hide').addEventListener('click', () => {
        // solo per questa visita: alla prossima apertura la R torna
        try { sessionStorage.setItem('rc_mascot_hidden', 'true'); } catch (e) {}
        el.remove();
        this.el = null;
      });
      return true;
    },

    _syncSoundBtn() {
      if (this.voiceBtn) {
        const v = voiceMuted();
        this.voiceBtn.textContent = v ? 'VOCE OFF' : 'VOCE ON';
        this.voiceBtn.setAttribute('aria-pressed', String(!v));
        this.voiceBtn.setAttribute('aria-label', v ? 'Fai parlare la R' : 'Zittisci la voce della R');
      }
      const m = RCSfx.muted;
      this.soundBtn.textContent = m ? 'SUONI OFF' : 'SUONI ON';
      this.soundBtn.setAttribute('aria-pressed', String(!m));
      this.soundBtn.setAttribute('aria-label', m ? 'Attiva i suoni del sito' : 'Disattiva i suoni del sito');
    },

    // ── Fumetto con testo lettera per lettera e voce ──
    say(line, force, opts) {
      if (!this.el || !line) return;
      opts = opts || {};
      const now = Date.now();
      // alcune battute tagliano quella in corso (raffica di clic, uscita)
      if (this.busy && opts.interrupt) {
        this._sayId = (this._sayId || 0) + 1;
        this.busy = false;
        this.el.classList.remove('rc-mascot--talking');
      }
      if (this.busy) {
        if (!this.queue.some(q => q.line === line)) this.queue.push({ line, opts });
        if (this.queue.length > 3) this.queue.shift();
        return;
      }
      if (!force && now - this.lastSaid < 6000) {
        this.queue.push({ line, opts });
        setTimeout(() => this._next(), 6000 - (now - this.lastSaid));
        return;
      }
      this.busy = true;
      this.lastSaid = now;
      clearTimeout(this._hideT);
      this.bubble.hidden = false;
      this.cta.hidden = true;
      requestAnimationFrame(() => this.bubble.classList.add('rc-mascot__bubble--open'));
      this.text.setAttribute('aria-label', line);
      // mentre parla guarda il fumetto, poi torna su di te
      const br = this.bubble.getBoundingClientRect();
      this.eye.lookAt(br.left + br.width * 0.4, br.top + br.height / 2, 450);

      const finish = () => {
        if (opts.cta && !liveIsPlaying()) this.cta.hidden = false;
        this._done(opts.cta ? 11000 : 7000);
      };
      if (REDUCED) { this.text.textContent = line; finish(); return; }

      this.text.textContent = '';
      this.el.classList.add('rc-mascot--talking');
      const id = this._sayId = (this._sayId || 0) + 1;
      let i = 0;
      const voiceOn = () => !RCSfx.muted && !voiceMuted() && ctx && ctx.state === 'running' && !anyAudioPlaying();
      const step = () => {
        if (!this.el || id !== this._sayId) return;
        if (i >= line.length) { finish(); return; }
        const ch = line[i++];
        this.text.textContent += ch;
        if (/[a-zà-ù]/i.test(ch) && i % 3 === 0 && voiceOn()) speak(ch);
        setTimeout(step, /[.,:]/.test(ch) ? 190 : 32);
      };
      step();
    },

    _done(ms) {
      this.el.classList.remove('rc-mascot--talking');
      clearTimeout(this._hideT);
      this._hideT = setTimeout(() => this.hideBubble(), ms || 7000);
      this.busy = false;
      if (this.queue.length) { clearTimeout(this._hideT); setTimeout(() => this._next(), 2600); }
    },

    _next() {
      if (this.busy || !this.queue.length) return;
      const q = this.queue.shift();
      this.say(q.line, true, q.opts);
    },

    hideBubble() {
      if (!this.el) return;
      this.bubble.classList.remove('rc-mascot__bubble--open');
      setTimeout(() => {
        if (this.el && !this.bubble.classList.contains('rc-mascot__bubble--open')) this.bubble.hidden = true;
        this._next();
      }, 200);
    },

    // ── Un solo ciclo per occhio, testa e balletto ──
    _loop() {
      const svg = this.body.querySelector('svg');
      const shadow = this.body.querySelector('.rc-mascot__shadow');
      let last = performance.now(), t = 0, hop = 0, vel = 0;
      const frame = now => {
        if (!this.el) return;
        const dt = Math.min(50, now - last);
        last = now;
        t += dt / 1000;
        this.eye.update(now, dt);

        let lift = 0, squash = 1, tilt = this.eye.state.lean;
        if (!REDUCED) {
          const playing = anyAudioPlaying();
          let target = 0;
          if (playing) {
            target = RCAudioReactive.enabled
              ? RCAudioReactive.bass
              : Math.max(0, Math.sin(t * Math.PI * 2 * (118 / 60))) * 0.55; // ~118 bpm finti
          }
          vel += (target - hop) * 0.25;
          vel *= 0.72;
          hop += vel;
          lift = hop * 14;
          squash = 1 + hop * 0.08;
          tilt += playing ? Math.sin(t * 3.1) * 4 : Math.sin(t * 1.3) * 1.2;
          this.el.classList.toggle('rc-mascot--dancing', playing);
        }
        svg.style.transform = `translateY(${-lift}px) rotate(${tilt}deg) scale(${1 / squash}, ${squash})`;
        shadow.style.transform = `translateX(-50%) scale(${1 - hop * 0.3})`;
        shadow.style.opacity = String(0.45 - hop * 0.2);
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    },

    // ── Commento la prima volta che entri in una sezione ──
    _sections() {
      const bank = window.RC_FRASI || {};
      const io = new IntersectionObserver(entries => {
        entries.forEach(en => {
          const key = '#' + en.target.id;
          if (!en.isIntersecting || this.seen.has(key)) return;
          if (getComputedStyle(en.target).display === 'none') return;
          this.seen.add(key);
          io.unobserve(en.target);
          if (document.querySelector('.tutorial-overlay')) return;
          this.say(Frasi.get(key));
        });
      }, { threshold: 0.35 });
      Object.keys(bank).filter(k => k[0] === '#').forEach(sel => {
        const s = document.querySelector(sel);
        if (s) io.observe(s);
      });
    },

    _radioEvents() {
      const audio = document.getElementById('rc-audio');
      if (!audio) return;
      let saidLive = false, startedAt = 0;
      audio.addEventListener('playing', () => {
        if (window.RCSamples && Date.now() - startedAt > 3000) RCSamples.play('ahYeah', { vol: 0.55 });
        startedAt = Date.now();
        if (saidLive) return;
        saidLive = true;
        this.say(Frasi.get('live'), true);
      });
      audio.addEventListener('pause', () => {
        if (audio.ended) return;
        if (startedAt && Date.now() - startedAt > 8000) {
          if (window.RCSamples) RCSamples.play('dontStop', { vol: 0.55 });
          if (Math.random() < 0.6) this.say(Frasi.get('pausa'));
        }
      });
      audio.addEventListener('error', () => {
        if (audio.getAttribute('src')) this.say(Frasi.get('offline'), true);
      });
    },

    // ── Si aggancia al cambio brano di NowPlaying (site.js) ──
    _hookNowPlaying() {
      const np = window.NowPlaying;
      if (!np || typeof np.onTrackChange !== 'function' || np._rcHooked) return;
      np._rcHooked = true;
      const orig = np.onTrackChange;
      const self = this;
      np.onTrackChange = function (trackStr) {
        const r = orig.apply(this, arguments);
        try { self.onTrack(trackStr); } catch (e) {}
        return r;
      };
      if (np.currentTrack) this.firstTrack = false; // il brano attuale c'era già: niente commento
    },

    onTrack(trackStr) {
      if (!trackStr) return;
      const parts = trackStr.split(' - ');
      const artista = parts.length > 1 ? parts[0].trim() : '';
      const titolo = (parts.length > 1 ? parts.slice(1).join(' - ') : trackStr).trim();
      const first = this.firstTrack;
      this.firstTrack = false;
      const playing = liveIsPlaying();
      const delay = streamDelayMs();

      // Si commenta quando il brano si sente davvero, non quando arrivano i metadati
      setTimeout(() => {
        if (playing && liveIsPlaying() && !/^radio carducci$/i.test(artista)) Ascolti.add(artista, titolo);
        if (first || !this.el) return;
        const line = this._lineForTrack(artista, titolo, playing);
        if (!line) return;
        this.say(line.text, false, { cta: line.cta });
      }, delay);
      window.RCDebug && RCDebug.trackEvent(trackStr, delay);
    },

    _lineForTrack(artista, titolo, playing) {
      const vars = { artista, titolo, programma: artista };
      if (/^radio carducci$/i.test(artista)) {
        return Math.random() < 0.4 ? { text: Frasi.get('jingle') } : null;
      }
      if (/in diretta su radio carducci/i.test(titolo)) {
        return { text: Frasi.get('inDiretta', vars), cta: !playing };
      }
      const liked = isLiked(artista, titolo) || likesArtist(artista);
      const plays = Ascolti.artistCount(artista);
      const repeat = Ascolti.trackCount(artista, titolo);
      if (liked) return { text: Frasi.get('branoSalvato', vars), cta: !playing };
      if (plays >= 3) return { text: Frasi.get('branoArtistaFrequente', Object.assign({ volte: plays }, vars)), cta: !playing };
      if (repeat >= 1 && playing) return { text: Frasi.get('branoRipetuto', vars) };
      // Brano qualsiasi: sempre se ascolti, ogni tanto se no (con invito)
      if (playing) return Math.random() < 0.7 ? { text: Frasi.brano(vars) } : null;
      return Math.random() < 0.35 ? { text: [Frasi.opener(vars), Frasi.get('ctaDiretta')].filter(Boolean).join(' '), cta: true } : null;
    },

    // ── Fermo troppo a lungo, scroll a razzo ──
    _behaviour() {
      let lastInput = Date.now();
      ['mousemove', 'keydown', 'scroll', 'pointerdown'].forEach(ev =>
        document.addEventListener(ev, () => { lastInput = Date.now(); }, { passive: true }));
      setInterval(() => {
        const idle = Date.now() - lastInput;
        if (idle > 30000 && Date.now() - this.lastIdleSay > 120000 && !document.hidden) {
          this.lastIdleSay = Date.now();
          this.say(Frasi.get('idle'));
        }
      }, 5000);

      let lastY = window.scrollY, lastT = performance.now(), lastFast = 0;
      window.addEventListener('scroll', () => {
        const now = performance.now();
        const v = Math.abs(window.scrollY - lastY) / Math.max(1, now - lastT) * 1000;
        // l'occhio segue la direzione dello scroll
        if (v > 800 && this.eye) {
          const c = this.body.getBoundingClientRect();
          this.eye.lookAt(c.left + c.width * 0.8, window.scrollY > lastY ? c.bottom + 400 : c.top - 400, 250);
        }
        if (v > 6000 && Date.now() - lastFast > 60000) {
          lastFast = Date.now();
          this.say(Frasi.get('scrollVeloce'));
        }
        lastY = window.scrollY; lastT = now;
      }, { passive: true });

      // il mouse esce dall'alto della finestra: sta per chiudere o cambiare scheda
      let warned = false;
      document.addEventListener('mouseout', e => {
        if (warned || e.relatedTarget || e.clientY > 8) return;
        warned = true;
        if (window.RCSamples) RCSamples.play('waitAMinute', { vol: 0.55 });
        this.eye.lookAt(e.clientX, -200, 900);
        this.say(Frasi.get('uscita'), true, { interrupt: true });
      });

      document.addEventListener('rc:login', e => {
        this.say(Frasi.get('login', { nome: e.detail && e.detail.name }), true);
      });
    },

    countPhrases() { return Frasi.countAll(); }
  };

  function voiceMuted() { return store('rc_voice_muted') === 'true'; }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function clock() {
    const d = new Date();
    return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function timeGroup() {
    const d = new Date(), h = d.getHours(), day = d.getDay();
    if ((day === 0 || day === 6) && Math.random() < 0.5) return 'weekend';
    if (h >= 5 && h < 12) return 'mattina';
    if (h >= 12 && h < 18) return 'pomeriggio';
    if (h >= 18 && h < 23) return 'sera';
    return 'notte';
  }

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
