# RFC-041 — Framework Nativo de Testes Unitários (`std/testing` e `flex test`)

> **Status:** IMPLEMENTADO · **Prioridade:** P0 — Bloqueante · **Depende de:** nada

---

## 1. Motivação

Até a v0.3.0, a FlexLang foi testada inteiramente por uma suíte interna no código do compilador (`tests/runner.ts`), que funciona bem para o desenvolvimento da linguagem, mas é inútil para **desenvolvedores finais** que constroem backends de missão crítica (como o `flexbank`).
Uma linguagem madura exige baterias inclusas de testes. A FlexLang necessita de um comando nativo `flex test` e um módulo `std/testing` para que usuários possam testar suas próprias funções.

---

## 2. Design da API

### 2.1 Módulo `std/testing` (Asserções)

```flexlang
import { testing } from "std/testing";

// 1. Asserções Básicas
testing.assert_true(1 == 1, "A matemática básica falhou");
testing.assert_false(1 == 2, "Um não deve ser dois");

// 2. Asserção de Igualdade e Desigualdade
testing.assert_eq("FlexLang", "FlexLang", "Strings devem ser iguais");
testing.assert_neq(42, 0, "Valores não podem coincidir");

// 3. Asserção para Result e Option
let res = Result.Ok(100);
let val = testing.assert_ok(res, "Deveria retornar Ok"); // Retorna 100
testing.assert_eq(val, 100, "");

let err = Result.Err("Falha de Rede");
let err_msg = testing.assert_err(err, "Deveria falhar"); // Retorna "Falha de Rede"

let opt = Option.Some(true);
testing.assert_some(opt, "Não pode ser None");
testing.assert_none(Option.None, "Deve ser None");
```

### 2.2 Anotações e Estrutura de Arquivos

Funções de teste devem:
1. Começar com a anotação `#[test]` e/ou o prefixo `test_`.
2. Estar em arquivos com sufixo `_test.flex` ou na pasta `tests/` do projeto.

```flexlang
// math_test.flex
import { testing } from "std/testing";
import { Decimal } from "math/decimal";

#[test]
func test_decimal_addition() {
    let a = Decimal.new("0.1");
    let b = Decimal.new("0.2");
    
    testing.assert_eq(a.add(b).to_string(), "0.3", "IEEE 754 fails here, Decimal shouldn't");
}

#[test]
func test_divide_by_zero_should_fail() {
    let a = Decimal.new("10");
    let b = Decimal.new("0");
    
    testing.assert_err(a.div(b), "Divisão por zero");
}
```

---

## 3. Integração com a CLI

- `flex test`: Comando que escaneia o diretório atual recursivamente em busca de funções `#[test]` e as executa com isolamento, apresentando um output legível e colorido de falhas vs sucessos (estilo Rust/Go).
- O compilador extrai os testes e roda-os via TS (rápido) ou via Go nativamente (`flex test --native`) com a flag do parity gate habilitada.

---

## 4. Plano de Implementação
- [ ] Adicionar suporte a `#[test]` no Parser (Attributes).
- [ ] Implementar `std/testing` no interpretador TS (utilizando exceptions ocultas que falham o caso de teste graciosamente, sem quebrar o suite).
- [ ] Implementar `std/testing` no Go Transpiler mapeando para `testing.T` nativo do Go.
- [ ] Expandir CLI `cli.ts` para mapear comandos `test`.
