// Teste RFC-027: Módulo core/time - Timestamps, Durações e Formatação

import { Time, Duration } from "core/time";

func test_durations() {
    print("--- 1. Durations ---");
    let d_sec = Duration.seconds(10);
    print("10s em segundos: ${d_sec.as_seconds()}");
    print("10s em millis: ${d_sec.as_millis()}");

    let d_min = Duration.minutes(5);
    print("5min em segundos: ${d_min.as_seconds()}");

    let d_hours = Duration.hours(2);
    print("2h em segundos: ${d_hours.as_seconds()}");

    let d_ms = Duration.millis(2500);
    print("2500ms em segundos: ${d_ms.as_seconds()}");
    print("2500ms em millis: ${d_ms.as_millis()}");
}

func test_timestamps() {
    print("--- 2. Timestamps ---");
    let epoch = Time.from_unix(0);
    print("Epoch unix: ${epoch.unix()}");
    print("Epoch iso8601: ${epoch.iso8601()}");

    let t100 = Time.from_unix(100);
    print("t100 unix: ${t100.unix()}");
    print("t100 unix_millis: ${t100.unix_millis()}");

    let t_plus = epoch.add_duration(Duration.seconds(3600));
    print("Epoch + 1h iso8601: ${t_plus.iso8601()}");

    let diff = t_plus.sub(epoch);
    print("Diff em segundos: ${diff.as_seconds()}");

    let is_before = epoch.before(t_plus);
    let is_after = t_plus.after(epoch);
    print("Epoch before Epoch+1h: ${is_before}");
    print("Epoch+1h after Epoch: ${is_after}");

    let formatted = t_plus.format("YYYY-MM-DD HH:mm:ss");
    print("Formatado: ${formatted}");
}

func main() {
    test_durations();
    test_timestamps();
}

main();
