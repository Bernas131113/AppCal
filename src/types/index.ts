export interface FoodItem {
  name: string;
  weight_g: number;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  confidence?: 'high' | 'medium' | 'low';
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface Meal {
  id: string;
  timestamp: string; // ISO String
  meal_type: MealType;
  items: FoodItem[];
  photos: string[]; // base64 strings
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fats: number;
  notes?: string;
}

export interface UserGoals {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export interface AppSettings {
  geminiApiKey: string;
  model: string;
  goals: UserGoals;
}
