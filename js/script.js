
// Helpers, filtros e renderizações centralizados em módulos e AppUtils.

const app = {
    generateOcraReport() {
        try {
            // Prefer delegation to module implementation if available
            if (window.AbaDreDepartamento && typeof window.AbaDreDepartamento.generateOcraReport === 'function') {
                return window.AbaDreDepartamento.generateOcraReport(this);
            }

            // Fallback seguro: se o módulo não exportar generateOcraReport (ou não for carregado),
            // mas expuser computeDREValues, usamos esse helper para gerar a exportação a partir
            // dos mesmos dados/ regras usadas pela DRE (garante paridade mesmo sem estar na aba aberta).
            if (window.AbaDreDepartamento && typeof window.AbaDreDepartamento.computeDREValues === 'function') {
                const ctx = (typeof window.AbaDreDepartamento.prepareCtx === 'function') ? window.AbaDreDepartamento.prepareCtx(this) : {
                    year: (new Date()).getFullYear(),
                    month: (new Date()).getMonth() + 1,
                    data: this.data || [],
                    planoContas: this.planoContas || [],
                    keyRatiosData: this.keyRatiosData || [],
                    mgmtDetailData: this.mgmtDetailData || {},
                    mgmtFees: this.mgmtFees || [],
                    balanceData: this.balanceData || [],
                    exemptCCs: this.exemptCCs || [],
                    dreDeptLayout: this.dreDeptLayout || [],
                    ocraConfig: this.ocraConfig || []
                };

                                // Forçar o contexto para usar os filtros de exportação (ano/mês da aba OCRA)
                                try {
                                    const yearEl = document.getElementById('ocra-export-year');
                                    const monthEl = document.getElementById('ocra-export-month');
                                    const selectedYear = yearEl ? parseInt(yearEl.value) : (ctx.year || (new Date()).getFullYear());
                                    const selectedMonth = monthEl ? parseInt(monthEl.value) : (ctx.month || ((new Date()).getMonth()+1));
                                    ctx.year = selectedYear;
                                    ctx.month = selectedMonth;
                                    ctx.type = 'ytd';
                                } catch (e) { console.warn('Erro ao aplicar filtros OCRA ao contexto de export', e); }

                const { dreMap } = window.AbaDreDepartamento.computeDREValues(ctx);

                // Build export list
                const ocraConfigList = Array.isArray(this.ocraConfig) ? this.ocraConfig : (this.ocraConfig ? [this.ocraConfig] : []);
                const admCompanyNum = (ocraConfigList.find(c => c.department === 'ADM') || {}).companyNum || '';
                const exportList = [];
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
                        if (norm !== 0) exportList.push({ Company: companyNum, Departamento: deptNum, Account: acc, Amount: norm });
                    });
                });

                if (exportList.length === 0) return this.showToast('Nenhum dado encontrado para os filtros selecionados.', true);

                                // Sempre gerar arquivo de comparação com 3 abas: OCRA Export / DRE Values / Diff
                                // Reconstruir exportSheet a partir de dreMap (forçar paridade com tela)
                                const exportSheet = [];
                                const dreRows = [];
                                Object.keys(dreMap || {}).forEach(acc => {
                                    // Excluir conta 3204 da exportação
                                    if (String(acc).trim() === '3204') return;
                                    Object.keys(dreMap[acc] || {}).forEach(depto => {
                                        const companyNum = (ocraConfigList.find(c => c.department === depto) || {}).companyNum || admCompanyNum || '';
                                        const deptNum = (ocraConfigList.find(c => c.department === depto) || {}).deptNum || '';
                                        const dreRaw = Number(dreMap[acc][depto] || 0);
                                        let dreNorm = (typeof window.applyOcraSignRule === 'function') ? window.applyOcraSignRule(acc, dreRaw) : dreRaw;
                                        if (String(acc).trim() === '4040' && String(depto).trim() === 'ADM') {
                                            dreNorm = -Math.abs(dreNorm);
                                        }
                                        exportSheet.push({ Company: companyNum, Departamento: deptNum, Account: acc, Amount: dreNorm });
                                        dreRows.push({ Account: acc, Departamento: depto, DRE_Value: dreRaw });
                                    });
                                });

                                // Build diff rows (should be zero deltas since export uses dreMap)
                                const diffRows = exportSheet.map(r => ({ Account: r.Account, Departamento: r.Departamento, DRE_Value: (dreMap[r.Account] && dreMap[r.Account][r.Departamento]) ? Number(dreMap[r.Account][r.Departamento]) : 0, Export_Value: Number(r.Amount || 0), Delta: Number(r.Amount || 0) - ((dreMap[r.Account] && dreMap[r.Account][r.Departamento]) ? Number(dreMap[r.Account][r.Departamento]) : 0) }));

                                const wb = XLSX.utils.book_new();
                                const ws1 = XLSX.utils.json_to_sheet(exportSheet);
                                const ws2 = XLSX.utils.json_to_sheet(dreRows);
                                const ws3 = XLSX.utils.json_to_sheet(diffRows);
                                XLSX.utils.book_append_sheet(wb, ws1, 'OCRA Export');
                                XLSX.utils.book_append_sheet(wb, ws2, 'DRE Values');
                                XLSX.utils.book_append_sheet(wb, ws3, 'Diff');
                                XLSX.writeFile(wb, `OCRA_Comparison_fallback_${ctx.year}_${ctx.month}.xlsx`);
                                return this.showToast(`Comparação OCRA gerada (Diff: ${diffRows.length} linhas).`);
            }
        } catch (e) {
            console.warn('Erro delegando generateOcraReport para AbaDreDepartamento', e);
        }
        this.showToast('Módulo AbaDreDepartamento não disponível para OCRA.', true);
    },

    

    confirmImport() {
        try {
            if (this.currentImportType === 'PlanoContas') {
                this.showToast(`${this.tempData.length} contas do Plano de Contas salvas.`);
                this.cancelImport();
            } else if (this.currentImportType === 'Balance') {
            // ...existing code...
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
        } else if (this.currentImportType === 'Receita') {
            if (window.AbaImportReceita && typeof window.AbaImportReceita.confirmReceitaImport === 'function') {
                return window.AbaImportReceita.confirmReceitaImport(this);
            }
            // Fallback: manter lógica anterior
            const periodsToReplace = new Set(this.tempData.map(item => this.normalizePeriod(item.mes, item.ano)));
            let newList = (this.data || []).filter(item => {
                if (item.tipo !== 'Receita') return true;
                const period = this.normalizePeriod(item.mes, item.ano);
                return !periodsToReplace.has(String(period));
            });
            newList = [...newList, ...(this.tempData || [])];
            if (window.DataAPI && typeof DataAPI.importReceita === 'function') {
                DataAPI.importReceita(this, newList, { persist: true, render: true });
            } else {
                this.data = newList;
                if (this.saveToStorage) this.saveToStorage();
                if (typeof this.renderData === 'function') this.renderData();
            }
            this.showToast(`${(this.tempData || []).length} registros de Receita salvos.`);
            this.cancelImport();
        } else {
            // ...existing code...
            const existingMain = (this.data || []).filter(item => {
                if (item.tipo !== this.currentImportType) return true;
                const period = this.normalizePeriod(item.mes, item.ano);
                return !periodsToReplace.has(String(period));
            });
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
        } catch (err) {
            console.error('confirmImport failed', err);
            try { this.showToast('Erro ao confirmar importação: ' + (err && err.message ? err.message : err), true); } catch(e) {}
        }
    },

    cancelImport() {
        this.tempData = [];
        document.getElementById('fileInput').value = '';
        document.getElementById('fileName').innerText = '';
        document.getElementById('preview-section').classList.add('hidden');
        try { this.setImportContext(this.currentImportType); } catch(e){}
    },

    setImportContext(typeOrKey) {
        // Accept either friendly type names (e.g. 'Receita') or keys like 'import-receita'
        let t = String(typeOrKey || '').trim();
        // If key form, map to friendly type
        if (t.startsWith('import-')) {
            const k = t.replace('import-','');
            const map = {
                'receita': 'Receita',
                'despesa': 'Despesa',
                'budget': 'Budget',
                'key-ratios': 'KeyRatios',
                'key-ratios-budget': 'KeyRatiosBudget',
                'plano-contas': 'PlanoContas',
                'balance': 'Balance'
            };
            t = map[k] || t;
        }
        // Normalize some common variants
        if (t.toLowerCase() === 'keyratios') t = 'KeyRatios';

        this.currentImportType = t || 'Receita';

        // Update badge and title
        const badge = document.getElementById('import-type-badge');
        if (badge) badge.innerText = (this.currentImportType || '').toString().replace(/([A-Z])/g,' $1').trim().toUpperCase();
        const title = document.getElementById('import-title');
        if (title) title.innerText = `Importar Arquivo - ${this.currentImportType}`;

        // Show/hide specific import subsections
        const planoSection = document.getElementById('plano-contas-list-section');
        if (planoSection) planoSection.classList.toggle('hidden', this.currentImportType !== 'PlanoContas');
        const previewSection = document.getElementById('preview-section');
        if (previewSection) previewSection.classList.toggle('hidden', true); // keep preview hidden until a file is selected

        // Reset any staged import data when switching import context
        try {
            this.tempData = [];
            const fi = document.getElementById('fileInput'); if (fi) fi.value = '';
            const fn = document.getElementById('fileName'); if (fn) fn.innerText = '';
        } catch(e) { /* ignore */ }

        // Guidance for budget import formatting
        const budgetGuidance = document.getElementById('budget-import-guidance');
        if (budgetGuidance) budgetGuidance.classList.toggle('hidden', this.currentImportType !== 'Budget');

        // Adjust import-description text for some types
        const desc = document.getElementById('import-description');
        if (desc) {
            const m = this.currentImportType;
            if (m === 'KeyRatios') desc.innerText = 'Importe arquivo Key Ratios (Horas/Consultores)';
            else if (m === 'PlanoContas') desc.innerText = 'Importe o Plano de Contas (.xlsx) com mapeamento OCRA';
            else if (m === 'Budget') desc.innerText = 'Importe arquivo Budget (.xlsx) — coluna Valor deve usar vírgula para decimais.';
            else if (m === 'Balance') desc.innerText = 'Importe arquivo de Balanço/Pos EBIT';
            else desc.innerText = 'Selecione o arquivo mensal (.xlsx ou .xls)';
        }

        // If module-specific renderers exist, call them to update UI
        try {
            if (this.currentImportType === 'PlanoContas') {
                if (typeof this.renderPlanoContas === 'function') this.renderPlanoContas();
            }
        } catch(e) { console.warn('setImportContext renderPlanoContas failed', e); }
    },

    handleFileSelect(input) {
        // Generic router for file input used by import UI (index.html onchange="app.handleFileSelect(this)")
        const file = input && input.files ? input.files[0] : null;
        if (!file) return;

        // If a module provides a dedicated handler, prefer it
        try {
            const key = (this.currentImportType || '').toString();
            // Map friendly types to module names where applicable
            if (key === 'PlanoContas' && window.AbaImportPlanoContas && typeof window.AbaImportPlanoContas.handleFileInput === 'function') return window.AbaImportPlanoContas.handleFileInput(this, input);
            if (key === 'Receita' && window.AbaImportReceita && typeof window.AbaImportReceita.handleFileInput === 'function') return window.AbaImportReceita.handleFileInput(this, input);
            if (key === 'Despesa' && window.AbaImportDespesa && typeof window.AbaImportDespesa.handleFileInput === 'function') return window.AbaImportDespesa.handleFileInput(this, input);
            if (key === 'Budget' && window.AbaImportBudget && typeof window.AbaImportBudget.handleFileInput === 'function') return window.AbaImportBudget.handleFileInput(this, input);
            if (key === 'CentrosCusto' && window.AbaCentrosCusto && typeof window.AbaCentrosCusto.handleFileInput === 'function') return window.AbaCentrosCusto.handleFileInput(this, input);
        } catch(e) {
            console.warn('handleFileSelect: module handler failed', e);
        }

        // Fallback: read file here and dispatch to delegators that accept rows arrays
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const wb = XLSX.read(data, { type: 'array' });
                const first = wb.SheetNames[0];
                const sheet = wb.Sheets[first];
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
                console.info('handleFileSelect: read rows', rows.length, 'for import type', this.currentImportType);

                // Dispatch based on currentImportType
                const t = (this.currentImportType || '').toString();
                if (t === 'KeyRatios' && window.AbaImportKeyRatios && typeof window.AbaImportKeyRatios.processKeyRatiosData === 'function') return window.AbaImportKeyRatios.processKeyRatiosData(this, rows);
                if (t === 'KeyRatiosBudget' && window.AbaImportKeyRatios && typeof window.AbaImportKeyRatios.processKeyRatiosBudgetData === 'function') return window.AbaImportKeyRatios.processKeyRatiosBudgetData(this, rows);
                if (t === 'PlanoContas' && typeof this.processPlanoContasData === 'function') return this.processPlanoContasData(rows);
                if (t === 'Balance' && typeof this.processBalanceData === 'function') return this.processBalanceData(rows);

                // Generic importers that expect rows processing in modules
                if (window.AbaImportReceita && typeof window.AbaImportReceita.processFinancialData === 'function' && (t === 'Receita' || t === 'Despesa' || t === 'Budget')) {
                    return window.AbaImportReceita.processFinancialData(this, rows);
                }

                // If nothing matched, keep file input cleared and warn
                console.warn('handleFileSelect: no importer matched for type', t);
                const fi = document.getElementById('fileInput'); if (fi) fi.value = '';
                this.showToast('Tipo de import não suportado ou módulo ausente.', true);
            } catch (err) {
                console.error('handleFileSelect read error', err);
                this.showToast('Erro ao ler arquivo: ' + (err.message || err), true);
            }
        };
        reader.readAsArrayBuffer(file);
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
        try { console.info('app.renderMgmtFeesList called', { mgmtFeesCount: (this.mgmtFees||[]).length }); } catch(e){}
        if (window.AbaMgmtFee && typeof window.AbaMgmtFee.renderMgmtFeesList === 'function') {
            try { return window.AbaMgmtFee.renderMgmtFeesList(this); } catch (e) { console.error('AbaMgmtFee.renderMgmtFeesList failed', e); }
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
        // Normaliza e remove duplicatas de `ano` convertendo para string antes do Set,
        // porque alguns registros podem ter `ano` como number e outros como string
        const rawYears = Array.from(new Set(allData.map(d => (d && d.ano) !== undefined ? String(d.ano).trim() : '').filter(s => s !== '')));
        const years = rawYears
            .map(s => ({ s, n: Number(s) }))
            .filter(o => (!isNaN(o.n) && o.n > 31) || (o.s && o.s.length >= 4))
            .map(o => o.s)
            .sort((a,b)=> Number(b) - Number(a));
        // debug logs removed
        
        // Popula apenas a lista de anos (é o filtro principal)
        ['dre-year-select', 'dre-acc-year', 'dre-b2-year', 'margin-year-select', 'dre-dept-year', 'ocra-export-year', 'ocra-parity-year'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const prevValue = el.value || null; el.innerHTML = '';
            try { el.disabled = false; el.tabIndex = 0; el.style.pointerEvents = 'auto'; el.removeAttribute('disabled'); el.removeAttribute('aria-disabled'); } catch(e) {}

            if(!years.length) { 
                const thisYear = new Date().getFullYear();
                const opt = document.createElement('option'); opt.value = String(thisYear); opt.innerText = String(thisYear); opt.selected = true;
                el.appendChild(opt);
                // fallback year set
            } else {
                years.forEach((y, idx) => { 
                    const opt = document.createElement('option'); opt.value = y; opt.innerText = y; 
                    if(String(y) === String(prevValue) || (idx === 0 && !prevValue)) opt.selected = true;
                    el.appendChild(opt);
                });
                // select populated
                // ensure the select is focusable
                try { el.tabIndex = 0; el.style.pointerEvents = 'auto'; } catch(e) {}
            }
        });
        // Os demais filtros serão preenchidos em setupDynamicFilters
    },

    setupDynamicFilters() {
        // Wrapper: chama AppUtils.setupDynamicFilters com contexto e targets
        const targets = [
            { prefix: 'dre', fields: ['cc', 'dept', 'client', 'sbd', 'proj'], suffix: '-filter-', render: this.renderDRE },
            { prefix: 'dre-b2', fields: ['cc', 'dept', 'client', 'sbd', 'proj'], suffix: '-', render: this.renderDREBudget2 },
            { prefix: 'dre-acc', fields: ['cc', 'dept', 'client', 'sbd', 'proj'], suffix: '-', render: this.renderDREAcumulado },
            { prefix: 'margin', fields: ['cc', 'dept', 'client', 'sbd', 'proj'], suffix: '-filter-', render: this.renderMarginAnalysis }
        ];
        return window.AppUtils.setupDynamicFilters(
            this,
            targets,
            (prefix) => this.applyFilterDependencies(prefix)
        );
    },

    applyFilterDependencies(prefix, forceShowAll) {
        // Wrapper: chama AppUtils.applyFilterDependencies
        return window.AppUtils.applyFilterDependencies(
            this,
            prefix,
            this.data,
            this.keyRatiosData,
            (datalistId, values) => this.updateDatalist(datalistId, values),
            !!forceShowAll
        );
    },

    // ...existing code...

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
                let year = parseInt(document.getElementById('dre-year-select') ? document.getElementById('dre-year-select').value : (new Date().getFullYear()));
                if (isNaN(year)) year = (new Date()).getFullYear();
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
        // Delegator: prefere o módulo `AbaDreBudget` quando disponível.
        try {
            if (window.AbaDreBudget && typeof window.AbaDreBudget.render === 'function') {
                let ctx = null;
                if (typeof window.AbaDreBudget.prepareCtx === 'function') {
                    try { ctx = window.AbaDreBudget.prepareCtx(this); } catch (e) { ctx = null; }
                }
                if (!ctx) {
                    const getFilterValue = (id) => { const el = document.getElementById(id); if (!el) return ''; const v = String(el.value || '').trim(); return v === 'Todos...' ? '' : v; };
                    let year = parseInt(document.getElementById('dre-budget-year-select') ? document.getElementById('dre-budget-year-select').value : (new Date()).getFullYear());
                    if (isNaN(year)) year = (new Date()).getFullYear();
                    let month = parseInt(document.getElementById('dre-budget-month-select') ? document.getElementById('dre-budget-month-select').value : (new Date().getMonth()+1));
                    if (isNaN(month)) month = (new Date()).getMonth() + 1;
                    ctx = {
                        year,
                        month,
                        filtros: {
                            cc: getFilterValue('dre-budget-filter-cc'),
                            dept: getFilterValue('dre-budget-filter-dept'),
                            client: getFilterValue('dre-budget-filter-client'),
                            sbd: getFilterValue('dre-budget-filter-sbd'),
                            proj: getFilterValue('dre-budget-filter-proj')
                        },
                        data: this.data || [],
                        keyRatiosData: this.keyRatiosData || [],
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
                        normalizeAccountDigits: (window.AppUtils && AppUtils.normalizeAccountDigits) || (this.normalizeAccountDigits ? this.normalizeAccountDigits.bind(this) : (s => String(s||''))),
                        isAdmAllocationEnabled: this.isAdmAllocationEnabled,
                        getAdmAllocationForMonth: this.getAdmAllocationForMonth ? this.getAdmAllocationForMonth.bind(this) : null,
                        getMgmtFeeAllocationForMonth: this.getMgmtFeeAllocationForMonth ? this.getMgmtFeeAllocationForMonth.bind(this) : null,
                        calculateKeyRatiosMonthly: this.calculateKeyRatiosMonthly ? this.calculateKeyRatiosMonthly.bind(this) : null,
                        currentDREExportData: this.currentDREExportData || []
                    };
                }
                return window.AbaDreBudget.render('view-dre-budget', ctx);
            }
        } catch (e) { console.warn('Erro delegando renderDREBudget para AbaDreBudget', e); }

        // Fallback para implementação legada caso o módulo falhe ou não exista
        if (typeof this._legacyRenderDREBudget === 'function') return this._legacyRenderDREBudget();
    },

    _legacyRenderDREBudget() {
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
                        normalizeAccountDigits: this.normalizeAccountDigits,
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

    renderDRESuecia() {
        // Debounced wrapper similar to other DRE renderers
        if (this._dreSueciaTimer) clearTimeout(this._dreSueciaTimer);
        this._dreSueciaTimer = setTimeout(() => {
            try {
                // If module provides prepareCtx, prefer it
                let ctx = null;
                if (window.AbaDreSuecia && typeof window.AbaDreSuecia.prepareCtx === 'function') {
                    try { ctx = window.AbaDreSuecia.prepareCtx(this); } catch(e) { ctx = null; }
                }

                if (!ctx) {
                    const getFilterValue = (id) => { const el = document.getElementById(id); if (!el) return ''; const v = String(el.value || '').trim(); return v === 'Todos...' ? '' : v; };
                    const year = parseInt(document.getElementById('dre-suecia-year') ? document.getElementById('dre-suecia-year').value : (new Date()).getFullYear());
                    const month = parseInt(document.getElementById('dre-suecia-month') ? document.getElementById('dre-suecia-month').value : (new Date()).getMonth()+1);
                    const type = document.getElementById('dre-suecia-type') ? document.getElementById('dre-suecia-type').value : 'ytd';
                    const view = document.getElementById('dre-suecia-view') ? document.getElementById('dre-suecia-view').value : 'departamento';
                    ctx = {
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
                        keyRatiosData: this.keyRatiosData || [],
                        mgmtDetailData: this.mgmtDetailData || {},
                        isAdmAllocationSueciaEnabled: !!this.isAdmAllocationSueciaEnabled,
                        exemptCCs: this.exemptCCs || [],
                        dreDeptLayout: (window.DreConfig && Array.isArray(DreConfig.dreDeptLayout)) ? DreConfig.dreDeptLayout : (this.dreDeptLayout || []),
                        normalizeAccountDigits: (window.AppUtils && AppUtils.normalizeAccountDigits) || (this.normalizeAccountDigits ? this.normalizeAccountDigits.bind(this) : (s=>String(s||''))),
                        getLastMonthHeads: this.getLastMonthHeads ? this.getLastMonthHeads.bind(this) : null
                    };
                }

                if (window.AbaDreSuecia && typeof window.AbaDreSuecia.render === 'function') {
                    window.AbaDreSuecia.render('view-dre-suecia', ctx);
                    return;
                }
            } catch (e) {
                console.error('Erro delegando renderDRESuecia para AbaDreSuecia:', e);
            }
            // Fallback: clear table body
            try { const tbody = document.getElementById('dre-suecia-body'); if (tbody) tbody.innerHTML = ''; } catch(e) {}
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

    renderDREDepartamento() {
        try {
            // If module provides a prepareCtx helper, use it to ensure parity with extracted module
            let ctx = null;
            if (window.AbaDreDepartamento && typeof window.AbaDreDepartamento.prepareCtx === 'function') {
                try { ctx = window.AbaDreDepartamento.prepareCtx(this); } catch(e) { ctx = null; }
            }

            if (!ctx) {
                const getFilterValue = (id) => {
                    const el = document.getElementById(id); if (!el) return ''; const v = String(el.value || '').trim(); return v === 'Todos...' ? '' : v;
                };
                const year = parseInt(document.getElementById('dre-dept-year') ? document.getElementById('dre-dept-year').value : (new Date().getFullYear()));
                const month = parseInt(document.getElementById('dre-dept-month') ? document.getElementById('dre-dept-month').value : (new Date().getMonth()+1));
                const type = document.getElementById('dre-dept-type') ? document.getElementById('dre-dept-type').value : 'accumulated';
                ctx = {
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
                    keyRatiosData: this.keyRatiosData || [],
                    balanceData: this.balanceData || [],
                    exemptCCs: this.exemptCCs || [],
                    isAdmAllocationEnabled: !!this.isAdmAllocationEnabled,
                    isAdmAllocationSueciaEnabled: !!this.isAdmAllocationSueciaEnabled,
                    dreDeptLayout: (window.DreConfig && Array.isArray(DreConfig.dreDeptLayout)) ? DreConfig.dreDeptLayout : (this.dreDeptLayout || []),
                    // account groups (populated from DreConfig during init or here as fallback)
                    custoAccounts: (window.DreConfig && DreConfig.accountGroups && Array.isArray(DreConfig.accountGroups.custoAccounts)) ? DreConfig.accountGroups.custoAccounts : (this.custoAccounts || []),
                    depreciacaoAccounts: (window.DreConfig && DreConfig.accountGroups && Array.isArray(DreConfig.accountGroups.depreciacaoAccounts)) ? DreConfig.accountGroups.depreciacaoAccounts : (this.depreciacaoAccounts || []),
                    pessoalAccounts: (window.DreConfig && DreConfig.accountGroups && Array.isArray(DreConfig.accountGroups.pessoalAccounts)) ? DreConfig.accountGroups.pessoalAccounts : (this.pessoalAccounts || []),
                    viagensAccounts: (window.DreConfig && DreConfig.accountGroups && Array.isArray(DreConfig.accountGroups.viagensAccounts)) ? DreConfig.accountGroups.viagensAccounts : (this.viagensAccounts || []),
                    aluguelAccounts: (window.DreConfig && DreConfig.accountGroups && Array.isArray(DreConfig.accountGroups.aluguelAccounts)) ? DreConfig.accountGroups.aluguelAccounts : (this.aluguelAccounts || []),
                    servicosProfissionaisAccounts: (window.DreConfig && DreConfig.accountGroups && Array.isArray(DreConfig.accountGroups.servicosProfissionaisAccounts)) ? DreConfig.accountGroups.servicosProfissionaisAccounts : (this.servicosProfissionaisAccounts || []),
                    taxasAccounts: (window.DreConfig && DreConfig.accountGroups && Array.isArray(DreConfig.accountGroups.taxasAccounts)) ? DreConfig.accountGroups.taxasAccounts : (this.taxasAccounts || []),
                    normalizeAccountDigits: (window.AppUtils && AppUtils.normalizeAccountDigits) || (this.normalizeAccountDigits ? this.normalizeAccountDigits.bind(this) : (s=>String(s||''))),
                    getLastMonthHeads: this.getLastMonthHeads ? this.getLastMonthHeads.bind(this) : null
                };
            }

            if (window.AbaDreDepartamento && typeof window.AbaDreDepartamento.render === 'function') {
                window.AbaDreDepartamento.render('view-dre-departamento', ctx);
                return;
            }
        } catch (e) {
            console.error('Erro delegando renderDREDepartamento para AbaDreDepartamento:', e);
        }
        // Fallback: clear tbody
        try { const tbody = document.getElementById('dre-departamento-body'); if (tbody) tbody.innerHTML = ''; } catch (e) {}
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
        // Use AppUtils.normalizeAccountDigits when available; otherwise fallback to stripping non-digits.
        const normalizer = (window.AppUtils && typeof AppUtils.normalizeAccountDigits === 'function')
            ? AppUtils.normalizeAccountDigits
            : (s => String(s || '').replace(/\D/g, ''));
        const d = normalizer(conta);
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
        try { console.info('renderLocks completed', { locksCount: this.locks.length, exemptCount: (this.exemptCCs||[]).length }); } catch(e){}
        // Ensure exempt centros and OCRA config are rendered when opening Config
        try { if (typeof this.renderExemptCCs === 'function') this.renderExemptCCs(); } catch(e) { console.warn('renderExemptCCs failed', e); }
        try { if (typeof this.renderOcraConfigList === 'function') this.renderOcraConfigList(); } catch(e) { /* ignore */ }
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
        try { console.info('app.renderOcraConfigList called', { ocraConfigCount: (this.ocraConfig && this.ocraConfig.length) || 0 }); } catch(e){}
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
                    this.ocraConfig = o.ocraConfig || [];
                    this.exemptCCs = o.exemptCCs || [];
                    this.keyRatiosData = o.keyRatiosData || [];
                    this.centrosCusto = o.centrosCusto || [];
                    this.keyRatiosBudgetData = o.keyRatiosBudgetData || [];
                    this.savedImportedFiles = o.savedImportedFiles || [];
                    console.info('loadFromStorage: loaded from Electron disk (fin-system/db.json)');
                    console.debug('loadFromStorage: counts', { data: (this.data||[]).length, planoContas: (this.planoContas||[]).length, keyRatios: (this.keyRatiosData||[]).length, mgmtFees: (this.mgmtFees||[]).length });
                    // Após carregar do disco, garantir que filtros e views sejam atualizados
                    try { this.renderSavedImports(); this.renderSavedImportsInline(); } catch (e) { /* ignore */ }
                    try { if (typeof this.populateFilters === 'function') this.populateFilters(); } catch(e) { console.warn('populateFilters failed', e); }
                    try { if (typeof this.setupDynamicFilters === 'function') this.setupDynamicFilters(); } catch(e) { console.warn('setupDynamicFilters failed', e); }
                    try {
                        if (!document.getElementById('view-dre').classList.contains('hidden')) this.renderDRE();
                        if (!document.getElementById('view-dre-acumulado').classList.contains('hidden')) this.renderDREAcumulado();
                        if (!document.getElementById('view-dre-budget-2').classList.contains('hidden')) this.renderDREBudget2();
                        if (!document.getElementById('view-dre-departamento').classList.contains('hidden')) this.renderDREDepartamento();
                        if (!document.getElementById('view-dre-suecia').classList.contains('hidden')) this.renderDRESuecia();
                        if (!document.getElementById('view-mgmt-fee').classList.contains('hidden')) this.renderMgmtFeesList();
                        if (!document.getElementById('view-data').classList.contains('hidden')) this.renderData();
                        if (!document.getElementById('view-centros-custo').classList.contains('hidden')) this.renderCentrosCusto();
                    } catch (e) { console.warn('Initial render after loadFromStorage failed', e); }
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
                    this.ocraConfig = o.ocraConfig || [];
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

        // Debug: log que tipo de fallback foi usado e contagens finais
        try {
            console.info('loadFromStorage: finished (fallback localStorage or legacy keys)');
            console.debug('loadFromStorage: counts', { data: (this.data||[]).length, planoContas: (this.planoContas||[]).length, keyRatios: (this.keyRatiosData||[]).length, mgmtFees: (this.mgmtFees||[]).length });
        } catch(e) {}

        // Reconstrói filtros dinâmicos (anos / datalists) antes do primeiro render
        try {
            if (typeof this.populateFilters === 'function') this.populateFilters();
        } catch(e) { console.warn('populateFilters failed', e); }
        try {
            if (typeof this.setupDynamicFilters === 'function') this.setupDynamicFilters();
        } catch(e) { console.warn('setupDynamicFilters failed', e); }

        // Após carregar storage e popular filtros, força um primeiro render nas views visíveis para evitar telas vazias
        try {
            if (!document.getElementById('view-dre').classList.contains('hidden')) this.renderDRE();
            if (!document.getElementById('view-dre-acumulado').classList.contains('hidden')) this.renderDREAcumulado();
            if (!document.getElementById('view-dre-budget-2').classList.contains('hidden')) this.renderDREBudget2();
            if (!document.getElementById('view-dre-departamento').classList.contains('hidden')) this.renderDREDepartamento();
            if (!document.getElementById('view-dre-suecia').classList.contains('hidden')) this.renderDRESuecia();
            if (!document.getElementById('view-mgmt-fee').classList.contains('hidden')) this.renderMgmtFeesList();
            if (!document.getElementById('view-data').classList.contains('hidden')) this.renderData();
            if (!document.getElementById('view-centros-custo').classList.contains('hidden')) this.renderCentrosCusto();
        } catch (e) { console.warn('Initial render after loadFromStorage failed', e); }
    },

    // HIST (arquivado): dropdown de imports salvos removido da UI — ver `docs/LEGADO_script_comments.md`

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

                    // FORÇAR: incluir também as contas componentes de receita (3xxx-7xxx) na exportação
                    // removemos o retorno que pulava essas contas para que apareçam no arquivo exportado.

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

// Minimal robust implementation of app.switchTab and app.init
// These are intentionally conservative: they restore the public API
// used by inline handlers in `index.html` and call the proper renderers.
app.switchTab = function(tabKey) {
    try {
        if (!tabKey) return;
        // Map logical tab keys to view IDs
        const map = {
            'dre': 'view-dre',
            'dre-acumulado': 'view-dre-acumulado',
            'dre-budget-2': 'view-dre-budget-2',
            'dre-departamento': 'view-dre-departamento',
            'dre-suecia': 'view-dre-suecia',
            'mgmt-fee': 'view-mgmt-fee',
            'data': 'view-data',
            'margin-analysis': 'view-margin-analysis',
            'locks': 'view-locks',
            'centros-custo': 'view-centros-custo',
            'import-receita': 'view-import',
            'import-despesa': 'view-import',
            'import-budget': 'view-import',
            'import-key-ratios': 'view-import',
            'import-key-ratios-budget': 'view-import',
            'import-plano-contas': 'view-import',
            'import-balance': 'view-import'
        };

        const viewId = map[tabKey] || ('view-' + tabKey);

        // Hide all view-* containers
        try {
            document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'));
        } catch (e) { /* ignore */ }

        const viewEl = document.getElementById(viewId);
        if (viewEl) viewEl.classList.remove('hidden');

        // Update tab button active state
        try {
            document.querySelectorAll('[id^="tab-"]').forEach(b => { b.classList.remove('tab-active'); b.classList.add('tab-inactive'); });
            const btn = document.getElementById('tab-' + tabKey);
            if (btn) { btn.classList.remove('tab-inactive'); btn.classList.add('tab-active'); }
        } catch (e) { /* ignore */ }

        // If this is an import tab, set context for the importer
        try {
            if (String(tabKey).startsWith('import-')) this.setImportContext(tabKey);
        } catch (e) { /* ignore */ }

        // Trigger renderer for the shown view when available
        try {
            if (viewId === 'view-dre') this.renderDRE && this.renderDRE();
            if (viewId === 'view-dre-acumulado') this.renderDREAcumulado && this.renderDREAcumulado();
            if (viewId === 'view-dre-budget-2') this.renderDREBudget2 && this.renderDREBudget2();
            if (viewId === 'view-dre-departamento') this.renderDREDepartamento && this.renderDREDepartamento();
            if (viewId === 'view-dre-suecia') this.renderDRESuecia && this.renderDRESuecia();
            if (viewId === 'view-mgmt-fee') this.renderMgmtFeesList && this.renderMgmtFeesList();
            if (viewId === 'view-data') this.renderData && this.renderData();
            if (viewId === 'view-margin-analysis') this.renderMarginAnalysis && this.renderMarginAnalysis();
            if (viewId === 'view-centros-custo') this.renderCentrosCusto && this.renderCentrosCusto();
        } catch (e) { console.warn('switchTab renderer failed', e); }

        try { window.location.hash = tabKey; } catch(e) {}
    } catch (err) {
        console.error('switchTab failed', err);
    }
};

app.init = async function() {
    if (this._inited) return;
    try {
        // Ensure filters and dynamic controls exist
        try { if (typeof this.populateFilters === 'function') this.populateFilters(); } catch(e) {}
        try { if (typeof this.setupDynamicFilters === 'function') this.setupDynamicFilters(); } catch(e) {}

        // Load persisted state (handles electron/localStorage fallback)
        try { if (typeof this.loadFromStorage === 'function') await this.loadFromStorage(); } catch(e) { console.warn('loadFromStorage in init failed', e); }

        // Sincronizar configurações de DRE (layout e grupos de contas) se o arquivo de config carregou posteriormente
        try {
            if (window.DreConfig) {
                try { this.dreDeptLayout = Array.isArray(DreConfig.dreDeptLayout) ? DreConfig.dreDeptLayout : (this.dreDeptLayout || []); } catch(e) { /* ignore */ }
                try {
                    const g = DreConfig.accountGroups || {};
                    this.custoAccounts = Array.isArray(g.custoAccounts) ? g.custoAccounts : (this.custoAccounts || []);
                    this.depreciacaoAccounts = Array.isArray(g.depreciacaoAccounts) ? g.depreciacaoAccounts : (this.depreciacaoAccounts || []);
                    this.pessoalAccounts = Array.isArray(g.pessoalAccounts) ? g.pessoalAccounts : (this.pessoalAccounts || []);
                    this.aluguelAccounts = Array.isArray(g.aluguelAccounts) ? g.aluguelAccounts : (this.aluguelAccounts || []);
                    this.viagensAccounts = Array.isArray(g.viagensAccounts) ? g.viagensAccounts : (this.viagensAccounts || []);
                    this.deductionAccounts = Array.isArray(g.deductionAccounts) ? g.deductionAccounts : (this.deductionAccounts || []);
                    this.diversasAccounts = Array.isArray(g.diversasAccounts) ? g.diversasAccounts : (this.diversasAccounts || []);
                    this.servicosProfissionaisAccounts = Array.isArray(g.servicosProfissionaisAccounts) ? g.servicosProfissionaisAccounts : (this.servicosProfissionaisAccounts || []);
                    this.taxasAccounts = Array.isArray(g.taxasAccounts) ? g.taxasAccounts : (this.taxasAccounts || []);
                    this.outrasAdmAccounts = Array.isArray(g.outrasAdmAccounts) ? g.outrasAdmAccounts : (this.outrasAdmAccounts || []);
                    this.posEbitdaAccounts = Array.isArray(g.posEbitdaAccounts) ? g.posEbitdaAccounts : (this.posEbitdaAccounts || []);
                    this.managementFeeAccounts = Array.isArray(g.managementFeeAccounts) ? g.managementFeeAccounts : (this.managementFeeAccounts || []);
                } catch(e) { /* ignore */ }
            }
        } catch(e) { /* ignore DreConfig sync errors */ }

        // Honor location.hash if present, otherwise keep existing visible view or default to 'dre'
        const hash = (window.location.hash || '').replace('#','');
        if (hash) {
            try { this.switchTab(hash); } catch(e) {}
        } else {
            // If an import view is visible by default, keep it; otherwise prefer 'dre'
            const importView = document.getElementById('view-import');
            const shouldShowImport = importView && !importView.classList.contains('hidden');
            if (shouldShowImport) {
                this.switchTab('import-receita');
            } else {
                this.switchTab('dre');
            }
        }
    } catch (err) {
        console.error('app.init internal error', err);
    }
    this._inited = true;
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

// Expor helpers comuns caso não existam como métodos de `app`.
// Isso assegura compatibilidade com módulos que chamam `this.normalizeAccountDigits`.
try {
    if (!app.normalizeAccountDigits) {
        app.normalizeAccountDigits = (window.AppUtils && AppUtils.normalizeAccountDigits) || (s => String(s || '').replace(/\D/g, ''));
    }
} catch (e) { /* ignore */ }

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
            normalizeAccountDigits: (window.AppUtils && AppUtils.normalizeAccountDigits) || (this.normalizeAccountDigits ? this.normalizeAccountDigits.bind(this) : (s => String(s||'').replace(/\D/g, ''))),
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

    // HIST (arquivado): scaling do preview removido; import usa valores do arquivo — ver `docs/LEGADO_script_comments.md`

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