// Teste RFC-045: Agendador de Tarefas em Background / Cron (core/scheduler)

import { scheduler, CronJob } from "core/scheduler";
import { Duration } from "core/time";

func main() {
    print("--- Running RFC-045 Cron Scheduler Test ---");

    // 1. Registro de Cron Job com expressao crontab padrao
    let job_cron = scheduler.cron("59 23 * * *", || {
        print("Task: Fechamento diario FlexBank executado");
    });

    // 2. Registro com intervalo amigavel (every)
    let job_every = scheduler.every("15m", || {
        print("Task: Conciliacao rapida de SPI executada");
    });

    // 3. Registro com disparo one-shot (after)
    let job_after = scheduler.after("1h", || {
        print("Task: Lembrete de seguranca disparado");
    });

    // 4. Inspecao de propriedades dos jobs
    print("Job cron schedule:");
    print(job_cron.schedule);
    print(job_cron.job_type);

    print("Job every schedule:");
    print(job_every.schedule);
    print(job_every.job_type);

    print("Job after schedule:");
    print(job_after.schedule);
    print(job_after.job_type);

    print("Total registered jobs:");
    print(scheduler.jobs_count());

    // 5. Execucao manual deterministica de todos os jobs (run_pending)
    print("Executing run_pending():");
    let executed_count = scheduler.run_pending();
    print("Executed jobs count:");
    print(executed_count);

    // 6. Disparo individual sob demanda com trigger()
    print("Triggering individual job:");
    job_cron.trigger();

    // 7. Interrupcao e parada dos jobs
    job_every.stop();
    scheduler.stop_all();
    print("Scheduler stopped successfully");

    print("RFC-045 Cron Scheduler verified successfully!");
}

main();
