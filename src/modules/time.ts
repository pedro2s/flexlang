import { NATIVE_TAG, type NativeModule } from "./types";

export class FlexDuration {
  readonly [NATIVE_TAG] = "Duration";
  readonly millis: number;

  constructor(millis: number) {
    this.millis = millis;
  }

  static seconds(n: number): FlexDuration {
    return new FlexDuration(n * 1000);
  }

  static millis(n: number): FlexDuration {
    return new FlexDuration(n);
  }

  static minutes(n: number): FlexDuration {
    return new FlexDuration(n * 60 * 1000);
  }

  static hours(n: number): FlexDuration {
    return new FlexDuration(n * 60 * 60 * 1000);
  }

  as_seconds(): number {
    return Math.trunc(this.millis / 1000);
  }

  as_millis(): number {
    return Math.trunc(this.millis);
  }

  to_string(): string {
    return `${this.millis}ms`;
  }
}

export class FlexTime {
  readonly [NATIVE_TAG] = "Time";
  readonly date: Date;

  constructor(date: Date) {
    this.date = date;
  }

  static now(): FlexTime {
    return new FlexTime(new Date());
  }

  static from_unix(secs: number): FlexTime {
    return new FlexTime(new Date(secs * 1000));
  }

  unix(): number {
    return Math.floor(this.date.getTime() / 1000);
  }

  unix_millis(): number {
    return this.date.getTime();
  }

  iso8601(): string {
    return this.date.toISOString().replace(/\.\d{3}Z$/, "Z");
  }

  to_string(): string {
    return this.iso8601();
  }

