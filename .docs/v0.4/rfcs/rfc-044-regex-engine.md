# RFC-044 — Expressões Regulares Nativas (`std/regex`)

> **Status:** IMPLEMENTADO · **Prioridade:** P1 · **Depende de:** RFC-033 (`std/validator`)

---

## 1. Motivação

Manipulação de texto avançada é fundamental para:
1. Extração de padrões em logs (ex: Correlation IDs, IP addresses).
2. Parsing de retorno bancário legados e arquivos CNAB de largura fixa que o `json` não consegue cobrir.
3. Validação robusta de formatos de entrada, como Placas de Carro, Passaportes ou formatadores complexos que o `std/validator` padrão não oferece.

Linguagens maduras (Go, Rust, TS) oferecem suporte nativo a expressões regulares. Sem a capacidade de compilar e validar Regex, a FlexLang perde mercado em integração de dados.

---

## 2. Design da API

A abordagem favorece compilação prévia para performance (evitando recompilação a cada chamada dentro de loops) e adoção do motor **RE2** unificado (O(n) no tempo) para prevenir a vulnerabilidade crítica do **ReDoS** (*Regex Denial of Service*).

```flexlang
import { regex, Regex } from "std/regex";

// 1. Compilação Segura
// O compilador sinaliza erros de sintaxe (como grupos de captura não balanceados) no carregamento.
let cpf_pattern = regex.compile("^[0-9]{3}\\.[0-9]{3}\\.[0-9]{3}-[0-9]{2}$")?;

// 2. Validação Exata
let is_valid = cpf_pattern.matches("123.456.789-00"); // true

// 3. Busca de padrões em texto longo
let log_text = "Transaction ID: e82f-41, Amount: 1500.50";
let uuid_pattern = regex.compile("[a-f0-9]{4}-[a-f0-9]{2}")?;

match uuid_pattern.find(log_text) {
    Option.Some(match_result) {
        print("Encontrado: ${match_result.text}"); // "e82f-41"
        print("Na posição: ${match_result.start}"); // 16
    },
    Option.None {
        print("Nada encontrado");
    }
}

// 4. Substituição (Replace Global)
let spaces = regex.compile("\\s+")?;
let clean_str = spaces.replace_all("Muitos     espacos aqui", " ");
// "Muitos espacos aqui"
```

---

## 3. Implementação e Paridade

### 3.1 Modo Interpretado (TypeScript / V8)
O motor padrão RegExp do V8 não é 100% RE2-safe (pode sofrer de retrocesso catastrófico - backtracking). Para mitigação no interpretador:
- Utiliza a engine RegExp de JavaScript (focando em manter a sintaxe de expressão idêntica, descartando flags não-suportadas pelo Go).
- Validar se a sintaxe introduzida (ex: lookaheads) é suportada na paridade do Go.

### 3.2 Modo Compilado (Go)
- O Go possui o pacote nativo `regexp` que é estritamente O(n) baseado na engine RE2 original (desenvolvida pela Google). Mapear `regex.compile` para `regexp.Compile`.
- Assegura que *ReDoS* seja virtualmente impossível no binário de produção FlexLang.

---

## 4. Plano de Testes

- Teste de Regex simples e match.
- Teste de grupos de captura e iteração de matches.
- Teste de `replace_all`.
- Validar que a mesma string RegExp gera o mesmo resultado de `matches` no Node e no Go.
