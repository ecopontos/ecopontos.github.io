# ADR-075 — Sessão ligada ao login e ingestão de sync confiável

- **Status:** Proposto
- **Data:** 2026-06-19
- **Depende de:** [ADR-074](./ADR-074-cofre-de-chaves-e-confinamento-fs.md) — **não iniciar antes de 074 estar em verde.** A autorização baseada em sessão (aqui) só tem valor depois que o FS está confinado e a chave de sync não está em claro (lá). Caso contrário, um atacante com leitura arbitrária + chave org contorna qualquer checagem de sessão.
- **Relacionado:** Auditoria `docs/security-audit-2026-06-19.md` (C2, A1, A3, S2, S3, S4).
- **Atualizado por:** [ADR-076](./ADR-076-fronteira-cripto-lan-e-envelope-remoto.md), que pausa cifragem/HMAC/assinatura obrigatorios no sync LAN e reserva criptografia para envelope remoto/web.

## Contexto

Com a fronteira local fechada por ADR-074, restam três furos de **autenticação/autorização e confiança de dados** que se encadeiam:

1. **Sessão desacoplada da senha (C2).** `db_login` verifica a senha mas só devolve o resultado ao frontend; `set_session(user_id, perfil)` cria a sessão sem prova de senha. Qualquer JS chama `set_session(<id_admin>, "admin")` → vira admin.
2. **RBAC não imposto na escrita genérica (A1).** `db_execute` só bloqueia mutação nas 6 tabelas sensíveis; qualquer outra tabela de negócio é gravável por qualquer sessão, sem checar `permissoes`.
3. **Ingestão LAN não confiável (S3).** `LanPullService` lê snapshots JSON **em claro** do share e faz UPSERT direto em `usuarios` (perfil!), `demandas`, `manifestacoes`, etc. — **sem schema e sem allowlist efetiva**. Pela ADR-076, JSON claro na LAN controlada e aceitavel; o problema ativo e aceitar payload/campos privilegiados sem validacao.

Além disso: o `checksum` keyless dá falsa sensação de anti-tampering (S4) e não há autenticação de remetente no sync (S2). Pela ADR-076, HMAC/assinatura ficam pausados no sync LAN e retornam apenas para envelope remoto/web ou se a premissa de LAN controlada mudar.

## Decisão

### D1 — Sessão criada **pelo** login, com token opaco (fecha C2)
- `db_login`, ao validar a senha, **cria a sessão diretamente** no `SessionState` e retorna um **token de sessão opaco** (random 32B) guardado no estado Rust.
- `set_session` deixa de aceitar identidade arbitrária do cliente: ou é removido, ou passa a exigir o token emitido por `db_login`.
- Comandos sensíveis continuam validando via `session.validate_against_db` (já existe).

### D2 — Autorização na escrita genérica (fecha A1)
- Em `db_execute`/`db_execute_batch`, além do guard de tabelas sensíveis, mapear **(tabela, operação) → permissão** e chamar `check_permission` (rbac.rs) para as tabelas de domínio.
- Tabela de mapeamento explícita (ex.: `demandas`→`data.edit_*`, `manifestacoes`→`ouvidoria.*`). Sem mapeamento ⇒ negar por padrão para mutação (fail-closed) ou exigir um command de domínio dedicado.
- Migrar gradualmente os fluxos de escrita para **commands de domínio** com permissão explícita (como `actions.rs`/`key_rotation.rs` já fazem), reduzindo a superfície do SQL genérico.

### D3 — Ingestão LAN validada, sem cripto obrigatoria local (fecha S3 local)
- `LanPullService` passa a, por snapshot:
  - **validar schema com zod** (`validatePayload`/novo schema de snapshot) — mesma porta que `InboundService._dispatch` já usa;
  - **lista branca de campos**: nunca aceitar `perfil` ou colunas de autorização vindas de snapshot; `usuarios` via LAN só atualiza campos não-privilegiados (ou é proibido).
