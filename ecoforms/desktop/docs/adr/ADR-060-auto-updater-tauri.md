# ADR-060 — Auto-Updater do Tauri Desktop

**Status:** Pendente de decisão  
**Data:** 2026-06-09  
**Autor:** Marcelo Luiz  
**Contexto externo:** Checklist de Encerramento Desktop (item #4) — `auto-updater` não configurado no `tauri.conf.json`.

---

## Contexto

### O que existe hoje

O `tauri.conf.json` do EcoSuite Desktop **não possui** o bloco `updater` configurado:

```json
{
  "productName": "EcoSuite Desktop",
  "version": "0.1.8",
  "bundle": {
    "active": true,
    "targets": ["nsis"]
  }
  // ❌ Sem bloco "updater"
}
```

Consequência: o Tauri **desabilita o auto-updater por padrão**. Usuários que instalaram versões anteriores não recebem notificações de novas versões e precisam baixar manualmente o instalador.

### Problema

| Cenário | Impacto |
|---------|---------|
| Correção crítica de bug (ex: sync quebrado) | Usuário continua com versão defeituosa até perceber manualmente |
| Nova feature importante | Adoção lenta — usuários não sabem que existe atualização |
| Vulnerabilidade de segurança | Janela de exposição prolongada |
| Suporte técnico | Dificuldade em reproduzir bugs — versões diferentes em campo |

### Restrições técnicas

- **Distribuição atual:** `.exe` via NSIS (Windows Installer)
- **Assinatura de código:** ❌ Não configurada — SmartScreen pode bloquear instalações
- **Servidor de updates:** ❌ Não existe endpoint público para `updater.json`
- **Chave de assinatura:** ❌ Não gerada (Tauri exige par de chaves Ed25519)

---

## Opções

### Opção A — Habilitar auto-updater com endpoint próprio

**Configuração:**

```json
{
  "bundle": {
    "windows": {
      "certificateThumbprint": "...",
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.digicert.com"
    }
  },
  "updater": {
    "active": true,
    "endpoints": [
      "https://ecoforms.example.com/api/updater/{{target}}/{{arch}}/{{current_version}}"
    ],
    "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ...",
    "dialog": true,
    "windows": {
      "installMode": "passive"
    }
  }
}
```

**Infraestrutura necessária:**

| Componente | Descrição | Esforço |
|------------|-----------|---------|
| Endpoint `/api/updater` | Retorna `updater.json` com versão mais recente + URL do instalador + assinatura | Médio |
| Geração de chaves Ed25519 | `tauri signer generate -w ~/.tauri/ecoforms.key` | Baixo |
| Assinatura de builds | Assinar `.exe` com chave privada antes de publicar | Médio |
| Storage público | Hospedar instaladores assinados (S3, Cloudflare R2, etc.) | Baixo |
| Assinatura de código Windows | Certificado digital (DV/OV) para evitar SmartScreen | Alto ($200-400/ano) |

**Prós:**
- ✅ Usuários recebem updates automaticamente
- ✅ Redução de suporte técnico (versões uniformes)
- ✅ Correções críticas chegam rápido
- ✅ Padrão da indústria (Tauri, Electron, etc.)

**Contras:**
- ❌ Custo de certificado digital Windows (~$300/ano)
- ❌ Infraestrutura de endpoint + storage
- ❌ Complexidade operacional (assinatura, publicação, rollback)
- ❌ SmartScreen ainda pode alertar se sem certificado

---

### Opção B — Desabilitar conscientemente (status quo)

**Configuração:**

```json
{
  "bundle": {
    "active": true,
    "targets": ["nsis"]
  }
  // updater desabilitado por omissão
}
```

**Documentação necessária:**

Criar `docs/DEPLOYMENT.md` explicando:
- Como baixar novas versões (link para release page)
- Como verificar versão atual (menu "Sobre")
- Processo manual de atualização

**Prós:**
- ✅ Zero custo de infraestrutura
- ✅ Zero complexidade operacional
- ✅ Simplicidade máxima

**Contras:**
- ❌ Usuários não recebem updates automaticamente
- ❌ Correções críticas dependem de ação manual
- ❌ Múltiplas versões em campo simultaneamente
- ❌ Suporte técnico mais difícil

---

### Opção C — Auto-updater simplificado (GitHub Releases)

**Configuração:**

```json
{
  "updater": {
    "active": true,
    "endpoints": [
      "https://github.com/ecoforms/desktop/releases/latest/download/updater.json"
    ],
    "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ...",
    "dialog": true
  }
}
```

**Infraestrutura necessária:**

| Componente | Descrição | Esforço |
|------------|-----------|---------|
| GitHub Releases | Publicar `.exe` + `updater.json` assinados | Baixo |
| Geração de chaves Ed25519 | `tauri signer generate` | Baixo |
| CI/CD | Assinar builds automaticamente | Médio |

**Prós:**
- ✅ Usuários recebem updates automaticamente
- ✅ Infraestrutura gratuita (GitHub)
- ✅ Sem custo de certificado digital
- ✅ Simplicidade operacional

**Contras:**
- ❌ SmartScreen pode bloquear (sem certificado Windows)
- ❌ Depende de disponibilidade do GitHub
- ❌ Menos controle sobre distribuição

---

## Recomendação

**Opção C — Auto-updater simplificado (GitHub Releases)**

### Justificativa

| Critério | Peso | Opção A | Opção B | Opção C |
|----------|------|---------|---------|---------|
| Custo inicial | 30% | 🔴 Alto | 🟢 Zero | 🟢 Baixo |
| Complexidade operacional | 25% | 🔴 Alta | 🟢 Zero | 🟡 Média |
| Experiência do usuário | 25% | 🟢 Excelente | 🔴 Ruim | 🟡 Boa |
| Segurança | 20% | 🟢 Excelente | 🟡 Neutro | 🟡 Boa |

**Opção C** equilibra custo, complexidade e experiência do usuário. O SmartScreen é um inconveniente, mas não bloqueante — usuários podem clicar em "Executar mesmo assim".

### Condições para implementar

1. **Gerar chaves Ed25519:**
   ```bash
   tauri signer generate -w ~/.tauri/ecoforms.key
   ```

2. **Adicionar `pubkey` ao `tauri.conf.json`:**
   ```json
   {
     "updater": {
       "active": true,
       "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ..."
     }
   }
   ```

3. **Configurar CI/CD para assinar builds:**
   - GitHub Actions com secret `TAURI_SIGNING_PRIVATE_KEY`
   - Assinar `.exe` antes de publicar no Release

4. **Gerar `updater.json` automaticamente:**
   ```json
   {
     "version": "0.2.0",
     "notes": "Correções de sync e melhorias de performance",
     "pub_date": "2026-06-10T12:00:00Z",
     "url": "https://github.com/ecoforms/desktop/releases/download/v0.2.0/EcoSuite.Desktop_0.2.0_x64.exe"
   }
   ```

5. **Documentar processo de publicação:**
   - Criar `docs/RELEASE.md` com passo a passo
   - Incluir comandos para assinar e publicar

### Alternativa futura

Se o SmartScreen se tornar um problema crítico (usuários não conseguem instalar), migrar para **Opção A** com certificado digital Windows.

---

## Consequências

### Positivas

- ✅ Usuários recebem atualizações automaticamente
- ✅ Redução de suporte técnico (versões uniformes)
- ✅ Correções críticas chegam em horas, não semanas
- ✅ Infraestrutura gratuita (GitHub Releases)

### Negativas

- ⚠️ SmartScreen pode alertar (mas não bloqueia)
- ⚠️ Dependência do GitHub para distribuição
- ⚠️ Complexidade adicional no CI/CD (assinatura)

### Neutras

- ℹ️ Usuários ainda podem desabilitar updates nas configurações
- ℹ️ Rollback manual ainda é possível (baixar versão anterior)

---

## Implementação

### Fase 1 — Configuração básica (1 dia)

| Arquivo | Mudança |
|---------|---------|
| `tauri.conf.json` | Adicionar bloco `updater` com `pubkey` |
| `.github/workflows/release.yml` | Assinar `.exe` com chave privada |
| `docs/RELEASE.md` | Documentar processo de publicação |

### Fase 2 — Teste em staging (1 dia)

1. Gerar chaves Ed25519
2. Publicar versão de teste no GitHub Releases
3. Instalar versão anterior em VM limpa
4. Verificar se update é detectado e instalado

### Fase 3 — Produção (1 dia)

1. Publicar versão `0.2.0` com updater habilitado
2. Monitorar logs de update (se disponível)
3. Coletar feedback de usuários

---

## Referências

- [Tauri Auto-Updater Documentation](https://tauri.app/distribute/updater/)
- [Tauri Code Signing](https://tauri.app/distribute/sign/)
- [GitHub Releases API](https://docs.github.com/en/rest/releases)

---

## Decisão

**Pendente.** Aguardando aprovação da equipe para prosseguir com **Opção C**.

**Próximos passos:**
1. Revisar este ADR
2. Aprovar Opção C (ou escolher alternativa)
3. Implementar Fase 1 (configuração básica)
4. Testar em staging
5. Publicar em produção

---

**Data da decisão:** _Aguardando_  
**Decidido por:** _Aguardando_
