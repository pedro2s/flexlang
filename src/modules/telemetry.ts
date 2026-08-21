import nodeCrypto from "crypto";
import { NATIVE_TAG, type NativeModule } from "./types";
import type { Interpreter } from "../interpreter";

function randomHex(chars: number): string {
  return nodeCrypto.randomBytes(Math.ceil(chars / 2)).toString("hex").slice(0, chars).toLowerCase();
}

function labelsToMap(raw: unknown): Map<string, string> {
  const map = new Map<string, string>();
  if (!raw) return map;
  if (raw instanceof Map) {
    for (const [k, v] of raw.entries()) {
      if (k !== undefined && v !== undefined) {
        map.set(String(k), String(v));
      }
    }
  } else if (typeof raw === "object") {
    for (const [k, v] of Object.entries(raw)) {
      if (v !== undefined) {
        map.set(String(k), String(v));
      }
    }
  }
  return map;
}

function labelsKey(labels: Map<string, string>): string {
  if (labels.size === 0) return "";
  const keys = Array.from(labels.keys()).sort();
  return keys.map((k) => `${k}="${labels.get(k)}"`).join(",");
}

function formatMetricLine(name: string, labelsStr: string, value: number | string): string {
  if (labelsStr.length > 0) {
    return `${name}{${labelsStr}} ${value}`;
  }
  return `${name} ${value}`;
}

function formatLe(bucket: number): string {
  if (Number.isInteger(bucket)) {
    return String(bucket);
  }
  return String(bucket);
}

export class FlexCounter {
  readonly [NATIVE_TAG] = "Counter";
  private series = new Map<string, { labels: Map<string, string>; value: number }>();

  constructor(
    readonly name: string,
    readonly description: string,
  ) {}

  inc(labels?: unknown): number {
    return this.add(1.0, labels);
  }

  add(amount: number, labels?: unknown): number {
    const val = typeof amount === "number" && !isNaN(amount) ? amount : 1.0;
    const effectiveAmount = val > 0 ? val : 0;
    const m = labelsToMap(labels);
    const key = labelsKey(m);
    const entry = this.series.get(key);
    if (entry) {
      entry.value += effectiveAmount;
      return entry.value;
    } else {
      this.series.set(key, { labels: m, value: effectiveAmount });
      return effectiveAmount;
    }
  }

  get(labels?: unknown): number {
    const key = labelsKey(labelsToMap(labels));
    return this.series.get(key)?.value ?? 0;
  }

  reset(): void {
    this.series.clear();
  }

  exportPrometheus(): string[] {
    const lines: string[] = [
      `# HELP ${this.name} ${this.description}`,
      `# TYPE ${this.name} counter`,
    ];
    if (this.series.size === 0) {
      lines.push(`${this.name} 0`);
      return lines;
    }
    const keys = Array.from(this.series.keys()).sort();
    for (const key of keys) {
      const entry = this.series.get(key)!;
      lines.push(formatMetricLine(this.name, key, entry.value));
    }
    return lines;
  }
}

export class FlexGauge {
  readonly [NATIVE_TAG] = "Gauge";
  private series = new Map<string, { labels: Map<string, string>; value: number }>();

  constructor(
    readonly name: string,
    readonly description: string,
  ) {}

  set(val: number, labels?: unknown): number {
    const num = typeof val === "number" && !isNaN(val) ? val : 0;
    const m = labelsToMap(labels);
    const key = labelsKey(m);
    this.series.set(key, { labels: m, value: num });
    return num;
  }

  inc(labels?: unknown): number {
    return this.add(1.0, labels);
  }

  dec(labels?: unknown): number {
    return this.sub(1.0, labels);
  }

  add(amount: number, labels?: unknown): number {
    const val = typeof amount === "number" && !isNaN(amount) ? amount : 1.0;
    const m = labelsToMap(labels);
    const key = labelsKey(m);
    const entry = this.series.get(key);
    if (entry) {
      entry.value += val;
      return entry.value;
    } else {
      this.series.set(key, { labels: m, value: val });
      return val;
    }
  }

  sub(amount: number, labels?: unknown): number {
    const val = typeof amount === "number" && !isNaN(amount) ? amount : 1.0;
    return this.add(-val, labels);
  }

  get(labels?: unknown): number {
    const key = labelsKey(labelsToMap(labels));
    return this.series.get(key)?.value ?? 0;
  }

  reset(): void {
    this.series.clear();
  }

