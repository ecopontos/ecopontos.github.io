# WhatsApp Business API Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate WhatsApp Business Cloud API into EcoForms for sending notifications, confirmations, and reports via WhatsApp.

**Architecture:** Direct HTTP integration using existing `ureq` crate in the Rust backend. New `whatsapp.rs` module follows the same pattern as `email.rs` and `supabase_admin.rs`. State managed via Tauri's State system. Configuration via environment variables.

**Tech Stack:** Rust, Tauri v2, ureq (HTTP), serde (serialization), tokio (async)

---

## Global Constraints

- Rust edition 2021, minimum rust-version 1.77.2
- Tauri v2.11.4
- ureq 2.12 with json feature
- Environment variables for secrets (never hardcoded)
- All new commands must be registered in `lib.rs` invoke_handler
- Follow existing code patterns (see `email.rs`, `supabase_admin.rs`)

---

## File Structure

| File | Purpose |
|------|---------|
| `desktop/src-tauri/src/commands/whatsapp.rs` | WhatsApp API client, commands, config |
| `desktop/src-tauri/src/commands/mod.rs` | Add `pub mod whatsapp;` |
| `desktop/src-tauri/src/lib.rs` | Register state + commands |
| `desktop/src-tauri/Cargo.toml` | No new deps needed (ureq already present) |
| `CLAUDE.md` | Document WhatsApp env vars |

---

### Task 1: WhatsApp Configuration State

**Files:**
- Create: `desktop/src-tauri/src/commands/whatsapp.rs`
- Modify: `desktop/src-tauri/src/commands/mod.rs`
- Modify: `desktop/src-tauri/src/lib.rs`

**Interfaces:**
- Produces: `WhatsAppState`, `WhatsAppConfig`

- [ ] **Step 1: Create whatsapp.rs with config state**

```rust
// desktop/src-tauri/src/commands/whatsapp.rs
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

/// WhatsApp Business API configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhatsAppConfig {
    /// Meta access token (permanent or system user token)
    pub access_token: String,
    /// WhatsApp Business phone number ID (from Meta Business Suite)
    pub phone_number_id: String,
    /// WhatsApp Business Account ID
    pub waba_id: String,
    /// API version (default: v21.0)
    pub api_version: String,
    /// Whether WhatsApp integration is enabled
    pub enabled: bool,
}

impl WhatsAppConfig {
    /// Load config from environment variables
    pub fn from_env() -> Self {
        Self {
            access_token: std::env::var("WHATSAPP_ACCESS_TOKEN").unwrap_or_default(),
            phone_number_id: std::env::var("WHATSAPP_PHONE_NUMBER_ID").unwrap_or_default(),
            waba_id: std::env::var("WHATSAPP_WABA_ID").unwrap_or_default(),
            api_version: std::env::var("WHATSAPP_API_VERSION")
                .unwrap_or_else(|_| "v21.0".to_string()),
            enabled: std::env::var("WHATSAPP_ENABLED")
                .map(|v| v == "true" || v == "1")
                .unwrap_or(false),
        }
    }

    pub fn is_configured(&self) -> bool {
        self.enabled && !self.access_token.is_empty() && !self.phone_number_id.is_empty()
    }
}

/// Managed state for WhatsApp integration
#[derive(Debug)]
pub struct WhatsAppState {
    pub config: Mutex<WhatsAppConfig>,
}

impl WhatsAppState {
    pub fn new() -> Self {
        Self {
            config: Mutex::new(WhatsAppConfig::from_env()),
        }
    }
}

/// Request to send a template message
#[derive(Debug, Serialize, Deserialize)]
pub struct SendTemplateRequest {
    /// Recipient phone number (international format, e.g., "5511999999999")
    pub to: String,
    /// Template name (must be approved in Meta Business Suite)
    pub template_name: String,
    /// Template language code (e.g., "pt_BR", "en_US")
    pub language_code: String,
    /// Template parameters (optional, for dynamic content)
    pub parameters: Option<Vec<TemplateParameter>>,
}

/// Template parameter (dynamic content in template)
#[derive(Debug, Serialize, Deserialize)]
pub struct TemplateParameter {
    /// Parameter type ("text", "image", "document", "video")
    #[serde(rename = "type")]
    pub param_type: String,
    /// Text content for text parameters
    pub text: Option<String>,
}

/// Request to send a free-form text message (within service window)
#[derive(Debug, Serialize, Deserialize)]
pub struct SendTextRequest {
    /// Recipient phone number
    pub to: String,
    /// Message text
    pub text: String,
}

/// WhatsApp API response
#[derive(Debug, Serialize, Deserialize)]
pub struct WhatsAppResponse {
    pub messaging_product: Option<String>,
    pub contacts: Option<Vec<serde_json::Value>>,
    pub messages: Option<Vec<serde_json::Value>>,
    pub error: Option<WhatsAppError>,
}

/// WhatsApp API error
#[derive(Debug, Serialize, Deserialize)]
pub struct WhatsAppError {
    pub message: String,
    #[serde(rename = "type")]
    pub error_type: Option<String>,
    pub code: Option<i64>,
    pub error_subcode: Option<i64>,
    pub fbtrace_id: Option<String>,
}

/// Status response for health check
#[derive(Debug, Serialize)]
pub struct WhatsAppStatus {
    pub configured: bool,
    pub phone_number_id: String,
    pub waba_id: String,
}
```

