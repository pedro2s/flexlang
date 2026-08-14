import pg from "pg";
import type { Interpreter } from "../interpreter";
import { resultErr, resultOk } from "../stdlib";
import { NATIVE_TAG, type NativeModule } from "./types";

/**
 * Módulo nativo db/postgres (RFC-005).
 *
 * Em modo interpretado, usa o driver `pg` do npm. Em modo compilado, o
 * boilerplate Go usa `pgxpool` + `database/sql` conforme o RFC.
 *
 * Todo SQL é parametrizado por posição ($1, $2, ...) — não existe, por
 * design, nenhuma API que aceite concatenação de string do usuário.
 */

// Wrapper de transação para o modo interpretado
class FlexTx {
  readonly [NATIVE_TAG] = "Tx";

  constructor(private client: pg.PoolClient) {}

  async query(sql: string, params: unknown[]): Promise<unknown> {
    try {
      const result = await this.client.query(sql, params);
      // Cada linha vira um Map (struct FlexLang)
      const rows = result.rows.map((row: Record<string, unknown>) => {
        const map = new Map<string, unknown>();
        for (const [key, value] of Object.entries(row)) {
          map.set(key, value);
        }
        return map;
      });
      return resultOk(rows);
    } catch (e: any) {
      return resultErr(e.message ?? String(e));
    }
  }

  async query_one(sql: string, params: unknown[]): Promise<unknown> {
    try {
      const result = await this.client.query(sql, params);
      if (result.rows.length === 0) {
        return resultErr("query returned zero rows");
      }
      if (result.rows.length > 1) {
        return resultErr(`query returned ${result.rows.length} rows, expected exactly 1`);
      }
      const row = result.rows[0]!;
      const map = new Map<string, unknown>();
      for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
        map.set(key, value);
      }
      return resultOk(map);
    } catch (e: any) {
      return resultErr(e.message ?? String(e));
    }
  }

  async execute(sql: string, params: unknown[]): Promise<unknown> {
    try {
      const result = await this.client.query(sql, params);
      return resultOk(result.rowCount ?? 0);
    } catch (e: any) {
      return resultErr(e.message ?? String(e));
    }
  }
}

// Pool de conexões para o modo interpretado
class FlexPool {
  readonly [NATIVE_TAG] = "Pool";

  constructor(
    private pool: pg.Pool,
    private interpreter: Interpreter,
  ) {}

  async query(sql: string, params: unknown[]): Promise<unknown> {
    try {
      const result = await this.pool.query(sql, params);
      const rows = result.rows.map((row: Record<string, unknown>) => {
        const map = new Map<string, unknown>();
        for (const [key, value] of Object.entries(row)) {
          map.set(key, value);
        }
        return map;
      });
      return resultOk(rows);
    } catch (e: any) {
      return resultErr(e.message ?? String(e));
    }
  }

  async query_one(sql: string, params: unknown[]): Promise<unknown> {
    try {
      const result = await this.pool.query(sql, params);
      if (result.rows.length === 0) {
        return resultErr("query returned zero rows");
      }
      if (result.rows.length > 1) {
        return resultErr(`query returned ${result.rows.length} rows, expected exactly 1`);
      }
      const row = result.rows[0]!;
      const map = new Map<string, unknown>();
      for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
        map.set(key, value);
      }
      return resultOk(map);
    } catch (e: any) {
      return resultErr(e.message ?? String(e));
    }
  }

  async execute(sql: string, params: unknown[]): Promise<unknown> {
    try {
      const result = await this.pool.query(sql, params);
      return resultOk(result.rowCount ?? 0);
    } catch (e: any) {
      return resultErr(e.message ?? String(e));
    }
  }

  /**
   * Transação: adquire uma conexão do pool, executa BEGIN, chama o callback
   * FlexLang (lambda) com um FlexTx, e faz COMMIT se sucesso ou ROLLBACK se
   * o callback lança exceção.
   */
  async transaction(callback: unknown): Promise<unknown> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const tx = new FlexTx(client);
      await this.interpreter.callFunction(callback, [tx]);
      await client.query("COMMIT");
      return resultOk(null);
    } catch (e: any) {
      await client.query("ROLLBACK");
      return resultErr(e.message ?? String(e));
    } finally {
      client.release();
    }
  }
}

