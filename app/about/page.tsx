import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About - GastroGraph',
  description: 'The methodology behind GastroGraph - graph construction, GraphSAGE training, context-aware reranking, and ablation study results.',
};

const MODEL_PARAMS = [
  { param: 'Architecture', value: 'GraphSAGE (2-layer)' },
  { param: 'Epochs', value: '100' },
  { param: 'Learning Rate', value: '0.01' },
  { param: 'Hidden Dim', value: '128' },
  { param: 'Output Dim', value: '64 (embeddings)' },
  { param: 'Batch Size (edges)', value: '2,048' },
  { param: 'Dropout', value: '0.2' },
  { param: 'Objective', value: 'Link Prediction' },
  { param: 'Random Seed', value: '42' },
];

const CONTEXT_PARAMS = [
  { param: 'Alpha (α)', value: '0.60 — GastroGraph baseline score weight' },
  { param: 'Beta (β)', value: '0.40 — Recipe co-occurrence fit weight' },
  { param: 'Fit formula', value: 'fit(c, R) = (1/|R|) Σ w(c, r)  for r in R' },
  { param: 'Fusion', value: 'final(c) = 10 × (α × s_GastroGraph + β × fit_norm)' },
  { param: 'Normalisation', value: 'Min-max fit_norm across candidate pool' },
  { param: 'Context source', value: 'CoSyLab RecipeDB API / local curated / user-provided' },
  { param: 'Pool size', value: 'Top-20 functional candidates fed to reranker' },
];

const DATA_SOURCES = [
  { file: 'nodes_191120.csv', records: '8,298 nodes', description: 'Ingredient & molecule nodes with type labels' },
  { file: 'edges_191120.csv', records: '147,179 edges', description: 'CO_OCCURS (ingr-ingr) and CONTAINS (ingr-mol) relationships' },
  { file: 'node_classification_hub.csv', records: '8 hub categories', description: 'Coarse ingredient classification' },
  { file: 'dict_ingr2cate…csv', records: '616 mappings', description: 'Ingredient-to-fine-category mapping' },
  { file: 'fine_categories.csv', records: '90 fine / 35 broad categories', description: 'Priority-ordered culinary taxonomy (keyword matching)' },
  { file: 'curated_recipes.json', records: '20+ benchmark dishes', description: 'Hand-curated culinary ground-truth for context evaluation' },
];

// Ablation study results (from ablation_embeddings.py run)
const ABLATION_RESULTS = [
  {
    label: 'TF-IDF Cosine (no GNN)',
    mean: 14.2,
    std: 8.1,
    color: '#fbbf24',
    pVsGraphSage: '0.003',
    description: 'Raw TF-IDF molecular overlap cosine similarity — no graph traversal or neighbourhood aggregation.',
  },
  {
    label: 'node2vec',
    mean: 18.7,
    std: 9.4,
    color: '#60a5fa',
    pVsGraphSage: '0.041',
    description: 'node2vec biased random-walk + Word2Vec (80-step walks, 10 walks/node, 64-dim).',
  },
  {
    label: 'GraphSAGE (full)',
    mean: 26.3,
    std: 10.5,
    color: '#10b981',
    pVsGraphSage: '—',
    description: 'Two-layer GraphSAGE trained with link-prediction objective, 128→64d, 100 epochs.',
  },
];

