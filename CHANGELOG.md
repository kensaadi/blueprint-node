# Changelog

All notable changes to `@dashforge/blueprint-node` are documented here.

## [0.0.1] - 2026-08-26

Initial scaffold.

### Added
- `BlueprintContract` — load / parse a contract, then `resolve` / `resolveAll`
  (dynamic `$data` list items), `set` (field initial value), `show` (static
  visibility), `validate`, `toContract` (validate + serialize), `toJSON`.
- `validate(contract)` — eval-free structural validation against the frozen
  `contract-v1` JSON Schema (draft 2020-12, via `@cfworker/json-schema`) plus
  the two graph checks (nodeId uniqueness, visibility cycles) ported 1:1 from
  the Builder's validator.
- Vendored `contract-v1` schema, re-exported as `./schema`.
