import { NextRequest, NextResponse } from 'next/server';
import { runQuery } from '@/lib/localdb/engine';
import type { QuerySpec } from '@/lib/localdb/query';

// Read-only query endpoint used by client components (lib/db.ts).
export async function POST(request: NextRequest) {
  let spec: QuerySpec;
  try {
    spec = await request.json();
  } catch {
    return NextResponse.json({ data: null, count: null, error: { message: 'Invalid JSON body' } }, { status: 400 });
  }
  const result = runQuery(spec);
  return NextResponse.json(result, { status: result.error ? 400 : 200 });
}
