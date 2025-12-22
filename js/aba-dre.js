// Módulo da aba DRE
const AbaDre = {
  render: function(containerId, contexto) {
    // contexto: { year, filtros, dadosBrutos, departamentos, data, keyRatiosData, exemptCCs, ... }
    // Funções utilitárias devem ser passadas no contexto!
    const container = document.getElementById(containerId);
    if (!container) return;
    // Preserve existing filters/header in the container. Reuse the existing tbody if present.
    let tbody = container.querySelector('#dre-body');
    if (!tbody) {
      // If the host markup doesn't have a dre-body, create a simple table structure.
      container.innerHTML = `<div><h2>DRE - Ano ${contexto.year}</h2><div class="overflow-x-auto border rounded-lg max-h-[calc(100vh-12rem)] overflow-y-auto"><table class='dre-table min-w-full divide-y divide-gray-200 text-xs'><tbody id='dre-body'></tbody></table></div></div>`;
      tbody = container.querySelector('#dre-body');
      if (!tbody) return;
    }
    // Clear previous rows
    tbody.innerHTML = '';

    // Utilitários vindos do contexto
    const data = contexto.data || [];
    const keyRatiosData = contexto.keyRatiosData || [];
    const exemptCCs = contexto.exemptCCs || [];
    const normalizeAccountDigits = contexto.normalizeAccountDigits;
    const getAdmAllocationForMonth = contexto.getAdmAllocationForMonth;
    const getMgmtFeeAllocationForMonth = contexto.getMgmtFeeAllocationForMonth;
    const calculateKeyRatiosMonthly = contexto.calculateKeyRatiosMonthly;
    const getLastMonthHeads = contexto.getLastMonthHeads;
    const isAdmAllocationEnabled = contexto.isAdmAllocationEnabled;
    const posEbitdaAccounts = contexto.posEbitdaAccounts || [];
    const custoAccounts = contexto.custoAccounts || [];
    const depreciacaoAccounts = contexto.depreciacaoAccounts || [];
    const pessoalAccounts = contexto.pessoalAccounts || [];
    const aluguelAccounts = contexto.aluguelAccounts || [];
    const viagensAccounts = contexto.viagensAccounts || [];
    const diversasAccounts = contexto.diversasAccounts || [];
    const servicosProfissionaisAccounts = contexto.servicosProfissionaisAccounts || [];
    const taxasAccounts = contexto.taxasAccounts || [];
    const outrasAdmAccounts = contexto.outrasAdmAccounts || [];
    const deductionAccounts = contexto.deductionAccounts || [];
    const budgetRevenueAccounts = contexto.budgetRevenueAccounts || [];
    const budgetExcludedFromRevenue = contexto.budgetExcludedFromRevenue || [];

    // Filtros
    const year = contexto.year;
    const filtros = contexto.filtros || {};
    const filterCC = filtros.cc || '';
    const filterDept = filtros.dept || '';
    const filterCli = filtros.client || '';
    const filterSBD = filtros.sbd || '';
    const filterProj = filtros.proj || '';

    // DRE Mensal mostra apenas dados Actual
    const dreType = 'Actual';

    // Estruturas de agregação
    const details = {
      receitaBruta: {}, receitaLiquidaExtra: {}, deducoes: {}, custos: {}, pessoal: {}, aluguel: {}, viagens: {}, 
      diversas: {}, servicosProfissionais: {}, taxas: {}, outrasAdm: {}, admin: {}, 
      depreciacao: {}, managementFee: {}, posEbitda: {} 
    };
    const dynamicTaxMap = {};
    const initArr = () => new Array(13).fill(0);
    const importedKeys = new Set();

    // Processamento dos dados (adaptado do script.js)
    data.forEach(item => {
      if (dreType === 'Actual') {
        if (item.tipo === 'Budget') return;
      } else if (dreType === 'Budget') {
        if (item.tipo !== 'Budget') return;
      }
      if (String(item.departamento).trim() === 'ADM' && (item.conta == 3190 || item.conta == 3204)) return;
      const itemMonth = Number(item.mes) || 0;
      if (parseInt(item.ano) !== year) return;
      if (!itemMonth || itemMonth < 1 || itemMonth > 12) return;
      let valor = Number(item.valor) || 0;
      const isAdmItem = String(item.departamento).trim() === 'ADM';
      let passFilter = true;
      if (isAdmAllocationEnabled && isAdmItem && item.tipo !== 'Receita' && typeof getAdmAllocationForMonth === 'function') {
        valor = getAdmAllocationForMonth(parseInt(item.ano), parseInt(item.mes), {
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
      const contaDigits = normalizeAccountDigits ? normalizeAccountDigits(item.conta) : item.conta;
      const contaNum = (contaDigits && !isNaN(Number(contaDigits))) ? Number(contaDigits) : (isFinite(Number(item.conta)) ? Number(item.conta) : NaN);
      const key = `${item.conta || ''} - ${item.descricao || ''}`;
      let targetGroup = null;
      if (item.tipo === 'Receita') {
        const ccToCheck = String(item.centroCusto).trim();
        const isExempt = exemptCCs.includes(ccToCheck);
        if (deductionAccounts.includes(contaNum)) {
          targetGroup = details.deducoes;
        } else if (contaNum === 1902) {
          targetGroup = details.receitaBruta;
          if (!isExempt) {
            const taxValue = valor * -0.0925;
            const taxKey = "3204 - impostos sobre receita a faturar (Cálculo Dinâmico)";
            if (!dynamicTaxMap[taxKey]) dynamicTaxMap[taxKey] = initArr();
            dynamicTaxMap[taxKey][m] += taxValue;
            dynamicTaxMap[taxKey][12] += taxValue;
          }
        } else if (contaNum === 3204) {
          return;
        } else if (contaNum === 1899) {
          targetGroup = details.receitaLiquidaExtra;
        } else {
          targetGroup = details.receitaBruta;
        }
      } else if (item.tipo === 'Despesa' || item.tipo === 'Budget') {
        const c = Number(item.conta);
        const accDigits = normalizeAccountDigits ? normalizeAccountDigits(item.conta) : item.conta;
        if (item.tipo === 'Budget' && (budgetRevenueAccounts || []).some(b => String(b) === String(item.conta) || String(b) === String(accDigits)) && !(budgetExcludedFromRevenue || []).some(b => String(b) === String(item.conta) || String(b) === String(accDigits))) {
          targetGroup = details.receitaBruta;
        }
        if (c === 1899) {
          targetGroup = details.receitaLiquidaExtra;
        }
        if (c === 3204) return;
        if (posEbitdaAccounts.includes(c)) targetGroup = details.posEbitda;
        else if (custoAccounts.includes(c)) targetGroup = details.custos;
        else if (depreciacaoAccounts.includes(c)) targetGroup = details.depreciacao;
        else if (pessoalAccounts.includes(c)) targetGroup = details.pessoal;
        else if (aluguelAccounts.includes(c)) targetGroup = details.aluguel;
        else if (viagensAccounts.includes(c)) targetGroup = details.viagens;
        else if (diversasAccounts.includes(c)) targetGroup = details.diversas;
        else if (servicosProfissionaisAccounts.includes(c)) targetGroup = details.servicosProfissionais;
        else if (taxasAccounts.includes(c)) targetGroup = details.taxas;
        else if (outrasAdmAccounts.includes(c)) targetGroup = details.outrasAdm;
        else targetGroup = details.admin;
      }
      if(targetGroup) {
        if(!targetGroup[key]) {
          targetGroup[key] = initArr();
          importedKeys.add(key);
        }
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
    try {
      if (typeof getMgmtFeeAllocationForMonth === 'function') {
        for (let m = 0; m < 12; m++) {
          const mes = m + 1;
          const allocation = getMgmtFeeAllocationForMonth(year, mes, {
            cc: filterCC,
            dept: filterDept,
            cli: filterCli,
            sbd: filterSBD,
            proj: filterProj
          });
          if (allocation && allocation !== 0) {
            const key = "9999 - Management Fee Rateado (Proporcional Horas)";
            if (!details.managementFee[key]) details.managementFee[key] = initArr();
            details.managementFee[key][m] += allocation;
            details.managementFee[key][12] += allocation;
          }
        }
      }
    } catch(e) { console.error('Erro alocando Management Fee (aba DRE):', e); }

    // Renderização dos grupos principais (exemplo simplificado)
    const renderGroup = (title, groupData, cssSubtotal) => {
      const groupTotal = initArr();
      const sortedKeys = Object.keys(groupData).sort((a, b) => {
        const contaA = Number(a.split(" - ")[0]);
        const contaB = Number(b.split(" - ")[0]);
        return contaA - contaB;
      });
      if (sortedKeys.length === 0) return groupTotal;
      const trTitle = document.createElement('tr');
      trTitle.innerHTML = `<td colspan="15" class="px-3 py-1 dre-group-title">${title}</td>`;
      tbody.appendChild(trTitle);
      sortedKeys.forEach(k => {
        const vals = groupData[k];
        for(let i=0; i<13; i++) groupTotal[i] += vals[i];
        let conta = k.split(" - ")[0];
        let desc = k.split(" - ").slice(1).join(" - ");
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
      // Render subtotal row for the group when requested
      if (cssSubtotal) {
        const trSub = document.createElement('tr');
        trSub.className = cssSubtotal;
        let subHtml = `<td class="text-left px-3 ${cssSubtotal}" colspan="2">Total ${title.replace(/^[\(\-\)\=\s]*/,'')}</td>`;
        for (let i = 0; i < 12; i++) {
          const v = groupTotal[i];
          const color = v < 0 ? 'text-red-600' : 'text-gray-800';
          subHtml += `<td class="text-right px-2 ${cssSubtotal} ${color}">${v !== 0 ? v.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}) : '-'}</td>`;
        }
        const subTot = groupTotal[12];
        const subCol = subTot < 0 ? 'text-red-600' : 'text-gray-900';
        subHtml += `<td class="text-right px-2 ${cssSubtotal} font-semibold bg-gray-50 ${subCol}">${subTot !== 0 ? subTot.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}) : '-'}</td>`;
        trSub.innerHTML = subHtml;
        tbody.appendChild(trSub);
      }
      return groupTotal;
    };

    // Funções auxiliares para cálculos
    const subArrays = (a, b) => a.map((v, i) => v - b[i]);
    const sumArrays = (a, b) => a.map((v, i) => v + b[i]);

    // Renderização dos grupos principais e captura dos totais
    const totReceita = renderGroup("Receita Bruta", details.receitaBruta);
    const totReceitaExtra = renderGroup("Ajustes Receita Líquida", details.receitaLiquidaExtra);
    const totDeducoes = renderGroup("(-) Deduções", details.deducoes);
    const valRecLiq = sumArrays(sumArrays(totReceita, totReceitaExtra), totDeducoes);

    // Linha Receita Líquida
    renderCalcLine("(=) Receita Líquida", valRecLiq, "dre-subtotal-final");
      function renderCalcLine(label, values, cssClass) {
        const tr = document.createElement('tr');
        tr.className = cssClass || '';
        let html = `<td class="text-left px-3" colspan="2">${label}</td>`;
        for(let i=0; i<12; i++) {
          const v = values[i];
          const color = v < 0 ? 'text-red-600' : 'text-gray-800';
          html += `<td class="text-right px-2 ${color}">${v !== 0 ? v.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</td>`;
        }
        const tot = values[12];
        const col = tot < 0 ? 'text-red-600' : 'text-gray-900';
        html += `<td class="text-right px-2 ${col}">${tot.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>`;
        tr.innerHTML = html;
        tbody.appendChild(tr);
      }

    const renderPercRow = (label, numeratorArr, denominatorArr) => {
      const tr = document.createElement('tr');
      tr.className = "dre-perc-row";
      let html = `<td class="text-left px-3 text-right pr-6" colspan="2">${label}</td>`;
      for(let i=0; i<13; i++) { 
        const num = numeratorArr[i];
        const den = denominatorArr[i];
        let perc = 0;
        if(den && den !== 0) perc = (num / den) * 100;
        html += `<td class="text-right px-2">${perc.toFixed(2)}%</td>`;
      }
      tr.innerHTML = html;
      tbody.appendChild(tr);
    };

    // Custos e Margem
    const totCustos = renderGroup("(-) Custos Variáveis", details.custos, 'dre-subtotal');
    const totViagens = renderGroup("(-) Despesas com Viagem", details.viagens, 'dre-subtotal');
    const valTotalCustos = sumArrays(totCustos, totViagens);
    renderCalcLine("(=) Total de Custos", valTotalCustos, "dre-subtotal");
    let valMargem = subArrays(valRecLiq, valTotalCustos);
    renderCalcLine("(=) Margem de Contribuição", valMargem, "dre-subtotal-final");
    renderPercRow("% Margem de Contribuição", valMargem, valRecLiq);

    // Despesas Operacionais
    const totPessoal = renderGroup("(-) Despesas com Pessoal ADM", details.pessoal, 'dre-subtotal');
    const totAluguel = renderGroup("(-) Despesas Administrativas Gerais (Demais)", details.aluguel, 'dre-subtotal');
    const totServicosProfissionais = renderGroup("(-) Serviços Profissionais", details.servicosProfissionais, 'dre-subtotal');
    const totTaxas = renderGroup("(-) Taxas Diversas", details.taxas, 'dre-subtotal');
    const totDiversas = renderGroup("(-) Despesas Diversas ADM", details.diversas, 'dre-subtotal');
    const totOutrasAdm = renderGroup("(-) Outras despesas adm", details.outrasAdm, 'dre-subtotal');
    const totAdmin = renderGroup("(-) Despesas Com Aluguel", details.admin, 'dre-subtotal');

    // OPEX
    let valOpex = sumArrays(totPessoal, totServicosProfissionais);
    valOpex = sumArrays(valOpex, totTaxas);
    valOpex = sumArrays(valOpex, totDiversas);
    valOpex = sumArrays(valOpex, totOutrasAdm);
    valOpex = sumArrays(valOpex, totAdmin);
    renderCalcLine("(=) OPEX", valOpex, "dre-subtotal");

    // % Despesas Administrativas Totais
    const totDespAdmGerais = sumArrays(sumArrays(totPessoal, totAluguel), sumArrays(totViagens, sumArrays(totServicosProfissionais, sumArrays(totTaxas, sumArrays(totDiversas, sumArrays(totOutrasAdm, totAdmin))))));
    renderPercRow("% Despesas Administrativas Totais", totDespAdmGerais, valRecLiq);

    // Depreciação
    const totDeprec = renderGroup("(-) Depreciação", details.depreciacao, 'dre-subtotal');
    renderPercRow("% Depreciação", totDeprec, valRecLiq);
    renderPercRow("Total Depreciação %", totDeprec, valRecLiq);

    // Management Fee
    const totMgmt = renderGroup("(-) Management Fee", details.managementFee);
    renderPercRow("% Management Fee", totMgmt, valRecLiq);
    renderPercRow("Total Management Fee %", totMgmt, valRecLiq);

    // EBITDA
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

    // Pós-EBITDA
    const totPosEbitda = renderGroup("(-) IRPJ/CSLL e Financeiro", details.posEbitda, 'dre-subtotal');
    let valResultado = subArrays(valEbitda, totPosEbitda);
    renderCalcLine("(=) Resultado Operacional Líquido", valResultado, "dre-subtotal-final");
    renderPercRow("% Resultado Operacional Líquido", valResultado, valRecLiq);

    // Key Ratios (simplificado)
    if (typeof calculateKeyRatiosMonthly === 'function') {
      const filteredKeyRatios = keyRatiosData.filter(item => {
        if (parseInt(item.ano) !== year) return false;
        if (filterCC && String(item.centroCusto) !== filterCC) return false;
        if (filterDept && String(item.departamento) !== filterDept) return false;
        if (filterCli && String(item.cliente) !== filterCli) return false;
        if (filterSBD && String(item.sbd) !== filterSBD) return false;
        if (filterProj && String(item.projectType) !== filterProj) return false;
        return true;
      });
      const ratios = calculateKeyRatiosMonthly(filteredKeyRatios, valRecLiq);
      // Exemplo de renderização dos ratios
      const trSpace = document.createElement('tr');
      trSpace.innerHTML = `<td colspan="15" class="px-3 py-2 bg-gray-50"></td>`;
      tbody.appendChild(trSpace);
      const trTitle = document.createElement('tr');
      trTitle.innerHTML = `<td colspan="15" class="px-3 py-1 dre-group-title text-green-800 bg-green-100 text-base">KEY RATIOS</td>`;
      tbody.appendChild(trTitle);
      const renderRatioLine = (label, values) => {
        const tr = document.createElement('tr');
        let html = `<td class="text-left px-3 font-semibold" colspan="2">${label}</td>`;
        for(let i=0; i<12; i++) {
          const v = values[i];
          html += `<td class="text-right px-2 font-mono">${v !== 0 ? v.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</td>`;
        }
        // Por padrão, tot é o índice 12. Porém, para as linhas de funcionários
        // devemos mostrar o último mês com informação (ex: se há dados até maio,
        // o total deve ser maio). Detectamos os rótulos específicos e ajustamos.
        let tot = values[12];
        try {
          const normalized = String(label || '').toLowerCase();
          if (normalized.includes('funcionários (adm)') || normalized.includes('funcionários (consultores)')) {
            // procura o último índice entre 0..11 com valor diferente de zero
            let lastIdx = -1;
            for (let i = 11; i >= 0; i--) {
              if (values[i] && Number(values[i]) !== 0) { lastIdx = i; break; }
            }
            if (lastIdx >= 0) tot = values[lastIdx];
          }
        } catch(e) { /* keep tot as-is on error */ }
        html += `<td class="text-right px-2 font-bold font-mono">${tot !== 0 ? Number(tot).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</td>`;
        tr.innerHTML = html;
        tbody.appendChild(tr);
      };
      renderRatioLine("Horas Trabalhadas (h)", ratios.totalHours);
      renderRatioLine("Funcionários (ADM)", ratios.numAdm);
      renderRatioLine("Funcionários (Consultores)", ratios.numConsultor);
      renderRatioLine("Valor Hora Médio (R$/h)", ratios.avgHourlyValue);
    }

    // Diagnostic logs removed for cleaner console output
  }
};
window.AbaDre = AbaDre;
