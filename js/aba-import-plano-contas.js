// Módulo de importação Plano de Contas
(function(){
    window.AbaImportPlanoContas = {
        processPlanoContasData(app, rows) {
            app.tempData = [];
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row) continue;

                const item = {
                    id: Date.now() + Math.random(),
                    contaReduzida: row[0],
                    contaGrande: row[2],
                    descricao: row[3],
                    contaOCRA: row[6],
                    ocraDesc: row[7],
                    subgrupo: row[8],
                    grupo: row[9],
                    contaBudget: row[10]
                };

                if (!item.contaReduzida && !item.contaGrande && !item.descricao && !item.contaOCRA) continue;
                app.tempData.push(item);
            }

            if ((app.tempData || []).length === 0) {
                app.showToast("Nenhum dado válido encontrado para o Plano de Contas.", true);
                return;
            }
            app.renderPreview();
        },

        confirmPlanoContasImport(app) {
            app.planoContas = app.tempData || [];
            app.saveToStorage();
            app.showToast(`${(app.tempData||[]).length} contas do Plano de Contas salvas.`);
            app.cancelImport();
            try { 
                if (window.AbaImportPlanoContas && typeof window.AbaImportPlanoContas.renderPlanoContas === 'function') {
                    window.AbaImportPlanoContas.renderPlanoContas(app);
                } else if (typeof app.renderPlanoContas === 'function') {
                    app.renderPlanoContas();
                }
            } catch(e) {}
        }
,
        renderPlanoContas(app) {
            try {
                const tbody = document.getElementById('plano-contas-body');
                if (!tbody) return;
                tbody.innerHTML = '';

                if (!app.planoContas || app.planoContas.length === 0) {
                    const section = document.getElementById('plano-contas-list-section');
                    if (section) section.classList.add('hidden');
                    return;
                }

                const section = document.getElementById('plano-contas-list-section');
                if (section) section.classList.remove('hidden');

                const thead = tbody.parentElement ? tbody.parentElement.querySelector('thead') : null;
                if (thead) {
                    thead.innerHTML = `
                       <tr>
                           <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Conta Reduzida</th>
                           <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Conta Grande</th>
                           <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
                           <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Conta OCRA</th>
                           <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">OCRA Desc</th>
                           <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subgrupo</th>
                           <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grupo</th>
                           <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Conta Budget</th>
                       </tr>
                    `;
                }

                (app.planoContas || []).forEach(item => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="px-3 py-2">${item.contaReduzida || ''}</td>
                        <td class="px-3 py-2">${item.contaGrande || ''}</td>
                        <td class="px-3 py-2">${item.descricao || ''}</td>
                        <td class="px-3 py-2">${item.contaOCRA || ''}</td>
                        <td class="px-3 py-2">${item.ocraDesc || ''}</td>
                        <td class="px-3 py-2">${item.subgrupo || ''}</td>
                        <td class="px-3 py-2">${item.grupo || ''}</td>
                        <td class="px-3 py-2">${item.contaBudget || ''}</td>
                    `;
                    tbody.appendChild(tr);
                });
            } catch (e) {
                console.error('Erro em AbaImportPlanoContas.renderPlanoContas', e);
            }
        },

        exportPlanoContas(app) {
            try {
                if (!app.planoContas || app.planoContas.length === 0) {
                    if (typeof app.showToast === 'function') app.showToast('Nenhum Plano de Contas para exportar.', true);
                    return;
                }

                const dataToExport = (app.planoContas || []).map(item => ({
                    'Conta Reduzida': item.contaReduzida || '',
                    'Conta Grande': item.contaGrande || '',
                    'Descrição': item.descricao || '',
                    'Conta OCRA': item.contaOCRA || '',
                    'OCRA Desc': item.ocraDesc || '',
                    'Subgrupo': item.subgrupo || '',
                    'Grupo': item.grupo || '',
                    'Conta Budget': item.contaBudget || ''
                }));

                const ws = XLSX.utils.json_to_sheet(dataToExport);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Plano de Contas');
                XLSX.writeFile(wb, 'Plano_de_Contas.xlsx');
                if (typeof app.showToast === 'function') app.showToast('Plano de Contas exportado.');
            } catch (e) {
                console.error('Erro em AbaImportPlanoContas.exportPlanoContas', e);
                if (typeof app.showToast === 'function') app.showToast('Erro ao exportar Plano de Contas.', true);
            }
        }
    };
})();
