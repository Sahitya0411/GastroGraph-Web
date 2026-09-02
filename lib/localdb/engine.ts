import fs from 'fs';
import path from 'path';
import { createLocalClient, TABLES, type Filter, type QueryResult, type QuerySpec, type TableName } from './query';

// Tables are exported from the original Supabase project into data/db/*.json as
// { columns: string[], rows: unknown[][] } and loaded once per server process.
const DB_DIR = path.join(process.cwd(), 'data', 'db');

// Columns that get a value -> rows index for fast eq / in lookups
const INDEXED: Record<TableName, string[]> = {
  nodes: ['id', 'type', 'name'],
  edges: ['source', 'target'],
  substitutes: ['ingredient_id'],
};

type Row = Record<string, any>;
interface Table { rows: Row[]; index: Map<string, Map<string, Row[]>> }

const cache = new Map<TableName, Table>();

function loadTable(name: TableName): Table {
  const hit = cache.get(name);
  if (hit) return hit;
  const raw = JSON.parse(fs.readFileSync(path.join(DB_DIR, `${name}.json`), 'utf8')) as { columns: string[]; rows: unknown[][] };
  const rows: Row[] = raw.rows.map(r => Object.fromEntries(raw.columns.map((c, i) => [c, r[i]])));
  const index = new Map<string, Map<string, Row[]>>();
  for (const col of INDEXED[name]) {
    const m = new Map<string, Row[]>();
    for (const row of rows) {
      const k = String(row[col]);
      const list = m.get(k);
      if (list) list.push(row); else m.set(k, [row]);
    }
    index.set(col, m);
  }
  const table = { rows, index };
  cache.set(name, table);
  return table;
}

function likeToRegex(pattern: string): RegExp {
  const esc = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.');
  return new RegExp(`^${esc}$`, 'i');
}

// Split on commas that are not inside parentheses
function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur) out.push(cur);
  return out.map(x => x.trim()).filter(Boolean);
}

// Minimal PostgREST logic-tree parser: and(...), or(...), col.eq.val, col.in.(a,b)
type Pred = (row: Row) => boolean;
function parseLogic(expr: string): Pred {
  const m = expr.match(/^(and|or)\(([\s\S]*)\)$/);
  if (m) {
    const parts = splitTop(m[2]).map(parseLogic);
    return m[1] === 'and' ? row => parts.every(p => p(row)) : row => parts.some(p => p(row));
  }
  const [col, op, ...rest] = expr.split('.');
  const val = rest.join('.');
  if (op === 'eq') return row => String(row[col]) === val;
  if (op === 'in') {
    const set = new Set(val.replace(/^\(|\)$/g, '').split(',').map(v => v.trim()));
    return row => set.has(String(row[col]));
  }
  throw new Error(`Unsupported filter "${expr}"`);
}

function toPred(f: Filter): Pred {
  switch (f.op) {
    case 'eq': return row => String(row[f.col]) === String(f.val);
    case 'in': { const set = new Set(f.val.map(String)); return row => set.has(String(row[f.col])); }
    case 'ilike': { const re = likeToRegex(f.val); return row => re.test(String(row[f.col] ?? '')); }
    case 'or': return parseLogic(`or(${f.expr})`);
  }
}

export function runQuery(spec: QuerySpec): QueryResult {
  try {
    if (!TABLES.includes(spec.table)) throw new Error(`Unknown table "${spec.table}"`);
    const table = loadTable(spec.table);

    // Narrow the scan with an index when an eq / in filter hits an indexed column
    let candidates: Row[] = table.rows;
    for (const f of spec.filters) {
      if ((f.op === 'eq' || f.op === 'in') && table.index.has(f.col)) {
        const idx = table.index.get(f.col)!;
        const keys = f.op === 'eq' ? [String(f.val)] : Array.from(new Set(f.val.map(String)));
        candidates = keys.flatMap(k => idx.get(k) ?? []);
        break;
      }
    }

    const preds = spec.filters.map(toPred);
    let rows = candidates.filter(r => preds.every(p => p(r)));

    if (spec.order) {
      const { col, ascending } = spec.order;
      rows = [...rows].sort((a, b) => {
        const x = a[col], y = b[col];
        const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
        return ascending ? c : -c;
      });
    } else if (candidates !== table.rows) {
      rows.sort((a, b) => a.id - b.id); // keep primary-key order like Postgres would
    }

    const count = spec.count ? rows.length : null;
    if (spec.head) return { data: null, count, error: null };
    if (spec.limit !== undefined) rows = rows.slice(0, spec.limit);

    const cols = spec.columns.split(',').map(c => c.trim()).filter(Boolean);
    const data = cols.includes('*') ? rows.map(r => ({ ...r })) : rows.map(r => Object.fromEntries(cols.map(c => [c, r[c]])));
    return { data, count, error: null };
  } catch (err) {
    return { data: null, count: null, error: { message: err instanceof Error ? err.message : String(err) } };
  }
}

/** Server-side client: same API as the browser client, runs queries in-process. */
export const db = createLocalClient(async spec => runQuery(spec));
