// Módulo: Aba Import - Budget
// Fornece funções para processar importações do tipo 'Budget' e auto-mapeamento heurístico.
(function(){
    const mod = {};

    mod.render = function(containerId, contexto) {
        // Não substitui DOM; apenas fornece funções de processamento.
    };

    mod.handleFileInput = function(app, input) {
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

                return mod.processBudgetData(app, rows);
            } catch (err) {
                console.error('Erro lendo arquivo (AbaImportBudget):', err);
                app.showToast('Erro ao ler arquivo: ' + (err.message || err), true);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    mod.processBudgetData = function(app, rows) {
        app.tempData = [];
        let lockedError = false;
        let lockedPeriodDetected = "";

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row) continue;

            const rawMes = String(row[8] || '').trim();
            const mesParsed = parseMonthString(rawMes);
            let mesNum = mesParsed !== null ? Number(mesParsed) : Number(String(rawMes).replace(/[^0-9]/g, ''));
            const rawAno = String(row[9] || '').trim();
            let anoNum = Number(rawAno.replace(/[^0-9]/g, ''));

            if (!row[0] || isNaN(mesNum) || mesNum < 1 || mesNum > 12 || isNaN(anoNum)) continue;

            const lockKey = `${mesNum}-${anoNum}`;
            if (app.locks.includes(lockKey)) {
                lockedError = true;
                lockedPeriodDetected = lockKey;
                break;
            }

            const budgetAcc = String(row[0] || '').trim();
            const fileDesc = String(row[1] || '').trim();
            const mappedConta = budgetAcc;
            const mappedDesc = fileDesc || '';
            const mappedOcra = '';

            const rawCell = row[2];
            const rawStr = rawCell === undefined || rawCell === null ? '' : String(rawCell).trim();
            const valorNum = app.parseLocaleNumber(rawStr);

            let centroCusto = row[3] !== undefined ? String(row[3]).trim() : '';
            let departamento = row[4] !== undefined ? String(row[4]).trim() : '';
            let cliente = row[5] !== undefined ? String(row[5]).trim() : '';
            let sbd = row[6] !== undefined ? String(row[6]).trim() : '';
            let projectType = row[7] !== undefined ? String(row[7]).trim() : '';

            if (!centroCusto) {
                const matched = app.matchCentroInRow ? app.matchCentroInRow(row) : null;
                if (matched) {
                    centroCusto = matched.projectId;
                    departamento = departamento || matched.departamento || '';
                    cliente = cliente || matched.cliente || '';
                    sbd = sbd || matched.sbd || '';
                    projectType = projectType || matched.projectType || '';
                }
            } else {
                const check = app.findCentroByProjectId(centroCusto);
                if (check) {
                    departamento = departamento || check.departamento || '';
                    cliente = cliente || check.cliente || '';
                    sbd = sbd || check.sbd || '';
                    projectType = projectType || check.projectType || '';
                }
            }

            const item = {
                id: Date.now() + Math.random(),
                tipo: 'Budget',
                conta: mappedConta,
                descricao: mappedDesc || '',
                contaOCRA: mappedOcra || '',
                valor: Number(valorNum),
                _rawValor: rawStr,
                centroCusto: centroCusto,
                departamento: departamento,
                cliente: cliente,
                sbd: sbd,
                projectType: projectType,
                mes: Number(mesNum),
                ano: Number(anoNum),
                _budgetOriginal: budgetAcc
            };
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
            app.showToast("Nenhum dado de Budget válido encontrado.", true);
            return;
        }

        app.lastImportUnmapped = [];
        if (typeof app.renderPreview === 'function') app.renderPreview();
    };

    // Auto-map heurístico (copiado/adaptado de script.js)
    mod.autoMapBudgetUsingHeuristics = function(app, applyToSaved = true) {
        const plano = app.planoContas || [];
        if (!plano.length) {
            app.showToast('Plano de Contas vazio. Importe o Plano de Contas antes de auto-mapear.', true);
            return { mapped: 0, total: 0 };
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
                    let best = null;
                    let bestScore = 0;
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

        const processList = (list) => {
            let mappedCount = 0;
            let total = 0;
            const examples = [];

            list.forEach(item => {
                if (!item || !item._budgetOriginal) return;
                total++;
                const code = String(item._budgetOriginal || '').trim();
                const desc = item.descricao || '';
                const found = tryFindPc(code, desc);
                if (found && found.pc) {
                    const pc = found.pc;
                    const before = { conta: item.conta, descricao: item.descricao, contaOCRA: item.contaOCRA };
                    item.conta = String(pc.contaReduzida || item.conta);
                    item.descricao = item.descricao && item.descricao !== 'Budget' ? item.descricao : (pc.descricao || item.descricao);
                    if (pc.contaOCRA) item.contaOCRA = pc.contaOCRA;
                    item._mappedByAuto = found.reason || 'heuristic';
                    item._mappedScore = found.score || null;
                    mappedCount++;
                    if (examples.length < 20) examples.push({ code, before, after: { conta: item.conta, descricao: item.descricao, contaOCRA: item.contaOCRA, reason: item._mappedByAuto } });
                }
            });

            return { mappedCount, total, examples };
        };

        const tempRes = processList(app.tempData || []);
        let savedRes = { mappedCount: 0, total: 0, examples: [] };
        if (applyToSaved) {
            const savedBudgetItems = (app.data || []).filter(i => i && i.tipo === 'Budget');
            savedRes = processList(savedBudgetItems);
        }

        const summary = {
            tempMapped: tempRes.mappedCount,
            tempTotal: tempRes.total,
            savedMapped: savedRes.mappedCount,
            savedTotal: savedRes.total,
            examples: tempRes.examples.concat(savedRes.examples).slice(0, 20)
        };

        if (applyToSaved) app.saveToStorage();

        const msg = `Auto-mapeamento concluído. Temp: ${summary.tempMapped}/${summary.tempTotal}. Salvos: ${summary.savedMapped}/${summary.savedTotal}. Veja console para exemplos.`;
        app.showToast(msg);
        console.group('AutoMap Summary'); console.log(summary); console.groupEnd();

        return summary;
    };

    window.AbaImportBudget = mod;
})();
