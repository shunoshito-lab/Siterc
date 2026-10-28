/* ============================================================
   RADIO CARDUCCI — SUONI DEL SITO (campioni in assets/sfx/)
   - exit-window: chiusura di finestre e pannelli
   - fav / unfav: salvi o togli un brano dai preferiti
   - vol-up / vol-down / vol-max: cursore del volume
   - key-*: clic sui pulsanti e tasti nei campi di testo
   - pixel-text: la "voce" della R mentre scrive (usata da mascotte.js)
   - voce-*: esclamazioni della R (diretta che parte, pausa, clic, bumper)
   Tutti si spengono con SUONI OFF (rc_sounds_muted), anche nel Wrapped.
   ============================================================ */
(function () {
  'use strict';

  const script = document.currentScript;
  const BASE = (script ? script.src.replace(/[^/]*(\?.*)?$/, '') : '') + 'assets/sfx/';
  const FILES = {
    exit: 'exit-window', fav: 'fav', unfav: 'unfav',
    volUp: 'vol-up', volDown: 'vol-down', volMax: 'vol-max',
    text: 'pixel-text',
    key1: 'key-1', key2: 'key-2', key3: 'key-3', key4: 'key-4',
    key5: 'key-5', key7: 'key-7', key8: 'key-8', key9: 'key-9',
    // voci della R
    ahYeah: 'voce-ah-yeah', dontStop: 'voce-dont-stop', dropTheBeat: 'voce-drop-the-beat', a: 'voce-a',
    waitAMinute: 'voce-wait-a-minute', haha: 'voce-haha'
  };
  const KEYS = ['key1', 'key2', 'key3', 'key4', 'key5', 'key7', 'key8', 'key9'];
  const TOUCH = window.matchMedia && window.matchMedia('(hover: none)').matches;

  let ctx = null, loading = null;
  const buffers = {};

  function getCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    return ctx;
  }

  function muted() {
    try { return localStorage.getItem('rc_sounds_muted') === 'true'; } catch (e) { return false; }
  }

  function load() {
    if (loading) return loading;
    const c = getCtx();
    if (!c) return Promise.resolve();
    loading = Promise.all(Object.entries(FILES).map(([name, file]) =>
      fetch(BASE + file + '.ogg')
        .then(r => (r.ok ? r.arrayBuffer() : Promise.reject()))
        .then(buf => new Promise((res, rej) => c.decodeAudioData(buf, res, rej)))
        .then(b => { buffers[name] = b; })
        .catch(() => {})
    ));
    return loading;
  }

  function unlock() {
    const c = getCtx();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
    load();
  }
  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, unlock, { passive: true, capture: true }));

  const last = {};
  function play(name, opts) {
    opts = opts || {};
    if (muted() || !ctx || ctx.state !== 'running') return false;
    const b = buffers[name];
    if (!b) return false;
    // lo stesso suono non si accavalla con sé stesso più di così
    const now = performance.now();
    if (last[name] && now - last[name] < (opts.gap == null ? 40 : opts.gap)) return false;
    last[name] = now;
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.playbackRate.value = opts.rate || 1;
    const g = ctx.createGain();
    g.gain.value = opts.vol == null ? 0.5 : opts.vol;
    src.connect(g).connect(ctx.destination);
    src.start();
    if (typeof window.RCSamples.onPlay === 'function') window.RCSamples.onPlay(name);
    return true;
  }

  function key(vol) {
    return play(KEYS[(Math.random() * KEYS.length) | 0], { vol: vol == null ? 0.35 : vol, rate: 0.94 + Math.random() * 0.12, gap: 25 });
  }

  window.RCSamples = { play, key, load, ready: name => !!buffers[name], ctx: getCtx };

  // ── Chiusure ──
  const CLOSE = '.np-overlay__close, .wrapped-view__close, .podcast-modal__close, .calendar-modal__close, ' +
    '.rc-acc__x, .rc-mascot__close, .rcd__x, .tutorial-card__btn.btn-skip';
  document.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest(CLOSE);
    if (t) { play('exit', { vol: 0.45 }); return; }
    // clic sui pulsanti: un tasto a caso, piano
    const b = e.target.closest && e.target.closest('.btn, button, .nav-links a');
    if (b && !b.matches('.player-bar__play')) key(0.3);
  }, true);

  // ── Preferiti: si guarda se la lista è cresciuta o calata ──
  function likeCount() {
    try { return (JSON.parse(localStorage.getItem('rc_liked_tracks') || '[]') || []).length; } catch (e) { return 0; }
  }
  let likes = likeCount();
  window.addEventListener('rc-liked-tracks-updated', () => {
    const n = likeCount();
    if (!window.__rcSyncingLikes) {
      if (n > likes) play('fav', { vol: 0.55 });
      else if (n < likes) play('unfav', { vol: 0.55 });
    }
    likes = n;
  });

  // ── Volume: su, giù, al massimo ──
  function bindVolume() {
    const v = document.querySelector('.player-bar__volume');
    if (!v) return;
    let prev = parseFloat(v.value);
    v.addEventListener('input', () => {
      const val = parseFloat(v.value);
      const max = parseFloat(v.max || '1');
      if (val >= max && prev < max) play('volMax', { vol: 0.5, gap: 0 });
      else if (val > prev) play('volUp', { vol: 0.4, gap: 70 });
      else if (val < prev) play('volDown', { vol: 0.4, gap: 70 });
      prev = val;
    });
  }

  // ── Tasti nei campi di testo (solo con tastiera vera) ──
  document.addEventListener('keydown', e => {
    if (TOUCH || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (!t || !t.matches || !t.matches('input:not([type=range]):not([type=checkbox]), textarea')) return;
    if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter') key(0.4);
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindVolume);
  else bindVolume();
})();
