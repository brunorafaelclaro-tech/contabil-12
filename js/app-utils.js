// Helpers reutilizáveis extraídos de `script.js`
(function(){
    const AppUtils = {
                // Configura listeners dinâmicos para filtros das abas DRE/Margin
                setupDynamicFilters(ctx, targets, applyFilterDependencies) {
                    const nonTriggerFields = ['year-select', 'year', 'month', 'group-by'];
                    targets.forEach(({ prefix, fields, suffix, render }) => {
                        [...fields, ...nonTriggerFields.filter(f => document.getElementById(`${prefix}${suffix}${f}` || `${prefix}-${f}` ))]
                        .forEach(field => {
                            let elementId;
                            if (nonTriggerFields.includes(field)) {
                                elementId = `${prefix}-${field.replace('-select', '')}`;
                            } else {
                                elementId = `${prefix}${suffix}${field}`;
                            }
                            const element = document.getElementById(elementId);
                            if (element) {
                                const isFilterField = fields.includes(field);
                                const isReportRenderTrigger = isFilterField || field.includes('year') || field.includes('month');
                                const handler = () => {
                                    if(isFilterField) {
                                        applyFilterDependencies.call(ctx, prefix);
                                    }
                                    if (isReportRenderTrigger) {
                                        render.call(ctx);
                                    }
                                };
                                element.removeEventListener('change', element._dynamicFilterHandler);
                                element._dynamicFilterHandler = handler;
                                element.addEventListener('change', handler);
                            }
                        });
                        applyFilterDependencies.call(ctx, prefix);
                    });
                },

                // Aplica dependências entre filtros e atualiza datalists
                applyFilterDependencies(ctx, prefix, data, keyRatiosData, updateDatalist, forceShowAll = false) {
                    const suffixMap = {
                        'dre': '-filter-',
                        'dre-b2': '-',
                        'margin': '-filter-',
                        'dre-acc': '-',
                    };
                    const inputSuffix = suffixMap[prefix];
                    const fields = ['cc', 'dept', 'client', 'sbd', 'proj'];
                    const filterValues = {};
                    fields.forEach(f => {
                        const id = `${prefix}${inputSuffix}${f}`;
                        const element = document.getElementById(id);
                        filterValues[f] = element ? String(element.value).trim() : '';
                        if (filterValues[f] === 'Todos...') filterValues[f] = '';
                    });
                    const yearElement = document.getElementById(`${prefix}-year-select`) || document.getElementById(`${prefix}-year`);
                    const currentYear = yearElement ? parseInt(yearElement.value) : null;
                    if (!currentYear) return;
                    let filteredData = [];
                    if (prefix === 'dre') {
                        const dreTypeEl = document.getElementById('dre-type-select');
                        const dreType = (dreTypeEl && dreTypeEl.value) ? dreTypeEl.value : 'Actual';
                        if (dreType === 'Budget') filteredData = data.filter(d => d.tipo === 'Budget');
                        else if (dreType === 'Actual') filteredData = data.filter(d => d.tipo !== 'Budget');
                        else filteredData = [...data];
                        filteredData = [...filteredData, ...keyRatiosData];
                    } else {
                        filteredData = [...data, ...keyRatiosData];
                    }
                    filteredData = filteredData.filter(d => parseInt(d.ano) === currentYear);
                    let currentFilterState = {};
                    const filterKeys = ['centroCusto', 'departamento', 'cliente', 'sbd', 'projectType'];
                    if (!forceShowAll) {
                        filterKeys.forEach((key, i) => {
                            const f = fields[i];
                            currentFilterState[key] = filterValues[f];
                            if (currentFilterState[key]) {
                                filteredData = filteredData.filter(d => AppUtils.filterMatches(d[key], currentFilterState[key]));
                            }
                        });
                    }
                    // Atualiza datalists
                    if (typeof updateDatalist === 'function') {
                        updateDatalist(filteredData, filterValues, currentYear);
                    }
                },
        /**
         * Converte abreviações de mês (pt) em número (Jan->1, Fev->2, ...)
         */
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
            if (!isNaN(asNum) && asNum >= 1 && asNum <= 12) return asNum;
            return null;
        },

        /**
         * Normaliza string de conta (remove não dígitos/letras, caixa alta)
         */
        normalizeAccountString(s) {
            if (s === undefined || s === null) return '';
            return String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
        },

        /**

        const AppUtils = {
            // Conversão de mês abreviado para número
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
                if (!isNaN(asNum) && asNum >= 1 && asNum <= 12) return asNum;
                return null;
            },
            // Normalização de string de conta
            normalizeAccountString(s) {
                if (s === undefined || s === null) return '';
                return String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
            },
            // Extrai apenas os dígitos de uma string de conta
            normalizeAccountDigits(s) {
                if (s === undefined || s === null) return '';
                const digits = String(s).replace(/\D/g, '');
                return digits.replace(/^0+/, '') || digits;
            },
            // Converte número local (pt-BR) para float
            parseLocaleNumber(value) {
                if (value === undefined || value === null) return 0;
                if (typeof value === 'number') return value;
                let s = String(value).trim();
                if (!s) return 0;
                s = s.replace(/\s+/g, '');
                if (s.indexOf(',') > -1 && s.indexOf('.') > -1) {
                    const lastDot = s.lastIndexOf('.')
                    const lastComma = s.lastIndexOf(',')
                    if (lastDot > lastComma) {
                        s = s.replace(/,/g, '');
                    } else {
                        s = s.replace(/\./g, '').replace(',', '.');
                    }
                } else if (s.indexOf(',') > -1) {
                    s = s.replace(/\./g, '').replace(',', '.');
                } else {
                    s = s.replace(/\./g, '');
                }
                const n = Number(s);
                return isNaN(n) ? 0 : n;
            },
            // Verifica se o valor do filtro corresponde ao item
            filterMatches(itemValue, filterString) {
                if (!filterString || filterString.toLowerCase() === 'todos...' || filterString.trim() === '') {
                    return true;
                }
                const filterValues = filterString.split(',')
                                                .map(v => String(v).trim())
                                                .filter(v => v !== '');
                if (filterValues.length === 0) return true;
                const itemStr = String(itemValue || '').trim();
                return filterValues.some(filterV => itemStr === filterV);
            },
            // ...demais métodos utilitários, todos separados por vírgula, exceto o último...
            // (copiar todos os métodos utilitários do objeto original aqui, mantendo a vírgula entre eles)
            // ...
            // O último método:
            inferMonthYearFromFilename(fileName) {
                if (!fileName || typeof fileName !== 'string') return null;
                const s = fileName.replace(/[_\-\.]/g, ' ').toLowerCase();
                const months = {
                    jan:1, janeiro:1, feb:2, fev:2, february:2, mar:3, marco:3, março:3, apr:4, abril:4,
                    may:5, maio:5, jun:6, junho:6, jul:7, julho:7, aug:8, agosto:8, sep:9, set:9, setembro:9,
                    oct:10, out:10, outubro:10, nov:11, novembro:11, dec:12, dez:12, dezembro:12
                };
                const yearMatch = s.match(/(20\d{2}|19\d{2})/);
                const year = yearMatch ? parseInt(yearMatch[0]) : null;
                for (const key in months) {
                    if (s.indexOf(key) >= 0) {
                        return { month: months[key], year: year, label: (months[key] + (year ? '/' + year : '')) };
                    }
                }
                const mmYYYY = s.match(/(0?[1-9]|1[0-2])[\s_\-\./]*(20\d{2})/);
                if (mmYYYY) {
                    return { month: parseInt(mmYYYY[1]), year: parseInt(mmYYYY[2]), label: (parseInt(mmYYYY[1]) + '/' + mmYYYY[2]) };
                }
                const yyyymm = s.match(/(20\d{2})[\s_\-\.]*0?(1[0-2]|[1-9])\b/);
                if (yyyymm) {
                    return { month: parseInt(yyyymm[2]), year: parseInt(yyyymm[1]), label: (parseInt(yyyymm[2]) + '/' + yyyymm[1]) };
                }
                return null;
            }
        };
        // Expor globalmente para compatibilidade com código existente
        window.AppUtils = AppUtils;
        window.parseMonthString = AppUtils.parseMonthString.bind(AppUtils);
        window.parseLocaleNumber = AppUtils.parseLocaleNumber.bind(AppUtils);
        window.normalizeAccountString = AppUtils.normalizeAccountString.bind(AppUtils);
        window.normalizeAccountDigits = AppUtils.normalizeAccountDigits.bind(AppUtils);
        window.normalizePeriod = AppUtils.normalizePeriod.bind(AppUtils);
        window.inferMonthYearFromFilename = AppUtils.inferMonthYearFromFilename.bind(AppUtils);
        window.setupDynamicFilters = AppUtils.setupDynamicFilters.bind(AppUtils);
        window.applyFilterDependencies = AppUtils.applyFilterDependencies.bind(AppUtils);
    })();
                        };
                        element.removeEventListener('change', element._dynamicFilterHandler);
                        element._dynamicFilterHandler = handler;
                        element.addEventListener('change', handler);
                    }
                });
                applyFilterDependencies.call(ctx, prefix);
            });
        },

        /**
         * Aplica dependências entre filtros e atualiza datalists
         * @param {Object} ctx - Contexto (this das abas)
         * @param {string} prefix - Prefixo da aba
         * @param {Array} data - Dados principais
         * @param {Array} keyRatiosData - Dados de key ratios
         * @param {Function} updateDatalist - Função para atualizar datalist
         */
        applyFilterDependencies(ctx, prefix, data, keyRatiosData, updateDatalist, forceShowAll = false) {
            const suffixMap = {
                'dre': '-filter-',
                'dre-b2': '-',
                'margin': '-filter-',
                'dre-acc': '-',
            };
            const inputSuffix = suffixMap[prefix];
            const fields = ['cc', 'dept', 'client', 'sbd', 'proj'];
            const filterValues = {};
            fields.forEach(f => {
                const id = `${prefix}${inputSuffix}${f}`;
                const element = document.getElementById(id);
                filterValues[f] = element ? String(element.value).trim() : '';
                if (filterValues[f] === 'Todos...') filterValues[f] = '';
            });
            const yearElement = document.getElementById(`${prefix}-year-select`) || document.getElementById(`${prefix}-year`);
            const currentYear = yearElement ? parseInt(yearElement.value) : null;
            if (!currentYear) return;
            let filteredData = [];
            if (prefix === 'dre') {
                const dreTypeEl = document.getElementById('dre-type-select');
                const dreType = (dreTypeEl && dreTypeEl.value) ? dreTypeEl.value : 'Actual';
                if (dreType === 'Budget') filteredData = data.filter(d => d.tipo === 'Budget');
                else if (dreType === 'Actual') filteredData = data.filter(d => d.tipo !== 'Budget');
                else filteredData = [...data];
                filteredData = [...filteredData, ...keyRatiosData];
            } else {
                filteredData = [...data, ...keyRatiosData];
            }
            filteredData = filteredData.filter(d => parseInt(d.ano) === currentYear);
            let currentFilterState = {};
            const filterKeys = ['centroCusto', 'departamento', 'cliente', 'sbd', 'projectType'];
            if (!forceShowAll) {
                filterKeys.forEach((key, i) => {
                    const f = fields[i];
                    currentFilterState[key] = filterValues[f];
                    if (currentFilterState[key]) {
                        filteredData = filteredData.filter(d => AppUtils.filterMatches(d[key], currentFilterState[key]));
                    }
                });
            } else {
                filterKeys.forEach((key, i) => { currentFilterState[key] = ''; });
            }
            filterKeys.forEach(field => {
                const uniqueValues = [...new Set(filteredData.map(d => String(d[field] || '').trim()).filter(x => x))].sort();
                const filterAbbr =
                    field === 'centroCusto' ? 'cc' :
                    field === 'departamento' ? 'dept' :
                    field === 'cliente' ? 'client' :
                    field === 'projectType' ? 'proj' :
                    field;
                let datalistId = `dl-${filterAbbr}`;
                if (prefix === 'dre-acc') datalistId += '-acc';
                else if (prefix === 'margin') datalistId += '-margin';
                else if (prefix === 'dre-b2') datalistId += '-b2';
                const currentValue = currentFilterState[field];
                if (currentValue && !uniqueValues.includes(currentValue) && currentValue !== 'Todos...') {
                    uniqueValues.unshift(currentValue);
                }
                updateDatalist(datalistId, uniqueValues);
            });
        },

        /**
         * Verifica se o valor do filtro corresponde ao item
         */
        filterMatches(itemValue, filterString) {
            if (!filterString || filterString.toLowerCase() === 'todos...' || filterString.trim() === '') {
                return true;
            }
            const filterValues = filterString.split(',')
                                            .map(v => String(v).trim())
                                            .filter(v => v !== '');
            if (filterValues.length === 0) return true;
            const itemStr = String(itemValue || '').trim();
            return filterValues.some(filterV => itemStr === filterV);
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
            if (!isNaN(asNum) && asNum >= 1 && asNum <= 12) return asNum;
            return null;
        },

        parseLocaleNumber(value) {
            if (value === undefined || value === null) return 0;
            if (typeof value === 'number') return value;
            let s = String(value).trim();
            if (!s) return 0;
            s = s.replace(/\s+/g, '');
            if (s.indexOf(',') > -1 && s.indexOf('.') > -1) {
                const lastDot = s.lastIndexOf('.')
                const lastComma = s.lastIndexOf(',')
                if (lastDot > lastComma) {
                    s = s.replace(/,/g, '');
                } else {
                    s = s.replace(/\./g, '').replace(/,/g, '.');
                }
            } else if (s.indexOf(',') > -1) {
                s = s.replace(',', '.');
            } else if (s.indexOf('.') > -1) {
                const parts = s.split('.');
                const last = parts[parts.length - 1] || '';
                if (!(last.length > 0 && last.length <= 2)) {
                    s = s.replace(/\./g, '');
                }
            }
            s = s.replace(/[^0-9\.-]/g, '');
            const n = parseFloat(s);
            return isNaN(n) ? 0 : n;
        },

        normalizeAccountString(s) {
            if (s === undefined || s === null) return '';
            return String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
        },

        normalizeAccountDigits(s) {
            if (s === undefined || s === null) return '';
            const digits = String(s).replace(/\D/g, '');
            return digits.replace(/^0+/, '') || digits;
        },

        normalizePeriod(mes, ano) {
            let m = mes;
            let y = ano;
            if ((y === undefined || y === null || y === '') && typeof m === 'string' && m.includes('/')) {
                const parts = m.split('/').map(s => s.trim()).filter(Boolean);
                if (parts.length >= 2) {
                    m = parts[0];
                    y = parts[1];
                }
            }
            const parsed = AppUtils.parseMonthString(m);
            if (parsed !== null) {
                m = parsed;
            } else {
                m = String(m).trim();
                m = m.replace(/^0+/, '');
                const mm = Number(m);
                if (!isNaN(mm) && mm >= 1 && mm <= 12) m = mm;
            }
            if ((y === undefined || y === null || y === '') && typeof m === 'string' && m.includes('/')) {
                const parts = m.split('/').map(s => s.trim());
                if (parts.length >= 2) {
                    y = parts[1];
                    m = parts[0];
                }
            }
            y = String(y || '').trim();
            const yy = Number(y.replace(/[^0-9]/g, ''));
            const yearNum = !isNaN(yy) && yy > 0 ? yy : y;
            return `${String(m)}-${String(yearNum)}`;
        },

        inferMonthYearFromFilename(fileName) {
            if (!fileName || typeof fileName !== 'string') return null;
            const s = fileName.replace(/[_\-\.]/g, ' ').toLowerCase();
            const months = {
                jan:1, janeiro:1, feb:2, fev:2, february:2, mar:3, marco:3, março:3, apr:4, abril:4,
                may:5, maio:5, jun:6, junho:6, jul:7, julho:7, aug:8, agosto:8, sep:9, set:9, setembro:9,
                oct:10, out:10, outubro:10, nov:11, novembro:11, dec:12, dez:12, dezembro:12
            };

            const yearMatch = s.match(/(20\d{2}|19\d{2})/);
            const year = yearMatch ? parseInt(yearMatch[0]) : null;

            for (const key in months) {
                if (s.indexOf(key) >= 0) {
                    return { month: months[key], year: year, label: (months[key] + (year ? '/' + year : '')) };
                }
            }

            const mmYYYY = s.match(/(0?[1-9]|1[0-2])[\s_\-\.\/]*(20\d{2})/);
            if (mmYYYY) {
                return { month: parseInt(mmYYYY[1]), year: parseInt(mmYYYY[2]), label: (parseInt(mmYYYY[1]) + '/' + mmYYYY[2]) };
            }
            const yyyymm = s.match(/(20\d{2})[\s_\-\.]*0?(1[0-2]|[1-9])\b/);
            if (yyyymm) {
                return { month: parseInt(yyyymm[2]), year: parseInt(yyyymm[1]), label: (parseInt(yyyymm[2]) + '/' + yyyymm[1]) };
            }

            return null;
        }
    };
    // Expor globalmente para compatibilidade com código existente
    window.AppUtils = AppUtils;
    window.parseMonthString = AppUtils.parseMonthString.bind(AppUtils);
    window.parseLocaleNumber = AppUtils.parseLocaleNumber.bind(AppUtils);
    window.normalizeAccountString = AppUtils.normalizeAccountString.bind(AppUtils);
    window.normalizeAccountDigits = AppUtils.normalizeAccountDigits.bind(AppUtils);
    window.normalizePeriod = AppUtils.normalizePeriod.bind(AppUtils);
    window.inferMonthYearFromFilename = AppUtils.inferMonthYearFromFilename.bind(AppUtils);
    window.setupDynamicFilters = AppUtils.setupDynamicFilters.bind(AppUtils);
    window.applyFilterDependencies = AppUtils.applyFilterDependencies.bind(AppUtils);
})();
