/** Evidence is data; it must never execute code or choose default rules. */
export interface RuleSource {
  readonly id: string;
  readonly kind: 'product-brief' | 'rulebook' | 'board' | 'card' | 'owner-clarification';
  readonly reference: string;
  readonly edition: string | null;
}

export type RuleKnowledge<T> =
  | { readonly status: 'unknown'; readonly value: null }
  | { readonly status: 'confirmed'; readonly value: T; readonly sources: readonly [RuleSource, ...RuleSource[]] };
