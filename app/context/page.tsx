'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { db, fmt, rankSuggestions, normaliseIngredient, type Node, type Substitute, type ContextAwareResult } from '@/lib/db';
import { type RecipeItem } from '@/lib/recipedb';
import Link from 'next/link';

// ─── Curated Benchmark Recipes ───────────────────────────────────────────────

interface PresetRecipe {
  id: string;
  title: string;
  cuisine: string;
  defaultTarget: string;
  ingredients: string[];
}

const PRESET_RECIPES: PresetRecipe[] = [
  {
    id: 'biryani',
    title: 'Chicken Biryani',
    cuisine: 'Indian',
    defaultTarget: 'chicken',
    ingredients: ['basmati_rice', 'yogurt', 'brown_onion', 'garam_masala', 'saffron', 'cardamom', 'clove', 'cinnamon', 'garlic', 'ginger', 'ghee'],
  },
  {
    id: 'carbonara',
    title: 'Spaghetti Carbonara',
    cuisine: 'Italian',
    defaultTarget: 'parmesan_cheese',
    ingredients: ['spaghetti', 'pancetta', 'egg', 'pecorino_romano', 'black_pepper', 'olive_oil'],
  },
  {
    id: 'pesto',
    title: 'Basil Pesto Pasta',
    cuisine: 'Italian',
    defaultTarget: 'basil',
    ingredients: ['pine_nuts', 'garlic', 'parmesan_cheese', 'olive_oil', 'fusilli', 'black_pepper', 'lemon'],
  },
  {
    id: 'guacamole',
    title: 'Guacamole',
    cuisine: 'Mexican',
    defaultTarget: 'lime',
    ingredients: ['avocado', 'onion', 'cilantro', 'jalapeno', 'tomato', 'sea_salt'],
  },
  {
    id: 'apple_pie',
    title: 'Classic Apple Pie',
    cuisine: 'American',
    defaultTarget: 'butter',
    ingredients: ['apple', 'cinnamon', 'nutmeg', 'brown_sugar', 'flour', 'lemon_juice', 'egg'],
  },
  {
    id: 'thai_curry',
    title: 'Thai Red Curry',
    cuisine: 'Thai',
    defaultTarget: 'coconut_milk',
    ingredients: ['chicken', 'red_curry_paste', 'bamboo_shoot', 'fish_sauce', 'thai_basil', 'bell_pepper', 'kaffir_lime_leaf'],
  },
  {
    id: 'caesar_salad',
    title: 'Chicken Caesar Salad',
    cuisine: 'American',
    defaultTarget: 'parmesan_cheese',
    ingredients: ['chicken', 'romaine_lettuce', 'croutons', 'anchovy', 'garlic', 'dijon_mustard', 'lemon_juice', 'olive_oil'],
  },
  {
    id: 'palak_paneer',
    title: 'Palak Paneer',
    cuisine: 'Indian',
    defaultTarget: 'paneer',
    ingredients: ['spinach', 'onion', 'tomato', 'ginger', 'garlic', 'green_chili', 'garam_masala', 'cumin', 'cream'],
  },
];

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

function RankBadge({ change }: { change: number }) {
  if (change === 0) {
    return (
      <span style={{
        fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
        background: 'rgba(255,255,255,0.06)', borderRadius: 99, padding: '2px 8px',
      }}>
        = same
      </span>
    );
  }
  const up = change > 0;
  return (
    <span style={{
      fontSize: 11, fontWeight: 700,
      color: up ? 'var(--accent)' : '#f87171',
      background: up ? 'rgba(0,212,170,0.12)' : 'rgba(248,113,113,0.12)',
      border: `1px solid ${up ? 'rgba(0,212,170,0.3)' : 'rgba(248,113,113,0.3)'}`,
      borderRadius: 99, padding: '2px 8px',
    }}>
      {up ? `↑ +${change}` : `↓ ${change}`}
    </span>
  );
}

