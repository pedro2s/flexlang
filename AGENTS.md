# Contexto Geral da FlexLang

Este arquivo dita regras arquiteturais e o escopo de atuação que você (e outros agentes) deve assumir ao interagir com o repositório da FlexLang.

## O Que é a FlexLang? (Filosofia e Paridade)
FlexLang é uma linguagem de programação moderna projetada para possuir dois modos de execução perfeitos e inseparáveis:
1. **Modo Interpretado (`flex run`)**: Baseado num *Interpreter* rodando sobre NodeJS/TypeScript. Focado em ciclo de feedback rápido, facilidade de scripting local e depuração sem necessidade de builds demorados.
2. **Modo Compilado (`flex build`)**: Um **Transpilador Go** (GoCodegen) que recebe a AST exata que o TypeScript validou e a converte em um binário Go de alta performance e concorrência massiva.

### A Promessa do "Parity Gate" (ADR-001)
A regra de ouro (estabelecida pela RFC-001) é: **O mesmo programa produz o mesmo resultado nos dois modos**. 
- Todo e qualquer código (`.flex`) escrito ou abstraído através dos módulos da *Standard Library* (`NATIVE_MODULES`) **deve** possuir comportamento idêntico entre Node.js e Golang. 
- Módulos nativos (`net/http`, `crypto/jwt`, etc) devem ser escritos com as interfaces TypeScript (interpretador) de um lado, e o correspondente em `boilerplate` Go no transpilador do outro.
- Sempre que você alterar a sintaxe, parser ou um pacote da standard library, **você deve validar o Parity Gate**, garantindo que os testes passem de ponta-a-ponta em ambas as engines.

---

# Fluxo de Documentação de Arquitetura (Walkthroughs e Status de RFCs)

Este projeto segue um modelo de organização estrito para o encerramento de tarefas complexas (RFCs e Features). Toda vez que você finalizar a execução de um escopo de planejamento (Planning Mode) ou implementação de uma funcionalidade:

1. **Atualização do Status da RFC**:
   - Sempre que uma RFC for concluída/implementada, você DEVE OBRIGATORIAMENTE atualizar o campo `> **Status:**` no arquivo da RFC em `.docs/{versao}/rfcs/rfc-{numero}.md` para `IMPLEMENTADO`.
2. **Walkthrough da Implementação**:
   - Você deve OBRIGATORIAMENTE salvar o artefato `walkthrough` que descreve o que foi modificado e as decisões tomadas dentro do diretório do projeto para memória de longo prazo.
3. **Organização Estrutural (`.docs`)**:
   - Os Walkthroughs de RFCs não devem ser jogados na raiz do diretório `.docs/`.
   - Eles DEVEM ser salvos exclusivamente na pasta de Walkthroughs referente à versão da RFC que você implementou: `.docs/{versao}/walkthroughs/rfc-{numero}.md`.
   - Por exemplo, se finalizar a RFC-036 que pertence a v0.4, salve o arquivo em `.docs/v0.4/walkthroughs/rfc-036.md`.
   - Caso a tarefa seja transversal (não associada a uma versão específica/RFC), salve em `.docs/walkthroughs/`.
4. **Commit Automático**:
   - O status atualizado da RFC e o artefato do walkthrough documentado deverão ser commitados junto com as alterações da funcionalidade (ou num *amend*), fechando o ciclo. Não espere que o usuário instrua você a salvá-los para consultas futuras, assuma isso como regra inerente.

Siga estas instruções nativamente para manter o projeto íntegro.
