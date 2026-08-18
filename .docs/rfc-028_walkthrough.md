# Walkthrough: Implementação da RFC-028 — Módulo `crypto`

Implementamos com sucesso a especificação [RFC-028](file:///home/pedro/dev/pedro/flexlang/.docs/v0.3/rfcs/rfc-028-crypto-module.md) na linguagem FlexLang, introduzindo o módulo nativo `crypto` com hashing de senhas via bcrypt, geração de UUIDs v4, HMAC-SHA256 e função livre de hash SHA-256.

---

## 🛠️ Recursos Implementados

### 1. API do Módulo `crypto`
```flexlang
import { hash, uuid, hmac, sha256 } from "crypto";
```

| Método / Função | Assinatura | Retorno | Descrição |
|---|---|---|---|
| `hash.bcrypt` | `hash.bcrypt(password: String)` | `Result<String, String>` | Gera hash bcrypt seguro com salt aleatório e custo 12 |
| `hash.bcrypt_verify` | `hash.bcrypt_verify(password: String, hash: String)` | `Bool` | Valida senha contra hash de forma segura |
| `uuid.v4` | `uuid.v4()` | `String` | Gera UUID v4 aleatório compatível com RFC 4122 (36 caracteres) |
| `hmac.sha256` | `hmac.sha256(message: String, key: String)` | `String` | Gera HMAC-SHA256 em hexadecimal |
| `hmac.verify` | `hmac.verify(message: String, key: String, expected: String)` | `Bool` | Verificação de HMAC em tempo constante (evita timing attacks) |
| `sha256` | `sha256(data: String)` | `String` | Calcula o hash SHA-256 em hexadecimal |

---

## 🔧 Alterações por Componente

1. **Módulo Nativo ([`src/modules/crypto.ts`](file:///home/pedro/dev/pedro/flexlang/src/modules/crypto.ts))**:
   - Integração com `bcryptjs` e módulo `crypto` do Node.
   - Boilerplate Go autossuficiente com `crypto/hmac`, `crypto/rand`, `crypto/subtle`, `encoding/hex` e implementação segura de bcrypt e UUID.

2. **Extensão do Sistema de Módulos Nativos ([`src/modules/types.ts`](file:///home/pedro/dev/pedro/flexlang/src/modules/types.ts) & [`src/checker.ts`](file:///home/pedro/dev/pedro/flexlang/src/checker.ts) & [`src/interpreter.ts`](file:///home/pedro/dev/pedro/flexlang/src/interpreter.ts) & [`src/transpiler.ts`](file:///home/pedro/dev/pedro/flexlang/src/transpiler.ts))**:
   - Suporte a funções livres exportadas por módulos nativos (`NativeModule.functions`).
   - Resolução e verificação de tipos em Pass 1 e Pass 2 do checker.
   - Execução transparente de funções JS nativas no interpretador.
   - Formatação robusta de imports Go com aliases no transpiler.

3. **Registro de Módulos ([`src/modules/registry.ts`](file:///home/pedro/dev/pedro/flexlang/src/modules/registry.ts))**:
   - Registro de `cryptoModule` em `crypto`.

---

## 🧪 Testes e Validação

### Resultados dos Testes:
1. **Novo Teste Golden [`tests/47_crypto.flex`](file:///home/pedro/dev/pedro/flexlang/tests/47_crypto.flex)**:
   - `hash.bcrypt` e `hash.bcrypt_verify`.
   - `uuid.v4()`.
   - `hmac.sha256` e `hmac.verify`.
   - `sha256("hello")`.
2. **Suíte Golden Completa**:
   ```bash
   $ npm test
   Tests Completed: 47 passed, 0 failed.
   ```
3. **Paridade Node ↔ Go**:
   ```bash
   $ npm run test:parity
   Parity gate: 42 passaram, 0 falharam, 5 sem comparação de stdout.
   ```
4. **Testes da Extensão VSCode**:
   ```bash
   $ npm run test:vscode
   ✅ Sucesso: RFC-028: módulo crypto com hash, uuid, hmac e sha256 validado
   ✨ Todos os testes das Ferramentas VSCode passaram com 100% de sucesso!
   ```