- **Pausado por ADR-076:** decrypt/verify, HMAC e assinatura por dispositivo no sync LAN. Esses controles passam a pertencer ao envelope remoto/web quando houver saida para infraestrutura nao local.
- **S4 ativo no LAN:** remover linguagem de anti-tampering do checksum keyless ou renomear o campo para deteccao de corrupcao. Nao vender SHA-256 sem chave como autenticidade.

### D4 — Sessão/permissão em leitura e e-mail (fecha A3) e bug de seq (S5)
- `db_query` passa a exigir sessão (hoje recebe `_session` e ignora).
- `send_email`/`test_email_connection`/`migrate_smtp_password` exigem `check_permission`.
- Corrigir `InboundService._updateLocalSeq` (SET duplicado no `ON CONFLICT`).

## Plano de execução (fases)

| Fase | Entrega | Arquivos | Aceitação |
|------|---------|----------|-----------|
| 075.1 | Token de sessão em `db_login`; travar `set_session` | `commands/auth.rs`, `session.rs`, `lib.rs`, `CryptoLayer`/login TS | impersonação via `set_session` direto → falha; login normal → ok |
| 075.2 | Mapa (tabela,op)→permissão em `db_execute`/batch | `database.rs`, `commands/rbac.rs` | `operador` não escreve em `demandas` sem `data.edit_*`; admin sim |
| 075.3 | `db_query` exige sessão; e-mail exige permissão | `database.rs`, `commands/email.rs` | comandos sem sessão/permissão → erro |
| 075.4 | `LanPull`: zod + lista branca de campos | `LanPullService.ts`, `payloadSchemas.ts` | snapshot invalido → rejeitado; `perfil` via LAN → ignorado |
| 075.5 | checksum keyless: renomear/ajustar mensagem; HMAC local pausado | `core/src/sync/EventEnvelope.ts`, `InboundService.ts`, `TransportService.ts` | nao tratar checksum sem chave como anti-tampering |
| 075.6 | Corrigir bug de seq (S5) | `InboundService.ts` | upsert de seq em conflito não falha |
| 075.7 | (pausado por ADR-076) assinatura por dispositivo (S2) | `EventEnvelope`, transporte, distribuição de chaves | retomar apenas para envelope remoto/web ou LAN nao controlada |

## Consequências

**Positivas:** a sessão passa a significar autenticação real; RBAC vira fronteira de dados, não convenção de UI; a via LAN ganha a mesma robustez da via de eventos; fim do anti-tampering ilusório.
**Negativas / trade-offs:**
- O mapa (tabela,op)→permissão exige inventariar os fluxos de escrita atuais — esforço de levantamento; risco de quebrar telas se algum fluxo não tiver permissão mapeada (mitigar com fase de log-only antes de fail-closed).
- HMAC/assinatura mudam o formato do envelope → **pausado por ADR-076** ate haver envelope remoto/web.
- Snapshots LAN cifrados exigem que o **produtor** (quem publica no share) também adote ADR-074 — **pausado por ADR-076**.

## Dependência explícita com ADR-074
- 075.1 (token) depende principalmente de FS confinado e sessao validada. A dependencia de chave local foi reduzida pela ADR-076.
- 075.4 ativo depende de schema/allowlist, nao de decrypt/HMAC local.
- 075.5/075.7 criptograficos estao pausados por ADR-076.
- Ordem recomendada: **074.1→074.3 → 075.1→075.6**. Retomar criptografia apenas no plano do envelope remoto/web.

## Teste de regressão
- [ ] `set_session` não escala privilégio sem login.
- [ ] Escrita em tabela de domínio sem permissão → negada.
- [ ] Snapshot LAN sem zod válido → não ingerido; `perfil` nunca vem de snapshot.
- [ ] Envelope remoto/web adulterado sem a chave → rejeitado (ADR-076).
- [ ] `db_query`/e-mail sem sessão+permissão → erro.
