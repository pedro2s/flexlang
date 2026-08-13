# Plano de Testes — FlexLang v1.0

> **Status:** Draft · **Relacionado:** todas as RFCs em [`rfcs/`](rfcs/) referenciam este plano em sua seção "Plano de Testes"

## 1. Por que este documento existe separado das RFCs

Cada RFC lista os testes específicos da sua própria mudança. Este documento define a **estratégia** compartilhada — em particular o "parity gate", que é o mecanismo de teste mais importante da v1.0 e é reusado por praticamente toda RFC (001 a 006).

## 2. Camadas de teste

### 2.1 Golden-file (existente, `tests/runner.ts`)

Já implementado: cada `tests/NN_nome.flex` tem um `.out` correspondente; a suíte roda tudo em modo interpretado e compara stdout capturado. **Limitação atual**: só valida `flex run`, nunca `flex build` — é exatamente por isso que a Lacuna 1 (paridade Go) passou despercebida até esta análise.

### 2.2 Parity gate (novo — o item mais crítico deste plano)

Estende `tests/runner.ts` (ou um runner irmão, `tests/parity_runner.ts`) para, por teste:

1. Rodar em modo interpretado (`flex run`), capturar stdout — já existe.
2. Rodar `flex build`, executar o binário Go resultante, capturar stdout.
3. **Falhar o teste se as duas saídas divergirem**, mesmo que ambas "funcionem" isoladamente.

```bash
flex test --parity   # (RFC-007) roda golden-file + parity gate para cada .flex
```

Este gate é o que torna a RFC-001 (paridade Go) verificável de forma contínua — sem ele, uma regressão futura no transpiler (alguém adiciona uma feature de linguagem e esquece de implementar o `case` correspondente no transpiler) voltaria a passar despercebida, exatamente como aconteceu a primeira vez.

**Custo**: rodar `go build` por teste é mais lento que só interpretar. Mitigação: o parity gate roda em CI (todo PR), não necessariamente em todo `flex test` local — localmente, `flex test` sem `--parity` continua rápido (só interpretado), e `--parity` é o gate obrigatório antes de merge.

### 2.3 Testes de integração (HTTP e Postgres)

Diferente do golden-file (determinístico, sem I/O externo), estes testes sobem processos reais:

- **HTTP**: subir um `FlexServer` de teste (via `flex run` de um `.flex` de fixture), disparar requisições reais contra ele, validar status/corpo/headers. Cobre RFC-004 e RFC-008 (panic recovery, graceful shutdown, health check).
- **Postgres**: subir um Postgres efêmero em CI (container descartável), rodar um schema de fixture, executar CRUD via o driver `db/postgres` (RFC-005), validar dados e tratamento de erro (constraint violation, SQL malformado).

Esses testes rodam em ambos os modos (interpretado e compilado) sempre que fizer sentido, reaproveitando o parity gate.

### 2.4 Testes negativos (o compilador deve recusar corretamente)

Toda RFC lista casos que **devem falhar** (import circular, redeclaração de `Result`, match não-exaustivo, SQL não parametrizado se algum dia isso for reintroduzido por engano). Cada um vira um `.flex` de fixture cujo `.out` esperado é a mensagem de erro exata — regressões em mensagens de erro (que quebram a experiência de debug do desenvolvedor) ficam tão visíveis quanto regressões de comportamento.

### 2.5 Testes de segurança (RFC-009)

Casos dedicados por requisito da tabela da RFC-009 — tentativa de injeção, corpo acima do limite, vazamento de stack trace, mascaramento de log. Rodam como parte da suíte normal, não como um processo de auditoria separado (segurança é testada continuamente, não só antes do release).

## 3. Critério de release (gate final)

Nenhuma release de v1.0 sai sem:

- [ ] 100% dos golden tests (`tests/`) passando.
- [ ] 100% do parity gate passando (interpretado == compilado, para todo teste).
- [ ] Testes de integração HTTP e Postgres passando em CI com serviços reais.
- [ ] Todos os testes negativos de cada RFC passando (mensagens de erro corretas).
- [ ] Todos os testes de segurança da RFC-009 passando.

## 4. O que este plano deliberadamente não cobre na v1.0

- **Fuzzing** do lexer/parser (entrada aleatória buscando crash) — valioso, mas não bloqueante; candidato de hardening pós-v1.0, quando o parity gate e os testes funcionais já derem uma base de confiança maior para investir em fuzzing sem ruído.
- **Testes de carga/performance** — o PRD (Seção 5) prioriza correção sobre performance para a v1.0; benchmarks formais entram quando houver uma versão correta para medir.
