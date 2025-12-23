        // --- Key Ratios Budget helpers ---
        setKeyRatiosBudget(app, list, { persist = true, render = true } = {}) {
            if (!app) return;
            app.keyRatiosBudgetData = Array.isArray(list) ? list : [];
            if (persist && typeof app.saveToStorage === 'function') {
                try { app.saveToStorage(); } catch(e) { console.warn('DataAPI.setKeyRatiosBudget: saveToStorage failed', e); }
            }
            // Não há renderizador dedicado para budget, mas pode-se adicionar aqui se necessário
        },

        // --- Key Ratios Data helpers ---
        getKeyRatiosData(app) {
            return (app && Array.isArray(app.keyRatiosData)) ? app.keyRatiosData : [];
        },

        setKeyRatiosData(app, list, { persist = true, render = true } = {}) {
            if (!app) return;
            app.keyRatiosData = Array.isArray(list) ? list : [];
            if (persist && typeof app.saveToStorage === 'function') {
                try { app.saveToStorage(); } catch(e) { console.warn('DataAPI.setKeyRatiosData: saveToStorage failed', e); }
            }
            // Não há renderizador dedicado para keyRatiosData, mas pode-se adicionar aqui se necessário
        },
(function(){
    // Pequena API para encapsular operações sobre app.data e outros datasets (receita/despesa/keyRatios)
    // Objetivo: fornecer pontos de acesso padronizados sem alterar comportamento atual.
    const DataAPI = {
        // --- Generic data (app.data) ---
        getData(app) {
            return (app && app.data) ? app.data : [];
        },

        setData(app, newData, { persist = true, render = true } = {}) {
            if (!app) return;
            app.data = Array.isArray(newData) ? newData : [];
            if (persist && typeof app.saveToStorage === 'function') {
                try { app.saveToStorage(); } catch(e) { console.warn('DataAPI.saveToStorage failed', e); }
            }
            if (render && typeof app.renderData === 'function') {
                try { app.renderData(); } catch(e) { console.warn('DataAPI.renderData failed', e); }
            }
        },

        importData(app, rows, { merge = false, persist = true, render = true } = {}) {
            if (!app) return;
            if (!Array.isArray(rows)) return;
            if (!Array.isArray(app.data) || !merge) {
                app.data = rows.slice();
            } else {
                const existingById = new Map();
                app.data.forEach(d => { if (d && d.id !== undefined) existingById.set(String(d.id), d); });
                rows.forEach(r => {
                    if (r && r.id !== undefined) existingById.set(String(r.id), r);
                    else app.data.push(r);
                });
                if (existingById.size) app.data = Array.from(existingById.values());
            }

            if (persist && typeof app.saveToStorage === 'function') {
                try { app.saveToStorage(); } catch(e) { console.warn('DataAPI.saveToStorage failed', e); }
            }
            if (render && typeof app.renderData === 'function') {
                try { app.renderData(); } catch(e) { console.warn('DataAPI.renderData failed', e); }
            }
        },

        // --- Receita helpers ---
        getReceita(app) {
            return (app && Array.isArray(app.receita)) ? app.receita : [];
        },

        setReceita(app, list, { persist = true, render = true } = {}) {
            if (!app) return;
            app.receita = Array.isArray(list) ? list : [];
            if (persist && typeof app.saveToStorage === 'function') {
                try { app.saveToStorage(); } catch(e) { console.warn('DataAPI.setReceita: saveToStorage failed', e); }
            }
            const fn = (typeof app.renderReceita === 'function') ? app.renderReceita : (typeof app.renderData === 'function' ? app.renderData : null);
            if (render && fn) { try { fn(); } catch(e){ console.warn('DataAPI.setReceita: render failed', e); } }
        },

        importReceita(app, rows, { merge = false, persist = true, render = true } = {}) {
            if (!app || !Array.isArray(rows)) return;
            const header = (rows[0] || []).map(h => String(h || '').trim());
            const list = [];
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i]; if (!row) continue;
                const obj = {}; let any = false;
                for (let j = 0; j < header.length; j++) {
                    const key = header[j] || `col${j}`;
                    const val = row[j];
                    obj[key] = (val === undefined || val === null) ? '' : String(val).trim();
                    if (obj[key] !== '') any = true;
                }
                if (!any) continue;
                obj.id = Date.now() + Math.random();
                list.push(obj);
            }
            if (merge && Array.isArray(app.receita)) app.receita = app.receita.concat(list);
            else app.receita = list;
            if (persist && typeof app.saveToStorage === 'function') { try { app.saveToStorage(); } catch(e){ console.warn('DataAPI.importReceita: saveToStorage failed', e); } }
            const fn = (typeof app.renderReceita === 'function') ? app.renderReceita : (typeof app.renderData === 'function' ? app.renderData : null);
            if (render && fn) { try { fn(); } catch(e){ console.warn('DataAPI.importReceita: render failed', e); } }
        },

        // --- Despesa helpers ---
        getDespesa(app) {
            return (app && Array.isArray(app.despesa)) ? app.despesa : [];
        },

        setDespesa(app, list, { persist = true, render = true } = {}) {
            if (!app) return;
            app.despesa = Array.isArray(list) ? list : [];
            if (persist && typeof app.saveToStorage === 'function') {
                try { app.saveToStorage(); } catch(e) { console.warn('DataAPI.setDespesa: saveToStorage failed', e); }
            }
            const fn = (typeof app.renderDespesa === 'function') ? app.renderDespesa : (typeof app.renderData === 'function' ? app.renderData : null);
            if (render && fn) { try { fn(); } catch(e){ console.warn('DataAPI.setDespesa: render failed', e); } }
        },

        importDespesa(app, rows, { merge = false, persist = true, render = true } = {}) {
            if (!app || !Array.isArray(rows)) return;
            const header = (rows[0] || []).map(h => String(h || '').trim());
            const list = [];
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i]; if (!row) continue;
                const obj = {}; let any = false;
                for (let j = 0; j < header.length; j++) {
                    const key = header[j] || `col${j}`;
                    const val = row[j];
                    obj[key] = (val === undefined || val === null) ? '' : String(val).trim();
                    if (obj[key] !== '') any = true;
                }
                if (!any) continue;
                obj.id = Date.now() + Math.random();
                list.push(obj);
            }
            if (merge && Array.isArray(app.despesa)) app.despesa = app.despesa.concat(list);
            else app.despesa = list;
            if (persist && typeof app.saveToStorage === 'function') { try { app.saveToStorage(); } catch(e){ console.warn('DataAPI.importDespesa: saveToStorage failed', e); } }
            const fn = (typeof app.renderDespesa === 'function') ? app.renderDespesa : (typeof app.renderData === 'function' ? app.renderData : null);
            if (render && fn) { try { fn(); } catch(e){ console.warn('DataAPI.importDespesa: render failed', e); } }
        },

        // --- Key Ratios helpers ---
        getKeyRatios(app) {
            return (app && Array.isArray(app.keyRatios)) ? app.keyRatios : [];
        },

        setKeyRatios(app, list, { persist = true, render = true } = {}) {
            if (!app) return;
            app.keyRatios = Array.isArray(list) ? list : [];
            if (persist && typeof app.saveToStorage === 'function') {
                try { app.saveToStorage(); } catch(e) { console.warn('DataAPI.setKeyRatios: saveToStorage failed', e); }
            }
            const fn = (typeof app.renderKeyRatios === 'function') ? app.renderKeyRatios : (typeof app.renderData === 'function' ? app.renderData : null);
            if (render && fn) { try { fn(); } catch(e){ console.warn('DataAPI.setKeyRatios: render failed', e); } }
        },

        importKeyRatios(app, rows, { merge = false, persist = true, render = true } = {}) {
            if (!app || !Array.isArray(rows)) return;
            const header = (rows[0] || []).map(h => String(h || '').trim());
            const list = [];
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i]; if (!row) continue;
                const obj = {}; let any = false;
                for (let j = 0; j < header.length; j++) {
                    const key = header[j] || `col${j}`;
                    const val = row[j];
                    obj[key] = (val === undefined || val === null) ? '' : String(val).trim();
                    if (obj[key] !== '') any = true;
                }
                if (!any) continue;
                obj.id = Date.now() + Math.random();
                list.push(obj);
            }
            if (merge && Array.isArray(app.keyRatios)) app.keyRatios = app.keyRatios.concat(list);
            else app.keyRatios = list;
            if (persist && typeof app.saveToStorage === 'function') { try { app.saveToStorage(); } catch(e){ console.warn('DataAPI.importKeyRatios: saveToStorage failed', e); } }
            const fn = (typeof app.renderKeyRatios === 'function') ? app.renderKeyRatios : (typeof app.renderData === 'function' ? app.renderData : null);
            if (render && fn) { try { fn(); } catch(e){ console.warn('DataAPI.importKeyRatios: render failed', e); } }
        }

        // --- Centros de Custo helpers ---
        ,getCentrosCusto(app) {
            return (app && Array.isArray(app.centrosCusto)) ? app.centrosCusto : [];
        }

        ,setCentrosCusto(app, list, { persist = true, render = true } = {}) {
            if (!app) return;
            app.centrosCusto = Array.isArray(list) ? list : [];
            if (persist && typeof app.saveToStorage === 'function') {
                try { app.saveToStorage(); } catch(e) { console.warn('DataAPI.setCentrosCusto: saveToStorage failed', e); }
            }
            if (render && typeof app.setupDynamicFilters === 'function') {
                try { app.setupDynamicFilters(); } catch(e) { /* ignore */ }
            }
            if (render && typeof app.populateFilters === 'function') {
                try { app.populateFilters(); } catch(e) { /* ignore */ }
            }
        }

        ,importCentrosCusto(app, rows, { persist = true, render = true } = {}) {
            if (!app || !Array.isArray(rows)) return;
            if (rows.length <= 1) return;
            const list = [];
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i]; if (!row) continue;
                const projectIdRaw = row[0];
                const projectId = String(projectIdRaw === undefined || projectIdRaw === null ? '' : projectIdRaw).trim();
                if (!projectId) continue;
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
            app.centrosCusto = list;
            if (persist && typeof app.saveToStorage === 'function') { try { app.saveToStorage(); } catch(e){ console.warn('DataAPI.importCentrosCusto: saveToStorage failed', e); } }
            if (render && typeof app.populateFilters === 'function') { try { app.populateFilters(); } catch(e){} }
            if (render && typeof app.setupDynamicFilters === 'function') { try { app.setupDynamicFilters(); } catch(e){} }
        }

        // --- Plano de Contas helper ---
        setPlanoContas(app, list, { persist = true, render = true } = {}) {
            if (!app) return;
            app.planoContas = Array.isArray(list) ? list : [];
            if (persist && typeof app.saveToStorage === 'function') {
                try { app.saveToStorage(); } catch(e) { console.warn('DataAPI.setPlanoContas: saveToStorage failed', e); }
            }
            if (render && typeof app.renderPlanoContas === 'function') {
                try { app.renderPlanoContas(); } catch(e) { console.warn('DataAPI.setPlanoContas: render failed', e); }
            }
        },

        getPlanoContas(app) {
            return (app && Array.isArray(app.planoContas)) ? app.planoContas : [];
        },

        // --- Balance data helper ---
        setBalanceData(app, list, { persist = true, render = true } = {}) {
            if (!app) return;
            app.balanceData = Array.isArray(list) ? list : [];
            if (persist && typeof app.saveToStorage === 'function') {
                try { app.saveToStorage(); } catch(e) { console.warn('DataAPI.setBalanceData: saveToStorage failed', e); }
            }
            if (render && typeof app.renderBalanceData === 'function') {
                try { app.renderBalanceData(); } catch(e) { console.warn('DataAPI.setBalanceData: render failed', e); }
            }
        }
        ,getBalanceData(app) {
            return (app && Array.isArray(app.balanceData)) ? app.balanceData : [];
        }
    };

    window.DataAPI = DataAPI;
})();
