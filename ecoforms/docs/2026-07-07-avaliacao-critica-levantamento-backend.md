# Avaliação Crítica do Levantamento de Backend

Data: 2026-07-07

Este documento avalia o texto de levantamento do backend em relação ao código atual do monorepo `ecoforms`.
O objetivo aqui não é repetir o inventário, mas separar o que está comprovado do que exige mais cautela.

## Veredito

O levantamento tem boa direção geral:

- identifica corretamente a tensão entre `desktop`, `mobile` e `packages/core`
- aponta duplicação real no sync
- reconhece que há boilerplate mecânico e documentos desatualizados
- preserva o paradigma local-first com sync por eventos

Mas ele mistura três níveis diferentes de certeza:

1. itens comprovados por código e grep
2. itens plausíveis, mas ainda dependentes de contexto operacional
3. itens que são órfãos no build atual, mas não necessariamente lixo seguro para remoção

## O que está bem sustentado

### 1. Divergência entre sync desktop, mobile e core

Há base real para a crítica:

- `desktop/src/infrastructure/sync/HandlerRegistry.ts` existe como espelho local
- `mobile/www/js/sync/HandlerRegistry.js` também mantém sua própria tabela de handlers
- `packages/core/src/sync/EventEnvelope.ts` concentra a lista canônica, mas o desktop ainda tem seu próprio espelho em `desktop/src/infrastructure/sync/EventEnvelope.ts`

Isso confirma a tese de que o sync ainda mantém duplicação estrutural e risco de drift.

### 2. Boilerplate em use cases e container

O texto acerta ao apontar:

- use cases de consulta que apenas delegam ao repositório
- `container.ts` grande e manual
- padrões repetidos de repositório SQLite

O arquivo `ViewUseCases.ts` realmente contém consultas triviais, e `DecisionUseCases.ts` é repasse puro.

### 3. `ensure-columns.ts` é monolítico

O bootstrap de schema é grande e concentra muita responsabilidade.
Mesmo sem apagar nada, já há material suficiente para modularização e limpeza.

### 4. `CLAUDE.md` e `BACKEND_NAO_EXPOSTO.md` precisam revisão

Esses documentos já carregam números e descrições que não batem com o estado atual do código.
Então a crítica de documentação desatualizada é válida.

## O que precisa de ajuste

### 1. “Código morto comprovado” ficou forte demais para a raiz

O texto trata alguns artefatos da raiz como removíveis sem risco. Isso precisa ser rebaixado.

Exemplos:

- `server.js` existe e é um entrypoint real de Express
- `meu-supabase-mcp/` tem `package.json` e scripts próprios
- `app/login/page.tsx` existe como artefato rastreado
- `src/` da raiz contém código real, mesmo que fora dos workspaces do app principal

Esses itens podem ser órfãos do fluxo principal, mas precisam de confirmação operacional antes de remoção.

### 2. A seção de números está parcialmente defasada

Os números do levantamento são próximos do real, mas não devem ser tratados como absolutos sem nova medição.

O caso mais visível:

- `desktop/src-tauri/src/lib.rs` registra 63 comandos Tauri
- o levantamento antigo ainda fala em 35

`ensure-columns.ts` também precisa de contagem atualizada antes de sustentar claims quantitativos.

### 3. Alguns itens “sem referências” têm referências indiretas

Exemplo:

- `server.js` não aparece no fluxo atual do app desktop/mobile, mas é um entrypoint funcional
- `meu-supabase-mcp` está fora dos workspaces, mas não é um diretório sem metadados

Então a formulação correta é “fora do caminho principal do build”, não “código morto” em sentido absoluto.

### 4. Parte do diagnóstico do sync já está sendo mitigada

O documento descreve o `packages/core` como um destino para unificação, e isso está correto.
Mas o quadro não está parado: já existem reexports e uso do core em vários pontos.

Ou seja, a conclusão certa é:

- o core já é a direção canônica
- o trabalho restante é terminar a migração e reduzir espelhos

## Classificação prática

### Confirmado

- duplicação entre desktop, mobile e core no sync
- arquivos grandes e mecanicamente repetitivos
- documentação em desacordo com o código atual
- `ensure-columns.ts` como ponto de concentração de schema

### Confirmado com cautela

- `src/` raiz como legado fora do fluxo principal
- `server.js` como artefato órfão do build principal
- `meu-supabase-mcp` como ferramenta lateral
- use cases triviais como candidatos à simplificação

### Não fechar como fato sem mais validação

- remoção direta de artefatos da raiz
- estimativas exatas de linhas mortas sem atualização de grep e build
- afirmar que todos os itens fora dos workspaces são descartáveis

## Propostas antes da execução

### 1. Evidenciar drift de sync

Criar uma matriz comparando `EcoFormsEventTypes` em `packages/core`, `desktop` e `mobile`.
O objetivo é separar três casos: evento canônico ausente no core, evento legado que deve ser removido e evento específico de plataforma que precisa ser documentado.

### 2. Corrigir a leitura do mobile

Tratar `mobile/www/js/sync/EventEnvelope.js` como camada de reexport do core, não como espelho completo.
O problema restante no mobile está mais em `HandlerRegistry.js` e nos handlers de persistência do que no envelope.

### 3. Criar matriz de comandos Tauri

Atualizar `BACKEND_NAO_EXPOSTO.md` com a contagem real do `generate_handler!` e classificar cada comando como:

- invocado pelo frontend
- usado internamente pelo Rust
- reservado por decisão operacional
- candidato a remoção

### 4. Tratar raiz como inventário, não limpeza

Para `src/`, `server.js`, `app/login/page.tsx`, `default/vitest.config.js` e `meu-supabase-mcp/`, registrar dono, entrypoint, script e uso operacional conhecido.
Só depois decidir entre manter documentado, mover para ferramentas ou remover.

### 5. Reduzir boilerplate em ordem segura

Começar por wrappers sem regra, como `DecisionUseCases.ts`.
Em arquivos mistos, como `ViewUseCases.ts`, remover apenas getters triviais e preservar fluxos com autorização, normalização ou criação de estado.

### 6. Modularizar bootstrap sem alterar comportamento

Dividir `ensure-columns.ts` por domínio, mas manter uma orquestração única.
A primeira melhoria deve ser observabilidade: substituir `.catch(() => {})` por tratamento explícito de erro esperado.

## Recomendação

Use o levantamento como base para trabalho em fases, mas com linguagem mais precisa:

1. separar “órfão do build principal” de “código morto”
2. atualizar os números antes de transformar em plano executivo
3. tratar a unificação do sync no `packages/core` como prioridade técnica
4. revisar docs antes de promover claims quantitativos

## Artefatos de execução

- Plano: `docs/superpowers/plans/2026-07-07-backend-simplification-execution.md`
- Evidências e progresso: `docs/backend/2026-07-07-backend-simplification-progress.md`
- Matriz de sync: `docs/backend/2026-07-07-sync-event-matrix.md`
- Matriz Tauri: `docs/backend/2026-07-07-tauri-command-matrix.md`
- Inventário da raiz: `docs/backend/2026-07-07-root-artifact-inventory.md`
- Nenhuma remoção deve ocorrer antes das matrizes de sync, Tauri e raiz.
