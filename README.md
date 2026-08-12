<div align="center">
  <h1>🚀 FlexLang</h1>
  <p><strong>A linguagem definitiva para Backends Escaláveis, Seguros e Altamente Performáticos.</strong></p>
  <p>
    Sintaxe limpa. Semântica rigorosa. Zero <i>Data Races</i>.
  </p>
</div>

---

A **FlexLang** nasceu da necessidade de unir a simplicidade no aprendizado e produtividade (com sintaxe clara e familiar) à segurança extrema de acesso à memória e alto desempenho para sistemas paralelos que processam pesadas cargas de I/O em Backend.

Esqueça o _Callback Hell_ ou funções "coloridas" (`async/await`). Na FlexLang a concorrência flui nativamente inspirada no ecossistema Go, sendo suportada por transpiladores modernos que vertem seu código seguro diretamente para binários Go de alta disponibilidade.

## ✨ Destaques & Filosofia

- **🔒 Imutabilidade por Padrão:** Variáveis na FlexLang são cravadas em pedra (`let`). A Mutabilidade (`let mut`) é explícita e mapeável pelo compilador.
- **⚡ Concorrência Estruturada Nativa:** Crie rotinas secundárias usando o modelo semântico `scope` / `spawn`. O motor fará as Fibras trabalharem sem bloquear o Event Loop principal.
- **🛡️ Erradicação de Data Races:** Canais (`Channel.new()`) são os únicos meios de comunicação de estado em concorrência. Quando uma variável mutável é repassada via canal (`send`), nosso compilador ativa as regras de _Move Semantics_: você perde a posse da variável na origem, impedindo corrupção paralela ("Use-after-send" será barrado estaticamente!).
- **🌐 Stdlib Direto ao Ponto:** A linguagem possui importação direta de módulos robustos para web, como `net/http`.
- **⚙️ CLI Unificada (`flex`):** Um binário, todos os comandos. De `flex run` (desenvolvimento Node.js) a `flex build` (transpilação Go / binário de máquina).

---

## ⚡ Hello World: Criando um Servidor Web

Com a FlexLang, subir uma API robusta não requer instalação de bibliotecas de terceiros ou frameworks. O próprio compilador absorve e transpila sua lógica para o poller nativo:

```flexlang
// arquivo: api.flex

import { Server, Request, Response } from "net/http";

func handle_users(req: Request, mut res: Response) {
    let payload = "Bem-vindo a FlexLang! A linguagem do futuro.";
    res.json(payload);
}

// Inicia um servidor escutando na porta 8080
let mut server = Server.new(":8080");
server.route("/users", handle_users);

print("Servidor subiu perfeitamente! Escutando localhost:8080");
server.start(); // Bloqueia a Fiber atual e passa a escutar chamadas assíncronas
```

**Execute no terminal instantaneamente:**
```bash
# Rodar via Interpretador Integrado (Dev)
npx flex run api.flex

# OU Compilar para um Binário Nativo (Prod)
npx flex build api.flex
./api
```

---

## 📚 Documentação e Exemplos Públicos

Preparamos uma documentação interativa baseada em códigos reais. Acesse o diretório **`examples/`** na raiz deste repositório para estudar exemplos executáveis que ilustram as peças-chave da linguagem:

- [**`01_hello_http.flex`**](./examples/01_hello_http.flex): O "Hello World" ilustrando a inicialização e tratamento de HTTP.
- [**`02_concurrency.flex`**](./examples/02_concurrency.flex): Estudo avançado do bloco de Concorrência, abordando `scope`, `spawn` e o compilador vetando acessos via *Move Semantics*.
- [**`03_traits.flex`**](./examples/03_traits.flex): Demonstração de Polimorfismo e interfaces restritas via *Traits*.

---

## 🏛️ Arquitetura e Engenharia Interna

Você é um entusiasta de Compiladores ou apenas quer entender o motor V8 / LLVM / Go sob o capô da linguagem? Nossas decisões de engenharia são totalmente abertas e explicadas:

📖 **Leia o [Roadmap Arquitetural (ADR-001)](./.docs/flexlang_architecture_roadmap.md)** para visualizar o escopo completo.
📖 **Acompanhe o [Registro Histórico da Fase 2](./.docs/phase2_walkthrough.md)** detalhando o nascimento do TypeChecker e Semântica Move.

---

> _"Faça simples, faça robusto. Construa com FlexLang."_
