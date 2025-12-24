// Wrapper module for DRE Departamento renderer — initial extraction
(function(){
    window.AbaDreDepartamento = {
        render: function(viewId, ctx) {
            try {
                if (window.app && typeof window.app._renderDREDepartamentoLegacy === 'function') {
                    // delegate to legacy implementation while we progressively move logic here
                    return window.app._renderDREDepartamentoLegacy();
                }
            } catch (e) {
                console.error('AbaDreDepartamento.render failed delegating to legacy', e);
            }
            // minimal fallback: clear the container
            try {
                const tbody = document.getElementById('dre-departamento-body');
                if (tbody) tbody.innerHTML = '';
            } catch (e) {}
        }
    };
})();

// Módulo da aba DRE Departamento (extraído do legado em script.js)
const AbaDreDepartamento = {
  render: function(containerId, contexto) {
    try {
      // Mapear contexto para variáveis locais (substitui uso de `this` no legado)
      const data = contexto.data || [];
      const planoContas = contexto.planoContas || [];
      const mgmtFees = contexto.mgmtFees || [];
      const mgmtDetailData = contexto.mgmtDetailData || {};
      const keyRatiosData = (window.DataAPI && typeof DataAPI.getKeyRatiosData === 'function') ? DataAPI.getKeyRatiosData(contexto) : (contexto.keyRatiosData || []);
      const balanceData = contexto.balanceData || [];
      const exemptCCs = contexto.exemptCCs || [];
      const dreDeptLayout = contexto.dreDeptLayout || [];
      const isAdmAllocationSueciaEnabled = !!contexto.isAdmAllocationSueciaEnabled;
      const normalizeAccountDigits = contexto.normalizeAccountDigits || (s=>String(s||''));
      const getLastMonthHeads = contexto.getLastMonthHeads || (function(){ return 0; });

      const year = Number(contexto.year) || (new Date()).getFullYear();
      const month = Number(contexto.month) || (new Date()).getMonth() + 1;
      const type = contexto.type || 'accumulated';
      const filtros = contexto.filtros || {};
      const filterCC = filtros.cc || '';
      const filterDept = filtros.dept || '';
      const filterCli = filtros.client || '';
      const filterSBD = filtros.sbd || '';
      const filterProj = filtros.proj || '';

      // Localiza elementos do DOM (apenas tbody/thead; não sobrescrever cabeçalho/filters)
      const tbody = document.getElementById('dre-departamento-body');
      if (!tbody) {
        console.warn('AbaDreDepartamento: tbody #dre-departamento-body não encontrado');
        return;
      }
      const thead = tbody.parentElement ? tbody.parentElement.querySelector('thead') : null;

      // Popula select de anos se estiver vazio (comportamento legado preservado)
      const yearSelect = document.getElementById('dre-dept-year');
      if (yearSelect) {
        const years = Array.from(new Set((data||[]).map(d => d.ano))).sort().filter(Boolean);
        if (yearSelect.options.length === 0 && years.length > 0) {
          years.forEach(y => { const opt = document.createElement('option'); opt.value = y; opt.innerText = y; yearSelect.appendChild(opt); });
          yearSelect.value = years[years.length-1];
        }
      }

      // Limpa corpo
      try { tbody.innerHTML = ''; } catch(e) { console.error('AbaDreDepartamento: erro limpando tbody', e); }

      // Mapeia conta contábil -> OCRA
      const contabilToOcra = {};
      const ocraDesc = {};
      (planoContas || []).forEach(pc => {
        const red = String(pc.contaReduzida || '').trim();
        const ocra = String(pc.contaOCRA || '').trim();
        if (red && ocra) {
          contabilToOcra[red] = ocra;
          if (!ocraDesc[ocra]) ocraDesc[ocra] = pc.ocraDesc || pc.descricao || '';
        }
      });

      // Filtra dados conforme ano, mês, tipo (ignora Budget)
      const filteredData = (data || []).filter(item => {
        if (String(item.tipo || '').trim() === 'Budget') return false;
        if (!item.ano || !item.mes) return false;
        if (String(item.ano) !== String(year)) return false;
        const itemMonth = parseInt(item.mes);
        let ocra = item.contaOCRA ? String(item.contaOCRA).trim() : '';
        if (!ocra) ocra = contabilToOcra[String(item.conta).trim()] || String(item.conta).trim();
        const firstDigit = ocra.charAt(0);
        const isBalanceSheet = ['1','2'].includes(firstDigit);
        if (type === 'monthly') return itemMonth === month;
        if (isBalanceSheet) return itemMonth === month;
        return itemMonth <= month;
      });

      // Agrupa valores por conta OCRA e departamento
      const valores = {};
      const dynamicTax = {};
      const deptosSet = new Set();

      // Key Ratios (contagem/hours) - usado no rateio
      const consultantCounts = {};
      const consultantHours = {};
      const headsConsultantsSets = {};
      const headsADMSets = {};
      let totalConsultants = 0;

      const filteredKeyRatios = (keyRatiosData || []).filter(item => {
        if (!item.ano || !item.mes) return false;
        if (String(item.ano) !== String(year)) return false;
        const itemMonth = parseInt(item.mes);
        if (type === 'monthly') return itemMonth === month;
        return itemMonth <= month;
      });

      filteredKeyRatios.forEach(kr => {
        const depto = String(kr.departamento || '').trim();
        if (!depto) return;
        if (!consultantCounts[depto]) consultantCounts[depto] = 0;
        consultantCounts[depto] += 1;
        if (!consultantHours[depto]) consultantHours[depto] = 0;
        consultantHours[depto] += (Number(kr.hours) || 0);
        totalConsultants += 1;
        deptosSet.add(depto);
      });

      // Management fee detalhado (mgmtDetailData)
      if (mgmtDetailData && mgmtDetailData[year] && totalConsultants > 0) {
        const detailData = mgmtDetailData[year];
        ['ocra','calc'].forEach(rowKey => {
          const rowData = detailData[rowKey]; if (!rowData) return;
          let rowValue = 0;
          if (type === 'monthly') rowValue = Number(rowData.values[month]) || 0; else { for (let m=1;m<=month;m++) rowValue += Number(rowData.values[m]) || 0; }
          if (rowValue === 0) return;
          if (rowData.debit) {
            const acc = String(rowData.debit).trim(); if (!valores[acc]) valores[acc] = {};
            Object.keys(consultantCounts).forEach(depto => { const count = consultantCounts[depto]; const share = (count/totalConsultants)*rowValue; if (!valores[acc][depto]) valores[acc][depto]=0; valores[acc][depto]+=share; });
          }
          if (rowData.credit) {
            const acc = String(rowData.credit).trim(); if (!valores[acc]) valores[acc] = {};
            Object.keys(consultantCounts).forEach(depto => { const count = consultantCounts[depto]; const share = (count/totalConsultants)*rowValue*-1; if (!valores[acc][depto]) valores[acc][depto]=0; valores[acc][depto]+=share; });
          }
        });
      }

      // Processa linhas filtradas
      (filteredData || []).forEach(item => {
        if (!item.conta) return;
        const depto = String(item.departamento || '').trim(); if (depto) deptosSet.add(depto);
        const contaOriginal = String(item.conta).trim(); const contaNum = Number(item.conta);
        let ocra = item.contaOCRA ? String(item.contaOCRA).trim() : '';
        if (!ocra) ocra = contabilToOcra[contaOriginal] || contaOriginal;
        const valor = Number(item.valor) || 0;

        if (contaNum === 1902) {
          const ccToCheck = String(item.centroCusto || '').trim(); const isExempt = (exemptCCs||[]).includes(ccToCheck);
          if (!isExempt) {
            const taxValue = valor * -0.0925;
            if (!dynamicTax[depto]) dynamicTax[depto] = 0;
            dynamicTax[depto] += taxValue;
          }
        }

        const ignoredAccounts = ['8010','8022','8300','8360','8331','8390','8072','8400','8412','8460','8436','8490','8893','8820','8821','8828','8829','8890','8810','8935','8940','8980'];
        if (ignoredAccounts.includes(ocra) || ignoredAccounts.includes(String(contaNum))) return;
        if (ocra === '3204' || contaNum === 3204) return;
        if (ocra === '6430' || contaNum === 6430) return;
        if (ocra === '3010' && depto === 'ADM' && contaNum === 3190) return;

        if (!valores[ocra]) valores[ocra] = {};
        if (!valores[ocra][depto]) valores[ocra][depto] = 0;
        valores[ocra][depto] += valor;
      });

      // Balanço / Pos EBIT
      const filteredBalance = (balanceData || []).filter(item => {
        if (!item.ano || !item.mes) return false; if (String(item.ano) !== String(year)) return false; const itemMonth = parseInt(item.mes); return itemMonth === month;
      });
      filteredBalance.forEach(item => {
        const ocra = String(item.contaOCRA || item.contaReduzida || '').trim(); if (!ocra) return;
        if (!valores[ocra]) valores[ocra] = {};
        if (!valores[ocra]['BS/IT']) valores[ocra]['BS/IT'] = 0;
        valores[ocra]['BS/IT'] += Number(item.saldoFinal) || 0;
      });

      // Monta lista de departamentos (coluna BS/IT primeira)
      let departamentos = Array.from(deptosSet).sort();
      departamentos = departamentos.filter(d => d !== 'BS/IT' && d !== 'ADM');
      departamentos.unshift('BS/IT');
      if (deptosSet.has('ADM')) departamentos.push('ADM');

      // Cabeçalho
      if (thead) thead.innerHTML = `<tr><th class='px-3 py-3 text-left'>Conta OCRA</th><th class='px-3 py-3 text-left'>Descrição</th>${departamentos.map(d => `<th class='px-3 py-3 text-right'>${d}</th>`).join('')}<th class='px-3 py-3 text-right font-bold'>TOTAL</th></tr>`;

      const excludedBSITRows = ['total_revenue','total_other_income','total_income','total_prod_costs','gross_profit','total_admin_costs','total_depreciation','profit_before_sas','total_sas','ebit'];

      // Heads snapshot (monthly)
      const filteredKeyRatiosHeads = (keyRatiosData || []).filter(item => { if (!item.ano || !item.mes) return false; if (String(item.ano) !== String(year)) return false; const itemMonth = parseInt(item.mes); return itemMonth === month; });
      filteredKeyRatiosHeads.forEach(kr => { const depto = String(kr.departamento || '').trim(); if (!depto) return; const name = kr.name; if (name) { if (depto.toUpperCase() === 'ADM') { if (!headsADMSets[depto]) headsADMSets[depto] = new Set(); headsADMSets[depto].add(name); } else { if (!headsConsultantsSets[depto]) headsConsultantsSets[depto] = new Set(); headsConsultantsSets[depto].add(name); } } });

      const headsConsultants = {}; const headsADM = {}; const allHeadsConsultantsSet = new Set(); const allHeadsADMSet = new Set();
      Object.keys(headsConsultantsSets).forEach(k => { headsConsultants[k] = headsConsultantsSets[k].size; headsConsultantsSets[k].forEach(n=>allHeadsConsultantsSet.add(n)); });
      Object.keys(headsADMSets).forEach(k => { headsADM[k] = headsADMSets[k].size; headsADMSets[k].forEach(n=>allHeadsADMSet.add(n)); });

      valores['KR_HEADS_CONS'] = headsConsultants; valores['KR_HEADS_ADM'] = headsADM; valores['KR_HOURS'] = consultantHours;

      // Renderiza com layout se existir
      if (dreDeptLayout && dreDeptLayout.length > 0) {
        let currentSectionTotal = {};
        let savedTotals = {};
        let invertValues = false;
        const layout = [];
        for (const row of dreDeptLayout) {
          layout.push(row);
          if (row.id === 'total_equity_liab') {
            layout.push({ type: 'header', description: 'Key Ratios', bg: 'bg-blue-100' });
            layout.push({ type: 'account', code: 'KR_HEADS_CONS', description: 'Heads Consultants', precision: 0 });
            layout.push({ type: 'account', code: 'KR_HEADS_ADM', description: 'Heads ADM', precision: 0 });
            layout.push({ type: 'account', code: 'KR_HOURS', description: 'Total hours' });
            // Nova linha solicitada: Average Fee = TOTAL INCOME / Total hours
            layout.push({ type: 'account', code: 'AVERAGE_FEE', description: 'Average Fee' });
          }
        }

        layout.forEach(row => {
          if (row.id === 'total_income') invertValues = true;
          const tr = document.createElement('tr');
          if (row.type === 'header') { tr.innerHTML = `<td class='px-3 py-2 font-bold' colspan="${3 + departamentos.length}">${row.description}</td>`; tbody.appendChild(tr); }
          else if (row.type === 'account') {
            const ocra = String(row.code).trim(); const desc = row.description || ocraDesc[ocra] || '';
            let html = `<td class='px-3 py-2'>${ocra}</td><td class='px-3 py-2'>${desc}</td>`; let rowTotal = 0; let hasValue = false;
            departamentos.forEach(depto => {
              let valor = 0;
              if (['8820','8821'].includes(ocra)) {
                if (depto === 'BS/IT') { valor = (valores[ocra]) ? Object.values(valores[ocra]).reduce((a,b)=>a+(Number(b)||0),0) : 0; } else { valor = 0; }
              } else if (depto === 'BS/IT') {
                const firstDigit = ocra.charAt(0);
                if (['3','4','5','6','7'].includes(firstDigit)) { valor = 0; } else { valor = (valores[ocra] && valores[ocra]['BS/IT']) ? valores[ocra]['BS/IT'] : 0; }
              } else if (ocra === '6437') {
                // Complex ADM rateio logic (preserva comportamento legado)
                const admGrossProfit = (savedTotals['gross_profit'] && savedTotals['gross_profit']['ADM']) || 0;
                const admTotalAdminCosts = (savedTotals['total_admin_costs'] && savedTotals['total_admin_costs']['ADM']) || 0;
                const admTotalDepreciation = (savedTotals['total_depreciation'] && savedTotals['total_depreciation']['ADM']) || 0;
                const adm6430_val = (valores['6430'] && valores['6430']['ADM']) || 0;
                const adm6436_val = (valores['6436'] && valores['6436']['ADM']) || 0;
                const mgmtFeeSemconAB = ((mgmtFees || []).find(item => String(item.ano) === String(year) && String(item.mes) === String(month) && item.description === 'Management fee Semcon AB - Internal Business Area OH') || {}).valor || 0;
                const sumOfComponents = admGrossProfit + admTotalAdminCosts + admTotalDepreciation + (adm6430_val * -1) + (adm6436_val * -1) + (Number(mgmtFeeSemconAB) * -1);
                const totalAdmCostToRatePositive = Math.abs(sumOfComponents);
                const totalAdmCostToRateNegative = sumOfComponents;
                const consultantsPerDepto = valores['KR_HEADS_CONS'] || {};
                let totalConsultantsForRateio = 0; for (const k in consultantsPerDepto) { if (k !== 'ADM') totalConsultantsForRateio += Number(consultantsPerDepto[k]||0); }
                const rateioPorDeptoLocal = {};
                if (totalConsultantsForRateio === 0) { departamentos.forEach(dep => { rateioPorDeptoLocal[dep] = (dep==='ADM')? totalAdmCostToRatePositive:0; }); }
                else { departamentos.forEach(dep => { if (dep==='ADM') rateioPorDeptoLocal[dep]=totalAdmCostToRatePositive; else { const deptoConsultants=Number(consultantsPerDepto[dep])||0; rateioPorDeptoLocal[dep]=(deptoConsultants/totalConsultantsForRateio)*totalAdmCostToRateNegative; } }); }
                valor = (rateioPorDeptoLocal[depto]||0) * -1;
              } else if (ocra === 'AVERAGE_FEE') {
                // Average Fee = TOTAL INCOME / Total hours (safely)
                const totalIncomeDept = (savedTotals['total_income'] && savedTotals['total_income'][depto]) || 0;
                const totalHoursDept = (valores['KR_HOURS'] && valores['KR_HOURS'][depto]) || 0;
                if (!totalHoursDept || totalHoursDept === 0) {
                  valor = 0; // exibimos '-' depois no rendering quando zero
                } else {
                  valor = totalIncomeDept / totalHoursDept;
                }
              } else {
                if (ocra === '3204') valor = dynamicTax[depto] || 0; else valor = (valores[ocra] && valores[ocra][depto]) ? valores[ocra][depto] : 0;
              }

              if (invertValues) {
                const isFinancialIncome = ['8010','8022','8300','8360','8331','8390'].includes(ocra);
                if (depto === 'BS/IT' && ['8300','8331','8010','8022','8360','8390'].includes(ocra)) { valor = Math.abs(valor); }
                else if (!isFinancialIncome && !ocra.startsWith('KR_')) valor = valor * -1;
              }

              // Average Fee deve ser sempre positivo (não herdando inversão)
              if (ocra === 'AVERAGE_FEE') {
                valor = Math.abs(valor);
              }

              if (valor !== 0) hasValue = true; rowTotal += valor; if (!currentSectionTotal[depto]) currentSectionTotal[depto]=0; currentSectionTotal[depto]+=valor;
              const precision = row.precision !== undefined ? row.precision : 2;
              const style = valor < 0 ? 'text-red-600' : 'text-gray-800'; html += `<td class='px-3 py-2 text-right ${style}'>${valor !== 0 ? valor.toLocaleString('pt-BR',{minimumFractionDigits:precision, maximumFractionDigits:precision}) : '-'}</td>`;
            });

            // Overrides for KR totals
            if (ocra === 'KR_HEADS_CONS') {
              try { const override = getLastMonthHeads(year, {cc: filterCC, dept: filterDept, cli: filterCli, sbd: filterSBD, proj: filterProj}, false); if (override && override > 0) rowTotal = override; } catch(e) { console.warn('Erro override KR_HEADS_CONS', e); }
            } else if (ocra === 'KR_HEADS_ADM') {
              try { const override = getLastMonthHeads(year, {cc: filterCC, dept: filterDept, cli: filterCli, sbd: filterSBD, proj: filterProj}, true); if (override && override > 0) rowTotal = override; } catch(e) { console.warn('Erro override KR_HEADS_ADM', e); }
            }

            // Se for AVERAGE_FEE, o total (coluna final) deve ser calculado como TOTAL INCOME consolidado / TOTAL HOURS consolidado
            let finalRowTotal = rowTotal;
            if (ocra === 'AVERAGE_FEE') {
              // soma consolidada dos totais por departamento
              let totalIncomeConsolidated = 0;
              let totalHoursConsolidated = 0;
              if (savedTotals['total_income']) {
                Object.keys(savedTotals['total_income']).forEach(d => { totalIncomeConsolidated += Number(savedTotals['total_income'][d]||0); });
              }
              if (valores['KR_HOURS']) {
                Object.keys(valores['KR_HOURS']).forEach(d => { totalHoursConsolidated += Number(valores['KR_HOURS'][d]||0); });
              }
              finalRowTotal = (totalHoursConsolidated && totalHoursConsolidated !== 0) ? (totalIncomeConsolidated / totalHoursConsolidated) : 0;
            }

            const rowStyle = finalRowTotal < 0 ? 'text-red-600' : 'text-gray-800'; const precision = row.precision !== undefined ? row.precision : 2;
            html += `<td class='px-3 py-2 text-right font-bold ${rowStyle}'>${finalRowTotal !== 0 ? finalRowTotal.toLocaleString('pt-BR',{minimumFractionDigits:precision, maximumFractionDigits:precision}) : '-'}</td>`;
            tr.innerHTML = html; if (hasValue) tbody.appendChild(tr);
          } else if (row.type === 'total') {
            const bgClass = row.bg || 'bg-gray-100';
            let html = `<td class='px-3 py-2 font-bold ${bgClass}'></td><td class='px-3 py-2 font-bold ${bgClass}'>${row.description}</td>`;
            if (row.id) savedTotals[row.id] = { ...currentSectionTotal };

            let rowTotal = 0;
            departamentos.forEach(depto => {
              if (depto === 'BS/IT' && excludedBSITRows.includes(row.id)) {
                html += `<td class='px-3 py-2 text-right font-bold ${bgClass}'>-</td>`;
                return;
              }

              const total = currentSectionTotal[depto] || 0;
              rowTotal += total;
              const totalFormatado = total.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
              const style = total < 0 ? 'text-red-600' : 'text-gray-800';

              let percentHtml = '';
              const showPercent = ['total_admin_costs','total_depreciation','total_sas','total_fin_income','total_fin_expenses','total_appropriations','total_tax'].includes(row.id);
              if (showPercent) {
                const totalIncome = (savedTotals['total_income'] && savedTotals['total_income'][depto]) || 0;
                if (totalIncome !== 0) {
                  const percent = (total / totalIncome) * 100;
                  percentHtml = `<br><span class="text-xs text-gray-500">${percent.toFixed(1)}%</span>`;
                }
              }

              html += `<td class='px-3 py-2 text-right font-bold ${bgClass} ${style}'>${total !== 0 ? totalFormatado : '-'}${percentHtml}</td>`;
            });

            const rowStyle = rowTotal < 0 ? 'text-red-600' : 'text-gray-800';
            let rowPercentHtml = '';
            const showPercentRow = ['total_admin_costs','total_depreciation','total_sas','total_fin_income','total_fin_expenses','total_appropriations','total_tax'].includes(row.id);
            if (showPercentRow) {
              let totalIncomeConsolidated = 0;
              if (savedTotals['total_income']) Object.values(savedTotals['total_income']).forEach(v => totalIncomeConsolidated += v);
              if (totalIncomeConsolidated !== 0) {
                const percent = (rowTotal / totalIncomeConsolidated) * 100;
                rowPercentHtml = `<br><span class="text-xs text-gray-500">${percent.toFixed(1)}%</span>`;
              }
            }

            html += `<td class='px-3 py-2 text-right font-bold ${bgClass} ${rowStyle}'>${rowTotal !== 0 ? rowTotal.toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2}) : '-'}${rowPercentHtml}</td>`;
            const tr = document.createElement('tr'); tr.innerHTML = html; tbody.appendChild(tr);
            currentSectionTotal = {};
            if (row.description === 'Net profit or loss for the year') invertValues = false;

          } else if (row.type === 'calculation') {
            const bgClass = row.bg || 'bg-gray-100';
            let html = `<td class='px-3 py-2 font-bold ${bgClass}'></td><td class='px-3 py-2 font-bold ${bgClass}'>${row.description}</td>`;
            let rowTotal = 0;

            if (row.id) savedTotals[row.id] = {};

            departamentos.forEach(depto => {
              if (depto === 'BS/IT' && excludedBSITRows.includes(row.id)) {
                html += `<td class='px-3 py-2 text-right font-bold ${bgClass}'>-</td>`;
                return;
              }

              let result = 0;
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

              if (row.id) savedTotals[row.id][depto] = result;
              rowTotal += result;

              const resultFormatado = result.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
              const style = result < 0 ? 'text-red-600' : 'text-gray-800';

              let percentHtml = '';
              const showPercent = ['gross_profit','ebit','profit_before_taxes'].includes(row.id) || row.description === 'Net profit or loss for the year';
              if (showPercent) {
                const totalIncome = (savedTotals['total_income'] && savedTotals['total_income'][depto]) || 0;
                if (totalIncome !== 0) {
                  const percent = (result / totalIncome) * 100;
                  percentHtml = `<br><span class="text-xs text-gray-500">${percent.toFixed(1)}%</span>`;
                }
              }

              html += `<td class='px-3 py-2 text-right font-bold ${bgClass} ${style}'>${result !== 0 ? resultFormatado : '-'}${percentHtml}</td>`;
            });

            const rowStyle = rowTotal < 0 ? 'text-red-600' : 'text-gray-800';
            let rowPercentHtml = '';
            const showPercentRow = ['gross_profit','ebit','profit_before_taxes'].includes(row.id) || row.description === 'Net profit or loss for the year';
            if (showPercentRow) {
              let totalIncomeConsolidated = 0;
              if (savedTotals['total_income']) Object.values(savedTotals['total_income']).forEach(v => totalIncomeConsolidated += v);
              if (totalIncomeConsolidated !== 0) {
                const percent = (rowTotal / totalIncomeConsolidated) * 100;
                rowPercentHtml = `<br><span class="text-xs text-gray-500">${percent.toFixed(1)}%</span>`;
              }
            }

            html += `<td class='px-3 py-2 text-right font-bold ${bgClass} ${rowStyle}'>${rowTotal !== 0 ? rowTotal.toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2}) : '-'}${rowPercentHtml}</td>`;
            const tr = document.createElement('tr'); tr.innerHTML = html; tbody.appendChild(tr);
            if (row.description === 'Net profit or loss for the year') invertValues = false;
          }
        });
      } else {
        // fallback: render all contas
        Object.keys(valores).sort().forEach(ocra => { const tr = document.createElement('tr'); const desc = ocraDesc[ocra] || ''; let html = `<td class='px-3 py-2'>${ocra}</td><td class='px-3 py-2'>${desc}</td>`; departamentos.forEach(depto => { const valor = valores[ocra][depto] || 0; const style = valor < 0 ? 'text-red-600' : 'text-gray-800'; html += `<td class='px-3 py-2 text-right ${style}'>${valor !== 0 ? valor.toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2}) : '-'}</td>`; }); tr.innerHTML = html; tbody.appendChild(tr); });
      }

    } catch (err) {
      console.error('AbaDreDepartamento.render error:', err, contexto);
    }
  }
};
window.AbaDreDepartamento = AbaDreDepartamento;

