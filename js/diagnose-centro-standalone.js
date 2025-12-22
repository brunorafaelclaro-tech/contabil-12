// diagnoseCentro standalone: expõe função global diagnoseCentro para uso direto no console
window.diagnoseCentro = function(centroId, year, month, periodType = 'mes') {
    const appData = window.app && window.app.data ? window.app : null;
    if (!appData) { alert('app.data não encontrado!'); return; }
    const y = Number(year) || (new Date()).getFullYear();
    const m = Number(month) || (new Date()).getMonth() + 1;
    const period = (periodType === 'ytd' || periodType === 'YTD') ? 'ytd' : 'mes';
    const center = String(centroId || '').trim();
    if (!center) { alert('Informe um centro válido (ProjectID).'); return; }
    const contasCusto = (appData.userCustoAccounts && appData.userCustoAccounts.length) ? appData.userCustoAccounts.slice() : (appData.custoAccounts || []);
    const rowsCustosView = [];
    const rowsDREView = [];
    (appData.data || []).forEach(d => {
        if (!d) return;
        if (String(d.tipo || '').toLowerCase() === 'budget') return;
        if (String(d.centroCusto || '').trim() !== center) return;
        if (String(d.ano) !== String(y)) return;
        const dmes = Number(d.mes) || 0;
        if (period === 'ytd' ? dmes > m : dmes !== m) return;
        const item = {
            id: d.id || '', mes: d.mes || '', ano: d.ano || '', tipo: d.tipo || '', conta: d.conta || '', contaOCRA: d.contaOCRA || '', descricao: d.descricao || '', valor: Number(d.valor) || 0, departamento: d.departamento || ''
        };
        let matchCustos = false;
        for (const acc of contasCusto) {
            if (!acc) continue;
            if (String(item.conta).trim() === String(acc).trim() || String(item.contaOCRA).trim() === String(acc).trim()) { matchCustos = true; break; }
        }
        if (matchCustos) rowsCustosView.push(item);
        const accDigits = String((window.app && window.app.normalizeAccountDigits ? window.app.normalizeAccountDigits(item.conta) : String(item.conta)) || item.conta || '').replace(/\D/g,'');
        const userList = (appData.userCustoAccounts && appData.userCustoAccounts.length) ? appData.userCustoAccounts.slice() : (appData.custoAccounts || []);
        const userSet = new Set(userList.map(x => String(x).replace(/\D/g,'')));
        const viagensSet = new Set((appData.viagensAccounts || []).map(x => String(x).replace(/\D/g,'')));
        if (accDigits && userSet.has(accDigits)) rowsDREView.push(item);
        else if (accDigits && viagensSet.has(accDigits)) rowsDREView.push(item);
    });
    const sumSigned = arr => arr.reduce((s,r)=>s + (Number(r.valor)||0),0);
    const sumAbs = arr => arr.reduce((s,r)=>s + Math.abs(Number(r.valor)||0),0);
    const summary = {
        centro: center,
        year: y,
        month: m,
        period,
        custosView_count: rowsCustosView.length,
        custosView_sum_signed: sumSigned(rowsCustosView),
        custosView_sum_abs: sumAbs(rowsCustosView),
        dreView_count: rowsDREView.length,
        dreView_sum_signed: sumSigned(rowsDREView),
        dreView_sum_abs: sumAbs(rowsDREView)
    };
    console.group(`Diagnóstico Centro ${center} - ${y}/${m} (${period})`);
    console.log('Resumo:', summary);
    console.log('Linhas consideradas pela aba Custos (amostra 50):'); console.table(rowsCustosView.slice(0,50));
    console.log('Linhas consideradas pelo DRE (computeDRETotalsForCentro) (amostra 50):'); console.table(rowsDREView.slice(0,50));
    console.groupEnd();
    alert('Diagnóstico concluído! Veja o console para detalhes.');
    return { summary, rowsCustosView, rowsDREView };
};
