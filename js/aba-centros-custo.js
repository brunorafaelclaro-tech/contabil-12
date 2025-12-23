
// Módulo da aba Centros de Custo
const AbaCentrosCusto = {
  render: function(containerId, contexto) {
    // contexto: { centrosCusto, addCentroCusto, removeCentroCusto, keyRatiosData }
    const centrosCusto = contexto.centrosCusto || [];
    const addCentroCusto = contexto.addCentroCusto;
    const removeCentroCusto = contexto.removeCentroCusto;

    const container = document.getElementById(containerId);
    container.innerHTML = `
      <div class="mb-4">
        <h2 class="text-xl font-bold mb-2">Centros de Custo</h2>
        <div class="mb-2 flex flex-wrap gap-2">
          <input id="cc-projectid" placeholder="Project ID" class="border px-2 py-1" size="8">
          <input id="cc-desc" placeholder="Descrição" class="border px-2 py-1" size="16">
          <input id="cc-cliente" placeholder="Cliente" class="border px-2 py-1" size="10">
          <input id="cc-depto" placeholder="Departamento" class="border px-2 py-1" size="10">
          <input id="cc-sbd" placeholder="SB/D" class="border px-2 py-1" size="6">
          <input id="cc-projtype" placeholder="Tipo Projeto" class="border px-2 py-1" size="10">
          <button id="add-cc-btn" class="bg-blue-500 text-white px-3 py-1 rounded">Adicionar</button>
        </div>
        <table class="min-w-full border mb-4">
          <thead><tr><th>Project ID</th><th>Descrição</th><th>Cliente</th><th>Departamento</th><th>SB/D</th><th>Tipo Projeto</th><th>Ações</th></tr></thead>
          <tbody id="centros-custo-body"></tbody>
        </table>
      </div>
    `;

    // Renderiza lista
    function renderCentrosCustoList() {
      const tbody = document.getElementById('centros-custo-body');
      tbody.innerHTML = '';
      // Exemplo de uso de keyRatiosData padronizado (caso necessário):
      // const keyRatiosData = (window.DataAPI && typeof DataAPI.getKeyRatiosData === 'function') ? DataAPI.getKeyRatiosData(contexto) : (contexto.keyRatiosData || []);
      if (centrosCusto.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="px-3 py-2 text-gray-500" colspan="7">Nenhum centro cadastrado.</td>`;
        tbody.appendChild(tr);
        return;
      }
      centrosCusto.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="px-3 py-2">${item.projectId}</td>
          <td class="px-3 py-2">${item.descricao || ''}</td>
          <td class="px-3 py-2">${item.cliente || ''}</td>
          <td class="px-3 py-2">${item.departamento || ''}</td>
          <td class="px-3 py-2">${item.sbd || ''}</td>
          <td class="px-3 py-2">${item.projectType || ''}</td>
          <td class="px-3 py-2 text-center"><button class="text-red-500 hover:text-red-700" data-id="${item.id}"><i class="fa-solid fa-trash"></i></button></td>
        `;
        tbody.appendChild(tr);
      });
      // Ações de remoção
      tbody.querySelectorAll('button[data-id]').forEach(btn => {
        btn.onclick = () => {
          if (removeCentroCusto) removeCentroCusto(Number(btn.dataset.id));
        };
      });
    }

    // Botão adicionar
    document.getElementById('add-cc-btn').onclick = () => {
      if (addCentroCusto) {
        const get = id => document.getElementById(id).value;
        addCentroCusto({
          projectId: get('cc-projectid'),
          descricao: get('cc-desc'),
          cliente: get('cc-cliente'),
          departamento: get('cc-depto'),
          sbd: get('cc-sbd'),
          projectType: get('cc-projtype')
        });
        // Limpa inputs
        ['cc-projectid','cc-desc','cc-cliente','cc-depto','cc-sbd','cc-projtype'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
      }
    };

    renderCentrosCustoList();
  }
};
// Render based on app state (re-usable)
AbaCentrosCusto.renderList = function(app) {
  const tbody = document.getElementById('centros-custo-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  const list = (window.DataAPI && typeof DataAPI.getCentrosCusto === 'function') ? DataAPI.getCentrosCusto(app) : ((app && app.centrosCusto) ? app.centrosCusto : []);
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
      <td class="px-3 py-2 text-center"><button class="text-red-500 hover:text-red-700" data-id="${item.id}"><i class="fa-solid fa-trash"></i></button></td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('button[data-id]').forEach(btn => {
    btn.onclick = () => {
      const id = Number(btn.dataset.id);
      if (app && typeof app.removeCentroCusto === 'function') {
        app.removeCentroCusto(id);
      } else if (AbaCentrosCusto.removeCentroCusto) {
        AbaCentrosCusto.removeCentroCusto(app, id);
      }
    };
  });
};

// Adds a centro to app.centrosCusto (does not persist automatically)
AbaCentrosCusto.addCentroCusto = function(app, item) {
  if (!app) return;
  const _item = Object.assign({ id: Date.now() + Math.random(), projectId: '' }, item || {});
  if (!String(_item.projectId || '').trim()) return;
  const list = (window.DataAPI && typeof DataAPI.getCentrosCusto === 'function') ? DataAPI.getCentrosCusto(app).slice() : (app.centrosCusto || []).slice();
  list.push(_item);
  if (window.DataAPI && typeof DataAPI.setCentrosCusto === 'function') {
    DataAPI.setCentrosCusto(app, list);
  } else {
    app.centrosCusto = list;
    if (app.saveToStorage) app.saveToStorage();
  }
  AbaCentrosCusto._applyMappingToData(app);
  AbaCentrosCusto.renderList(app);
};

AbaCentrosCusto.removeCentroCusto = function(app, id) {
  if (!app) return;
  const list = (window.DataAPI && typeof DataAPI.getCentrosCusto === 'function') ? DataAPI.getCentrosCusto(app).slice() : (app.centrosCusto || []).slice();
  const filtered = list.filter(c => c.id !== id);
  if (window.DataAPI && typeof DataAPI.setCentrosCusto === 'function') {
    DataAPI.setCentrosCusto(app, filtered);
  } else {
    app.centrosCusto = filtered;
    if (app.saveToStorage) app.saveToStorage();
  }
  AbaCentrosCusto._applyMappingToData(app);
  AbaCentrosCusto.renderList(app);
};

// Persist imported list and render
AbaCentrosCusto.importCentrosCusto = function(app, rows) {
  if (!app) return;
  if (!rows || rows.length <= 1) {
    if (app.showToast) app.showToast('Arquivo de Centros vazio ou sem linhas.', true);
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
    if (app.showToast) app.showToast('Nenhum Centro de Custo válido encontrado no arquivo.', true);
    return;
  }
  if (window.DataAPI && typeof DataAPI.importCentrosCusto === 'function') {
    DataAPI.importCentrosCusto(app, rows);
  } else {
    app.centrosCusto = list;
    if (app.saveToStorage) app.saveToStorage();
  }
  // After import, propagate mappings to existing data/keyRatios
  AbaCentrosCusto._applyMappingToData(app);
  AbaCentrosCusto.renderList(app);
  let msg = `Importados ${list.length} Centros de Custo`;
  if (skipped) msg += `, pulados/invalidos: ${skipped}`;
  if (app.showToast) app.showToast(msg + '.');
};

// Handle a file input element (FileReader + XLSX)
AbaCentrosCusto.handleFileInput = function(app, input) {
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
      AbaCentrosCusto.importCentrosCusto(app, rows);
    } catch (err) {
      console.error('Erro lendo arquivo de Centros:', err);
      if (app.showToast) app.showToast('Erro ao ler arquivo de Centros.', true);
    }
  };
  reader.onloadend = () => { try { if (input && input.tagName === 'INPUT') input.value = ''; } catch(e) {} };
  reader.readAsArrayBuffer(file);
};