  format(layout: string): string {
    const yyyy = String(this.date.getUTCFullYear());
    const mm = String(this.date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(this.date.getUTCDate()).padStart(2, "0");
    const hh = String(this.date.getUTCHours()).padStart(2, "0");
    const min = String(this.date.getUTCMinutes()).padStart(2, "0");
    const ss = String(this.date.getUTCSeconds()).padStart(2, "0");

    let res = layout;
    res = res.replace(/YYYY|2006/g, yyyy);
    res = res.replace(/MM|01/g, mm);
    res = res.replace(/DD|02/g, dd);
    res = res.replace(/HH|15/g, hh);
    res = res.replace(/mm|04/g, min);
    res = res.replace(/ss|05/g, ss);
    return res;
  }

  add_duration(d: FlexDuration): FlexTime {
    return new FlexTime(new Date(this.date.getTime() + d.millis));
  }

  sub(other: FlexTime): FlexDuration {
    return new FlexDuration(this.date.getTime() - other.date.getTime());
  }

  before(other: FlexTime): boolean {
    return this.date.getTime() < other.date.getTime();
  }

  after(other: FlexTime): boolean {
    return this.date.getTime() > other.date.getTime();
  }
}

const GO_BOILERPLATE = `// --- FlexLang core/time ---
type Time struct {
	t time.Time
}

type Duration struct {
	d time.Duration
}

func Time_now() *Time {
	return &Time{t: time.Now().UTC()}
}

func Time_from_unix(secs int) *Time {
	return &Time{t: time.Unix(int64(secs), 0).UTC()}
}

func (t *Time) unix() int {
	return int(t.t.Unix())
}

func (t *Time) unix_millis() int {
	return int(t.t.UnixMilli())
}

func (t *Time) iso8601() string {
	return t.t.UTC().Format("2006-01-02T15:04:05Z")
}

func (t *Time) to_string() string {
	return t.iso8601()
}

func (t *Time) format(layout string) string {
	l := layout
	l = strings.ReplaceAll(l, "YYYY", "2006")
	l = strings.ReplaceAll(l, "MM", "01")
	l = strings.ReplaceAll(l, "DD", "02")
	l = strings.ReplaceAll(l, "HH", "15")
	l = strings.ReplaceAll(l, "mm", "04")
	l = strings.ReplaceAll(l, "ss", "05")
	return t.t.UTC().Format(l)
}

func (t *Time) add_duration(d *Duration) *Time {
	return &Time{t: t.t.Add(d.d)}
}

func (t *Time) sub(other *Time) *Duration {
	return &Duration{d: t.t.Sub(other.t)}
}

func (t *Time) before(other *Time) bool {
	return t.t.Before(other.t)
}

func (t *Time) after(other *Time) bool {
	return t.t.After(other.t)
}

func Duration_seconds(n int) *Duration {
	return &Duration{d: time.Duration(n) * time.Second}
}

func Duration_millis(n int) *Duration {
	return &Duration{d: time.Duration(n) * time.Millisecond}
}

func Duration_minutes(n int) *Duration {
	return &Duration{d: time.Duration(n) * time.Minute}
}

func Duration_hours(n int) *Duration {
	return &Duration{d: time.Duration(n) * time.Hour}
}

func (d *Duration) as_seconds() int {
	return int(d.d / time.Second)
}

func (d *Duration) as_millis() int {
	return int(d.d / time.Millisecond)
}

func (d *Duration) to_string() string {
	return d.d.String()
}
// --------------------------`;

export const timeModule: NativeModule = {
  path: "core/time",

  types: [
    {
      name: "Time",
      goPointer: true,
      statics: [
        {
          name: "now",
          arity: 0,
          returns: { kind: "Struct", name: "Time", genericArgs: [] },
        },
        {
          name: "from_unix",
          arity: 1,
          returns: { kind: "Struct", name: "Time", genericArgs: [] },
        },
      ],
      methods: [
        { name: "unix", arity: 0, returns: { kind: "Int" } },
        { name: "unix_millis", arity: 0, returns: { kind: "Int" } },
        { name: "iso8601", arity: 0, returns: { kind: "String" } },
        { name: "format", arity: 1, returns: { kind: "String" } },
        {
          name: "add_duration",
          arity: 1,
          returns: { kind: "Struct", name: "Time", genericArgs: [] },
        },
        {
          name: "sub",
          arity: 1,
          returns: { kind: "Struct", name: "Duration", genericArgs: [] },
        },
        { name: "before", arity: 1, returns: { kind: "Bool" } },
        { name: "after", arity: 1, returns: { kind: "Bool" } },
        { name: "to_string", arity: 0, returns: { kind: "String" } },
      ],
    },
    {
      name: "Duration",
      goPointer: true,
      statics: [
        {
          name: "seconds",
          arity: 1,
          returns: { kind: "Struct", name: "Duration", genericArgs: [] },
        },
        {
          name: "millis",
          arity: 1,
          returns: { kind: "Struct", name: "Duration", genericArgs: [] },
        },
        {
          name: "minutes",
          arity: 1,
          returns: { kind: "Struct", name: "Duration", genericArgs: [] },
        },
        {
          name: "hours",
          arity: 1,
          returns: { kind: "Struct", name: "Duration", genericArgs: [] },
        },
      ],
      methods: [
        { name: "as_seconds", arity: 0, returns: { kind: "Int" } },
        { name: "as_millis", arity: 0, returns: { kind: "Int" } },
        { name: "to_string", arity: 0, returns: { kind: "String" } },
      ],
    },
  ],

  runtimeBinding: () => ({
    Time: {
      [NATIVE_TAG]: "Time",
      now: () => FlexTime.now(),
      from_unix: (s: number) => FlexTime.from_unix(s),
    },
    Duration: {
      [NATIVE_TAG]: "Duration",
      seconds: (n: number) => FlexDuration.seconds(n),
      millis: (n: number) => FlexDuration.millis(n),
      minutes: (n: number) => FlexDuration.minutes(n),
      hours: (n: number) => FlexDuration.hours(n),
    },
  }),

  goCodegen: {
    imports: ["time", "strings"],
    boilerplate: GO_BOILERPLATE,
  },
};
