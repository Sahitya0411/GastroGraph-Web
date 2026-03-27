import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL     ?? 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

// ─── Helpers ───────────────────────────────────────────────────────────────────

export function fmt(name: string) {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
