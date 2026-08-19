import { createClient } from '@supabase/supabase-js';
import type { Meal, WeightLog, AppSettings, FavoriteMeal } from '../types';

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

// ─── Supabase Singleton ───────────────────────────────────────────────────────
// Created ONCE at module level from .env — prevents "Multiple GoTrueClient"
// instances warning that occurs when the client is destroyed and recreated.
const _envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const _envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const supabase: any = (_envUrl && _envKey) ? createClient(_envUrl, _envKey) : null;

export const getSupabaseClient = () => supabase;

// No-op kept for backwards compat — client is a singleton, never recreated
export const resetSupabaseClient = () => {};

// ==========================================
// LOCAL MULTI-USER ENGINE (Fallback)
// ==========================================
export interface LocalUser {
  id: string;
  email: string;
  passwordHash: string;
}

const getLocalUsers = (): LocalUser[] =>
  JSON.parse(localStorage.getItem('appcal_users') || '[]');

const saveLocalUsers = (users: LocalUser[]) =>
  localStorage.setItem('appcal_users', JSON.stringify(users));

export const getLoggedInUser = (): { id: string; email: string } | null => {
  const user = localStorage.getItem('appcal_current_user');
  return user ? JSON.parse(user) : null;
};

/** Returns true only if the string is a proper RFC-4122 UUID */
const isValidUUID = (id: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

/**
 * Returns { client, userId } only when the Supabase client exists
 * AND the local user ID is a valid UUID (created via Supabase Auth).
 * Local-only accounts (non-UUID ids) always fall back to localStorage.
 */
const getSupabaseContext = (): { client: any; userId: string } | null => {
  const user = getLoggedInUser();
  if (!supabase || !user || !isValidUUID(user.id)) return null;
  return { client: supabase, userId: user.id };
};

// ==========================================
// AUTHENTICATION INTERFACE (Supabase & Local)
// ==========================================
export const dbSignUp = async (email: string, password: string): Promise<{ user: any; error: string | null }> => {
  if (supabase) {
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) return { user: null, error: error.message };

    if (data?.session && data?.user) {
      // Email confirmation is OFF — user is immediately authenticated
      const sessionUser = { id: data.user.id, email: data.user.email };
      localStorage.setItem('appcal_current_user', JSON.stringify(sessionUser));
      return { user: data.user, error: null };
    }

    if (data?.user && !data?.session) {
      // Email confirmation is ON — tell user to check inbox
      return {
        user: null,
        error: 'Conta criada! Confirma o teu e-mail antes de iniciar sessão — verifica a caixa de entrada.'
      };
    }

    return { user: null, error: 'Erro ao criar conta. Tenta novamente.' };
  } else {
    // Local Simulation
    const users = getLocalUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      return { user: null, error: 'Este e-mail já está registado.' };
    }
    const newUser: LocalUser = {
      id: Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(),
      email,
      passwordHash: password
    };
    saveLocalUsers([...users, newUser]);
    const sessionUser = { id: newUser.id, email: newUser.email };
    localStorage.setItem('appcal_current_user', JSON.stringify(sessionUser));
    return { user: sessionUser, error: null };
  }
};

export const dbSignIn = async (email: string, password: string): Promise<{ user: any; error: string | null }> => {
  if (supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (data?.session && data?.user) {
      // Full authenticated session — email confirmed, JWT active
      const sessionUser = { id: data.user.id, email: data.user.email };
      localStorage.setItem('appcal_current_user', JSON.stringify(sessionUser));
      return { user: data.user, error: null };
    }

    if (data?.user && !data?.session) {
      // User exists but no session = email NOT confirmed yet
      return {
        user: null,
        error: 'Confirma o teu e-mail primeiro! Abre o link que recebeste na caixa de entrada e tenta iniciar sessão novamente.'
      };
    }

    // Supabase Auth failed — try local fallback (accounts before Supabase)
    const users = getLocalUsers();
    const localUser = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === password);
    if (localUser) {
      const sessionUser = { id: localUser.id, email: localUser.email };
      localStorage.setItem('appcal_current_user', JSON.stringify(sessionUser));
      return { user: sessionUser, error: null };
    }

    return { user: null, error: error ? error.message : 'E-mail ou palavra-passe incorretos.' };
  } else {
    // No Supabase — local only
    const users = getLocalUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === password);
    if (!user) return { user: null, error: 'E-mail ou palavra-passe incorretos.' };
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
  localStorage.removeItem('appcal_remember_me');
  localStorage.removeItem('appcal_saved_email');
  localStorage.removeItem('appcal_saved_password');
  localStorage.removeItem('appcal_favorites');
  localStorage.removeItem('appcal_favorites_v2');
};

