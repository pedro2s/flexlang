import { NATIVE_TAG, type NativeModule } from "./types";
import { resultOk, resultErr } from "../stdlib";

export class FlexDecimal {
  readonly [NATIVE_TAG] = "Decimal";
  readonly value: bigint;
  readonly scale: number;

  constructor(valueOrStr: string | bigint, scale: number = 0) {
    if (typeof valueOrStr === "string") {
      let str = valueOrStr.trim();
      let isNeg = false;
      if (str.startsWith("-")) {
        isNeg = true;
        str = str.slice(1);
      } else if (str.startsWith("+")) {
        str = str.slice(1);
      }
      const parts = str.split(".");
      if (parts.length === 1) {
        this.scale = 0;
        this.value = BigInt(parts[0] || "0") * (isNeg ? -1n : 1n);
      } else {
        this.scale = parts[1].length;
        this.value = BigInt((parts[0] || "0") + parts[1]) * (isNeg ? -1n : 1n);
      }
    } else {
      this.value = valueOrStr;
      this.scale = Math.max(0, scale);
    }
  }

  static normalize(v: bigint, scale: number): FlexDecimal {
    let s = scale;
    while (s > 0 && v % 10n === 0n) {
      v = v / 10n;
      s--;
    }
    if (v === 0n) {
      s = 0;
    }
    return new FlexDecimal(v, s);
  }

  static new(s: string): FlexDecimal {
    return new FlexDecimal(s);
  }

  static from_int(n: number): FlexDecimal {
    return new FlexDecimal(BigInt(Math.trunc(n)), 0);
  }

  private align(other: FlexDecimal): { v1: bigint; v2: bigint; maxScale: number } {
    const maxScale = Math.max(this.scale, other.scale);
    const v1 = this.value * 10n ** BigInt(maxScale - this.scale);
    const v2 = other.value * 10n ** BigInt(maxScale - other.scale);
    return { v1, v2, maxScale };
  }

  add(other: FlexDecimal): FlexDecimal {
    const { v1, v2, maxScale } = this.align(other);
    return FlexDecimal.normalize(v1 + v2, maxScale);
  }

  sub(other: FlexDecimal): FlexDecimal {
    const { v1, v2, maxScale } = this.align(other);
    return FlexDecimal.normalize(v1 - v2, maxScale);
  }

  mul(other: FlexDecimal): FlexDecimal {
    const v = this.value * other.value;
    return FlexDecimal.normalize(v, this.scale + other.scale);
  }

  div(other: FlexDecimal): any {
    if (other.is_zero()) {
      return resultErr("division by zero");
    }
    const extraScale = 16;
    const v1 = this.value * 10n ** BigInt(other.scale + extraScale);
    const resVal = v1 / other.value;
    return resultOk(FlexDecimal.normalize(resVal, this.scale + extraScale));
  }

  modulo(other: FlexDecimal): FlexDecimal {
    if (other.is_zero()) {
      return FlexDecimal.from_int(0);
    }
    const { v1, v2, maxScale } = this.align(other);
    return FlexDecimal.normalize(v1 % v2, maxScale);
  }

  neg(): FlexDecimal {
    return new FlexDecimal(-this.value, this.scale);
  }

  abs(): FlexDecimal {
    return new FlexDecimal(this.value < 0n ? -this.value : this.value, this.scale);
  }

  round(places: number): FlexDecimal {
    if (this.scale <= places) {
      return this;
    }
    const diff = BigInt(this.scale - places);
    const divisor = 10n ** diff;
    const isNeg = this.value < 0n;
    const absVal = isNeg ? -this.value : this.value;
    let quotient = absVal / divisor;
    const remainder = absVal % divisor;
    const half = divisor / 2n;

    if (remainder > half) {
      quotient += 1n;
    } else if (remainder === half) {
      if (quotient % 2n !== 0n) {
        quotient += 1n;
      }
    }

    const finalVal = isNeg ? -quotient : quotient;
    return FlexDecimal.normalize(finalVal, places);
  }

