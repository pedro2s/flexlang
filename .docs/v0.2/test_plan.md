# Plano de Testes — FlexLang v0.2.0

> **Status:** Draft · **Complementa:** [`.docs/v1/test_plan.md`](../v1/test_plan.md), que definiu as camadas (golden-file, parity gate, integração, negativos)

## 1. A lição da v0.2

O defeito mais grave desta rodada — divisão produzindo `3.5` interpretado e `3` compilado (RFC-013) — **não foi encontrado por teste**, e sim executando o compilador à mão durante a análise. O parity gate estava verde o tempo todo, porque nenhum arquivo em `tests/*.flex` fazia divisão não-exata.

A conclusão não é "escrever mais testes", é mais específica: **o parity gate só protege o que alguém pensou em exercitar**. Uma área semântica inteira (aritmética) não tinha nenhum caso, e por isso a garantia central da linguagem esteve quebrada por nove RFCs sem sinal nenhum.

Daí as duas regras novas desta release:

1. **Toda RFC que altera semântica de avaliação entrega casos no parity gate**, não só golden-file do modo interpretado.
2. **Toda operação que existe nos dois runtimes com semântica potencialmente diferente é candidata a divergência até prova em contrário** — e o par JavaScript/Go tem muitas: divisão inteira, divisão por zero, `%` em ponto flutuante, truncamento de negativos, formatação numérica.

## 2. Matriz de divergência Node↔Go

Esta matriz é a entrega de teste mais valiosa da v0.2. Cada linha vira um caso do parity gate; a coluna "risco" é o que aconteceria sem o caso.

| Operação | JavaScript | Go | Risco se não testado |
|---|---|---|---|
| `7 / 2` (Int) | `3.5` | `3` | **o defeito que originou a RFC-013** |
| `-7 / 2` (Int) | `-3.5` | `-3` (trunca p/ zero) | resultado errado em valores negativos |
| `7 / 0` (Int) | `Infinity` | panic | comportamento divergente sob erro |
| `7.0 / 0.0` (Float) | `Infinity` | `+Inf` | ok, mas precisa ser fixado |
| `1.5 % 2` | `1.5` | não compila | Go inválido gerado (RFC-013 §4.6) |
| `print(3.0)` | `3` | `3` | formatação divergente em magnitudes extremas |
| `print(0.1 + 0.2)` | `0.30000000000000004` | idem | representação de double |
| Header `Authorization` vs `authorization` | Node normaliza p/ minúsculas | Go normaliza (canonical) | lookup falha em um dos modos (RFC-015 §3.3) |
| Ordem de chaves em JSON | ordem de inserção | `map` é **não determinística** | corpo de resposta difere entre execuções |

A última linha merece destaque: `map[string]any` em Go **não garante ordem de iteração**, e `encoding/json` ordena chaves de mapa alfabeticamente, enquanto o `JSON.stringify` do Node segue a ordem de inserção. Structs FlexLang com mais de um campo podem, portanto, serializar em ordens diferentes nos dois modos. O parity gate compara saída byte a byte, então isso apareceria como falha — a decisão a tomar durante a implementação é se a comparação de corpos JSON deve ser semântica (parse e comparar) em vez de textual.

## 3. Cobertura por RFC

| RFC | Golden | Parity | Integração | Negativo |
|---|---|---|---|---|
| 011 — verbos HTTP | registro dos 5 verbos | status/corpo/`Allow` por verbo | 5 verbos, 405, 404, HEAD, OPTIONS | `server.route` removido |
| 012 — watch | — | — | 7 cenários (`watch_integration.ts`) | erro de sintaxe não mata o watcher |
| 013 — Float | literais e anotações | **matriz da §2 inteira** | Float em corpo JSON | `%` com Float; `Float * Int` |
| 014 — diagnósticos | goldens negativos atualizados | — | — | erro interno vs. erro de usuário |
| 015 — middleware | `use`/`header`/`cors` | headers e status | ordem, `/healthz` isento, preflight | — |

## 4. Testes que exigem infraestrutura nova

- **`tests/watch_integration.ts`** (RFC-012): envolve escrever arquivos, disparar `fs.watch` e gerenciar subprocessos. Cada caso precisa de timeout próprio e limpeza garantida do processo filho mesmo em falha — um teste de watch que vaza processo trava a suíte inteira em CI.
- **Comparação de headers HTTP** (RFC-011/015): `http_integration.ts` hoje compara status e corpo. Precisa passar a comparar headers selecionados (`Allow`, `Access-Control-*`), normalizando nome para minúsculas antes.

## 5. Gate de release da v0.2.0

Além do gate da v0.1 (`.docs/v1/test_plan.md` §3), que continua valendo:

- [ ] Matriz de divergência da §2 inteira coberta no parity gate, verde.
- [ ] `watch_integration.ts` verde, sem processo órfão ao final.
- [ ] Nenhuma saída de erro do compilador contendo stack trace do Node (asserção automatizada, RFC-014).
- [ ] Caso de uso de referência do PRD §2 idêntico nos dois modos.

## 6. Dívida de teste reconhecida

- **Cobertura de aritmética antes da RFC-013**: zero. Depois dela, a matriz da §2 — mas note que a matriz cobre o que se conhece hoje. Divergências JS↔Go em áreas ainda não exercitadas (comparação de strings com Unicode, ordenação, overflow de inteiro) permanecem possíveis.
- **Overflow de `Int`** não é testado nem especificado: Go tem `int` de 64 bits com wraparound; o `number` do JavaScript perde precisão acima de 2^53. Um `Int` grande diverge silenciosamente hoje. Não entra na v0.2 (exigiria BigInt no interpretador, com custo de performance em todo caminho aritmético), mas fica registrado aqui como divergência conhecida — e é candidato natural à v0.3.
