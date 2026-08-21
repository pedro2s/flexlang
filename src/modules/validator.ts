import { NATIVE_TAG, type NativeModule } from "./types";
import { resultOk, resultErr } from "../stdlib";

function validateCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(digits[i]) * (10 - i);
  }
  let rev = (sum * 10) % 11;
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== Number(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += Number(digits[i]) * (11 - i);
  }
  rev = (sum * 10) % 11;
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== Number(digits[10])) return false;

  return true;
}

function validateCnpj(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(digits[i]) * weights1[i]!;
  }
  let rem = sum % 11;
  const digit1 = rem < 2 ? 0 : 11 - rem;
  if (Number(digits[12]) !== digit1) return false;

  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += Number(digits[i]) * weights2[i]!;
  }
  rem = sum % 11;
  const digit2 = rem < 2 ? 0 : 11 - rem;
  if (Number(digits[13]) !== digit2) return false;

  return true;
}

function validateEmail(email: string): boolean {
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(email);
}

function validateUuid(uuid: string): boolean {
  const regex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
  return regex.test(uuid);
}

function makeValidationError(field: string, message: string): Map<string, unknown> {
  const map = new Map<string, unknown>();
  map.set("__structName", "ValidationError");
  map.set("field", field);
  map.set("message", message);
  return map;
}

export class FlexFieldValidator {
  readonly [NATIVE_TAG] = "FieldValidator";

  constructor(
    private parent: FlexValidator,
    private fieldName: string,
    private value: string,
  ) {}

  required(): FlexFieldValidator {
    if (!this.value || this.value.trim().length === 0) {
      this.parent.add_error(this.fieldName, `${this.fieldName} é obrigatório`);
    }
    return this;
  }

  min_len(min: number): FlexFieldValidator {
    if (this.value && this.value.length < min) {
      this.parent.add_error(this.fieldName, `${this.fieldName} deve ter no mínimo ${min} caracteres`);
    }
    return this;
  }

  max_len(max: number): FlexFieldValidator {
    if (this.value && this.value.length > max) {
      this.parent.add_error(this.fieldName, `${this.fieldName} não pode exceder ${max} caracteres`);
    }
    return this;
  }

  email(): FlexFieldValidator {
    if (this.value && !validateEmail(this.value)) {
      this.parent.add_error(this.fieldName, `${this.fieldName} deve ser um e-mail válido`);
    }
    return this;
  }

  cpf(): FlexFieldValidator {
    if (this.value && !validateCpf(this.value)) {
      this.parent.add_error(this.fieldName, `${this.fieldName} deve ser um CPF válido`);
    }
    return this;
  }

  cnpj(): FlexFieldValidator {
    if (this.value && !validateCnpj(this.value)) {
      this.parent.add_error(this.fieldName, `${this.fieldName} deve ser um CNPJ válido`);
    }
    return this;
  }

  uuid(): FlexFieldValidator {
    if (this.value && !validateUuid(this.value)) {
      this.parent.add_error(this.fieldName, `${this.fieldName} deve ser um UUID válido`);
    }
    return this;
  }

  regex(pattern: string): FlexFieldValidator {
    if (this.value) {
      try {
        const re = new RegExp(pattern);
        if (!re.test(this.value)) {
          this.parent.add_error(this.fieldName, `${this.fieldName} tem formato inválido`);
        }
      } catch {
        this.parent.add_error(this.fieldName, `${this.fieldName} tem formato inválido`);
      }
    }
    return this;
  }
}

export class FlexValidator {
  readonly [NATIVE_TAG] = "Validator";
  private errorList: Map<string, unknown>[] = [];

  field(name: string, value: unknown): FlexFieldValidator {
    const valStr = value !== null && value !== undefined ? String(value) : "";
    return new FlexFieldValidator(this, name, valStr);
  }

  add_error(field: string, message: string): null {
    this.errorList.push(makeValidationError(field, message));
    return null;
  }

  is_valid(): boolean {
    return this.errorList.length === 0;
  }

  errors(): Map<string, unknown>[] {
    return this.errorList;
  }

  result(): unknown {
    if (this.errorList.length === 0) {
      return resultOk(null);
    }
    return resultErr(this.errorList);
  }
}

