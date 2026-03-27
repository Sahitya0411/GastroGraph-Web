'use client';

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import Link from 'next/link';
import { fmt } from '@/lib/supabase';
import type { Node, Substitute } from '@/lib/supabase';

const BADGE_MAP: Record<string, string> = {
  'Spice': 'badge-amber', 'Fruit': 'badge-green', 'Dairy': 'badge-blue',
  'Plant/Vegetable': 'badge-green', 'Meat/Animal Product': 'badge-purple',
  'Beverage Alcoholic': 'badge-purple', 'Seafood': 'badge-blue',
  'Cereal/Crop/Bean': 'badge-amber', 'Nut/Seed': 'badge-amber', 'Fungus': 'badge-green',
};
function badgeClass(cat: string | null) { return BADGE_MAP[cat ?? ''] ?? 'badge-blue'; }

// Derive fake radar metrics from molecule count + similarity scores
function buildRadarData(node: Node, subs: Array<Substitute & { substitute: Node }>) {
  const mol = Math.min((node.molecule_count ?? 0) / 20, 1);
  const avgSim = subs.length ? subs.reduce((a, b) => a + b.cos_sim, 0) / subs.length : 0;
  const funcSubs = subs.filter(s => s.sub_type === 'functional');
  const aromSubs = subs.filter(s => s.sub_type === 'aromatic');
  return [
    { subject: 'Chemical\nComplexity', A: Math.round(mol * 100) },
    { subject: 'Aroma\nProfile',       A: Math.round(aromSubs.length > 0 ? ((aromSubs[0]?.score ?? 5) / 10) * 100 : 50) },
    { subject: 'Substitutability',     A: Math.round(avgSim * 100) },
    { subject: 'Culinary\nVersatility',A: Math.round(funcSubs.length * 18) },
    { subject: 'Flavor\nIntensity',    A: Math.round(mol * 80 + 20) },
    { subject: 'Pairing\nCompat.',     A: Math.round(subs.filter(s => s.sub_type === 'complement').length * 14) },
  ].map(d => ({ ...d, A: Math.min(d.A, 100) }));
}

interface Props {
  node: Node;
  molecules: Node[];
  totalMolecules: number;
  coIngredients: Node[];
  substitutes: Array<Substitute & { substitute: Node }>;
}

export default function IngredientProfileClient({ node, molecules, totalMolecules, coIngredients, substitutes }: Props) {
  const radarData = buildRadarData(node, substitutes);
  const funcSubs = substitutes.filter(s => s.sub_type === 'functional').slice(0, 3);
  const aromSubs = substitutes.filter(s => s.sub_type === 'aromatic').slice(0, 3);

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(0,212,170,0.06) 0%, transparent 100%)',
        borderBottom: '1px solid var(--border)',
        padding: '48px 0 40px',
      }}>
        <div className="container">
          <Link href="/finder" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 13, textDecoration: 'none', marginBottom: 24 }}>
            ← Back to Finder
          </Link>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
            <div style={{
              width: 72, height: 72, borderRadius: 16,
              background: 'linear-gradient(135deg, rgba(0,212,170,0.2), rgba(124,92,252,0.2))',
              border: '1px solid rgba(0,212,170,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32, flexShrink: 0,
            }}>🌿</div>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)', marginBottom: 12 }}>{fmt(node.name)}</h1>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className={`badge ${badgeClass(node.category)}`}>{node.category ?? 'Unknown'}</span>
                <span className="badge badge-green">🔬 {node.molecule_count ?? molecules.length} molecules</span>
              </div>
            </div>
            <Link href={`/finder?q=${encodeURIComponent(node.name)}`} className="btn-primary">
              🔍 Find Substitutes
            </Link>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="container" style={{ padding: '48px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>

          {/* Radar chart */}
          <div className="card" style={{ minHeight: 380 }}>
            <h2 style={{ fontSize: 16, marginBottom: 4 }}>Flavor Profile</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 20 }}>Derived from GNN embedding analysis</p>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData} margin={{ top: 20, right: 50, bottom: 20, left: 50 }}>
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <Radar
                  name={fmt(node.name)} dataKey="A"
                  stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.15}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Metadata */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <h2 style={{ fontSize: 16, marginBottom: 16 }}>Ingredient Info</h2>
              {[
                { label: 'Name', value: fmt(node.name) },
                { label: 'Type', value: 'Ingredient' },
                { label: 'Category', value: node.category ?? '-' },
                { label: 'Molecule Count', value: (node.molecule_count ?? molecules.length).toString() },
                { label: 'Node ID', value: node.id },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13, gap: 12 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500, textAlign: 'right' }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Quick substitute preview */}
            {funcSubs.length > 0 && (
              <div className="card">
                <h2 style={{ fontSize: 16, marginBottom: 16 }}>Top Functional Substitutes</h2>
                {funcSubs.map((s, i) => (
                  <Link key={i} href={`/ingredient/${encodeURIComponent(s.substitute.name)}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'inherit')}
                    >
                      <span style={{ fontSize: 14 }}>{fmt(s.substitute.name)}</span>
                      <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700 }}>{(s.cos_sim * 100).toFixed(0)}%</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Molecules */}
          <div className="card">
            <h2 style={{ fontSize: 16, marginBottom: 4 }}>Top 20 Most Shared Molecules</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 16 }}>
              Top {molecules.length} compounds most widely shared across ingredients
              {totalMolecules > molecules.length && (
                <span style={{ color: 'var(--text-muted)' }}> · out of {totalMolecules} total in this ingredient</span>
              )}
            </p>
            {molecules.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No molecule data in graph</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {molecules.map((m, i) => (
                  <span key={i} className="badge badge-purple" style={{ fontSize: 11 }}>
                    🔬 {fmt(m.name)}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Co-occurring ingredients */}
          <div className="card">
            <h2 style={{ fontSize: 16, marginBottom: 4 }}>Co-occurring Ingredients</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 16 }}>Frequently used together</p>
            {coIngredients.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No co-occurrence data loaded</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {coIngredients.map((c, i) => (
                  <Link key={i} href={`/ingredient/${encodeURIComponent(c.name)}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                      borderRadius: 8, transition: 'background 0.15s', cursor: 'pointer',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ color: 'var(--accent)', fontSize: 12 }}>🌿</span>
                      <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{fmt(c.name)}</span>
                      {c.category && (
                        <span className={`badge ${badgeClass(c.category)}`} style={{ marginLeft: 'auto', fontSize: 10 }}>
                          {c.category}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