  exportPrometheus(): string[] {
    const lines: string[] = [
      `# HELP ${this.name} ${this.description}`,
      `# TYPE ${this.name} gauge`,
    ];
    if (this.series.size === 0) {
      lines.push(`${this.name} 0`);
      return lines;
    }
    const keys = Array.from(this.series.keys()).sort();
    for (const key of keys) {
      const entry = this.series.get(key)!;
      lines.push(formatMetricLine(this.name, key, entry.value));
    }
    return lines;
  }
}

export class FlexHistogram {
  readonly [NATIVE_TAG] = "Histogram";
  readonly buckets: number[];
  private series = new Map<
    string,
    { labels: Map<string, string>; bucketCounts: number[]; sum: number; count: number }
  >();

  constructor(
    readonly name: string,
    readonly description: string,
    buckets?: number[],
  ) {
    if (Array.isArray(buckets) && buckets.length > 0) {
      this.buckets = [...buckets].sort((a, b) => a - b);
    } else {
      this.buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0];
    }
  }

  observe(val: number, labels?: unknown): number {
    const num = typeof val === "number" && !isNaN(val) ? val : 0;
    const m = labelsToMap(labels);
    const key = labelsKey(m);
    let entry = this.series.get(key);
    if (!entry) {
      entry = {
        labels: m,
        bucketCounts: new Array(this.buckets.length).fill(0),
        sum: 0,
        count: 0,
      };
      this.series.set(key, entry);
    }
    entry.count += 1;
    entry.sum += num;
    for (let i = 0; i < this.buckets.length; i++) {
      if (num <= this.buckets[i]!) {
        entry.bucketCounts[i]! += 1;
      }
    }
    return num;
  }

  start_timer(labels?: unknown): FlexTimer {
    return new FlexTimer(this, labelsToMap(labels));
  }

  get_sum(labels?: unknown): number {
    const key = labelsKey(labelsToMap(labels));
    return this.series.get(key)?.sum ?? 0;
  }

  get_count(labels?: unknown): number {
    const key = labelsKey(labelsToMap(labels));
    return this.series.get(key)?.count ?? 0;
  }

  reset(): void {
    this.series.clear();
  }

  exportPrometheus(): string[] {
    const lines: string[] = [
      `# HELP ${this.name} ${this.description}`,
      `# TYPE ${this.name} histogram`,
    ];
    if (this.series.size === 0) {
      for (const b of this.buckets) {
        lines.push(`${this.name}_bucket{le="${formatLe(b)}"} 0`);
      }
      lines.push(`${this.name}_bucket{le="+Inf"} 0`);
      lines.push(`${this.name}_sum 0`);
      lines.push(`${this.name}_count 0`);
      return lines;
    }
    const keys = Array.from(this.series.keys()).sort();
    for (const key of keys) {
      const entry = this.series.get(key)!;
      for (let i = 0; i < this.buckets.length; i++) {
        const b = this.buckets[i]!;
        const labelsWithLe = new Map(entry.labels);
        labelsWithLe.set("le", formatLe(b));
        lines.push(`${this.name}_bucket{${labelsKey(labelsWithLe)}} ${entry.bucketCounts[i]}`);
      }
      const labelsWithInf = new Map(entry.labels);
      labelsWithInf.set("le", "+Inf");
      lines.push(`${this.name}_bucket{${labelsKey(labelsWithInf)}} ${entry.count}`);
      lines.push(formatMetricLine(`${this.name}_sum`, key, entry.sum));
      lines.push(formatMetricLine(`${this.name}_count`, key, entry.count));
    }
    return lines;
  }
}

export class FlexTimer {
  readonly [NATIVE_TAG] = "Timer";
  private startTimeNs: bigint;

  constructor(
    private histogram: FlexHistogram,
    private labels: Map<string, string>,
  ) {
    this.startTimeNs = process.hrtime.bigint ? process.hrtime.bigint() : BigInt(Date.now()) * BigInt(1_000_000);
  }

  observe_duration(): number {
    const nowNs = process.hrtime.bigint ? process.hrtime.bigint() : BigInt(Date.now()) * BigInt(1_000_000);
    const diffNs = Number(nowNs - this.startTimeNs);
    const elapsedSeconds = diffNs / 1_000_000_000;
    this.histogram.observe(elapsedSeconds, this.labels);
    return elapsedSeconds;
  }
}

export class FlexSpan {
  readonly [NATIVE_TAG] = "Span";
  private _tags = new Map<string, string>();
  private _startTime: number = Date.now();
  private _endTime: number | null = null;
  private _finished = false;

