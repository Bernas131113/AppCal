import { createClient } from '@supabase/supabase-js';
import type { Meal, WeightLog, AppSettings } from '../types';

/*
  ========================================================================
  SCRIPT SQL PARA CRIAR AS TABELAS NO SUPABASE (Copy & Paste no SQL Editor)
  ========================================================================

  -- 1. Habilitar UUID
  create extension if not exists "uuid-ossp";

  -- 2. Tabela de logs de peso
  create table public.weight_logs (
      id uuid default gen_random_uuid() primary key,
      user_id uuid references auth.users(id) on delete cascade not null,
      date date not null default current_date,
      weight_kg numeric(5,2) not null,
      created_at timestamp with time zone default timezone('utc'::text, now()) not null
  );

  -- 3. Tabela de refeições
  create table public.meals (
      id uuid default gen_random_uuid() primary key,
      user_id uuid references auth.users(id) on delete cascade not null,
      meal_type text not null,
      logged_at timestamp with time zone not null default now(),
      photos text[] default '{}'::text[], -- URLs ou Base64 das fotos
      total_calories integer not null,
      total_protein numeric(5,1) not null,
      total_carbs numeric(5,1) not null,
      total_fats numeric(5,1) not null,
      notes text,
      created_at timestamp with time zone default timezone('utc'::text, now()) not null
  );

  -- 4. Tabela de itens das refeições (Food Itemization)
  create table public.meal_items (
      id uuid default gen_random_uuid() primary key,
      meal_id uuid references public.meals(id) on delete cascade not null,
      name text not null,
      weight_g numeric(6,1) not null,
      calories integer not null,
      protein numeric(5,1) not null,
      carbs numeric(5,1) not null,
      fats numeric(5,1) not null
  );

  -- 5. Tabela de favoritos
  create table public.favorites (
      id uuid default gen_random_uuid() primary key,
      user_id uuid references auth.users(id) on delete cascade not null,
      name text not null,
      items jsonb not null, -- Guardar ingredientes como json estruturado
      total_calories integer not null,
      total_protein numeric(5,1) not null,
      total_carbs numeric(5,1) not null,
      total_fats numeric(5,1) not null
  );

  -- 6. Configurar RLS (Row Level Security) para segurança dos utilizadores
  alter table public.weight_logs enable row level security;
  alter table public.meals enable row level security;
  alter table public.meal_items enable row level security;
  alter table public.favorites enable row level security;

  -- 7. Criar políticas de segurança para ler e escrever apenas os próprios dados
  create policy "Users can perform actions on own weight logs"
      on public.weight_logs for all using (auth.uid() = user_id);

  create policy "Users can perform actions on own meals"
      on public.meals for all using (auth.uid() = user_id);

  -- meal_items verifica através do parent meal user_id
  create policy "Users can perform actions on own meal items"
      on public.meal_items for all using (
          exists (
              select 1 from public.meals 
              where public.meals.id = public.meal_items.meal_id 
              and public.meals.user_id = auth.uid()
          )
      );

  create policy "Users can perform actions on own favorites"
      on public.favorites for all using (auth.uid() = user_id);
*/

let supabase: any = null;

// Initialize Supabase Client dynamically
export const getSupabaseClient = () => {
  if (supabase) return supabase;
  
  const settings = JSON.parse(localStorage.getItem('appcal_settings') || '{}');
  if (settings.useSupabase && settings.supabaseUrl && settings.supabaseAnonKey) {
    try {
      supabase = createClient(settings.supabaseUrl, settings.supabaseAnonKey);
      return supabase;
    } catch (e) {
      console.error('Falha ao inicializar cliente Supabase:', e);
    }
  }
  return null;
};

// Clear Supabase cache if settings change
export const resetSupabaseClient = () => {
  supabase = null;
};

// ==========================================
// LOCAL MULTI-USER ENGINE (Fallback)
// ==========================================
export interface LocalUser {
  id: string;
  email: string;
  passwordHash: string; // Plaintext representation for simulation
}

const getLocalUsers = (): LocalUser[] => {
  return JSON.parse(localStorage.getItem('appcal_users') || '[]');
};

const saveLocalUsers = (users: LocalUser[]) => {
  localStorage.setItem('appcal_users', JSON.stringify(users));
};

export const getLoggedInUser = (): { id: string; email: string } | null => {
  const user = localStorage.getItem('appcal_current_user');
  return user ? JSON.parse(user) : null;
};

