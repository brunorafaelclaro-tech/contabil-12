**Planejamento de Refactor — Projeto contabil-12

**Objetivo**: Reduzir `js/script.js` ao mínimo, extraindo lógica por módulos (importadores, renderers, helpers e persistência) e centralizando gravações em `js/data-api.js`.

**Princípios**:
- Refatoração incremental: um módulo por vez, branch de backup antes de cada alteração.
- Testes manuais rápidos após cada mudança (import/export, renderização).
- Manter fallback compatível até estabilizar (`DataAPI` opt-in).
- Commits pequenos e atômicos por módulo.


**Cronograma (3–4 h por dia)**
- ~~Dia 1 — Audit + iniciar `balanceData` (3–4 h)~~ ✅
  - ~~Mapear responsabilidades em `script.js` e dependências do Balanço.~~
  - ~~Criar branch `backup-before-balanceData-<timestamp>` e começar extração do preview/parse.~~
  - **Status:** Concluído. Módulo `aba-import-balance.js` criado, centralização via DataAPI implementada, testes manuais e commits realizados.

- ~~Dia 2 — Finalizar `balanceData` (3–4 h)~~ ✅
  - ~~Completar heurísticas, fallback (preview raw) e `DataAPI.setBalanceData`.~~
  - ~~Testes de import/export e render.~~
  - **Status:** Concluído. Toda lógica de importação, preview, persistência e renderização do balanço está modularizada e validada.

- ~~Dia 3 — `receita` (3–4 h)~~ ✅
  - ~~Extrair import/processamento para `js/aba-import-receita.js` e usar `DataAPI.importReceita`.~~
  - **Status:** Concluído. Módulo `aba-import-receita.js` padronizado, integração com DataAPI validada, testes manuais realizados e push efetuado.

- ~~Dia 4 — `despesa` (3–4 h)~~ ✅
  - ~~Extrair import/processamento para `js/aba-import-despesa.js` e usar `DataAPI.importDespesa`.~~
  - **Status:** Concluído. Módulo `aba-import-despesa.js` padronizado, integração com DataAPI validada, testes manuais realizados e push será efetuado.

- ~~Dia 5 — `keyRatios` e budgets (3–4 h)~~ ✅
  - ~~Padronizar `keyRatiosData` e `keyRatiosBudgetData` via `DataAPI`.~~
  - **Status:** Concluído. Módulo `aba-import-keyratios.js` padronizado, integração com DataAPI validada, testes manuais realizados e push será efetuado.

- ~~Dia 6 — Extrair renderers DRE pesados (3–4 h)~~ ✅
  - Mover DRE/DRE Acumulado/Budget para módulos específicos e delegar a `script.js`.
  - **Status:** Concluído. Renderizadores DRE, DRE Acumulado e DRE Budget-2 extraídos para módulos, delegação em script.js validada, filtros funcionando perfeitamente.

- Dia 7 — Filtros e helpers UI (3–4 h)
  - Mover `setupDynamicFilters`, `populateFilters` e utilitários para `js/app-utils.js`.

- Dia 8 — QA final e limpeza (3–4 h)
  - Testes integrados com importações reais, limpar código restante em `script.js`.

**Branches e commits**
- Antes de mexer em um módulo: criar branch `backup-before-<module>-YYYYMMDD-HHmmss` e dar `push`.
- Commit style: `refactor(<module>): extract and use DataAPI`.
- Push para remoto após cada commit para manter cópia externa.

**Comandos úteis (PowerShell)**
```powershell
# Criar branch de backup
$ts = (Get-Date -Format 'yyyyMMdd-HHmmss')
git checkout -b backup-before-balanceData-$ts
git push -u origin HEAD

# Comitar alterações
git add -A
git commit -m "refactor(<module>): descrição curta"
git push

# Iniciar app para testes
npm start
```

**Checklist por módulo**
- [ ] Criar branch de backup
- [ ] Extrair/parar lógica no módulo `js/aba-<module>.js`
- [ ] Substituir atribuições diretas por `DataAPI` (get/set/import)
- [ ] Garantir fallback se `DataAPI` não existir
- [ ] Testes manuais de import/export/render
- [ ] Commit e push

**Observações e riscos**
- Dados binários/base64 não devem crescer sem controle; avaliar estratégia de armazenamento separado.
- Cálculos financeiros e DRE são sensíveis — teste com amostras reais.
- Manter a aba `Dados` em `script.js` até você autorizar a extração completa.

**Como atualizo este plano**
- Sempre que você pedir "Atualize o planejamento" eu atualizo este arquivo `PLANEJAMENTO.md` e o item `Planejamento` no tracker com o delta (o que mudou).

---
Arquivo gerado automaticamente por request do usuário. Para que eu commit/empurre este arquivo agora, responda `commit` — caso contrário eu apenas o deixo criado para você revisar.
