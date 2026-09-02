'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { db, fmt, rankSuggestions, type Node, type Substitute } from '@/lib/db';
import Link from 'next/link';

interface SubResult {
  query: Node;
  functional: Array<Substitute & { substitute: Node }>;
  aromatic: Array<Substitute & { substitute: Node }>;
  complements: Array<Substitute & { substitute: Node }>;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Spice': 'badge-amber',
  'Fruit': 'badge-green',
  'Dairy': 'badge-blue',
  'Meat/Animal Product': 'badge-purple',
  'Beverage Alcoholic': 'badge-purple',
  'Plant/Vegetable': 'badge-green',
  'Seafood': 'badge-blue',
  'Cereal/Crop/Bean': 'badge-amber',
};

function badgeClass(cat: string | null) {
  return CATEGORY_COLORS[cat ?? ''] ?? 'badge-blue';
}

function ScoreBar({ value, max = 10 }: { value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="score-bar-track" style={{ marginTop: 8 }}>
      <div className="score-bar-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

function ResultCard({ item, scoreKey, scoreLabel }: {
  item: Substitute & { substitute: Node };
  scoreKey: string;
  scoreLabel: string;
}) {
  const node = item.substitute;
  const score = (item as unknown as Record<string, unknown>)[scoreKey] as number ?? 0;
  return (
    <Link href={`/ingredient/${encodeURIComponent(node.name)}`} style={{ textDecoration: 'none', color: 'var(--text-primary)' }}>
      <div className="card" style={{ cursor: 'pointer', padding: '18px 20px', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{fmt(node.name)}</div>
            {node.category && (
              <span className={`badge ${badgeClass(node.category)}`}>{node.category}</span>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)', fontFamily: 'Space Grotesk' }}>
              {score.toFixed(1)}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {scoreLabel}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
          <span>🔬 {node.molecule_count} molecules</span>
          <span>📐 {(item.cos_sim * 100).toFixed(0)}% similarity</span>
        </div>
        <ScoreBar value={score} max={10} />
      </div>
    </Link>
  );
}

function Row({ title, icon, color, description, items, scoreKey, scoreLabel, empty }: {
  title: string; icon: string; color: string; description: string;
  items: Array<Substitute & { substitute: Node }>;
  scoreKey: string; scoreLabel: string; empty: boolean;
}) {
  if (empty) return null;

  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 20,
        paddingBottom: 16, borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 22, marginTop: 2 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color }}>{title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{description}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.6, marginTop: 4 }}>{items.length} results</div>
        </div>
      </div>
      {items.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '20px 0' }}>
          No results found
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}>
          {items.map((item, i) => (
            <ResultCard key={i} item={item} scoreKey={scoreKey} scoreLabel={scoreLabel} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FinderPage() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [allIngredients, setAllIngredients] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SubResult | null>(null);
  const [error, setError] = useState('');
  const [showSugg, setShowSugg] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    db.from('nodes').select('name').eq('type', 'ingredient').order('name')
      .then(({ data }) => {
        if (data) setAllIngredients(data.map((d: { name: string }) => fmt(d.name)));
      });
  }, []);

  useEffect(() => {
    if (query.length < 2) { setSuggestions([]); return; }
    setSuggestions(rankSuggestions(allIngredients, query));
    setActiveIdx(-1);
  }, [query, allIngredients]);

  const search = useCallback(async (name: string) => {
    if (!name.trim()) return;
    setLoading(true); setError(''); setResult(null); setShowSugg(false);
    const raw = name.toLowerCase().replace(/ /g, '_');

    try {
      let { data: queryNodes } = await db
        .from('nodes').select('*').eq('type', 'ingredient').ilike('name', raw).limit(1);

      if (!queryNodes || queryNodes.length === 0) {
        ({ data: queryNodes } = await db
          .from('nodes').select('*').eq('type', 'ingredient').ilike('name', `%${raw}%`).limit(1));
      }

      if (!queryNodes || queryNodes.length === 0) {
        setError(`Ingredient "${name}" not found in the graph.`);
        setLoading(false); return;
      }
      const queryNode = queryNodes[0] as Node;

      const { data: rawSubs, error: subsErr } = await db
        .from('substitutes')
        .select('id, ingredient_id, substitute_id, sub_type, cos_sim, mol_pct, score, rank')
        .eq('ingredient_id', queryNode.id)
        .order('rank');

      if (subsErr) throw subsErr;
      const subRows = rawSubs ?? [];

      if (subRows.length === 0) {
        setResult({ query: queryNode, functional: [], aromatic: [], complements: [] });
        setLoading(false); return;
      }

      const subIds = [...new Set(subRows.map((s: { substitute_id: string }) => s.substitute_id))];
      const { data: subNodes } = await db.from('nodes').select('*').in('id', subIds);

      const nodeMap = new Map<string, Node>((subNodes ?? []).map((n: Node) => [n.id, n]));

      const merged = subRows
        .map((s: Substitute) => ({ ...s, substitute: nodeMap.get(s.substitute_id) ?? undefined }))
        .filter((s: Substitute & { substitute: Node | undefined }) => s.substitute !== undefined) as Array<Substitute & { substitute: Node }>;

      setResult({
        query: queryNode,
        functional: merged.filter(s => s.sub_type === 'functional'),
        aromatic: merged.filter(s => s.sub_type === 'aromatic'),
        complements: merged.filter(s => s.sub_type === 'complement'),
      });
    } catch (e) {
      console.error('Search error:', e);
      setError('Failed to fetch results. Please check your Supabase connection.');
    }
    setLoading(false);
  }, []);

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(0,212,170,0.06) 0%, transparent 100%)',
        borderBottom: '1px solid var(--border)',
        padding: '48px 0 40px',
      }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <div className="badge badge-green" style={{ marginBottom: 16, display: 'inline-flex' }}>
            🔍 Substitute Finder
          </div>
          <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)', marginBottom: 12 }}>
            Find <span className="glow-text">Ingredient</span> Substitutes
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, maxWidth: 500, margin: '0 auto 32px' }}>
            Powered by GraphSAGE embeddings — get functional substitutes, aromatic pairings, and complementary alternatives
          </p>

          {/* Search */}
          <div style={{ maxWidth: 620, margin: '0 auto', position: 'relative' }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  ref={inputRef}
                  id="ingredient-search"
                  className="input"
                  placeholder="e.g. chicken, lemon, apple…"
                  value={query}
                  onChange={e => { setQuery(e.target.value); setShowSugg(true); }}
                  onKeyDown={e => {
                    if (!showSugg || suggestions.length === 0) {
                      if (e.key === 'Enter') search(query);
                      return;
                    }
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setActiveIdx(i => Math.max(i - 1, -1));
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      if (activeIdx >= 0 && activeIdx < suggestions.length) {
                        const selected = suggestions[activeIdx];
                        setQuery(selected); setShowSugg(false); setActiveIdx(-1); search(selected);
                      } else {
                        search(query);
                      }
                    } else if (e.key === 'Escape') {
                      setShowSugg(false); setActiveIdx(-1);
                    }
                  }}
                  onFocus={() => setShowSugg(true)}
                  style={{ paddingRight: 48 }}
                  autoComplete="off"
                />
                <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 18, pointerEvents: 'none' }}>
                  🔎
                </span>
                {showSugg && suggestions.length > 0 && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 999,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    borderRadius: 12, overflow: 'hidden', boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
                  }}>
                    {suggestions.map((s, i) => (
                      <div key={s}
                        onClick={() => { setQuery(s); setShowSugg(false); setActiveIdx(-1); search(s); }}
                        onMouseEnter={() => setActiveIdx(i)}
                        onMouseLeave={() => setActiveIdx(-1)}
                        style={{
                          padding: '12px 18px', cursor: 'pointer', fontSize: 14,
                          borderBottom: '1px solid var(--border)',
                          display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.15s',
                          background: i === activeIdx ? 'var(--accent-glow)' : 'transparent',
                          borderLeft: i === activeIdx ? '3px solid var(--accent)' : '3px solid transparent',
                        }}
                      >
                        <span style={{ color: 'var(--accent)', fontSize: 12 }}>🌿</span>
                        <span style={{ flex: 1 }}>{s}</span>
                        {i === activeIdx && <span style={{ fontSize: 10, color: 'var(--accent)', opacity: 0.7 }}>↵</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                className="btn-primary"
                onClick={() => search(query)}
                disabled={loading}
                style={{ flexShrink: 0, opacity: loading ? 0.7 : 1 }}
              >
                {loading ? '⏳' : '🔍'} {loading ? 'Searching…' : 'Find'}
              </button>
            </div>
          </div>

          {/* Context hint */}
          <div style={{ marginTop: 20 }}>
            <Link href="/context" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13,
              color: 'var(--accent)', textDecoration: 'none', opacity: 0.8,
              transition: 'opacity 0.2s',
            }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0.8')}
            >
              🎯 Want recipe-context-aware results? Try the Context Reranker →
            </Link>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="container" style={{ padding: '48px 24px' }}>
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 12, padding: '16px 20px', color: '#f87171', marginBottom: 32,
          }}>
            ⚠️ {error}
          </div>
        )}

        {result && (
          <div className="card" style={{
            marginBottom: 40, padding: '24px 28px',
            background: 'linear-gradient(135deg, rgba(0,212,170,0.06), rgba(124,92,252,0.06))',
            border: '1px solid rgba(0,212,170,0.3)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 36 }}>🌿</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                  <h2 style={{ fontSize: 22, margin: 0 }}>{fmt(result.query.name)}</h2>
                  <span className={`badge ${badgeClass(result.query.category)}`}>{result.query.category ?? 'Unknown'}</span>
                </div>
                <div style={{ display: 'flex', gap: 20, color: 'var(--text-secondary)', fontSize: 13 }}>
                  <span>🔬 {result.query.molecule_count ?? 0} connected molecules</span>
                  {result.query.group_name && <span>📂 {result.query.group_name}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link href={`/ingredient/${encodeURIComponent(result.query.name)}`} className="btn-ghost">
                  View Profile →
                </Link>
                <Link
                  href={`/context?q=${encodeURIComponent(result.query.name)}`}
                  className="btn-ghost"
                  style={{ borderColor: 'rgba(0,212,170,0.4)', color: 'var(--accent)' }}
                >
                  🎯 Context Rerank
                </Link>
              </div>
            </div>
          </div>
        )}

        <div>
          <Row
            title="Functional Substitutes" icon="⚗️" color="var(--accent)"
            description="Same-category ingredients that perform the same culinary role — safe 1:1 swaps backed by molecular overlap and embedding similarity."
            items={result?.functional ?? []} scoreKey="score" scoreLabel="Score"
            empty={!result}
          />
          <Row
            title="Aromatic Pairings" icon="🌸" color="#a78bfa"
            description="Ingredients that share key flavour molecules across different categories — not strict substitutes, but harmonious companions in a dish."
            items={result?.aromatic ?? []} scoreKey="score" scoreLabel="Aroma"
            empty={!result}
          />
          <Row
            title="Complements" icon="🤝" color="#f59e0b"
            description="Ingredients that frequently co-occur in recipes and pair well together — ranked by co-occurrence strength and embedding affinity."
            items={result?.complements ?? []} scoreKey="score" scoreLabel="Pairing"
            empty={!result}
          />
        </div>

        {!result && !loading && !error && (
          <div style={{
            textAlign: 'center', padding: '80px 24px',
            border: '1px dashed var(--border)', borderRadius: 20,
          }}>
            <div style={{ fontSize: 56, marginBottom: 24 }}>🔬</div>
            <h2 style={{ fontSize: 22, marginBottom: 12, color: 'var(--text-secondary)' }}>
              Search for an ingredient to begin
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 400, margin: '0 auto 24px' }}>
              Type any ingredient above. For recipe-context results, use the{' '}
              <Link href="/context" style={{ color: 'var(--accent)' }}>Context Reranker</Link>.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              {['chicken', 'basil', 'lemon', 'butter', 'parmesan'].map(ex => (
                <button key={ex} className="btn-ghost" style={{ fontSize: 13 }}
                  onClick={() => { setQuery(fmt(ex)); search(ex); }}>
                  {fmt(ex)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
