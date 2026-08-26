import { describe, test, expect } from 'vitest';
import { BlueprintContract, UnknownField } from './contract';
import { validate } from './validate';

const CONTRACT = {
  version: '1.0',
  root: {
    nodeId: 'checkout', type: 'form', props: {}, children: [
      { nodeId: 'email', type: 'field', props: { name: 'email', label: 'Email', type: 'email', required: true } },
      { nodeId: 'country', type: 'select', props: { name: 'country', label: 'Country', options: { source: '$data.countries', prepend: [{ value: '', label: 'All' }] } } },
      { nodeId: 'pay', type: 'submit', props: { label: 'Pay' } },
    ],
  },
};

describe('validate (structural + graph, eval-free)', () => {
  test('accepts a valid contract', () => {
    expect(validate(CONTRACT).ok).toBe(true);
  });
  test('rejects an unknown atom type (structural / JSON Schema)', () => {
    expect(validate({ version: '1.0', root: { type: 'wormhole', props: {} } }).ok).toBe(false);
  });
  test('rejects a duplicate nodeId (graph check)', () => {
    const r = validate({ version: '1.0', root: { nodeId: 'x', type: 'stack', props: {}, children: [{ nodeId: 'x', type: 'divider', props: {} }] } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'DUPLICATE_NODE_ID')).toBe(true);
  });
  test('rejects a cyclic visibility dependency (graph check)', () => {
    const r = validate({ version: '1.0', root: { nodeId: 'f', type: 'form', props: {}, children: [
      { nodeId: 'a', type: 'field', props: { name: 'a' }, visibility: { field: '$form.b', eq: '1' } },
      { nodeId: 'b', type: 'field', props: { name: 'b' }, visibility: { field: '$form.a', eq: '1' } },
    ] } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'CYCLIC_VISIBILITY')).toBe(true);
  });
});

describe('operations (load → resolve/set → validate → toContract)', () => {
  test('sources lists the $data references', () => {
    expect(BlueprintContract.parse(CONTRACT).sources()).toEqual(['$data.countries']);
  });

  test('resolve injects the list, merging prepend/append', () => {
    const c = BlueprintContract.parse(CONTRACT);
    c.resolve('$data.countries', [{ value: 'IT', label: 'Italy' }]);
    const opts = c.node('country')!.props!.options as unknown[];
    expect(opts).toEqual([{ value: '', label: 'All' }, { value: 'IT', label: 'Italy' }]);
  });

  test('resolveAll resolves every source via a resolver', async () => {
    const c = BlueprintContract.parse(CONTRACT);
    await c.resolveAll((src) => (src === '$data.countries' ? [{ value: 'FR', label: 'France' }] : []));
    const opts = c.node('country')!.props!.options as unknown[];
    expect(opts).toContainEqual({ value: 'FR', label: 'France' });
  });

  test('set writes a field defaultValue; unknown field throws with the available list', () => {
    const c = BlueprintContract.parse(CONTRACT);
    c.set('email', 'user@x.com');
    expect(c.node('email')!.props!.defaultValue).toBe('user@x.com');
    expect(() => c.set('nope', 1)).toThrow(UnknownField);
  });

  test('does not mutate the source object', () => {
    const src = structuredClone(CONTRACT);
    const c = BlueprintContract.parse(src);
    c.set('email', 'x@y.com').resolve('$data.countries', [{ value: 'IT', label: 'Italy' }]);
    // The original is untouched.
    expect((src.root.children[0].props as Record<string, unknown>).defaultValue).toBeUndefined();
    expect((src.root.children[1].props.options as { source: string }).source).toBe('$data.countries');
  });

  test('toContract validates then returns the filled contract', () => {
    const c = BlueprintContract.parse(CONTRACT)
      .resolve('$data.countries', [{ value: 'IT', label: 'Italy' }])
      .set('email', 'a@b.com');
    const out = c.toContract();
    expect(out.root!.nodeId).toBe('checkout');
    // country options are now concrete, email carries its default.
    expect(Array.isArray((c.node('country')!.props!.options))).toBe(true);
    expect(c.node('email')!.props!.defaultValue).toBe('a@b.com');
  });

  test('toContract throws when a manipulation left the contract invalid', () => {
    const c = BlueprintContract.parse({ version: '1.0', root: { nodeId: 'r', type: 'form', props: {}, children: [
      { nodeId: 'dup', type: 'field', props: { name: 'a' } },
    ] } });
    // Force a duplicate nodeId via the raw handle, then expect toContract to reject.
    (c.toJSON().root!.children![0]).nodeId = 'r';
    expect(() => c.toContract()).toThrow(/invalid/i);
  });
});
