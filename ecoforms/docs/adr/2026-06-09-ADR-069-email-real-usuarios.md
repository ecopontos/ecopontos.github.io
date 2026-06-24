# ADR-069 ÔÇö Email real no cadastro de usu├írios


> **Renumerado** de ADR-057 para ADR-069 em 2026-06-18 (triagem de ADRs — série `desktop/docs/adr/` consolidada em `docs/adr/`).


**Status:** Decidido  
**Data:** 2026-06-09  
**Autor:** Marcelo Luiz  
**Branch:** gaps-90-92-93-fix  
**Contexto externo:** US-02 ÔÇö sess├úo Supabase em paralelo usa email sint├®tico `{username}@ecoforms.local` como placeholder.

---

## Contexto

### O que existe hoje

US-02 (Sess├úo Supabase em paralelo) implementa auto-provisionamento no Supabase Auth durante o login:

```typescript
// syncSupabaseAuth ÔÇö fluxo simplificado
await supabase.auth.signInWithPassword({
    email: `${username}@ecoforms.local`,   // ÔåÉ sint├®tico, placeholder
    password,
});
```

Se o usu├írio n├úo existe no Supabase Auth:
```typescript
await supabase.auth.signUp({
    email: `${username}@ecoforms.local`,
    password,
});
```

O dom├¡nio `ecoforms.local` n├úo ├® rote├ível ÔÇö emails de verifica├º├úo, recupera├º├úo de senha e notifica├º├Áes do Supabase Auth nunca chegam ao usu├írio.

### Tabela `usuarios` no SQLite

O schema atual **n├úo possui coluna `email`**:

```sql
CREATE TABLE usuarios (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    perfil TEXT NOT NULL DEFAULT 'campo',
    password_hash TEXT,
    ...
);
```

A coluna `username` ├® o identificador ├║nico. O email ├® derivado dela (`{username}@ecoforms.local`) no momento do sync Supabase, nunca persistido.

### Problemas

1. **Recupera├º├úo de senha imposs├¡vel** ÔÇö Supabase Auth envia link para `@ecoforms.local` (n├úo rote├ível)
2. **Verifica├º├úo de email bloqueada** ÔÇö `auth.users.email_confirmed_at` nunca ├® populado
3. **Notifica├º├Áes do Supabase n├úo chegam** ÔÇö `auth.hook.send_email` n├úo tem destinat├írio real
4. **LGPD** ÔÇö O email sint├®tico n├úo identifica o usu├írio real para fins de exclus├úo/portabilidade (ADR-021)

---

## Decis├úo

### Adicionar coluna `email` ├á tabela `usuarios`

```sql
ALTER TABLE usuarios ADD COLUMN email TEXT;
```

**Regra de neg├│cio:**
- `email` ├® **opcional** ÔÇö usu├írios legados continuam sem email
- Se `email` preenchido, `syncSupabaseAuth` usa-o no lugar do sint├®tico
- Se `email` ausente, mant├®m fallback `{username}@ecoforms.local` por compatibilidade
- `email` ├® ├║nico por usu├írio (validado em UI, n├úo em constraint para permitir NULLs m├║ltiplos)

### Fluxo de provisionamento Supabase Auth

```
login(usuario)
  ÔåÆ se usuario.email preenchido:
      signInWithPassword({ email: usuario.email, password })
  ÔåÆ sen├úo:
      signInWithPassword({ email: '{username}@ecoforms.local', password })

  ÔåÆ se erro "user not found" E usuario.email preenchido:
      signUp({ email: usuario.email, password })
  ÔåÆ sen├úo se erro "user not found":
      signUp({ email: '{username}@ecoforms.local', password })
      // usu├írio legado ÔÇö permanece com email sint├®tico
```

### Migra├º├úo de dados

**N├úo autom├ítica.** O administrador edita cada usu├írio e preenche o campo `email` via painel de administra├º├úo (US-07 j├í implementado). A migra├º├úo em lote n├úo ├® vi├ível porque:
- N├úo h├í fonte externa de emails (sem LDAP, sem integra├º├úo SSO)
- Emails devem ser fornecidos pelos pr├│prios usu├írios (consentimento LGPD)
- Erros de migra├º├úo em lote produzem emails inv├ílidos no Supabase Auth (dif├¡ceis de reverter)

### Painel de administra├º├úo

US-07 (`AdminUserPanel`) ganha campo `email` no formul├írio de cria├º├úo/edi├º├úo:

```
ÔöîÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÉ
Ôöé  Criar / Editar Usu├írio             Ôöé
Ôöé                                     Ôöé
Ôöé  Username:  [________________]      Ôöé
Ôöé  Email:     [________________]  ­ƒôº  Ôöé  ÔåÉ NOVO
Ôöé  Perfil:    [admin Ôû¥]              Ôöé
Ôöé  Senha:     [________________]      Ôöé
Ôöé                                     Ôöé
Ôöé  Ôä╣´©Å Email opcional. Se preenchido,  Ôöé
Ôöé  permite recupera├º├úo de senha via   Ôöé
Ôöé  Supabase.                          Ôöé
Ôöé                                     Ôöé
Ôöé  [Salvar]  [Cancelar]              Ôöé
ÔööÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÿ
```

---

## O que N├âO faz parte deste ADR

- **Verifica├º├úo de email no Supabase** ÔÇö O email sint├®tico continua sem verifica├º├úo. Quando email real for preenchido, o Supabase envia link de confirma├º├úo automaticamente. O usu├írio confirma clicando no link.
- **Single Sign-On (SSO)** ÔÇö Sem provedor externo. Login ├® local (bcrypt no SQLite) + Supabase Auth em paralelo.
- **Migra├º├úo for├ºada** ÔÇö Nenhum usu├írio ├® obrigado a fornecer email. O sistema continua funcional com email sint├®tico.
- **Phone auth** ÔÇö Alternativa considerada e descartada: complexidade de SMS gateway + custo operacional. Email ├® suficiente.

---

## Implementa├º├úo

| Fase | Arquivo | Mudan├ºa |
|---|---|---|
| 1 | `ensure-columns.ts` | Adicionar `ALTER TABLE usuarios ADD COLUMN email TEXT` |
| 2 | `desktop/src/domain/user/User.ts` | Campo `email?: string` na entidade |
| 3 | `desktop/src/interface/components/admin/UserForm.tsx` | Campo email no formul├írio |
| 4 | `mobile_standalone/www/js/auth-manager.js` | `syncSupabaseAuth` usa `user.email` se dispon├¡vel |
| 5 | `desktop/src/application/auth/SyncSupabaseAuthUseCase.ts` | Idem para desktop |

---

## Rastreabilidade

| User Story | Impacto |
|---|---|
| US-02 (Sess├úo Supabase) | `syncSupabaseAuth` passa a usar email real quando dispon├¡vel |
| US-07 (Admin provisiona) | Formul├írio de usu├írio ganha campo email |
| ADR-021 (LGPD) | Email real permite contato para exclus├úo/portabilidade |
