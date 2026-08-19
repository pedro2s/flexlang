---
title: Visão Geral & Filosofia
description: Conheça os pilares de design e os objetivos fundamentais da FlexLang.
---

# Visão Geral & Filosofia da FlexLang

A **FlexLang** é uma linguagem de programação compilada e estaticamente tipada, projetada desde o primeiro dia para resolver os desafios reais do desenvolvimento de **backends modernos, altamente concorrentes e financeiramente críticos**.

---

## 🎯 Os 4 Pilares de Design

### 1. "Um Go com Sistema de Tipos Melhor"
O ecossistema Go provou que um runtime leve com green threads (goroutines), garbage collector de baixa pausa e compilação rápida é excelente para serviços de rede. No entanto, a falta de tipos soma (`enum` com payload), o tratamento de erro repetitivo com `if err != nil` e a ausência de imutabilidade por padrão geram fragilidades em código corporativo.

A FlexLang herda o poder de execução do Go, mas oferece:
- **`Result<T, E>` e `Option<T>` nativos**: Erros são valores explícitos no sistema de tipos.
- **Pattern Matching com Exhaustiveness**: O compilador impede que você esqueça de tratar um caso de erro.
- **Operador de Propagação `?` e Blocos `catch`**: Sintaxe concisa para propagar ou tratar erros com fallback inline.

### 2. Concorrência Estruturada por Padrão
Em linguagens tradicionais, lançar uma thread ou goroutine em segundo plano cria o risco de vazamento (*goroutine leak*), tornando difícil cancelar tarefas quando uma requisição sofre timeout.

Na FlexLang:
- **Não existe `spawn` solto**: Toda green thread nasce dentro de um bloco `scope { ... }`.
- **Hierarquia de Ciclo de Vida**: O escopo pai aguarda a finalização de todas as tarefas filhas antes de prosseguir.
- **Cancelamento Automático por Timeout**: Se o deadline do escopo expirar (`scope(deadline: Duration.ms(200))`), todas as tarefas filhas e operações de I/O são interrompidas automaticamente.

### 3. Liberdade de Data Races Sem a Curva do Rust
O Rust oferece segurança incomparável de memória via *borrow checker* e tempos de vida (*lifetimes*), mas impõe uma curva de aprendizado íngreme que frequentemente desacelera o desenvolvimento de regras de negócio em backends.

A FlexLang adota o modelo de **Isolamento por Mutabilidade** (*Reference Capabilities* simplificado):
- Toda variável declarada com `let` é **100% imutável** e pode ser compartilhada com segurança entre green threads.
- Variáveis declaradas com `let mut` pertencem exclusivamente à thread que as criou. Ao enviar um valor mutável por um canal (`channel.send(data)`), o valor é **movido** (*Move Semantics*). Tentar usar a variável novamente após o envio resulta em **erro de compilação imediato**.

### 4. Paridade 100% Garantida (Desenvolvimento Ágil e Produção Segura)
A FlexLang oferece dois modos de execução sem discrepâncias:
- **`flex run` (Modo Interpretado)**: Iteração ultra-rápida no desenvolvimento local, com recarregamento instantâneo via `--watch`.
- **`flex build` (Modo Compilado)**: Transpilação e compilação para binário nativo altamente otimizado via Go.

O **Type Checker** roda estritamente antes de ambos os modos, garantindo que qualquer código aceito localmente se comporte com exatidão em produção.
