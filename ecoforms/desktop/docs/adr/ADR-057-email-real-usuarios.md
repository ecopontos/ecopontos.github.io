# ADR-057 — Email real no cadastro de usuários

**Status:** Decidido  
**Data:** 2026-06-09  
**Autor:** Marcelo Luiz  
**Branch:** gaps-90-92-93-fix  
**Contexto externo:** US-02 — sessão Supabase em paralelo usa email sintético `{username}@ecoforms.local` como placeholder.

---

## Contexto

### O que existe hoje

US-02 (Sessão Supabase em paralelo) implementa auto-provisionamento no Supabase Auth durante o login:

```typescript
// syncSupabaseAuth — fluxo simplificado
await supabase.auth.signInWithPassword({
    email: `${username}@ecoforms.local`,   // ← sintético, placeholder
    password,
});
```

Se o usuário não existe no Supabase Auth:
```typescript
await supabase.auth.signUp({
    email: `${username}@ecoforms.local`,
    password,
});
```

O domínio `ecoforms.local` não é roteável — emails de verificação, recuperação de senha e notificações do Supabase Auth nunca chegam ao usuário.

### Tabela `usuarios` no SQLite

O schema atual **não possui coluna `email`**:

```sql
CREATE TABLE usuarios (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    perfil TEXT NOT NULL DEFAULT 'campo',
    password_hash TEXT,
    ...
);
```

A coluna `username` é o identificador único. O email é derivado dela (`{username}@ecoforms.local`) no momento do sync Supabase, nunca persistido.

### Problemas

1. **Recuperação de senha impossível** — Supabase Auth envia link para `@ecoforms.local` (não roteável)
2. **Verificação de email bloqueada** — `auth.users.email_confirmed_at` nunca é populado
3. **Notificações do Supabase não chegam** — `auth.hook.send_email` não tem destinatário real
4. **LGPD** — O email sintético não identifica o usuário real para fins de exclusão/portabilidade (ADR-021)

---

## Decisão

### Adicionar coluna `email` à tabela `usuarios`

```sql
ALTER TABLE usuarios ADD COLUMN email TEXT;
```

**Regra de negócio:**
- `email` é **opcional** — usuários legados continuam sem email
- Se `email` preenchido, `syncSupabaseAuth` usa-o no lugar do sintético
- Se `email` ausente, mantém fallback `{username}@ecoforms.local` por compatibilidade
- `email` é único por usuário (validado em UI, não em constraint para permitir NULLs múltiplos)

### Fluxo de provisionamento Supabase Auth

```
login(usuario)
  → se usuario.email preenchido:
      signInWithPassword({ email: usuario.email, password })
  → senão:
      signInWithPassword({ email: '{username}@ecoforms.local', password })

  → se erro "user not found" E usuario.email preenchido:
      signUp({ email: usuario.email, password })
  → senão se erro "user not found":
      signUp({ email: '{username}@ecoforms.local', password })
      // usuário legado — permanece com email sintético
```

### Migração de dados

**Não automática.** O administrador edita cada usuário e preenche o campo `email` via painel de administração (US-07 já implementado). A migração em lote não é viável porque:
- Não há fonte externa de emails (sem LDAP, sem integração SSO)
- Emails devem ser fornecidos pelos próprios usuários (consentimento LGPD)
- Erros de migração em lote produzem emails inválidos no Supabase Auth (difíceis de reverter)

### Painel de administração

US-07 (`AdminUserPanel`) ganha campo `email` no formulário de criação/edição:

```
┌─────────────────────────────────────┐
│  Criar / Editar Usuário             │
│                                     │
│  Username:  [________________]      │
│  Email:     [________________]  📧  │  ← NOVO
│  Perfil:    [admin ▾]              │
│  Senha:     [________________]      │
│                                     │
│  ℹ️ Email opcional. Se preenchido,  │
│  permite recuperação de senha via   │
│  Supabase.                          │
│                                     │
│  [Salvar]  [Cancelar]              │
└─────────────────────────────────────┘
```

---

## O que NÃO faz parte deste ADR

- **Verificação de email no Supabase** — O email sintético continua sem verificação. Quando email real for preenchido, o Supabase envia link de confirmação automaticamente. O usuário confirma clicando no link.
- **Single Sign-On (SSO)** — Sem provedor externo. Login é local (bcrypt no SQLite) + Supabase Auth em paralelo.
- **Migração forçada** — Nenhum usuário é obrigado a fornecer email. O sistema continua funcional com email sintético.
- **Phone auth** — Alternativa considerada e descartada: complexidade de SMS gateway + custo operacional. Email é suficiente.

---

## Implementação

| Fase | Arquivo | Mudança |
|---|---|---|
| 1 | `ensure-columns.ts` | Adicionar `ALTER TABLE usuarios ADD COLUMN email TEXT` |
| 2 | `desktop/src/domain/user/User.ts` | Campo `email?: string` na entidade |
| 3 | `desktop/src/interface/components/admin/UserForm.tsx` | Campo email no formulário |
| 4 | `mobile_standalone/www/js/auth-manager.js` | `syncSupabaseAuth` usa `user.email` se disponível |
| 5 | `desktop/src/application/auth/SyncSupabaseAuthUseCase.ts` | Idem para desktop |

---

## Rastreabilidade

| User Story | Impacto |
|---|---|
| US-02 (Sessão Supabase) | `syncSupabaseAuth` passa a usar email real quando disponível |
| US-07 (Admin provisiona) | Formulário de usuário ganha campo email |
| ADR-021 (LGPD) | Email real permite contato para exclusão/portabilidade |
