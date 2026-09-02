import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/localdb/engine';
import GraphCanvas from '@/components/GraphCanvas';

export const metadata: Metadata = {
  title: 'GastroGraph',
  description: 'Discover intelligent ingredient substitutes powered by Graph Neural Networks and chemical flavor science.',
};

const FEATURES = [
  {
    icon: '🕸️',
    title: 'Knowledge Graph',
    desc: 'Ingredients and molecular compounds modelled as a rich graph with TF-IDF weighted edges, capturing both chemical composition and culinary co-occurrence.',
    color: 'var(--accent)',
  },
  {
    icon: '🧠',
    title: 'GraphSAGE Embeddings',
    desc: 'A Graph Neural Network learns 64-dimensional embeddings per node, encoding flavor chemistry and culinary context simultaneously.',
    color: '#7c5cfc',
  },
  {
    icon: '🔄',
    title: 'Smart Substitutes',
    desc: 'Cosine similarity over GNN embeddings powers three substitute types: Functional Substitutes, Aromatic Pairings, and Complementary pairings.',
    color: '#f59e0b',
  },
  {
    icon: '🎯',
    title: 'Context-Aware Reranking',
    desc: 'Supply a recipe name or ingredient list to trigger context-aware reranking: final = α × GastroGraph score + β × recipe co-occurrence fit (α=0.60, β=0.40).',
    color: '#34d399',
  },
];

async function getStats() {
  try {
    const [ingr, mols, edges] = await Promise.all([
      db.from('nodes').select('id', { count: 'exact', head: true }).eq('type', 'ingredient'),
      db.from('nodes').select('id', { count: 'exact', head: true }).eq('type', 'molecule'),
      db.from('edges').select('id', { count: 'exact', head: true }),
    ]);
    return {
      ingredients: ingr.count ?? 6653,
      molecules: mols.count ?? 1645,
      edges: edges.count ?? 147179,
      categories: 35,
    };
  } catch {
    return { ingredients: 6653, molecules: 1645, edges: 147179, categories: 35 };
  }
}

