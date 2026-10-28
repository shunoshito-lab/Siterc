/* ============================================================
   RADIO CARDUCCI — PANNELLO DEBUG
   Si apre con ?debug=1 nell'indirizzo oppure Ctrl+Shift+D.
   Serve a capire se testi, metadati e R sono in ritardo rispetto
   a quello che si sente, e a correggere l'offset dei testi al volo.
   ============================================================ */
(function () {
  'use strict';

  const OFFSET_KEY = 'rc_lyrics_offset';
  const log = [];
  let panel = null, timer = null, lastData = 0, dataCount = 0;

  function ls(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; }
  }

  // Offset dei testi salvato dal pannello: vale anche senza pannello aperto
  function applySavedOffset() {
    const np = window.NowPlaying;
    const saved = parseFloat(ls(OFFSET_KEY));
    if (np && !isNaN(saved)) np.delayOffset = saved;
  }

  function hook() {
    const np = window.NowPlaying;
    if (!np || np._rcDebugHooked) return;
    np._rcDebugHooked = true;
    const orig = np.handleData;
    np.handleData = function () {
      lastData = Date.now();
      dataCount++;
      return orig.apply(this, arguments);
    };
  }

  const RCDebug = window.RCDebug = {
    trackEvent(track, delay) {
      log.unshift({ at: new Date(), track, delay });
      if (log.length > 6) log.pop();
    },
    open() { build(); panel.hidden = false; tick(); timer = setInterval(tick, 250); try { sessionStorage.setItem('rc_debug', '1'); } catch (e) {} },
    close() { if (panel) panel.hidden = true; clearInterval(timer); try { sessionStorage.removeItem('rc_debug'); } catch (e) {} },
    toggle() { (panel && !panel.hidden) ? this.close() : this.open(); }
  };

  function audioInfo() {
    const a = document.getElementById('rc-audio');
    if (!a) return { playing: false };
    let buffer = 0;
    try { if (a.buffered.length) buffer = a.buffered.end(a.buffered.length - 1) - a.currentTime; } catch (e) {}
    return { playing: !a.paused, buffer, ready: a.readyState, src: a.getAttribute('src') || '' };
  }

  function lyricsInfo() {
    const np = window.NowPlaying;
    if (!np) return null;
    const offset = typeof np.delayOffset === 'number' ? np.delayOffset : 6.5;
    const elapsed = (Date.now() - np.trackStartTime) / 1000 + offset;
    const lines = np.syncedLines || [];
    const idx = np.activeLyricIndex;
    const cur = idx >= 0 ? lines[idx] : null;
    const next = lines[idx + 1] || null;
    return { offset, elapsed, lines: lines.length, idx, cur, next, latency: np.streamLatencyMs, sync: np.isTimeSyncEnabled };
  }

  function fmt(n, d) { return (typeof n === 'number' && isFinite(n)) ? n.toFixed(d == null ? 1 : d) : '—'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

  function row(k, v, cls) { return `<div class="rcd__row"><span>${k}</span><b class="${cls || ''}">${v}</b></div>`; }

  function tick() {
    if (!panel || panel.hidden) return;
    const np = window.NowPlaying || {};
    const a = audioInfo();
    const l = lyricsInfo();
    const delay = window.RCStreamDelayMs ? window.RCStreamDelayMs() : 0;
    const age = lastData ? (Date.now() - lastData) / 1000 : null;
    const sse = np.sse ? ['IN CONNESSIONE', 'APERTO', 'CHIUSO'][np.sse.readyState] : 'NO';
    const eye = window.RCMascotte && RCMascotte.eye ? RCMascotte.eye.state : null;

    let html = '<div class="rcd__h">STREAM</div>';
    html += row('in riproduzione', a.playing ? 'SÌ' : 'NO', a.playing ? 'ok' : '');
    html += row('buffer audio', fmt(a.buffer) + ' s', a.buffer > 8 ? 'bad' : '');
    html += row('latenza stimata', fmt(delay / 1000) + ' s');

    html += '<div class="rcd__h">METADATI</div>';
    html += row('brano', esc(np.currentTrack || '—'));
    html += row('ultimo aggiornamento', age == null ? '—' : fmt(age) + ' s fa', age != null && age > 10 ? 'bad' : 'ok');
    html += row('aggiornamenti', String(dataCount));
    html += row('SSE', sse, sse === 'APERTO' ? 'ok' : 'bad');

    html += '<div class="rcd__h">TESTI SINCRONIZZATI</div>';
    if (l) {
      html += row('sync attivo', l.sync ? 'SÌ' : 'NO');
      html += row('offset', (l.offset >= 0 ? '+' : '') + fmt(l.offset, 2) + ' s');
      html += row('tempo stimato nel brano', fmt(l.elapsed) + ' s');
      html += row('righe', l.lines ? `${l.idx + 1} / ${l.lines}` : 'nessun testo');
      if (l.cur) html += row('riga attiva da', fmt(l.elapsed - l.cur.t) + ' s');
      if (l.next) html += row('prossima riga tra', fmt(l.next.t - l.elapsed) + ' s');
    }

    html += '<div class="rcd__h">LA R</div>';
    if (eye) {
      html += row('fps occhio', fmt(eye.fps, 0), eye.fps < 45 ? 'bad' : 'ok');
      html += row('occhio in ritardo da', Math.round(eye.lagMs) + ' ms', eye.lagMs > 250 ? 'bad' : '');
      html += row('modo', eye.mode);
    } else {
      html += row('stato', 'non attiva (telefono o nascosta)');
    }
    if (window.RCMascotte && RCMascotte.countPhrases) html += row('frasi disponibili', String(RCMascotte.countPhrases()));
    if (log.length) {
      html += '<div class="rcd__h">CAMBI BRANO</div>';
      log.forEach(e => {
        html += row(e.at.toLocaleTimeString(), esc(e.track) + ` <i>(+${fmt(e.delay / 1000)} s)</i>`);
      });
    }
    panel.querySelector('.rcd__body').innerHTML = html;
  }

  function nudge(d) {
    const np = window.NowPlaying;
    if (!np) return;
    np.delayOffset = Math.round(((typeof np.delayOffset === 'number' ? np.delayOffset : 6.5) + d) * 100) / 100;
    ls(OFFSET_KEY, String(np.delayOffset));
    if (np.tickLyricsSync) np.tickLyricsSync();
    tick();
  }

  // Premi quando SENTI partire la riga successiva: il pannello calcola di quanto correggere
  function tap() {
    const l = lyricsInfo();
    const out = panel.querySelector('.rcd__tap-out');
    if (!l || !l.next) { out.textContent = 'serve un brano con testo sincronizzato'; return; }
    const delta = l.next.t - l.elapsed;
    nudge(delta);
    out.textContent = delta > 0
      ? `i testi erano in ritardo di ${fmt(delta, 2)} s: corretto`
      : `i testi erano in anticipo di ${fmt(-delta, 2)} s: corretto`;
  }

  function build() {
    if (panel) return;
    const style = document.createElement('style');
    style.textContent = `
      .rcd{position:fixed;top:calc(80px + env(safe-area-inset-top,0px));left:max(16px,env(safe-area-inset-left,0px));z-index:200000;width:min(340px,calc(100vw - 32px));max-height:calc(100vh - 180px);overflow:auto;background:rgba(20,20,20,.96);color:var(--rc-bone);border:1px solid var(--line-strong);font:12px/1.4 var(--font-mono);}
      .rcd__top{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid var(--line-strong);font-family:var(--font-display);font-weight:800;letter-spacing:.14em;font-size:11px}
      .rcd__top button,.rcd__ctrl button{background:none;border:1px solid var(--line-strong);color:var(--rc-bone);font:inherit;padding:4px 8px;cursor:pointer}
      .rcd__top button:hover,.rcd__ctrl button:hover{border-color:var(--rc-red);color:var(--rc-red)}
      .rcd__body{padding:4px 12px 8px}
      .rcd__h{margin:10px 0 4px;color:var(--fg3);font-family:var(--font-display);font-weight:700;letter-spacing:.14em;font-size:10px}
      .rcd__row{display:flex;justify-content:space-between;gap:12px;padding:2px 0;border-bottom:1px solid var(--line)}
      .rcd__row span{color:var(--fg2);flex:none}
      .rcd__row b{font-weight:500;text-align:right;min-width:0;overflow-wrap:anywhere}
      .rcd__row b.ok{color:#5fd38d}.rcd__row b.bad{color:var(--rc-red)}
      .rcd__row i{color:var(--fg3);font-style:normal}
      .rcd__ctrl{display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px 12px;border-top:1px solid var(--line-strong)}
      .rcd__ctrl .rcd__tap{flex-basis:100%;background:var(--rc-red);border-color:var(--rc-red)}
      .rcd__ctrl .rcd__tap:hover{color:var(--rc-bone);background:var(--rc-red-deep)}
      .rcd__tap-out{flex-basis:100%;color:var(--fg2);min-height:1.4em}`;
    document.head.appendChild(style);
    panel = document.createElement('div');
    panel.className = 'rcd';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Pannello debug');
    panel.hidden = true;
    panel.innerHTML = `
      <div class="rcd__top"><span>RC / DEBUG</span><button type="button" class="rcd__x">CHIUDI</button></div>
      <div class="rcd__body"></div>
      <div class="rcd__ctrl">
        <button type="button" data-d="-0.5">TESTI −0.5 s</button>
        <button type="button" data-d="0.5">TESTI +0.5 s</button>
        <button type="button" class="rcd__reset">OFFSET 6.5</button>
        <button type="button" class="rcd__tap">PREMI QUANDO SENTI LA PROSSIMA RIGA</button>
        <div class="rcd__tap-out" aria-live="polite"></div>
      </div>`;
    document.body.appendChild(panel);
    panel.querySelector('.rcd__x').addEventListener('click', () => RCDebug.close());
    panel.querySelectorAll('[data-d]').forEach(b => b.addEventListener('click', () => nudge(parseFloat(b.dataset.d))));
    panel.querySelector('.rcd__reset').addEventListener('click', () => {
      const np = window.NowPlaying;
      if (np) np.delayOffset = 6.5;
      try { localStorage.removeItem(OFFSET_KEY); } catch (e) {}
      tick();
    });
    panel.querySelector('.rcd__tap').addEventListener('click', tap);
  }

  function boot() {
    hook();
    applySavedOffset();
    document.addEventListener('keydown', e => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) { e.preventDefault(); RCDebug.toggle(); }
    });
    let want = /[?&]debug=1\b/.test(location.search);
    try { want = want || sessionStorage.getItem('rc_debug') === '1'; } catch (e) {}
    if (want) RCDebug.open();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
