// Módulo da aba DRE Acumulado
const AbaDreAcumulado = {
  render: function(containerId, contexto) {
    // invocation without debug logging
    const safeCtx = contexto || {};

    // Preserve container filters/header and reuse existing tbody
    const container = document.getElementById(containerId);
    if (!container) {
      console.warn('AbaDreAcumulado: container not found', containerId, contexto);
      return;
    }
    let tbody = container.querySelector('#dre-acumulado-body');
    if (!tbody) {
      container.innerHTML = container.innerHTML + `<div class="overflow-x-auto border rounded-lg max-h-[calc(100vh-12rem)] overflow-y-auto"><table class="min-w-full divide-y divide-gray-200 text-xs"><tbody id="dre-acumulado-body"></tbody></table></div>`;
      tbody = container.querySelector('#dre-acumulado-body');
      if (!tbody) return;
    }
    tbody.innerHTML = '';

    // debug artifacts removed

    // Mapeia contexto para variáveis locais (todas opcionais, com fallback)
    const data = contexto.data || [];
    const keyRatiosData = (window.DataAPI && typeof DataAPI.getKeyRatiosData === 'function') ? DataAPI.getKeyRatiosData(contexto) : (contexto.keyRatiosData || []);
    const keyRatiosBudgetData = contexto.keyRatiosBudgetData || [];
    const mgmtFees = contexto.mgmtFees || [];
    const isAdmAllocationEnabled = !!contexto.isAdmAllocationEnabled;
    const getAdmAllocationForMonth = contexto.getAdmAllocationForMonth;
    const getMgmtFeeAllocationForMonth = contexto.getMgmtFeeAllocationForMonth;
    const calculateKeyRatios = contexto.calculateKeyRatios || contexto.calculateKeyRatiosMonthly || null;
    const normalizeAccountDigits = contexto.normalizeAccountDigits || (s=>String(s||''));
    const exemptCCs = contexto.exemptCCs || [];

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
    const managementFeeAccounts = contexto.managementFeeAccounts || [];

    // Export array (referência compartilhada com app)
    contexto.currentDREAcumuladoExportData = contexto.currentDREAcumuladoExportData || [];

    // Filtros e parâmetros
    const year = Number(contexto.year) || (new Date()).getFullYear();
    const month = Number(contexto.month) ||  (new Date()).getMonth() + 1;
    const filtros = contexto.filtros || {};
    const fCC = filtros.cc || '';
    const fDept = filtros.dept || '';
    const fCli = filtros.client || '';
    const fSBD = filtros.sbd || '';
    const fProj = filtros.proj || '';

    // Estruturas de agregação
    const aggreg = { receita: {}, deducoes: {}, custos: {}, pessoal: {}, aluguel: {}, viagens: {}, servicos: {}, taxas: {}, diversas: {}, outras: {}, admin: {}, deprec: {}, mgmt: {}, posEbitda: {}, outrasPos: {} };
    const initRow = () => ({ act_mo:0, act_prev_mo:0, act_ytd:0, bdg_ytd:0, bdg_mo:0, act_py_ytd:0, bdg_fy:0, act_ltm: 0 });

    const getGroup = (c) => {
      c = Number(c);
      if(viagensAccounts.includes(c)) return 'viagens';
      if(custoAccounts.includes(c)) return 'custos';
      if(pessoalAccounts.includes(c)) return 'pessoal';
      if(aluguelAccounts.includes(c)) return 'aluguel';
      if(servicosProfissionaisAccounts.includes(c)) return 'servicos';
      if(taxasAccounts.includes(c)) return 'taxas';
      if(diversasAccounts.includes(c)) return 'diversas';
      if(outrasAdmAccounts.includes(c)) return 'outras';
      if(depreciacaoAccounts.includes(c)) return 'deprec';
      if(posEbitdaAccounts.includes(c)) return 'posEbitda';
      if(managementFeeAccounts.includes(c)) return 'mgmt';
      return 'admin';
    };

    const accountDescMap = {};
    data.forEach(d => {
      const contaNum = String(d.conta).trim();
      if (d.tipo === 'Budget' || d.descricao === 'Budget') {
        if (!accountDescMap[contaNum]) accountDescMap[contaNum] = `Conta ${d.conta}`;
      } else {
        if (d.descricao) accountDescMap[contaNum] = d.descricao;
      }
    });

    // Títulos que devem receber borda completa e números com mesma fonte que a descrição
    const eqTitles = new Set([
      'Total Deduções',
      'Total Custos Variáveis',
      'Total Despesas com Viagem',
      'Total Despesas com Pessoal ADM',
      'Total Serviços Profissionais',
      'Total Taxas Diversas',
      'Total Despesas Diversas ADM',
      'Total Despesas Administrativas',
      'Total Despesas Administrativas Gerais (Demais)',
      '(-) Management Fee',
      'Total Management Fee',
      'Valor Hora Médio (R$/h)'
    ]);

    // Títulos que devem receber background cinza (linha inteira)
    const grayTitles = new Set([
      '(-) Deduções',
      '(-) Custos Variáveis',
      '(-) Despesas com Viagem',
      '(-) Despesas com Pessoal ADM',
      '(-) Serviços Profissionais',
      '(-) Taxas Diversas',
      '(-) Despesas Diversas ADM',
      '(-) Despesas Administrativas',
      '(-) Despesas Administrativas Gerais (Demais)',
      '(-) Depreciação',
      'Total Depreciação'
    ]);

    // Títulos de linhas de percentuais que devem ter fonte maior
    const percTitles = new Set([
      'gross margin %',
      'opex %',
      '% depreciação',
      'total depreciação %',
      'ebit %',
      '% resultado operacional líquido',
      'total depreciação'
    ]);

    // Processamento de linhas (Actual e Budget)
    const allData = [...data];
    const dynamicTaxMap = {};

    allData.forEach(d => {
      let val = Number(d.valor)||0;
      let passFilter = true;
      const isAdm = String(d.departamento).trim() === 'ADM';

      if (isAdmAllocationEnabled && isAdm && d.tipo !== 'Receita') {
        if (typeof getAdmAllocationForMonth === 'function') {
          const ratio = getAdmAllocationForMonth(d.ano, d.mes, { cc: fCC, dept: fDept, client: fCli, sbd: fSBD, proj: fProj }, 1);
          val = val * ratio;
        }
        passFilter = true;
      } else {
        if(fCC && String(d.centroCusto) !== fCC) passFilter = false;
        if(fDept && String(d.departamento) !== fDept) passFilter = false;
        if(fCli && String(d.cliente) !== fCli) passFilter = false;
        if(fSBD && String(d.sbd) !== fSBD) passFilter = false;
        if(fProj && String(d.projectType) !== fProj) passFilter = false;
      }

      if (!passFilter) return;
      if(String(d.departamento).trim()=='ADM' && (d.conta==3190||d.conta==3204)) return;

      const dY = parseInt(d.ano), dM = parseInt(d.mes);
      const contaNum = Number(d.conta);
      let grpKey = '';
      const isBud = d.tipo === 'Budget';
      const ccToCheck = String(d.centroCusto).trim();
      const isExempt = exemptCCs.includes(ccToCheck);

      if (contaNum === 1899) {
        grpKey = 'receita';
      }
      else if (deductionAccounts.includes(contaNum)) {
        grpKey = 'deducoes';
      }
      else if (contaNum === 1902) {
        // Apenas calcula o imposto dinâmico para centros de custo NÃO isentos
        if (!isExempt) {
          const taxValue = val * -0.0925;
          const taxKey = `${ccToCheck}_${dY}_${dM}`;
          if (!dynamicTaxMap[taxKey]) dynamicTaxMap[taxKey] = initRow();
          if (dY === year && dM === month) dynamicTaxMap[taxKey].act_mo += taxValue;
          let prevMo = month - 1; let prevYear = year; if (prevMo === 0) { prevMo = 12; prevYear = year - 1; }
          if (dY === prevYear && dM === prevMo) dynamicTaxMap[taxKey].act_prev_mo += taxValue;
          if (dY === year && dM <= month) dynamicTaxMap[taxKey].act_ytd += taxValue;
          if (dY === year - 1 && dM <= month) dynamicTaxMap[taxKey].act_py_ytd += taxValue;
          const targetMonths = year * 12 + month; const currentMonths = dY * 12 + dM; const diff = targetMonths - currentMonths;
          if (diff >= 0 && diff < 12) dynamicTaxMap[taxKey].act_ltm += taxValue;
        }
        grpKey = 'receita';
      }
      else if (contaNum === 3204) {
        return; // será calculado dinamicamente
      }
      else {
        grpKey = getGroup(d.conta);
      }

      if(!grpKey) return;
      const contaKey = String(d.conta).trim();
      if(!aggreg[grpKey][contaKey]) aggreg[grpKey][contaKey] = initRow();
      const r = aggreg[grpKey][contaKey];

      if (!isBud && dY === year && dM === month) r.act_mo += val;

      let prevMo = month - 1; let prevYear = year; if (prevMo === 0) { prevMo = 12; prevYear = year - 1; }
      if (!isBud && dY === prevYear && dM === prevMo) r.act_prev_mo += val;
      if (!isBud && dY === year && dM <= month) r.act_ytd += val;
      if (isBud && dY === year && dM <= month) r.bdg_ytd += val;
      if (isBud && dY === year && dM === month) r.bdg_mo += val;
      if (!isBud && dY === year - 1 && dM <= month) r.act_py_ytd += val;
      if (isBud && dY === year) r.bdg_fy += val;
      if (!isBud) {
        const targetMonths = year * 12 + month; const currentMonths = dY * 12 + dM; const diff = targetMonths - currentMonths;
        if (diff >= 0 && diff < 12) r.act_ltm += val;
      }
    });

    // Injeta impostos dinâmicos (3204)
    const TAX_ACCOUNT = '3204';
    if (!aggreg.deducoes[TAX_ACCOUNT]) aggreg.deducoes[TAX_ACCOUNT] = initRow();
    for (const taxKey in dynamicTaxMap) {
      const vals = dynamicTaxMap[taxKey];
      ['act_mo','act_prev_mo','act_ytd','bdg_ytd','bdg_mo','act_py_ytd','bdg_fy','act_ltm'].forEach(f => { aggreg.deducoes[TAX_ACCOUNT][f] += vals[f]; });
    }
    accountDescMap[TAX_ACCOUNT] = 'impostos sobre receita a faturar (Cálculo Dinâmico)';

    // Management Fee (9999) alocado dinamicamente
    const MGMT_ACCOUNT = '9999';
    if (!aggreg.mgmt[MGMT_ACCOUNT]) aggreg.mgmt[MGMT_ACCOUNT] = initRow();
    accountDescMap[MGMT_ACCOUNT] = 'Management Fee Rateado (Proporcional Horas)';
    if (Array.isArray(mgmtFees)) {
      mgmtFees.forEach(item => {
        const dY = Number(item.ano), dM = Number(item.mes);
        if (isNaN(dY) || isNaN(dM)) return;
        const allocation = (typeof getMgmtFeeAllocationForMonth === 'function') ? getMgmtFeeAllocationForMonth(dY, dM, { cc: fCC, dept: fDept, cli: fCli, sbd: fSBD, proj: fProj }) : 0;
        if (allocation === 0) return;
        const r = aggreg.mgmt[MGMT_ACCOUNT];
        if (dY === year && dM === month) r.act_mo += allocation;
        let prevMo = month - 1; let prevYear = year; if (prevMo === 0) { prevMo = 12; prevYear = year - 1; }
        if (dY === prevYear && dM === prevMo) r.act_prev_mo += allocation;
        if (dY === year && dM <= month) r.act_ytd += allocation;
        if (dY === year - 1 && dM <= month) r.act_py_ytd += allocation;
        const targetMonths = year * 12 + month; const currentMonths = dY * 12 + dM; const diff = targetMonths - currentMonths; if (diff >= 0 && diff < 12) r.act_ltm += allocation;
      });
    }

    // Helpers de renderização (adaptados do app)
    const renderGroup = (title, obj, cssTitle = 'dre-group-title', cssSubtotal = '') => {
      const groupTotal = initRow();
      const sortedKeys = Object.keys(obj).sort((a,b)=> Number(a) - Number(b));
      if (sortedKeys.length === 0) return groupTotal;
      if (title) {
        contexto.currentDREAcumuladoExportData.push([title]);
        tbody.innerHTML += `<tr><td class="px-2 py-1 ${cssTitle} border-r border-gray-300 sticky left-0 z-10">${title}</td><td colspan="20" class="bg-gray-50 border-b border-gray-100"></td></tr>`;
      }
      let detailCount = 0;
      // Inferir se o grupo é despesa a partir do título
      const inferredIsExpense = (/^\(\-\)/.test(title)) || (/despesas|despesa|custos|custo|taxas|depreciaç|depreciac|management|irpj|financeiro/i.test(title));
      sortedKeys.forEach(accNum => {
        const d = obj[accNum];
        ['act_mo','act_prev_mo','act_ytd','bdg_ytd','bdg_mo','act_py_ytd','bdg_fy','act_ltm'].forEach(f => groupTotal[f] += (d[f]||0));
        const displayName = `${accNum} - ${accountDescMap[accNum] || 'Sem Descrição'}`;
        // Use the app's renderer to keep columns aligned with the table header
          try {
          if (window.app && typeof window.app.renderAcumuladoRow === 'function') {
            window.app.renderAcumuladoRow(tbody, displayName, d, false, inferredIsExpense);
          } else {
            // fallback: simple row
            const tr = document.createElement('tr'); tr.className = 'dre-detail';
            let html = `<td class="text-left px-3 text-xs font-mono" title="${String(accNum)}">${String(accNum)}</td><td class="text-left px-3 truncate max-w-xs" title="${displayName}">${displayName}</td>`;
            ['act_mo','act_prev_mo','act_ytd','bdg_ytd','bdg_mo','act_py_ytd','bdg_fy','act_ltm'].forEach((f)=>{ const v = d[f] || 0; const color = v < 0 ? 'text-red-600' : 'text-gray-600'; html += `<td class="text-right px-2 ${color}">${v !== 0 ? v.toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2}) : '-'}</td>`; });
            tr.innerHTML = html; tbody.appendChild(tr);
          }
        } catch (e) { console.error('Erro renderizando detalhe acumulado', e); }
        detailCount++;
      });
        if (cssSubtotal) {
        // compute short title
        const shortTitle = (title || '').replace(/^\(\-\)\s*/,'').replace(/^\(=\)\s*/,'').trim();
        const totalLabel = `Total ${shortTitle}`;
        contexto.currentDREAcumuladoExportData.push([totalLabel]);
        // se o título estiver na lista, adiciona a classe de borda completa
        let subtotalCssFinal = cssSubtotal;
        if (eqTitles.has(totalLabel) || eqTitles.has(shortTitle) || eqTitles.has(title)) subtotalCssFinal += ' dre-subtotal-eqnums';
          try {
          if (window.app && typeof window.app.renderAcumuladoRow === 'function') {
            window.app.renderAcumuladoRow(tbody, totalLabel, groupTotal, true, inferredIsExpense, subtotalCssFinal);
          } else {
            const trSub = document.createElement('tr'); trSub.className = subtotalCssFinal;
            let subHtml = `<td class="text-left px-3 ${subtotalCssFinal}" colspan="1">${' '}</td><td class="text-left px-3 ${subtotalCssFinal}">${totalLabel}</td>`;
            ['act_mo','act_prev_mo','act_ytd','bdg_ytd','bdg_mo','act_py_ytd','bdg_fy','act_ltm'].forEach(f=>{ const v = groupTotal[f]||0; const color = v<0?'text-red-600':'text-gray-800'; subHtml += `<td class="text-right px-2 ${subtotalCssFinal} ${color}">${v.toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2})}</td>`; });
            trSub.innerHTML = subHtml; tbody.appendChild(trSub);
          }
        } catch (e) { console.error('Erro renderizando subtotal acumulado', e); }
      }
      // debug removed
      return groupTotal;
    };

    const sum = (a,b) => { const r = initRow(); ['act_mo','act_prev_mo','act_ytd','bdg_ytd','bdg_mo','act_py_ytd','bdg_fy','act_ltm'].forEach(f=> r[f] = (a[f]||0) + (b[f]||0)); return r; };
    const sub = (a,b) => { const r = initRow(); ['act_mo','act_prev_mo','act_ytd','bdg_ytd','bdg_mo','act_py_ytd','bdg_fy','act_ltm'].forEach(f=> r[f] = (a[f]||0) - (b[f]||0)); return r; };

    const isLabelExpense = (label) => {
      if(!label) return false;
      return /custos|despesas|management|depreciaç|irpj|financeiro|(-\))/i.test(label);
    };

    const renderCalcLine = (label, values, cssClass = 'dre-subtotal') => {
      contexto.currentDREAcumuladoExportData.push([label, ...( ['act_mo','act_prev_mo','act_ytd','bdg_ytd','bdg_mo','act_py_ytd','bdg_fy','act_ltm'].map(f=> values[f]||0) )]);
      // se o label for um dos títulos especiais, anexa as classes apropriadas
      // Aplicamos dre-row-gray apenas quando houver correspondência exata do label
      let finalCss = cssClass;
      if (eqTitles.has(label)) finalCss += ' dre-subtotal-eqnums';
      if (grayTitles.has(label)) finalCss += ' dre-row-gray';
      try {
        if (window.app && typeof window.app.renderAcumuladoRow === 'function') {
          window.app.renderAcumuladoRow(tbody, label, values, true, isLabelExpense(label), finalCss);
          return;
        }
      } catch(e) { console.error('Erro delegando renderCalcLine para app.renderAcumuladoRow', e); }
      // fallback: simple row
      const tr = document.createElement('tr'); tr.className = finalCss;
      let html = `<td class="text-left px-3" colspan="2">${label}</td>`;
      ['act_mo','act_prev_mo','act_ytd','bdg_ytd','bdg_mo','act_py_ytd','bdg_fy','act_ltm'].forEach(f=>{ const v = values[f]||0; const color = v<0 ? 'text-red-600':'text-gray-800'; html += `<td class="text-right px-2 ${color}">${v !== 0 ? v.toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2}) : '-'}</td>`; });
      tr.innerHTML = html; tbody.appendChild(tr);
    };

    const renderPercRow = (label, numeratorArr, denominatorArr) => {
      contexto.currentDREAcumuladoExportData.push([label]);
      try {
        if (window.app && typeof window.app.renderAcumuladoPercRow === 'function') {
          window.app.renderAcumuladoPercRow(tbody, label, numeratorArr, denominatorArr);
          return;
        }
      } catch (e) { console.error('Erro delegando renderPercRow para app.renderAcumuladoPercRow', e); }
      // fallback
      const tr = document.createElement('tr'); tr.className = 'dre-perc-row';
      let html = `<td class="text-left px-3 text-right pr-6" colspan="2">${label}</td>`;
      ['act_mo','act_prev_mo','act_ytd','bdg_ytd','bdg_mo','act_py_ytd','bdg_fy','act_ltm'].forEach(f=>{
        const num = numeratorArr[f] || 0;
        const den = denominatorArr[f] || 0;
        const perc = (den && den !== 0) ? (num / den) * 100 : 0;
        html += `<td class="text-right px-2">${perc.toFixed(2)}%</td>`;
      });
      tr.innerHTML = html; tbody.appendChild(tr);
    };

    // Render groups
    const totReceita = renderGroup('Receita Bruta', aggreg.receita, 'dre-group-title text-green-800', 'dre-row font-bold text-green-700 bg-green-50');
    const totDeducoes = renderGroup('(-) Deduções', aggreg.deducoes, 'dre-group-title text-red-800', 'dre-subtotal-group-orange');
    const valRecLiq = sum(totReceita, totDeducoes);
    renderCalcLine('(=) Receita Líquida', valRecLiq, 'dre-subtotal-final');

    const totCustos = renderGroup('(-) Custos Variáveis', aggreg.custos, 'dre-group-title text-red-800', 'dre-subtotal-group-orange');
    const totViagens = renderGroup('(-) Despesas com Viagem', aggreg.viagens, 'dre-group-title text-red-800', 'dre-subtotal-group-orange');
    const valTotalCustos = sum(totCustos, totViagens);
    renderCalcLine('(=) Total de Custos', valTotalCustos, 'dre-subtotal-final');

    const valGrossMargin = sub(valRecLiq, valTotalCustos);
    renderCalcLine('(=) Gross Margin', valGrossMargin, 'dre-subtotal-final');
    renderPercRow('Gross Margin %', valGrossMargin, valRecLiq);

    const totPessoal = renderGroup('(-) Despesas com Pessoal ADM', aggreg.pessoal, 'dre-group-title text-red-800', 'dre-subtotal-group-orange');
    const totServicosProfissionais = renderGroup('(-) Serviços Profissionais', aggreg.servicos, 'dre-group-title text-red-800', 'dre-subtotal-group-orange');
    const totTaxas = renderGroup('(-) Taxas Diversas', aggreg.taxas, 'dre-group-title text-red-800', 'dre-subtotal-group-orange');
    const totDiversas = renderGroup('(-) Despesas Diversas ADM', aggreg.diversas, 'dre-group-title text-red-800', 'dre-subtotal-group-orange');
    const totOutrasAdm = renderGroup('(-) Despesas Administrativas', aggreg.outras, 'dre-group-title text-red-800', 'dre-subtotal-group-orange');
    const totAdmin = renderGroup('(-) Despesas Administrativas Gerais (Demais)', aggreg.admin, 'dre-group-title text-red-800', 'dre-subtotal-group-orange');

    let valOpex = sum(totPessoal, totServicosProfissionais);
    valOpex = sum(valOpex, totTaxas);
    valOpex = sum(valOpex, totDiversas);
    valOpex = sum(valOpex, totOutrasAdm);
    valOpex = sum(valOpex, totAdmin);
    renderCalcLine('(=) OPEX', valOpex, 'dre-subtotal-final');
    renderPercRow('OPEX %', valOpex, valRecLiq);

    const totDeprec = renderGroup('(-) Depreciação', aggreg.deprec, 'dre-group-title text-gray-600', 'dre-row font-bold text-gray-600 bg-gray-100');
    renderPercRow('% Depreciação', totDeprec, valRecLiq);
    renderPercRow('Total Depreciação %', totDeprec, valRecLiq);
    const totMgmt = renderGroup('(-) Management Fee', aggreg.mgmt, 'dre-group-title-orange', 'dre-subtotal-group-black-text');
    renderPercRow('% Management Fee', totMgmt, valRecLiq);
    renderPercRow('Total Management Fee %', totMgmt, valRecLiq);

    let valEBIT = sub(valGrossMargin, valOpex);
    valEBIT = sub(valEBIT, totDeprec);
    valEBIT = sub(valEBIT, totMgmt);
    renderCalcLine('(=) EBIT', valEBIT, 'dre-subtotal-final');
    renderPercRow('EBIT %', valEBIT, valRecLiq);

    const totPosEbitda = renderGroup('(-) IRPJ/CSLL e Financeiro', aggreg.posEbitda, 'text-blue-700 bg-blue-50', '');
    let valResultado = sub(valEBIT, totPosEbitda);
    renderCalcLine('(=) Resultado Operacional Líquido', valResultado, 'dre-subtotal-final');
    renderPercRow('% Resultado Operacional Líquido', valResultado, valRecLiq);

    // Key ratios acumulados (se função fornecida)
    if (typeof calculateKeyRatios === 'function') {
      try {
        const filteredKeyRatios = keyRatiosData.filter(item => {
          const itemYear = parseInt(item.ano);
          const itemMonth = parseInt(item.mes);
          if (isNaN(itemYear) || isNaN(itemMonth)) return false;
          if (!(itemYear === year || itemYear === year - 1)) return false;
          if (fCC && String(item.centroCusto) !== fCC) return false;
          if (fDept && String(item.departamento) !== fDept) return false;
          if (fCli && String(item.cliente) !== fCli) return false;
          if (fSBD && String(item.sbd) !== fSBD) return false;
          if (fProj && String(item.projectType) !== fProj) return false;
          return true;
        });

        const ratiosAc = calculateKeyRatios(filteredKeyRatios, year, month, {
          act_mo: valRecLiq.act_mo || 0,
          act_prev_mo: valRecLiq.act_prev_mo || 0,
          act_ytd: valRecLiq.act_ytd || 0,
          act_py_ytd: valRecLiq.act_py_ytd || 0,
          act_ltm: valRecLiq.act_ltm || 0
        });

        // Mesclar keyRatiosBudgetData para campos de budget
        try {
          const krb = keyRatiosBudgetData || [];
          const filteredKrbB = krb.filter(k => parseInt(k.ano) === year && (
            (!fCC || String(k.centroCusto) === fCC) &&
            (!fDept || String(k.departamento) === fDept) &&
            (!fCli || String(k.cliente) === fCli) &&
            (!fSBD || String(k.sbd) === fSBD) &&
            (!fProj || String(k.projectType) === fProj)
          ));

          let budgetHoursYTD = 0, budgetHoursFY = 0, budgetHoursMO = 0;
          let budgetAdmYTD = 0, budgetAdmFY = 0, budgetAdmMO = 0;
          let budgetConsYTD = 0, budgetConsFY = 0, budgetConsMO = 0;

          filteredKrbB.forEach(item => {
            const acc = normalizeAccountDigits(String(item.conta || ''));
            const m = Number(item.mes);
            const v = Number(item.valor) || 0;
            if (isNaN(m)) return;
            if (acc === '7004') { if (m >= 1 && m <= month) budgetHoursYTD += v; if (m === month) budgetHoursMO += v; if (String(item.ano) == String(year)) budgetHoursFY += v; }
            else if (acc === '7002') { if (m >= 1 && m <= month) budgetAdmYTD += v; if (m === month) budgetAdmMO += v; if (String(item.ano) == String(year)) budgetAdmFY += v; }
            else if (acc === '7001') { if (m >= 1 && m <= month) budgetConsYTD += v; if (m === month) budgetConsMO += v; if (String(item.ano) == String(year)) budgetConsFY += v; }
            else {
              const d = String(item.descricao || '').toLowerCase();
              if (d.includes('hora')) { if (m >= 1 && m <= month) budgetHoursYTD += v; if (m === month) budgetHoursMO += v; if (String(item.ano) == String(year)) budgetHoursFY += v; }
              else if (d.includes('adm')) { if (m >= 1 && m <= month) budgetAdmYTD += v; if (m === month) budgetAdmMO += v; if (String(item.ano) == String(year)) budgetAdmFY += v; }
              else if (d.includes('consult')) { if (m >= 1 && m <= month) budgetConsYTD += v; if (m === month) budgetConsMO += v; if (String(item.ano) == String(year)) budgetConsFY += v; }
            }
          });

          if (!ratiosAc.totalHours) ratiosAc.totalHours = {};
          ratiosAc.totalHours.bdg_ytd = budgetHoursYTD; ratiosAc.totalHours.bdg_mo = budgetHoursMO; ratiosAc.totalHours.bdg_fy = budgetHoursFY;
          if (!ratiosAc.numAdm) ratiosAc.numAdm = {}; ratiosAc.numAdm.bdg_ytd = budgetAdmYTD; ratiosAc.numAdm.bdg_mo = budgetAdmMO; ratiosAc.numAdm.bdg_fy = budgetAdmFY;
          if (!ratiosAc.numConsultor) ratiosAc.numConsultor = {}; ratiosAc.numConsultor.bdg_ytd = budgetConsYTD; ratiosAc.numConsultor.bdg_mo = budgetConsMO; ratiosAc.numConsultor.bdg_fy = budgetConsFY;
          if (!ratiosAc.avgHourlyValue) ratiosAc.avgHourlyValue = {}; ratiosAc.avgHourlyValue.bdg_ytd = (budgetHoursYTD && valRecLiq.bdg_ytd) ? (valRecLiq.bdg_ytd / budgetHoursYTD) : 0; ratiosAc.avgHourlyValue.bdg_mo = (budgetHoursMO && valRecLiq.bdg_mo) ? (valRecLiq.bdg_mo / budgetHoursMO) : 0; ratiosAc.avgHourlyValue.bdg_fy = (budgetHoursFY && valRecLiq.bdg_fy) ? (valRecLiq.bdg_fy / budgetHoursFY) : 0;
        } catch (e) { console.error('Erro mesclando KeyRatiosBudget ao Acumulado:', e); }

        // Render ratios (use app helper if available)
        try {
          if (window.app && typeof window.app.renderAcumuladoRatios === 'function') {
            window.app.renderAcumuladoRatios(tbody, ratiosAc);
          } else {
            // fallback: simple rendering per line
            const renderRatioLine = (label, values) => {
              const trTitle = document.createElement('tr'); trTitle.innerHTML = `<td colspan="20" class="px-3 py-1 dre-group-title text-green-800 bg-green-100 text-base">${label}</td>`; tbody.appendChild(trTitle);
              const tr = document.createElement('tr');
                if (eqTitles.has(label)) tr.className = 'dre-subtotal-eqnums';
                if (grayTitles.has(label)) tr.classList.add('dre-row-gray');
              let html = `<td class="text-left px-3 font-semibold" colspan="2">${label}</td>`;
              for (let i=0;i<12;i++) { const v = values[i] || 0; html += `<td class="text-right px-2 font-mono">${v !== 0 ? v.toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2}) : '-'}</td>`; }
              const tot = values[12] || 0; html += `<td class="text-right px-2 font-bold font-mono">${tot.toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2})}</td>`; tr.innerHTML = html; tbody.appendChild(tr);
            };
            renderRatioLine('Horas Trabalhadas (h)', ratiosAc.totalHours || []);
            renderRatioLine('Funcionários (ADM)', ratiosAc.numAdm || []);
            renderRatioLine('Funcionários (Consultores)', ratiosAc.numConsultor || []);
            renderRatioLine('Valor Hora Médio (R$/h)', ratiosAc.avgHourlyValue || []);
          }
        } catch (e) { console.error('Erro renderizando key ratios (fallback):', e); }
      } catch (e) { console.error('Erro calculando key ratios acumulados:', e); }
    }

    // Garantia adicional: alguns renderers internos podem ignorar a classe passada.
    // Percorremos as linhas geradas e aplicamos `dre-subtotal-eqnums` quando o texto
    // do rótulo estiver na(s) primeira(s) célula(s) da própria linha (evita aplicar
    // a classe em linhas seguintes).
    try {
      const applyEqClassToRenderedRows = () => {
        try {
          const rows = tbody.querySelectorAll('tr');
          // remove a classe dre-row-gray de todas as linhas antes de reaplicar
          rows.forEach(r => r.classList.remove('dre-row-gray'));
          rows.forEach(tr => {
            const tds = tr.querySelectorAll('td');
            if (!tds || tds.length === 0) return;
            const firstRaw = (tds[0].textContent || '').replace(/\s+/g,' ').trim();
            const secondRaw = (tds[1] ? (tds[1].textContent || '').replace(/\s+/g,' ').trim() : '');
            const first = firstRaw.toLowerCase();
            const second = secondRaw.toLowerCase();
            const combined = (first + ' ' + second).trim();
            // aplicar dre-subtotal-eqnums quando encontrar correspondência para eqTitles (mais tolerante)
            for (const t of eqTitles) {
              if (!t) continue;
              const normT = t.replace(/\s+/g,' ').trim().toLowerCase();
              const normTNoTotal = normT.replace(/^total\s+/,'');
              if (combined.includes(normT) || combined.includes(normTNoTotal) || first.includes(normT) || second.includes(normT) || first.includes(normTNoTotal) || second.includes(normTNoTotal)) {
                tr.classList.add('dre-subtotal-eqnums');
                break;
              }
            }
            // aplicar destaque de percentuais quando o label normalizado corresponder
            try {
              const combinedRaw = (firstRaw + ' ' + secondRaw).replace(/\s+/g,' ').trim().toLowerCase();
              const normalizedCombined = combinedRaw.replace(/[^a-z0-9%\s]/g,'');
              for (const p of percTitles) {
                if (!p) continue;
                const normP = p.replace(/[^a-z0-9%\s]/g,'').trim().toLowerCase();
                if (normalizedCombined.includes(normP) || first.includes(normP) || second.includes(normP)) {
                  tr.classList.add('dre-perc-highlight');
                  break;
                }
              }
            } catch(e) { /* silently continue */ }
            // aplicar dre-row-gray apenas se houver correspondência EXATA do título nas primeiras células
            for (const g of grayTitles) {
              if (!g) continue;
              const normG = g.replace(/\s+/g,' ').trim().toLowerCase();
              if (first === normG || second === normG || (`total ${first}` === normG) || (`total ${second}` === normG)) {
                tr.classList.add('dre-row-gray');
                break;
              }
            }
          });
        } catch(e) { console.error('Erro aplicando dre-subtotal-eqnums:', e); }
      };
      applyEqClassToRenderedRows();
    } catch(e) { console.error('Erro na etapa final de aplicação de classes:', e); }
    
  }
};
window.AbaDreAcumulado = AbaDreAcumulado;