  constructor(
    private readonly _traceId: string,
    private readonly _spanId: string,
    private readonly _parentSpanId: string,
    private readonly _flags: string,
    private readonly _name: string,
    private readonly _tracestate: string = "",
  ) {}

  set_tag(key: string, value: string): FlexSpan {
    this._tags.set(String(key), String(value));
    return this;
  }

  get_tag(key: string): string {
    return this._tags.get(String(key)) ?? "";
  }

  inject_w3c_headers(): Map<string, string> {
    const map = new Map<string, string>();
    map.set("traceparent", `00-${this._traceId}-${this._spanId}-${this._flags}`);
    if (this._tracestate && this._tracestate.length > 0) {
      map.set("tracestate", this._tracestate);
    }
    return map;
  }

  finish(): FlexSpan {
    if (!this._finished) {
      this._endTime = Date.now();
      this._finished = true;
    }
    return this;
  }

  trace_id(): string {
    return this._traceId;
  }

  span_id(): string {
    return this._spanId;
  }

  parent_span_id(): string {
    return this._parentSpanId;
  }

  name(): string {
    return this._name;
  }

  duration_ms(): number {
    const end = this._endTime ?? Date.now();
    return Math.max(0, end - this._startTime);
  }

  is_finished(): boolean {
    return this._finished;
  }
}

class FlexMetricsRegistry {
  readonly [NATIVE_TAG] = "metrics";
  private counters = new Map<string, FlexCounter>();
  private gauges = new Map<string, FlexGauge>();
  private histograms = new Map<string, FlexHistogram>();

  counter(name: string, description: string): FlexCounter {
    let c = this.counters.get(name);
    if (!c) {
      c = new FlexCounter(name, description);
      this.counters.set(name, c);
    }
    return c;
  }

  gauge(name: string, description: string): FlexGauge {
    let g = this.gauges.get(name);
    if (!g) {
      g = new FlexGauge(name, description);
      this.gauges.set(name, g);
    }
    return g;
  }

  histogram(name: string, description: string, buckets?: number[]): FlexHistogram {
    let h = this.histograms.get(name);
    if (!h) {
      h = new FlexHistogram(name, description, buckets);
      this.histograms.set(name, h);
    }
    return h;
  }

  export_prometheus(): string {
    const allNames = new Set<string>([
      ...this.counters.keys(),
      ...this.gauges.keys(),
      ...this.histograms.keys(),
    ]);
    const sortedNames = Array.from(allNames).sort();
    const blocks: string[] = [];
    for (const name of sortedNames) {
      if (this.counters.has(name)) {
        blocks.push(this.counters.get(name)!.exportPrometheus().join("\n"));
      } else if (this.gauges.has(name)) {
        blocks.push(this.gauges.get(name)!.exportPrometheus().join("\n"));
      } else if (this.histograms.has(name)) {
        blocks.push(this.histograms.get(name)!.exportPrometheus().join("\n"));
      }
    }
    if (blocks.length === 0) return "";
    return blocks.join("\n\n") + "\n";
  }

  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }
}

class FlexTracerRegistry {
  readonly [NATIVE_TAG] = "tracer";

  start_span(name: string, parent?: FlexSpan): FlexSpan {
    if (parent instanceof FlexSpan) {
      const traceId = parent.trace_id();
      const parentSpanId = parent.span_id();
      const spanId = randomHex(16);
      return new FlexSpan(traceId, spanId, parentSpanId, "01", name);
    }
    const traceId = randomHex(32);
    const spanId = randomHex(16);
    return new FlexSpan(traceId, spanId, "", "01", name);
  }

  start_span_from_headers(name: string, headers: unknown): FlexSpan {
    let traceparentVal = "";
    let tracestateVal = "";

    if (headers instanceof Map) {
      for (const [k, v] of headers.entries()) {
        const keyLower = String(k).toLowerCase();
        if (keyLower === "traceparent") traceparentVal = String(v).trim();
        if (keyLower === "tracestate") tracestateVal = String(v).trim();
      }
    } else if (headers && typeof headers === "object") {
      for (const [k, v] of Object.entries(headers)) {
        const keyLower = String(k).toLowerCase();
        if (keyLower === "traceparent") traceparentVal = String(v).trim();
        if (keyLower === "tracestate") tracestateVal = String(v).trim();
      }
    }

    const match = traceparentVal.match(/^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i);
    if (
      match &&
      match[2] !== "00000000000000000000000000000000" &&
      match[3] !== "0000000000000000"
    ) {
      const traceId = match[2]!.toLowerCase();
      const parentSpanId = match[3]!.toLowerCase();
      const flags = match[4]!.toLowerCase();
      const spanId = randomHex(16);
      return new FlexSpan(traceId, spanId, parentSpanId, flags, name, tracestateVal);
    }

    const traceId = randomHex(32);
    const spanId = randomHex(16);
    return new FlexSpan(traceId, spanId, "", "01", name, tracestateVal);
  }
}

