// Supabase-style query builder backed by the local JSON tables in data/db/.
// The builder only records a QuerySpec; an executor (server: engine.ts, browser: /api/db) runs it.

export type TableName = 'nodes' | 'edges' | 'substitutes';
export const TABLES: TableName[] = ['nodes', 'edges', 'substitutes'];

export type Filter =
  | { op: 'eq'; col: string; val: string | number }
  | { op: 'in'; col: string; val: (string | number)[] }
  | { op: 'ilike'; col: string; val: string }
  | { op: 'or'; expr: string };

export interface QuerySpec {
  table: TableName;
  columns: string;
  filters: Filter[];
  order?: { col: string; ascending: boolean };
  limit?: number;
  count?: boolean;
  head?: boolean;
}

export interface QueryResult<T = any> {
  data: T[] | null;
  count: number | null;
  error: { message: string } | null;
}

export type Executor = (spec: QuerySpec) => Promise<QueryResult>;

export class QueryBuilder<T = any> implements PromiseLike<QueryResult<T>> {
  private spec: QuerySpec;

  constructor(table: TableName, private exec: Executor) {
    this.spec = { table, columns: '*', filters: [] };
  }

  select(columns = '*', opts?: { count?: 'exact'; head?: boolean }) {
    this.spec.columns = columns;
    if (opts?.count) this.spec.count = true;
    if (opts?.head) this.spec.head = true;
    return this;
  }
  eq(col: string, val: string | number) { this.spec.filters.push({ op: 'eq', col, val }); return this; }
  in(col: string, val: readonly (string | number)[]) { this.spec.filters.push({ op: 'in', col, val: [...val] }); return this; }
  ilike(col: string, val: string) { this.spec.filters.push({ op: 'ilike', col, val }); return this; }
  or(expr: string) { this.spec.filters.push({ op: 'or', expr }); return this; }
  order(col: string, opts?: { ascending?: boolean }) { this.spec.order = { col, ascending: opts?.ascending ?? true }; return this; }
  limit(n: number) { this.spec.limit = n; return this; }

  then<R1 = QueryResult<T>, R2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.exec(this.spec).then(onfulfilled, onrejected);
  }
}

export function createLocalClient(exec: Executor) {
  return {
    from<T = any>(table: TableName) {
      return new QueryBuilder<T>(table, exec);
    },
  };
}
