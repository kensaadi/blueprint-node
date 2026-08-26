import { validate, type ValidationResult } from './validate';
import type { BlueprintNode, BoundList, Contract } from './types';

/** Props keys that may carry a bound list (`$data.<key>`). */
const LIST_KEYS = ['options', 'items'] as const;

function isBound(v: unknown): v is BoundList {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    && typeof (v as BoundList).source === 'string';
}

/**
 * A loaded contract you can manipulate before serving it. Grammar-aware: it
 * fills the dynamic parts (resolve `$data` lists, seed field defaults, toggle
 * visibility) and guarantees a VALID contract out (`toContract` validates).
 *
 * It never mutates the source you loaded from — `parse`/`load` take an isolated
 * copy, so a cached/shared CDN document is safe.
 */
export class BlueprintContract {
  private constructor(private doc: Contract) {}

  /** Parse an in-hand contract (string or object) into an isolated handle. */
  static parse(input: string | object): BlueprintContract {
    const raw = typeof input === 'string' ? JSON.parse(input) : input;
    return new BlueprintContract(structuredClone(raw) as Contract);
  }

  /** Fetch a published contract (e.g. from a CDN) and open it. */
  static async load(url: string, init?: RequestInit): Promise<BlueprintContract> {
    const res = await fetch(url, init);
    if (!res.ok) throw new Error(`blueprint: failed to load contract (${res.status}) from ${url}`);
    return BlueprintContract.parse(await res.text());
  }

  // ── inspect ────────────────────────────────────────────────────────
  /** Every `$data.*` source referenced by a bound list — what you must fetch. */
  sources(): string[] {
    const out = new Set<string>();
    this.walk((n) => {
      for (const key of LIST_KEYS) {
        const v = n.props?.[key];
        if (isBound(v)) out.add(v.source);
      }
    });
    return [...out];
  }

  /** Every form field name in the contract. */
  fields(): string[] {
    const out = new Set<string>();
    this.walk((n) => {
      const name = n.props?.name;
      if (typeof name === 'string') out.add(name);
    });
    return [...out];
  }

  /** Locate a node by its nodeId. */
  node(nodeId: string): BlueprintNode | undefined {
    let found: BlueprintNode | undefined;
    this.walk((n) => { if (n.nodeId === nodeId) found = n; });
    return found;
  }

  // ── resolve dynamic items ──────────────────────────────────────────
  /**
   * Inject a resolved list wherever a bound list references `source`, merging
   * the binding's static `prepend`/`append` around it. This is the core job:
   * turning `{ source: "$data.countries" }` into a concrete array.
   */
  resolve(source: string, list: unknown[]): this {
    this.walk((n) => {
      if (!n.props) return;
      for (const key of LIST_KEYS) {
        const v = n.props[key];
        if (isBound(v) && v.source === source) {
          n.props[key] = [...(v.prepend ?? []), ...list, ...(v.append ?? [])];
        }
      }
    });
    return this;
  }

  /** Resolve EVERY `$data.*` source via the resolver (e.g. your DB/API calls). */
  async resolveAll(resolver: (source: string) => Promise<unknown[]> | unknown[]): Promise<this> {
    for (const src of this.sources()) this.resolve(src, await resolver(src));
    return this;
  }

  // ── fill field state ───────────────────────────────────────────────
  /**
   * Set a field's initial value — writes `props.defaultValue` on the input
   * whose `name` matches. This is a grammar operation (the value lives in the
   * contract), symmetric with `disabled`/`visibility`. Throws if no such field.
   */
  set(name: string, value: unknown): this {
    const node = this.findByName(name);
    if (!node) throw new UnknownField(name, this.fields());
    (node.props ??= {}).defaultValue = value;
    return this;
  }

  /** Toggle a node's static visibility by nodeId. Throws if no such node. */
  show(nodeId: string, visible: boolean): this {
    const node = this.node(nodeId);
    if (!node) throw new UnknownNode(nodeId);
    node.visibility = visible;
    return this;
  }

  // ── guarantee + output ─────────────────────────────────────────────
  /** Validate the current contract (structural + graph checks). Never throws. */
  validate(): ValidationResult {
    return validate(this.doc);
  }

  /** Serialize the filled contract, validating first — throws on invalid. */
  toContract(): Contract {
    const res = this.validate();
    if (!res.ok) throw new InvalidContract(res.errors);
    return this.doc;
  }

  /** Serialize WITHOUT validating — escape hatch for debugging. */
  toJSON(): Contract {
    return this.doc;
  }

  // ── internals ──────────────────────────────────────────────────────
  private walk(fn: (n: BlueprintNode) => void): void {
    const rec = (n: BlueprintNode) => { fn(n); n.children?.forEach(rec); };
    if (this.doc.root) rec(this.doc.root);
  }

  private findByName(name: string): BlueprintNode | undefined {
    let found: BlueprintNode | undefined;
    this.walk((n) => { if (n.props?.name === name) found = n; });
    return found;
  }
}

export class UnknownField extends Error {
  constructor(public readonly field: string, public readonly available: string[]) {
    super(`No field "${field}" in this contract. Available: ${available.join(', ') || '(none)'}`);
    this.name = 'UnknownField';
  }
}

export class UnknownNode extends Error {
  constructor(public readonly nodeId: string) {
    super(`No node with nodeId "${nodeId}" in this contract.`);
    this.name = 'UnknownNode';
  }
}

export class InvalidContract extends Error {
  constructor(public readonly errors: { path: string; message: string }[]) {
    super(`Contract is invalid:\n${errors.map((e) => `  ${e.path}: ${e.message}`).join('\n')}`);
    this.name = 'InvalidContract';
  }
}