// Boilerplate Go para transpilação (database/sql)
const GO_BOILERPLATE = [
  "// --- FlexLang db/postgres Boilerplate (RFC-005) ---",
  "",
  "type Pool struct {",
  "  db *sql.DB",
  "}",
  "",
  "type Tx struct {",
  "  tx *sql.Tx",
  "}",
  "",
  "func Pool_connect(url string) Result {",
  '  db, err := sql.Open("postgres", url)',
  "  if err != nil {",
  '    return Result_Err_new(err.Error())',
  "  }",
  "  if err := db.Ping(); err != nil {",
  '    return Result_Err_new(err.Error())',
  "  }",
  "  return Result_Ok_new(&Pool{db: db})",
  "}",
  "",
  "func (p *Pool) query(querySql string, params []any) Result {",
  "  rows, err := p.db.Query(querySql, params...)",
  "  if err != nil {",
  '    return Result_Err_new(err.Error())',
  "  }",
  "  defer rows.Close()",
  "  cols, err := rows.Columns()",
  "  if err != nil {",
  '    return Result_Err_new(err.Error())',
  "  }",
  "  var result []map[string]any",
  "  for rows.Next() {",
  "    columns := make([]any, len(cols))",
  "    columnPointers := make([]any, len(cols))",
  "    for i := range columns {",
  "      columnPointers[i] = &columns[i]",
  "    }",
  "    if err := rows.Scan(columnPointers...); err != nil {",
  '      return Result_Err_new(err.Error())',
  "    }",
  "    row := make(map[string]any)",
  "    for i, colName := range cols {",
  "      val := columnPointers[i].(*any)",
  "      row[colName] = *val",
  "    }",
  "    result = append(result, row)",
  "  }",
  "  return Result_Ok_new(result)",
  "}",
  "",
  "func (p *Pool) query_one(querySql string, params []any) Result {",
  "  rows, err := p.db.Query(querySql, params...)",
  "  if err != nil {",
  '    return Result_Err_new(err.Error())',
  "  }",
  "  defer rows.Close()",
  "  cols, err := rows.Columns()",
  "  if err != nil {",
  '    return Result_Err_new(err.Error())',
  "  }",
  "  if !rows.Next() {",
  '    return Result_Err_new("query returned zero rows")',
  "  }",
  "  columns := make([]any, len(cols))",
  "  columnPointers := make([]any, len(cols))",
  "  for i := range columns {",
  "    columnPointers[i] = &columns[i]",
  "  }",
  "  if err := rows.Scan(columnPointers...); err != nil {",
  '    return Result_Err_new(err.Error())',
  "  }",
  "  row := make(map[string]any)",
  "  for i, colName := range cols {",
  "    val := columnPointers[i].(*any)",
  "    row[colName] = *val",
  "  }",
  "  if rows.Next() {",
  '    return Result_Err_new("query returned more than one row")',
  "  }",
  "  return Result_Ok_new(row)",
  "}",
  "",
  "func (p *Pool) execute(querySql string, params []any) Result {",
  "  res, err := p.db.Exec(querySql, params...)",
  "  if err != nil {",
  '    return Result_Err_new(err.Error())',
  "  }",
  "  affected, err := res.RowsAffected()",
  "  if err != nil {",
  '    return Result_Err_new(err.Error())',
  "  }",
  "  return Result_Ok_new(int(affected))",
  "}",
  "",
  "func (p *Pool) transaction(callback func(*Tx)) Result {",
  "  tx, err := p.db.Begin()",
  "  if err != nil {",
  '    return Result_Err_new(err.Error())',
  "  }",
  "  defer func() {",
  "    if r := recover(); r != nil {",
  "      tx.Rollback()",
  "      panic(r)",
  "    }",
  "  }()",
  "  callback(&Tx{tx: tx})",
  "  if err := tx.Commit(); err != nil {",
  '    return Result_Err_new(err.Error())',
  "  }",
  "  return Result_Ok_new(nil)",
  "}",
  "",
  "func (t *Tx) query(querySql string, params []any) Result {",
  "  rows, err := t.tx.Query(querySql, params...)",
  "  if err != nil {",
  '    return Result_Err_new(err.Error())',
  "  }",
  "  defer rows.Close()",
  "  cols, err := rows.Columns()",
  "  if err != nil {",
  '    return Result_Err_new(err.Error())',
  "  }",
  "  var result []map[string]any",
  "  for rows.Next() {",
  "    columns := make([]any, len(cols))",
  "    columnPointers := make([]any, len(cols))",
  "    for i := range columns {",
  "      columnPointers[i] = &columns[i]",
  "    }",
  "    if err := rows.Scan(columnPointers...); err != nil {",
  '      return Result_Err_new(err.Error())',
  "    }",
  "    row := make(map[string]any)",
  "    for i, colName := range cols {",
  "      val := columnPointers[i].(*any)",
  "      row[colName] = *val",
  "    }",
  "    result = append(result, row)",
  "  }",
  "  return Result_Ok_new(result)",
  "}",
  "",
  "func (t *Tx) query_one(querySql string, params []any) Result {",
  "  rows, err := t.tx.Query(querySql, params...)",
  "  if err != nil {",
  '    return Result_Err_new(err.Error())',
  "  }",
  "  defer rows.Close()",
  "  cols, err := rows.Columns()",
  "  if err != nil {",
  '    return Result_Err_new(err.Error())',
  "  }",
  "  if !rows.Next() {",
  '    return Result_Err_new("query returned zero rows")',
  "  }",
  "  columns := make([]any, len(cols))",
  "  columnPointers := make([]any, len(cols))",
  "  for i := range columns {",
  "    columnPointers[i] = &columns[i]",
  "  }",
  "  if err := rows.Scan(columnPointers...); err != nil {",
  '    return Result_Err_new(err.Error())',
  "  }",
  "  row := make(map[string]any)",
  "  for i, colName := range cols {",
  "    val := columnPointers[i].(*any)",
  "    row[colName] = *val",
  "  }",
  "  if rows.Next() {",
  '    return Result_Err_new("query returned more than one row")',
  "  }",
  "  return Result_Ok_new(row)",
  "}",
  "",
  "func (t *Tx) execute(querySql string, params []any) Result {",
  "  res, err := t.tx.Exec(querySql, params...)",
  "  if err != nil {",
  '    return Result_Err_new(err.Error())',
  "  }",
  "  affected, err := res.RowsAffected()",
  "  if err != nil {",
  '    return Result_Err_new(err.Error())',
  "  }",
  "  return Result_Ok_new(int(affected))",
  "}",
  "",
  "// -------------------------------------------",
].join("\n");

