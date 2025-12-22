(function(){
    // Módulo da aba Config (OCRA)
    window.AbaConfig = {
        addOcraConfig(app) {
            try {
                const companyNumEl = document.getElementById('ocra-company-num');
                const deptNumEl = document.getElementById('ocra-dept-num');
                const departmentEl = document.getElementById('ocra-department');
                if (!companyNumEl || !deptNumEl || !departmentEl) return alert('Campos de OCRA não encontrados.');

                const companyNum = companyNumEl.value.trim();
                const deptNum = deptNumEl.value.trim();
                const department = departmentEl.value.trim();
                if (!companyNum || !deptNum || !department) return alert('Preencha todos os campos.');

                if (!Array.isArray(app.ocraConfig)) app.ocraConfig = [];

                app.ocraConfig.push({ id: Date.now(), companyNum, deptNum, department });
                app.saveToStorage && app.saveToStorage();
                if (typeof window.AbaConfig.renderOcraConfigList === 'function') window.AbaConfig.renderOcraConfigList(app);
                app.showToast && app.showToast('Cadastro adicionado!');

                // limpa campos
                companyNumEl.value = '';
                deptNumEl.value = '';
                departmentEl.value = '';
            } catch (e) {
                console.error('AbaConfig.addOcraConfig', e);
            }
        },

        removeOcraConfig(app, id) {
            try {
                if (!Array.isArray(app.ocraConfig)) return;
                app.ocraConfig = app.ocraConfig.filter(item => item.id !== id);
                app.saveToStorage && app.saveToStorage();
                if (typeof window.AbaConfig.renderOcraConfigList === 'function') window.AbaConfig.renderOcraConfigList(app);
                app.showToast && app.showToast('Cadastro removido.');
            } catch (e) {
                console.error('AbaConfig.removeOcraConfig', e);
            }
        },

        renderOcraConfigList(app) {
            try {
                const tbody = document.getElementById('ocra-list-body');
                const emptyMsg = document.getElementById('ocra-empty-msg');
                if (!tbody || !emptyMsg) return;
                tbody.innerHTML = '';

                let list = app.ocraConfig;
                if (!Array.isArray(list)) {
                    if (list && list.companyNum) list = [list]; else list = [];
                }

                if (list.length === 0) {
                    emptyMsg.classList.remove('hidden');
                } else {
                    emptyMsg.classList.add('hidden');
                    list.forEach(item => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td class="px-3 py-2">${item.companyNum || ''}</td>
                            <td class="px-3 py-2">${item.deptNum || ''}</td>
                            <td class="px-3 py-2">${item.department || ''}</td>
                            <td class="px-3 py-2 text-center">
                                <button class="text-red-500 hover:text-red-700" data-id="${item.id}">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </td>
                        `;
                        // attach remove handler
                        const btn = tr.querySelector('button[data-id]');
                        if (btn) btn.addEventListener('click', (ev) => {
                            const id = Number(btn.getAttribute('data-id'));
                            if (confirm('Remover este cadastro?')) window.AbaConfig.removeOcraConfig(app, id);
                        });
                        tbody.appendChild(tr);
                    });
                }
            } catch (e) {
                console.error('AbaConfig.renderOcraConfigList', e);
            }
        },

        loadOcraConfig(app) {
            try {
                if (!app) return;
                if (!app.ocraConfig) app.ocraConfig = [];
                if (typeof window.AbaConfig.renderOcraConfigList === 'function') window.AbaConfig.renderOcraConfigList(app);
                // Garantir que os inputs do cadastro OCRA estejam focáveis/habilitados
                try {
                    const ids = ['ocra-company-num','ocra-dept-num','ocra-department'];
                    ids.forEach(id => {
                        const el = document.getElementById(id);
                        if (!el) return;
                        el.disabled = false;
                        el.readOnly = false;
                        el.tabIndex = 0;
                        el.style.pointerEvents = 'auto';
                        // sobe o z-index do elemento pai se necessário
                        try { if (el.parentElement) el.parentElement.style.zIndex = 'auto'; } catch(e){}
                    });
                } catch(e) { console.warn('AbaConfig: não foi possível forçar habilitação dos inputs OCRA', e); }
            } catch (e) {
                console.error('AbaConfig.loadOcraConfig', e);
            }
        }
    };
})();
