import { Validator } from '@cfworker/json-schema';
import schema from '../schema/contract-v1.schema.json';
import { checkDuplicateNodeIds, checkVisibilityCycles } from './graphChecks';
import type { Contract } from './types';

export type ValidationError = { path: string; message: string; code?: string };
export type ValidationResult = { ok: true } | { ok: false; errors: ValidationError[] };

/**
 * Eval-free structural validator against the frozen contract-v1 JSON Schema
 * (draft 2020-12). `@cfworker/json-schema` INTERPRETS the schema — no
 * `new Function` / code-gen — so it is safe under strict CSP and PCI/no-eval
 * policies. `shortCircuit: false` collects every error.
 */
const structural = new Validator(schema, '2020-12', false);

/**
 * Validate a contract exactly as the Builder does: the structural JSON-Schema
 * pass PLUS the two graph checks (nodeId uniqueness, visibility cycles) that
 * JSON Schema cannot express. Never throws — returns a Result.
 */
export function validate(contract: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  const res = structural.validate(contract);
  if (!res.valid) {
    for (const e of res.errors) {
      errors.push({ path: e.instanceLocation, message: e.error, code: e.keyword });
    }
  }

  if (isContract(contract) && contract.root) {
    for (const g of checkDuplicateNodeIds(contract.root)) errors.push(g);
    for (const g of checkVisibilityCycles(contract.root)) errors.push(g);
  }

  return errors.length ? { ok: false, errors } : { ok: true };
}

function isContract(v: unknown): v is Contract {
  return typeof v === 'object' && v !== null && 'root' in v;
}
