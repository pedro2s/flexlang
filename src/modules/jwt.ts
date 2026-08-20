import { NATIVE_TAG, type NativeModule } from "./types";
import { resultOk, resultErr } from "../stdlib";
import _jwt from "jsonwebtoken";
const jwt: any = _jwt;

const GO_BOILERPLATE = `// --- FlexLang crypto/jwt ---
func jwt_sign(payload any, options any) Result {
    claims := jwtV5.MapClaims{}
    payloadMap, ok := payload.(map[string]any)
    if !ok {
        return Result_Err_new("Payload must be an object")
    }
    for k, v := range payloadMap {
        claims[k] = v
    }

    optsMap, ok := options.(map[string]any)
    if !ok {
        return Result_Err_new("Options must be an object")
    }

    if val, ok := optsMap["expires_in"]; ok {
        var exp float64
        switch v := val.(type) {
        case float64:
            exp = v
        case int:
            exp = float64(v)
        case int64:
            exp = float64(v)
        }
        claims["exp"] = jwtV5.NewNumericDate(time.Now().Add(time.Duration(exp) * time.Second))
    }
    if iss, ok := optsMap["issuer"].(string); ok && iss != "" {
        claims["iss"] = iss
    }

    alg, _ := optsMap["algorithm"].(string)
    if alg == "" {
        alg = "HS256"
    }

    token := jwtV5.NewWithClaims(jwtV5.GetSigningMethod(alg), claims)
    secret, _ := optsMap["secret"].(string)

    signedString, err := token.SignedString([]byte(secret))
    if err != nil {
        return Result_Err_new("JWT Sign Error: " + err.Error())
    }
    return Result_Ok_new(signedString)
}

func jwt_sign_rsa(payload any, options any) Result {
    claims := jwtV5.MapClaims{}
    payloadMap, ok := payload.(map[string]any)
    if !ok {
        return Result_Err_new("Payload must be an object")
    }
    for k, v := range payloadMap {
        claims[k] = v
    }

    optsMap, ok := options.(map[string]any)
    if !ok {
        return Result_Err_new("Options must be an object")
    }

    if val, ok := optsMap["expires_in"]; ok {
        var exp float64
        switch v := val.(type) {
        case float64:
            exp = v
        case int:
            exp = float64(v)
        case int64:
            exp = float64(v)
        }
        claims["exp"] = jwtV5.NewNumericDate(time.Now().Add(time.Duration(exp) * time.Second))
    }
    if iss, ok := optsMap["issuer"].(string); ok && iss != "" {
        claims["iss"] = iss
    }

    alg, _ := optsMap["algorithm"].(string)
    if alg == "" {
        alg = "RS256"
    }

    token := jwtV5.NewWithClaims(jwtV5.GetSigningMethod(alg), claims)
    privKeyPem, _ := optsMap["private_key_pem"].(string)

    privKey, err := jwtV5.ParseRSAPrivateKeyFromPEM([]byte(privKeyPem))
    if err != nil {
        return Result_Err_new("Invalid RSA Private Key: " + err.Error())
    }

    signedString, err := token.SignedString(privKey)
    if err != nil {
        return Result_Err_new("JWT Sign Error: " + err.Error())
    }
    return Result_Ok_new(signedString)
}

func jwt_verify(tokenStrRaw any, options any) Result {
    tokenStr, ok := tokenStrRaw.(string)
    if !ok {
        return Result_Err_new("Token must be a string")
    }
    optsMap, ok := options.(map[string]any)
    if !ok {
        return Result_Err_new("Options must be an object")
    }

    secret, _ := optsMap["secret"].(string)
    token, err := jwtV5.Parse(tokenStr, func(t *jwtV5.Token) (interface{}, error) {
        return []byte(secret), nil
    })

    if err != nil {
        return Result_Err_new("JWT Verify Error: " + err.Error())
    }

    if claims, ok := token.Claims.(jwtV5.MapClaims); ok && token.Valid {
        // Convert to map[string]any for FlexLang
        resMap := make(map[string]any)
        for k, v := range claims {
            resMap[k] = v
        }
        return Result_Ok_new(resMap)
    }

    return Result_Err_new("Invalid Token")
}

func jwt_verify_rsa(tokenStrRaw any, options any) Result {
    tokenStr, ok := tokenStrRaw.(string)
    if !ok {
        return Result_Err_new("Token must be a string")
    }
    optsMap, ok := options.(map[string]any)
    if !ok {
        return Result_Err_new("Options must be an object")
    }

    pubKeyPem, _ := optsMap["public_key_pem"].(string)
    pubKey, err := jwtV5.ParseRSAPublicKeyFromPEM([]byte(pubKeyPem))
    if err != nil {
        return Result_Err_new("Invalid RSA Public Key: " + err.Error())
    }

    token, err := jwtV5.Parse(tokenStr, func(t *jwtV5.Token) (interface{}, error) {
        return pubKey, nil
    })

    if err != nil {
        return Result_Err_new("JWT Verify Error: " + err.Error())
    }

    if claims, ok := token.Claims.(jwtV5.MapClaims); ok && token.Valid {
        resMap := make(map[string]any)
        for k, v := range claims {
            resMap[k] = v
        }
        return Result_Ok_new(resMap)
    }

    return Result_Err_new("Invalid Token")
}
// -----------------------------`;

