# ADR-057 - Higiene da estrutura do repositorio e separacao de artefatos

- **Status:**Implementado (parcial)** (inventário)
- **Data:** 2026-06-17
- **Atualizado:** 2026-06-18 (triagem de ADRs — auditoria de execução por fase)
- **Autores:** Equipe EcoForms
- **Contexto da decisao:** diagnostico visual e estrutural da raiz do repositorio apos consolidacao de apps desktop, mobile e pacote compartilhado
- **ADRs relacionados:** ADR-056 (Fonte de Verdade dos Dados), ADR-051 (fronteira backend/frontend) `[ARQUIVO EXISTENTE em docs/Concluidos/2026-06-02-ADR-051-commands-backend-nao-expostos.md — referência válida]`

---

## Contexto

O repositorio ja apresenta uma separacao nominal razoavel entre aplicacoes:

- `desktop/` concentra o app desktop, com Next/Tauri e `desktop/src-tauri/tauri.conf.json`.
- `mobile/` concentra o app mobile, com Capacitor/Android e `mobile/capacitor.config.json`.
- `packages/core/` concentra codigo compartilhado.
- `docs/` concentra documentacao tecnica.

Apesar disso, a raiz do repositorio acumula responsabilidades diferentes:

- **codigo fonte rastreado e ativo na raiz** (`src/` com camadas `application/`, `domain/`, `infrastructure/` e modulos `index.js`, `supabase-client.js`, `supabase-mcp-connector.js`; `server.js` Express com `@supabase/supabase-js`; `app/login/page.tsx`; `supabase-config.js`);
- **diretorios vazios/não rastreados** deixados como resíduo (`components/layout/`, `supabase/migrations/`, `app/clientes/`, `app/logistica/`, `app/manifestacoes/` — confirmado via `git ls-files` e `git status`: nenhum arquivo rastreado dentro deles);
- scripts de build e diagnostico (`build-debug*.ps1`, `build-debug-mobile.ps1`, `check-*`, `prepare-env.ps1`, `validate-project.ps1`);
- scripts historicos ou pontuais (`fix-*`, `rename-*.cjs`, `create_*.{js,mjs}`);
- artefatos locais de runtime e debug (`tauri-dev*.log` ate `tauri-dev5.log`, `hs_err_pid*.log`, `replay_pid*.log`, `app_debug.log`);
- bancos locais e amostras (`BD_Flex_v2007.sqlite`, `data.db`, `database.sqlite`, `ecoforms.sqlite`, `historical.db`, `local_db_schema.json`);
- dependencias instaladas na raiz (`node_modules/`, `package.json`, `package-lock.json`);
- recursos estaticos soltos (`favicon.ico`, `icon-192.png`, `icon-512.png`, `logo/`);
- apps, backups ou variantes historicas (`archive/`, `mobile_standalone/`, `logisticahtml/`, `EcoForms/`, `mobile_standalone.rar`);
- ferramentas auxiliares (`meu-supabase-mcp/`, pastas de agentes e automacoes);
- dados exportados e relatorios (`download/` com CSV/XLSX/JSON/SQL/tar, `reports/`, `changes/`);
- infraestrutura de migrations solta (`supabase/migrations/` na raiz, distinta de `desktop/supabase/`).

Esse desenho torna dificil distinguir rapidamente:

- codigo fonte vivo;
- codigo legado ou congelado;
- ferramenta de desenvolvimento;
- artefato gerado;
- dado local;
- recurso externo empacotado;
- script seguro de usar;
- script historico que nao deve mais rodar.

O problema principal nao e a existencia desses itens, mas a falta de fronteira explicita. A raiz virou ponto de mistura entre fonte, build, runtime, ferramentas, caches e historico.

---

## Diagnostico

### Achado 1 - Raiz com multiplos papeis

A raiz hoje funciona ao mesmo tempo como:

- workspace/orquestrador;
- deposito de scripts;
- diretorio de execucao local;
- deposito de logs;
- deposito de bancos locais;
- deposito de artefatos;
- deposito de recursos estaticos;
- area de legado e backup.

