# ADR-076 — Fronteira criptografica: LAN local validada e envelope remoto cifrado

- **Status:** Proposto
- **Data:** 2026-06-19
- **Substitui parcialmente:** [ADR-074](./ADR-074-cofre-de-chaves-e-confinamento-fs.md) e [ADR-075](./ADR-075-sessao-autenticada-e-ingestao-confiavel.md) no escopo de criptografia aplicada ao sync LAN.
- **Relacionado:** Auditoria `docs/security-audit-2026-06-19.md` (S1, S2, S3, S4), ADR-074, ADR-075.

## Contexto

Os ADRs 074 e 075 assumiam que a robustez do sync local deveria vir de criptografia
ativa no share LAN: chave de sync, decrypt/verificacao de snapshots, HMAC e,
em medio prazo, assinatura por dispositivo.

Essa premissa mistura duas fronteiras diferentes:

1. **LAN offline controlada.** O share e os dispositivos estao dentro de um ambiente
   operacional administrado, sem transito web por padrao.
2. **Arquivo remoto/web.** Um arquivo publicado fora da rede local cruza uma fronteira
   nao confiavel: armazenamento externo, transporte externo, retencao por terceiros
   ou exposicao acidental.

Para a LAN offline, cifrar todos os snapshots pode aumentar complexidade sem reduzir
proporcionalmente o risco dominante. O risco principal no share local e integridade
operacional: path escape, escrita indevida, payload invalido e campos privilegiados
vindos da rede.

Para arquivo remoto/web, o risco muda: confidencialidade e integridade passam a ser
fronteira primaria. Nesse caso a criptografia deve existir no envelope especifico que
sai do dominio local.

## Decisao

Adotar uma politica por fronteira:

### D1 — LAN offline: dados legiveis, mas confinados e validados

Snapshots LAN continuam podendo ser JSON legivel enquanto o sistema operar apenas em
rede local controlada.

Controles obrigatorios para essa via:

- comandos de filesystem confinados a base-dir aprovado;
- sessao real e permissao backend para comandos sensiveis;
- validacao de schema antes de ingerir snapshots;
- lista branca de campos por dominio;
- nunca aceitar `perfil`, `hash_senha`, `sal_sync`, permissoes, hierarquia ou campos
  de autorizacao vindos do share;
- ACL operacional no share LAN continua sendo parte do modelo de seguranca.

### D2 — Remoto/web: envelope cifrado e autenticado

Quando um snapshot, evento ou export sair da LAN para arquivo remoto/web, ele deve ser
encapsulado em um envelope criptografico especifico.

Envelope minimo:

- `version`;
- `algorithm`;
- `key_id`;
- `created_at`;
- `source_device`;
- `content_type`;
- `payload_enc`;
- metadados nao sensiveis necessarios para roteamento.

O payload deve ser canonicalizado e validado antes da cifragem. O algoritmo deve ser
AEAD, como AES-GCM, para prover sigilo e integridade no mesmo envelope.

### D3 — Chaves: sem cofre local enquanto nao houver envelope remoto

Enquanto nao houver export/sync remoto cifrado, ficam pausadas as entregas de cofre
de chave, `seal_key`/`unseal_key`, HMAC de envelope local e assinatura por dispositivo.

Se o envelope remoto for implementado, a chave nao pode ser persistida em claro. A
decisao entre rederivar por login, keyring do SO ou chave organizacional externa deve
ser feita no plano especifico do envelope remoto.

## Plano de execucao

| Fase | Entrega | Estado | Aceitacao |
|------|---------|--------|-----------|
| 076.1 | Pausar itens criptograficos locais nos ADRs 074/075 | Ativo | ADRs indicam claramente o que fica pausado |
| 076.2 | Manter LAN com schema + allowlist + FS guard + sessao/RBAC | Ativo | snapshot invalido ou privilegiado nao e ingerido |
| 076.3 | Definir formato do envelope remoto | Futuro | spec de envelope com versionamento e key_id |
| 076.4 | Implementar cifragem AEAD apenas na saida remoto/web | Futuro | arquivo remoto sem chave nao revela payload e adulteracao falha |

## Consequencias

**Positivas:**
- reduz engenharia criptografica no caminho LAN offline;
- concentra criptografia onde a fronteira realmente muda;
- mantem controles fortes contra alteracao indevida de dados locais;
- evita dependencia prematura de keyring, Stronghold, HMAC e assinatura por device.

**Negativas / trade-offs:**
- dados no share LAN continuam legiveis por quem tiver acesso ao share;
- a seguranca da LAN depende de ACL, segmentacao local e controles de escrita;
- se a premissa de LAN controlada deixar de ser verdadeira, esta ADR deve ser revista.

## Itens pausados por esta ADR

- ADR-074: cofre do SO, `seal_key`/`unseal_key`, remocao/migracao motivada por chave
  AES local persistida.
- ADR-075: decrypt/verify de snapshot LAN, checksum->HMAC para sync local, assinatura
  por dispositivo no sync local.

## Testes de regressao

- [ ] Snapshot LAN com `perfil`, `hash_senha`, `sal_sync` ou permissoes e rejeitado ou tem esses campos ignorados.
- [ ] Snapshot LAN invalido por schema nao e ingerido.
- [ ] Comando FS fora do base-dir aprovado falha.
- [ ] Arquivo remoto/web cifrado nao revela payload sem chave.
- [ ] Alteracao em `payload_enc` de arquivo remoto/web falha na abertura do envelope.