AbaCentrosCusto.saveCentrosCusto = function(app) {
  if (!app) return;
  if (window.DataAPI && typeof DataAPI.setCentrosCusto === 'function') {
    DataAPI.setCentrosCusto(app, app.centrosCusto || []);
  } else if (app.saveToStorage) {
    app.saveToStorage();
  }
  if (app.showToast) app.showToast('Centros de Custo salvos.');
};

AbaCentrosCusto.clearCentrosCusto = function(app) {
  if (!app) return;
  if (!confirm('Limpar todos os Centros de Custo?')) return;
  if (window.DataAPI && typeof DataAPI.setCentrosCusto === 'function') {
    DataAPI.setCentrosCusto(app, []);
  } else {
    app.centrosCusto = [];
    if (app.saveToStorage) app.saveToStorage();
  }
  // Removing mappings: clear related fields? We'll only re-apply (which will leave existing cliente/departamento intact), then refresh filters.
  AbaCentrosCusto._applyMappingToData(app);
  AbaCentrosCusto.renderList(app);
  if (app.showToast) app.showToast('Centros de Custo limpos.');
};

AbaCentrosCusto.exportCentrosCusto = function(app) {
  if (!app) return;
  if (!app.centrosCusto || app.centrosCusto.length === 0) {
    if (app.showToast) app.showToast('Nenhum Centro de Custo para exportar.', true);
    return;
  }
  const dataToExport = app.centrosCusto.map(item => ({
    'Project ID': item.projectId || '',
    'Descrição': item.descricao || '',
    'Cliente': item.cliente || '',
    'Departamento': item.departamento || '',
    'SB/D': item.sbd || '',
    'Project Type': item.projectType || ''
  }));
  try {
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Centros de Custo');
    XLSX.writeFile(wb, 'Centros_de_Custo.xlsx');
    if (app.showToast) app.showToast('Centros de Custo exportados.');
  } catch (e) {
    console.error('Erro exportando Centros de Custo', e);
    if (app.showToast) app.showToast('Erro ao exportar Centros de Custo.', true);
  }
};