Isso reduz legibilidade e aumenta risco operacional. Um arquivo na raiz pode parecer fonte ativa mesmo sendo residuo local ou script de migracao antiga.

### Achado 2 - Fronteira desktop/mobile quase correta, mas com sinais cruzados

`desktop/` e `mobile/` existem como apps separados. Porem ha sinais de acoplamento historico:

- `desktop/src-tauri/tauri.conf.json` convive com `desktop/capacitor.config.json`.
- `mobile/package.json` contem scripts relacionados a `tauri` e `desktop`.
- raiz contem scripts de build/debug mobile e desktop misturados.

Esses sinais nao provam bug por si so, mas dificultam entender qual plataforma possui qual runtime.

### Achado 3 - Dependencias Node sem estrategia unica

Foram encontrados `package.json`/`package-lock.json` em varios niveis:

- raiz;
- `desktop/`;
- `mobile/`;
- `packages/core/`;
- `meu-supabase-mcp/`.

Observacao importante: o `package.json` da raiz **ja declara workspaces** (`"workspaces": ["desktop", "mobile", "packages/core"]`), ou seja, a Opcao A (monorepo com workspaces) ja e a configuracao nominal vigente. A divergencia real nao e ausencia de workspaces, e a coexistencia de um `package-lock.json` na raiz com `package-lock.json` independentes em `desktop/`, `mobile/` e `packages/core/`, o que contradiz o modelo de workspace unificado e permite divergencia silenciosa de versoes.

Isso pode ser valido, mas precisa ser intencional. Sem politica explicita, cada pasta pode evoluir dependencias de forma independente, com lockfiles divergentes e scripts duplicados.

### Achado 4 - Artefatos locais competem visualmente com fonte

Logs, bancos locais, arquivos `.rar`, caches, reports e arquivos de debug aparecem no mesmo nivel dos diretorios principais. Isso prejudica revisao, onboarding e auditoria.

### Achado 5 - Scripts historicos nao tem ciclo de vida claro

Scripts `fix-*`, `rename-*` e `create-*` podem ter sido uteis durante migracoes, mas nao indicam:

- se ainda devem rodar;
- se sao idempotentes;
- se dependem de uma fase antiga;
- se sao perigosos em codigo atual.

Scripts sem dono e sem status viram risco.

### Achado 6 - Codigo fonte rastreado convivendo com residuo na raiz (critico)

A raiz nao e apenas deposito de scripts e artefatos. Verificacao via `git ls-files` confirma **codigo fonte rastreado e ativo** na raiz:

- `src/` com estrutura DDD (`src/application/`, `src/domain/`, `src/infrastructure/`) e modulos `src/index.js`, `src/supabase-client.js`, `src/supabase-mcp-connector.js`;
- `server.js` servidor Express com `@supabase/supabase-js` e headers de seguranca (entry point de backend/bridge);
- `app/login/page.tsx`;
- `supabase-config.js`.

Atecao: nem tudo que aparece no disco e fonte. Os seguintes caminhos **existem como diretorios mas nao tem arquivos rastreados** (vazios ou apenas locais), devendo ser tratados como residuo, nao como codigo ativo:

- `components/layout/`;
- `supabase/migrations/`;
- `app/clientes/`, `app/logistica/`, `app/manifestacoes/`.

Este e o achado mais serio: a ADR original tratava a raiz apenas como deposito de scripts/logs/dbs/assets, mas existe um backend/aplicacao hospedado ali (rastreado no Git) fora de qualquer `apps/` ou `packages/`. Qualquer movimento futuro de `desktop/`/`mobile/` para `apps/` (Fase 5) precisa primeiro classificar esse codigo-fonte da raiz, sob risco de quebrar imports e contratos.

### Achado 7 - Artefatos ja commitados apesar das regras de `.gitignore`

O `.gitignore` ja cobre a maioria dos artefatos listados (`*.log`, `*.db`, `*.sqlite`, `*.rar`, `*.zip`, `tauri-dev*.err`, `app_*.log`). Porem os seguintes itens **continuam rastreados no Git**, tendo sido commitados antes das regras:

- `historical.db`;
- `favicon.ico`;
- `icon-192.png`;
- `icon-512.png`.

