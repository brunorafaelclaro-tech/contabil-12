
// Módulo da aba DRE Suécia (extraído de renderDRESuecia em script.js)
const AbaDreSuecia = {
  render: function(containerId, contexto) {
    // contexto: { year?, month?, type?, view?, data, planoContas, keyRatiosData, mgmtDetailData, isAdmAllocationSueciaEnabled, exemptCCs, dreDeptLayout, normalizeAccountDigits, getLastMonthHeads }
    const S = {
      data: contexto.data || [],
      planoContas: contexto.planoContas || [],
      keyRatiosData: contexto.keyRatiosData || [],
      mgmtDetailData: contexto.mgmtDetailData || {},
      isAdmAllocationSueciaEnabled: contexto.isAdmAllocationSueciaEnabled,
      exemptCCs: contexto.exemptCCs || [],
      dreDeptLayout: contexto.dreDeptLayout || null,
      normalizeAccountDigits: contexto.normalizeAccountDigits || (s=>String(s)),
      getLastMonthHeads: contexto.getLastMonthHeads || (function(){ return 0; })
    };

    // Preserve behavior: read DOM selects but allow contexto to override
    const tbody = document.getElementById('dre-suecia-body');
    const thead = tbody ? tbody.parentElement.querySelector('thead') : null;
    const yearSelect = document.getElementById('dre-suecia-year');
    const monthSelect = document.getElementById('dre-suecia-month');
    const typeSelect = document.getElementById('dre-suecia-type');
    const viewSelect = document.getElementById('dre-suecia-view');
    if (!tbody || !thead) return;
    tbody.innerHTML = '';

    // Populate years dropdown if needed (keeps original behavior)
    const years = Array.from(new Set((S.data||[]).map(d => d.ano))).sort().filter(Boolean);
    if (yearSelect && yearSelect.options.length === 0 && years.length > 0) {
      years.forEach(y => { const opt = document.createElement('option'); opt.value = y; opt.innerText = y; yearSelect.appendChild(opt); });
      yearSelect.value = years[years.length - 1];
    }

    const selectedYear = contexto.year || (yearSelect ? yearSelect.value : (new Date()).getFullYear());
    const selectedMonth = Number(contexto.month || (monthSelect ? Number(monthSelect.value) : (new Date()).getMonth()+1));
    const selectedType = contexto.type || (typeSelect ? typeSelect.value : 'accumulated');
    const selectedView = contexto.view || (viewSelect ? viewSelect.value : 'departamento');

    // Build mapping conta -> OCRA from planoContas
    const contabilToOcra = {};
    const ocraDesc = {};
    (S.planoContas || []).forEach(pc => {
      const red = String(pc.contaReduzida || '').trim();
      const ocra = String(pc.contaOCRA || '').trim();
      if (red && ocra) { contabilToOcra[red] = ocra; if (!ocraDesc[ocra]) ocraDesc[ocra] = pc.ocraDesc || pc.descricao || ''; }
    });

    // Filters object to be used when calling helpers (keeps parity with original calls)
    const filtros = contexto.filtros || { cc:'', dept:'', cli:'', sbd:'', proj:'' };

    const filteredData = (S.data || []).filter(item => {
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

    // --- Management Fee and KeyRatios aggregation (as original) ---
    const consultantCounts = {};
    const consultantHours = {};
    let totalConsultants = 0;

    const filteredKeyRatios = (S.keyRatiosData || []).filter(item => {
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

    valores['KR_COUNT'] = consultantCounts;
    valores['KR_HOURS'] = consultantHours;

    // Heads (monthly snapshot)
    const headsConsultantsSets = {};
    const headsADMSets = {};
    const filteredKeyRatiosHeads = (S.keyRatiosData || []).filter(item => {
      if (!item.ano || !item.mes) return false;
      if (String(item.ano) !== String(selectedYear)) return false;
      const itemMonth = parseInt(item.mes);
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
          if (depto === 'ADM') { if (!headsADMSets[groupKey]) headsADMSets[groupKey] = new Set(); headsADMSets[groupKey].add(name); }
          else { if (!headsConsultantsSets[groupKey]) headsConsultantsSets[groupKey] = new Set(); headsConsultantsSets[groupKey].add(name); }
        }
      }
    });

    const headsConsultants = {}; const headsADM = {};
    const allHeadsConsultantsSet = new Set(); const allHeadsADMSet = new Set();
    Object.keys(headsConsultantsSets).forEach(k => { headsConsultants[k] = headsConsultantsSets[k].size; headsConsultantsSets[k].forEach(name => allHeadsConsultantsSet.add(name)); });
    Object.keys(headsADMSets).forEach(k => { headsADM[k] = headsADMSets[k].size; headsADMSets[k].forEach(name => allHeadsADMSet.add(name)); });

    valores['KR_HEADS_CONS'] = headsConsultants;
    valores['KR_HEADS_ADM'] = headsADM;

    // Rateio ADM accumulation
    const admToDistribute = {};
    let totalHeadsForAllocation = 0;
    if (S.isAdmAllocationSueciaEnabled) {
      Object.keys(headsConsultants).forEach(k => { if (k !== 'ADM') totalHeadsForAllocation += headsConsultants[k]; });
    }

    if (S.mgmtDetailData && S.mgmtDetailData[selectedYear] && totalConsultants > 0) {
      const detailData = S.mgmtDetailData[selectedYear];
      ['ocra','calc'].forEach(rowKey => {
        const rowData = detailData[rowKey]; if (!rowData) return;
        let rowValue = 0;
        if (selectedType === 'monthly') rowValue = Number(rowData.values[selectedMonth]) || 0; else { for (let m=1;m<=selectedMonth;m++) rowValue += Number(rowData.values[m]) || 0; }
        if (rowValue !== 0) {
          const processMgmt = (val, type) => {
            const acc = String(type === 'debit' ? rowData.debit : rowData.credit).trim();
            if (!valores[acc]) valores[acc] = {};
            let eligibleGroups = Object.keys(consultantCounts);
            let totalForDiv = totalConsultants;
            if (S.isAdmAllocationSueciaEnabled) { eligibleGroups = eligibleGroups.filter(g => g !== 'ADM'); totalForDiv = eligibleGroups.reduce((sum,g)=>sum+(consultantCounts[g]||0),0); }
            if (totalForDiv > 0) { eligibleGroups.forEach(grp => { const count = consultantCounts[grp]; const share = (count/totalForDiv)*val; if (!valores[acc][grp]) valores[acc][grp]=0; valores[acc][grp]+=share; }); }
          };
          if (rowData.debit) processMgmt(rowValue,'debit'); if (rowData.credit) processMgmt(rowValue * -1,'credit');
        }
      });
    }

    filteredData.forEach(item => {
      if (!item.conta) return;
      let groupKey = '';
      if (selectedView === 'sbd') groupKey = String(item.sbd || 'Não Classificado').trim(); else if (selectedView === 'departamento') groupKey = String(item.departamento || 'Não Classificado').trim(); else groupKey = String(item.cliente || 'Não Classificado').trim();
      if (groupKey) columnsSet.add(groupKey);
      const contaOriginal = String(item.conta).trim(); const contaNum = Number(item.conta);
      let ocra = item.contaOCRA ? String(item.contaOCRA).trim() : ''; if (!ocra) ocra = contabilToOcra[contaOriginal] || contaOriginal;
      const valor = Number(item.valor) || 0;
      if (contaNum === 1902) { const ccToCheck = String(item.centroCusto || '').trim(); const isExempt = (S.exemptCCs||[]).includes(ccToCheck); if (!isExempt) { const taxValue = valor * -0.0925; if (!dynamicTax[groupKey]) dynamicTax[groupKey] = 0; dynamicTax[groupKey] += taxValue; } }

      const ignoredAccounts = ['8010','8022','8300','8360','8331','8390','8072','8400','8412','8460','8436','8490','8893','8820','8821','8828','8829','8890','8810','8935','8940','8980'];
      if (ignoredAccounts.includes(ocra) || ignoredAccounts.includes(String(contaNum))) return;
      if (ocra === '3204' || contaNum === 3204) return;
      if (ocra === '6430' || contaNum === 6430) return;
      if (ocra === '3010' && groupKey === 'ADM') return;

      if (S.isAdmAllocationSueciaEnabled && totalHeadsForAllocation > 0) {
        const deptoOriginal = String(item.departamento || '').trim().toUpperCase();
        if (deptoOriginal === 'ADM') { if (!admToDistribute[ocra]) admToDistribute[ocra] = 0; admToDistribute[ocra] += valor; return; }
      }

      if (!valores[ocra]) valores[ocra] = {};
      if (!valores[ocra][groupKey]) valores[ocra][groupKey] = 0;
      valores[ocra][groupKey] += valor;
    });

    // Apply ADM distribution
    if (S.isAdmAllocationSueciaEnabled && totalHeadsForAllocation > 0) {
      Object.keys(admToDistribute).forEach(ocra => {
        const totalAdm = admToDistribute[ocra]; if (totalAdm === 0) return;
        if (!valores[ocra]) valores[ocra] = {};
        let distributed = false; const targetCols = []; let totalTargetValue = 0;
        Object.keys(valores[ocra]).forEach(col => { if (col !== 'ADM') { const val = valores[ocra][col]; if ((totalAdm > 0 && val < 0) || (totalAdm < 0 && val > 0)) { targetCols.push(col); totalTargetValue += Math.abs(val); } } });
        if (targetCols.length > 0) { targetCols.forEach(col => { const share = (Math.abs(valores[ocra][col]) / totalTargetValue) * totalAdm; valores[ocra][col] += share; }); distributed = true; }
        if (!distributed) { Object.keys(headsConsultants).forEach(targetGroup => { if (targetGroup !== 'ADM') { const heads = headsConsultants[targetGroup]; if (heads > 0) { const share = (heads / totalHeadsForAllocation) * totalAdm; if (!valores[ocra][targetGroup]) valores[ocra][targetGroup] = 0; valores[ocra][targetGroup] += share; columnsSet.add(targetGroup); } } }); }
      });
    }

    // Revenue ordering and header
    const revenueAccounts = ['3010','3556','3557','3015','3095','3019','3018','3030','3204','3413','3040','3050','3110','3521','3910','3510','32101','3960','3973','3900'];
    const colRevenue = {};
    columnsSet.forEach(col => { colRevenue[col] = 0; revenueAccounts.forEach(acc => { let val = 0; if (acc === '3204') val = dynamicTax[col] || 0; else val = (valores[acc] && valores[acc][col]) ? valores[acc][col] : 0; colRevenue[col] += val; }); });
    const columns = Array.from(columnsSet).sort((a,b)=>{ if (a === 'ADM') return -1; if (b === 'ADM') return 1; return colRevenue[b] - colRevenue[a]; });

    // debug for columns removed

    thead.innerHTML = `<tr><th class='px-3 py-3 text-left'>Conta OCRA</th><th class='px-3 py-3 text-left'>Descrição</th>${columns.map(c => `<th class='px-3 py-3 text-right'>${c}</th>`).join('')}<th class='px-3 py-3 text-right font-bold'>TOTAL</th></tr>`;

    // Layout driven rendering if available
    const layout = [];
    if (S.dreDeptLayout) {
      for (const row of S.dreDeptLayout) {
        layout.push(row);
        if (row.id === 'gross_profit') layout.push({ type: 'calculation', id: 'gross_profit_pct', description: 'GROSS PROFIT %', formula: 'gross_profit / total_income', isPercentage: true });
        if (row.id === 'total_admin_costs') layout.push({ type: 'calculation', id: 'total_admin_costs_pct', description: 'Total administration costs %', formula: 'total_admin_costs / total_income', isPercentage: true });
        if (row.id === 'total_depreciation') layout.push({ type: 'calculation', id: 'total_depreciation_pct', description: 'Total depreciation %', formula: 'total_depreciation / total_income', isPercentage: true });
        if (row.id === 'total_sas') layout.push({ type: 'calculation', id: 'total_sas_pct', description: 'TOTAL SaS %', formula: 'total_sas / total_income', isPercentage: true });
        if (row.id === 'ebit') {
          layout.push({ type: 'calculation', id: 'ebit_pct', description: 'EBIT %', formula: 'ebit / total_income', isPercentage: true });
          layout.push({ type: 'header', description: 'Key Ratios', bg: 'bg-blue-100' });
          layout.push({ type: 'account', code: 'KR_HEADS_CONS', description: 'Heads Consultants', precision: 0 });
          layout.push({ type: 'account', code: 'KR_HEADS_ADM', description: 'Heads ADM', precision: 0 });
          layout.push({ type: 'account', code: 'KR_HOURS', description: 'Total hours' });
          // Nova linha: Average Fee = TOTAL INCOME / Total hours
          layout.push({ type: 'account', code: 'AVERAGE_FEE', description: 'Average Fee' });
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
        if (row.type === 'header') { tr.innerHTML = `<td class='px-3 py-2 font-bold' colspan="${3 + columns.length}">${row.description}</td>`; tbody.appendChild(tr); currentSectionTotal = {}; }
        else if (row.type === 'account') {
          const ocra = String(row.code).trim(); const desc = row.description || ocraDesc[ocra] || '';
          let html = `<td class='px-3 py-2'>${ocra}</td><td class='px-3 py-2'>${desc}</td>`; let rowTotal = 0; let hasValue = false;
          columns.forEach(col => {
            let valor = 0;
            // Average Fee calculation: uses savedTotals['total_income'] and valores['KR_HOURS'] per column
            if (ocra === 'AVERAGE_FEE') {
              const totalIncomeDept = (savedTotals['total_income'] && savedTotals['total_income'][col]) || 0;
              const totalHoursDept = (valores['KR_HOURS'] && valores['KR_HOURS'][col]) || 0;
              if (!totalHoursDept || totalHoursDept === 0) valor = 0; else valor = totalIncomeDept / totalHoursDept;
            } else {
              if (ocra === '3204') valor = dynamicTax[col] || 0; else valor = (valores[ocra] && valores[ocra][col]) ? valores[ocra][col] : 0;
            }
            if (ocra === 'KR_HEADS_CONS' && col === 'ADM') valor = 0;
            if (invertValues && !ocra.startsWith('KR_')) valor = valor * -1;
            // Garantir Average Fee positivo
            if (ocra === 'AVERAGE_FEE') valor = Math.abs(valor);
            if (valor !== 0) hasValue = true;
            rowTotal += valor; if (!currentSectionTotal[col]) currentSectionTotal[col] = 0; currentSectionTotal[col] += valor;
            const style = valor < 0 ? 'text-red-600' : 'text-gray-800'; const precision = row.precision !== undefined ? row.precision : 2;
            html += `<td class='px-3 py-2 text-right ${style}'>${valor !== 0 ? valor.toLocaleString('pt-BR', {minimumFractionDigits:precision, maximumFractionDigits:precision}) : '-'}</td>`;
          });

          // Para AVERAGE_FEE: o total (coluna TOTAL) não é soma das colunas, é TOTAL_INCOME_CONSOLIDADO / TOTAL_HOURS_CONSOLIDADO
          let finalRowTotal = rowTotal;
          if (ocra === 'AVERAGE_FEE') {
            let totalIncomeConsolidated = 0;
            let totalHoursConsolidated = 0;
            if (savedTotals['total_income']) { Object.keys(savedTotals['total_income']).forEach(c => { totalIncomeConsolidated += Number(savedTotals['total_income'][c]||0); }); }
            if (valores['KR_HOURS']) { Object.keys(valores['KR_HOURS']).forEach(c => { totalHoursConsolidated += Number(valores['KR_HOURS'][c]||0); }); }
            finalRowTotal = (totalHoursConsolidated && totalHoursConsolidated !== 0) ? (totalIncomeConsolidated / totalHoursConsolidated) : 0;
          }
          const rowStyle = finalRowTotal < 0 ? 'text-red-600' : 'text-gray-800';
          if (ocra === 'KR_HEADS_CONS') {
            try { const override = S.getLastMonthHeads(selectedYear, filtros, false); if (override && override > 0) rowTotal = override; } catch (e) { console.warn('Erro calculando override KR_HEADS_CONS', e); }
          } else if (ocra === 'KR_HEADS_ADM') {
            try { const override = S.getLastMonthHeads(selectedYear, filtros, true); if (override && override > 0) rowTotal = override; } catch (e) { console.warn('Erro calculando override KR_HEADS_ADM', e); }
          }
          const precision = row.precision !== undefined ? row.precision : 2;
          html += `<td class='px-3 py-2 text-right font-bold ${rowStyle}'>${finalRowTotal !== 0 ? finalRowTotal.toLocaleString('pt-BR', {minimumFractionDigits:precision, maximumFractionDigits:precision}) : '-'}</td>`;
          tr.innerHTML = html; if (hasValue) tbody.appendChild(tr);
        } else if (row.type === 'total' || row.type === 'calculation') {
          const bgClass = row.bg || 'bg-gray-100'; let html = `<td class='px-3 py-2 font-bold ${bgClass}'></td><td class='px-3 py-2 font-bold ${bgClass}'>${row.description}</td>`;
          let rowTotal = 0; if (row.id) savedTotals[row.id] = {};
          columns.forEach(col => {
            let total = 0;
            if (row.type === 'total') { total = currentSectionTotal[col] || 0; }
            else if (row.type === 'calculation' && row.formula) {
              const parts = row.formula.split(' ');
              if (parts.length >= 1) {
                total = (savedTotals[parts[0]] && savedTotals[parts[0]][col]) || 0;
                for (let i=1;i<parts.length;i+=2) {
                  const op = parts[i]; const nextId = parts[i+1]; const nextVal = (savedTotals[nextId] && savedTotals[nextId][col]) || 0;
                  if (op === '+') total += nextVal; else if (op === '-') total -= nextVal; else if (op === '/') { if (nextVal !== 0) total = (total / nextVal) * 100; else total = 0; }
                }
              }
            }
            rowTotal += total; if (row.id) savedTotals[row.id][col] = total;
            const style = total < 0 ? 'text-red-600' : 'text-gray-800'; const precision = row.precision !== undefined ? row.precision : 2;
            const displayVal = row.isPercentage ? `${total.toFixed(2)}%` : (total !== 0 ? total.toLocaleString('pt-BR', {minimumFractionDigits:precision, maximumFractionDigits:precision}) : '-');
            html += `<td class='px-3 py-2 text-right font-bold ${bgClass} ${style}'>${displayVal}</td>`;
          });
          let displayRowTotal = '';
          if (row.isPercentage && row.formula) {
            const parts = row.formula.split(' ');
            const sumRow = (id) => { if (!savedTotals[id]) return 0; return Object.values(savedTotals[id]).reduce((a,b)=>a+b,0); };
            let totalGlobal = sumRow(parts[0]);
            for (let i=1;i<parts.length;i+=2) { const op = parts[i]; const nextId = parts[i+1]; const nextVal = sumRow(nextId); if (op === '+') totalGlobal += nextVal; else if (op === '-') totalGlobal -= nextVal; else if (op === '/') { if (nextVal !== 0) totalGlobal = (totalGlobal / nextVal) * 100; else totalGlobal = 0; } }
            displayRowTotal = `${totalGlobal.toFixed(2)}%`;
          } else { displayRowTotal = rowTotal !== 0 ? rowTotal.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}) : '-'; }
          html += `<td class='px-3 py-2 text-right font-bold ${bgClass} ${rowTotal < 0 ? 'text-red-600' : 'text-gray-800'}'>${displayRowTotal}</td>`;
          tr.innerHTML = html; tbody.appendChild(tr);
          if (row.type === 'total') currentSectionTotal = {};
        }
      });
    }
  }
};
window.AbaDreSuecia = AbaDreSuecia;
