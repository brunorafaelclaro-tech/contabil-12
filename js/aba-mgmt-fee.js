// Módulo da aba Management Fee
const AbaMgmtFee = (function(){
	// Helper: formata número para BR
	function fmt(v){
		return Number(v||0).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
	}

	function render(containerId, contexto){
		const app = (contexto && contexto.app) ? contexto.app : (contexto || {});
		const year = (contexto && contexto.year) ? Number(contexto.year) : (document.getElementById('mgmt-year') ? Number(document.getElementById('mgmt-year').value) : (new Date()).getFullYear());
		const mgmtFees = (contexto && contexto.mgmtFees) ? contexto.mgmtFees : (app && app.mgmtFees ? app.mgmtFees : []);
		const mgmtDetailData = (contexto && contexto.mgmtDetailData) ? contexto.mgmtDetailData : (app && app.mgmtDetailData ? app.mgmtDetailData : {});
		const cb = contexto || {};

		const container = document.getElementById(containerId);
		if (!container) return;

		const listBody = document.getElementById('mgmt-list-body');
		const emptyMsg = document.getElementById('mgmt-empty-msg');
		const detailBody = document.getElementById('mgmt-detail-body');
		const detailSection = document.getElementById('mgmt-detail-section') || detailBody || document.getElementById('mgmt-detail');

		function renderMgmtFeesList(){
			if (!listBody) return;
			listBody.innerHTML = '';
			const sorted = [...mgmtFees].sort((a,b)=>{ if (a.ano !== b.ano) return b.ano - a.ano; return b.mes - a.mes; });
			if (emptyMsg) emptyMsg.classList.add('hidden');

			const isTbody = listBody.tagName && listBody.tagName.toUpperCase() === 'TBODY';
			const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
			let grand = 0;

			if (isTbody){
				for (let m = 1; m <= 12; m++){
					const item = sorted.find(it => it.mes === m && it.ano === year);
					const val = (item && Number(item.valor)) || 0;
					grand += val;
					const tr = document.createElement('tr');
					tr.className = 'hover:bg-gray-50';
					tr.innerHTML = `
						<td class="px-3 py-2 text-left">${months[m-1]} ${year}</td>
						<td class="px-3 py-2 text-right font-mono">${fmt(val)}</td>
						<td class="px-3 py-2 text-center">${item ? `<button class="remove-mgmt-btn text-red-500" data-id="${item.id}" title="Remover">Remover</button>` : `<button class="select-mgmt-btn text-blue-600" data-month="${m}" data-year="${year}">Selecionar</button>`}</td>
					`;
					listBody.appendChild(tr);
				}
				const trTotal = document.createElement('tr');
				trTotal.className = 'bg-purple-50 font-bold';
				trTotal.innerHTML = `
					<td class="px-3 py-2">Total</td>
					<td class="px-3 py-2 text-right font-mono">${fmt(grand)}</td>
					<td class="px-3 py-2"></td>
				`;
				listBody.appendChild(trTotal);
			} else {
				// fallback: render cards
				sorted.forEach(item => {
					const card = document.createElement('div');
					card.className = 'flex items-center gap-2 px-3 py-2 border rounded bg-gray-50 text-[14px]';
					card.innerHTML = `
						<span class="font-medium">${item.mes}/${item.ano}</span>
						<span class="font-mono text-right ml-2">${fmt(item.valor)}</span>
						<button class="remove-mgmt-btn text-red-500 ml-3" data-id="${item.id}" title="Remover">✕</button>
					`;
					listBody.appendChild(card);
				});
			}

			// attach handlers
			listBody.querySelectorAll('.remove-mgmt-btn').forEach(btn=>{
				btn.onclick = ()=>{
					const id = Number(btn.dataset.id);
					if (cb.removeMgmtFee) return cb.removeMgmtFee(id);
					if (app && app.removeMgmtFee) return app.removeMgmtFee(id);
				};
			});

			listBody.querySelectorAll('.select-mgmt-btn').forEach(btn=>{
				btn.onclick = ()=>{
					const mm = btn.dataset.month;
					const yy = btn.dataset.year;
					const elMonth = document.getElementById('mgmt-month');
					const elYear = document.getElementById('mgmt-year');
					const elValue = document.getElementById('mgmt-value');
					if (elMonth) elMonth.value = mm;
					if (elYear) elYear.value = yy;
					if (elValue) elValue.focus();
				};
			});
		}

		function populateStaticDetail(){
			const data = mgmtDetailData[year] || { ocra: { debit:'', credit:'', values: Array(13).fill(0)}, calc: { debit:'', credit:'', values: Array(13).fill(0)} };

			// fill account inputs
			document.querySelectorAll('.mgmt-account').forEach(inp => {
				const row = inp.dataset.row;
				const col = inp.dataset.col;
				if (data[row] && data[row][col] !== undefined) inp.value = data[row][col] || '';
			});

			// fill monthly inputs
			document.querySelectorAll('.mgmt-input').forEach(inp => {
				const row = inp.dataset.row;
				const month = parseInt(inp.dataset.month) || 0;
				const val = (data[row] && data[row].values && data[row].values[month]) ? Number(data[row].values[month]) : 0;
				inp.value = fmt(val);
			});

			// totals
			let totalOcra = 0, totalCalc = 0;
			for (let m = 1; m <= 12; m++){
				const ocraVal = Number((data.ocra.values[m])||0);
				const calcVal = Number((data.calc.values[m])||0);
				totalOcra += ocraVal; totalCalc += calcVal;
				const colEl = document.getElementById(`total-col-${m}`);
				if (colEl) colEl.innerText = fmt(ocraVal + calcVal);
			}
			const tOcra = document.getElementById('total-row-ocra'); if (tOcra) tOcra.innerText = fmt(totalOcra);
			const tCalc = document.getElementById('total-row-calc'); if (tCalc) tCalc.innerText = fmt(totalCalc);
			const grandEl = document.getElementById('grand-total-mgmt'); if (grandEl) grandEl.innerText = fmt(totalOcra + totalCalc);
		}

		function buildFallbackDetail(){
			const data = mgmtDetailData[year] || { ocra: { debit:'', credit:'', values: Array(13).fill(0)}, calc: { debit:'', credit:'', values: Array(13).fill(0)} };
			if (!detailSection) return;
			let html = '<table class="min-w-full divide-y divide-gray-200 text-sm"><thead><tr>' +
				'<th>Débito</th><th>Crédito</th><th>Descrição</th>';
			for (let m=1;m<=12;m++) html += `<th class="text-right">${m}</th>`;
			html += '<th class="text-right">TOTAL</th></tr></thead><tbody>';

			['ocra','calc'].forEach(row => {
				html += '<tr>';
				html += `<td><input class="mgmt-account" data-row="${row}" data-col="debit" value="${data[row].debit||''}"></td>`;
				html += `<td><input class="mgmt-account" data-row="${row}" data-col="credit" value="${data[row].credit||''}"></td>`;
				html += `<td>${row === 'ocra' ? 'Management fee Ocra' : 'Management Fee Calculo'}</td>`;
				let rowTotal = 0;
				for (let m=1;m<=12;m++){
					const v = Number(data[row].values[m])||0; rowTotal += v;
					html += `<td><input class="mgmt-input" data-row="${row}" data-month="${m}" value="${fmt(v)}"></td>`;
				}
				html += `<td class="font-mono">${fmt(rowTotal)}</td>`;
				html += '</tr>';
			});

			// totals row
			html += '<tr class="font-bold"><td colspan="3">Total Management fee</td>';
			let grand = 0;
			for (let m=1;m<=12;m++){
				const colTotal = (Number(data.ocra.values[m])||0) + (Number(data.calc.values[m])||0);
				grand += colTotal;
				html += `<td class="text-right">${fmt(colTotal)}</td>`;
			}
			html += `<td class="text-right">${fmt(grand)}</td></tr>`;

			html += '</tbody></table>';
			detailSection.innerHTML = html;

			// attach handlers to call app callbacks directly (or context callbacks)
			detailSection.querySelectorAll('.mgmt-input').forEach(inp=>{ inp.oninput = ()=>{ if (cb.calcMgmtDetail) return cb.calcMgmtDetail(inp); if (app && app.calcMgmtDetail) return app.calcMgmtDetail(inp); }; });
			detailSection.querySelectorAll('.mgmt-account').forEach(inp=>{ inp.onchange = ()=>{ if (cb.saveMgmtDetail) return cb.saveMgmtDetail(true); if (app && app.saveMgmtDetail) return app.saveMgmtDetail(true); }; });
		}

		// Render
		renderMgmtFeesList();
		if (detailBody && detailBody.querySelectorAll('.mgmt-input').length > 0){
			populateStaticDetail();
		} else {
			buildFallbackDetail();
		}
	}

	return { render };
})();
window.AbaMgmtFee = AbaMgmtFee;