// ==========================================
// AUTHENTICATION INTERFACE (Supabase & Local)
// ==========================================
export const dbSignUp = async (email: string, password: string): Promise<{ user: any; error: string | null }> => {
  const client = getSupabaseClient();
  if (client) {
    const { data, error } = await client.auth.signUp({ email, password });
    return { user: data.user, error: error ? error.message : null };
  } else {
    // Local Simulation
    const users = getLocalUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      return { user: null, error: 'Este e-mail já está registado.' };
    }
    const newUser: LocalUser = {
      id: Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(),
      email,
      passwordHash: password // Mock simulation
    };
    saveLocalUsers([...users, newUser]);
    const sessionUser = { id: newUser.id, email: newUser.email };
    localStorage.setItem('appcal_current_user', JSON.stringify(sessionUser));
    return { user: sessionUser, error: null };
  }
};

export const dbSignIn = async (email: string, password: string): Promise<{ user: any; error: string | null }> => {
  const client = getSupabaseClient();
  if (client) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    return { user: data.user, error: error ? error.message : null };
  } else {
    // Local Simulation
    const users = getLocalUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === password);
    if (!user) {
      return { user: null, error: 'E-mail ou palavra-passe incorretos.' };
    }
    const sessionUser = { id: user.id, email: user.email };
    localStorage.setItem('appcal_current_user', JSON.stringify(sessionUser));
    return { user: sessionUser, error: null };
  }
};

export const dbSignOut = async (): Promise<void> => {
  const client = getSupabaseClient();
  if (client) {
    await client.auth.signOut();
  }
  localStorage.removeItem('appcal_current_user');
};

// ==========================================
// DATA SYNC LOGIC (Meals & Ingredients)
// ==========================================
export const fetchMeals = async (): Promise<Meal[]> => {
  const client = getSupabaseClient();
  const user = getLoggedInUser();
  if (!user) return [];

  if (client) {
    try {
      const { data, error } = await client
        .from('meals')
        .select(`
          id,
          meal_type,
          logged_at,
          photos,
          total_calories,
          total_protein,
          total_carbs,
          total_fats,
          notes,
          meal_items (
            name,
            weight_g,
            calories,
            protein,
            carbs,
            fats
          )
        `)
        .eq('user_id', user.id)
        .order('logged_at', { ascending: false });

      if (error) throw error;
      
      // Map database structure to React state interface
      return (data || []).map((m: any) => ({
        id: m.id,
        timestamp: m.logged_at,
        meal_type: m.meal_type as any,
        photos: m.photos || [],
        total_calories: m.total_calories,
        total_protein: Number(m.total_protein),
        total_carbs: Number(m.total_carbs),
        total_fats: Number(m.total_fats),
        notes: m.notes,
        items: (m.meal_items || []).map((item: any) => ({
          name: item.name,
          weight_g: Number(item.weight_g),
          calories: item.calories,
          protein: Number(item.protein),
          carbs: Number(item.carbs),
          fats: Number(item.fats),
        })),
      }));
    } catch (e) {
      console.error('Erro ao ler refeições do Supabase. Carregando da cache local.', e);
    }
  }

  // Local user cache fallback
  const allMeals = JSON.parse(localStorage.getItem('appcal_meals_v2') || '[]');
  return allMeals.filter((m: any) => m.user_id === user.id);
};

