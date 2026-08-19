---
title: 8. Concorrência Estruturada & Canais
description: Green threads leves, escopos de concorrência estruturada, canais rendezvous e isolamento de mutabilidade.
---

A FlexLang foi construída para atender a milhões de conexões simultâneas com baixo consumo de memória, sem risco de vazamento de tarefas em segundo plano.

---

## 🧵 Green Threads e `scope`

Na FlexLang, **não existe `spawn` solto**. Toda tarefa concorrente nasce subordinada a um bloco `scope { ... }`:

```flexlang
scope {
    spawn {
        print("Tarefa concorrente A executando...");
    }

    spawn {
        print("Tarefa concorrente B executando...");
    }
}
// O código só chega aqui quando TODAS as tarefas filhas do scope terminarem.
print("Todas as tarefas concluídas!");
```

---

## ⏱️ Deadlines e Timeouts Automáticos

Você pode atribuir um prazo limite (*deadline*) a um escopo:

```flexlang
import { Duration } from "core/time";

scope(deadline: Duration.from_millis(200)) {
    spawn {
        consultar_servico_lento();
    }
}
// Se a tarefa demorar mais de 200ms, ela é cancelada automaticamente sem travar a requisição.
```

---

## 📬 Canais Tipados (`Channel.new()`)

Canais permitem a comunicação segura entre green threads com capacidade rendezvous síncrona (tamanho 0) por padrão:

```flexlang
let canal = Channel.new();

scope {
    spawn {
        let dados = processar_relatorio();
        canal.send(dados); // Envia o dado para o canal
    }

    spawn {
        let resultado = canal.recv(); // Aguarda e recebe o dado
        print("Resultado recebido: ${resultado}");
    }
}
```

---

## 🔒 Isolamento de Mutabilidade (*Move Semantics*)

Quando você envia uma variável declarada como `mut` por um canal, a **posse da variável é movida** para a thread receptora:

```flexlang
let mut buffer = [1, 2, 3];

scope {
    spawn {
        canal.send(buffer);
        // buffer foi MOVIDO!
        // buffer.push(4); // ERRO ESTÁTICO: Use-after-send of moved variable 'buffer'
    }
}
```

Essa regra estática simples elimina condições de corrida de dados em tempo de compilação sem exigir anotações complexas de lifetimes.
