/**
 * Minimal structural types the SDK operates on. The full per-atom prop types
 * are generated from the #20 schema (`pnpm gen:types` → contract.generated.ts)
 * for consumers who author contracts; the operations here only need the generic
 * node tree.
 */

export type VisibilityValue = string | number | boolean | null;

export type VisibilityRule =
  | { field: string; eq?: VisibilityValue; neq?: VisibilityValue; in?: VisibilityValue[]; nin?: VisibilityValue[] }
  | { and: VisibilityRule[] }
  | { or: VisibilityRule[] }
  | { not: VisibilityRule }
  | { rule: string };

/** A dynamic (backend-bound) list — `options`/`items` referencing `$data.<key>`. */
export type BoundList = { source: string; sample?: unknown[]; prepend?: unknown[]; append?: unknown[] };

export interface BlueprintNode {
  nodeId?: string;
  type: string;
  props?: Record<string, unknown>;
  children?: BlueprintNode[];
  visibility?: boolean | VisibilityRule;
  access?: { resource: string; action: string; onUnauthorized?: 'hide' | 'disable' | 'readonly' };
  disabled?: boolean;
}

export interface Contract {
  version: string;
  root: BlueprintNode | null;
}
