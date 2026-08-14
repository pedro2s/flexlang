// FlexLang: Concorrência Estruturada e Canais
// Demonstra o uso de `scope`, `spawn` e passagem segura de estado por `Channel`

struct Worker {
    id: Int
}

impl Worker {
    func process(self, data: String) {
        print("Trabalhador processando: ");
        print(data);
    }
}

func main() {
    let mut c: Channel<String> = Channel.new();
    let w1 = Worker { id: 1 };
    
    scope {
        // Dispara uma Green Thread que executará em background
        spawn {
            print("Processamento pesado inciado...");
            let mut payload = "Dados vitais do Banco de Dados";
            
            // Move a variável para o canal (Borrow Checker: Use-after-send previne Data Races)
            c.send(payload); 
        }
        
        // A thread principal dorme até o dado chegar no canal
        let result = c.recv();
        w1.process(result);
    }
    
    print("Todas as tarefas assíncronas finalizaram!");
}

main();
