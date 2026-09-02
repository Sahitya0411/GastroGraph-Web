import { createLocalClient, type QueryResult } from './localdb/query';

// Browser client for the local graph tables (data/db/*.json), queried through /api/db.
// Server components should import `db` from '@/lib/localdb/engine' instead.
export const db = createLocalClient(async spec => {
  try {
    const res = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(spec),
    });
    return (await res.json()) as QueryResult;
  } catch (err) {
    return { data: null, count: null, error: { message: err instanceof Error ? err.message : String(err) } };
  }
});

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface Node {
  id: string;
  name: string;
  type: 'ingredient' | 'molecule';
  category: string | null;
  group_name: string | null;
  molecule_count: number;
}

export interface Edge {
  id: number;
  source: string;
  target: string;
  edge_type: 'CO_OCCURS' | 'CONTAINS';
  weight: number;
}

export interface Substitute {
  id: number;
  ingredient_id: string;
  substitute_id: string;
  sub_type: 'functional' | 'aromatic' | 'complement';
  cos_sim: number;
  mol_pct: number;
  score: number;
  rank: number;
  // joined
  substitute?: Node;
}

export interface SubstituteResult {
  query: Node;
  functional: (Substitute & { substitute: Node })[];
  aromatic: (Substitute & { substitute: Node })[];
  complements: (Substitute & { substitute: Node })[];
}

// ─── Context-Aware Types ───────────────────────────────────────────────────────

/**
 * A candidate returned from the client-side context-aware reranker.
 * Mirrors the Python ContextAwareReranker output.
 *   final_score = 10 × (alpha × base_score + beta × fit_norm)
 *   alpha = 0.60  (GastroGraph functional score weight)
 *   beta  = 0.40  (recipe co-occurrence fit weight)
 */
export interface ContextAwareResult {
  substitute: Node;
  name: string;
  label: string | null;
  group: string | null;
  /** Raw GastroGraph functional score [0,1] */
  base_score: number;
  /** Avg co-occurrence weight with recipe context ingredients */
  recipe_fit: number;
  /** Fused final score [0,10] */
  final_score: number;
  /** Rank improvement vs baseline (positive = promoted) */
  rank_change: number;
  /** Recipe context ingredients that boosted this candidate */
  boosters: Array<{ name: string; weight: number }>;
  cos_sim: number;
  mol_pct: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

export function fmt(name: string) {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Normalise a raw ingredient string to underscore_snake_case for graph lookup. */
export function normaliseIngredient(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Rank ingredient names for autocomplete: exact match, then prefix, then word-prefix,
 * then substring; shorter names first within each tier. Spaces and underscores are equivalent.
 */
export function rankSuggestions(names: string[], query: string, limit = 8): string[] {
  const norm = (s: string) => s.toLowerCase().trim().replace(/[\s_]+/g, ' ');
  const q = norm(query);
  if (q.length < 2) return [];
  const scored: Array<[number, string]> = [];
  for (const name of names) {
    const n = norm(name);
    const pos = n.indexOf(q);
    if (pos < 0) continue;
    const tier = n === q ? 0 : pos === 0 ? 1 : n[pos - 1] === ' ' ? 2 : 3;
    scored.push([tier * 1000 + n.length, name]);
  }
  scored.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]));
  return scored.slice(0, limit).map(([, name]) => name);
}
