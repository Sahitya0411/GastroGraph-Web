# GastroGraph Web

> **Intelligent ingredient substitution powered by Graph Neural Networks and computational gastronomy.**

GastroGraph is a full-stack research platform that models culinary ingredients and their underlying flavour molecules as a heterogeneous knowledge graph. A **GraphSAGE** GNN learns rich node embeddings that encode both chemical composition and culinary co-occurrence context. These embeddings are then used to surface three types of ingredient substitutes: **Functional**, **Aromatic**, and **Complementary**, through a multi-signal scoring pipeline.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🕸️ **Knowledge Graph** | 8,298 nodes (6,653 ingredients + 1,645 molecules) connected by 147,179 edges with TF-IDF weighting |
| 🧠 **GraphSAGE Embeddings** | Two-layer GNN producing 64-dimensional node embeddings trained via link prediction |
| 🔄 **Substitute Finder** | Functional, Aromatic, and Complementary substitute types with ranked scoring |
| 🎯 **Context Reranker** | Re-ranks substitutes for a specific dish, fusing the GraphSAGE score with recipe co-occurrence fit |
| 🍳 **RecipeDB Integration** | Live dish search, ingredients, nutrition and instructions from CoSyLab RecipeDB |
| 🌐 **Interactive Graph Explorer** | Visualise an ingredient's co-pair and molecule neighbourhood; compare several ingredients at once |
| 📊 **Ingredient Profiles** | Per-ingredient pages showing molecule count, category, group, and substitutes |
| 📱 **Responsive Design** | Mobile-friendly dark-mode UI with animated transitions |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router) |
| Language | TypeScript 5 |
| Data | Local JSON tables in `data/db/` (served via Next.js API routes) + [CoSyLab RecipeDB API](https://cosylab.iiitd.edu.in) |
| Graph Rendering | HTML Canvas (custom force layout) |
| Charting | [Recharts](https://recharts.org) |
| Styling | Vanilla CSS (custom design system via `globals.css`) |
| Fonts | Space Grotesk, Inter (Google Fonts) |

---

## 📁 Project Structure

```
GastroGraph-Web/
├── app/
│   ├── page.tsx                  # Home / landing page
│   ├── layout.tsx                # Root layout (Navbar + Footer)
│   ├── globals.css               # Global design system & tokens
│   ├── about/
│   │   └── page.tsx              # About page (team, methodology, data sources)
│   ├── api/
│   │   ├── db/route.ts           # Read-only query endpoint over data/db/*.json
│   │   └── recipedb/route.ts     # Proxy to CoSyLab RecipeDB (search, recipe, nutrition, instructions)
│   ├── context/
│   │   └── page.tsx              # Context Reranker (recipe-aware substitution)
│   ├── finder/
│   │   └── page.tsx              # Substitute Finder (search + results)
│   ├── ingredient-explorer/
│   │   └── page.tsx              # Interactive graph explorer (canvas)
│   └── ingredient/
│       └── [name]/
│           └── page.tsx          # Dynamic ingredient profile page
├── components/
│   ├── Navbar.tsx                # Sticky responsive navigation bar
│   ├── Footer.tsx                # Site footer
│   └── GraphCanvas.tsx           # Animated hero background graph canvas
├── data/
│   └── db/                       # nodes.json, edges.json, substitutes.json (graph tables)
├── lib/
│   ├── db.ts                     # Browser data client (via /api/db) + shared TypeScript types
│   ├── localdb/                  # Query builder + server-side engine over data/db/*.json
│   └── recipedb.ts               # RecipeDB types + ingredient normalisation
├── public/
│   ├── GastroGraph2.png          # Logo
│   ├── Dr_Ganesh_Bagler.jpg      # Team photo
│   └── sahitya.jpeg              # Team photo
├── next.config.ts
├── tsconfig.json
└── package.json
```

---

## 🔭 Pages

### `/` : Home
Landing page with an animated graph canvas hero, live stats computed from the graph tables (ingredient count, molecule count, edge count, categories), a feature-card section explaining the three-layer pipeline, and a pipeline visual with step-by-step breakdown.

### `/finder` : Substitute Finder
Search bar with real-time autocomplete over all 6,653 ingredient names (best matches first: exact, then prefix, then word, then substring). On submit, looks up the ingredient node and its pre-computed substitutes, then renders **Functional**, **Aromatic**, and **Complement** result columns with cosine similarity scores and score bars.

### `/context` : Context Reranker
Pick the ingredient to replace and a dish. Typing a dish name searches RecipeDB live; selecting a result auto-fills its ingredients and shows calories per serving, macros and step-by-step instructions. The top GastroGraph substitutes are then re-ranked for that dish:

```
final = 10 × (α · base_score + β · recipe_fit)      # default α = 0.60, β = 0.40
```

`recipe_fit` is the average `CO_OCCURS` weight between a candidate and the dish's ingredients. Results are shown side by side (context-blind baseline vs. context-aware), with rank shifts and the dish ingredients that boosted each candidate. α and β are adjustable with sliders; quick benchmark dishes (Chicken Biryani, Spaghetti Carbonara, …) are one click away.

### `/ingredient-explorer` : Graph Explorer
Search with autocomplete and add one or more ingredients. The canvas draws each ingredient's co-pair ingredients and molecules as a force-directed graph; with several ingredients, shared co-pairs and shared molecules are highlighted. Molecule nodes can be toggled, hovering shows details, and clicking an ingredient opens its profile.

### `/ingredient/[name]` : Ingredient Profile
Dynamic route for any ingredient. Shows the ingredient's category, group, connected molecule count, and its substitute recommendations.

### `/about` : About
Project description, team bios (Dr. Ganesh Bagler, Sahitya Sharma), three-step methodology (Graph Construction → GraphSAGE Training → Substitution Scoring), model hyperparameter table, and data source table.

---

## ⚙️ The ML Pipeline

### Step 1: Graph Construction
Ingredient and molecule nodes are loaded from CSV files. Two edge types are constructed:
- **`CO_OCCURS`**: ingredient pairs that appear together in recipes (TF-IDF scored)
- **`CONTAINS`**: ingredient → molecule relationships

```bash
python src/build_graph.py   # → gastro_graph.gpickle
```

### Step 2: GraphSAGE Training
A 2-layer GraphSAGE model is trained via link prediction over 100 epochs to produce 64-dimensional embeddings per node.

| Parameter | Value |
|---|---|
| Architecture | GraphSAGE (2-layer) |
| Epochs | 100 |
| Learning Rate | 0.01 |
| Hidden Dim | 128 |
| Output Dim | 64 |
| Batch Size (edges) | 2,048 |
| Dropout | 0.2 |
| Objective | Link Prediction |
| Random Seed | 42 |

```bash
python src/train.py         # → node_embeddings.npy
```

### Step 3: Substitution Scoring
Three substitute types are scored using a weighted formula:

```
sim(a, b)    = cos(e_a, e_b)
mol_overlap  = |M(a) ∩ M(b)| / |M(a) ∪ M(b)|
score        = α·sim + β·mol_pct + γ·ctx
```

- **Functional**: cosine similarity in embedding space
- **Aromatic**: molecular overlap in aroma context
- **Complement**: disjoint context pairing scores

---

## 🗄️ Data Sources

The web app reads three tables from `data/db/` (exported from the research pipeline, ~11 MB in total):

| Table | Rows | Contents |
|---|---|---|
| `nodes.json` | 8,298 | Ingredient & molecule nodes (name, type, category, molecule count) |
| `edges.json` | 147,179 | `CO_OCCURS` and `CONTAINS` edges with weights |
| `substitutes.json` | 52,996 | Pre-computed functional / aromatic / complement substitutes per ingredient |

They are loaded into memory once per server process and queried through `lib/localdb` (server components call it directly, client components go through `/api/db`), so the browser never downloads the full graph.

These were built in the [research repo](https://github.com/Sahitya0411/GastroGraph) from:

| File | Records | Description |
|---|---|---|
| `nodes_191120.csv` | 8,298 nodes | Ingredient & molecule nodes with type labels |
| `edges_191120.csv` | 147,179 edges | CO_OCCURS (ingr-ingr) and CONTAINS (ingr-mol) relationships |
| `node_classification_hub.csv` | 8 hub categories | Coarse ingredient classification |
| `dict_ingr2cate….csv` | 616 mappings | Ingredient-to-fine-category mapping |
| `fine_categories.csv` | 90 fine / 35 broad | Priority-ordered culinary taxonomy (keyword matching) |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** ≥ 18
- A RecipeDB API key from [Foodoscope](https://www.foodoscope.com/) (optional; needed only for live recipe lookup, which works on the IIITD network)

### 1. Clone and install

```bash
git clone https://github.com/Sahitya0411/GastroGraph-Web.git
cd GastroGraph-Web
npm install
```

### 2. Configure environment variables

Create a `.env.local` file in the project root:

```env
RECIPEDB_API_KEY=your-recipedb-api-key
NEXT_PUBLIC_RECIPEDB_BASE_URL=http://cosylab.iiitd.edu.in:6969
```

The graph data (`nodes`, `edges`, `substitutes`) ships with the repo in `data/db/`, so no database is needed. Without a RecipeDB key everything works except live dish search on the Context Reranker.

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Available scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server (kills any existing Next.js process first) |
| `npm run build` | Build for production |
| `npm start` | Start the production server |
| `npm run lint` | Run ESLint |

### Deploying

The app deploys as a standard Next.js project (e.g. Vercel). `next.config.ts` bundles `data/db/*.json` with every server route, so no external database is required. Set `RECIPEDB_API_KEY` (and optionally `RECIPEDB_BASE_URL`) in the host's environment variables.

> **Note:** the CoSyLab RecipeDB server only accepts requests from the IIIT Delhi network, so live dish search will report "RecipeDB unreachable" on hosts outside it. All graph features keep working.

---

## 👥 Team

| Name | Role |
|---|---|
| **Dr. Ganesh Bagler** | Professor · Computational Gastronomy: Research direction, methodology, model architecture |
| **Sahitya Sharma** | Developer · ML Engineer · Researcher: Literature review, data curation, GraphSAGE training pipeline, embeddings, full-stack web platform |

---

## 🔗 Links

- **GitHub (web app):** [github.com/Sahitya0411/GastroGraph-Web](https://github.com/Sahitya0411/GastroGraph-Web)
- **GitHub (ML research repo):** [github.com/Sahitya0411/GastroGraph](https://github.com/Sahitya0411/GastroGraph)
- **RecipeDB API:** [foodoscope.com](https://www.foodoscope.com/) (API keys) · `cosylab.iiitd.edu.in:6969/recipe2-api`

---

## 📄 License

This project is licensed under the **MIT License**, see the [LICENSE](./LICENSE) file for details.

This project is part of a Bachelor's Thesis Project (BTP) at **IIIT Delhi**.
