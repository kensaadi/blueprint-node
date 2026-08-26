# Compatibility

`@dashforge/blueprint-node` targets the **Blueprint contract grammar**, not a
specific runtime. Compatibility is expressed against the frozen contract
version, not the frontend package versions.

| SDK version | Contract | Schema (vendored) |
|---|---|---|
| 0.0.1 | **contract-v1** | `schema/contract-v1.schema.json` (draft 2020-12) |

## How it stays in sync

The schema is the single source of truth (generated from blueprint-core's zod
schemas via `gen:spec`). This SDK **vendors a copy**; when the contract grammar
changes, the copy is refreshed and a new SDK version ships. Additive grammar
changes (new atoms, new props) are backward-compatible: an older SDK validates
an older contract fine, and an unknown atom in a newer contract is reported as
an unknown type rather than crashing.

## Eval-free guarantee

Validation never uses `eval` / `new Function` / runtime code generation, so the
SDK is safe under strict CSP and PCI / no-eval policies. This holds for every
Dashforge SDK (Node here; Go and Java use their languages' interpreting
JSON-Schema validators).
