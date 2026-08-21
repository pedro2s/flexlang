import { validator, ValidationError } from "std/validator";

func run_validation_suite() -> Result<Int, String> {
  // 1. Validações Primitivas
  let cpf_ok = validator.cpf("529.982.247-25");
  let cpf_fake = validator.cpf("111.111.111-11");
  let cnpj_ok = validator.cnpj("11.222.333/0001-81");
  let cnpj_fake = validator.cnpj("11.222.333/0001-82");
  let email_ok = validator.email("user@flexlang.dev");
  let email_fake = validator.email("invalid_email");
  let uuid_ok = validator.uuid("550e8400-e29b-41d4-a716-446655440000");
  let uuid_fake = validator.uuid("bad_uuid");

  print("cpf_ok: ${cpf_ok}");
  print("cpf_fake: ${cpf_fake}");
  print("cnpj_ok: ${cnpj_ok}");
  print("cnpj_fake: ${cnpj_fake}");
  print("email_ok: ${email_ok}");
  print("email_fake: ${email_fake}");
  print("uuid_ok: ${uuid_ok}");
  print("uuid_fake: ${uuid_fake}");

  // 2. Validador com Builder (DTO válido)
  let mut v_ok = validator.new();
  v_ok.field("account", "123456")
      .required()
      .min_len(4)
      .max_len(10);
  v_ok.field("pix", "user@flexlang.dev")
      .required()
      .email();

  match v_ok.result() {
    Result.Ok(_) { print("DTO OK"); },
    Result.Err(errs) { print("DTO FAIL"); }
  }

  // 3. Validador com Builder (DTO com Erros)
  let mut v_err = validator.new();
  v_err.field("account", "12")
       .required()
       .min_len(4);
  v_err.field("pix", "")
       .required();
  v_err.add_error("amount", "amount must be positive");

  match v_err.result() {
    Result.Ok(_) { print("UNEXPECTED PASS"); },
    Result.Err(errs) {
      print("ERRORS COUNT: ${errs.len()}");
      for err in errs {
        print("err: ${err.field} -> ${err.message}");
      }
    }
  }

  return Result.Ok(1);
}

match run_validation_suite() {
  Result.Ok(_) { print("SUITE COMPLETED"); },
  Result.Err(e) { print("ERROR: \${e}"); }
}
