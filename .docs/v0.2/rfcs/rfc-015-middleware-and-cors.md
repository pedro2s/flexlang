# RFC-015: Middleware, Headers e CORS

> **Status:** Draft · **Prioridade:** P1 · **Depende de:** RFC-011 (o despacho por verbo é onde a cadeia se encaixa)
> **Toca:** `src/modules/http.ts`

## Resumo

Não existe forma de interceptar uma requisição antes do handler, nem de ler um header. Toda API com autenticação teria de repetir a mesma verificação dentro de cada handler. Esta RFC adiciona `server.use(...)`, acesso a headers, e CORS configurável.

## Motivação

`FlexRequest` (`http.ts:64`) expõe `param`, `param_int`, `query`, `query_int` e `json` — não há acesso a headers, o que sozinho já inviabiliza `Authorization`, `Content-Type` negociado ou qualquer coisa baseada em cabeçalho. E `FlexServer` não tem nenhum ponto de extensão entre receber a requisição e chamar o handler.

Sem isso, uma API de dez rotas autenticadas tem dez cópias da mesma checagem — e a décima primeira, escrita com pressa, é a que esquece.

## Design

### 3.1 Middleware é um handler comum; responder encerra a cadeia

```flexlang
func require_auth(req: Request, mut res: Response) {
    match req.header("Authorization") {
        Option.None    => { res.error(401, "unauthorized"); },  // respondeu → para aqui
        Option.Some(t) => { },                                   // não respondeu → segue
    }
}

let mut server = Server.new(":8080");
server.use(require_auth);
server.get("/products", list_products);
```

Um middleware tem **exatamente a mesma assinatura de um handler** — `func(Request, mut Response)`. A regra de controle de fluxo é uma só:

> Se o middleware escreveu uma resposta, a cadeia para. Se não escreveu, a requisição segue para o próximo middleware e, no fim, para o handler.

Nenhum tipo novo, nenhum `next()`, nenhuma closure aninhada. O estado necessário já existe: `FlexResponse` rastreia `written` (`http.ts:108`) e ignora escritas repetidas (`http.ts:137`) — a cadeia só precisa consultar esse campo.

**Por que não `next()` no estilo Express:** encadear callbacks é exatamente o "callback hell" que a linguagem se propõe a evitar; exigiria um tipo `Next` invocável, closures aninhadas e uma regra sobre chamar `next()` duas vezes. **Por que não `-> Result<Void, String>`:** obriga o middleware a escrever a resposta *e* devolver um sinal redundante, criando um estado inconsistente possível (retornou `Err` mas não respondeu — e aí, qual status?). "Respondeu = parou" tem uma fonte de verdade só.

### 3.2 Ordem e alcance

Middlewares rodam **na ordem de registro, antes do roteamento** — não apenas em rotas que casaram. É o que faz `require_auth` proteger também caminhos inexistentes: sem isso, um `404` responde antes da autenticação e expõe quais rotas existem para quem não está autenticado.

**`GET /healthz` é isento de toda a cadeia.** É o erro clássico de operação: o middleware de auth passa a valer para tudo, o health check começa a responder `401`, e o orquestrador tira todas as instâncias saudáveis do ar em produção. A isenção é do próprio runtime e não é configurável na v0.2 — um health check autenticado não é um requisito que apareça antes de uma RFC dedicada.

### 3.3 Headers

```flexlang
req.header("Authorization")     // -> Option<String>, nome case-insensitive
res.header("X-Request-Id", id)  // encadeável, como res.status(...)
```

`req.header` devolve `Option` (ausência não é erro, é o caso comum) e normaliza o nome para minúsculas antes de comparar, porque nomes de header são case-insensitive por especificação (RFC 7230 §3.2) — em Go, `http.Header.Get` já normaliza; no Node, `req.headers` já vem em minúsculas. Sem a normalização explícita, `Authorization` e `authorization` divergiriam entre os dois modos.

`res.header(...)` precisa ser aplicado antes de `json`/`error`, pelo mesmo motivo que `res.status(...)`: depois de escrever o corpo, o cabeçalho já foi enviado. A chamada tardia é ignorada, coerente com `write` já ser idempotente.

### 3.4 CORS

