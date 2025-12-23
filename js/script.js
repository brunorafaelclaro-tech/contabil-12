// Use localStorage para persistência de dados localmente (sem necessidade de Firestore)
// Esta versão tenta usar window.electron.readJSON/saveJSON (exposto pelo preload.js em Electron).
// Se não disponível, faz fallback para localStorage.

// LEGACY SAFEGUARD: desativa o bloco DRE legado em `js/script.js`.
// As renderizações de DRE agora são feitas por módulos em `js/aba-dre.js` e
// `js/aba-dre-acumulado.js`. Mantivemos o código legado como backup em
// `js/script.js.bak` criado automaticamente. Para reativar o legado, remova
// a linha abaixo ou restaure o backup.
const LEGACY_DRE_DISABLED = true;

// Helper: converte abreviações de mês (pt) em número (Jan->1, Fev->2, ...)
function parseMonthString(raw) {
    if (window.AppUtils && typeof window.AppUtils.parseMonthString === 'function') {
        return window.AppUtils.parseMonthString(raw);
    }
    return null;
}

const app = {
            // Limpa todos os filtros da aba DRE
            clearDREFilters() {
                const ids = [
                    'dre-filter-cc',
                    'dre-filter-dept',
                    'dre-filter-client',
                    'dre-filter-sbd',
                    'dre-filter-proj'
                ];
                ids.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = '';
                });
                this.renderDRE();
            },

            // Limpa todos os filtros da aba DRE Acumulado
            clearDREAcumuladoFilters() {
                const ids = [
                    'dre-acc-cc',
                    'dre-acc-dept',
                    'dre-acc-client',
                    'dre-acc-sbd',
                    'dre-acc-proj'
                ];
                ids.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = '';
                });
                this.renderDREAcumulado();
            },

            // Limpa todos os filtros da aba DRE Budget-2
            clearDREBudget2Filters() {
                const ids = [
                    'dre-b2-cc',
                    'dre-b2-dept',
                    'dre-b2-client',
                    'dre-b2-sbd',
                    'dre-b2-proj'
                ];
                ids.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = '';
                });
                this.renderDREBudget2();
            },
        // Limpa todos os filtros da aba Margem
        clearMarginFilters() {
            const ids = [
                'margin-filter-cc',
                'margin-filter-dept',
                'margin-filter-client',
                'margin-filter-sbd',
                'margin-filter-proj'
            ];
            ids.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            this.renderMarginAnalysis();
        },
    data: [],
    centrosCusto: [], // Lista de centros de custo (Project ID mapping)
    planoContas: [], 
    balanceData: [], // Dados de Balanço e Pos EBIT
    locks: [], 
    mgmtFees: [], 
    mgmtDetailData: {}, // Dados detalhados de Management Fee (Ocra/Calc)
    _mgmtSaveTimer: null,
    ocraConfig: [], // Configuração de Cadastro OCRA (Lista de objetos)
    exemptCCs: [], 
    // keyRatiosData: [], // Substituído por DataAPI.getKeyRatiosData/app.keyRatiosData
        keyRatiosBudgetData: [],
        // Configurável: contas do Budget que devem sempre ser tratadas como RECEITA (forçar classificação)
        budgetRevenueAccounts: [],
        // Contas permitidas como receita quando departamento === 'ADM'
        admRevenueAllowedAccounts: ['1899','1902','1945','1953','1961','3204','3212'],
    tempData: [], 
    currentImportType: 'KeyRatios', 
    currentDREExportData: [], 
    currentDREAcumuladoExportData: [],
    marginExclusionFilter: [], 
    isAdmAllocationEnabled: false, // Estado do botão de rateio ADM
    isAdmAllocationSueciaEnabled: false, // Estado do botão de rateio ADM Suécia

    // Layout do DRE Departamento
    dreDeptLayout: [
        { type: 'account', code: '3010', description: 'Consultant fees external' },
        { type: 'account', code: '3556', description: 'Consultant fees within own Business Area' },
        { type: 'account', code: '3557', description: 'Consultant fees to other Business Area' },
        { type: 'account', code: '3015', description: 'Write- up/down of fees' },
        { type: 'account', code: '3095', description: 'Provision not invoiced WIP' },
        { type: 'account', code: '3019', description: 'Fee other dep. within same comp.' },
        { type: 'account', code: '3018', description: 'Costs other dep. within same comp.' },
        { type: 'account', code: '3030', description: 'Subcontractor fees' },
        { type: 'account', code: '3204', description: 'Tax on revenue (Dynamic)' },
        { type: 'total', description: 'Total Revenue', bg: 'bg-yellow-100', id: 'total_revenue' },
        { type: 'account', code: '3413', description: 'Computers within projects' },
        { type: 'account', code: '3040', description: 'Travel expenses, outlay' },
        { type: 'account', code: '3050', description: 'Recharged expenses' },
        { type: 'account', code: '3110', description: 'Training' },
        { type: 'account', code: '3521', description: 'Sales of computers' },
        { type: 'account', code: '3910', description: 'Rents' },
        { type: 'account', code: '3510', description: 'Machinery fees' },
        { type: 'account', code: '32101', description: 'Licences' },
        { type: 'account', code: '3960', description: 'Exchange profit from business' },
        { type: 'account', code: '3973', description: 'Capital gains on fixed assets' },
        { type: 'account', code: '3900', description: 'Other income' },
        { type: 'total', description: 'Total Other Income', bg: 'bg-yellow-100', id: 'total_other_income' },
        { type: 'calculation', description: 'TOTAL INCOME', bg: 'bg-green-100', formula: 'total_revenue + total_other_income', id: 'total_income' },
        { type: 'header', description: 'Production costs' },
        { type: 'account', code: '7210', description: 'Salary consultants' },
        { type: 'account', code: '7200', description: 'Social Security' },
        { type: 'account', code: '7500', description: 'Statutory and Social Security contributions' },
        { type: 'account', code: '74001', description: 'Other personnel costs, consultants' },
        { type: 'account', code: '4619', description: 'Subcontractors from group comp.' },
        { type: 'account', code: '4110', description: 'Subcontractors' },
        { type: 'account', code: '4200', description: 'Machinery costs' },
        { type: 'account', code: '4040', description: 'Licence costs' },
        { type: 'account', code: '4211', description: 'Costs for computers in projects' },
        { type: 'account', code: '4550', description: 'Outlay/expenses projects' },
        { type: 'account', code: '4670', description: 'Material cost to customers' },
        { type: 'account', code: '4630', description: 'Computer software' },
        { type: 'account', code: '4223', description: 'Operating costs test' },
        { type: 'account', code: '4185', description: 'Education/training costs' },
        { type: 'account', code: '6624', description: 'Microsoft Licence' },
        { type: 'account', code: '4022', description: 'Cost of computers for sale' },
        { type: 'account', code: '4730', description: 'Other production costs' },
        { type: 'total', description: 'Total production costs', bg: 'bg-yellow-100', id: 'total_prod_costs' },
        { type: 'calculation', description: 'GROSS PROFIT', bg: 'bg-green-100', formula: 'total_income + total_prod_costs', id: 'gross_profit' },
        { type: 'account', code: '7110', description: 'Salary administration' },
        { type: 'account', code: '7199', description: 'Manager bonus' },
        { type: 'account', code: '7002', description: 'Salary salesmen' },
        { type: 'account', code: '7003', description: 'Salary leaders' },
        { type: 'account', code: '7004', description: 'Social Security' },
        { type: 'account', code: '7400', description: 'Other personnel costs' },
        { type: 'account', code: '5010', description: 'Office rental costs' },
        { type: 'account', code: '6110', description: 'Office expenses' },
        { type: 'account', code: '6300', description: 'Insurance and other riskrelated costs' },
        { type: 'account', code: '6500', description: 'Consultants and external services' },
        { type: 'account', code: '6200', description: 'Communication' },
        { type: 'account', code: '7615', description: 'Vehicle costs' },
        { type: 'account', code: '5900', description: 'Sales and marketing costs' },
        { type: 'account', code: '6354', description: 'Provision doubtful debts' },
        { type: 'account', code: '6352', description: 'Reserve high risk debts' },
        { type: 'account', code: '7960', description: 'Exchange loss from business' },
        { type: 'account', code: '6990', description: 'Other costs' },
        { type: 'account', code: '6998', description: 'Reversal One-off costs' },
        { type: 'account', code: '6999', description: 'One-off costs' },
        { type: 'account', code: '7973', description: 'Capital losses on fixed assets' },
        { type: 'total', description: 'Total administration costs', bg: 'bg-yellow-100', id: 'total_admin_costs' },
        { type: 'header', description: 'Depreciation' },
        { type: 'account', code: '7860', description: 'Depreciation intangible assets' },
        { type: 'account', code: '7850', description: 'Depreciation tangible assets' },
        { type: 'account', code: '7840', description: 'Depreciation intangible assets' },
        { type: 'account', code: '7830', description: 'Depreciation tangible assets' },
        { type: 'total', description: 'Total depreciation', bg: 'bg-yellow-100', id: 'total_depreciation' },
        { type: 'calculation', description: 'PROFIT BEFORE SaS', bg: 'bg-green-100', formula: 'gross_profit + total_admin_costs + total_depreciation', id: 'profit_before_sas' },
        { type: 'account', code: '6430', description: 'Management fee Semcon AB' },
        { type: 'account', code: '7981', description: 'Shared Service fee' },
        { type: 'account', code: '6435', description: 'Management fee Reduciton' },
        { type: 'account', code: '6436', description: 'Internal Business Area OH' },
        { type: 'account', code: '6437', description: 'Internal Region OH' },
        { type: 'account', code: '7994', description: 'Other management fees' },
        { type: 'total', description: 'Total SaS', bg: 'bg-yellow-100', id: 'total_sas' },
        { type: 'calculation', description: 'EBIT', bg: 'bg-green-100', formula: 'profit_before_sas + total_sas', id: 'ebit' },
        { type: 'account', code: '8010', description: 'Dividend from group companies' },
        { type: 'account', code: '8022', description: 'Result from sale of group companies' },
        { type: 'account', code: '8300', description: 'Interest income' },
        { type: 'account', code: '8360', description: 'Interest income, group companies' },
        { type: 'account', code: '8331', description: 'Exchange profit from financing' },
        { type: 'account', code: '8390', description: 'Other financial income' },
        { type: 'total', description: 'Total financial income', bg: 'bg-yellow-100', id: 'total_fin_income' },
        { type: 'account', code: '8072', description: 'Write-down of assets in group companies' },
        { type: 'account', code: '8400', description: 'Interest expenses' },
        { type: 'account', code: '8412', description: 'Interest expenses pension obligations' },
        { type: 'account', code: '8460', description: 'Interest expenses, group companies' },
        { type: 'account', code: '8436', description: 'Exchange loss from financing' },
        { type: 'account', code: '8490', description: 'Other financial expenses' },
        { type: 'total', description: 'Total financial expenses', bg: 'bg-yellow-100', id: 'total_fin_expenses' },
        { type: 'calculation', description: 'Finance net', bg: 'bg-green-100', formula: 'total_fin_income + total_fin_expenses', id: 'finance_net' },
        // { type: 'calculation', description: 'PROFIT AFTER FINANCIAL ITEMS', bg: 'bg-green-100', formula: 'ebit + finance_net', id: 'profit_after_fin' },
        { type: 'account', code: '8893', description: 'Contribution from/to group companies' },
        { type: 'account', code: '8820', description: 'Centrally approved items Semcon Operative fee' },
        { type: 'account', code: '8821', description: 'Centrally approved items Internal Business fee' },
        { type: 'account', code: '8828', description: 'Centrally approved items Legal Service fee' },
        { type: 'account', code: '8829', description: 'Centrally approved items Other' },
        { type: 'account', code: '8890', description: 'Other appropriations' },
        { type: 'total', description: 'Total appropriations', bg: 'bg-yellow-100', id: 'total_appropriations' },
        // { type: 'calculation', description: 'PROFIT BEFORE TAXES', bg: 'bg-green-100', formula: 'profit_after_fin + total_appropriations', id: 'profit_before_taxes' },
        { type: 'account', code: '8910', description: 'Current tax' },
        { type: 'account', code: '8935', description: 'WHT (Whithold tax)' },
        { type: 'account', code: '8940', description: 'Deferred tax' },
        { type: 'account', code: '8980', description: 'Other tax' },
        { type: 'total', description: 'Total tax', bg: 'bg-yellow-100', id: 'total_tax' },
        { type: 'calculation', description: 'Net profit or loss for the year', bg: 'bg-green-100', formula: 'ebit + finance_net + total_appropriations + total_tax', id: 'net_profit' },
        { type: 'header', description: 'ASSETS', bg: 'bg-blue-100' },
        { type: 'header', description: 'Fixed assets' },
        { type: 'header', description: 'Intangible assets' },
        { type: 'account', code: '1070', description: 'Goodwill' },
        { type: 'account', code: '1040', description: 'Other intangible assets' },
        { type: 'total', description: 'Total intangible assets', bg: 'bg-yellow-100', id: 'total_intangible' },
        { type: 'header', description: 'Tangible assets' },
        { type: 'account', code: '1110', description: 'Buildings and land' },
        { type: 'account', code: '1230', description: 'Plant and machinery' },
        { type: 'account', code: '1210', description: 'Equipment' },
        { type: 'account', code: '1220', description: 'Computers' },
        { type: 'total', description: 'Total tangible assets', bg: 'bg-yellow-100', id: 'total_tangible' },
        { type: 'header', description: 'Financial assets' },
        { type: 'account', code: '1312', description: 'Shares in group companies' },
        { type: 'account', code: '1315', description: 'Shares in associated companies' },
        { type: 'account', code: '1370', description: 'Deferred tax assets' },
        { type: 'account', code: '1360', description: 'Long-term receivables group companies' },
        { type: 'account', code: '1388', description: 'Other financial assets' },
        { type: 'total', description: 'Total financial assets', bg: 'bg-yellow-100', id: 'total_financial_assets' },
        { type: 'calculation', description: 'Total fixed assets', bg: 'bg-yellow-100', formula: 'total_intangible + total_tangible + total_financial_assets', id: 'total_fixed_assets' },
        { type: 'header', description: 'Current assets' },
        { type: 'account', code: '1510', description: 'Accounts receivable, external' },
        { type: 'account', code: '1560', description: 'Accounts receivable, group companies' },
        { type: 'account', code: '1565', description: 'Accounts receivable, Ratos group companies' },
        { type: 'account', code: '1400', description: 'Inventories' },
        { type: 'account', code: '1470', description: 'Work in progress' },
        { type: 'account', code: '1640', description: 'Current tax receivable' },
        { type: 'account', code: '1600', description: 'Other current receivables, employees' },
        { type: 'account', code: '1689', description: 'Other current receivables, external' },
        { type: 'account', code: '1660', description: 'Other current receivables, group companies' },
        { type: 'account', code: '1790', description: 'Prepaid expenses and accrued income' },
        { type: 'total', description: 'Total current assets excl. cash', bg: 'bg-yellow-100', id: 'total_current_excl_cash' },
        { type: 'account', code: '1960', description: 'Cash pool receivables, group companies' },
        { type: 'account', code: '1800', description: 'Short-term financial investments' },
        { type: 'account', code: '1930', description: 'Cash and bank' },
        { type: 'total', description: 'Total cash and bank equivalent', bg: 'bg-yellow-100', id: 'total_cash_bank' },
        { type: 'calculation', description: 'Total current assets', bg: 'bg-yellow-100', formula: 'total_current_excl_cash + total_cash_bank', id: 'total_current_assets' },
        { type: 'calculation', description: 'TOTAL ASSETS', bg: 'bg-green-100', formula: 'total_fixed_assets + total_current_assets', id: 'total_assets' },
        { type: 'header', description: 'SHAREHOLDERS\' EQUITY AND LIABILITIES', bg: 'bg-blue-100' },
        { type: 'header', description: 'Shareholders\' equity' },
        { type: 'header', description: 'Restricted equity' },
        { type: 'account', code: '2081', description: 'Share capital' },
        { type: 'account', code: '2086', description: 'Restricted reserves' },
        { type: 'header', description: 'Non-restricted equity' },
        { type: 'account', code: '2090', description: 'Profit brought forward' },
        { type: 'account', code: '2099', description: 'Net profit or loss for the year' },
        { type: 'account', code: '2200', description: 'Minority interest' },
        { type: 'total', description: 'Total shareholders\' equity', bg: 'bg-yellow-100', id: 'total_equity' },
        { type: 'account', code: '2190', description: 'Untaxed reserves' },
        { type: 'total', description: 'Total untaxed reserves', bg: 'bg-yellow-100', id: 'total_untaxed_reserves' },
        { type: 'header', description: 'Long-term liabilities' },
        { type: 'account', code: '2520', description: 'Deferred tax liabilities' },
        { type: 'account', code: '2270', description: 'Pension obligations' },
        { type: 'account', code: '2280', description: 'Other long-term provisions' },
        { type: 'account', code: '2352', description: 'Other long-term interest-bearing liabilities' },
        { type: 'account', code: '2390', description: 'Other long-term non interest-bearing liabilities' },
        { type: 'account', code: '2360', description: 'Other long-term liabilities, group companies' },
        { type: 'total', description: 'Total long-term liabilities', bg: 'bg-yellow-100', id: 'total_long_term_liab' },
        { type: 'header', description: 'Current liabilities' },
        { type: 'account', code: '2843', description: 'Cash pool liabilities, group companies' },
        { type: 'account', code: '2842', description: 'Overdraft facilities, external' },
        { type: 'account', code: '2841', description: 'Other current interest-bearing liabilities' },
        { type: 'account', code: '2440', description: 'Accounts payable, external' },
        { type: 'account', code: '2460', description: 'Accounts payable, group companies' },
        { type: 'account', code: '2510', description: 'Current tax liabilities' },
        { type: 'account', code: '2420', description: 'Advance payments from customers' },
        { type: 'account', code: '2700', description: 'Other current liabilities, employees' },
        { type: 'account', code: '2890', description: 'Other current liabilities, external' },
        { type: 'account', code: '2840', description: 'Loans' },
        { type: 'account', code: '2860', description: 'Other current liabilities, group companies' },
        { type: 'account', code: '2290', description: 'Other current provisions' },
        { type: 'account', code: '2902', description: 'Accrued expenses, employees & subcontractors' },
        { type: 'account', code: '2990', description: 'Accrued expenses and prepaid income' },
        { type: 'total', description: 'Total current liabilities', bg: 'bg-yellow-100', id: 'total_current_liab' },
        { type: 'calculation', description: 'TOTAL SHAREHOLDERS\' EQUITY AND LIABILITIES', bg: 'bg-blue-200', formula: 'total_equity + total_untaxed_reserves + total_long_term_liab + total_current_liab', id: 'total_equity_liab' }
    ],

    // Definição das Contas para Categorização
    custoAccounts: [
        2925, 2933, 2941, 2950, 2968, 2976, 2984, 2992, 3000, 3018, 
        3034, 3042, 3069, 3077, 3085, 3093, 3107, 3115, 3123, 3131, 
        3140, 3158, 3824, 3832, 11446, 11452, 3166, 24118, 24131, 17621
    ],
    depreciacaoAccounts: [2623, 2631, 2331, 17711],
    pessoalAccounts: [
        2011, 2020, 2038, 2046, 2054, 2062, 2070, 2089, 2119, 2860, 2097, 2100, 2879, 
        2135, 2143, 2151, 2160, 2178, 2186, 2194, 2208, 2216, 3816, 3948, 11423, 
        11430, 2232, 24124, 24147
    ],
    aluguelAccounts: [],
    // Contas de Viagem que ficam PRÉ-MARGEM
    viagensAccounts: [2305, 2313, 2321, 2330, 2348, 2356, 2364, 2372, 3506],
    // Contas de Dedução da Receita (além da 3204 dinâmica)
    deductionAccounts: [1945, 1953, 1961, 3212],
    diversasAccounts: [
        2380, 2399, 2402, 2410, 2429, 2437, 2445, 2453, 2461, 2470, 
        2488, 2496, 2500, 2518, 2526, 2534, 2550, 3514, 4146, 2542, 
        29624, 14581
    ], 
    servicosProfissionaisAccounts: [
        2569, 2577, 2585, 2593, 2607, 2615, 2887, 3620, 3590, 3581, 
        3522, 3530, 16455, 16573
    ],
    taxasAccounts: [
        2640, 2658, 2666, 11558, 11564, 11571, 11587, 11676, 11742, 
        23001, 11759
    ],
    outrasAdmAccounts: [2674, 2682, 2690],
    // GRUPO REMOVIDO/VAZIO
    outrasPosAccounts: [], 
    // CONTA 2844 CONSOLIDADA NO GRUPO PRINCIPAL PÓS-EBITDA
    posEbitdaAccounts: [
        2704, 2720, 2739, 2747, 2771, 2780, 2798, 2801, 2810, 
        4120, 3867, 3875, 2895, 2909, 16248, 16254, 2844
    ],
    managementFeeAccounts: [9999], 
    
    async init() {
        // Now load storage asynchronously (supports Electron)
        await this.loadFromStorage();
        // Set default month selector on Margin view to current month
        try {
            const monthEl = document.getElementById('margin-month-select');
            if (monthEl && !monthEl.value) monthEl.value = (new Date().getMonth() + 1);
        } catch (e) {}
        // Integração padrão: contas comumente NÃO-Receita fornecidas pelo usuário
        try {
            const defaults = ['2925','3034','3123','2968','3115','3042','2976','17621','2364','3077','2542','2011','3530','9999','2984','2240','24118','2623','2470','2097','2607','2887','3093','2054','3158','2186','2100','2062','2178','2135','2585','3107','2402','3140','2070','2151'];
            this.budgetExcludedFromRevenue = this.budgetExcludedFromRevenue || [];
            const normalized = defaults.map(d=>String(d).replace(/\D/g,''));
            const merged = Array.from(new Set([].concat(this.budgetExcludedFromRevenue, normalized)));
            if (merged.length !== (this.budgetExcludedFromRevenue||[]).length) {
                this.budgetExcludedFromRevenue = merged;
                // Persist the user's explicit preferences
                this.saveToStorage();
            }
        } catch(e) {
            // ignore
        }
        // Setup CSV upload for DRE departamento
        const dreCsvInput = document.getElementById('dre-departamento-csv');
        if (dreCsvInput) {
            dreCsvInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    app.processDreDepartamentoCSV(ev.target.result);
                };
                reader.readAsText(file);
            });
        }
        this.renderLocks();
        this.renderExemptCCs();
        this.loadOcraConfig();
        // 1. Configura a lista de anos e a estrutura de filtros
        this.populateFilters(); 
        // 2. Configura a lógica de dependência dos filtros e popula as opções iniciais
        this.setupDynamicFilters(); 
        
        // Setup DRE type selector listener (Actual / Budget / Both)
        const dreTypeEl = document.getElementById('dre-type-select');
        if (dreTypeEl) {
            if (!dreTypeEl.value) dreTypeEl.value = 'Actual';
            dreTypeEl.removeEventListener('change', dreTypeEl._handler);
            dreTypeEl._handler = () => {
                // When type changes, update filters and re-render DRE
                this.populateFilters();
                this.applyFilterDependencies('dre');
                this.renderDRE();
            };
            dreTypeEl.addEventListener('change', dreTypeEl._handler);
        }

        // convenience method for inline calls
        this.onDreTypeChange = () => {
            const el = document.getElementById('dre-type-select');
            if (el) {
                el.dispatchEvent(new Event('change'));
            } else {
                this.populateFilters();
                this.applyFilterDependencies('dre');
                this.renderDRE();
            }
        };

        // (previously attempted to persist savedImportedFiles here; actual persistence
        // happens in saveToStorage/loadFromStorage and via readerDataUrl handler)

        this.switchTab('import-key-ratios'); 
        document.getElementById('lock-year').value = new Date().getFullYear();
        document.getElementById('mgmt-year').value = new Date().getFullYear();
        document.getElementById('dre-acc-month').value = new Date().getMonth() + 1; 
    },

    downloadSavedImport(idOrIndex) {
        try {
            if (!this.savedImportedFiles || !this.savedImportedFiles.length) {
                this.showToast('Nenhum arquivo salvo para download.', true);
                return;
            }

            // If no arg passed, choose the most recent
            let item = null;
            if (typeof idOrIndex === 'undefined' || idOrIndex === null) {
                item = this.savedImportedFiles[this.savedImportedFiles.length - 1];
            } else if (typeof idOrIndex === 'number') {
                item = this.savedImportedFiles[idOrIndex];
            } else {
                item = this.savedImportedFiles.find(f => f.id === idOrIndex) || null;
            }

            if (!item) {
                this.showToast('Arquivo não encontrado.', true);
                return;
            }

            const base64 = item.base64;
            if (!base64) {
                this.showToast('Arquivo salvo inválido (sem conteúdo).', true);
                return;
            }

            const byteChars = atob(base64);
            const byteNumbers = new Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) {
                byteNumbers[i] = byteChars.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = item.fileName || 'imported.xlsx';
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('downloadSavedImport error', err);
            this.showToast('Erro ao gerar download do arquivo.', true);
        }
    },

    inferMonthYearFromFilename(fileName) {
        if (window.AppUtils && typeof window.AppUtils.inferMonthYearFromFilename === 'function') {
            try { return window.AppUtils.inferMonthYearFromFilename(fileName); } catch(e) { console.warn('inferMonthYearFromFilename AppUtils failed', e); }
        }
        if (!fileName || typeof fileName !== 'string') return null;
        // fallback simple heuristic
        const s = fileName.replace(/[_\-\.]/g, ' ').toLowerCase();
        const yearMatch = s.match(/(20\d{2}|19\d{2})/);
        const year = yearMatch ? parseInt(yearMatch[0]) : null;
        const mmYYYY = s.match(/(0?[1-9]|1[0-2])[\s_\-\.\/]*(20\d{2})/);
        if (mmYYYY) return { month: parseInt(mmYYYY[1]), year: parseInt(mmYYYY[2]), label: (parseInt(mmYYYY[1]) + '/' + mmYYYY[2]) };
        return year ? { month: null, year: year, label: (year) } : null;
    },

    renderSavedImports() {
        // Ocultar completamente a seção de imports salvos (sem exibir metadados)
        const section = document.getElementById('saved-imports-section');
        const summary = document.getElementById('saved-imports-summary');
        if (section) section.classList.add('hidden');
        if (summary) summary.innerText = '';
        return;
    },

    renderSavedImportsInline() {
        // Limpar qualquer exibição inline de imports salvos (não mostrar nome/label)
        const container = document.getElementById('saved-imports-inline');
        const fileNameEl = document.getElementById('fileName');
        if (container) container.innerHTML = '';
        if (fileNameEl) fileNameEl.innerText = '';
        return;
    },

    deleteSavedImport(id) {
        if (!id) return;
        if (!confirm('Excluir este arquivo salvo?')) return;
        this.savedImportedFiles = (this.savedImportedFiles || []).filter(f => f.id !== id);
        try { if (this.saveToStorage) this.saveToStorage(); } catch (e) { console.warn('saveToStorage failed after deleteSavedImport', e); }
        try { this.renderSavedImports(); } catch (e) {}

        try { this.renderSavedImportsInline(); } catch (e) {}
        try { this.renderSavedImportsGlobal(); } catch (e) {}
    },

    // Diagnostic helper: show details of ADM allocation for current filters
    showAdmAllocationDetail(year, groupBy) {
        const y = parseInt(year) || parseInt(document.getElementById('margin-year-select').value) || new Date().getFullYear();
        const monthSelected = parseInt(document.getElementById('margin-month-select') ? document.getElementById('margin-month-select').value : (new Date().getMonth()+1)) || (new Date().getMonth()+1);
        const gb = groupBy || document.getElementById('margin-group-by').value || 'client';
        const filterCC = (document.getElementById('margin-filter-cc')||{value:''}).value.trim();
        const filterDept = (document.getElementById('margin-filter-dept')||{value:''}).value.trim();
        const filterCli = (document.getElementById('margin-filter-client')||{value:''}).value.trim();
        const filterSBD = (document.getElementById('margin-filter-sbd')||{value:''}).value.trim();
        const filterProj = (document.getElementById('margin-filter-proj')||{value:''}).value.trim();

        let admPool = 0, admPoolBdg = 0;
        const groups = {};
        const groupsB = {};
        this.data.forEach(it => {
            if (!it || parseInt(it.ano) !== y) return;
            const m = Number(it.mes) || 0;
            if (!m || m < 1 || m > monthSelected) return;
            const isAdm = String(it.departamento).trim() === 'ADM';
            const gkey = String(it[gb] || 'Não Classificado').trim() || 'Não Classificado';
            if (filterCC && String(it.centroCusto) !== filterCC) return;
            if (filterDept && String(it.departamento) !== filterDept) return;
            if (filterCli && String(it.cliente) !== filterCli) return;
            if (filterSBD && String(it.sbd) !== filterSBD) return;
            if (filterProj && String(it.projectType) !== filterProj) return;

            // Actuals
            if (it.tipo !== 'Budget') {
                const c = Number(it.conta);
                let isCusto = this.custoAccounts.includes(c) || this.viagensAccounts.includes(c) || this.pessoalAccounts.includes(c) || this.outrasAdmAccounts.includes(c) || this.depreciacaoAccounts.includes(c) || this.servicosProfissionaisAccounts.includes(c) || this.taxasAccounts.includes(c);
                if (!isCusto && Number(it.valor) < 0) isCusto = true;
                if (this.isAdmAllocationEnabled && isAdm && it.tipo !== 'Receita' && isCusto) { admPool += Number(it.valor) || 0; }
                if (!isAdm) {
                    groups[gkey] = groups[gkey] || { receita:0, custos:0, heads:0 };
                    groups[gkey].custos += Number(it.valor) || 0;
                }
            } else {
                // Budget
                const c = Number(it.conta);
                let isCustoB = this.custoAccounts.includes(c) || this.viagensAccounts.includes(c);
                if (!isCustoB && Number(it.valor) < 0) isCustoB = true;
                if (this.isAdmAllocationEnabled && String(it.departamento).trim() === 'ADM' && isCustoB) admPoolBdg += Number(it.valor) || 0;
                if (!(String(it.departamento).trim() === 'ADM')) {
                    groupsB[gkey] = groupsB[gkey] || { receita:0, custos:0, heads:0 };
                    groupsB[gkey].custos += Number(it.valor) || 0;
                }
            }
        });

        // compute shares (headcount preferred)
        const shares = {};
        let totalShare = 0;
        const keyRatiosData = (window.DataAPI && typeof DataAPI.getKeyRatiosData === 'function') ? DataAPI.getKeyRatiosData(this) : (this.keyRatiosData || []);
        Object.keys(groups).forEach(k => {
            const unique = new Set();
            (keyRatiosData||[]).forEach(r => { if (parseInt(r.ano) === y && String(r[gb]||'').trim() === k) unique.add(r.name);});
            const s = Math.max(unique.size, Math.abs(groups[k].receita || groups[k].custos || 0));
            shares[k] = s; totalShare += s;
        });

        // allocations
        const allocations = {};
        if (Math.abs(totalShare) > 0) {
            Object.keys(groups).forEach(k => allocations[k] = (shares[k]/totalShare) * admPool);
        } else {
            // equal distribution fallback
            const ks = Object.keys(groups); const per = ks.length ? admPool/ks.length : 0;
            ks.forEach(k => allocations[k] = per);
        }

        const allocationsB = {};
        const totalShareB = 0;
        if (Object.keys(groupsB).length) {
            const ks = Object.keys(groupsB); const perB = admPoolBdg/ks.length;
            ks.forEach(k => allocationsB[k] = perB);
        }

        console.group('ADM Allocation Detail');
        console.log('Year', y, 'groupBy', gb, 'AdmPool Actual', admPool, 'AdmPool Budget', admPoolBdg);
        console.log('Groups (Actual) rows:', groups);
        console.log('Allocations (Actual):'); console.table(Object.keys(allocations).map(k=>({group:k, alloc: allocations[k]})));
        console.log('Groups (Budget) rows:', groupsB);
        console.log('Allocations (Budget):'); console.table(Object.keys(allocationsB).map(k=>({group:k, alloc: allocationsB[k]})));
        console.groupEnd();
        return { admPool, allocations, admPoolBdg, allocationsB };
    },

    // Helper: sumariza totals YTD para verificação rápida (Actual vs Budget)
    summarizeMarginYTD(year, month, groupBy) {
        const y = parseInt(year) || parseInt(document.getElementById('margin-year-select').value) || new Date().getFullYear();
        const m = parseInt(month) || parseInt(document.getElementById('margin-month-select')?.value) || (new Date().getMonth()+1);
        const gb = groupBy || document.getElementById('margin-group-by')?.value || 'cliente';
        const res = { year: y, month: m, groupBy: gb, actual: { receita:0, custos:0 }, budget: { receita:0, custos:0 } };
        (this.data||[]).forEach(it => {
            if (!it) return;
            const itYear = parseInt(it.ano);
            const itMonth = Number(it.mes) || 0;
            if (itYear !== y) return;
            if (!itMonth || itMonth < 1 || itMonth > m) return;
            const v = Number(it.valor)||0;
            if (it.tipo === 'Budget') {
                if (this.custoAccounts.includes(Number(it.conta)) || this.viagensAccounts.includes(Number(it.conta)) || Number(it.valor) < 0) res.budget.custos += v; else res.budget.receita += v;
            } else {
                if (this.custoAccounts.includes(Number(it.conta)) || this.viagensAccounts.includes(Number(it.conta)) || Number(it.valor) < 0) res.actual.custos += v; else res.actual.receita += v;
            }
        });
        console.log('YTD Summary', res);
        return res;
    },

    // Opens an overlay panel with YTD summary (Actual + Budget) and ADM allocation details
    openMarginYTDPanel() {
        try {
            const panelId = 'margin-ytd-panel';
            const existing = document.getElementById(panelId);
            if (existing) return existing.scrollIntoView();

            const year = parseInt(document.getElementById('margin-year-select').value);
            const month = parseInt(document.getElementById('margin-month-select').value);
            const groupBy = document.getElementById('margin-group-by').value;

            const ytd = this.summarizeMarginYTD(year, month, groupBy);
            const adm = this.showAdmAllocationDetail(year, groupBy);

            // Build panel
            const cont = document.createElement('div');
            cont.id = panelId;
            cont.style.position = 'fixed'; cont.style.right = '12px'; cont.style.top = '80px'; cont.style.width = '520px'; cont.style.maxHeight = '70vh'; cont.style.overflow = 'auto'; cont.style.background = 'white'; cont.style.border = '1px solid #e5e7eb'; cont.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'; cont.style.zIndex = 99999; cont.style.padding = '12px'; cont.style.fontSize = '13px';

            const header = document.createElement('div'); header.style.display = 'flex'; header.style.justifyContent = 'space-between'; header.style.alignItems = 'center';
            const title = document.createElement('div'); title.innerHTML = `<strong>Detalhe YTD (${year} até ${['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][month]})</strong><div style="font-size:12px;color:#555">Agrupamento: ${groupBy}</div>`;
            header.appendChild(title);
            const close = document.createElement('button'); close.innerText = '×'; close.style.border = 'none'; close.style.background = 'transparent'; close.style.fontSize = '18px'; close.style.cursor = 'pointer'; close.onclick = () => cont.remove(); header.appendChild(close);
            cont.appendChild(header);

            const pre = document.createElement('pre'); pre.style.whiteSpace = 'pre-wrap'; pre.style.wordBreak = 'break-word'; pre.style.marginTop = '8px'; pre.textContent = JSON.stringify({ ytd, adm }, null, 2);
            cont.appendChild(pre);

            const copyBtn = document.createElement('button'); copyBtn.innerText = 'Copiar resumo'; copyBtn.style.marginTop = '8px'; copyBtn.style.padding = '8px 10px'; copyBtn.style.background = '#2563eb'; copyBtn.style.color = 'white'; copyBtn.style.border = 'none'; copyBtn.style.borderRadius = '6px'; copyBtn.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(pre.textContent); this.showToast('Resumo copiado para a área de transferência.'); };
            cont.appendChild(copyBtn);

            document.body.appendChild(cont);
            this.showToast('Painel Detalhe YTD aberto.');
            return cont;
        } catch (e) {
            console.error('Erro abrindo painel YTD', e); this.showToast('Erro ao abrir painel YTD', true);
        }
    },

    // Diagnostic helper: call from DevTools console to see how given budget codes map
    debugMatchBudgetSamples(samples) {
        if (!Array.isArray(samples)) samples = [samples];
        const results = samples.map(code => {
            const budgetAcc = String(code || '').trim();
            const targetNorm = this.normalizeAccountString(budgetAcc);
            const targetDigits = this.normalizeAccountDigits(budgetAcc);
            let pc = null;
            if (this.planoContas && this.planoContas.length > 0) {
                pc = this.planoContas.find(p => this.normalizeAccountString(p.contaBudget || '') === targetNorm);
                if (!pc) pc = this.planoContas.find(p => this.normalizeAccountString(p.contaReduzida || '') === targetNorm || this.normalizeAccountString(p.contaGrande || '') === targetNorm);
                if (!pc && targetDigits) {
                    pc = this.planoContas.find(p => {
                        const pb = this.normalizeAccountDigits(p.contaBudget || '');
                        const pr = this.normalizeAccountDigits(p.contaReduzida || '');
                        const pg = this.normalizeAccountDigits(p.contaGrande || '');
                        return (pb && pb === targetDigits) || (pr && pr === targetDigits) || (pg && pg === targetDigits);
                    });
                }
            }
            return { input: budgetAcc, matched: !!pc, mapped: pc ? { contaReduzida: pc.contaReduzida, contaBudget: pc.contaBudget, descricao: pc.descricao } : null };
        });
        // Also print to an on-screen debug panel so output is visible without DevTools
        try {
            const containerId = 'budget-debug-console';
            let container = document.getElementById(containerId);
            if (!container) {
                container = document.createElement('div');
                container.id = containerId;
                container.style.position = 'fixed';
                container.style.right = '12px';
                container.style.bottom = '12px';
                container.style.width = '520px';
                container.style.maxHeight = '60vh';
                container.style.overflow = 'auto';
                container.style.background = 'rgba(255,255,255,0.95)';
                container.style.border = '1px solid #ccc';
                container.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
                container.style.zIndex = 99999;
                container.style.fontSize = '12px';
                container.style.padding = '8px';
                const header = document.createElement('div');
                header.style.display = 'flex';
                header.style.justifyContent = 'space-between';
                header.style.alignItems = 'center';
                const title = document.createElement('strong');
                title.innerText = `Budget Debug ${y}${deptFilter ? ' - ' + deptFilter : ''}`;
                const closeBtn = document.createElement('button');
                closeBtn.innerText = '×';
                closeBtn.style.border = 'none';
                closeBtn.style.background = 'transparent';
                closeBtn.style.fontSize = '18px';
                closeBtn.style.cursor = 'pointer';
                closeBtn.onclick = () => container.remove();
                header.appendChild(title);
                header.appendChild(closeBtn);
                container.appendChild(header);
                const pre = document.createElement('pre');
                pre.style.whiteSpace = 'pre-wrap';
                pre.style.wordBreak = 'break-word';
                pre.style.marginTop = '8px';
                pre.style.maxHeight = '52vh';
                pre.style.overflow = 'auto';
                pre.id = containerId + '-pre';
                container.appendChild(pre);
                document.body.appendChild(container);
            }
            const preEl = document.getElementById(containerId + '-pre');
            if (preEl) preEl.textContent = JSON.stringify(results, null, 2);
        } catch (e) {
            // ignore UI errors
        }

        console.table(results);
        return results;
    },

    parseLocaleNumber(value) {
        if (window.AppUtils && typeof window.AppUtils.parseLocaleNumber === 'function') {
            return window.AppUtils.parseLocaleNumber(value);
        }
        return 0;
    },

    normalizeAccountString(s) {
        if (window.AppUtils && typeof window.AppUtils.normalizeAccountString === 'function') {
            return window.AppUtils.normalizeAccountString(s);
        }
        if (s === undefined || s === null) return '';
        return String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
    },

    normalizeAccountDigits(s) {
        if (window.AppUtils && typeof window.AppUtils.normalizeAccountDigits === 'function') {
            return window.AppUtils.normalizeAccountDigits(s);
        }
        if (s === undefined || s === null) return '';
        const digits = String(s).replace(/\D/g, '');
        return digits.replace(/^0+/, '') || digits;
    },

    normalizePeriod(mes, ano) {
        // Retorna chave normalizada 'M-Y' onde M e Y são números (ex: '1-2025')
        let m = mes;
        let y = ano;

        if ((y === undefined || y === null || y === '') && typeof m === 'string' && m.includes('/')) {
            const parts = m.split('/').map(s => s.trim()).filter(Boolean);
            if (parts.length >= 2) {
                m = parts[0];
                y = parts[1];
            }
        }

        // Se mês for texto (Jan/Fev) tenta converter
        const parsed = parseMonthString(m);
        if (parsed !== null) {
            m = parsed;
        } else {
            // remove zeros à esquerda e não dígitos
            m = String(m).trim();
            m = m.replace(/^0+/, '');
            const mm = Number(m);
            if (!isNaN(mm) && mm >= 1 && mm <= 12) m = mm; // número
        }

        // Ano: pegar últimos 4 dígitos se vier combinado
        if ((y === undefined || y === null || y === '') && typeof m === 'string' && m.includes('/')) {
            const parts = m.split('/').map(s => s.trim());
            if (parts.length >= 2) {
                y = parts[1];
                m = parts[0];
            }
        }

        y = String(y || '').trim();
        // extrai número de ano
        const yy = Number(y.replace(/[^0-9]/g, ''));
        const yearNum = !isNaN(yy) && yy > 0 ? yy : y;

        return `${String(m)}-${String(yearNum)}`;
    },
    getLastMonthHeads(year, filters, isADM) {
        // filters: {cc, dept, cli, sbd, proj}
        year = String(year);
        const cc = filters && filters.cc ? String(filters.cc) : '';
        const deptF = filters && filters.dept ? String(filters.dept) : '';
        const cli = filters && filters.cli ? String(filters.cli) : '';
        const sbd = filters && filters.sbd ? String(filters.sbd) : '';
        const proj = filters && filters.proj ? String(filters.proj) : '';

        const keyRatiosData = (window.DataAPI && typeof DataAPI.getKeyRatiosData === 'function') ? DataAPI.getKeyRatiosData(this) : (this.keyRatiosData || []);
        for (let m = 12; m >= 1; m--) {
            const filtered = (keyRatiosData || []).filter(item => {
                if (!item || !item.ano || !item.mes) return false;
                if (String(item.ano) !== year) return false;
                const itemMonth = Number(item.mes);
                if (isNaN(itemMonth) || itemMonth !== m) return false;
                if (cc && String(item.centroCusto || '') !== cc) return false;
                if (deptF && String(item.departamento || '') !== deptF) return false;
                if (cli && String(item.cliente || '') !== cli) return false;
                if (sbd && String(item.sbd || '') !== sbd) return false;
                if (proj && String(item.projectType || '') !== proj) return false;
                return true;
            });

            if (!filtered || filtered.length === 0) continue;

            const uniqueNames = new Set();
            filtered.forEach(kr => {
                const dept = String(kr.departamento || '').trim();
                const name = String(kr.name || kr.name || '').trim();
                if (!name) return;
                if (isADM) {
                    if (dept === 'ADM') uniqueNames.add(name);
                } else {
                    if (dept !== 'ADM') uniqueNames.add(name);
                }
            });

            if (uniqueNames.size > 0) return uniqueNames.size;
        }
        return 0;
    },
    processDreDepartamentoCSV(csvText) {
        // Parse CSV (assume ; as separator)
        const lines = csvText.split(/\r?\n/).filter(l => l.trim());
        const rows = lines.map(line => line.split(';'));
        const tbody = document.getElementById('dre-departamento-body');
        tbody.innerHTML = '';
        rows.forEach(row => {
            if (row.length < 3) return;
            const [tipo, conta, descricao] = row;
            // Ignora cabeçalho
            if ((tipo || '').trim().toLowerCase() === 'tipo' && (conta || '').trim().toLowerCase() === 'conta ocra') return;
            const tr = document.createElement('tr');
            tr.innerHTML = `<td class='px-3 py-2'>${tipo || ''}</td><td class='px-3 py-2'>${conta || ''}</td><td class='px-3 py-2'>${descricao || ''}</td>`;
            tbody.appendChild(tr);
        });
    },

    // --- Navegação ---
    switchTab(tabName) {
        const tabs = ['import-receita', 'import-despesa', 'import-budget', 'mgmt-fee', 'import-key-ratios', 'import-key-ratios-budget', 'import-plano-contas', 'import-balance', 'data', 'dre', 'dre-acumulado', 'dre-budget-2', 'dre-departamento', 'dre-suecia', 'margin-analysis', 'export-ocra', 'locks', 'centros-custo'];

        const views = ['view-import', 'view-mgmt-fee', 'view-data', 'view-dre', 'view-dre-acumulado', 'view-dre-budget-2', 'view-dre-departamento', 'view-dre-suecia', 'view-margin-analysis', 'view-export-ocra', 'view-locks', 'view-centros-custo'];
        views.forEach(v => {
            const el = document.getElementById(v);
            if(el) el.classList.add('hidden');
        });

        tabs.forEach(t => {
            const el = document.getElementById(`tab-${t}`);
            if(el) {
                if(t === tabName) {
                    el.classList.add('tab-active');
                    el.classList.remove('tab-inactive');
                } else {
                    el.classList.remove('tab-active');
                    el.classList.add('tab-inactive');
                }
            }
        });

        let viewId = `view-${tabName}`;
        if (tabName.startsWith('import-')) viewId = 'view-import';
        const currentView = document.getElementById(viewId);
        if (currentView) currentView.classList.remove('hidden');

        if (tabName.startsWith('import-')) {
            const raw = tabName.replace('import-', '');
            const map = { 
                'receita': 'Receita', 
                'despesa': 'Despesa', 
                'budget': 'Budget', 
                    'key-ratios': 'KeyRatios',
                    'key-ratios-budget': 'KeyRatiosBudget',
                'plano-contas': 'PlanoContas',
                'balance': 'Balance'
            };
            this.setImportContext(map[raw] || 'Receita');
            const pcList = document.getElementById('plano-contas-list-section');
            if (pcList) pcList.classList.add('hidden');

            if (tabName === 'import-plano-contas') {
                this.renderPlanoContas();
                if (pcList) pcList.classList.remove('hidden');
            }
        }
        else if (tabName === 'mgmt-fee') this.renderMgmtFeesList();
        else if (tabName === 'data') this.renderData();
        else if (tabName === 'dre') { 
            this.populateFilters(); 
            this.applyFilterDependencies('dre'); // Garante que os filtros estejam atualizados
            this.renderDRE(); 
        }
        // 'dre-budget' removed — use 'dre-budget-2' instead
        else if (tabName === 'dre-acumulado') { 
            this.populateFilters(); 
            this.applyFilterDependencies('dre-acc'); // Garante que os filtros estejam atualizados
            this.renderDREAcumulado(); 
        } 
        else if (tabName === 'dre-budget-2') {
            this.populateFilters();
            this.applyFilterDependencies('dre-b2');
            this.renderDREBudget2();
        }
        else if (tabName === 'margin-analysis') { 
            this.populateFilters(); 
            this.applyFilterDependencies('margin'); // Garante que os filtros estejam atualizados
            this.renderMarginAnalysis(); 
        }
        else if (tabName === 'locks') { this.renderLocks(); this.renderExemptCCs(); }
        
        if (!tabName.startsWith('import-')) this.cancelImport();
        if (tabName === 'dre-departamento') this.renderDREDepartamento();
        if (tabName === 'dre-suecia') this.renderDRESuecia();
        if (tabName === 'centros-custo') this.renderCentrosCusto();
    },

    setImportContext(type) {
        this.currentImportType = type;
        document.getElementById('import-title').innerText = `Importar ${type === 'KeyRatios' ? 'Key Ratios' : type}`;
        const badge = document.getElementById('import-type-badge');
        const desc = document.getElementById('import-description');

        if (type === 'Receita') {
            badge.className = "mb-4 inline-block px-3 py-1 rounded-full text-sm font-bold bg-green-100 text-green-800";
            badge.innerText = "RECEITA (6 ou 18 colunas)";
            desc.innerText = "Selecione o arquivo mensal de Receita (.xlsx ou .xls). Aceita formato compacto (6 colunas: Conta, Descrição, Valor, Centro (Project ID), Mês, Ano) ou formato antigo (>=18 colunas, filtro Coluna 6 == 36).";
            document.getElementById('preview-filter-hint').innerText = "Filtro (antigo): Coluna 6 == 36";
            const guidanceEl = document.getElementById('import-column-guidance');
            if (guidanceEl) guidanceEl.innerHTML = "<strong>Colunas esperadas (compacto):</strong> 1-Conta; 2-Descrição; 3-Valor; 4-Centro (Project ID); 5-Mês; 6-Ano. <br><strong>Formato antigo:</strong> arquivos com muitas colunas (>=18) onde o filtro é Coluna 6 == 36. Use vírgula para decimais.";
        } else if (type === 'Despesa') {
            badge.className = "mb-4 inline-block px-3 py-1 rounded-full text-sm font-bold bg-red-100 text-red-800";
            badge.innerText = "DESPESA (6 ou 18 colunas)";
            desc.innerText = "Selecione o arquivo mensal de Despesa (.xlsx ou .xls). Aceita formato compacto (6 colunas: Conta, Descrição, Valor, Centro (Project ID), Mês, Ano) ou formato antigo (>=18 colunas, filtro Coluna 6 == 36).";
            document.getElementById('preview-filter-hint').innerText = "Filtro (antigo): Coluna 6 == 36";
            const guidanceEl = document.getElementById('import-column-guidance');
            if (guidanceEl) guidanceEl.innerHTML = "<strong>Colunas esperadas (compacto):</strong> 1-Conta; 2-Descrição; 3-Valor; 4-Centro (Project ID); 5-Mês; 6-Ano. <br><strong>Formato antigo:</strong> arquivos com muitas colunas (>=18) onde o filtro é Coluna 6 == 36. Use vírgula para decimais.";
        } else if (type === 'Budget') {
            badge.className = "mb-4 inline-block px-3 py-1 rounded-full text-sm font-bold bg-indigo-100 text-indigo-800";
            badge.innerText = "BUDGET (10 Colunas)";
            desc.innerText = "Selecione o arquivo de Budget (.xlsx ou .xls). Layout: 1-Conta, 2-Descrição, 3-Valor, 4-C. Custo, 5-Depto, 6-Cliente, 7-SB/D, 8-Project Type, 9-Mês, 10-Ano.";
            document.getElementById('preview-filter-hint').innerText = "";
            const guidanceEl = document.getElementById('import-column-guidance');
            if (guidanceEl) guidanceEl.innerHTML = "<strong>Layout esperado (10 colunas):</strong> 1-Conta; 2-Descrição; 3-Valor; 4-C. Custo; 5-Depto; 6-Cliente; 7-SB/D; 8-Project Type; 9-Mês; 10-Ano.";
        } else if (type === 'KeyRatios') {
            badge.className = "mb-4 inline-block px-3 py-1 rounded-full text-sm font-bold bg-blue-100 text-blue-800";
            badge.innerText = "KEY RATIOS";
            desc.innerText = "Selecione o arquivo de Key Ratios (.xlsx).";
            document.getElementById('preview-filter-hint').innerText = "";
            const guidanceEl = document.getElementById('import-column-guidance');
            if (guidanceEl) guidanceEl.innerHTML = "<strong>Key Ratios:</strong> arquivo deve conter colunas de departamento, mês, ano e métricas (heads, etc.). Siga o modelo usado anteriormente.";
        } else if (type === 'Balance') {
            badge.className = "mb-4 inline-block px-3 py-1 rounded-full text-sm font-bold bg-teal-100 text-teal-800";
            badge.innerText = "BALANÇO / POS EBIT (7 colunas)";
            desc.innerText = "Selecione o arquivo de Balanço / Pos EBIT (.xlsx ou .xls).";
            document.getElementById('preview-filter-hint').innerText = "";
            const guidanceElBalance = document.getElementById('import-column-guidance');
            if (guidanceElBalance) guidanceElBalance.innerHTML =
                'Arquivo com 7 colunas,<br>' +
                'Coluna A - Conta reduzida<br>' +
                'Coluna B - Conta Grande<br>' +
                'Coluna C- Descrição<br>' +
                'Coluna D - Saldo final<br>' +
                'Coluna E - Conta Ocra<br>' +
                'Coluna F - mês<br>' +
                'Coluna G - Ano';
        } else {
            badge.className = "mb-4 inline-block px-3 py-1 rounded-full text-sm font-bold bg-gray-100 text-gray-800";
            badge.innerText = type;
            desc.innerText = "Selecione o arquivo apropriado.";
            document.getElementById('preview-filter-hint').innerText = "";
            const guidanceEl = document.getElementById('import-column-guidance');
            if (type === 'PlanoContas') {
                if (guidanceEl) guidanceEl.innerHTML = "<strong>Plano de Contas:</strong> colunas esperadas: Conta Reduzida, Conta OCRA, Descrição (ou similar). Outros campos opcionais serão ignorados.";
            } else if (type === 'Balance') {
                if (guidanceEl) guidanceEl.innerHTML = "<strong>Balanço/Pos EBIT:</strong> o preview mostrará as colunas originais. Procure colunas com Mês/Ano ou títulos de saldo. O app tenta detectar mês/ano automaticamente.";
            } else {
                if (guidanceEl) guidanceEl.innerHTML = "Selecione um tipo de importação para ver orientações sobre o layout de colunas.";
            }
            const guide = document.getElementById('budget-import-guidance');
            if (guide) guide.classList.add('hidden');
        }
    },

    handleFileSelect(input) {
        const file = input.files ? input.files[0] : null;
        if (!file) return;
        const fileNameEl = document.getElementById('fileName');
        if (fileNameEl) fileNameEl.innerText = file.name;

        // Also read as DataURL to persist the original uploaded file (base64)
        const readerDataUrl = new FileReader();
        readerDataUrl.onload = (ev) => {
            try {
                const dataUrl = ev.target.result || '';
                const base64 = (dataUrl.split(',')[1]) || '';
                const saveEntry = {
                    id: Date.now() + '-' + file.name,
                    fileName: file.name,
                    base64: base64,
                    size: file.size || 0,
                    lastModified: file.lastModified || 0,
                    importType: this.currentImportType || null,
                    uploadedAt: (new Date()).toISOString()
                };
                this.savedImportedFiles = this.savedImportedFiles || [];
                const last = this.savedImportedFiles[this.savedImportedFiles.length - 1];
                if (!last || last.fileName !== saveEntry.fileName || last.size !== saveEntry.size || last.lastModified !== saveEntry.lastModified) {
                    this.savedImportedFiles.push(saveEntry);
                    try { if (this.saveToStorage) this.saveToStorage(); } catch (e) { console.warn('saveToStorage failed after saving imported file', e); }
                }
                try { this.renderSavedImports(); } catch (err) {}
                try { this.renderSavedImportsInline(); } catch (err) {}
            } catch (err) {
                console.error('Erro ao salvar arquivo importado (base64):', err);
            }
        };
        readerDataUrl.readAsDataURL(file);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const wb = XLSX.read(data, { type: 'array' });
                const firstSheet = wb.SheetNames[0];
                const sheet = wb.Sheets[firstSheet];
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

                // Route to correct processor based on currentImportType
                if (this.currentImportType === 'Receita' || this.currentImportType === 'Despesa') {
                    if (this.currentImportType === 'Receita') {
                        if (window.AbaImportReceita && typeof window.AbaImportReceita.processFinancialData === 'function') {
                            return window.AbaImportReceita.processFinancialData(this, rows);
                        }
                        this.showToast('Módulo de importação Receita não encontrado.', true);
                        return;
                    }
                    // Despesa deve delegar ao módulo específico
                    if (window.AbaImportDespesa && typeof window.AbaImportDespesa.processFinancialData === 'function') {
                        return window.AbaImportDespesa.processFinancialData(this, rows);
                    }
                    this.showToast('Módulo de importação Despesa não encontrado.', true);
                    return;
                } else if (this.currentImportType === 'Budget') {
                    if (window.AbaImportBudget && typeof window.AbaImportBudget.processBudgetData === 'function') {
                        return window.AbaImportBudget.processBudgetData(this, rows);
                    }
                    this.showToast('Módulo de importação Budget não encontrado.', true);
                    return;
                } else if (this.currentImportType === 'KeyRatios') {
                    this.processKeyRatiosData(rows);
                } else if (this.currentImportType === 'KeyRatiosBudget') {
                    this.processKeyRatiosBudgetData(rows);
                } else if (this.currentImportType === 'PlanoContas') {
                    this.processPlanoContasData(rows);
                } else if (this.currentImportType === 'Balance') {
                    this.processBalanceData(rows);
                } else {
                    this.showToast('Tipo de importação desconhecido.', true);
                }
            } catch (err) {
                console.error('Erro lendo arquivo:', err);
                this.showToast('Erro ao ler arquivo: ' + (err.message || err), true);
            }
        };
        reader.readAsArrayBuffer(file);
    },

    processFinancialData(rows) {
        // Delegador: lógica de importação de Receita/Despesa foi movida para módulos separados.
        if (this.currentImportType === 'Receita') {
            if (window.AbaImportReceita && typeof window.AbaImportReceita.processFinancialData === 'function') {
                return window.AbaImportReceita.processFinancialData(this, rows);
            }
            this.showToast('Módulo de importação Receita não encontrado.', true);
            return;
        }
        if (this.currentImportType === 'Despesa') {
            if (window.AbaImportDespesa && typeof window.AbaImportDespesa.processFinancialData === 'function') {
                return window.AbaImportDespesa.processFinancialData(this, rows);
            }
            this.showToast('Módulo de importação Despesa não encontrado.', true);
            return;
        }
        this.showToast('Tipo de importação inválido para processFinancialData.', true);
    },
    
    processBudgetData(rows) {
        if (window.AbaImportBudget && typeof window.AbaImportBudget.processBudgetData === 'function') {
            return window.AbaImportBudget.processBudgetData(this, rows);
        }
        this.showToast('Módulo de importação Budget não encontrado.', true);
        return;
    },

    processKeyRatiosData(rows) {
        // Delegador para módulo de Key Ratios
        if (window.AbaImportKeyRatios && typeof window.AbaImportKeyRatios.processKeyRatiosData === 'function') {
            return window.AbaImportKeyRatios.processKeyRatiosData(this, rows);
        }
        this.showToast('Módulo de importação Key Ratios não encontrado.', true);
    },

    processKeyRatiosBudgetData(rows) {
        if (window.AbaImportKeyRatios && typeof window.AbaImportKeyRatios.processKeyRatiosBudgetData === 'function') {
            return window.AbaImportKeyRatios.processKeyRatiosBudgetData(this, rows);
        }
        this.showToast('Módulo de importação Key Ratios Budget não encontrado.', true);
    },

    processPlanoContasData(rows) {
        // Delegador: a lógica de importação do Plano de Contas foi movida para um módulo
        if (window.AbaImportPlanoContas && typeof window.AbaImportPlanoContas.processPlanoContasData === 'function') {
            return window.AbaImportPlanoContas.processPlanoContasData(this, rows);
        }
        this.showToast('Módulo de importação Plano de Contas não encontrado.', true);
    },

    processBalanceData(rows) {
        // Delegador para o módulo de Balanço/Pos EBIT
        if (window.AbaImportBalance && typeof window.AbaImportBalance.processBalanceData === 'function') {
            try { return window.AbaImportBalance.processBalanceData(this, rows); } catch (e) { console.error('Erro ao delegar processBalanceData', e); this.showToast('Erro ao processar dados de Balanço.', true); }
        }
        this.showToast('Módulo de importação Balanço/Pos EBIT não encontrado.', true);
    },

    renderBalanceData() {
        if (window.AbaImportBalance && typeof window.AbaImportBalance.renderBalanceData === 'function') {
            try { return window.AbaImportBalance.renderBalanceData(this); } catch (e) { console.error('Erro ao delegar renderBalanceData', e); this.showToast('Erro ao renderizar Balanço.', true); }
        }
        this.showToast('Módulo de Balanço/Pos EBIT não encontrado.', true);
    },

    clearBalanceData() {
        if (window.AbaImportBalance && typeof window.AbaImportBalance.clearBalanceData === 'function') {
            try { return window.AbaImportBalance.clearBalanceData(this); } catch (e) { console.error('Erro ao delegar clearBalanceData', e); this.showToast('Erro ao limpar Balanço.', true); }
        }
        this.showToast('Módulo de Balanço/Pos EBIT não encontrado.', true);
    },

    exportBalanceData() {
        if (window.AbaImportBalance && typeof window.AbaImportBalance.exportBalanceData === 'function') {
            try { return window.AbaImportBalance.exportBalanceData(this); } catch (e) { console.error('Erro ao delegar exportBalanceData', e); this.showToast('Erro ao exportar Balanço.', true); }
        }
        this.showToast('Módulo de Balanço/Pos EBIT não encontrado.', true);
    },


    renderDREDepartamento() {
        // Delegador para módulo `AbaDreDepartamento` (se presente)
        try {
            if (window.AbaDreDepartamento && typeof window.AbaDreDepartamento.render === 'function') {
                const getFilterValue = (id) => { const el = document.getElementById(id); if (!el) return ''; const v = String(el.value || '').trim(); return v === 'Todos...' ? '' : v; };
                let year = parseInt(document.getElementById('dre-dept-year') ? document.getElementById('dre-dept-year').value : (new Date().getFullYear()));
                if (isNaN(year)) year = (new Date()).getFullYear();
                let month = parseInt(document.getElementById('dre-dept-month') ? document.getElementById('dre-dept-month').value : (new Date().getMonth()+1));
                if (isNaN(month)) month = (new Date()).getMonth() + 1;
                const type = (document.getElementById('dre-dept-type') ? document.getElementById('dre-dept-type').value : 'accumulated');
                const ctx = {
                    year,
                    month,
                    type,
                    filtros: {
                        cc: getFilterValue('dre-dept-cc'),
                        dept: getFilterValue('dre-dept-dept'),
                        client: getFilterValue('dre-dept-client'),
                        sbd: getFilterValue('dre-dept-sbd'),
                        proj: getFilterValue('dre-dept-proj')
                    },
                    data: this.data || [],
                    planoContas: this.planoContas || [],
                    mgmtFees: this.mgmtFees || [],
                    mgmtDetailData: this.mgmtDetailData || {},
                    keyRatiosData: (window.DataAPI && typeof DataAPI.getKeyRatiosData === 'function') ? DataAPI.getKeyRatiosData(this) : (this.keyRatiosData || []),
                    balanceData: this.balanceData || [],
                    exemptCCs: this.exemptCCs || [],
                    isAdmAllocationEnabled: this.isAdmAllocationEnabled,
                    isAdmAllocationSueciaEnabled: this.isAdmAllocationSueciaEnabled,
                    dreDeptLayout: this.dreDeptLayout || [],
                    normalizeAccountDigits: this.normalizeAccountDigits ? this.normalizeAccountDigits.bind(this) : null,
                    getLastMonthHeads: this.getLastMonthHeads ? this.getLastMonthHeads.bind(this) : null
                };
                // delegador silencioso: chama AbaDreDepartamento sem logs
                window.AbaDreDepartamento.render('view-dre-departamento', ctx);
                return;
            }
        } catch (e) {
            console.warn('Erro no delegador renderDREDepartamento', e);
        }

        if (typeof LEGACY_DRE_DISABLED !== 'undefined' && LEGACY_DRE_DISABLED) {
            return;
        }
        const tbody = document.getElementById('dre-departamento-body');
        const thead = tbody.parentElement.querySelector('thead');
        const yearSelect = document.getElementById('dre-dept-year');
        const monthSelect = document.getElementById('dre-dept-month');
        const typeSelect = document.getElementById('dre-dept-type');

        if (!tbody || !thead) return;
        tbody.innerHTML = '';

        // Populate Years if needed
        const years = Array.from(new Set(this.data.map(d => d.ano))).sort().filter(Boolean);
        
        // Se o select estiver vazio e tivermos anos, popula
        if (yearSelect.options.length === 0 && years.length > 0) {
            years.forEach(y => {
                const opt = document.createElement('option');
                opt.value = y;
                opt.innerText = y;
                yearSelect.appendChild(opt);
            });
            // Select latest year by default
            yearSelect.value = years[years.length - 1];
        }

        const selectedYear = yearSelect.value;
        const selectedMonth = parseInt(monthSelect.value);
        const selectedType = typeSelect.value;

        if (!this.planoContas || this.planoContas.length === 0) {
            this.showToast("Aviso: Plano de Contas não importado. Exibindo contas originais.", true);
        }

        // Mapeia conta contábil -> OCRA (Movido para antes do filtro para identificar contas de balanço)
        const contabilToOcra = {};
        const ocraDesc = {};
        
        this.planoContas.forEach(pc => {
            // Normaliza para string e remove espaços
            const red = String(pc.contaReduzida || '').trim();
            const ocra = String(pc.contaOCRA || '').trim();
            
            if (red && ocra) {
                contabilToOcra[red] = ocra;
                // Tenta usar a descrição da primeira ocorrência, ou uma lógica melhor se disponível
                if (!ocraDesc[ocra]) {
                    ocraDesc[ocra] = pc.ocraDesc || pc.descricao || '';
                }
            }
        });

        // Filter Data
        const filteredData = this.data.filter(item => {
            // Para DRE Departamento: somente Actual - ignorar linhas Budget
            if (String(item.tipo || '').trim() === 'Budget') return false;
            if (!item.ano || !item.mes) return false;
            if (String(item.ano) !== String(selectedYear)) return false;

            const itemMonth = parseInt(item.mes);

            // Verifica se é conta de Balanço (Ativo/Passivo)
            const contaOriginal = String(item.conta).trim();
            let ocra = item.contaOCRA ? String(item.contaOCRA).trim() : '';
            if (!ocra) ocra = contabilToOcra[contaOriginal] || contaOriginal;
            
            const firstDigit = ocra.charAt(0);
            const isBalanceSheet = ['1', '2'].includes(firstDigit);

            if (selectedType === 'monthly') {
                return itemMonth === selectedMonth;
            } else { // YTD
                if (isBalanceSheet) {
                    // Contas de Ativo/Passivo já são acumuladas (saldo), então pega só o mês atual
                    return itemMonth === selectedMonth;
                } else {
                    return itemMonth <= selectedMonth;
                }
            }
        });

        try {
            console.debug('renderDRESuecia - params', { selectedYear, selectedMonth, selectedType, selectedView, filteredDataCount: filteredData.length });
        } catch (e) {}

        // Agrupar valores por conta OCRA e departamento (usando filteredData)
        const valores = {};
        const dynamicTax = {}; // Armazena imposto calculado por departamento
        const deptosSet = new Set();

        // --- Lógica de Management Fee (6430) ---
        // 1. Calcular Total Management Fee do período
        let totalMgmtFee = 0;
        this.mgmtFees.forEach(mf => {
            if (String(mf.ano) !== String(selectedYear)) return;
            const mfMonth = parseInt(mf.mes);
            if (selectedType === 'monthly') {
                if (mfMonth === selectedMonth) totalMgmtFee += Number(mf.valor);
            } else {
                if (mfMonth <= selectedMonth) totalMgmtFee += Number(mf.valor);
            }
        });

        // 2. Calcular contagem de consultores por departamento (Key Ratios)
        // REMOVIDO: Duplicação de declaração. A lógica de Key Ratios foi movida para baixo.
        /*
        const consultantCounts = {};
        let totalConsultants = 0;

        const filteredKeyRatios = this.keyRatiosData.filter(item => {
            if (!item.ano || !item.mes) return false;
            if (String(item.ano) !== String(selectedYear)) return false;
            const itemMonth = parseInt(item.mes);
            if (selectedType === 'monthly') {
                return itemMonth === selectedMonth;
            } else { // YTD
                return itemMonth <= selectedMonth;
            }
        });

        try { console.debug('renderDRESuecia - filteredKeyRatios count', filteredKeyRatios.length); } catch(e) {}

        filteredKeyRatios.forEach(kr => {
            const depto = String(kr.departamento || '').trim();
            if (depto) {
                if (!consultantCounts[depto]) consultantCounts[depto] = 0;
                // Assumindo que cada linha em KeyRatios é um consultor (ou usar item.hours se for ponderado)
                // O usuário pediu "numero de consultores", então contagem de linhas parece apropriado.
                // Se for YTD, somamos as ocorrências (consultor-mês).
                consultantCounts[depto] += 1; 
                totalConsultants += 1;
                deptosSet.add(depto); // Garante que o departamento apareça
            }
        });
        */

        // 3. Distribuir Management Fee (será inserido em 'valores' abaixo)
        // REMOVIDO: O usuário solicitou que a conta 6430 NÃO pegue mais do totalMgmtFee (Conta 9999),
        // e sim apenas do detalhamento novo (mgmtDetailData).
        /*
        if (totalMgmtFee !== 0 && totalConsultants > 0) {
            if (!valores['6430']) valores['6430'] = {};
            Object.keys(consultantCounts).forEach(depto => {
                const count = consultantCounts[depto];
                const share = (count / totalConsultants) * totalMgmtFee;
                if (!valores['6430'][depto]) valores['6430'][depto] = 0;
                valores['6430'][depto] += share; 
            });
        }
        */

        // --- Lógica de Management Fee Detalhado (Novo) ---
        // Nota: consultantCounts e totalConsultants são calculados mais abaixo na seção Key Ratios
        // Mas precisamos deles aqui para o rateio do Management Fee.
        // Vamos mover a lógica de cálculo de Key Ratios para ANTES do Management Fee.
        
        // --- Key Ratios Logic for DRE Departamento (Moved Up) ---
        const consultantCounts = {};
        const consultantHours = {};
        const headsConsultantsSets = {};
        const headsADMSets = {};
        let totalConsultants = 0;

        const filteredKeyRatios = this.keyRatiosData.filter(item => {
            if (!item.ano || !item.mes) return false;
            if (String(item.ano) !== String(selectedYear)) return false;
            const itemMonth = parseInt(item.mes);
            if (selectedType === 'monthly') return itemMonth === selectedMonth;
            return itemMonth <= selectedMonth;
        });

        filteredKeyRatios.forEach(kr => {
            const depto = String(kr.departamento || '').trim();
            if (depto) {
                if (!consultantCounts[depto]) consultantCounts[depto] = 0;
                consultantCounts[depto] += 1;
                
                if (!consultantHours[depto]) consultantHours[depto] = 0;
                consultantHours[depto] += (Number(kr.hours) || 0);

                totalConsultants += 1;
                deptosSet.add(depto); // Garante que o departamento apareça
            }
        });

        if (this.mgmtDetailData && this.mgmtDetailData[selectedYear] && totalConsultants > 0) {
            const detailData = this.mgmtDetailData[selectedYear];
            ['ocra', 'calc'].forEach(rowKey => {
                const rowData = detailData[rowKey];
                if (!rowData) return;

                let rowValue = 0;
                if (selectedType === 'monthly') {
                    rowValue = Number(rowData.values[selectedMonth]) || 0;
                } else {
                    for (let m = 1; m <= selectedMonth; m++) {
                        rowValue += Number(rowData.values[m]) || 0;
                    }
                }

                if (rowValue !== 0) {
                    // Processa Débito (Positivo)
                    if (rowData.debit) {
                        const acc = String(rowData.debit).trim();
                        if (!valores[acc]) valores[acc] = {};
                        Object.keys(consultantCounts).forEach(depto => {
                            const count = consultantCounts[depto];
                            const share = (count / totalConsultants) * rowValue;
                            if (!valores[acc][depto]) valores[acc][depto] = 0;
                            valores[acc][depto] += share;
                        });
                    }
                    // Processa Crédito (Negativo)
                    if (rowData.credit) {
                        const acc = String(rowData.credit).trim();
                        if (!valores[acc]) valores[acc] = {};
                        Object.keys(consultantCounts).forEach(depto => {
                            const count = consultantCounts[depto];
                            const share = (count / totalConsultants) * rowValue * -1; // Negativo
                            if (!valores[acc][depto]) valores[acc][depto] = 0;
                            valores[acc][depto] += share;
                        });
                    }
                }
            });
        }
        // ---------------------------------------
        // ---------------------------------------

        filteredData.forEach(item => {
            if (!item.conta || !item.departamento) return;
            
            const depto = String(item.departamento).trim();
            if (depto) deptosSet.add(depto);

            const contaOriginal = String(item.conta).trim();
            const contaNum = Number(item.conta);
            
            // Prioriza a conta OCRA importada (coluna 12), senão usa o mapa, senão a original
            let ocra = item.contaOCRA ? String(item.contaOCRA).trim() : '';
            if (!ocra) {
                ocra = contabilToOcra[contaOriginal] || contaOriginal; 
            } 
            
            const valor = Number(item.valor) || 0;

            // Cálculo Dinâmico de Imposto (3204)
            // Baseado EXCLUSIVAMENTE na conta reduzida 1902
            if (contaNum === 1902) {
                 const ccToCheck = String(item.centroCusto || '').trim();
                 const isExempt = this.exemptCCs.includes(ccToCheck);
                 
                 if (!isExempt) {
                     // Assume receita positiva, imposto negativo (dedução)
                     const taxValue = valor * -0.0925;
                     
                     // Calcula por departamento
                     if (!dynamicTax[depto]) dynamicTax[depto] = 0;
                     dynamicTax[depto] += taxValue;
                 }
            }
            
            // Contas a ignorar (serão importadas em outra aba futuramente)
            const ignoredAccounts = ['8010','8022','8300','8360','8331','8390','8072','8400','8412','8460','8436','8490','8893','8820','8821','8828','8829','8890','8810','8935','8940','8980'];
            if (ignoredAccounts.includes(ocra) || ignoredAccounts.includes(String(contaNum))) return;

            // Ignora registros existentes da 3204 para evitar duplicação com o cálculo
            // Ignora registros existentes da 6430 pois agora é calculado via Management Fee
            if (ocra === '3204' || contaNum === 3204) return;
            if (ocra === '6430' || contaNum === 6430) return;

            // Regra específica: Ignorar 3010 no ADM se vier da reduzida 3190
            if (ocra === '3010' && depto === 'ADM' && contaNum === 3190) return;

            if (!valores[ocra]) valores[ocra] = {};
            if (!valores[ocra][depto]) valores[ocra][depto] = 0;
            valores[ocra][depto] += valor;
        });

        // Lógica solicitada: Coluna ADM recebe a soma de todos os impostos (mantendo os originais)
        // REMOVIDO: Usuário pediu para excluir o valor da 3204 para o ADM.
        /*
        let totalTax3204 = 0;
        Object.values(dynamicTax).forEach(v => totalTax3204 += v);
        
        // Se houver imposto calculado, atribui o total à coluna ADM com sinal invertido
        if (totalTax3204 !== 0) {
            dynamicTax['ADM'] = totalTax3204 * -1;
            deptosSet.add('ADM');
        }
        */

        // --- Lógica de Balanço e Pos EBIT (BS/IT) ---
        // Filtra dados de Balanço para o período selecionado
        const filteredBalance = this.balanceData.filter(item => {
            if (!item.ano || !item.mes) return false;
            if (String(item.ano) !== String(selectedYear)) return false;
            const itemMonth = parseInt(item.mes);
            // Balanço é sempre saldo final, então pegamos apenas o mês selecionado, mesmo em YTD.
            return itemMonth === selectedMonth;
        });

        // Adiciona valores de Balanço à coluna virtual 'BS/IT'
        filteredBalance.forEach(item => {
            const ocra = String(item.contaOCRA || item.contaReduzida || '').trim();
            if (!ocra) return;
            
            if (!valores[ocra]) valores[ocra] = {};
            if (!valores[ocra]['BS/IT']) valores[ocra]['BS/IT'] = 0;
            valores[ocra]['BS/IT'] += Number(item.saldoFinal) || 0;
        });

        // Garante que 'BS/IT' esteja na lista de departamentos, sendo a PRIMEIRA coluna
        let departamentos = Array.from(deptosSet).sort();
        
        // Remove 'BS/IT' e 'ADM' se existirem para reposicionar
        departamentos = departamentos.filter(d => d !== 'BS/IT' && d !== 'ADM');
        
        // Adiciona 'BS/IT' no início
        departamentos.unshift('BS/IT');
        
        // Adiciona 'ADM' no final, se existir no set original (ou se tiver imposto calculado)
        if (deptosSet.has('ADM')) {
            departamentos.push('ADM');
        }

        // Monta cabeçalho dinâmico
        thead.innerHTML = `<tr><th class='px-3 py-3 text-left'>Conta OCRA</th><th class='px-3 py-3 text-left'>Descrição</th>${departamentos.map(d => `<th class='px-3 py-3 text-right'>${d}</th>`).join('')}<th class='px-3 py-3 text-right font-bold'>TOTAL</th></tr>`;

        // Lista de IDs de linhas de total/cálculo que NÃO devem ser preenchidas na coluna BS/IT
        const excludedBSITRows = ['total_revenue', 'total_other_income', 'total_income', 'total_prod_costs', 'gross_profit', 'total_admin_costs', 'total_depreciation', 'profit_before_sas', 'total_sas', 'ebit'];

        // --- Key Ratios Logic for DRE Departamento ---
        // (Calculated above for Mgmt Fee usage)
        
        // Heads Logic (Always Monthly Snapshot)
        const filteredKeyRatiosHeads = this.keyRatiosData.filter(item => {
            if (!item.ano || !item.mes) return false;
            if (String(item.ano) !== String(selectedYear)) return false;
            const itemMonth = parseInt(item.mes);
            return itemMonth === selectedMonth;
        });

        filteredKeyRatiosHeads.forEach(kr => {
            const depto = String(kr.departamento || '').trim();
            if (depto) {
                const name = kr.name;
                if (name) {
                    if (depto.toUpperCase() === 'ADM') {
                        if (!headsADMSets[depto]) headsADMSets[depto] = new Set();
                        headsADMSets[depto].add(name);
                    } else {
                        if (!headsConsultantsSets[depto]) headsConsultantsSets[depto] = new Set();
                        headsConsultantsSets[depto].add(name);
                    }
                }
            }
        });

        const headsConsultants = {};
        const headsADM = {};
        const allHeadsConsultantsSet = new Set();
        const allHeadsADMSet = new Set();

        Object.keys(headsConsultantsSets).forEach(k => {
            headsConsultants[k] = headsConsultantsSets[k].size;
            headsConsultantsSets[k].forEach(name => allHeadsConsultantsSet.add(name));
        });
        Object.keys(headsADMSets).forEach(k => {
            headsADM[k] = headsADMSets[k].size;
            headsADMSets[k].forEach(name => allHeadsADMSet.add(name));
        });

        valores['KR_HEADS_CONS'] = headsConsultants;
        valores['KR_HEADS_ADM'] = headsADM;
        valores['KR_HOURS'] = consultantHours;

        // realTotalHeadsCons/ADM will be computed on-demand via `getLastMonthHeads` when rendering totals

        // Renderiza linhas baseado no layout definido
        if (this.dreDeptLayout && this.dreDeptLayout.length > 0) {
            let currentSectionTotal = {}; // Acumulador para totais da seção atual
            let savedTotals = {}; // Armazena totais salvos por ID para cálculos posteriores
            let invertValues = false; // Flag para inverter valores

            // Cria uma cópia do layout para injetar Key Ratios
            const layout = [];
            for (const row of this.dreDeptLayout) {
                layout.push(row);
                if (row.id === 'total_equity_liab') {
                    layout.push({ type: 'header', description: 'Key Ratios', bg: 'bg-blue-100' });
                    layout.push({ type: 'account', code: 'KR_HEADS_CONS', description: 'Heads Consultants', precision: 0 });
                    layout.push({ type: 'account', code: 'KR_HEADS_ADM', description: 'Heads ADM', precision: 0 });
                    layout.push({ type: 'account', code: 'KR_HOURS', description: 'Total hours' });
                }
            }



            layout.forEach(row => {
                // Lógica de inversão de sinal
                if (row.id === 'total_income') {
                    invertValues = true;
                }
                
                const tr = document.createElement('tr');
                
                if (row.type === 'header') {
                    tr.innerHTML = `<td class='px-3 py-2 font-bold' colspan="${3 + departamentos.length}">${row.description}</td>`;
                    tbody.appendChild(tr);
                    // Reseta acumulador ao iniciar nova seção lógica (opcional, depende da estrutura)
                    // currentSectionTotal = {}; 

                } else if (row.type === 'account') {
                    const ocra = String(row.code).trim();
                    const desc = row.description || ocraDesc[ocra] || '';
                    
                    let html = `<td class='px-3 py-2'>${ocra}</td><td class='px-3 py-2'>${desc}</td>`;
                    let rowTotal = 0;
                    let hasValue = false;
                    
                    departamentos.forEach(depto => {
                        let valor = 0;
                        
                        // Se for BS/IT, verifica se a conta pertence a um grupo excluído
                        // Como não temos o grupo da conta aqui facilmente, vamos assumir que contas importadas no Balanço
                        // que não sejam financeiras/impostos não devem aparecer se estiverem acima do EBIT.
                        // Mas o usuário pediu explicitamente para excluir VALORES das contas OCRA que compõem esses totais.
                        // A melhor forma é: se a conta está sendo renderizada e estamos na coluna BS/IT,
                        // e essa conta faz parte de um grupo "acima do EBIT", não mostrar.
                        // Simplificação: Se a conta NÃO é financeira/imposto/apropriação (8xxx), não mostrar no BS/IT.
                        // As contas acima do EBIT são geralmente 3xxx, 4xxx, 5xxx, 6xxx, 7xxx.
                        // As contas abaixo do EBIT são 8xxx.
                        
                        // Lógica especial para 8820 e 8821: Agrega tudo na coluna BS/IT
                        if (['8820', '8821'].includes(ocra)) {
                            if (depto === 'BS/IT') {
                                valor = (valores[ocra]) ? Object.values(valores[ocra]).reduce((a, b) => a + (Number(b)||0), 0) : 0;
                            } else {
                                valor = 0;
                            }
                        } else if (depto === 'BS/IT') {
                            const firstDigit = ocra.charAt(0);
                            // Exibe apenas contas 8xxx (Financeiro/Impostos) na coluna BS/IT
                            // Ajuste conforme necessidade se houver exceções
                            if (['3','4','5','6','7'].includes(firstDigit)) {
                                valor = 0; 
                            } else {
                                valor = (valores[ocra] && valores[ocra]['BS/IT']) ? valores[ocra]['BS/IT'] : 0;
                            }
                        } else if (ocra === '6437') {
                            // --- Novo cálculo de totalAdmCostToRate baseado em linhas específicas do DRE ---
                            const admGrossProfit = (savedTotals['gross_profit'] && savedTotals['gross_profit']['ADM']) || 0;
                            const admTotalAdminCosts = (savedTotals['total_admin_costs'] && savedTotals['total_admin_costs']['ADM']) || 0;
                            const admTotalDepreciation = (savedTotals['total_depreciation'] && savedTotals['total_depreciation']['ADM']) || 0;
                            const adm6430_val = (valores['6430'] && valores['6430']['ADM']) || 0;
                            const adm6436_val = (valores['6436'] && valores['6436']['ADM']) || 0; // Re-introducing adm6436
                            // Buscar Management fee Semcon AB - Internal Business Area OH
                            const mgmtFeeSemconAB = (this.mgmtFees.find(item => 
                                item.ano === selectedYear && 
                                item.mes === selectedMonth && 
                                item.description === 'Management fee Semcon AB - Internal Business Area OH'
                            ) || {}).valor || 0;
                            
                            // totalAdmCostToRate será a SOMA (NEGATIVA) dessas linhas de custo para o ADM.
                            // Incluindo a Management Fee, 6430 e 6436 como custos (negativos).
                            const sumOfComponents = admGrossProfit + admTotalAdminCosts + admTotalDepreciation + (adm6430_val * -1) + (adm6436_val * -1) + (Number(mgmtFeeSemconAB) * -1);
                            
                            // Valor a ser rateado é o inverso da soma (positivo para zerar ADM, negativo para ratear)
                            const totalAdmCostToRatePositive = Math.abs(sumOfComponents); // Valor POSITIVO para a linha 6437 ADM
                            const totalAdmCostToRateNegative = sumOfComponents; // Valor NEGATIVO para rateio nos outros deptos

                            // Passo B: Verifique a conta KR_HEADS_CONS para obter o total de consultores de TODOS os departamentos, EXCETO ADM.
                            const consultantsPerDepto = valores['KR_HEADS_CONS'] || {};
                            let totalConsultantsForRateio = 0; // Soma dos consultores dos departamentos que receberão o rateio (excluindo ADM)
                            for (const deptoKey in consultantsPerDepto) {
                                if (deptoKey !== 'ADM') { // Exclui consultores do ADM da base de rateio
                                    totalConsultantsForRateio += Number(consultantsPerDepto[deptoKey]);
                                }
                            }

                            // Prepare rateioPorDepto localmente
                            const rateioPorDeptoLocal = {};
                            if (totalConsultantsForRateio === 0) {
                                departamentos.forEach(dep => {
                                    if (dep === 'ADM') {
                                        rateioPorDeptoLocal[dep] = totalAdmCostToRatePositive; // ADM Positive (Credit)
                                    } else {
                                        rateioPorDeptoLocal[dep] = 0;
                                    }
                                });
                            } else {
                                departamentos.forEach(dep => {
                                    if (dep === 'ADM') {
                                        // ADM recebe o valor como Crédito (positivo no DRE)
                                        rateioPorDeptoLocal[dep] = totalAdmCostToRatePositive;
                                    } else {
                                        // Outros departamentos recebem o valor como Débito (negativo no DRE)
                                        const deptoConsultants = Number(consultantsPerDepto[dep]) || 0;
                                        rateioPorDeptoLocal[dep] = (deptoConsultants / totalConsultantsForRateio) * totalAdmCostToRateNegative;
                                    }
                                });
                            }

                            // Atribui o valor calculado para a célula atual
                            valor = rateioPorDeptoLocal[depto] || 0;
                            // Multiplica toda a linha 6437 por -1
                            valor = valor * -1;
                            }
                        else {
                            if (ocra === '3204') {
                                valor = dynamicTax[depto] || 0;
                            } else {
                                valor = (valores[ocra] && valores[ocra][depto]) ? valores[ocra][depto] : 0;
                            }
                        }
                        
                        // Inverte sinal se necessário, EXCETO para contas de Receita Financeira (80xx, 83xx)
                        // Assumindo que 80xx e 83xx são receitas e devem somar ao lucro
                        if (invertValues) {
                            const isFinancialIncome = ['8010', '8022', '8300', '8360', '8331', '8390'].includes(ocra);
                            
                            if (depto === 'BS/IT' && ['8300', '8331', '8010', '8022', '8360', '8390'].includes(ocra)) {
                                valor = Math.abs(valor);
                            } else if (!isFinancialIncome && !ocra.startsWith('KR_')) {
                                valor = valor * -1;
                            }
                        }

                        if (valor !== 0) hasValue = true;
                        rowTotal += valor;
                        
                        // Acumula para o total da seção
                        if (!currentSectionTotal[depto]) currentSectionTotal[depto] = 0;
                        currentSectionTotal[depto] += valor;

                        const valorFormatado = valor.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
                        const style = valor < 0 ? 'text-red-600' : 'text-gray-800';
                        const precision = row.precision !== undefined ? row.precision : 2;
                        html += `<td class='px-3 py-2 text-right ${style}'>${valor !== 0 ? valor.toLocaleString('pt-BR', {minimumFractionDigits:precision, maximumFractionDigits:precision}) : '-'}</td>`;
                    });

                    // Coluna Total da Linha
                    // Override Total for Heads: compute last-month heads respecting filters
                    if (ocra === 'KR_HEADS_CONS') {
                        try {
                            const override = this.getLastMonthHeads(year, {cc: filterCC, dept: filterDept, cli: filterCli, sbd: filterSBD, proj: filterProj}, false);
                            if (override && override > 0) rowTotal = override;
                        } catch (e) { console.warn('Erro calculando override KR_HEADS_CONS', e); }
                    } else if (ocra === 'KR_HEADS_ADM') {
                        try {
                            const override = this.getLastMonthHeads(year, {cc: filterCC, dept: filterDept, cli: filterCli, sbd: filterSBD, proj: filterProj}, true);
                            if (override && override > 0) rowTotal = override;
                        } catch (e) { console.warn('Erro calculando override KR_HEADS_ADM', e); }
                    }

                    const rowTotalFormatado = rowTotal.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
                    const rowStyle = rowTotal < 0 ? 'text-red-600' : 'text-gray-800';
                    const precision = row.precision !== undefined ? row.precision : 2;
                    html += `<td class='px-3 py-2 text-right font-bold ${rowStyle}'>${rowTotal !== 0 ? rowTotal.toLocaleString('pt-BR', {minimumFractionDigits:precision, maximumFractionDigits:precision}) : '-'}</td>`;

                    tr.innerHTML = html;
                    if (hasValue) tbody.appendChild(tr);

                } else if (row.type === 'total') {
                    const bgClass = row.bg || 'bg-gray-100';
                    let html = `<td class='px-3 py-2 font-bold ${bgClass}'></td><td class='px-3 py-2 font-bold ${bgClass}'>${row.description}</td>`;
                    
                    // Salva os totais se tiver ID
                    if (row.id) {
                        savedTotals[row.id] = { ...currentSectionTotal };
                    }

                    let rowTotal = 0;

                    departamentos.forEach(depto => {
                        // Se for BS/IT e a linha estiver na lista de exclusão, não exibe valor
                        if (depto === 'BS/IT' && excludedBSITRows.includes(row.id)) {
                            html += `<td class='px-3 py-2 text-right font-bold ${bgClass}'>-</td>`;
                            return;
                        }

                        const total = currentSectionTotal[depto] || 0;
                        rowTotal += total;
                        const totalFormatado = total.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
                        const style = total < 0 ? 'text-red-600' : 'text-gray-800';
                        
                        let percentHtml = '';
                        // Calcula % da Receita se solicitado
                        const showPercent = ['total_admin_costs', 'total_depreciation', 'total_sas', 'total_fin_income', 'total_fin_expenses', 'total_appropriations', 'total_tax'].includes(row.id);
                        if (showPercent) {
                            const totalIncome = (savedTotals['total_income'] && savedTotals['total_income'][depto]) || 0;
                            if (totalIncome !== 0) {
                                const percent = (total / totalIncome) * 100;
                                percentHtml = `<br><span class="text-xs text-gray-500">${percent.toFixed(1)}%</span>`;
                            }
                        }

                        html += `<td class='px-3 py-2 text-right font-bold ${bgClass} ${style}'>${total !== 0 ? totalFormatado : '-'}${percentHtml}</td>`;
                    });

                    // Coluna Total da Linha de Total
                    const rowTotalFormatado = rowTotal.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
                    const rowStyle = rowTotal < 0 ? 'text-red-600' : 'text-gray-800';
                    
                    let rowPercentHtml = '';
                    const showPercentRow = ['total_admin_costs', 'total_depreciation', 'total_sas', 'total_fin_income', 'total_fin_expenses', 'total_appropriations', 'total_tax'].includes(row.id);
                    if (showPercentRow) {
                         // Calcula total income consolidado
                         let totalIncomeConsolidated = 0;
                         if (savedTotals['total_income']) {
                             Object.values(savedTotals['total_income']).forEach(v => totalIncomeConsolidated += v);
                         }
                         
                         if (totalIncomeConsolidated !== 0) {
                             const percent = (rowTotal / totalIncomeConsolidated) * 100;
                             rowPercentHtml = `<br><span class="text-xs text-gray-500">${percent.toFixed(1)}%</span>`;
                         }
                    }

                    html += `<td class='px-3 py-2 text-right font-bold ${bgClass} ${rowStyle}'>${rowTotal !== 0 ? rowTotalFormatado : '-'}${rowPercentHtml}</td>`;

                    tr.innerHTML = html;
                    tbody.appendChild(tr);
                    
                    // Reset acumulador após exibir total
                    currentSectionTotal = {}; 
                
                } else if (row.type === 'calculation') {
                    const bgClass = row.bg || 'bg-gray-100';
                    let html = `<td class='px-3 py-2 font-bold ${bgClass}'></td><td class='px-3 py-2 font-bold ${bgClass}'>${row.description}</td>`;
                    
                    let rowTotal = 0;
                    
                    // Inicializa o objeto para salvar os totais deste cálculo
                    if (row.id) {
                        savedTotals[row.id] = {};
                    }

                    departamentos.forEach(depto => {
                        // Se for BS/IT e a linha estiver na lista de exclusão, não exibe valor
                        if (depto === 'BS/IT' && excludedBSITRows.includes(row.id)) {
                            html += `<td class='px-3 py-2 text-right font-bold ${bgClass}'>-</td>`;
                            return;
                        }

                        let result = 0;
                        // Suporte a múltiplas operações: "id1 + id2 - id3"
                        if (row.formula) {
                            const parts = row.formula.split(' ');
                            if (parts.length >= 1) {
                                result = (savedTotals[parts[0]] && savedTotals[parts[0]][depto]) || 0;
                                
                                for (let i = 1; i < parts.length; i += 2) {
                                    const op = parts[i];
                                    const nextId = parts[i+1];
                                    const nextVal = (savedTotals[nextId] && savedTotals[nextId][depto]) || 0;
                                    
                                    if (op === '+') result += nextVal;
                                    else if (op === '-') result -= nextVal;
                                }
                            }
                        }
                        
                        // Salva o resultado para uso em cálculos futuros
                        if (row.id) {
                            savedTotals[row.id][depto] = result;
                        }
                        
                        rowTotal += result;

                        const resultFormatado = result.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
                        const style = result < 0 ? 'text-red-600' : 'text-gray-800';
                        
                        let percentHtml = '';
                        // Calcula % da Receita se solicitado
                        const showPercent = ['gross_profit', 'ebit', 'profit_before_taxes'].includes(row.id) || row.description === 'Net profit or loss for the year';
                        if (showPercent) {
                            const totalIncome = (savedTotals['total_income'] && savedTotals['total_income'][depto]) || 0;
                            if (totalIncome !== 0) {
                                const percent = (result / totalIncome) * 100;
                                percentHtml = `<br><span class="text-xs text-gray-500">${percent.toFixed(1)}%</span>`;
                            }
                        }

                        html += `<td class='px-3 py-2 text-right font-bold ${bgClass} ${style}'>${result !== 0 ? resultFormatado : '-'}${percentHtml}</td>`;
                    });

                    // Coluna Total da Linha de Cálculo
                    const rowTotalFormatado = rowTotal.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
                    const rowStyle = rowTotal < 0 ? 'text-red-600' : 'text-gray-800';
                    
                    let rowPercentHtml = '';
                    const showPercentRow = ['gross_profit', 'ebit', 'profit_before_taxes'].includes(row.id) || row.description === 'Net profit or loss for the year';
                    if (showPercentRow) {
                         // Calcula total income consolidado
                         let totalIncomeConsolidated = 0;
                         if (savedTotals['total_income']) {
                             Object.values(savedTotals['total_income']).forEach(v => totalIncomeConsolidated += v);
                         }
                         
                         if (totalIncomeConsolidated !== 0) {
                             const percent = (rowTotal / totalIncomeConsolidated) * 100;
                             rowPercentHtml = `<br><span class="text-xs text-gray-500">${percent.toFixed(1)}%</span>`;
                         }
                    }

                    html += `<td class='px-3 py-2 text-right font-bold ${bgClass} ${rowStyle}'>${rowTotal !== 0 ? rowTotalFormatado : '-'}${rowPercentHtml}</td>`;

                    tr.innerHTML = html;
                    tbody.appendChild(tr);

                    // Desativa inversão se for a linha final do range
                    if (row.description === 'Net profit or loss for the year') {
                        invertValues = false;
                    }
                }
            });
        } else {
            // Fallback para renderização automática se não houver layout definido
            Object.keys(valores).sort().forEach(ocra => {
                const tr = document.createElement('tr');
                const desc = ocraDesc[ocra] || ''; 
                
                let html = `<td class='px-3 py-2'>${ocra}</td><td class='px-3 py-2'>${desc}</td>`;
                
                departamentos.forEach(depto => {
                    const valor = valores[ocra][depto] || 0;
                    const valorFormatado = valor.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
                    const style = valor < 0 ? 'text-red-600' : 'text-gray-800';
                    html += `<td class='px-3 py-2 text-right ${style}'>${valor !== 0 ? valorFormatado : '-'}</td>`;
                });
                tr.innerHTML = html;
                tbody.appendChild(tr);
            });
        }
    },

    renderDRESuecia() {
        // Delegador para módulo `AbaDreSuecia` (se presente)
        try {
            if (window.AbaDreSuecia && typeof window.AbaDreSuecia.render === 'function') {
                const getFilterValue = (id) => { const el = document.getElementById(id); if (!el) return ''; const v = String(el.value || '').trim(); return v === 'Todos...' ? '' : v; };
                let year = parseInt(document.getElementById('dre-suecia-year') ? document.getElementById('dre-suecia-year').value : (new Date().getFullYear()));
                if (isNaN(year)) year = (new Date()).getFullYear();
                let month = parseInt(document.getElementById('dre-suecia-month') ? document.getElementById('dre-suecia-month').value : (new Date().getMonth()+1));
                if (isNaN(month)) month = (new Date()).getMonth() + 1;
                const type = (document.getElementById('dre-suecia-type') ? document.getElementById('dre-suecia-type').value : 'accumulated');
                const view = (document.getElementById('dre-suecia-view') ? document.getElementById('dre-suecia-view').value : 'departamento');
                const ctx = {
                    year,
                    month,
                    type,
                    view,
                    filtros: {
                        cc: getFilterValue('dre-suecia-cc'),
                        dept: getFilterValue('dre-suecia-dept'),
                        client: getFilterValue('dre-suecia-client'),
                        sbd: getFilterValue('dre-suecia-sbd'),
                        proj: getFilterValue('dre-suecia-proj')
                    },
                    data: this.data || [],
                    planoContas: this.planoContas || [],
                    mgmtFees: this.mgmtFees || [],
                    mgmtDetailData: this.mgmtDetailData || {},
                    keyRatiosData: this.keyRatiosData || [],
                    balanceData: this.balanceData || [],
                    exemptCCs: this.exemptCCs || [],
                    isAdmAllocationEnabled: this.isAdmAllocationEnabled,
                    isAdmAllocationSueciaEnabled: this.isAdmAllocationSueciaEnabled,
                    dreDeptLayout: this.dreDeptLayout || [],
                    normalizeAccountDigits: this.normalizeAccountDigits ? this.normalizeAccountDigits.bind(this) : null,
                    getLastMonthHeads: this.getLastMonthHeads ? this.getLastMonthHeads.bind(this) : null
                };
                // delegador silencioso: chama AbaDreSuecia sem logs
                window.AbaDreSuecia.render('view-dre-suecia', ctx);
                return;
            }
        } catch (e) {
            console.warn('Erro no delegador renderDRESuecia', e);
        }
        if (typeof LEGACY_DRE_DISABLED !== 'undefined' && LEGACY_DRE_DISABLED) {
            return;
        }
        const tbody = document.getElementById('dre-suecia-body');
        const thead = tbody.parentElement.querySelector('thead');
        const yearSelect = document.getElementById('dre-suecia-year');
        const monthSelect = document.getElementById('dre-suecia-month');
        const typeSelect = document.getElementById('dre-suecia-type');
        const viewSelect = document.getElementById('dre-suecia-view');

        if (!tbody || !thead) return;
        tbody.innerHTML = '';

        const years = Array.from(new Set(this.data.map(d => d.ano))).sort().filter(Boolean);
        if (yearSelect.options.length === 0 && years.length > 0) {
            years.forEach(y => {
                const opt = document.createElement('option');
                opt.value = y;
                opt.innerText = y;
                yearSelect.appendChild(opt);
            });
            yearSelect.value = years[years.length - 1];
        }

        const selectedYear = yearSelect.value;
        const selectedMonth = parseInt(monthSelect.value);
        const selectedType = typeSelect.value;
        const selectedView = viewSelect.value;

        const contabilToOcra = {};
        const ocraDesc = {};
        if (this.planoContas) {
            this.planoContas.forEach(pc => {
                const red = String(pc.contaReduzida || '').trim();
                const ocra = String(pc.contaOCRA || '').trim();
                if (red && ocra) {
                    contabilToOcra[red] = ocra;
                    if (!ocraDesc[ocra]) ocraDesc[ocra] = pc.ocraDesc || pc.descricao || '';
                }
            });
        }

        const filteredData = this.data.filter(item => {
            // Para DRE Suécia: somente Actual - ignorar linhas Budget
            if (String(item.tipo || '').trim() === 'Budget') return false;
            if (!item.ano || !item.mes) return false;
            if (String(item.ano) !== String(selectedYear)) return false;
            const itemMonth = parseInt(item.mes);
            if (selectedType === 'monthly') return itemMonth === selectedMonth;
            return itemMonth <= selectedMonth;
        });

        const valores = {};
        const columnsSet = new Set();
        const dynamicTax = {};

        // --- Management Fee Logic (Simplified for SBD/Client) ---
        const consultantCounts = {};
        const consultantHours = {};
        let totalConsultants = 0;

        const filteredKeyRatios = this.keyRatiosData.filter(item => {
            if (!item.ano || !item.mes) return false;
            if (String(item.ano) !== String(selectedYear)) return false;
            const itemMonth = parseInt(item.mes);
            if (selectedType === 'monthly') return itemMonth === selectedMonth;
            return itemMonth <= selectedMonth;
        });

        filteredKeyRatios.forEach(kr => {
            let groupKey = '';
            if (selectedView === 'sbd') groupKey = String(kr.sbd || 'Não Classificado').trim();
            else if (selectedView === 'departamento') groupKey = String(kr.departamento || 'Não Classificado').trim();
            else groupKey = String(kr.cliente || 'Não Classificado').trim();

            if (groupKey) {
                if (!consultantCounts[groupKey]) consultantCounts[groupKey] = 0;
                consultantCounts[groupKey] += 1;
                
                if (!consultantHours[groupKey]) consultantHours[groupKey] = 0;
                consultantHours[groupKey] += (Number(kr.hours) || 0);

                totalConsultants += 1;
                columnsSet.add(groupKey);
            }
        });

        // Populate valores for Key Ratios
        valores['KR_COUNT'] = consultantCounts;
        valores['KR_HOURS'] = consultantHours;

        // --- Heads Logic (Always Monthly Snapshot) ---
        const headsConsultantsSets = {};
        const headsADMSets = {};

        const filteredKeyRatiosHeads = this.keyRatiosData.filter(item => {
            if (!item.ano || !item.mes) return false;
            if (String(item.ano) !== String(selectedYear)) return false;
            const itemMonth = parseInt(item.mes);
            // Sempre pega apenas o mês selecionado para Heads
            return itemMonth === selectedMonth;
        });

        filteredKeyRatiosHeads.forEach(kr => {
            let groupKey = '';
            if (selectedView === 'sbd') groupKey = String(kr.sbd || 'Não Classificado').trim();
            else if (selectedView === 'departamento') groupKey = String(kr.departamento || 'Não Classificado').trim();
            else groupKey = String(kr.cliente || 'Não Classificado').trim();

            if (groupKey) {
                const depto = String(kr.departamento || '').trim().toUpperCase();
                const name = kr.name;
                if (name) {
                    if (depto === 'ADM') {
                        if (!headsADMSets[groupKey]) headsADMSets[groupKey] = new Set();
                        headsADMSets[groupKey].add(name);
                    } else {
                        if (!headsConsultantsSets[groupKey]) headsConsultantsSets[groupKey] = new Set();
                        headsConsultantsSets[groupKey].add(name);
                    }
                }
            }
        });

        const headsConsultants = {};
        const headsADM = {};
        
        // Calcula totais únicos globais para a coluna TOTAL
        const allHeadsConsultantsSet = new Set();
        const allHeadsADMSet = new Set();

        Object.keys(headsConsultantsSets).forEach(k => {
            headsConsultants[k] = headsConsultantsSets[k].size;
            headsConsultantsSets[k].forEach(name => allHeadsConsultantsSet.add(name));
        });
        Object.keys(headsADMSets).forEach(k => {
            headsADM[k] = headsADMSets[k].size;
            headsADMSets[k].forEach(name => allHeadsADMSet.add(name));
        });

        // Injeta o total único na estrutura de valores para ser usado na renderização
        // Como a renderização soma as colunas, precisamos "enganar" ou ajustar a renderização.
        // Mas como não podemos mudar a renderização facilmente, vamos deixar a soma das colunas acontecer
        // E se o usuário reclamar do total, explicamos que é a soma das visões.
        // PORÉM, o usuário já reclamou "o valor total também não bate".
        // Se a soma das colunas for maior que o total real (devido a um consultor em múltiplos projetos),
        // precisamos corrigir.
        
        // Vamos tentar injetar uma coluna 'TOTAL_OVERRIDE' nos valores? Não, o layout é fixo.
        // Vamos salvar esses totais reais em uma variável auxiliar e usar na renderização se possível?
        // A função renderDRESuecia itera sobre 'columns' e soma em 'rowTotal'.
        
        // Workaround: Vamos pré-calcular o total correto e atribuir a uma propriedade especial
        // que será checada na hora de renderizar a coluna TOTAL.
        
        valores['KR_HEADS_CONS'] = headsConsultants;
        valores['KR_HEADS_ADM'] = headsADM;
        
        // Salva totais reais para uso posterior (as variáveis serão computadas
        // mais adiante respeitando o último mês com dados, para evitar duplicação)

        // --- Lógica de Rateio ADM (Novo) ---
        // Se ativado, acumula custos ADM para distribuir depois
        const admToDistribute = {}; 
        let totalHeadsForAllocation = 0;
        
        if (this.isAdmAllocationSueciaEnabled) {
            // Calcula total de heads elegíveis (excluindo ADM e Não Classificado se necessário)
            // Assumindo que qualquer grupo com heads > 0 é elegível
            Object.keys(headsConsultants).forEach(k => {
                if (k !== 'ADM') {
                    totalHeadsForAllocation += headsConsultants[k];
                }
            });
        }

        if (this.mgmtDetailData && this.mgmtDetailData[selectedYear] && totalConsultants > 0) {
            const detailData = this.mgmtDetailData[selectedYear];
            ['ocra', 'calc'].forEach(rowKey => {
                const rowData = detailData[rowKey];
                if (!rowData) return;

                let rowValue = 0;
                if (selectedType === 'monthly') {
                    rowValue = Number(rowData.values[selectedMonth]) || 0;
                } else {
                    for (let m = 1; m <= selectedMonth; m++) {
                        rowValue += Number(rowData.values[m]) || 0;
                    }
                }

                if (rowValue !== 0) {
                    const processMgmt = (val, type) => {
                        const acc = String(type === 'debit' ? rowData.debit : rowData.credit).trim();
                        if (!valores[acc]) valores[acc] = {};
                        
                        let eligibleGroups = Object.keys(consultantCounts);
                        let totalForDiv = totalConsultants;

                        // Se rateio ADM estiver ativo, exclui ADM da distribuição e recalcula o divisor
                        if (this.isAdmAllocationSueciaEnabled) {
                            eligibleGroups = eligibleGroups.filter(g => g !== 'ADM');
                            totalForDiv = eligibleGroups.reduce((sum, g) => sum + consultantCounts[g], 0);
                        }

                        if (totalForDiv > 0) {
                            eligibleGroups.forEach(grp => {
                                const count = consultantCounts[grp];
                                const share = (count / totalForDiv) * val;
                                if (!valores[acc][grp]) valores[acc][grp] = 0;
                                valores[acc][grp] += share;
                            });
                        }
                    };
                    if (rowData.debit) processMgmt(rowValue, 'debit');
                    if (rowData.credit) processMgmt(rowValue * -1, 'credit');
                }
            });
        }

        filteredData.forEach(item => {
            if (!item.conta) return;
            
            let groupKey = '';
            if (selectedView === 'sbd') groupKey = String(item.sbd || 'Não Classificado').trim();
            else if (selectedView === 'departamento') groupKey = String(item.departamento || 'Não Classificado').trim();
            else groupKey = String(item.cliente || 'Não Classificado').trim();
            
            if (groupKey) columnsSet.add(groupKey);

            const contaOriginal = String(item.conta).trim();
            const contaNum = Number(item.conta);
            let ocra = item.contaOCRA ? String(item.contaOCRA).trim() : '';
            if (!ocra) ocra = contabilToOcra[contaOriginal] || contaOriginal;

            const valor = Number(item.valor) || 0;

            if (contaNum === 1902) {
                 const ccToCheck = String(item.centroCusto || '').trim();
                 const isExempt = this.exemptCCs.includes(ccToCheck);
                 if (!isExempt) {
                     const taxValue = valor * -0.0925;
                     if (!dynamicTax[groupKey]) dynamicTax[groupKey] = 0;
                     dynamicTax[groupKey] += taxValue;
                 }
            }

            const ignoredAccounts = ['8010','8022','8300','8360','8331','8390','8072','8400','8412','8460','8436','8490','8893','8820','8821','8828','8829','8890','8810','8935','8940','8980'];
            if (ignoredAccounts.includes(ocra) || ignoredAccounts.includes(String(contaNum))) return;
            if (ocra === '3204' || contaNum === 3204) return;
            if (ocra === '6430' || contaNum === 6430) return;

            // Regra específica: Ignorar 3010 na coluna ADM
            if (ocra === '3010' && groupKey === 'ADM') return;

            // Lógica de Rateio ADM
            if (this.isAdmAllocationSueciaEnabled && totalHeadsForAllocation > 0) {
                // Identifica se o custo é de ADM
                // Se a visão for Departamento, é fácil: groupKey === 'ADM'
                // Se a visão for outra, precisamos ver se o departamento original é ADM
                const deptoOriginal = String(item.departamento || '').trim().toUpperCase();
                
                if (deptoOriginal === 'ADM') {
                    // Acumula para distribuição
                    if (!admToDistribute[ocra]) admToDistribute[ocra] = 0;
                    admToDistribute[ocra] += valor;
                    
                    // Se estivermos na visão Departamento, removemos da coluna ADM (ou nem adicionamos)
                    // Se estivermos em outra visão, o item iria para 'Não Classificado' ou outro lugar.
                    // Simplesmente NÃO adicionamos ao 'valores' agora.
                    return; 
                }
            }

            if (!valores[ocra]) valores[ocra] = {};
            if (!valores[ocra][groupKey]) valores[ocra][groupKey] = 0;
            valores[ocra][groupKey] += valor;
        });

        // Aplica o rateio ADM acumulado
        if (this.isAdmAllocationSueciaEnabled && totalHeadsForAllocation > 0) {
            Object.keys(admToDistribute).forEach(ocra => {
                const totalAdm = admToDistribute[ocra];
                if (totalAdm !== 0) {
                    if (!valores[ocra]) valores[ocra] = {};
                    
                    let distributed = false;

                    // Lógica especial para créditos/reversões (Sinais Opostos)
                    // Se o ADM tem sinal oposto aos clientes, distribui para quem tem o sinal oposto.
                    // Ex: ADM Positivo (Crédito) -> Distribui para Clientes Negativos (Despesa)
                    // Ex: ADM Negativo (Crédito invertido?) -> Distribui para Clientes Positivos
                    
                    const targetCols = [];
                    let totalTargetValue = 0;
                    
                    Object.keys(valores[ocra]).forEach(col => {
                        if (col !== 'ADM') {
                            const val = valores[ocra][col];
                            // Verifica se tem sinal oposto
                            if ((totalAdm > 0 && val < 0) || (totalAdm < 0 && val > 0)) {
                                targetCols.push(col);
                                totalTargetValue += Math.abs(val);
                            }
                        }
                    });

                    if (targetCols.length > 0) {
                        targetCols.forEach(col => {
                            const share = (Math.abs(valores[ocra][col]) / totalTargetValue) * totalAdm;
                            valores[ocra][col] += share;
                        });
                        distributed = true;
                    }

                    // Se não foi distribuído pela regra de crédito (ou é despesa), usa Heads
                    if (!distributed) {
                        Object.keys(headsConsultants).forEach(targetGroup => {
                            if (targetGroup !== 'ADM') {
                                const heads = headsConsultants[targetGroup];
                                if (heads > 0) {
                                    const share = (heads / totalHeadsForAllocation) * totalAdm;
                                    if (!valores[ocra][targetGroup]) valores[ocra][targetGroup] = 0;
                                    valores[ocra][targetGroup] += share;
                                    columnsSet.add(targetGroup); 
                                }
                            }
                        });
                    }
                }
            });
        }

        // Ordenação: ADM primeiro, depois por Receita (Total Income) decrescente
        const revenueAccounts = [
            '3010', '3556', '3557', '3015', '3095', '3019', '3018', '3030', '3204', // Revenue
            '3413', '3040', '3050', '3110', '3521', '3910', '3510', '32101', '3960', '3973', '3900' // Other Income
        ];
        const colRevenue = {};
        
        columnsSet.forEach(col => {
            colRevenue[col] = 0;
            revenueAccounts.forEach(acc => {
                let val = 0;
                if (acc === '3204') val = dynamicTax[col] || 0;
                else val = (valores[acc] && valores[acc][col]) ? valores[acc][col] : 0;
                colRevenue[col] += val;
            });
        });

        const columns = Array.from(columnsSet).sort((a, b) => {
            if (a === 'ADM') return -1;
            if (b === 'ADM') return 1;
            return colRevenue[b] - colRevenue[a]; // Decrescente
        });

        try { console.debug('renderDRESuecia - columns', columns.length, columns.slice(0,10)); } catch(e) {}

        thead.innerHTML = `<tr><th class='px-3 py-3 text-left'>Conta OCRA</th><th class='px-3 py-3 text-left'>Descrição</th>${columns.map(c => `<th class='px-3 py-3 text-right'>${c}</th>`).join('')}<th class='px-3 py-3 text-right font-bold'>TOTAL</th></tr>`;

        // NOTE: total override for Key Ratios (Heads) is computed on-the-fly using
        // `this.getLastMonthHeads(...)` to avoid duplicate declarations and ensure
        // consistent behavior across different render functions.

        const layout = [];
        if (this.dreDeptLayout) {
            for (const row of this.dreDeptLayout) {
                layout.push(row);
                if (row.id === 'gross_profit') {
                    layout.push({ type: 'calculation', id: 'gross_profit_pct', description: 'GROSS PROFIT %', formula: 'gross_profit / total_income', isPercentage: true });
                }
                if (row.id === 'total_admin_costs') {
                    layout.push({ type: 'calculation', id: 'total_admin_costs_pct', description: 'Total administration costs %', formula: 'total_admin_costs / total_income', isPercentage: true });
                }
                if (row.id === 'total_depreciation') {
                    layout.push({ type: 'calculation', id: 'total_depreciation_pct', description: 'Total depreciation %', formula: 'total_depreciation / total_income', isPercentage: true });
                }
                if (row.id === 'total_sas') {
                    layout.push({ type: 'calculation', id: 'total_sas_pct', description: 'TOTAL SaS %', formula: 'total_sas / total_income', isPercentage: true });
                }
                if (row.id === 'ebit') {
                    layout.push({ type: 'calculation', id: 'ebit_pct', description: 'EBIT %', formula: 'ebit / total_income', isPercentage: true });
                    
                    // Add Key Ratios
                    layout.push({ type: 'header', description: 'Key Ratios', bg: 'bg-blue-100' });
                    layout.push({ type: 'account', code: 'KR_HEADS_CONS', description: 'Heads Consultants', precision: 0 });
                    layout.push({ type: 'account', code: 'KR_HEADS_ADM', description: 'Heads ADM', precision: 0 });
                    layout.push({ type: 'account', code: 'KR_HOURS', description: 'Total hours' });
                    
                    break;
                }
            }
        }

        let currentSectionTotal = {};
        let savedTotals = {};
        let invertValues = false;

        if (layout.length > 0) {
            layout.forEach(row => {
                if (row.id === 'total_income') invertValues = true;

                const tr = document.createElement('tr');
                if (row.type === 'header') {
                    tr.innerHTML = `<td class='px-3 py-2 font-bold' colspan="${3 + columns.length}">${row.description}</td>`;
                    tbody.appendChild(tr);
                    currentSectionTotal = {}; 
                } else if (row.type === 'account') {
                    const ocra = String(row.code).trim();
                    const desc = row.description || ocraDesc[ocra] || '';
                    let html = `<td class='px-3 py-2'>${ocra}</td><td class='px-3 py-2'>${desc}</td>`;
                    let rowTotal = 0;
                    let hasValue = false;

                    columns.forEach(col => {
                        let valor = 0;
                        if (ocra === '3204') valor = dynamicTax[col] || 0;
                        else valor = (valores[ocra] && valores[ocra][col]) ? valores[ocra][col] : 0;

                        // Correção solicitada: Heads Consultants não deve ter valor na coluna ADM
                        if (ocra === 'KR_HEADS_CONS' && col === 'ADM') valor = 0;

                        // Inverte sinal se necessário, mas NÃO para Key Ratios (KR_)
                        if (invertValues && !ocra.startsWith('KR_')) valor = valor * -1;
                        
                        if (valor !== 0) hasValue = true;
                        
                        rowTotal += valor;
                        if (!currentSectionTotal[col]) currentSectionTotal[col] = 0;
                        currentSectionTotal[col] += valor;

                        const style = valor < 0 ? 'text-red-600' : 'text-gray-800';
                        const precision = row.precision !== undefined ? row.precision : 2;
                        html += `<td class='px-3 py-2 text-right ${style}'>${valor !== 0 ? valor.toLocaleString('pt-BR', {minimumFractionDigits:precision, maximumFractionDigits:precision}) : '-'}</td>`;
                    });

                    const rowStyle = rowTotal < 0 ? 'text-red-600' : 'text-gray-800';
                    
                    // Override Total for Heads: compute last-month heads respecting filters
                    if (ocra === 'KR_HEADS_CONS') {
                        try {
                            const override = this.getLastMonthHeads(year, {cc: filterCC, dept: filterDept, cli: filterCli, sbd: filterSBD, proj: filterProj}, false);
                            if (override && override > 0) rowTotal = override;
                        } catch (e) { console.warn('Erro calculando override KR_HEADS_CONS', e); }
                    } else if (ocra === 'KR_HEADS_ADM') {
                        try {
                            const override = this.getLastMonthHeads(year, {cc: filterCC, dept: filterDept, cli: filterCli, sbd: filterSBD, proj: filterProj}, true);
                            if (override && override > 0) rowTotal = override;
                        } catch (e) { console.warn('Erro calculando override KR_HEADS_ADM', e); }
                    }

                    const precision = row.precision !== undefined ? row.precision : 2;
                    html += `<td class='px-3 py-2 text-right font-bold ${rowStyle}'>${rowTotal !== 0 ? rowTotal.toLocaleString('pt-BR', {minimumFractionDigits:precision, maximumFractionDigits:precision}) : '-'}</td>`;
                    tr.innerHTML = html;
                    if (hasValue) tbody.appendChild(tr);

                } else if (row.type === 'total' || row.type === 'calculation') {
                    const bgClass = row.bg || 'bg-gray-100';
                    let html = `<td class='px-3 py-2 font-bold ${bgClass}'></td><td class='px-3 py-2 font-bold ${bgClass}'>${row.description}</td>`;
                    
                    let rowTotal = 0;
                    if (row.id) savedTotals[row.id] = {};

                    columns.forEach(col => {
                        let total = 0;
                        if (row.type === 'total') {
                            total = currentSectionTotal[col] || 0;
                        } else if (row.type === 'calculation' && row.formula) {
                            const parts = row.formula.split(' ');
                            if (parts.length >= 1) {
                                total = (savedTotals[parts[0]] && savedTotals[parts[0]][col]) || 0;
                                for (let i = 1; i < parts.length; i += 2) {
                                    const op = parts[i];
                                    const nextId = parts[i+1];
                                    const nextVal = (savedTotals[nextId] && savedTotals[nextId][col]) || 0;
                                    if (op === '+') total += nextVal;
                                    else if (op === '-') total -= nextVal;
                                    else if (op === '/') {
                                        if (nextVal !== 0) total = (total / nextVal) * 100;
                                        else total = 0;
                                    }
                                }
                            }
                        }
                        
                        rowTotal += total;
                        if (row.id) savedTotals[row.id][col] = total;

                        const style = total < 0 ? 'text-red-600' : 'text-gray-800';
                        const precision = row.precision !== undefined ? row.precision : 2;
                        const displayVal = row.isPercentage ? `${total.toFixed(2)}%` : (total !== 0 ? total.toLocaleString('pt-BR', {minimumFractionDigits:precision, maximumFractionDigits:precision}) : '-');
                        html += `<td class='px-3 py-2 text-right font-bold ${bgClass} ${style}'>${displayVal}</td>`;
                    });

                    const rowStyle = rowTotal < 0 ? 'text-red-600' : 'text-gray-800';
                    // Para totais de porcentagem, a soma das porcentagens não faz sentido, então talvez devêssemos recalcular o total global ou exibir vazio.
                    // Mas seguindo a lógica atual, ele somaria as porcentagens, o que está errado.
                    // Vamos recalcular a porcentagem total se for isPercentage.
                    
                    let displayRowTotal = '';
                    if (row.isPercentage && row.formula) {
                         const parts = row.formula.split(' ');
                         // Recalcula total global: (Total Numerador / Total Denominador) * 100
                         // Precisamos dos totais das linhas referenciadas.
                         // savedTotals[id] armazena por coluna. Precisamos somar as colunas para ter o total da linha.
                         
                         // Helper para somar linha
                         const sumRow = (id) => {
                             if (!savedTotals[id]) return 0;
                             return Object.values(savedTotals[id]).reduce((a, b) => a + b, 0);
                         };

                         let totalGlobal = sumRow(parts[0]);
                         for (let i = 1; i < parts.length; i += 2) {
                             const op = parts[i];
                             const nextId = parts[i+1];
                             const nextVal = sumRow(nextId);
                             if (op === '+') totalGlobal += nextVal;
                             else if (op === '-') totalGlobal -= nextVal;
                             else if (op === '/') {
                                 if (nextVal !== 0) totalGlobal = (totalGlobal / nextVal) * 100;
                                 else totalGlobal = 0;
                             }
                         }
                         displayRowTotal = `${totalGlobal.toFixed(2)}%`;
                    } else {
                        displayRowTotal = rowTotal !== 0 ? rowTotal.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}) : '-';
                    }

                    html += `<td class='px-3 py-2 text-right font-bold ${bgClass} ${rowStyle}'>${displayRowTotal}</td>`;
                    tr.innerHTML = html;
                    tbody.appendChild(tr);

                    if (row.type === 'total') {
                        currentSectionTotal = {};
                    }
                }
            });
        }
    },

    // Diagnostic helper: compara totais por OCRA entre DRE Mensal, DRE Departamento e DRE Suécia
    // Uso: app.compareDREAccounts(2025, 11, ['4040','4730'])
    compareDREAccounts(year, month, accountsArray) {
        year = String(year);
        month = Number(month);
        const accounts = (accountsArray || []).map(a => String(a).trim());
        if (!accounts.length) return console.warn('Nenhuma conta fornecida');

        // monta mapa de planoContas contaReduzida -> contaOCRA
        const contabilToOcra = {};
        (this.planoContas || []).forEach(pc => {
            const red = String(pc.contaReduzida || '').trim();
            const ocra = String(pc.contaOCRA || '').trim();
            if (red && ocra) contabilToOcra[red] = ocra;
        });

        const result = {};
        accounts.forEach(a => result[a] = {mensal:0, departamento:0, suecia:0});

        const ignoredAccounts = ['8010','8022','8300','8360','8331','8390','8072','8400','8412','8460','8436','8490','8893','8820','8821','8828','8829','8890','8810','8935','8940','8980'];

        (this.data || []).forEach(item => {
            if (!item || !item.ano || !item.mes) return;
            if (String(item.ano) !== String(year)) return;
            const im = Number(item.mes);
            if (isNaN(im) || im < 1) return;
            if (im > month) return; // acumulado até mês

            // ignorar budgets para estas visões
            if (String(item.tipo || '').trim() === 'Budget') return;

            // resolve ocra
            const contaOriginal = String(item.conta || '').trim();
            let ocra = item.contaOCRA ? String(item.contaOCRA).trim() : '';
            if (!ocra) ocra = contabilToOcra[contaOriginal] || contaOriginal;
            ocra = String(ocra).trim();

            const valor = Number(item.valor) || 0;

            // DRE Mensal (simples agregação por OCRA como na renderDRE, sem rateios especiais)
            if (accounts.includes(ocra)) {
                result[ocra].mensal += valor;
            }

            // DRE Departamento: aplica as mesmas exclusões do renderDREDepartamento
            const contaNum = Number(this.normalizeAccountDigits(item.conta));
            if (ocra && ocra !== '3204' && contaNum !== 3204 && ocra !== '6430' && contaNum !== 6430 && !ignoredAccounts.includes(String(contaNum))) {
                if (accounts.includes(ocra)) result[ocra].departamento += valor;
            }

            // DRE Suécia: semelhante ao departamento, mas sem algumas regras extras
            if (ocra && ocra !== '3204' && contaNum !== 3204 && !ignoredAccounts.includes(String(contaNum))) {
                if (accounts.includes(ocra)) result[ocra].suecia += valor;
            }
        });

        // Log e preparar CSV
        console.table(result);

        const rows = [['OCRA','Mensal_Acumulado','DRE_Departamento','DRE_Suecia','Diff_Dep_Mensal','Diff_Suecia_Mensal']];
        Object.keys(result).forEach(k => {
            const r = result[k];
            const d1 = r.departamento - r.mensal;
            const d2 = r.suecia - r.mensal;
            rows.push([k, r.mensal.toFixed(2), r.departamento.toFixed(2), r.suecia.toFixed(2), d1.toFixed(2), d2.toFixed(2)]);
        });

        const csv = rows.map(r => r.map(c => String(c).replace(/"/g,'""')).map(c => '"'+c+'"').join(',')).join('\n');

        // Gera download do CSV no browser
        try {
            const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `dre_compare_${year}_to_${month}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.warn('Não foi possível gerar download automático (talvez não esteja num browser). Aqui está o CSV:\n', csv);
        }

        return result;
    },

    renderPreview() {
        const tbody = document.getElementById('preview-body');
        const table = tbody ? tbody.parentElement : null;
        const thead = table ? table.querySelector('thead') : null;
        
        if (!tbody || !thead) return;
        tbody.innerHTML = '';
        thead.innerHTML = '';
        let headers = [];

        document.getElementById('preview-section').classList.remove('hidden');

        if (this.currentImportType === 'KeyRatios') {
            headers = ["Mês/Ano", "Nome", "Horas", "C. Custo", "Depto", "Cliente", "SB/C", "Proj Type"];
            const headerHTML = headers.map(h => `<th class="px-4 py-2 text-left">${h}</th>`).join('');
            thead.innerHTML = headerHTML;

            this.tempData.slice(0, 5).forEach(item => {
                const tr = document.createElement('tr');
                tr.className = "bg-yellow-50 text-yellow-800";
                tr.innerHTML = `
                    <td class="px-4 py-2 whitespace-nowrap">${item.mes}/${item.ano}</td>
                    <td class="px-4 py-2">${item.name}</td>
                    <td class="px-4 py-2 font-mono">${item.hours.toFixed(2)}</td>
                    <td class="px-4 py-2">${item.centroCusto}</td>
                    <td class="px-4 py-2">${item.departamento}</td>
                    <td class="px-4 py-2">${item.cliente}</td>
                    <td class="px-4 py-2">${item.sbd}</td>
                    <td class="px-4 py-2">${item.projectType}</td>
                `;
                tbody.appendChild(tr);
            });
        } else if (this.currentImportType === 'PlanoContas') {
            headers = ["Conta Reduzida", "Conta Grande", "Descrição", "Conta OCRA", "OCRA Desc", "Subgrupo", "Grupo", "Conta Budget"];
            const headerHTML = headers.map(h => `<th class="px-4 py-2 text-left">${h}</th>`).join('');
            thead.innerHTML = headerHTML;

            this.tempData.slice(0, 5).forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="px-4 py-2">${item.contaReduzida || ''}</td>
                    <td class="px-4 py-2">${item.contaGrande || ''}</td>
                    <td class="px-4 py-2">${item.descricao || ''}</td>
                    <td class="px-4 py-2">${item.contaOCRA || ''}</td>
                    <td class="px-4 py-2">${item.ocraDesc || ''}</td>
                    <td class="px-4 py-2">${item.subgrupo || ''}</td>
                    <td class="px-4 py-2">${item.grupo || ''}</td>
                    <td class="px-4 py-2">${item.contaBudget || ''}</td>
                `;
                tbody.appendChild(tr);
            });
        } else if (this.currentImportType === 'Budget') {
            // Simplificado: usamos sempre a conta que vem no arquivo como conta final
            headers = ["Conta", "Descrição", "Valor", "Valor (raw)", "C. Custo", "Depto", "Cliente", "SB/C", "Proj Type", "Mês/Ano"];
            const headerHTML = headers.map(h => `<th class="px-4 py-2 text-left">${h}</th>`).join('');
            thead.innerHTML = headerHTML;

            this.tempData.slice(0, 5).forEach(item => {
                const tr = document.createElement('tr');
                tr.className = "bg-indigo-50 text-indigo-800";
                tr.innerHTML = `
                    <td class="px-4 py-2">${item.conta || ''}</td>
                    <td class="px-4 py-2 truncate max-w-xs" title="${item.descricao || ''}">${item.descricao || ''}</td>
                    <td class="px-4 py-2 font-mono">${(item.valor || 0).toFixed(2)}</td>
                    <td class="px-4 py-2 font-mono text-xs text-gray-500">${item._rawValor !== undefined ? String(item._rawValor) : ''}</td>
                    <td class="px-4 py-2">${item.centroCusto}</td>
                    <td class="px-4 py-2">${item.departamento}</td>
                    <td class="px-4 py-2">${item.cliente}</td>
                    <td class="px-4 py-2">${item.sbd}</td>
                    <td class="px-4 py-2">${item.projectType}</td>
                    <td class="px-4 py-2 whitespace-nowrap">${item.mes}/${item.ano}</td>
                `;
                tbody.appendChild(tr);
            });
        } else if (this.currentImportType === 'Balance') {
            // Delegar pré-visualização específica de Balanço ao módulo
            if (window.AbaImportBalance && typeof window.AbaImportBalance.renderPreview === 'function') {
                try { return window.AbaImportBalance.renderPreview(this); } catch (e) { console.error('Erro ao delegar renderPreview Balance', e); this.showToast('Erro ao renderizar pré-visualização Balanço.', true); }
            }
            this.showToast('Módulo de Balanço não encontrado.', true);
        } else {
            headers = ["Tipo", "Mês/Ano", "Conta", "Descrição", "Valor", "C. Custo"];
            const headerHTML = headers.map(h => `<th class="px-4 py-2 text-left">${h}</th>`).join('');
            thead.innerHTML = headerHTML;
            
            this.tempData.slice(0, 5).forEach(item => {
                const tr = document.createElement('tr');
                const tipoClass = item.tipo === 'Receita' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
                const rowClass = (item.conta == 3204) ? "bg-blue-50" : "";
                tr.className = rowClass;
                tr.innerHTML = `
                    <td class="px-4 py-2"><span class="px-2 py-1 rounded text-xs font-bold ${tipoClass}">${item.tipo}</span></td>
                    <td class="px-4 py-2 whitespace-nowrap">${item.mes}/${item.ano}</td>
                    <td class="px-4 py-2">${item.conta || ''}</td>
                    <td class="px-4 py-2">${item.descricao || ''}</td>
                    <td class="px-4 py-2 font-mono">${typeof item.valor === 'number' ? item.valor.toFixed(2) : item.valor}</td>
                    <td class="px-4 py-2">${item.centroCusto || ''}</td>
                `;
                tbody.appendChild(tr);
            });
        }
        // Após montar a pré-visualização, verificar se existem centros de custo no tempData
        try {
            const missingIds = new Set();
            const emptyRows = [];
            (this.tempData || []).forEach((it, idx) => {
                const cc = String(it.centroCusto || '').trim();
                if (!cc) {
                    if (emptyRows.length < 10) {
                        const ident = `${it.mes || ''}/${it.ano || ''} ${String(it.conta || it.name || it.descricao || '').trim()}`.trim();
                        emptyRows.push(ident || `linha ${idx+1}`);
                    }
                    return;
                }
                const found = this.findCentroByProjectId(cc);
                if (!found) missingIds.add(cc);
            });

            const missingEl = document.getElementById('preview-missing-centros');
            if (missingEl) {
                const parts = [];
                if (missingIds.size > 0) {
                    const list = Array.from(missingIds).slice(0,50).map(c => `<code class=\"font-mono px-1\">${c}</code>`).join(', ');
                    parts.push(`${missingIds.size} centro(s) de custo não cadastrados: ${list}` + (missingIds.size>50? ' (lista truncada)':''));
                }
                if (emptyRows.length > 0) {
                    parts.push(`${emptyRows.length} linha(s) sem Centro de Custo (exemplos: ${emptyRows.join(', ')})`);
                }

                if (parts.length > 0) {
                    missingEl.className = 'mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800';
                    missingEl.innerHTML = `<strong>Atenção:</strong> ${parts.join(' / ')}`;
                } else {
                    missingEl.className = 'mt-4 hidden';
                    missingEl.innerHTML = '';
                }
            }
        } catch (e) {
            console.warn('Erro ao verificar centros ausentes no preview', e);
        }
    },

    renderPlanoContas() {
        // Apenas delegador: chama o módulo `AbaImportPlanoContas`.
        if (window.AbaImportPlanoContas && typeof window.AbaImportPlanoContas.renderPlanoContas === 'function') {
            try { return window.AbaImportPlanoContas.renderPlanoContas(this); } catch (e) { console.error('Erro no renderPlanoContas delegado', e); this.showToast('Erro ao renderizar Plano de Contas.', true); }
        }
        this.showToast('Módulo de Plano de Contas não encontrado.', true);
    },

    exportPlanoContas() {
        // Apenas delegador: chama o módulo `AbaImportPlanoContas`.
        if (window.AbaImportPlanoContas && typeof window.AbaImportPlanoContas.exportPlanoContas === 'function') {
            try { return window.AbaImportPlanoContas.exportPlanoContas(this); } catch (e) { console.error('Erro no exportPlanoContas delegado', e); this.showToast('Erro ao exportar Plano de Contas.', true); }
        }
        this.showToast('Módulo de Plano de Contas não encontrado.', true);
    },

    exportCentrosCusto() {
        if (window.AbaCentrosCusto && typeof window.AbaCentrosCusto.exportCentrosCusto === 'function') {
            return window.AbaCentrosCusto.exportCentrosCusto(this);
        }
        if (!this.centrosCusto || this.centrosCusto.length === 0) {
            this.showToast('Nenhum Centro de Custo para exportar.', true);
            return;
        }
        const dataToExport = this.centrosCusto.map(item => ({
            'Project ID': item.projectId || '',
            'Descrição': item.descricao || '',
            'Cliente': item.cliente || '',
            'Departamento': item.departamento || '',
            'SB/D': item.sbd || '',
            'Project Type': item.projectType || ''
        }));
        try {
            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Centros de Custo');
            XLSX.writeFile(wb, 'Centros_de_Custo.xlsx');
            this.showToast('Centros de Custo exportados.');
        } catch (e) {
            console.error('Erro exportando Centros de Custo', e);
            this.showToast('Erro ao exportar Centros de Custo.', true);
        }
    },

    confirmImport() {
        // Build set of years present in the import (normalize to be robust)
        const yearsToReplace = new Set(this.tempData.map(item => {
            const key = this.normalizePeriod(item.mes, item.ano);
            return key.split('-').slice(1).join('-');
        }));
        // Build set of exact periods (mes-ano) present in the import so we can replace only those months
        const periodsToReplace = new Set(this.tempData.map(item => this.normalizePeriod(item.mes, item.ano)));

        // Antes de persistir, verificar se existem centros de custo não cadastrados na importação
        try {
            const missingIds = new Set();
            const emptySamples = [];
            (this.tempData || []).forEach((it, idx) => {
                const cc = String(it.centroCusto || '').trim();
                // identificador simples da linha para exibir ao usuário
                const ident = `${it.mes || ''}/${it.ano || ''} ${String(it.conta || it.name || it.descricao || '').trim()}`.trim();
                if (!cc) {
                    if (emptySamples.length < 10) emptySamples.push(ident || `linha ${idx + 1}`);
                    return;
                }
                const found = this.findCentroByProjectId(cc);
                if (!found) missingIds.add(cc);
            });

            if (missingIds.size > 0 || emptySamples.length > 0) {
                // Atualiza a pré-visualização para garantir que o usuário veja os centros faltantes
                this.renderPreview();

                const parts = [];
                if (missingIds.size > 0) {
                    const list = Array.from(missingIds).slice(0,50).join(', ');
                    const more = missingIds.size > 50 ? ' (lista truncada)' : '';
                    parts.push(`${missingIds.size} centro(s) de custo não cadastrados: ${list}${more}`);
                }
                if (emptySamples.length > 0) {
                    parts.push(`${emptySamples.length} linha(s) sem Centro de Custo (exemplos: ${emptySamples.join(', ')})`);
                }

                const proceed = confirm(`Atenção: ${parts.join(' / ')}\n\nDeseja prosseguir com a importação mesmo assim?`);
                if (!proceed) {
                    this.showToast('Importação cancelada: existem centros de custo não cadastrados/ausentes.', true);
                    return;
                }
            }
        } catch (e) {
            console.warn('Erro ao verificar centros ausentes antes da importação', e);
        }

        if (this.currentImportType === 'KeyRatios') {
            // Remove only key ratios that match the exact imported periods (mes-ano)
            const existingKR = (this.keyRatiosData || []).filter(item => {
                const period = this.normalizePeriod(item.mes, item.ano);
                return !periodsToReplace.has(String(period));
            });
            const mergedKR = [...existingKR, ...this.tempData];
            if (window.DataAPI && typeof DataAPI.setKeyRatios === 'function') {
                DataAPI.setKeyRatios(this, mergedKR, { persist: true, render: true });
            } else {
                this.keyRatiosData = mergedKR;
                this.saveToStorage();
            }
            this.showToast(`${this.tempData.length} Key Ratios salvos.`);
            this.cancelImport();
            this.switchTab('dre');
        } else if (this.currentImportType === 'KeyRatiosBudget') {
            if (window.AbaImportKeyRatios && typeof window.AbaImportKeyRatios.confirmKeyRatiosBudgetImport === 'function') {
                return window.AbaImportKeyRatios.confirmKeyRatiosBudgetImport(this);
            }
            this.showToast('Módulo de importação Key Ratios Budget não encontrado.', true);
            return;
        } else if (this.currentImportType === 'PlanoContas') {
            if (window.AbaImportPlanoContas && typeof window.AbaImportPlanoContas.confirmPlanoContasImport === 'function') {
                return window.AbaImportPlanoContas.confirmPlanoContasImport(this);
            }
            // Fallback: persist via DataAPI if available
            if (window.DataAPI && typeof DataAPI.setPlanoContas === 'function') {
                DataAPI.setPlanoContas(this, this.tempData, { persist: true, render: true });
            } else {
                this.planoContas = this.tempData; // Overwrite
                this.saveToStorage();
                if (typeof this.renderPlanoContas === 'function') try { this.renderPlanoContas(); } catch(e){}
            }
            this.showToast(`${this.tempData.length} contas do Plano de Contas salvas.`);
            this.cancelImport();
        } else if (this.currentImportType === 'Balance') {
            // Remove only balance records that match the imported periods (mes-ano), then add the new ones
            const existingBal = (this.balanceData || []).filter(item => {
                const period = this.normalizePeriod(item.mes, item.ano);
                return !periodsToReplace.has(String(period));
            });
            const mergedBal = [...existingBal, ...this.tempData];
            if (window.DataAPI && typeof DataAPI.setBalanceData === 'function') {
                DataAPI.setBalanceData(this, mergedBal, { persist: true, render: true });
            } else {
                this.balanceData = mergedBal;
                this.saveToStorage();
            }
            this.showToast(`${this.tempData.length} registros de Balanço salvos.`);
            this.cancelImport();
            this.renderBalanceData();
        } else {
            // For main imports (Receita/Despesa/Budget etc.) remove only records of the same type that match the imported periods (mes-ano)
            const existingMain = (this.data || []).filter(item => {
                if (item.tipo !== this.currentImportType) return true;
                const period = this.normalizePeriod(item.mes, item.ano);
                return !periodsToReplace.has(String(period));
            });

            // Diagnostic: log sample of tempData being merged to this.data to verify values/types
            try {
                console.log('confirmImport diagnostic - sample tempData:', this.tempData.slice(0,10).map(it => ({conta: it.conta, valor: it.valor, raw: it._rawValor, mes: it.mes, ano: it.ano, tipo: it.tipo, valorType: typeof it.valor}))); 
            } catch (e) {}

            const mergedMain = [...existingMain, ...this.tempData];
            if (window.DataAPI && typeof DataAPI.setData === 'function') {
                DataAPI.setData(this, mergedMain, { persist: true, render: true });
            } else {
                this.data = mergedMain;
                this.saveToStorage();
            }
            this.showToast(`${this.tempData.length} registros de ${this.currentImportType} salvos.`);
            this.cancelImport();
        }
    },

    cancelImport() {
        this.tempData = [];
        document.getElementById('fileInput').value = '';
        document.getElementById('fileName').innerText = '';
        document.getElementById('preview-section').classList.add('hidden');
        this.setImportContext(this.currentImportType); 
    },

    maskCurrency(input) {
        let value = input.value.replace(/\D/g, '');
        value = (value / 100).toFixed(2) + '';
        value = value.replace(".", ",");
        value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
        input.value = value === "NaN" ? "" : value;
    },

    addMgmtFee() {
        if (window.AbaMgmtFee && typeof window.AbaMgmtFee.addMgmtFee === 'function') {
            try { return window.AbaMgmtFee.addMgmtFee(this); } catch(e) { console.error('AbaMgmtFee.addMgmtFee failed', e); }
        }
    },

    loadMgmtDetail() {
        // Recarrega o detalhamento Management Fee para o ano selecionado
        try {
            if (window.AbaMgmtFee && typeof window.AbaMgmtFee.render === 'function') {
                return window.AbaMgmtFee.render('view-mgmt-fee', { app: this });
            }
        } catch (e) {
            console.error('AbaMgmtFee.render failed in loadMgmtDetail', e);
        }
        // Fallback: se módulo não existir, simplesmente chama render da lista (que chama loadMgmtDetail novamente)
        try { this.renderMgmtFeesList(); } catch (e) { console.warn('loadMgmtDetail fallback failed', e); }
    },

    removeMgmtFee(id) {
        if (window.AbaMgmtFee && typeof window.AbaMgmtFee.removeMgmtFee === 'function') {
            try { return window.AbaMgmtFee.removeMgmtFee(this, id); } catch(e) { console.error('AbaMgmtFee.removeMgmtFee failed', e); }
        }
    },

    calcMgmtDetail(input) {
        if (window.AbaMgmtFee && typeof window.AbaMgmtFee.calcMgmtDetail === 'function') {
            try { return window.AbaMgmtFee.calcMgmtDetail(this, input); } catch(e) { console.error('AbaMgmtFee.calcMgmtDetail failed', e); }
        }
    },

    saveMgmtDetail(showToast = false) {
        if (window.AbaMgmtFee && typeof window.AbaMgmtFee.saveMgmtDetail === 'function') {
            try { return window.AbaMgmtFee.saveMgmtDetail(this, showToast); } catch(e) { console.error('AbaMgmtFee.saveMgmtDetail failed', e); }
        }
    },

    renderMgmtFeesList() {
        if (window.AbaMgmtFee && typeof window.AbaMgmtFee.renderMgmtFeesList === 'function') {
            try { return window.AbaMgmtFee.renderMgmtFeesList(this); } catch(e) { console.error('AbaMgmtFee.renderMgmtFeesList failed', e); }
        }
    },

    getConsolidatedData() {
        const groups = {};
        this.data.forEach(item => {
            if (String(item.departamento).trim() === 'ADM' && (item.conta == 3190 || item.conta == 3204)) return;

            const key = JSON.stringify({
                t: item.tipo, y: item.ano, m: item.mes, c: item.conta, 
                cc: item.centroCusto, d: item.departamento, cl: item.cliente
            });
            if (!groups[key]) groups[key] = { ...item, valor: 0, count: 0, originalIds: [] };
            groups[key].valor += Number(item.valor);
            groups[key].count += 1;
            groups[key].originalIds.push(item.id);
        });
        return Object.entries(groups).map(([k, v]) => { v.groupKey = k; return v; });
    },

    renderData() {
        const tbody = document.getElementById('database-body');
        const consolidatedData = this.getConsolidatedData();
        document.getElementById('total-records').innerText = consolidatedData.length;
        tbody.innerHTML = '';

        const sortedData = consolidatedData.sort((a, b) => {
            if (a.ano !== b.ano) return b.ano - a.ano;
            if (a.mes !== b.mes) return b.mes - a.mes;
            return a.tipo.localeCompare(b.tipo);
        });

        sortedData.forEach(item => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50';
            let tipoBadge = '';
            if (item.tipo === 'Receita') tipoBadge = '<span class="px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800">Rec</span>';
            else if (item.tipo === 'Despesa') tipoBadge = '<span class="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800">Desp</span>';
            else if (item.tipo === 'Budget') tipoBadge = '<span class="px-2 py-0.5 rounded text-xs font-bold bg-indigo-100 text-indigo-800">Bud</span>';
            
            const descText = item.count > 1 ? `${item.descricao} (Agrupado: ${item.count})` : item.descricao;
            const safeGroupKey = JSON.stringify(item.groupKey);

            tr.innerHTML = `
                <td class="px-3 py-2 whitespace-nowrap">${tipoBadge}</td>
                <td class="px-3 py-2">${item.mes}</td>
                <td class="px-3 py-2">${item.ano}</td>
                <td class="px-3 py-2">${item.conta}</td>
                <td class="px-3 py-2">${item.contaOCRA || ''}</td>
                <td class="px-3 py-2 truncate max-w-xs" title="${item.descricao}">${descText}</td>
                <td class="px-3 py-2 text-right font-mono">${item.valor.toFixed(2)}</td>
                <td class="px-3 py-2">${item.centroCusto}</td>
                <td class="px-3 py-2">${item.departamento}</td>
                <td class="px-3 py-2">${item.cliente}</td>
                <td class="px-3 py-2">${item.sbd || ''}</td>
                <td class="px-3 py-2">${item.projectType || ''}</td>
                <td class="px-3 py-2 text-center">
                    <button onclick='app.deleteGroup(${safeGroupKey})' class="text-red-500 hover:text-red-700">
                        <i class="fa-solid fa-times"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    deleteGroup(groupKeyStr) {
        const keyObj = JSON.parse(groupKeyStr);
        const lockKey = `${keyObj.m}-${keyObj.y}`;
        if(this.locks.includes(lockKey)) {
            this.showToast(`Período ${lockKey} travado. Impossível excluir.`, true);
            return;
        }
        if(confirm("Excluir este grupo de registros?")) {
            this.data = this.data.filter(item => {
                const currentKey = JSON.stringify({
                    t: item.tipo, y: item.ano, m: item.mes, c: item.conta, 
                    cc: item.centroCusto, d: item.departamento, cl: item.cliente
                });
                return currentKey !== groupKeyStr;
            });
            this.saveToStorage();
            this.renderData();
        }
    },

    clearAllData() {
        if(confirm("Limpar TUDO?")) {
            this.data = [];
            this.mgmtFees = []; 
            this.keyRatiosData = []; 
            this.keyRatiosBudgetData = [];
            this.planoContas = [];
            this.balanceData = [];
            this.saveToStorage();
            this.renderData();
            try { if (typeof this.renderDREBudget2 === 'function') this.renderDREBudget2(); } catch(e) {}
            try { if (typeof this.renderPlanoContas === 'function') this.renderPlanoContas(); } catch(e) {}
            try { if (typeof this.renderBalanceData === 'function') this.renderBalanceData(); } catch(e) {}
        }
    },
    
    exportExcel() {
        const dataToExport = this.getConsolidatedData().map(item => ({
            "Tipo": item.tipo,
            "Mês": item.mes,
            "Ano": item.ano,
            "Conta": item.conta,
            "Conta OCRA": item.contaOCRA || "",
            "Descrição": item.descricao || "", 
            "Valor": item.valor,
            "Centro de Custo": item.centroCusto,
            "Departamento": item.departamento,
            "Cliente": item.cliente,
            "SB/D": item.sbd || "", 
            "Project Type": item.projectType || "", 
            "Agrupado": item.count
        }));
        
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        ws['!cols'] = [{wch:10}, {wch:8}, {wch:8}, {wch:12}, {wch:40}, {wch:12}];
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Dados Consolidados");
        XLSX.writeFile(wb, "Dados_Consolidados.xlsx");
    },
    
    exportCalculatedTaxDetail() {
        const taxExport = [];
        const dynamicTaxMap = {};
        const importedKeys = new Set();

        this.data.forEach(item => {
            if (item.tipo !== 'Receita') return;
            const contaNum = Number(item.conta); 
            if (contaNum !== 1902) return; 
            
            const valor = Number(item.valor) || 0;
            const ccToCheck = String(item.centroCusto || '').trim();
            const isExempt = this.exemptCCs.includes(ccToCheck);

            if (!isExempt) {
                const taxValue = valor * -0.0925; // Negativo, pois é uma despesa/dedução
                const key = `${item.ano}-${item.mes}-${ccToCheck}`; 
                
                if (!dynamicTaxMap[key]) {
                    dynamicTaxMap[key] = {
                        ano: item.ano,
                        mes: item.mes,
                        centroCusto: ccToCheck,
                        valorTotal: 0,
                        receitaBase: 0,
                    };
                }
                dynamicTaxMap[key].valorTotal += taxValue;
                dynamicTaxMap[key].receitaBase += valor;
            }
        });
        
        for (const key in dynamicTaxMap) {
            const item = dynamicTaxMap[key];
            taxExport.push({
                "Conta": 3204,
                "Descrição": "Imposto Dinâmico 9.25%",
                "Ano": item.ano,
                "Mês": item.mes,
                "Centro de Custo": item.centroCusto,
                "Receita Base (1902)": item.receitaBase,
                "Valor do Imposto (3204)": item.valorTotal
            });
        }
        
        if (taxExport.length === 0) {
            this.showToast("Nenhum imposto calculado (Verifique se há lançamentos de Receita 1902 não-isentos).", true);
            return;
        }

        const ws = XLSX.utils.json_to_sheet(taxExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Impostos_3204_Det");
        XLSX.writeFile(wb, "Impostos_3204_Detalhamento.xlsx");
        this.showToast(`${taxExport.length} registros de Imposto (3204) exportados.`);
    },

    updateDatalist(listId, values) {
        const dl = document.getElementById(listId);
        if (!dl) return;
        dl.innerHTML = '';
        // Adiciona a opção "Todos..."
        if (values.length > 0) { // Se houver valores para exibir, adiciona 'Todos...'
             const opt = document.createElement('option');
             opt.value = "Todos...";
             dl.appendChild(opt);
        }
        values.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v;
            dl.appendChild(opt);
        });
    },

    toggleAdmAllocationSuecia() {
        this.isAdmAllocationSueciaEnabled = !this.isAdmAllocationSueciaEnabled;
        const btn = document.getElementById('btn-adm-alloc-suecia');
        if (btn) {
            if (this.isAdmAllocationSueciaEnabled) {
                btn.innerText = "Rateio ADM: ON";
                btn.classList.remove('bg-gray-200', 'text-gray-600');
                btn.classList.add('bg-green-600', 'text-white');
            } else {
                btn.innerText = "Rateio ADM: OFF";
                btn.classList.remove('bg-green-600', 'text-white');
                btn.classList.add('bg-gray-200', 'text-gray-600');
            }
        }
        this.renderDRESuecia();
    },

    populateFilters() {
        const allData = [...this.data, ...this.keyRatiosData.map(r => ({
            centroCusto: r.centroCusto,
            departamento: r.departamento,
            cliente: r.cliente,
            sbd: r.sbd,
            projectType: r.projectType,
            ano: r.ano
        }))];

        const getUnique = (field) => [...new Set(allData.map(d => d[field]).filter(x => x))].sort();
        
        // Filtra apenas valores que representam anos válidos (evita incluir meses 1..12
        // quando algum registro tiver 'ano' errado). Considera como ano números > 31
        // ou strings com 4+ dígitos.
        const rawYears = getUnique('ano').map(y => String(y).trim()).filter(s => s !== '');
        const years = rawYears
            .map(s => ({ s, n: Number(s) }))
            .filter(o => (!isNaN(o.n) && o.n > 31) || (o.s && o.s.length >= 4))
            .map(o => o.s)
            .sort((a,b)=> Number(b) - Number(a));
        
        // Popula apenas a lista de anos (é o filtro principal)
        ['dre-year-select', 'dre-acc-year', 'dre-b2-year', 'margin-year-select', 'dre-dept-year'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const v = el.value; el.innerHTML = '';
            
            if(!years.length) { 
                const thisYear = new Date().getFullYear();
                el.innerHTML = `<option value="${thisYear}">${thisYear}</option>`; 
            } else {
                years.forEach(y => { 
                    const opt = document.createElement('option'); opt.value = y; opt.innerText = y; 
                    if(String(y) === String(v) || (y === years[0] && !v)) opt.selected = true;
                    el.appendChild(opt);
                });
            }
        });
        // Os demais filtros serão preenchidos em setupDynamicFilters
    },

    setupDynamicFilters() {
        const targets = [
            // DRE Mensal
            { prefix: 'dre', fields: ['cc', 'dept', 'client', 'sbd', 'proj'], suffix: '-filter-', render: this.renderDRE },
            // DRE Mensal Budget (mesma estrutura, view distinta)
            // DRE Mensal Budget removido; Budget-2 remains
            // DRE Mensal Budget-2 (layout Acumulado, mensal)
            { prefix: 'dre-b2', fields: ['cc', 'dept', 'client', 'sbd', 'proj'], suffix: '-', render: this.renderDREBudget2 },
            // DRE Acumulada
            { prefix: 'dre-acc', fields: ['cc', 'dept', 'client', 'sbd', 'proj'], suffix: '-', render: this.renderDREAcumulado },
            // Margin Analysis
            { prefix: 'margin', fields: ['cc', 'dept', 'client', 'sbd', 'proj'], suffix: '-filter-', render: this.renderMarginAnalysis }
        ];
        
        // Fields que não acionam render/reaplicação dos filtros (ex: ano, mês, agrupamento)
        const nonTriggerFields = ['year-select', 'year', 'month', 'group-by'];

        targets.forEach(({ prefix, fields, suffix, render }) => {
            [...fields, ...nonTriggerFields.filter(f => document.getElementById(`${prefix}${suffix}${f}` || `${prefix}-${f}` ))]
            .forEach(field => {
                let elementId;
                if (nonTriggerFields.includes(field)) {
                    elementId = `${prefix}-${field.replace('-select', '')}`; // Year/Month
                } else {
                    elementId = `${prefix}${suffix}${field}`; // cc, dept, client, sbd, proj
                }
                
                const element = document.getElementById(elementId);

                if (element) {
                    const isFilterField = fields.includes(field); // Apenas filtros de dimensão ativam a dependência
                    const isReportRenderTrigger = isFilterField || field.includes('year') || field.includes('month');

                    const handler = () => {
                        if(isFilterField) {
                            this.applyFilterDependencies(prefix); 
                        }
                        if (isReportRenderTrigger) { 
                            render.call(this);
                        }
                    };
                    
                    element.removeEventListener('change', element._dynamicFilterHandler);
                    element._dynamicFilterHandler = handler;
                    element.addEventListener('change', handler);
                }
            });
            
            // Handle initial population after everything is set up
            this.applyFilterDependencies(prefix);
        });
    },

    applyFilterDependencies(prefix) {
        const suffixMap = {
            'dre': '-filter-',
            'dre-b2': '-',
            'margin': '-filter-',
            'dre-acc': '-', 
        };
        const inputSuffix = suffixMap[prefix];
        const fields = ['cc', 'dept', 'client', 'sbd', 'proj']; // Input ID suffixes

        // 1. Get current filter values
        const filterValues = {};
        fields.forEach(f => {
            const id = `${prefix}${inputSuffix}${f}`;
            const element = document.getElementById(id);
            filterValues[f] = element ? String(element.value).trim() : '';
            if (filterValues[f] === 'Todos...') filterValues[f] = '';
        });
        
        // Handle Year for filtering (Year is always mandatory for filtering data)
        const yearElement = document.getElementById(`${prefix}-year-select`) || document.getElementById(`${prefix}-year`);
        const currentYear = yearElement ? parseInt(yearElement.value) : null;
        if (!currentYear) return; 

        // 2. Combine and filter data (data + keyRatiosData)
        let filteredData = [];

        // If prefix is 'dre', respect the DRE type selector (Actual / Budget / Both)
        if (prefix === 'dre') {
            const dreTypeEl = document.getElementById('dre-type-select');
            const dreType = (dreTypeEl && dreTypeEl.value) ? dreTypeEl.value : 'Actual';
            if (dreType === 'Budget') filteredData = this.data.filter(d => d.tipo === 'Budget');
            else if (dreType === 'Actual') filteredData = this.data.filter(d => d.tipo !== 'Budget');
            else filteredData = [...this.data];
            // include keyRatios so that datalists (cc/dept/client/proj) consider key ratios too
            filteredData = [...filteredData, ...this.keyRatiosData];
        } else {
            filteredData = [...this.data, ...this.keyRatiosData];
        }

        // Filter by Year first
        filteredData = filteredData.filter(d => parseInt(d.ano) === currentYear);

        // Apply ALL active filters
        let currentFilterState = {};
        const filterKeys = ['centroCusto', 'departamento', 'cliente', 'sbd', 'projectType'];
        filterKeys.forEach((key, i) => {
            const f = fields[i]; // f is 'cc', 'dept', 'client', 'sbd', 'proj'
            currentFilterState[key] = filterValues[f];
            
            if (currentFilterState[key]) {
                 filteredData = filteredData.filter(d => this.filterMatches(d[key], currentFilterState[key]));
            }
        });

        // 3. Update Datalists for ALL filters based on the *remaining* filteredData
        filterKeys.forEach(field => {
            const uniqueValues = [...new Set(filteredData.map(d => String(d[field] || '').trim()).filter(x => x))].sort();
            
            // Mapeamento dos nomes das propriedades de dados para os sufixos de ID do datalist.
            const filterAbbr = 
                field === 'centroCusto' ? 'cc' : 
                field === 'departamento' ? 'dept' : 
                field === 'cliente' ? 'client' : 
                field === 'projectType' ? 'proj' : 
                field;

            let datalistId = `dl-${filterAbbr}`;
            if (prefix === 'dre-acc') datalistId += '-acc';
            else if (prefix === 'margin') datalistId += '-margin';
            else if (prefix === 'dre-b2') datalistId += '-b2';
            
            // Ensure the currently selected value is still an option (if not empty)
            const currentValue = currentFilterState[field];
            if (currentValue && !uniqueValues.includes(currentValue) && currentValue !== 'Todos...') {
                 uniqueValues.unshift(currentValue);
            }

            this.updateDatalist(datalistId, uniqueValues);
        });
    },

    filterMatches(itemValue, filterString) {
        if (!filterString || filterString.toLowerCase() === 'todos...' || filterString.trim() === '') {
            return true;
        }
        
        const filterValues = filterString.split(',')
                                         .map(v => String(v).trim())
                                         .filter(v => v !== '');

        if (filterValues.length === 0) return true;

        const itemStr = String(itemValue || '').trim();
        return filterValues.some(filterV => itemStr === filterV);
    },

    // Calcula a alocação proporcional do Management Fee (9999) para um mês/ano específico 
    // com base nas horas de consultores que atendem aos filtros.
    getMgmtFeeAllocationForMonth(year, month, filters) {
        
        // 1. Management Fee total para o período
        const mgmtFeeItem = this.mgmtFees.find(item => item.ano === year && item.mes === month);
        const totalFee = (mgmtFeeItem && mgmtFeeItem.valor) || 0; // CORRIGIDO: Usando mgmtFeeItem.valor
        if (totalFee === 0) return 0;

        // 2. Horas totais de consultores (Global, no mês/ano)
        const globalRatios = this.keyRatiosData.filter(item => {
            const itemYear = parseInt(item.ano);
            const itemMonth = parseInt(item.mes);
            // Considera APENAS não-ADM (consultores)
            const isConsultor = String(item.departamento || '').toUpperCase().trim() !== 'ADM'; 
            return itemYear === year && itemMonth === month && isConsultor;
        });
        const globalHours = globalRatios.reduce((sum, item) => sum + (Number(item.hours) || 0), 0);
        
        if (globalHours === 0) return 0; // Se não houver horas de consultores globais, a fee não é rateada

        // 3. Horas de consultores no segmento filtrado
        const filteredRatios = globalRatios.filter(item => {
            if (filters.cc && String(item.centroCusto) !== filters.cc) return false;
            if (filters.dept && String(item.departamento) !== filters.dept) return false;
            if (filters.cli && String(item.cliente) !== filters.cli) return false;
            if (filters.sbd && String(item.sbd) !== filters.sbd) return false;
            if (filters.proj && String(item.projectType) !== filters.proj) return false;
            return true;
        });
        const filteredHours = filteredRatios.reduce((sum, item) => sum + (Number(item.hours) || 0), 0);
        
        if (filteredHours === 0) return 0; // Se o filtro não pegar horas, a fee não é rateada para ele
        
        // 4. Cálculo da Alocação
        const allocation = totalFee * (filteredHours / globalHours);
        
        return allocation;
    },

    // Toggle para o botão de Rateio ADM
    toggleAdmAllocation() {
        this.isAdmAllocationEnabled = !this.isAdmAllocationEnabled;
        
        // Atualiza visual dos botões
        const updateBtn = (id) => {
            const btn = document.getElementById(id);
            if (btn) {
                if (this.isAdmAllocationEnabled) {
                    btn.classList.remove('bg-purple-600', 'hover:bg-purple-700');
                    btn.classList.add('bg-green-600', 'hover:bg-green-700');
                    btn.innerHTML = '<i class="fa-solid fa-check"></i> Rateio ADM Ativo';
                } else {
                    btn.classList.remove('bg-green-600', 'hover:bg-green-700');
                    btn.classList.add('bg-purple-600', 'hover:bg-purple-700');
                    btn.innerHTML = '<i class="fa-solid fa-users-gear"></i> Ratear ADM';
                }
            }
        };

        updateBtn('btn-rateio-adm');
        updateBtn('btn-rateio-adm-budget');
        updateBtn('btn-rateio-adm-acc');
        updateBtn('btn-rateio-adm-margin');

        // Re-renderiza as views ativas
        if (!document.getElementById('view-dre').classList.contains('hidden')) this.renderDRE();
        if (!document.getElementById('view-dre-acumulado').classList.contains('hidden')) this.renderDREAcumulado();
        if (!document.getElementById('view-dre-budget-2').classList.contains('hidden')) this.renderDREBudget2();
        if (!document.getElementById('view-margin-analysis').classList.contains('hidden')) this.renderMarginAnalysis();
    },

    // Calcula o rateio de despesas ADM baseado em Headcount (Key Ratios 7001/7002/7004)
    getAdmAllocationForMonth(year, month, filters, admTotalValue) {
        if (admTotalValue === 0) return 0;

        // 1. Total de Heads (Consultores) Global no mês
        const globalRatios = this.keyRatiosData.filter(item => {
            const itemYear = parseInt(item.ano);
            const itemMonth = parseInt(item.mes);
            const isConsultor = String(item.departamento || '').toUpperCase().trim() !== 'ADM';
            // Conta 7001, 7002, 7004 indicam headcount/salários, mas aqui usamos a contagem de nomes únicos ou horas?
            // O pedido diz "rateio... por numero de heads".
            // Vamos usar a lógica de contar nomes únicos que não sejam ADM.
            return itemYear === year && itemMonth === month && isConsultor;
        });

        // Set de nomes únicos globais (Consultores)
        const globalHeads = new Set(globalRatios.map(i => i.name)).size;

        if (globalHeads === 0) return 0;

        // 2. Total de Heads no Filtro Atual
        const filteredRatios = globalRatios.filter(item => {
            if (filters.cc && String(item.centroCusto) !== filters.cc) return false;
            if (filters.dept && String(item.departamento) !== filters.dept) return false;
            if (filters.cli && String(item.cliente) !== filters.cli) return false;
            if (filters.sbd && String(item.sbd) !== filters.sbd) return false;
            if (filters.proj && String(item.projectType) !== filters.proj) return false;
            return true;
        });

        const filteredHeads = new Set(filteredRatios.map(i => i.name)).size;

        if (filteredHeads === 0) return 0;

        // 3. Rateio
        return admTotalValue * (filteredHeads / globalHeads);
    },

    renderDRE() {
        // Delega renderização para o módulo de aba `AbaDre` quando disponível
        try {
            if (window.AbaDre && typeof window.AbaDre.render === 'function') {
                const getFilterValue = (id) => {
                    const el = document.getElementById(id);
                    if (!el) return '';
                    const val = String(el.value || '').trim();
                    return val === 'Todos...' ? '' : val;
                };
                const year = parseInt(document.getElementById('dre-year-select') ? document.getElementById('dre-year-select').value : (new Date().getFullYear()));
                const ctx = {
                    year,
                    filtros: {
                        cc: getFilterValue('dre-filter-cc'),
                        dept: getFilterValue('dre-filter-dept'),
                        client: getFilterValue('dre-filter-client'),
                        sbd: getFilterValue('dre-filter-sbd'),
                        proj: getFilterValue('dre-filter-proj')
                    },
                    data: this.data || [],
                    keyRatiosData: this.keyRatiosData || [],
                    exemptCCs: this.exemptCCs || [],
                    isAdmAllocationEnabled: this.isAdmAllocationEnabled,
                    posEbitdaAccounts: this.posEbitdaAccounts || [],
                    custoAccounts: this.custoAccounts || [],
                    depreciacaoAccounts: this.depreciacaoAccounts || [],
                    pessoalAccounts: this.pessoalAccounts || [],
                    aluguelAccounts: this.aluguelAccounts || [],
                    viagensAccounts: this.viagensAccounts || [],
                    diversasAccounts: this.diversasAccounts || [],
                    servicosProfissionaisAccounts: this.servicosProfissionaisAccounts || [],
                    taxasAccounts: this.taxasAccounts || [],
                    outrasAdmAccounts: this.outrasAdmAccounts || [],
                    deductionAccounts: this.deductionAccounts || [],
                    budgetRevenueAccounts: this.budgetRevenueAccounts || [],
                    budgetExcludedFromRevenue: this.budgetExcludedFromRevenue || [],
                    normalizeAccountDigits: this.normalizeAccountDigits ? this.normalizeAccountDigits.bind(this) : null,
                    getAdmAllocationForMonth: this.getAdmAllocationForMonth ? this.getAdmAllocationForMonth.bind(this) : null,
                    getMgmtFeeAllocationForMonth: this.getMgmtFeeAllocationForMonth ? this.getMgmtFeeAllocationForMonth.bind(this) : null,
                    calculateKeyRatiosMonthly: this.calculateKeyRatiosMonthly ? this.calculateKeyRatiosMonthly.bind(this) : null,
                    getLastMonthHeads: this.getLastMonthHeads ? this.getLastMonthHeads.bind(this) : null
                };
                window.AbaDre.render('view-dre', ctx);
                return;
            }
        } catch (e) {
            console.error('Erro delegando renderDRE para AbaDre:', e);
        }
        // Fallback mínimo: limpar a tabela se AbaDre não estiver disponível
        try { const tbody = document.getElementById('dre-body'); if (tbody) tbody.innerHTML = ''; } catch (e) {}
    },
        
    

    renderDREBudget() {
        if (typeof LEGACY_DRE_DISABLED !== 'undefined' && LEGACY_DRE_DISABLED) { console.debug('Legacy DRE disabled: renderDREBudget skipped'); return; }
        this.currentDREExportData = [
            ["Conta", "Descrição", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez", "Total"]
        ];

        const year = parseInt(document.getElementById('dre-budget-year-select').value);
        
        const getFilterValue = (id) => {
            const el = document.getElementById(id);
            if (!el) return '';
            const val = el.value.trim();
            return val === 'Todos...' ? '' : val;
        };

        const filterCC = getFilterValue('dre-budget-filter-cc');
        const filterDept = getFilterValue('dre-budget-filter-dept');
        const filterCli = getFilterValue('dre-budget-filter-client');
        const filterSBD = getFilterValue('dre-budget-filter-sbd');
        const filterProj = getFilterValue('dre-budget-filter-proj');

        // A aba DRE Mensal Budget mostra apenas dados Budget
        const dreType = 'Budget';

        const tbody = document.getElementById('dre-budget-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        const details = {
            receitaBruta: {}, receitaLiquidaExtra: {}, deducoes: {}, custos: {}, pessoal: {}, aluguel: {}, viagens: {}, 
            diversas: {}, servicosProfissionais: {}, taxas: {}, outrasAdm: {}, admin: {}, 
            depreciacao: {}, managementFee: {}, posEbitda: {} 
        };
        const dynamicTaxMap = {};
        const initArr = () => new Array(13).fill(0);

        // Diagnostic: compute raw budget sums by month (after applying same filters)
        const computeRawBudgetSums = () => {
            const sums = new Array(12).fill(0);
            this.data.forEach(it => {
                if (it.tipo !== 'Budget') return;
                if (parseInt(it.ano) !== year) return;
                if (filterCC && String(it.centroCusto) !== filterCC) return;
                if (filterDept && String(it.departamento) !== filterDept) return;
                if (filterCli && String(it.cliente) !== filterCli) return;
                if (filterSBD && String(it.sbd) !== filterSBD) return;
                if (filterProj && String(it.projectType) !== filterProj) return;
                const mIdx = Number(it.mes) - 1;
                if (isNaN(mIdx) || mIdx < 0 || mIdx > 11) return;
                const v = Number(it.valor) || 0;
                sums[mIdx] += v;
            });
            return sums;
        };

        const rawBudgetSums = computeRawBudgetSums();
        try { console.log('DREBudget diagnostic - rawBudgetSums (Jan..Dec): ' + JSON.stringify(rawBudgetSums.map(v => Number(v.toFixed(2))))); } catch(e) { console.log('DREBudget diagnostic - rawBudgetSums (Jan..Dec):', rawBudgetSums.map(v => v.toFixed(2))); }

        // Diagnostic: show any entries that normalize to conta 1899 and whether they would be included
        try {
            const candidates = this.data.filter(it => {
                const cd = this.normalizeAccountDigits(it.conta);
                return cd === '1899';
            }).slice(0,50).map(it => ({conta: it.conta, contaDigits: this.normalizeAccountDigits(it.conta), tipo: it.tipo, mes: it.mes, ano: it.ano, centroCusto: it.centroCusto, valor: it.valor}));
            try { console.log('DREBudget diagnostic - 1899 candidates (sample): ' + JSON.stringify(candidates)); } catch(e) { console.log('DREBudget diagnostic - 1899 candidates (sample):', candidates); }
        } catch (e) {}

        this.data.forEach(item => {
            // Control by DRE type selection: only Budget here
            if (dreType === 'Actual') {
                if (item.tipo === 'Budget') return;
            } else if (dreType === 'Budget') {
                if (item.tipo !== 'Budget') return;
            }

            if (String(item.departamento).trim() === 'ADM' && (item.conta == 3190 || item.conta == 3204)) return;
            if (parseInt(item.ano) !== year) return;
            const itemMonth = Number(item.mes) || 0;
            if (!itemMonth || itemMonth < 1 || itemMonth > monthSelected) return;
            
            let valor = Number(item.valor) || 0;
            const isAdmItem = String(item.departamento).trim() === 'ADM';
            let passFilter = true;

            // Lógica de Rateio ADM: Se ativado, itens ADM (exceto Receita) são rateados conta a conta
            if (this.isAdmAllocationEnabled && isAdmItem && item.tipo !== 'Receita') {
                 valor = this.getAdmAllocationForMonth(parseInt(item.ano), parseInt(item.mes), {
                    cc: filterCC, dept: filterDept, cli: filterCli, sbd: filterSBD, proj: filterProj
                 }, valor);
                 passFilter = true;
            } else {
                if (filterCC && String(item.centroCusto) !== filterCC) passFilter = false;
                if (filterDept && String(item.departamento) !== filterDept) passFilter = false;
                if (filterCli && String(item.cliente) !== filterCli) passFilter = false;
                if (filterSBD && String(item.sbd) !== filterSBD) passFilter = false;
                if (filterProj && String(item.projectType) !== filterProj) passFilter = false;
            }

            if (!passFilter) return;

            const m = parseInt(item.mes) - 1; 
            if (m < 0 || m > 11) return;
            
            // Normaliza a conta para extrair dígitos quando possível (ex.: '3.010' ou '3010 ')
            const contaDigits = this.normalizeAccountDigits(item.conta);
            const contaNum = (contaDigits && !isNaN(Number(contaDigits))) ? Number(contaDigits) : (isFinite(Number(item.conta)) ? Number(item.conta) : NaN);
            const key = `${item.conta || ''} - ${item.descricao || ''}`;
            
            let targetGroup = null;

            if (item.tipo === 'Receita') {
                const ccToCheck = String(item.centroCusto).trim();
                const isExempt = this.exemptCCs.includes(ccToCheck);

                if (this.deductionAccounts.includes(contaNum)) {
                    targetGroup = details.deducoes; // Rota para Deduções
                }
                else if (contaNum === 1902) {
                    targetGroup = details.receitaBruta;
                    if (!isExempt) {
                        const taxValue = valor * -0.0925;
                        const taxKey = "3204 - impostos sobre receita a faturar (Cálculo Dinâmico)";
                        if (!dynamicTaxMap[taxKey]) dynamicTaxMap[taxKey] = initArr();
                        dynamicTaxMap[taxKey][m] += taxValue;
                        dynamicTaxMap[taxKey][12] += taxValue;
                    }
                }
                else if (contaNum === 3204) {
                    return; 
                }
                else if (contaNum === 1899) {
                    // 1899 deve aparecer como ajuste em Receita Líquida
                    targetGroup = details.receitaLiquidaExtra;
                }
                else {
                    targetGroup = details.receitaBruta;
                }
            } else if (item.tipo === 'Despesa' || item.tipo === 'Budget') {
                const c = contaNum;
                // Conta 1899 sempre deve ser tratada como ajuste de Receita Líquida
                if (c === 1899) {
                    targetGroup = details.receitaLiquidaExtra;
                } else if (c === 3204) {
                    return;
                } else if (this.posEbitdaAccounts.includes(c)) targetGroup = details.posEbitda;
                else if (this.custoAccounts.includes(c)) targetGroup = details.custos;
                else if (this.depreciacaoAccounts.includes(c)) targetGroup = details.depreciacao;
                else if (this.pessoalAccounts.includes(c)) targetGroup = details.pessoal;
                else if (this.aluguelAccounts.includes(c)) targetGroup = details.aluguel;
                else if (this.viagensAccounts.includes(c)) targetGroup = details.viagens;
                else if (this.diversasAccounts.includes(c)) targetGroup = details.diversas;
                else if (this.servicosProfissionaisAccounts.includes(c)) targetGroup = details.servicosProfissionais;
                else if (this.taxasAccounts.includes(c)) targetGroup = details.taxas;
                else if (this.outrasAdmAccounts.includes(c)) targetGroup = details.outrasAdm;
                else targetGroup = details.admin;
            }

            if(targetGroup) {
                if(!targetGroup[key]) targetGroup[key] = initArr();
                targetGroup[key][m] += valor;
                targetGroup[key][12] += valor;
            }
        });

        // INJETA OS IMPOSTOS CALCULADOS DINAMICAMENTE (3204)
        for (const taxKey in dynamicTaxMap) {
            const vals = dynamicTaxMap[taxKey];
            const descKey = "3204 - Impostos Calculados Dinamicamente (9.25%)";
            if (!details.deducoes[descKey]) details.deducoes[descKey] = initArr();

            for (let i = 0; i < 13; i++) {
                details.deducoes[descKey][i] += vals[i];
            }
        }
        
        // Rateio do Management Fee (9999) baseado em Horas de Consultores, respeitando os filtros
        if (dreType !== 'Budget') { // Apenas para Real ou Ambos (mantido, mas ficará inativo aqui pois dreType === 'Budget')
            for (let m = 0; m < 12; m++) {
                const mes = m + 1;
                
                const allocation = this.getMgmtFeeAllocationForMonth(year, mes, {
                    cc: filterCC,
                    dept: filterDept,
                    cli: filterCli,
                    sbd: filterSBD,
                    proj: filterProj
                });
                
                if (allocation !== 0) {
                    const key = "9999 - Management Fee Rateado (Proporcional Horas)";
                    if (!details.managementFee[key]) details.managementFee[key] = initArr();
                    details.managementFee[key][m] += allocation;
                    details.managementFee[key][12] += allocation;
                }
            }
        }
        const renderGroup = (title, groupData, cssTitle, cssDetail, cssSubtotal) => {
            const groupTotal = initArr();
            const sortedKeys = Object.keys(groupData).sort((a, b) => {
                const contaA = Number(a.split(" - ")[0]);
                const contaB = Number(b.split(" - ")[0]);
                return contaA - contaB;
            });

            if (sortedKeys.length === 0) return groupTotal;
            
            if(title) {
                this.currentDREExportData.push([title, "", "", "", "", "", "", "", "", "", "", "", "", "", ""]);
                const trTitle = document.createElement('tr');
                trTitle.innerHTML = `<td colspan="15" class="px-3 py-1 ${cssTitle}">${title}</td>`;
                tbody.appendChild(trTitle);
            }

            sortedKeys.forEach(k => {
                const vals = groupData[k];
                for(let i=0; i<13; i++) groupTotal[i] += vals[i];

                let conta = k.split(" - ")[0];
                let desc = k.split(" - ").slice(1).join(" - ");

                this.currentDREExportData.push([conta, desc || "", ...vals.slice(0, 12), vals[12]]);

                const tr = document.createElement('tr');
                tr.className = "dre-detail";
                let html = `<td class="text-left px-3 text-xs font-mono">${conta}</td><td class="text-left px-3 truncate max-w-xs" title="${desc}">${desc}</td>`;
                for(let i=0; i<12; i++) {
                    const v = vals[i];
                    const color = v < 0 ? 'text-red-600' : 'text-gray-600';
                    html += `<td class="text-right px-2 ${color}">${v !== 0 ? v.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</td>`;
                }
                const tot = vals[12];
                const totColor = tot < 0 ? 'text-red-600' : 'text-gray-800';
                html += `<td class="text-right px-2 font-semibold bg-gray-50 ${totColor}">${tot.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>`;
                tr.innerHTML = html;
                tbody.appendChild(tr);
            });

            if(cssSubtotal) {
                this.currentDREExportData.push([`Total ${title}`, '', ...groupTotal.slice(0, 12), groupTotal[12]]);
                const trSub = document.createElement('tr');
                trSub.className = cssSubtotal; 
                let subHtml = `<td class="text-left px-3 ${cssSubtotal}" colspan="2">Total ${title}</td>`;
                for(let i=0; i<12; i++) {
                    const v = groupTotal[i];
                    const color = v < 0 ? 'text-red-600' : 'text-gray-800';
                    subHtml += `<td class="text-right px-2 ${cssSubtotal} ${color}">${v.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>`;
                }
                const subTot = groupTotal[12];
                const subCol = subTot < 0 ? 'text-red-600' : 'text-gray-900';
                subHtml += `<td class="text-right px-2 ${cssSubtotal} font-semibold bg-gray-50 ${subCol}">${subTot.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>`;
                trSub.innerHTML = subHtml;
                tbody.appendChild(trSub);
            }

            return groupTotal;
        };

        const renderCalcLine = (label, values, cssClass) => {
            const row = [label, "", ...values.slice(0, 12), values[12]];
            this.currentDREExportData.push(row);

            const tr = document.createElement('tr');
            tr.className = cssClass;
            let html = `<td class="text-left px-3" colspan="2">${label}</td>`;
            for(let i=0; i<12; i++) {
                const v = values[i];
                const color = v < 0 ? 'text-red-600' : 'text-gray-800';
                html += `<td class="text-right px-2 ${color}">${v.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>`;
            }
            const tot = values[12];
            const col = tot < 0 ? 'text-red-600' : 'text-gray-900';
            html += `<td class="text-right px-2 ${col}">${tot.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>`;
            tr.innerHTML = html;
            tbody.appendChild(tr);
        };

        const renderPercRow = (label, numeratorArr, denominatorArr) => {
            const tr = document.createElement('tr');
            tr.className = "dre-perc-row";
            let html = `<td class="text-left px-3 text-right pr-6" colspan="2">${label}</td>`;
            const rowExport = [label, ""];

            for(let i=0; i<13; i++) { 
                const num = numeratorArr[i];
                const den = denominatorArr[i];
                let perc = 0;
                if(den && den !== 0) perc = (num / den) * 100;
                
                rowExport.push(perc.toFixed(2) + "%");

                html += `<td class="text-right px-2">${perc.toFixed(2)}%</td>`;
            }
            this.currentDREExportData.push(rowExport);

            tr.innerHTML = html;
            tbody.appendChild(tr);
        };

        const subArrays = (a, b) => a.map((v, i) => v - b[i]);
        const sumArrays = (a, b) => a.map((v, i) => v + b[i]);

        const totReceita = renderGroup("Receita Bruta", details.receitaBruta, "dre-group-title text-green-800", "", "dre-row font-bold text-green-700 bg-green-50");
        const totDeducoes = renderGroup("(-) Deduções", details.deducoes, "dre-group-title text-red-800", "", "dre-subtotal-group-orange");
        
        const valRecLiq = sumArrays(totReceita, totDeducoes);
        renderCalcLine("(=) Receita Líquida", valRecLiq, "dre-subtotal-final");
        
        const totCustos = renderGroup("(-) Custos Variáveis", details.custos, "dre-group-title text-red-800", "", "dre-subtotal-group-orange");
        const totViagens = renderGroup("(-) Despesas com Viagem", details.viagens, "dre-group-title text-red-800", "", "dre-subtotal-group-orange");
        
        const valTotalCustos = sumArrays(totCustos, totViagens);
        renderCalcLine("(=) Total de Custos", valTotalCustos, "dre-subtotal");

        let valMargem = subArrays(valRecLiq, valTotalCustos);
        
        renderCalcLine("(=) Margem de Contribuição", valMargem, "dre-subtotal-final"); 
        renderPercRow("% Margem de Contribuição", valMargem, valRecLiq);
        
        const totPessoal = renderGroup("(-) Despesas com Pessoal ADM", details.pessoal, "dre-group-title text-red-800", "", "dre-subtotal-group-orange");
        
        const totAluguel = renderGroup("(-) Despesas Administrativas Gerais (Demais)", details.aluguel, "dre-group-title text-red-800", "", "dre-subtotal-group-orange");
        
        const totServicosProfissionais = renderGroup("(-) Serviços Profissionais", details.servicosProfissionais, "dre-group-title text-red-800", "", "dre-subtotal-group-orange");
        const totTaxas = renderGroup("(-) Taxas Diversas", details.taxas, "dre-group-title text-red-800", "", "dre-subtotal-group-orange");
        const totDiversas = renderGroup("(-) Despesas Diversas ADM", details.diversas, "dre-group-title text-red-800", "", "dre-subtotal-group-orange");
        const totOutrasAdm = renderGroup("(-) Outras despesas adm", details.outrasAdm, "dre-group-title text-red-800", "", "dre-subtotal-group-orange");
        
        const totAdmin = renderGroup("(-) Despesas Com Aluguel", details.admin, "dre-group-title text-red-800", "", "dre-subtotal-group-orange");
        
        let valOpex = sumArrays(totPessoal, totServicosProfissionais);
        valOpex = sumArrays(valOpex, totTaxas);
        valOpex = sumArrays(valOpex, totDiversas);
        valOpex = sumArrays(valOpex, totOutrasAdm);
        valOpex = sumArrays(valOpex, totAdmin);
        
        renderCalcLine("(=) OPEX", valOpex, "dre-subtotal");

        const totDespAdmGerais = sumArrays(sumArrays(totPessoal, totAluguel), sumArrays(totViagens, sumArrays(totServicosProfissionais, sumArrays(totTaxas, sumArrays(totDiversas, sumArrays(totOutrasAdm, totAdmin))))));
        renderPercRow("% Despesas Administrativas Totais", totDespAdmGerais, valRecLiq);

        const totDeprec = renderGroup("(-) Depreciação", details.depreciacao, "dre-group-title text-gray-600", "", "dre-row font-bold text-gray-600 bg-gray-100");
        
        renderPercRow("% Depreciação", totDeprec, valRecLiq);

        const totMgmt = renderGroup("(-) Management Fee", details.managementFee, "dre-group-title-orange", "", "dre-subtotal-group-black-text");
        
        renderPercRow("% Management Fee", totMgmt, valRecLiq);

        let valEbitda = valMargem;
        valEbitda = subArrays(valEbitda, totPessoal);
        valEbitda = subArrays(valEbitda, totAluguel);
        valEbitda = subArrays(valEbitda, totServicosProfissionais); 
        valEbitda = subArrays(valEbitda, totTaxas); 
        valEbitda = subArrays(valEbitda, totDiversas); 
        valEbitda = subArrays(valEbitda, totOutrasAdm); 
        valEbitda = subArrays(valEbitda, totAdmin); 
        valEbitda = subArrays(valEbitda, totDeprec);
        valEbitda = subArrays(valEbitda, totMgmt);
        
        renderCalcLine("(=) EBITDA", valEbitda, "dre-subtotal-final");
        renderPercRow("% EBITDA", valEbitda, valRecLiq);

        const totPosEbitda = renderGroup("(-) IRPJ/CSLL e Financeiro", details.posEbitda, "dre-group-title text-blue-800", "", "dre-row font-bold text-blue-600 bg-blue-50");

        let valResultado = subArrays(valEbitda, totPosEbitda);

        renderCalcLine("(=) Resultado Operacional Líquido", valResultado, "dre-subtotal-final");
        
        renderPercRow("% Resultado Operacional Líquido", valResultado, valRecLiq);

        const filteredKeyRatios = this.keyRatiosData.filter(item => {
            if (parseInt(item.ano) !== year) return false;
            if (filterCC && String(item.centroCusto) !== filterCC) return false;
            if (filterDept && String(item.departamento) !== filterDept) return false;
            if (filterCli && String(item.cliente) !== filterCli) return false;
            if (filterSBD && String(item.sbd) !== filterSBD) return false;
            if (filterProj && String(item.projectType) !== filterProj) return false;
            return true;
        });
        
        const ratios = this.calculateKeyRatiosMonthly(filteredKeyRatios, valRecLiq); 

        const renderKeyRatiosSection = (ratios) => {
            const trSpace = document.createElement('tr');
            trSpace.innerHTML = `<td colspan="15" class="px-3 py-2 bg-gray-50"></td>`;
            tbody.appendChild(trSpace);

            const trTitle = document.createElement('tr');
            trTitle.innerHTML = `<td colspan="15" class="px-3 py-1 dre-group-title text-green-800 bg-green-100 text-base">KEY RATIOS</td>`;
            tbody.appendChild(trTitle);

            const renderRatioLine = (label, values, cssClass = "dre-row font-normal bg-gray-50") => {
                const tr = document.createElement('tr');
                tr.className = cssClass;
                let html = `<td class="text-left px-3 font-semibold" colspan="2">${label}</td>`;
                
                this.currentDREExportData.push([label, "", ...values.slice(0, 12), values[12]]);

                for(let i=0; i<12; i++) {
                    const v = values[i];
                    const format = (v, isMoney = false) => v.toLocaleString('pt-BR', {minimumFractionDigits: isMoney ? 2 : 0, maximumFractionDigits: 2});
                    html += `<td class="text-right px-2 font-mono">${v !== 0 ? format(v, label.includes('R$')) : '-'}</td>`;
                }
                const tot = values[12];
                html += `<td class="text-right px-2 font-bold font-mono">${tot.toLocaleString('pt-BR', {minimumFractionDigits: label.includes('R$') ? 2 : 0, maximumFractionDigits: 2})}</td>`;
                tr.innerHTML = html;
                tbody.appendChild(tr);
            };
            
            renderRatioLine("Horas Trabalhadas (h)", ratios.totalHours);
            renderRatioLine("Funcionários (ADM)", ratios.numAdm);
            renderRatioLine("Funcionários (Consultores)", ratios.numConsultor);
            renderRatioLine("Valor Hora Médio (R$/h)", ratios.avgHourlyValue, "dre-row font-bold bg-yellow-100 text-blue-800");

        };

        renderKeyRatiosSection(ratios);
    },
    
    calculateKeyRatiosMonthly(data, netRevenueArray) {
        const totalHours = new Array(13).fill(0);
        const uniqueEmployees = { adm: new Array(12).fill(null).map(() => new Set()), consultor: new Array(12).fill(null).map(() => new Set()) };

        data.forEach(item => {
            const m = parseInt(item.mes) - 1; 
            const hours = item.hours || 0;
            const name = item.name;
            const isADM = String(item.departamento).toUpperCase().trim() === 'ADM';

            if (m >= 0 && m <= 11) {
                totalHours[m] += hours;
                
                if (name) {
                    if (isADM) {
                        uniqueEmployees.adm[m].add(name);
                    } else {
                        uniqueEmployees.consultor[m].add(name);
                    }
                }
            }
        });

        totalHours[12] = totalHours.slice(0, 12).reduce((sum, hours) => sum + hours, 0);

        const numAdm = uniqueEmployees.adm.map(set => set.size);
        numAdm.push(numAdm.slice(0, 12).reduce((sum, count) => sum + count, 0)); 

        const numConsultor = uniqueEmployees.consultor.map(set => set.size);
        numConsultor.push(numConsultor.slice(0, 12).reduce((sum, count) => sum + count, 0)); 

        const avgHourlyValue = netRevenueArray.map((net, i) => {
            const hours = totalHours[i];
            return (hours && hours !== 0) ? net / hours : 0;
        });
        
        const totalNetRevenue = netRevenueArray[12];
        const totalHoursSum = totalHours[12];
        avgHourlyValue[12] = (totalHoursSum && totalHoursSum !== 0) ? totalNetRevenue / totalHoursSum : 0;


        return {
            totalHours,
            numAdm,
            numConsultor,
            avgHourlyValue
        };
    },

    // New calculateKeyRatios for DRE Acumulado (aggregates Key Ratios across periods used by acumulado)
    calculateKeyRatios(keyRatiosArray, year, month, netRevenueAcumulado) {
        const initRow = () => ({ act_mo: 0, act_prev_mo: 0, act_ytd: 0, bdg_ytd: 0, bdg_mo: 0, act_py_ytd: 0, bdg_fy: 0, act_ltm: 0 });

        const totalHours = initRow();
        const numAdm = initRow();
        const numConsultor = initRow();

        const sets = {
            act_mo_adm: new Set(), act_prev_mo_adm: new Set(), act_ytd_adm: new Set(), act_py_ytd_adm: new Set(), act_ltm_adm: new Set(),
            act_mo_cons: new Set(), act_prev_mo_cons: new Set(), act_ytd_cons: new Set(), act_py_ytd_cons: new Set(), act_ltm_cons: new Set()
        };

        let prevMo = month - 1;
        let prevYear = year;
        if (prevMo === 0) { prevMo = 12; prevYear = year - 1; }

        const targetIndex = year * 12 + month;

        keyRatiosArray.forEach(r => {
            const rY = parseInt(r.ano);
            const rM = parseInt(r.mes);
            if (isNaN(rY) || isNaN(rM)) return;
            const hours = Number(r.hours) || 0;
            const name = String(r.name || '').trim();
            const isADM = String(r.departamento || '').toUpperCase().trim() === 'ADM';

            // act_mo
            if (rY === year && rM === month) {
                totalHours.act_mo += hours;
                if (name) {
                    if (isADM) sets.act_mo_adm.add(name); else sets.act_mo_cons.add(name);
                }
            }

            // prev month
            if (rY === prevYear && rM === prevMo) {
                totalHours.act_prev_mo += hours;
                if (name) {
                    if (isADM) sets.act_prev_mo_adm.add(name); else sets.act_prev_mo_cons.add(name);
                }
            }

            // YTD (year, months <= month)
            if (rY === year && rM <= month) {
                totalHours.act_ytd += hours;
                if (name) {
                    if (isADM) sets.act_ytd_adm.add(name); else sets.act_ytd_cons.add(name);
                }
            }

            // PY YTD (year-1, months <= month)
            if (rY === year - 1 && rM <= month) {
                totalHours.act_py_ytd += hours;
                if (name) {
                    if (isADM) sets.act_py_ytd_adm.add(name); else sets.act_py_ytd_cons.add(name);
                }
            }

            // LTM (last 12 months)
            const idx = rY * 12 + rM;
            const diff = targetIndex - idx;
            if (diff >= 0 && diff < 12) {
                totalHours.act_ltm += hours;
                if (name) {
                    if (isADM) sets.act_ltm_adm.add(name); else sets.act_ltm_cons.add(name);
                }
            }
        });

        numAdm.act_mo = sets.act_mo_adm.size;
        numAdm.act_prev_mo = sets.act_prev_mo_adm.size;
        numAdm.act_ytd = sets.act_ytd_adm.size;
        numAdm.act_py_ytd = sets.act_py_ytd_adm.size;
        numAdm.act_ltm = sets.act_ltm_adm.size;
        numAdm.bdg_ytd = 0; numAdm.bdg_fy = 0;

        numConsultor.act_mo = sets.act_mo_cons.size;
        numConsultor.act_prev_mo = sets.act_prev_mo_cons.size;
        numConsultor.act_ytd = sets.act_ytd_cons.size;
        numConsultor.act_py_ytd = sets.act_py_ytd_cons.size;
        numConsultor.act_ltm = sets.act_ltm_cons.size;
        numConsultor.bdg_ytd = 0; numConsultor.bdg_fy = 0;

        const avgHourlyValue = initRow();
        avgHourlyValue.act_mo = totalHours.act_mo ? (netRevenueAcumulado.act_mo || 0) / totalHours.act_mo : 0;
        avgHourlyValue.act_prev_mo = totalHours.act_prev_mo ? (netRevenueAcumulado.act_prev_mo || 0) / totalHours.act_prev_mo : 0;
        avgHourlyValue.act_ytd = totalHours.act_ytd ? (netRevenueAcumulado.act_ytd || 0) / totalHours.act_ytd : 0;
        avgHourlyValue.act_py_ytd = totalHours.act_py_ytd ? (netRevenueAcumulado.act_py_ytd || 0) / totalHours.act_py_ytd : 0;
        avgHourlyValue.act_ltm = totalHours.act_ltm ? (netRevenueAcumulado.act_ltm || 0) / totalHours.act_ltm : 0;
        avgHourlyValue.bdg_ytd = 0; avgHourlyValue.bdg_fy = 0;

        return {
            totalHours,
            numAdm,
            numConsultor,
            avgHourlyValue
        };
    },

    // Detailed variant for debugging: returns the same shape plus debug arrays/entries
    calculateKeyRatiosDetailed(keyRatiosArray, year, month) {
        const initRow = () => ({ act_mo: 0, act_prev_mo: 0, act_ytd: 0, bdg_ytd: 0, bdg_mo: 0, act_py_ytd: 0, bdg_fy: 0, act_ltm: 0 });

        const totalHours = initRow();
        const numAdm = initRow();
        const numConsultor = initRow();

        const sets = {
            act_mo_adm: new Set(), act_prev_mo_adm: new Set(), act_ytd_adm: new Set(), act_py_ytd_adm: new Set(), act_ltm_adm: new Set(),
            act_mo_cons: new Set(), act_prev_mo_cons: new Set(), act_ytd_cons: new Set(), act_py_ytd_cons: new Set(), act_ltm_cons: new Set()
        };

        const entries = { act_mo: [], act_prev_mo: [], act_ytd: [], act_py_ytd: [], ltm: [] };

        let prevMo = month - 1;
        let prevYear = year;
        if (prevMo === 0) { prevMo = 12; prevYear = year - 1; }

        const targetIndex = year * 12 + month;

        keyRatiosArray.forEach(r => {
            const rY = parseInt(r.ano);
            const rM = parseInt(r.mes);
            if (isNaN(rY) || isNaN(rM)) return;
            const hours = Number(r.hours) || 0;
            const name = String(r.name || '').trim();
            const isADM = String(r.departamento || '').toUpperCase().trim() === 'ADM';

            if (rY === year && rM === month) {
                totalHours.act_mo += hours;
                entries.act_mo.push(r);
                if (name) {
                    if (isADM) sets.act_mo_adm.add(name); else sets.act_mo_cons.add(name);
                }
            }

            if (rY === prevYear && rM === prevMo) {
                totalHours.act_prev_mo += hours;
                entries.act_prev_mo.push(r);
                if (name) {
                    if (isADM) sets.act_prev_mo_adm.add(name); else sets.act_prev_mo_cons.add(name);
                }
            }

            if (rY === year && rM <= month) {
                totalHours.act_ytd += hours;
                entries.act_ytd.push(r);
                if (name) {
                    if (isADM) sets.act_ytd_adm.add(name); else sets.act_ytd_cons.add(name);
                }
            }

            if (rY === year - 1 && rM <= month) {
                totalHours.act_py_ytd += hours;
                entries.act_py_ytd.push(r);
                if (name) {
                    if (isADM) sets.act_py_ytd_adm.add(name); else sets.act_py_ytd_cons.add(name);
                }
            }

            const idx = rY * 12 + rM;
            const diff = targetIndex - idx;
            if (diff >= 0 && diff < 12) {
                totalHours.act_ltm += hours;
                entries.ltm.push(r);
                if (name) {
                    if (isADM) sets.act_ltm_adm.add(name); else sets.act_ltm_cons.add(name);
                }
            }
        });

        numAdm.act_mo = sets.act_mo_adm.size;
        numAdm.act_prev_mo = sets.act_prev_mo_adm.size;
        numAdm.act_ytd = sets.act_ytd_adm.size;
        numAdm.act_py_ytd = sets.act_py_ytd_adm.size;
        numAdm.act_ltm = sets.act_ltm_adm.size;

        numConsultor.act_mo = sets.act_mo_cons.size;
        numConsultor.act_prev_mo = sets.act_prev_mo_cons.size;
        numConsultor.act_ytd = sets.act_ytd_cons.size;
        numConsultor.act_py_ytd = sets.act_py_ytd_cons.size;
        numConsultor.act_ltm = sets.act_ltm_cons.size;

        const avgHourlyValue = initRow();

        return {
            totalHours,
            numAdm,
            numConsultor,
            avgHourlyValue,
            debug: {
                sets: {
                    act_mo_adm: Array.from(sets.act_mo_adm), act_mo_cons: Array.from(sets.act_mo_cons),
                    act_ytd_adm: Array.from(sets.act_ytd_adm), act_ytd_cons: Array.from(sets.act_ytd_cons)
                },
                entries
            }
        };
    },

    // Utility to print diagnostic info to console for a given year/month
    printKeyRatiosDebug(year, month) {
        year = Number(year) || (new Date()).getFullYear();
        month = Number(month) || (new Date()).getMonth() + 1;
        const arr = this.keyRatiosData || [];
        const det = this.calculateKeyRatiosDetailed(arr, year, month);
        console.group(`KeyRatios Debug - ${year}/${month}`);
        console.log('totalHours:', det.totalHours);
        console.log('numAdm:', det.numAdm);
        console.log('numConsultor:', det.numConsultor);
        console.log('debug sets:', det.debug.sets);
        console.log('entries.act_mo (count):', det.debug.entries.act_mo.length, det.debug.entries.act_mo.slice(0,20));
        console.log('entries.act_ytd (count):', det.debug.entries.act_ytd.length);
        console.groupEnd();
        return det;
    },

    // --- LÓGICA DINÂMICA DRE ACUMULADO ---
    renderDREAcumulado() {
        // Debounced wrapper: evita renderizações repetidas quando filtros mudam rapidamente
        if (this._dreAccTimer) clearTimeout(this._dreAccTimer);
        this._dreAccTimer = setTimeout(() => {
            // Delega renderização para o módulo de aba `AbaDreAcumulado` quando disponível
            try {
                if (window.AbaDreAcumulado && typeof window.AbaDreAcumulado.render === 'function') {
                    const getFilterValue = (id) => {
                        const el = document.getElementById(id);
                        if (!el) return '';
                        const v = String(el.value || '').trim();
                        return v === 'Todos...' ? '' : v;
                    };
                    const year = parseInt(document.getElementById('dre-acc-year') ? document.getElementById('dre-acc-year').value : (new Date().getFullYear()));
                    const month = parseInt(document.getElementById('dre-acc-month') ? document.getElementById('dre-acc-month').value : (new Date().getMonth()+1));
                    // prepare context
                    this.currentDREAcumuladoExportData = [];
                    const ctx = {
                        year,
                        month,
                        filtros: {
                            cc: getFilterValue('dre-acc-cc'),
                            dept: getFilterValue('dre-acc-dept'),
                            client: getFilterValue('dre-acc-client'),
                            sbd: getFilterValue('dre-acc-sbd'),
                            proj: getFilterValue('dre-acc-proj')
                        },
                        data: this.data || [],
                        keyRatiosData: this.keyRatiosData || [],
                        keyRatiosBudgetData: this.keyRatiosBudgetData || [],
                        mgmtFees: this.mgmtFees || [],
                        isAdmAllocationEnabled: this.isAdmAllocationEnabled,
                        exemptCCs: this.exemptCCs || [],
                        posEbitdaAccounts: this.posEbitdaAccounts || [],
                        custoAccounts: this.custoAccounts || [],
                        depreciacaoAccounts: this.depreciacaoAccounts || [],
                        pessoalAccounts: this.pessoalAccounts || [],
                        aluguelAccounts: this.aluguelAccounts || [],
                        viagensAccounts: this.viagensAccounts || [],
                        diversasAccounts: this.diversasAccounts || [],
                        servicosProfissionaisAccounts: this.servicosProfissionaisAccounts || [],
                        taxasAccounts: this.taxasAccounts || [],
                        outrasAdmAccounts: this.outrasAdmAccounts || [],
                        deductionAccounts: this.deductionAccounts || [],
                        budgetRevenueAccounts: this.budgetRevenueAccounts || [],
                        budgetExcludedFromRevenue: this.budgetExcludedFromRevenue || [],
                        managementFeeAccounts: this.managementFeeAccounts || [],
                        normalizeAccountDigits: this.normalizeAccountDigits ? this.normalizeAccountDigits.bind(this) : null,
                        getAdmAllocationForMonth: this.getAdmAllocationForMonth ? this.getAdmAllocationForMonth.bind(this) : null,
                        getMgmtFeeAllocationForMonth: this.getMgmtFeeAllocationForMonth ? this.getMgmtFeeAllocationForMonth.bind(this) : null,
                        calculateKeyRatios: this.calculateKeyRatios ? this.calculateKeyRatios.bind(this) : (this.calculateKeyRatiosMonthly ? this.calculateKeyRatiosMonthly.bind(this) : null),
                        currentDREAcumuladoExportData: this.currentDREAcumuladoExportData
                    };
                    // silencioso: chamando AbaDreAcumulado sem log
                    window.AbaDreAcumulado.render('view-dre-acumulado', ctx);
                    return;
                }
            } catch (e) {
                console.error('Erro delegando renderDREAcumulado para AbaDreAcumulado:', e);
            }
            // Fallback mínimo: limpar a tabela se AbaDreAcumulado não estiver disponível
            try { const tbody = document.getElementById('dre-acumulado-body'); if (tbody) tbody.innerHTML = ''; } catch (e) {}
        }, 120);
    },

    // --- NOVA VISÃO: DRE MENSAL BUDGET-2 (delegada ao módulo `AbaDreBudget2`) ---
    renderDREBudget2() {
        try {
            if (window.AbaDreBudget2 && typeof window.AbaDreBudget2.render === 'function') {
                const getFilterValue = (id) => {
                    const el = document.getElementById(id);
                    if (!el) return '';
                    const v = String(el.value || '').trim();
                    return v === 'Todos...' ? '' : v;
                };
                const year = parseInt(document.getElementById('dre-b2-year') ? document.getElementById('dre-b2-year').value : (new Date().getFullYear()));
                const ctx = {
                    year,
                    filtros: {
                        cc: getFilterValue('dre-b2-cc'),
                        dept: getFilterValue('dre-b2-dept'),
                        client: getFilterValue('dre-b2-client'),
                        sbd: getFilterValue('dre-b2-sbd'),
                        proj: getFilterValue('dre-b2-proj')
                    },
                    data: this.data || [],
                    keyRatiosBudgetData: this.keyRatiosBudgetData || [],
                    exemptCCs: this.exemptCCs || [],
                    isAdmAllocationEnabled: this.isAdmAllocationEnabled,
                    viagensAccounts: this.viagensAccounts || [],
                    custoAccounts: this.custoAccounts || [],
                    pessoalAccounts: this.pessoalAccounts || [],
                    aluguelAccounts: this.aluguelAccounts || [],
                    servicosProfissionaisAccounts: this.servicosProfissionaisAccounts || [],
                    taxasAccounts: this.taxasAccounts || [],
                    diversasAccounts: this.diversasAccounts || [],
                    outrasAdmAccounts: this.outrasAdmAccounts || [],
                    depreciacaoAccounts: this.depreciacaoAccounts || [],
                    posEbitdaAccounts: this.posEbitdaAccounts || [],
                    managementFeeAccounts: this.managementFeeAccounts || [],
                    deductionAccounts: this.deductionAccounts || [],
                    normalizeAccountDigits: this.normalizeAccountDigits ? this.normalizeAccountDigits.bind(this) : null,
                    getAdmAllocationForMonth: this.getAdmAllocationForMonth ? this.getAdmAllocationForMonth.bind(this) : null
                };
                // silencioso: chamando AbaDreBudget2 sem log
                window.AbaDreBudget2.render('view-dre-budget-2', ctx);
                return;
            }
        } catch (e) {
            console.error('Erro delegando renderDREBudget2 para AbaDreBudget2:', e);
        }
        // Fallback mínimo: limpar a tabela se AbaDreBudget2 não estiver disponível
        try { const tbody = document.getElementById('dre-b2-body'); if (tbody) tbody.innerHTML = ''; } catch (e) {}
    },
    
    renderAcumuladoRatios(container, ratios) {
        // Formatação: mostrar 0 como '0,00' em vez de '-' para evitar colunas em branco
        const f = (v) => (v === 0 ? (0).toLocaleString('pt-BR',{minimumFractionDigits:0, maximumFractionDigits:2}) : (v ? v.toLocaleString('pt-BR',{minimumFractionDigits:0, maximumFractionDigits:2}) : '-'));
        const f_money = (v) => (v === 0 ? (0).toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2}) : (v ? v.toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2}) : '-'));
        const p = (v) => v ? (v * 100).toFixed(1) + '%' : '-';
        
        const cell = (v, fm_func, bg="") => {
            const value = v === 0 ? '-' : (v ? fm_func(v) : '-');
            // Reduzido o font-size para caber
            return `<td class="px-2 py-1 text-right font-mono text-[10px] ${bg}">${value}</td>`;
        };

        const getVarColor = (val) => {
            if(Math.abs(val) < 0.01) return 'text-gray-400';
            return val > 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold';
        };
        
        const calcVar = (real, base) => {
            if (base === 0) return { diff: real, perc: 0, color: 'text-gray-400' };
            const diff = real - base;
            const perc = diff / Math.abs(base);
            return { diff, perc, color: getVarColor(diff) };
        };
        
        const rows = [
            { label: "Horas Trabalhadas (h)", data: ratios.totalHours, isMoney: false },
            { label: "Funcionários (ADM)", data: ratios.numAdm, isMoney: false },
            { label: "Funcionários (Consultores)", data: ratios.numConsultor, isMoney: false },
            { label: "Valor Hora Médio (R$/h)", data: ratios.avgHourlyValue, isMoney: true, highlight: true }
        ];
        
        container.innerHTML += `<tr><td colspan="21" class="px-3 py-2 bg-gray-100 border-t-4 border-gray-300">
            <span class="text-xs font-bold text-blue-700"><i class="fa-solid fa-gauge-high mr-2"></i>KEY RATIOS ACUMULADOS</span>
        </td></tr>`;
        this.currentDREAcumuladoExportData.push(["KEY RATIOS"]);

        // Determine selected acumulado month (if any)
        const accMonthEl = document.getElementById('dre-acc-month');
        const selectedAccMonth = accMonthEl ? Number(accMonthEl.value) : null;

        rows.forEach(row => {
            const d = row.data;
            const fm_func = row.isMoney ? f_money : f; 
            
            const isHighlight = row.highlight;
            const baseClass = isHighlight 
                ? "dre-row font-bold bg-yellow-100 text-blue-800 border-t border-gray-300" 
                : "dre-row hover:bg-gray-50 text-gray-600 border-b border-gray-100";
            
            const labelClass = isHighlight
                ? "px-2 py-2 border-r border-gray-400 sticky left-0 z-10 bg-yellow-100"
                : "px-2 py-1 text-xs truncate border-r border-gray-200 sticky left-0 z-10 bg-white";

            const isEmployeeLine = row.label.includes('Funcionários (ADM)') || row.label.includes('Funcionários (Consultores)');
            // Sempre mostrar o valor do mês atual real (act_mo) e mês anterior (act_prev_mo).
            // Antes usávamos act_ytd para funcionários, o que mostrava acumulado quando o mês
            // selecionado não tinha dados — isso causava números incorretos. Aqui usamos o valor
            // do mês explícito.
            const moVal = d.act_mo;
            const prevVal = d.act_prev_mo;
            const vMoM = calcVar(moVal, prevVal);

            // Mês Budget e Var M vs B (esses valores foram calculados anteriormente ao mesclar budgets)
            const monthBudget = (d.bdg_mo !== undefined && d.bdg_mo !== null) ? d.bdg_mo : 0;
            const vMoVsB = calcVar(moVal, monthBudget);

            // Decide which budget value to show for YTD column: for employee lines and when an acumulado month is selected, show bdg_mo
            const bdgYtdShown = (isEmployeeLine && selectedAccMonth) ? (d.bdg_mo || 0) : (d.bdg_ytd || 0);

            // For employee lines show 'Mês Atual' across all Actual columns (so they match moVal)
            const actYtdShown = isEmployeeLine ? moVal : d.act_ytd;
            // YTD Ant. deve puxar do ano anterior (act_py_ytd). Se não houver, mostrar 0.
            const actPyShown = (d.act_py_ytd !== undefined && d.act_py_ytd !== null) ? d.act_py_ytd : 0;

            const vYTDvsB = calcVar(actYtdShown, bdgYtdShown);
            const vYTDvsPY = calcVar(actYtdShown, actPyShown);

            const bdgFyShown = (isEmployeeLine && selectedAccMonth) ? (d.bdg_mo || 0) : (d.bdg_fy || 0);
            const vYTDvsFYB = calcVar(actYtdShown, bdgFyShown);

            const cellNA = (bg, borderClass="") => `<td class="px-2 py-1 text-right font-mono text-gray-400 text-[10px] ${bg} ${borderClass}">-</td>`;
            const cellVarVal = (obj, bg="") => `<td class="px-2 py-1 text-right var-col ${bg} ${obj.color} text-[10px]">${fm_func(obj.diff)}</td>`; 
            const cellVarPerc = (obj, bg="") => `<td class="px-2 py-1 text-right var-col ${bg} ${obj.color} text-[10px] section-border-right">${p(obj.perc)}</td>`;
            
            // Export: alinhar com novo cabeçalho (inclui Mês Budget e var Month vs Budget)
            // monthBudget and vMoVsB already computed above for rendering alignment
            // LTM mostrado: para funcionários usamos moVal; caso contrário, se houver mês acumulado usamos act_ytd, senão act_ltm
            const ltmShown = isEmployeeLine ? moVal : ((selectedAccMonth) ? (d.act_ytd || 0) : (d.act_ltm || 0));
            const percAchieved = (bdgFyShown !== 0) ? (actYtdShown / bdgFyShown) : 0;
            this.currentDREAcumuladoExportData.push([
                row.label,
                moVal, prevVal, vMoM.diff, p(vMoM.perc),
                monthBudget, vMoVsB.diff, p(vMoVsB.perc),
                actYtdShown, bdgYtdShown, vYTDvsB.diff, p(vYTDvsB.perc),
                actYtdShown, actPyShown, vYTDvsPY.diff, p(vYTDvsPY.perc),
                actYtdShown, bdgFyShown, vYTDvsFYB.diff, p(percAchieved),
                ltmShown
            ]);


            container.innerHTML += `<tr class="${baseClass}">
                <td class="${labelClass}" title="${row.label}">${row.label}</td>
                
                ${cell(moVal, fm_func, "bg-gray-50")}
                ${cell(prevVal, fm_func, "text-gray-400 bg-gray-50")}
                ${cellVarVal(vMoM, "bg-gray-50")} ${cellVarPerc(vMoM, "bg-gray-50")}
                ${cell(monthBudget, fm_func, "bg-gray-50 text-gray-700")} ${cellVarVal(vMoVsB, "bg-gray-50")} ${cellVarPerc(vMoVsB, "bg-gray-50 section-border-right")}

                ${cell(actYtdShown, fm_func, "bg-blue-50 text-blue-900 section-border-left")} 
                ${cell(bdgYtdShown, fm_func, "bg-blue-50 text-gray-700")} 
                ${cellVarVal(vYTDvsB, "bg-blue-50")} ${cellVarPerc(vYTDvsB, "bg-blue-50 section-border-right")} 
                
                ${cell(actYtdShown, fm_func, "bg-yellow-50 text-yellow-900 section-border-left")} 
                ${cell(actPyShown, fm_func, "bg-yellow-50 text-gray-500")} 
                ${cellVarVal(vYTDvsPY, "bg-yellow-50")} ${cellVarPerc(vYTDvsPY, "bg-yellow-50")}

                ${cell(actYtdShown, fm_func, "bg-green-50 text-green-900 section-border-left")} 
                ${cell(bdgFyShown, fm_func, "bg-green-50 text-gray-700")} 
                ${cellVarVal(vYTDvsFYB, "bg-green-50")} ${cellVarPerc(vYTDvsFYB, "bg-green-50 section-border-right")} 
                
                ${cell(ltmShown, fm_func, "bg-purple-50 text-purple-900 border-l border-purple-200")} 
            </tr>`;
        });
    },

    renderAcumuladoRow(container, label, d, isBold, isExpense, cssClass="") {
        // Formatação: exibir 0 como '0,00' em vez de '-'
        const f = (v) => (v === 0 ? (0).toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2}) : (v ? v.toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2}) : '-'));
        const p = (v) => v ? (v * 100).toFixed(1) + '%' : '-';
        
        const getVarColor = (val, isPerc = false) => {
            if(Math.abs(val) < (isPerc ? 0.1 : 0.01)) return 'text-gray-400';
            const isPositive = val > 0;
            if (isExpense) {
                return isPositive ? 'text-red-600 font-bold' : 'text-green-600 font-bold';
            } else {
                return isPositive ? 'text-green-600 font-bold' : 'text-red-600 font-bold';
            }
        };
        
        const calcVar = (real, base) => {
            const diff = real - base; 
            let perc = 0;
            if (base !== 0) perc = diff / Math.abs(base);
            
            return { 
                diff: diff, 
                perc: perc, 
                color: getVarColor(diff, true)
            };
        };

        const vMoM = calcVar(d.act_mo, d.act_prev_mo);
        const vYTDvsB = calcVar(d.act_ytd, d.bdg_ytd);
        const vYTDvsPY = calcVar(d.act_ytd, d.act_py_ytd);
        const vYTDvsFYB = calcVar(d.act_ytd, d.bdg_fy); // Calculo de Var $ YTD vs FYB
        
        let percAchieved = d.bdg_fy !== 0 ? (d.act_ytd / d.bdg_fy) : 0;
        const achColor = getVarColor(percAchieved, false);


        const baseClass = isBold ? `font-bold ${cssClass} border-t border-gray-300` : `dre-row hover:bg-gray-50`;
        const labelClass = isBold 
            ? `px-2 py-2 border-r border-gray-400 sticky left-0 z-10 ${cssClass}` 
            : 'px-2 py-1 text-[9px] truncate border-r border-gray-200 sticky left-0 z-10 bg-white';
        
        const cell = (v, bg="") => `<td class="px-2 py-1 text-right text-[10px] ${bg}">${f(v)}</td>`;
        const cellVarVal = (obj, bg="") => `<td class="px-2 py-1 text-right var-col ${bg} ${obj.color} text-[10px]">${f(obj.diff)}</td>`;
        const cellVarPerc = (obj, bg="") => `<td class="px-2 py-1 text-right var-col ${bg} ${obj.color} text-[10px] section-border-right">${p(obj.perc)}</td>`;
        const cellPercAchieved = (v, bg="") => `<td class="px-2 py-1 text-right var-col ${bg} ${achColor} text-[10px] section-border-right">${p(v)}</td>`;
        const cellLTM = (v, bg="") => `<td class="px-2 py-1 text-right font-semibold text-[10px] ${bg} border-l border-purple-200">${f(v)}</td>`;

        // Exportação Excel (inclui Mês Budget + var Month vs B)
        const monthBudget = (d.bdg_mo !== undefined && d.bdg_mo !== null) ? d.bdg_mo : 0;
        const vMoVsB = calcVar(d.act_mo, monthBudget);
        this.currentDREAcumuladoExportData.push([
            label,
            d.act_mo, d.act_prev_mo, vMoM.diff, p(vMoM.perc),
            monthBudget, vMoVsB.diff, p(vMoVsB.perc),
            d.act_ytd, d.bdg_ytd, vYTDvsB.diff, p(vYTDvsB.perc),
            d.act_ytd, d.act_py_ytd, vYTDvsPY.diff, p(vYTDvsPY.perc),
            d.act_ytd, d.bdg_fy, vYTDvsFYB.diff, p(percAchieved),
            d.act_ltm
        ]);


        container.innerHTML += `<tr class="${baseClass}">
            <td class="${labelClass}" title="${label}">${label}</td>
            
            ${cell(d.act_mo, "bg-gray-50")}
            ${cell(d.act_prev_mo, "text-gray-400 bg-gray-50")}
            ${cellVarVal(vMoM, "bg-gray-50")} ${cellVarPerc(vMoM, "bg-gray-50")}
            ${cell(monthBudget, "bg-gray-50 text-gray-700")} ${cellVarVal(vMoVsB, "bg-gray-50")} ${cellVarPerc(vMoVsB, "bg-gray-50")} 
            
            ${cell(d.act_ytd, "bg-blue-50 text-blue-900 section-border-left")} 
            ${cell(d.bdg_ytd, "bg-blue-50 text-gray-500")} 
            ${cellVarVal(vYTDvsB, "bg-blue-50")} ${cellVarPerc(vYTDvsB, "bg-blue-50")} 
            
            ${cell(d.act_ytd, "bg-yellow-50 text-yellow-900 section-border-left")} 
            ${cell(d.act_py_ytd, "bg-yellow-50 text-gray-500")} 
            ${cellVarVal(vYTDvsPY, "bg-yellow-50")} ${cellVarPerc(vYTDvsPY, "bg-yellow-50")}

            ${cell(d.act_ytd, "bg-green-50 text-green-900 section-border-left")}
            ${cell(d.bdg_fy, "bg-green-50 text-gray-500")}
            ${cellVarVal(vYTDvsFYB, "bg-green-50")} ${cellPercAchieved(percAchieved, "bg-green-50")}

            ${cellLTM(d.act_ltm, "bg-purple-50 text-purple-900")}
        </tr>`;
    },
    
    renderAcumuladoPercRow(container, label, numeratorRow, denominatorRow) {
        const p = (v) => v ? (v * 100).toFixed(2) + '%' : '-';
        
        const baseClass = `dre-perc-row border-t border-gray-300`;
        const labelClass = 'px-2 py-1 text-xs truncate border-r border-gray-200 sticky left-0 z-10 bg-gray-50 text-gray-700 font-medium';
        const cellPerc = (val, bg="") => `<td class="px-2 py-1 text-right text-[10px] ${bg}">${p(val)}</td>`; // Fonte reduzida
        const cellPercLTM = (val, bg="") => `<td class="px-2 py-1 text-right text-[10px] ${bg} border-l border-purple-200">${p(val)}</td>`; // Fonte reduzida
        
        const calcPerc = (num, den) => den !== 0 ? num / den : 0;

        const vMoM = calcPerc(numeratorRow.act_mo, denominatorRow.act_mo);
        const vMoM_ant = calcPerc(numeratorRow.act_prev_mo, denominatorRow.act_prev_mo);
        const vYTD = calcPerc(numeratorRow.act_ytd, denominatorRow.act_ytd);
        const vYTD_b = calcPerc(numeratorRow.bdg_ytd, denominatorRow.bdg_ytd);
        const vYTD_py = calcPerc(numeratorRow.act_py_ytd, denominatorRow.act_py_ytd);
        const vFY = calcPerc(numeratorRow.bdg_fy, denominatorRow.bdg_fy);
        const vLTM = calcPerc(numeratorRow.act_ltm, denominatorRow.act_ltm);

        const vMoB = calcPerc(numeratorRow.bdg_mo, denominatorRow.bdg_mo);
        const vAchieved = calcPerc(vYTD, vFY);

        // Exportação Excel (Inclui células vazias para Var $ / Var % nas colunas de variações)
        this.currentDREAcumuladoExportData.push([
            label,
            p(vMoM), // Mês Atual %
            p(vMoM_ant), // Mês Anterior %
            '-', // Var $MoM (não aplicável para % row)
            '-', // Var % MoM (não aplicável)
            p(vMoB), // Mês Budget %
            '-', // Var $ M vs B
            '-', // Var % M vs B
            p(vYTD), // YTD Real %
            p(vYTD_b), // YTD Budget %
            '-', // Var$ YTD vs B
            '-', // Var % YTD vs B
            p(vYTD), // YTD Real (reapresentado)
            p(vYTD_py), // YTD Ant. %
            '-', // Var $YTD vs PY
            '-', // Var % YTD vs PY
            p(vYTD), // YTD Real (FYB section)
            p(vFY), // FY Budget %
            '-', // Var$ YTD vs FYB
            p(vAchieved), // Perc. Atin. %
            p(vLTM) // LTM %
        ]);

        // Célula vazia para Var $ (para alinhamento)
        const emptyVal = (bg="") => `<td class="px-2 py-1 bg-gray-50 ${bg}"></td>`;

        container.innerHTML += `<tr class="${baseClass}">
            <td class="${labelClass}" title="% ${label}">% ${label}</td>

            ${cellPerc(vMoM, "bg-gray-50")}
            ${cellPerc(vMoM_ant, "text-gray-400 bg-gray-50")}
            ${emptyVal("bg-gray-50")} <!-- Var $MoM -->
            ${emptyVal("bg-gray-50")} <!-- Var %MoM -->
            ${cellPerc(vMoB, "bg-gray-50 text-gray-700")}
            ${emptyVal("bg-gray-50")} <!-- Var $ M vs B -->
            ${emptyVal("bg-gray-50 section-border-right")} <!-- Var % M vs B -->

            ${cellPerc(vYTD, "bg-blue-50 text-blue-900 section-border-left")} 
            ${cellPerc(vYTD_b, "bg-blue-50 text-gray-500")} 
            ${emptyVal("bg-blue-50")} <!-- Var$ YTD vs B -->
            ${emptyVal("bg-blue-50 section-border-right")} <!-- Var % YTD vs B -->

            ${cellPerc(vYTD, "bg-yellow-50 text-yellow-900 section-border-left")} <!-- YTD Real (PY) -->
            ${cellPerc(vYTD_py, "bg-yellow-50 text-gray-500")} <!-- YTD Ant. -->
            ${emptyVal("bg-yellow-50")} <!-- Var $YTD vs PY -->
            ${emptyVal("bg-yellow-50")} <!-- Var % YTD vs PY -->

            ${cellPerc(vYTD, "bg-green-50 text-green-900 section-border-left")} <!-- YTD Real (FYB) -->
            ${cellPerc(vFY, "bg-green-50 text-gray-500")} <!-- FY Budget % -->
            ${emptyVal("bg-green-50")} <!-- Var$ YTD vs FYB -->
            ${cellPerc(vAchieved, "bg-green-50 section-border-right")} <!-- Perc. Atin. % -->

            ${cellPercLTM(vLTM, "bg-purple-50 text-purple-900")} <!-- LTM -->
        </tr>`;
    },
    
    exportDREAcumulado() {
        if (!this.currentDREAcumuladoExportData || this.currentDREAcumuladoExportData.length === 0) {
            alert("Por favor, gere a DRE Acumulada antes de exportar.");
            return;
        }
        const ws = XLSX.utils.aoa_to_sheet(this.currentDREAcumuladoExportData);
        
        // Corrigido para 18 colunas (1ª + 17 dados)
        ws['!cols'] = [{wch:40}, ...Array(17).fill({wch:12})];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "DRE Acumulada");
        XLSX.writeFile(wb, "DRE_Acumulada_Analitica.xlsx");
    },

    // Margin rendering logic moved to `js/aba-margin-analysis.js`.
    // Delegadores para as ações da aba Margem são definidos mais abaixo (wrapper).

    // Diagnostic helper: mostra linhas do Budget com classificação (Receita vs Custo) e motivo
    printBudgetClassification(year, departamento) {
        const y = parseInt(year) || new Date().getFullYear();
        const deptFilter = departamento ? String(departamento).trim() : null;
        const rows = this.data.filter(it => it.tipo === 'Budget' && parseInt(it.ano) === y && (!deptFilter || String(it.departamento).trim() === deptFilter));
        const results = rows.map(it => {
            const contaNum = Number(it.conta);
            const valor = Number(it.valor) || 0;
            let isCusto = false;
            const reasons = [];
            if (this.custoAccounts.includes(contaNum)) { isCusto = true; reasons.push('custoAccounts'); }
            if (this.viagensAccounts.includes(contaNum)) { isCusto = true; reasons.push('viagensAccounts'); }
            if (this.pessoalAccounts.includes(contaNum)) { isCusto = true; reasons.push('pessoalAccounts'); }
            if (this.outrasAdmAccounts.includes(contaNum)) { isCusto = true; reasons.push('outrasAdmAccounts'); }
            if (this.depreciacaoAccounts.includes(contaNum)) { isCusto = true; reasons.push('depreciacaoAccounts'); }
            if (this.servicosProfissionaisAccounts.includes(contaNum)) { isCusto = true; reasons.push('servicosProfissionaisAccounts'); }
            if (this.taxasAccounts.includes(contaNum)) { isCusto = true; reasons.push('taxasAccounts'); }
            if (this.managementFeeAccounts.includes(contaNum)) { isCusto = true; reasons.push('managementFeeAccounts'); }
            if (!isCusto && valor < 0) { isCusto = true; reasons.push('valor<0'); }
            if (!isCusto && String(it.departamento).trim() === 'ADM') {
                if (!(contaNum === 1902 || contaNum === 3204)) { isCusto = true; reasons.push('departamento ADM (default custo)'); }
            }
            if (this.deductionAccounts.includes(contaNum)) { reasons.push('deductionAccounts'); }
            if (contaNum === 1902) { reasons.push('conta1902 - explicit revenue'); }
            if (contaNum === 3204) { reasons.push('conta3204 - ignored imported 3204'); }

            return {
                ano: it.ano, departamento: it.departamento, centroCusto: it.centroCusto, conta: it.conta, descricao: it.descricao || '', valor: valor,
                classifiedAs: isCusto ? 'CUSTO' : 'RECEITA', reasons: reasons.join(', ')
            };
        });
        console.table(results);
        return results;
    },

    // Diagnostic helper: mostra as N maiores linhas do Budget (por valor absoluto) e abre o painel
    printBudgetTop(n, year, departamento) {
        const y = parseInt(year) || new Date().getFullYear();
        const deptFilter = departamento ? String(departamento).trim() : null;
        const limit = parseInt(n) || 20;
        const rows = this.data.filter(it => it.tipo === 'Budget' && parseInt(it.ano) === y && (!deptFilter || String(it.departamento).trim() === deptFilter));
        const mapped = rows.map(it => {
            const contaNum = Number(it.conta);
            const valor = Number(it.valor) || 0;
            let isCusto = false;
            const reasons = [];
            if (this.custoAccounts.includes(contaNum)) { isCusto = true; reasons.push('custoAccounts'); }
            if (this.viagensAccounts.includes(contaNum)) { isCusto = true; reasons.push('viagensAccounts'); }
            if (this.pessoalAccounts.includes(contaNum)) { isCusto = true; reasons.push('pessoalAccounts'); }
            if (this.outrasAdmAccounts.includes(contaNum)) { isCusto = true; reasons.push('outrasAdmAccounts'); }
            if (this.depreciacaoAccounts.includes(contaNum)) { isCusto = true; reasons.push('depreciacaoAccounts'); }
            if (this.servicosProfissionaisAccounts.includes(contaNum)) { isCusto = true; reasons.push('servicosProfissionaisAccounts'); }
            if (this.taxasAccounts.includes(contaNum)) { isCusto = true; reasons.push('taxasAccounts'); }
            if (this.managementFeeAccounts.includes(contaNum)) { isCusto = true; reasons.push('managementFeeAccounts'); }
            if (!isCusto && valor < 0) { isCusto = true; reasons.push('valor<0'); }
            if (!isCusto && String(it.departamento).trim() === 'ADM') {
                if (!(contaNum === 1902 || contaNum === 3204)) { isCusto = true; reasons.push('departamento ADM (default custo)'); }
            }
            return {
                ano: it.ano, departamento: it.departamento, centroCusto: it.centroCusto, conta: it.conta, descricao: it.descricao || '', valor: valor,
                absValor: Math.abs(valor), classifiedAs: isCusto ? 'CUSTO' : 'RECEITA', reasons: reasons.join(', ')
            };
        });
        mapped.sort((a,b) => b.absValor - a.absValor);
        const top = mapped.slice(0, limit);
        // Reuse UI panel if present
        try {
            const containerId = 'budget-debug-console';
            let container = document.getElementById(containerId);
            if (!container) {
                // call existing print function to create the panel
                this.printBudgetClassification(y, deptFilter);
                container = document.getElementById(containerId);
            }
            if (container) {
                const preEl = document.getElementById(containerId + '-pre');
                if (preEl) preEl.textContent = JSON.stringify(top, null, 2);
            }
        } catch (e) {}

        console.table(top);
        return top;
    },

    // Diagnostic helper: filtra Budget por valor absoluto mínimo e mostra resumo compacto
    printBudgetBig(minAbs, year, departamento) {
        const y = parseInt(year) || new Date().getFullYear();
        const deptFilter = departamento ? String(departamento).trim() : null;
        const threshold = Number(minAbs) || 1000000;
        const rows = this.data.filter(it => it.tipo === 'Budget' && parseInt(it.ano) === y && (!deptFilter || String(it.departamento).trim() === deptFilter));
        const matched = rows.filter(it => Math.abs(Number(it.valor) || 0) >= threshold).map(it => ({ano: it.ano, departamento: it.departamento, centroCusto: it.centroCusto, conta: it.conta, descricao: it.descricao || '', valor: Number(it.valor) || 0}));
        matched.sort((a,b) => Math.abs(b.valor) - Math.abs(a.valor));
        const top = matched.slice(0, 200); // show up to 200 to avoid flooding

        // show concise console.table with key columns
        if (top.length > 0) {
            console.table(top, ['conta','departamento','centroCusto','valor','descricao']);
        } else {
            console.log(`Nenhum lançamento Budget com |valor| >= ${threshold} para ${y}${deptFilter ? ' dept='+deptFilter : ''}`);
        }

        // also show a small UI panel if possible
        try {
            const containerId = 'budget-debug-console-big';
            let container = document.getElementById(containerId);
            if (!container) {
                container = document.createElement('div');
                container.id = containerId;
                container.style.position = 'fixed';
                container.style.right = '12px';
                container.style.top = '12px';
                container.style.width = '640px';
                container.style.maxHeight = '70vh';
                container.style.overflow = 'auto';
                container.style.background = 'rgba(255,255,255,0.98)';
                container.style.border = '1px solid #bbb';
                container.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)';
                container.style.zIndex = 999999;
                container.style.fontSize = '12px';
                container.style.padding = '8px';
                const header = document.createElement('div');
                header.style.display = 'flex';
                header.style.justifyContent = 'space-between';
                header.style.alignItems = 'center';
                const title = document.createElement('strong');
                title.innerText = `Budget Big >= ${threshold} - ${y}${deptFilter ? ' - ' + deptFilter : ''}`;
                const closeBtn = document.createElement('button');
                closeBtn.innerText = '×';
                closeBtn.style.border = 'none';
                closeBtn.style.background = 'transparent';
                closeBtn.style.fontSize = '18px';
                closeBtn.style.cursor = 'pointer';
                closeBtn.onclick = () => container.remove();
                header.appendChild(title);
                header.appendChild(closeBtn);
                container.appendChild(header);
                const pre = document.createElement('pre');
                pre.style.whiteSpace = 'pre-wrap';
                pre.style.wordBreak = 'break-word';
                pre.style.marginTop = '8px';
                pre.style.maxHeight = '62vh';
                pre.style.overflow = 'auto';
                pre.id = containerId + '-pre';
                container.appendChild(pre);
                document.body.appendChild(container);
            }
            const preEl = document.getElementById(containerId + '-pre');
            if (preEl) preEl.textContent = JSON.stringify(top.slice(0,50), null, 2);
        } catch (e) {
            // ignore UI errors
        }

        return top;
    },

    // New helper: cria um painel visível com as maiores linhas do Budget (útil quando
    // o console não está acessível). Uso: `app.showBudgetDebug(2025, 'ADM', 1000000)`
    showBudgetDebug(year, departamento, threshold) {
        const y = parseInt(year) || new Date().getFullYear();
        const deptFilter = departamento ? String(departamento).trim() : null;
        const thr = Number(threshold) || 1000000;
        const rows = this.data.filter(it => it && it.tipo === 'Budget' && parseInt(it.ano) === y && (!deptFilter || String(it.departamento).trim() === deptFilter));
        const mapped = rows.map(it => ({
            ano: it.ano, departamento: it.departamento, centroCusto: it.centroCusto, conta: it.conta, descricao: it.descricao || '', valor: Number(it.valor) || 0
        }));
        const filtered = mapped.filter(r => Math.abs(r.valor) >= thr).sort((a,b)=> Math.abs(b.valor)-Math.abs(a.valor));

        // create or reuse panel
        try {
            const id = 'budget-debug-panel';
            let panel = document.getElementById(id);
            if (!panel) {
                panel = document.createElement('div'); panel.id = id;
                panel.style.position = 'fixed'; panel.style.right = '12px'; panel.style.top = '12px';
                panel.style.width = '760px'; panel.style.maxHeight = '70vh'; panel.style.overflow = 'auto';
                panel.style.background = 'rgba(255,255,255,0.98)'; panel.style.border = '1px solid #bbb';
                panel.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'; panel.style.zIndex = 999999;
                panel.style.fontSize = '12px'; panel.style.padding = '8px'; panel.style.borderRadius = '6px';
                const header = document.createElement('div'); header.style.display='flex'; header.style.justifyContent='space-between'; header.style.alignItems='center';
                const title = document.createElement('strong'); title.innerText = `Budget Debug >= ${thr} - ${y}${deptFilter ? ' - ' + deptFilter : ''}`;
                const closeBtn = document.createElement('button'); closeBtn.innerText = '×'; closeBtn.style.border='none'; closeBtn.style.background='transparent'; closeBtn.style.fontSize='18px'; closeBtn.style.cursor='pointer';
                closeBtn.onclick = () => panel.remove();
                header.appendChild(title); header.appendChild(closeBtn); panel.appendChild(header);
                const info = document.createElement('div'); info.style.marginTop='8px'; info.style.marginBottom='8px'; info.style.color='#333'; panel.appendChild(info);
                const pre = document.createElement('pre'); pre.style.whiteSpace='pre-wrap'; pre.style.wordBreak='break-word'; pre.style.marginTop='8px'; pre.style.maxHeight='62vh'; pre.style.overflow='auto'; pre.id = id + '-pre'; panel.appendChild(pre);
                document.body.appendChild(panel);
            }
            const preEl = document.getElementById(id + '-pre');
            if (preEl) preEl.textContent = JSON.stringify(filtered.slice(0,500), null, 2);
        } catch (e) {
            console.error('Erro criando painel de debug Budget:', e);
        }

        // also log a short summary to console for quick copy-paste
        const total = filtered.reduce((s,r)=> s + (Number(r.valor)||0), 0);
        console.log(`Budget Debug ${y} ${deptFilter||''} threshold ${thr} -> linhas: ${filtered.length}, soma: ${total.toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2})}`);
        return filtered;
    },

    // New lightweight helper: sumariza Budget por conta para um departamento e imprime no console
    // Uso: app.summarizeBudgetDept(2025, 'ADM')
    summarizeBudgetDept(year, departamento) {
        const y = parseInt(year) || new Date().getFullYear();
        const deptFilter = departamento ? String(departamento).trim() : null;
        const rows = this.data.filter(it => it && it.tipo === 'Budget' && parseInt(it.ano) === y && (!deptFilter || String(it.departamento).trim() === deptFilter));
        if (!rows || rows.length === 0) {
            console.log(`Nenhum lançamento Budget para ${y}${deptFilter ? ' dept='+deptFilter : ''}`);
            return [];
        }
        const byAccount = {};
        let total = 0;
        rows.forEach(r => {
            const acc = String(r.conta).trim();
            const v = Number(r.valor) || 0;
            if (!byAccount[acc]) byAccount[acc] = { conta: acc, descricao: String(r.descricao||''), soma: 0, linhas: 0 };
            byAccount[acc].soma += v;
            byAccount[acc].linhas += 1;
            total += v;
        });
        const arr = Object.values(byAccount).sort((a,b) => Math.abs(b.soma) - Math.abs(a.soma));
        console.log(`Resumo Budget ${y}${deptFilter ? ' dept='+deptFilter : ''} => linhas: ${rows.length}, total: ${total.toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2})}`);
        console.table(arr.slice(0,200), ['conta','descricao','linhas','soma']);
        return { total, accounts: arr };
    },

    // Abre um painel overlay com o resumo por conta (UI visível)
    openBudgetSummaryPanel(year, departamento) {
        const panelId = 'budget-summary-panel';
        // Evitar múltiplos painéis
        const existing = document.getElementById(panelId);
        if (existing) return existing.scrollIntoView();

        // Defaults from controls if disponíveis
        const selYear = year || (document.getElementById('dre-b2-year') && document.getElementById('dre-b2-year').value) || new Date().getFullYear();
        const dept = departamento || (document.getElementById('dre-b2-dept') && document.getElementById('dre-b2-dept').value) || '';
        const res = this.summarizeBudgetDept(selYear, dept);

        // Cria painel
        const container = document.createElement('div');
        container.id = panelId;
        container.style.position = 'fixed';
        container.style.left = '12px';
        container.style.bottom = '12px';
        container.style.width = '680px';
        container.style.maxHeight = '70vh';
        container.style.overflow = 'auto';
        container.style.background = 'rgba(255,255,255,0.98)';
        container.style.border = '1px solid #e5e7eb';
        container.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
        container.style.zIndex = 99999;
        container.style.padding = '12px';
        container.style.fontSize = '13px';

        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';

        const title = document.createElement('div');
        title.innerHTML = `<strong>Resumo Budget por Conta</strong><div style="font-size:12px;color:#555;margin-top:4px">${selYear} ${dept ? ' - ' + dept : ''} • Linhas: ${res.accounts.length} • Total: ${Number(res.total||0).toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2})}</div>`;
        header.appendChild(title);

        // Excluded accounts summary (at top)
        const excludedDiv = document.createElement('div');
        excludedDiv.style.marginTop = '8px';
        const exclList = (this.budgetExcludedFromRevenue || []).slice(0,50);
        excludedDiv.innerHTML = `<div style="font-size:12px;color:#444">Contas marcadas como <strong>NOTA: NÃO Receita</strong>: ${exclList.length ? exclList.join(', ') : '<em>nenhuma</em>'} <button id="btn-clear-excluded" style="margin-left:8px;padding:4px 8px;background:#ef4444;color:white;border:none;border-radius:6px;cursor:pointer">Limpar todas</button></div>`;
        header.appendChild(excludedDiv);

        const btns = document.createElement('div');
        const close = document.createElement('button');
        close.innerText = '×';
        close.style.border = 'none'; close.style.background = 'transparent'; close.style.fontSize = '18px'; close.style.cursor = 'pointer';
        close.onclick = () => container.remove();
        btns.appendChild(close);
        header.appendChild(btns);
        container.appendChild(header);

        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.marginTop = '8px';
        const thead = document.createElement('thead');
        thead.innerHTML = `<tr style="background:#f3f4f6"><th style="text-align:left;padding:6px;border-bottom:1px solid #eee">Conta</th><th style="text-align:left;padding:6px;border-bottom:1px solid #eee">Descrição</th><th style="text-align:right;padding:6px;border-bottom:1px solid #eee">Linhas</th><th style="text-align:right;padding:6px;border-bottom:1px solid #eee">Soma</th><th style="padding:6px;border-bottom:1px solid #eee"></th></tr>`;
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        res.accounts.slice(0,200).forEach(row => {
            const accNorm = this.normalizeAccountDigits(row.conta || '') || String(row.conta || '');
            const isExcluded = (this.budgetExcludedFromRevenue || []).some(b => String(b) === String(accNorm) || String(b) === String(row.conta));
            const btnLabel = isExcluded ? 'Remover marcação' : 'Marcar como NÃO Receita';
            const btnStyle = isExcluded ? 'padding:6px 8px;background:#6b7280;color:white;border-radius:6px;border:none;cursor:pointer' : 'padding:6px 8px;background:#ef4444;color:white;border-radius:6px;border:none;cursor:pointer';
            const tr = document.createElement('tr');
            tr.innerHTML = `<td style="padding:6px;border-bottom:1px solid #f9fafb">${row.conta}</td><td style="padding:6px;border-bottom:1px solid #f9fafb">${(row.descricao||'').slice(0,80)}</td><td style="padding:6px;border-bottom:1px solid #f9fafb;text-align:right">${row.linhas}</td><td style="padding:6px;border-bottom:1px solid #f9fafb;text-align:right">${Number(row.soma||0).toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2})}</td><td style="padding:6px;border-bottom:1px solid #f9fafb;text-align:right"><button data-acc="${row.conta}" class="btn-mark-not-rev" style="${btnStyle}">${btnLabel}</button></td>`;
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        container.appendChild(table);

        // event delegation for mark-as-revenue
        container.addEventListener('click', (ev) => {
            const btn = ev.target.closest && ev.target.closest('.btn-mark-not-rev');
            if (btn) {
                const acc = btn.getAttribute('data-acc');
                if (!acc) return;
                // Toggle exclusion
                const accDigits = this.normalizeAccountDigits(acc) || String(acc);
                this.budgetExcludedFromRevenue = this.budgetExcludedFromRevenue || [];
                const idx = this.budgetExcludedFromRevenue.findIndex(b => String(b) === String(accDigits) || String(b) === String(acc));
                if (idx === -1) {
                    this.budgetExcludedFromRevenue.push(accDigits);
                    this.showToast(`Conta ${accDigits} marcada como NÃO Receita`);
                    btn.innerText = 'Remover marcação'; btn.style.background = '#6b7280';
                } else {
                    this.budgetExcludedFromRevenue.splice(idx,1);
                    this.showToast(`Marca de NÃO Receita removida: ${accDigits}`);
                    btn.innerText = 'Marcar como NÃO Receita'; btn.style.background = '#ef4444';
                }
                this.saveToStorage();
                // refresh header excluded summary
                try { const hd = container.querySelector('div'); if (hd) { const exclList2 = (this.budgetExcludedFromRevenue||[]).slice(0,50); excludedDiv.innerHTML = `<div style="font-size:12px;color:#444">Contas marcadas como <strong>NOTA: NÃO Receita</strong>: ${exclList2.length ? exclList2.join(', ') : '<em>nenhuma</em>'} <button id="btn-clear-excluded" style="margin-left:8px;padding:4px 8px;background:#ef4444;color:white;border:none;border-radius:6px;cursor:pointer">Limpar todas</button></div>`; } } catch(e){}
                try { if (typeof this.renderDREBudget2 === 'function') this.renderDREBudget2(); } catch (e) {}
                try { if (typeof this.renderMarginAnalysis === 'function') this.renderMarginAnalysis(); } catch (e) {}
                return;
            }
            const upd = ev.target.closest && ev.target.closest('.btn-budget-update');
            if (upd) {
                try { if (typeof this.renderDREBudget2 === 'function') this.renderDREBudget2(); } catch (e) {}
                try { if (typeof this.renderMarginAnalysis === 'function') this.renderMarginAnalysis(); } catch (e) {}
            }
        });

        document.body.appendChild(container);
        // Add update button footer
        const footer = document.createElement('div');
        footer.style.display = 'flex';
        footer.style.justifyContent = 'flex-end';
        footer.style.marginTop = '8px';
        const updBtn = document.createElement('button');
        updBtn.className = 'btn-budget-update';
        updBtn.innerText = 'Atualizar Relatórios';
        updBtn.style.padding = '8px 10px';
        updBtn.style.background = '#2563eb';
        updBtn.style.color = 'white';
        updBtn.style.border = 'none';
        updBtn.style.borderRadius = '6px';
        updBtn.style.cursor = 'pointer';
        footer.appendChild(updBtn);
        container.appendChild(footer);
        // Clear all excluded handler
        const clearBtn = document.getElementById('btn-clear-excluded');
        if (clearBtn) clearBtn.onclick = () => {
            this.budgetExcludedFromRevenue = [];
            this.saveToStorage();
            excludedDiv.innerHTML = `<div style="font-size:12px;color:#444">Contas marcadas como <strong>NOTA: NÃO Receita</strong>: <em>nenhuma</em> <button id="btn-clear-excluded" style="margin-left:8px;padding:4px 8px;background:#ef4444;color:white;border:none;border-radius:6px;cursor:pointer">Limpar todas</button></div>`;
            this.renderDREBudget2 && this.renderDREBudget2();
            this.renderMarginAnalysis && this.renderMarginAnalysis();
        };
        return container;
    },

    // Marca uma conta do Budget para forçar classificação como RECEITA
    suggestTreatAccountAsRevenue(conta) {
        if (!conta) return this.showToast('Conta inválida', true);
        const descLikeTotal = /(^\(=\))|(^total\b)|\btotal\b|deprecia|depreciação|op[eé]x|opex/i;
        // If conta looks like an aggregate (e.g., '(=) OPEX', 'Total Depreciação') reject
        if (descLikeTotal.test(String(conta))) return this.showToast('Não é permitido marcar linhas agregadas/"Total" como receita.', true);

        // Require at least some digits in the account identifier
        const accDigits = this.normalizeAccountDigits(conta || '');
        if (!accDigits) return this.showToast('Esta linha não contém uma conta numérica válida e não pode ser marcada como receita.', true);

        this.budgetRevenueAccounts = this.budgetRevenueAccounts || [];
        if (!this.budgetRevenueAccounts.includes(accDigits) && !this.budgetRevenueAccounts.includes(conta)) {
            this.budgetRevenueAccounts.push(accDigits);
            this.saveToStorage();
            this.showToast(`Conta ${accDigits} marcada como Receita (persistido).`);
        } else {
            this.showToast(`Conta ${accDigits} já está marcada.`);
        }
    },

    // Marca múltiplas contas como NÃO Receita (uso: app.bulkExcludeBudgetAccounts(['2925','3034',...]))
    bulkExcludeBudgetAccounts(list) {
        if (!Array.isArray(list)) {
            console.error('bulkExcludeBudgetAccounts requires an array');
            return [];
        }
        this.budgetExcludedFromRevenue = this.budgetExcludedFromRevenue || [];
        const added = [];
        list.forEach(acc => {
            const s = String(acc || '').trim();
            const digits = this.normalizeAccountDigits(s) || s;
            if (!digits) return;
            if (!this.budgetExcludedFromRevenue.some(b => String(b) === String(digits))) {
                this.budgetExcludedFromRevenue.push(digits);
                added.push(digits);
            }
        });
        if (added.length) {
            this.saveToStorage();
            try { if (typeof this.renderDREBudget2 === 'function') this.renderDREBudget2(); } catch(e){}
            try { if (typeof this.renderMarginAnalysis === 'function') this.renderMarginAnalysis(); } catch(e){}
            console.log('bulkExclude added:', added);
            this.showToast(`${added.length} contas marcadas como NÃO Receita.`);
        }
        return added;
    },

    // Helpers para gerenciar contas permitidas de receita em ADM
    isAdmRevenueAllowed(conta) {
        if (!conta) return false;
        const d = this.normalizeAccountDigits(conta);
        return (this.admRevenueAllowedAccounts || []).some(a => String(a) === String(d) || String(a) === String(conta));
    },

    // Define a lista (substitui)
    setAdmRevenueAllowedAccounts(list) {
        if (!Array.isArray(list)) return this.showToast('Lista inválida', true);
        this.admRevenueAllowedAccounts = list.map(x=>String(x).replace(/\D/g,''));
        this.saveToStorage();
        this.showToast('Lista de contas ADM permitidas atualizada.');
    },

    addAdmRevenueAccount(acc) {
        const d = String(acc||'').replace(/\D/g,'');
        if (!d) return;
        this.admRevenueAllowedAccounts = this.admRevenueAllowedAccounts || [];
        if (!this.admRevenueAllowedAccounts.includes(d)) {
            this.admRevenueAllowedAccounts.push(d);
            this.saveToStorage();
            this.showToast(`Conta ${d} adicionada à whitelist ADM.`);
        }
    },

    removeAdmRevenueAccount(acc) {
        const d = String(acc||'').replace(/\D/g,'');
        this.admRevenueAllowedAccounts = (this.admRevenueAllowedAccounts||[]).filter(a=>String(a)!==String(d));
        this.saveToStorage();
        this.showToast(`Conta ${d} removida da whitelist ADM.`);
    },
    
    exportDRE() {
        if (!this.currentDREExportData || this.currentDREExportData.length === 0) {
            alert("Por favor, gere a DRE (visualize a aba) antes de exportar.");
            return;
        }
        const ws = XLSX.utils.aoa_to_sheet(this.currentDREExportData);
        
        ws['!cols'] = [{wch:15}, {wch:40}, {wch:12}, {wch:12}, {wch:12}, {wch:12}, {wch:12}, {wch:12}, {wch:12}, {wch:12}, {wch:12}, {wch:12}, {wch:12}, {wch:12}, {wch:12}];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "DRE Mensal");
        XLSX.writeFile(wb, "DRE_Mensal_Detalhada.xlsx");
    },
    addLock() {
        const m = document.getElementById('lock-month').value;
        const y = document.getElementById('lock-year').value;
        if(!y) return alert("Informe o ano");
        const key = `${m}-${y}`;
        if (!this.locks.includes(key)) {
            this.locks.push(key);
            this.saveToStorage();
            this.renderLocks();
            this.showToast(`Período ${m}/${y} travado.`);
        }
    },
    removeLock(key) {
        this.locks = this.locks.filter(k => k !== key);
        this.saveToStorage();
        this.renderLocks();
    },
    renderLocks() {
        const list = document.getElementById('lock-list');
        const emptyMsg = document.getElementById('no-locks-msg');
        list.innerHTML = '';
        if (this.locks.length === 0) {
            emptyMsg.classList.remove('hidden');
        } else {
            emptyMsg.classList.add('hidden');
            this.locks.sort().forEach(key => {
                const [m, y] = key.split('-');
                const li = document.createElement('li');
                li.className = "flex justify-between items-center p-3 hover:bg-gray-50";
                li.innerHTML = `<span>${m.padStart(2, '0')}/${y}</span> <button onclick="app.removeLock('${key}')" class="text-red-500"><i class="fa-solid fa-unlock"></i></button>`;
                list.appendChild(li);
            });
        }
    },

    addExemptCC() {
        const input = document.getElementById('exempt-cc-input');
        const cc = input.value.trim();
        if(!cc) return alert("Digite o código do Centro de Custo.");

        if (!this.exemptCCs.includes(cc)) {
            this.exemptCCs.push(cc);
            this.saveToStorage();
            this.renderExemptCCs();
            this.showToast(`Centro de custo ${cc} adicionado à exceção.`);
            input.value = '';
            
            // NOVO: Renderiza DREs para aplicar a isenção imediatamente
            this.renderDRE();
            this.renderDREAcumulado();
            this.renderMarginAnalysis();
        } else {
            alert("Este centro de custo já está na lista.");
        }
    },
    removeExemptCC(cc) {
        this.exemptCCs = this.exemptCCs.filter(item => item !== cc);
        this.saveToStorage();
        this.renderExemptCCs();
        
        // NOVO: Renderiza DREs para remover a isenção imediatamente
        this.renderDRE();
            this.renderDREAcumulado();
            this.renderMarginAnalysis();
    },
    renderExemptCCs() {
        const list = document.getElementById('exempt-list');
        const emptyMsg = document.getElementById('no-exempt-msg');
        list.innerHTML = '';
        if (this.exemptCCs.length === 0) {
            emptyMsg.classList.remove('hidden');
        } else {
            emptyMsg.classList.add('hidden');
            this.exemptCCs.sort().forEach(cc => {
                const li = document.createElement('li');
                li.className = "flex justify-between items-center p-3 hover:bg-gray-50";
                li.innerHTML = `<span>${cc}</span> <button onclick="app.removeExemptCC('${cc}')" class="text-red-500 hover:text-red-700"><i class="fa-solid fa-trash"></i></button>`;
                list.appendChild(li);
            });
        }
    },

    addOcraConfig() {
        // Delegador para AbaConfig
        if (window.AbaConfig && typeof window.AbaConfig.addOcraConfig === 'function') {
            try { return window.AbaConfig.addOcraConfig(this); } catch (e) { console.error('Erro ao delegar addOcraConfig', e); this.showToast('Erro ao adicionar configuração OCRA.', true); }
        }
        this.showToast('Módulo de Config OCRA não encontrado.', true);
    },

    removeOcraConfig(id) {
        if (window.AbaConfig && typeof window.AbaConfig.removeOcraConfig === 'function') {
            try { return window.AbaConfig.removeOcraConfig(this, id); } catch (e) { console.error('Erro ao delegar removeOcraConfig', e); this.showToast('Erro ao remover configuração OCRA.', true); }
        }
        this.showToast('Módulo de Config OCRA não encontrado.', true);
    },

    renderOcraConfigList() {
        if (window.AbaConfig && typeof window.AbaConfig.renderOcraConfigList === 'function') {
            try { return window.AbaConfig.renderOcraConfigList(this); } catch (e) { console.error('Erro ao delegar renderOcraConfigList', e); this.showToast('Erro ao renderizar lista OCRA.', true); }
        }
        this.showToast('Módulo de Config OCRA não encontrado.', true);
    },

    loadOcraConfig() {
        if (window.AbaConfig && typeof window.AbaConfig.loadOcraConfig === 'function') {
            try { return window.AbaConfig.loadOcraConfig(this); } catch (e) { console.error('Erro ao delegar loadOcraConfig', e); }
        }
        // Fallback: render using existing method
        try { this.renderOcraConfigList(); } catch (e) {}
    },

    // ----------------- Centros de Custo (Project ID mapping) -----------------
    handleCentrosFile(input) {
        if (window.AbaCentrosCusto && typeof window.AbaCentrosCusto.handleFileInput === 'function') {
            return window.AbaCentrosCusto.handleFileInput(this, input);
        }
        // fallback: original inline behavior (if module not present)
        const file = input.files ? input.files[0] : null;
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const wb = XLSX.read(data, { type: 'array' });
                const firstSheet = wb.SheetNames[0];
                const sheet = wb.Sheets[firstSheet];
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
                this.importCentrosCusto(rows);
            } catch (err) {
                console.error('Erro lendo arquivo de Centros:', err);
                this.showToast('Erro ao ler arquivo de Centros.', true);
            }
        };
        reader.onloadend = () => { try { if (input && input.tagName === 'INPUT') input.value = ''; } catch(e) {} };
        reader.readAsArrayBuffer(file);
    },

    importCentrosCusto(rows) {
        if (window.AbaCentrosCusto && typeof window.AbaCentrosCusto.importCentrosCusto === 'function') {
            return window.AbaCentrosCusto.importCentrosCusto(this, rows);
        }
        // fallback to inline import if module not loaded
        if (!rows || rows.length <= 1) {
            this.showToast('Arquivo de Centros vazio ou sem linhas.', true);
            return;
        }
        const list = [];
        let skipped = 0;
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row) continue;
            const projectIdRaw = row[0];
            const projectId = String(projectIdRaw === undefined || projectIdRaw === null ? '' : projectIdRaw).trim();
            if (!projectId) { skipped++; continue; }
            const item = {
                id: Date.now() + Math.random(),
                projectId,
                descricao: String(row[1] || '').trim(),
                cliente: String(row[2] || '').trim(),
                departamento: String(row[3] || '').trim(),
                sbd: String(row[4] || '').trim(),
                projectType: String(row[5] || '').trim()
            };
            list.push(item);
        }
        if (list.length === 0) {
            this.showToast('Nenhum Centro de Custo válido encontrado no arquivo.', true);
            return;
        }
        this.centrosCusto = list;
        this.saveToStorage();
        this.renderCentrosCusto();
        let msg = `Importados ${list.length} Centros de Custo`;
        if (skipped) msg += `, pulados/invalidos: ${skipped}`;
        this.showToast(msg + '.');
    },

    renderCentrosCusto() {
        if (window.AbaCentrosCusto && typeof window.AbaCentrosCusto.renderList === 'function') {
            return window.AbaCentrosCusto.renderList(this);
        }
        const tbody = document.getElementById('centros-custo-body');
        if (!tbody) return;
        tbody.innerHTML = '';
        const list = this.centrosCusto || [];
        if (list.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td class="px-3 py-2 text-gray-500" colspan="7">Nenhum centro cadastrado.</td>`;
            tbody.appendChild(tr);
            return;
        }
        list.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-3 py-2">${item.projectId}</td>
                <td class="px-3 py-2">${item.descricao || ''}</td>
                <td class="px-3 py-2">${item.cliente || ''}</td>
                <td class="px-3 py-2">${item.departamento || ''}</td>
                <td class="px-3 py-2">${item.sbd || ''}</td>
                <td class="px-3 py-2">${item.projectType || ''}</td>
                <td class="px-3 py-2 text-center"><button onclick="app.removeCentroCusto(${item.id})" class="text-red-500 hover:text-red-700"><i class="fa-solid fa-trash"></i></button></td>
            `;
            tbody.appendChild(tr);
        });
    },

    addCentroCustoFromInputs() {
        const projectId = String(document.getElementById('cc-projectid').value || '').trim();
        if (!projectId) { this.showToast('Project ID é obrigatório.', true); return; }
        const item = {
            projectId,
            descricao: String(document.getElementById('cc-desc').value || '').trim(),
            cliente: String(document.getElementById('cc-cliente').value || '').trim(),
            departamento: String(document.getElementById('cc-depto').value || '').trim(),
            sbd: String(document.getElementById('cc-sbd').value || '').trim(),
            projectType: String(document.getElementById('cc-projtype').value || '').trim()
        };
        if (window.AbaCentrosCusto && typeof window.AbaCentrosCusto.addCentroCusto === 'function') {
            window.AbaCentrosCusto.addCentroCusto(this, item);
        } else {
            const newItem = Object.assign({ id: Date.now() + Math.random() }, item);
            this.centrosCusto = this.centrosCusto || [];
            this.centrosCusto.push(newItem);
            this.renderCentrosCusto();
        }
        // limpa inputs
        ['cc-projectid','cc-desc','cc-cliente','cc-depto','cc-sbd','cc-projtype'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
    },

    saveCentrosCusto() {
        if (window.AbaCentrosCusto && typeof window.AbaCentrosCusto.saveCentrosCusto === 'function') {
            return window.AbaCentrosCusto.saveCentrosCusto(this);
        }
        this.saveToStorage();
        this.showToast('Centros de Custo salvos.');
    },

    clearCentrosCusto() {
        if (window.AbaCentrosCusto && typeof window.AbaCentrosCusto.clearCentrosCusto === 'function') {
            return window.AbaCentrosCusto.clearCentrosCusto(this);
        }
        if (!confirm('Limpar todos os Centros de Custo?')) return;
        this.centrosCusto = [];
        this.saveToStorage();
        this.renderCentrosCusto();
        this.showToast('Centros de Custo limpos.');
    },

    removeCentroCusto(id) {
        if (window.AbaCentrosCusto && typeof window.AbaCentrosCusto.removeCentroCusto === 'function') {
            return window.AbaCentrosCusto.removeCentroCusto(this, id);
        }
        this.centrosCusto = (this.centrosCusto || []).filter(c => c.id !== id);
        this.saveToStorage();
        this.renderCentrosCusto();
    },

    findCentroByProjectId(pid) {
        if (window.AbaCentrosCusto && typeof window.AbaCentrosCusto.findCentroByProjectId === 'function') {
            return window.AbaCentrosCusto.findCentroByProjectId(this, pid);
        }
        if (!pid) return null;
        const list = this.centrosCusto || [];
        const str = String(pid).trim();
        return list.find(c => String(c.projectId).trim() === str) || null;
    },

    // Procura em uma linha de import qualquer célula que corresponda a um Project ID cadastrado
    matchCentroInRow(row) {
        if (window.AbaCentrosCusto && typeof window.AbaCentrosCusto.matchCentroInRow === 'function') {
            return window.AbaCentrosCusto.matchCentroInRow(this, row);
        }
        if (!row || !Array.isArray(row)) return null;
        const list = this.centrosCusto || [];
        if (!list.length) return null;
        for (let i = 0; i < row.length; i++) {
            const val = String(row[i] || '').trim();
            if (!val) continue;
            const found = list.find(c => String(c.projectId).trim() === val);
            if (found) return found;
        }
        return null;
    },

    // ----------------- Persistência atualizada (Electron-friendly) -----------------
    saveToStorage() {
        // Cria o estado que queremos persistir
        const state = {
            data: this.data,
            planoContas: this.planoContas,
            balanceData: this.balanceData,
            locks: this.locks,
            mgmtFees: this.mgmtFees,
            centrosCusto: this.centrosCusto,
            mgmtDetailData: this.mgmtDetailData,
            ocraConfig: this.ocraConfig,
            exemptCCs: this.exemptCCs,
            keyRatiosData: this.keyRatiosData,
            keyRatiosBudgetData: this.keyRatiosBudgetData || [],
            budgetRevenueAccounts: this.budgetRevenueAccounts || [],
            budgetExcludedFromRevenue: this.budgetExcludedFromRevenue || []
        };

        // Se estivermos em Electron com a API exposta, salve no disco (userData)
        if (window && window.electron && typeof window.electron.saveJSON === 'function') {
            // fire-and-forget async save; não aguardamos para não bloquear a UI
            window.electron.saveJSON('fin-system/db.json', state).then(res => {
                if (!res || !res.ok) {
                    console.warn('saveToStorage (electron) failed:', res && res.error);
                    // fallback para localStorage se quiser (não obrigatório)
                    try {
                        localStorage.setItem('finSystem_data', JSON.stringify(state));
                    } catch (e) {
                        console.error('Fallback localStorage save failed', e);
                    }
                }
            }).catch(err => {
                console.error('saveToStorage error:', err);
                try {
                    localStorage.setItem('finSystem_data', JSON.stringify(state));
                } catch (e) {
                    console.error('Fallback localStorage save failed', e);
                }
            });
        } else {
            // Fallback: localStorage (limite ~5MB). Use IndexedDB para volumes maiores no browser.
            try {
                localStorage.setItem('finSystem_data', JSON.stringify(state));
            } catch (e) {
                console.error('localStorage save failed (likely quota).', e);
            }
        }
    },

    async loadFromStorage() {
        // Prioridade: Electron disk -> localStorage
        if (window && window.electron && typeof window.electron.readJSON === 'function') {
            try {
                const res = await window.electron.readJSON('fin-system/db.json');
                if (res && res.ok && res.json) {
                    const o = res.json;
                    this.data = o.data || [];
                    this.planoContas = o.planoContas || [];
                    this.balanceData = o.balanceData || [];
                    this.locks = o.locks || [];
                    this.mgmtFees = o.mgmtFees || [];
                    this.mgmtDetailData = o.mgmtDetailData || {};
                    this.keyRatiosBudgetData = o.keyRatiosBudgetData || [];
                    this.budgetRevenueAccounts = o.budgetRevenueAccounts || [];
                    this.budgetExcludedFromRevenue = o.budgetExcludedFromRevenue || [];
                    this.admRevenueAllowedAccounts = o.admRevenueAllowedAccounts || this.admRevenueAllowedAccounts || [];
                    this.ocraConfig = o.ocraConfig || {};
                    this.exemptCCs = o.exemptCCs || [];
                    this.keyRatiosData = o.keyRatiosData || [];
                    this.centrosCusto = o.centrosCusto || [];
                    this.keyRatiosBudgetData = o.keyRatiosBudgetData || [];
                    this.savedImportedFiles = o.savedImportedFiles || [];
                    return;
                } else {
                    // if file missing or error, fall back to localStorage
                    console.warn('readJSON returned not-ok or no-json, falling back to localStorage', res && res.error);
                }
            } catch (err) {
                console.warn('readJSON failed, falling back to localStorage', err);
            }
        }

        // Fallback: localStorage (may be truncated or absent)
        try {
            const stored = localStorage.getItem('finSystem_data');
            if (stored) {
                const o = JSON.parse(stored);
                // Stored structure in fallback mode might be either whole state or individual keys.
                if (o && (o.data || o.locks || o.mgmtFees || o.exemptCCs || o.keyRatiosData || o.planoContas || o.balanceData)) {
                    this.data = o.data || [];
                    this.planoContas = o.planoContas || [];
                    this.balanceData = o.balanceData || [];
                    this.locks = o.locks || [];
                    this.mgmtFees = o.mgmtFees || [];
                    this.mgmtDetailData = o.mgmtDetailData || {};
                    this.budgetRevenueAccounts = o.budgetRevenueAccounts || [];
                    this.budgetExcludedFromRevenue = o.budgetExcludedFromRevenue || [];
                    this.admRevenueAllowedAccounts = o.admRevenueAllowedAccounts || this.admRevenueAllowedAccounts || [];
                    this.ocraConfig = o.ocraConfig || {};
                    this.exemptCCs = o.exemptCCs || [];
                    this.keyRatiosData = o.keyRatiosData || [];
                    this.centrosCusto = o.centrosCusto || [];
                    this.savedImportedFiles = o.savedImportedFiles || [];
                } else {
                    // Older format (individual keys)
                    const storedData = localStorage.getItem('finSystem_data');
                    if (storedData) this.data = JSON.parse(storedData);
                    const storedPlanoContas = localStorage.getItem('finSystem_planoContas');
                    if (storedPlanoContas) this.planoContas = JSON.parse(storedPlanoContas);
                    const storedLocks = localStorage.getItem('finSystem_locks');
                    if (storedLocks) this.locks = JSON.parse(storedLocks);
                    const storedMgmt = localStorage.getItem('finSystem_mgmtFees');
                    if (storedMgmt) this.mgmtFees = JSON.parse(storedMgmt);
                    const storedExempts = localStorage.getItem('finSystem_exemptCCs');
                    if (storedExempts) this.exemptCCs = JSON.parse(storedExempts);
                    const storedRatios = localStorage.getItem('finSystem_keyRatiosData');
                    if (storedRatios) this.keyRatiosData = JSON.parse(storedRatios);
                    const storedRatiosBudget = localStorage.getItem('finSystem_keyRatiosBudgetData');
                    if (storedRatiosBudget) this.keyRatiosBudgetData = JSON.parse(storedRatiosBudget);
                    const storedFiles = localStorage.getItem('finSystem_savedFiles');
                    if (storedFiles) this.savedImportedFiles = JSON.parse(storedFiles);
                }
            } else {
                // Try legacy individual keys
                const storedData = localStorage.getItem('finSystem_data');
                if (storedData) this.data = JSON.parse(storedData);
                const storedPlanoContas = localStorage.getItem('finSystem_planoContas');
                if (storedPlanoContas) this.planoContas = JSON.parse(storedPlanoContas);
                const storedLocks = localStorage.getItem('finSystem_locks');
                if (storedLocks) this.locks = JSON.parse(storedLocks);
                const storedMgmt = localStorage.getItem('finSystem_mgmtFees');
                if (storedMgmt) this.mgmtFees = JSON.parse(storedMgmt);
                const storedExempts = localStorage.getItem('finSystem_exemptCCs');
                if (storedExempts) this.exemptCCs = JSON.parse(storedExempts);
                const storedRatios = localStorage.getItem('finSystem_keyRatiosData');
                if (storedRatios) this.keyRatiosData = JSON.parse(storedRatios);
                const storedRatiosBudget = localStorage.getItem('finSystem_keyRatiosBudgetData');
                if (storedRatiosBudget) this.keyRatiosBudgetData = JSON.parse(storedRatiosBudget);
            }
        } catch (e) {
            console.error('loadFromStorage fallback failed', e);
        }

        // Atualiza seção de imports salvos na UI (table + inline list)
        try { this.renderSavedImports(); this.renderSavedImportsInline(); } catch (e) { /* ignore */ }
    },

    // global saved imports dropdown removed — function intentionally deleted

    generateOcraReport() {
        // 1. Obter dados calculados do DRE Departamento
        
        const yearEl = document.getElementById('ocra-export-year');
        const monthEl = document.getElementById('ocra-export-month');
        
        if (!yearEl || !monthEl) {
            this.showToast("Erro: Filtros de exportação não encontrados.", true);
            return;
        }

        const selectedYear = parseInt(yearEl.value);
        const selectedMonth = parseInt(monthEl.value);
        // Alterado para 'ytd' conforme solicitação: "as contas de DRE estão vindo com valor do mês, elas devem vir valor acumulado até o mês selecionado"
        const selectedType = 'ytd'; 

        // Mapeia conta contábil -> OCRA (Movido para antes do filtro)
        const contabilToOcra = {};
        this.planoContas.forEach(p => {
            if (p.contaReduzida && p.contaOCRA) {
                contabilToOcra[String(p.contaReduzida).trim()] = String(p.contaOCRA).trim();
            }
        });

        // Filtra dados (Acumulado até o mês selecionado)
        let filteredData = this.data.filter(item => {
            if (!item.ano || !item.mes) return false;
            if (String(item.ano) !== String(selectedYear)) return false;
            const itemMonth = parseInt(item.mes);
            
            return itemMonth <= selectedMonth;
        });

        // Agrupa valores
        const valores = {};
        const deptosSet = new Set();
        // contabilToOcra já foi definido acima

        // --- Lógica de Management Fee (Simplificada para pegar do detalhe) ---
        // (Copiado da lógica atualizada do renderDREDepartamento)
        // ... (Lógica de distribuição de Mgmt Fee deve ser aplicada aqui também se quisermos precisão total)
        // Para simplificar, vamos assumir que filteredData já tem a maior parte, 
        // mas Mgmt Fee é calculado dinamicamente. Vamos replicar a parte essencial.
        
        // Recalcula contagem de consultores para rateio
        const consultantCounts = {};
        let totalConsultants = 0;
        const filteredKeyRatios = this.keyRatiosData.filter(item => {
            if (String(item.ano) !== String(selectedYear)) return false;
            const itemMonth = parseInt(item.mes);
            return selectedType === 'monthly' ? itemMonth === selectedMonth : itemMonth <= selectedMonth;
        });
        filteredKeyRatios.forEach(kr => {
            const depto = String(kr.departamento || '').trim();
            if (depto) {
                if (!consultantCounts[depto]) consultantCounts[depto] = 0;
                consultantCounts[depto] += 1; 
                totalConsultants += 1;
                deptosSet.add(depto);
            }
        });

        // Aplica Mgmt Fee Detalhado
        if (this.mgmtDetailData && this.mgmtDetailData[selectedYear] && totalConsultants > 0) {
            const detailData = this.mgmtDetailData[selectedYear];
            ['ocra', 'calc'].forEach(rowKey => {
                const rowData = detailData[rowKey];
                if (!rowData) return;
                let rowValue = 0;
                if (selectedType === 'monthly') {
                    rowValue = Number(rowData.values[selectedMonth]) || 0;
                } else {
                    for (let m = 1; m <= selectedMonth; m++) {
                        rowValue += Number(rowData.values[m]) || 0;
                    }
                }
                if (rowValue !== 0) {
                    if (rowData.debit) {
                        const acc = String(rowData.debit).trim();
                        if (!valores[acc]) valores[acc] = {};
                        Object.keys(consultantCounts).forEach(depto => {
                            const share = (consultantCounts[depto] / totalConsultants) * rowValue;
                            if (!valores[acc][depto]) valores[acc][depto] = 0;
                            valores[acc][depto] += share;
                        });
                    }
                    if (rowData.credit) {
                        const acc = String(rowData.credit).trim();
                        if (!valores[acc]) valores[acc] = {};
                        Object.keys(consultantCounts).forEach(depto => {
                            const share = (consultantCounts[depto] / totalConsultants) * rowValue * -1;
                            if (!valores[acc][depto]) valores[acc][depto] = 0;
                            valores[acc][depto] += share;
                        });
                    }
                }
            });
        }

        // Processa dados normais
        const dynamicTax = {}; 
        filteredData.forEach(item => {
            if (!item.conta || !item.departamento) return;
            const depto = String(item.departamento).trim();
            if (depto) deptosSet.add(depto);
            const contaOriginal = String(item.conta).trim();
            const contaNum = Number(item.conta);

            let ocra = item.contaOCRA ? String(item.contaOCRA).trim() : '';
            if (!ocra) ocra = contabilToOcra[contaOriginal] || contaOriginal;
            
            const valor = Number(item.valor) || 0;

            // Ignora 3204 importada para usar a calculada
            if (ocra === '3204' || contaNum === 3204) return;

            // Cálculo Dinâmico de Imposto (3204)
            if (contaNum === 1902) {
                 const ccToCheck = String(item.centroCusto || '').trim();
                 const isExempt = this.exemptCCs && this.exemptCCs.includes(ccToCheck);
                 if (!isExempt) {
                     const taxValue = valor * -0.0925;
                     if (!dynamicTax[depto]) dynamicTax[depto] = 0;
                     dynamicTax[depto] += taxValue;
                 }
            }

            if (!valores[ocra]) valores[ocra] = {};
            if (!valores[ocra][depto]) valores[ocra][depto] = 0;
            valores[ocra][depto] += valor;
        });

        // Adiciona imposto calculado aos valores
        Object.keys(dynamicTax).forEach(depto => {
            if (!valores['3204']) valores['3204'] = {};
            if (!valores['3204'][depto]) valores['3204'][depto] = 0;
            valores['3204'][depto] += dynamicTax[depto];
        });

        // Processa Balanço (BS/IT)
        // Balanço é sempre acumulado por natureza (saldo final), mas precisamos garantir que pegamos o saldo correto.
        // Se a importação do balanço já traz o saldo final do mês, basta filtrar pelo mês selecionado.
        // Se a importação traz movimentação, precisaríamos somar.
        // Assumindo que 'balanceData' contém o SALDO FINAL do mês importado.
        const filteredBalance = this.balanceData.filter(item => {
            if (!item.ano || !item.mes) return false;
            if (String(item.ano) !== String(selectedYear)) return false;
            const itemMonth = parseInt(item.mes);
            // Para Balanço (Saldos), pegamos o registro do mês selecionado.
            // Se não houver registro no mês, o saldo não é zero, é o último disponível?
            // Geralmente em sistemas de reporte mensal, exporta-se o saldo do mês de referência.
            return itemMonth === selectedMonth;
        });
        filteredBalance.forEach(item => {
            const ocra = String(item.contaOCRA || item.contaReduzida || '').trim();
            if (!ocra) return;
            if (!valores[ocra]) valores[ocra] = {};
            if (!valores[ocra]['BS/IT']) valores[ocra]['BS/IT'] = 0;
            valores[ocra]['BS/IT'] += Number(item.saldoFinal) || 0;
        });
        deptosSet.add('BS/IT');

        // Lista de departamentos final
        let departamentos = Array.from(deptosSet).sort();
        departamentos = departamentos.filter(d => d !== 'BS/IT' && d !== 'ADM');
        departamentos.unshift('BS/IT');
        if (deptosSet.has('ADM')) departamentos.push('ADM');

        // Gera lista para exportação
        let ocraConfigList = this.ocraConfig;
        if (!Array.isArray(ocraConfigList)) {
            if (ocraConfigList && ocraConfigList.companyNum) {
                ocraConfigList = [ocraConfigList];
            } else {
                ocraConfigList = [];
            }
        }

        const exportList = []; // Inicializa a lista de exportação

        departamentos.forEach(depto => {
            // Busca config do departamento
            const config = ocraConfigList.find(c => c.department === depto) || {};
            const companyNum = config.companyNum || '';
            const deptNum = config.deptNum || '';

            // Itera sobre todas as contas que têm valor para este departamento
            // Precisamos iterar sobre o LAYOUT do DRE para manter a ordem e incluir cálculos se necessário?
            // O pedido diz "Account - Conta Ocra da aba DRE Departamento".
            // Geralmente exportações OCRA são de contas contábeis, não totais calculados.
            // Mas se o usuário quer "Amount - Valor pela conta OCRA", vamos iterar pelas contas que temos valores.
            // Se precisarmos seguir estritamente as linhas do DRE (incluindo totais), seria diferente.
            // Assumindo contas contábeis (type: 'account') do layout.

            this.dreDeptLayout.forEach(row => {
                if (row.type === 'account') {
                    const ocra = String(row.code).trim();
                    let valor = 0;

                    // Lógica de valor (copiada do render)
                    if (depto === 'BS/IT') {
                        const firstDigit = ocra.charAt(0);
                        if (['3','4','5','6','7'].includes(firstDigit)) {
                            valor = 0; 
                        } else {
                            valor = (valores[ocra] && valores[ocra]['BS/IT']) ? valores[ocra]['BS/IT'] : 0;
                        }
                    } else {
                        // Lógica de imposto dinâmico (simplificada, pois dynamicTax é complexo de recalcular aqui sem duplicar tudo)
                        // Se for crítico, precisaria extrair a lógica de dynamicTax.
                        // Por enquanto, pegamos o valor bruto acumulado.
                        valor = (valores[ocra] && valores[ocra][depto]) ? valores[ocra][depto] : 0;
                    }

                    // Inversão de sinal (copiada do render)
                    // Nota: row.id === 'total_income' define invertValues=true para as próximas.
                    // Isso é complexo de rastrear aqui sem iterar sequencialmente.
                    // Vamos simplificar: contas de receita (3xxx) geralmente são crédito (-), despesa débito (+).
                    // No DRE visual, invertemos para mostrar Receita positivo.
                    // Na exportação OCRA, geralmente se espera o sinal contábil ou o sinal do DRE?
                    // "Amount - Valor pela conta OCRA da aba DRE Departamento" sugere o valor VISUALIZADO.
                    // Vamos tentar aplicar a inversão básica de Receita.
                    
                    // Melhor abordagem: Iterar o layout sequencialmente mantendo o estado 'invertValues'
                }
            });
        });

        // Refazendo a iteração com estado para garantir valores iguais ao DRE
        let invertValues = false;
        
        // Prepara dados para tabela e excel
        const tableBody = document.getElementById('ocra-report-body');
        tableBody.innerHTML = '';

        // Busca configuração do ADM para fallback de Company
        const admConfig = ocraConfigList.find(c => c.department === 'ADM') || {};
        const admCompanyNum = admConfig.companyNum || '';

        departamentos.forEach(depto => {
            const config = ocraConfigList.find(c => c.department === depto) || {};
            // Se não tiver companyNum definido para o departamento, usa o do ADM
            const companyNum = config.companyNum || admCompanyNum;
            const deptNum = config.deptNum || '';
            
            invertValues = false; // Reseta por departamento (embora o layout seja fixo)

            this.dreDeptLayout.forEach(row => {
                if (row.id === 'total_income') invertValues = true;

                if (row.type === 'account') {
                    const ocra = String(row.code).trim();
                    
                    // Lista de contas que compõem o Total Revenue
                    const revenueAccounts = ['3010', '3556', '3557', '3015', '3095', '3019', '3018', '3030', '3204'];

                    // Se for uma das contas de receita (exceto a 3010), não exporta individualmente, pois será somada na 3010
                    if (revenueAccounts.includes(ocra) && ocra !== '3010') return;

                    let valor = 0;

                    // Lógica especial para 8820 e 8821 na exportação: Agrega tudo no BS/IT e zera nos outros
                    if (['8820', '8821'].includes(ocra)) {
                        if (depto === 'BS/IT') {
                             valor = (valores[ocra]) ? Object.values(valores[ocra]).reduce((a, b) => a + (Number(b)||0), 0) : 0;
                        } else {
                             valor = 0;
                        }
                    } else if (depto === 'BS/IT') {
                        const firstDigit = ocra.charAt(0);
                        if (['3','4','5','6','7'].includes(firstDigit)) {
                            valor = 0; 
                        } else {
                            valor = (valores[ocra] && valores[ocra]['BS/IT']) ? valores[ocra]['BS/IT'] : 0;
                        }
                    } else {
                        // TODO: Dynamic Tax (3204) logic se necessário
                        valor = (valores[ocra] && valores[ocra][depto]) ? valores[ocra][depto] : 0;

                        // Solicitação: Para contas com departamento (não BS/IT), não colocar contas abaixo de EBIT (8xxx, 9xxx)
                        const firstDigit = ocra.charAt(0);
                        if (['8', '9'].includes(firstDigit)) {
                            valor = 0;
                        }
                    }

                    // Se for a conta 3010, soma TODAS as contas de receita (Total Revenue)
                    if (ocra === '3010') {
                        // Ignora 3010 no departamento ADM
                        if (depto === 'ADM') return;

                        let totalRevenue = 0;
                        revenueAccounts.forEach(acc => {
                            let valAcc = 0;
                            if (depto === 'BS/IT') {
                                // Receitas (3xxx) são zeradas no BS/IT pela regra acima
                                valAcc = 0;
                            } else {
                                valAcc = (valores[acc] && valores[acc][depto]) ? valores[acc][depto] : 0;
                            }
                            totalRevenue += valAcc;
                        });
                        // Substitui o valor da 3010 pelo total calculado
                        valor = totalRevenue;
                    }

                    // Lógica de Sinal para Exportação OCRA
                    const firstDigit = ocra.charAt(0);
                    
                    if (firstDigit === '1') {
                        // Ativo: Multiplicar por +1 (Manter sinal original, geralmente Débito/Positivo)
                        valor = valor * 1;
                    } else if (firstDigit === '2') {
                        // Passivo: Multiplicar por -1 (Inverter sinal, geralmente Crédito/Negativo -> Positivo)
                        valor = valor * -1;
                    } else if (['3'].includes(firstDigit)) {
                        // Receita (3xxx): Inverter sinal (DRE Positivo -> Export Negativo)
                        valor = valor * -1;
                    } else if (['4', '5', '6', '7'].includes(firstDigit)) {
                        // Despesa até EBIT (4-7xxx): Manter positivo (DRE Negativo -> Export Positivo)
                        valor = valor * 1;
                    } else {
                        // P&L (8xxx) - Mantém lógica visual do DRE (Abaixo do EBIT)
                        if (invertValues) {
                            const isFinancialIncome = ['8010', '8022', '8300', '8360', '8331', '8390'].includes(ocra);
                            const isSpecialInversion = ['8400', '8414', '8460', '8436', '8490', '8910', '8935', '8940', '8980'].includes(ocra);
                            const isTaxInversion = ['8820', '8821'].includes(ocra);

                            if (!isFinancialIncome && !isSpecialInversion && !isTaxInversion) valor = valor * -1;
                        }
                    }

                    if (valor !== 0) {
                        exportList.push({
                            Company: companyNum,
                            Departamento: deptNum,
                            Account: ocra,
                            Amount: valor
                        });

                        // Adiciona à tabela (limitado a 100 linhas para preview)
                        if (exportList.length <= 100) {
                            const tr = document.createElement('tr');
                            tr.innerHTML = `
                                <td class="px-3 py-2">${companyNum}</td>
                                <td class="px-3 py-2">${deptNum}</td>
                                <td class="px-3 py-2">${ocra}</td>
                                <td class="px-3 py-2 text-right">${valor.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                            `;
                            tableBody.appendChild(tr);
                        }
                    }
                }
            });
        });

        if (exportList.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" class="px-3 py-4 text-center text-gray-500">Nenhum dado encontrado para os filtros selecionados.</td></tr>';
            return;
        }

        // Exporta Excel
        const ws = XLSX.utils.json_to_sheet(exportList);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "OCRA Report");
        XLSX.writeFile(wb, `OCRA_Report_${selectedYear}_${selectedMonth}.xlsx`);
        
        this.showToast(`Relatório gerado com ${exportList.length} linhas.`);
    },

    // ----------------- o restante das funções auxiliares (backup/restore/toast/etc.) -----------------
    exportCurrentData() {
        const year = parseInt(document.getElementById('dre-year-select').value);
        
        const getFilterValue = (id) => {
            const val = document.getElementById(id).value.trim();
            return val === 'Todos...' ? '' : val;
        };

        const filterCC = getFilterValue('dre-filter-cc');
        const filterDept = getFilterValue('dre-filter-dept');
        const filterCli = getFilterValue('dre-filter-client');
        const filterSBD = getFilterValue('dre-filter-sbd');
        const filterProj = getFilterValue('dre-filter-proj');

        const dreType = (document.getElementById('dre-type-select') && document.getElementById('dre-type-select').value) ? document.getElementById('dre-type-select').value : 'Actual';

        // Mapeamento Conta -> Conta Budget
        const contaToBudget = {};
        if (this.planoContas) {
            this.planoContas.forEach(pc => {
                const red = String(pc.contaReduzida || '').trim();
                const bud = String(pc.contaBudget || '').trim();
                if (red && bud) {
                    contaToBudget[red] = bud;
                }
            });
        }

        const exportData = [
            ["Conta Budget", "Valor", "Cliente", "Departamento", "SB/D", "Project type", "Centro de custo", "Mês", "Ano"]
        ];

        this.data.forEach(item => {
            // Control by DRE type selection
            if (dreType === 'Actual') {
                if (item.tipo === 'Budget') return;
            } else if (dreType === 'Budget') {
                if (item.tipo !== 'Budget') return;
            } // Both -> include all types

            if (String(item.departamento).trim() === 'ADM' && (item.conta == 3190 || item.conta == 3204)) return;
            if (parseInt(item.ano) !== year) return;
            
            if (filterCC && String(item.centroCusto) !== filterCC) return;
            if (filterDept && String(item.departamento) !== filterDept) return;
            if (filterCli && String(item.cliente) !== filterCli) return;
            if (filterSBD && String(item.sbd) !== filterSBD) return;
            if (filterProj && String(item.projectType) !== filterProj) return;

            // Ignora 3204 original para usar a calculada
            if (Number(item.conta) === 3204) return;

            // Resolve Conta Budget
            let contaExport = String(item.conta).trim();
            if (contaToBudget[contaExport]) {
                contaExport = contaToBudget[contaExport];
            }

            // Add to export
            exportData.push([
                contaExport,
                item.valor,
                item.cliente,
                item.departamento,
                item.sbd,
                item.projectType,
                item.centroCusto,
                item.mes,
                item.ano
            ]);

            // Lógica de Imposto Dinâmico (3204) baseada na 1902
            if (Number(item.conta) === 1902 && item.tipo === 'Receita') {
                 const ccToCheck = String(item.centroCusto).trim();
                 const isExempt = this.exemptCCs && this.exemptCCs.includes(ccToCheck);
                 
                 if (!isExempt) {
                     const taxValue = Number(item.valor) * -0.0925;
                     
                     let contaTax = '3204';
                     if (contaToBudget[contaTax]) {
                         contaTax = contaToBudget[contaTax];
                     }

                     exportData.push([
                        contaTax, // Conta Imposto (ou Budget correspondente)
                        taxValue,
                        item.cliente,
                        item.departamento,
                        item.sbd,
                        item.projectType,
                        item.centroCusto,
                        item.mes,
                        item.ano
                    ]);
                 }
            }
        });

        // --- Export Key Ratios (7004, 7002, 7001) ---
        if (this.keyRatiosData && this.keyRatiosData.length > 0) {
            // 1. Calcula totais de horas por pessoa/mês (Contexto Global para fração correta de FTE)
            const personMonthHours = {};
            this.keyRatiosData.forEach(item => {
                if (parseInt(item.ano) !== year) return;
                const key = `${item.name}|${item.mes}`;
                if (!personMonthHours[key]) personMonthHours[key] = 0;
                personMonthHours[key] += Number(item.hours) || 0;
            });

            // 2. Processa itens filtrados
            this.keyRatiosData.forEach(item => {
                if (parseInt(item.ano) !== year) return;

                // Aplica filtros
                if (filterCC && String(item.centroCusto) !== filterCC) return;
                if (filterDept && String(item.departamento) !== filterDept) return;
                if (filterCli && String(item.cliente) !== filterCli) return;
                if (filterSBD && String(item.sbd) !== filterSBD) return;
                if (filterProj && String(item.projectType) !== filterProj) return;

                const hours = Number(item.hours) || 0;
                if (hours === 0) return;

                // Conta 7004: Horas Trabalhadas
                exportData.push([
                    '7004',
                    hours,
                    item.cliente,
                    item.departamento,
                    item.sbd,
                    item.projectType,
                    item.centroCusto,
                    item.mes,
                    item.ano
                ]);

                // Conta 7001/7002: Headcount (Fração FTE baseada nas horas)
                const key = `${item.name}|${item.mes}`;
                const totalH = personMonthHours[key];
                const fraction = (totalH > 0) ? (hours / totalH) : 0;

                const isADM = String(item.departamento).toUpperCase().trim() === 'ADM';
                const hcAccount = isADM ? '7002' : '7001';

                exportData.push([
                    hcAccount,
                    fraction,
                    item.cliente,
                    item.departamento,
                    item.sbd,
                    item.projectType,
                    item.centroCusto,
                    item.mes,
                    item.ano
                ]);
            });
        }

        if (exportData.length <= 1) {
            this.showToast("Nenhum dado encontrado para exportar com os filtros atuais.", true);
            return;
        }

        const ws = XLSX.utils.aoa_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Dados Exportados");
        XLSX.writeFile(wb, "Dados_DRE_Mensal.xlsx");
    },

    backupData() {
        // Reutiliza a mesma estrutura de `saveToStorage()` para garantir consistência
        const state = {
            data: this.data,
            planoContas: this.planoContas,
            balanceData: this.balanceData,
            locks: this.locks,
            mgmtFees: this.mgmtFees,
            mgmtDetailData: this.mgmtDetailData,
            ocraConfig: this.ocraConfig,
            exemptCCs: this.exemptCCs,
            keyRatiosData: this.keyRatiosData,
            keyRatiosBudgetData: this.keyRatiosBudgetData || [],
            budgetRevenueAccounts: this.budgetRevenueAccounts || [],
            budgetExcludedFromRevenue: this.budgetExcludedFromRevenue || [],
            admRevenueAllowedAccounts: this.admRevenueAllowedAccounts || []
        };

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
        const dl = document.createElement('a');
        dl.setAttribute("href", dataStr);
        dl.setAttribute("download", "backup_financeiro.json");
        dl.click();
    },
    restoreData(input) {
        const f = input.files[0];
        if(!f) return;
        const r = new FileReader();
        r.onload = (e) => {
            const o = JSON.parse(e.target.result);
            if(o && (o.data || o.locks || o.planoContas)) {
                this.data = o.data || [];
                this.planoContas = o.planoContas || [];
                this.balanceData = o.balanceData || [];
                this.locks = o.locks || [];
                this.mgmtFees = o.mgmtFees || [];
                this.mgmtDetailData = o.mgmtDetailData || {};
                this.ocraConfig = o.ocraConfig || [];
                this.exemptCCs = o.exemptCCs || [];
                this.keyRatiosData = o.keyRatiosData || [];
                this.keyRatiosBudgetData = o.keyRatiosBudgetData || [];
                this.budgetRevenueAccounts = o.budgetRevenueAccounts || [];
                this.budgetExcludedFromRevenue = o.budgetExcludedFromRevenue || [];
                this.admRevenueAllowedAccounts = o.admRevenueAllowedAccounts || this.admRevenueAllowedAccounts || [];
                this.saveToStorage(); this.init();
                this.showToast("Backup restaurado!");
            }
        };
        r.readAsText(f);
    },
    showToast(msg, isError = false) {
        const t = document.getElementById('toast');
        document.getElementById('toast-msg').innerText = msg;
        t.className = `fixed bottom-4 right-4 px-6 py-3 rounded shadow-lg text-white transition-transform duration-300 z-50 ${isError ? 'bg-red-600' : 'bg-gray-800'}`;
        t.classList.remove('translate-y-20');
        setTimeout(() => t.classList.add('translate-y-20'), 3000);
    },

    toggleFullScreen() {
        const mainNav = document.getElementById('main-navbar');
        const secNav = document.getElementById('secondary-navbar');
        
        // Alterna classe no body para controle via CSS
        document.body.classList.toggle('fullscreen-mode');
        const isFullscreen = document.body.classList.contains('fullscreen-mode');
        
        if (mainNav && secNav) {
            if (isFullscreen) {
                // Expandir (Modo Foco)
                mainNav.classList.add('hidden');
                secNav.classList.add('hidden');
            } else {
                // Restaurar
                mainNav.classList.remove('hidden');
                secNav.classList.remove('hidden');
            }
        }
    }
};

window.onload = async () => {
  try {
    await app.init();
  } catch (err) {
    console.error('app.init failed', err);
  }
};

// Torna o objeto disponível no escopo global para os handlers inline (onclick=...)
window.app = app;

// Processa chamadas enfileiradas criadas pelo stub inicial no HTML (se houver)
try {
    if (window.app && Array.isArray(window.app._queuedCalls) && window.app._queuedCalls.length) {
        const q = window.app._queuedCalls.slice();
        window.app._queuedCalls = [];
        q.forEach(call => {
            try {
                if (typeof app[call.fn] === 'function') {
                    app[call.fn].apply(app, call.args || []);
                }
            } catch (err) {
                console.error('Erro ao processar chamada enfileirada', call, err);
            }
        });
    }
} catch (err) {
    console.error('Falha ao processar _queuedCalls', err);
}

// Wrappers: delegam renderização para módulos de aba quando disponíveis
app.renderDRE = function() {
    try {
        const getFilterValue = (id) => {
            const el = document.getElementById(id);
            if (!el) return '';
            const val = String(el.value || '').trim();
            return val === 'Todos...' ? '' : val;
        };
        const year = parseInt(document.getElementById('dre-year-select') ? document.getElementById('dre-year-select').value : (new Date().getFullYear()));
        const ctx = {
            year,
            filtros: {
                cc: getFilterValue('dre-filter-cc'),
                dept: getFilterValue('dre-filter-dept'),
                client: getFilterValue('dre-filter-client'),
                sbd: getFilterValue('dre-filter-sbd'),
                proj: getFilterValue('dre-filter-proj')
            },
            data: this.data || [],
            keyRatiosData: this.keyRatiosData || [],
            exemptCCs: this.exemptCCs || [],
            isAdmAllocationEnabled: this.isAdmAllocationEnabled,
            posEbitdaAccounts: this.posEbitdaAccounts || [],
            custoAccounts: this.custoAccounts || [],
            depreciacaoAccounts: this.depreciacaoAccounts || [],
            pessoalAccounts: this.pessoalAccounts || [],
            aluguelAccounts: this.aluguelAccounts || [],
            viagensAccounts: this.viagensAccounts || [],
            diversasAccounts: this.diversasAccounts || [],
            servicosProfissionaisAccounts: this.servicosProfissionaisAccounts || [],
            taxasAccounts: this.taxasAccounts || [],
            outrasAdmAccounts: this.outrasAdmAccounts || [],
            deductionAccounts: this.deductionAccounts || [],
            budgetRevenueAccounts: this.budgetRevenueAccounts || [],
            budgetExcludedFromRevenue: this.budgetExcludedFromRevenue || [],
            normalizeAccountDigits: this.normalizeAccountDigits ? this.normalizeAccountDigits.bind(this) : null,
            getAdmAllocationForMonth: this.getAdmAllocationForMonth ? this.getAdmAllocationForMonth.bind(this) : null,
            getMgmtFeeAllocationForMonth: this.getMgmtFeeAllocationForMonth ? this.getMgmtFeeAllocationForMonth.bind(this) : null,
            calculateKeyRatiosMonthly: this.calculateKeyRatiosMonthly ? this.calculateKeyRatiosMonthly.bind(this) : null,
            getLastMonthHeads: this.getLastMonthHeads ? this.getLastMonthHeads.bind(this) : null
        };
        if (window.AbaDre && typeof window.AbaDre.render === 'function') {
            window.AbaDre.render('view-dre', ctx);
        } else {
            console.warn('AbaDre não encontrada; mantendo implementação interna.');
        }
    } catch (e) {
        console.error('Erro wrapper renderDRE', e);
        try { this.showToast('Erro ao renderizar DRE', true); } catch(_){}
    }
};

app.renderMarginAnalysis = function() {
    try {
        const getFilterValue = (id) => {
            const el = document.getElementById(id);
            if (!el) return '';
            const val = String(el.value || '').trim();
            return val === 'Todos...' ? '' : val;
        };
        const year = parseInt(document.getElementById('margin-year-select') ? document.getElementById('margin-year-select').value : (new Date().getFullYear()));
        const groupBy = document.getElementById('margin-group-by') ? document.getElementById('margin-group-by').value : 'cliente';
        const periodType = document.getElementById('margin-period-type') ? document.getElementById('margin-period-type').value : 'ytd';
        const monthSelected = parseInt(document.getElementById('margin-month-select') ? document.getElementById('margin-month-select').value : (new Date().getMonth()+1)) || (new Date().getMonth()+1);

        const ctx = {
            year,
            filtros: {
                cc: getFilterValue('margin-filter-cc'),
                dept: getFilterValue('margin-filter-dept'),
                client: getFilterValue('margin-filter-client'),
                sbd: getFilterValue('margin-filter-sbd'),
                proj: getFilterValue('margin-filter-proj'),
                groupBy: groupBy,
                periodType: periodType,
                monthSelected: monthSelected
            },
            data: this.data || [],
            keyRatiosData: this.keyRatiosData || [],
            isAdmAllocationEnabled: this.isAdmAllocationEnabled,
            custoAccounts: this.custoAccounts || [],
            viagensAccounts: this.viagensAccounts || [],
            pessoalAccounts: this.pessoalAccounts || [],
            aluguelAccounts: this.aluguelAccounts || [],
            servicosProfissionaisAccounts: this.servicosProfissionaisAccounts || [],
            taxasAccounts: this.taxasAccounts || [],
            diversasAccounts: this.diversasAccounts || [],
            outrasAdmAccounts: this.outrasAdmAccounts || [],
            depreciacaoAccounts: this.depreciacaoAccounts || [],
            posEbitdaAccounts: this.posEbitdaAccounts || [],
            managementFeeAccounts: this.managementFeeAccounts || [],
            deductionAccounts: this.deductionAccounts || [],
            exemptCCs: this.exemptCCs || [],
            marginExclusionFilter: this.marginExclusionFilter || [],
            isAdmRevenueAllowed: this.isAdmRevenueAllowed ? this.isAdmRevenueAllowed.bind(this) : (()=>false),
            budgetRevenueAccounts: this.budgetRevenueAccounts || [],
            budgetExcludedFromRevenue: this.budgetExcludedFromRevenue || [],
            normalizeAccountDigits: this.normalizeAccountDigits ? this.normalizeAccountDigits.bind(this) : null,
            getAdmAllocationForMonth: this.getAdmAllocationForMonth ? this.getAdmAllocationForMonth.bind(this) : null,
            getMgmtFeeAllocationForMonth: this.getMgmtFeeAllocationForMonth ? this.getMgmtFeeAllocationForMonth.bind(this) : null,
            calculateKeyRatiosMonthly: this.calculateKeyRatiosMonthly ? this.calculateKeyRatiosMonthly.bind(this) : null,
            getLastMonthHeads: this.getLastMonthHeads ? this.getLastMonthHeads.bind(this) : null
        };

        if (window.AbaMarginAnalysis && typeof window.AbaMarginAnalysis.render === 'function') {
            window.AbaMarginAnalysis.render('view-margin-analysis', ctx);
        } else {
            console.warn('AbaMarginAnalysis não encontrada; mantendo implementação interna.');
        }
    } catch (e) {
        console.error('Erro wrapper renderMarginAnalysis', e);
        try { this.showToast('Erro ao renderizar análise de margem', true); } catch(_){}
    }
};

    // Delegadores para ações da aba Margem — chamam o módulo se disponível
    app.toggleMarginExclusion = function(year, groupByField, groupKeyValue) {
        if (window.AbaMarginAnalysis && typeof window.AbaMarginAnalysis.toggleMarginExclusion === 'function') {
            return window.AbaMarginAnalysis.toggleMarginExclusion(year, groupByField, groupKeyValue);
        }
        console.warn('toggleMarginExclusion: AbaMarginAnalysis.toggleMarginExclusion não encontrada.');
    };

    app.clearMarginExclusions = function() {
        if (window.AbaMarginAnalysis && typeof window.AbaMarginAnalysis.clearMarginExclusions === 'function') {
            return window.AbaMarginAnalysis.clearMarginExclusions();
        }
        console.warn('clearMarginExclusions: AbaMarginAnalysis.clearMarginExclusions não encontrada.');
    };

// Função para ratear ADM para OCRA 6437 por Heads Consultants
app.rateioADM6437 = function() {
    // Operar sobre os dados em memória (this.data) com comportamento ON/OFF
    const yearEl = document.getElementById('dre-dept-year');
    const monthEl = document.getElementById('dre-dept-month');
    const typeEl = document.getElementById('dre-dept-type');
    const btn = document.getElementById('btn-rateio-adm-6437');
    if (!yearEl || !monthEl || !typeEl) {
        alert('Filtros de ano/mês/tipo não encontrados na página.');
        return;
    }
    const selectedYear = String(yearEl.value);
    const selectedMonth = parseInt(monthEl.value);
    const selectedType = typeEl.value;

    // Verifica se já existe rateio sintético para este período
    const exists = (this.data || []).some(it => it.syntheticRateio6437 && String(it.ano) === selectedYear && Number(it.mes) === selectedMonth);
    if (exists) {
        // Desfazer: remove lançamentos sintéticos deste período
        this.data = (this.data || []).filter(it => !(it.syntheticRateio6437 && String(it.ano) === selectedYear && Number(it.mes) === selectedMonth));
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-users-gear"></i> Rateio ADM 6437: OFF';
            btn.classList.remove('bg-green-600', 'hover:bg-green-700');
            btn.classList.add('bg-purple-700', 'hover:bg-purple-800');
        }
        this.showToast('Rateio ADM (6437) removido para o período selecionado.');
        this.renderDREDepartamento();
        return;
    }

    // Caso não exista, aplica o rateio
    // Mapeia plano de contas para OCRA
    const contabilToOcra = {};
    (this.planoContas || []).forEach(pc => {
        const red = String(pc.contaReduzida || '').trim();
        const ocra = String(pc.contaOCRA || '').trim();
        if (red && ocra) contabilToOcra[red] = ocra;
    });

    // Reconstrói o objeto 'valores' como em renderDREDepartamento
    const valores = {};
    const filtered = (this.data || []).filter(item => {
        if (!item.ano || !item.mes) return false;
        if (String(item.ano) !== selectedYear) return false;
        const itemMonth = parseInt(item.mes);
        // Determina OCRA
        const contaOriginal = String(item.conta || '').trim();
        let ocra = item.contaOCRA ? String(item.contaOCRA).trim() : '';
        if (!ocra) ocra = contabilToOcra[contaOriginal] || contaOriginal;
        const firstDigit = ocra.charAt(0);
        const isBalanceSheet = ['1','2'].includes(firstDigit);
        if (selectedType === 'monthly') return itemMonth === selectedMonth;
        else return isBalanceSheet ? (itemMonth === selectedMonth) : (itemMonth <= selectedMonth);
    });

    filtered.forEach(item => {
        const contaOriginal = String(item.conta || '').trim();
        let ocra = item.contaOCRA ? String(item.contaOCRA).trim() : '';
        if (!ocra) ocra = contabilToOcra[contaOriginal] || contaOriginal;
        const depto = String(item.departamento || '').trim() || 'ADM';
        const valor = Number(item.valor) || 0;
        if (!valores[ocra]) valores[ocra] = {};
        if (!valores[ocra][depto]) valores[ocra][depto] = 0;
        valores[ocra][depto] += valor;
    });

    // Soma total da coluna ADM
    let totalADM = 0;
    Object.keys(valores).forEach(ocra => {
        if (valores[ocra] && (valores[ocra]['ADM'] || valores[ocra].ADM)) {
            totalADM += Number(valores[ocra]['ADM'] || valores[ocra].ADM) || 0;
        }
    });
    if (totalADM === 0) {
        alert('Não há valores na coluna ADM para ratear.');
        return;
    }

    // Calcula Heads Consultants (snapshot mensal)
    const headsSets = {};
    (this.keyRatiosData || []).forEach(kr => {
        if (!kr || String(kr.ano) !== selectedYear) return;
        const itemMonth = parseInt(kr.mes);
        if (itemMonth !== selectedMonth) return;
        const depto = String(kr.departamento || '').trim();
        const name = String(kr.name || '').trim();
        if (!depto || !name) return;
        if (depto.toUpperCase() === 'ADM') return;
        if (!headsSets[depto]) headsSets[depto] = new Set();
        headsSets[depto].add(name);
    });
    const heads = {};
    let totalHeads = 0;
    Object.keys(headsSets).forEach(d => { heads[d] = headsSets[d].size; totalHeads += heads[d]; });
    if (totalHeads === 0) {
        alert('Não há Heads Consultants cadastrados para este período.');
        return;
    }

    // Inserir lançamentos sintéticos na conta OCRA 6437
    const now = Date.now();
    // Lançamento positivo em ADM
    this.data.push({
        id: `${now}-rateio-6437-ADM`,
        tipo: 'Rateio',
        conta: '6437',
        contaOCRA: '6437',
        descricao: 'Rateio ADM para OCRA 6437 (positivo ADM)',
        valor: totalADM,
        centroCusto: '',
        departamento: 'ADM',
        cliente: '',
        sbd: '',
        projectType: '',
        mes: selectedMonth,
        ano: selectedYear,
        syntheticRateio6437: true
    });

    // Lançamentos negativos por departamento
    Object.keys(heads).forEach(depto => {
        const share = -1 * (totalADM * (heads[depto] / totalHeads));
        this.data.push({
            id: `${now}-rateio-6437-${depto}`,
            tipo: 'Rateio',
            conta: '6437',
            contaOCRA: '6437',
            descricao: `Rateio ADM 6437 - ${depto}`,
            valor: share,
            centroCusto: '',
            departamento: depto,
            cliente: '',
            sbd: '',
            projectType: '',
            mes: selectedMonth,
            ano: selectedYear,
            syntheticRateio6437: true
        });
    });

    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-users-gear"></i> Rateio ADM 6437: ON';
        btn.classList.remove('bg-purple-700', 'hover:bg-purple-800');
        btn.classList.add('bg-green-600', 'hover:bg-green-700');
    }
    // Atualiza visual
    this.showToast('Rateio ADM (6437) aplicado — verifique a aba DRE Departamento.');
    this.renderDREDepartamento();
};

// Exporta CSV com linhas de Budget sem mapeamento
app.exportUnmappedBudgetCSV = function() {
    const temp = this.tempData || [];
    const data = this.data || [];
    const combined = [...temp, ...data];

    const items = combined.filter(i => i && i._budgetOriginal && String(i._budgetOriginal).trim() && String(i.conta || '').trim() === String(i._budgetOriginal).trim());

    // Remover duplicados por id
    const unique = [];
    const seen = new Set();
    items.forEach(it => {
        const id = it.id || `${it._budgetOriginal}-${it.mes}-${it.ano}-${it.valor}`;
        if (!seen.has(id)) { seen.add(id); unique.push(it); }
    });

    if (unique.length === 0) {
        this.showToast('Nenhuma linha de Budget sem mapeamento encontrada.', true);
        return;
    }

    // Use ponto-e-vírgula como separador (Excel PT-BR) e adicione BOM UTF-8
    const sep = ';';
    const headers = ['budgetOriginal','conta','valor','centroCusto','departamento','mes','ano','id','descricao'];
    const rows = [headers.join(sep)];

    unique.forEach(i => {
        const values = [
            i._budgetOriginal || '',
            i.conta || '',
            i.valor || '',
            i.centroCusto || '',
            i.departamento || '',
            i.mes || '',
            i.ano || '',
            i.id || '',
            i.descricao || ''
        ].map(v => `"${String(v).replace(/"/g, '""')}"`);
        rows.push(values.join(sep));
    });

    // Prepend BOM so Excel recognizes UTF-8 and use CRLF line endings
    const csvBody = rows.join('\r\n');
    const csv = '\uFEFF' + csvBody;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budget_unmapped_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    this.showToast(`${unique.length} linhas de Budget sem mapeamento exportadas.`);
};

// Diagnóstico: verifica mapeamentos no Plano de Contas para uma conta (ex: '1899')
app.checkPlanoMapping = function(code) {
    const c = String(code || '').trim();
    if (!c) {
        this.showToast('Informe um código para verificar (ex: app.checkPlanoMapping("1899")).', true);
        return null;
    }

    const plano = this.planoContas || [];
    const byContaRed = plano.filter(p => String(p.contaReduzida || '').trim() === c);
    const byContaBudget = plano.filter(p => String(p.contaBudget || '').trim() === c);

    const tempBudgets = (this.tempData || []).filter(i => i._budgetOriginal && String(i._budgetOriginal).trim() === c);
    const savedBudgets = (this.data || []).filter(i => i.tipo === 'Budget' && i._budgetOriginal && String(i._budgetOriginal).trim() === c);

    const mappedInData = (this.data || []).filter(i => String(i.conta || '').trim() === c || String(i.contaOCRA || '').trim() === c);

    const summary = {
        code: c,
        plano_count_by_contaReduzida: byContaRed.length,
        plano_count_by_contaBudget: byContaBudget.length,
        temp_budget_rows: tempBudgets.length,
        saved_budget_rows: savedBudgets.length,
        mapped_in_data: mappedInData.length
    };

    // Log detalhado no console para inspeção
    console.group(`Plano Mapping Check: ${c}`);
    console.log('Summary:', summary);
    console.log('Plano (contaReduzida === code):', byContaRed);
    console.log('Plano (contaBudget === code):', byContaBudget);
    console.log('Temp Budget rows (_budgetOriginal === code):', tempBudgets.slice(0,50));
    console.log('Saved Budget rows (_budgetOriginal === code):', savedBudgets.slice(0,50));
    console.log('Data entries with conta/contaOCRA === code:', mappedInData.slice(0,50));
    console.groupEnd();

    // Feedback ao usuário
    const msg = `Plano: ${byContaRed.length} por contaReduzida, ${byContaBudget.length} por contaBudget.\n` +
                `Budget (preview): temp ${tempBudgets.length}, salvos ${savedBudgets.length}.\n` +
                `Entradas na base com conta/contaOCRA = ${mappedInData.length}. Cheque o console para detalhes.`;
    alert(msg);

    return summary;
};

// Wrappers de ação rápida para simplificar uso pelo usuário (botões na UI)
app.autoMapPreview = function() {
    try {
        if (!window.AbaImportBudget || typeof window.AbaImportBudget.autoMapBudgetUsingHeuristics !== 'function') {
            this.showToast('Módulo de AutoMap Budget não carregado.', true);
            return null;
        }
        const res = window.AbaImportBudget.autoMapBudgetUsingHeuristics(this, false);
        const msg = `Auto-map (preview): ${res.tempMapped || 0}/${res.tempTotal || 0} sugestões.`;
        this.showToast(msg);
        console.group('AutoMap Preview Examples');
        console.log(res.examples || []);
        console.groupEnd();
        return res;
    } catch (err) {
        console.error('autoMapPreview failed', err);
        this.showToast('Erro no Auto-map (preview). Veja console.', true);
        return null;
    }
};

app.autoMapApply = function() {
    try {
        if (!window.AbaImportBudget || typeof window.AbaImportBudget.autoMapBudgetUsingHeuristics !== 'function') {
            this.showToast('Módulo de AutoMap Budget não carregado.', true);
            return null;
        }
        if (!confirm('Executar auto-mapeamento e salvar alterações? Recomendado: faça backup antes. Deseja continuar?')) return null;
        // Fazer backup automático antes de aplicar
        this.backupData();
        const res = window.AbaImportBudget.autoMapBudgetUsingHeuristics(this, true);
        const msg = `Auto-map aplicado: ${res.savedMapped || 0}/${res.savedTotal || 0} itens.`;
        this.showToast(msg);
        console.group('AutoMap Apply Examples');
        console.log(res.examples || []);
        console.groupEnd();
        return res;
    } catch (err) {
        console.error('autoMapApply failed', err);
        this.showToast('Erro ao aplicar Auto-map. Veja console.', true);
        return null;
    }
};

app.backupDataAndNotify = function() {
    try {
        this.backupData();
        this.showToast('Backup baixado com sucesso.');
    } catch (err) {
        console.error('backupDataAndNotify failed', err);
        this.showToast('Erro ao gerar backup.', true);
    }
};

    // Scaling of preview values removed: import uses file values as-is.

// Gera sugestões de mapeamento (sem aplicar) e retorna lista de sugestões
app.generateAutoMapSuggestions = function() {
    const plano = this.planoContas || [];
    if (!plano.length) {
        this.showToast('Plano de Contas vazio. Importe antes.', true);
        return [];
    }

    const normalize = (s) => String(s || '').replace(/\D/g, '').replace(/^0+/, '');
    const tokens = (s) => String(s || '').toLowerCase().replace(/[\W_]+/g, ' ').split(/\s+/).filter(Boolean);

    const tryFindPc = (code, desc) => {
        const c = String(code || '').trim();
        if (!c && !desc) return null;
        let pc = plano.find(p => String(p.contaBudget || '').trim() === c);
        if (pc) return { pc, reason: 'exact_contaBudget' };
        const n1 = normalize(c);
        if (n1) {
            pc = plano.find(p => normalize(p.contaBudget) === n1 || normalize(p.contaReduzida) === n1);
            if (pc) return { pc, reason: 'numeric_normalize' };
        }
        if (c) {
            pc = plano.find(p => {
                const pb = String(p.contaBudget || '');
                return pb.endsWith(c) || pb.startsWith(c) || String(p.contaReduzida || '').endsWith(c) || String(p.contaReduzida || '').startsWith(c);
            });
            if (pc) return { pc, reason: 'partial_code' };
        }
        if (desc) {
            const dt = tokens(desc);
            if (dt.length) {
                let best = null; let bestScore = 0;
                plano.forEach(p => {
                    const pd = tokens(p.descricao || p.ocraDesc || '');
                    if (!pd.length) return;
                    const intersection = dt.filter(x => pd.includes(x));
                    const score = intersection.length / Math.max(pd.length, dt.length);
                    if (score > bestScore) { bestScore = score; best = p; }
                });
                if (best && bestScore >= 0.35) return { pc: best, reason: 'desc_similarity', score: bestScore };
            }
        }
        return null;
    };

    const combined = [].concat(this.tempData || [], (this.data || []).filter(i => i && i.tipo === 'Budget'));
    const suggestions = [];
    const seen = new Set();
    combined.forEach(item => {
        if (!item || !item._budgetOriginal) return;
        const key = `${item._budgetOriginal}::${item.mes || ''}::${item.ano || ''}`;
        if (seen.has(key)) return; seen.add(key);
        const code = String(item._budgetOriginal || '').trim();
        const desc = item.descricao || '';
        const found = tryFindPc(code, desc);
        suggestions.push({
            budgetOriginal: code,
            mes: item.mes || '',
            ano: item.ano || '',
            currentConta: item.conta || '',
            currentContaOCRA: item.contaOCRA || '',
            descricao: desc,
            suggestionContaReduzida: found && found.pc ? (found.pc.contaReduzida || '') : '',
            suggestionContaOCRA: found && found.pc ? (found.pc.contaOCRA || '') : '',
            reason: found ? (found.reason || '') : '',
            score: found && found.score ? found.score : null
        });
    });

    return suggestions;
};

// Exporta CSV com sugestões de auto-mapeamento (preview only)
app.exportAutoMapSuggestionsCSV = function() {
    const suggestions = this.generateAutoMapSuggestions();
    if (!suggestions || !suggestions.length) {
        this.showToast('Nenhuma sugestão gerada (verifique Plano de Contas e Budget).', true);
        return;
    }
    const sep = ';';
    const headers = ['budgetOriginal','mes','ano','currentConta','currentContaOCRA','descricao','suggestionContaReduzida','suggestionContaOCRA','reason','score'];
    const rows = [headers.join(sep)];
    suggestions.forEach(s => {
        const vals = [s.budgetOriginal,s.mes,s.ano,s.currentConta,s.currentContaOCRA,s.descricao,s.suggestionContaReduzida,s.suggestionContaOCRA,s.reason,(s.score||'')].map(v => `"${String(v||'').replace(/"/g,'""')}"`);
        rows.push(vals.join(sep));
    });
    const csv = '\uFEFF' + rows.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `auto_map_suggestions_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
    this.showToast(`${suggestions.length} sugestões exportadas.`);
    return suggestions;
};

// Auto-map heurístico movido para o módulo `js/aba-import-budget.js`.
// Mantemos um delegador leve para compatibilidade caso algum código ainda chame diretamente.
app.autoMapBudgetUsingHeuristics = function(applyToSaved = true) {
    if (window.AbaImportBudget && typeof window.AbaImportBudget.autoMapBudgetUsingHeuristics === 'function') {
        return window.AbaImportBudget.autoMapBudgetUsingHeuristics(this, applyToSaved);
    }
    this.showToast('Função de AutoMap Budget movida para módulo; módulo não carregado.', true);
    return { tempMapped: 0, tempTotal: 0, savedMapped: 0, savedTotal: 0, examples: [] };
};