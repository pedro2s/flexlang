import { json } from "encoding/json";
import { base64 } from "encoding/base64";
import { hex } from "encoding/hex";

// 1. JSON
print("--- JSON ---");
let raw = "{}";
match json.parse(raw) {
    Result.Ok(parsed) {
        let k_chave = "chave";
        json.set(parsed, k_chave, "valor");
        
        let k_num = "num";
        json.set(parsed, k_num, 42);
        
        // Modificando e Stringificando de volta
        json.set(parsed, "nova_chave", "sucesso");
        match json.stringify(parsed) {
            Result.Ok(str) {
                print("JSON stringify: Sucesso");
            },
            Result.Err(err) {
                print("Falhou ao stringify: ${err}");
            }
        }
    },
    Result.Err(err_parse) {
        print("Falhou ao dar parse: ${err_parse}");
    }
}

// 2. Base64
print("--- Base64 ---");
let b64 = base64.encode("flexlang super string");
print("Encode: ${b64}");
match base64.decode(b64) {
    Result.Ok(dec) {
        print("Decode: ${dec}");
    },
    Result.Err(err) {
        print("Decode err: ${err}");
    }
}

let b64_url = base64.encode_url_safe("jwt??payload++");
print("URL Safe Encode: ${b64_url}");
match base64.decode_url_safe(b64_url) {
    Result.Ok(dec2) {
        print("URL Safe Decode: ${dec2}");
    },
    Result.Err(err2) {
        print("URL Safe Decode err: ${err2}");
    }
}

// 3. Hex
print("--- Hex ---");
let hex_str = hex.encode("chave_secreta_pix");
print("Hex Encode: ${hex_str}");
match hex.decode(hex_str) {
    Result.Ok(dec3) {
        print("Hex Decode: ${dec3}");
    },
    Result.Err(err3) {
        print("Hex Decode err: ${err3}");
    }
}

print("Encoding Test Done");