Esses arquivos nao sao removidos apenas adicionando linhas no `.gitignore`; exigem `git rm --cached` explicito. A Fase 1 deve cobrir essa limpeza, nao apenas a atualizacao do ignore.

---

## Decisao

Adotar uma politica de higiene estrutural em que a raiz do repositorio seja apenas:

1. ponto de entrada do workspace;
2. documentacao de alto nivel;
3. configuracao global inevitavel;
4. orquestracao entre apps/pacotes.

Todo item que nao cumprir esse papel deve migrar gradualmente para uma area explicita:

```text
/
  apps/
    desktop/
    mobile/
  packages/
    core/
  docs/
  scripts/
    active/
    archive/
  tools/
    mcp/
  infra/
    supabase/
  artifacts/
    logs/
    databases/
    reports/
    builds/
  archive/
```

Esta ADR nao exige mover tudo imediatamente. Ela define a direcao e as regras para melhorias futuras.

---

## Regras alvo

### R1 - Apps ficam em `apps/`

Destino futuro recomendado:

- `desktop/` -> `apps/desktop/`
- `mobile/` -> `apps/mobile/`

Enquanto a mudanca for cara, os nomes atuais podem permanecer. Porem novos apps nao devem ser criados na raiz.

### R2 - Pacotes compartilhados ficam em `packages/`

`packages/core/` permanece como local correto para codigo compartilhado.

Regras:

- logica compartilhada nao deve ser copiada entre `desktop/` e `mobile/`;
- duplicacao TS/JS deve ser tratada como divida tecnica explicita;
- pacotes compartilhados devem ter contrato claro de build e consumo.

### R3 - Scripts devem ter dono e status

Scripts permanentes ficam em `scripts/active/`.

Scripts historicos ficam em `scripts/archive/` com cabecalho minimo:

- finalidade;
- data aproximada;
- pre-condicoes;
- status: ativo, arquivado, proibido, ou somente referencia.

Scripts soltos na raiz devem ser considerados divida estrutural.

### R4 - Artefatos gerados nao ficam na raiz

Logs, bancos locais, reports, builds, dumps e arquivos temporarios devem ir para `artifacts/` ou `temp/`, preferencialmente ignorados pelo Git.

Exemplos:

- `tauri-dev*.log` -> `artifacts/logs/tauri/`
- `hs_err_pid*.log` -> `artifacts/logs/jvm/`
- `replay_pid*.log` -> `artifacts/logs/replay/`
- `*.sqlite`, `*.db` locais -> `artifacts/databases/`
- `.rar`, builds exportados -> `artifacts/builds/`

### R5 - Recursos estaticos devem pertencer a um app ou pacote

Arquivos como icones, favicon e logos devem ficar no app que os empacota ou em pacote de assets compartilhado.

Exemplos:

- recurso usado so no desktop -> `desktop/public/` ou equivalente;
- recurso usado so no mobile -> `mobile/www/` ou equivalente;
- recurso compartilhado -> `packages/assets/` ou `assets/` documentado.

### R6 - Tauri pertence ao desktop; Capacitor pertence ao mobile

Regra conceitual:

- Tauri e runtime desktop ficam no app desktop;
- Capacitor e runtime mobile ficam no app mobile.

Qualquer excecao deve ser documentada no proprio arquivo ou em ADR complementar.

Arquivos suspeitos, como `desktop/capacitor.config.json`, devem ser classificados antes de mover ou remover:

- ativo;
- legado;
- gerado;
- compatibilidade temporaria.

Nota de diagnostico (2026-06-17): `desktop/capacitor.config.json` existe e **nao e gerado**. Conteudo confirmado:

```json
{
  "appId": "com.ecosuite.desktop",
  "appName": "EcoSuite Desktop",
  "webDir": "www",
  "bundledWebRuntime": false
}
```

E um config Capacitor real apontando para `www/`, convivendo na mesma pasta do app Tauri. Alem disso, `mobile/package.json` expoe scripts que chamam o desktop:

```json
"tauri": "npm run tauri --prefix desktop --",
"desktop": "npm run dev --prefix desktop"
```

