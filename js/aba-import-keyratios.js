// Módulo de importação Key Ratios
(function(){
    window.AbaImportKeyRatios = {
        processKeyRatiosData(app, rows) {
            app.tempData = [];
            let lockedError = false;
            let lockedPeriodDetected = "";
            
            let validRowsCount = 0;
            let dataFound = false;

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                // Esperamos pelo menos 5 colunas (A:Nome, B:Horas, C:CC, D:Mês, E:Ano)
                if (!row || row.length < 5) continue;

                dataFound = true;

                // Mês agora na coluna D (index 3) e Ano na coluna E (index 4)
                const rawMes = String(row[3] || '').trim();
                const mesParsed = parseMonthString(rawMes);
                const mes = mesParsed !== null ? mesParsed : (isNaN(Number(rawMes)) ? rawMes : Number(rawMes));
                const ano = row[4];
                const lockKey = `${mes}-${ano}`;
                
                if ((app.locks || []).includes(lockKey)) {
                    lockedError = true;
                    lockedPeriodDetected = lockKey;
                    break; 
                }
                
                const hours = Number(row[1]) || 0;
                if (hours === 0) continue; 

                validRowsCount++;

                const item = {
                    id: Date.now() + Math.random(),
                    name: String(row[0] || '').trim(),
                    hours: hours,
                    centroCusto: String(row[2] || '').trim(),
                    departamento: String(row[3] || '').trim(),
                    cliente: String(row[4] || '').trim(),
                    sbd: String(row[5] || '').trim(),
                    projectType: String(row[6] || '').trim(),
                    mes: mes,
                    ano: ano
                };

                // Preferir preencher Depto/Cliente/SB/D/ProjectType a partir do cadastro de Centros de Custo (coluna C)
                if (item.centroCusto) {
                    const centro = app.findCentroByProjectId(item.centroCusto);
                    if (centro) {
                        item.departamento = centro.departamento || '';
                        item.cliente = centro.cliente || '';
                        item.sbd = centro.sbd || '';
                        item.projectType = centro.projectType || '';
                    } else {
                        // Centro presente mas não cadastrado: esvaziar campos para destacar na pré-visualização
                        item.departamento = '';
                        item.cliente = '';
                        item.sbd = '';
                        item.projectType = '';
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
            
            if (!dataFound) {
                app.showToast("ERRO Key Ratios: Arquivo tem menos de 9 colunas ou está vazio.", true);
                return;
            }

            if ((app.tempData || []).length === 0) {
                app.showToast("Nenhum dado de Key Ratios válido encontrado (Verifique se a Coluna B tem Horas > 0).", true);
                return;
            }
            app.renderPreview();
        },

        processKeyRatiosBudgetData(app, rows) {
            // Espera 10 colunas: Conta, Descrição, Valor, CC, Depto, Cliente, SBD, ProjectType, Mês, Ano
            app.tempData = [];
            let dataFound = false;
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row) continue;
                // Normalize columns to at least length 10
                const cols = Array.from({length:10}, (_,k) => row[k] !== undefined ? row[k] : '');
                // Basic validation: conta, valor, mes, ano
                const rawConta = String(cols[0] || '').trim();
                const rawDesc = String(cols[1] || '').trim();
                const rawValor = cols[2];
                const centroCusto = String(cols[3] || '').trim();
                const departamento = String(cols[4] || '').trim();
                const cliente = String(cols[5] || '').trim();
                const sbd = String(cols[6] || '').trim();
                const projectType = String(cols[7] || '').trim();
                const rawMes = String(cols[8] || '').trim();
                const rawAno = String(cols[9] || '').trim();

                if (!rawConta || !rawMes || !rawAno) continue;

                const mesParsed = parseMonthString(rawMes);
                const mesNum = mesParsed !== null ? Number(mesParsed) : Number(String(rawMes).replace(/[^0-9]/g, ''));
                const anoNum = Number(String(rawAno).replace(/[^0-9]/g, ''));
                if (isNaN(mesNum) || isNaN(anoNum) || mesNum < 1 || mesNum > 12) continue;

                // valor pode vir como string com pt-br
                const valorNum = app.parseLocaleNumber ? app.parseLocaleNumber(String(rawValor || '').trim()) : (Number(rawValor)||0);

                // Mapear contagens/nomes por conta (7001,7002,7004)
                const accDigits = app.normalizeAccountDigits ? app.normalizeAccountDigits(String(rawConta)) : String(rawConta);
                let mappedName = rawDesc || '';
                if (accDigits === '7001') mappedName = 'Funcionários (Consultores)';
                else if (accDigits === '7002') mappedName = 'Funcionários (ADM)';
                else if (accDigits === '7004') mappedName = 'Horas Trabalhadas (h)';

                const item = {
                    id: Date.now() + Math.random(),
                    tipo: 'KeyRatiosBudget',
                    conta: String(rawConta).trim(),
                    descricao: mappedName,
                    rawDescricao: rawDesc,
                    valor: Number(valorNum),
                    centroCusto,
                    departamento,
                    cliente,
                    sbd,
                    projectType,
                    mes: Number(mesNum),
                    ano: Number(anoNum)
                };

                app.tempData.push(item);
                dataFound = true;
            }

            if (!dataFound) {
                app.showToast('Nenhum dado válido encontrado para Key Ratios Budget.', true);
                return;
            }

            app.renderPreview();
        },

        confirmKeyRatiosBudgetImport(app) {
            // Replace KeyRatiosBudget entries only for the imported periods (mes-ano)
            const periodsToReplaceBudget = new Set((app.tempData || []).map(item => app.normalizePeriod(item.mes, item.ano)));
            let newList = (app.keyRatiosBudgetData || []).filter(item => {
                const period = app.normalizePeriod(item.mes, item.ano);
                return !periodsToReplaceBudget.has(String(period));
            });
            newList = [...newList, ...(app.tempData || [])];
            if (window.DataAPI && typeof DataAPI.setKeyRatiosBudget === 'function') {
                DataAPI.setKeyRatiosBudget(app, newList);
            } else {
                app.keyRatiosBudgetData = newList;
                if (app.saveToStorage) app.saveToStorage();
            }
            app.showToast(`${(app.tempData || []).length} Key Ratios Budget salvos.`);
            app.cancelImport();
            app.switchTab('dre-budget-2');
        }
    };
})();
