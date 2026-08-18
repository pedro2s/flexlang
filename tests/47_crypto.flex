// Teste RFC-028: Módulo crypto - Hashing, UUID e HMAC

import { hash, uuid, hmac, sha256 } from "crypto";

func test_bcrypt() {
    print("--- 1. Bcrypt ---");
    let pass = "minhasenha123";
    let h_res = hash.bcrypt(pass);

    match h_res {
        Result.Ok(h) {
            let is_valid = hash.bcrypt_verify("minhasenha123", h);
            let is_invalid = hash.bcrypt_verify("senhaerrada", h);
            print("Senha correta valida: ${is_valid}");
            print("Senha incorreta valida: ${is_invalid}");
        },
        Result.Err(e) {
            print("Erro no bcrypt: ${e}");
        }
    }
}

func test_uuid() {
    print("--- 2. UUID ---");
    let id = uuid.v4();
    // UUID v4 possui comprimento 36: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    let id_len = id.len();
    print("UUID tamanho: ${id_len}");
}

func test_hmac_and_sha() {
    print("--- 3. HMAC e SHA256 ---");
    let msg = "mensagem_pix_123";
    let key = "chave_secreta";
    let mac = hmac.sha256(msg, key);
    let mac_ok = hmac.verify(msg, key, mac);
    let mac_fail = hmac.verify(msg, "chave_errada", mac);
    print("HMAC valido: ${mac_ok}");
    print("HMAC invalido: ${mac_fail}");

    let hash_val = sha256("hello");
    print("SHA256 hello: ${hash_val}");
}

func main() {
    test_bcrypt();
    test_uuid();
    test_hmac_and_sha();
}

main();