Esses dois pontos materializam o acoplamento cruzado Tauri/Capacitor descrito no Achado 2 e devem ser resolvidos (mover o config, remover os scripts, ou justificar como compatibilidade temporaria) antes da Fase 5.

### R7 - Lockfiles devem seguir uma politica unica

Estado atual (confirmado no codigo): o `package.json` da raiz **ja declara workspaces** (`"workspaces": ["desktop", "mobile", "packages/core"]`), o que coloca o repositorio nominalmente na **Opcao A** (monorepo com workspaces). A decisao pendente nao e mais "monorepo vs apps independentes", mas **alinhar a pratica a declaracao**.

#### Estado atual (Opcao A declarada, parcialmente implementada)

- Raiz: `package.json` com `workspaces` + `package-lock.json`.
- `desktop/`, `mobile/`, `packages/core/`: cada um mantem **proprio** `package-lock.json`.

Esse meio-termo e o pior dos mundos: workspaces existem mas lockfiles filhos divergem, abrindo risco de versoes diferentes da mesma dependencia entre pacotes.

#### Decisao alvo

Adotar a Opcao A de fato:

- manter **um unico** `package-lock.json` na raiz;
- remover os `package-lock.json` de `desktop/`, `mobile/` e `packages/core/`;
- re-rodar `npm install` na raiz para regenerar o lock unificado;
- preservar `meu-supabase-mcp/package-lock.json` apenas se continuar como ferramenta isolada (`meu-supabase-mcp/` nao esta no array de workspaces).

#### Pre-requisitos antes da migracao de lockfiles

- build e teste de `desktop`, `mobile` e `packages/core` passando;
- `capacitor sync` e `tauri build/dev` validados;
- scripts que fazem `npm install --prefix <pkg>` ou `npm run --prefix <pkg>` revisados (ainda funcionam com workspaces, mas `--prefix` torna-se redundante).

Nao migrar lockfiles sem validar builds desktop e mobile.

---

## Plano incremental

### Fase 0 - Inventario sem mudanca

Criar uma lista classificada dos itens da raiz. O inventario **deve incluir obrigatoriamente** os itens de codigo-fonte rastreado ativo identificados no Achado 6, que costumam ser esquecidos por parecerem "parte do workspace":

- `src/` (DDD: `application/`, `domain/`, `infrastructure/`, `index.js`, `supabase-client.js`, `supabase-mcp-connector.js`);
- `server.js` (Express + Supabase);
- `app/login/page.tsx`;
- `supabase-config.js`, `ecoponto-config.json`.

E tratar explicitamente como **residuo** (diretorios presentes no disco mas sem arquivos rastreados, confirmados via `git ls-files`):

- `components/layout/`, `supabase/migrations/`, `app/clientes/`, `app/logistica/`, `app/manifestacoes/`.

Categorias de classificacao para todos os itens da raiz:

- manter na raiz;
- mover para `scripts/active/`;
- mover para `scripts/archive/`;
- mover para `artifacts/`;
- mover para app especifico;
- mover para `packages/` (caso do codigo-fonte rastreado da raiz);
- mover para `archive/`;
- remover do Git futuramente;
- remover diretorios vazios/não rastreados;
- investigar.

Saida recomendada: `docs/INVENTARIO_HIGIENE_REPOSITORIO.md`.

### Fase 1 - `.gitignore` e artefatos

Estado atual: o `.gitignore` ja cobre `*.log`, `*.db`, `*.sqlite`, `*.rar`, `*.zip`, `tauri-dev*.err`, `app_*.log`, `temp/`, `tmp/`, `scratch/`, `reports/`, `changes/`, `EcoForms/`, `mobile_standalone/` e regras por app (desktop/mobile). A maior parte dos artefatos novos ja fica fora do Git.

Pendencias reais nesta fase:

- remover do index do Git os artefatos ja commitados antes das regras (Achado 7): `git rm --cached historical.db favicon.ico icon-192.png icon-512.png`;
- destino decidido para `download/` (CSV/XLSX/JSON/SQL/tar): ignorar com `/download/` e retirar do versionamento; premissa: o app não possui dados legados/auditoria a preservar neste momento;
- classificar `supabase/migrations/` da raiz vs `desktop/supabase/` (qual e a fonte de verdade das migrations?);
- revisar itens soltos ainda nao cobertos (`local_db_schema.json`, `ecoponto-config.json`, `force-offline.html`, `install-success.html`, `_analysis_output.json`, `iniciar-servidor-vistoria.bat`, `SCROLL-QUICK-REF.txt`).