```flexlang
server.cors(CorsConfig {
    allow_origins: ["https://app.exemplo.com"],
    allow_methods: ["GET", "POST", "PUT", "DELETE"],
    allow_headers: ["Authorization", "Content-Type"],
    max_age: 86400,
});
```

- **Sem `server.cors(...)`, nenhum header CORS é emitido** — o comportamento seguro por omissão (RFC-009), e o atual.
- `allow_origins` é uma lista explícita. **`"*"` é aceito mas nunca é o default**, e não pode ser combinado com credenciais — a combinação que os navegadores rejeitam e que costuma ser copiada de tutorial.
- O **preflight `OPTIONS`** é respondido pelo runtime com `Access-Control-Allow-*` e `204`, integrando-se ao `OPTIONS` automático da RFC-011 §5.4: sem CORS configurado, responde só `Allow`; com CORS, adiciona os headers e o `Max-Age`.
- Origem não permitida: a requisição **não** é bloqueada no servidor; apenas os headers CORS não são emitidos, e o navegador bloqueia. É como CORS funciona — bloquear no servidor daria a falsa impressão de ser um controle de acesso, o que CORS não é.

### 3.5 Não-objetivos

- **Middleware por rota ou por grupo/prefixo** (`server.group("/admin")`). A v0.2 tem cadeia global. Agrupamento é a evolução natural, mas exige decidir precedência entre grupos e ordem relativa à cadeia global — pesado demais para entrar junto.
- **Contexto de requisição** (o middleware de auth passar o `user_id` decodificado ao handler). É a lacuna mais sentida depois desta RFC: hoje o handler teria de decodificar o token de novo. Exige um mapa mutável por requisição atravessando a cadeia, com implicações no checker (tipagem do valor guardado) e na regra de mutabilidade. Merece RFC própria na v0.3.
- **Middleware de terceiros.** Não há gerenciador de pacotes (`flex mod` é pós-v1.0); `use` recebe funções do próprio projeto.
- **Rate limiting, compressão, sessão.** Construíveis sobre `use` quando houver contexto de requisição; nenhum é bloqueante para o caso de uso do PRD.

## Plano de testes

1. **Golden**: `server.use(...)`, `req.header`, `res.header` e `server.cors(...)` type-checam e transpilam.
2. **Integração** (os dois modos):
   - middleware que responde `401` impede o handler de executar (verificado por efeito observável, não só pelo status);
   - middleware que não responde deixa a requisição seguir;
   - dois middlewares executam na ordem de registro;
   - `GET /healthz` responde `200` mesmo com middleware que bloqueia tudo — a regressão operacional do §3.2;
   - middleware roda também em path inexistente (bloqueia antes do `404`);
   - `req.header` case-insensitive (`Authorization` e `authorization` devolvem o mesmo);
   - preflight `OPTIONS` com CORS configurado devolve `204` e os `Access-Control-Allow-*`;
   - sem `server.cors(...)`, nenhuma resposta contém header `Access-Control-*`.
3. **Parity gate**: os cenários acima comparando status, corpo e headers entre interpretado e compilado.
4. **Segurança (RFC-009)**: um header `Authorization` capturado em log é mascarado — `authorization` já está na lista de chaves sensíveis (`src/modules/log.ts`), e o caminho novo não pode contorná-la.

## Critério de aceite

- [ ] `server.use(...)` executa na ordem de registro, antes do roteamento.
- [ ] Middleware que responde encerra a cadeia; que não responde, deixa seguir.
- [ ] `/healthz` nunca passa pela cadeia.
- [ ] `req.header` é case-insensitive nos dois modos; `res.header` funciona antes do corpo.
- [ ] CORS ausente por padrão; quando configurado, cobre preflight.

## Alternativas consideradas

- **`next()` estilo Express** — §3.1: reintroduz o encadeamento de callbacks que a linguagem evita.
- **`-> Result<Void, String>`** — §3.1: duas fontes de verdade para a mesma decisão, com estados inconsistentes possíveis.
- **CORS como middleware escrito pelo usuário** — descartada: preflight correto envolve detalhes (`Vary: Origin`, `Max-Age`, interação com `OPTIONS`) que quase toda implementação manual erra; é exatamente o tipo de coisa que a stdlib deve resolver uma vez.
