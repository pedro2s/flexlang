---
title: 1. Variáveis, Imutabilidade e Constantes
description: Aprenda sobre let, let mut, const e o sistema de isolamento de mutabilidade da FlexLang.
---

Na FlexLang, a segurança de dados e a ausência de condições de corrida (*data races*) começam na declaração de variáveis.

---

## 🔒 Imutabilidade por Padrão (`let`)

Por padrão, toda variável declarada com `let` é estritamente imutável:

```flexlang
let port = 8080;
let host = "localhost";

// Erro de compilação: Não é possível reatribuir variável imutável
// port = 9000;
```

A inferência de tipos deduz automaticamente o tipo do valor, mas você também pode declará-lo explicitamente:

```flexlang
let max_connections: Int = 100;
let app_name: String = "FlexBank";
let is_active: Bool = true;
```

---

## ✏️ Mutabilidade Explícita (`let mut`)

Quando você precisa alterar o valor de uma variável ou modificar propriedades de uma estrutura, deve declará-la explicitamente com a palavra-chave `mut`:

```flexlang
let mut contador = 0;
contador = contador + 1;
print(contador); // Imprime: 1
```

### Mutabilidade em Estruturas
A mutabilidade é controlada na raiz da variável:

```flexlang
struct User {
    id: Int,
    name: String
}

let mut usuario = User { id: 1, name: "Alice" };
usuario.name = "Bob"; // Permitido porque 'usuario' foi declarado como 'mut'

let fixo = User { id: 2, name: "Carlos" };
// fixo.name = "Daniel"; // ERRO ESTÁTICO: 'fixo' é imutável
```

---

## 🛡️ Constantes Globais (`const`)

Constantes são declaradas com a palavra-chave `const` no nível de módulo (top-level). Elas são avaliadas em tempo de compilação e possuem imutabilidade absoluta:

```flexlang
const MAX_RETRIES = 3;
const TAX_RATE = 0.15;
const DEFAULT_TIMEOUT_MS = 5000;
const BANCO_NOME = "FlexBank S.A.";
```

### Regras de `const`:
1. **Apenas Literais**: Não aceita chamadas de função ou expressões dinâmicas.
2. **Imutabilidade Absoluta**: Qualquer tentativa de reatribuição gera o erro de compilação `E3003`.
3. **Escopo de Módulo**: Ideais para limites fixos, configurações estáticas e taxas financeiras.
