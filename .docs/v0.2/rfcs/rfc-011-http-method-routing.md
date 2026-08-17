# RFC-011: Roteamento por Verbo HTTP

> **Status:** Implementado · **Prioridade:** P0 — bloqueante · **Depende de:** nada
> **Toca:** `src/modules/http.ts` (interpretador + boilerplate Go), `tests/http_integration.ts`
> **Breaking change:** remove `server.route(path, handler)`

## Resumo

O roteador da FlexLang casa apenas o path e ignora o método HTTP: `GET /users` e `POST /users` não podem ter handlers diferentes. Esta RFC introduz roteamento por verbo (`get`, `post`, `put`, `patch`, `delete`), com a semântica HTTP correta de `405 Method Not Allowed`.

## Motivação

Verificado no código: `FlexServer.route` (`http.ts:166`) empurra `{segments, handler}` para uma lista, e `matchRoute` (`http.ts:32`) compara só os segmentos do path. `req.method` é lido uma única vez em todo o arquivo — na checagem literal do health check (`http.ts:177`). O boilerplate Go faz exatamente o mesmo (`http.ts:417`).

Consequência prática: `DELETE /users/42` executa o handler registrado para `GET /users/:id`, e responde `200` deletando nada. Isso não é uma limitação de conveniência — impossibilita o CRUD, que é o caso de uso declarado da linguagem.

## Design

### 5.1 Um método por verbo

```flexlang
server.get("/products", list_products);
server.post("/products", create_product);
server.put("/products/:id", replace_product);
server.patch("/products/:id", patch_product);
server.delete("/products/:id", delete_product);
```

**Por que métodos dedicados e não `server.route("GET", path, handler)`:** um verbo escrito errado (`"GET"`) só falharia em runtime, com uma rota que silenciosamente nunca casa — o pior tipo de bug, porque o servidor sobe normalmente. Com métodos dedicados, `server.gett(...)` é erro de compilação, gratuitamente, porque o checker já valida nomes de método nativo (`checker.ts:880`). É também a convenção de Express, Fastify, Gin e Echo, o que reduz o custo de aprendizado a zero para o público-alvo.

`delete` não conflita com nenhuma palavra reservada da FlexLang (a lista está em `lexer.ts:7-32`), então não precisa de tratamento especial.

### 5.2 Estrutura de dados

`CompiledRoute` (`http.ts:25`) ganha um campo:

```ts
interface CompiledRoute {
  method: string;      // "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  segments: string[];
  handler: unknown;
}
```

O casamento continua **linear na ordem de registro**, agora comparando método e segmentos. Manter linear é deliberado — ver PRD §4.

### 5.3 `404` vs `405`: a parte que exige cuidado

O despacho passa a ter duas fases, porque a distinção entre "esse recurso não existe" e "esse recurso existe mas não aceita esse verbo" é justamente o que um cliente REST precisa para depurar:

1. Varre as rotas casando **path + método**. Casou → executa.
2. Se nenhuma casou, varre de novo casando **só o path**, coletando os métodos disponíveis:
   - lista vazia → `404 {"error": "not found"}` (comportamento atual, preservado)
   - lista não vazia → `405 {"error": "method not allowed"}` **com header `Allow: GET, POST`**

O header `Allow` é obrigatório em respostas 405 pela RFC 7231 §6.5.5. Omiti-lo é o tipo de detalhe que faz um cliente HTTP bem-comportado se perder.

### 5.4 `HEAD` e `OPTIONS` automáticos

- **`HEAD /x`** é atendido pelo handler de `GET /x`, com o corpo descartado. Clientes e health checkers usam `HEAD` rotineiramente; exigir registro manual seria ruído.
- **`OPTIONS /x`** responde `204` com `Allow` listando os verbos registrados naquele path. Isso já entrega o preflight de CORS pela metade e conecta diretamente com a RFC-015.

Nenhum dos dois é registrável manualmente na v0.2 — são derivados. Se um dia alguém precisar de um `HEAD` com semântica própria, isso vira uma RFC nova.

### 5.5 Migração de `server.route`

`route` **é removido**, não mantido como alias. Um alias que aceita qualquer verbo perpetuaria exatamente o bug que esta RFC corrige, e de forma invisível.

Para não deixar quem já escreveu código na v0.1.x com um erro genérico, o checker ganha um caso especial: ao ver `server.route(...)`, emite

```
error: `server.route` foi removido na v0.2.0
 --> src/main.flex:12:8
  |
12| server.route("/users", handler);
  |        ^^^^^ use `server.get`, `server.post`, `server.put`, `server.patch` ou `server.delete`
  |
help: veja RFC-011 — o roteamento agora considera o verbo HTTP
```

São poucas linhas no checker e é a diferença entre uma migração de trinta segundos e uma de meia hora. O caso especial sai na v0.3.

### 5.6 Superfície do módulo nativo

Em `httpModule.types`, o tipo `Server` troca a assinatura de `route` pelas cinco novas, todas `{ arity: 2, returns: { kind: "Void" } }`. O boilerplate Go recebe as mesmas cinco (`func (s *Server) get(path string, handler func(Request, *Response))`, etc.), mais a lógica de duas fases do §5.3 dentro de `dispatch`.

## Plano de testes

1. **Golden**: registro dos cinco verbos type-checa e transpila (equivalente ao `tests/23_http_v1.flex` atual).
2. **Integração** (`tests/http_integration.ts`, os dois modos):
   - cada verbo chega ao seu handler, e só a ele;
   - `GET` em path registrado só para `POST` → `405` + `Allow: POST`;
   - path inexistente → `404` (sem regressão);
   - `HEAD` em rota `GET` → `200` sem corpo;
   - `OPTIONS` → `204` + `Allow` com todos os verbos daquele path.
3. **Negativo**: `server.route(...)` produz a mensagem de migração do §5.5, não "method not found".
4. **Parity gate**: os cenários acima rodam interpretado e compilado, comparando status, corpo e header `Allow`.

## Critério de aceite

- [ ] Os cinco verbos roteiam independentemente, nos dois modos.
- [ ] `405` com `Allow` correto quando o path existe mas o verbo não.
- [ ] `404` preservado quando o path não existe.
- [ ] `HEAD`/`OPTIONS` derivados automaticamente.
- [ ] `server.route` dá a mensagem de migração dedicada.

## Alternativas consideradas

- **`server.route(method, path, handler)` com string de verbo** — descartada no §5.1: erro de digitação vira rota morta silenciosa em vez de erro de compilação.
- **Manter `route` como "aceita qualquer verbo"** — descartada: é o bug atual, com um nome novo. Explicitar `server.any(...)` também foi descartado por não haver caso de uso real que o justifique na v0.2.
- **Registrar `HEAD`/`OPTIONS` manualmente** — descartada: são derivações mecânicas dos verbos já registrados; exigir registro é repasse de trabalho ao usuário sem ganho de expressividade.
