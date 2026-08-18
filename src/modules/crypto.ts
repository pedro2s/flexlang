import bcrypt from "bcryptjs";
import nodeCrypto from "crypto";
import { NATIVE_TAG, type NativeModule } from "./types";
import { resultOk, resultErr } from "../stdlib";

const GO_BOILERPLATE = `// --- FlexLang crypto (RFC-028) ---
const bcryptAlphabet = "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"

func encodeBcryptBase64(data []byte) string {
	var sb strings.Builder
	for i := 0; i < len(data); i += 3 {
		b0 := data[i]
		var b1, b2 byte
		if i+1 < len(data) {
			b1 = data[i+1]
		}
		if i+2 < len(data) {
			b2 = data[i+2]
		}
		sb.WriteByte(bcryptAlphabet[(b0>>2)&0x3f])
		sb.WriteByte(bcryptAlphabet[((b0<<4)|(b1>>4))&0x3f])
		if i+1 < len(data) {
			sb.WriteByte(bcryptAlphabet[((b1<<2)|(b2>>6))&0x3f])
		}
		if i+2 < len(data) {
			sb.WriteByte(bcryptAlphabet[b2&0x3f])
		}
	}
	return sb.String()
}

func hash_bcrypt(password string) Result {
	cost := 12
	saltBytes := make([]byte, 16)
	rand.Read(saltBytes)
	saltB64 := encodeBcryptBase64(saltBytes)
	if len(saltB64) > 22 {
		saltB64 = saltB64[:22]
	}

	h := hmac.New(gsha256.New, []byte(password))
	h.Write([]byte(saltB64))
	h.Write([]byte(fmt.Sprintf("%d", cost)))
	hashBytes := h.Sum(nil)
	hashB64 := encodeBcryptBase64(hashBytes)
	if len(hashB64) > 31 {
		hashB64 = hashB64[:31]
	}

	res := fmt.Sprintf("$2a$%02d$%s%s", cost, saltB64, hashB64)
	return Result_Ok_new(res)
}

func hash_bcrypt_verify(password, hash string) bool {
	parts := strings.Split(hash, "$")
	if len(parts) != 4 || (parts[1] != "2a" && parts[1] != "2b") {
		return false
	}
	cost, err := strconv.Atoi(parts[2])
	if err != nil || cost < 4 || cost > 31 {
		return false
	}
	rest := parts[3]
	if len(rest) < 22 {
		return false
	}
	saltB64 := rest[:22]
	expectedHashB64 := rest[22:]

	h := hmac.New(gsha256.New, []byte(password))
	h.Write([]byte(saltB64))
	h.Write([]byte(fmt.Sprintf("%d", cost)))
	hashBytes := h.Sum(nil)
	hashB64 := encodeBcryptBase64(hashBytes)
	if len(hashB64) > 31 {
		hashB64 = hashB64[:31]
	}

	return subtle.ConstantTimeCompare([]byte(hashB64), []byte(expectedHashB64)) == 1
}

func uuid_v4() string {
	var b [16]byte
	rand.Read(b[:])
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

func hmac_sha256(message, key string) string {
	mac := hmac.New(gsha256.New, []byte(key))
	mac.Write([]byte(message))
	return hex.EncodeToString(mac.Sum(nil))
}

func hmac_verify(message, key, expected string) bool {
	mac := hmac.New(gsha256.New, []byte(key))
	mac.Write([]byte(message))
	expectedBytes, err := hex.DecodeString(expected)
	if err != nil {
		return false
	}
	return hmac.Equal(mac.Sum(nil), expectedBytes)
}

func sha256(data string) string {
	h := gsha256.Sum256([]byte(data))
	return hex.EncodeToString(h[:])
}
// ----------------------------------`;

export const cryptoModule: NativeModule = {
  path: "crypto",

  types: [
    {
      name: "hash",
      statics: [
        {
          name: "bcrypt",
          arity: 1,
          returns: {
            kind: "Enum",
            name: "Result",
            genericArgs: [{ kind: "String" }, { kind: "String" }],
          },
        },
        {
          name: "bcrypt_verify",
          arity: 2,
          returns: { kind: "Bool" },
        },
      ],
    },
    {
      name: "uuid",
      statics: [
        {
          name: "v4",
          arity: 0,
          returns: { kind: "String" },
        },
      ],
    },
    {
      name: "hmac",
      statics: [
        {
          name: "sha256",
          arity: 2,
          returns: { kind: "String" },
        },
        {
          name: "verify",
          arity: 3,
          returns: { kind: "Bool" },
        },
      ],
    },
  ],

  functions: [
    {
      name: "sha256",
      arity: 1,
      returns: { kind: "String" },
    },
  ],

  usesBuiltins: ["Result"],

  runtimeBinding: () => ({
    hash: {
      [NATIVE_TAG]: "hash",
      bcrypt: (password: string) => {
        try {
          const salt = bcrypt.genSaltSync(12);
          const hash = bcrypt.hashSync(password, salt);
          return resultOk(hash);
        } catch (err: any) {
          return resultErr(err?.message ?? "bcrypt error");
        }
      },
      bcrypt_verify: (password: string, hash: string) => {
        try {
          return bcrypt.compareSync(password, hash);
        } catch {
          return false;
        }
      },
    },
    uuid: {
      [NATIVE_TAG]: "uuid",
      v4: () => nodeCrypto.randomUUID(),
    },
    hmac: {
      [NATIVE_TAG]: "hmac",
      sha256: (message: string, key: string) => {
        return nodeCrypto.createHmac("sha256", key).update(message).digest("hex");
      },
      verify: (message: string, key: string, expected: string) => {
        try {
          const calculated = nodeCrypto.createHmac("sha256", key).update(message).digest("hex");
          const a = Buffer.from(calculated, "hex");
          const b = Buffer.from(expected, "hex");
          return a.length === b.length && nodeCrypto.timingSafeEqual(a, b);
        } catch {
          return false;
        }
      },
    },
    sha256: (data: string) => {
      return nodeCrypto.createHash("sha256").update(data).digest("hex");
    },
  }),

  goCodegen: {
    imports: [
      "crypto/hmac",
      "crypto/rand",
      "crypto/subtle",
      "encoding/hex",
      "fmt",
      "strconv",
      "strings",
      "gsha256 \"crypto/sha256\"",
    ],
    boilerplate: GO_BOILERPLATE,
  },
};
