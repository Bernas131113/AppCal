import type { Meal, AppSettings, FavoriteMeal } from '../types';

const STORAGE_KEYS = {
  SETTINGS: 'appcal_settings',
  MEALS: 'appcal_meals',
  FAVORITES: 'appcal_favorites',
};

const DEFAULT_PROFILE = {
  hasProfile: false,
  age: 30,
  gender: 'male' as const,
  weight: 70,
  height: 175,
  activityLevel: 1.375,
  goalType: 'maintenance' as const,
  calorieAdjustment: 300,
  macroSplitType: 'percentage' as const,
  fixedProteinPerKg: 2.0,
  fixedFatPerKg: 0.8,
  macroPercentages: {
    protein: 30,
    carbs: 40,
    fats: 30,
  },
};

const DEFAULT_SETTINGS: AppSettings = {
  geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
  model: 'gemini-1.5-flash',
  goals: {
    calories: 2000,
    protein: 130,
    carbs: 220,
    fats: 65,
  },
  profile: DEFAULT_PROFILE,
  useSupabase: !!import.meta.env.VITE_SUPABASE_URL,
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
};

export const getSettings = (): AppSettings => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!data) return DEFAULT_SETTINGS;
    
    const parsed = JSON.parse(data);
    if (parsed.model === 'gemini-2.5-pro') {
      parsed.model = 'gemini-1.5-flash';
    }
    
    // Merge defaults to handle schema updates smoothly
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      goals: {
        ...DEFAULT_SETTINGS.goals,
        ...(parsed.goals || {}),
      },
      profile: {
        ...DEFAULT_SETTINGS.profile,
        ...(parsed.profile || {}),
        macroPercentages: {
          ...DEFAULT_SETTINGS.profile.macroPercentages,
          ...(parsed.profile?.macroPercentages || {}),
        },
      },
    };
  } catch (e) {
    console.error('Erro ao ler configurações do localStorage', e);
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = (settings: AppSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error('Erro ao guardar configurações no localStorage', e);
  }
};

export const getMeals = (): Meal[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.MEALS);
    if (!data) return [];
    
    const meals: Meal[] = JSON.parse(data);
    // Sort meals from newest to oldest
    return meals.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (e) {
    console.error('Erro ao ler refeições do localStorage', e);
    return [];
  }
};

export const saveMeals = (meals: Meal[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.MEALS, JSON.stringify(meals));
  } catch (e) {
    console.error('Erro ao guardar refeições no localStorage', e);
  }
};

export const addMeal = (meal: Meal): Meal[] => {
  const meals = getMeals();
  const updated = [meal, ...meals];
  saveMeals(updated);
  return updated;
};

export const deleteMeal = (id: string): Meal[] => {
  const meals = getMeals();
  const updated = meals.filter(m => m.id !== id);
  saveMeals(updated);
  return updated;
};

export const updateMeal = (updatedMeal: Meal): Meal[] => {
  const meals = getMeals();
  const updated = meals.map(m => m.id === updatedMeal.id ? updatedMeal : m);
  saveMeals(updated);
  return updated;
};

// FAVORITES HELPERS
export const getFavorites = (): FavoriteMeal[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.FAVORITES);
    if (!data) return [];
    return JSON.parse(data);
  } catch (e) {
    console.error('Erro ao ler favoritos do localStorage', e);
    return [];
  }
};

export const saveFavorites = (favorites: FavoriteMeal[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
  } catch (e) {
    console.error('Erro ao guardar favoritos no localStorage', e);
  }
};

export const addFavorite = (fav: FavoriteMeal): FavoriteMeal[] => {
  const favorites = getFavorites();
  // Avoid duplicate names if possible
  const filtered = favorites.filter(f => f.name.toLowerCase() !== fav.name.toLowerCase());
  const updated = [fav, ...filtered];
  saveFavorites(updated);
  return updated;
};

export const deleteFavorite = (id: string): FavoriteMeal[] => {
  const favorites = getFavorites();
  const updated = favorites.filter(f => f.id !== id);
  saveFavorites(updated);
  return updated;
};