  pow(exp: number): FlexDecimal {
    if (exp === 0) {
      return FlexDecimal.from_int(1);
    }
    if (exp < 0) {
      const pos = this.pow(-exp);
      const divRes = FlexDecimal.from_int(1).div(pos);
      return divRes.payload[0] as FlexDecimal;
    }
    const v = this.value ** BigInt(exp);
    return FlexDecimal.normalize(v, this.scale * exp);
  }

  cmp(other: FlexDecimal): number {
    const { v1, v2 } = this.align(other);
    if (v1 < v2) return -1;
    if (v1 > v2) return 1;
    return 0;
  }

  eq(other: FlexDecimal): boolean {
    return this.cmp(other) === 0;
  }

  gt(other: FlexDecimal): boolean {
    return this.cmp(other) > 0;
  }

  lt(other: FlexDecimal): boolean {
    return this.cmp(other) < 0;
  }

  gte(other: FlexDecimal): boolean {
    return this.cmp(other) >= 0;
  }

  lte(other: FlexDecimal): boolean {
    return this.cmp(other) <= 0;
  }

  is_zero(): boolean {
    return this.value === 0n;
  }

  is_positive(): boolean {
    return this.value > 0n;
  }

  is_negative(): boolean {
    return this.value < 0n;
  }

  to_string(): string {
    if (this.scale === 0) {
      return this.value.toString();
    }
    const isNeg = this.value < 0n;
    const absVal = isNeg ? -this.value : this.value;
    let str = absVal.toString();
    while (str.length <= this.scale) {
      str = "0" + str;
    }
    const intPart = str.slice(0, -this.scale);
    const fracPart = str.slice(-this.scale);
    return (isNeg ? "-" : "") + intPart + "." + fracPart;
  }

  to_float(): number {
    return parseFloat(this.to_string());
  }

  to_int(): number {
    const parts = this.to_string().split(".");
    return parseInt(parts[0], 10);
  }

  toJSON(): string {
    return this.to_string();
  }
}

