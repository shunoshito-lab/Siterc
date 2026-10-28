/* ============================================================
   RADIO CARDUCCI — ACCOUNT (lato sito)
   Pulsante ACCEDI in nav, finestra "sono nuovo / ho il codice",
   sincronizza preferiti (rc_liked_tracks) e ascolti (rc_listen_history)
   con il Worker in worker/account-worker.js.
   Compare solo se l'indirizzo del Worker è configurato:
   window.RC_ACCOUNT_API oppure APP_CONFIG.meta.accountApi.
   ============================================================ */
(function () {
  'use strict';

  const TOKEN_KEY = 'rc_account_token';
  const NAME_KEY = 'rc_account_name';
  let api = '', btn = null, modal = null, pushT = null, pulling = false;

  function ls(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    } catch (e) { return null; }
  }

  function apiBase() {
    const cfg = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG && APP_CONFIG.meta) ? APP_CONFIG.meta.accountApi : '';
    return String(window.RC_ACCOUNT_API || cfg || '').replace(/\/+$/, '');
  }

  async function call(method, path, payload) {
    const headers = { 'Content-Type': 'application/json' };
    const token = ls(TOKEN_KEY);
    if (token) headers.Authorization = 'Bearer ' + token;
    let res;
    try {
      res = await fetch(api + path, { method, headers, body: payload ? JSON.stringify(payload) : undefined });
    } catch (e) {
      throw new Error('server non raggiungibile, riprova tra poco');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) logoutLocal();
      throw new Error(data.error || 'qualcosa è andato storto');
    }
    return data;
  }

  // ── Dati locali ↔ server ──
  function localData() {
    let likes = [], history = {};
    try { likes = JSON.parse(ls('rc_liked_tracks') || '[]') || []; } catch (e) {}
    try { history = JSON.parse(ls('rc_listen_history') || '{}') || {}; } catch (e) {}
    const off = parseFloat(ls('rc_lyrics_user_offset'));
    return { likes, history, prefs: { soundsMuted: ls('rc_sounds_muted') === 'true', lyricsOffset: isNaN(off) ? 0 : off } };
  }

  function likeKey(t) { return (String(t.artist || '') + '|' + String(t.title || '')).toLowerCase(); }

  // Unione: non si perde niente né in locale né sul server
  function merge(local, remote) {
    const likes = [];
    const seen = new Set();
    [].concat(remote.likes || [], local.likes || []).forEach(t => {
      if (!t || typeof t !== 'object') return;
      const k = likeKey(t);
      if (seen.has(k)) return;
      seen.add(k);
      likes.push(t);
    });
    const h = { artists: {}, tracks: {}, updatedAt: Date.now() };
    [remote.history || {}, local.history || {}].forEach(src => {
      ['artists', 'tracks'].forEach(kind => {
        Object.entries(src[kind] || {}).forEach(([k, n]) => { h[kind][k] = Math.max(h[kind][k] || 0, n | 0); });
      });
    });
    return { likes, history: h, prefs: Object.assign({}, remote.prefs, local.prefs) };
  }

  async function pull() {
    if (!ls(TOKEN_KEY)) return;
    pulling = true;
    try {
      const me = await call('GET', '/me');
      ls(NAME_KEY, me.display);
      const merged = merge(localData(), me.data || {});
      ls('rc_liked_tracks', JSON.stringify(merged.likes));
      ls('rc_listen_history', JSON.stringify(merged.history));
      if (typeof merged.prefs.lyricsOffset === 'number' && window.NowPlaying && NowPlaying.setUserOffset) {
        NowPlaying.setUserOffset(merged.prefs.lyricsOffset);
      }
      // niente suono "preferito" per i brani che tornano dal server
      window.__rcSyncingLikes = true;
      window.dispatchEvent(new Event('rc-liked-tracks-updated'));
      window.__rcSyncingLikes = false;
      renderButton();
      await call('PUT', '/me', { data: merged });
    } catch (e) {
      // offline o token scaduto: si resta con i dati locali
    } finally {
      pulling = false;
    }
  }

  function schedulePush() {
    if (!ls(TOKEN_KEY) || pulling) return;
    clearTimeout(pushT);
    pushT = setTimeout(() => call('PUT', '/me', { data: localData() }).catch(() => {}), 3000);
  }

  function logoutLocal() {
    ls(TOKEN_KEY, null);
    ls(NAME_KEY, null);
    renderButton();
  }

  // ── Interfaccia ──
  function firstName() {
    const n = ls(NAME_KEY) || '';
    return n.split(' ')[0] || '';
  }

  function renderButton() {
    if (!btn) return;
    const logged = !!ls(TOKEN_KEY);
    btn.textContent = logged ? ('CIAO ' + firstName()).toUpperCase() : 'ACCEDI';
    btn.setAttribute('aria-label', logged ? 'Il tuo account' : 'Accedi o registrati');
  }

  function buildModal() {
    modal = document.createElement('div');
    modal.className = 'rc-acc';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="rc-acc__box" role="dialog" aria-modal="true" aria-labelledby="rc-acc-title">
        <div class="rc-acc__top"><span>RC / ACCOUNT</span><button type="button" class="rc-acc__x">CHIUDI</button></div>

        <div class="rc-acc__view" data-view="out">
          <h2 class="rc-acc__title" id="rc-acc-title">entra. così ci ricordiamo di te.</h2>
          <p class="rc-acc__text">Preferiti e ascolti restano salvati anche se cambi telefono, browser o se il sito li dimentica.</p>
          <div class="rc-acc__tabs" role="tablist">
            <button type="button" class="rc-acc__tab rc-acc__tab--on" data-tab="login" role="tab" aria-selected="true">HO GIÀ IL CODICE</button>
            <button type="button" class="rc-acc__tab" data-tab="new" role="tab" aria-selected="false">SONO NUOVO</button>
          </div>
          <form class="rc-acc__form" data-form="login">
            <label class="rc-acc__label" for="rc-acc-code">Il tuo codice</label>
            <input class="rc-acc__input" id="rc-acc-code" name="code" autocomplete="username" placeholder="Simone4821" required>
            <button class="btn btn-red" type="submit">ENTRA</button>
          </form>
          <form class="rc-acc__form" data-form="new" hidden>
            <label class="rc-acc__label" for="rc-acc-nome">Nome</label>
            <input class="rc-acc__input" id="rc-acc-nome" name="nome" autocomplete="given-name" required>
            <label class="rc-acc__label" for="rc-acc-cognome">Cognome</label>
            <input class="rc-acc__input" id="rc-acc-cognome" name="cognome" autocomplete="family-name" required>
            <p class="rc-acc__note">Salviamo solo il nome e l'iniziale del cognome.</p>
            <button class="btn btn-red" type="submit">CREA IL MIO CODICE</button>
          </form>
          <p class="rc-acc__err" role="alert"></p>
        </div>

        <div class="rc-acc__view" data-view="code" hidden>
          <h2 class="rc-acc__title">questo è il tuo codice.</h2>
          <div class="rc-acc__code" aria-live="polite"></div>
          <button type="button" class="btn rc-acc__copy">COPIA</button>
          <p class="rc-acc__text">Segnatelo da qualche parte. Serve per entrare da un altro telefono o computer. Se lo perdi, non possiamo recuperarlo.</p>
          <button type="button" class="btn btn-red rc-acc__done">HO SEGNATO IL CODICE</button>
        </div>

        <div class="rc-acc__view" data-view="in" hidden>
          <h2 class="rc-acc__title rc-acc__hello"></h2>
          <p class="rc-acc__text">Preferiti e ascolti si salvano da soli. Su un altro dispositivo entra con il tuo codice.</p>
          <button type="button" class="btn rc-acc__logout">ESCI</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const err = modal.querySelector('.rc-acc__err');
    const views = modal.querySelectorAll('.rc-acc__view');
    const show = v => views.forEach(x => { x.hidden = x.dataset.view !== v; });
    modal._show = show;

    modal.querySelector('.rc-acc__x').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) close(); });

    modal.querySelectorAll('.rc-acc__tab').forEach(t => t.addEventListener('click', () => {
      modal.querySelectorAll('.rc-acc__tab').forEach(x => {
        const on = x === t;
        x.classList.toggle('rc-acc__tab--on', on);
        x.setAttribute('aria-selected', String(on));
      });
      modal.querySelectorAll('.rc-acc__form').forEach(f => { f.hidden = f.dataset.form !== t.dataset.tab; });
      err.textContent = '';
    }));

    modal.querySelector('[data-form="login"]').addEventListener('submit', async e => {
      e.preventDefault();
      err.textContent = '';
      try {
        const r = await call('POST', '/login', { code: e.target.code.value });
        loggedIn(r);
        close();
      } catch (x) { err.textContent = x.message; }
    });

    modal.querySelector('[data-form="new"]').addEventListener('submit', async e => {
      e.preventDefault();
      err.textContent = '';
      try {
        const r = await call('POST', '/register', { nome: e.target.nome.value, cognome: e.target.cognome.value });
        loggedIn(r);
        modal.querySelector('.rc-acc__code').textContent = r.code;
        show('code');
      } catch (x) { err.textContent = x.message; }
    });

    modal.querySelector('.rc-acc__copy').addEventListener('click', e => {
      const code = modal.querySelector('.rc-acc__code');
      const b = e.currentTarget;
      const done = () => { b.textContent = 'COPIATO'; setTimeout(() => { b.textContent = 'COPIA'; }, 1500); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code.textContent).then(done).catch(() => selectText(code));
      } else selectText(code);
    });
    modal.querySelector('.rc-acc__done').addEventListener('click', close);
    modal.querySelector('.rc-acc__logout').addEventListener('click', async () => {
      try { await call('POST', '/logout'); } catch (e) {}
      logoutLocal();
      close();
    });
  }

  function selectText(el) {
    const r = document.createRange();
    r.selectNodeContents(el);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }

  function loggedIn(r) {
    ls(TOKEN_KEY, r.token);
    ls(NAME_KEY, r.display);
    renderButton();
    pull();
    document.dispatchEvent(new CustomEvent('rc:login', { detail: { name: firstName() } }));
  }

  function open() {
    if (!modal) buildModal();
    const logged = !!ls(TOKEN_KEY);
    modal._show(logged ? 'in' : 'out');
    if (logged) modal.querySelector('.rc-acc__hello').textContent = 'ciao ' + firstName().toLowerCase() + '.';
    modal.hidden = false;
    const f = modal.querySelector(logged ? '.rc-acc__logout' : '#rc-acc-code');
    if (f) f.focus();
  }

  function close() {
    if (!modal) return;
    modal.hidden = true;
    if (btn) btn.focus();
  }

  function mount() {
    api = apiBase();
    if (!api || btn) return !!btn;
    const right = document.querySelector('.nav-right');
    if (!right) return false;
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rc-acc-btn';
    btn.addEventListener('click', open);
    right.insertBefore(btn, right.querySelector('.rc-live') || null);

    // anche nel menu da telefono
    const mob = document.querySelector('.nav-mobile');
    if (mob) {
      const m = document.createElement('a');
      m.href = '#';
      m.textContent = 'Account';
      m.addEventListener('click', e => { e.preventDefault(); document.body.classList.remove('nav-open'); open(); });
      mob.insertBefore(m, mob.querySelector('.nav-mobile__explore-wrap'));
    }
    renderButton();
    window.addEventListener('rc-liked-tracks-updated', schedulePush);
    document.addEventListener('rc:history-updated', schedulePush);
    window.addEventListener('rc-lyrics-offset-updated', schedulePush);
    pull();
    return true;
  }

  window.RCAccount = {
    name: firstName,
    isLogged: () => !!ls(TOKEN_KEY),
    open
  };

  function boot() {
    // il config remoto arriva qualche secondo dopo: riprovo un po' di volte
    let tries = 0;
    const attempt = () => { if (!mount() && ++tries < 10) setTimeout(attempt, 1500); };
    attempt();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
