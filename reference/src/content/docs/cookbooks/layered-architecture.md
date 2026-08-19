---
title: Arquitetura em Camadas (Le Salvi API)
description: Padrão arquitetural em camadas com Routes, Services, Repositories e Traits.
---

O projeto **Le Salvi API** (`examples/08_le_salvi_api`) demonstra a separação clara de responsabilidades recomendada para aplicações FlexLang corporativas.

---

## 📐 Camadas da Aplicação

1. **Routes (Controladores HTTP)**: Recebem requisições, validam parâmetros e respondem JSON via `res.json()`.
2. **Services (Regras de Negócio)**: Contêm a lógica de domínio, orquestração e concorrência estruturada (`scope`/`spawn`).
3. **Repositories (Acesso a Dados)**: Executam queries no banco de dados via `db/postgres`.
4. **Traits (Interfaces & Contratos)**: Desacoplam regras de negócio de implementações de infraestrutura.

---

## 💡 Exemplo de Fluxo em Camadas

### Trait de Cobrança (`src/traits/billing.flex`)
```flexlang
trait ProcessadorCobranca {
    func cobrar(self, cliente_id: String, valor: Float) -> Result<String, String>;
}
```

### Serviço (`src/services/notifications.flex`)
```flexlang
import { ProcessadorCobranca } from "../traits/billing";

struct ServicoAgendamento {
    gateway: ProcessadorCobranca
}

impl ServicoAgendamento {
    func confirmar_agendamento(self, cliente_id: String, valor: Float) -> Result<String, String> {
        let recibo = self.gateway.cobrar(cliente_id, valor)?;
        return Result.Ok("Agendamento confirmado com recibo ${recibo}");
    }
}
```
