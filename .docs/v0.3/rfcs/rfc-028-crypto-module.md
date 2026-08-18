# RFC-028 — Módulo `crypto` — Hashing, UUID e HMAC

> **Status:** Implementado · **Prioridade:** P1 · **Depende de:** nada

## 1. Motivação

Um backend financeiro precisa:
- **Hashear senhas** com bcrypt (resistente a brute-force)
- **Gerar UUIDs** para IDs de transações e correlation IDs
- **Criar HMACs** para validar webhooks de parceiros (Pix, gateways de pagamento)
- **Hashear dados** com SHA-256 para checksums e assinaturas

## 2. API

```flexlang
import { hash, uuid, hmac, sha256 } from "crypto";
```

### 2.1 Hashing de Senhas (bcrypt)

| Método | Assinatura | Retorno | Descrição |
|---|---|---|---|
| `hash.bcrypt(password)` | `hash.bcrypt(password: String)` | `Result<String, String>` | Gera hash bcrypt com cost 12 |
| `hash.bcrypt_verify(password, hash)` | `hash.bcrypt_verify(password: String, hash: String)` | `Bool` | Verifica senha contra hash |

### 2.2 UUID

| Método | Assinatura | Retorno | Descrição |
|---|---|---|---|
| `uuid.v4()` | estático | `String` | UUID v4 (random, RFC 4122) |

### 2.3 HMAC

| Método | Assinatura | Retorno | Descrição |
|---|---|---|---|
| `hmac.sha256(message, key)` | `hmac.sha256(message: String, key: String)` | `String` | HMAC-SHA256 em hexadecimal |
| `hmac.verify(message, key, expected)` | `hmac.verify(message: String, key: String, expected: String)` | `Bool` | Verificação em tempo constante |

### 2.4 SHA-256

| Método | Assinatura | Retorno | Descrição |
|---|---|---|---|
| `sha256(data)` | `sha256(data: String)` | `String` | Hash SHA-256 em hexadecimal |

### 2.5 Exemplos

```flexlang
import { hash, uuid, hmac, sha256 } from "crypto";

// Cadastro de usuário
func register_user(name: String, email: String, password: String) -> Result<User, String> {
    let password_hash = hash.bcrypt(password)?;
    let user_id = uuid.v4();
    // ... inserir no banco ...
}

// Login
func login(email: String, password: String, stored_hash: String) -> Bool {
    return hash.bcrypt_verify(password, stored_hash);
}

// Validação de webhook Pix
func validate_pix_webhook(body: String, signature: String) -> Bool {
    let secret = env.require("PIX_WEBHOOK_SECRET");
    return hmac.verify(body, secret, signature);
}

// Correlation ID para rastreabilidade
func handle_request(req: Request, mut res: Response) {
    let correlation_id = uuid.v4();
    res.header("X-Correlation-ID", correlation_id);
    log.info("Request recebido", { correlation_id: correlation_id });
}
```

## 3. Implementação

### 3.1 Interpretador (TS)
- `hash.bcrypt` → pacote npm `bcrypt` ou `bcryptjs`
- `uuid.v4()` → `crypto.randomUUID()` (Node.js built-in)
- `hmac.sha256` → `crypto.createHmac('sha256', key)`
- `sha256` → `crypto.createHash('sha256')`

### 3.2 Transpiler Go
- `hash.bcrypt` → `golang.org/x/crypto/bcrypt`
- `uuid.v4()` → `github.com/google/uuid`
- `hmac.sha256` → `crypto/hmac` + `crypto/sha256`
- `sha256` → `crypto/sha256`
- Adiciona imports correspondentes ao boilerplate

## 4. Considerações de Segurança

1. **bcrypt cost = 12** (padrão OWASP para produção)
2. **HMAC.verify** usa comparação em tempo constante (`crypto.timingSafeEqual` no TS, `hmac.Equal` no Go) para evitar timing attacks
3. **Sem salt exposto**: bcrypt embute salt no hash — nenhuma API expõe salt separadamente
4. **Mascaramento em logs**: `password` e `hash` são mascarados automaticamente pelo `core/log` (RFC-009)

## 5. Plano de Testes

- Golden test: `hash.bcrypt("senha123")` → string começando com `$2b$`
- Golden test: `hash.bcrypt_verify("senha123", hash)` → `true`
- Golden test: `hash.bcrypt_verify("senhaErrada", hash)` → `false`
- Golden test: `uuid.v4()` → formato UUID (`xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`)
- Golden test: `sha256("hello")` → hash conhecido
- Parity test: hashes de bcrypt não são comparáveis entre runtimes (salt aleatório), mas verify sim
