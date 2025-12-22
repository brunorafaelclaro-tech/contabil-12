// Força a exposição da função diagnoseCentro no global após o carregamento do app
(function() {
  function tryExpose() {
    if (window.app && typeof window.app.diagnoseCentro === 'function') return;
    if (window.app && app.diagnoseCentro) {
      window.app.diagnoseCentro = app.diagnoseCentro;
      console.log('[Diagnóstico] diagnoseCentro exposta no global.');
    } else {
      setTimeout(tryExpose, 500);
    }
  }
  tryExpose();
})();
