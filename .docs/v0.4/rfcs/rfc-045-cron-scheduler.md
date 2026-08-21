# RFC-045 — Agendador de Tarefas em Background / Cron (`core/scheduler`)

> **Status:** IMPLEMENTADO · **Prioridade:** P1 · **Depende de:** RFC-007 (`spawn`), RFC-027 (`core/time`)

---

## 1. Motivação

Ecossistemas de backends financeiros não são apenas responsivos a APIs; eles possuem rigorosos processos agendados baseados em horários ou frequências para executar manutenção e fechamento contábil.
- Executar liquidação PIX (a cada 10 segundos).
- Fechar balanço diário (todos os dias às 23:59).
- Enviar relatórios de prevenção a fraudes (todas as segundas-feiras às 08:00).

---

## 2. Design da API

A API deve ser expressiva e rodar concorrência segura na *background*, similar às Goroutines mas gerenciadas pelo Event Loop/Scheduler central.

```flexlang
import { scheduler, CronJob } from "core/scheduler";
import { log } from "core/log";

// 1. Agendador Crontab padrão ("min hora dia mês dia-semana")
scheduler.cron("59 23 * * *", || {
    log.info("Iniciando processo de fechamento diário do FlexBank...");
    fechar_dia();
});

// 2. Agendador com Intervalos Amigáveis
scheduler.every("15m", || {
    log.info("Conciliação rápida de SPI...");
});

// 3. One-shot execution (Timeout / Delay)
scheduler.after("1h", || {
    log.warn("Lembrete: Atualizar chaves de segurança");
});

// 4. Iniciar Scheduler bloqueante ou paralelo
// Se for executado num servidor web, o servidor web já detém a thread principal.
// `scheduler.start_background()` inicializa os cron jobs sem bloquear.
scheduler.start_background();
```

---

## 3. Implementação e Paridade

### 3.1 Modo Interpretado (TypeScript)
- A implementação no `core/scheduler` converterá as máscaras cron (`"59 23 * * *"`) para instâncias do pacote `node-cron` ou cálculos matemáticos usando `setTimeout/setInterval` gerenciados.
- As closures executam no mesmo *Event Loop* (semântica do `spawn`). Operações pesadas síncronas bloqueiam, mas I/O as liberta.

### 3.2 Modo Compilado (Go)
- O Transpiler Go importa bibliotecas maduras como `github.com/robfig/cron/v3`.
- O Go despacha a função do schedule dentro de uma goroutine isolada `go func()`, provendo concorrência leve e paralela (Thread-pool multi-core automático da linguagem).

---

## 4. Plano de Testes

- Teste de máscara de tempo (parse de strings amigáveis `"15m"`, `"1h"`).
- Teste determinístico avançado: em vez de esperar `1h` no teste, testar a execução de uma vez invocando manualmente a engine do schedule (Tick manual em ambiente de teste `std/testing`).
- Paridade 100% de ativação de jobs via parser em TS e Go.
