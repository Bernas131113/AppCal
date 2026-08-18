import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Meal, AppSettings, MealType, FoodItem } from '../types';
import { getSettings, saveSettings } from '../utils/storage';
import { fetchMeals, fetchProfileSettings, saveProfileSettings } from '../utils/supabase';

interface AppState {
  currentUser: { id: string; email: string } | null;
  settings: AppSettings;
  meals: Meal[];
  activeTab: 'diary' | 'favorites' | 'progress' | 'profile';
  editingMeal: Meal | null;
  pendingAnalysis: {
    meal_type: MealType;
    items: FoodItem[];
    photos: string[];
    notes: string;
  } | null;
  toastConfig: {
    isOpen: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  } | null;
  modalConfig: {
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
  } | null;
  isInitializing: boolean;
  showSettings: boolean;

  setCurrentUser: (user: { id: string; email: string } | null) => void;
  setSettings: (settings: AppSettings) => void;
  saveSettingsCloud: (settings: AppSettings) => Promise<void>;
  setMeals: (meals: Meal[]) => void;
  setActiveTab: (tab: 'diary' | 'favorites' | 'progress' | 'profile') => void;
  setEditingMeal: (meal: Meal | null) => void;
  setPendingAnalysis: (analysis: any | null) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  closeToast: () => void;
  confirmAction: (title: string, message: string, onConfirm: () => void) => void;
  closeModal: () => void;
  loadMeals: () => Promise<void>;
  setIsInitializing: (val: boolean) => void;
  syncSettingsFromCloud: () => Promise<void>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      settings: getSettings(),
      meals: [],
      activeTab: 'diary',
      editingMeal: null,
      pendingAnalysis: null,
      toastConfig: null,
      modalConfig: null,
      isInitializing: true,
      showSettings: false,

      setCurrentUser: (user) => set({ currentUser: user }),
      setSettings: (newSettings) => {
        saveSettings(newSettings);
        set({ settings: newSettings });
      },

      saveSettingsCloud: async (newSettings) => {
        saveSettings(newSettings);
        set({ settings: newSettings });
        await saveProfileSettings(newSettings);
      },

      setMeals: (meals) => set({ meals }),
      setActiveTab: (tab) => set({ activeTab: tab }),
      setEditingMeal: (meal) => set({ editingMeal: meal }),
      setPendingAnalysis: (analysis) => set({ pendingAnalysis: analysis }),

      showToast: (message, type = 'success') => {
        set({ toastConfig: { isOpen: true, message, type } });
        setTimeout(() => {
          const current = get().toastConfig;
          if (current && current.message === message) {
            set({ toastConfig: null });
          }
        }, 3000);
      },
      closeToast: () => set({ toastConfig: null }),

      confirmAction: (title, message, onConfirm) => {
        set({
          modalConfig: {
            title,
            message,
            confirmText: 'Confirmar',
            cancelText: 'Cancelar',
            onConfirm: () => {
              onConfirm();
              set({ modalConfig: null });
            }
          }
        });
      },
      closeModal: () => set({ modalConfig: null }),

      loadMeals: async () => {
        const fetched = await fetchMeals();
        set({ meals: fetched });
      },

      setIsInitializing: (val) => set({ isInitializing: val }),

      syncSettingsFromCloud: async () => {
        const cloudSettings = await fetchProfileSettings();
        if (cloudSettings) {
          saveSettings(cloudSettings);
          set({ settings: cloudSettings });
        }
      }
    }),
    {
      name: 'appcal-store-v1', // localStorage key
      // Only persist data state — exclude UI state and functions
      partialize: (state) => ({
        currentUser: state.currentUser,
        settings: state.settings,
        meals: state.meals,
        activeTab: state.activeTab,
      }),
    }
  )
);

