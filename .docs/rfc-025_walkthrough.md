# Walkthrough: Implementação da RFC-025 — Módulo `math/decimal`

Implementamos com sucesso a especificação [RFC-025](file:///home/pedro/dev/pedro/flexlang/.docs/v0.3/rfcs/rfc-025-decimal-module.md) na linguagem FlexLang, introduzindo o módulo nativo `math/decimal` com o tipo `Decimal` para cálculos financeiros exatos sem erros de arredondamento de ponto flutuante.

---

## 🛠️ Recursos Implementados

### 1. Construtores Estáticos
- `Decimal.new(s: String) -> Decimal`: Criação canônica e segura a partir de string (ex: `Decimal.new("0.1")`).
- `Decimal.from_int(n: Int) -> Decimal`: Criação a partir de número inteiro.

### 2. Operações Aritméticas Exatas
| Método | Assinatura | Retorno | Descrição |
|---|---|---|---|
| `add` | `d.add(other: Decimal)` | `Decimal` | Soma exata (`0.1 + 0.2 = 0.3`) |
| `sub` | `d.sub(other: Decimal)` | `Decimal` | Subtração exata |
| `mul` | `d.mul(other: Decimal)` | `Decimal` | Multiplicação exata com ajuste de escala |
| `div` | `d.div(other: Decimal)` | `Result<Decimal, String>` | Divisão segura (`Result.Err("division by zero")`) |
| `modulo` | `d.modulo(other: Decimal)` | `Decimal` | Resto da divisão |
| `neg` | `d.neg()` | `Decimal` | Negação |
| `abs` | `d.abs()` | `Decimal` | Valor absoluto |
| `round` | `d.round(places: Int)` | `Decimal` | Arredondamento bancário (*half-even*) |
| `pow` | `d.pow(exp: Int)` | `Decimal` | Potenciação inteira |

### 3. Comparações e Conversões
- **Comparações**: `eq`, `gt`, `lt`, `gte`, `lte`, `is_zero`, `is_positive`, `is_negative`, `cmp`.
- **Conversões**: `to_string`, `to_float`, `to_int`.
- **Serialização**: `MarshalJSON` e `toJSON` formatados como string numérica exata.

---

## 🔧 Alterações por Componente

1. **Módulo Nativo ([`src/modules/decimal.ts`](file:///home/pedro/dev/pedro/flexlang/src/modules/decimal.ts))**:
   - Implementação de `FlexDecimal` em TypeScript com aritmética de `BigInt` escalado.
   - Boilerplate Go autossuficiente com `*big.Int` da biblioteca padrão Go, sem dependências externas, garantindo compatibilidade universal e compilação instantânea.

2. **Registro de Módulos ([`src/modules/registry.ts`](file:///home/pedro/dev/pedro/flexlang/src/modules/registry.ts))**:
   - Registro de `decimalModule` como módulo embutido padrão.

3. **Transpiler Go ([`src/transpiler.ts`](file:///home/pedro/dev/pedro/flexlang/src/transpiler.ts))**:
   - Suporte a métodos de struct como `to_float()` e `to_int()` de módulos nativos.

---

## 🧪 Testes e Validação

### Resultados dos Testes:
1. **Novo Teste Golden [`tests/44_decimal.flex`](file:///home/pedro/dev/pedro/flexlang/tests/44_decimal.flex)**:
   - Aritmética básica (`0.1 + 0.2 = 0.3`, `sub`, `mul`, `div`, `modulo`, `neg`, `abs`).
   - Arredondamento bancário *half-even* e potenciação.
   - Comparações e conversões.
   - Caso de uso bancário de split de parcelas com compensação na última parcela.
2. **Suíte Golden Completa**:
   ```bash
   $ npm test
   Tests Completed: 44 passed, 0 failed.
   ```
3. **Paridade Node ↔ Go**:
   ```bash
   $ npm run test:parity
   Parity gate: 39 passaram, 0 falharam, 5 sem comparação de stdout.
   ```
4. **Testes da Extensão VSCode**:
   ```bash
   $ npm run test:vscode
   ✅ Sucesso: RFC-025: módulo math/decimal com todas as operações e Result validado
   ✨ Todos os testes das Ferramentas VSCode passaram com 100% de sucesso!
   ```
