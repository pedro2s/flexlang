# RFC-005: Módulo Nativo `db/postgres`

> **Status:** Draft · **Prioridade:** P0 — bloqueante · **Depende de:** RFC-002, RFC-003
> **Relacionado:** RFC-009 (parametrização obrigatória de query é requisito de segurança, não só de design de API)

## Resumo

Nenhuma "API moderna e funcional" do PRD sobe em produção sem persistência. Esta RFC define o primeiro (e único, na v1.0) driver de banco nativo da FlexLang: PostgreSQL, via interop com `database/sql` + `github.com/jackc/pgx` do ecossistema Go (conforme já decidido no ADR-001 do roadmap arquitetural, Seção 6), exposto como um `NativeModule` (RFC-003).

## Motivação

Um CRUD sem banco não é um caso de uso de produção — é um exemplo de documentação. O PRD exige explicitamente que o caso de uso de referência persista em PostgreSQL (Seção 2).

## Não-objetivos

- **Não** é um ORM ou query builder — isso é Fase 6+ do roadmap arquitetural, deliberadamente pós-v1.0. A v1.0 expõe **query parametrizada crua**, não um mapeamento objeto-relacional.
- **Não** cobre migrations de schema — o time gerencia migrations com a ferramenta que preferir (`golang-migrate`, SQL puro) fora da FlexLang por enquanto; automatizar isso é uma RFC futura, não um bloqueio de v1.0.
- **Não** cobre outros bancos (MySQL, SQLite) — PostgreSQL é o único alvo da v1.0, conforme o roadmap arquitetural já havia decidido.

## Design Detalhado

### 1. Superfície da API

```flexlang
import { Pool } from "db/postgres";

func main() -> Result<Void, AppError> {
    let db = Pool.connect(env("DATABASE_URL"))?; // pool de conexões, não uma conexão única

    let user = db.query_one<User>(
        "SELECT id, name, email FROM users WHERE id = $1",
        [id],
    )?;

    let users = db.query<User>("SELECT id, name, email FROM users LIMIT $1", [20])?;

    db.execute("INSERT INTO users (name, email) VALUES ($1, $2)", [name, email])?;

    return Ok(Void);
}
```

- `Pool.connect(url)` → `Result<Pool, DbError>` — conecta e valida a URL, devolve um pool (não uma conexão crua) desde o início: nenhuma API de produção deve abrir uma conexão por request.
- `db.query_one<T>(sql, params)` → `Result<T, DbError>` (erro se zero ou mais de uma linha).
- `db.query<T>(sql, params)` → `Result<[T], DbError>`.
- `db.execute(sql, params)` → `Result<Int, DbError>` (linhas afetadas), para `INSERT`/`UPDATE`/`DELETE`.
- **Todo SQL é parametrizado por posição (`$1`, `$2`, ...)** — não existe, deliberadamente, nenhuma função de query que aceite concatenação de string do usuário. Isso não é só estilo: é a defesa primária contra SQL injection, e é imposta pela própria assinatura da API (RFC-009 formaliza isso como requisito de segurança).

### 2. Mapeamento `T` → linha do banco

O `T` de `query_one<T>`/`query<T>` é um `struct` FlexLang cujos campos, na v1.0, mapeiam por **posição** das colunas do `SELECT` (não por nome) — mais simples de implementar corretamente na primeira versão, e força o desenvolvedor a manter o `SELECT` e o `struct` sincronizados explicitamente (erro claro em tempo de execução se a contagem de colunas não bater com a contagem de campos do struct).

### 3. Transações

```flexlang
db.transaction(|tx| {
    tx.execute("UPDATE accounts SET balance = balance - $1 WHERE id = $2", [amount, from])?;
    tx.execute("UPDATE accounts SET balance = balance + $1 WHERE id = $2", [amount, to])?;
})?;
```

Depende de closures como parâmetro de função — hoje a FlexLang **não tem** literais de lambda (Lacuna 5 do roadmap arquitetural). Esta RFC assume que a sintaxe de closure mínima (só o suficiente para `|tx| { ... }` como parâmetro de uma função nativa, sem closures gerais como cidadãs de primeira classe em todo o resto da linguagem) é resolvida como parte desta RFC ou como uma sub-tarefa compartilhada com RFC-004 (que também precisa de handlers passáveis inline, embora hoje contorne isso com funções nomeadas). Se o prazo apertar, a v1.0 pode escapar com `tx.begin()`/`tx.commit()`/`tx.rollback()` explícitos em vez de `db.transaction(|tx| {...})` — ver "Riscos".

### 4. Runtime binding (modo interpretado)

Em modo interpretado (`flex run`), o `Pool` do FlexLang envolve o driver `pg` real via uma ponte Node↔Postgres (ex: biblioteca `pg` do npm) — o modo laboratório continua sendo Node (ADR-001), então o binding de runtime não pode depender de Go estar instalado só para rodar `flex run` localmente.

### 5. Transpilação para Go

`Pool` mapeia para `*pgxpool.Pool` do `github.com/jackc/pgx/v5/pgxpool`; `query_one<T>`/`query<T>` mapeiam para `pool.QueryRow`/`pool.Query` + `Scan` posicional nos campos do struct Go correspondente (já gerado pela RFC-001 para o `struct` FlexLang).

## Plano de Testes

1. Teste de integração com um Postgres real (via `docker compose` local ou um `testcontainers`-like ad-hoc) — não é golden-file puro, porque envolve um serviço externo. Ver `test_plan.md` para a estratégia de CI (subir um Postgres efêmero no pipeline).
2. Teste de erro: query malformada, violação de constraint (`UNIQUE`), e conexão recusada devem devolver `Result.Err` tipado, nunca lançar exceção não tratada.
3. Teste de injeção: confirmar que um valor de parâmetro contendo `'; DROP TABLE users; --` é tratado como dado, não como SQL, em todo caminho de `query`/`execute`.
4. Parity gate (RFC-001): mesmo teste de CRUD rodando via `flex run` (driver Node) e `flex build` (driver Go), validando que os resultados batem.

## Critério de Aceite

- [ ] `Pool.connect`, `query_one`, `query`, `execute` implementados em modo interpretado e compilado.
- [ ] 100% das operações de banco são parametrizadas — nenhuma API aceita SQL concatenado com dado do usuário.
- [ ] Teste de integração com Postgres real passa em CI.
- [ ] Erros de banco (conexão, constraint, SQL inválido) chegam como `Result.Err` tipado, nunca como crash do processo.

## Riscos e Alternativas Consideradas

- **Risco principal**: transações via closure (`db.transaction(|tx| {...})`) dependem de uma feature de linguagem (lambdas) que hoje não existe. Mitigação: se a sintaxe de lambda não estiver pronta a tempo, a v1.0 libera com a API explícita `tx.begin()/commit()/rollback()` e adia o açúcar de closure para logo depois — a Seção "Design Detalhado, item 3" já registra esse plano B.
- **Alternativa descartada**: um ORM leve em vez de query crua parametrizada. Rejeitada pelo PRD (Seção 4, fora de escopo) — query crua é suficiente para o caso de uso de referência e não impõe uma opinião de mapeamento objeto-relacional cedo demais.