export const insertMeal = async (meal: Meal): Promise<void> => {
  const client = getSupabaseClient();
  const user = getLoggedInUser();
  if (!user) return;

  if (client) {
    try {
      const isUuid = meal.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      
      // 1. Upsert meal header
      const { data: mealData, error: mealError } = await client
        .from('meals')
        .upsert({
          id: isUuid ? meal.id : undefined, // Check if valid UUID, else auto-generate
          user_id: user.id,
          meal_type: meal.meal_type,
          logged_at: meal.timestamp,
          photos: meal.photos,
          total_calories: meal.total_calories,
          total_protein: meal.total_protein,
          total_carbs: meal.total_carbs,
          total_fats: meal.total_fats,
          notes: meal.notes,
        }, { onConflict: 'id' })
        .select()
        .single();

      if (mealError) throw mealError;

      // 2. Delete old meal items for this meal to avoid duplication on edit
      await client.from('meal_items').delete().eq('meal_id', mealData.id);

      // 3. Insert detailed food items
      const itemsToInsert = meal.items.map((item) => ({
        meal_id: mealData.id,
        name: item.name,
        weight_g: item.weight_g,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fats: item.fats,
      }));

      const { error: itemsError } = await client.from('meal_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;
      return;
    } catch (e) {
      console.error('Falha ao inserir/atualizar refeição no Supabase, guardando na cache local.', e);
    }
  }

  // Local fallback cache
  const allMeals = JSON.parse(localStorage.getItem('appcal_meals_v2') || '[]');
  const exists = allMeals.some((m: any) => m.id === meal.id && m.user_id === user.id);
  
  let updatedMeals;
  if (exists) {
    // Edit existing
    updatedMeals = allMeals.map((m: any) => 
      (m.id === meal.id && m.user_id === user.id) ? { ...meal, user_id: user.id } : m
    );
  } else {
    // Add new
    const localMealWithUser = { ...meal, user_id: user.id };
    updatedMeals = [localMealWithUser, ...allMeals];
  }
  
  localStorage.setItem('appcal_meals_v2', JSON.stringify(updatedMeals));
};

export const deleteMealDb = async (id: string): Promise<void> => {
  const client = getSupabaseClient();
  const user = getLoggedInUser();
  if (!user) return;

  if (client) {
    try {
      const { error } = await client.from('meals').delete().eq('id', id).eq('user_id', user.id);
      if (error) throw error;
      return;
    } catch (e) {
      console.error('Erro ao apagar refeição no Supabase.', e);
    }
  }

  // Local fallback cache delete
  const allMeals = JSON.parse(localStorage.getItem('appcal_meals_v2') || '[]');
  const updated = allMeals.filter((m: any) => !(m.id === id && m.user_id === user.id));
  localStorage.setItem('appcal_meals_v2', JSON.stringify(updated));
};

// ==========================================
// DATA SYNC LOGIC (Weight Tracking)
// ==========================================
export const fetchWeightLogs = async (): Promise<WeightLog[]> => {
  const client = getSupabaseClient();
  const user = getLoggedInUser();
  if (!user) return [];

  if (client) {
    try {
      const { data, error } = await client
        .from('weight_logs')
        .select('id, date, weight_kg')
        .eq('user_id', user.id)
        .order('date', { ascending: true });

      if (error) throw error;
      return (data || []).map((l: any) => ({
        id: l.id,
        user_id: user.id,
        date: l.date,
        weight_kg: Number(l.weight_kg),
      }));
    } catch (e) {
      console.error('Erro ao ler logs de peso do Supabase.', e);
    }
  }

  // Local fallback cache
  const allLogs = JSON.parse(localStorage.getItem('appcal_weight_logs') || '[]');
  return allLogs
    .filter((l: any) => l.user_id === user.id)
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

export const insertWeightLog = async (date: string, weightKg: number): Promise<WeightLog[]> => {
  const client = getSupabaseClient();
  const user = getLoggedInUser();
  if (!user) return [];

  if (client) {
    try {
      // Upsert to ensure one weight log per day max
      const { error } = await client.from('weight_logs').upsert({
        user_id: user.id,
        date,
        weight_kg: weightKg,
      }, { onConflict: 'user_id,date' });

      if (error) throw error;
    } catch (e) {
      console.error('Erro ao guardar peso no Supabase.', e);
    }
  }

  // Local fallback cache update
  const allLogs = JSON.parse(localStorage.getItem('appcal_weight_logs') || '[]');
  
  // Remove existing log for same user/date if any
  const filtered = allLogs.filter((l: any) => !(l.user_id === user.id && l.date === date));
  const newLog: WeightLog = {
    id: Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(),
    user_id: user.id,
    date,
    weight_kg: weightKg,
  };
  const updated = [...filtered, newLog].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  localStorage.setItem('appcal_weight_logs', JSON.stringify(updated));
  return updated.filter((l: any) => l.user_id === user.id);
};

export const deleteWeightLogDb = async (id: string): Promise<WeightLog[]> => {
  const client = getSupabaseClient();
  const user = getLoggedInUser();
  if (!user) return [];

  if (client) {
    try {
      const { error } = await client.from('weight_logs').delete().eq('id', id).eq('user_id', user.id);
      if (error) throw error;
    } catch (e) {
      console.error('Erro ao apagar log de peso no Supabase.', e);
    }
  }

  // Local fallback delete
  const allLogs = JSON.parse(localStorage.getItem('appcal_weight_logs') || '[]');
  const updated = allLogs.filter((l: any) => !(l.id === id && l.user_id === user.id));
  localStorage.setItem('appcal_weight_logs', JSON.stringify(updated));
  return updated.filter((l: any) => l.user_id === user.id);
};

export const fetchProfileSettings = async (): Promise<AppSettings | null> => {
  const client = getSupabaseClient();
  const user = getLoggedInUser();
  if (!user) return null;

  if (client) {
    try {
      const { data, error } = await client
        .from('profiles')
        .select('settings')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (data && data.settings) {
        return data.settings as AppSettings;
      }
    } catch (e) {
      console.error('Erro ao ler perfil do Supabase:', e);
    }
  }
  return null;
};

export const saveProfileSettings = async (settings: AppSettings): Promise<void> => {
  const client = getSupabaseClient();
  const user = getLoggedInUser();
  if (!user) return;

  if (client) {
    try {
      const { error } = await client
        .from('profiles')
        .upsert({
          id: user.id,
          settings: settings,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
    } catch (e) {
      console.error('Erro ao guardar perfil no Supabase:', e);
    }
  }
};