const globalMetrics = new FlexMetricsRegistry();
const globalTracer = new FlexTracerRegistry();

const GO_BOILERPLATE = `// --- FlexLang core/telemetry (RFC-039) ---
var (
	telemetryMu        sync.Mutex
	telemetryCounters   = make(map[string]*Counter)
	telemetryGauges     = make(map[string]*Gauge)
	telemetryHistograms = make(map[string]*Histogram)
)

func telemetryRandomHex(n int) string {
	bytes := make([]byte, (n+1)/2)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)[:n]
}

func telemetryLabelsToMap(raw any) map[string]string {
	res := make(map[string]string)
	if raw == nil {
		return res
	}
	switch m := raw.(type) {
	case map[string]string:
		for k, v := range m {
			res[k] = v
		}
	case map[string]any:
		for k, v := range m {
			res[k] = fmt.Sprintf("%v", v)
		}
	}
	return res
}

func telemetryLabelsKey(labels map[string]string) string {
	if len(labels) == 0 {
		return ""
	}
	keys := make([]string, 0, len(labels))
	for k := range labels {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	pairs := make([]string, 0, len(keys))
	for _, k := range keys {
		pairs = append(pairs, fmt.Sprintf("%s=\\"%s\\"", k, labels[k]))
	}
	return strings.Join(pairs, ",")
}

func telemetryFormatLine(name, labelsStr string, value any) string {
	if len(labelsStr) > 0 {
		return fmt.Sprintf("%s{%s} %v", name, labelsStr, value)
	}
	return fmt.Sprintf("%s %v", name, value)
}

func telemetryFormatFloat(f float64) string {
	if f == float64(int64(f)) {
		return strconv.FormatInt(int64(f), 10)
	}
	return strconv.FormatFloat(f, 'f', -1, 64)
}

type Counter struct {
	mu          sync.Mutex
	name        string
	description string
	series      map[string]float64
	labelSets   map[string]map[string]string
}

func (c *Counter) inc(args ...any) float64 {
	return c.add(1.0, args...)
}

func (c *Counter) add(amount float64, args ...any) float64 {
	c.mu.Lock()
	defer c.mu.Unlock()
	if amount < 0 {
		amount = 0
	}
	var labels map[string]string
	if len(args) > 0 {
		labels = telemetryLabelsToMap(args[0])
	} else {
		labels = make(map[string]string)
	}
	key := telemetryLabelsKey(labels)
	c.series[key] += amount
	c.labelSets[key] = labels
	return c.series[key]
}

func (c *Counter) get(args ...any) float64 {
	c.mu.Lock()
	defer c.mu.Unlock()
	var labels map[string]string
	if len(args) > 0 {
		labels = telemetryLabelsToMap(args[0])
	} else {
		labels = make(map[string]string)
	}
	key := telemetryLabelsKey(labels)
	return c.series[key]
}

func (c *Counter) reset() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.series = make(map[string]float64)
	c.labelSets = make(map[string]map[string]string)
}

type Gauge struct {
	mu          sync.Mutex
	name        string
	description string
	series      map[string]float64
	labelSets   map[string]map[string]string
}

func (g *Gauge) set(val float64, args ...any) float64 {
	g.mu.Lock()
	defer g.mu.Unlock()
	var labels map[string]string
	if len(args) > 0 {
		labels = telemetryLabelsToMap(args[0])
	} else {
		labels = make(map[string]string)
	}
	key := telemetryLabelsKey(labels)
	g.series[key] = val
	g.labelSets[key] = labels
	return val
}

func (g *Gauge) inc(args ...any) float64 {
	return g.add(1.0, args...)
}

func (g *Gauge) dec(args ...any) float64 {
	return g.sub(1.0, args...)
}

func (g *Gauge) add(amount float64, args ...any) float64 {
	g.mu.Lock()
	defer g.mu.Unlock()
	var labels map[string]string
	if len(args) > 0 {
		labels = telemetryLabelsToMap(args[0])
	} else {
		labels = make(map[string]string)
	}
	key := telemetryLabelsKey(labels)
	g.series[key] += amount
	g.labelSets[key] = labels
	return g.series[key]
}

func (g *Gauge) sub(amount float64, args ...any) float64 {
	return g.add(-amount, args...)
}

func (g *Gauge) get(args ...any) float64 {
	g.mu.Lock()
	defer g.mu.Unlock()
	var labels map[string]string
	if len(args) > 0 {
		labels = telemetryLabelsToMap(args[0])
	} else {
		labels = make(map[string]string)
	}
	key := telemetryLabelsKey(labels)
	return g.series[key]
}

func (g *Gauge) reset() {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.series = make(map[string]float64)
	g.labelSets = make(map[string]map[string]string)
}

type Histogram struct {
	mu           sync.Mutex
	name         string
	description  string
	buckets      []float64
	bucketCounts map[string][]int
	sums         map[string]float64
	counts       map[string]int
	labelSets    map[string]map[string]string
}

type Timer struct {
	hist      *Histogram
	labels    map[string]string
	startTime time.Time
}

func (t *Timer) observe_duration() float64 {
	elapsed := time.Since(t.startTime).Seconds()
	t.hist.observe(elapsed, t.labels)
	return elapsed
}

func (h *Histogram) observe(val float64, args ...any) float64 {
	h.mu.Lock()
	defer h.mu.Unlock()
	var labels map[string]string
	if len(args) > 0 {
		labels = telemetryLabelsToMap(args[0])
	} else {
		labels = make(map[string]string)
	}
	key := telemetryLabelsKey(labels)
	counts, exists := h.bucketCounts[key]
	if !exists {
		counts = make([]int, len(h.buckets))
		h.bucketCounts[key] = counts
		h.labelSets[key] = labels
	}
	h.counts[key]++
	h.sums[key] += val
	for i, b := range h.buckets {
		if val <= b {
			counts[i]++
		}
	}
	return val
}

func (h *Histogram) start_timer(args ...any) *Timer {
	var labels map[string]string
	if len(args) > 0 {
		labels = telemetryLabelsToMap(args[0])
	} else {
		labels = make(map[string]string)
	}
	return &Timer{
		hist:      h,
		labels:    labels,
		startTime: time.Now(),
	}
}

func (h *Histogram) get_sum(args ...any) float64 {
	h.mu.Lock()
	defer h.mu.Unlock()
	var labels map[string]string
	if len(args) > 0 {
		labels = telemetryLabelsToMap(args[0])
	} else {
		labels = make(map[string]string)
	}
	key := telemetryLabelsKey(labels)
	return h.sums[key]
}

func (h *Histogram) get_count(args ...any) int {
	h.mu.Lock()
	defer h.mu.Unlock()
	var labels map[string]string
	if len(args) > 0 {
		labels = telemetryLabelsToMap(args[0])
	} else {
		labels = make(map[string]string)
	}
	key := telemetryLabelsKey(labels)
	return h.counts[key]
}

func (h *Histogram) reset() {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.bucketCounts = make(map[string][]int)
	h.sums = make(map[string]float64)
	h.counts = make(map[string]int)
	h.labelSets = make(map[string]map[string]string)
}

func metrics_counter(name, description string) *Counter {
	telemetryMu.Lock()
	defer telemetryMu.Unlock()
	c, ok := telemetryCounters[name]
	if !ok {
		c = &Counter{
			name:        name,
			description: description,
			series:      make(map[string]float64),
			labelSets:   make(map[string]map[string]string),
		}
		telemetryCounters[name] = c
	}
	return c
}

func metrics_gauge(name, description string) *Gauge {
	telemetryMu.Lock()
	defer telemetryMu.Unlock()
	g, ok := telemetryGauges[name]
	if !ok {
		g = &Gauge{
			name:        name,
			description: description,
			series:      make(map[string]float64),
			labelSets:   make(map[string]map[string]string),
		}
		telemetryGauges[name] = g
	}
	return g
}

func metrics_histogram(name, description string, args ...any) *Histogram {
	telemetryMu.Lock()
	defer telemetryMu.Unlock()
	h, ok := telemetryHistograms[name]
	if !ok {
		var buckets []float64
		if len(args) > 0 {
			switch b := args[0].(type) {
			case []float64:
				buckets = append([]float64{}, b...)
			case []any:
				for _, item := range b {
					if f, ok := item.(float64); ok {
						buckets = append(buckets, f)
					} else if n, ok := item.(int); ok {
						buckets = append(buckets, float64(n))
					}
				}
			}
		}
		if len(buckets) == 0 {
			buckets = []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0}
		}
		sort.Float64s(buckets)
		h = &Histogram{
			name:         name,
			description:  description,
			buckets:      buckets,
			bucketCounts: make(map[string][]int),
			sums:         make(map[string]float64),
			counts:       make(map[string]int),
			labelSets:    make(map[string]map[string]string),
		}
		telemetryHistograms[name] = h
	}
	return h
}

func metrics_export_prometheus() string {
	telemetryMu.Lock()
	defer telemetryMu.Unlock()

	var names []string
	for n := range telemetryCounters {
		names = append(names, n)
	}
	for n := range telemetryGauges {
		names = append(names, n)
	}
	for n := range telemetryHistograms {
		names = append(names, n)
	}
	sort.Strings(names)

	var blocks []string
	for _, name := range names {
		if c, ok := telemetryCounters[name]; ok {
			c.mu.Lock()
			lines := []string{
				fmt.Sprintf("# HELP %s %s", c.name, c.description),
				fmt.Sprintf("# TYPE %s counter", c.name),
			}
			if len(c.series) == 0 {
				lines = append(lines, fmt.Sprintf("%s 0", c.name))
			} else {
				var keys []string
				for k := range c.series {
					keys = append(keys, k)
				}
				sort.Strings(keys)
				for _, k := range keys {
					lines = append(lines, telemetryFormatLine(c.name, k, telemetryFormatFloat(c.series[k])))
				}
			}
			c.mu.Unlock()
			blocks = append(blocks, strings.Join(lines, "\\n"))
		} else if g, ok := telemetryGauges[name]; ok {
			g.mu.Lock()
			lines := []string{
				fmt.Sprintf("# HELP %s %s", g.name, g.description),
				fmt.Sprintf("# TYPE %s gauge", g.name),
			}
			if len(g.series) == 0 {
				lines = append(lines, fmt.Sprintf("%s 0", g.name))
			} else {
				var keys []string
				for k := range g.series {
					keys = append(keys, k)
				}
				sort.Strings(keys)
				for _, k := range keys {
					lines = append(lines, telemetryFormatLine(g.name, k, telemetryFormatFloat(g.series[k])))
				}
			}
			g.mu.Unlock()
			blocks = append(blocks, strings.Join(lines, "\\n"))
		} else if h, ok := telemetryHistograms[name]; ok {
			h.mu.Lock()
			lines := []string{
				fmt.Sprintf("# HELP %s %s", h.name, h.description),
				fmt.Sprintf("# TYPE %s histogram", h.name),
			}
			if len(h.bucketCounts) == 0 {
				for _, b := range h.buckets {
					lines = append(lines, fmt.Sprintf("%s_bucket{le=\\"%s\\"} 0", h.name, telemetryFormatFloat(b)))
				}
				lines = append(lines, fmt.Sprintf("%s_bucket{le=\\"+Inf\\"} 0", h.name))
				lines = append(lines, fmt.Sprintf("%s_sum 0", h.name))
				lines = append(lines, fmt.Sprintf("%s_count 0", h.name))
			} else {
				var keys []string
				for k := range h.bucketCounts {
					keys = append(keys, k)
				}
				sort.Strings(keys)
				for _, k := range keys {
					labels := h.labelSets[k]
					for i, b := range h.buckets {
						lCopy := make(map[string]string, len(labels)+1)
						for lk, lv := range labels {
							lCopy[lk] = lv
						}
						lCopy["le"] = telemetryFormatFloat(b)
						lines = append(lines, fmt.Sprintf("%s_bucket{%s} %d", h.name, telemetryLabelsKey(lCopy), h.bucketCounts[k][i]))
					}
					lCopy := make(map[string]string, len(labels)+1)
					for lk, lv := range labels {
						lCopy[lk] = lv
					}
					lCopy["le"] = "+Inf"
					lines = append(lines, fmt.Sprintf("%s_bucket{%s} %d", h.name, telemetryLabelsKey(lCopy), h.counts[k]))
					lines = append(lines, telemetryFormatLine(h.name+"_sum", k, telemetryFormatFloat(h.sums[k])))
					lines = append(lines, telemetryFormatLine(h.name+"_count", k, strconv.Itoa(h.counts[k])))
				}
			}
			h.mu.Unlock()
			blocks = append(blocks, strings.Join(lines, "\\n"))
		}
	}
	if len(blocks) == 0 {
		return ""
	}
	return strings.Join(blocks, "\\n\\n") + "\\n"
}

func metrics_reset() {
	telemetryMu.Lock()
	defer telemetryMu.Unlock()
	telemetryCounters = make(map[string]*Counter)
	telemetryGauges = make(map[string]*Gauge)
	telemetryHistograms = make(map[string]*Histogram)
}

type Span struct {
	mu           sync.Mutex
	traceId      string
	spanId       string
	parentSpanId string
	flags        string
	name         string
	tags         map[string]string
	tracestate   string
	startTime    time.Time
	endTime      time.Time
	finished     bool
}

func (s *Span) set_tag(key, value string) *Span {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.tags == nil {
		s.tags = make(map[string]string)
	}
	s.tags[key] = value
	return s
}

func (s *Span) get_tag(key string) string {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.tags == nil {
		return ""
	}
	return s.tags[key]
}

func (s *Span) inject_w3c_headers() map[string]any {
	s.mu.Lock()
	defer s.mu.Unlock()
	res := map[string]any{
		"traceparent": fmt.Sprintf("00-%s-%s-%s", s.traceId, s.spanId, s.flags),
	}
	if s.tracestate != "" {
		res["tracestate"] = s.tracestate
	}
	return res
}

func (s *Span) finish() *Span {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.finished {
		s.endTime = time.Now()
		s.finished = true
	}
	return s
}

func (s *Span) trace_id() string {
	return s.traceId
}

func (s *Span) span_id() string {
	return s.spanId
}

func (s *Span) parent_span_id() string {
	return s.parentSpanId
}

func (s *Span) name_str() string {
	return s.name
}

func (s *Span) duration_ms() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	end := s.endTime
	if !s.finished {
		end = time.Now()
	}
	return int(end.Sub(s.startTime).Milliseconds())
}

func (s *Span) is_finished() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.finished
}

func tracer_start_span(name string, args ...*Span) *Span {
	if len(args) > 0 && args[0] != nil {
		parent := args[0]
		return &Span{
			traceId:      parent.traceId,
			spanId:       telemetryRandomHex(16),
			parentSpanId: parent.spanId,
			flags:        parent.flags,
			name:         name,
			tags:         make(map[string]string),
			tracestate:   parent.tracestate,
			startTime:    time.Now(),
		}
	}
	return &Span{
		traceId:      telemetryRandomHex(32),
		spanId:       telemetryRandomHex(16),
		parentSpanId: "",
		flags:        "01",
		name:         name,
		tags:         make(map[string]string),
		startTime:    time.Now(),
	}
}

func tracer_start_span_from_headers(name string, headers any) *Span {
	traceparentVal := ""
	tracestateVal := ""

	switch h := headers.(type) {
	case map[string]string:
		for k, v := range h {
			if strings.EqualFold(k, "traceparent") {
				traceparentVal = strings.TrimSpace(v)
			}
			if strings.EqualFold(k, "tracestate") {
				tracestateVal = strings.TrimSpace(v)
			}
		}
	case map[string]any:
		for k, v := range h {
			if strings.EqualFold(k, "traceparent") {
				traceparentVal = strings.TrimSpace(fmt.Sprintf("%v", v))
			}
			if strings.EqualFold(k, "tracestate") {
				tracestateVal = strings.TrimSpace(fmt.Sprintf("%v", v))
			}
		}
	}

	parts := strings.Split(traceparentVal, "-")
	if len(parts) == 4 && len(parts[0]) == 2 && len(parts[1]) == 32 && len(parts[2]) == 16 && len(parts[3]) == 2 {
		traceId := strings.ToLower(parts[1])
		parentSpanId := strings.ToLower(parts[2])
		flags := strings.ToLower(parts[3])
		if traceId != "00000000000000000000000000000000" && parentSpanId != "0000000000000000" {
			return &Span{
				traceId:      traceId,
				spanId:       telemetryRandomHex(16),
				parentSpanId: parentSpanId,
				flags:        flags,
				name:         name,
				tags:         make(map[string]string),
				tracestate:   tracestateVal,
				startTime:    time.Now(),
			}
		}
	}

	return &Span{
		traceId:      telemetryRandomHex(32),
		spanId:       telemetryRandomHex(16),
		parentSpanId: "",
		flags:        "01",
		name:         name,
		tags:         make(map[string]string),
		tracestate:   tracestateVal,
		startTime:    time.Now(),
	}
}
// ------------------------------------------`;

