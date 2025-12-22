
// Módulo da aba DRE Budget-2
const AbaDreBudget2 = {
  render: function(containerId, contexto) {
    // contexto: { year, filtros: { cc, dept, client, sbd, proj }, data, keyRatiosBudgetData, exemptCCs, isAdmAllocationEnabled, viagensAccounts, custoAccounts, pessoalAccounts, aluguelAccounts, servicosProfissionaisAccounts, taxasAccounts, diversasAccounts, outrasAdmAccounts, depreciacaoAccounts, posEbitdaAccounts, managementFeeAccounts, deductionAccounts, normalizeAccountDigits, getAdmAllocationForMonth }
    const year = Number(contexto.year) || (new Date()).getFullYear();
    const filtros = contexto.filtros || {};
    const fCC = filtros.cc || '';
    const fDept = filtros.dept || '';
    const fCli = filtros.client || '';
    const fSBD = filtros.sbd || '';
    const fProj = filtros.proj || '';

    // Map context into local S to reduce changes from legacy code
    const S = {
      data: contexto.data || [],
      keyRatiosBudgetData: contexto.keyRatiosBudgetData || [],
      exemptCCs: contexto.exemptCCs || [],
      isAdmAllocationEnabled: contexto.isAdmAllocationEnabled,
      viagensAccounts: contexto.viagensAccounts || [],
      custoAccounts: contexto.custoAccounts || [],
      pessoalAccounts: contexto.pessoalAccounts || [],
      aluguelAccounts: contexto.aluguelAccounts || [],
      servicosProfissionaisAccounts: contexto.servicosProfissionaisAccounts || [],
      taxasAccounts: contexto.taxasAccounts || [],
      diversasAccounts: contexto.diversasAccounts || [],
      outrasAdmAccounts: contexto.outrasAdmAccounts || [],
      depreciacaoAccounts: contexto.depreciacaoAccounts || [],
      posEbitdaAccounts: contexto.posEbitdaAccounts || [],
      managementFeeAccounts: contexto.managementFeeAccounts || [],
      deductionAccounts: contexto.deductionAccounts || [],
      normalizeAccountDigits: contexto.normalizeAccountDigits || (x => String(x)),
      getAdmAllocationForMonth: contexto.getAdmAllocationForMonth || (function(){ return 1; })
    };

    // Use existing table and filters in the page — do NOT overwrite header/filters. Only render tbody.
    const tbody = document.getElementById('dre-b2-body') || (document.getElementById(containerId) && document.getElementById(containerId).querySelector('tbody'));
    if (!tbody) return;
    tbody.innerHTML = '';

    // Prepare export array on global app so Export button can use it
    try { window.app = window.app || {}; window.app.currentDREExportData = [["Conta","Descrição","Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez","Total"]]; } catch(e) {}

    const initArr = () => new Array(13).fill(0);
    const aggreg = { receita: {}, deducoes: {}, custos: {}, pessoal: {}, aluguel: {}, viagens: {}, servicos: {}, taxas: {}, diversas: {}, outras: {}, admin: {}, deprec: {}, mgmt: {}, posEbitda: {} };

    const getGroup = (c) => {
      c = Number(c);
      if (S.viagensAccounts.includes(c)) return 'viagens';
      if (S.custoAccounts.includes(c)) return 'custos';
      if (S.pessoalAccounts.includes(c)) return 'pessoal';
      if (S.aluguelAccounts.includes(c)) return 'aluguel';
      if (S.servicosProfissionaisAccounts.includes(c)) return 'servicos';
      if (S.taxasAccounts.includes(c)) return 'taxas';
      if (S.diversasAccounts.includes(c)) return 'diversas';
      if (S.outrasAdmAccounts.includes(c)) return 'outras';
      if (S.depreciacaoAccounts.includes(c)) return 'deprec';
      if (S.posEbitdaAccounts.includes(c)) return 'posEbitda';
      if (S.managementFeeAccounts.includes(c)) return 'mgmt';
      return 'admin';
    };

    const allData = Array.isArray(S.data) ? [...S.data] : [];
    const dynamicTaxMap = {};

    allData.forEach(d => {
      if (!d) return;
      // Use apenas registros importados como Budget
      if (String(d.tipo) !== 'Budget') return;
      const dY = parseInt(d.ano);
      if (dY !== year) return;

      let val = Number(d.valor) || 0;
      let passFilter = true;
      const isAdm = String(d.departamento || '').trim() === 'ADM';

      if (S.isAdmAllocationEnabled && isAdm && String(d.tipo) !== 'Receita') {
        try {
          const ratio = S.getAdmAllocationForMonth ? S.getAdmAllocationForMonth(d.ano, d.mes, { cc: fCC, dept: fDept, client: fCli, sbd: fSBD, proj: fProj }, 1) : 1;
          val = val * ratio;
          passFilter = true;
        } catch (e) { /* ignore */ }
      } else {
        if (fCC && String(d.centroCusto) !== fCC) passFilter = false;
        if (fDept && String(d.departamento) !== fDept) passFilter = false;
        if (fCli && String(d.cliente) !== fCli) passFilter = false;
        if (fSBD && String(d.sbd) !== fSBD) passFilter = false;
        if (fProj && String(d.projectType) !== fProj) passFilter = false;
      }
      if (!passFilter) return;
      if (String(d.departamento || '').trim() === 'ADM' && (Number(d.conta) === 3190 || Number(d.conta) === 3204)) return;

      const m = parseInt(d.mes) - 1;
      if (isNaN(m) || m < 0 || m > 11) return;

      const contaNum = Number(d.conta);
      let grpKey = '';

      const ccToCheck = String(d.centroCusto || '').trim();
      const isExempt = S.exemptCCs.includes(ccToCheck);

      if (contaNum === 1899) {
        grpKey = 'receita';
      } else if (S.deductionAccounts && S.deductionAccounts.includes && S.deductionAccounts.includes(contaNum)) {
        grpKey = 'deducoes';
      } else if (contaNum === 1902) {
        // legacy: treat as receita with special deducoes handling — keep as receita
        grpKey = 'receita';
        // Optionally, accumulate dynamic tax amounts per key (not always present in data)
        const taxKey = String(d.centroCusto || '');
        if (!dynamicTaxMap[taxKey]) dynamicTaxMap[taxKey] = initArr();
        const taxValue = val * 0.0925; // heuristic used previously
        dynamicTaxMap[taxKey][m] += taxValue;
        dynamicTaxMap[taxKey][12] += taxValue;
      } else if (contaNum === 3204) {
        // skip dynamic 3204 on Budget-2 (handled elsewhere)
        return;
      } else {
        grpKey = getGroup(contaNum);
      }

      const contaKey = `${String(d.conta).trim()} - ${String(d.descricao || '').trim()}`;
      if (!aggreg[grpKey][contaKey]) aggreg[grpKey][contaKey] = initArr();
      aggreg[grpKey][contaKey][m] += val;
      aggreg[grpKey][contaKey][12] += val;
    });

    // Inject dynamic taxes into deducoes (3204) per month
    const TAX_ACCOUNT = '3204';
    if (!aggreg.deducoes[TAX_ACCOUNT]) aggreg.deducoes[TAX_ACCOUNT] = initArr();
    for (const taxKey in dynamicTaxMap) {
      const vals = dynamicTaxMap[taxKey];
      for (let i = 0; i < 13; i++) aggreg.deducoes[TAX_ACCOUNT][i] += vals[i];
    }
    aggreg.deducoes[TAX_ACCOUNT] = aggreg.deducoes[TAX_ACCOUNT] || initArr();

    // Se o usuário não importou a conta 9999 como Budget, remover mgmt gerado pelo sistema
    try {
      const hasImported9999 = (S.data || []).some(d => d && String(d.tipo) === 'Budget' && S.normalizeAccountDigits(String(d.conta || '')) === '9999');
      if (!hasImported9999) {
        aggreg.mgmt = {};
      }
    } catch (e) {
      console.log('Erro checando importação 9999 em Budget-2:', e);
    }

    // Rateio ADM
    if (S.isAdmAllocationEnabled) {
      try {
        const admSums = new Array(13).fill(0);
        (S.data || []).forEach(d => {
          if (!d || String(d.tipo) !== 'Budget') return;
          if (String(d.departamento || '').trim() !== 'ADM') return;
          if (fCC && String(d.centroCusto) !== fCC) return;
          if (fDept && String(d.departamento) !== fDept) return;
          if (fCli && String(d.cliente) !== fCli) return;
          if (fSBD && String(d.sbd) !== fSBD) return;
          if (fProj && String(d.projectType) !== fProj) return;
          const m = parseInt(d.mes) - 1;
          if (isNaN(m) || m < 0 || m > 11) return;
          const v = Number(d.valor) || 0;
          admSums[m] += v;
          admSums[12] += v;
        });

        const pessoalKeys = Object.keys(aggreg.pessoal || {});
        if (pessoalKeys.length > 0) {
          for (let m = 0; m < 13; m++) {
            const totalToDistribute = admSums[m];
            if (!totalToDistribute || totalToDistribute === 0) continue;
            let baseTotal = 0;
            const basePerKey = {};
            pessoalKeys.forEach(k => {
              const arr = aggreg.pessoal[k] || new Array(13).fill(0);
              const val = Number(arr[m] || 0);
              basePerKey[k] = val;
              baseTotal += val;
            });
            if (baseTotal === 0) {
              const per = totalToDistribute / pessoalKeys.length;
              pessoalKeys.forEach(k => {
                aggreg.pessoal[k][m] = (aggreg.pessoal[k][m] || 0) + per;
                aggreg.pessoal[k][12] = (aggreg.pessoal[k][12] || 0) + per;
              });
            } else {
              pessoalKeys.forEach(k => {
                const share = basePerKey[k] / baseTotal;
                const add = totalToDistribute * share;
                aggreg.pessoal[k][m] = (aggreg.pessoal[k][m] || 0) + add;
                aggreg.pessoal[k][12] = (aggreg.pessoal[k][12] || 0) + add;
              });
            }
            Object.keys(aggreg.admin || {}).forEach(admKey => {
              if (aggreg.admin[admKey]) {
                aggreg.admin[admKey][m] = 0;
                aggreg.admin[admKey][12] = (aggreg.admin[admKey].slice(0,12).reduce((s,x)=>s+(Number(x)||0),0));
              }
            });
          }
        }
      } catch (e) {
        console.error('Erro aplicando rateio ADM em Budget-2:', e);
      }
    }

    // Rendering helpers (adaptados)
    const renderGroup = (title, groupData, cssTitle = 'dre-group-title', cssDetail = '', cssSubtotal = '') => {
      const groupTotal = initArr();
      const sortedKeys = Object.keys(groupData).sort((a,b)=> Number(a.split(' - ')[0]) - Number(b.split(' - ')[0]));
      if (sortedKeys.length === 0) return groupTotal;
      if (title) {
        try { window.app.currentDREExportData.push([title, '', '', '', '', '', '', '', '', '', '', '', '', '', '']); } catch (e) {}
        const trTitle = document.createElement('tr');
        trTitle.innerHTML = `<td colspan="15" class="px-3 py-1 ${cssTitle}">${title}</td>`;
        tbody.appendChild(trTitle);
      }
      sortedKeys.forEach(k => {
        const vals = groupData[k];
        for (let i=0;i<13;i++) groupTotal[i] += vals[i];
        let conta = k.split(' - ')[0];
        let desc = k.split(' - ').slice(1).join(' - ');
        try { window.app.currentDREExportData.push([conta || '', desc || '', ...vals.slice(0,12), vals[12]]); } catch (e) {}
        const tr = document.createElement('tr'); tr.className = 'dre-detail';
        let html = `<td class="text-left px-3 text-xs font-mono" title="${conta}">${conta}</td><td class="text-left px-3 truncate max-w-xs" title="${desc}">${desc}</td>`;
        for (let i=0;i<12;i++){
          const v = vals[i]; const color = v<0 ? 'text-red-600' : 'text-gray-600';
          html += `<td class="text-right px-2 ${color}">${v !== 0 ? v.toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2}) : '-'}</td>`;
        }
        const tot = vals[12]; const totColor = tot<0 ? 'text-red-600' : 'text-gray-800';
        html += `<td class="text-right px-2 font-semibold bg-gray-50 ${totColor}">${tot.toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2})}</td>`;
        tr.innerHTML = html; tbody.appendChild(tr);
      });
      if (cssSubtotal) {
        const shortTitle = (title || '').replace(/^\(\-\)\s*/,'').replace(/^\(\=\)\s*/,'').trim();
        try { window.app.currentDREExportData.push([`Total ${shortTitle}`, '', ...groupTotal.slice(0,12), groupTotal[12]]); } catch (e) {}
        const trSub = document.createElement('tr'); trSub.className = cssSubtotal;
        let subHtml = `<td class="text-left px-3 ${cssSubtotal}" colspan="1">${' '}</td><td class="text-left px-3 ${cssSubtotal}">Total ${shortTitle}</td>`;
        for (let i=0;i<12;i++){ const v = groupTotal[i]; const color = v<0 ? 'text-red-600' : 'text-gray-800'; subHtml += `<td class="text-right px-2 ${cssSubtotal} ${color}">${v.toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2})}</td>`; }
        const subTot = groupTotal[12]; const subCol = subTot<0 ? 'text-red-600' : 'text-gray-900'; subHtml += `<td class="text-right px-2 ${cssSubtotal} font-semibold bg-gray-50 ${subCol}">${subTot.toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2})}</td>`;
        trSub.innerHTML = subHtml; tbody.appendChild(trSub);
      }
      return groupTotal;
    };

    const sumArrays = (a,b) => a.map((v,i)=> v + b[i]);
    const subArrays = (a,b) => a.map((v,i)=> v - b[i]);

    const renderCalcLine = (label, values, cssClass = 'dre-subtotal') => {
      try { window.app.currentDREExportData.push([label, '', ...values.slice(0,12), values[12]]); } catch (e) {}
      const tr = document.createElement('tr'); tr.className = cssClass;
      let html = `<td class="text-left px-3" colspan="2">${label}</td>`;
      for (let i=0;i<12;i++){ const v = values[i]; const color = v<0 ? 'text-red-600' : 'text-gray-800'; html += `<td class="text-right px-2 ${color}">${v.toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2})}</td>`; }
      const tot = values[12]; const col = tot<0 ? 'text-red-600' : 'text-gray-900'; html += `<td class="text-right px-2 ${col}">${tot.toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2})}</td>`;
      tr.innerHTML = html; tbody.appendChild(tr);
    };

    const renderPercRow = (label, numeratorArr, denominatorArr) => {
      const tr = document.createElement('tr'); tr.className = 'dre-perc-row';
      let html = `<td class="text-left px-3 text-right pr-6" colspan="2">${label}</td>`;
      try { window.app.currentDREExportData.push([label, '', '', '', '', '', '', '', '', '', '', '', '', '']); } catch (e) {}
      for (let i=0;i<12;i++) {
        const num = numeratorArr[i];
        const den = denominatorArr[i];
        const perc = (den && den !== 0) ? (num / den) * 100 : 0;
        html += `<td class="text-right px-2">${perc.toFixed(2)}%</td>`;
      }
      const totNum = numeratorArr[12]; const totDen = denominatorArr[12];
      const totPerc = (totDen && totDen !== 0) ? (totNum / totDen) * 100 : 0;
      html += `<td class="text-right px-2">${totPerc.toFixed(2)}%</td>`;
      tr.innerHTML = html; tbody.appendChild(tr);
    };

    // Now render all groups and calc lines (same flow as legacy)
    const totReceita = renderGroup('Receita Bruta', aggreg.receita, 'dre-group-title text-green-800', '', 'dre-row font-bold text-green-700 bg-green-50');
    const totDeducoes = renderGroup('(-) Deduções', aggreg.deducoes, 'dre-group-title text-red-800', '', 'dre-subtotal-group-orange');
    const valRecLiq = sumArrays(totReceita, totDeducoes);

    // Render Receita Líquida
    renderCalcLine('(=) Receita Líquida', valRecLiq, 'dre-subtotal-final');

    // Render Custos groups and compute totals
    const totCustos = renderGroup('(-) Custos Variáveis', aggreg.custos, 'dre-group-title text-red-800', '', 'dre-subtotal-group-orange');
    const totViagens = renderGroup('(-) Despesas com Viagem', aggreg.viagens, 'dre-group-title text-red-800', '', 'dre-subtotal-group-orange');
    const valTotalCustos = sumArrays(totCustos, totViagens);
    renderCalcLine('(=) Total de Custos', valTotalCustos, 'dre-subtotal');

    // Gross Margin (Revenue - Total Costs)
    const valGrossMargin = subArrays(valRecLiq, valTotalCustos);
    renderCalcLine('(=) Gross Margin', valGrossMargin, 'dre-subtotal-final');
    renderPercRow('Gross Margin %', valGrossMargin, valRecLiq);

    // OPEX groups
    const totPessoal = renderGroup('(-) Despesas com Pessoal ADM', aggreg.pessoal, 'dre-group-title text-red-800', '', 'dre-subtotal-group-orange');
    const totServicosProfissionais = renderGroup('(-) Serviços Profissionais', aggreg.servicos, 'dre-group-title text-red-800', '', 'dre-subtotal-group-orange');
    const totTaxas = renderGroup('(-) Taxas Diversas', aggreg.taxas, 'dre-group-title text-red-800', '', 'dre-subtotal-group-orange');
    const totDiversas = renderGroup('(-) Despesas Diversas ADM', aggreg.diversas, 'dre-group-title text-red-800', '', 'dre-subtotal-group-orange');
    const totOutrasAdm = renderGroup('(-) Despesas Administrativas', aggreg.outras, 'dre-group-title text-red-800', '', 'dre-subtotal-group-orange');
    const totAdmin = renderGroup('(-) Despesas Administrativas Gerais (Demais)', aggreg.admin, 'dre-group-title text-red-800', '', 'dre-subtotal-group-orange');

    let valOpex = sumArrays(totPessoal, totServicosProfissionais);
    valOpex = sumArrays(valOpex, totTaxas);
    valOpex = sumArrays(valOpex, totDiversas);
    valOpex = sumArrays(valOpex, totOutrasAdm);
    valOpex = sumArrays(valOpex, totAdmin);
    renderCalcLine('(=) OPEX', valOpex, 'dre-subtotal');
    renderPercRow('OPEX %', valOpex, valRecLiq);

    // Depreciation and Management Fee groups
    const totDeprec = renderGroup('(-) Depreciação', aggreg.deprec, 'dre-group-title text-gray-600', '', 'dre-row font-bold text-gray-600 bg-gray-100');
    renderPercRow('% Depreciação', totDeprec, valRecLiq);
    renderPercRow('Total Depreciação %', totDeprec, valRecLiq);
    const totMgmt = renderGroup('(-) Management Fee', aggreg.mgmt, 'dre-group-title-orange', '', 'dre-subtotal-group-black-text');
    renderPercRow('% Management Fee', totMgmt, valRecLiq);
    renderPercRow('Total Management Fee %', totMgmt, valRecLiq);

    // EBIT
    let valEBIT = subArrays(valGrossMargin, valOpex);
    valEBIT = subArrays(valEBIT, totDeprec);
    valEBIT = subArrays(valEBIT, totMgmt);
    renderCalcLine('(=) EBIT', valEBIT, 'dre-subtotal-final');
    renderPercRow('EBIT %', valEBIT, valRecLiq);

    // Key Ratios Budget
    try {
      const krb = S.keyRatiosBudgetData || [];
      const filteredKrb = krb.filter(k => parseInt(k.ano) === year && (
        (!fCC || String(k.centroCusto) === fCC) &&
        (!fDept || String(k.departamento) === fDept) &&
        (!fCli || String(k.cliente) === fCli) &&
        (!fSBD || String(k.sbd) === fSBD) &&
        (!fProj || String(k.projectType) === fProj)
      ));

      const aggHours = new Array(13).fill(0);
      const aggAdm = new Array(13).fill(0);
      const aggConsult = new Array(13).fill(0);

      filteredKrb.forEach(item => {
        const acc = S.normalizeAccountDigits(String(item.conta || ''));
        const m = Number(item.mes) - 1;
        if (isNaN(m) || m < 0 || m > 11) return;
        const v = Number(item.valor) || 0;
        if (acc === '7001') {
          aggConsult[m] += v; aggConsult[12] += v;
        } else if (acc === '7002') {
          aggAdm[m] += v; aggAdm[12] += v;
        } else if (acc === '7004') {
          aggHours[m] += v; aggHours[12] += v;
        } else {
          const d = String(item.descricao || '').toLowerCase();
          if (d.includes('consult') || d.includes('consultor')) { aggConsult[m] += v; aggConsult[12] += v; }
          else if (d.includes('adm')) { aggAdm[m] += v; aggAdm[12] += v; }
          else if (d.includes('hora')) { aggHours[m] += v; aggHours[12] += v; }
        }
      });

      const anyData = aggHours.some(x=>x!==0) || aggAdm.some(x=>x!==0) || aggConsult.some(x=>x!==0);
      if (anyData) {
        const trTitle = document.createElement('tr');
        trTitle.innerHTML = `<td colspan="15" class="px-3 py-1 dre-group-title text-indigo-800">KEY RATIOS BUDGET (Sumarizado)</td>`;
        tbody.appendChild(trTitle);
        renderCalcLine('Horas Trabalhadas (h)', aggHours, 'dre-row');
        const admForRender = aggAdm.slice(); admForRender[12] = admForRender[11];
        const consultForRender = aggConsult.slice(); consultForRender[12] = consultForRender[11];
        renderCalcLine('Funcionários (ADM)', admForRender, 'dre-row');
        renderCalcLine('Funcionários (Consultores)', consultForRender, 'dre-row');
        try {
          const perHour = new Array(13).fill(0);
          for (let i = 0; i < 12; i++) {
            const hours = aggHours[i] || 0;
            const rev = (valRecLiq && valRecLiq[i]) ? valRecLiq[i] : 0;
            perHour[i] = hours ? (rev / hours) : 0;
          }
          const totalHours = aggHours[12] || 0;
          const totalRev = (valRecLiq && valRecLiq[12]) ? valRecLiq[12] : 0;
          perHour[12] = totalHours ? (totalRev / totalHours) : 0;
          renderCalcLine('(=) Valor Hora Médio (R$/h)', perHour, 'dre-subtotal-group-black-text');
        } catch (e) {
          console.error('Erro calculando Valor Hora Médio em DRE Budget-2', e);
        }
      }
    } catch (e) {
      console.error('Erro renderizando KeyRatiosBudget agregado em DRE Budget-2', e);
    }
  }
};
window.AbaDreBudget2 = AbaDreBudget2;
