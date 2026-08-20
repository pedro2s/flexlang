# Fluxo de Documentação de Arquitetura (Walkthroughs)

Este projeto segue um modelo de organização estrito para o encerramento de tarefas complexas (RFCs e Features). Toda vez que você finalizar a execução de um escopo de planejamento (Planning Mode):

1. **Walkthrough da Implementação**: Você deve OBRIGATORIAMENTE salvar o `walkthrough` que descreve o que foi modificado e as decisões tomadas dentro do diretório do projeto. 
2. **Organização Estrutural (`.docs`)**:
   - Os Walkthroughs de RFCs não devem ser jogados na raiz do diretório `.docs/`.
   - Eles DEVEM ser salvos exclusivamente na pasta de Walkthroughs referente à versão da RFC que você implementou: `.docs/{versao}/walkthroughs/rfc-{numero}.md`.
   - Por exemplo, se finalizar a RFC-036 que pertence a v0.4, salve o arquivo em `.docs/v0.4/walkthroughs/rfc-036.md`.
   - Caso a tarefa seja transversal (não associada a uma versão específica/RFC), salve em `.docs/walkthroughs/`.
3. **Commit Automático**: O artefato do walkthrough documentado no final do processo deverá ser commitado junto com as alterações da funcionalidade (ou num *amend*), fechando o ciclo. Não espere que o usuário instrua você a salvá-lo para consultas futuras, assuma isso como regra inerente.

Siga estas instruções nativamente para manter a árvore de versionamento limpa.