export const telemetryModule: NativeModule = {
  path: "core/telemetry",

  types: [
    {
      name: "Counter",
      goPointer: true,
      methods: [
        { name: "inc", minArity: 0, maxArity: 1, returns: { kind: "Float" } },
        { name: "add", minArity: 1, maxArity: 2, returns: { kind: "Float" } },
        { name: "get", minArity: 0, maxArity: 1, returns: { kind: "Float" } },
        { name: "reset", arity: 0, returns: { kind: "Void" } },
      ],
    },
    {
      name: "Gauge",
      goPointer: true,
      methods: [
        { name: "set", minArity: 1, maxArity: 2, returns: { kind: "Float" } },
        { name: "inc", minArity: 0, maxArity: 1, returns: { kind: "Float" } },
        { name: "dec", minArity: 0, maxArity: 1, returns: { kind: "Float" } },
        { name: "add", minArity: 1, maxArity: 2, returns: { kind: "Float" } },
        { name: "sub", minArity: 1, maxArity: 2, returns: { kind: "Float" } },
        { name: "get", minArity: 0, maxArity: 1, returns: { kind: "Float" } },
        { name: "reset", arity: 0, returns: { kind: "Void" } },
      ],
    },
    {
      name: "Timer",
      goPointer: true,
      methods: [
        { name: "observe_duration", arity: 0, returns: { kind: "Float" } },
      ],
    },
    {
      name: "Histogram",
      goPointer: true,
      methods: [
        { name: "observe", minArity: 1, maxArity: 2, returns: { kind: "Float" } },
        {
          name: "start_timer",
          minArity: 0,
          maxArity: 1,
          returns: { kind: "Struct", name: "Timer", genericArgs: [] },
        },
        { name: "get_sum", minArity: 0, maxArity: 1, returns: { kind: "Float" } },
        { name: "get_count", minArity: 0, maxArity: 1, returns: { kind: "Int" } },
        { name: "reset", arity: 0, returns: { kind: "Void" } },
      ],
    },
    {
      name: "Span",
      goPointer: true,
      methods: [
        { name: "set_tag", arity: 2, returns: { kind: "Struct", name: "Span", genericArgs: [] } },
        { name: "get_tag", arity: 1, returns: { kind: "String" } },
        {
          name: "inject_w3c_headers",
          arity: 0,
          returns: { kind: "HashMap", keyType: { kind: "String" }, valueType: { kind: "String" } },
        },
        { name: "finish", arity: 0, returns: { kind: "Struct", name: "Span", genericArgs: [] } },
        { name: "trace_id", arity: 0, returns: { kind: "String" } },
        { name: "span_id", arity: 0, returns: { kind: "String" } },
        { name: "parent_span_id", arity: 0, returns: { kind: "String" } },
        { name: "name", arity: 0, returns: { kind: "String" } },
        { name: "duration_ms", arity: 0, returns: { kind: "Int" } },
        { name: "is_finished", arity: 0, returns: { kind: "Bool" } },
      ],
    },
    {
      name: "metrics",
      statics: [
        {
          name: "counter",
          arity: 2,
          returns: { kind: "Struct", name: "Counter", genericArgs: [] },
        },
        {
          name: "gauge",
          arity: 2,
          returns: { kind: "Struct", name: "Gauge", genericArgs: [] },
        },
        {
          name: "histogram",
          minArity: 2,
          maxArity: 3,
          returns: { kind: "Struct", name: "Histogram", genericArgs: [] },
        },
        {
          name: "export_prometheus",
          arity: 0,
          returns: { kind: "String" },
        },
        {
          name: "reset",
          arity: 0,
          returns: { kind: "Void" },
        },
      ],
    },
    {
      name: "tracer",
      statics: [
        {
          name: "start_span",
          minArity: 1,
          maxArity: 2,
          returns: { kind: "Struct", name: "Span", genericArgs: [] },
        },
        {
          name: "start_span_from_headers",
          arity: 2,
          returns: { kind: "Struct", name: "Span", genericArgs: [] },
        },
      ],
    },
  ],

  runtimeBinding: (_interpreter: Interpreter) => ({
    metrics: globalMetrics,
    tracer: globalTracer,
    Counter: { [NATIVE_TAG]: "Counter" },
    Gauge: { [NATIVE_TAG]: "Gauge" },
    Histogram: { [NATIVE_TAG]: "Histogram" },
    Timer: { [NATIVE_TAG]: "Timer" },
    Span: { [NATIVE_TAG]: "Span" },
  }),

  goCodegen: {
    imports: [
      "crypto/rand",
      "encoding/hex",
      "fmt",
      "sort",
      "strconv",
      "strings",
      "sync",
      "time",
    ],
    boilerplate: GO_BOILERPLATE,
  },
};
