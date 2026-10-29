/* ============================================================
   RADIO CARDUCCI — LO STUDIO IN 3D
   Una stanza che si gira e si esplora, con i punti cliccabili
   come nella sezione Studi. Non scarica niente finche' non lo
   chiedi tu: il modello e' pesante e si carica a richiesta,
   con la barca del caricamento davanti.
   ============================================================ */
(function () {
  'use strict';

  const URL_MODELLO = 'assets/3d/studio.glb';
  const VER = '0.160.1';

  // Ogni punto si aggancia a un pezzo vero della stanza, per nome.
  const PUNTI = [
    { nodo: 'Piano',    titolo: 'LA TASTIERA',  testo: 'Qui nascono le sigle. Quasi tutte le basi che senti fra un programma e l’altro partono da due accordi suonati male e sistemati dopo.' },
    { nodo: 'Screen',   titolo: 'LA REGIA',     testo: 'Lo schermo con la scaletta: chi parla, quando, e quanto manca alla fine del pezzo. Quando lampeggia rosso, qualcuno ha sforato.' },
    { nodo: 'Sofa',     titolo: 'L’ATTESA', testo: 'Il divano degli ospiti. Chi entra in diretta aspetta qui, di solito ripetendo a mente la prima frase e poi dicendone un’altra.' },
    { nodo: 'TeaTable', titolo: 'LA PAUSA',     testo: 'Il tavolino. Tre minuti di stacco, due bicchieri di plastica, e la scaletta che cambia all’ultimo momento.' }
  ];

  const sez = document.getElementById('studio3d');
  if (!sez) return;

  const palco   = sez.querySelector('.s3d__palco');
  const tela    = sez.querySelector('.s3d__tela');
  const coperta = sez.querySelector('.s3d__coperta');
  const bottone = sez.querySelector('.s3d__entra');
  const strato  = sez.querySelector('.s3d__punti');
  const hud     = sez.querySelector('.s3d__hud');
  const hudTit  = sez.querySelector('.s3d__hud-tit');
  const hudTxt  = sez.querySelector('.s3d__hud-txt');
  const chiudiHud = sez.querySelector('.s3d__hud-chiudi');
  if (!tela || !bottone) return;

  let avviato = false;

  bottone.addEventListener('click', () => {
    if (avviato) return;
    avviato = true;
    bottone.disabled = true;
    bottone.textContent = 'UN MOMENTO';
    avvia().catch(err => {
      avviato = false;
      bottone.disabled = false;
      bottone.textContent = 'RIPROVA';
      coperta.querySelector('.s3d__coperta-nota').textContent =
        'Non siamo riusciti a caricare la stanza. Controlla la connessione.';
      if (window.RCCarico) RCCarico.chiudi();
      console.error('[studio3d]', err);
    });
  });

  async function avvia() {
    if (window.RCCarico) RCCarico.apri().progresso(0.02);

    const THREE = await import('https://cdn.jsdelivr.net/npm/three@' + VER + '/build/three.module.js');
    const { GLTFLoader } = await import('https://cdn.jsdelivr.net/npm/three@' + VER + '/examples/jsm/loaders/GLTFLoader.js');
    const { OrbitControls } = await import('https://cdn.jsdelivr.net/npm/three@' + VER + '/examples/jsm/controls/OrbitControls.js');
    if (window.RCCarico) RCCarico.progresso(0.12);

    const render = new THREE.WebGLRenderer({ canvas: tela, antialias: true, alpha: false });
    render.setPixelRatio(Math.min(2, devicePixelRatio));
    render.outputColorSpace = THREE.SRGBColorSpace;
    render.toneMapping = THREE.ACESFilmicToneMapping;
    render.toneMappingExposure = 1.05;

    const scena = new THREE.Scene();
    scena.background = new THREE.Color(0x1e1e1e);

    const cam = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 500);
    const ctrl = new OrbitControls(cam, tela);
    ctrl.enableDamping = true;
    ctrl.dampingFactor = 0.06;
    ctrl.enablePan = false;
    ctrl.minPolarAngle = 0.55;
    ctrl.maxPolarAngle = 1.52;   // non si va sotto il pavimento
    ctrl.rotateSpeed = 0.5;
    ctrl.zoomSpeed = 0.7;

    // luci: niente fronzoli, la stanza ha gia' le sue texture
    scena.add(new THREE.HemisphereLight(0xffffff, 0x404048, 2.1));
    const sole = new THREE.DirectionalLight(0xffffff, 1.5);
    sole.position.set(4, 8, 6);
    scena.add(sole);
    const contro = new THREE.DirectionalLight(0xdb3849, 0.5);
    contro.position.set(-6, 3, -5);
    scena.add(contro);

    const gltf = await new Promise((ok, no) => {
      new GLTFLoader().load(URL_MODELLO, ok, ev => {
        if (ev.total && window.RCCarico) RCCarico.progresso(0.12 + (ev.loaded / ev.total) * 0.82);
      }, no);
    });

    const stanza = gltf.scene;
    scena.add(stanza);

    // inquadratura: si parte vedendo tutta la stanza
    const box = new THREE.Box3().setFromObject(stanza);
    const centro = box.getCenter(new THREE.Vector3());
    const dim = box.getSize(new THREE.Vector3());
    const raggio = Math.max(dim.x, dim.y, dim.z);
    ctrl.target.copy(centro);
    // si parte vicini, quasi dentro la stanza: deve sembrare di entrarci
    ctrl.target.y = box.min.y + dim.y * 0.38;
    cam.position.set(centro.x + raggio * 0.5, centro.y + raggio * 0.3, centro.z + raggio * 0.5);
    ctrl.minDistance = raggio * 0.18;
    ctrl.maxDistance = raggio * 1.1;
    ctrl.update();

    // i punti: uno per ogni pezzo che abbiamo qualcosa da dire
    const vivi = [];
    PUNTI.forEach((p, i) => {
      const nodo = stanza.getObjectByName(p.nodo);
      if (!nodo) return;
      const b = new THREE.Box3().setFromObject(nodo);
      const pos = b.getCenter(new THREE.Vector3());
      pos.y = b.max.y;                      // il punto sta sopra l'oggetto

      const seg = document.createElement('button');
      seg.type = 'button';
      seg.className = 's3d__punto';
      seg.innerHTML = '<span class="s3d__punto-n">' + (i + 1) + '</span>' +
                      '<span class="s3d__punto-t">' + p.titolo + '</span>';
      seg.addEventListener('click', () => {
        mostraHud(p);
        vaiA(pos, b);
        vivi.forEach(v => v.seg.classList.toggle('is-on', v.seg === seg));
      });
      strato.appendChild(seg);
      vivi.push({ seg: seg, pos: pos, box: b, dati: p });
    });

    function mostraHud(p) {
      hudTit.textContent = p.titolo;
      hudTxt.textContent = p.testo;
      hud.classList.add('is-on');
    }
    chiudiHud.addEventListener('click', () => {
      hud.classList.remove('is-on');
      vivi.forEach(v => v.seg.classList.remove('is-on'));
    });

    // spostamento di camera: secco, senza rimbalzi, come il resto
    let volo = null;
    function vaiA(pos, b) {
      const d = Math.max(b.getSize(new THREE.Vector3()).length() * 1.6, raggio * 0.4);
      const dir = new THREE.Vector3().subVectors(cam.position, ctrl.target).normalize();
      volo = {
        t: 0,
        daT: ctrl.target.clone(), aT: pos.clone(),
        daP: cam.position.clone(), aP: pos.clone().add(dir.multiplyScalar(d))
      };
    }

    function misura() {
      const r = palco.getBoundingClientRect();
      render.setSize(r.width, r.height, false);
      cam.aspect = r.width / Math.max(1, r.height);
      cam.updateProjectionMatrix();
    }
    misura();
    addEventListener('resize', misura, { passive: true });

    // i punti seguono la stanza mentre gira
    const v = new THREE.Vector3();
    function piazzaPunti() {
      const r = palco.getBoundingClientRect();
      vivi.forEach(p => {
        v.copy(p.pos).project(cam);
        const dietro = v.z > 1;
        p.seg.style.transform = 'translate3d(' +
          ((v.x * 0.5 + 0.5) * r.width).toFixed(1) + 'px,' +
          ((-v.y * 0.5 + 0.5) * r.height).toFixed(1) + 'px,0)';
        p.seg.style.opacity = dietro ? '0' : '1';
        p.seg.style.pointerEvents = dietro ? 'none' : 'auto';
      });
    }

    let fermo = 0, ultimo = performance.now();
    ctrl.addEventListener('start', () => { fermo = 0; });
    function giro(ora) {
      const dt = Math.min(50, ora - ultimo) / 1000;
      ultimo = ora;

      if (volo) {
        volo.t = Math.min(1, volo.t + dt * 1.6);
        // stessa curva del resto del sito: parte e arriva secca
        const e = volo.t < 0.5 ? 4 * volo.t ** 3 : 1 - Math.pow(-2 * volo.t + 2, 3) / 2;
        ctrl.target.lerpVectors(volo.daT, volo.aT, e);
        cam.position.lerpVectors(volo.daP, volo.aP, e);
        if (volo.t >= 1) volo = null;
      } else {
        // se nessuno tocca niente, la stanza gira piano da sola
        fermo += dt;
        if (fermo > 4) ctrl.autoRotate = true;
      }
      if (ctrl.autoRotate) ctrl.autoRotateSpeed = 0.35;

      ctrl.update();
      render.render(scena, cam);
      piazzaPunti();
      requestAnimationFrame(giro);
    }
    requestAnimationFrame(giro);

    if (window.RCCarico) { RCCarico.progresso(1); RCCarico.chiudi(); }
    palco.classList.add('is-vivo');
    coperta.hidden = true;
  }
})();
