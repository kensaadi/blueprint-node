/**
 * The two graph-level checks that JSON Schema cannot express — ported 1:1 from
 * blueprint-core's validator so every SDK reaches the SAME verdict as the
 * Builder. Pure code, no eval (PCI/CSP-safe).
 */
import type { BlueprintNode, VisibilityRule } from './types';

export type GraphError = { path: string; message: string; code: string };

/** Extract the bare `$form.<field>` names a visibility rule depends on. */
function collectFieldRefs(rule: VisibilityRule, into = new Set<string>()): Set<string> {
  if ('and' in rule) { rule.and.forEach((r) => collectFieldRefs(r, into)); return into; }
  if ('or' in rule) { rule.or.forEach((r) => collectFieldRefs(r, into)); return into; }
  if ('not' in rule) { collectFieldRefs(rule.not, into); return into; }
  if ('rule' in rule) return into;
  if ('field' in rule && typeof rule.field === 'string' && rule.field.startsWith('$form.')) {
    into.add(rule.field.slice('$form.'.length));
  }
  return into;
}

/** 1. Every `nodeId` must be unique across the whole contract. */
export function checkDuplicateNodeIds(root: BlueprintNode): GraphError[] {
  const errors: GraphError[] = [];
  const seen = new Map<string, string>();
  const walk = (node: BlueprintNode, prefix: string) => {
    if (node.nodeId) {
      const first = seen.get(node.nodeId);
      if (first) {
        errors.push({
          path: `${prefix}/nodeId`,
          code: 'DUPLICATE_NODE_ID',
          message: `Duplicate nodeId "${node.nodeId}" — already used at ${first}. nodeId must be unique across the contract.`,
        });
      } else {
        seen.set(node.nodeId, `${prefix}/nodeId`);
      }
    }
    node.children?.forEach((c, i) => walk(c, `${prefix}/children/${i}`));
  };
  walk(root, '/root');
  return errors;
}

type VisibilityNode = { fieldName?: string; dependsOn: string[]; path: string };

/** 2. No cyclic `$form` visibility dependency (predicates that never stabilize). */
export function checkVisibilityCycles(root: BlueprintNode): GraphError[] {
  const graph: VisibilityNode[] = [];
  const collect = (node: BlueprintNode, prefix: string) => {
    if (node.visibility && typeof node.visibility !== 'boolean') {
      const fieldName = typeof node.props?.name === 'string' ? node.props.name : undefined;
      const deps = [...collectFieldRefs(node.visibility as VisibilityRule)];
      graph.push({ fieldName, dependsOn: deps, path: `${prefix}/visibility` });
    }
    node.children?.forEach((c, i) => collect(c, `${prefix}/children/${i}`));
  };
  collect(root, '/root');

  const adj = new Map<string, { deps: string[]; entry: VisibilityNode }>();
  for (const n of graph) if (n.fieldName) adj.set(n.fieldName, { deps: n.dependsOn, entry: n });

  const issues: GraphError[] = [];
  const seenCycles = new Set<string>();
  const dfs = (start: string, stack: string[], visited: Set<string>) => {
    visited.add(start);
    stack.push(start);
    const node = adj.get(start);
    if (!node) { stack.pop(); visited.delete(start); return; }
    for (const dep of node.deps) {
      if (stack.includes(dep)) {
        const ring = [...stack.slice(stack.indexOf(dep)), dep];
        const key = [...ring].sort().join(' → ');
        if (seenCycles.has(key)) continue;
        seenCycles.add(key);
        issues.push({
          path: node.entry.path,
          code: 'CYCLIC_VISIBILITY',
          message: `Cyclic visibility dependency: ${ring.join(' → ')}. The predicates can never stabilize.`,
        });
      } else if (!visited.has(dep)) {
        dfs(dep, stack, visited);
      }
    }
    stack.pop();
    visited.delete(start);
  };
  for (const fieldName of adj.keys()) dfs(fieldName, [], new Set());
  return issues;
}
