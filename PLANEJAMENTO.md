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

## Registro de Correções (23-12-2025)

- **Problema:** A aba `DRE Departamento` perdeu o layout (contas de balanço não eram exibidas) e a aba `DRE Suécia` não apresentava dados em colunas apropriadas.
- **Causa:** Condição de corrida / ordem de carregamento após extrair `dreDeptLayout` e grupos de contas para `js/config/dre-config.js`. O objeto `app` podia inicializar antes de `window.DreConfig` estar disponível.
- **Correção aplicada:** Em `js/script.js` adicionei uma sincronização em `app.init()` que atualiza `this.dreDeptLayout` e os grupos de contas a partir de `window.DreConfig` quando presente. Também atualizei `dreDeptLayout` e os grupos para referenciar `window.DreConfig` com fallback vazio quando o arquivo de config não estiver presente no parse.
- **Arquivos alterados:**
  - `js/script.js` — referências a `dreDeptLayout`/grupos substituídas por referências a `window.DreConfig` + sincronização em `app.init()`.
  - `js/config/dre-config.js` — arquivo existente com `window.DreConfig.dreDeptLayout` e `window.DreConfig.accountGroups`.
- **Branch:** `cleanup-remove-comments-2-20251223-124842` (commits comufix aplicados e push realizados).
- **Como validar (quick smoke):**
  1. `npm start`
  2. Abrir o app e selecionar `Relatórios DRE -> DRE Departamento` e verificar que as linhas de Balanço/Ativos/Passivos aparecem.
  3. Selecionar `Relatórios DRE -> DRE Suécia` e verificar que as colunas (por departamento/sbd/cliente) são populadas.
  4. Abrir DevTools (Console) para checar eventuais erros JS.
- **Próximo passo sugerido:** abrir PR pequeno para revisão dessas mudanças e, em seguida, prosseguir com a Fase B (modularizar renderers DRE em módulos separados).

Registro adicionado automaticamente pelo agente em 2025-12-23.

## Plano Resumido (para retomar)

- **Objetivo:** transformar `js/script.js` em orquestrador (routing + delegação).  
- **Fases:**  
  - A: Constantes -> `js/config/dre-config.js` (concluído)  
  - B: Renderers DRE -> `js/aba-dre-*.js` (PRs por aba)  
  - C: Helpers UI -> `js/app-utils.js` (concluído)  
  - D: Persistence -> `js/data-api.js` (savedImportedFiles, balanceData, mgmtFees)  
  - E: Wrappers -> `script.js` monta contexto mínimo e chama `window.Aba*.render(ctx)`  
  - F: QA final e limpeza (remover código morto, arquivar comentários)  
- **Checklist rápido por PR:** backup branch, work branch `feat/...`, fallback, testes manuais (3 cenários), commit/push, abrir PR.  

Arquivo atualizado para que você possa retomar quando quiser. (23-12-2025)

**Plano Detalhado — Minimização do `js/script.js`**

- **Meta:** transformar `js/script.js` em um orquestrador mínimo (routing + delegação). Alvo prático: manter o arquivo com apenas o contexto e delegações, visando < 100 linhas de lógica de controle.

- **Sequência Prioritária:**
  - **Backup:** criar branch de backup antes de qualquer mudança.
  - **Auditoria:** mapear responsabilidades do `js/script.js` (imports, renderers, helpers, persistência, eventos DOM). Entregável: lista curta de dependências e funções públicas.
  - **Config/Constantes:** consolidar constantes em `js/config/*` e garantir fallbacks seguros.
  - **Renderers (B):** extrair renderers pesados DRE por aba para `js/aba-dre-<nome>.js` (PRs por aba). Cada renderer implementa `render(ctx)` e `init()` opcional.
  - **Contrato de Renderers:** padronizar API mínima (`render(ctx)`, `getState()` opcional) e documentar no `PLANEJAMENTO.md`.
  - **DataAPI (D):** implementar/expandir `js/data-api.js` com métodos `get/set/import/export` para `balanceData`, `savedImportedFiles`, `mgmtFees` e outros; substituir acessos diretos no código.
  - **Helpers (C):** finalizar migração para `js/app-utils.js` e reduzir wrappers em `script.js` a chamadas diretas a `AppUtils`.
  - **Refactor Final:** reescrever `script.js` para montar contexto mínimo e delegar aos módulos via `window.Aba*.render(ctx)`.
  - **QA & Limpeza:** testes manuais em cenários críticos e remoção de código morto/arquivamento de comentários.

- **Estimativas (orientativas):**
  - Backup + auditoria: 0.5–1 h
  - Cada renderer DRE: 1–2 h
  - DataAPI: 1.5–3 h
  - Refatorar `script.js`: 1–2 h
  - QA e limpeza: 1–2 h

- **Critérios de Aceitação (por PR):**
  - Branch de backup criado e `push` realizado.
  - Nenhum erro JS novo no Console após `npm start`.
  - Cenário manual básico passa (import + render da aba alterada).
  - `script.js` não contém lógica específica de renderer (apenas delegação).
  - Fallbacks documentados quando `DataAPI` / `DreConfig` não estiverem presentes.

- **Comandos úteis (PowerShell) — criar backup:**
```powershell
$ts = (Get-Date -Format 'yyyyMMdd-HHmmss')
git checkout -b backup-before-script-minify-$ts
git push -u origin HEAD
```

- **Próximo passo sugerido:** criar o branch de backup agora e rodar a auditoria rápida do `js/script.js` para gerar o mapa de dependências (posso fazer isso automaticamente se você autorizar). 