const GO_BOILERPLATE = `// --- FlexLang math/decimal ---
type Decimal struct {
	value *big.Int
	scale int
}

func NewDecimal(s string) *Decimal {
	isNeg := false
	if len(s) > 0 && s[0] == '-' {
		isNeg = true
		s = s[1:]
	} else if len(s) > 0 && s[0] == '+' {
		s = s[1:]
	}
	parts := strings.Split(s, ".")
	var val *big.Int
	scale := 0
	if len(parts) == 1 {
		val, _ = new(big.Int).SetString(parts[0], 10)
		if val == nil { val = big.NewInt(0) }
	} else if len(parts) >= 2 {
		scale = len(parts[1])
		val, _ = new(big.Int).SetString(parts[0]+parts[1], 10)
		if val == nil { val = big.NewInt(0) }
	}
	if isNeg {
		val.Neg(val)
	}
	return decimal_normalize(val, scale)
}

func Decimal_new(s string) *Decimal {
	return NewDecimal(s)
}

func Decimal_from_int(n int) *Decimal {
	return &Decimal{value: big.NewInt(int64(n)), scale: 0}
}

func decimal_normalize(v *big.Int, scale int) *Decimal {
	ten := big.NewInt(10)
	zero := big.NewInt(0)
	rem := new(big.Int)
	for scale > 0 {
		rem.Mod(v, ten)
		if rem.Cmp(zero) == 0 {
			v.Div(v, ten)
			scale--
		} else {
			break
		}
	}
	if v.Cmp(zero) == 0 {
		scale = 0
	}
	return &Decimal{value: v, scale: scale}
}

func (d *Decimal) align(other *Decimal) (*big.Int, *big.Int, int) {
	maxScale := d.scale
	if other.scale > maxScale {
		maxScale = other.scale
	}
	ten := big.NewInt(10)
	v1 := new(big.Int).Set(d.value)
	if maxScale > d.scale {
		exp := new(big.Int).Exp(ten, big.NewInt(int64(maxScale-d.scale)), nil)
		v1.Mul(v1, exp)
	}
	v2 := new(big.Int).Set(other.value)
	if maxScale > other.scale {
		exp := new(big.Int).Exp(ten, big.NewInt(int64(maxScale-other.scale)), nil)
		v2.Mul(v2, exp)
	}
	return v1, v2, maxScale
}

func (d *Decimal) add(other *Decimal) *Decimal {
	v1, v2, maxScale := d.align(other)
	res := new(big.Int).Add(v1, v2)
	return decimal_normalize(res, maxScale)
}

func (d *Decimal) sub(other *Decimal) *Decimal {
	v1, v2, maxScale := d.align(other)
	res := new(big.Int).Sub(v1, v2)
	return decimal_normalize(res, maxScale)
}

func (d *Decimal) mul(other *Decimal) *Decimal {
	res := new(big.Int).Mul(d.value, other.value)
	return decimal_normalize(res, d.scale+other.scale)
}

func (d *Decimal) div(other *Decimal) Result {
	if other.is_zero() {
		return Result_Err_new("division by zero")
	}
	extraScale := 16
	ten := big.NewInt(10)
	exp := new(big.Int).Exp(ten, big.NewInt(int64(other.scale+extraScale)), nil)
	v1 := new(big.Int).Mul(d.value, exp)
	res := new(big.Int).Quo(v1, other.value)
	return Result_Ok_new(decimal_normalize(res, d.scale+extraScale))
}

func (d *Decimal) modulo(other *Decimal) *Decimal {
	if other.is_zero() {
		return Decimal_from_int(0)
	}
	v1, v2, maxScale := d.align(other)
	res := new(big.Int).Rem(v1, v2)
	return decimal_normalize(res, maxScale)
}

func (d *Decimal) neg() *Decimal {
	res := new(big.Int).Neg(d.value)
	return &Decimal{value: res, scale: d.scale}
}

func (d *Decimal) abs() *Decimal {
	res := new(big.Int).Abs(d.value)
	return &Decimal{value: res, scale: d.scale}
}

func (d *Decimal) round(places int) *Decimal {
	if d.scale <= places {
		return d
	}
	diff := int64(d.scale - places)
	ten := big.NewInt(10)
	divisor := new(big.Int).Exp(ten, big.NewInt(diff), nil)
	isNeg := d.value.Sign() < 0
	absVal := new(big.Int).Abs(d.value)
	quotient := new(big.Int)
	remainder := new(big.Int)
	quotient.QuoRem(absVal, divisor, remainder)
	half := new(big.Int).Quo(divisor, big.NewInt(2))
	cmp := remainder.Cmp(half)
	if cmp > 0 {
		quotient.Add(quotient, big.NewInt(1))
	} else if cmp == 0 {
		two := big.NewInt(2)
		remTwo := new(big.Int).Mod(quotient, two)
		if remTwo.Cmp(big.NewInt(0)) != 0 {
			quotient.Add(quotient, big.NewInt(1))
		}
	}
	if isNeg {
		quotient.Neg(quotient)
	}
	return decimal_normalize(quotient, places)
}

func (d *Decimal) pow(exp int) *Decimal {
	if exp == 0 {
		return Decimal_from_int(1)
	}
	if exp < 0 {
		pos := d.pow(-exp)
		res := Decimal_from_int(1).div(pos)
		switch r := res.(type) {
		case Result_Ok:
			return r.Field0.(*Decimal)
		default:
			return Decimal_from_int(0)
		}
	}
	resVal := new(big.Int).Exp(d.value, big.NewInt(int64(exp)), nil)
	return decimal_normalize(resVal, d.scale*exp)
}

func (d *Decimal) cmp(other *Decimal) int {
	v1, v2, _ := d.align(other)
	return v1.Cmp(v2)
}

func (d *Decimal) eq(other *Decimal) bool {
	return d.cmp(other) == 0
}

func (d *Decimal) gt(other *Decimal) bool {
	return d.cmp(other) > 0
}

func (d *Decimal) lt(other *Decimal) bool {
	return d.cmp(other) < 0
}

func (d *Decimal) gte(other *Decimal) bool {
	return d.cmp(other) >= 0
}

func (d *Decimal) lte(other *Decimal) bool {
	return d.cmp(other) <= 0
}

func (d *Decimal) is_zero() bool {
	return d.value.Sign() == 0
}

func (d *Decimal) is_positive() bool {
	return d.value.Sign() > 0
}

func (d *Decimal) is_negative() bool {
	return d.value.Sign() < 0
}

func (d *Decimal) to_string() string {
	if d.scale == 0 {
		return d.value.String()
	}
	isNeg := d.value.Sign() < 0
	absVal := new(big.Int).Abs(d.value)
	str := absVal.String()
	for len(str) <= d.scale {
		str = "0" + str
	}
	intPart := str[:len(str)-d.scale]
	fracPart := str[len(str)-d.scale:]
	prefix := ""
	if isNeg {
		prefix = "-"
	}
	return prefix + intPart + "." + fracPart
}

func (d *Decimal) to_float() float64 {
	f, _ := strconv.ParseFloat(d.to_string(), 64)
	return f
}

func (d *Decimal) to_int() int {
	parts := strings.Split(d.to_string(), ".")
	n, _ := strconv.Atoi(parts[0])
	return n
}

func (d *Decimal) MarshalJSON() ([]byte, error) {
	return json.Marshal(d.to_string())
}
// -----------------------------`;