- [ ] **Step 2: Add mod declaration to commands/mod.rs**

Append to `desktop/src-tauri/src/commands/mod.rs`:

```rust
pub mod whatsapp;
```

- [ ] **Step 3: Register state in lib.rs**

Add import near line 12 (after `use commands::crypto`):

```rust
use commands::whatsapp::WhatsAppState;
```

Add state registration after line 371 (after `SmtpCryptoState`):

```rust
.manage(WhatsAppState::new())
```

- [ ] **Step 4: Verify compilation**

Run: `cd desktop/src-tauri && cargo check`
Expected: No errors (warnings OK)

- [ ] **Step 5: Commit**

```bash
git add desktop/src-tauri/src/commands/whatsapp.rs desktop/src-tauri/src/commands/mod.rs desktop/src-tauri/src/lib.rs
git commit -m "feat(whatsapp): add configuration state and types"
```

---

### Task 2: WhatsApp HTTP Client

**Files:**
- Modify: `desktop/src-tauri/src/commands/whatsapp.rs`

**Interfaces:**
- Consumes: `WhatsAppConfig` from Task 1
- Produces: `send_template_message()`, `send_text_message()`, `check_health()`

- [ ] **Step 1: Add HTTP client functions to whatsapp.rs**

Append to `desktop/src-tauri/src/commands/whatsapp.rs`:

```rust
use ureq;

const GRAPH_API_BASE: &str = "https://graph.facebook.com";

/// Send a template message via WhatsApp Cloud API
pub fn send_template_message(
    config: &WhatsAppConfig,
    to: &str,
    template_name: &str,
    language_code: &str,
    parameters: Option<&[TemplateParameter]>,
) -> Result<WhatsAppResponse, String> {
    let url = format!(
        "{}/{}/messages",
        GRAPH_API_BASE, config.api_version
    );

    let mut body = serde_json::json!({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {
                "code": language_code
            }
        }
    });

    // Add parameters if provided
    if let Some(params) = parameters {
        if !params.is_empty() {
            let params_json: Vec<serde_json::Value> = params
                .iter()
                .map(|p| {
                    let mut param = serde_json::json!({
                        "type": p.param_type
                    });
                    if let Some(ref text) = p.text {
                        param["text"] = serde_json::json!(text);
                    }
                    param
                })
                .collect();
            body["template"]["components"] = serde_json::json!([{
                "type": "body",
                "parameters": params_json
            }]);
        }
    }

    let response = ureq::post(&url)
        .set("Authorization", &format!("Bearer {}", config.access_token))
        .set("Content-Type", "application/json")
        .send_json(&body)
        .map_err(|e| format!("WhatsApp API request failed: {}", e))?;

    let result: WhatsAppResponse = response
        .into_json()
        .map_err(|e| format!("Failed to parse WhatsApp response: {}", e))?;

    Ok(result)
}

/// Send a free-form text message (must be within 24h customer service window)
pub fn send_text_message(
    config: &WhatsAppConfig,
    to: &str,
    text: &str,
) -> Result<WhatsAppResponse, String> {
    let url = format!(
        "{}/{}/messages",
        GRAPH_API_BASE, config.api_version
    );

    let body = serde_json::json!({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "text",
        "text": {
            "body": text
        }
    });

    let response = ureq::post(&url)
        .set("Authorization", &format!("Bearer {}", config.access_token))
        .set("Content-Type", "application/json")
        .send_json(&body)
        .map_err(|e| format!("WhatsApp API request failed: {}", e))?;

    let result: WhatsAppResponse = response
        .into_json()
        .map_err(|e| format!("Failed to parse WhatsApp response: {}", e))?;

    Ok(result)
}

/// Check WhatsApp Business API health (verify credentials)
pub fn check_health(config: &WhatsAppConfig) -> Result<WhatsAppStatus, String> {
    let url = format!(
        "{}/{}/{}",
        GRAPH_API_BASE, config.api_version, config.phone_number_id
    );

    let _response = ureq::get(&url)
        .set("Authorization", &format!("Bearer {}", config.access_token))
        .call()
        .map_err(|e| format!("WhatsApp health check failed: {}", e))?;

    Ok(WhatsAppStatus {
        configured: true,
        phone_number_id: config.phone_number_id.clone(),
        waba_id: config.waba_id.clone(),
    })
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd desktop/src-tauri && cargo check`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/commands/whatsapp.rs
git commit -m "feat(whatsapp): add HTTP client for Cloud API"
```

---

### Task 3: Tauri Commands for Frontend

**Files:**
- Modify: `desktop/src-tauri/src/commands/whatsapp.rs`

**Interfaces:**
- Consumes: `WhatsAppState`, `SessionState` from prior tasks
- Produces: `whatsapp_send_template`, `whatsapp_send_text`, `whatsapp_status`

- [ ] **Step 1: Add Tauri commands to whatsapp.rs**

Append to `desktop/src-tauri/src/commands/whatsapp.rs`:

```rust
use crate::session::SessionState;

