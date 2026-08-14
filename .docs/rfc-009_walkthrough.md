# Implementação da RFC-009: Baseline de Segurança para v1.0

Este walkthrough resume as implementações e validações da **RFC-009**, formalizando o baseline "seguro por padrão" (secure-by-default) da FlexLang para sua versão 1.0.

## 1. Mascaramento Automático de Segredos em Logs (`core/log`)
O módulo `core/log` foi aprimorado com um mecanismo transparente de sanitização de dados:
- **Campos Sensíveis Reconhecidos (Case-Insensitive)**: `password`, `secret`, `token`, `authorization`, `api_key`.
- **Comportamento Recursivo**: Qualquer mapa ou array passado a `log.info` ou `log.error` tem seus campos sensíveis substituídos por `"***"` antes da serialização JSON.
- **Isomorfismo TS e Go**: Implementado tanto no runtime TypeScript do interpretador quanto nas rotinas geradas pelo transpiler Go (`strings.ToLower` lookup com `map[string]any`).
- **Campos não sensíveis preservados**: Dados normais (como `user`, `role`, `host`, `service`) continuam intactos.

```flexlang
log.info("user login", {
    user: "alice",
    password: "plaintext_password_123",
    role: "admin"
});
// Saída gerada:
// {"level":"info","msg":"user login","user":"alice","password":"***","role":"admin","ts":"..."}
```

## 2. Auditoria e Validação dos 6 Requisitos de Segurança

| # | Requisito | Status | Como é imposto |
|---|---|---|---|
| 1 | Toda query SQL é parametrizada ($1, $2) | ✅ Validado | Assinatura estrita de `Pool.query(sql, params)` / `Tx.query` na RFC-005 |
| 2 | Limite de corpo HTTP padrão (1MB) com 413 | ✅ Validado | `ServerConfig.max_body_size` com rejeição em streaming na RFC-004 |
| 3 | Timeout de leitura HTTP padrão (5s) | ✅ Validado | `ServerConfig.read_timeout` com cancelamento automático na RFC-004 |
| 4 | Erro não tratado não vaza stack trace | ✅ Validado | `defer/recover` (Go) e `try/catch` (Node) respondem `{"error": "internal server error"}` (500) |
| 5 | Mascaramento de segredos em logs | ✅ Implementado | Sanitização case-insensitive na borda de `core/log` no TS e Go |
| 6 | Segredos em connection strings via env var | ✅ Validado | Reforçado nas convenções de uso e exemplos de `Pool.connect` |

## 3. Testes Automatizados e Cobertura
- **Suíte de Segurança Dedicada (`tests/32_security_baseline.ts`)**: 26 testes cobrindo os requisitos de tipagem, assinaturas e mascaramento de campos com variações de capitalização (`password`, `PASSWORD`, `Token`, `api_key`, `Authorization`, `secret`).
- **Golden Test (`tests/32_security_log_masking.flex`)**: Teste de compilação e interpretação com mascaramento em múltiplos níveis.
- **Integração HTTP (`tests/http_integration.ts`)**: Adicionados cenários de teste para `/healthz` e `/panic` (500 genérico sem vazamento de detalhes internos).
- **Parity Gate (`npm run test:parity`)**: 32 testes executados e validados entre o compilador Go e o interpretador TypeScript.

## Validation Results
- `npm test`: 32/32 testes golden passaram.
- `npm run test:http`: 32/32 asserções de integração HTTP passaram.
- `npm run test:parity`: 32/32 testes no parity gate aprovados.
- `npx tsx tests/32_security_baseline.ts`: 26/26 asserções de segurança passaram.
