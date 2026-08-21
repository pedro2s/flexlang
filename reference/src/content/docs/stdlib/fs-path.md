---
title: std/fs & std/path — Arquivos e Diretórios
description: Manipulação assíncrona do sistema de arquivos e normalização de caminhos multiplataforma.
---

Os módulos `std/fs` e `std/path` oferecem operações robustas e não-bloqueantes para leitura, escrita, criação de diretórios e manipulação segura de caminhos em Linux, macOS e Windows.

```flexlang
import { fs } from "std/fs";
import { path } from "std/path";
```

---

## 📁 1. Operações no Sistema de Arquivos (`std/fs`)

```flexlang
let log_path = "build/audit.log";

// 1. Criação recursiva de diretórios
fs.create_dir_all("build/reports/daily");

// 2. Escrita e anexação de texto
fs.write_string(log_path, "START_AUDIT\n");
fs.append_string(log_path, "TRANSACTION_ID=tx_99182 STATUS=SUCCESS\n");

// 3. Leitura de arquivos
let content_res = fs.read_to_string(log_path);
match content_res {
    Result.Ok(text) {
        print("Conteúdo lido:");
        print(text);
    },
    Result.Err(err) {
        print("Erro de leitura: ${err}");
    }
}

// 4. Verificação de existência e listagem
if (fs.exists(log_path) && fs.is_file(log_path)) {
    let files = fs.read_dir("build");
    print(files);
}

// 5. Remoção de arquivos
fs.remove_file(log_path);
```

---

## 🛣️ 2. Manipulação de Caminhos (`std/path`)

```flexlang
// Junção de caminhos com separador nativo do SO
let full_path = path.join(["/var", "log", "flexbank", "core.log"]);
print(full_path); // "/var/log/flexbank/core.log"

// Extração de metadados
let base = path.basename(full_path);   // "core.log"
let dir = path.dirname(full_path);     // "/var/log/flexbank"
let extension = path.ext(full_path);   // ".log"
let is_abs = path.is_absolute(full_path); // true

// Normalização de segmentos relativos (., ..)
let clean = path.normalize("/var/log/../log/flexbank/./core.log");
```
