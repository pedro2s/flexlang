// Teste 08: Canais e Move Semantics

let c: Channel<String> = Channel.new();

scope {
    spawn {
        let mut msg = "Ola do filho para o pai!";
        c.send(msg); // Move a propriedade da string para o canal
        
        // Esta linha eh criminosa na FlexLang e sera barrada pelo TypeChecker
        // pois msg foi "movida" e nao pertence mais a este espaco de memoria!
        print(msg);
    }

    let resposta = c.recv();
    print(resposta);
}
