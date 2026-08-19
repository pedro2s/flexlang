---
title: FlexLang para Desenvolvedores TypeScript
description: Por que migrar de Node/TS para FlexLang — Compilação nativa, fim do 'async coloring' e tipos reais.
---

Desenvolvedores TypeScript adoram a expressividade e ergonomia dos tipos modernos, mas frequentemente sofrem com o overhead de runtime do Node.js/V8 e com a contaminação de `async/await` em toda a base de código (*function coloring*).

---

## 🥊 Principais Vantagens sobre TypeScript / Node

1. **Sem Function Coloring (`async/await` Viral)**:
   - No Node.js, se uma função chama I/O, ela obrigatoriamente se torna `async`, forçando todos os chamadores a usarem `await` até a raiz.
   - Na FlexLang, chamadas de I/O suspendem apenas a green thread atual de forma transparente. Todas as funções têm sintaxe síncrona natural sem overhead de Promise.

2. **Tipos Reais em Tempo de Execução**:
   - Os tipos do TypeScript são apagados (*erased*) na compilação.
   - Na FlexLang, structs e enums são validados estaticamente e mantêm integridade garantida.

3. **Performance Nativa de Produção**:
   - `flex build` gera binários nativos compilados de inicialização instantânea e consumo mínimo de memória RAM (<20 MB vs >150 MB de processos Node).
