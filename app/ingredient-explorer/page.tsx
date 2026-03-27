'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase, fmt } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface GraphNode { id: string; name: string; type: string; category: string | null; }
interface GraphEdge { source: string; target: string; edge_type: string; weight: number; }

/* ─── colours ─── */
const C_QUERY       = '#f59e0b';   // amber  - query ingredient nodes
const C_COPAIR      = '#00d4aa';   // teal   - regular co-pair nodes
const C_MOL         = '#7c5cfc';   // purple - molecule nodes
const C_COMMON_COPAIR = '#f43f5e'; // rose    - co-pair ingredient shared by ≥2 query ingrs
const C_COMMON_MOL   = '#fb923c'; // orange  - molecule shared by ≥2 query ingrs
const C_EDGE_CO     = 'rgba(0,212,170,0.22)';
const C_EDGE_CT     = 'rgba(124,92,252,0.22)';

export default function IngredientExplorerPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const router    = useRouter();

  /* ── search state */
  const [inputVal,  setInputVal]  = useState('');
  const [selected,  setSelected]  = useState<GraphNode[]>([]);   // confirmed query ingredients
  const [notFound,  setNotFound]  = useState('');                // last search that returned nothing
  const [searching, setSearching] = useState(false);

  /* ── graph state */
  const [nodes,  setNodes]    = useState<GraphNode[]>([]);
  const [edges,  setEdges]    = useState<GraphEdge[]>([]);
  const [commonNodeIds, setCommonNodeIds] = useState<Set<string>>(new Set());
  const [loading,  setLoading]  = useState(false);
  const [hovered,  setHovered]  = useState<GraphNode | null>(null);
  const [stats, setStats] = useState({ ingredients: 0, molecules: 0, edges: 0, commonIngrs: 0, commonMols: 0 });
  const [showMols, setShowMols] = useState(true);

  /* ── physics refs */
  const posRef      = useRef<Map<string, { x: number; y: number; vx: number; vy: number }>>(new Map());
  const animRef     = useRef<number>(0);
  const mouseRef    = useRef<{ x: number; y: number }>({ x: -999, y: -999 });
  const transformed = useRef<{ offsetX: number; offsetY: number; scale: number }>({ offsetX: 0, offsetY: 0, scale: 1 });

  /* ─── Search: look up exact / closest match and add to selected ── */
  const handleSearch = async () => {
    const q = inputVal.trim();
    if (!q) return;
    setSearching(true);
    setNotFound('');

    // Try exact match first (ilike = case-insensitive)
    const { data: exact } = await supabase
      .from('nodes')
      .select('id, name, type, category')
      .eq('type', 'ingredient')
      .ilike('name', q)
      .limit(1);

    let match: GraphNode | null = (exact && exact.length > 0) ? exact[0] as GraphNode : null;

    // Fallback: starts-with / contains
    if (!match) {
      const { data: fuzzy } = await supabase
        .from('nodes')
        .select('id, name, type, category')
        .eq('type', 'ingredient')
        .ilike('name', `%${q}%`)
        .limit(1);
      match = (fuzzy && fuzzy.length > 0) ? fuzzy[0] as GraphNode : null;
    }

    setSearching(false);

    if (!match) {
      setNotFound(q);
      return;
    }

    // Don't add duplicates
    if (selected.find(s => s.id === match!.id)) {
      setInputVal('');
      return;
    }

    setSelected(prev => [...prev, match!]);
    setInputVal('');
  };

  const removeIngredient = (id: string) =>
    setSelected(prev => prev.filter(s => s.id !== id));

  /* ─── Fetch graph ──────────────────────────────────────────────── */
  const loadGraph = useCallback(async () => {
    if (selected.length === 0) {
      setNodes([]); setEdges([]); setCommonNodeIds(new Set());
      return;
    }
    setLoading(true);
    posRef.current.clear();

    const queryIds   = selected.map(s => s.id);
    const queryIdSet = new Set(queryIds);
    const CHUNK = 200;

    /* 1. CO_OCCURS edges for all query ingredients */
    const rawCo: GraphEdge[] = [];
    for (let i = 0; i < queryIds.length; i += CHUNK) {
      const chunk = queryIds.slice(i, i + CHUNK);
      const [rA, rB] = await Promise.all([
        supabase.from('edges').select('source, target, edge_type, weight')
          .eq('edge_type', 'CO_OCCURS').in('source', chunk).limit(3000),
        supabase.from('edges').select('source, target, edge_type, weight')
          .eq('edge_type', 'CO_OCCURS').in('target', chunk).limit(3000),
      ]);
      rawCo.push(...((rA.data ?? []) as GraphEdge[]));
      rawCo.push(...((rB.data ?? []) as GraphEdge[]));
    }

    /* Deduplicate CO_OCCURS */
    const edgeKey  = (e: GraphEdge) => `${e.source}-${e.target}`;
    const coSeen   = new Set<string>();
    const coEdges: GraphEdge[] = [];
    for (const e of rawCo) {
      const k = edgeKey(e);
      if (!coSeen.has(k)) { coSeen.add(k); coEdges.push(e); }
    }

    /* 2. Collect co-pair ingredient IDs */
    const coPairIds = new Set<string>();
    for (const e of coEdges) {
      if (!queryIdSet.has(e.source)) coPairIds.add(e.source);
      if (!queryIdSet.has(e.target)) coPairIds.add(e.target);
    }
    const coPairArr = [...coPairIds];

    /* 3. Fetch co-pair nodes */
    const coPairNodes: GraphNode[] = [];
    for (let i = 0; i < coPairArr.length; i += CHUNK) {
      const { data } = await supabase.from('nodes').select('id, name, type, category')
        .in('id', coPairArr.slice(i, i + CHUNK));
      if (data) coPairNodes.push(...(data as GraphNode[]));
    }

    /* 4. Common co-pair node detection (only meaningful when ≥2 query ingredients) */
    const initCommonNodes = new Set<string>();
    if (selected.length >= 2) {
      const coPairNeighbourCnt = new Map<string, number>();
      for (const e of coEdges) {
        const nbr = queryIdSet.has(e.source) ? e.target : e.source;
        coPairNeighbourCnt.set(nbr, (coPairNeighbourCnt.get(nbr) ?? 0) + 1);
      }
      for (const [id, cnt] of coPairNeighbourCnt) {
        if (cnt >= 2) initCommonNodes.add(id);
      }
    }

    /* 5. Molecules */
    let molNodes: GraphNode[]    = [];
    let containsEdges: GraphEdge[] = [];

    if (showMols) {
      const allIngrIds = [...queryIds, ...coPairArr];
      const rawCt: GraphEdge[] = [];
      for (let i = 0; i < allIngrIds.length; i += CHUNK) {
        const { data } = await supabase.from('edges').select('source, target, edge_type, weight')
          .eq('edge_type', 'CONTAINS').in('source', allIngrIds.slice(i, i + CHUNK)).limit(3000);
        if (data) rawCt.push(...(data as GraphEdge[]));
      }
      const ctSeen = new Set<string>();
      for (const e of rawCt) {
        const k = edgeKey(e);
        if (!ctSeen.has(k)) { ctSeen.add(k); containsEdges.push(e); }
      }

      const molIdList = [...new Set(containsEdges.map(e => e.target))];
      for (let i = 0; i < molIdList.length; i += CHUNK) {
        const { data } = await supabase.from('nodes').select('id, name, type, category')
          .in('id', molIdList.slice(i, i + CHUNK));
        if (data) molNodes.push(...(data as GraphNode[]));
      }

      /* Common molecules: shared by ≥2 query ingredients (only when multi) */
      if (selected.length >= 2) {
        const molSharedBy = new Map<string, Set<string>>();
        for (const e of containsEdges) {
          if (queryIdSet.has(e.source)) {
            if (!molSharedBy.has(e.target)) molSharedBy.set(e.target, new Set());
            molSharedBy.get(e.target)!.add(e.source);
          }
        }
        for (const [id, ingrs] of molSharedBy) {
          if (ingrs.size >= 2) initCommonNodes.add(id);
        }
      }
    }

    /* 6. Assemble */
    const allNodes: GraphNode[] = [
      ...selected,
      ...coPairNodes,
      ...(showMols ? molNodes : []),
    ];
    const allEdges = [...coEdges, ...(showMols ? containsEdges : [])];
    const vis = new Set(allNodes.map(n => n.id));
    const filteredEdges = allEdges.filter(e => vis.has(e.source) && vis.has(e.target));

    const commonIngrs = allNodes.filter(n => n.type === 'ingredient' && !queryIdSet.has(n.id) && initCommonNodes.has(n.id)).length;
    const commonMols  = allNodes.filter(n => n.type === 'molecule'   && initCommonNodes.has(n.id)).length;

    setNodes(allNodes);
    setEdges(filteredEdges);
    setCommonNodeIds(initCommonNodes);
    setStats({
      ingredients: allNodes.filter(n => n.type === 'ingredient').length,
      molecules:   allNodes.filter(n => n.type === 'molecule').length,
      edges:       filteredEdges.length,
      commonIngrs,
      commonMols,
    });
    setLoading(false);
  }, [selected, showMols]);

  useEffect(() => { loadGraph(); }, [loadGraph]);

  /* ─── Draw loop ──────────────────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || loading || nodes.length === 0) return;
    const ctx = canvas.getContext('2d')!;

    const W = canvas.offsetWidth  || 900;
    const H = canvas.offsetHeight || 620;
    canvas.width  = W;
    canvas.height = H;

    const queryIdSet = new Set(selected.map(s => s.id));
    const pos = posRef.current;
    nodes.forEach(n => {
      if (!pos.has(n.id)) pos.set(n.id, {
        x: 80 + Math.random() * (W - 160),
        y: 80 + Math.random() * (H - 160),
        vx: 0, vy: 0,
      });
    });

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const { offsetX, offsetY, scale } = transformed.current;
      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);

      /* Physics */
      const MARGIN = 80, WALL_K = 1.2, CEN_K = 0.002;
      nodes.forEach(a => {
        const pa = pos.get(a.id); if (!pa) return;
        nodes.forEach(b => {
          if (a.id === b.id) return;
          const pb = pos.get(b.id); if (!pb) return;
          const dx = pa.x - pb.x, dy = pa.y - pb.y;
          const d  = Math.sqrt(dx * dx + dy * dy) || 1;
          const f  = Math.min(2600 / (d * d), 6);
          pa.vx += (dx / d) * f; pa.vy += (dy / d) * f;
        });
        pa.vx += (W / 2 - pa.x) * CEN_K;
        pa.vy += (H / 2 - pa.y) * CEN_K;
        if (pa.x < MARGIN)     pa.vx += (MARGIN - pa.x)       * WALL_K;
        if (pa.x > W - MARGIN) pa.vx -= (pa.x - (W - MARGIN)) * WALL_K;
        if (pa.y < MARGIN)     pa.vy += (MARGIN - pa.y)       * WALL_K;
        if (pa.y > H - MARGIN) pa.vy -= (pa.y - (H - MARGIN)) * WALL_K;
      });
      edges.forEach(e => {
        const pa = pos.get(e.source), pb = pos.get(e.target);
        if (!pa || !pb) return;
        const dx = pb.x - pa.x, dy = pb.y - pa.y;
        const d  = Math.sqrt(dx * dx + dy * dy) || 1;
        const ideal = e.edge_type === 'CONTAINS' ? 70 : 130;
        const f  = (d - ideal) * 0.003;
        pa.vx += (dx / d) * f; pa.vy += (dy / d) * f;
        pb.vx -= (dx / d) * f; pb.vy -= (dy / d) * f;
      });
      nodes.forEach(n => {
        const p = pos.get(n.id); if (!p) return;
        p.vx *= 0.76; p.vy *= 0.76;
        p.x += p.vx; p.y += p.vy;
        p.x = Math.max(10, Math.min(W - 10, p.x));
        p.y = Math.max(10, Math.min(H - 10, p.y));
      });

      /* Edges - always standard colours, no special highlighting */
      edges.forEach(e => {
        const pa = pos.get(e.source), pb = pos.get(e.target);
        if (!pa || !pb) return;
        ctx.beginPath();
        ctx.strokeStyle = e.edge_type === 'CO_OCCURS' ? C_EDGE_CO : C_EDGE_CT;
        ctx.lineWidth   = 0.7;
        ctx.globalAlpha = 0.5;
        ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
        ctx.globalAlpha = 1;
      });

      /* Nodes */
      const mx = (mouseRef.current.x - offsetX) / scale;
      const my = (mouseRef.current.y - offsetY) / scale;
      let nowHovered: GraphNode | null = null;

      nodes.forEach(n => {
        const p = pos.get(n.id); if (!p) return;
        const isQuery       = queryIdSet.has(n.id);
        const isMol         = n.type === 'molecule';
        const isCommon      = !isQuery && selected.length >= 2 && commonNodeIds.has(n.id);
        const isCommonMol   = isCommon && isMol;
        const isCommonIngr  = isCommon && !isMol;
        const r             = isQuery ? 9 : isMol ? 3 : 5.5;
        const color         = isQuery       ? C_QUERY
                            : isCommonIngr  ? C_COMMON_COPAIR
                            : isCommonMol   ? C_COMMON_MOL
                            : isMol         ? C_MOL
                            : C_COPAIR;
        const dist     = Math.sqrt((p.x - mx) ** 2 + (p.y - my) ** 2);
        const isHover  = dist < r + 10;
        if (isHover) nowHovered = n;

        /* Glow */
        const glowColor = isQuery      ? 'rgba(245,158,11,0.35)'
                        : isCommonIngr ? 'rgba(244,63,94,0.35)'
                        : isCommonMol  ? 'rgba(251,146,60,0.35)'
                        : isMol        ? 'rgba(124,92,252,0.20)'
                        : 'rgba(0,212,170,0.25)';
        const glowR = isQuery || isCommon ? 5 : 4;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * glowR);
        g.addColorStop(0, glowColor);
        g.addColorStop(1, 'transparent');
        ctx.beginPath(); ctx.fillStyle = g;
        ctx.arc(p.x, p.y, r * glowR, 0, Math.PI * 2); ctx.fill();

        /* Circle */
        ctx.beginPath();
        ctx.arc(p.x, p.y, isHover ? r + 2.5 : r, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();

        /* Ring */
        if (isQuery || isCommon) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, r + 4, 0, Math.PI * 2);
          ctx.strokeStyle = isQuery ? C_QUERY : isCommonIngr ? C_COMMON_COPAIR : C_COMMON_MOL;
          ctx.lineWidth = 1.5; ctx.globalAlpha = 0.5;
          ctx.stroke(); ctx.globalAlpha = 1;
        }

        /* Labels - hover only */
        if (isHover) {
          ctx.fillStyle = 'white';
          ctx.font = 'bold 11px Inter, sans-serif';
          ctx.fillText(fmt(n.name), p.x + r + 6, p.y + 4);
        }
      });
      setHovered(nowHovered);
      animRef.current = requestAnimationFrame(draw);
    };

    cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [nodes, edges, loading, commonNodeIds, selected]);

  /* ─── Mouse move for hover only ─────────────────────────────────── */
  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!hovered || hovered.type !== 'ingredient') return;
    router.push(`/ingredient/${encodeURIComponent(hovered.name)}`);
  }, [hovered, router]);

  const graphVisible = selected.length > 0 && !loading && nodes.length > 0;

  /* ─── UI ─────────────────────────────────────────────────────────── */
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <div style={{
        borderBottom: '1px solid var(--border)', padding: '28px 0 20px',
        background: 'linear-gradient(180deg, rgba(245,158,11,0.07) 0%, transparent 100%)',
      }}>
        <div className="container">
          <div className="badge badge-amber" style={{ marginBottom: 10, display: 'inline-flex' }}>
            🔍 Ingredient Graph Explorer
          </div>
          <h1 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', marginBottom: 6 }}>
            Explore Ingredient <span style={{ color: '#f59e0b' }}>Connections</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Type an ingredient name and press <kbd style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 5, padding: '1px 6px', fontSize: 11, fontFamily: 'monospace' }}>Enter</kbd> to explore · add multiple to highlight shared links
          </p>
        </div>
      </div>

      {/* ── Search bar ── */}
      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', padding: '14px 0' }}>
        <div className="container">

          {/* Selected chips */}
          {selected.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {selected.map(s => (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)',
                  borderRadius: 50, padding: '4px 12px', fontSize: 13, fontWeight: 600, color: '#f59e0b',
                }}>
                  🌿 {fmt(s.name)}
                  <button onClick={() => removeIngredient(s.id)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#f59e0b', fontSize: 14, padding: 0, lineHeight: 1,
                  }}>✕</button>
                </div>
              ))}
              <button onClick={() => setSelected([])} style={{
                background: 'none', border: '1px solid var(--border)', borderRadius: 50,
                padding: '4px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--text-muted)',
              }}>Clear all</button>
            </div>
          )}

          {/* Input row */}
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={inputVal}
              onChange={e => { setInputVal(e.target.value); setNotFound(''); }}
              onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
              placeholder="e.g. chicken, lemon, apple…"
              className="input"
              style={{ flex: 1, padding: '11px 18px', fontSize: 14 }}
              disabled={searching}
            />
            <button
              onClick={handleSearch}
              disabled={searching || !inputVal.trim()}
              className="btn-primary"
              style={{ padding: '11px 24px', fontSize: 14, flexShrink: 0 }}
            >
              {searching ? '⏳ Searching…' : '🔍 Explore'}
            </button>
          </div>

          {/* Not-found message */}
          {notFound && (
            <div style={{
              marginTop: 10, fontSize: 13, color: '#ef4444',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 8, padding: '8px 14px',
            }}>
              ⚠️ No ingredient found for <strong>&ldquo;{notFound}&rdquo;</strong> - try a different spelling.
            </div>
          )}
        </div>
      </div>

      {/* ── Main area ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Canvas area */}
        <div style={{ flex: 1, position: 'relative', background: 'var(--bg-base)' }}>
          {selected.length === 0 ? (
            /* ── Empty state ── */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 20, padding: 40 }}>
              <div style={{ fontSize: 64, filter: 'grayscale(0.2)' }}>🌿</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'center' }}>
                Start by exploring an ingredient
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', maxWidth: 420, lineHeight: 1.8 }}>
                Type any ingredient (e.g. <em style={{ color: '#f59e0b' }}>chicken</em>) in the search bar above and press
                {' '}<strong>Enter</strong> or click <strong>Explore</strong>.<br />
                You&apos;ll see all its co-pair ingredient nodes, molecule nodes,
                and every edge connecting them.
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
                {['Chicken', 'Lemon', 'Apple', 'Garlic', 'Ginger'].map(ex => (
                  <button key={ex} onClick={() => { setInputVal(ex); }}
                    style={{
                      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                      borderRadius: 50, padding: '6px 16px', cursor: 'pointer',
                      fontSize: 13, color: 'var(--text-secondary)',
                    }}
                    onMouseEnter={e => { (e.currentTarget.style.borderColor = '#f59e0b'); (e.currentTarget.style.color = '#f59e0b'); }}
                    onMouseLeave={e => { (e.currentTarget.style.borderColor = 'var(--border)'); (e.currentTarget.style.color = 'var(--text-secondary)'); }}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          ) : loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
              <div style={{ fontSize: 44 }}>⏳</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 15 }}>Fetching graph data…</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Loading co-pair ingredients &amp; molecules</div>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              style={{
                width: '100%', height: '100%',
                cursor: hovered?.type === 'ingredient' ? 'pointer' : 'default',
              }}
              onMouseMove={onMouseMove}
              onClick={handleClick}
            />
          )}

          {/* Hover tooltip */}
          {hovered && (
            <div style={{
              position: 'absolute', bottom: 24, left: 24, pointerEvents: 'none',
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: 12, padding: '12px 18px', fontSize: 13,
            }}>
              <strong>{fmt(hovered.name)}</strong>
              <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                {hovered.type === 'ingredient' ? '🌿 Ingredient' : '🔬 Molecule'}
                {hovered.category ? ` · ${hovered.category}` : ''}
              </div>
              {hovered.type === 'ingredient' && (
                <div style={{ color: 'var(--accent)', fontSize: 11, marginTop: 6 }}>Click to view profile →</div>
              )}
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div style={{
          width: 262, flexShrink: 0, background: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border)', padding: 20,
          overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 22,
        }}>

          {/* Display toggle */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 12, textTransform: 'uppercase' }}>Display</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={showMols} onChange={e => setShowMols(e.target.checked)}
                style={{ accentColor: C_MOL, width: 15, height: 15 }} />
              Show Molecule Nodes
            </label>
          </div>

          {/* Legend */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 12, textTransform: 'uppercase' }}>Legend - Nodes</div>
            {[
              { color: C_QUERY,        label: 'Query Ingredient',          size: 18 },
              { color: C_COPAIR,       label: 'Co-pair Ingredient',         size: 11 },
              { color: C_COMMON_COPAIR,label: 'Shared Co-pair (multi)',     size: 11 },
              { color: C_MOL,          label: 'Molecule',                   size: 6  },
              { color: C_COMMON_MOL,   label: 'Shared Molecule (multi)',    size: 6  },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: l.size, height: l.size, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{l.label}</span>
              </div>
            ))}
            <div style={{ height: 1, background: 'var(--border)', margin: '10px 0' }} />
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 12, textTransform: 'uppercase' }}>Legend - Edges</div>
            {[
              { color: C_EDGE_CO, label: 'CO_OCCURS' },
              { color: C_EDGE_CT, label: 'CONTAINS'  },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 28, height: 2, background: l.color, flexShrink: 0, borderRadius: 2 }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{l.label}</span>
              </div>
            ))}
          </div>

          {/* Stats */}
          {graphVisible && (
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 12, textTransform: 'uppercase' }}>Graph Stats</div>
              {[
                { label: '🌿 Query Nodes',          val: selected.length,                      color: 'var(--accent)' },
                { label: '🤝 Co-pair Ingredients',  val: stats.ingredients - selected.length,  color: 'var(--accent)' },
                { label: '🔬 Molecules',             val: stats.molecules,                      color: 'var(--accent)' },
                { label: '⚡ Total Edges',           val: stats.edges,                          color: 'var(--accent)' },
                ...(selected.length >= 2 ? [
                  { label: '🔴 Shared Ingredients',  val: stats.commonIngrs,                    color: C_COMMON_COPAIR },
                  { label: '🟠 Shared Molecules',    val: stats.commonMols,                     color: C_COMMON_MOL    },
                ] : []),
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.label}</span>
                  <strong style={{ color: s.color, fontSize: 13 }}>
                    {s.val.toLocaleString()}
                  </strong>
                </div>
              ))}
            </div>
          )}

          {/* Tips */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 14, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.8 }}>
            <strong style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Tips</strong>
            🖱 Click ingredient → profile<br />
            ➕ Add multiple ingredients<br />
            <span style={{ color: C_COMMON_COPAIR }}>● Rose</span> = shared co-pair<br />
            <span style={{ color: C_COMMON_MOL }}>● Orange</span> = shared molecule
          </div>
        </div>
      </div>
    </div>
  );
}
