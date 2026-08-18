export interface FoodItem {
  name: string;
  weight_g: number;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  confidence?: 'high' | 'medium' | 'low';
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'supper' | 'extrasnack';

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

export interface UserProfile {
  hasProfile: boolean;
  age: number;
  gender: 'male' | 'female';
  weight: number; // kg
  height: number; // cm
  activityLevel: number; // multiplier: 1.2, 1.375, 1.55, 1.725, 1.9
  goalType: 'loss' | 'maintenance' | 'gain';
  calorieAdjustment: number; // 300-500, etc.
  macroSplitType: 'percentage' | 'fixed';
  fixedProteinPerKg: number; // e.g., 2.0
  fixedFatPerKg: number; // e.g., 0.8
  macroPercentages: {
    protein: number;
    carbs: number;
    fats: number;
  };
}

export interface WeightLog {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  weight_kg: number;
}

export interface AppSettings {
  geminiApiKey: string;
  model: string;
  goals: UserGoals;
  profile: UserProfile;
  // Supabase Cloud Sync settings
  useSupabase: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  language?: 'pt' | 'en';
}

export interface FavoriteMeal {
  id: string;
  name: string;
  items: FoodItem[];
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fats: number;
}
