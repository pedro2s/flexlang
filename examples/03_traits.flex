// FlexLang: Traits e Abstrações
// O Polimorfismo na FlexLang ocorre através de "Interfaces Estritas" chamadas Traits.

trait Logger {
    func log(msg: String);
}

struct ConsoleLogger {
    prefix: String
}

impl Logger for ConsoleLogger {
    func log(self, msg: String) {
        print(self.prefix);
        print(msg);
    }
}

// O compilador validará se a struct obedece todas as assinaturas do Trait,
// abortando o build em caso de falha de implementação.

let logger = ConsoleLogger { prefix: "[FLEX] " };
logger.log("O sistema iniciou com sucesso!");