const GO_BOILERPLATE = `// --- FlexLang std/validator (RFC-037) ---
type ValidationError struct {
	field   string
	message string
}

func (e *ValidationError) String() string {
	return fmt.Sprintf("{field: %s, message: %s}", e.field, e.message)
}

type Validator struct {
	errors []*ValidationError
}

func validator_new() *Validator {
	return &Validator{errors: make([]*ValidationError, 0)}
}

func Newvalidator() *Validator {
	return validator_new()
}

func validator_cpf(cpf string) bool {
	digits := ""
	for _, ch := range cpf {
		if ch >= '0' && ch <= '9' {
			digits += string(ch)
		}
	}
	if len(digits) != 11 {
		return false
	}
	allSame := true
	for i := 1; i < 11; i++ {
		if digits[i] != digits[0] {
			allSame = false
			break
		}
	}
	if allSame {
		return false
	}

	sum := 0
	for i := 0; i < 9; i++ {
		sum += int(digits[i]-'0') * (10 - i)
	}
	rev := (sum * 10) % 11
	if rev == 10 || rev == 11 {
		rev = 0
	}
	if rev != int(digits[9]-'0') {
		return false
	}

	sum = 0
	for i := 0; i < 10; i++ {
		sum += int(digits[i]-'0') * (11 - i)
	}
	rev = (sum * 10) % 11
	if rev == 10 || rev == 11 {
		rev = 0
	}
	if rev != int(digits[10]-'0') {
		return false
	}

	return true
}

func validator_cnpj(cnpj string) bool {
	digits := ""
	for _, ch := range cnpj {
		if ch >= '0' && ch <= '9' {
			digits += string(ch)
		}
	}
	if len(digits) != 14 {
		return false
	}
	allSame := true
	for i := 1; i < 14; i++ {
		if digits[i] != digits[0] {
			allSame = false
			break
		}
	}
	if allSame {
		return false
	}

	weights1 := []int{5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2}
	sum := 0
	for i := 0; i < 12; i++ {
		sum += int(digits[i]-'0') * weights1[i]
	}
	rem := sum % 11
	digit1 := 0
	if rem >= 2 {
		digit1 = 11 - rem
	}
	if int(digits[12]-'0') != digit1 {
		return false
	}

	weights2 := []int{6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2}
	sum = 0
	for i := 0; i < 13; i++ {
		sum += int(digits[i]-'0') * weights2[i]
	}
	rem = sum % 11
	digit2 := 0
	if rem >= 2 {
		digit2 = 11 - rem
	}
	if int(digits[13]-'0') != digit2 {
		return false
	}

	return true
}

var emailRegex = regexp.MustCompile(\`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$\`)
var uuidRegex = regexp.MustCompile(\`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$\`)

func validator_email(email string) bool {
	return emailRegex.MatchString(email)
}

func validator_uuid(uuid string) bool {
	return uuidRegex.MatchString(uuid)
}

type FieldValidator struct {
	parent *Validator
	field  string
	value  string
}

func (v *Validator) field(name string, value string) *FieldValidator {
	return &FieldValidator{parent: v, field: name, value: value}
}

func (v *Validator) add_error(field string, message string) {
	v.errors = append(v.errors, &ValidationError{field: field, message: message})
}

func (v *Validator) is_valid() bool {
	return len(v.errors) == 0
}

func (v *Validator) errors_list() []*ValidationError {
	return v.errors
}

func (v *Validator) result() Result {
	if len(v.errors) == 0 {
		return Result_Ok_new(nil)
	}
	return Result_Err_new(v.errors)
}

func (fv *FieldValidator) required() *FieldValidator {
	if strings.TrimSpace(fv.value) == "" {
		fv.parent.add_error(fv.field, fv.field+" é obrigatório")
	}
	return fv
}

func (fv *FieldValidator) min_len(min int) *FieldValidator {
	if len(fv.value) < min {
		fv.parent.add_error(fv.field, fmt.Sprintf("%s deve ter no mínimo %d caracteres", fv.field, min))
	}
	return fv
}

func (fv *FieldValidator) max_len(max int) *FieldValidator {
	if len(fv.value) > max {
		fv.parent.add_error(fv.field, fmt.Sprintf("%s não pode exceder %d caracteres", fv.field, max))
	}
	return fv
}

func (fv *FieldValidator) email() *FieldValidator {
	if fv.value != "" && !validator_email(fv.value) {
		fv.parent.add_error(fv.field, fv.field+" deve ser um e-mail válido")
	}
	return fv
}

func (fv *FieldValidator) cpf() *FieldValidator {
	if fv.value != "" && !validator_cpf(fv.value) {
		fv.parent.add_error(fv.field, fv.field+" deve ser um CPF válido")
	}
	return fv
}

func (fv *FieldValidator) cnpj() *FieldValidator {
	if fv.value != "" && !validator_cnpj(fv.value) {
		fv.parent.add_error(fv.field, fv.field+" deve ser um CNPJ válido")
	}
	return fv
}

func (fv *FieldValidator) uuid() *FieldValidator {
	if fv.value != "" && !validator_uuid(fv.value) {
		fv.parent.add_error(fv.field, fv.field+" deve ser um UUID válido")
	}
	return fv
}

func (fv *FieldValidator) regex(pattern string) *FieldValidator {
	if fv.value != "" {
		re, err := regexp.Compile(pattern)
		if err != nil || !re.MatchString(fv.value) {
			fv.parent.add_error(fv.field, fv.field+" tem formato inválido")
		}
	}
	return fv
}
// ---------------------------------------------`;

