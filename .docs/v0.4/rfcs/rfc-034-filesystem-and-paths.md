# RFC-034 — Módulo de Sistema de Arquivos e Caminhos (`std/fs`, `std/path`)

> **Status:** Proposto · **Prioridade:** P0 · **Depende de:** nada

---

## 1. Motivação

Sistemas bancários necessitam de operações de I/O em disco para:
1. **Leitura de Certificados Digitais e Chaves Criptográficas** (`.pem`, `.crt`, `.key`) usados em conexões mTLS com o Banco Central e adquirentes.
2. **Gravação de Arquivos de Auditoria e CNAB**: Geração de arquivos de remessa e retorno bancário (CNAB 240 / CNAB 400).
3. **Manipulação Segura de Caminhos de Diretórios**: Prevenção de vulnerabilidades de *Path Traversal* (`../`).

---

## 2. Design da API

### 2.1 Módulo `std/fs` (File System)

```flexlang
import { fs } from "std/fs";

// Leitura de arquivo como String (UTF-8)
let cert_content = fs.read_to_string("/etc/ssl/certs/pix_certificate.pem")?;

// Escrita de arquivo (cria ou sobrescreve)
fs.write_string("/var/log/flexbank/audit_20260819.log", "TRANSACAO_LIQUIDADA_OK\n")?;

// Anexar conteúdo ao final de arquivo existente
fs.append_string("/var/log/flexbank/audit.log", "NOVA_LINHA_AUDITORIA\n")?;

// Verificações e metadados
let exists = fs.exists("/tmp/lock.pid");
let is_file = fs.is_file("/etc/hosts");
let is_dir = fs.is_dir("/var/data");

// Manipulação de diretórios
fs.create_dir_all("/var/data/flexbank/cnab/processed")?;
let files = fs.read_dir("/var/data/flexbank/cnab")?; // [String] com nomes dos arquivos

// Remoção segura
fs.remove_file("/tmp/temp_file.tmp")?;
```

---

### 2.2 Módulo `std/path` (Manipulação de Caminhos)

```flexlang
import { path } from "std/path";

// Junção de segmentos com separador correto do SO (/ ou \)
let full_path = path.join(["/var", "data", "flexbank", "config.json"]);
// "/var/data/flexbank/config.json"

// Normalização e resolução
let clean_path = path.normalize("/var/data/../data/./file.txt"); // "/var/data/file.txt"
let base_name = path.basename("/etc/ssl/cert.pem");               // "cert.pem"
let dir_name = path.dirname("/etc/ssl/cert.pem");                 // "/etc/ssl"
let extension = path.ext("/etc/ssl/cert.pem");                    // ".pem"
let is_abs = path.is_absolute("/etc/ssl");                        // true
```

---

## 3. Exemplo de Uso: Leitura de Certificado mTLS

```flexlang
import { fs } from "std/fs";
import { path } from "std/path";
import { env } from "os/env";

func load_bacen_mtls_credentials() -> Result<{ cert: String, key: String }, String> {
    let base_dir = env.get_or("CERT_BASE_DIR", "/etc/flexbank/certs");
    
    let cert_path = path.join([base_dir, "bacen_spi.crt"]);
    let key_path = path.join([base_dir, "bacen_spi.key"]);

    if !fs.exists(cert_path) {
        return Result.Err("CERT_FILE_NOT_FOUND: ${cert_path}");
    }

    if !fs.exists(key_path) {
        return Result.Err("KEY_FILE_NOT_FOUND: ${key_path}");
    }

    let cert_data = fs.read_to_string(cert_path)?;
    let key_data = fs.read_to_string(key_path)?;

    return Result.Ok({
        cert: cert_data,
        key: key_data
    });
}
```

---

## 4. Implementação e Paridade

### 4.1 Modo Interpretado (TypeScript)
- `std/fs` mapeia para `node:fs` síncrono ou com Promises (`fs.readFileSync`, `fs.writeFileSync`, `fs.mkdirSync`).
- `std/path` mapeia para `node:path` (`path.join`, `path.normalize`, `path.basename`).

### 4.2 Modo Compilado (Go)
- `std/fs` mapeia para os pacotes nativos do Go `os` e `io` (`os.ReadFile`, `os.WriteFile`, `os.MkdirAll`, `os.Stat`).
- `std/path` mapeia para `path/filepath` (`filepath.Join`, `filepath.Clean`, `filepath.Base`, `filepath.Ext`).

---

## 5. Plano de Testes

- Teste de leitura/escrita de arquivos com caracteres UTF-8.
- Teste de criação recursiva de diretórios (`create_dir_all`).
- Teste de tentativa de leitura de arquivo inexistente retornando `Result.Err`.
- Paridade 100% de saída e manipulação de paths no parity gate.
