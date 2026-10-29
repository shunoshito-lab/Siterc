/* ============================================================
   RADIO CARDUCCI — SPIGOLO E IL GATTO, IN 3D
   Una tela sola sopra tutta la pagina. Dentro ci stanno il
   pappagallo (costruito a poligoni sui nostri colori) e il gatto
   (modello low poly con la sua corsa). Si muovono con lo stesso
   cervello delle versioni piatte: se il 3D non parte, restano
   quelle e non si rompe niente.
   ============================================================ */
(function () {
  'use strict';

  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = matchMedia('(pointer: fine)').matches;
  if (REDUCED || !FINE) return;

  const VER = '0.160.1';
  const GATTO = 'assets/3d/gatto/scene.gltf';
  const ROSSO = 0xdb3849, CUPO = 0x991c3b, OSSO = 0xf4f4f5, INCHIOSTRO = 0x1e1e1e;

  let THREE, scena, cam, render, tela, mixer, orologio;
  let spigolo = null, ali = null, gatto = null, corsa = null;

  function haWebGL() {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  }

  // ── il pappagallo, costruito a mano ───────────────────────
  function costruisciSpigolo() {
    const g = new THREE.Group();
    const mat = c => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
    const rosso = mat(ROSSO), cupo = mat(CUPO), osso = mat(OSSO), ink = mat(INCHIOSTRO);

    // corpo: un icosaedro schiacciato, facce piatte
    const corpo = new THREE.Mesh(new THREE.IcosahedronGeometry(12, 0), rosso);
    corpo.scale.set(1, 1.35, 0.95);
    g.add(corpo);

    // petto chiaro
    const petto = new THREE.Mesh(new THREE.IcosahedronGeometry(8, 0), osso);
    petto.scale.set(0.9, 1.25, 0.7);
    petto.position.set(1, -2, 7);
    g.add(petto);

    // testa
    const testa = new THREE.Group();
    testa.position.set(0, 14, 2);
    const cranio = new THREE.Mesh(new THREE.IcosahedronGeometry(8, 0), rosso);
    testa.add(cranio);

    // becco uncinato: due coni
    const b1 = new THREE.Mesh(new THREE.ConeGeometry(4, 9, 5), osso);
    b1.rotation.set(Math.PI / 2.1, 0, 0);
    b1.position.set(0, -1, 8);
    testa.add(b1);
    const b2 = new THREE.Mesh(new THREE.ConeGeometry(2.6, 5, 5), ink);
    b2.rotation.set(Math.PI * 0.78, 0, 0);
    b2.position.set(0, -4.5, 9);
    testa.add(b2);

    // cresta: tre penne all'indietro
    [[0, 7, -1, 0.18], [0, 7.5, -4, 0.5], [0, 6, -6.5, 0.9]].forEach((c, i) => {
      const p = new THREE.Mesh(new THREE.ConeGeometry(2.2, 9 - i * 1.4, 4), i === 1 ? osso : cupo);
      p.position.set(c[0], c[1], c[2]);
      p.rotation.x = -c[3];
      testa.add(p);
    });

    // occhi
    [-1, 1].forEach(lato => {
      const bianco = new THREE.Mesh(new THREE.SphereGeometry(2.6, 8, 6), osso);
      bianco.position.set(lato * 5.2, 1.5, 5.2);
      testa.add(bianco);
      const pupilla = new THREE.Mesh(new THREE.SphereGeometry(1.4, 6, 5), ink);
      pupilla.position.set(lato * 5.6, 1.5, 7);
      testa.add(pupilla);
    });
    g.add(testa);

    // ali: due pale che battono
    // ala: un cono a quattro facce, schiacciato e rastremato verso la punta
    const alaGeo = new THREE.ConeGeometry(7, 26, 4);
    alaGeo.rotateZ(Math.PI / 2);
    alaGeo.scale(1, 0.34, 1);
    const coppia = [];
    [-1, 1].forEach(lato => {
      const perno = new THREE.Group();
      perno.position.set(lato * 9, 3, 0);
      const ala = new THREE.Mesh(alaGeo, cupo);
      ala.position.x = lato * 13;
      ala.rotation.y = lato > 0 ? 0 : Math.PI;   // la punta guarda in fuori
      ala.rotation.z = -lato * 0.12;
      perno.add(ala);
      g.add(perno);
      coppia.push({ perno: perno, lato: lato });
    });

    // coda
    const coda = new THREE.Mesh(new THREE.ConeGeometry(5, 20, 4), cupo);
    coda.rotation.x = Math.PI * 0.42;
    coda.position.set(0, -13, -9);
    g.add(coda);

    // zampe
    [-1, 1].forEach(lato => {
      const z = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 8, 5), osso);
      z.position.set(lato * 3.5, -18, 2);
      g.add(z);
    });

    g.userData.testa = testa;
    return { nodo: g, ali: coppia };
  }

  // ── la scena ───────────────────────────────────────────────
  async function avvia() {
    if (!haWebGL()) return;
    THREE = await import('https://cdn.jsdelivr.net/npm/three@' + VER + '/build/three.module.js');
    const { GLTFLoader } = await import('https://cdn.jsdelivr.net/npm/three@' + VER + '/examples/jsm/loaders/GLTFLoader.js');

    tela = document.createElement('canvas');
    tela.className = 'm3d';
    document.body.appendChild(tela);

    render = new THREE.WebGLRenderer({ canvas: tela, alpha: true, antialias: true });
    render.setPixelRatio(Math.min(2, devicePixelRatio));
    render.outputColorSpace = THREE.SRGBColorSpace;

    scena = new THREE.Scene();
    scena.add(new THREE.HemisphereLight(0xffffff, 0x303038, 2.4));
    const luce = new THREE.DirectionalLight(0xffffff, 1.6);
    luce.position.set(-0.4, 1, 0.8);
    scena.add(luce);
    const rimbalzo = new THREE.DirectionalLight(ROSSO, 0.7);
    rimbalzo.position.set(0.8, -0.3, 0.5);
    scena.add(rimbalzo);

    // camera tarata sui pixel: a z=0 un'unita' e' un pixel
    cam = new THREE.PerspectiveCamera(40, 1, 1, 6000);
    misura();
    addEventListener('resize', misura, { passive: true });

    const sp = costruisciSpigolo();
    spigolo = sp.nodo; ali = sp.ali;
    spigolo.scale.setScalar(2.1);   // circa 90 pixel di altezza
    scena.add(spigolo);

    orologio = new THREE.Clock();

    // il gatto: modello con la sua corsa
    new GLTFLoader().load(GATTO, gltf => {
      gatto = gltf.scene;
      // il riquadro dello scheletro e' enorme e bugiardo: misuriamo la maglia
      let alt = 0;
      gatto.updateWorldMatrix(true, true);
      gatto.traverse(n => {
        if (!n.isMesh) return;
        n.geometry.computeBoundingBox();
        const bb = n.geometry.boundingBox.clone().applyMatrix4(n.matrixWorld);
        const d = bb.getSize(new THREE.Vector3());
        alt = Math.max(alt, d.y, d.z);
      });
      gatto.scale.setScalar(86 / (alt || 28));   // alto come prima, 86 pixel
      gatto.traverse(n => {
        if (!n.isMesh) return;
        // il modello arriva grigio: lo vestiamo da Radio Carducci
        n.material = new THREE.MeshLambertMaterial({ color: OSSO, flatShading: true });
      });
      scena.add(gatto);
      if (gltf.animations && gltf.animations.length) {
        mixer = new THREE.AnimationMixer(gatto);
        corsa = mixer.clipAction(gltf.animations[0]);
        corsa.play();
      }
    }, undefined, e => console.warn('[3d] gatto', e));

    document.documentElement.classList.add('rc-3d');   // spegne i disegni piatti
    requestAnimationFrame(giro);
  }

  function misura() {
    const w = innerWidth, h = innerHeight;
    render.setSize(w, h, false);
    cam.aspect = w / h;
    cam.position.z = (h / 2) / Math.tan(cam.fov * Math.PI / 360);
    cam.updateProjectionMatrix();
  }

  // schermo -> mondo: x da sinistra, y dall'alto
  function mx(x) { return x - innerWidth / 2; }
  function my(y) { return innerHeight / 2 - y; }

  let rotPrec = 0;
  function giro() {
    const dt = orologio.getDelta();
    const S = window.RCSpigolo, G = window.RCGatto;

    if (S && spigolo) {
      spigolo.visible = !!S.visto;
      spigolo.position.set(mx(S.x), my(S.y) + 20, 0);

      // rollio e beccheggio presi dalla velocita': in volo si inclina
      const rot = Math.max(-0.5, Math.min(0.5, -S.vx * 0.045));
      rotPrec += (rot - rotPrec) * 0.18;
      spigolo.rotation.z = rotPrec;
      spigolo.rotation.x = Math.max(-0.35, Math.min(0.35, S.vy * 0.03));
      // di profilo quando va, di tre quarti verso chi guarda quando e' posato
      const guarda = S.posato ? 0.4 : (S.vx >= 0 ? 1.25 : -1.25);
      spigolo.rotation.y += (guarda - spigolo.rotation.y) * 0.12;

      const vel = Math.hypot(S.vx || 0, S.vy || 0);
      const battito = S.posato ? 0.1 : 0.45 + Math.min(0.6, vel * 0.04);
      const fase = performance.now() / 1000 * (S.posato ? 2 : 11);
      ali.forEach(a => {
        const apri = S.posato ? 0.12 + Math.sin(fase) * 0.06 : 0.25 + Math.sin(fase) * battito;
        a.perno.rotation.z = -a.lato * apri;
      });
    }

    if (G && gatto) {
      gatto.visible = !!G.visto;
      gatto.position.set(mx(G.x), my(G.y) - 10, -60);
      // di tre quarti, cosi' si vede che e' un volume e non un adesivo
      // di profilo, con un filo di tre quarti: si deve vedere il volume
      const giro = G.verso > 0 ? Math.PI * 0.12 : Math.PI * 0.88;
      gatto.rotation.y += (giro - gatto.rotation.y) * 0.15;
      if (corsa) {
        const v = Math.abs(G.vx || 0);
        corsa.timeScale = Math.max(0.35, Math.min(2.4, v * 0.35));
      }
    }
    if (mixer) mixer.update(dt);

    render.render(scena, cam);
    requestAnimationFrame(giro);
  }

  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', () => avvia().catch(e => console.warn('[3d]', e)));
  else avvia().catch(e => console.warn('[3d]', e));
})();
