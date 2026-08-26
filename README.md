# @dashforge/blueprint-node

Server SDK for **Blueprint** contracts (Node / TypeScript). Load a published contract, fill its dynamic parts with your backend data, validate, and serve it to the client.

- **Agnostic** — validates against the frozen `contract-v1` JSON Schema, the same contract every SDK (Node, Go, Java) targets. No framework, no zod.
- **Eval-free** — the validator interprets the schema (no `new Function` / code generation), so it is safe under strict CSP and **PCI / no-eval** policies.
- **Same verdict as the Builder** — the structural JSON-Schema pass plus the two graph checks (nodeId uniqueness, visibility cycles) mirror the Builder exactly.
- **Self-contained** — the schema ships inside the package; one `npm install`, no peer setup.

## Install

```bash
npm install @dashforge/blueprint-node
```

## Use — load → fill → serve

```ts
import { BlueprintContract } from '@dashforge/blueprint-node';

app.get('/ui/checkout', async (req, res) => {
  // 1. fetch the published contract (authored in the Builder)
  const ui = await BlueprintContract.load('https://cdn.dashforge.io/apps/acme/checkout.js');

  // 2. fill the dynamic parts with backend data
  await ui.resolveAll((source) => api.list(source)); // resolve every $data.* binding
  ui.set('email', req.user.email);                    // seed a field's initial value
  ui.show('taxSection', req.user.country === 'IT');   // toggle a conditional block

  // 3. return a guaranteed-valid contract (toContract validates first)
  res.json(ui.toContract());
});
```

`set` addresses a field by its `name` and throws `UnknownField` (listing the available fields) if it does not exist — so a renamed/removed field in a republished template fails on your server, not in the client.

## API

| | |
|---|---|
| `BlueprintContract.load(url, init?)` | fetch + open a contract |
| `BlueprintContract.parse(string \| object)` | open an in-hand contract (isolated copy) |
| `.sources()` | every `$data.*` reference — what you must fetch |
| `.fields()` / `.node(nodeId)` | inspect |
| `.resolve(source, list)` / `.resolveAll(fn)` | inject dynamic list items (merges `prepend`/`append`) |
| `.set(name, value)` | set a field's initial value (`props.defaultValue`) |
| `.show(nodeId, visible)` | set a node's static visibility |
| `.validate()` | structural + graph checks; never throws |
| `.toContract()` | validate then return the filled contract (throws `InvalidContract` if invalid) |
| `.toJSON()` | serialize without validating (debug) |

Standalone `validate(contract)` is also exported.

## Contract version

This release targets **contract-v1** — see [COMPAT.md](./COMPAT.md). The schema is vendored at `schema/contract-v1.schema.json` and re-exported as `@dashforge/blueprint-node/schema`.

## License

MIT — the Dashforge SDKs are free and open source.
