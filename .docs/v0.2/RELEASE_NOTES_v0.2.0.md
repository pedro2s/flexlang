# FlexLang v0.2.0 — Release Notes

A release **v0.2.0** marca um salto fundamental para a FlexLang, transformando o compilador e a biblioteca padrão em uma plataforma pronta para expressar APIs REST completas, seguras e de nível empresarial, eliminando qualquer divergência entre o modo interpretado e o modo compilado nativo em Go.

---

## 🚀 Principais Destaques da Release

### 1. Roteamento por Verbo HTTP e Semântica 405 (RFC-011)
- Roteador moderno baseado em verbos dedicados: `server.get`, `server.post`, `server.put`, `server.patch` e `server.delete` (substituindo o antigo `server.route`).
- Despacho em duas fases com suporte a **`405 Method Not Allowed`** e cabeçalho **`Allow: ...`** listando métodos disponíveis.
- Derivação automática para **`HEAD`** (executa o handler de `GET` e omite o corpo) e **`OPTIONS`** (`204 No Content` + `Allow`).
- Diagnóstico amigável no compilador (`E2024`) orientando a migração de código legado.

### 2. Middlewares, Leitura/Modificação de Headers e CORS Nativo (RFC-015)
- Cadeia global de middlewares via `server.use(...)` com a mesma assinatura dos handlers `func(Request, mut Response)`.
- Controle de fluxo simples e determinístico: se o middleware responde, a cadeia é interrompida; se não, a requisição prossegue.
- Leitura case-insensitive de headers em `req.header(name: String) -> Option<String>`.
- Emissão encadeável de cabeçalhos de resposta customizados em `res.header(name: String, value: String) -> Response`.
- Suporte nativo a **CORS** com `server.cors(CorsConfig { ... })`, tratando preflight `OPTIONS` com status `204`, `Access-Control-Allow-*` e `Vary: Origin`.
- Isenção automática e incondicional de **`GET /healthz`** de toda a cadeia de middlewares.

### 3. Modo Watch e Resolução de Projetos (RFC-012)
- Modo de desenvolvimento com hot reloading: **`flex run --watch`** / **`flex run -w`**.
- Resolução automática do arquivo de entrada a partir do manifesto `flex.toml` (`entry = "src/main.flex"`).
- Observação de todo o grafo de dependências do projeto com debounce de 80ms e recuperação resiliente de erros sintáticos.

### 4. Aritmética e Literais Float com 100% de Paridade (RFC-013)
- Tipo primitivo `Float` (ponto flutuante IEEE 754 de 64 bits em Go e TS).
- Paridade aritmética rigorosa: `7.0 / 2.0` resulta em `3.5` tanto no interpretador quanto no binário compilado.
- Conversões explícitas `to_float()` e `to_int()` e promoção segura de literais untyped.

### 5. Diagnósticos Ricos do Compilador (RFC-014)
- Mensagens de erro formatadas no padrão Rustc com arquivo, linha, coluna, trecho do código com ponteiros `^^^^`, código de erro (`E1001`, `E2001`, etc.) e sugestões `help:`.
- Eliminação completa de vazamento de stack traces do Node.js para o usuário final.

### 6. Unificação de Sintaxe de Blocos e Versionamento no `flex.toml` (RFC-016)
- Sintaxe limpa e unificada para blocos: remoção do operador `=>` em braços de `match`, tornando o padrão homogêneo em toda a linguagem (`padrão -> bloco`).
- Diagnóstico amigável `E1002` para quem utilizar a sintaxe legada.
- Versionamento e trava de compatibilidade no manifesto do projeto com `flex_version = "0.2.0"`.

---

## 🏛️ Projeto de Referência: Le Salvi API (`examples/08_le_salvi_api`)
- API REST modular de exemplo inspirada na plataforma de estética e beleza **Le Salvi**, cobrindo 100% dos recursos da linguagem de ponta a ponta.

---

## 🧪 Matriz de Validação
- **Golden Tests**: 35/35 aprovados.
- **Parity Gate (TS vs Go)**: 35/35 aprovados com 100% de paridade.
- **HTTP Integration Tests**: 96/96 testes aprovados em portas reais.
- **Watch Integration Tests**: 8/8 cenários de hot reload aprovados.
- **Compiler Diagnostics**: 26/26 asserções de spans e diagnósticos aprovadas.
- **Security Baseline**: 26/26 validações de mascaramento e segurança aprovadas.