/// Tauri command: Send template message
#[tauri::command]
pub fn whatsapp_send_template(
    request: SendTemplateRequest,
    state: State<'_, WhatsAppState>,
    session: State<'_, SessionState>,
) -> Result<WhatsAppResponse, String> {
    // Verify user is logged in
    let _user = session
        .user_id
        .lock()
        .map_err(|e| format!("Session lock poisoned: {}", e))?
        .clone()
        .ok_or("Sessão não iniciada. Faça login primeiro.")?;

    let config = state
        .config
        .lock()
        .map_err(|e| format!("Config lock poisoned: {}", e))?;

    if !config.is_configured() {
        return Err("WhatsApp não configurado. Defina as variáveis de ambiente WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID e WHATSAPP_ENABLED=true".to_string());
    }

    // Validate phone number format (Brazilian numbers: 55 + DDD + 8-9 digits)
    let digits: String = request.to.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.len() < 12 || digits.len() > 15 {
        return Err("Número de telefone inválido. Use formato internacional (ex: 5511999999999)".to_string());
    }

    log::info!(
        "[WHATSAPP] Sending template '{}' to {}",
        request.template_name,
        &digits[..digits.len().min(6)]
    );

    send_template_message(
        &config,
        &digits,
        &request.template_name,
        &request.language_code,
        request.parameters.as_deref(),
    )
}

/// Tauri command: Send free-form text message (within service window)
#[tauri::command]
pub fn whatsapp_send_text(
    request: SendTextRequest,
    state: State<'_, WhatsAppState>,
    session: State<'_, SessionState>,
) -> Result<WhatsAppResponse, String> {
    // Verify user is logged in
    let _user = session
        .user_id
        .lock()
        .map_err(|e| format!("Session lock poisoned: {}", e))?
        .clone()
        .ok_or("Sessão não iniciada. Faça login primeiro.")?;

    let config = state
        .config
        .lock()
        .map_err(|e| format!("Config lock poisoned: {}", e))?;

    if !config.is_configured() {
        return Err("WhatsApp não configurado. Defina as variáveis de ambiente WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID e WHATSAPP_ENABLED=true".to_string());
    }

    // Validate phone number format
    let digits: String = request.to.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.len() < 12 || digits.len() > 15 {
        return Err("Número de telefone inválido. Use formato internacional (ex: 5511999999999)".to_string());
    }

    log::info!(
        "[WHATSAPP] Sending text to {}",
        &digits[..digits.len().min(6)]
    );

    send_text_message(&config, &digits, &request.text)
}

