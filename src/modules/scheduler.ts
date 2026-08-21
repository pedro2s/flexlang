import { NATIVE_TAG, type NativeModule } from "./types";
import type { Interpreter } from "../interpreter";

function parseIntervalMillis(val: any): number {
  if (typeof val === "number") return val;
  if (val && typeof val.as_millis === "function") return val.as_millis();
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    if (s.endsWith("ms")) return parseFloat(s.slice(0, -2)) || 100;
    if (s.endsWith("s")) return (parseFloat(s.slice(0, -1)) || 1) * 1000;
    if (s.endsWith("m")) return (parseFloat(s.slice(0, -1)) || 1) * 60 * 1000;
    if (s.endsWith("h")) return (parseFloat(s.slice(0, -1)) || 1) * 60 * 60 * 1000;
    if (s.endsWith("d")) return (parseFloat(s.slice(0, -1)) || 1) * 24 * 60 * 60 * 1000;
    const num = parseFloat(s);
    if (!isNaN(num)) return num * 1000;
  }
  return 1000;
}

export class FlexCronJob {
  readonly [NATIVE_TAG] = "CronJob";
  public id: string;
  public schedule: string;
  public job_type: string; // "cron" | "every" | "after"
  public is_running = false;
  private task: any;
  private interpreter?: Interpreter;
  private timerRef?: any;

  constructor(id: string, schedule: string, job_type: string, task: any, interpreter?: Interpreter) {
    this.id = id;
    this.schedule = schedule;
    this.job_type = job_type;
    this.task = task;
    this.interpreter = interpreter;
  }

  async trigger(): Promise<unknown> {
    if (!this.task) return null;
    try {
      if (this.interpreter && typeof this.interpreter.callFunction === "function") {
        return await this.interpreter.callFunction(this.task, []);
      }
      if (typeof this.task === "function") {
        return await this.task();
      }
    } catch (e: any) {
      console.error(`[scheduler] Erro ao executar job '${this.id}':`, e?.message ?? e);
    }
    return null;
  }

  start(): void {
    if (this.is_running) return;
    this.is_running = true;

    if (this.job_type === "after") {
      const ms = parseIntervalMillis(this.schedule);
      this.timerRef = setTimeout(async () => {
        await this.trigger();
        this.is_running = false;
      }, ms);
      if (this.timerRef && typeof this.timerRef.unref === "function") {
        this.timerRef.unref();
      }
    } else if (this.job_type === "every") {
      const ms = parseIntervalMillis(this.schedule);
      this.timerRef = setInterval(async () => {
        if (!this.is_running) return;
        await this.trigger();
      }, ms);
      if (this.timerRef && typeof this.timerRef.unref === "function") {
        this.timerRef.unref();
      }
    } else if (this.job_type === "cron") {
      // Para cron expressions, agenda verificação periódica de minuto
      this.timerRef = setInterval(async () => {
        if (!this.is_running) return;
        await this.trigger();
      }, 60 * 1000);
      if (this.timerRef && typeof this.timerRef.unref === "function") {
        this.timerRef.unref();
      }
    }
  }

  stop(): void {
    this.is_running = false;
    if (this.timerRef) {
      clearTimeout(this.timerRef);
      clearInterval(this.timerRef);
      this.timerRef = undefined;
    }
  }
}

export class FlexSchedulerEngine {
  readonly [NATIVE_TAG] = "scheduler";
  private jobs: FlexCronJob[] = [];
  private jobCounter = 0;
  private interpreter?: Interpreter;

  constructor(interpreter?: Interpreter) {
    this.interpreter = interpreter;
  }

  setInterpreter(interpreter: Interpreter): void {
    this.interpreter = interpreter;
  }

  cron(expr: string, task: any): FlexCronJob {
    this.jobCounter++;
    const id = `cron_${this.jobCounter}`;
    const job = new FlexCronJob(id, expr, "cron", task, this.interpreter);
    this.jobs.push(job);
    return job;
  }

  every(interval: any, task: any): FlexCronJob {
    this.jobCounter++;
    const id = `every_${this.jobCounter}`;
    const scheduleStr = typeof interval === "string" ? interval : String(interval?.to_string?.() ?? "1s");
    const job = new FlexCronJob(id, scheduleStr, "every", task, this.interpreter);
    this.jobs.push(job);
    return job;
  }

  after(delay: any, task: any): FlexCronJob {
    this.jobCounter++;
    const id = `after_${this.jobCounter}`;
    const scheduleStr = typeof delay === "string" ? delay : String(delay?.to_string?.() ?? "1s");
    const job = new FlexCronJob(id, scheduleStr, "after", task, this.interpreter);
    this.jobs.push(job);
    return job;
  }

  start_background(): void {
    for (const job of this.jobs) {
      job.start();
    }
  }

  stop_all(): void {
    for (const job of this.jobs) {
      job.stop();
    }
  }

  jobs_count(): number {
    return this.jobs.length;
  }

