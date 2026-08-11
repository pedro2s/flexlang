# FlexLang: A Nova Geração de Linguagem de Programação

Criar uma nova linguagem de programação é um projeto ambicioso e emocionante! A concepção da FlexLang nasce da análise minuciosa do que as principais linguagens de programação oferecem de melhor. O objetivo é absorver e fundir conceitos de desempenho, simplicidade, segurança e arquitetura em uma sintaxe expressiva e moderna.

Aqui estão as inspirações que moldaram a visão da FlexLang:

### 1. Python & TypeScript
- **Simplicidade e Expressividade:** A sintaxe clara e a experiência de desenvolvedor do Python aliada ao poder do ecossistema e tipagem estática do TypeScript.
- **Ecossistema:** O ferramental moderno do Node.js, com execução via motores otimizados.

### 2. Go
- **Concorrência:** Suporte robusto a concorrência através de _goroutines_ e _channels_.
- **Desempenho Eficiente:** Compilação rápida e execução paralela otimizada, perfeita para desenvolvimento de serviços e sistemas distribuídos.

### 3. Rust & C++
- **Desempenho e Segurança:** Controle fino sobre memória. A FlexLang busca trazer segurança de memória sem garbage collection tradicional, ou de forma altamente otimizada, inspirada no borrow checker do Rust.

### 4. Java & Kotlin
- **Robustez Corporativa e Arquitetura:** Tipagem forte, frameworks baseados em reflexão e Injeção de Dependências (IoC), e o foco em design orientado a domínio (DDD).

---

## A Proposta da FlexLang

**Nome: FlexLang**

**Objetivos Fundamentais:**
- **Sintaxe Simples e Legível:** Curva de aprendizado rápida, com tipagem estática e inferência inteligente.
- **Alta Escalabilidade (I/O e Concorrência):** Sistema nativo assíncrono para lidar com concorrência massiva de forma leve.
- **Engenharia de Software Nativa:** Fornecer suporte em nível de linguagem (Decorators, Reflection) para a construção de arquiteturas limpas (Arquitetura Hexagonal/Ports and Adapters).
- **Desenvolvimento Web e de APIs:** Foco direcionado na construção de APIs robustas com Injeção de Dependências nativa, isolamento de domínio e conectividade impecável com bancos relacionais (PostgreSQL).

### Exemplo de Sintaxe (Visão)

```flexlang
// Tipagem forte com inferência
let max_connections = 100;
let host: String = "localhost";

// Structs e encapsulamento de domínio
struct User {
    id: Int,
    name: String,
}

// Decorators nativos para Injeção de Dependência e Web Roteamento
@Injectable()
@Controller("/users")
struct UserController {
    // Injeção de repositórios diretamente via construtor/propriedade
    userService: UserService;

    @Get("/{id}")
    func getUser(id: Int) -> User {
        return self.userService.findById(id);
    }
}

// Concorrência nativa (goroutines)
goroutine {
    print("Processando em background...");
}
```

---

## Roadmap de Engenharia

Para chegarmos ao nível de construir APIs robustas com Injeção de Dependências, isolamento de domínio e a ergonomia de ferramentas avançadas do ecossistema Node, precisamos de um roteiro rigoroso. A construção de uma linguagem exige que cada camada seja uma fundação sólida para a próxima — não podemos construir o contêiner de injeção de dependências sem antes ter um sistema de tipos e uma árvore de sintaxe (AST) madura.

Para o desenvolvimento inicial, o core da linguagem (Lexer, Parser e Interpretador/TypeChecker) está sendo construído em **TypeScript**.

Aqui está o roadmap de engenharia, ordenado do núcleo da linguagem até o ecossistema de alto nível:

### 1. Fundação Sintática e Execução Base
**Foco atual:** Expandir o MVP.
O objetivo aqui é fazer a linguagem entender lógica de programação básica e avançada, estruturando corretamente a AST.
- **Controle de Fluxo:** Implementar blocos condicionais (`if`/`else`) e laços de repetição (`for`, `while`).
- **Funções e Escopo:** Suporte a declaração de funções (`func`), passagem de parâmetros, retorno de valores e closures (isolamento de escopo na memória).
- **Estruturas de Dados Básicas:** Arrays e Strings completas com métodos embutidos.

### 2. Sistema de Tipos e Estruturas de Domínio
Antes de avançarmos para regras de negócio, precisamos garantir a segurança estática e a capacidade de modelar entidades.
- **Type Checker:** Um analisador semântico que roda antes da execução para validar se os tipos declarados batem com os valores atribuídos.
- **Structs e Métodos:** Capacidade de criar tipos complexos (ex: `struct User`) e atrelar funções a eles, permitindo o encapsulamento de lógica.
- **Módulos (Imports/Exports):** O sistema de resolução de dependências de arquivos para dividir o código em módulos estruturados.

### 3. Motor Assíncrono e I/O
Para competir em escalabilidade, a linguagem precisa se comunicar com o mundo externo sem bloquear a thread principal.
- **Goroutines e Channels:** Implementar o scheduler nativo para concorrência e troca de mensagens entre processos leves.
- **File System (FS):** Biblioteca padrão nativa para leitura e escrita de arquivos.
- **Rede (TCP/HTTP):** Implementação de sockets TCP em baixo nível e o módulo `http` padrão para receber requisições e enviar respostas.

### 4. Metaprogramação e Inversão de Controle
A base para frameworks declarativos. É aqui que a linguagem ganha a capacidade de suportar arquiteturas corporativas de forma elegante.
- **Decorators:** Suporte nativo na gramática para anotações (ex: `@Injectable()`, `@Controller()`).
- **Reflection API:** Capacidade do código ler seus próprios metadados em tempo de execução.
- **IoC Container Nativo:** Um motor interno de Injeção de Dependências para instanciar repositórios e serviços de forma autônoma, garantindo o desacoplamento das camadas.

### 5. Persistência e Isolamento de Dados
**Foco em Bancos Relacionais.** Uma API de alto nível precisa de comunicação impecável com o banco de dados.
- **Drivers Nativos:** Conexão TCP direta com bancos robustos, começando pelo PostgreSQL.
- **ORM e Query Builder Base:** Ferramental nativo usando as structs e decorators para mapear tabelas.
- **Isolamento Nativo:** Preparar as APIs de banco para suportar padrões avançados de arquitetura direto na linguagem, como suporte facilitado a Row-Level Security (RLS) e estratégias de Multi-tenancy na camada de persistência.

### 6. O Framework Oficial e Arquitetura
O topo da pirâmide. Utilizando tudo o que foi construído, nasce o framework web padrão da linguagem.
- **Roteamento e Middlewares:** Sistema de rotas baseado nos decorators e interceptadores de requisição.
- **Validação Estática:** Uso do Type Checker da linguagem para validar payloads de entrada automaticamente.
- **Design de Arquitetura:** Estruturar as CLI tools do framework para encorajar a separação em camadas desde a criação do projeto, favorecendo modelos como a Arquitetura Hexagonal (separando Ports e Adapters da lógica de domínio).

---

## Contribua!

A **FlexLang** está no começo de uma jornada extraordinária. Pesquisas detalhadas, RFCs de sintaxe e implementações no AST são sempre bem-vindas. Se você tiver alguma ideia ou funcionalidade arquitetural inovadora, sinta-se à vontade para abrir uma issue!
