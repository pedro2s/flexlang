---
title: flex.toml Manifest
description: Specification of all configuration keys and options in the flex.toml manifest.
---

# `flex.toml` Specification

The `flex.toml` file is the declarative manifest required at the root of every FlexLang application.

---

## 📄 Complete Example

```toml
[package]
name = "my-banking-api"
version = "1.0.0"
entry = "src/main.flex"
flex_version = "0.3.0"
description = "High-performance financial settlement service"
```

---

## 🏷️ Supported Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `String` | **Yes** | Unique package/project identifier. |
| `version` | `String` | **Yes** | Current SemVer version (e.g. `"0.1.0"`, `"1.0.0"`). |
| `entry` | `String` | **Yes** | Relative path to main entrypoint file (e.g. `"src/main.flex"`). |
| `flex_version` | `String` | **Yes** | Minimum required compiler version. Running on an older compiler triggers an actionable upgrade error. |
| `description` | `String` | No | Short service description. |