export default function AboutPage() {
  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        borderBottom: '1px solid var(--border)',
        padding: '48px 0 40px',
        background: 'linear-gradient(180deg, rgba(245,158,11,0.05) 0%, transparent 100%)',
      }}>
        <div className="container">
          <div className="badge badge-amber" style={{ marginBottom: 16, display: 'inline-flex' }}>🍽️ About the Project</div>
          <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)', marginBottom: 12 }}>
            About <span style={{ color: '#f59e0b' }}>GastroGraph</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 680, fontSize: 15, lineHeight: 1.8 }}>
            GastroGraph is a computational gastronomy platform that models the complex relationships
            between culinary ingredients and their underlying flavour molecules as a heterogeneous
            knowledge graph. It learns 64-dimensional node embeddings via a two-layer GraphSAGE model
            trained with unsupervised link-prediction, then applies a <strong style={{ color: 'var(--text-primary)' }}>Disjoint-Context Recommender</strong> that
            jointly scores candidates along three orthogonal axes — molecular compound overlap,
            embedding cosine similarity, and category-aware compatibility. A&nbsp;
            <strong style={{ color: 'var(--accent)' }}>Context-Aware Reranker</strong> further fuses the baseline score with
            recipe co-occurrence fit (α=0.60, β=0.40), producing strictly separated outputs for
            functional substitutes, aromatic pairings, recipe complements, and context-aware substitutes.
          </p>
          <div style={{ marginTop: 24 }}>
            <a
              href="https://github.com/Sahitya0411/GastroGraph"
              target="_blank"
              rel="noopener noreferrer"
              className="github-btn"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
              </svg>
              View on GitHub
            </a>
          </div>
        </div>
      </div>

      <div className="container" style={{ padding: '60px 24px' }}>



        {/* ── Team Section ── */}
        <div style={{ marginBottom: 72 }}>
          <h2 style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)', marginBottom: 8 }}>
            Meet the <span style={{ color: 'var(--accent)' }}>Team</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7, marginBottom: 40, maxWidth: 620 }}>
            GastroGraph emerged from a close collaboration between a faculty mentor and a student
            researcher, uniting computational gastronomy expertise, machine learning engineering,
            and rigorous scientific investigation.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 28, maxWidth: 760 }}>

            {/* Dr. Ganesh Bagler */}
            <div className="card" style={{ textAlign: 'center', padding: '36px 28px' }}>
              <div style={{
                width: 96, height: 96, borderRadius: '50%', margin: '0 auto 20px',
                border: '2px solid var(--accent)',
                overflow: 'hidden', boxShadow: '0 0 0 4px rgba(245,158,11,0.12)',
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/Dr_Ganesh_Bagler.jpg"
                  alt="Dr. Ganesh Bagler"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>Dr. Ganesh Bagler</div>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: 'var(--accent)', marginBottom: 16,
              }}>
                Professor · Computational Gastronomy
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.75 }}>
                Defined and guided the overall research approach and methodology, directing key decisions
                around graph architecture and the GraphSAGE model design. Provided deep expertise in
                computational gastronomy, shaping the scientific framing of the substitution scoring pipeline
                and ensuring the work is grounded in established food-science principles.
              </p>
              <div style={{ marginTop: 18, display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {['Research Direction', 'Methodology', 'Model Architecture'].map(tag => (
                  <span key={tag} style={{
                    background: 'rgba(245,158,11,0.1)', color: 'var(--accent)',
                    border: '1px solid rgba(245,158,11,0.25)',
                    borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600,
                  }}>{tag}</span>
                ))}
              </div>
            </div>

            {/* Sahitya Sharma */}
            <div className="card" style={{ textAlign: 'center', padding: '36px 28px' }}>
              <div style={{
                width: 96, height: 96, borderRadius: '50%', margin: '0 auto 20px',
                border: '2px solid #a78bfa',
                overflow: 'hidden', boxShadow: '0 0 0 4px rgba(167,139,250,0.12)',
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/sahitya.jpeg"
                  alt="Sahitya Sharma"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>Sahitya Sharma</div>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: '#a78bfa', marginBottom: 16,
              }}>
                Developer · ML Engineer · Researcher
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.75 }}>
                Conducted an extensive literature review across computational gastronomy, flavour
                pairing theory, and graph-based food science, and led the data collection and curation
                pipeline. Implemented the end-to-end GraphSAGE training pipeline, tuned model
                hyperparameters, and generated the node embeddings that power ingredient substitution
                scoring. Also designed and built the entire GastroGraph web platform, from Supabase
                data APIs to the interactive ingredient explorer and this site.
              </p>
              <div style={{ marginTop: 18, display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {['ML Training', 'GraphSAGE', 'Full-Stack Dev', 'Literature Review', 'Data Curation', 'Food Science Research'].map(tag => (
                  <span key={tag} style={{
                    background: 'rgba(167,139,250,0.1)', color: '#a78bfa',
                    border: '1px solid rgba(167,139,250,0.25)',
                    borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600,
                  }}>{tag}</span>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* ── Methodology Header ── */}
        <div style={{ marginBottom: 40 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 12,
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700,
            color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>⚙️ Methodology</div>
          <h2 style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)', marginBottom: 10 }}>
            How It <span style={{ color: 'var(--accent)' }}>Works</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7, maxWidth: 600 }}>
            A three-step research pipeline combining food chemistry databases, graph theory,
            and Graph Neural Networks to power intelligent ingredient substitution.
          </p>
        </div>

        {/* Pipeline */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, marginBottom: 72 }}>
          {/* Step 1 */}
          <div className="card" style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: 20, right: 20, fontSize: 40, opacity: 0.08, fontFamily: 'Space Grotesk', fontWeight: 900 }}>01</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.12em', marginBottom: 12, textTransform: 'uppercase' }}>Step 1</div>
            <h2 style={{ fontSize: 20, marginBottom: 16 }}>📊 Graph Construction</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7, marginBottom: 16 }}>
              Ingredient and molecular compound nodes are loaded from CSV files. Two
              types of edges are constructed:
            </p>
            <ul style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.8, paddingLeft: 20 }}>
              <li><strong style={{ color: 'var(--accent)' }}>CO_OCCURS</strong>: ingredient pairs that appear together in recipes (scored)</li>
              <li><strong style={{ color: '#a78bfa' }}>CONTAINS</strong>: ingredient-molecule relationships with TF-IDF weighting</li>
            </ul>
            <div style={{ marginTop: 20, background: 'var(--bg-elevated)', borderRadius: 10, padding: 16, fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>
              <div style={{ color: 'var(--accent)' }}>python src/build_graph.py</div>
              <div>→ gastro_graph.gpickle</div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="card" style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: 20, right: 20, fontSize: 40, opacity: 0.08, fontFamily: 'Space Grotesk', fontWeight: 900 }}>02</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.12em', marginBottom: 12, textTransform: 'uppercase' }}>Step 2</div>
            <h2 style={{ fontSize: 20, marginBottom: 16 }}>🧠 GraphSAGE Training</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7, marginBottom: 16 }}>
              A two-layer GraphSAGE model is trained via link prediction to produce
              64-dimensional node embeddings that capture both chemical and culinary context.
            </p>
            {/* Architecture visual */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
              {['Input\nGraph', 'SAGE\nLayer 1\n128d', 'SAGE\nLayer 2\n64d', 'Node\nEmbeddings'].map((label, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    background: i === 3 ? 'rgba(0,212,170,0.15)' : 'var(--bg-elevated)',
                    border: `1px solid ${i === 3 ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 8, padding: '8px 12px', fontSize: 10,
                    textAlign: 'center', whiteSpace: 'pre-line', color: i === 3 ? 'var(--accent)' : 'var(--text-secondary)',
                    minWidth: 60,
                  }}>{label}</div>
                  {i < 3 && <span style={{ color: 'var(--text-muted)', fontSize: 16 }}>→</span>}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 4, background: 'var(--bg-elevated)', borderRadius: 10, padding: 16, fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>
              <div style={{ color: '#a78bfa' }}>python src/train.py</div>
              <div>→ node_embeddings.npy</div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="card" style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: 20, right: 20, fontSize: 40, opacity: 0.08, fontFamily: 'Space Grotesk', fontWeight: 900 }}>03</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', letterSpacing: '0.12em', marginBottom: 12, textTransform: 'uppercase' }}>Step 3</div>
            <h2 style={{ fontSize: 20, marginBottom: 16 }}>⚗️ Substitution Scoring</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7, marginBottom: 16 }}>
              Three different substitute types are computed using a weighted combination of:
            </p>
            <ul style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.8, paddingLeft: 20, marginBottom: 20 }}>
              <li><strong style={{ color: 'var(--accent)' }}>Functional</strong>: same-group cosine similarity + molecular overlap</li>
              <li><strong style={{ color: '#a78bfa' }}>Aromatic Pairing</strong>: TF-IDF–weighted Jaccard molecule overlap across categories</li>
              <li><strong style={{ color: '#f59e0b' }}>Complement</strong>: direct co-occurrence edge ranking by embedding similarity</li>
            </ul>
            <div style={{
              background: 'var(--bg-elevated)', borderRadius: 10, padding: 16,
              fontFamily: 'monospace', fontSize: 12, color: 'var(--accent)', lineHeight: 1.8,
            }}>
              {'sim(a,b) = cos(e_a, e_b)'}
              <br />
              {'mol_overlap = |M(a) ∩ M(b)| / |M(a) ∪ M(b)|'}
              <br />
              {'_func_score = 0.30·mol + 0.40·cat_bonus + 0.30·cos_norm'}
            </div>
          </div>

          {/* Step 4 */}
          <div className="card" style={{ position: 'relative', borderColor: 'rgba(0,212,170,0.3)', background: 'linear-gradient(135deg, rgba(0,212,170,0.04), rgba(52,211,153,0.04))' }}>
            <div style={{ position: 'absolute', top: 20, right: 20, fontSize: 40, opacity: 0.08, fontFamily: 'Space Grotesk', fontWeight: 900 }}>04</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.12em', marginBottom: 12, textTransform: 'uppercase' }}>Step 4 — New</div>
            <h2 style={{ fontSize: 20, marginBottom: 16 }}>🎯 Context-Aware Reranking</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7, marginBottom: 16 }}>
              Provide a recipe name or ingredient list to trigger the <strong style={{ color: 'var(--text-primary)' }}>ContextAwareReranker</strong>.
              Candidates from the functional pool are reranked by their co-occurrence fit with the recipe context R:
            </p>
            <ul style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.8, paddingLeft: 20, marginBottom: 20 }}>
              <li><strong style={{ color: 'var(--accent)' }}>Exclude</strong> candidates already present in R</li>
              <li><strong style={{ color: 'var(--accent)' }}>Compute</strong> fit(c, R) = (1/|R|) × Σ w(c, r)</li>
              <li><strong style={{ color: 'var(--accent)' }}>Normalise</strong> fit scores (min-max across candidate pool)</li>
              <li><strong style={{ color: 'var(--accent)' }}>Fuse</strong> with baseline via convex combination</li>
            </ul>
            <div style={{
              background: 'var(--bg-elevated)', borderRadius: 10, padding: 16,
              fontFamily: 'monospace', fontSize: 12, color: 'var(--accent)', lineHeight: 1.8,
            }}>
              {'fit(c, R) = (1/|R|) × Σ_{r∈R} w(c, r)'}
              <br />
              {'fit_norm = min-max(fit(c, R))'}
              <br />
              {'final(c) = 10 × (α × s_GastroGraph + β × fit_norm)'}
              <br />
              {'  α = 0.60,  β = 0.40'}
            </div>
          </div>
        </div>

        {/* Context Reranker Parameters */}
        <div style={{ marginBottom: 72 }}>
          <h2 style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)', marginBottom: 8 }}>
            Context Reranker <span style={{ color: 'var(--accent)' }}>Parameters</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7, marginBottom: 28, maxWidth: 620 }}>
            Parameters for the ContextAwareReranker (src/context_reranker.py) that fuses the GastroGraph
            baseline score with recipe co-occurrence fit.
          </p>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)' }}>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>PARAMETER</th>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>VALUE</th>
                </tr>
              </thead>
              <tbody>
                {CONTEXT_PARAMS.map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '14px 20px', fontSize: 14, color: 'var(--text-secondary)' }}>{r.param}</td>
                    <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--accent)', fontFamily: 'monospace', fontWeight: 600 }}>{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Model parameters */}
        <div style={{ marginBottom: 72 }}>
          <h2 style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)', marginBottom: 32 }}>
            GNN Model <span style={{ color: 'var(--accent)' }}>Parameters</span>
          </h2>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)' }}>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>PARAMETER</th>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>VALUE</th>
                </tr>
              </thead>
              <tbody>
                {MODEL_PARAMS.map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '14px 20px', fontSize: 14, color: 'var(--text-secondary)' }}>{r.param}</td>
                    <td style={{ padding: '14px 20px', fontSize: 14, color: 'var(--accent)', fontFamily: 'monospace', fontWeight: 600 }}>{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ablation Study */}
        <div style={{ marginBottom: 72 }}>
          <h2 style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)', marginBottom: 8 }}>
            Embedding <span style={{ color: 'var(--accent)' }}>Ablation Study</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7, marginBottom: 28, maxWidth: 680 }}>
            Metric 2 — Within-Category Ranking Quality: average TF-IDF molecular overlap of the top-5 functional
            substitutes across 50 queries (5 categories × 10 queries). All variants use the identical taxonomy gate
            and composite scorer; only the embedding source differs. Statistical significance via two-sided
            Mann–Whitney U test vs. GraphSAGE.
          </p>

          {/* Bar visual */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 32 }}>
            {ABLATION_RESULTS.map((r, i) => {
              const maxMean = Math.max(...ABLATION_RESULTS.map(x => x.mean));
              const barPct = (r.mean / maxMean) * 100;
              return (
                <div key={i} className="card" style={{ position: 'relative', overflow: 'hidden' }}>
                  <div style={{
                    position: 'absolute', top: 0, left: 0, width: `${barPct}%`, height: 3,
                    background: r.color, borderRadius: '12px 0 0 0',
                  }} />
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: r.color }}>
                      {r.label}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                      {r.description}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: r.color, fontFamily: 'Space Grotesk', lineHeight: 1 }}>
                          {r.mean.toFixed(1)}%
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          ± {r.std.toFixed(1)}% std · n=50
                        </div>
                      </div>
                      {r.pVsGraphSage !== '—' && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>p vs GraphSAGE</div>
                          <div style={{
                            fontSize: 13, fontWeight: 700,
                            color: parseFloat(r.pVsGraphSage) < 0.05 ? '#34d399' : '#f87171',
                            fontFamily: 'monospace',
                          }}>
                            {r.pVsGraphSage}
                          </div>
                        </div>
                      )}
                      {r.pVsGraphSage === '—' && (
                        <span style={{
                          fontSize: 10, background: 'rgba(0,212,170,0.12)',
                          color: 'var(--accent)', border: '1px solid rgba(0,212,170,0.3)',
                          borderRadius: 99, padding: '3px 10px', fontWeight: 700,
                        }}>BASELINE</span>
                      )}
                    </div>
                    {/* Mini bar */}
                    <div style={{ marginTop: 12, height: 4, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: `${barPct}%`, height: '100%', background: r.color, borderRadius: 99, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* LaTeX table hint */}
          <div style={{
            background: 'var(--bg-elevated)', borderRadius: 12, padding: '16px 20px',
            border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Ablation Summary Table
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Embedding', 'Mean Mol Overlap', 'Std Dev', 'p vs GraphSAGE'].map(h => (
                      <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ABLATION_RESULTS.map((r, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 16px', fontWeight: 600, color: r.color }}>{r.label}</td>
                      <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{r.mean.toFixed(1)}%</td>
                      <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>±{r.std.toFixed(1)}%</td>
                      <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: r.pVsGraphSage !== '—' && parseFloat(r.pVsGraphSage) < 0.05 ? '#34d399' : 'var(--text-muted)' }}>{r.pVsGraphSage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              ✱ p-values from two-sided Mann–Whitney U test vs. GraphSAGE. p &lt; 0.05 indicates statistically significant improvement.
              GraphSAGE achieves <strong style={{ color: 'var(--accent)' }}>+85% improvement</strong> over TF-IDF and
              <strong style={{ color: 'var(--accent)' }}> +41% over node2vec</strong> on within-category molecular overlap.
            </div>
          </div>
        </div>

        {/* Data Sources */}
        <div style={{ marginBottom: 72 }}>
          <h2 style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)', marginBottom: 32 }}>
            Data <span style={{ color: 'var(--accent)' }}>Sources</span>
          </h2>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)' }}>
                  {['File', 'Records', 'Description'].map(h => (
                    <th key={h} style={{ padding: '14px 20px', textAlign: 'left', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DATA_SOURCES.map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '14px 20px', fontSize: 13, fontFamily: 'monospace', color: '#a78bfa' }}>{r.file}</td>
                    <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text-secondary)' }}>{r.records}</td>
                    <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text-secondary)' }}>{r.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center', display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
          <Link href="/finder" className="btn-primary" style={{ fontSize: 16, padding: '14px 32px' }}>
            🔍 Try the Substitute Finder
          </Link>
          <a
            href="https://github.com/Sahitya0411/GastroGraph"
            target="_blank"
            rel="noopener noreferrer"
            className="github-btn github-btn-lg"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
            </svg>
            View on GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
