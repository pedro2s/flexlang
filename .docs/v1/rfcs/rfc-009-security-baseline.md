# RFC-009: Baseline de Segurança para v1.0

> **Status:** Draft · **Prioridade:** P0 — bloqueante · **Depende de:** RFC-004, RFC-005 (define requisitos sobre as superfícies que elas expõem)

## Resumo

Esta RFC não introduz features novas de linguagem — formaliza, como requisitos testáveis, decisões de segurança que já apareceram como menções pontuais nas RFC-004 e RFC-005 (parametrização obrigatória de SQL, limite de corpo HTTP). O objetivo é ter uma lista única e auditável do que "seguro por padrão" significa para a v1.0, em vez de depender de cada RFC lembrar sozinha.

## Motivação

"Pronto para produção" sem baseline de segurança é uma contradição — é o tipo de lacuna que só aparece depois de um incidente. Esta RFC existe para que isso seja decidido antes, não descoberto depois.

## Não-objetivos

- Não é uma auditoria de segurança completa (pentest, análise de supply chain de dependências Go) — isso é processo de release (ver `release_plan.md`), não design de linguagem.
- Não inclui autenticação/autorização nativa (OAuth, JWT) — a v1.0 permite implementar isso no nível da aplicação (com `net/http` da RFC-004), mas não fornece um framework de auth embutido; é candidato natural de v1.1+, quando houver mais de um padrão de uso real para generalizar.

## Requisitos (cada um rastreável a uma RFC)

| # | Requisito | Onde é imposto |
|---|---|---|
| 1 | Toda query de banco é parametrizada por posição; não existe API que aceite SQL concatenado com dado do usuário | RFC-005, assinatura de `query`/`execute` |
| 2 | Corpo de requisição HTTP tem limite de tamanho por padrão (1 MB), configurável para cima, nunca ilimitado por padrão | RFC-004, `ServerConfig.max_body_size` |
| 3 | Toda requisição tem timeout de leitura por padrão (5s), evitando conexões penduradas consumindo recursos indefinidamente | RFC-004, `ServerConfig.read_timeout` |
| 4 | Um panic/erro não tratado nunca deve vazar stack trace ou detalhe interno na resposta HTTP ao cliente — só um erro genérico; o detalhe vai para o log estruturado, não para a resposta | RFC-008 (`defer/recover` → `w.WriteHeader(500)` sem corpo detalhado) |
| 5 | Segredos (strings de conexão, senhas, tokens) nunca aparecem em texto claro em log — `log.error`/`log.info` (RFC-008) devem mascarar campos conhecidos por nome (`password`, `token`, `secret`, `authorization`, case-insensitive) | RFC-008, `core/log` |
| 6 | `Pool.connect` (RFC-005) lê a URL de conexão de variável de ambiente (`env("DATABASE_URL")`), nunca hardcoded como literal no código — reforçado por convenção/exemplo, não por uma checagem estática (ver "Riscos") |RFC-005 |

## Design Detalhado

### Mascaramento de log (item 5) — o único mecanismo novo desta RFC

`core/log` (RFC-008) mantém uma lista fixa de nomes de campo sensíveis (case-insensitive: `password`, `secret`, `token`, `authorization`, `api_key`) e substitui o valor por `"***"` antes de serializar para JSON, independentemente de onde o campo aparece na estrutura passada a `log.info`/`log.error`. Isso é aplicado **na borda do logger**, não no código do usuário — para não depender de disciplina manual de cada handler lembrar de mascarar.

```flexlang
log.info("login attempt", { user: email, password: raw_password });
// saída: {"level":"info","msg":"login attempt","user":"...","password":"***"}
```

### Resposta de erro genérica (item 4)

Reaproveita o `defer/recover` da RFC-008: a resposta HTTP em caso de panic é sempre `{"error": "internal server error"}` com status 500, nunca o texto da exceção Go/JS original — esse texto vai só para o log estruturado (que tem os controles de acesso do próprio ambiente de produção, não a resposta HTTP pública).

## Plano de Testes

1. Tentativa de SQL injection via parâmetro de query (`'; DROP TABLE users; --`) deve ser tratada como dado literal (teste já descrito na RFC-005, referenciado aqui como requisito de segurança formal).
2. Corpo de requisição maior que o limite deve ser rejeitado com 413 antes de ser totalmente lido em memória (não só rejeitado depois de já ter alocado o corpo inteiro).
3. Um panic em handler não deve expor a mensagem original na resposta HTTP — teste inspeciona o corpo da resposta 500 e confirma que não contém a string original do erro.
4. `log.info`/`log.error` com um campo chamado `password`/`token`/`secret` deve mascarar o valor na saída, testado com variações de capitalização.

## Critério de Aceite

- [ ] Todos os 6 requisitos da tabela têm teste automatizado correspondente.
- [ ] Nenhum requisito depende de o desenvolvedor lembrar manualmente de fazer algo — todos são padrão/automático (defaults seguros), com opção explícita de opt-out onde fizer sentido (ex: aumentar `max_body_size`).

## Riscos e Alternativas Consideradas

- **Risco aceito, não resolvido nesta RFC**: o item 6 (segredo nunca hardcoded) é reforçado só por convenção e exemplo de documentação, não por uma checagem estática do compilador (ex: um linter que reprove uma `StringLiteral` passada diretamente a `Pool.connect`). Adicionar essa checagem é candidato de RFC futura, não bloqueante para v1.0 — o risco residual é aceito porque a alternativa (linter de padrão de string) tem alta taxa de falso positivo/negativo para valer o esforço agora.
- **Alternativa descartada**: mascaramento de log configurável por regex de usuário. Rejeitada para v1.0 — uma lista fixa de nomes comuns cobre o caso comum sem introduzir superfície de configuração nova.
