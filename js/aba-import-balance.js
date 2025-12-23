(function(){
    // Módulo de importação / visualização / export Balanço e Pos EBIT
    window.AbaImportBalance = {
        processBalanceData(app, rows) {
            app.tempData = [];
            // Detect mapping offset more robustly by scoring candidate offsets
                // If the file already has 7+ columns per row and they look like the expected layout
                // (contaReduzida, contaGrande, descricao, saldoFinal, contaOCRA, mes, ano) prefer that mapping.
                const preferStraightMapping = (rows) => {
                    const maxCheck = Math.min(30, rows.length - 1);
                    let good = 0, total = 0;
                    for (let i = 1; i <= maxCheck; i++) {
                        const r = rows[i]; if (!r || r.length < 7) continue; total++;
                        // check saldo (col 3) parseable as number
                        const rawValor = String(r[3] || '');
                        let numOk = false;
                        try {
                            const num = (app.parseLocaleNumber ? app.parseLocaleNumber(rawValor) : (window.AppUtils && AppUtils.parseLocaleNumber ? AppUtils.parseLocaleNumber(rawValor) : parseLocaleNumber(rawValor)));
                            numOk = !isNaN(Number(num));
                        } catch(e) { numOk = false; }
                        // check month and year columns
                        const mm = r[5]; const yy = r[6];
                        const mmOk = (!isNaN(Number(mm)) && Number(mm) >=1 && Number(mm) <=12) || (app.parseMonthString && app.parseMonthString(mm) !== null) || (window.AppUtils && AppUtils.parseMonthString && AppUtils.parseMonthString(mm) !== null);
                        const yyOk = (!isNaN(Number(yy)) && String(Number(yy)).length >= 3);
                        if (numOk && mmOk && yyOk) good++;
                    }
                    return total > 0 && (good / total) >= 0.6; // 60% confidence
                };

                // declare offset variable; prefer straight mapping when detected
                let offset;
                if (preferStraightMapping(rows)) {
                    try { app._lastBalanceMapping = Object.assign(app._lastBalanceMapping || {}, { preferredMapping: 'straight7' }); } catch(e) {}
                    offset = 0;
                }

            const detectOffset = (rows) => {
                const maxCheck = Math.min(30, rows.length - 1);
                const minOffset = -2;
                const maxOffset = 4; // try offsets -2..4
                const parseMonth = (v) => {
                    try { return (app.parseMonthString ? app.parseMonthString(v) : (window.AppUtils && AppUtils.parseMonthString ? AppUtils.parseMonthString(v) : parseMonthString(v))); } catch(e) { return null; }
                };
                const tryOffset = (off) => {
                    let score = 0, checked = 0;
                    for (let i = 1; i <= maxCheck; i++) {
                        const r = rows[i]; if (!r) continue;
                        checked++;
                        const cConta = r[0+off];
                        const cGrande = r[1+off];
                        const cDesc = r[2+off];
                        const cValor = r[3+off];
                        const cOcra = r[4+off];
                        const cMes = r[5+off];
                        const cAno = r[6+off];

                        // conta reduzida should look like digits or structured code
                        if (cConta && String(cConta).trim().length > 0) {
                            if (/\d/.test(String(cConta))) score += 1;
                        }

                        // valor should be parseable as number
                        try {
                            const num = (app.parseLocaleNumber ? app.parseLocaleNumber(String(cValor||'')) : (window.AppUtils && AppUtils.parseLocaleNumber ? AppUtils.parseLocaleNumber(String(cValor||'')) : parseLocaleNumber(String(cValor||''))));
                            if (!isNaN(Number(num))) score += 2;
                        } catch(e) {}

                        // month/year detection
                        const mm = parseMonth(cMes) !== null || (!isNaN(Number(cMes)) && Number(cMes) >=1 && Number(cMes) <=12);
                        const yy = (!isNaN(Number(cAno)) && String(Number(cAno)).length >= 3);
                        if (mm && yy) score += 3;

                        // contaOCRA presence gives small boost
                        if (cOcra && String(cOcra).trim().length > 0) score += 0.5;
                    }
                    return { score, checked };
                };

                let best = { off: 0, score: -1 };
                const details = [];
                for (let off = minOffset; off <= maxOffset; off++) {
                    const res = tryOffset(off);
                    const norm = res.checked > 0 ? (res.score / res.checked) : 0;
                    details.push({ off, score: norm, checked: res.checked });
                    if (norm > best.score) best = { off, score: norm };
                }
                try { app._lastBalanceMapping = Object.assign(app._lastBalanceMapping || {}, { offsetScores: details }); } catch(e) {}
                return best.off;
            };

            if (typeof offset === 'undefined') offset = detectOffset(rows);

            // Save original header for preview (first row) and raw data rows
            try { app.tempRawHeader = Array.isArray(rows[0]) ? rows[0].map(h => h === undefined ? '' : String(h)) : []; } catch(e) { app.tempRawHeader = []; }
            try { app.tempRawDataRows = rows.slice(1).map(r => Array.isArray(r) ? r.map(c => c) : []); } catch(e) { app.tempRawDataRows = []; }

            // Save mapping guess for debugging
            try { app._lastBalanceMapping = { offset }; } catch(e) {}

            // Detect if month and year are provided in a single column (e.g. "03/2024" or "Mar 2024") at position c5
            const detectCombinedMonthYear = (rows, off) => {
                let cnt = 0, total = 0;
                const maxCheck = Math.min(30, rows.length - 1);
                for (let i = 1; i <= maxCheck; i++) {
                    const r = rows[i]; if (!r) continue; total++;
                    const cand = String(r[5+off] || '').trim();
                    if (!cand) continue;
                    // common patterns: 03/2024, 3/24, Mar 2024, 2024-03, "Março 2024"
                    if (/\d{1,2}\/\d{2,4}/.test(cand) || /\d{4}-\d{1,2}/.test(cand) || /\d{4}\s+\d{1,2}/.test(cand) || /[A-Za-zÀ-ÿ]+\s+\d{4}/.test(cand)) cnt++;
                }
                return total > 0 && (cnt / total) > 0.4; // >40% rows indicate combined format
            };

            const mesAnoCombined = detectCombinedMonthYear(rows, offset);
            try { app._lastBalanceMapping = Object.assign(app._lastBalanceMapping || {}, { offset, mesAnoCombined }); } catch(e) {}

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row) continue;

                const c0 = 0 + offset;
                const c1 = 1 + offset;
                const c2 = 2 + offset;
                const c3 = 3 + offset;
                const c4 = 4 + offset;
                const c5 = 5 + offset;
                const c6 = 6 + offset;

                const parseLocale = (v) => {
                    try { return (app.parseLocaleNumber ? app.parseLocaleNumber(String(v || '')) : (window.AppUtils && AppUtils.parseLocaleNumber ? AppUtils.parseLocaleNumber(String(v || '')) : parseLocaleNumber(String(v || '')))); } catch(e) { return Number(String(v || '').replace(/[^0-9\-,.]/g, '')) || 0; }
                };

                let item = { id: Date.now() + Math.random(), _rawRow: row };
                if (mesAnoCombined) {
                    // expected columns: c0=contaReduzida, c1=contaGrande, c2=descricao, c3=contaOCRA, c4=saldoFinal, c5=mes/ano
                    item.contaReduzida = row[c0];
                    item.contaGrande = row[c1];
                    item.descricao = row[c2];
                    item.contaOCRA = row[c3];
                    item.saldoFinal = parseLocale(row[c4]) || Number(row[c4]) || 0;
                    const my = String(row[c5] || '').trim();
                    // try parse formats like MM/YYYY or M/YYYY or YYYY-MM or 'Mar 2024'
                    let parsedMonth = null, parsedYear = null;
                    const m1 = my.match(/(\d{1,2})\/(\d{2,4})/);
                    if (m1) { parsedMonth = Number(m1[1]); parsedYear = Number(m1[2].length===2 ? ('20'+m1[2]) : m1[2]); }
                    else {
                        const m2 = my.match(/(\d{4})-(\d{1,2})/);
                        if (m2) { parsedYear = Number(m2[1]); parsedMonth = Number(m2[2]); }
                        else {
                            // try split by space: 'Mar 2024' or 'Março 2024' or '03 2024'
                            const parts = my.split(/\s+/);
                            if (parts.length >= 2) {
                                const last = parts[parts.length-1];
                                if (/^\d{4}$/.test(last)) {
                                    parsedYear = Number(last);
                                    const first = parts.slice(0, parts.length-1).join(' ');
                                    parsedMonth = (app.parseMonthString ? app.parseMonthString(first) : (window.AppUtils && AppUtils.parseMonthString ? AppUtils.parseMonthString(first) : parseMonthString(first)));
                                }
                            }
                        }
                    }
                    item.mes = parsedMonth !== null ? parsedMonth : (row[c5] || '');
                    item.ano = parsedYear !== null ? parsedYear : '';
                } else {
                    // default mapping: c0=contaReduzida, c1=contaGrande, c2=descricao, c3=saldoFinal, c4=contaOCRA, c5=mes, c6=ano
                    item.contaReduzida = row[c0];
                    item.contaGrande = row[c1];
                    item.descricao = row[c2];
                    item.saldoFinal = parseLocale(row[c3]) || Number(row[c3]) || 0;
                    item.contaOCRA = row[c4];
                    item.mes = row[c5];
                    item.ano = row[c6];
                }

                if (!item.contaReduzida && !item.contaOCRA) continue;

                app.tempData.push(item);
            }

            if (app.tempData.length === 0) {
                app.showToast && app.showToast("Nenhum dado válido encontrado para Balanço/Pos EBIT.", true);
                return;
            }
            app.renderPreview && app.renderPreview();
        },

        renderBalanceData(app) {
            try {
                const tbody = document.getElementById('balance-list-body');
                if(!tbody) return;
                tbody.innerHTML = '';
                const list = (window.DataAPI && typeof DataAPI.getBalanceData === 'function') ? DataAPI.getBalanceData(app) : (app.balanceData || []);
                const sorted = [...list].sort((a,b) => {
                    if (a.ano !== b.ano) return b.ano - a.ano;
                    if (a.mes !== b.mes) return b.mes - a.mes;
                    return String(a.contaReduzida).localeCompare(String(b.contaReduzida));
                });
                sorted.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.className = 'hover:bg-gray-50';
                    tr.innerHTML = `
                        <td class="px-2 py-2">${item.mes}/${item.ano}</td>
                        <td class="px-2 py-2">${item.contaReduzida || ''}</td>
                        <td class="px-2 py-2">${item.contaGrande || ''}</td>
                        <td class="px-2 py-2 truncate max-w-xs" title="${item.descricao}">${item.descricao || ''}</td>
                        <td class="px-2 py-2">${item.contaOCRA || ''}</td>
                        <td class="px-2 py-2 text-right font-mono">${(item.saldoFinal || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                    `;
                    tbody.appendChild(tr);
                });
            } catch (e) {
                console.error('Erro em AbaImportBalance.renderBalanceData', e);
            }
        },

        clearBalanceData(app) {
            try {
                if (confirm("Tem certeza que deseja limpar todos os dados de Balanço e Pos EBIT?")) {
                    if (window.DataAPI && typeof DataAPI.setBalanceData === 'function') {
                        DataAPI.setBalanceData(app, []);
                    } else {
                        app.balanceData = [];
                        app.saveToStorage && app.saveToStorage();
                    }
                    app.renderBalanceData && app.renderBalanceData();
                    app.showToast && app.showToast("Dados de Balanço limpos.");
                }
            } catch(e) { console.error('Erro em AbaImportBalance.clearBalanceData', e); }
        },

        exportBalanceData(app) {
            try {
                const list = (window.DataAPI && typeof DataAPI.getBalanceData === 'function') ? DataAPI.getBalanceData(app) : (app.balanceData || []);
                if (!list || list.length === 0) {
                    app.showToast && app.showToast("Não há dados de Balanço para exportar.", true);
                    return;
                }
                const dataToExport = list.map(item => ({
                    "Mês": item.mes,
                    "Ano": item.ano,
                    "Conta Reduzida": item.contaReduzida,
                    "Conta Grande": item.contaGrande,
                    "Descrição": item.descricao,
                    "Conta OCRA": item.contaOCRA,
                    "Saldo Final": item.saldoFinal
                }));
                const ws = XLSX.utils.json_to_sheet(dataToExport);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Balanço e Pos EBIT");
                XLSX.writeFile(wb, "Balanco_Pos_EBIT.xlsx");
            } catch (e) { console.error('Erro em AbaImportBalance.exportBalanceData', e); }
        }
        ,

        applyMapping(app, mapping) {
            // mapping: 'straight7' corresponds to columns A..G -> [contaReduzida, contaGrande, descricao, saldoFinal, contaOCRA, mes, ano]
            try {
                if (!app.tempRawDataRows || !Array.isArray(app.tempRawDataRows)) return;
                const rows = app.tempRawDataRows;
                app.tempData = [];
                const parseLocale = (v) => {
                    try { return (app.parseLocaleNumber ? app.parseLocaleNumber(String(v || '')) : (window.AppUtils && AppUtils.parseLocaleNumber ? AppUtils.parseLocaleNumber(String(v || '')) : parseLocaleNumber(String(v || '')))); } catch(e) { return Number(String(v || '').replace(/[^0-9\-,.]/g, '')) || 0; }
                };
                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i]; if (!row) continue;
                    if (mapping === 'straight7') {
                        // ensure indexes
                        const item = {
                            id: Date.now() + Math.random(),
                            _rawRow: row,
                            contaReduzida: row[0],
                            contaGrande: row[1],
                            descricao: row[2],
                            saldoFinal: parseLocale(row[3]) || Number(row[3]) || 0,
                            contaOCRA: row[4],
                            mes: row[5],
                            ano: row[6]
                        };
                        if (!item.contaReduzida && !item.contaOCRA) continue;
                        app.tempData.push(item);
                    }
                }
                try { app._lastBalanceMapping = Object.assign(app._lastBalanceMapping || {}, { applied: mapping }); } catch(e) {}
                // re-render preview
                if (typeof app.renderPreview === 'function') app.renderPreview();
            } catch (e) {
                console.error('Erro em AbaImportBalance.applyMapping', e);
            }
        }
        ,

        renderPreview(app) {
            try {
                const tbody = document.getElementById('preview-body');
                const table = tbody ? tbody.parentElement : null;
                const thead = table ? table.querySelector('thead') : null;
                if (!tbody || !thead) return;
                tbody.innerHTML = '';
                thead.innerHTML = '';

                // Show original file columns in preview exactly as imported: use app.tempRawHeader and app.tempRawDataRows
                const rawHeader = (app.tempRawHeader && app.tempRawHeader.length) ? app.tempRawHeader : (app.tempData && app.tempData[0] && app.tempData[0]._rawRow ? app.tempData[0]._rawRow.map((_,i)=>`Col ${i+1}`) : []);
                const headerHTML = rawHeader.map(h => `<th class="px-4 py-2 text-left">${String(h || '')}</th>`).join('');
                thead.innerHTML = headerHTML;

                const rawRows = (app.tempRawDataRows && app.tempRawDataRows.length) ? app.tempRawDataRows : (app.tempData ? app.tempData.map(d => d._rawRow || []) : []);
                rawRows.slice(0,5).forEach(raw => {
                    const tr = document.createElement('tr');
                    tr.className = "bg-teal-50 text-teal-800";
                    const cells = rawHeader.map((_, idx) => {
                        const c = raw && raw.length > idx ? raw[idx] : '';
                        return `<td class="px-4 py-2">${c === undefined || c === null ? '' : String(c)}</td>`;
                    }).join('');
                    tr.innerHTML = cells;
                    tbody.appendChild(tr);
                });

                // Add mapping control (force straight A..G mapping)
                try {
                    const previewSection = document.getElementById('preview-section');
                    if (previewSection) {
                        let ctrl = document.getElementById('preview-mapping-controls');
                        if (!ctrl) {
                            ctrl = document.createElement('div');
                            ctrl.id = 'preview-mapping-controls';
                            ctrl.className = 'mt-3 flex items-center gap-2';
                            const btn = document.createElement('button');
                            btn.className = 'px-3 py-1 text-xs bg-yellow-200 rounded border border-yellow-300';
                            btn.innerText = 'Forçar mapeamento A→G (7 colunas)';
                            btn.onclick = function(){
                                if (window.AbaImportBalance && typeof window.AbaImportBalance.applyMapping === 'function') {
                                    window.AbaImportBalance.applyMapping(window.app, 'straight7');
                                } else {
                                    window.app.showToast && window.app.showToast('Módulo de Balanço não disponível.', true);
                                }
                            };
                            ctrl.appendChild(btn);
                            const parent = document.getElementById('preview-missing-centros');
                            if (parent && parent.parentElement) {
                                parent.parentElement.insertBefore(ctrl, parent);
                            } else {
                                previewSection.appendChild(ctrl);
                            }
                        }
                    }
                } catch(e) { console.warn('Erro ao inserir controles de mapeamento (balance)', e); }

            } catch (e) {
                console.error('Erro em AbaImportBalance.renderPreview', e);
            }
        }
    };
})();
