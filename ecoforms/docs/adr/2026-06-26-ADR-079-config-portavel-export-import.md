# ADR-079 — Configuração Portátil: Export/Import de Bundle JSON

**Status:** Proposto
**Data:** 2026-06-26
**Relacionado:** ADR-010 (Module Registry), ADR-027 (LAN sync), ADR-064 (event-sourcing/mesh), ADR-074 (cofre de chaves)

---

## Contexto

Não há banco de dados central. Cada instância do app guarda localmente seu **plano de configuração** — os
registries de metadados: `tbl_module_registry`, `registro_visualizacoes`, `registro_decisoes`,
`instancias_widgets_usuario`, `permissoes_modulos`, `tbl_configuracoes_sistema`.

Queremos que essas definições possam **acompanhar o usuário ou o departamento** entre instâncias (onboarding de
uma nova máquina, padronização de um setor, backup), inclusive **offline**, sem depender do bucket de sync.

O sistema já modela as duas peças necessárias:
- um **contrato de eventos** (`EventEnvelope` v2, idempotência por checksum, `ConflictResolver` LWW+hash);
- um **eixo de roteamento** `routing_type: 'setor' | 'user'`.

## Decisão

Adotar um **bundle de configuração em JSON** como **transporte do mesmo pipeline de sync** — não um caminho de
escrita paralelo.

- **Export:** serializa os eventos (ou snapshot) do plano de config, escopados a um `user` ou `setor`, para um
  arquivo JSON.
- **Import:** faz *replay* desses eventos pelo pipeline inbound (`HandlerRegistry`), **nunca** escrevendo direto
  no SQLite.

Regra inegociável: **o import passa pelo contrato de eventos.** Isso reaproveita idempotência, conflito
determinístico (LWW+hash) e o roteamento setor/user, e evita reintroduzir "duas fontes de verdade".

### Forma do bundle

```json
{
  "kind": "ecoforms.config.bundle",
  "schema_version": 1,
  "scope": { "routing_type": "setor", "routing_id": "<slug-ou-uuid>" },
  "exported_at": "2026-06-26T...",
  "redacted": ["tbl_email_config.smtp_password"],
  "events": [ /* EventEnvelopes: module.publicado, visuais_modulos.*, instancias_widgets_usuario.*, ... */ ]
}
```

`events` são `EventEnvelope`s padrão → o import resume-se a `inbound.feed(bundle.events)`.

### Três requisitos deliberados

1. **Identidade portátil.** O bundle só é reusável entre instâncias se referenciar identidades estáveis
   (slugs, UUIDv7), não ids auto-incrementais. Config escopada a `setor` exige que "setor" tenha identidade
   portátil; caso contrário, o import precisa de uma etapa explícita de **remapeamento** de `routing_id`.
2. **Redação de segredos.** Campos sensíveis (`tbl_email_config`, chaves) devem ser **redigidos ou
   criptografados** no export — mesmo princípio do cleanup de export do CR-5/ADR-076. O campo `redacted` lista o
   que foi omitido.
3. **Versão.** `schema_version` permite que um bundle antigo importado num app mais novo degrade com elegância.

## Consequências

**Positivas**
- Funciona 100% offline (o arquivo É o transporte).
- Convergência garantida: importar é idempotente e reconciliável pelo `ConflictResolver`.
- Reusa o eixo setor/user já existente — "seguir o usuário vs. o departamento" sai de graça.
- Artefato legível/versionável: dá para revisar/diff antes de aplicar e usar como **template de departamento**.

**Negativas / custos**
- Exige disciplina de identidade portátil (migrar pontos que ainda usam id auto-incremental para slug/UUID).
- Precisa de uma política clara de redação de segredos (e de quem pode exportar — provável `perfil` mínimo).
- O replay precisa de handlers inbound para todo evento do plano de config (alguns registries ainda não têm
  handler — ver pendências de wire-up).

## Alternativas rejeitadas

- **Import escrevendo direto no SQLite (dump/restore de tabelas).** Mais simples, mas recria divergência que o
  sync não reconcilia (duas fontes de verdade) e ignora conflito/idempotência. Rejeitado.
- **Depender do bucket de sync para "carregar config".** Não atende o caso offline/sneakernet nem o de
  template explícito revisável.

## Escopo de implementação (esboço)

- `exportConfigBundle(scope)` e `importConfigBundle(json)` na camada de aplicação, reutilizando
  `UserSnapshotService`/`CrmSnapshotPublisher` (export) e `HandlerRegistry`/`InboundService` (import).
- UI no módulo de configurações: "Exportar configuração" / "Importar configuração" com seleção de escopo
  (este usuário / este setor) e prévia do que será aplicado.