// Expor impl e helper de preparação de contexto para migração incremental
window.AbaDreDepartamento.impl = AbaDreDepartamento;
window.AbaDreDepartamento.prepareCtx = function(appRef) {
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
    data: appRef.data || [],
    planoContas: appRef.planoContas || [],
    mgmtFees: appRef.mgmtFees || [],
    mgmtDetailData: appRef.mgmtDetailData || {},
    keyRatiosData: (window.DataAPI && typeof DataAPI.getKeyRatiosData === 'function') ? DataAPI.getKeyRatiosData(appRef) : (appRef.keyRatiosData || []),
    balanceData: appRef.balanceData || [],
    exemptCCs: appRef.exemptCCs || [],
    isAdmAllocationEnabled: !!appRef.isAdmAllocationEnabled,
    isAdmAllocationSueciaEnabled: !!appRef.isAdmAllocationSueciaEnabled,
    dreDeptLayout: appRef.dreDeptLayout || [],
    normalizeAccountDigits: (window.AppUtils && AppUtils.normalizeAccountDigits) || (s=>String(s||'')),
    getLastMonthHeads: appRef.getLastMonthHeads ? appRef.getLastMonthHeads.bind(appRef) : null
  };
  return ctx;
};

  // Computa os valores do DRE (sem renderizar DOM) e retorna mapa { ocra: { dept: valor } }
  window.AbaDreDepartamento.computeDREValues = function(contexto) {
    try {
      const data = contexto.data || [];
      const planoContas = contexto.planoContas || [];
      const mgmtFees = contexto.mgmtFees || [];
      const mgmtDetailData = contexto.mgmtDetailData || {};
      const keyRatiosData = contexto.keyRatiosData || [];
      const balanceData = contexto.balanceData || [];
      const exemptCCs = contexto.exemptCCs || [];
      const dreDeptLayout = contexto.dreDeptLayout || [];
      const year = Number(contexto.year) || (new Date()).getFullYear();
      const month = Number(contexto.month) || (new Date()).getMonth() + 1;
      const type = contexto.type || 'accumulated';

      // Mapeia conta contábil -> OCRA
      const contabilToOcra = {};
      const ocraDesc = {};
      (planoContas || []).forEach(pc => {
        const red = String(pc.contaReduzida || '').trim();
        const ocra = String(pc.contaOCRA || '').trim();
        if (red && ocra) {
          contabilToOcra[red] = ocra;
          if (!ocraDesc[ocra]) ocraDesc[ocra] = pc.ocraDesc || pc.descricao || '';
        }
      });

      const normalize = (s => String(s||'').replace(/\D/g, ''));
      const filteredData = (data || []).filter(item => {
        if (String(item.tipo || '').trim() === 'Budget') return false;
        if (!item.ano || !item.mes) return false;
        if (String(item.ano) !== String(year)) return false;
        const itemMonth = parseInt(item.mes);
        let ocra = item.contaOCRA ? String(item.contaOCRA).trim() : '';
        if (!ocra) ocra = contabilToOcra[String(item.conta).trim()] || String(item.conta).trim();
        const firstDigit = ocra.charAt(0);
        const isBalanceSheet = ['1','2'].includes(firstDigit);
        if (type === 'monthly') return itemMonth === month;
        if (isBalanceSheet) return itemMonth === month;
        return itemMonth <= month;
      });

      const valores = {};
      const dynamicTax = {};
      const deptosSet = new Set();

      // Key ratios
      const consultantCounts = {};
      let totalConsultants = 0;
      const filteredKeyRatios = (keyRatiosData || []).filter(item => {
        if (!item.ano || !item.mes) return false;
        if (String(item.ano) !== String(year)) return false;
        const itemMonth = parseInt(item.mes);
        if (type === 'monthly') return itemMonth === month;
        return itemMonth <= month;
      });
      filteredKeyRatios.forEach(kr => {
        const depto = String(kr.departamento || '').trim(); if (!depto) return;
        if (!consultantCounts[depto]) consultantCounts[depto] = 0; consultantCounts[depto] += 1; totalConsultants += 1; deptosSet.add(depto);
      });

      // Mgmt detail
      if (mgmtDetailData && mgmtDetailData[year] && totalConsultants > 0) {
        const detailData = mgmtDetailData[year];
        ['ocra','calc'].forEach(rowKey => {
          const rowData = detailData[rowKey]; if (!rowData) return;
          let rowValue = 0;
          if (type === 'monthly') rowValue = Number(rowData.values[month]) || 0; else { for (let m=1;m<=month;m++) rowValue += Number(rowData.values[m]) || 0; }
          if (rowValue === 0) return;
          if (rowData.debit) {
            const acc = String(rowData.debit).trim(); if (!valores[acc]) valores[acc] = {};
            Object.keys(consultantCounts).forEach(depto => { const share = (consultantCounts[depto] / totalConsultants) * rowValue; if (!valores[acc][depto]) valores[acc][depto]=0; valores[acc][depto]+=share; });
          }
          if (rowData.credit) {
            const acc = String(rowData.credit).trim(); if (!valores[acc]) valores[acc] = {};
            Object.keys(consultantCounts).forEach(depto => { const share = (consultantCounts[depto] / totalConsultants) * rowValue * -1; if (!valores[acc][depto]) valores[acc][depto]=0; valores[acc][depto]+=share; });
          }
        });
      }

      (filteredData || []).forEach(item => {
        if (!item.conta) return;
        const depto = String(item.departamento || '').trim(); if (depto) deptosSet.add(depto);
        const contaOriginal = String(item.conta).trim(); const contaNum = Number(item.conta);
        let ocra = item.contaOCRA ? String(item.contaOCRA).trim() : '';
        if (!ocra) ocra = contabilToOcra[contaOriginal] || contaOriginal;
        const valor = Number(item.valor) || 0;
        if (contaNum === 1902) {
          const ccToCheck = String(item.centroCusto || '').trim(); const isExempt = (exemptCCs||[]).includes(ccToCheck);
          if (!isExempt) { const taxValue = valor * -0.0925; if (!dynamicTax[depto]) dynamicTax[depto] = 0; dynamicTax[depto] += taxValue; }
        }
        const ignoredAccounts = ['8010','8022','8300','8360','8331','8390','8072','8400','8412','8460','8436','8490','8893','8820','8821','8828','8829','8890','8810','8935','8940','8980'];
        if (ignoredAccounts.includes(ocra) || ignoredAccounts.includes(String(contaNum))) return;
        if (ocra === '3204' || contaNum === 3204) return;
        if (ocra === '6430' || contaNum === 6430) return;
        if (!valores[ocra]) valores[ocra] = {};
        if (!valores[ocra][depto]) valores[ocra][depto] = 0;
        valores[ocra][depto] += valor;
      });

      Object.keys(dynamicTax).forEach(depto => { if (!valores['3204']) valores['3204'] = {}; if (!valores['3204'][depto]) valores['3204'][depto] = 0; valores['3204'][depto] += dynamicTax[depto]; });

      const filteredBalance = (balanceData || []).filter(item => { if (!item.ano || !item.mes) return false; if (String(item.ano) !== String(year)) return false; const itemMonth = parseInt(item.mes); return itemMonth === month; });
      filteredBalance.forEach(item => { const ocra = String(item.contaOCRA || item.contaReduzida || '').trim(); if (!ocra) return; if (!valores[ocra]) valores[ocra] = {}; if (!valores[ocra]['BS/IT']) valores[ocra]['BS/IT'] = 0; valores[ocra]['BS/IT'] += Number(item.saldoFinal) || 0; });
      deptosSet.add('BS/IT');

      // Agora iteramos o layout e calculamos os valores finais conforme DRE (sem DOM)
      const departamentos = (() => { let arr = Array.from(deptosSet).sort(); arr = arr.filter(d => d !== 'BS/IT' && d !== 'ADM'); arr.unshift('BS/IT'); if (deptosSet.has('ADM')) arr.push('ADM'); return arr; })();

      const dreMap = {};
      const savedTotals = {};
      let currentSectionTotal = {};
      let invertValues = false;

      // Monta um layout local igual ao render (possível AVERAGE_FEE adicionado)
      const layout = [];
      for (const row of (dreDeptLayout || [])) {
        layout.push(row);
        if (row.id === 'total_equity_liab') {
          layout.push({ type: 'header', description: 'Key Ratios', bg: 'bg-blue-100' });
          layout.push({ type: 'account', code: 'KR_HEADS_CONS', description: 'Heads Consultants', precision: 0 });
          layout.push({ type: 'account', code: 'KR_HEADS_ADM', description: 'Heads ADM', precision: 0 });
          layout.push({ type: 'account', code: 'KR_HOURS', description: 'Total hours' });
          layout.push({ type: 'account', code: 'AVERAGE_FEE', description: 'Average Fee' });
        }
      }

      layout.forEach(row => {
        if (row.id === 'total_income') invertValues = true;
        if (row.type === 'account') {
          const ocra = String(row.code).trim();
          departamentos.forEach(depto => {
            if (!dreMap[ocra]) dreMap[ocra] = {};
            let valor = 0;
            if (['8820','8821'].includes(ocra)) { if (depto === 'BS/IT') { valor = (valores[ocra]) ? Object.values(valores[ocra]).reduce((a,b)=>a+(Number(b)||0),0) : 0; } else { valor = 0; } }
            else if (depto === 'BS/IT') { const firstDigit = ocra.charAt(0); if (['3','4','5','6','7'].includes(firstDigit)) { valor = 0; } else { valor = (valores[ocra] && valores[ocra]['BS/IT']) ? valores[ocra]['BS/IT'] : 0; } }
            else { valor = (valores[ocra] && valores[ocra][depto]) ? valores[ocra][depto] : 0; const firstDigit = ocra.charAt(0); if (['8','9'].includes(firstDigit)) valor = 0; }
            if (ocra === '3010') { if (depto === 'ADM') { valor = 0; } else { let totalRevenue = 0; const revenueAccounts = ['3010','3556','3557','3015','3095','3019','3018','3030','3204']; revenueAccounts.forEach(acc => { let valAcc = 0; if (depto === 'BS/IT') valAcc = 0; else valAcc = (valores[acc] && valores[acc][depto]) ? valores[acc][depto] : 0; totalRevenue += valAcc; }); valor = totalRevenue; } }

            // Aplicar inversão similar ao render
            if (invertValues) {
              const isFinancialIncome = ['8010','8022','8300','8360','8331','8390'].includes(ocra);
              if (depto === 'BS/IT' && ['8300','8331','8010','8022','8360','8390'].includes(ocra)) { valor = Math.abs(valor); }
              else if (!isFinancialIncome && !ocra.startsWith('KR_')) valor = valor * -1;
            }

            // Average Fee sempre positivo
            if (ocra === 'AVERAGE_FEE') valor = Math.abs(valor);

            dreMap[ocra][depto] = (dreMap[ocra][depto] || 0) + valor;
            if (valor !== 0) currentSectionTotal[depto] = (currentSectionTotal[depto] || 0) + valor;
          });

          // Mantém savedTotals quando necessário
          if (row.type === 'account' && row.id) {
            if (!savedTotals[row.id]) savedTotals[row.id] = {};
            departamentos.forEach(depto => { savedTotals[row.id][depto] = dreMap[row.code] ? (dreMap[row.code][depto] || 0) : 0; });
          }
        } else if (row.type === 'total' || row.type === 'calculation') {
          if (row.id) savedTotals[row.id] = { ...currentSectionTotal };
          currentSectionTotal = {};
          if (row.description === 'Net profit or loss for the year') invertValues = false;
        }
      });

      // Ajustes finais para AVERAGE_FEE usando savedTotals e KR_HOURS
      if (dreMap['AVERAGE_FEE']) {
        let totalIncomeConsolidated = 0, totalHoursConsolidated = 0;
        if (savedTotals['total_income']) Object.keys(savedTotals['total_income']).forEach(d => totalIncomeConsolidated += Number(savedTotals['total_income'][d]||0));
        if (valores['KR_HOURS']) Object.keys(valores['KR_HOURS']).forEach(d => totalHoursConsolidated += Number(valores['KR_HOURS'][d]||0));
        const avg = (totalHoursConsolidated && totalHoursConsolidated !== 0) ? (totalIncomeConsolidated / totalHoursConsolidated) : 0;
        departamentos.forEach(depto => { dreMap['AVERAGE_FEE'][depto] = avg; });
      }

      return { dreMap, valores, savedTotals };
    } catch (e) {
      console.error('computeDREValues failed', e);
      return { dreMap: {}, valores: {}, savedTotals: {} };
    }
  };
