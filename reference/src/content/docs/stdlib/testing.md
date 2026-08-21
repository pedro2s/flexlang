---
title: std/testing — Framework Nativo de Testes Unitários
description: Framework nativo de testes unitários com anotações #[test], asserções completas de igualdade profunda e execução via CLI flex test.
---

O módulo `std/testing` é o framework nativo de testes unitários da FlexLang (RFC-041). Ele permite escrever suítes de testes de missão crítica com funções anotadas com `#[test]`, asserções com validação de igualdade profunda e execução isolada pela CLI `flex test` nos modos interpretado e compilado Go (`--native`).

```flexlang
import { testing } from "std/testing";
```

---

## 🧪 1. Estrutura de Arquivos de Teste

Funções de teste devem:
1. Conter o atributo `#[test]` e/ou o prefixo `test_`.
2. Estar localizadas em arquivos terminados em `_test.flex` ou dentro do diretório `tests/` do seu projeto.

### Exemplo Completo

```flexlang
// tests/math_test.flex
import { testing } from "std/testing";
import { Decimal } from "math/decimal";

#[test]
func test_decimal_addition() {
    let a = Decimal.new("0.1");
    let b = Decimal.new("0.2");
    let c = a.add(b);

    // Asserção de igualdade com mensagem customizada em caso de falha
    testing.assert_eq(c.to_string(), "0.3", "Aritmética exata com Decimal falhou");
}

#[test]
func test_boolean_conditions() {
    testing.assert_true(10 > 5, "10 deve ser maior que 5");
    testing.assert_false(2 == 3, "2 não pode ser igual a 3");
    testing.assert_neq("chave_a", "chave_b", "Chaves devem ser distintas");
}

#[test]
func test_result_and_option_unpacking() {
    // 1. Asserção que desempacota o valor de Result.Ok
    let res = Result.Ok(500);
    let valor = testing.assert_ok(res, "Deveria ter retornado Ok");
    testing.assert_eq(valor, 500, "Valor desempacotado incorreto");

    // 2. Asserção que desempacota o erro de Result.Err
    let res_err = Result.Err("saldo_insuficiente");
    let msg_erro = testing.assert_err(res_err, "Deveria ter falhado com saldo insuficiente");
    testing.assert_eq(msg_erro, "saldo_insuficiente", "");

    // 3. Asserção de Option.Some e Option.None
    let opt = Option.Some("alice");
    let nome = testing.assert_some(opt, "Deveria conter um valor");
    testing.assert_eq(nome, "alice", "");

    testing.assert_none(Option.None, "Deveria ser None");
}
```

---

## 📋 2. Tabela de Asserções (`std/testing`)

| Asserção | Assinatura | Retorno | Descrição |
|---|---|---|---|
| `assert_eq` | `testing.assert_eq(actual, expected, msg?)` | `Void` | Valida igualdade profunda estrutural (primitivos, mapas, arrays, enums). |
| `assert_neq` | `testing.assert_neq(actual, expected, msg?)` | `Void` | Valida que os dois valores são diferentes. |
| `assert_true` | `testing.assert_true(condition, msg?)` | `Void` | Assegura que a expressão booleana é `true`. |
| `assert_false` | `testing.assert_false(condition, msg?)` | `Void` | Assegura que a expressão booleana é `false`. |
| `assert_ok` | `testing.assert_ok(result, msg?)` | `T` | Valida `Result.Ok(T)` e **retorna o valor desempacotado `T`**. |
| `assert_err` | `testing.assert_err(result, msg?)` | `E` | Valida `Result.Err(E)` e **retorna o erro desempacotado `E`**. |
| `assert_some` | `testing.assert_some(option, msg?)` | `T` | Valida `Option.Some(T)` e **retorna o valor desempacotado `T`**. |
| `assert_none` | `testing.assert_none(option, msg?)` | `Void` | Assegura que o valor é `Option.None`. |

---

## 🚀 3. Execução via CLI (`flex test`)

O comando `flex test` descobre automaticamente todos os arquivos de teste do projeto e executa cada função `#[test]` em isolamento com captura de exceções/panics.

```bash
# 1. Executa todos os testes no modo interpretado (rápido para desenvolvimento)
flex test

# 2. Executa uma suíte ou pasta específica
flex test tests/math_test.flex
flex test tests/

# 3. Modo compilado nativo Go (valida o Parity Gate ADR-001)
flex test --native (ou -n)

# 4. Exibe ajuda
flex test --help
```

### Exemplo de Saída no Terminal:

```text
running 1 test suite(s)...

running 3 test(s) in tests/math_test.flex:
  test test_decimal_addition ... ok
  test test_boolean_conditions ... ok
  test test_result_and_option_unpacking ... ok

test result: ok. 3 passed; 0 failed; finished in 14ms
```
