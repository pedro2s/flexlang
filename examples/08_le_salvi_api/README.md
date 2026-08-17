# 💇‍♀️ Le Salvi API (Exemplo Completo FlexLang)

Este projeto demonstra uma aplicação backend completa e modular desenvolvida em **FlexLang v0.2.0**, inspirada na plataforma de estética e beleza **Le Salvi**.

O objetivo deste projeto é cobrir e validar todos os recursos da linguagem e de sua biblioteca padrão de ponta-a-ponta em uma arquitetura limpa em camadas.

---

## 🏗️ Estrutura do Projeto

```text
examples/08_le_salvi_api/
├── flex.toml                     # Manifesto do projeto e versão da FlexLang
├── README.md                     # Documentação e guia de uso da API
└── src/
    ├── database/
    │   └── db.flex               # Conexão e fallback de persistência com db/postgres
    ├── middlewares/
    │   └── auth.flex             # Middlewares de observabilidade e autenticação
    ├── models/
    │   └── entities.flex         # Structs, Enums e Tipos de Domínio
    ├── routes/
    │   ├── appointments_routes.flex  # Rotas REST completas (GET, POST, PUT, PATCH, DELETE)
    │   ├── auth_routes.flex          # Autenticação e mascaramento de senhas
    │   └── services_routes.flex      # Catálogo de serviços e busca por ID
    ├── services/
    │   └── notifications.flex    # Serviço assíncrono e auditoria
    ├── traits/
    │   └── billing.flex          # Traits polimórficos e regras de cálculo de faturamento
    └── main.flex                 # Ponto de entrada do servidor e configuração de CORS
```

---

## 🌟 Recursos da FlexLang Demonstrados

1. **Servidor HTTP Nativo (`net/http`)**:
   - Roteamento moderno por verbo: `server.get`, `server.post`, `server.put`, `server.patch`, `server.delete` (RFC-011).
   - Despacho em duas fases com `405 Method Not Allowed` e cabeçalho `Allow`.
   - Derivação automática de `HEAD` e `OPTIONS`.
   - Configuração de CORS com Preflight automático: `server.cors(CorsConfig { ... })` (RFC-015).
   - Cadeia global de Middlewares: `server.use(logging_mw)`, `server.use(auth_mw)` (RFC-015).
   - Leitura de headers case-insensitive (`req.header`) e emissão de headers customizados (`res.header`).
   - Isenção automática de `/healthz` de toda autenticação.

2. **Sistema de Tipos e Orientação a Traits**:
   - **Structs** para entidades e DTOs (`Appointment`, `SalonService`, `User`, `CreateAppointmentRequest`).
   - **Enums** ricos (`UserRole`, `AppointmentStatus`).
   - **Traits** e polimorfismo (`trait PricingPolicy`, `impl PricingPolicy for LoyaltyBilling`).
   - **Propagação de Erro com `?`** e tipos funcionais `Result<T, E>` / `Option<T>`.
   - **Pattern Matching Exaustivo** com a nova sintaxe de blocos diretos (RFC-016).

3. **Segurança e Observabilidade (`core/log` e `db/postgres`)**:
   - Logs estruturados em formato JSON (RFC-007).
   - **Mascaramento automático** de credenciais e campos sensíveis em logs (`password`, `token`, `secret`, `authorization`, `api_key`) (RFC-009).
   - Conexão e superfície com PostgreSQL parametrizada e imune a SQL Injection (RFC-005).
   - Recuperação automática de panic por request (RFC-008).

4. **Gerenciamento de Projeto e Watcher (`flex.toml`)**:
   - Resolução de `entry` e checagem de versão de compatibilidade (`flex_version = "0.2.0"`).
   - Suporte a recarregamento automático em desenvolvimento com `flex run --watch`.

---

## 🚀 Como Executar

### 1. Modo Interpretado
A partir da raiz do projeto FlexLang:
```bash
flex run examples/08_le_salvi_api/src/main.flex
```
Ou dentro do diretório `examples/08_le_salvi_api` (lê o `flex.toml` automaticamente):
```bash
flex run
```

### 2. Modo Watch (Hot Reloading em Desenvolvimento)
```bash
flex run --watch
```

### 3. Compilação para Binário Nativo (Go Transpiler)
```bash
flex build
./build/main
```

---

## 📡 Endpoints da API

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/healthz` | Health check nativo da plataforma (isento de middlewares) |
| `POST` | `/auth/login` | Login de profissionais/clientes (com log de senha mascarada) |
| `GET` | `/services` | Lista catálogo de procedimentos e serviços |
| `GET` | `/services/:id` | Detalhes de um procedimento específico |
| `GET` | `/appointments` | Lista agendamentos (suporta query `?status=Scheduled`) |
| `GET` | `/appointments/:id` | Consulta agendamento por ID |
| `POST` | `/appointments` | Cria agendamento com cálculo fidelidade e notificação |
| `PUT` | `/appointments/:id` | Atualização completa de agendamento |
| `PATCH` | `/appointments/:id` | Atualização parcial de status |
| `DELETE` | `/appointments/:id` | Cancelamento de agendamento |
| `OPTIONS` | `/appointments/:id` | Preflight CORS com 204 e headers `Access-Control-*` |
