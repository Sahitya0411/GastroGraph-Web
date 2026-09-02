import { db } from '@/lib/localdb/engine';
import type { Node, Substitute } from '@/lib/db';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import IngredientProfileClient from './IngredientProfileClient';

interface Props { params: Promise<{ name: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params;
  const decoded = decodeURIComponent(name).replace(/_/g, ' ');
  return { title: `${decoded.replace(/\b\w/g, c => c.toUpperCase())} - GastroGraph` };
}

export default async function IngredientProfilePage({ params }: Props) {
  const { name } = await params;
  const rawName = decodeURIComponent(name).toLowerCase();

  // Fetch the ingredient node
  const { data: nodes } = await db
    .from('nodes')
    .select('*')
    .eq('type', 'ingredient')
    .ilike('name', rawName.replace(/ /g, '_'))
    .limit(1);

  if (!nodes || nodes.length === 0) notFound();
  const node = nodes[0] as Node;

  // Fetch connected molecules (CONTAINS edges)
  const { data: molEdges } = await db
    .from('edges')
    .select('target')
    .eq('source', node.id)
    .eq('edge_type', 'CONTAINS')
    .limit(200);

  // Fetch co-occurring ingredients
  const { data: coEdgesA } = await db.from('edges').select('target').eq('source', node.id).eq('edge_type', 'CO_OCCURS').limit(10);
  const { data: coEdgesB } = await db.from('edges').select('source').eq('target', node.id).eq('edge_type', 'CO_OCCURS').limit(10);

  // Gather molecule node IDs
  const molIds = (molEdges ?? []).map((e: { target: string }) => e.target);
  const totalMolecules = molIds.length;

  const coIds  = [
    ...(coEdgesA ?? []).map((e: { target: string }) => e.target),
    ...(coEdgesB ?? []).map((e: { source: string }) => e.source),
  ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 12);

  // Rank molecules by how many ingredients share them (shared = high CONTAINS edge degree)
  // Fetch all CONTAINS edges where these molecules are the target to count sharing
  const top20MolIds: string[] = [];
  if (molIds.length > 0) {
    const CHUNK = 200;
    const shareCounts = new Map<string, number>();
    for (let i = 0; i < molIds.length; i += CHUNK) {
      const chunk = molIds.slice(i, i + CHUNK);
      const { data: shareEdges } = await db
        .from('edges').select('target').eq('edge_type', 'CONTAINS').in('target', chunk).limit(5000);
      for (const row of (shareEdges ?? []) as { target: string }[]) {
        shareCounts.set(row.target, (shareCounts.get(row.target) ?? 0) + 1);
      }
    }
    // Sort molIds by descending share count, take top 20
    const sorted = [...molIds].sort((a, b) => (shareCounts.get(b) ?? 0) - (shareCounts.get(a) ?? 0));
    top20MolIds.push(...sorted.slice(0, 20));
  }

  // Fetch molecule names for top 20 only
  const { data: molNodes } = top20MolIds.length
    ? await db.from('nodes').select('id, name, type, category').in('id', top20MolIds)
    : { data: [] };

  // Fetch co-ingredient names
  const { data: coNodes } = coIds.length
    ? await db.from('nodes').select('id, name, type, category').in('id', coIds)
    : { data: [] };

  // Fetch pre-computed substitutes (two-step: rows first, then node details)
  const { data: rawSubs } = await db
    .from('substitutes')
    .select('id, ingredient_id, substitute_id, sub_type, cos_sim, mol_pct, score, rank')
    .eq('ingredient_id', node.id)
    .order('rank')
    .limit(15);

  const subRows = rawSubs ?? [];
  let subs: Array<Substitute & { substitute: Node }> = [];

  if (subRows.length > 0) {
    const subIds = [...new Set(subRows.map((s: { substitute_id: string }) => s.substitute_id))];
    const { data: subNodeData } = await db
      .from('nodes')
      .select('*')
      .in('id', subIds);
    const subNodeMap = new Map<string, Node>((subNodeData ?? []).map((n: Node) => [n.id, n]));
    subs = subRows
      .map((s: Substitute) => ({ ...s, substitute: subNodeMap.get(s.substitute_id) }))
      .filter((s: Substitute & { substitute: Node | undefined }) => s.substitute !== undefined) as Array<Substitute & { substitute: Node }>;
  }

  return (
    <IngredientProfileClient
      node={node}
      molecules={(molNodes ?? []) as Node[]}
      totalMolecules={totalMolecules}
      coIngredients={(coNodes ?? []) as Node[]}
      substitutes={(subs ?? []) as Array<Substitute & { substitute: Node }>}
    />
  );
}
