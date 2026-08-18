import type { Meal, AppSettings } from '../types';

const STORAGE_KEYS = {
  SETTINGS: 'appcal_settings',
  MEALS: 'appcal_meals',
};

const DEFAULT_SETTINGS: AppSettings = {
  geminiApiKey: '',
  model: 'gemini-2.5-flash',
  goals: {
    calories: 2000,
    protein: 130,
    carbs: 220,
    fats: 65,
  },
};

export const getSettings = (): AppSettings => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!data) return DEFAULT_SETTINGS;
    
    const parsed = JSON.parse(data);
    // Merge defaults to handle schema updates smoothly
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      goals: {
        ...DEFAULT_SETTINGS.goals,
        ...(parsed.goals || {}),
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
