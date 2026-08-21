# RFC-027 — Módulo `core/time` — Timestamps, Duração e Formatação

> **Status:** Implementado · **Prioridade:** P0 — bloqueante · **Depende de:** nada

## 1. Motivação

Sem um módulo de tempo, é impossível: medir latência de operações, criar timestamps para auditoria, definir TTL de tokens, calcular prazos de vencimento, agendar retries com backoff exponencial, ou formatar datas para resposta de API.

## 2. API

```flexlang
import { Time, Duration } from "core/time";
```

### 2.1 Timestamps

| Método | Assinatura | Retorno | Descrição |
|---|---|---|---|
| `Time.now()` | estático | `Time` | Timestamp UTC atual |
| `Time.from_unix(secs)` | `Time.from_unix(secs: Int)` | `Time` | Timestamp a partir de epoch Unix |
| `t.unix()` | instância | `Int` | Epoch Unix em segundos |
| `t.unix_millis()` | instância | `Int` | Epoch Unix em milissegundos |
| `t.format(layout)` | `t.format(layout: String)` | `String` | Formatação customizada |
| `t.iso8601()` | instância | `String` | Formato ISO 8601 (`2026-08-18T10:00:00Z`) |
| `t.add_duration(d)` | `t.add_duration(d: Duration)` | `Time` | Soma duração |
| `t.sub(other)` | `t.sub(other: Time)` | `Duration` | Diferença entre timestamps |
| `t.before(other)` | `t.before(other: Time)` | `Bool` | Comparação |
| `t.after(other)` | `t.after(other: Time)` | `Bool` | Comparação |
| `t.to_string()` | instância | `String` | Alias string via ISO8601 |

### 2.2 Duração

| Método | Assinatura | Retorno | Descrição |
|---|---|---|---|
| `Duration.seconds(n)` | `Duration.seconds(n: Int)` | `Duration` | Duração em segundos |
| `Duration.millis(n)` | `Duration.millis(n: Int)` | `Duration` | Duração em milissegundos |
| `Duration.minutes(n)` | `Duration.minutes(n: Int)` | `Duration` | Duração em minutos |
| `Duration.hours(n)` | `Duration.hours(n: Int)` | `Duration` | Duração em horas |
| `d.as_seconds()` | instância | `Int` | Converte para segundos |
| `d.as_millis()` | instância | `Int` | Converte para milissegundos |
| `d.to_string()` | instância | `String` | Duração legível ("1000ms") |

### 2.3 Exemplos

```flexlang
import { Time, Duration } from "core/time";

// Auditoria com timestamp
let now = Time.now();
log.info("Transferência executada", {
    timestamp: now.iso8601(),
    unix: now.unix().to_string()
});

// Expiração de token (30 minutos)
let issued_at = Time.now();
let expires_at = issued_at.add_duration(Duration.minutes(30));

// Medição de latência
let start = Time.now();
// ... operação ...
let elapsed = Time.now().sub(start);
log.info("Operação concluída", { latency_ms: elapsed.as_millis().to_string() });

// Cálculo de vencimento (30 dias corridos)
let due_date = Time.now().add_duration(Duration.hours(24 * 30));
```

## 3. Implementação

### 3.1 Interpretador (TS)
- `Time.now()` → `Date.now()`
- `Time.from_unix(s)` → `new Date(s * 1000)`
- `t.format(layout)` → formatação via `Intl.DateTimeFormat` ou manual
- `Duration.*` → milissegundos internos

### 3.2 Transpiler Go
- `Time.now()` → `time.Now()`
- `Time.from_unix(s)` → `time.Unix(int64(s), 0)`
- `t.format(layout)` → `t.Format(layout)` (com mapeamento de layouts)
- `Duration.seconds(n)` → `time.Duration(n) * time.Second`
- Adiciona `import "time"` ao boilerplate

## 4. Plano de Testes

- Golden test: `Time.now().unix()` → inteiro positivo
- Golden test: `Time.from_unix(0).iso8601()` → `"1970-01-01T00:00:00Z"`
- Golden test: `Duration.minutes(5).as_seconds()` → `300`
- Golden test: `t.add_duration(Duration.hours(1)).after(t)` → `true`
- Parity test: formatos consistentes (timestamps dinâmicos são `nondeterministic`)
