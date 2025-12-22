(function(){
    // Pequena API para encapsular operações sobre app.data
    // Não substitui a orquestração central; fornece pontos de entrada para futuras extrações.
    const DataAPI = {
        getData(app) {
            return (app && app.data) ? app.data : [];
        },

        setData(app, newData, { persist = true, render = true } = {}) {
            if (!app) return;
            app.data = Array.isArray(newData) ? newData : [];
            if (persist && typeof app.saveToStorage === 'function') {
                try { app.saveToStorage(); } catch(e) { console.warn('DataAPI.saveToStorage failed', e); }
            }
            if (render && typeof app.renderData === 'function') {
                try { app.renderData(); } catch(e) { console.warn('DataAPI.renderData failed', e); }
            }
        },

        importData(app, rows, { merge = false, persist = true, render = true } = {}) {
            // rows: array de objetos já normalizados (espera formato compatível com app.data)
            if (!app) return;
            if (!Array.isArray(rows)) return;
            if (!Array.isArray(app.data) || !merge) {
                app.data = rows.slice();
            } else {
                // merge simples: concatena e evita duplicados por id quando presente
                const existingById = new Map();
                app.data.forEach(d => { if (d && d.id !== undefined) existingById.set(String(d.id), d); });
                rows.forEach(r => {
                    if (r && r.id !== undefined) {
                        existingById.set(String(r.id), r);
                    } else {
                        app.data.push(r);
                    }
                });
                // se existirem ids, reconstruir array a partir do mapa
                if (existingById.size) app.data = Array.from(existingById.values());
            }

            if (persist && typeof app.saveToStorage === 'function') {
                try { app.saveToStorage(); } catch(e) { console.warn('DataAPI.saveToStorage failed', e); }
            }
            if (render && typeof app.renderData === 'function') {
                try { app.renderData(); } catch(e) { console.warn('DataAPI.renderData failed', e); }
            }
        }
    };

    window.DataAPI = DataAPI;
})();
