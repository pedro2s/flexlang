# Implementação da RFC-015: Middleware, Headers e CORS

Este walkthrough documenta a implementação e validação da **RFC-015**, que adiciona suporte a middlewares globais (`server.use`), leitura e escrita de cabeçalhos HTTP (`req.header`, `res.header`) e suporte nativo a CORS (`server.cors`, `CorsConfig`) no módulo `net/http`.

## 1. Cadeia de Middlewares e Controle de Fluxo (`src/modules/http.ts`)

- **Assinatura Uniforme**: Middlewares usam a mesma assinatura dos handlers: `func(Request, mut Response)`.
- **Regra de Execução**: Middlewares rodam sequencialmente na ordem de registro (`server.use(...)`) antes do roteamento (protegendo também rotas inexistentes antes do 404).
- **Encerramento da Cadeia**: Se um middleware emitir uma resposta (`res.json()`, `res.error()`, etc., marcando `written = true`), a cadeia é interrompida imediatamente.
- **Isenção de `/healthz`**: A rota `GET /healthz` é atendida diretamente pelo runtime e nunca passa pela cadeia de middlewares.

## 2. Leitura e Modificação de Headers

- **`req.header(name: String) -> Option<String>`**: Leitura de cabeçalhos com normalização case-insensitive tanto no interpretador TypeScript quanto no Go.
- **`res.header(name: String, value: String) -> Response`**: Modificador encadeável que acumula headers customizados para serem enviados na resposta.

## 3. Configuração de CORS e Preflight OPTIONS

- **`CorsConfig`**: Struct expondo `allow_origins: [String]`, `allow_methods: [String]`, `allow_headers: [String]` e `max_age: Int`.
- **Segurança por Padrão**: Nenhum cabeçalho `Access-Control-*` é emitido se `server.cors(...)` não for configurado.
- **Preflight `OPTIONS`**: Atendido automaticamente com `204 No Content`, `Access-Control-Allow-*`, `Vary: Origin` e `Allow`.

## 4. Resultados de Validação

- **`npm run test:http`**: **96/96** testes de integração HTTP aprovados (48 em modo interpretado + 48 em Go compilado):
  - Injeção de cabeçalhos por middleware não-bloqueante (`X-Global-Mw: active`).
  - Interrupção de cadeia com `403` por middleware bloqueante.
  - Isenção de `GET /healthz` de middlewares bloqueantes.
  - Execução de middleware antes de rotas `404`.
  - Leitura case-insensitive de headers em `req.header` (`Authorization` vs `authorization`).
  - Emissão de headers de resposta customizados com `res.header`.
  - Emissão correta de `Access-Control-Allow-Origin` e `Vary: Origin` para origens válidas e supressão para origens inválidas.
  - Preflight `OPTIONS` com status 204 e cabeçalhos CORS completos.
- **`npm test`**: **35/35** golden tests aprovados.
- **`npm run test:parity`**: **35/35** no parity gate.
- **`npm run test:watch`**: **8/8** testes de watch aprovados.
- **`npx tsx tests/36_compiler_diagnostics.ts`**: **26/26** diagnósticos aprovados.
- **`npx tsx tests/28_module_errors.ts`**: **4/4** testes aprovados.
- **`npx tsx tests/32_security_baseline.ts`**: **26/26** testes de segurança aprovados.
- **`npm run build`**: Build de produção gerado com sucesso sem erros.
