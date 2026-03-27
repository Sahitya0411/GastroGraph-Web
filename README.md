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
| 🌐 **Interactive Graph Explorer** | Browse and visualise the full ingredient–molecule graph in the browser |
| 📊 **Ingredient Profiles** | Per-ingredient pages showing molecule count, category, group, and substitutes |
| 📱 **Responsive Design** | Mobile-friendly dark-mode UI with animated transitions |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router) |
| Language | TypeScript 5 |
| Database | [Supabase](https://supabase.com) (PostgreSQL) |
| Graph Rendering | [Sigma.js](https://www.sigmajs.org) + [Graphology](https://graphology.github.io) + ForceAtlas2 |
| Charting | [Recharts](https://recharts.org) |
| Styling | Vanilla CSS (custom design system via `globals.css`) |
| Icons | [Lucide React](https://lucide.dev) |
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
│   ├── finder/
│   │   └── page.tsx              # Substitute Finder (search + results)
│   ├── ingredient-explorer/
│   │   └── page.tsx              # Interactive graph explorer (Sigma.js)
│   └── ingredient/
│       └── [name]/
│           └── page.tsx          # Dynamic ingredient profile page
├── components/
│   ├── Navbar.tsx                # Sticky responsive navigation bar
│   ├── Footer.tsx                # Site footer
│   └── GraphCanvas.tsx           # Animated hero background graph canvas
├── lib/
│   └── supabase.ts               # Supabase client + shared TypeScript types
├── public/
│   ├── GastroGraph2.png          # Logo
│   ├── Dr_Ganesh_Bagler.jpg      # Team photo
│   ├── sahitya.jpeg              # Team photo
│   └── Tripti.jpg                # Team photo
├── next.config.ts
├── tsconfig.json
└── package.json
```

---

## 🔭 Pages

### `/` : Home
Landing page with an animated graph canvas hero, live stats fetched from Supabase (ingredient count, molecule count, edge count, categories), a feature-card section explaining the three-layer pipeline, and a pipeline visual with step-by-step breakdown.

### `/finder` : Substitute Finder
Search bar with real-time autocomplete over all 6,653 ingredient names. On submit, queries Supabase for the ingredient node and its pre-computed substitutes, then renders **Functional**, **Aromatic**, and **Complement** result columns with cosine similarity scores and score bars.

### `/ingredient-explorer` : Graph Explorer
Full interactive force-directed graph powered by Sigma.js and Graphology's ForceAtlas2 layout. Nodes are coloured by type (ingredient vs. molecule) with zoom, pan, and hover tooltips.

### `/ingredient/[name]` : Ingredient Profile
Dynamic route for any ingredient. Shows the ingredient's category, group, connected molecule count, and its substitute recommendations.

### `/about` : About
Project description, team bios (Dr. Ganesh Bagler, Sahitya Sharma, Tripti Kashyap), three-step methodology (Graph Construction → GraphSAGE Training → Substitution Scoring), model hyperparameter table, and data source table.

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
- A [Supabase](https://supabase.com) project with the `nodes`, `edges`, and `substitutes` tables populated

### 1. Clone and install

```bash
git clone https://github.com/Sahitya0411/GastroGraph.git
cd GastroGraph-Web
npm install
```

### 2. Configure environment variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

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

---

## 👥 Team

| Name | Role |
|---|---|
| **Dr. Ganesh Bagler** | Professor · Computational Gastronomy: Research direction, methodology, model architecture |
| **Sahitya Sharma** | Developer · ML Engineer: GraphSAGE training pipeline, embeddings, full-stack web platform |
| **Tripti Kashyap** | Researcher · Data & Literature: Literature review, data collection and curation |

---

## 🔗 Links

- **GitHub (ML research repo):** [github.com/Sahitya0411/GastroGraph](https://github.com/Sahitya0411/GastroGraph)

---

## 📄 License

This project is licensed under the **MIT License**, see the [LICENSE](./LICENSE) file for details.

This project is part of a Bachelor's Thesis Project (BTP) at **IIIT Delhi**.
