// Helpers for AppCal

import imageCompression from 'browser-image-compression';

/**
 * Compresses an image file client-side using browser-image-compression.
 * Resizes the image to target size under 800KB and outputs a JPEG base64 string.
 */
export const compressImage = async (file: File, maxDimension: number = 1024, quality: number = 0.8): Promise<string> => {
  const options = {
    maxSizeMB: 0.8, // target size < 800KB
    maxWidthOrHeight: maxDimension,
    useWebWorker: true,
    initialQuality: quality
  };
  try {
    const compressedFile = await imageCompression(file, options);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(compressedFile);
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  } catch (error) {
    console.error("Erro na compressão de imagem:", error);
    // Fallback: convert original file to base64
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
  }
};

/**
 * Generates a unique string ID
 */
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36);
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
