# ADR-037: Controle de Acesso por Turno — Tabela `escalas` e Auditoria de Sessão

**Data:** 2026-05-27  
**Status:**Implementado**
**Autores:** Equipe EcoForms

---

## Contexto

A chefia decidiu disponibilizar o app mobile para funcionários que preferem o celular pessoal ao papel. Isso introduz dois requisitos que não existiam quando o dispositivo era dedicado:

1. **Restrição de horário**: o app deve funcionar apenas durante o turno do funcionário — o ecoponto não pode permanecer "aberto" fora do expediente, e o uso do app fora do horário cria ambiguidade de jornada (CLT).
2. **Auditoria de permanência**: a chefia precisa de registro auditável de logins e sessões ativas fora do turno, tanto para controle interno quanto para conformidade com LGPD (processamento de dados pessoais do dispositivo fora do expediente).

### Regime de trabalho

Os operadores de ecoponto trabalham em regime **12×36**: 12 horas de presença, 36 horas de folga, ciclo de 48 horas. O tempo efetivo de trabalho por turno é **7h19m (439 minutos)**, com tolerância de **±10 minutos** para login e encerramento de sessão.

### Decisão de granularidade

A escala é armazenada em tabela dedicada (`escalas`) com FK em `usuarios`, não como JSON inline por usuário. Isso permite:

- Múltiplos usuários compartilhando a mesma escala
- Atualização centralizada de horário sem tocar em cada usuário
- Rastreabilidade da escala ativa no momento de cada evento de auditoria

---

## Decisão

**A sessão do app é vinculada ao turno do funcionário: o login é bloqueado fora da janela de turno, a sessão expira automaticamente ao fim do turno, e cada evento de acesso é registrado em `log_acesso_turno` e sincronizado com o desktop.**

---

## Schema

### Tabela `escalas`

```sql
CREATE TABLE escalas (
    id                   TEXT PRIMARY KEY,
    nome                 TEXT NOT NULL,       -- "12x36 Turno A", "12x36 Turno B"
    tipo                 TEXT NOT NULL,       -- "12x36"
    referencia_inicio    TEXT NOT NULL,       -- ISO datetime âncora do ciclo (ex: "2026-05-27T07:00")
    duracao_minutos      INTEGER NOT NULL,    -- 439 (7h19m)
    tolerancia_minutos   INTEGER DEFAULT 10,
    ciclo_horas          INTEGER NOT NULL,    -- 48 (12+36)
    criado_em            TEXT DEFAULT (datetime('now')),
    atualizado_em        TEXT DEFAULT (datetime('now'))
);
```

A `referencia_inicio` é uma âncora: qualquer datetime que seja o início de um turno real do funcionário. O sistema calcula todos os turnos futuros (e passados) por aritmética modular sobre o ciclo de 48h.

### ALTER `usuarios`

```sql
ALTER TABLE usuarios ADD COLUMN escala_id TEXT REFERENCES escalas(id);
```

Usuários sem `escala_id` (gerentes, admin) não têm restrição de horário.

### Tabela `log_acesso_turno`

```sql
CREATE TABLE log_acesso_turno (
    id                      TEXT PRIMARY KEY,
    usuario_id              TEXT NOT NULL,
    escala_id               TEXT,
    tipo                    TEXT NOT NULL,
    -- 'login_ok' | 'login_negado' | 'sessao_expirada' | 'logout_manual'
    timestamp               TEXT NOT NULL,
    dentro_turno            INTEGER NOT NULL,  -- 0 | 1
    turno_inicio_calculado  TEXT,
    turno_fim_calculado     TEXT,
    dispositivo_id          TEXT
);
```

Sincroniza ao desktop via evento `acesso.turno.log` no pipeline existente.

---

## Boot JSON — escala inline por operador

O `ecoforms_boot.json` inclui o objeto `escala` desnormalizado em cada usuário operador para uso offline pelo `auth-manager.js`. O `escala_id` referencia a tabela no desktop; o objeto inline evita query adicional no login.

```json
{
  "username": "ecoponto3",
  "ecoponto_id": "ecoponto_3",
  "escala": {
    "id": "<escala_id>",
    "tipo": "12x36",
    "referencia_inicio": "2026-05-27T07:00",
    "duracao_minutos": 439,
    "tolerancia_minutos": 10,
    "ciclo_horas": 48
  }
}
```

A `referencia_inicio` deve ser configurada pelo admin para refletir o turno real de cada funcionário antes do go-live. O placeholder `2026-05-27T07:00` é a data de provisionamento inicial.

---

## Lógica de turno em `auth-manager.js`

```js
_isTurnoAtivo(escala, agora = new Date()) {
    const ref = new Date(escala.referencia_inicio);
    const cicloMs = escala.ciclo_horas * 3_600_000;
    const toleranciaMs = escala.tolerancia_minutos * 60_000;
    const duracaoMs = escala.duracao_minutos * 60_000;
    // posição dentro do ciclo atual (sempre positivo)
    const pos = ((agora - ref) % cicloMs + cicloMs) % cicloMs;
    return pos <= (duracaoMs + toleranciaMs);
}

_calcularFimTurno(escala, agora = new Date()) {
    const ref = new Date(escala.referencia_inicio);
    const cicloMs = escala.ciclo_horas * 3_600_000;
    const toleranciaMs = escala.tolerancia_minutos * 60_000;
    const duracaoMs = escala.duracao_minutos * 60_000;
    const pos = ((agora - ref) % cicloMs + cicloMs) % cicloMs;
    const restanteMs = (duracaoMs + toleranciaMs) - pos;
    return new Date(agora.getTime() + restanteMs);
}
```