  async run_pending(): Promise<number> {
    let count = 0;
    for (const job of this.jobs) {
      await job.trigger();
      count++;
    }
    return count;
  }
}

export const globalScheduler = new FlexSchedulerEngine();

const GO_BOILERPLATE = `// --- FlexLang core/scheduler (RFC-045) ---
type CronJob struct {
	id         string
	schedule   string
	job_type   string // "cron" | "every" | "after"
	is_running bool
	task       func() any
	stopChan   chan struct{}
	mu         sync.Mutex
}

func (j *CronJob) stop() {
	j.mu.Lock()
	defer j.mu.Unlock()
	if !j.is_running {
		return
	}
	j.is_running = false
	if j.stopChan != nil {
		close(j.stopChan)
		j.stopChan = nil
	}
}

func (j *CronJob) trigger() any {
	if j.task != nil {
		return j.task()
	}
	return nil
}

type schedulerEngineState struct {
	mu         sync.RWMutex
	jobs       []*CronJob
	jobCounter int
}

var globalSchedulerEngine = &schedulerEngineState{
	jobs: make([]*CronJob, 0),
}

func scheduler_parse_interval(val any) time.Duration {
	switch v := val.(type) {
	case string:
		s := strings.ToLower(strings.TrimSpace(v))
		if strings.HasSuffix(s, "ms") {
			n, _ := strconv.Atoi(strings.TrimSuffix(s, "ms"))
			return time.Duration(n) * time.Millisecond
		}
		if strings.HasSuffix(s, "s") {
			n, _ := strconv.Atoi(strings.TrimSuffix(s, "s"))
			return time.Duration(n) * time.Second
		}
		if strings.HasSuffix(s, "m") {
			n, _ := strconv.Atoi(strings.TrimSuffix(s, "m"))
			return time.Duration(n) * time.Minute
		}
		if strings.HasSuffix(s, "h") {
			n, _ := strconv.Atoi(strings.TrimSuffix(s, "h"))
			return time.Duration(n) * time.Hour
		}
		if strings.HasSuffix(s, "d") {
			n, _ := strconv.Atoi(strings.TrimSuffix(s, "d"))
			return time.Duration(n) * 24 * time.Hour
		}
		n, _ := strconv.Atoi(s)
		if n > 0 {
			return time.Duration(n) * time.Second
		}
	default:
		if d, ok := val.(interface{ as_millis() int }); ok {
			return time.Duration(d.as_millis()) * time.Millisecond
		}
		if d, ok := val.(interface{ as_millis() int64 }); ok {
			return time.Duration(d.as_millis()) * time.Millisecond
		}
	}
	return 1 * time.Second
}

func scheduler_cron(expr string, task any) *CronJob {
	globalSchedulerEngine.mu.Lock()
	defer globalSchedulerEngine.mu.Unlock()

	globalSchedulerEngine.jobCounter++
	id := fmt.Sprintf("cron_%d", globalSchedulerEngine.jobCounter)

	var fn func() any
	if f, ok := task.(func() any); ok {
		fn = f
	} else if f2, ok := task.(func()); ok {
		fn = func() any { f2(); return nil }
	}

	job := &CronJob{
		id:       id,
		schedule: expr,
		job_type: "cron",
		task:     fn,
	}
	globalSchedulerEngine.jobs = append(globalSchedulerEngine.jobs, job)
	return job
}

func scheduler_every(interval any, task any) *CronJob {
	globalSchedulerEngine.mu.Lock()
	defer globalSchedulerEngine.mu.Unlock()

	globalSchedulerEngine.jobCounter++
	id := fmt.Sprintf("every_%d", globalSchedulerEngine.jobCounter)

	scheduleStr := fmt.Sprintf("%v", interval)
	if str, ok := interval.(string); ok {
		scheduleStr = str
	}

	var fn func() any
	if f, ok := task.(func() any); ok {
		fn = f
	} else if f2, ok := task.(func()); ok {
		fn = func() any { f2(); return nil }
	}

	job := &CronJob{
		id:       id,
		schedule: scheduleStr,
		job_type: "every",
		task:     fn,
	}
	globalSchedulerEngine.jobs = append(globalSchedulerEngine.jobs, job)
	return job
}

func scheduler_after(delay any, task any) *CronJob {
	globalSchedulerEngine.mu.Lock()
	defer globalSchedulerEngine.mu.Unlock()

	globalSchedulerEngine.jobCounter++
	id := fmt.Sprintf("after_%d", globalSchedulerEngine.jobCounter)

	scheduleStr := fmt.Sprintf("%v", delay)
	if str, ok := delay.(string); ok {
		scheduleStr = str
	}

	var fn func() any
	if f, ok := task.(func() any); ok {
		fn = f
	} else if f2, ok := task.(func()); ok {
		fn = func() any { f2(); return nil }
	}

	job := &CronJob{
		id:       id,
		schedule: scheduleStr,
		job_type: "after",
		task:     fn,
	}
	globalSchedulerEngine.jobs = append(globalSchedulerEngine.jobs, job)
	return job
}

func scheduler_start_background() {
	globalSchedulerEngine.mu.Lock()
	defer globalSchedulerEngine.mu.Unlock()

	for _, job := range globalSchedulerEngine.jobs {
		if job.is_running {
			continue
		}
		job.is_running = true
		job.stopChan = make(chan struct{})

		if job.job_type == "after" {
			dur := scheduler_parse_interval(job.schedule)
			go func(j *CronJob, d time.Duration) {
				select {
				case <-time.After(d):
					j.trigger()
					j.stop()
				case <-j.stopChan:
					return
				}
			}(job, dur)
		} else if job.job_type == "every" {
			dur := scheduler_parse_interval(job.schedule)
			go func(j *CronJob, d time.Duration) {
				ticker := time.NewTicker(d)
				defer ticker.Stop()
				for {
					select {
					case <-ticker.C:
						j.trigger()
					case <-j.stopChan:
						return
					}
				}
			}(job, dur)
		} else if job.job_type == "cron" {
			go func(j *CronJob) {
				ticker := time.NewTicker(1 * time.Minute)
				defer ticker.Stop()
				for {
					select {
					case <-ticker.C:
						j.trigger()
					case <-j.stopChan:
						return
					}
				}
			}(job)
		}
	}
}

func scheduler_stop_all() {
	globalSchedulerEngine.mu.Lock()
	defer globalSchedulerEngine.mu.Unlock()

	for _, job := range globalSchedulerEngine.jobs {
		job.stop()
	}
}

func scheduler_jobs_count() int {
	globalSchedulerEngine.mu.RLock()
	defer globalSchedulerEngine.mu.RUnlock()
	return len(globalSchedulerEngine.jobs)
}

func scheduler_run_pending() int {
	globalSchedulerEngine.mu.RLock()
	jobs := make([]*CronJob, len(globalSchedulerEngine.jobs))
	copy(jobs, globalSchedulerEngine.jobs)
	globalSchedulerEngine.mu.RUnlock()

	count := 0
	for _, job := range jobs {
		job.trigger()
		count++
	}
	return count
}
// ------------------------------------------`;

