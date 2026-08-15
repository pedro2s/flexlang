# RFC-012: `flex run --watch` e Entrada de Projeto

> **Status:** Draft · **Prioridade:** P0 — bloqueante · **Depende de:** nada
> **Toca:** `src/cli.ts`, e um `src/watcher.ts` novo

## Resumo

`flex run` executa uma vez e termina. Como o servidor HTTP segura o processo indefinidamente (`http.ts:262`, promessa que nunca resolve), cada alteração de uma linha exige `Ctrl+C` e re-execução manual. Esta RFC adiciona `flex run --watch`, que reexecuta o programa sozinho quando **qualquer arquivo do grafo de módulos** muda; e faz `flex run` sem argumento usar o `entry` declarado no `flex.toml`.

## Motivação

O ciclo editar → ver rodando é a métrica de DX que um desenvolvedor sente a cada minuto. Hoje ele é inteiramente manual, e isso pesa muito mais em uma API HTTP — cujo processo nunca termina sozinho — do que em um script.

O `flex.toml` gerado por `flex init` (`cli.ts:39-44`) já declara `entry = "src/main.flex"`, mas **nenhum comando lê esse campo** (verificado: só `cli.ts:42` o escreve). O arquivo promete uma conveniência que não existe.

## Design

### 3.1 Interface

```bash
flex run --watch src/main.flex   # observa e reexecuta
flex run -w src/main.flex        # forma curta
flex run --watch                 # entry vem do flex.toml
flex run                         # idem, sem watch
```

Resolução do alvo, nesta ordem: caminho explícito no argumento → campo `entry` do `flex.toml` do diretório atual → erro pedindo um dos dois. O parser de TOML necessário aqui é uma linha de regex sobre `entry = "..."`, não um parser completo — o `flex.toml` da v0.2 tem três campos fixos, e trazer uma dependência de TOML para isso seria desproporcional. Quando o manifesto crescer (`flex mod`, pós-v1.0), essa decisão se revisita.

### 3.2 O que é observado

Não apenas o arquivo de entrada: **todos os arquivos do grafo de módulos**. O `loadModuleGraph` (`src/loader.ts`) já devolve `ModuleGraph.files`, um `Map` com o caminho absoluto de cada arquivo alcançável a partir da entrada — é exatamente a lista de arquivos a observar, sem precisar de nenhuma descoberta nova.

Isso importa: editar `repository/users.flex` precisa disparar reload tanto quanto editar `main.flex`. Observar só a entrada seria um watch que parece funcionar e falha justamente no arquivo em que se está trabalhando.

**A cada reload o grafo é reconstruído** e os watchers são recriados, porque um `import` novo adiciona um arquivo ao grafo — e um watch que não enxerga arquivos criados depois de iniciado envelhece mal.

Quando o grafo não pode ser construído (erro de sintaxe, import quebrado), o watcher mantém os watchers do último grafo válido. Sem isso, um erro de digitação em um import derrubaria a capacidade de detectar a correção desse mesmo erro.

### 3.3 Modelo de execução: subprocesso

Cada execução roda em um **processo filho** (`child_process.fork` do próprio `dist/cli.js` com o subcomando `run`). Um reload mata o filho e cria outro.

A alternativa — reexecutar a AST no mesmo processo — foi descartada por um motivo concreto, não estético: o interpretador não tem teardown. Um `server.start()` faz `listen()` na porta 8080 (`http.ts:244`), registra handlers de `SIGINT`/`SIGTERM` (`http.ts:258-259`) e devolve uma promessa que nunca resolve. Reexecutar in-process deixaria o servidor anterior segurando a porta (`EADDRINUSE` no segundo reload), além de acumular handlers de sinal, timers e canais a cada ciclo. Isolar em processo elimina toda essa classe de vazamento por construção, ao custo de ~100–200 ms de inicialização do Node por reload — irrelevante perto do ganho.

**O encerramento reaproveita o graceful shutdown da RFC-008:** o filho recebe `SIGTERM`, o que dispara os hooks de `on_shutdown` já implementados (fechar pool de banco, por exemplo) antes de sair. Um `SIGKILL` direto puliaria isso e deixaria conexões de banco penduradas a cada save. Se o filho não sair em 3 s, aí sim `SIGKILL`, para que um handler de shutdown travado não congele o watch.