### Fluxo de login

```
loginLocal(username, password)
  → verifica senha (comportamento atual)
  → se user.escala:
      se !_isTurnoAtivo(user.escala):
          _registrarLogAcesso(user.id, 'login_negado', false, user.escala)
          return null   ← login bloqueado
      _registrarLogAcesso(user.id, 'login_ok', true, user.escala)
  → retorna user com escala e ecoponto_id incluídos

saveSession(user)
  → se user.escala:
      expiresAt = _calcularFimTurno(user.escala)   ← substitui sessionTimeoutHours
  → senão: comportamento atual (admin/gerente sem restrição)

loadSession()
  → ao detectar expiração com user.escala presente:
      _registrarLogAcesso(user.id, 'sessao_expirada', false, user.escala)
      → logout()
```

### Log de acesso

`_registrarLogAcesso` é chamado em quatro situações:

| Gatilho | Tipo | `dentro_turno` |
|---------|------|----------------|
| Login bloqueado por turno | `login_negado` | `false` |
| Login bem-sucedido | `login_ok` | `true` |
| Sessão expirada (fim do turno) | `sessao_expirada` | `false` |
| Logout manual | `logout_manual` | conforme turno atual |

Os eventos são gravados em `localStorage['acesso_turno_log_queue']` como array JSON. Se o `SyncAdapter` estiver ativo, o evento `acesso.turno.log` é publicado imediatamente; caso contrário, fica na fila para sync posterior.

```js
_registrarLogAcesso(usuarioId, tipo, dentroTurno, escala) {
    const log = {
        id, usuario_id, escala_id, tipo, timestamp,
        dentro_turno, turno_inicio_calculado, turno_fim_calculado, dispositivo_id
    };
    // empilha em localStorage + publica via SyncAdapter se ativo
}
```

No desktop, o `HandlerRegistry` ainda precisa processar o evento `acesso.turno.log` e persistir em `log_acesso_turno`.

---

## Alternativas consideradas

### Restrição apenas no servidor (Supabase Storage rejeita uploads fora do turno)

Mais robusto contra bypass, mas:
- Requer JWT claim com informação de turno (infra adicional)
- O app continua acessível — apenas o sync falha; a UX é confusa
- Não registra tentativas de login (o bloqueio é silencioso)

Mantida como evolução futura para hardening.

### JSON inline sem tabela `escalas`

Mais simples, mas escala vira dado duplicado em cada usuário. Mudança de horário requer re-provisionamento individual de todos os funcionários do turno.

### Sessão com `sessionTimeoutHours` configurável (abordagem atual)

O valor atual é `999999` (nunca expira). Seria possível configurar para 8h, mas não é vinculado ao ciclo 12×36 — não sabe distinguir turno ativo de inativo para a mesma hora em dias diferentes.

---

## Consequências

### Positivas

- App inacessível fora do turno — sem ambiguidade de jornada
- Auditoria completa: login negado, sessão expirada, logout manual
- Um registro de escala cobre N funcionários do mesmo turno
- Proteção do funcionário: LGPD — dados pessoais não processados fora do expediente

### Negativas / Riscos

- **`referencia_inicio` incorreta**: se o admin provisionar com a data errada, todos os logins do turno falham. Mitigado por validação no painel admin antes do go-live.
- **Troca de turno não refletida**: se o funcionário muda de turno (troca com colega), a escala precisa ser atualizada no desktop e re-sincronizada. Sem atualização, o login é bloqueado.
- **Sem override de emergência**: conforme requisito — o ecoponto não pode permanecer aberto fora do horário. Não há mecanismo de exceção.

### Sem mudança

- `FormSyncService`, `InboundService` — intactos
- Lógica de perfis e setores — intacta
- Formulários e boot JSON estrutural — intactos (apenas campos adicionados)

---

## Plano de implementação

| # | Arquivo | Mudança | Status |
|---|---|---|---|
| 1 | `desktop/scripts/ensure-columns.ts` | Criar `escalas`, `log_acesso_turno`, `ALTER usuarios ADD escala_id` | Desktop — pendente |
| 2 | `mobile_standalone/ecoforms_boot.json` | Adicionar `escala` nos 9 operadores; `ecoponto_id` no `boot` | ✅ Implementado |
| 3 | `mobile_standalone/www/js/auth-manager.js` | `_isTurnoAtivo`, `_calcularFimTurno`, `_registrarLogAcesso`, handler de sessão expirada | ✅ Implementado |

---

## Referências

- `ADR-033` — `ecoponto_id` no perfil do usuário (mesmo mecanismo de campo inline no boot)
- `mobile_standalone/www/js/auth-manager.js` — `loginLocal()`, `saveSession()`, `loadSession()`
- `desktop/scripts/ensure-columns.ts` — migrações aditivas
- `desktop/src/infrastructure/sync/HandlerRegistry.ts` — handler para `acesso.turno.log`
