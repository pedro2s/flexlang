import type { NativeModule } from "./types";
import { httpModule } from "./http";
import { postgresModule } from "./postgres";
import { logModule } from "./log";
import { decimalModule } from "./decimal";
import { envModule } from "./env";
import { timeModule } from "./time";
import { cryptoModule } from "./crypto";
import { dotenvModule } from "./dotenv";
import { hexModule } from "./hex";
import { base64Module } from "./base64";
import { jsonModule } from "./json";
import { pathModule } from "./path";
import { fsModule } from "./fs";
import { jwtModule } from "./jwt";
import { redisModule } from "./redis";
import { validatorModule } from "./validator";
import { resilienceModule } from "./resilience";

export class ModuleRegistry {
  private modules = new Map<string, NativeModule>();

  register(mod: NativeModule): void {
    this.modules.set(mod.path, mod);
  }

  get(path: string): NativeModule | undefined {
    return this.modules.get(path);
  }
}

/**
 * Registro dos módulos nativos da linguagem. Módulos de teste podem ser
 * registrados de fora (ver `tests/runner.ts`), o que é justamente a prova de
 * que checker/interpretador/transpiler não conhecem nenhum módulo por nome.
 */
export const registry = new ModuleRegistry();

registry.register(httpModule);
registry.register(postgresModule);
registry.register(logModule);
registry.register(decimalModule);
registry.register(envModule);
registry.register(timeModule);
registry.register(cryptoModule);
registry.register(dotenvModule);
registry.register(hexModule);
registry.register(base64Module);
registry.register(jsonModule);
registry.register(pathModule);
registry.register(fsModule);
registry.register(jwtModule);
registry.register(redisModule);
registry.register(validatorModule);
registry.register(resilienceModule);

