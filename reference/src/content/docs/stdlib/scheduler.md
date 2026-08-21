---
title: core/scheduler — Agendador de Tarefas & Cron
description: Execução de jobs agendados em background com sintaxe padrão cron e intervalos recorrentes.
---

O módulo `core/scheduler` permite agendar e executar tarefas recorrentes em background usando expressões cron de 5 campos ou intervalos de tempo fixos.

```flexlang
import { scheduler, CronJob } from "core/scheduler";
import { Duration } from "core/time";
```

---

## ⏰ 1. Expressões Cron

Sintaxe padrão de 5 campos: `minuto hora dia_do_mês mês dia_da_semana`.

```flexlang
// Executa diariamente à meia-noite
let job1 = scheduler.cron("0 0 * * *", || {
    print("Iniciando conciliação contábil diária...");
    run_daily_reconciliation();
});

// Executa a cada 15 minutos em dias de semana (seg a sex)
let job2 = scheduler.cron("*/15 * * * 1-5", || {
    sync_currency_rates();
});
```

---

## ⏱️ 2. Intervalos Fixos (`every` e `after`)

```flexlang
// Executa a cada 30 segundos
let ticker = scheduler.every(Duration.seconds(30), || {
    flush_telemetry_metrics();
});

// Executa uma única vez após 5 segundos
let timeout = scheduler.after(Duration.seconds(5), || {
    print("Inicialização tardia concluída");
});
```

---

## 🎛️ 3. Controle e Ciclo de Vida

```flexlang
// Inicia o motor de execução assíncrona em background
scheduler.start_background();

// Quantidade de jobs registrados
print("Total de jobs: ${scheduler.jobs_count()}");

// Cancelamento de job individual
ticker.stop();

// Interrupção global de todos os agendamentos
scheduler.stop_all();
```
