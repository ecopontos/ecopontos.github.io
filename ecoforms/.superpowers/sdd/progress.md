# Progress Ledger

BASE: 2b7e637

## Tasks

- [x] Task 1: Remover roteiro_terreno_override de CoordOrigem e lógica de derivação (commit b7e395d)
- [x] Task 2: Remover roteiro_terreno_override de COORD_ORIGEM_DOT_COLOR (commit 851b7d2)
- [x] Task 3: Remover roteiro_terreno_id e cliente_terreno_id de ItinerarioStop (commit 4ee0c84)
- [x] Task 4: Atualizar comentário de fallback (no-op — already correct)
- [x] Task 5: Atualizar testes de itinerário (commit 06b36d8)
- [x] Task 6: Atualizar testes de queries (commit aa85580)
- [x] Task 7: Validação final — typecheck ✅, eslint ✅, vitest 18/18 ✅

---

# Plano: roteiro_paradas ponto operacional (Fase 3 logistica)

PLAN: docs/superpowers/plans/2026-07-02-roteiro-paradas-ponto-operacional.md
BASE: d976ac6

## Tasks

- [x] Task 1: Schema - colunas de override por parada em roteiro_clientes (commit 8279bad, review clean)
- [x] Task 2: Repositorio - findClientesByRoteiro + updateParadaLocalizacao (commit 087d5b5, review approved - flagged \xe2\x9a\xa0 item resolved: columns already in ensure-columns.ts from Task 1)
- [x] Task 3: Query - prioridade de resolucao em ROTEIRO_CLIENTES_ITINERARIO (commit 8c669b4, review approved; minor note: terreno_nome fallback nao acompanha override so-de-ponto sem imovel_id, irrelevante pois UI sempre seta os dois juntos)
- [x] Task 4: deriveCoordOrigem - 2 novos valores de CoordOrigem (commits 5611a47, 15e4a5a fix; review approved apos fechar gap de cobertura de precedencia; minor: 4o teste redundante e doc-comment style drift nao corrigidos, aguardam review final)
- [x] Task 5: Hook updateParadaLocalizacao em useLogisticsMutations (commit bc4e653, review approved; note: tsc tem 1 erro conhecido em ItinerarioModal.tsx ate a Task 7 rodar - esperado)
- [x] Task 6: Componente ParadaLocalizacaoDialog (commit 6836a03, review approved, hooks signatures verified)
- [x] Task 7: Integrar dialogo em ItinerarioModal.tsx (commit 3bff1e1, review approved; commit 2e648ed style avulso incorporado por decisao heuristica - sem resposta do usuario)
- [x] Task 8: Integrar dialogo em RoteiroDetailPage.tsx (commit faccff9, review approved)
- [x] Task 9: Marcador de override no mapa (ItinerarioMap.tsx) (commit efe0f34, review approved)
- [x] Task 10: Verificacao final (typecheck 0 erros, lint 0 erros/4 warnings pre-existentes, 375/375 testes; fix c62d0c8 react-hooks/set-state-in-effect no ParadaLocalizacaoDialog; verificacao manual interativa via Tauri pendente - next dev nao tem ponte invoke)

## Review final de branch (MERGE_BASE 2552a9f..HEAD)

Ready to merge: With fixes -> fixes aplicados.
- Critical: linkClienteToImovel nao desmarcava outros vinculos principais -> FIXED (commit 59cfc68, teste de integracao SQLite real novo)
- Important: geocodeWithCache cacheava falha de rede -> FIXED (commit 9c62cab)
- Important: queries de resolucao geo nunca executadas em teste (so shape-check) -> PARCIALMENTE ENDERECADO pelo teste de integracao do fix Critical; recomendacao de suite mais ampla registrada para o usuario, nao implementada nesta rodada
- Minor (5 itens: IDs deterministicos cvinc-*, suggestImoveisForCliente carrega todos terrenos em JS, AGENDAMENTOS_MAP_POINTS_BY_SLOT duplicado em 2 lugares, comentario com caractere corrompido em geocoding.ts, import dinamico em geocodeCandidates) -> reportados ao usuario, nao corrigidos, ficam de backlog