export const schedulerModule: NativeModule = {
  path: "core/scheduler",

  types: [
    {
      name: "CronJob",
      goPointer: true,
      properties: [
        { name: "id", typeAnnotation: { kind: "NamedTypeNode", name: "String" } },
        { name: "schedule", typeAnnotation: { kind: "NamedTypeNode", name: "String" } },
        { name: "job_type", typeAnnotation: { kind: "NamedTypeNode", name: "String" } },
        { name: "is_running", typeAnnotation: { kind: "NamedTypeNode", name: "Bool" } },
      ],
      methods: [
        {
          name: "stop",
          arity: 0,
          returns: { kind: "Void" },
        },
        {
          name: "trigger",
          arity: 0,
          returns: { kind: "Any" },
        },
      ],
    },
    {
      name: "scheduler",
      statics: [
        {
          name: "cron",
          arity: 2,
          returns: { kind: "Struct", name: "CronJob", genericArgs: [] },
        },
        {
          name: "every",
          arity: 2,
          returns: { kind: "Struct", name: "CronJob", genericArgs: [] },
        },
        {
          name: "after",
          arity: 2,
          returns: { kind: "Struct", name: "CronJob", genericArgs: [] },
        },
        {
          name: "start_background",
          arity: 0,
          returns: { kind: "Void" },
        },
        {
          name: "stop_all",
          arity: 0,
          returns: { kind: "Void" },
        },
        {
          name: "jobs_count",
          arity: 0,
          returns: { kind: "Int" },
        },
        {
          name: "run_pending",
          arity: 0,
          returns: { kind: "Int" },
        },
      ],
    },
  ],

  runtimeBinding: (interpreter: Interpreter) => {
    globalScheduler.setInterpreter(interpreter);
    return {
      CronJob: {
        kind: "StructDeclaration",
        name: "CronJob",
        properties: [
          { name: "id", typeAnnotation: { kind: "NamedTypeNode", name: "String" } },
          { name: "schedule", typeAnnotation: { kind: "NamedTypeNode", name: "String" } },
          { name: "job_type", typeAnnotation: { kind: "NamedTypeNode", name: "String" } },
          { name: "is_running", typeAnnotation: { kind: "NamedTypeNode", name: "Bool" } },
        ],
      },
      scheduler: {
        [NATIVE_TAG]: "scheduler",
        cron: (expr: string, task: any) => globalScheduler.cron(expr, task),
        every: (interval: any, task: any) => globalScheduler.every(interval, task),
        after: (delay: any, task: any) => globalScheduler.after(delay, task),
        start_background: () => globalScheduler.start_background(),
        stop_all: () => globalScheduler.stop_all(),
        jobs_count: () => globalScheduler.jobs_count(),
        run_pending: () => globalScheduler.run_pending(),
      },
    };
  },

  goCodegen: {
    imports: ["sync", "time", "strconv", "strings", "fmt"],
    boilerplate: GO_BOILERPLATE,
  },
};
