# ADRs de Segurança — EcoForms Desktop

Plano de remediacao derivado de [`../security-audit-2026-06-19.md`](../security-audit-2026-06-19.md).
Os ADRs sao encadeados, mas a ADR-076 revisa a premissa criptografica: LAN offline
controlada usa confinamento, sessao/RBAC, schema e allowlist; criptografia fica para
envelope remoto/web.

```
ADR-074  Confinamento de FS                      ->  fecha C1
   |     (itens de cofre/chave local pausados pela ADR-076)
   v  (pre-requisito)
ADR-075  Sessao autenticada + LAN validada        ->  fecha C2, A1, A3, S3 local
   |     (HMAC/assinatura LAN pausados pela ADR-076)
   v
ADR-076  Envelope remoto/web cifrado              ->  cripto quando o dado sai da LAN
```

| ADR | Titulo | Fecha | Depende de |
|-----|--------|-------|------------|
| [074](./ADR-074-cofre-de-chaves-e-confinamento-fs.md) | Cofre de chaves e confinamento de FS | C1; cripto local pausada | — |
| [075](./ADR-075-sessao-autenticada-e-ingestao-confiavel.md) | Sessao ligada ao login e ingestao de sync confiavel | C2, A1, A3, S3 local | **ADR-074** |
| [076](./ADR-076-fronteira-cripto-lan-e-envelope-remoto.md) | Fronteira criptografica: LAN local validada e envelope remoto cifrado | Cripto para remoto/web; pausa cripto LAN | **ADR-074/075** |

**Por que encadear:** a autorizacao por sessao (075) e contornavel enquanto houver leitura arbitraria de FS. A ADR-076 remove a obrigatoriedade de cifrar o sync LAN, mas nao remove a necessidade de confinamento, sessao/RBAC, schema e allowlist.

**Ordem de execucao:** 074.1->074.3 -> 075.1->075.6. Criptografia volta ao plano quando houver envelope remoto/web (ADR-076.3->076.4).
