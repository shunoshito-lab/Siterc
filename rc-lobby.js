/* ============================================================
   RADIO CARDUCCI — MUSICA DELLA MODALITÀ ESPLORA
   Sceglie il brano in base a: energia/BPM del brano, ora del giorno
   e meteo a Roma (Open-Meteo, senza chiave). Finito un brano, ne
   sceglie un altro. I brani e le misure stanno in assets/lobby/lobby.json.
   Se qualcosa non risponde, resta il vecchio lobby.mp3 in loop.
   ============================================================ */
(function () {
  'use strict';

  const BASE = 'assets/lobby/';
  // Liceo Carducci, via Asmara (Roma)
  const METEO = 'https://api.open-meteo.com/v1/forecast?latitude=41.925&longitude=12.522&current=weather_code,is_day,temperature_2m&timezone=Europe%2FRome';

  let tracks = [], meteo = null, current = null;
  const recent = [];

  function fasciaOraria(h) {
    if (h >= 6 && h < 9) return { nome: 'MATTINA PRESTO', e: 0.42 };
    if (h >= 9 && h < 13) return { nome: 'MATTINA', e: 0.58 };
    if (h >= 13 && h < 15) return { nome: 'DOPO PRANZO', e: 0.45 };
    if (h >= 15 && h < 19) return { nome: 'POMERIGGIO', e: 0.68 };
    if (h >= 19 && h < 22) return { nome: 'SERA', e: 0.42 };
    return { nome: 'NOTTE', e: 0.25 };
  }

  // Codici WMO di Open-Meteo
  function descriviMeteo(m) {
    if (!m) return { nome: '', d: 0 };
    const c = m.weather_code;
    let nome = 'SERENO', d = 0.08;
    if (c >= 95) { nome = 'TEMPORALE'; d = -0.18; }
    else if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) { nome = 'PIOGGIA'; d = -0.15; }
    else if (c >= 71 && c <= 77) { nome = 'NEVE'; d = -0.12; }
    else if (c === 45 || c === 48) { nome = 'NEBBIA'; d = -0.1; }
    else if (c === 3) { nome = 'NUVOLOSO'; d = -0.05; }
    else if (c === 2) { nome = 'POCO NUVOLOSO'; d = 0; }
    if (!m.is_day) d -= 0.05;
    return { nome, d, temp: Math.round(m.temperature_2m) };
  }

  function target() {
    const f = fasciaOraria(new Date().getHours());
    const w = descriviMeteo(meteo);
    return { e: Math.max(0.1, Math.min(0.9, f.e + w.d)), fascia: f.nome, meteo: w };
  }

  // Tra i brani più vicini all'energia giusta, uno a caso (niente ripetizioni recenti)
  function pick() {
    if (!tracks.length) return null;
    const t = target();
    const pool = tracks.filter(x => !recent.includes(x.file));
    const list = (pool.length ? pool : tracks).slice().sort((a, b) => Math.abs(a.energy - t.e) - Math.abs(b.energy - t.e));
    const choice = list[Math.floor(Math.random() * Math.min(4, list.length))];
    recent.push(choice.file);
    if (recent.length > 6) recent.shift();
    current = Object.assign({ target: t }, choice);
    return current;
  }

  function label() {
    if (!current) return 'MODALITÀ ESPLORAZIONE · LOBBY AUDIO';
    const w = current.target.meteo;
    return ['ESPLORA', current.bpm + ' BPM', current.target.fascia, w.nome ? w.nome + (w.temp != null ? ' ' + w.temp + '°' : '') : '']
      .filter(Boolean).join(' · ');
  }

  function showLabel() {
    const meta = document.querySelector('.player-bar__meta');
    const audio = document.getElementById('lobby-audio');
    if (meta && audio && !audio.paused) meta.textContent = label();
  }

  // Chiamato da site.js subito prima di far partire la musica dell'Esplora
  function prepare(audio) {
    const t = pick();
    if (!t) return false;
    audio.loop = false;
    audio.src = BASE + t.file;
    return true;
  }

  function init() {
    const audio = document.getElementById('lobby-audio');
    if (!audio) return;
    fetch(BASE + 'lobby.json').then(r => r.json()).then(d => { tracks = d.tracks || []; }).catch(() => {});
    const loadMeteo = () => fetch(METEO).then(r => r.json()).then(d => { meteo = d.current || null; }).catch(() => {});
    loadMeteo();
    setInterval(loadMeteo, 30 * 60 * 1000);

    // brano finito: se l'Esplora è ancora accesa, si passa al prossimo
    audio.addEventListener('ended', () => {
      if (!document.body.classList.contains('theme-explore')) return;
      if (prepare(audio)) audio.play().catch(() => {});
    });
    audio.addEventListener('playing', () => setTimeout(showLabel, 50));
  }

  window.RCLobby = {
    prepare,
    get current() { return current; },
    get meteo() { return descriviMeteo(meteo); },
    target,
    label
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
