// parity: nondeterministic timestamps dinamicos nos logs
import { log } from "core/log";

scope {
    spawn {
        let arr = [1];
        print(arr[10]); // Panic here
    }
}

log.info("Finished", { status: "success" });
