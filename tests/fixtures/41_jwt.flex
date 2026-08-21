import { jwt } from "crypto/jwt";
import { json } from "encoding/json";

print("--- JWT HS256 ---");

let secret = "minha_chave_super_secreta_2026";
let payload = json.parse("{}").unwrap();
json.set(payload, "user_id", "admin-123");
json.set(payload, "role", "superuser");

let opts = json.parse("{}").unwrap();
json.set(opts, "secret", secret);
json.set(opts, "algorithm", "HS256");
json.set(opts, "issuer", "flex-test");
json.set(opts, "expires_in", 3600); // 1 hora

match jwt.sign(payload, opts) {
    Result.Ok(t) {
        print("JWT Sign: OK");
        
        let verifyOpts = json.parse("{}").unwrap();
        json.set(verifyOpts, "secret", secret);
        json.set(verifyOpts, "expected_issuer", "flex-test");

        match jwt.verify(t, verifyOpts) {
            Result.Ok(claims) {
                print("JWT Verify: OK");
            },
            Result.Err(e) {
                print("JWT Verify Err: ${e}");
            }
        }
    },
    Result.Err(e) {
        print("JWT Sign Err: ${e}");
    }
}

print("--- JWT HS256 Expirado ---");
let expOpts = json.parse("{}").unwrap();
json.set(expOpts, "secret", secret);
json.set(expOpts, "algorithm", "HS256");
json.set(expOpts, "expires_in", -10); // expirou 10s atrás

match jwt.sign(payload, expOpts) {
    Result.Ok(t) {
        let verifyOpts = json.parse("{}").unwrap();
        json.set(verifyOpts, "secret", secret);
        json.set(verifyOpts, "expected_issuer", "flex-test");
        
        match jwt.verify(t, verifyOpts) {
            Result.Ok(claims) {
                print("Err: Token expirado deveria falhar!");
            },
            Result.Err(e) {
                print("Verify Expired: Fail OK (Esperado)");
            }
        }
    },
    Result.Err(e) {
        print("Sign Expired Err: ${e}");
    }
}

print("--- JWT JWT DONE ---");