export const decimalModule: NativeModule = {
  path: "math/decimal",

  types: [
    {
      name: "Decimal",
      goPointer: true,
      statics: [
        {
          name: "new",
          arity: 1,
          returns: { kind: "Struct", name: "Decimal", genericArgs: [] },
        },
        {
          name: "from_int",
          arity: 1,
          returns: { kind: "Struct", name: "Decimal", genericArgs: [] },
        },
      ],
      methods: [
        { name: "add", arity: 1, returns: { kind: "Struct", name: "Decimal", genericArgs: [] } },
        { name: "sub", arity: 1, returns: { kind: "Struct", name: "Decimal", genericArgs: [] } },
        { name: "mul", arity: 1, returns: { kind: "Struct", name: "Decimal", genericArgs: [] } },
        {
          name: "div",
          arity: 1,
          returns: {
            kind: "Enum",
            name: "Result",
            genericArgs: [{ kind: "Struct", name: "Decimal", genericArgs: [] }, { kind: "String" }],
          },
        },
        { name: "modulo", arity: 1, returns: { kind: "Struct", name: "Decimal", genericArgs: [] } },
        { name: "neg", arity: 0, returns: { kind: "Struct", name: "Decimal", genericArgs: [] } },
        { name: "abs", arity: 0, returns: { kind: "Struct", name: "Decimal", genericArgs: [] } },
        { name: "round", arity: 1, returns: { kind: "Struct", name: "Decimal", genericArgs: [] } },
        { name: "pow", arity: 1, returns: { kind: "Struct", name: "Decimal", genericArgs: [] } },
        { name: "eq", arity: 1, returns: { kind: "Bool" } },
        { name: "gt", arity: 1, returns: { kind: "Bool" } },
        { name: "lt", arity: 1, returns: { kind: "Bool" } },
        { name: "gte", arity: 1, returns: { kind: "Bool" } },
        { name: "lte", arity: 1, returns: { kind: "Bool" } },
        { name: "is_zero", arity: 0, returns: { kind: "Bool" } },
        { name: "is_positive", arity: 0, returns: { kind: "Bool" } },
        { name: "is_negative", arity: 0, returns: { kind: "Bool" } },
        { name: "cmp", arity: 1, returns: { kind: "Int" } },
        { name: "to_string", arity: 0, returns: { kind: "String" } },
        { name: "to_float", arity: 0, returns: { kind: "Float" } },
        { name: "to_int", arity: 0, returns: { kind: "Int" } },
      ],
    },
  ],

  usesBuiltins: ["Result"],

  runtimeBinding: () => ({
    Decimal: {
      [NATIVE_TAG]: "Decimal",
      new: (s: string) => FlexDecimal.new(s),
      from_int: (n: number) => FlexDecimal.from_int(n),
    },
  }),

  goCodegen: {
    imports: ["math/big", "strings", "strconv", "encoding/json"],
    boilerplate: GO_BOILERPLATE,
  },
};