export const dbUpdatePassword = async (newPassword: string): Promise<{ success: boolean; error: string | null }> => {
  const user = getLoggedInUser();
  if (!user) return { success: false, error: 'Utilizador não autenticado.' };

  const client = getSupabaseClient();
  if (client) {
    const { error } = await client.auth.updateUser({ password: newPassword });
    if (error) return { success: false, error: error.message };

    // Also update locally in case they fallback
    const users = getLocalUsers();
    const updatedUsers = users.map(u => u.id === user.id ? { ...u, passwordHash: newPassword } : u);
    saveLocalUsers(updatedUsers);
    return { success: true, error: null };
  } else {
    const users = getLocalUsers();
    const existing = users.find(u => u.id === user.id);
    if (!existing) {
      const newUser: LocalUser = {
        id: user.id,
        email: user.email,
        passwordHash: newPassword
      };
      saveLocalUsers([...users, newUser]);
    } else {
      const updatedUsers = users.map(u => u.id === user.id ? { ...u, passwordHash: newPassword } : u);
      saveLocalUsers(updatedUsers);
    }
    return { success: true, error: null };
  }
};


// ==========================================
// DATA SYNC LOGIC (Meals & Ingredients)
// ==========================================
export const fetchMeals = async (): Promise<Meal[]> => {
  const user = getLoggedInUser();
  if (!user) return [];

  const ctx = getSupabaseContext();
  if (ctx) {
    try {
      const { data, error } = await ctx.client
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
        .eq('user_id', ctx.userId)
        .order('logged_at', { ascending: false });

      if (error) throw error;
      
      // Map database structure to React state interface
      const mappedMeals = (data || []).map((m: any) => ({
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

      // Cache locally
      const allMeals = JSON.parse(localStorage.getItem('appcal_meals_v2') || '[]');
      const otherMeals = allMeals.filter((m: any) => m.user_id !== user.id);
      const userMeals = mappedMeals.map((m: any) => ({ ...m, user_id: user.id }));
      localStorage.setItem('appcal_meals_v2', JSON.stringify([...otherMeals, ...userMeals]));

      return mappedMeals;
    } catch (e) {
      console.error('Erro ao ler refeições do Supabase. Carregando da cache local.', e);
    }
  }

  // Local user cache fallback
  const allMeals = JSON.parse(localStorage.getItem('appcal_meals_v2') || '[]');
  return allMeals.filter((m: any) => m.user_id === user.id);
};

export const insertMeal = async (meal: Meal): Promise<void> => {
  const user = getLoggedInUser();
  if (!user) return;

  const ctx = getSupabaseContext();
  if (ctx) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(meal.id);
      
      // 1. Upsert meal header
      const { data: mealData, error: mealError } = await ctx.client
        .from('meals')
        .upsert({
          id: isUuid ? meal.id : undefined,
          user_id: ctx.userId,
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

      // 2. Delete old meal items to avoid duplication on edit
      await ctx.client.from('meal_items').delete().eq('meal_id', mealData.id);

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

      const { error: itemsError } = await ctx.client.from('meal_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;
    } catch (e) {
      console.error('Falha ao inserir/atualizar refeição no Supabase, guardando na cache local.', e);
    }
  }

  // Local fallback cache
  const allMeals = JSON.parse(localStorage.getItem('appcal_meals_v2') || '[]');
  const exists = allMeals.some((m: any) => m.id === meal.id && m.user_id === user.id);
  
  let updatedMeals;
  if (exists) {
    updatedMeals = allMeals.map((m: any) => 
      (m.id === meal.id && m.user_id === user.id) ? { ...meal, user_id: user.id } : m
    );
  } else {
    updatedMeals = [{ ...meal, user_id: user.id }, ...allMeals];
  }
  
  localStorage.setItem('appcal_meals_v2', JSON.stringify(updatedMeals));
};

export const deleteMealDb = async (id: string): Promise<void> => {
  const user = getLoggedInUser();
  if (!user) return;

  const ctx = getSupabaseContext();
  if (ctx) {
    try {
      const { error } = await ctx.client.from('meals').delete().eq('id', id).eq('user_id', ctx.userId);
      if (error) throw error;
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
  const user = getLoggedInUser();
  if (!user) return [];

  const ctx = getSupabaseContext();
  if (ctx) {
    try {
      const { data, error } = await ctx.client
        .from('weight_logs')
        .select('id, date, weight_kg')
        .eq('user_id', ctx.userId)
        .order('date', { ascending: true });

      if (error) throw error;
      const mappedLogs = (data || []).map((l: any) => ({
        id: l.id,
        user_id: ctx.userId,
        date: l.date,
        weight_kg: Number(l.weight_kg),
      }));

      // Cache locally
      const allLogs = JSON.parse(localStorage.getItem('appcal_weight_logs') || '[]');
      const otherLogs = allLogs.filter((l: any) => l.user_id !== user.id);
      localStorage.setItem('appcal_weight_logs', JSON.stringify([...otherLogs, ...mappedLogs]));

      return mappedLogs;
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
  const user = getLoggedInUser();
  if (!user) return [];

  const ctx = getSupabaseContext();
  if (ctx) {
    try {
      // Check if weight log already exists for this date and user
      const { data: existing, error: findError } = await ctx.client
        .from('weight_logs')
        .select('id')
        .eq('user_id', ctx.userId)
        .eq('date', date)
        .maybeSingle();

      if (findError) throw findError;

      if (existing) {
        const { error: updateError } = await ctx.client
          .from('weight_logs')
          .update({ weight_kg: weightKg })
          .eq('id', existing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await ctx.client
          .from('weight_logs')
          .insert({
            user_id: ctx.userId,
            date,
            weight_kg: weightKg,
          });
        if (insertError) throw insertError;
      }

      return fetchWeightLogs();
    } catch (e) {
      console.error('Erro ao guardar peso no Supabase.', e);
    }
  }

  // Local fallback cache update
  const allLogs = JSON.parse(localStorage.getItem('appcal_weight_logs') || '[]');
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
  const user = getLoggedInUser();
  if (!user) return [];

  const ctx = getSupabaseContext();
  if (ctx) {
    try {
      const { error } = await ctx.client.from('weight_logs').delete().eq('id', id).eq('user_id', ctx.userId);
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
  const ctx = getSupabaseContext();
  if (!ctx) return null;

  try {
    const { data, error } = await ctx.client
      .from('profiles')
      .select('settings')
      .eq('id', ctx.userId)
      .maybeSingle();

    if (error) throw error;
    if (data && data.settings) {
      return data.settings as AppSettings;
    }
  } catch (e) {
    console.error('Erro ao ler perfil do Supabase:', e);
  }
  return null;
};

export const saveProfileSettings = async (settings: AppSettings): Promise<void> => {
  const ctx = getSupabaseContext();
  if (!ctx) return;

  try {
    const { error } = await ctx.client
      .from('profiles')
      .upsert({
        id: ctx.userId,
        settings: settings,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
  } catch (e) {
    console.error('Erro ao guardar perfil no Supabase:', e);
  }
};

// ==========================================
// DATA SYNC LOGIC (Favorites)
// ==========================================
export const fetchFavorites = async (): Promise<FavoriteMeal[]> => {
  const user = getLoggedInUser();
  if (!user) return [];

  const ctx = getSupabaseContext();
  if (ctx) {
    try {
      const { data, error } = await ctx.client
        .from('favorites')
        .select('id, name, items, total_calories, total_protein, total_carbs, total_fats')
        .eq('user_id', ctx.userId);

      if (error) throw error;
      const favs = (data || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        items: f.items || [],
        total_calories: f.total_calories,
        total_protein: Number(f.total_protein),
        total_carbs: Number(f.total_carbs),
        total_fats: Number(f.total_fats),
      }));

      // Cache locally
      localStorage.setItem('appcal_favorites', JSON.stringify(favs));

      return favs;
    } catch (e) {
      console.error('Erro ao ler favoritos do Supabase. Carregando da cache local.', e);
    }
  }

  // Local fallback cache
  return JSON.parse(localStorage.getItem('appcal_favorites') || '[]');
};

export const insertFavoriteDb = async (fav: FavoriteMeal): Promise<void> => {
  const user = getLoggedInUser();
  if (!user) return;

  const ctx = getSupabaseContext();
  if (ctx) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fav.id);
      
      const { error } = await ctx.client
        .from('favorites')
        .upsert({
          id: isUuid ? fav.id : undefined,
          user_id: ctx.userId,
          name: fav.name,
          items: fav.items,
          total_calories: fav.total_calories,
          total_protein: fav.total_protein,
          total_carbs: fav.total_carbs,
          total_fats: fav.total_fats,
        }, { onConflict: 'id' });

      if (error) throw error;
    } catch (e) {
      console.error('Erro ao guardar favorito no Supabase, guardando na cache local.', e);
    }
  }

  // Local fallback cache
  const allFavorites = JSON.parse(localStorage.getItem('appcal_favorites') || '[]');
  const exists = allFavorites.some((f: any) => f.id === fav.id);
  let updated;
  if (exists) {
    updated = allFavorites.map((f: any) => 
      f.id === fav.id ? fav : f
    );
  } else {
    updated = [fav, ...allFavorites];
  }
  localStorage.setItem('appcal_favorites', JSON.stringify(updated));
};

export const deleteFavoriteDb = async (id: string): Promise<void> => {
  const user = getLoggedInUser();
  if (!user) return;

  const ctx = getSupabaseContext();
  if (ctx) {
    try {
      const { error } = await ctx.client
        .from('favorites')
        .delete()
        .eq('id', id)
        .eq('user_id', ctx.userId);
      if (error) throw error;
    } catch (e) {
      console.error('Erro ao apagar favorito no Supabase.', e);
    }
  }

  // Local fallback cache delete
  const allFavorites = JSON.parse(localStorage.getItem('appcal_favorites') || '[]');
  const updated = allFavorites.filter((f: any) => f.id !== id);
  localStorage.setItem('appcal_favorites', JSON.stringify(updated));
};
