---
title: 6. Enums e Pattern Matching
description: Tipos soma (Sum Types) com payloads posicionais e desestruturação exaustiva com match.
---

Na FlexLang, `enum` não é apenas uma lista de constantes numéricas — são **Sum Types (Tipos Soma)** que podem carregar dados e payloads tipados em cada variante.

---

## 📦 Declarando Enums com Payloads

Cada variante de um enum pode conter parâmetros posicionais de tipos distintos:

```flexlang
enum StatusTransacao {
    Pendente,
    Aprovada(String),     // Carrega o comprovante (String)
    Rejeitada(Int, String) // Carrega código de erro (Int) e motivo (String)
}
```

### Instanciação de Variantes
```flexlang
let t1 = StatusTransacao.Pendente;
let t2 = StatusTransacao.Aprovada("AUTH_891230");
let t3 = StatusTransacao.Rejeitada(402, "Saldo insuficiente");
```

---

## 🎯 Pattern Matching com `match`

A instrução `match` desestrutura enums com segurança e extrai os valores contidos nos payloads:

```flexlang
func processar(status: StatusTransacao) {
    match status {
        StatusTransacao.Pendente {
            print("Aguardando processamento...");
        },
        StatusTransacao.Aprovada(recibo) {
            print("Transação aprovada! Recibo: ");
            print(recibo);
        },
        StatusTransacao.Rejeitada(codigo, motivo) {
            print("Transação rejeitada com código: ");
            print(codigo);
            print(motivo);
        }
    }
}
```

---

## 🛡️ Checagem de Exaustividade Estática (*Exhaustiveness Checking*)

O compilador exige que **todas as variantes sejam obrigatoriamente tratadas**. Se você adicionar uma nova variante a um `enum` e esquecer de tratá-la em algum `match`, o compilador rejeitará o código com o erro `E2010`:

```flexlang
// Se StatusTransacao tiver a variante 'Cancelada' e você não a cobrir:
// ERRO DE COMPILAÇÃO E2010: match is not exhaustive, missing variant 'Cancelada'
```

Isso garante que refatorações em regras de negócio complexas nunca deixem pontas soltas.
