/* ============================================================
   RADIO CARDUCCI — ORA E ALMANACCO NELLA MODALITÀ ESPLORA
   Ora locale, data di oggi, una frase per il quarto d'ora (100 frasi
   per fascia oraria) e una voce dell'almanacco che cambia ogni 15
   minuti: accadde oggi, nati oggi, santi e ricorrenze.
   I dati vengono dalla pagina del giorno di Wikipedia in italiano
   (es. "28 ottobre"), letti dal browser e ricordati per la giornata:
   valgono per ogni anno, quindi non c'è niente da rifare.
   ============================================================ */
(function () {
  'use strict';

  const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto',
    'settembre', 'ottobre', 'novembre', 'dicembre'];
  const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
  const SEZIONI = { eventi: 'ACCADDE OGGI', nati: 'NATI OGGI', morti: 'SCOMPARSI OGGI', santi: 'SI FESTEGGIA' };

  let box = null, timer = null, data = null, dataKey = '';

  function ls(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; }
  }

  function pageTitle(d) { return d.getDate() + '_' + MESI[d.getMonth()]; }

  // ── Lettura della pagina del giorno (HTML Parsoid della REST API) ──
  function parse(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const out = { eventi: [], nati: [], morti: [], santi: [] };
    doc.querySelectorAll('h2').forEach(h => {
      const id = (h.id || h.textContent).toLowerCase();
      let kind = null;
      if (/^eventi/.test(id)) kind = 'eventi';
      else if (/^nati/.test(id)) kind = 'nati';
      else if (/^morti/.test(id)) kind = 'morti';
      else if (/^(feste|ricorrenze)/.test(id)) kind = 'santi';
      if (!kind) return;
      const sec = h.closest('section') || h.parentElement;
      sec.querySelectorAll('li').forEach(li => {
        if (li.querySelector('li')) return; // solo le voci finali, non i contenitori
        let txt = li.textContent.replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim();
        if (!txt || txt.length > 220) return;
        // l'anno sta nel <li> padre quando gli eventi dello stesso anno sono raggruppati
        const parentLi = li.parentElement && li.parentElement.closest('li');
        let year = '';
        const m = txt.match(/^(\d{1,4}(?:\s*a\.\s*C\.)?)\s*[-–—:]\s*(.+)$/);
        if (m) { year = m[1]; txt = m[2]; }
        else if (parentLi) {
          const pm = parentLi.firstChild && parentLi.firstChild.textContent.match(/^\s*(\d{1,4})/);
          if (pm) year = pm[1];
        }
        if (kind !== 'santi' && !year) return;
        out[kind].push({ year, text: txt.replace(/\s*\.$/, '') });
      });
    });
    return out;
  }

  async function load(d) {
    const key = 'rc_almanacco_' + (d.getMonth() + 1) + '-' + d.getDate();
    if (dataKey === key && data) return data;
    try {
      const cached = JSON.parse(ls(key) || 'null');
      if (cached && cached.eventi) { data = cached; dataKey = key; return data; }
    } catch (e) {}
    try {
      const r = await fetch('https://it.wikipedia.org/api/rest_v1/page/html/' + encodeURIComponent(pageTitle(d)));
      if (!r.ok) throw new Error(r.status);
      data = parse(await r.text());
      dataKey = key;
      ls(key, JSON.stringify(data));
    } catch (e) {
      data = null;
    }
    return data;
  }

  // ── Una voce diversa ogni quarto d'ora, sempre la stessa per lo stesso quarto ──
  function slot(d) { return d.getHours() * 4 + Math.floor(d.getMinutes() / 15); }

  function voce(d) {
    if (!data) return null;
    // giro: tre eventi, un nato, un santo/ricorrenza, un evento, uno scomparso…
    const giro = ['eventi', 'eventi', 'nati', 'eventi', 'santi', 'eventi', 'morti'];
    const s = slot(d);
    for (let k = 0; k < giro.length; k++) {
      const kind = giro[(s + k) % giro.length];
      const list = data[kind];
      if (list && list.length) {
        const item = list[(s * 7 + d.getDate()) % list.length];
        return { label: SEZIONI[kind], year: item.year, text: item.text };
      }
    }
    return null;
  }

  function frasePiano(d) {
    // senza Wikipedia: una frase della R per la fascia oraria
    const b = window.RC_FRASI || {};
    const h = d.getHours();
    const g = h >= 5 && h < 12 ? 'mattina' : h < 18 ? 'pomeriggio' : h < 23 ? 'sera' : 'notte';
    const list = b[g] || ['la radio va avanti anche quando tu studi.'];
    return { label: 'RC / ESPLORA', year: '', text: list[slot(d) % list.length].replace('{ora}', clock(d)) };
  }

  // ── Frasi dell'ora: una diversa ogni quarto d'ora, scelte per fascia ──
  // {ora} diventa l'ora attuale. Voce RC: minuscolo, secco, niente punti esclamativi.
  const FRASI_ORA = [
    { da: 0, a: 5, frasi: [
      'sono le {ora}. a quest\'ora la radio la ascoltano in pochi, ma bene.',
      'notte fonda. se stai studiando, rispetto. se no, a letto.',
      'le {ora}. il mixer dorme, la diretta no.',
      'orario da insonni. musica bassa e luci spente.',
      'a quest\'ora anche i compiti dormono. tu?',
      'notte. la città è ferma, lo stream va.',
      'le {ora}: il momento giusto per un ultimo brano. solo uno.',
      'chi ascolta la radio di notte ha sempre qualcosa da pensare.'
    ,
      'le {ora}. chi è sveglio adesso ha le sue ragioni.',
      'a quest\'ora si studia o non si dorme. a volte tutte e due.',
      'notte. qui non chiude nessuno, perché non c\'è nessuno da chiudere.',
      'le {ora}: la radio parla piano per non svegliare nessuno.',
      'il silenzio di fuori lo riempiamo noi.',
      'le {ora}. domani ti pentirai, ma adesso va bene così.',
      'chi si sveglia a quest\'ora o ha un esame o ha un\'idea.',
      'notte piena. volume basso, cuffie giuste.'
    ] },
    { da: 5, a: 7, frasi: [
      'alba. il cielo sopra via Asmara si schiarisce.',
      'le {ora}. presto per tutti, tranne per chi ha la verifica.',
      'prime luci. un brano per svegliarsi piano.',
      'mattina presto: niente fretta, ancora un po\'.',
      'le {ora}. la sveglia non ha ancora suonato. o sì.',
      'è presto. la radio è già sveglia, tu fai con calma.',
      'buongiorno a chi è già in piedi. agli altri, dopo.',
      'colazione, zaino, cuffie. l\'ordine lo scegli tu.'
    ,
      'le {ora}. la sveglia sta per suonare. fatti trovare pronto.',
      'primo caffè di qualcuno, ultimo di qualcun altro.',
      'le {ora}. fuori è ancora buio, qui si è già accesi.',
      'mattina presto: la giornata non ha ancora deciso niente.',
      'le {ora}. c\'è chi ripassa in bagno. lo sappiamo.',
      'sveglia. la radio è già in piedi da un pezzo.',
      'le {ora}. oggi può ancora andare bene.',
      'alba su Roma. il tragitto comincia adesso.'
    ] },
    { da: 7, a: 8, frasi: [
      'le {ora}. si esce di casa: cuffie nelle orecchie.',
      'in metro, in autobus o a piedi: la diretta viene con te.',
      'mancano pochi minuti alla prima ora. respira.',
      'le {ora}. ultimo brano prima di entrare.',
      'il tragitto casa-scuola dura una playlist. più o meno.',
      'mattina. hai preso tutto? anche il caricatore?',
      'le {ora}. il momento in cui si ripassa sul telefono.',
      'si va. buona giornata, davvero.'
    ,
      'le {ora}. metro, autobus o motorino: la scelta è tua.',
      'si entra tra poco. un brano regge fino al cancello.',
      'le {ora}. la prima ora non si salva nessuno.',
      'zaino, cuffie, via. in questo ordine.',
      'le {ora}. chi corre adesso arriva comunque in ritardo.',
      'ultimo pezzo prima della campanella.',
      'le {ora}. buona giornata, sul serio.',
      'il tragitto è l\'unico momento tuo della mattina. usalo bene.'
    ] },
    { da: 8, a: 10, frasi: [
      'le {ora}. lezioni iniziate: la radio aspetta fuori dall\'aula.',
      'prima ora. il volume, se c\'è, è a zero.',
      'mentre voi fate lezione, noi teniamo calda la diretta.',
      'le {ora}. concentrazione. la musica dopo.',
      'mattina piena. il sito resta qui, quando hai un minuto.',
      'seconda ora, terza ora. il tempo a scuola ha un ritmo tutto suo.',
      'le {ora}. qualcuno sta interrogando qualcun altro. coraggio.',
      'si studia. la radio fa da sottofondo a chi può.'
    ,
      'le {ora}. in aula il telefono sta in tasca. la radio aspetta.',
      'prima ora: la più lunga di tutte.',
      'le {ora}. qualcuno sta già guardando l\'orologio.',
      'si studia. noi teniamo il posto.',
      'le {ora}. se sei qui invece che in classe, non lo diciamo a nessuno.',
      'mattina piena. la musica torna all\'intervallo.',
      'le {ora}. i professori ci ascoltano? dicono di no.',
      'seconda ora. tieni duro.'
    ] },
    { da: 10, a: 12, frasi: [
      'le {ora}. tra poco intervallo. più o meno.',
      'metà mattina: il momento della merenda.',
      'intervallo in arrivo. dieci minuti valgono un brano o due.',
      'le {ora}. chi ha fame alzi la mano. mentalmente.',
      'la mattina è a metà. si tiene duro.',
      'le {ora}. corridoio pieno, cuffie piene.',
      'quarta ora. resiste chi resiste.',
      'pausa? un brano e si rientra.'
    ,
      'le {ora}. l\'intervallo è il momento più sociale della giornata.',
      'dieci minuti di pausa valgono due brani.',
      'le {ora}. c\'è chi mangia e chi ripassa. e chi fa finta.',
      'corridoi pieni, cuffie piene.',
      'le {ora}. quarta ora: la resistenza è una virtù.',
      'metà mattina. da qui in giù è discesa.',
      'le {ora}. qualcuno sta già pensando a cosa fa dopo.',
      'il distributore è sempre guasto. lo sappiamo anche noi.'
    ] },
    { da: 12, a: 14, frasi: [
      'le {ora}. ultime ore, ultimi sforzi.',
      'si avvicina l\'uscita. la diretta ti aspetta al cancello.',
      'le {ora}. chi esce adesso, buon pranzo.',
      'fine lezioni per qualcuno. per altri, ancora un po\'.',
      'mezzogiorno passato. il pomeriggio è lì.',
      'le {ora}. zaino in spalla, cuffie in testa.',
      'si torna a casa. il tragitto è della radio.',
      'uscita. oggi com\'è andata? non rispondere, metti un brano.'
    ,
      'le {ora}. ultime due ore, poi liberi.',
      'si avvicina l\'uscita: la playlist è pronta.',
      'le {ora}. chi ha finito, buon pranzo.',
      'campanella in arrivo. il resto lo fa la musica.',
      'le {ora}. il tragitto di ritorno è il momento migliore per ascoltare.',
      'mezzogiorno passato: la giornata cambia marcia.',
      'le {ora}. oggi com\'è andata? raccontalo a qualcuno.',
      'usciti. adesso si decide cosa fare del pomeriggio.'
    ] },
    { da: 14, a: 16, frasi: [
      'le {ora}. pranzo fatto, compiti in vista.',
      'primo pomeriggio. la musica aiuta, se è quella giusta.',
      'le {ora}. un\'ora di studio, un brano di pausa. si può fare.',
      'pomeriggio. le dirette dalla regia iniziano a scaldarsi.',
      'le {ora}. il momento più lento della giornata.',
      'compiti e musica, nell\'ordine che preferisci.',
      'dopo pranzo: un po\' di energia non guasta.',
      'le {ora}. se ti serve concentrazione, prova l\'esplora.'
    ,
      'le {ora}. pranzo finito, libri aperti. teoricamente.',
      'primo pomeriggio: il momento in cui si rimanda tutto.',
      'le {ora}. venticinque minuti di studio e una pausa. funziona.',
      'pomeriggio. se devi concentrarti, prova l\'esplora.',
      'le {ora}. chi ha allenamento è già in ritardo.',
      'dopo pranzo serve una spinta. ci pensiamo noi.',
      'le {ora}. i compiti non si fanno da soli. purtroppo.',
      'pomeriggio lento. la musica lo rende sopportabile.'
    ] },
    { da: 16, a: 18, frasi: [
      'le {ora}. pomeriggio pieno: allenamenti, lezioni, compiti.',
      'merenda del pomeriggio. sì, esiste anche questa.',
      'le {ora}. pausa dallo studio: cinque minuti di diretta.',
      'il pomeriggio va avanti. la radio pure.',
      'le {ora}. chi esce, chi resta, chi studia. tutti in onda.',
      'luce che cala, playlist che sale.',
      'le {ora}. ancora un esercizio e poi basta.',
      'pomeriggio tardo. il momento delle idee migliori.'
    ,
      'le {ora}. il pomeriggio è il momento delle idee migliori.',
      'merenda, compiti, prove. in qualche ordine.',
      'le {ora}. in regia qualcuno sta preparando la prossima diretta.',
      'la luce cala, il volume sale.',
      'le {ora}. ancora un esercizio, poi basta davvero.',
      'pomeriggio pieno: scuola finita, giornata no.',
      'le {ora}. chi suona, chi studia, chi ascolta. tutti qui.',
      'quasi sera. il momento buono per scoprire un pezzo nuovo.'
    ] },
    { da: 18, a: 20, frasi: [
      'le {ora}. tramonto su Roma, o almeno da qualche parte.',
      'sera in arrivo. la giornata si fa più leggera.',
      'le {ora}. cena tra un po\'. un brano intanto.',
      'si stacca. la radio di sera è un\'altra cosa.',
      'le {ora}. compiti finiti? se sì, complimenti.',
      'luci accese, volume giusto.',
      'le {ora}. il momento di raccontare com\'è andata.',
      'sera. qui la diretta continua.'
    ,
      'le {ora}. tramonto, e la giornata si alleggerisce.',
      'sera che arriva. la radio cambia tono.',
      'le {ora}. cena fra poco: un ultimo brano.',
      'si stacca. finalmente.',
      'le {ora}. se hai finito i compiti, bravo. se no, pazienza.',
      'luci accese in casa, luci accese in studio.',
      'le {ora}. è l\'ora in cui si racconta la giornata.',
      'prima serata: qui si ascolta meglio.'
    ] },
    { da: 20, a: 22, frasi: [
      'le {ora}. cena fatta, divano vicino.',
      'prima serata. musica per non pensare a domani.',
      'le {ora}. un brano tranquillo prima di preparare lo zaino.',
      'sera. il palinsesto di domani è già on line, se ti interessa.',
      'le {ora}. qualcuno ripassa, qualcuno ascolta. anche entrambi.',
      'la giornata è quasi finita. bene così.',
      'le {ora}. chiudi i libri, apri le orecchie.',
      'sera tranquilla. il volume lo decidi tu.'
    ,
      'le {ora}. divano, cuffie, niente fretta.',
      'sera. il palinsesto di domani è già on line.',
      'le {ora}. un brano tranquillo prima di preparare lo zaino.',
      'prima serata: musica per non pensare a domani.',
      'le {ora}. chi ripassa adesso fa bene. chi ascolta anche.',
      'la giornata è quasi chiusa. bene così.',
      'le {ora}. domani si ricomincia, ma non adesso.',
      'sera tranquilla. il volume lo decidi tu.'
    ] },
    { da: 22, a: 24, frasi: [
      'le {ora}. domani c\'è scuola: ancora un brano e poi a dormire.',
      'tardi. abbassa un po\' il volume, gli altri dormono.',
      'le {ora}. sveglia puntata? controlla.',
      'fine giornata. grazie di essere passato in radio.',
      'le {ora}. l\'ultimo brano lo scegli tu, ma è l\'ultimo.',
      'notte che arriva. luci basse e diretta bassa.',
      'le {ora}. domani si ricomincia. con la radio, possibilmente.',
      'buonanotte da radio carducci. lo stream resta acceso.'
    ,
      'le {ora}. domani c\'è scuola: ancora uno e poi basta.',
      'tardi. abbassa un po\', gli altri dormono.',
      'le {ora}. sveglia puntata? controlla davvero.',
      'fine giornata. grazie di essere passato.',
      'le {ora}. l\'ultimo brano è sempre il più lungo.',
      'notte in arrivo: luci basse e volume basso.',
      'le {ora}. domani ci risentiamo.',
      'buonanotte. lo stream resta acceso lo stesso.'
    ] }
  ];
  const FRASI_WEEKEND = [
    'weekend. niente sveglia, la radio sì.',
    'sabato o domenica: oggi la diretta non ha fretta.',
    'giorno libero. la playlist pure.',
    'weekend: il momento giusto per recuperare i podcast.',
    'oggi niente campanella. musica a volontà.'
  ];

  function fraseOra(d) {
    const h = d.getHours(), s = slot(d);
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    // nel weekend, di giorno, una volta su tre una frase del weekend
    if (weekend && h >= 9 && h < 20 && s % 3 === 0) return FRASI_WEEKEND[(s / 3 + d.getDate()) % FRASI_WEEKEND.length];
    const fascia = FRASI_ORA.find(f => h >= f.da && h < f.a) || FRASI_ORA[0];
    return fascia.frasi[(s + d.getDate()) % fascia.frasi.length].replace('{ora}', clock(d));
  }

  function clock(d) { return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

  function render() {
    if (!box) return;
    const d = new Date();
    box.querySelector('.rc-focus__clock').textContent = clock(d);
    box.querySelector('.rc-focus__date').textContent = (GIORNI[d.getDay()] + ' ' + d.getDate() + ' ' + MESI[d.getMonth()]).toUpperCase();
    const s = slot(d);
    if (box._slot === s && box._hadData === !!data) return;
    box._slot = s;
    box._hadData = !!data;
    box.querySelector('.rc-focus__phrase').textContent = fraseOra(d);
    const v = voce(d) || frasePiano(d);
    box.querySelector('.rc-focus__label').textContent = v.label;
    box.querySelector('.rc-focus__year').textContent = v.year;
    box.querySelector('.rc-focus__text').textContent = v.text;
    box.querySelector('.rc-focus__src').hidden = !data;
    box.classList.remove('rc-focus--cut');
    void box.offsetWidth;
    box.classList.add('rc-focus--cut');
  }

  function start() {
    if (box) return;
    box = document.createElement('aside');
    box.className = 'rc-focus';
    box.setAttribute('aria-live', 'polite');
    box.innerHTML = `
      <div class="rc-focus__clock">--:--</div>
      <div class="rc-focus__date"></div>
      <p class="rc-focus__phrase"></p>
      <div class="rc-focus__entry">
        <span class="rc-focus__label"></span>
        <span class="rc-focus__year"></span>
        <p class="rc-focus__text"></p>
      </div>
      <div class="rc-focus__src" hidden>ALMANACCO · FONTE: WIKIPEDIA</div>`;
    document.body.appendChild(box);
    render();
    load(new Date()).then(() => { box && (box._slot = -1); render(); });
    timer = setInterval(() => {
      const d = new Date();
      if (d.getHours() === 0 && d.getMinutes() === 0) load(d).then(render);
      render();
    }, 1000);
  }

  function stop() {
    clearInterval(timer);
    timer = null;
    if (box) box.remove();
    box = null;
  }

  function init() {
    // la modalità Esplora mette la classe theme-explore sul body
    new MutationObserver(() => {
      document.body.classList.contains('theme-explore') ? start() : stop();
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  window.RCFocus = { parse, load, voce };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
