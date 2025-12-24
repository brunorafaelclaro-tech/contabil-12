(function(){
  // Este arquivo adiciona a função de export Paridade ao objeto global `app`.
  // Foi separado de `script.js` para reduzir o tamanho daquele arquivo.
  function safeNumber(v){ return Number(v||0); }

  const makeParityExporter = function(appRef){
    return function generateOcraReportParity(){
      try {
        const app = appRef || (typeof window !== 'undefined' ? window.app : null);
        if (!app) return console.warn('app não encontrado para gerar OCRA Paridade');

        // Prepara contexto usando helper do módulo (se presente)
        const ctx = (window.AbaDreDepartamento && typeof window.AbaDreDepartamento.prepareCtx === 'function') ? window.AbaDreDepartamento.prepareCtx(app) : {
          year: (new Date()).getFullYear(),
          month: (new Date()).getMonth() + 1,
          type: 'ytd',
          data: app.data || [],
          planoContas: app.planoContas || [],
          keyRatiosData: app.keyRatiosData || [],
          mgmtDetailData: app.mgmtDetailData || {},
          mgmtFees: app.mgmtFees || [],
          balanceData: app.balanceData || [],
          exemptCCs: app.exemptCCs || [],
          dreDeptLayout: app.dreDeptLayout || [],
          ocraConfig: app.ocraConfig || []
        };

        // Overwrite year/month from parity view selects
        try {
          const yearEl = document.getElementById('ocra-parity-year');
          const monthEl = document.getElementById('ocra-parity-month');
          if (yearEl) ctx.year = parseInt(yearEl.value) || ctx.year;
          if (monthEl) ctx.month = parseInt(monthEl.value) || ctx.month;
          ctx.type = 'ytd';
        } catch (e) { console.warn('Erro aplicando filtros OCRA Parity', e); }

        if (!(window.AbaDreDepartamento && typeof window.AbaDreDepartamento.computeDREValues === 'function')) {
          if (app && typeof app.showToast === 'function') app.showToast('Módulo AbaDreDepartamento não disponível para export Parity.', true);
          return;
        }

        const { dreMap } = window.AbaDreDepartamento.computeDREValues(ctx);

        // Construir exportList a partir de dreMap
        const ocraConfigList = Array.isArray(app.ocraConfig) ? app.ocraConfig : (app.ocraConfig ? [app.ocraConfig] : []);
        const admCompanyNum = (ocraConfigList.find(c => c.department === 'ADM') || {}).companyNum || '';
        const exportList = [];
        Object.keys(dreMap || {}).sort().forEach(acc => {
          // Excluir conta 3204 da exportação conforme regra do usuário
          if (String(acc).trim() === '3204') return;
          Object.keys(dreMap[acc] || {}).forEach(depto => {
            const companyNum = (ocraConfigList.find(c => c.department === depto) || {}).companyNum || admCompanyNum || '';
            const deptNum = (ocraConfigList.find(c => c.department === depto) || {}).deptNum || '';
            const raw = safeNumber(dreMap[acc][depto]);
            let norm = (typeof window.applyOcraSignRule === 'function') ? window.applyOcraSignRule(acc, raw) : raw;
            // Forçar inversão de 4040 na coluna ADM conforme regra específica
            if (String(acc).trim() === '4040' && String(depto).trim() === 'ADM') {
              norm = -Math.abs(norm);
            }
            if (norm !== 0) exportList.push({ Company: companyNum, Departamento: deptNum, Account: acc, Amount: norm });
          });
        });

        // Preencher preview na nova view
        try {
          const tbody = document.getElementById('ocra-parity-report-body');
          if (tbody) {
            tbody.innerHTML = '';
            exportList.slice(0,200).forEach(r => {
              const tr = document.createElement('tr');
              tr.innerHTML = `<td class=\"px-3 py-2\">${r.Company}</td><td class=\"px-3 py-2\">${r.Departamento}</td><td class=\"px-3 py-2\">${r.Account}</td><td class=\"px-3 py-2 text-right\">${Number(r.Amount).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>`;
              tbody.appendChild(tr);
            });
          }
        } catch (e) { console.warn('Erro preenchendo preview OCRA Parity', e); }

        if (exportList.length === 0) {
          if (app && typeof app.showToast === 'function') app.showToast('Nenhum dado encontrado para os filtros selecionados.', true);
          return;
        }

        // Gerar arquivo (apenas OCRA Export — paridade garantida porque vem de dreMap)
        try {
          const ws = XLSX.utils.json_to_sheet(exportList);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'OCRA Export');
          XLSX.writeFile(wb, `OCRA_Report_Parity_${ctx.year}_${ctx.month}.xlsx`);
          if (app && typeof app.showToast === 'function') app.showToast(`Relatório Paridade gerado com ${exportList.length} linhas.`);
        } catch (e) {
          console.error('Erro ao gerar XLSX Parity', e);
          if (app && typeof app.showToast === 'function') app.showToast('Erro ao gerar arquivo OCRA Paridade.', true);
        }

      } catch (err) {
        console.error('generateOcraReportParity failed', err);
        try { if (appRef && typeof appRef.showToast === 'function') appRef.showToast('Erro ao gerar OCRA Paridade: ' + (err && err.message ? err.message : err), true); } catch(e) {}
      }
    };
  };

  // Attach to global app when ready. If `app` not yet defined, attach on window load.
  if (typeof window !== 'undefined') {
    const attach = () => { try { window.app = window.app || {}; window.app.generateOcraReportParity = makeParityExporter(window.app); } catch(e){ console.error('Erro ao anexar generateOcraReportParity', e);} };
    if (window.app) attach(); else window.addEventListener('load', attach);
  }
})();