export default async function HomePage() {
  const stats = await getStats();

  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <section style={{
        position: 'relative',
        minHeight: '92vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,212,170,0.08) 0%, transparent 70%)',
      }}>
        <GraphCanvas />

        {/* Gradient overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse 60% 80% at 50% 100%, var(--bg-base) 0%, transparent 60%)',
          pointerEvents: 'none',
        }} />

        <div className="container" style={{ position: 'relative', zIndex: 10, textAlign: 'center' }}>
          {/* Eyebrow */}
          <div className="badge badge-green anim-fade-up" style={{ marginBottom: 24, display: 'inline-flex' }}>
            ✦ GraphSAGE GNN · Context-Aware Reranking
          </div>

          <h1 className="anim-fade-up" style={{
            fontSize: 'clamp(3rem, 7vw, 6rem)',
            fontWeight: 900,
            letterSpacing: '-0.04em',
            lineHeight: 1.05,
            marginBottom: 24,
            animationDelay: '0.1s',
          }}>
            Gastro<span className="glow-text">Graph</span>
          </h1>

          <p className="anim-fade-up" style={{
            fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
            color: 'var(--text-secondary)',
            maxWidth: 560,
            margin: '0 auto 40px',
            lineHeight: 1.7,
            animationDelay: '0.2s',
          }}>
            Discover intelligent ingredient substitutes by exploring the intersection of
            chemical composition, culinary context, and graph neural networks.
          </p>

          <div className="anim-fade-up" style={{
            display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap',
            animationDelay: '0.3s',
          }}>
            <Link href="/finder" className="btn-primary">
              🔍 Find Substitutes
            </Link>
            <Link href="/context" className="btn-primary" style={{
              background: 'linear-gradient(135deg, rgba(124,92,252,0.9), rgba(0,212,170,0.9))',
              boxShadow: '0 0 20px rgba(124,92,252,0.3)',
            }}>
              🎯 Context Reranker
            </Link>
            <Link href="/ingredient-explorer" className="btn-ghost">
              🌐 Explore Graph
            </Link>
          </div>

          {/* Stats */}
          <div className="anim-fade-up" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 1,
            marginTop: 80,
            background: 'var(--border)',
            borderRadius: 20,
            overflow: 'hidden',
            border: '1px solid var(--border)',
            animationDelay: '0.4s',
          }}>
            {[
              { value: stats.ingredients.toLocaleString(), label: 'Ingredients' },
              { value: stats.molecules.toLocaleString(), label: 'Molecules' },
              { value: stats.edges.toLocaleString(), label: 'Graph Edges' },
              { value: stats.categories.toLocaleString(), label: 'Categories' },
            ].map((s) => (
              <div key={s.label} className="stat-widget" style={{ background: 'var(--bg-card)' }}>
                <div className="value">{s.value}</div>
                <div className="label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature Cards ─────────────────────────────────────────────────────── */}
      <section className="section" style={{ background: 'var(--bg-surface)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', marginBottom: 16 }}>
              How it <span className="glow-text">works</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 16, maxWidth: 500, margin: '0 auto' }}>
              A three-layer pipeline combining food chemistry, graph theory, and deep learning
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
            {FEATURES.map((f, i) => (
              <div key={i} className="card" style={{ position: 'relative', overflow: 'hidden' }}>
                {/* Background glow */}
                <div style={{
                  position: 'absolute', top: -20, right: -20,
                  width: 100, height: 100,
                  background: `radial-gradient(circle, ${f.color}22, transparent 70%)`,
                  pointerEvents: 'none',
                }} />
                <div style={{ fontSize: 36, marginBottom: 16 }}>{f.icon}</div>
                <h3 style={{ fontSize: 18, marginBottom: 12, color: f.color }}>{f.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pipeline visual ───────────────────────────────────────────────────── */}
      <section className="section">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', marginBottom: 16 }}>
              The <span className="glow-text">Pipeline</span>
            </h2>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 0,
            position: 'relative',
          }}>
            {[
              { step: '01', title: 'Build Graph', desc: 'Load ingredient + molecule CSVs, construct NetworkX graph with TF-IDF edge weights', icon: '📊' },
              { step: '02', title: 'Train GNN', desc: 'GraphSAGE learns 64-dim embeddings via link-prediction over 100 epochs', icon: '🧬' },
              { step: '03', title: 'Score Substitutes', desc: 'Cosine similarity + molecular overlap + aromatic context → ranked results', icon: '⚗️' },
              { step: '04', title: 'Context Rerank', desc: 'Provide a recipe name or ingredient list — substitutes reranked by recipe co-occurrence fit (α=0.60, β=0.40)', icon: '🎯' },
            ].map((s, i) => (
              <div key={i} style={{
                padding: '32px 24px',
                borderTop: '1px solid var(--border)',
                borderLeft: i > 0 ? '1px solid var(--border)' : 'none',
                position: 'relative',
                background: i % 2 ? 'var(--bg-surface)' : 'transparent',
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', marginBottom: 12 }}>
                  STEP {s.step}
                </div>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{s.icon}</div>
                <h3 style={{ fontSize: 17, marginBottom: 10 }}>{s.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.7 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ────────────────────────────────────────────────────────── */}
      <section style={{ padding: '60px 0', background: 'var(--bg-surface)' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(0,212,170,0.08), rgba(124,92,252,0.08))',
            border: '1px solid var(--border)',
            borderRadius: 24,
            padding: '60px 40px',
          }}>
            <h2 style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.4rem)', marginBottom: 16 }}>
              Ready to explore ingredient space?
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 16, marginBottom: 32 }}>
              Search from {stats.ingredients.toLocaleString()} ingredients and discover functional substitutes, aromatic pairings, and complementary results
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/finder" className="btn-primary" style={{ fontSize: 16, padding: '14px 28px' }}>
                🚀 Launch Substitute Finder
              </Link>
              <Link href="/context" className="btn-ghost" style={{
                fontSize: 16, padding: '14px 28px',
                borderColor: 'rgba(0,212,170,0.5)', color: 'var(--accent)',
              }}>
                🎯 Try Context Reranker
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