function flexToJs(val: any): any {
  if (val === null || val === undefined) return null;
  if (Array.isArray(val)) return val.map(flexToJs);
  if (val instanceof Map) {
    const obj: any = {};
    for (const [k, v] of val) {
      obj[k] = flexToJs(v);
    }
    return obj;
  }
  if (typeof val === "object") {
    const obj: any = {};
    for (const k of Object.keys(val)) {
      obj[k] = flexToJs(val[k]);
    }
    return obj;
  }
  return val;
}

function jsToFlex(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(jsToFlex);
  if (typeof obj === "object") {
    const m = new Map<string, any>();
    for (const k of Object.keys(obj)) {
      m.set(k, jsToFlex(obj[k]));
    }
    return m;
  }
  return obj;
}

export const jwtModule: NativeModule = {
  path: "crypto/jwt",

  types: [
    {
      name: "jwt",
      statics: [
        { name: "sign", arity: 2, returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "NamedTypeNode", name: "String" }, { kind: "NamedTypeNode", name: "String" }] } },
        { name: "sign_rsa", arity: 2, returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "NamedTypeNode", name: "String" }, { kind: "NamedTypeNode", name: "String" }] } },
        { name: "verify", arity: 2, returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "Any" }, { kind: "NamedTypeNode", name: "String" }] } },
        { name: "verify_rsa", arity: 2, returns: { kind: "Enum", name: "Result", genericArgs: [{ kind: "Any" }, { kind: "NamedTypeNode", name: "String" }] } },
      ],
      methods: [],
    },
  ],

  usesBuiltins: ["Result"],

  runtimeBinding: (interpreter) => ({
    jwt: {
      [NATIVE_TAG]: "jwt",
      sign: (payload: any, options: any) => {
        try {
          const jsPayload = flexToJs(payload);
          const jsOpts = flexToJs(options);
          const secret = jsOpts.secret || "";
          
          const signOpts: jwt.SignOptions = {};
          if (jsOpts.algorithm) signOpts.algorithm = jsOpts.algorithm;
          if (typeof jsOpts.expires_in === "number") signOpts.expiresIn = jsOpts.expires_in; // in seconds
          if (jsOpts.issuer) signOpts.issuer = jsOpts.issuer;

          const token = jwt.sign(jsPayload, secret, signOpts);
          return resultOk(token);
        } catch (e: any) {
          return resultErr("JWT Sign Error: " + (e.message || String(e)));
        }
      },
      sign_rsa: (payload: any, options: any) => {
        try {
          const jsPayload = flexToJs(payload);
          const jsOpts = flexToJs(options);
          const privateKey = jsOpts.private_key_pem || "";
          
          const signOpts: jwt.SignOptions = {};
          signOpts.algorithm = jsOpts.algorithm || "RS256";
          if (typeof jsOpts.expires_in === "number") signOpts.expiresIn = jsOpts.expires_in;
          if (jsOpts.issuer) signOpts.issuer = jsOpts.issuer;

          const token = jwt.sign(jsPayload, privateKey, signOpts);
          return resultOk(token);
        } catch (e: any) {
          return resultErr("JWT Sign Error: " + (e.message || String(e)));
        }
      },
      verify: (token: string, options: any) => {
        try {
          const jsOpts = flexToJs(options);
          const secret = jsOpts.secret || "";
          
          const verifyOpts: jwt.VerifyOptions = {};
          if (jsOpts.expected_issuer) verifyOpts.issuer = jsOpts.expected_issuer;

          const decoded = jwt.verify(token, secret, verifyOpts);
          return resultOk(jsToFlex(decoded));
        } catch (e: any) {
          return resultErr("JWT Verify Error: " + (e.message || String(e)));
        }
      },
      verify_rsa: (token: string, options: any) => {
        try {
          const jsOpts = flexToJs(options);
          const publicKey = jsOpts.public_key_pem || "";
          
          const verifyOpts: jwt.VerifyOptions = {};
          if (jsOpts.expected_issuer) verifyOpts.issuer = jsOpts.expected_issuer;
          verifyOpts.algorithms = ["RS256", "RS384", "RS512"];

          const decoded = jwt.verify(token, publicKey, verifyOpts);
          return resultOk(jsToFlex(decoded));
        } catch (e: any) {
          return resultErr("JWT Verify Error: " + (e.message || String(e)));
        }
      },
    }
  }),

  goCodegen: {
    imports: ["time", 'jwtV5 "github.com/golang-jwt/jwt/v5"'],
    boilerplate: GO_BOILERPLATE,
    thirdParty: ["github.com/golang-jwt/jwt/v5"],
  },
};
