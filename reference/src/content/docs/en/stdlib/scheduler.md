---
title: core/scheduler — Background Jobs & Cron
description: Scheduled background task execution with standard 5-field cron syntax and recurrent intervals.
---

The `core/scheduler` module provides background job scheduling using standard 5-field cron syntax (`minute hour day-of-month month day-of-week`) or fixed duration intervals.

```flexlang
import { scheduler, CronJob } from "core/scheduler";
import { Duration } from "core/time";
```

---

## ⏰ 1. Cron Expressions

```flexlang
// Runs daily at midnight
let job1 = scheduler.cron("0 0 * * *", || {
    run_daily_reconciliation();
});

// Runs every 15 minutes on weekdays
let job2 = scheduler.cron("*/15 * * * 1-5", || {
    sync_currency_rates();
});
```

---

## ⏱️ 2. Fixed Intervals (`every` and `after`)

```flexlang
let ticker = scheduler.every(Duration.seconds(30), || {
    flush_telemetry_metrics();
});

let timeout = scheduler.after(Duration.seconds(5), || {
    print("Bootstrap completed");
});
```

---

## 🎛️ 3. Lifecycle Management

```flexlang
scheduler.start_background();
print("Active jobs: ${scheduler.jobs_count()}");

ticker.stop();
scheduler.stop_all();
```