### 3.4 Detecção de mudanças

`fs.watch` nativo (inotify no Linux, FSEvents no macOS), um watcher por arquivo do grafo. Sem `chokidar`: o pacote publicado hoje tem exatamente uma dependência de runtime (`pg`), e adicionar uma árvore de dependências para observar um punhado de arquivos conhecidos não se paga.

**Debounce de 80 ms**, obrigatório: editores salvam em múltiplas operações (truncate + write, ou write em temporário + rename), e sem debounce um único `Ctrl+S` dispara dois ou três reloads. O timer reinicia a cada evento dentro da janela.

Eventos de arquivos idênticos em conteúdo são ignorados comparando `mtimeMs` — alguns editores tocam o arquivo sem alterá-lo.

### 3.5 Saída no terminal

```
[flex] watch: observando 4 arquivos · Ctrl+C para sair

  ────────────────────────────────────────
  ↻ src/repository/users.flex alterado

[flex] Running src/main.flex in interpreted mode...
🚀 Servidor online em http://localhost:8080
```

A tela **não** é limpa a cada reload: o histórico de logs anteriores é frequentemente o que se está tentando ler. O separador com o nome do arquivo que disparou o ciclo dá a orientação sem destruir contexto.

Erro de compilação **não encerra o watch** — imprime o diagnóstico (formatado pela RFC-014) e segue observando. Um watcher que morre no primeiro erro de sintaxe é um watcher que não serve para desenvolver, que é justamente quando erros de sintaxe acontecem.

`Ctrl+C` no processo pai encerra o filho graciosamente e sai.

### 3.6 Não-objetivos

- **Hot reload preservando estado.** Trocar o código sem derrubar o processo exigiria invalidação seletiva e teardown de recursos que o interpretador não modela (§3.3). O ganho seria de centenas de milissegundos; o risco, estado inconsistente entre reloads — a pior categoria de bug de desenvolvimento, porque some quando você reinicia para investigar.
- **`--watch` em `flex build` e `flex test`.** Reaproveitam o mesmo `src/watcher.ts`, mas ficam para a v0.3: o loop de feedback que dói hoje é o do `run`.

## Plano de testes

Watch é I/O de sistema de arquivos e processo; golden-file não alcança. Vai para `tests/watch_integration.ts`, no modelo já usado por `http_integration.ts`:

1. Alterar o arquivo de entrada dispara reexecução (detectada pela saída do filho).
2. Alterar um arquivo **importado** (não a entrada) também dispara — é a regressão mais provável desta RFC.
3. Duas escritas em 20 ms produzem **um** reload (debounce).
4. Erro de sintaxe imprime diagnóstico e o watcher continua vivo; corrigir o arquivo volta a executar normalmente.
5. Um arquivo importado **novo** passa a ser observado após o reload que o introduziu.
6. Reload de um programa com `on_shutdown` executa o hook antes de reiniciar (SIGTERM, não SIGKILL).
7. `flex run` sem argumento, em projeto com `flex.toml`, resolve o `entry`; sem `flex.toml`, erra pedindo o caminho.

## Critério de aceite

- [ ] `flex run --watch` reexecuta ao alterar qualquer arquivo do grafo.
- [ ] Erro de compilação não mata o watcher.
- [ ] Reload encerra o processo anterior graciosamente (hooks da RFC-008 rodam).
- [ ] Reload completo em menos de 1 s no projeto de `flex init` (PRD §5).
- [ ] `flex run`/`flex run --watch` sem argumento usam o `entry` do `flex.toml`.

## Alternativas consideradas

- **Reexecução in-process** — descartada no §3.3: sem teardown, a porta continua ocupada no segundo reload.
- **`chokidar`** — descartada no §3.4: dependência desproporcional para observar uma lista de arquivos já conhecida.
- **Polling (`fs.watchFile`)** — descartada: consome CPU proporcional ao número de arquivos e tem latência pior. Fica como plano B documentado se `fs.watch` se mostrar instável em algum sistema de arquivos (notoriamente, alguns compartilhamentos de rede).