// Find helpers
AbaCentrosCusto.findCentroByProjectId = function(app, pid) {
  if (!pid) return null;
  const list = (app && app.centrosCusto) ? app.centrosCusto : [];
  const str = String(pid).trim();
  return list.find(c => String(c.projectId).trim() === str) || null;
};

AbaCentrosCusto.matchCentroInRow = function(app, row) {
  if (!row || !Array.isArray(row)) return null;
  const list = (app && app.centrosCusto) ? app.centrosCusto : [];
  if (!list.length) return null;
  for (let i = 0; i < row.length; i++) {
    const val = String(row[i] || '').trim();
    if (!val) continue;
    const found = list.find(c => String(c.projectId).trim() === val);
    if (found) return found;
  }
  return null;
};

// Apply current centrosCusto mapping to existing app.data and app.keyRatiosData
AbaCentrosCusto._applyMappingToData = function(app) {
  if (!app) return;
  const map = {};
  (app.centrosCusto || []).forEach(c => { map[String(c.projectId).trim()] = c; });

  const updateItem = (d) => {
    if (!d || !d.centroCusto) return;
    const key = String(d.centroCusto).trim();
    const m = map[key];
    if (m) {
      d.departamento = (m.departamento !== undefined && m.departamento !== null) ? m.departamento : (d.departamento || '');
      d.cliente = (m.cliente !== undefined && m.cliente !== null) ? m.cliente : (d.cliente || '');
      d.sbd = (m.sbd !== undefined && m.sbd !== null) ? m.sbd : (d.sbd || '');
      d.projectType = (m.projectType !== undefined && m.projectType !== null) ? m.projectType : (d.projectType || '');
    }
  };

  if (Array.isArray(app.data)) app.data.forEach(updateItem);
  if (Array.isArray(app.keyRatiosData)) app.keyRatiosData.forEach(updateItem);

  if (app.saveToStorage) app.saveToStorage();
  if (app.populateFilters) app.populateFilters();

  // Rebuild dynamic filters (datalists) so UI reflects updated cliente/departamento values
  if (typeof app.setupDynamicFilters === 'function') {
    try { app.setupDynamicFilters(); } catch (e) { console.error('Erro ao setupDynamicFilters after mapping', e); }
  } else {
    // fallback: try to apply dependencies for main prefixes
    try {
      if (typeof app.applyFilterDependencies === 'function') {
        ['dre','dre-acc','dre-b2','margin'].forEach(p => { try { app.applyFilterDependencies(p); } catch(e){} });
      }
    } catch(e) {}
  }

  // Re-render dependent views if available
  const viewsToRefresh = ['renderDRE','renderDREAcumulado','renderDREBudget2','renderMarginAnalysis','renderDRESuecia'];
  viewsToRefresh.forEach(fn => { if (typeof app[fn] === 'function') app[fn](); });
};

window.AbaCentrosCusto = AbaCentrosCusto;