export const postgresModule: NativeModule = {
  path: "db/postgres",

  types: [
    {
      name: "Pool",
      statics: [
        {
          name: "connect",
          arity: 1,
          returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "Struct", name: "Pool", genericArgs: [] }, { kind: "String" }] },
        },
      ],
      methods: [
        {
          name: "query",
          arity: 2,
          returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "Array", elementType: { kind: "Any" } }, { kind: "String" }] },
        },
        {
          name: "query_one",
          arity: 2,
          returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "Any" }, { kind: "String" }] },
        },
        {
          name: "execute",
          arity: 2,
          returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "Int" }, { kind: "String" }] },
        },
        {
          name: "transaction",
          arity: 1,
          returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "Void" }, { kind: "String" }] },
        },
      ],
    },
    {
      name: "Tx",
      methods: [
        {
          name: "query",
          arity: 2,
          returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "Array", elementType: { kind: "Any" } }, { kind: "String" }] },
        },
        {
          name: "query_one",
          arity: 2,
          returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "Any" }, { kind: "String" }] },
        },
        {
          name: "execute",
          arity: 2,
          returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "Int" }, { kind: "String" }] },
        },
      ],
    },
  ],

  usesBuiltins: ["Result"],

  runtimeBinding: (interpreter) => ({
    Pool: {
      [NATIVE_TAG]: "Pool",
      connect: async (url: string) => {
        try {
          const pool = new pg.Pool({
            connectionString: url,
            // Timeout curto para não pendurar o processo quando não há banco
            connectionTimeoutMillis: 3000,
          });
          // Valida a conexão com um ping
          const client = await pool.connect();
          client.release();
          return resultOk(new FlexPool(pool, interpreter));
        } catch (e: any) {
          return resultErr(e.message ?? String(e));
        }
      },
    },
  }),

  goCodegen: {
    imports: ["database/sql"],
    boilerplate: GO_BOILERPLATE,
  },
};
