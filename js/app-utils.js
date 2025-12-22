// Helpers reutilizáveis extraídos de `script.js`
(function(){
    const AppUtils = {
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
        }

        ,

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
})();
