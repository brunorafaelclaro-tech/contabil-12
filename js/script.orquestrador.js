// script.orquestrador.js - Orquestrador principal das abas

// Variáveis globais de estado
let year = 2025;
let filtros = {};
let dadosBrutos = {};
let departamentos = {};
let abas = {};

// Carregue os módulos das abas (ajuste para import ou require se usar módulos)
abas = {
  'import-receita': window.AbaImportReceita,
  'import-despesa': window.AbaImportDespesa,
  'import-budget': window.AbaImportBudget,
  'mgmt-fee': window.AbaMgmtFee,
  'import-key-ratios': window.AbaImportKeyRatios,
  'import-key-ratios-budget': window.AbaImportKeyRatiosBudget,
  'import-plano-contas': window.AbaImportPlanoContas,
  'import-balance': window.AbaImportBalance,
  'data': window.AbaData,
  'dre': window.AbaDre,
  'dre-acumulado': window.AbaDreAcumulado,
  'dre-budget-2': window.AbaDreBudget2,
  'dre-departamento': window.AbaDreDepartamento,
  'dre-suecia': window.AbaDreSuecia,
  'margin-analysis': window.AbaMarginAnalysis,
  'export-ocra': window.AbaExportOcra,
  'locks': window.AbaLocks,
  'centros-custo': window.AbaCentrosCusto
};


// Função para montar o contexto dinâmico para cada aba
function getContexto(tabName) {
  // Exemplo: ajuste conforme necessário para cada aba
  const base = {
    year,
    filtros,
    dadosBrutos,
    departamentos,
    data: window.app?.data || [],
    planoContas: window.app?.planoContas || [],
    centrosCusto: window.app?.centrosCusto || [],
    mgmtFees: window.app?.mgmtFees || [],
    mgmtDetailData: window.app?.mgmtDetailData || {},
    keyRatiosData: window.app?.keyRatiosData || [],
    keyRatiosBudgetData: window.app?.keyRatiosBudgetData || [],
    exemptCCs: window.app?.exemptCCs || [],
    saveMgmtDetail: window.app?.saveMgmtDetail?.bind(window.app),
    removeMgmtFee: window.app?.removeMgmtFee?.bind(window.app),
    calcMgmtDetail: window.app?.calcMgmtDetail?.bind(window.app),
    addCentroCusto: (item) => {
      if(window.app?.addCentroCustoFromInputs) window.app.addCentroCustoFromInputs(item);
    },
    removeCentroCusto: window.app?.removeCentroCusto?.bind(window.app)
  };
  // Adicione aqui ajustes específicos por aba se necessário
  return base;
}


function switchTab(tabName, containerId) {
  if (abas[tabName] && typeof abas[tabName].render === 'function') {
    abas[tabName].render(containerId, getContexto(tabName));
  } else {
    document.getElementById(containerId).innerHTML = '<div>Aba não encontrada.</div>';
  }
}

// Exemplo de uso:
// switchTab('dre', 'main-container');