/// Tauri command: Check WhatsApp configuration status
#[tauri::command]
pub fn whatsapp_status(
    state: State<'_, WhatsAppState>,
) -> Result<WhatsAppStatus, String> {
    let config = state
        .config
        .lock()
        .map_err(|e| format!("Config lock poisoned: {}", e))?;

    Ok(WhatsAppStatus {
        configured: config.is_configured(),
        phone_number_id: config.phone_number_id.clone(),
        waba_id: config.waba_id.clone(),
    })
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd desktop/src-tauri && cargo check`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/commands/whatsapp.rs
git commit -m "feat(whatsapp): add Tauri commands for frontend integration"
```

---

### Task 4: Register Commands in lib.rs

**Files:**
- Modify: `desktop/src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: Commands from Task 3

- [ ] **Step 1: Add commands to invoke_handler**

Add to the `tauri::generate_handler![]` macro in `lib.rs` (after the email commands around line 410):

```rust
commands::whatsapp::whatsapp_send_template,
commands::whatsapp::whatsapp_send_text,
commands::whatsapp::whatsapp_status,
```

- [ ] **Step 2: Verify compilation**

Run: `cd desktop/src-tauri && cargo check`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/lib.rs
git commit -m "feat(whatsapp): register commands in Tauri handler"
```

---

### Task 5: Frontend WhatsApp Service

**Files:**
- Create: `desktop/src/lib/whatsapp.ts`

**Interfaces:**
- Produces: `WhatsAppService` class with methods matching Tauri commands

- [ ] **Step 1: Create WhatsApp service for frontend**

```typescript
// desktop/src/lib/whatsapp.ts
import { invoke } from '@tauri-apps/api/core';

export interface WhatsAppTemplateParameter {
  type: 'text' | 'image' | 'document' | 'video';
  text?: string;
}

export interface SendTemplateRequest {
  to: string;
  templateName: string;
  languageCode: string;
  parameters?: WhatsAppTemplateParameter[];
}

export interface SendTextRequest {
  to: string;
  text: string;
}

export interface WhatsAppResponse {
  messaging_product?: string;
  contacts?: Record<string, unknown>[];
  messages?: Record<string, unknown>[];
  error?: {
    message: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

export interface WhatsAppStatus {
  configured: boolean;
  phoneNumberId: string;
  wabaId: string;
}

export class WhatsAppService {
  /**
   * Send a template message via WhatsApp
   */
  static async sendTemplate(request: SendTemplateRequest): Promise<WhatsAppResponse> {
    return invoke<WhatsAppResponse>('whatsapp_send_template', {
      request: {
        to: request.to,
        template_name: request.templateName,
        language_code: request.languageCode,
        parameters: request.parameters,
      },
    });
  }

  /**
   * Send a free-form text message (within 24h service window)
   */
  static async sendText(request: SendTextRequest): Promise<WhatsAppResponse> {
    return invoke<WhatsAppResponse>('whatsapp_send_text', {
      request: {
        to: request.to,
        text: request.text,
      },
    });
  }

  /**
   * Check WhatsApp configuration status
   */
  static async status(): Promise<WhatsAppStatus> {
    return invoke<WhatsAppStatus>('whatsapp_status');
  }

  /**
   * Format a Brazilian phone number to international format
   * Input: (11) 99999-9999 or 11999999999
   * Output: 5511999999999
   */
  static formatPhoneBR(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('55')) {
      return digits;
    }
    return `55${digits}`;
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd desktop && npx tsc --noEmit src/lib/whatsapp.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add desktop/src/lib/whatsapp.ts
git commit -m "feat(whatsapp): add frontend service for WhatsApp API"
```

---

### Task 6: Document Environment Variables

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: Configuration from Task 1

- [ ] **Step 1: Add WhatsApp section to CLAUDE.md**

Add after the email configuration section (search for SMTP configuration):

```markdown
## WhatsApp Business API

Integração com WhatsApp Business Cloud API para notificações e comunicação.

**Variáveis de ambiente obrigatórias** (desktop/src-tauri/.env):

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `WHATSAPP_ENABLED` | Ativar integração | `true` |
| `WHATSAPP_ACCESS_TOKEN` | Token de acesso Meta Business | `EAAx...` |
| `WHATSAPP_PHONE_NUMBER_ID` | ID do número de telefone WhatsApp | `123456789` |
| `WHATSAPP_WABA_ID` | ID da conta WhatsApp Business | `987654321` |
| `WHATSAPP_API_VERSION` | Versão da API (opcional) | `v21.0` |

**Setup:**

1. Criar conta no [Meta Business Manager](https://business.facebook.com)
2. Ativar WhatsApp Business Platform
3. Obter permanent access token ou system user token
4. Aprovar templates de mensagens no Meta Business Suite
5. Configurar variáveis de ambiente no `.env`

**Templates recomendados para EcoForms:**

| Template | Categoria | Uso |
|----------|-----------|-----|
| `ecoponto_notification` | Utility | Notificação de tarefa atribuída |
| `appointment_confirmation` | Utility | Confirmação de agendamento |
| `report_ready` | Utility | Relatório disponível |

**Limitações:**

- Mensagens de template requerem aprovação prévia do Meta
- Mensagens gratuitas apenas dentro da janela de 24h (service window)
- Números devem estar no formato internacional (55XXXXXXXXXXX)
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(whatsapp): add environment variables and setup guide"
```

---

### Task 7: Integration Test Helper

**Files:**
- Create: `desktop/src-tauri/src/commands/whatsapp_test.rs` (test module)

**Interfaces:**
- Consumes: All types from prior tasks

- [ ] **Step 1: Add test module to whatsapp.rs**

Append to `desktop/src-tauri/src/commands/whatsapp.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_from_env_missing() {
        // Clear env vars for test
        std::env::remove_var("WHATSAPP_ACCESS_TOKEN");
        std::env::remove_var("WHATSAPP_PHONE_NUMBER_ID");
        std::env::remove_var("WHATSAPP_ENABLED");

        let config = WhatsAppConfig::from_env();
        assert!(!config.is_configured());
        assert!(config.access_token.is_empty());
    }

    #[test]
    fn test_config_from_env_present() {
        std::env::set_var("WHATSAPP_ACCESS_TOKEN", "test_token");
        std::env::set_var("WHATSAPP_PHONE_NUMBER_ID", "123456");
        std::env::set_var("WHATSAPP_ENABLED", "true");

        let config = WhatsAppConfig::from_env();
        assert!(config.is_configured());
        assert_eq!(config.access_token, "test_token");
        assert_eq!(config.phone_number_id, "123456");

        // Cleanup
        std::env::remove_var("WHATSAPP_ACCESS_TOKEN");
        std::env::remove_var("WHATSAPP_PHONE_NUMBER_ID");
        std::env::remove_var("WHATSAPP_ENABLED");
    }

    #[test]
    fn test_config_disabled() {
        std::env::set_var("WHATSAPP_ACCESS_TOKEN", "test_token");
        std::env::set_var("WHATSAPP_PHONE_NUMBER_ID", "123456");
        std::env::set_var("WHATSAPP_ENABLED", "false");

        let config = WhatsAppConfig::from_env();
        assert!(!config.is_configured());

        // Cleanup
        std::env::remove_var("WHATSAPP_ACCESS_TOKEN");
        std::env::remove_var("WHATSAPP_PHONE_NUMBER_ID");
        std::env::remove_var("WHATSAPP_ENABLED");
    }

    #[test]
    fn test_template_parameter_serialization() {
        let param = TemplateParameter {
            param_type: "text".to_string(),
            text: Some("João".to_string()),
        };

        let json = serde_json::to_value(&param).unwrap();
        assert_eq!(json["type"], "text");
        assert_eq!(json["text"], "João");
    }

    #[test]
    fn test_send_template_request_serialization() {
        let request = SendTemplateRequest {
            to: "5511999999999".to_string(),
            template_name: "ecoponto_notification".to_string(),
            language_code: "pt_BR".to_string(),
            parameters: Some(vec![
                TemplateParameter {
                    param_type: "text".to_string(),
                    text: Some("Ecoponto Central".to_string()),
                },
            ]),
        };

        let json = serde_json::to_value(&request).unwrap();
        assert_eq!(json["to"], "5511999999999");
        assert_eq!(json["templateName"], "ecoponto_notification");
        assert_eq!(json["languageCode"], "pt_BR");
    }
}
```

- [ ] **Step 2: Run tests**

Run: `cd desktop/src-tauri && cargo test whatsapp`
Expected: All 4 tests pass

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/commands/whatsapp.rs
git commit -m "test(whatsapp): add unit tests for config and serialization"
```

---

## Verification Checklist

After completing all tasks:

- [ ] `cargo check` passes with no errors
- [ ] `cargo test whatsapp` passes all tests
- [ ] Environment variables documented in CLAUDE.md
- [ ] Commands registered in lib.rs invoke_handler
- [ ] Frontend service compiles with TypeScript
- [ ] Phone number validation works for Brazilian numbers
- [ ] Error messages are clear and actionable

---

## Next Steps (Not in Scope)

After this plan is implemented:

1. Create Meta Business Manager account and get credentials
2. Create and approve message templates in Meta Business Suite
3. Add UI components for sending WhatsApp messages from the desktop app
4. Integrate with task/notification system for automated messages
5. Add webhook receiver for incoming messages (optional)
