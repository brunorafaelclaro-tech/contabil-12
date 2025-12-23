// Módulo: Aba Import - Receita
// Fornece funções específicas para processar importações do tipo 'Receita'.
(function(){
    const mod = {};

    mod.confirmReceitaImport = function(app) {
        // Remove apenas registros do tipo Receita dos períodos importados
        const periodsToReplace = new Set((app.tempData || []).map(item => app.normalizePeriod(item.mes, item.ano)));
        let newList = (app.data || []).filter(item => {
            if (item.tipo !== 'Receita') return true;
            const period = app.normalizePeriod(item.mes, item.ano);
            return !periodsToReplace.has(String(period));
        });
        newList = [...newList, ...(app.tempData || [])];
        if (window.DataAPI && typeof DataAPI.importReceita === 'function') {
            DataAPI.importReceita(app, newList, { persist: true, render: true });
        } else {
            app.data = newList;
            if (app.saveToStorage) app.saveToStorage();
            if (typeof app.renderData === 'function') app.renderData();
        }
        app.showToast(`${(app.tempData || []).length} registros de Receita salvos.`);
        app.cancelImport();
    };

    mod.render = function(containerId, contexto) {
        // placeholder de render não-destrutivo: o HTML de import já existe em index.html
        // Este módulo não substitui DOM; apenas expõe funções de processamento.
    };

    mod.handleFileInput = function(app, input) {
        // Compatível com a chamada original: lê arquivo XLSX e encaminha para processor
        const file = input.files ? input.files[0] : null;
        if (!file) return;
        const fileNameEl = document.getElementById('fileName');
        if (fileNameEl) fileNameEl.innerText = file.name;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const wb = XLSX.read(data, { type: 'array' });
                const firstSheet = wb.SheetNames[0];
                const sheet = wb.Sheets[firstSheet];
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

                return mod.processFinancialData(app, rows);
            } catch (err) {
                console.error('Erro lendo arquivo (AbaImportReceita):', err);
                app.showToast('Erro ao ler arquivo: ' + (err.message || err), true);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    mod.processFinancialData = function(app, rows) {
        app.tempData = [];
        let lockedError = false;
        let lockedPeriodDetected = "";

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row) continue;

            let isNewFormat = false;
            if (row.length >= 6 && (row.length < 18 || String(row[5] || '').trim().length > 0)) {
                isNewFormat = true;
            }

            if (isNewFormat) {
                const conta = row[0] !== undefined ? String(row[0]).trim() : '';
                const descricao = row[1] !== undefined ? String(row[1]).trim() : '';
                const rawValor = row[2] !== undefined ? String(row[2]).trim() : '';
                const centroRaw = row[3] !== undefined ? String(row[3]).trim() : '';
                const mesRaw = row[4];
                const anoRaw = row[5];

                const valorNum = app.parseLocaleNumber(rawValor) || 0;
                const mes = Number(mesRaw);
                const ano = Number(anoRaw);
                const lockKey = `${mes}-${ano}`;
                if (app.locks.includes(lockKey)) {
                    lockedError = true;
                    lockedPeriodDetected = lockKey;
                    break;
                }

                const item = {
                    id: Date.now() + Math.random(),
                    tipo: app.currentImportType,
                    conta: conta,
                    contaOCRA: '',
                    descricao: descricao,
                    valor: Number(valorNum),
                    centroCusto: centroRaw || '',
                    departamento: '',
                    cliente: '',
                    sbd: '',
                    projectType: '',
                    mes: mes,
                    ano: ano
                };

                if (item.centroCusto) {
                    const check = app.findCentroByProjectId(item.centroCusto);
                    if (check) {
                        item.departamento = check.departamento || '';
                        item.cliente = check.cliente || '';
                        item.sbd = check.sbd || '';
                        item.projectType = check.projectType || '';
                    }
                } else {
                    const matched = app.matchCentroInRow ? app.matchCentroInRow(row) : null;
                    if (matched) {
                        item.centroCusto = matched.projectId;
                        item.departamento = matched.departamento || '';
                        item.cliente = matched.cliente || '';
                        item.sbd = matched.sbd || '';
                        item.projectType = matched.projectType || '';
                    }
                }

                app.tempData.push(item);
                continue;
            }

            if (row.length < 18) continue;
            const col6Value = String(row[5] || '').trim();
            if (col6Value != "36") continue;

            const mes = row[16];
            const ano = row[17];
            const lockKey = `${mes}-${ano}`;
            if (app.locks.includes(lockKey)) {
                lockedError = true;
                lockedPeriodDetected = lockKey;
                break;
            }

            let rawCliente = row[10];
            let cleanCliente = "";
            if (rawCliente !== undefined && rawCliente !== null) {
                let strCliente = String(rawCliente);
                cleanCliente = strCliente.replace(/[0-9]/g, '');
                cleanCliente = cleanCliente.replace(/^[\s\-\.]+|[\s\-\.]+$/g, '').trim();
            }

            const item = {
                id: Date.now() + Math.random(),
                tipo: app.currentImportType,
                conta: row[0],
                contaOCRA: row[11],
                descricao: row[3],
                valor: app.parseLocaleNumber(String(row[4] || '')) || 0,
                centroCusto: row[7],
                departamento: row[8],
                cliente: cleanCliente,
                sbd: row[12],
                projectType: row[15],
                mes: mes,
                ano: ano
            };

            if (!item.centroCusto || String(item.centroCusto).trim() === '') {
                const matched = app.matchCentroInRow ? app.matchCentroInRow(row) : null;
                if (matched) {
                    item.centroCusto = matched.projectId;
                    item.departamento = item.departamento || matched.departamento || '';
                    item.cliente = item.cliente || matched.cliente || '';
                    item.sbd = item.sbd || matched.sbd || '';
                    item.projectType = item.projectType || matched.projectType || '';
                }
            } else {
                const check = app.findCentroByProjectId(item.centroCusto);
                if (check) {
                    item.departamento = item.departamento || check.departamento || '';
                    item.cliente = item.cliente || check.cliente || '';
                    item.sbd = item.sbd || check.sbd || '';
                    item.projectType = item.projectType || check.projectType || '';
                }
            }

            app.tempData.push(item);
        }

        if (lockedError) {
            app.showToast(`ERRO: Período ${lockedPeriodDetected} travado.`, true);
            app.tempData = [];
            const fi = document.getElementById('fileInput'); if (fi) fi.value = '';
            const ps = document.getElementById('preview-section'); if (ps) ps.classList.add('hidden');
            return;
        }
        if (app.tempData.length === 0) {
            app.showToast("Nenhum dado válido encontrado. O filtro 'Coluna 6 = 36' não foi atendido.", true);
            return;
        }
        if (typeof app.renderPreview === 'function') app.renderPreview();
    };

    // Expor no window para que `js/script.js` possa delegar
    window.AbaImportReceita = mod;

})();
