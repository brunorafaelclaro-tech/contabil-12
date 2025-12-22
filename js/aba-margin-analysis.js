window.AbaMarginAnalysis = (function(){
    function formatCurrency(value) { return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

    function safeNumber(v){ return Number(v) || 0; }

    return {
        render(containerId, ctx) {
            try {
                const year = ctx.year || (new Date()).getFullYear();
                const filtros = ctx.filtros || {};
                const groupBy = filtros.groupBy || 'cliente';
                const periodType = filtros.periodType || 'ytd';
                const monthSelected = filtros.monthSelected || (new Date().getMonth()+1);

                const compareBudgetEl = document.getElementById('margin-compare-budget');
                const compareBudget = compareBudgetEl ? compareBudgetEl.checked : false;
                const fontSizeHeader = compareBudget ? '12px' : '10px';
                const fontSizeCell = fontSizeHeader;

                const headerMap = {
                    centroCusto: "Centro de Custo", departamento: "Departamento", cliente: "Cliente",
                    sbd: "SB/D", projectType: "Project Type"
                };
                const headerEl = document.getElementById('margin-group-header');
                if (headerEl) headerEl.innerText = headerMap[groupBy] || headerMap.cliente;

                // filters from contexto (fallback to DOM where appropriate)
                const filterCC = filtros.cc || '';
                const filterDept = filtros.dept || '';
                const filterCli = filtros.client || '';
                const filterSBD = filtros.sbd || '';
                const filterProj = filtros.proj || '';

                const tbody = document.getElementById('margin-analysis-body');
                if (!tbody) return;
                tbody.innerHTML = '';

                const data = ctx.data || [];
                const keyRatiosData = ctx.keyRatiosData || [];
                const exemptCCs = ctx.exemptCCs || [];
                const isAdmAllocationEnabled = !!ctx.isAdmAllocationEnabled;

                const custoAccounts = ctx.custoAccounts || [];
                const viagensAccounts = ctx.viagensAccounts || [];
                const pessoalAccounts = ctx.pessoalAccounts || [];
                const aluguelAccounts = ctx.aluguelAccounts || [];
                const servicosProfissionaisAccounts = ctx.servicosProfissionaisAccounts || [];
                const taxasAccounts = ctx.taxasAccounts || [];
                const diversasAccounts = ctx.diversasAccounts || [];
                const outrasAdmAccounts = ctx.outrasAdmAccounts || [];
                const depreciacaoAccounts = ctx.depreciacaoAccounts || [];
                const posEbitdaAccounts = ctx.posEbitdaAccounts || [];
                const managementFeeAccounts = ctx.managementFeeAccounts || [];
                const deductionAccounts = ctx.deductionAccounts || [];

                // read current exclusion filter from app global (mutable)
                const marginExclusionFilter = (window.app && Array.isArray(window.app.marginExclusionFilter)) ? window.app.marginExclusionFilter : (ctx.marginExclusionFilter || []);

                // Helper: determine group for an account (same logic as DRE Budget-2)
                const getGroup = (c) => {
                    c = Number(c);
                    if (viagensAccounts.includes(c)) return 'viagens';
                    if (custoAccounts.includes(c)) return 'custos';
                    if (pessoalAccounts.includes(c)) return 'pessoal';
                    if (aluguelAccounts.includes(c)) return 'aluguel';
                    if (servicosProfissionaisAccounts.includes(c)) return 'servicos';
                    if (taxasAccounts.includes(c)) return 'taxas';
                    if (diversasAccounts.includes(c)) return 'diversas';
                    if (outrasAdmAccounts.includes(c)) return 'outras';
                    if (depreciacaoAccounts.includes(c)) return 'deprec';
                    if (posEbitdaAccounts.includes(c)) return 'posEbitda';
                    if (managementFeeAccounts.includes(c)) return 'mgmt';
                    return 'admin';
                };

                const analysisData = {};
                const analysisBudget = {};

                // Aggregate Actuals
                data.forEach(item => {
                    if (String(item.ano) !== String(year)) return;
                    if (item.tipo === 'Budget') return;
                    const itemMonth = Number(item.mes) || 0;
                    if (!itemMonth || itemMonth < 1) return;
                    if (periodType === 'ytd') { if (itemMonth > monthSelected) return; }
                    else if (periodType === 'mensal') { if (itemMonth !== monthSelected) return; }

                    const contaNum = Number(item.conta);
                    if (managementFeeAccounts.includes(contaNum)) return; // exclude mgmt fee

                    const isAdm = String(item.departamento).trim() === 'ADM';
                    let isCusto = false;
                    if (custoAccounts.includes(contaNum) || viagensAccounts.includes(contaNum) || pessoalAccounts.includes(contaNum) || outrasAdmAccounts.includes(contaNum) || depreciacaoAccounts.includes(contaNum) || servicosProfissionaisAccounts.includes(contaNum) || taxasAccounts.includes(contaNum)) {
                        isCusto = true;
                    }
                    if (!isCusto && Number(item.valor) < 0) isCusto = true;

                    let key = String(item[groupBy] || 'Não Classificado').trim() || 'Não Classificado';
                    if ((groupBy === 'client' || groupBy === 'cliente') && isAdm && item.tipo !== 'Receita') key = 'ADM (Interno)';

                    const exclusionKey = `${year}_${groupBy}_${key}`;
                    if (marginExclusionFilter.includes(exclusionKey)) return;

                    if (filterCC && String(item.centroCusto) !== filterCC) return;
                    if (filterDept && String(item.departamento) !== filterDept) return;
                    if (filterCli && String(item.cliente) !== filterCli) return;
                    if (filterSBD && String(item.sbd) !== filterSBD) return;
                    if (filterProj && String(item.projectType) !== filterProj) return;

                    const valor = safeNumber(item.valor);

                    if (!analysisData[key]) analysisData[key] = { receitaBruta: 0, deducoes: 0, custos: 0 };

                    const isVariableCost = custoAccounts.includes(contaNum) || viagensAccounts.includes(contaNum);
                    if (isVariableCost) {
                        analysisData[key].custos += valor;
                    } else {
                        const isDeduction = deductionAccounts.includes(contaNum);
                        const ccToCheck = String(item.centroCusto).trim();
                        const isExempt = exemptCCs.includes(ccToCheck);
                        if (isDeduction) {
                            analysisData[key].deducoes += valor;
                        } else if (contaNum === 1902) {
                            analysisData[key].receitaBruta += valor;
                            if (!isExempt) analysisData[key].deducoes += (valor * -0.0925);
                        } else if (contaNum === 3204) {
                            // ignore
                        } else if (item.tipo === 'Receita' && (!isAdm || (ctx.isAdmRevenueAllowed && ctx.isAdmRevenueAllowed(contaNum)))) {
                            analysisData[key].receitaBruta += valor;
                        }
                    }
                });

                // ADM allocation using aggregated ADM lines
                if (isAdmAllocationEnabled) {
                    const admPattern = /^\s*ADM(\b|\s|\(|:)|^\s*1\.01/i;
                    let computedAdmPool = 0;
                    Object.keys(analysisData).forEach(k => { if (admPattern.test(String(k))) computedAdmPool += safeNumber(analysisData[k].custos); });
                    if (Math.abs(computedAdmPool) > 0) {
                        const targetKeys = Object.keys(analysisData).filter(k => !admPattern.test(String(k)));
                        if (targetKeys.length > 0) {
                            const shares = {};
                            let totalShare = 0;
                            if (groupBy === 'departamento' || groupBy === 'centroCusto') {
                                targetKeys.forEach(k => {
                                    const uniqueNames = new Set();
                                    (keyRatiosData||[]).forEach(r => { if (parseInt(r.ano) === parseInt(year) && String(r[groupBy]||'').trim() === k) uniqueNames.add(r.name); });
                                    shares[k] = uniqueNames.size;
                                    totalShare += shares[k];
                                });
                            } else {
                                targetKeys.forEach(k => { shares[k] = safeNumber(analysisData[k].receitaBruta); totalShare += shares[k]; });
                            }
                            if (Math.abs(totalShare) > 0) {
                                targetKeys.forEach(k => { const ratio = shares[k] / totalShare; analysisData[k].custos += computedAdmPool * ratio; });
                            } else {
                                const per = computedAdmPool / targetKeys.length;
                                targetKeys.forEach(k => { analysisData[k].custos += per; });
                            }
                            Object.keys(analysisData).forEach(k => { if (admPattern.test(String(k))) analysisData[k].custos = 0; });
                        }
                    }
                    // ensure ADM row exists and shows custos = 0
                    const keys = Object.keys(analysisData);
                    const admPattern2 = /^\s*ADM(\b|\s|\(|:)|^\s*1\.01/i;
                    let found = false;
                    keys.forEach(k => { if (admPattern2.test(String(k))) { analysisData[k].custos = 0; found = true; } });
                    if (!found) { analysisData['ADM'] = analysisData['ADM'] || { receitaBruta:0, deducoes:0, custos:0 }; analysisData['ADM'].custos = 0; }
                }

                // Budget aggregation (optional)
                if (document.getElementById('margin-compare-budget') && document.getElementById('margin-compare-budget').checked) {
                    data.forEach(item => {
                        if (item.tipo !== 'Budget') return;
                        if (String(item.departamento).trim() === 'ADM' && (item.conta == 3190 || item.conta == 3204)) return;
                        const itemMonthB = Number(item.mes) || 0;
                        if (parseInt(item.ano) !== parseInt(year)) return;
                        if (!itemMonthB || itemMonthB < 1) return;
                        if (periodType === 'ytd') { if (itemMonthB > monthSelected) return; }
                        else if (periodType === 'mensal') { if (itemMonthB !== monthSelected) return; }

                        let key = String(item[groupBy] || 'Não Classificado').trim() || 'Não Classificado';
                        if ((groupBy === 'client' || groupBy === 'cliente') && String(item.departamento).trim() === 'ADM' && item.tipo !== 'Receita') key = 'ADM (Interno)';
                        const exclusionKey = `${year}_${groupBy}_${key}`;
                        if (marginExclusionFilter.includes(exclusionKey)) return;
                        if (filterCC && String(item.centroCusto) !== filterCC) return;
                        if (filterDept && String(item.departamento) !== filterDept) return;
                        if (filterCli && String(item.cliente) !== filterCli) return;
                        if (filterSBD && String(item.sbd) !== filterSBD) return;
                        if (filterProj && String(item.projectType) !== filterProj) return;

                        const contaNum = Number(item.conta);
                        if (managementFeeAccounts.includes(contaNum)) return;
                        const valor = safeNumber(item.valor);

                        if (!analysisBudget[key]) analysisBudget[key] = { receitaBruta:0, deducoes:0, custos:0 };
                        let isCustoBudget = false;
                        if (custoAccounts.includes(contaNum) || viagensAccounts.includes(contaNum)) isCustoBudget = true;
                        if (!isCustoBudget && valor < 0) isCustoBudget = true;
                        if (deductionAccounts.includes(contaNum)) {
                            analysisBudget[key].deducoes += valor;
                        } else if (contaNum === 1902) {
                            const isAdmB = String(item.departamento).trim() === 'ADM';
                            if (!isAdmB || (ctx.isAdmRevenueAllowed && ctx.isAdmRevenueAllowed(contaNum))) {
                                analysisBudget[key].receitaBruta += valor;
                                analysisBudget[key].deducoes += (valor * -0.0925);
                            }
                        } else if (contaNum === 3204) {
                            // ignore
                        } else if (isCustoBudget) {
                            analysisBudget[key].custos += valor;
                        } else {
                            const isAdmB = String(item.departamento).trim() === 'ADM';
                            if (!isAdmB || (ctx.isAdmRevenueAllowed && ctx.isAdmRevenueAllowed(contaNum))) analysisBudget[key].receitaBruta += valor;
                        }
                    });

                    if (isAdmAllocationEnabled) {
                        const admPattern = /^\s*ADM(\b|\s|\(|:)|^\s*1\.01/i;
                        let computedAdmPoolBdg = 0;
                        Object.keys(analysisBudget).forEach(k => { if (admPattern.test(String(k))) computedAdmPoolBdg += safeNumber(analysisBudget[k].custos); });
                        if (Math.abs(computedAdmPoolBdg) > 0) {
                            const targetKeys = Object.keys(analysisBudget).filter(k => !admPattern.test(String(k)));
                            if (targetKeys.length > 0) {
                                const shares = {};
                                let totalShare = 0;
                                if (groupBy === 'departamento' || groupBy === 'centroCusto') {
                                    targetKeys.forEach(k => {
                                        const uniqueNames = new Set();
                                        (keyRatiosData||[]).forEach(r => { if (parseInt(r.ano) === parseInt(year) && String(r[groupBy]||'').trim() === k) uniqueNames.add(r.name); });
                                        shares[k] = uniqueNames.size; totalShare += shares[k];
                                    });
                                } else {
                                    targetKeys.forEach(k => { shares[k] = safeNumber(analysisBudget[k].receitaBruta); totalShare += shares[k]; });
                                }
                                if (Math.abs(totalShare) > 0) {
                                    targetKeys.forEach(k => { const ratio = shares[k]/totalShare; analysisBudget[k].custos += computedAdmPoolBdg * ratio; });
                                } else {
                                    const per = computedAdmPoolBdg / targetKeys.length; targetKeys.forEach(k => analysisBudget[k].custos += per);
                                }
                                Object.keys(analysisBudget).forEach(k => { if (admPattern.test(String(k))) analysisBudget[k].custos = 0; });
                            }
                        }
                        const keysB = Object.keys(analysisBudget);
                        let foundB = false;
                        keysB.forEach(k => { if (admPattern.test(String(k))) { analysisBudget[k].custos = 0; foundB = true; } });
                        if (!foundB) { analysisBudget['ADM'] = analysisBudget['ADM'] || { receitaBruta:0, deducoes:0, custos:0 }; analysisBudget['ADM'].custos = 0; }
                    }
                }

                // Build rows
                let rowsToRender = [];
                let totalLiquida = 0;
                let totalCustos = 0;

                Object.keys(analysisData).forEach(key => {
                    const dataRow = analysisData[key];
                    const recLiq = safeNumber(dataRow.receitaBruta) + safeNumber(dataRow.deducoes);
                    const custosR = safeNumber(dataRow.custos);
                    const margemR = recLiq - custosR;
                    const margemP = recLiq !== 0 ? (margemR / recLiq) * 100 : 0;

                    let recLiq_bdg = 0, custosR_bdg = 0, margemR_bdg = 0, margemP_bdg = 0;
                    if (document.getElementById('margin-compare-budget') && document.getElementById('margin-compare-budget').checked && analysisBudget[key]) {
                        recLiq_bdg = safeNumber(analysisBudget[key].receitaBruta) + safeNumber(analysisBudget[key].deducoes);
                        custosR_bdg = safeNumber(analysisBudget[key].custos);
                        margemR_bdg = recLiq_bdg - custosR_bdg;
                        margemP_bdg = recLiq_bdg !== 0 ? (margemR_bdg / recLiq_bdg) * 100 : 0;
                    }

                    rowsToRender.push({ key, recLiq, custosR, margemR, margemP, recLiq_bdg, custosR_bdg, margemR_bdg, margemP_bdg });
                    totalLiquida += recLiq;
                    totalCustos += custosR;
                });

                rowsToRender.sort((a,b) => b.recLiq - a.recLiq);

                // adjust header DOM - set appropriate header columns when comparing with Budget
                const tableThead = document.querySelector('#view-margin-analysis table thead');
                if (tableThead) {
                    tableThead.className = 'bg-gray-100 sticky top-0 z-10';
                    const thRow = tableThead.querySelector('tr');
                    if (compareBudget) {
                        thRow.innerHTML = `
                            <th class="px-2 py-2 text-left w-64 uppercase tracking-wider" id="margin-group-header">${headerMap[groupBy] || 'Grupo'}</th>
                            <th class="px-2 py-2 text-right uppercase tracking-wider">Receita Líquida</th>
                            <th class="px-2 py-2 text-right uppercase tracking-wider">Receita (Budget)</th>
                            <th class="px-2 py-2 text-right uppercase tracking-wider">Var. Receita (R$)</th>
                            <th class="px-2 py-2 text-right uppercase tracking-wider">Var. Receita (%)</th>
                            <th class="px-2 py-2 text-right uppercase tracking-wider">Custo Variável</th>
                            <th class="px-2 py-2 text-right uppercase tracking-wider">Custo (Budget)</th>
                            <th class="px-2 py-2 text-right uppercase tracking-wider">Var. Custo (R$)</th>
                            <th class="px-2 py-2 text-right uppercase tracking-wider">Var. Custo (%)</th>
                            <th class="px-2 py-2 text-right uppercase tracking-wider">Margem Contrib. (R$)</th>
                            <th class="px-2 py-2 text-right uppercase tracking-wider">Margem (Budget)</th>
                            <th class="px-2 py-2 text-right uppercase tracking-wider">Delta Margem (%)</th>
                            <th class="px-2 py-2 text-right uppercase tracking-wider">Margem (%)</th>
                            <th class="px-2 py-2 text-right uppercase tracking-wider">Margem (%) Budget</th>
                            <th class="px-2 py-2 text-right uppercase tracking-wider">Var. Margem (%)</th>
                            <th class="px-4 py-2 text-center uppercase tracking-wider">Ação</th>
                        `;
                    } else {
                        thRow.innerHTML = `
                            <th class="px-4 py-2 text-left w-64 uppercase tracking-wider" id="margin-group-header">${headerMap[groupBy] || 'Grupo'}</th>
                            <th class="px-4 py-2 text-right uppercase tracking-wider">Receita Líquida</th>
                            <th class="px-4 py-2 text-right uppercase tracking-wider">Custo Variável</th>
                            <th class="px-4 py-2 text-right uppercase tracking-wider">Margem Contrib. (R$)</th>
                            <th class="px-4 py-2 text-right uppercase tracking-wider bg-orange-700">Margem Contrib. (%)</th>
                            <th class="px-4 py-2 text-center uppercase tracking-wider">Ação</th>
                        `;
                    }
                }

                // Precompute budget totals if necessary
                let totalLiquida_bdg = 0, totalCustos_bdg = 0;
                if (document.getElementById('margin-compare-budget') && document.getElementById('margin-compare-budget').checked) {
                    Object.keys(analysisBudget).forEach(k => { totalLiquida_bdg += safeNumber(analysisBudget[k].receitaBruta) + safeNumber(analysisBudget[k].deducoes); totalCustos_bdg += safeNumber(analysisBudget[k].custos); });
                }

                // Render rows (keeping original HTML structure / classes)
                rowsToRender.forEach(row => {
                    const tr = document.createElement('tr');
                    tr.className = "hover:bg-gray-50 dre-row";
                    let trHTML = '';
                    if (compareBudget) {
                        const varRec = row.recLiq - row.recLiq_bdg;
                        const varRecPerc = row.recLiq_bdg !== 0 ? (varRec / Math.abs(row.recLiq_bdg)) * 100 : 0;
                        const varCust = row.custosR - row.custosR_bdg;
                        const varCustPerc = row.custosR_bdg !== 0 ? (varCust / Math.abs(row.custosR_bdg)) * 100 : 0;
                        const varMargPerc = row.margemP - row.margemP_bdg;
                        const varRecPercClass = varRecPerc < 0 ? 'text-red-600' : 'text-black';
                        const varCustPercClass = varCustPerc < 0 ? 'text-red-600' : 'text-black';
                        const varMargPercBgClass = varMargPerc < 0 ? 'bg-red-600' : 'bg-orange-700';

                        trHTML = `\
                        <td class="px-2 py-1 text-left font-semibold text-gray-700" style="font-size:${fontSizeCell}">${row.key}</td>\
                        <td class="px-2 py-1 text-right font-bold text-blue-700 bg-blue-50" style="font-size:${fontSizeCell}">${formatCurrency(row.recLiq)}</td>\
                        <td class="px-2 py-1 text-right bg-blue-50 text-black" style="font-size:${fontSizeCell}">${formatCurrency(row.recLiq_bdg)}</td>\
                        <td class="px-2 py-1 text-right text-red-600 bg-blue-50" style="font-size:${fontSizeCell}">${formatCurrency(varRec)}</td>\
                        <td class="px-2 py-1 text-right bg-blue-50 ${varRecPercClass}" style="font-size:${fontSizeCell}">${varRecPerc.toFixed(2)}%</td>\
                        <td class="px-2 py-1 text-right bg-gray-50 text-black" style="font-size:${fontSizeCell}">${formatCurrency(row.custosR)}</td>\
                        <td class="px-2 py-1 text-right bg-gray-50 text-black" style="font-size:${fontSizeCell}">${formatCurrency(row.custosR_bdg)}</td>\
                        <td class="px-2 py-1 text-right text-red-600 bg-gray-50" style="font-size:${fontSizeCell}">${formatCurrency(varCust)}</td>\
                        <td class="px-2 py-1 text-right bg-gray-50 ${varCustPercClass}" style="font-size:${fontSizeCell}">${varCustPerc.toFixed(2)}%</td>\
                        <td class="px-2 py-1 text-right font-bold bg-orange-50 text-black" style="font-size:${fontSizeCell}">${formatCurrency(row.margemR)}</td>\
                        <td class="px-2 py-1 text-right bg-orange-50 text-black" style="font-size:${fontSizeCell}">${formatCurrency(row.margemR_bdg)}</td>\
                        <td class="px-2 py-1 text-right bg-orange-50 text-black" style="font-size:${fontSizeCell}">${(row.margemP_bdg ? ( (row.margemP - row.margemP_bdg).toFixed(2) ) : (row.margemP.toFixed(2)) )}%</td>\
                        <td class="px-2 py-1 text-right font-extrabold ${varMargPercBgClass} text-white" style="font-size:${fontSizeCell}">${row.margemP.toFixed(2)}%</td>\
                        <td class="px-2 py-1 text-right bg-orange-700 text-white" style="font-size:${fontSizeCell}">${row.margemP_bdg.toFixed(2)}%</td>\
                        <td class="px-2 py-1 text-right ${varMargPercBgClass} text-white" style="font-size:${fontSizeCell}">${varMargPerc.toFixed(2)}%</td>\
                        <td class="px-4 py-2 text-center">\
                            <button onclick="app.toggleMarginExclusion('${year}', '${groupBy}', '${String(row.key).replace(/'/g, "\\'")}')" class="text-red-500 hover:text-red-700" title="Excluir temporariamente grupo ${row.key}">\
                                <i class="fa-solid fa-eye-slash"></i>\
                            </button>\
                        </td>`;
                    } else {
                        trHTML = `\
                        <td class="px-4 py-2 text-left font-semibold text-gray-700">${row.key}</td>\
                        <td class="px-4 py-2 text-right font-bold text-blue-700">${formatCurrency(row.recLiq)}</td>\
                        <td class="px-4 py-2 text-right">${formatCurrency(row.custosR)}</td>\
                        <td class="px-4 py-2 text-right font-bold">${formatCurrency(row.margemR)}</td>\
                        <td class="px-4 py-2 text-right font-extrabold bg-orange-100 text-orange-700">${row.margemP.toFixed(2)}%</td>\
                        <td class="px-4 py-2 text-center">\
                            <button onclick="app.toggleMarginExclusion('${year}', '${groupBy}', '${String(row.key).replace(/'/g, "\\'")}')" class="text-red-500 hover:text-red-700" title="Excluir temporariamente grupo ${row.key}">\
                                <i class="fa-solid fa-eye-slash"></i>\
                            </button>\
                        </td>`;
                    }
                    tr.innerHTML = trHTML;
                    tbody.appendChild(tr);
                });

                // Totals row
                const totalCustosR = rowsToRender.reduce((s,r) => s + (r.custosR || 0), 0);
                const totalMargemR_Corrected = totalLiquida - totalCustosR;
                const totalMargemP_Corrected = totalLiquida !== 0 ? (totalMargemR_Corrected / totalLiquida) * 100 : 0;

                const trTotal = document.createElement('tr');
                trTotal.className = "dre-total border-t-2 border-orange-700";
                if (!compareBudget) {
                    trTotal.className += " bg-orange-300 text-gray-900";
                    trTotal.innerHTML = `\
                        <td class="px-4 py-2 text-left font-extrabold text-lg">TOTAL GERAL</td>\
                        <td class="px-4 py-2 text-right font-extrabold">${formatCurrency(totalLiquida)}</td>\
                        <td class="px-4 py-2 text-right font-extrabold">${formatCurrency(totalCustosR)}</td>\
                        <td class="px-4 py-2 text-right font-extrabold">${formatCurrency(totalMargemR_Corrected)}</td>\
                        <td class="px-4 py-2 text-right font-extrabold bg-orange-800 text-white">${totalMargemP_Corrected.toFixed(2)}%</td>\
                        <td class="px-4 py-2 text-center"></td>`;
                } else {
                    const totalMargemR_bdg = totalLiquida_bdg - totalCustos_bdg;
                    const totalMargemP_bdg = totalLiquida_bdg !== 0 ? (totalMargemR_bdg / totalLiquida_bdg) * 100 : 0;
                    const varRecTotal = totalLiquida - totalLiquida_bdg;
                    const varCustTotal = totalCustosR - totalCustos_bdg;
                    const varMargPercTotal = totalMargemP_Corrected - totalMargemP_bdg;
                    trTotal.className += " bg-orange-300 text-gray-900";
                    const totalRecVarPerc = totalLiquida_bdg ? ((varRecTotal / Math.abs(totalLiquida_bdg)) * 100) : 0;
                    const totalRecVarClass = totalRecVarPerc < 0 ? 'text-red-600' : 'text-black';
                    const totalCustVarPerc = totalCustos_bdg ? ((varCustTotal / Math.abs(totalCustos_bdg)) * 100) : 0;
                    const totalCustVarClass = totalCustVarPerc < 0 ? 'text-red-600' : 'text-black';
                    const totalMargBgClass = varMargPercTotal < 0 ? 'bg-red-600 text-white' : 'bg-orange-800 text-white';

                    trTotal.innerHTML = `\
                        <td class="px-4 py-2 text-left font-extrabold text-lg" style="font-size:${fontSizeCell}">TOTAL GERAL</td>\
                        <td class="px-4 py-2 text-right font-extrabold text-blue-800" style="font-size:${fontSizeCell}">${formatCurrency(totalLiquida)}</td>\
                        <td class="px-4 py-2 text-right font-extrabold text-blue-800" style="font-size:${fontSizeCell}">${formatCurrency(totalLiquida_bdg)}</td>\
                        <td class="px-4 py-2 text-right font-extrabold text-red-700" style="font-size:${fontSizeCell}">${formatCurrency(varRecTotal)}</td>\
                        <td class="px-4 py-2 text-right font-extrabold ${totalRecVarClass}" style="font-size:${fontSizeCell}">${totalRecVarPerc.toFixed(2)}%</td>\
                        <td class="px-4 py-2 text-right font-extrabold text-gray-800" style="font-size:${fontSizeCell}">${formatCurrency(totalCustosR)}</td>\
                        <td class="px-4 py-2 text-right font-extrabold text-gray-800" style="font-size:${fontSizeCell}">${formatCurrency(totalCustos_bdg)}</td>\
                        <td class="px-4 py-2 text-right font-extrabold text-red-700" style="font-size:${fontSizeCell}">${formatCurrency(varCustTotal)}</td>\
                        <td class="px-4 py-2 text-right font-extrabold ${totalCustVarClass}" style="font-size:${fontSizeCell}">${totalCustVarPerc.toFixed(2)}%</td>\
                        <td class="px-4 py-2 text-right font-extrabold" style="font-size:${fontSizeCell}">${formatCurrency(totalMargemR_Corrected)}</td>\
                        <td class="px-4 py-2 text-right font-extrabold" style="font-size:${fontSizeCell}">${formatCurrency(totalMargemR_bdg)}</td>\
                        <td class="px-4 py-2 text-right font-extrabold ${varMargPercTotal < 0 ? 'text-red-600' : 'text-black'}" style="font-size:${fontSizeCell}">${varMargPercTotal.toFixed(2)}%</td>\
                        <td class="px-4 py-2 text-right font-extrabold ${totalMargBgClass}" style="font-size:${fontSizeCell}">${totalMargemP_Corrected.toFixed(2)}%</td>\
                        <td class="px-4 py-2 text-right font-extrabold ${totalMargBgClass}" style="font-size:${fontSizeCell}">${totalMargemP_bdg.toFixed(2)}%</td>\
                        <td class="px-4 py-2 text-right font-extrabold ${totalMargBgClass}" style="font-size:${fontSizeCell}">${varMargPercTotal.toFixed(2)}%</td>\
                        <td class="px-4 py-2 text-center"></td>`;
                }
                tbody.appendChild(trTotal);

                // toggle reset button visibility
                try {
                    const resetButton = document.querySelector('#view-margin-analysis button[onclick="app.clearMarginExclusions()"]')?.parentNode;
                    if (resetButton) {
                        if (marginExclusionFilter && marginExclusionFilter.length > 0) resetButton.classList.remove('hidden');
                        else resetButton.classList.add('hidden');
                    }
                } catch(e) {}

            } catch (e) {
                console.error('Erro em AbaMarginAnalysis.render', e);
            }
        },

        toggleMarginExclusion(year, groupByField, groupKeyValue) {
            const appRef = window.app || {};
            appRef.marginExclusionFilter = appRef.marginExclusionFilter || [];
            const exclusionKey = `${year}_${groupByField}_${groupKeyValue}`;
            const index = appRef.marginExclusionFilter.indexOf(exclusionKey);
            if (index > -1) {
                appRef.marginExclusionFilter.splice(index, 1);
                if (appRef.showToast) appRef.showToast(`Grupo '${groupKeyValue}' reativado.`);
            } else {
                appRef.marginExclusionFilter.push(exclusionKey);
                if (appRef.showToast) appRef.showToast(`Grupo '${groupKeyValue}' temporariamente excluído da análise.`);
            }
            if (appRef.renderMarginAnalysis) appRef.renderMarginAnalysis();
        },

        clearMarginExclusions() {
            const appRef = window.app || {};
            appRef.marginExclusionFilter = [];
            if (appRef.renderMarginAnalysis) appRef.renderMarginAnalysis();
            if (appRef.showToast) appRef.showToast("Filtros temporários de margem resetados.");
        }
    };
})();

