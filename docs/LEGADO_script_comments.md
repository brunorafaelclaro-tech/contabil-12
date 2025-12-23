# Arquivo de Legado — comentários extraídos de `js/script.js`

Data da extração: 2025-12-23
Fonte: `js/script.js`

Objetivo: arquivar comentários históricos, decisões e marcadores de remoção para permitir limpeza do código sem perder contexto.

---

## Trechos arquivadas

1) Contexto: definição de contas e grupos

Trecho (origem: linhas ~320-340):

    outrasAdmAccounts: [2674, 2682, 2690],
    // (grupo removido)
    outrasPosAccounts: [], 
    // CONTA 2844 CONSOLIDADA NO GRUPO PRINCIPAL PÓS-EBITDA

Observação: comentário curto informando que um grupo foi removido. Mantido por contexto histórico.

---

2) Contexto: loadFromStorage / saved imports

Trecho (origem: linhas ~5370-5386):

    try { this.renderSavedImports(); this.renderSavedImportsInline(); } catch (e) { /* ignore */ }
    }

    // (global saved imports dropdown removido)

Observação: marca que o dropdown global de imports salvos foi removido da UI. Informação de história de produto.

---

3) Contexto: auto-map / backup / preview scaling

Trecho (origem: linhas ~6448-6480):

    app.backupDataAndNotify = function() { ... }

    // (scaling do preview removido; import usa valores do arquivo)

Observação: indica decisão de design (scaling do preview removido). Mantido como nota histórica.

---

4) Observações gerais

- Muitos comentários no arquivo são explicativos e de manutenção ("Lógica de Management Fee", "Heads Logic", "Filtra dados de Balanço" etc.) — esses foram preservados no código.
- A extração aqui cobre marcadores explícitos de remoção/histórico detectados automaticamente numa primeira varredura. Comentários explicativos foram deixados no código.

---

Como usar:
- Este arquivo está no repositório para fins de auditoria. Após revisão, as entradas aqui podem ser removidas ou enriquecidas com autor/data adicional.

---

Fim do arquivo.
