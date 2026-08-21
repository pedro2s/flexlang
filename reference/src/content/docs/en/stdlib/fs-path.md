---
title: std/fs & std/path — Files & Paths
description: Asynchronous filesystem operations and cross-platform path normalization.
---

The `std/fs` and `std/path` modules provide non-blocking file I/O, directory management, and cross-platform path manipulation for backend services across Linux, macOS, and Windows.

```flexlang
import { fs } from "std/fs";
import { path } from "std/path";
```

---

## 📁 1. Filesystem Operations (`std/fs`)

```flexlang
let file_path = "build/audit.log";

// 1. Recursive directory creation
fs.create_dir_all("build/reports/daily");

// 2. Writing & Appending
fs.write_string(file_path, "START_AUDIT\n");
fs.append_string(file_path, "TRANSACTION_ID=tx_99182 STATUS=SUCCESS\n");

// 3. Reading files
let content_res = fs.read_to_string(file_path);
match content_res {
    Result.Ok(text) {
        print(text);
    },
    Result.Err(err) {
        print("Read error: ${err}");
    }
}

// 4. File existence & directory listing
if (fs.exists(file_path) && fs.is_file(file_path)) {
    let files = fs.read_dir("build");
    print(files);
}

// 5. File deletion
fs.remove_file(file_path);
```

---

## 🛣️ 2. Path Normalization (`std/path`)

```flexlang
let full_path = path.join(["/var", "log", "flexbank", "core.log"]);
let base = path.basename(full_path);      // "core.log"
let dir = path.dirname(full_path);        // "/var/log/flexbank"
let extension = path.ext(full_path);      // ".log"
let is_abs = path.is_absolute(full_path); // true
let clean = path.normalize("/var/log/../log/flexbank/./core.log");
```