export const validatorModule: NativeModule = {
  path: "std/validator",

  types: [
    {
      name: "ValidationError",
      properties: [
        { name: "field", typeAnnotation: { kind: "NamedTypeNode", name: "String" } },
        { name: "message", typeAnnotation: { kind: "NamedTypeNode", name: "String" } },
      ],
      goPointer: true,
    },
    {
      name: "FieldValidator",
      goPointer: true,
      methods: [
        { name: "required", arity: 0, returns: { kind: "Struct", name: "FieldValidator", genericArgs: [] } },
        { name: "min_len", arity: 1, returns: { kind: "Struct", name: "FieldValidator", genericArgs: [] } },
        { name: "max_len", arity: 1, returns: { kind: "Struct", name: "FieldValidator", genericArgs: [] } },
        { name: "email", arity: 0, returns: { kind: "Struct", name: "FieldValidator", genericArgs: [] } },
        { name: "cpf", arity: 0, returns: { kind: "Struct", name: "FieldValidator", genericArgs: [] } },
        { name: "cnpj", arity: 0, returns: { kind: "Struct", name: "FieldValidator", genericArgs: [] } },
        { name: "uuid", arity: 0, returns: { kind: "Struct", name: "FieldValidator", genericArgs: [] } },
        { name: "regex", arity: 1, returns: { kind: "Struct", name: "FieldValidator", genericArgs: [] } },
      ],
    },
    {
      name: "Validator",
      goPointer: true,
      methods: [
        { name: "field", arity: 2, returns: { kind: "Struct", name: "FieldValidator", genericArgs: [] } },
        { name: "add_error", arity: 2, returns: { kind: "Void" } },
        { name: "is_valid", arity: 0, returns: { kind: "Bool" } },
        { name: "errors", arity: 0, returns: { kind: "Array", elementType: { kind: "Struct", name: "ValidationError", genericArgs: [] } } },
        {
          name: "result",
          arity: 0,
          returns: {
            kind: "Enum",
            name: "Result",
            genericArgs: [
              { kind: "Void" },
              { kind: "Array", elementType: { kind: "Struct", name: "ValidationError", genericArgs: [] } },
            ],
          },
        },
      ],
    },
    {
      name: "validator",
      statics: [
        { name: "new", arity: 0, returns: { kind: "Struct", name: "Validator", genericArgs: [] } },
        { name: "cpf", arity: 1, returns: { kind: "Bool" } },
        { name: "cnpj", arity: 1, returns: { kind: "Bool" } },
        { name: "email", arity: 1, returns: { kind: "Bool" } },
        { name: "uuid", arity: 1, returns: { kind: "Bool" } },
      ],
      methods: [],
    },
  ],

  usesBuiltins: ["Result", "Option"],

  runtimeBinding: () => ({
    ValidationError: {
      kind: "StructDeclaration",
      name: "ValidationError",
      properties: [
        { name: "field", typeAnnotation: { kind: "NamedTypeNode", name: "String" } },
        { name: "message", typeAnnotation: { kind: "NamedTypeNode", name: "String" } },
      ],
    },
    FieldValidator: {
      [NATIVE_TAG]: "FieldValidator",
    },
    Validator: {
      [NATIVE_TAG]: "Validator",
    },
    validator: {
      [NATIVE_TAG]: "validator",
      new: () => new FlexValidator(),
      cpf: (c: string) => validateCpf(c),
      cnpj: (c: string) => validateCnpj(c),
      email: (e: string) => validateEmail(e),
      uuid: (u: string) => validateUuid(u),
    },
  }),

  goCodegen: {
    imports: ["fmt", "regexp", "strings"],
    boilerplate: GO_BOILERPLATE,
  },
};