// Extrai a geração do relatório OCRA para este módulo.
window.AbaDreDepartamento.generateOcraReport = function(appRef) {
  try {
    const ctx = (typeof window.AbaDreDepartamento.prepareCtx === 'function') ? window.AbaDreDepartamento.prepareCtx(appRef) : {
      year: (new Date()).getFullYear(),
      month: (new Date()).getMonth() + 1,
      data: appRef.data || [],
      planoContas: appRef.planoContas || [],
      keyRatiosData: appRef.keyRatiosData || [],
      mgmtDetailData: appRef.mgmtDetailData || {},
      mgmtFees: appRef.mgmtFees || [],
      balanceData: appRef.balanceData || [],
      exemptCCs: appRef.exemptCCs || [],
      dreDeptLayout: appRef.dreDeptLayout || [],
      ocraConfig: appRef.ocraConfig || []
    };

    // Reaproveita a mesma lógica que existia no script.js, mas usando o contexto
    const yearEl = document.getElementById('ocra-export-year');
    const monthEl = document.getElementById('ocra-export-month');
    if (!yearEl || !monthEl) {
      if (appRef && typeof appRef.showToast === 'function') appRef.showToast("Erro: Filtros de exportação não encontrados.", true);
      return;
    }

    const selectedYear = parseInt(yearEl.value);
    const selectedMonth = parseInt(monthEl.value);
    const selectedType = 'ytd';

    // Garantir que o contexto usado por computeDREValues reflita os filtros de export (OCRA)
    try {
      if (ctx) {
        ctx.year = selectedYear;
        ctx.month = selectedMonth;
        ctx.type = selectedType;
      }
    } catch (e) {
      console.warn('Não foi possível sobrescrever ctx.year/ctx.month para export OCRA', e);
    }

    const normalize = (typeof ctx.normalizeAccountDigits === 'function') ? ctx.normalizeAccountDigits : (s => String(s || '').replace(/\D/g, ''));
    const contabilToOcra = {};
    (ctx.planoContas || []).forEach(p => {
      if (p.contaReduzida && p.contaOCRA) {
        const key = String(normalize(String(p.contaReduzida))).trim();
        contabilToOcra[key] = String(p.contaOCRA).trim();
      }
    });

    // Debug helpers (temporários) - habilitar definindo `app.ocraDebug = true`
    const _ocraDebugContribs = [];
    // Detecta flag de debug também em `window.app.ocraDebug` ou `window.ocraDebug` para casos
    // em que o stub inicial foi sobrescrito por `window.app = app` durante a inicialização.
    const _ocraDebug = !!(
      (appRef && appRef.ocraDebug) ||
      (typeof window !== 'undefined' && window.app && window.app.ocraDebug) ||
      (typeof window !== 'undefined' && window.ocraDebug)
    );

    const filteredData = (ctx.data || []).filter(item => {
      if (!item.ano || !item.mes) return false;
      if (String(item.ano) !== String(selectedYear)) return false;
      const itemMonth = parseInt(item.mes);
      return itemMonth <= selectedMonth;
    });

    const valores = {};
    const deptosSet = new Set();

    const consultantCounts = {};
    let totalConsultants = 0;
    const filteredKeyRatios = (ctx.keyRatiosData || []).filter(item => {
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

    if (ctx.mgmtDetailData && ctx.mgmtDetailData[selectedYear] && totalConsultants > 0) {
      const detailData = ctx.mgmtDetailData[selectedYear];
      ['ocra','calc'].forEach(rowKey => {
        const rowData = detailData[rowKey]; if (!rowData) return;
        let rowValue = 0;
        if (selectedType === 'monthly') rowValue = Number(rowData.values[selectedMonth]) || 0; else { for (let m=1;m<=selectedMonth;m++) rowValue += Number(rowData.values[m]) || 0; }
        if (rowValue === 0) return;
        if (rowData.debit) {
          const acc = String(rowData.debit).trim(); if (!valores[acc]) valores[acc] = {};
          Object.keys(consultantCounts).forEach(depto => { const share = (consultantCounts[depto] / totalConsultants) * rowValue; if (!valores[acc][depto]) valores[acc][depto]=0; valores[acc][depto]+=share; });
        }
        if (rowData.credit) {
          const acc = String(rowData.credit).trim(); if (!valores[acc]) valores[acc] = {};
          Object.keys(consultantCounts).forEach(depto => { const share = (consultantCounts[depto] / totalConsultants) * rowValue * -1; if (!valores[acc][depto]) valores[acc][depto]=0; valores[acc][depto]+=share; });
        }
      });
    }

    const dynamicTax = {};
    (filteredData || []).forEach(item => {
      if (!item.conta || !item.departamento) return;
      const depto = String(item.departamento || '').trim(); if (depto) deptosSet.add(depto);
      const contaOriginalRaw = String(item.conta).trim();
      const contaOriginal = String(normalize(contaOriginalRaw)).trim();
      const contaNum = Number(contaOriginalRaw);
      let ocra = item.contaOCRA ? String(item.contaOCRA).trim() : '';
      if (!ocra) ocra = contabilToOcra[contaOriginal] || contaOriginal;
      const valor = Number(item.valor) || 0;
      if (_ocraDebug) _ocraDebugContribs.push({ contaOriginalRaw, contaOriginal, contaNum, ocra, depto, valor, centroCusto: item.centroCusto, contaOCRA: item.contaOCRA });
      if (contaNum === 1902) {
        const ccToCheck = String(item.centroCusto || '').trim(); const isExempt = (ctx.exemptCCs||[]).includes(ccToCheck);
        if (!isExempt) { const taxValue = valor * -0.0925; if (!dynamicTax[depto]) dynamicTax[depto] = 0; dynamicTax[depto] += taxValue; }
      }
      const ignoredAccounts = ['8010','8022','8300','8360','8331','8390','8072','8400','8412','8460','8436','8490','8893','8820','8821','8828','8829','8890','8810','8935','8940','8980'];
      if (ignoredAccounts.includes(ocra) || ignoredAccounts.includes(String(contaNum))) return;
      if (ocra === '3204' || contaNum === 3204) return;
      if (ocra === '6430' || contaNum === 6430) return;
      if (!valores[ocra]) valores[ocra] = {};
      if (!valores[ocra][depto]) valores[ocra][depto] = 0;
      valores[ocra][depto] += valor;
    });

    Object.keys(dynamicTax).forEach(depto => { if (!valores['3204']) valores['3204'] = {}; if (!valores['3204'][depto]) valores['3204'][depto] = 0; valores['3204'][depto] += dynamicTax[depto]; });

    // Debug output: mapa, contribuições e totais por OCRA
    if (_ocraDebug) {
      try {
        console.group('AbaDreDepartamento OCRA Debug', selectedYear, selectedMonth);
        console.log('contabilToOcra (map) ->', contabilToOcra);
        console.log('contribuicoes (amostra, primeiro 200) ->', _ocraDebugContribs.slice(0,200));
        console.log('valores (por OCRA -> por depto) ->', valores);
        console.log('dynamicTax ->', dynamicTax);
        const _ocraTotals = {};
        Object.keys(valores).forEach(k => { _ocraTotals[k] = Object.values(valores[k]||{}).reduce((a,b)=>a+(Number(b)||0),0); });
        console.log('ocraTotals (soma por OCRA) ->', _ocraTotals);
        console.groupEnd();
      } catch (e) { console.warn('Erro ao imprimir debug OCRA', e); }
    }

    const filteredBalance = (ctx.balanceData || []).filter(item => { if (!item.ano || !item.mes) return false; if (String(item.ano) !== String(selectedYear)) return false; const itemMonth = parseInt(item.mes); return itemMonth === selectedMonth; });
    filteredBalance.forEach(item => { const ocra = String(item.contaOCRA || item.contaReduzida || '').trim(); if (!ocra) return; if (!valores[ocra]) valores[ocra] = {}; if (!valores[ocra]['BS/IT']) valores[ocra]['BS/IT'] = 0; valores[ocra]['BS/IT'] += Number(item.saldoFinal) || 0; });
    deptosSet.add('BS/IT');

    let departamentos = Array.from(deptosSet).sort(); departamentos = departamentos.filter(d => d !== 'BS/IT' && d !== 'ADM'); departamentos.unshift('BS/IT'); if (deptosSet.has('ADM')) departamentos.push('ADM');

    let ocraConfigList = ctx.ocraConfig || [];
    if (!Array.isArray(ocraConfigList)) { if (ocraConfigList && ocraConfigList.companyNum) ocraConfigList = [ocraConfigList]; else ocraConfigList = []; }

    // Em vez de recalcular aqui, usamos computeDREValues para garantir paridade exata com o que
    // é mostrado na tela DRE Departamento. computeDREValues aplica as mesmas regras de layout,
    // inversões e cálculos auxiliares (dynamicTax, mgmtDetail, AVERAGE_FEE etc.).
    const exportList = [];
    const tableBody = document.getElementById('ocra-report-body'); if (tableBody) tableBody.innerHTML = '';
    const admConfig = ocraConfigList.find(c => c.department === 'ADM') || {}; const admCompanyNum = admConfig.companyNum || '';

    // Computa DRE values com a função reutilizável
    const { dreMap } = window.AbaDreDepartamento.computeDREValues(ctx);

    // Itera dreMap para construir exportList (Account x Departamento) aplicando normalização de sinais
    Object.keys(dreMap || {}).forEach(acc => {
      // Excluir conta 3204 da exportação
      if (String(acc).trim() === '3204') return;
      Object.keys(dreMap[acc] || {}).forEach(depto => {
        const companyNum = (ocraConfigList.find(c => c.department === depto) || {}).companyNum || admCompanyNum || '';
        const deptNum = (ocraConfigList.find(c => c.department === depto) || {}).deptNum || '';
        const raw = Number(dreMap[acc][depto] || 0);
        let norm = (typeof window.applyOcraSignRule === 'function') ? window.applyOcraSignRule(acc, raw) : raw;
        // Forçar inversão de 4040 na coluna ADM conforme regra específica
        if (String(acc).trim() === '4040' && String(depto).trim() === 'ADM') {
          norm = -Math.abs(norm);
        }
        if (norm !== 0) {
          exportList.push({ Company: companyNum, Departamento: deptNum, Account: acc, Amount: norm });
        }
      });
    });

    // Antes de exportar, garantir que as contas P&L listadas usem os valores do DRE (para paridade com a tela)
    const forceAccounts = ['3010','4040','4730','5010','6110','6990','7004','7110','7210','7500','7615','7850','7860'];
    // Reconstruir exportMap a partir de dreMap para evitar qualquer discrepância
    const finalExportMap = {};
    Object.keys(dreMap || {}).forEach(acc => {
      // Excluir conta 3204 da exportação
      if (String(acc).trim() === '3204') return;
      Object.keys(dreMap[acc] || {}).forEach(depto => {
        const key = acc + '||' + depto;
        finalExportMap[key] = Number(dreMap[acc][depto] || 0);
      });
    });

    // Recria exportList garantindo paridade com dreMap e aplicando normalização de sinais
    const enforcedExportList = [];
    Object.keys(finalExportMap).forEach(k => {
      const parts = k.split('||'); const acc = parts[0] || ''; const dept = parts[1] || '';
      const companyNum = (ocraConfigList.find(c => c.department === dept) || {}).companyNum || admCompanyNum || '';
      const deptNum = (ocraConfigList.find(c => c.department === dept) || {}).deptNum || '';
      const raw = finalExportMap[k];
      let norm = (typeof window.applyOcraSignRule === 'function') ? window.applyOcraSignRule(acc, raw) : raw;
      if (String(acc).trim() === '4040' && String(dept).trim() === 'ADM') {
        norm = -Math.abs(norm);
      }
      enforcedExportList.push({ Company: companyNum, Departamento: deptNum, Account: acc, Amount: norm });
    });

    // Preenche preview de até 100 linhas com a lista forçada
    if (tableBody) {
      enforcedExportList.slice(0,100).forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="px-3 py-2">${r.Company}</td><td class="px-3 py-2">${r.Departamento}</td><td class="px-3 py-2">${r.Account}</td><td class="px-3 py-2 text-right">${Number(r.Amount).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>`;
        tableBody.appendChild(tr);
      });
    }

    if (!tableBody && exportList.length === 0) {
      if (appRef && typeof appRef.showToast === 'function') appRef.showToast('Nenhum dado encontrado para os filtros selecionados.', true);
      return;
    }

    // Se habilitado debug forçado, gere um arquivo com 3 abas: Export / DRE Values / Diff
    try {
      // Forçar modo debug para sempre gerar a comparação (Diff) durante investigação
      // Isso assegura que o arquivo exportado contenha 'OCRA Export', 'DRE Values' e 'Diff'
      // permitindo identificar rapidamente discrepâncias sem usar o console.
      const shouldDebugForce = false;
      if (shouldDebugForce) {
        // Computa DRE values via helper
        const { dreMap } = window.AbaDreDepartamento.computeDREValues(ctx);

        // Flatten exportList into map for comparison
        const exportMap = {};
        exportList.forEach(row => {
          const acc = String(row.Account || '').trim();
          const dept = String(row.Departamento || '').trim();
          const key = acc + '||' + dept;
          exportMap[key] = (exportMap[key] || 0) + Number(row.Amount || 0);
        });

        // Build sheets data
        const exportSheet = exportList.map(r => ({ Company: r.Company, Departamento: r.Departamento, Account: r.Account, Amount: Number(r.Amount) }));

        const dreRows = [];
        Object.keys(dreMap || {}).forEach(acc => {
              // Excluir conta 3204 da exportação
              if (String(acc).trim() === '3204') return;
              Object.keys(dreMap[acc] || {}).forEach(depto => {
                dreRows.push({ Account: acc, Departamento: depto, DRE_Value: Number(dreMap[acc][depto] || 0) });
              });
            });

        // Build diff rows (union of keys)
        const allKeys = new Set();
        exportSheet.forEach(r => allKeys.add(r.Account + '||' + r.Departamento));
        dreRows.forEach(r => allKeys.add(r.Account + '||' + r.Departamento));

        const diffRows = [];
        allKeys.forEach(k => {
          const parts = k.split('||');
          const acc = parts[0] || '';
          const dept = parts[1] || '';
          const exp = exportMap[k] || 0;
          const dreVal = (dreMap[acc] && dreMap[acc][dept]) ? Number(dreMap[acc][dept]) : 0;
          diffRows.push({ Account: acc, Departamento: dept, DRE_Value: dreVal, Export_Value: exp, Delta: (exp - dreVal) });
        });

        const wb = XLSX.utils.book_new();
        const ws1 = XLSX.utils.json_to_sheet(exportSheet);
        const ws2 = XLSX.utils.json_to_sheet(dreRows);
        const ws3 = XLSX.utils.json_to_sheet(diffRows);
        XLSX.utils.book_append_sheet(wb, ws1, 'OCRA Export');
        XLSX.utils.book_append_sheet(wb, ws2, 'DRE Values');
        XLSX.utils.book_append_sheet(wb, ws3, 'Diff');
        XLSX.writeFile(wb, `OCRA_Comparison_${selectedYear}_${selectedMonth}.xlsx`);
        if (appRef && typeof appRef.showToast === 'function') appRef.showToast(`Comparação OCRA gerada (Diff: ${diffRows.length} linhas).`);
      } else {
        const ws = XLSX.utils.json_to_sheet(exportList);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "OCRA Report");
        XLSX.writeFile(wb, `OCRA_Report_${selectedYear}_${selectedMonth}.xlsx`);
        if (appRef && typeof appRef.showToast === 'function') appRef.showToast(`Relatório gerado com ${exportList.length} linhas.`);
      }
    } catch (e) {
      console.error('Erro ao gerar arquivo OCRA/debug', e);
      if (appRef && typeof appRef.showToast === 'function') appRef.showToast('Erro ao gerar relatório OCRA.', true);
    }
  } catch (err) {
    console.error('AbaDreDepartamento.generateOcraReport failed', err);
    if (appRef && typeof appRef.showToast === 'function') appRef.showToast('Erro ao gerar relatório OCRA.', true);
  }
};
