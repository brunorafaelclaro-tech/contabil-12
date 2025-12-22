// Template para módulo de aba
const NomeDaAba = {
  render: function(containerId, contexto) {
    // containerId: string do id do container HTML
    // contexto: { year, filtros, dadosBrutos, departamentos }
    document.getElementById(containerId).innerHTML = '<div>Conteúdo da aba</div>';
    // Use o contexto conforme necessário
  }
};
// Para uso global:
window.NomeDaAba = NomeDaAba;
// Para uso com módulos ES6, use:
// export default NomeDaAba;