// Funções de mutação e cálculo movidas de `script.js` para reduzir o tamanho do arquivo principal.
(function(){
	// Adiciona ou atualiza um Management Fee usando o objeto `app` para estado/persistência
	function addMgmtFee(app){
		try {
			const impl = AbaMgmtFee.addMgmtFeeImpl;
			if (impl) return impl(app);
		} catch(e) { console.error('AbaMgmtFee.addMgmtFee failed', e); }

		const mesEl = document.getElementById('mgmt-month');
		const anoEl = document.getElementById('mgmt-year');
		const rawEl = document.getElementById('mgmt-value');
		if (!mesEl || !anoEl || !rawEl) return;
		const mes = mesEl.value;
		const ano = anoEl.value;
		const rawVal = rawEl.value;
		let valStr = rawVal.replace(/\./g, '').replace(',', '.');
		const valor = parseFloat(valStr);

		if (!ano || isNaN(valor) || valor <= 0) return alert("Preencha ano e valor válido.");

		if (app.locks && app.locks.includes(`${mes}-${ano}`)) {
			return alert(`Período ${mes}/${ano} está travado.`);
		}

		const existing = (app.mgmtFees||[]).find(x => x.mes === parseInt(mes) && x.ano === parseInt(ano));
		if (existing) {
			existing.valor = valor;
			if (app.saveToStorage) app.saveToStorage();
			if (app.renderMgmtFeesList) app.renderMgmtFeesList();
			if (app.showToast) app.showToast(`Management Fee ${mes}/${ano} atualizado.`);
		} else {
			(app.mgmtFees = app.mgmtFees || []).push({
				id: Date.now(),
				mes: parseInt(mes),
				ano: parseInt(ano),
				conta: 9999,
				valor: valor
			});
			if (app.saveToStorage) app.saveToStorage();
			if (app.renderMgmtFeesList) app.renderMgmtFeesList();
			if (app.showToast) app.showToast("Management Fee adicionado.");
		}
		if (rawEl) rawEl.value = '';
	}

	function removeMgmtFee(app, id){
		try {
			const impl = AbaMgmtFee.removeMgmtFeeImpl;
			if (impl) return impl(app, id);
		} catch(e) { console.error('AbaMgmtFee.removeMgmtFee failed', e); }

		const item = (app.mgmtFees||[]).find(x => x.id === id);
		if(item && app.locks && app.locks.includes(`${item.mes}-${item.ano}`)) {
			return alert(`Período ${item.mes}/${item.ano} travado.`);
		}
		app.mgmtFees = (app.mgmtFees||[]).filter(x => x.id !== id);
		if (app.saveToStorage) app.saveToStorage();
		if (app.renderMgmtFeesList) app.renderMgmtFeesList();
	}

	function calcMgmtDetail(app, input){
		try {
			const impl = AbaMgmtFee.calcMgmtDetailImpl;
			if (impl) return impl(app, input);
		} catch(e) { console.error('AbaMgmtFee.calcMgmtDetail failed', e); }

		if (input) {
			// maskCurrency equivalent: format numeric fields as typed
			let value = (input.value || '').toString().replace(/\D/g, '');
			value = (Number(value) / 100).toFixed(2) + '';
			value = value.replace('.', ',');
			value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
			input.value = value === 'NaN' ? '' : value;
		}

		// Use integer cents to avoid floating-point accumulation errors.
		let grandTotalCents = 0;
		let totalOcraCents = 0;
		let totalCalcCents = 0;
		let monthTotalsCents = new Array(13).fill(0);

		const inputs = document.querySelectorAll('.mgmt-input');
		inputs.forEach(inp => {
			const row = inp.dataset.row;
			const month = parseInt(inp.dataset.month);
			let valStr = (inp.value||'').toString().replace(/\./g, '').replace(',', '.');
			let val = parseFloat(valStr) || 0;
			// round to cents
			const cents = Math.round(val * 100);
			if (row === 'ocra') totalOcraCents += cents;
			if (row === 'calc') totalCalcCents += cents;
			monthTotalsCents[month] += cents;
		});

		const elTotalOcra = document.getElementById('total-row-ocra'); if (elTotalOcra) elTotalOcra.innerText = (totalOcraCents/100).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
		const elTotalCalc = document.getElementById('total-row-calc'); if (elTotalCalc) elTotalCalc.innerText = (totalCalcCents/100).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});

		for (let m = 1; m <= 12; m++){
			const totalMonthCents = monthTotalsCents[m];
			const el = document.getElementById(`total-col-${m}`);
			if (el) el.innerText = (totalMonthCents/100).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
			grandTotalCents += totalMonthCents;
		}

		const grandTotalEl = document.getElementById('grand-total-mgmt'); if (grandTotalEl) grandTotalEl.innerText = (grandTotalCents/100).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});

		try {
			if (app._mgmtSaveTimer) clearTimeout(app._mgmtSaveTimer);
			app._mgmtSaveTimer = setTimeout(() => {
				if (app.saveMgmtDetail) app.saveMgmtDetail(false);
				app._mgmtSaveTimer = null;
			}, 500);
		} catch (e) {
			if (app.saveMgmtDetail) app.saveMgmtDetail(false);
		}
	}

	function saveMgmtDetail(app, showToast = false){
		try {
			const impl = AbaMgmtFee.saveMgmtDetailImpl;
			if (impl) return impl(app, showToast);
		} catch(e) { console.error('AbaMgmtFee.saveMgmtDetail failed', e); }

		const yearEl = document.getElementById('mgmt-detail-year');
		const year = yearEl ? yearEl.value : null;
		if (!year) return;
		const data = {
			ocra: { debit: '', credit: '', values: new Array(13).fill(0) },
			calc: { debit: '', credit: '', values: new Array(13).fill(0) }
		};

		const accInputs = document.querySelectorAll('.mgmt-account');
		accInputs.forEach(inp => {
			const row = inp.dataset.row;
			const col = inp.dataset.col;
			if (data[row]) data[row][col] = inp.value;
		});

		const valueInputs = document.querySelectorAll('.mgmt-input');
		valueInputs.forEach(inp => {
			const row = inp.dataset.row;
			const month = parseInt(inp.dataset.month) || 0;
			let valStr = (inp.value || '').toString().replace(/\./g, '').replace(',', '.');
			let val = parseFloat(valStr) || 0;
			// store rounded to cents to avoid float drift
			val = Math.round(val * 100) / 100;
			if (data[row]) data[row].values[month] = val;
		});

		app.mgmtDetailData = app.mgmtDetailData || {};
		app.mgmtDetailData[year] = data;
		try { if (app.saveToStorage) app.saveToStorage(); } catch (e) { console.error('Erro ao salvar mgmtDetailData', e); }
		if (showToast && app.showToast) app.showToast('Detalhamento Management Fee salvo.');
	}

	function renderMgmtFeesList(app){
		// delegate to existing render function: render uses contexto.app
		try { return AbaMgmtFee.render('view-mgmt-fee', { app: app }); } catch(e) { console.error('AbaMgmtFee.render failed', e); }
	}

	// Attach to global module object
	AbaMgmtFee.addMgmtFee = addMgmtFee;
	AbaMgmtFee.removeMgmtFee = removeMgmtFee;
	AbaMgmtFee.calcMgmtDetail = calcMgmtDetail;
	AbaMgmtFee.saveMgmtDetail = saveMgmtDetail;
	AbaMgmtFee.renderMgmtFeesList = renderMgmtFeesList;
})();


