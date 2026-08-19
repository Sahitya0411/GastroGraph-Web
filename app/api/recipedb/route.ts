import { NextRequest, NextResponse } from 'next/server';
import { normalizeIngredient, RecipeItem, RecipeNutrition } from '@/lib/recipedb';

// CoSyLab RecipeDB (IIITD) — accessed directly; the key is generated on foodoscope.com
const BASE_URL = (process.env.RECIPEDB_BASE_URL || process.env.NEXT_PUBLIC_RECIPEDB_BASE_URL || 'http://cosylab.iiitd.edu.in:6969').replace(/\/+$/, '');
const API_ROOT = `${BASE_URL}/recipe2-api`;
const API_KEY = process.env.RECIPEDB_API_KEY || '';

async function recipeDB(path: string, timeoutMs = 8000): Promise<any | null> {
  if (!API_KEY) return null;
  try {
    const res = await fetch(`${API_ROOT}/${path}`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      console.warn(`RecipeDB ${path} -> HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn(`RecipeDB ${path} failed:`, err);
    return null;
  }
}

const num = (v: unknown) => {
  const n = parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};

const round = (n: number) => Math.round(n * 10) / 10;

function nutritionFromRecipe(r: any): RecipeNutrition {
  return {
    caloriesPerServing: num(r?.Calories),
    servings: String(r?.servings ?? ''),
    totalEnergyKcal: round(num(r?.['Energy (kcal)'])),
    proteinG: round(num(r?.['Protein (g)'])),
    fatG: round(num(r?.['Total lipid (fat) (g)'])),
    carbsG: round(num(r?.['Carbohydrate, by difference (g)'])),
  };
}

function splitSteps(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.flatMap(s => (typeof s === 'string' ? [s] : splitSteps(s?.steps)));
  }
  if (typeof raw === 'string') {
    return raw.split(/\s\.\s|\n/).map(s => s.trim()).filter(Boolean);
  }
  return [];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'search';
  const query = (searchParams.get('q') || '').trim();
  const recipeId = (searchParams.get('id') || '').trim();
  const hasLiveKey = Boolean(API_KEY);

  // 1. Search by dish title — recipeByTitle
  if (action === 'search') {
    if (!query) {
      return NextResponse.json({ recipes: [], source: 'recipedb_live', hasLiveKey });
    }

    const json = await recipeDB(`recipe-bytitle/recipeByTitle?title=${encodeURIComponent(query)}`);
    const items: any[] = Array.isArray(json?.data) ? json.data : [];
    const recipes: RecipeItem[] = items.slice(0, 15).map(item => ({
      id: String(item.Recipe_id),
      title: item.Recipe_title || 'Untitled Recipe',
      cuisine: item.Region || item.Continent || 'Global',
      ingredients: [],
      source: 'recipedb_live',
    }));
    return NextResponse.json({
      recipes,
      source: 'recipedb_live',
      hasLiveKey,
      ...(json === null ? { error: 'RecipeDB unreachable (needs IIITD network and RECIPEDB_API_KEY)' } : {}),
    });
  }

  // 2. Recipe details, ingredients, macros and instructions — search-recipe/{id}
  if (action === 'recipe' && recipeId) {
    const json = await recipeDB(`search-recipe/${encodeURIComponent(recipeId)}`);
    if (json?.data?.recipe) {
      const { recipe: r, ingredients: rawIngs, instructions: rawSteps } = json.data;

      const ingredients: string[] = [];
      for (const item of Array.isArray(rawIngs) ? rawIngs : []) {
        const name = typeof item === 'string' ? item : (item?.ingredient || item?.name || '');
        const norm = normalizeIngredient(name);
        if (norm && !ingredients.includes(norm)) ingredients.push(norm);
      }

      let instructions = splitSteps(rawSteps);
      if (instructions.length === 0) {
        const ins = await recipeDB(`instructions/${encodeURIComponent(recipeId)}`);
        instructions = splitSteps(ins?.data?.steps ?? ins?.steps);
      }

      const recipe: RecipeItem = {
        id: recipeId,
        title: r.Recipe_title || recipeId,
        cuisine: r.Region || r.Continent || 'Global',
        ingredients,
        instructions,
        nutrition: nutritionFromRecipe(r),
        source: 'recipedb_live',
      };
      return NextResponse.json({ recipe, source: 'recipedb_live' });
    }

    return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
  }

  // 3. Instructions only — instructions/{recipe_id}
  if (action === 'instructions' && recipeId) {
    const json = await recipeDB(`instructions/${encodeURIComponent(recipeId)}`);
    const steps = splitSteps(json?.data?.steps ?? json?.steps);
    if (steps.length === 0) return NextResponse.json({ error: 'Instructions not found' }, { status: 404 });
    return NextResponse.json({ recipeId, steps, source: 'recipedb_live' });
  }

  // 4. Per-ingredient macro breakdown — recipe-nutri/nutritioninfo
  // (micronutritioninfo ignores recipeId server-side, so it is not used here)
  if (action === 'nutrition' && recipeId) {
    const json = await recipeDB(`recipe-nutri/nutritioninfo?recipeId=${encodeURIComponent(recipeId)}&page=1&limit=100`, 15000);
    const rows: any[] = (Array.isArray(json?.data) ? json.data : []).filter((r: any) => String(r.Recipe_id) === recipeId);
    if (rows.length === 0) return NextResponse.json({ error: 'Nutrition not found' }, { status: 404 });

    const perIngredient = rows.map(r => ({
      ingredient: normalizeIngredient(r.ingredientName || '') || String(r.ndb_id),
      kcal: round(num(r['Energy (kcal)'])),
      proteinG: round(num(r['Protein (g)'])),
      fatG: round(num(r['Total lipid (fat) (g)'])),
      carbsG: round(num(r['Carbohydrate, by difference (g)'])),
      fiberG: round(num(r['Fiber, total dietary (g)'])),
      sodiumMg: round(num(r['Sodium, Na (mg)'])),
      cholesterolMg: round(num(r['Cholesterol (mg)'])),
    }));
    const totals = perIngredient.reduce(
      (acc, r) => {
        for (const k of ['kcal', 'proteinG', 'fatG', 'carbsG', 'fiberG', 'sodiumMg', 'cholesterolMg'] as const) {
          acc[k] = round(acc[k] + r[k]);
        }
        return acc;
      },
      { kcal: 0, proteinG: 0, fatG: 0, carbsG: 0, fiberG: 0, sodiumMg: 0, cholesterolMg: 0 },
    );
    return NextResponse.json({ recipeId, perIngredient, totals, source: 'recipedb_live' });
  }

  return NextResponse.json({ error: `Unknown action "${action}"` }, { status: 400 });
}
