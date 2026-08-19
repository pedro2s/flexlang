---
title: 9. Local Modules & flex.toml
description: Organizing multi-file projects, importing local files, and configuring flex.toml.
---

# Local Modules & `flex.toml`

Real-world FlexLang applications are organized into modular multi-file directories with static dependency resolution.

---

## 📁 Importing Local Modules

Use relative paths starting with `./` or `../` to import structs, functions, enums, and constants:

```flexlang
// src/services/user_service.flex
import { User } from "../models/user";
import { find_by_id } from "../repository/user_repository";

func get_profile(id: Int) -> User {
    return find_by_id(id);
}
```

---

## 🔍 Circular Dependency Prevention

The compiler's **Module Loader** statically builds the dependency DAG and rejects circular import cycles (`A -> B -> A`). Cycles trigger error `E1005` detailing the exact cycle path.

---

## 📄 The `flex.toml` Configuration File

The `flex.toml` file resides at the project root:

```toml
[package]
name = "my-service"
version = "0.1.0"
entry = "src/main.flex"
flex_version = "0.3.0"
```

- `name`: Package name.
- `version`: Package SemVer version.
- `entry`: Default entrypoint when running `flex run` or `flex build`.
- `flex_version`: Minimum required FlexLang compiler version.
