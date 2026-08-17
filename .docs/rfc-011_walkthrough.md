# Implementação da RFC-011: Roteamento por Verbo HTTP

Este walkthrough documenta a implementação e validação da **RFC-011**, que adiciona roteamento por verbos HTTP dedicados (`get`, `post`, `put`, `patch`, `delete`) no módulo nativo `net/http`, resposta `405 Method Not Allowed` com cabeçalho `Allow`, suporte automático a `HEAD` e `OPTIONS`, e mensagem de migração dedicada para `server.route`.

## 1. Métodos por Verbo e Estrutura de Rotas (`src/modules/http.ts`)

- **Métodos Dedicados**: `server.get`, `server.post`, `server.put`, `server.patch` e `server.delete` substituem `server.route`.
- **Despacho em Duas Fases**:
  1. Casamento estrito de **path + método** (com requisições `HEAD` atendidas pelo handler de `GET`).
  2. Caso o método não coincida mas o path exista:
     - Retorna **`405 Method Not Allowed`** com o cabeçalho **`Allow: ...`** listando todos os métodos suportados naquele path (RFC 7231 §6.5.5).
     - Se o verbo da requisição for **`OPTIONS`**, responde **`204 No Content`** com o cabeçalho `Allow`.
     - Caso o path não exista em nenhum verbo, retorna **`404 Not Found`**.
- **Comportamento Idêntico nos Dois Modos**: Implementado com paridade exata tanto no interpretador TypeScript (`FlexServer`) quanto no boilerplate Go (`Server`).

## 2. Diagnóstico de Migração no TypeChecker (`src/checker.ts`)

- Chamadas legadas a `server.route(...)` emitem o erro diagnóstico `E2024`:
  ```
  error[E2024]: `server.route` foi removido na v0.2.0 — use `server.get`, `server.post`, `server.put`, `server.patch` ou `server.delete`
    |
    = help: veja RFC-011 — o roteamento agora considera o verbo HTTP
  ```

## 3. Resultados de Validação

- **`npm run test:http`**: **46/46** testes de integração HTTP aprovados:
  - 23 testes em modo interpretado e 23 testes em modo compilado (Go).
  - Roteamento independente de `GET`, `POST`, `PUT`, `PATCH` e `DELETE`.
  - `405 Method Not Allowed` com header `Allow: POST, OPTIONS` ao tentar `GET` em rota exclusivamente `POST`.
  - `OPTIONS` retornando `204` com header `Allow` contendo todos os verbos registrados no path.
  - `HEAD` em rota `GET` retornando status `200` com corpo vazio.
  - `404 Not Found` em rotas inexistentes.
- **`npm run test:watch`**: **8/8** testes de watch aprovados.
- **`npm test`**: **35/35** golden tests aprovados.
- **`npm run test:parity`**: **35/35** no parity gate.
- **`npx tsx tests/36_compiler_diagnostics.ts`**: **23/23** asserções aprovadas (incluindo teste específico de `E2024` para `server.route`).
- **`npm run build`**: Build de produção gerado com sucesso pelo `tsup`.
