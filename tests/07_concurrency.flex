// Teste 07: Concorrencia Estruturada (Scope e Spawn)

let mut valor_compartilhado = 0;

print("1. Antes do scope");

scope {
    print("2. Dentro do scope, iniciando filhos");

    spawn {
        valor_compartilhado = valor_compartilhado + 10;
        print(" -> Filho 1 finalizou seu trabalho");
    }
    
    spawn {
        valor_compartilhado = valor_compartilhado + 20;
        print(" -> Filho 2 finalizou seu trabalho");
    }
    
    print("3. Filhos despachados (o pai deve esperar antes de seguir)");
}

print("4. Fora do scope, todos os filhos terminaram");
print("Valor final:");
print(valor_compartilhado);
