// Teste 22: Modulo nativo registrado de fora do core (RFC-003).
// "test/echo" nao e conhecido por checker, interpretador nem transpiler: quem o
// registra e o runner dos testes. Se este teste passa nos dois modos, a costura
// de modulos nativos esta funcionando de ponta a ponta.

import { Echo } from "test/echo";

let e = Echo.new("eco: ");
print(e.say("ola"));
print(e.say("de novo"));
