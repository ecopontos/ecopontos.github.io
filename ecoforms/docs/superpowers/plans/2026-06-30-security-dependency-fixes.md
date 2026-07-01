## Status Update 2026-07-01

- npm audit --json --workspaces=false zerado em ecoforms/desktop e ecoforms/mobile.
- cargo update --manifest-path ecoforms/desktop/src-tauri/Cargo.toml aplicado com cargo check concluido em ecoforms/desktop/src-tauri.
- Os alertas do GitHub Dependabot so vao fechar depois do push e da reindexacao dos lockfiles pelo GitHub.
- Residuo tecnico atual: a cadeia Linux de gtk 0.18.x e webkit2gtk 2.0.x ainda puxa glib 0.18.5; se o alerta glib permanecer no GitHub apos o push, isso indica limitacao upstream do stack Tauri no Linux, nao omissao no manifest da aplicacao.

# Security Dependency Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolver as vulnerabilidades de dependências abertas no projeto desktop, removendo pacotes obsoletos do package-lock e adicionando overrides onde necessário.

**Architecture:** O package-lock.json contém `jspdf` e `jspdf-autotable` como resíduos (não estão no package.json); removê-los elimina também a cadeia `dompurify`. Os demais pacotes vulneráveis são corrigidos via npm `overrides` no package.json. Após os ajustes, `npm audit` confirma o estado final.

**Tech Stack:** Node.js / npm, package.json overrides

## Global Constraints

- Não remover funcionalidade — apenas atualizar versões de segurança
- Manter `exceljs` como dependência direta (usado para exportação Excel)
- Não alterar código TypeScript/Rust nesta task — somente manifests de dependência
- Todas as mudanças no branch `codex/security-audit-fixes`

---

### Task 1: Remover jspdf/jspdf-autotable residuais e limpar package-lock

**Files:**
- Modify: `ecoforms/desktop/package-lock.json` (via npm install)

**Interfaces:**
- Produz: package-lock.json sem jspdf, jspdf-autotable, dompurify

- [ ] **Step 1: Confirmar que jspdf NÃO está no package.json**

```bash
grep "jspdf\|jspdf-autotable" ecoforms/desktop/package.json
```
Esperado: nenhuma saída (confirmando que são resíduos do lock)

- [ ] **Step 2: Rodar npm install para sincronizar lock com package.json**

```bash
cd ecoforms/desktop && npm install --ignore-scripts 2>&1 | tail -5
```
Esperado: updated X packages, ou similar sem erros críticos

- [ ] **Step 3: Verificar que jspdf foi removido do lock**

```bash
grep '"jspdf"' ecoforms/desktop/package-lock.json | head -5
```
Esperado: nenhuma saída, ou apenas referências dentro de node_modules de outros pacotes

---

### Task 2: Adicionar overrides de segurança no package.json

**Files:**
- Modify: `ecoforms/desktop/package.json` (seção `overrides`)

**Interfaces:**
- Consome: package.json atual com overrides existentes (`next/postcss`, `exceljs/uuid`, `socks/ip-address`)
- Produz: package.json com overrides adicionais para `brace-expansion` e `ws`

- [ ] **Step 1: Adicionar overrides ao package.json**

Na seção `"overrides"` do `ecoforms/desktop/package.json`, adicionar:

```json
"overrides": {
  "next": { "postcss": "^8.5.10" },
  "exceljs": { "uuid": "^11.1.1" },
  "socks": { "ip-address": "^10.2.0" },
  "brace-expansion": "^2.0.1",
  "ws": "^8.18.2"
}
```

- [ ] **Step 2: Rodar npm install para aplicar overrides**

```bash
cd ecoforms/desktop && npm install --ignore-scripts 2>&1 | tail -5
```

- [ ] **Step 3: Verificar versões instaladas**

```bash
grep -A2 '"node_modules/brace-expansion"' ecoforms/desktop/package-lock.json | head -4
grep -A2 '"node_modules/ws"' ecoforms/desktop/package-lock.json | head -4
```
Esperado: brace-expansion >= 2.0.1, ws >= 8.18.2

---

### Task 3: Rodar npm audit e avaliar estado final

**Files:**
- Leitura: output do npm audit

- [ ] **Step 1: Rodar npm audit**

```bash
cd ecoforms/desktop && npm audit --audit-level=moderate 2>&1 | tail -30
```

- [ ] **Step 2: Avaliar vulnerabilidades restantes**

Vulnerabilidades esperadas que NÃO têm fix disponível (aceitar ou documentar):
- `tmp` via exceljs — risco baixo (prefix/postfix controlados internamente pelo exceljs)
- Alertas para `next` já na versão 16.2.4 (última disponível)
- Alertas dev-only: `vitest`, `esbuild`, `@babel/core`

---

### Task 4: Commit das mudanças

- [ ] **Step 1: Commit**

```bash
git add ecoforms/desktop/package.json ecoforms/desktop/package-lock.json
git commit -m "fix: remove stale jspdf deps and add security overrides for brace-expansion and ws"
```
