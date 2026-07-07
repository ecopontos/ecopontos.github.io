# Levantamento Revisado do Backend

Data: 2026-07-07

## Objetivo

Reduzir complexidade do backend do monorepo `ecoforms` sem mudar o paradigma atual:

- local-first
- SQLite como base local
- sync por eventos
- criptografia no transporte de eventos
- `packages/core` como direção canônica para lógica compartilhada

O foco é simplificar manutenção, não redesenhar a arquitetura.

## Síntese executiva

Há três frentes claras de simplificação:

1. sync ainda mantém espelhos entre desktop, mobile e core
2. há muito boilerplate em use cases, repositórios e wiring
3. o bootstrap de schema e a documentação acumulam responsabilidade demais em arquivos grandes

O melhor caminho não é consolidar runtime, e sim reduzir duplicação e alinhar contratos.

## 1. Sync e contratos canônicos

### Estado atual

O sistema já usa `packages/core` para parte do protocolo de sync, mas ainda existem espelhos locais e camadas de compatibilidade:

- `desktop/src/infrastructure/sync/HandlerRegistry.ts`
- `desktop/src/infrastructure/sync/EventEnvelope.ts`
- `mobile/www/js/sync/HandlerRegistry.js`
- `mobile/www/js/sync/EventEnvelope.js`, hoje como reexport de `ecoforms-core`

O drift mais relevante está entre `packages/core/src/sync/EventEnvelope.ts` e `desktop/src/infrastructure/sync/EventEnvelope.ts`.
O mobile já aponta para o core no envelope, mas ainda mantém handlers próprios.

### Leitura correta

O problema não é o uso de desktop + mobile.
O problema é manter tabelas de eventos e handlers em mais de um lugar quando o contrato já deveria viver no core.

### Direção recomendada

- manter `packages/core` como fonte canônica para tipos de evento e envelope
- reduzir o desktop a bindings e handlers específicos de persistência
- deixar o mobile com o mesmo contrato, sem listas divergentes

### Propostas

1. Fazer uma tabela `evento / core / desktop / mobile handler` antes de alterar código.
2. Migrar `desktop/src/infrastructure/sync/EventEnvelope.ts` para reexportar `ecoforms-core/sync`, mantendo apenas adaptações inevitáveis.
3. Transformar diferenças de evento em decisão explícita: adicionar ao core, remover do desktop ou manter como legado documentado.
4. Criar teste de paridade que falhe quando `EcoFormsEventTypes` divergir entre runtimes.
5. Manter `HandlerRegistry` por plataforma somente para persistência e efeitos locais, não para definir contrato.

## 2. Simplificação de aplicação

### Onde há ganho fácil

- `DecisionUseCases.ts`: repasse puro
- parte de `ViewUseCases.ts`: getters simples
- `container.ts`: wiring manual extenso
- alguns repositórios SQLite com padrões repetidos de `findAll` e upsert

### Critério

Se o use case não adiciona regra, validação, autorização ou evento, ele deve ser tratado como candidato a remoção ou inline.

### Direção recomendada

- manter use cases com regra real
- remover wrappers que só chamam repositório
- extrair helpers comuns para repositórios SQLite
- modularizar `container.ts` por domínio

### Propostas

1. Classificar use cases em três grupos: regra real, consulta trivial e wrapper legado.
2. Começar por `DecisionUseCases.ts`, porque é repasse puro e tem baixo risco funcional.
3. Em `ViewUseCases.ts`, remover apenas getters triviais; preservar fluxos com autorização, normalização e criação de dashboard.
4. Extrair factories por domínio do `container.ts`, sem introduzir framework de DI.
5. Criar helpers SQLite pequenos para padrões repetidos de `findAll`, `findById`, `upsert` e serialização JSON.

## 3. Schema bootstrap

`desktop/scripts/ensure-columns.ts` concentra criação de tabelas, seeds e ajustes de coluna.

Isso ainda pode ser simplificado sem alterar comportamento:

- dividir por domínio
- reduzir repetição de `ALTER TABLE ... ADD COLUMN`
- evitar mascarar falhas com `.catch(() => {})` quando o erro importa

O arquivo não precisa desaparecer.
Ele precisa virar bootstrap legível e auditável.

### Propostas

1. Dividir `ensure-columns.ts` em módulos por domínio, mantendo uma função orquestradora única.
2. Substituir blocos repetidos de `ALTER TABLE ... ADD COLUMN` por helper idempotente com log contextual.
3. Trocar `.catch(() => {})` por tratamento que ignore apenas erros esperados, como coluna já existente.
4. Separar criação de schema, migrações compatíveis e seeds em funções distintas.
5. Adicionar um teste ou script de dry-run para banco novo e banco existente.

## 4. Rust e Tauri

O backend Rust não é o principal alvo de remoção.
Há partes boas que devem ser preservadas:

- sanitização de SQL
- guard rails de acesso ao banco
- comandos Tauri que ainda têm uso real

O ganho está mais em:

- revisar comandos não expostos
- alinhar documentação com o número real de comandos
- manter Rust como camada de proteção e ponte, não como lugar de duplicação de regra

### Propostas

1. Atualizar a contagem real de comandos Tauri a partir do `generate_handler!`.
2. Montar matriz `comando / invocado no frontend / usado internamente / planejado / candidato a remoção`.
3. Preservar comandos ligados a segurança, sessão, SQL guard, criptografia, arquivos confinados e LAN.
4. Remover apenas comandos sem consumidor, sem uso interno e sem justificativa operacional documentada.
5. Atualizar `desktop/docs/BACKEND_NAO_EXPOSTO.md` depois da matriz, não antes.

## 5. Itens da raiz do repositório

Alguns artefatos na raiz estão fora do fluxo principal do app, mas precisam de validação antes de remoção:

- `src/`
- `server.js`
- `app/login/page.tsx`
- `default/vitest.config.js`
- `meu-supabase-mcp/`

Esses itens devem ser tratados como:

- órfãos do build principal, quando aplicável
- não como lixo presumido

### Critério de decisão

Só remover se houver:

- confirmação de ausência no build
- confirmação de ausência de importação
- confirmação de ausência de uso operacional

### Propostas

1. Criar inventário para cada item com `dono`, `entrypoint`, `script`, `dependências` e `uso operacional conhecido`.
2. Marcar `server.js` como entrypoint lateral Express até prova contrária.
3. Marcar `meu-supabase-mcp/` como ferramenta lateral, não como código morto.
4. Validar `src/`, `app/login/page.tsx` e `default/vitest.config.js` contra imports, scripts e histórico antes de remoção.
5. Se a decisão for manter, mover ou documentar o propósito; se for remover, fazer em PR separado.

## 6. Ordem sugerida de trabalho

### Fase 1

Atualizar documentação e métricas:

- números de comandos Tauri
- estado real do sync
- inventário dos artefatos da raiz

### Fase 2

Terminar a unificação do sync:

- evento canônico no core
- remover espelhos locais quando possível
- manter handlers específicos de plataforma apenas onde necessário

### Fase 3

Reduzir boilerplate:

- wrappers triviais
- helpers SQLite comuns
- modularização do container

### Fase 4

Limpeza de bootstrap e docs:

- `ensure-columns.ts`
- `CLAUDE.md`
- `BACKEND_NAO_EXPOSTO.md`

## Conclusão

O backend tem espaço real para simplificação sem quebra de paradigma.
A prioridade técnica não é remover volume por si só, e sim:

- reduzir drift entre runtimes
- concentrar contratos em `packages/core`
- eliminar delegações vazias
- tornar o bootstrap e a documentação coerentes com o código atual

