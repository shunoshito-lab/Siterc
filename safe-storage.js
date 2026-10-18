/* Radio Carducci - storage sicuro.
   Dentro un iframe di un altro dominio (es. il sito mostrato in WordPress) molti browser
   bloccano localStorage/sessionStorage e lanciano un errore che fermerebbe il player.
   Se l'accesso non e' possibile, usiamo una copia in memoria: tutto funziona, senza salvataggio. */
(function () {
  function makeMemory() {
    var data = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
      setItem: function (k, v) { data[k] = String(v); },
      removeItem: function (k) { delete data[k]; },
      clear: function () { data = {}; },
      key: function (i) { return Object.keys(data)[i] || null; },
      get length() { return Object.keys(data).length; }
    };
  }
  ['localStorage', 'sessionStorage'].forEach(function (name) {
    var ok = false;
    try {
      var s = window[name];
      var t = '__rc_test__';
      s.setItem(t, '1'); s.removeItem(t);
      ok = true;
    } catch (e) { ok = false; }
    if (!ok) {
      try { Object.defineProperty(window, name, { value: makeMemory(), configurable: true }); } catch (e) {}
    }
  });
})();
