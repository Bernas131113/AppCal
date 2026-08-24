// Helpers for AppCal
import type { UserProfile, UserGoals } from '../types';

/**
 * Compresses an image file client-side using native HTML5 canvas.
 * Resizes the image to target max dimension and outputs a lightweight JPEG base64 string.
 * This is extremely reliable on iOS Safari and prevents high-resolution 429 token limits.
 */
export const compressImage = async (file: File, maxDimension: number = 800, quality: number = 0.6): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Scale keeping aspect ratio
        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Export as compressed JPEG
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        } else {
          resolve(img.src);
        }
      };
      img.onerror = () => {
        resolve(event.target?.result as string);
      };
    };
    reader.onerror = () => {
      resolve('');
    };
  });
};

/**
 * Generates a unique string ID (UUID v4)
 */
export const generateId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback RFC 4122 version 4 UUID generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Format date into a human readable format
 */
export const formatDateLabel = (dateStr: string): string => {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(date, today)) {
    return 'Hoje';
  } else if (isSameDay(date, yesterday)) {
    return 'Ontem';
  } else {
    // Return e.g. "18 de Agosto"
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${date.getDate()} de ${months[date.getMonth()]}`;
  }
};

/**
 * Checks if two dates are the same calendar day
 */
export const isSameDay = (d1: Date, d2: Date): boolean => {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

/**
 * Formats decimal numbers to 1 decimal place or integer if whole
 */
export const formatNumber = (num: number): string => {
  if (Number.isInteger(num)) return num.toString();
  return num.toFixed(1);
};

export const recalculateGoals = (profile: UserProfile): UserGoals => {
  const {
    age,
    gender,
    weight,
    height,
    activityLevel,
    goalType,
    calorieAdjustment,
    macroSplitType,
    fixedProteinPerKg,
    fixedFatPerKg,
    macroPercentages,
  } = profile;

  let bmr = 0;
  if (gender === 'male') {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  }

  const tdee = bmr * activityLevel;

  let targetCalories = tdee;
  if (goalType === 'loss') {
    targetCalories = tdee - calorieAdjustment;
  } else if (goalType === 'gain') {
    targetCalories = tdee + calorieAdjustment;
  }

  targetCalories = Math.max(1200, Math.round(targetCalories));

  let protein = 130;
  let carbs = 220;
  let fats = 65;

  if (macroSplitType === 'percentage') {
    const pPct = macroPercentages.protein / 100;
    const cPct = macroPercentages.carbs / 100;
    const fPct = macroPercentages.fats / 100;

    protein = Math.round((targetCalories * pPct) / 4);
    carbs = Math.round((targetCalories * cPct) / 4);
    fats = Math.round((targetCalories * fPct) / 9);
  } else {
    protein = Math.round(fixedProteinPerKg * weight);
    fats = Math.round(fixedFatPerKg * weight);
    const proteinCals = protein * 4;
    const fatCals = fats * 9;
    const remainingCals = targetCalories - proteinCals - fatCals;
    carbs = Math.max(20, Math.round(remainingCals / 4));
  }

  return {
    calories: targetCalories,
    protein,
    carbs,
    fats,
  };
};
