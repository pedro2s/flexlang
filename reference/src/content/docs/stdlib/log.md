---
title: core/log — Logging Estruturado & Segurança
description: Logs em JSON estruturado com timestamps ISO 8601 e mascaramento automático de dados sensíveis.
---

O módulo `core/log` emite registros em formato JSON estruturado direto para `stdout`/`stderr`, com proteção ativa para mascarar segredos e senhas.

```flexlang
import { log } from "core/log";
```

---

## 🪵 Níveis de Log

```flexlang
log.info("Servidor iniciado com sucesso", { porta: 8080, env: "production" });
log.warn("Tentativa de login com credenciais suspeitas", { ip: "192.168.1.50" });
log.error("Falha ao comunicar com gateway de pagamento", { codigo: 504 });
log.debug("Parâmetros da requisição recebida", { query: "limit=10" });
```

### Formato da Saída JSON:
```json
{"level":"info","msg":"Servidor iniciado com sucesso","ts":"2026-08-18T22:00:00.000Z","porta":8080,"env":"production"}
```

---

## 🔒 Mascaramento Automático de Segredos (RFC-009)

O logger analisa automaticamente as chaves dos objetos estruturados e substitui valores sensíveis por `"***"`, independentemente de onde apareçam:

### Chaves Mascaradas Automaticamente (Case-Insensitive):
- `password`, `senha`
- `token`, `auth`, `authorization`
- `secret`, `api_key`

```flexlang
// O desenvolvedor passa o objeto completo:
log.info("Tentativa de autenticação", {
    usuario: "alice",
    password: "senha_ultra_secreta",
    api_key: "ak_live_8912301283"
});

// A saída gerada mascara os campos automaticamente:
// {"level":"info","msg":"Tentativa de autenticação","ts":"...","usuario":"alice","password":"***","api_key":"***"}
```
