---
title: 5. Structs, Métodos e Traits
description: Modelagem de dados orientada a dados com structs, blocos impl e polimorfismo seguro com traits.
---

A FlexLang separa claramente **dados** (armazenados em `struct`) de **comportamento** (definido em blocos `impl` e `trait`), promovendo uma arquitetura limpa sem a complexidade de herança de classes.

---

## 🏗️ Estruturas (`struct`)

Structs agrupam campos nomeados e tipados:

```flexlang
struct User {
    id: Int,
    name: String,
    email: String,
    is_active: Bool
}

// Instanciação
let alice = User {
    id: 1,
    name: "Alice",
    email: "alice@empresa.com",
    is_active: true
};
```

---

## 🛠️ Métodos de Estrutura (`impl Struct`)

Comportamentos são adicionados a uma struct através de blocos `impl`. O receptor do método é indicado por `self` (imutável) ou `mut self` (quando altera o estado interno):

```flexlang
struct Carrinho {
    total: Float,
    itens: Int
}

impl Carrinho {
    func adicionar_item(mut self, preco: Float) {
        self.total = self.total + preco;
        self.itens = self.itens + 1;
    }

    func resumo(self) -> String {
        return "Carrinho com ${self.itens} itens, Total: R$ ${self.total}";
    }
}

let mut meu_carrinho = Carrinho { total: 0.0, itens: 0 };
meu_carrinho.adicionar_item(49.90);
print(meu_carrinho.resumo());
```

---

## 🎭 Traits (Interfaces Nominais)

Traits definem contratos de comportamento que qualquer struct pode implementar:

```flexlang
trait Notificavel {
    func enviar(self, mensagem: String) -> Bool;
}

struct EmailService {
    smtp_host: String
}

impl Notificavel for EmailService {
    func enviar(self, mensagem: String) -> Bool {
        print("Enviando via SMTP (${self.smtp_host}): ${mensagem}");
        return true;
    }
}
```

### Validação Estática de Conformidade
O **Type Checker** da FlexLang valida em tempo de compilação se a struct implementa todos os métodos exigidos pela trait com nomes, parâmetros, aridades e tipos de retorno exatos.
