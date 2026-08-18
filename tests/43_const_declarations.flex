// Teste RFC-024: Declarações const de Nível de Módulo

const MAX_RETRIES = 3;
const TAX_RATE = 0.15;
const BANK_NAME = "FlexBank S.A.";
const IS_PROD = true;
const MAX_LIMIT: Int = 10000;

func test_consts() {
    print("--- Teste Constantes ---");
    print("Max retries: ${MAX_RETRIES}");
    print("Tax rate: ${TAX_RATE}");
    print("Bank: ${BANK_NAME}");
    print("Prod: ${IS_PROD}");
    print("Limit: ${MAX_LIMIT}");

    let total = MAX_RETRIES * 10;
    print("Total: ${total}");
}

func main() {
    test_consts();
}

main();
