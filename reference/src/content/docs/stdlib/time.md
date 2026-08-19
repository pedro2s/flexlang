---
title: core/time — Tempo e Durações
description: Manipulação de timestamps UTC, formato ISO 8601, Epoch e durações na FlexLang.
---

# `core/time` — Tempo & Durações

O módulo `core/time` fornece manipulação precisa de timestamps UTC e cálculos de intervalos temporais (*Duration*).

```flexlang
import { Time, Duration } from "core/time";
```

---

## ⏰ Objeto `Time`

| Construtor / Método | Assinatura | Retorno | Descrição |
|---|---|---|---|
| `Time.now` | `Time.now()` | `Time` | Retorna o timestamp UTC atual. |
| `Time.parse` | `Time.parse(iso: String)` | `Result<Time, String>` | Faz parse de string ISO 8601. |
| `Time.from_unix` | `Time.from_unix(secs: Int)` | `Time` | Cria Time a partir de Unix timestamp. |
| `to_iso_string` | `t.to_iso_string()` | `String` | Retorna formato `2026-08-18T10:00:00.000Z`. |
| `unix_timestamp` | `t.unix_timestamp()` | `Int` | Retorna segundos desde Epoch. |
| `unix_millis` | `t.unix_millis()` | `Int` | Retorna milissegundos desde Epoch. |
| `add` | `t.add(d: Duration)` | `Time` | Adiciona uma duração ao timestamp. |
| `sub` | `t.sub(other: Time)` | `Duration` | Calcula a diferença entre dois tempos. |

---

## ⏳ Objeto `Duration`

| Construtor | Assinatura | Descrição |
|---|---|---|
| `Duration.from_seconds` | `Duration.from_seconds(s: Int)` | Cria duração em segundos. |
| `Duration.from_millis` | `Duration.from_millis(ms: Int)` | Cria duração em milissegundos. |
| `Duration.from_minutes` | `Duration.from_minutes(m: Int)` | Cria duração em minutos. |
| `Duration.from_hours` | `Duration.from_hours(h: Int)` | Cria duração em horas. |

---

## 💡 Exemplo: Expiração de Token JWT/Sessão

```flexlang
func gerar_expiracao_sessao() -> String {
    let agora = Time.now();
    let ttl = Duration.from_hours(24);
    let expira_em = agora.add(ttl);

    return expira_em.to_iso_string();
}
```