Esta fase deve evitar mover codigo fonte.

### Fase 2 - Scripts

Classificar scripts da raiz e mover apenas os claramente nao importados por build/teste.

Cada movimento deve atualizar referencias em:

- `package.json`;
- scripts `.ps1`/`.sh`;
- documentacao;
- CI, se existir.

### Fase 3 - Recursos estaticos

Mover icones, favicon e logos para o app consumidor ou pacote compartilhado.

Antes de mover:

- buscar referencias;
- validar build;
- validar empacotamento desktop/mobile.

### Fase 4 - Runtime configs

Classificar configs cruzadas:

- `desktop/capacitor.config.json`;
- scripts Tauri dentro do mobile;
- scripts desktop dentro do mobile.

Resultado esperado:

- manter com justificativa documentada; ou
- mover para app correto; ou
- arquivar/remover se legado.

### Fase 5 - Estrutura `apps/`

Mover `desktop/` e `mobile/` para `apps/` somente se:

- builds locais passarem;
- testes principais passarem;
- Capacitor sync passar;
- Tauri build/dev passar;
- paths hardcoded forem ajustados;
- documentacao for atualizada.

Esta fase e de alto impacto e deve ser tratada como projeto separado.

---

## Consequencias

### Positivas

- Onboarding mais rapido.
- Menos risco de alterar artefato achando que e fonte.
- Menos ruido em auditorias e engenharia reversa.
- Fronteiras de plataforma mais claras.
- Scripts com ciclo de vida explicito.
- Menos divergencia entre desktop, mobile e core.

### Negativas / custos

- Movimentos de pastas podem quebrar imports, scripts, CI e caminhos hardcoded.
- Build Tauri e Capacitor sao sensiveis a paths.
- Historico Git fica mais ruidoso durante migracao.
- Exige validacao por fase, nao uma limpeza unica.

### Riscos se nada for feito

- Crescimento da raiz como deposito permanente.
- Novos scripts copiados sem dono.
- Artefatos locais versionados por acidente.
- Duplicacao entre desktop/mobile mascarada por organizacao visual.
- Dificuldade para agentes e humanos distinguirem codigo vivo de legado.

---

## Criterios de aceite futuros

Uma melhoria estrutural baseada nesta ADR sera considerada segura quando:

- nenhum codigo fonte vivo for removido sem inventario;
- raiz tiver apenas arquivos globais e orquestradores;
- scripts tiverem status explicito;
- artefatos locais estiverem ignorados ou em `artifacts/`;
- configs Tauri/Capacitor estiverem no app correto ou justificadas;
- builds desktop/mobile continuarem funcionando;
- testes relevantes de `packages/core`, `desktop` e `mobile` passarem;
- documentacao de setup refletir a nova estrutura.

---

## Decisao de curto prazo

Nao reorganizar a arvore imediatamente.

Primeiro passo aprovado por esta ADR:

1. criar inventario da raiz, **incluindo obrigatoriamente o codigo-fonte rastreado ativo** (`src/`, `server.js`, `app/login/page.tsx`, `supabase-config.js`) identificado no Achado 6, e separando os diretorios vazios/não rastreados como residuo (`components/layout/`, `supabase/migrations/`, `app/clientes/`, `app/logistica/`, `app/manifestacoes/`);
2. remover do index do Git os artefatos ja commitados (Achado 7): `historical.db`, `favicon.ico`, `icon-192.png`, `icon-512.png` via `git rm --cached` (o `.gitignore` ja cobre os padroes, mas o historico commitado precisa ser limpo a parte);
3. retirar `download/` do versionamento e ignorar o diretorio, sem preservar em `artifacts/exports/`;
4. arquivar arquivos comprovadamente gerados, historicos ou sem dono (`default/vitest.config.js`, `test/auth-encarregado.test.js`, artefatos HTML/JSON antigos, `logisticahtml/` e backend raiz legado) conforme classificacao do inventario;
5. preservar codigo legado por arquivamento, nao por permanencia na raiz como codigo vivo.