function ScoreBar({ value, max = 10, color = 'var(--accent)' }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);
  return (
    <div className="score-bar-track" style={{ marginTop: 8 }}>
      <div
        className="score-bar-fill"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}, ${color}cc)`,
        }}
      />
    </div>
  );
}

// ─── Computation Function ───────────────────────────────────────────────────

async function computeContextAwareReranking(
  queryNode: Node,
  functionalCandidates: Array<Substitute & { substitute: Node }>,
  contextIngredients: string[],
  topK: number = 8,
  alpha: number = 0.60,
  beta: number = 0.40,
): Promise<ContextAwareResult[]> {
  if (!contextIngredients.length || !functionalCandidates.length) {
    return [];
  }

  // 1. Normalise context ingredients and exclude the target query itself
  const queryNorm = normaliseIngredient(queryNode.name);
  const normContext = Array.from(new Set(
    contextIngredients
      .map(s => normaliseIngredient(s))
      .filter(s => s.length > 0 && s !== queryNorm)
  ));

  if (!normContext.length) return [];

  // 2. Fetch context nodes from Supabase
  const { data: ctxNodes } = await db
    .from('nodes')
    .select('id, name')
    .eq('type', 'ingredient')
    .in('name', normContext);

  const ctxNodeMap = new Map<string, string>(); // id -> name
  (ctxNodes ?? []).forEach((n: { id: string; name: string }) => ctxNodeMap.set(n.id, n.name));
  const ctxIds = Array.from(ctxNodeMap.keys());
  const ctxNamesSet = new Set(Array.from(ctxNodeMap.values()).map(n => n.toLowerCase()));

  // 3. Exclude candidates already present in the recipe context
  const filteredCandidates = functionalCandidates.filter(
    c => !ctxNamesSet.has(c.substitute.name.toLowerCase()) &&
         !normContext.includes(normaliseIngredient(c.substitute.name))
  );

  const pool = filteredCandidates.length > 0 ? filteredCandidates : functionalCandidates;
  const candIds = pool.map(s => s.substitute_id);

  if (!ctxIds.length || !candIds.length) {
    return [];
  }

  // 4. Fetch co-occurrence edges between candidates and recipe context nodes
  const { data: edgeRows } = await db
    .from('edges')
    .select('source, target, weight')
    .eq('edge_type', 'CO_OCCURS')
    .or(
      `and(source.in.(${candIds.join(',')}),target.in.(${ctxIds.join(',')})),` +
      `and(source.in.(${ctxIds.join(',')}),target.in.(${candIds.join(',')}))`
    );

  const fitMap = new Map<string, Map<string, number>>();
  (edgeRows ?? []).forEach((e: { source: string; target: string; weight: number }) => {
    const candId = candIds.includes(e.source) ? e.source : (candIds.includes(e.target) ? e.target : null);
    const ctxId  = ctxIds.includes(e.source)  ? e.source  : (ctxIds.includes(e.target)  ? e.target  : null);
    if (!candId || !ctxId) return;
    if (!fitMap.has(candId)) fitMap.set(candId, new Map());
    fitMap.get(candId)!.set(ctxId, Number(e.weight) || 0);
  });

  // 5. Compute fit(c, R) = (1 / |R|) * sum_{r in R} w(c, r)
  const N = ctxIds.length;
  const enriched = pool.map((s, baseRank) => {
    const edgesByCtx = fitMap.get(s.substitute_id) ?? new Map<string, number>();
    let totalWeight = 0;
    const boosters: Array<{ name: string; weight: number }> = [];

    ctxIds.forEach(ctxId => {
      const w = edgesByCtx.get(ctxId) ?? 0;
      if (w > 0) {
        totalWeight += w;
        boosters.push({ name: ctxNodeMap.get(ctxId) ?? ctxId, weight: w });
      }
    });

    boosters.sort((a, b) => b.weight - a.weight);
    const recipe_fit = totalWeight / N;
    const base_score = (s.score ?? 5) / 10;
    return { s, baseRank, recipe_fit, boosters, base_score };
  });

  // 6. Min-max normalise fit scores across pool
  const fitVals = enriched.map(e => e.recipe_fit);
  const minFit = Math.min(...fitVals);
  const maxFit = Math.max(...fitVals);

  // 7. Convex fusion: final = 10 * (alpha * base + beta * fit_norm)
  const fused = enriched.map(e => {
    let fitNorm = 0;
    if (maxFit > minFit) fitNorm = (e.recipe_fit - minFit) / (maxFit - minFit);
    else if (maxFit > 0) fitNorm = e.recipe_fit / maxFit;

    const final_score = 10 * (alpha * e.base_score + beta * fitNorm);
    return { ...e, fitNorm, final_score };
  });

  // 8. Sort by final score descending
  fused.sort((a, b) => b.final_score - a.final_score);

  return fused.slice(0, topK).map((e, contextRank) => ({
    substitute: e.s.substitute,
    name: e.s.substitute.name,
    label: e.s.substitute.category,
    group: e.s.substitute.group_name,
    base_score: e.base_score,
    recipe_fit: e.recipe_fit,
    final_score: e.final_score,
    rank_change: e.baseRank - contextRank,
    boosters: e.boosters,
    cos_sim: e.s.cos_sim,
    mol_pct: e.s.mol_pct,
  }));
}

// ─── Main Content Component ─────────────────────────────────────────────────

function ContextRerankerInner() {
  const searchParams = useSearchParams();

  // Search state
  const [targetQuery, setTargetQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [allIngredients, setAllIngredients] = useState<string[]>([]);
  const [showSugg, setShowSugg] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  // Recipe context & RecipeDB integration state
  const [recipeName, setRecipeName] = useState('');
  const [contextIngredients, setContextIngredients] = useState<string[]>([]);
  const [newIngredientInput, setNewIngredientInput] = useState('');
  const [recipeSuggestions, setRecipeSuggestions] = useState<RecipeItem[]>([]);
  const [showRecipeDropdown, setShowRecipeDropdown] = useState(false);
  const [activeRecipeIdx, setActiveRecipeIdx] = useState(-1);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [recipeStatusMessage, setRecipeStatusMessage] = useState<string>('');
  const [recipeDetails, setRecipeDetails] = useState<RecipeItem | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const recipeDropdownRef = useRef<HTMLDivElement>(null);
  const targetDropdownRef = useRef<HTMLDivElement>(null);

  // Hyperparameters
  const [alpha, setAlpha] = useState(0.60);
  const [beta, setBeta] = useState(0.40);

  // Results state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [queryNode, setQueryNode] = useState<Node | null>(null);
  const [baselineCandidates, setBaselineCandidates] = useState<Array<Substitute & { substitute: Node }>>([]);
  const [contextResults, setContextResults] = useState<ContextAwareResult[] | null>(null);

  // Autocomplete load
  useEffect(() => {
    db.from('nodes').select('name').eq('type', 'ingredient').order('name')
      .then(({ data }) => {
        if (data) setAllIngredients(data.map((d: { name: string }) => fmt(d.name)));
      });
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (recipeDropdownRef.current && !recipeDropdownRef.current.contains(event.target as globalThis.Node)) {
        setShowRecipeDropdown(false);
        setActiveRecipeIdx(-1);
      }
      if (targetDropdownRef.current && !targetDropdownRef.current.contains(event.target as globalThis.Node)) {
        setShowSugg(false);
        setActiveIdx(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter target suggestions
  useEffect(() => {
    if (targetQuery.length < 2) { setSuggestions([]); return; }
    setSuggestions(rankSuggestions(allIngredients, targetQuery));
    setActiveIdx(-1);
  }, [targetQuery, allIngredients]);

  // Debounced search for RecipeDB
  useEffect(() => {
    if (!recipeName || recipeName.trim().length < 2) {
      setRecipeSuggestions([]);
      return;
    }

    const q = recipeName.trim();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/recipedb?action=search&q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setRecipeSuggestions(data.recipes || []);
          if (data.error) setRecipeStatusMessage(data.error);
          return;
        }
      } catch (err) {
        console.warn('RecipeDB API search error:', err);
      }
      setRecipeSuggestions([]);
    }, 400);

    return () => clearTimeout(timer);
  }, [recipeName]);

  // Handle RecipeDB selection & ingredient auto-filling
  const handleSelectRecipe = async (recipe: RecipeItem) => {
    setRecipeName(recipe.title);
    setShowRecipeDropdown(false);
    setActiveRecipeIdx(-1);
    setRecipeLoading(true);
    setRecipeDetails(null);
    setShowInstructions(false);
    setRecipeStatusMessage(`Fetching ingredients for "${recipe.title}" from RecipeDB…`);

    try {
      if (recipe.ingredients && recipe.ingredients.length > 0) {
        setContextIngredients([...recipe.ingredients]);
        setRecipeStatusMessage(`Auto-filled ${recipe.ingredients.length} ingredients from ${recipe.source === 'recipedb_live' ? 'RecipeDB API' : 'RecipeDB Database'}`);
        if (recipe.defaultTarget && !targetQuery) {
          setTargetQuery(fmt(recipe.defaultTarget));
        }
      } else {
        const res = await fetch(`/api/recipedb?action=recipe&id=${encodeURIComponent(recipe.id)}`);
        if (res.ok) {
          const data = await res.json();
          const ings: string[] = data?.recipe?.ingredients || [];
          if (data?.recipe?.nutrition || data?.recipe?.instructions?.length) {
            setRecipeDetails(data.recipe);
          }
          if (ings.length > 0) {
            setContextIngredients(ings);
            setRecipeStatusMessage(`Auto-filled ${ings.length} ingredients from RecipeDB API`);
            if (data?.recipe?.defaultTarget && !targetQuery) {
              setTargetQuery(fmt(data.recipe.defaultTarget));
            }
          } else {
            setRecipeStatusMessage(`Loaded recipe "${recipe.title}"`);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching recipe ingredients:', err);
      setRecipeStatusMessage(`Could not auto-fill ingredients for "${recipe.title}"`);
    } finally {
      setRecipeLoading(false);
    }
  };

  // Handle Preset selection
  const selectPreset = (preset: PresetRecipe | RecipeItem) => {
    setRecipeName(preset.title);
    setContextIngredients([...preset.ingredients]);
    if (preset.defaultTarget) {
      setTargetQuery(fmt(preset.defaultTarget));
    }
    setShowSugg(false);
    setShowRecipeDropdown(false);
    setRecipeStatusMessage(`Auto-filled ${preset.ingredients.length} ingredients from RecipeDB (${preset.title})`);
  };

  // Add ingredient chip
  const addIngredientChip = (raw: string) => {
    const parts = raw.split(',').map(s => s.trim().toLowerCase().replace(/\s+/g, '_')).filter(s => s.length > 0);
    const next = Array.from(new Set([...contextIngredients, ...parts]));
    setContextIngredients(next);
    setNewIngredientInput('');
  };

  // Remove ingredient chip
  const removeIngredientChip = (name: string) => {
    setContextIngredients(contextIngredients.filter(i => i !== name));
  };

  // Main evaluation trigger
  const runRerank = useCallback(async (customTarget?: string, customContext?: string[]) => {
    const target = customTarget ?? targetQuery;
    const ctx = customContext ?? contextIngredients;

    if (!target.trim()) {
      setError('Please specify an ingredient to replace.');
      return;
    }
    if (!ctx.length) {
      setError('Please add at least one ingredient to the recipe context.');
      return;
    }

    setLoading(true);
    setError('');
    setContextResults(null);
    setShowSugg(false);

    const raw = normaliseIngredient(target);

    try {
      // Step 1: Find target node
      let { data: nodes } = await db
        .from('nodes').select('*').eq('type', 'ingredient').ilike('name', raw).limit(1);

      if (!nodes || nodes.length === 0) {
        ({ data: nodes } = await db
          .from('nodes').select('*').eq('type', 'ingredient').ilike('name', `%${raw}%`).limit(1));
      }

      if (!nodes || nodes.length === 0) {
        setError(`Ingredient "${target}" not found in the GastroGraph knowledge base.`);
        setLoading(false);
        return;
      }

      const qNode = nodes[0] as Node;
      setQueryNode(qNode);

      // Step 2: Fetch functional substitute candidates from precomputed GraphSAGE table
      const { data: rawSubs, error: subsErr } = await db
        .from('substitutes')
        .select('id, ingredient_id, substitute_id, sub_type, cos_sim, mol_pct, score, rank')
        .eq('ingredient_id', qNode.id)
        .eq('sub_type', 'functional')
        .order('rank')
        .limit(15);

      if (subsErr) throw subsErr;
      const subRows = rawSubs ?? [];

      if (subRows.length === 0) {
        setError(`No functional substitute candidates found for ${fmt(qNode.name)}.`);
        setLoading(false);
        return;
      }

      // Step 3: Fetch candidate nodes details
      const subIds = subRows.map((s: { substitute_id: string }) => s.substitute_id);
      const { data: candNodes } = await db.from('nodes').select('*').in('id', subIds);
      const nodeMap = new Map<string, Node>((candNodes ?? []).map((n: Node) => [n.id, n]));

      const functional = subRows
        .map((s: Substitute) => ({ ...s, substitute: nodeMap.get(s.substitute_id)! }))
        .filter((s: Substitute & { substitute?: Node }) => !!s.substitute);

      setBaselineCandidates(functional);

      // Step 4: Run Context Reranker with alpha, beta, and recipe context
      const reranked = await computeContextAwareReranking(
        qNode,
        functional,
        ctx,
        8,
        alpha,
        beta
      );

      setContextResults(reranked);
    } catch (e: unknown) {
      console.error('Context reranker error:', e);
      setError('An error occurred during reranking. Please check your Supabase connection.');
    }

    setLoading(false);
  }, [targetQuery, contextIngredients, alpha, beta]);

  // Init from URL param if present
  useEffect(() => {
    const q = searchParams.get('q');
    const rec = searchParams.get('recipe');
    if (q) {
      setTargetQuery(fmt(q));
      if (!contextIngredients.length) {
        // default to biryani if no recipe specified
        const found = PRESET_RECIPES.find(p => p.defaultTarget === normaliseIngredient(q)) || PRESET_RECIPES[0];
        setRecipeName(found.title);
        setContextIngredients(found.ingredients);
        runRerank(fmt(q), found.ingredients);
      } else {
        runRerank(fmt(q));
      }
    }
    if (rec) {
      const match = PRESET_RECIPES.find(p => p.title.toLowerCase().includes(rec.toLowerCase()));
      if (match) {
        setRecipeName(match.title);
        setContextIngredients(match.ingredients);
        if (q) setTargetQuery(fmt(q));
        else setTargetQuery(fmt(match.defaultTarget));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(124,92,252,0.08) 0%, rgba(0,212,170,0.04) 100%)',
        borderBottom: '1px solid var(--border)',
        padding: '52px 0 44px',
      }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <div className="badge badge-purple" style={{ marginBottom: 16, display: 'inline-flex', gap: 6 }}>
            <span>🎯</span> Retrieval-Augmented Reranker
          </div>
          <h1 style={{ fontSize: 'clamp(2rem, 4.5vw, 3.2rem)', marginBottom: 14 }}>
            Recipe-<span className="glow-text">Context</span> Reranker
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 16, maxWidth: 640, margin: '0 auto 28px', lineHeight: 1.6 }}>
            Standard substitutes often fail culinary context: substituting yogurt in <em>curry</em> works, but fails in <em>carbonara</em>.
            This dedicated engine fuses GastroGraph embeddings with recipe co-occurrence statistics.
          </p>

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 16,
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            borderRadius: 99, padding: '8px 20px', fontSize: 13, color: 'var(--text-secondary)'
          }}>
            <span>Formula: <code style={{ color: 'var(--accent)', fontWeight: 600 }}>final = 10 × (α · base + β · fit_norm)</code></span>
            <span style={{ color: 'var(--border)' }}>|</span>
            <span>Ablation Benchmark: <strong style={{ color: 'var(--text-primary)' }}>α=0.60, β=0.40</strong></span>
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 40 }}>
        {/* Presets Bar */}
        <div style={{ marginBottom: 32 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 12, flexWrap: 'wrap', gap: 8
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
              ⚡ Quick Benchmark Dishes (Click to populate)
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Curated ground-truth recipes from RecipeDB evaluation
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {PRESET_RECIPES.map(p => {
              const isActive = recipeName === p.title;
              return (
                <button
                  key={p.id}
                  onClick={() => selectPreset(p)}
                  style={{
                    background: isActive ? 'linear-gradient(135deg, rgba(124,92,252,0.25), rgba(0,212,170,0.25))' : 'var(--bg-card)',
                    border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 12, padding: '8px 14px', cursor: 'pointer',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontSize: 13, fontWeight: 500, transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = 'rgba(0,212,170,0.4)'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                  <span>🍽️</span>
                  <span>{p.title}</span>
                  <span style={{ fontSize: 11, opacity: 0.6 }}>({p.cuisine})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Input Configuration Card */}
        <div className="card" style={{
          padding: '28px 32px', marginBottom: 40,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 20, boxShadow: '0 8px 30px rgba(0,0,0,0.25)'
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 28, marginBottom: 28
          }}>
            {/* Target Ingredient */}
            <div ref={targetDropdownRef} style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                1. Ingredient to Replace
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="target-ingredient-input"
                  className="input"
                  placeholder="e.g. chicken, parmesan_cheese, basil, butter…"
                  value={targetQuery}
                  onChange={e => { setTargetQuery(e.target.value); setShowSugg(true); }}
                  onKeyDown={e => {
                    if (!showSugg || suggestions.length === 0) {
                      if (e.key === 'Enter') runRerank();
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
                        setTargetQuery(selected); setShowSugg(false); setActiveIdx(-1);
                      } else {
                        runRerank();
                      }
                    } else if (e.key === 'Escape') {
                      setShowSugg(false); setActiveIdx(-1);
                    }
                  }}
                  onFocus={() => setShowSugg(true)}
                  style={{ fontSize: 15 }}
                  autoComplete="off"
                />
                {showSugg && suggestions.length > 0 && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 999,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    borderRadius: 12, overflow: 'hidden', boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
                  }}>
                    {suggestions.map((s, i) => (
                      <div
                        key={s}
                        onClick={() => { setTargetQuery(s); setShowSugg(false); setActiveIdx(-1); }}
                        onMouseEnter={() => setActiveIdx(i)}
                        onMouseLeave={() => setActiveIdx(-1)}
                        style={{
                          padding: '10px 16px', cursor: 'pointer', fontSize: 14,
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
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                Target node in the graph whose functional substitute candidates will be evaluated.
              </div>
            </div>

            {/* Recipe Title & Context with RecipeDB Autocomplete & Dropdown */}
            <div ref={recipeDropdownRef} style={{ position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  2. Recipe Context (Dish Name)
                </label>
                {recipeLoading && (
                  <span style={{ fontSize: 12, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="animate-spin">⏳</span> Querying RecipeDB…
                  </span>
                )}
              </div>

              {/* Searchable input with keyboard up/down autocomplete */}
              <div style={{ position: 'relative' }}>
                <input
                  id="recipe-title-input"
                  className="input"
                  placeholder="Type dish name e.g. Chicken Biryani, Tomato Basil Soup…"
                  value={recipeName}
                  onChange={e => {
                    setRecipeName(e.target.value);
                    setShowRecipeDropdown(true);
                  }}
                  onFocus={() => setShowRecipeDropdown(true)}
                  onKeyDown={e => {
                    if (!showRecipeDropdown || recipeSuggestions.length === 0) {
                      if (e.key === 'ArrowDown') setShowRecipeDropdown(true);
                      return;
                    }
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setActiveRecipeIdx(i => Math.min(i + 1, recipeSuggestions.length - 1));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setActiveRecipeIdx(i => Math.max(i - 1, -1));
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      if (activeRecipeIdx >= 0 && activeRecipeIdx < recipeSuggestions.length) {
                        handleSelectRecipe(recipeSuggestions[activeRecipeIdx]);
                      } else if (recipeSuggestions.length > 0) {
                        handleSelectRecipe(recipeSuggestions[0]);
                      }
                    } else if (e.key === 'Escape') {
                      setShowRecipeDropdown(false);
                      setActiveRecipeIdx(-1);
                    }
                  }}
                  style={{ fontSize: 15 }}
                  autoComplete="off"
                />

                {/* Suggestions popup */}
                {showRecipeDropdown && recipeSuggestions.length > 0 && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 999,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    borderRadius: 12, overflow: 'hidden', boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
                    maxHeight: 280, overflowY: 'auto'
                  }}>
                    <div style={{
                      padding: '8px 14px', background: 'rgba(255,255,255,0.03)',
                      borderBottom: '1px solid var(--border)', fontSize: 11,
                      fontWeight: 600, color: 'var(--text-muted)', display: 'flex',
                      justifyContent: 'space-between', alignItems: 'center'
                    }}>
                      <span>RECIPEDB MATCHES (↑↓ arrows, Enter to auto-fill)</span>
                      <span>{recipeSuggestions.length} dishes</span>
                    </div>
                    {recipeSuggestions.map((rec, i) => (
                      <div
                        key={rec.id + '-' + i}
                        onClick={() => handleSelectRecipe(rec)}
                        onMouseEnter={() => setActiveRecipeIdx(i)}
                        onMouseLeave={() => setActiveRecipeIdx(-1)}
                        style={{
                          padding: '10px 16px', cursor: 'pointer', fontSize: 14,
                          borderBottom: '1px solid var(--border)',
                          display: 'flex', alignItems: 'center', gap: 10,
                          background: i === activeRecipeIdx ? 'var(--accent-glow)' : 'transparent',
                          borderLeft: i === activeRecipeIdx ? '3px solid var(--accent)' : '3px solid transparent',
                          transition: 'background 0.15s',
                        }}
                      >
                        <span style={{ fontSize: 15 }}>🍳</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{rec.title}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {rec.cuisine} {rec.ingredients.length > 0 ? `• ${rec.ingredients.length} ingredients` : ''}
                          </div>
                        </div>
                        <span style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 99,
                          background: rec.source === 'recipedb_live' ? 'rgba(124,92,252,0.15)' : 'rgba(0,212,170,0.12)',
                          color: rec.source === 'recipedb_live' ? '#a78bfa' : 'var(--accent)',
                          border: `1px solid ${rec.source === 'recipedb_live' ? 'rgba(124,92,252,0.3)' : 'rgba(0,212,170,0.3)'}`,
                          fontWeight: 600,
                        }}>
                          {rec.source === 'recipedb_live' ? 'Live API' : 'RecipeDB'}
                        </span>
                        {i === activeRecipeIdx && (
                          <span style={{ fontSize: 11, color: 'var(--accent)', opacity: 0.8 }}>↵ Auto-fill</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {recipeStatusMessage ? (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>✓</span> {recipeStatusMessage}
                </div>
              ) : (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                  Search a dish to auto-populate ingredients via RecipeDB API.
                </div>
              )}

              {recipeDetails?.nutrition && (
                <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {[
                    ['Calories / serving', `${recipeDetails.nutrition.caloriesPerServing} kcal`],
                    ['Servings', recipeDetails.nutrition.servings || '—'],
                    ['Protein (total)', `${recipeDetails.nutrition.proteinG} g`],
                    ['Fat (total)', `${recipeDetails.nutrition.fatG} g`],
                    ['Carbs (total)', `${recipeDetails.nutrition.carbsG} g`],
                  ].map(([label, value]) => (
                    <div key={label} style={{
                      padding: '6px 12px', borderRadius: 10, background: 'var(--bg-card)',
                      border: '1px solid var(--border)', fontSize: 12,
                    }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                      <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{value}</div>
                    </div>
                  ))}
                </div>
              )}

              {recipeDetails?.instructions && recipeDetails.instructions.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <button
                    onClick={() => setShowInstructions(v => !v)}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', padding: 0 }}
                  >
                    {showInstructions ? '▾' : '▸'} Instructions from RecipeDB ({recipeDetails.instructions.length} steps)
                  </button>
                  {showInstructions && (
                    <ol style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      {recipeDetails.instructions.map((step, i) => <li key={i}>{step}</li>)}
                    </ol>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Context Ingredients Chips */}
          <div style={{ marginBottom: 28, padding: '20px', background: 'var(--bg-surface)', borderRadius: 14, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  3. Recipe Ingredients ({contextIngredients.length} in context R)
                </label>
                {recipeName && (
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 99,
                    background: 'rgba(0,212,170,0.1)', color: 'var(--accent)',
                    border: '1px solid rgba(0,212,170,0.25)', fontWeight: 600
                  }}>
                    Dish: {recipeName}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {recipeName && (
                  <button
                    onClick={() => {
                      const found = recipeSuggestions.find(r => r.title.toLowerCase() === recipeName.toLowerCase()) || recipeSuggestions[0];
                      if (found) handleSelectRecipe(found);
                    }}
                    style={{
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      color: 'var(--accent)', fontSize: 12, borderRadius: 8,
                      padding: '4px 10px', cursor: 'pointer'
                    }}
                    title="Re-fetch ingredients from RecipeDB"
                  >
                    ⚡ Auto-fill from RecipeDB
                  </button>
                )}
                {contextIngredients.length > 0 && (
                  <button
                    onClick={() => {
                      setContextIngredients([]);
                      setRecipeStatusMessage('');
                    }}
                    style={{ background: 'none', border: 'none', color: '#f87171', fontSize: 12, cursor: 'pointer' }}
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>

            {/* Chip list */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14, minHeight: 40, alignItems: 'center' }}>
              {contextIngredients.length === 0 ? (
                <span style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No context ingredients yet. Click a preset above or add items below.
                </span>
              ) : (
                contextIngredients.map(ing => (
                  <span
                    key={ing}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      background: 'rgba(0,212,170,0.1)', color: 'var(--accent)',
                      border: '1px solid rgba(0,212,170,0.3)',
                      borderRadius: 99, padding: '4px 12px', fontSize: 13, fontWeight: 500,
                    }}
                  >
                    <span>🌿 {fmt(ing)}</span>
                    <button
                      onClick={() => removeIngredientChip(ing)}
                      style={{
                        background: 'none', border: 'none', color: 'var(--accent)',
                        cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1, opacity: 0.7,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
                    >
                      ✕
                    </button>
                  </span>
                ))
              )}
            </div>

            {/* Add ingredient input */}
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                id="add-context-ingredient-input"
                className="input"
                placeholder="Type ingredient name (e.g. garlic, tomato) and press Enter…"
                value={newIngredientInput}
                onChange={e => setNewIngredientInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newIngredientInput.trim()) {
                    e.preventDefault();
                    addIngredientChip(newIngredientInput);
                  }
                }}
                style={{ fontSize: 14, flex: 1 }}
              />
              <button
                className="btn-ghost"
                onClick={() => {
                  if (newIngredientInput.trim()) addIngredientChip(newIngredientInput);
                }}
                style={{ flexShrink: 0, padding: '8px 18px', fontSize: 13 }}
              >
                + Add
              </button>
            </div>
          </div>

          {/* Hyperparameter Sliders */}
          <div style={{
            padding: '20px 24px', background: 'rgba(124,92,252,0.04)',
            border: '1px solid rgba(124,92,252,0.15)', borderRadius: 14, marginBottom: 28
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  ⚙️ Fusion Weight Calibration
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 10 }}>
                  Controls the trade-off between intrinsic chemical similarity and dish co-occurrence harmony
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { label: 'Ablation Optimal (0.6 / 0.4)', a: 0.60, b: 0.40 },
                  { label: 'Flavor Pure (0.8 / 0.2)', a: 0.80, b: 0.20 },
                  { label: 'Dish Fit (0.4 / 0.6)', a: 0.40, b: 0.60 },
                ].map(p => (
                  <button
                    key={p.label}
                    onClick={() => { setAlpha(p.a); setBeta(p.b); }}
                    style={{
                      background: (alpha === p.a && beta === p.b) ? 'rgba(124,92,252,0.25)' : 'transparent',
                      border: '1px solid rgba(124,92,252,0.3)',
                      color: (alpha === p.a && beta === p.b) ? 'var(--text-primary)' : 'var(--text-muted)',
                      borderRadius: 8, padding: '4px 10px', fontSize: 11, cursor: 'pointer',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span>α (Intrinsic Functional Score):</span>
                  <strong style={{ color: 'var(--accent)', fontFamily: 'Space Grotesk' }}>{alpha.toFixed(2)}</strong>
                </div>
                <input
                  type="range" min="0" max="1" step="0.05"
                  value={alpha}
                  onChange={e => {
                    const a = parseFloat(e.target.value);
                    setAlpha(a);
                    setBeta(parseFloat((1 - a).toFixed(2)));
                  }}
                  style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span>β (Recipe Context Fit):</span>
                  <strong style={{ color: '#a78bfa', fontFamily: 'Space Grotesk' }}>{beta.toFixed(2)}</strong>
                </div>
                <input
                  type="range" min="0" max="1" step="0.05"
                  value={beta}
                  onChange={e => {
                    const b = parseFloat(e.target.value);
                    setBeta(b);
                    setAlpha(parseFloat((1 - b).toFixed(2)));
                  }}
                  style={{ width: '100%', accentColor: '#a78bfa', cursor: 'pointer' }}
                />
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Looking for generic replacements without dish context?{' '}
              <Link href="/finder" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                Go to Standard Substitute Finder →
              </Link>
            </div>
            <button
              id="compute-rerank-btn"
              className="btn-primary"
              onClick={() => runRerank()}
              disabled={loading}
              style={{
                fontSize: 15, padding: '12px 32px',
                background: 'linear-gradient(135deg, #7c5cfc, #00d4aa)',
                boxShadow: '0 0 24px rgba(124,92,252,0.3)',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? '⏳ Computing Fit…' : '⚡ Run Context Reranking'}
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 14, padding: '16px 22px', color: '#f87171', marginBottom: 32,
            display: 'flex', alignItems: 'center', gap: 12
          }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Query Info Banner */}
        {queryNode && (
          <div className="card" style={{
            marginBottom: 36, padding: '22px 28px',
            background: 'linear-gradient(135deg, rgba(124,92,252,0.06), rgba(0,212,170,0.06))',
            border: '1px solid rgba(0,212,170,0.3)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 32 }}>🌿</span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <h2 style={{ fontSize: 22, margin: 0 }}>Target: {fmt(queryNode.name)}</h2>
                    <span className={`badge ${badgeClass(queryNode.category)}`}>{queryNode.category ?? 'Unknown'}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    Dish context: <strong style={{ color: 'var(--accent)' }}>{recipeName || 'Custom Dish'}</strong>
                    &nbsp;·&nbsp; {contextIngredients.length} context ingredients in R
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <Link href={`/ingredient/${encodeURIComponent(queryNode.name)}`} className="btn-ghost" style={{ fontSize: 13 }}>
                  View Chemical Profile →
                </Link>
                <Link href={`/finder`} className="btn-ghost" style={{ fontSize: 13 }}>
                  Standard Substitutes →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Side-by-Side Comparison: Baseline vs Context Reranked */}
        {contextResults && baselineCandidates.length > 0 && (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 24, paddingBottom: 12, borderBottom: '1px solid var(--border)'
            }}>
              <div>
                <h2 style={{ fontSize: 22, margin: '0 0 6px 0' }}>
                  📊 Substitution Reranking Comparison
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
                  Observe how recipe context promotes ingredients that share culinary harmony with the rest of the dish
                </p>
              </div>
              <span className="badge badge-green" style={{ fontSize: 12, padding: '6px 14px' }}>
                ✓ {contextResults.length} Reranked Candidates
              </span>
            </div>

            {/* Rows pair baseline #i with reranked #i so both columns share row heights */}
            <div className="rerank-compare">
              <div style={{ '--m-order': 0 } as React.CSSProperties}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10, height: '100%', boxSizing: 'border-box',
                    padding: '12px 18px', background: 'var(--bg-surface)',
                    borderRadius: 12, border: '1px solid var(--border)'
                  }}>
                    <span style={{ fontSize: 20 }}>🧬</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                        Baseline GastroGraph
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Context-blind · purely based on GraphSAGE link prediction
                      </div>
                    </div>
                  </div>
              </div>
              <div style={{ '--m-order': 1000 } as React.CSSProperties}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10, height: '100%', boxSizing: 'border-box',
                    padding: '12px 18px',
                    background: 'linear-gradient(135deg, rgba(124,92,252,0.12), rgba(0,212,170,0.12))',
                    borderRadius: 12, border: '1px solid rgba(0,212,170,0.3)'
                  }}>
                    <span style={{ fontSize: 20 }}>🎯</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--accent)' }}>
                        Context-Aware Reranked
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        fused = {alpha.toFixed(2)} · base + {beta.toFixed(2)} · fit({recipeName || 'dish'})
                      </div>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                      background: 'rgba(0,212,170,0.15)', color: 'var(--accent)',
                      border: '1px solid rgba(0,212,170,0.3)', borderRadius: 99,
                      padding: '3px 10px',
                    }}>
                      Ablation Model
                    </span>
                  </div>
              </div>
              {Array.from({ length: Math.max(Math.min(baselineCandidates.length, 8), contextResults.length) }).flatMap((_, idx) => {
                const base = baselineCandidates.slice(0, 8)[idx];
                const ctx = contextResults[idx];
                return [
                  base ? (
                    <Link
                      key={`b-${base.substitute_id}`}
                      href={`/ingredient/${encodeURIComponent(base.substitute.name)}`}
                      style={{ textDecoration: 'none', '--m-order': idx + 1 } as React.CSSProperties}
                    >
                      <div className="card" style={{
                        padding: '16px 20px', cursor: 'pointer', height: '100%', boxSizing: 'border-box',
                        display: 'flex', flexDirection: 'column',
                        border: '1px solid var(--border)', background: 'var(--bg-card)',
                        transition: 'transform 0.15s, border-color 0.15s'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{
                              fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
                              width: 22, height: 22, borderRadius: 99, background: 'var(--bg-surface)',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                              #{idx + 1}
                            </span>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                                {fmt(base.substitute.name)}
                              </div>
                              {base.substitute.category && (
                                <span className={`badge ${badgeClass(base.substitute.category)}`} style={{ fontSize: 10, marginTop: 4 }}>
                                  {base.substitute.category}
                                </span>
                              )}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-secondary)', fontFamily: 'Space Grotesk' }}>
                              {(base.score ?? 0).toFixed(1)}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                              Base Score
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                          <span>📐 {(base.cos_sim * 100).toFixed(0)}% cos-sim</span>
                          <span>🔬 {base.substitute.molecule_count} molecules</span>
                        </div>
                        <div style={{ marginTop: 'auto' }} />
                        <ScoreBar value={base.score} max={10} color="var(--text-muted)" />
                      </div>
                    </Link>
                  ) : <div key={`b-empty-${idx}`} style={{ '--m-order': idx + 1 } as React.CSSProperties} />,
                  ctx ? (
                    <Link
                      key={`c-${ctx.name}`}
                      href={`/ingredient/${encodeURIComponent(ctx.name)}`}
                      style={{ textDecoration: 'none', '--m-order': 1001 + idx } as React.CSSProperties}
                    >
                      <div className="card" style={{
                        padding: '16px 20px', cursor: 'pointer', height: '100%', boxSizing: 'border-box',
                        display: 'flex', flexDirection: 'column',
                        border: '1px solid rgba(0,212,170,0.25)',
                        background: 'linear-gradient(135deg, rgba(0,212,170,0.03), rgba(124,92,252,0.03))',
                        boxShadow: '0 4px 18px rgba(0,0,0,0.15)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{
                              fontSize: 12, fontWeight: 700, color: 'var(--accent)',
                              width: 22, height: 22, borderRadius: 99, background: 'rgba(0,212,170,0.15)',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              border: '1px solid rgba(0,212,170,0.3)'
                            }}>
                              #{idx + 1}
                            </span>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                                  {fmt(ctx.name)}
                                </span>
                                <RankBadge change={ctx.rank_change} />
                              </div>
                              {ctx.label && (
                                <span className={`badge ${badgeClass(ctx.label)}`} style={{ fontSize: 10, marginTop: 4 }}>
                                  {ctx.label}
                                </span>
                              )}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)', fontFamily: 'Space Grotesk' }}>
                              {ctx.final_score.toFixed(1)}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                              Fused / 10
                            </div>
                          </div>
                        </div>

                        {/* Breakdown pills */}
                        <div style={{
                          display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)',
                          marginTop: 8, marginBottom: 8, flexWrap: 'wrap'
                        }}>
                          <span>🧪 Base: <strong style={{ color: 'var(--text-primary)' }}>{(ctx.base_score * 10).toFixed(1)}</strong></span>
                          <span>🤝 Recipe Fit: <strong style={{ color: 'var(--accent)' }}>{ctx.recipe_fit.toFixed(3)}</strong></span>
                          <span>📐 {(ctx.cos_sim * 100).toFixed(0)}% cos-sim</span>
                        </div>

                        {/* Boosters breakdown */}
                        {ctx.boosters.length > 0 && (
                          <div style={{
                            display: 'flex', gap: 6, flexWrap: 'wrap',
                            alignItems: 'center', marginTop: 10, paddingTop: 8,
                            borderTop: '1px solid rgba(255,255,255,0.06)'
                          }}>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Harmonises with:</span>
                            {ctx.boosters.slice(0, 4).map((b, bIdx) => (
                              <span
                                key={bIdx}
                                style={{
                                  fontSize: 10, fontWeight: 500,
                                  background: 'rgba(0,212,170,0.1)', color: 'var(--accent)',
                                  border: '1px solid rgba(0,212,170,0.25)',
                                  borderRadius: 99, padding: '2px 8px',
                                }}
                              >
                                {fmt(b.name)}
                              </span>
                            ))}
                          </div>
                        )}

                        <div style={{ marginTop: 'auto' }} />
                        <ScoreBar value={ctx.final_score} max={10} color="var(--accent)" />
                      </div>
                    </Link>
                  ) : <div key={`c-empty-${idx}`} style={{ '--m-order': 1001 + idx } as React.CSSProperties} />,
                ];
              })}
            </div>
          </div>
        )}

        {/* Empty placeholder guide */}
        {!contextResults && !loading && (
          <div style={{
            textAlign: 'center', padding: '64px 24px',
            border: '1px dashed var(--border)', borderRadius: 20, marginTop: 16
          }}>
            <div style={{ fontSize: 52, marginBottom: 20 }}>🍽️</div>
            <h2 style={{ fontSize: 20, marginBottom: 10, color: 'var(--text-secondary)' }}>
              Select a benchmark recipe or enter your custom dish
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 480, margin: '0 auto 24px', lineHeight: 1.6 }}>
              Click any of the quick benchmark buttons at the top (like Chicken Biryani, Spaghetti Carbonara, or Basil Pesto) to immediately evaluate context-aware substitution.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                className="btn-primary"
                onClick={() => {
                  const b = PRESET_RECIPES[0];
                  selectPreset(b);
                  runRerank(fmt(b.defaultTarget), b.ingredients);
                }}
              >
                🚀 Run Chicken Biryani Benchmark
              </button>
              <button
                className="btn-ghost"
                onClick={() => {
                  const c = PRESET_RECIPES[1];
                  selectPreset(c);
                  runRerank(fmt(c.defaultTarget), c.ingredients);
                }}
              >
                🍝 Run Carbonara Benchmark
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ContextPage() {
  return (
    <Suspense fallback={
      <div className="container" style={{ padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>⏳</div>
        <div style={{ fontSize: 16, color: 'var(--text-muted)' }}>Loading Context Reranker…</div>
      </div>
    }>
      <ContextRerankerInner />
    </Suspense>
  );
}
