# Revisão da Fase 2: O Motor Concorrente e Abstrações

Com a conclusão da **Fase 2**, a **FlexLang** deixou de ser um parser teórico e evoluiu para uma linguagem imponente capaz de coordenar múltiplas *Green Threads*, travar corridas de dados usando transferência de posse e aceitar contratos severos via Polimorfismo.

## O Que Foi Construído?

> [!NOTE]
> **Simulador Assíncrono (Node.js)**
> O interpretador original era 100% síncrono. Para simular as rotinas e a semântica concorrente da FlexLang perfeitamente, o motor interno foi inteiramente convertido para `async/await`. Agora ele usa `Promises` nativas do JS para emular `Goroutines`, rodando no event-loop em verdadeira assincronia sem bloquear a linha principal.

### 1. Concorrência Estruturada
Foram introduzidas as primitivas `scope` e `spawn`. O **TypeChecker** agora proíbe sumariamente que desenvolvedores lancem tarefas fantasmas (`spawn`) fora de um bloco estruturado. Em execução, o `scope` obriga a thread pai a aguardar *todas* as sub-rotinas serem concluídas antes de seguir (utilizando `Promise.all` em background).

### 2. Semântica de Move e Canais Seguros
Foi introduzida a classe interna `Channel` com seus métodos cruciais: `.send(val)` e `.recv()`.
Para erradicar *Data Races* (condições de corrida), criamos nosso próprio "mini Borrow Checker" restrito aos canais:
- Ao fazer o envio `c.send(mut_var)`, o compilador engatilha a mecânica de *Move*.
- A variável original é selada (`isMoved = true`).
- Se o programador for pego tentando utilizá-la em linhas subsequentes, a compilação aborta imediatamente, protegendo a estabilidade geral.

> [!WARNING]
> Testes atestam que tentar usar um dado enviado num canal abortará o compilador com: `TypeError: Use-after-send of moved variable`.

### 3. Sistema de Traits (Polimorfismo)
Adicionada a palavra-chave `trait` e o suporte polimórfico na implementação através da sintaxe `impl Trait for Struct`.
O verificador cruza ativamente o que foi entregue no `impl` com o prometido pelo `trait`, cobrando que todas as assinaturas (nomes de método, quantidade de parâmetros, etc) batam exatamente, recusando compilação no caso de omissões.

### 4. Transpilador Primordial (Go)
O tão aguardado tradutor base da AST para Golang (criado no `transpiler.ts`) já está no mundo real!
Ele pega todo e qualquer nó aprovado pelo **TypeChecker** e verte num arquivo idiomático `.go`.
Inclusive, já converte organicamente `c.send(val)` para sintaxes belíssimas nativas do Go como `c <- val`.

## Validação Total
Nossa suíte de ouro atual atinge **10 arquivos de testes** (`01` a `10`).
Foram validadas intersecções entre erros sintáticos, concorrência, canais, move semantics, omissões em traits, loops e avaliações booleanas.

O sistema da FlexLang está 100% robusto e pronto para ser exposto ao *front-line*!