Execucao aplicada em 2026-06-17:

- `download/` saiu do index e passou a ser ignorado por `/download/`;
- backend raiz movido para `archive/legacy-root-backend/`;
- `logisticahtml/` movido para `archive/logisticahtml/`;
- stray config/test e artefatos HTML/JSON antigos movidos para `archive/repository-hygiene/`.

---

## Status de execução por fase (2026-06-18 — triagem de ADRs)

> Auditoria contra o estado do repositório. Mapeia para `docs/INVENTARIO_HIGIENE_REPOSITORIO.md §9`.

| Fase | Item | Status | Risco | Pode rodar agora? |
|---|---|---|---|---|
| **F0** | Inventário classificatório (`INVENTARIO_HIGIENE_REPOSITORIO.md`) | ✅ **Concluído** | — | — |
| **F1** | `git rm --cached` 4 artefatos (`historical.db`, `favicon.ico`, `icon-192.png`, `icon-512.png`) — Achado 7 | 🔴 **Pendente** | baixo | ✅ Sim |
| **F1** | `git rm --cached`/mover artefatos §3.15 (`_analysis_output.json`, `local_db_schema.json`, `force-offline.html`, `install-success.html`) | 🔴 **Pendente** | baixo | ✅ Sim |
| **F1** | Remover dirs vazios (Seção 6) | 🔴 **Pendente** | baixo | ✅ Sim |
| **F1** | Remover `supabase/` raiz (fonte é `desktop/supabase/`) | 🔴 **Pendente** | baixo | ✅ Sim |
| **F1** | `/download/` removido do index + ignorado | ✅ **Executado** (2026-06-17) | baixo | — |
| **F1** | `logisticahtml/` → `archive/logisticahtml/` | ✅ **Executado** (2026-06-17) | médio | — |
| **pré-F5** | Backend raiz → `archive/legacy-root-backend/` | ✅ **Executado** (2026-06-17) | médio | — |
| **F1** | Stray config/test/HTML/JSON → `archive/repository-hygiene/` | ✅ **Executado** (2026-06-17) | médio | — |
| **F2** | Mover `data-flow.md`, `PLANO_MIGRACAO_UUIDV7.md` para `docs/` | 🟡 **A verificar** | baixo | ✅ Sim |
| **F2** | Mover `build-*`, `check-*`, `prepare-env`, `validate-project` para `scripts/active/` | 🔴 **Pendente** | médio | Após P3 ou janela dedicada |
| **F3** | Mover `favicon`/`icon`/`logo/` para app consumidor | 🔴 **Pendente** | médio | Exige validar build/empacotamento |
| **F4** | Classificar `desktop/capacitor.config.json` + scripts `tauri`/`desktop` do mobile | 🔴 **Pendente** | médio | Após P3 |
| **F5** | Mover `desktop/`/`mobile/` para `apps/` | 🔴 **Pendente** | alto | Projeto separado |
| **R7** | Unificar lockfiles (remover filhos) | 🔴 **Pendente** | alto | Após builds desktop+mobile+core verdes |

**Conclusão da auditoria:** F0 concluída; F1 parcialmente executada (4 itens `git rm --cached` do Achado 7 + dirs vazios + `supabase/` raiz ainda pendentes — todos de baixo risco, prontos para rodar). F2-F5 + R7 pendentes, dependem de P3 (refactor SQL) ou janelas dedicadas.

> **Próximo marco recomendado (redução de risco técnico):** completar os 4 itens F1 pendentes de baixo risco (Achado 7 + dirs vazios + `supabase/` raiz + artefatos §3.15). São `git rm --cached` isolados, independentes entre si, sem tocar em código fonte.

> **Colisão de numeração observada:** existe outro `ADR-057-email-real-usuarios.md` (restaurado de `desktop/docs/adr/` em 2026-06-18) — documento distinto sobre envio de email real no cadastro de usuários. Este ADR-057 (Higiene) é o canônico para a decisão estrutural do repositório.
