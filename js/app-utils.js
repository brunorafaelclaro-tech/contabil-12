/* AppUtils: coleção de helpers reutilizáveis para as abas/relatórios */
(function(){
    const AppUtils = {
        setupDynamicFilters(ctx, targets, applyFilterDependencies) {
            const nonTriggerFields = ['year-select', 'year', 'month', 'group-by'];
            targets.forEach(({ prefix, fields, suffix, render }) => {
                const candidates = [
                    ...fields,
                    ...nonTriggerFields.filter(f => document.getElementById(`${prefix}${suffix}${f}`) || document.getElementById(`${prefix}-${f}`))
                ];
                candidates.forEach(field => {
                    const elementId = nonTriggerFields.includes(field)
                        ? `${prefix}-${field.replace('-select', '')}`
                        : `${prefix}${suffix}${field}`;
                    const element = document.getElementById(elementId);
                    if (!element) return;
                    const isFilterField = fields.includes(field);
                    const isReportRenderTrigger = isFilterField || field.includes('year') || field.includes('month');
                    const handler = () => {
                        if (isFilterField && typeof applyFilterDependencies === 'function') applyFilterDependencies.call(ctx, prefix);
                        if (isReportRenderTrigger && typeof render === 'function') render.call(ctx);
                    };
                    element.removeEventListener('change', element._dynamicFilterHandler);
                    element._dynamicFilterHandler = handler;
                    element.addEventListener('change', handler);
                });
                if (typeof applyFilterDependencies === 'function') applyFilterDependencies.call(ctx, prefix);
            });
        },

        applyFilterDependencies(ctx, prefix, data = [], keyRatiosData = [], updateDatalist, forceShowAll = false) {
            const suffixMap = { dre: '-filter-', 'dre-b2': '-', margin: '-filter-', 'dre-acc': '-' };
            const inputSuffix = suffixMap[prefix] || '-filter-';
            const fields = ['cc', 'dept', 'client', 'sbd', 'proj'];
            const filterValues = {};
            fields.forEach(f => {
                const el = document.getElementById(`${prefix}${inputSuffix}${f}`);
                filterValues[f] = el ? String(el.value).trim() : '';
                if (filterValues[f] === 'Todos...') filterValues[f] = '';
            });
            const yearEl = document.getElementById(`${prefix}-year-select`) || document.getElementById(`${prefix}-year`);
            const currentYear = yearEl ? parseInt(yearEl.value, 10) : null;
            if (!currentYear) return;
            let filteredData = [...(data || []), ...(keyRatiosData || [])].filter(d => parseInt(d.ano, 10) === currentYear);
            if (prefix === 'dre') {
                const dreTypeEl = document.getElementById('dre-type-select');
                const dreType = dreTypeEl ? dreTypeEl.value : 'Actual';
                if (dreType === 'Budget') filteredData = filteredData.filter(d => d.tipo === 'Budget');
                else if (dreType === 'Actual') filteredData = filteredData.filter(d => d.tipo !== 'Budget');
            }
            const filterKeys = ['centroCusto', 'departamento', 'cliente', 'sbd', 'projectType'];
            if (!forceShowAll) filterKeys.forEach((key, i) => {
                const v = filterValues[fields[i]];
                if (v) filteredData = filteredData.filter(d => AppUtils.filterMatches(d[key], v));
            });
            if (typeof updateDatalist === 'function') {
                filterKeys.forEach(field => {
                    const uniqueValues = [...new Set(filteredData.map(d => String(d[field] || '').trim()).filter(x => x))].sort();
                    const abbr = field === 'centroCusto' ? 'cc' : field === 'departamento' ? 'dept' : field === 'cliente' ? 'client' : field === 'projectType' ? 'proj' : field;
                    let datalistId = `dl-${abbr}`;
                    if (prefix === 'dre-acc') datalistId += '-acc';
                    else if (prefix === 'margin') datalistId += '-margin';
                    else if (prefix === 'dre-b2') datalistId += '-b2';
                    updateDatalist(datalistId, uniqueValues);
                });
            }
        },

        parseMonthString(raw) {
            if (raw === undefined || raw === null) return null;
            const s = String(raw).toLowerCase().replace(/\./g, '').trim();
            if (!s) return null;
            if (/^jan/.test(s)) return 1;
            if (/^fev/.test(s) || /^feb/.test(s)) return 2;
            if (/^mar/.test(s)) return 3;
            if (/^abr/.test(s)) return 4;
            if (/^mai/.test(s) || /^may/.test(s)) return 5;
            if (/^jun/.test(s)) return 6;
            if (/^jul/.test(s)) return 7;
            if (/^ago/.test(s) || /^aug/.test(s)) return 8;
            if (/^set/.test(s) || /^sep/.test(s)) return 9;
            if (/^out/.test(s) || /^oct/.test(s)) return 10;
            if (/^nov/.test(s)) return 11;
            if (/^dez/.test(s) || /^dec/.test(s)) return 12;
            const asNum = Number(s);
            return (!isNaN(asNum) && asNum >= 1 && asNum <= 12) ? asNum : null;
        },

        parseLocaleNumber(value) {
            if (value === undefined || value === null) return 0;
            if (typeof value === 'number') return value;
            let s = String(value).trim();
            if (!s) return 0;
            s = s.replace(/\s+/g, '');
            if (s.indexOf(',') > -1 && s.indexOf('.') > -1) {
                const lastDot = s.lastIndexOf('.');
                const lastComma = s.lastIndexOf(',');
                if (lastDot > lastComma) s = s.replace(/,/g, '');
                else s = s.replace(/\./g, '').replace(/,/g, '.');
            } else if (s.indexOf(',') > -1) s = s.replace(',', '.');
            else if (s.indexOf('.') > -1) {
                const parts = s.split('.');
                const last = parts[parts.length - 1] || '';
                if (!(last.length > 0 && last.length <= 2)) s = s.replace(/\./g, '');
            }
            s = s.replace(/[^0-9\.-]/g, '');
            const n = parseFloat(s);
            return isNaN(n) ? 0 : n;
        },

        normalizeAccountString(s) {
            return (s === undefined || s === null) ? '' : String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
        },

        normalizeAccountDigits(s) {
            if (s === undefined || s === null) return '';
            const digits = String(s).replace(/\D/g, '');
            return digits.replace(/^0+/, '') || digits;
        },

        normalizePeriod(mes, ano) {
            let m = mes;
            let y = ano;
            // suporte para formato 'MM/YYYY' passado em `mes`
            if ((y === undefined || y === null || y === '') && typeof m === 'string' && m.includes('/')) {
                const parts = m.split('/').map(s => s.trim()).filter(Boolean);
                if (parts.length >= 2) { m = parts[0]; y = parts[1]; }
            }
            // tenta normalizar mês para número (1-12) quando possível
            const parsed = AppUtils.parseMonthString(m);
            if (parsed !== null) m = parsed;
            else {
                m = String(m || '').trim();
                m = m.replace(/^0+/, '');
                const mm = Number(m);
                if (!isNaN(mm) && mm >= 1 && mm <= 12) m = mm;
            }
            y = String(y || '').trim();
            // remove caracteres não numéricos e tenta inferir ano numérico
            const yy = Number(String(y).replace(/[^0-9]/g, ''));
            const yearNum = (!isNaN(yy) && yy > 0) ? yy : y || '';
            return `${String(m)}-${String(yearNum)}`;
        },

        inferMonthYearFromFilename(name) {
            if (!name) return { mes: null, ano: null };
            const m = (name.match(/(\d{1,2})(?:\D|$)/) || [])[1];
            const y = (name.match(/(20\d{2}|19\d{2})/) || [])[1];
            return { mes: m ? Number(m) : null, ano: y ? Number(y) : null };
        },

        filterMatches(value, pattern) {
            if (value === undefined || value === null) return false;
            if (!pattern) return true;
            const s = String(value).toLowerCase();
            const p = String(pattern).toLowerCase();
            return s.indexOf(p) !== -1;
        }
    };

    window.AppUtils = AppUtils;
})();

