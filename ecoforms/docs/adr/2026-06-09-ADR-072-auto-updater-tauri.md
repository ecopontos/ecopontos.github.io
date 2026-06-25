# ADR-072 ÔÇö Auto-Updater do Tauri Desktop


> **Renumerado** de ADR-060 para ADR-072 em 2026-06-18 (triagem de ADRs — série `desktop/docs/adr/` consolidada em `docs/adr/`).


**Status:**Proposto**
**Data:** 2026-06-09  
**Autor:** Marcelo Luiz  
**Contexto externo:** Checklist de Encerramento Desktop (item #4) ÔÇö `auto-updater` n├úo configurado no `tauri.conf.json`.

---

## Contexto

### O que existe hoje

O `tauri.conf.json` do EcoSuite Desktop **n├úo possui** o bloco `updater` configurado:

```json
{
  "productName": "EcoSuite Desktop",
  "version": "0.1.8",
  "bundle": {
    "active": true,
    "targets": ["nsis"]
  }
  // ÔØî Sem bloco "updater"
}
```

Consequ├¬ncia: o Tauri **desabilita o auto-updater por padr├úo**. Usu├írios que instalaram vers├Áes anteriores n├úo recebem notifica├º├Áes de novas vers├Áes e precisam baixar manualmente o instalador.

### Problema

| Cen├írio | Impacto |
|---------|---------|
| Corre├º├úo cr├¡tica de bug (ex: sync quebrado) | Usu├írio continua com vers├úo defeituosa at├® perceber manualmente |
| Nova feature importante | Ado├º├úo lenta ÔÇö usu├írios n├úo sabem que existe atualiza├º├úo |
| Vulnerabilidade de seguran├ºa | Janela de exposi├º├úo prolongada |
| Suporte t├®cnico | Dificuldade em reproduzir bugs ÔÇö vers├Áes diferentes em campo |

### Restri├º├Áes t├®cnicas

- **Distribui├º├úo atual:** `.exe` via NSIS (Windows Installer)
- **Assinatura de c├│digo:** ÔØî N├úo configurada ÔÇö SmartScreen pode bloquear instala├º├Áes
- **Servidor de updates:** ÔØî N├úo existe endpoint p├║blico para `updater.json`
- **Chave de assinatura:** ÔØî N├úo gerada (Tauri exige par de chaves Ed25519)

---

## Op├º├Áes

### Op├º├úo A ÔÇö Habilitar auto-updater com endpoint pr├│prio

**Configura├º├úo:**

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

**Infraestrutura necess├íria:**

| Componente | Descri├º├úo | Esfor├ºo |
|------------|-----------|---------|
| Endpoint `/api/updater` | Retorna `updater.json` com vers├úo mais recente + URL do instalador + assinatura | M├®dio |
| Gera├º├úo de chaves Ed25519 | `tauri signer generate -w ~/.tauri/ecoforms.key` | Baixo |
| Assinatura de builds | Assinar `.exe` com chave privada antes de publicar | M├®dio |
| Storage p├║blico | Hospedar instaladores assinados (S3, Cloudflare R2, etc.) | Baixo |
| Assinatura de c├│digo Windows | Certificado digital (DV/OV) para evitar SmartScreen | Alto ($200-400/ano) |

**Pr├│s:**
- Ô£à Usu├írios recebem updates automaticamente
- Ô£à Redu├º├úo de suporte t├®cnico (vers├Áes uniformes)
- Ô£à Corre├º├Áes cr├¡ticas chegam r├ípido
- Ô£à Padr├úo da ind├║stria (Tauri, Electron, etc.)

**Contras:**
- ÔØî Custo de certificado digital Windows (~$300/ano)
- ÔØî Infraestrutura de endpoint + storage
- ÔØî Complexidade operacional (assinatura, publica├º├úo, rollback)
- ÔØî SmartScreen ainda pode alertar se sem certificado

---

### Op├º├úo B ÔÇö Desabilitar conscientemente (status quo)

**Configura├º├úo:**

```json
{
  "bundle": {
    "active": true,
    "targets": ["nsis"]
  }
  // updater desabilitado por omiss├úo
}
```

**Documenta├º├úo necess├íria:**

Criar `docs/DEPLOYMENT.md` explicando:
- Como baixar novas vers├Áes (link para release page)
- Como verificar vers├úo atual (menu "Sobre")
- Processo manual de atualiza├º├úo

**Pr├│s:**
- Ô£à Zero custo de infraestrutura
- Ô£à Zero complexidade operacional
- Ô£à Simplicidade m├íxima

**Contras:**
- ÔØî Usu├írios n├úo recebem updates automaticamente
- ÔØî Corre├º├Áes cr├¡ticas dependem de a├º├úo manual
- ÔØî M├║ltiplas vers├Áes em campo simultaneamente
- ÔØî Suporte t├®cnico mais dif├¡cil

---

### Op├º├úo C ÔÇö Auto-updater simplificado (GitHub Releases)

**Configura├º├úo:**

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

**Infraestrutura necess├íria:**

| Componente | Descri├º├úo | Esfor├ºo |
|------------|-----------|---------|
| GitHub Releases | Publicar `.exe` + `updater.json` assinados | Baixo |
| Gera├º├úo de chaves Ed25519 | `tauri signer generate` | Baixo |
| CI/CD | Assinar builds automaticamente | M├®dio |

**Pr├│s:**
- Ô£à Usu├írios recebem updates automaticamente
- Ô£à Infraestrutura gratuita (GitHub)
- Ô£à Sem custo de certificado digital
- Ô£à Simplicidade operacional

**Contras:**
- ÔØî SmartScreen pode bloquear (sem certificado Windows)
- ÔØî Depende de disponibilidade do GitHub
- ÔØî Menos controle sobre distribui├º├úo

---

## Recomenda├º├úo

**Op├º├úo C ÔÇö Auto-updater simplificado (GitHub Releases)**

### Justificativa

| Crit├®rio | Peso | Op├º├úo A | Op├º├úo B | Op├º├úo C |
|----------|------|---------|---------|---------|
| Custo inicial | 30% | ­ƒö┤ Alto | ­ƒƒó Zero | ­ƒƒó Baixo |
| Complexidade operacional | 25% | ­ƒö┤ Alta | ­ƒƒó Zero | ­ƒƒí M├®dia |
| Experi├¬ncia do usu├írio | 25% | ­ƒƒó Excelente | ­ƒö┤ Ruim | ­ƒƒí Boa |
| Seguran├ºa | 20% | ­ƒƒó Excelente | ­ƒƒí Neutro | ­ƒƒí Boa |

**Op├º├úo C** equilibra custo, complexidade e experi├¬ncia do usu├írio. O SmartScreen ├® um inconveniente, mas n├úo bloqueante ÔÇö usu├írios podem clicar em "Executar mesmo assim".

### Condi├º├Áes para implementar

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
     "notes": "Corre├º├Áes de sync e melhorias de performance",
     "pub_date": "2026-06-10T12:00:00Z",
     "url": "https://github.com/ecoforms/desktop/releases/download/v0.2.0/EcoSuite.Desktop_0.2.0_x64.exe"
   }
   ```

5. **Documentar processo de publica├º├úo:**
   - Criar `docs/RELEASE.md` com passo a passo
   - Incluir comandos para assinar e publicar

### Alternativa futura

Se o SmartScreen se tornar um problema cr├¡tico (usu├írios n├úo conseguem instalar), migrar para **Op├º├úo A** com certificado digital Windows.

---

## Consequ├¬ncias

### Positivas

- Ô£à Usu├írios recebem atualiza├º├Áes automaticamente
- Ô£à Redu├º├úo de suporte t├®cnico (vers├Áes uniformes)
- Ô£à Corre├º├Áes cr├¡ticas chegam em horas, n├úo semanas
- Ô£à Infraestrutura gratuita (GitHub Releases)

### Negativas

- ÔÜá´©Å SmartScreen pode alertar (mas n├úo bloqueia)
- ÔÜá´©Å Depend├¬ncia do GitHub para distribui├º├úo
- ÔÜá´©Å Complexidade adicional no CI/CD (assinatura)

### Neutras

- Ôä╣´©Å Usu├írios ainda podem desabilitar updates nas configura├º├Áes
- Ôä╣´©Å Rollback manual ainda ├® poss├¡vel (baixar vers├úo anterior)

---

## Implementa├º├úo

### Fase 1 ÔÇö Configura├º├úo b├ísica (1 dia)

| Arquivo | Mudan├ºa |
|---------|---------|
| `tauri.conf.json` | Adicionar bloco `updater` com `pubkey` |
| `.github/workflows/release.yml` | Assinar `.exe` com chave privada |
| `docs/RELEASE.md` | Documentar processo de publica├º├úo |

### Fase 2 ÔÇö Teste em staging (1 dia)

1. Gerar chaves Ed25519
2. Publicar vers├úo de teste no GitHub Releases
3. Instalar vers├úo anterior em VM limpa
4. Verificar se update ├® detectado e instalado

### Fase 3 ÔÇö Produ├º├úo (1 dia)

1. Publicar vers├úo `0.2.0` com updater habilitado
2. Monitorar logs de update (se dispon├¡vel)
3. Coletar feedback de usu├írios

---

## Refer├¬ncias

- [Tauri Auto-Updater Documentation](https://tauri.app/distribute/updater/)
- [Tauri Code Signing](https://tauri.app/distribute/sign/)
- [GitHub Releases API](https://docs.github.com/en/rest/releases)

---

## Decis├úo

**Pendente.** Aguardando aprova├º├úo da equipe para prosseguir com **Op├º├úo C**.

**Pr├│ximos passos:**
1. Revisar este ADR
2. Aprovar Op├º├úo C (ou escolher alternativa)
3. Implementar Fase 1 (configura├º├úo b├ísica)
4. Testar em staging
5. Publicar em produ├º├úo

---

**Data da decis├úo:** _Aguardando_  
**Decidido por:** _Aguardando_
