// CoSyLab RecipeDB integration for GastroGraph Web

export interface RecipeNutrition {
  caloriesPerServing: number;
  servings: string;
  totalEnergyKcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export interface RecipeItem {
  id: string;
  title: string;
  cuisine: string;
  ingredients: string[];
  defaultTarget?: string;
  source?: 'recipedb_live';
  instructions?: string[];
  nutrition?: RecipeNutrition;
}

const STRIP_WORDS = new Set([
  'cup', 'cups', 'tbsp', 'tablespoon', 'tablespoons', 'tsp', 'teaspoon', 'teaspoons',
  'ounce', 'ounces', 'oz', 'lb', 'lbs', 'pound', 'pounds', 'gram', 'grams', 'g', 'kg',
  'pinch', 'clove', 'cloves', 'slice', 'slices', 'piece', 'pieces', 'can', 'cans',
  'fresh', 'freshly', 'chopped', 'diced', 'minced', 'sliced', 'grated', 'shredded',
  'crushed', 'ground', 'boneless', 'skinless', 'cooked', 'dry', 'dried', 'large',
  'medium', 'small', 'cold', 'hot', 'warm', 'pure', 'extra', 'virgin', 'coarse',
  'fine', 'taste', 'needed', 'optional', 'drained', 'rinsed', 'halved', 'toasted', 'all', 'purpose'
]);

const ALIASES: Record<string, string> = {
  'onion': 'brown_onion',
  'onions': 'brown_onion',
  'yellow_onion': 'brown_onion',
  'white_onion': 'brown_onion',
  'rice': 'basmati_rice',
  'white_rice': 'basmati_rice',
  'salt': 'sea_salt',
  'table_salt': 'sea_salt',
  'pepper': 'black_pepper',
  'pasta': 'spaghetti',
  'noodles': 'egg_noodle',
  'cream': 'heavy_cream',
  'milk': 'cow_milk',
  'paneer': 'paneer_cheese',
  'parmesan': 'parmesan_cheese',
  'mozzarella': 'mozzarella_cheese',
  'cheddar': 'cheddar_cheese',
  'feta': 'feta_cheese',
  'chicken_breast': 'chicken',
  'chicken_thigh': 'chicken',
  'tomatoes': 'tomato',
  'potatoes': 'potato',
  'carrots': 'carrot',
  'mushrooms': 'mushroom',
  'eggs': 'egg',
  'garlic_cloves': 'garlic',
  'lemon': 'lemon_juice',
  'lime': 'lime_juice',
  'olive': 'olive',
  'olives': 'olive',
};

export function normalizeIngredient(raw: string): string {
  if (!raw) return '';
  let text = raw.toLowerCase().replace(/\(.*?\)/g, '');
  text = text.replace(/\d+[\/\.]?\d*/g, ' ');
  text = text.replace(/[^a-z\s_-]/g, ' ');

  const tokens = text.replace(/[-_]/g, ' ').split(/\s+/).filter(Boolean);
  const filtered = tokens.filter(t => !STRIP_WORDS.has(t));
  const candidate = (filtered.length > 0 ? filtered : tokens).join('_');

  if (ALIASES[candidate]) return ALIASES[candidate];
  return candidate;
}
