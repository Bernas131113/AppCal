import type { FoodItem, MealType } from '../types';
import { useAppStore } from '../store/useAppStore';

interface GeminiResponse {
  meal_type: MealType;
  items: {
    name: string;
    weight_g: number;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    confidence: 'high' | 'medium' | 'low';
  }[];
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fats: number;
}

// Extracts raw base64 data from a data URL string (removes data prefix)
const getRawBase64 = (dataUrl: string): { mimeType: string; data: string } => {
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (matches && matches.length === 3) {
    return {
      mimeType: matches[1],
      data: matches[2],
    };
  }
  return {
    mimeType: 'image/jpeg',
    data: dataUrl,
  };
};

/**
 * Simulates a Gemini response for testing purposes (Demo Mode)
 */
const getSimulatedResponse = (
  textNotes: string,
  _hasPhotos: boolean
): GeminiResponse => {
  const noteLower = textNotes.toLowerCase();
  
  // Default structure
  let meal_type: MealType = 'lunch';
  let items: FoodItem[] = [];

  const timeHour = new Date().getHours();
  if (timeHour < 11) meal_type = 'breakfast';
  else if (timeHour >= 18) meal_type = 'dinner';
  else if (timeHour >= 15 && timeHour < 18) meal_type = 'snack';

  // Keyword matching for demo interactive test
  if (noteLower.includes('frango') || noteLower.includes('arroz')) {
    items = [
      { name: 'Peito de Frango Grelhado', weight_g: 150, calories: 247, protein: 46.5, carbs: 0, fats: 5.2, confidence: 'high' },
      { name: 'Arroz Basmati Cozido', weight_g: 150, calories: 195, protein: 4.1, carbs: 42.3, fats: 0.4, confidence: 'high' },
      { name: 'Brócolos ao Vapor', weight_g: 100, calories: 35, protein: 2.8, carbs: 7.0, fats: 0.4, confidence: 'high' }
    ];
  } else if (noteLower.includes('pizza')) {
    meal_type = 'dinner';
    items = [
      { name: 'Pizza Margherita (2 fatias)', weight_g: 220, calories: 540, protein: 22.0, carbs: 64.0, fats: 20.0, confidence: 'medium' },
      { name: 'Salada Verde Simples', weight_g: 80, calories: 45, protein: 1.2, carbs: 3.5, fats: 3.1, confidence: 'high' }
    ];
  } else if (noteLower.includes('salmão') || noteLower.includes('peixe')) {
    items = [
      { name: 'Posta de Salmão Grelhado', weight_g: 160, calories: 320, protein: 34.0, carbs: 0, fats: 19.5, confidence: 'high' },
      { name: 'Batata Doce Assada', weight_g: 120, calories: 108, protein: 2.0, carbs: 25.0, fats: 0.2, confidence: 'high' },
      { name: 'Espargos Grelhados com Azeite', weight_g: 80, calories: 60, protein: 1.8, carbs: 4.0, fats: 4.5, confidence: 'medium' }
    ];
  } else if (noteLower.includes('ovo') || noteLower.includes('ovos') || noteLower.includes('pão') || noteLower.includes('tosta')) {
    meal_type = 'breakfast';
    items = [
      { name: 'Ovos Mexidos (2 ovos)', weight_g: 100, calories: 154, protein: 12.6, carbs: 1.1, fats: 11.0, confidence: 'high' },
      { name: 'Tosta de Pão de Centeio', weight_g: 50, calories: 120, protein: 4.2, carbs: 23.0, fats: 1.2, confidence: 'high' },
      { name: 'Abacate Laminado', weight_g: 50, calories: 80, protein: 1.0, carbs: 4.3, fats: 7.3, confidence: 'high' }
    ];
  } else if (noteLower.includes('aveia') || noteLower.includes('iogurte') || noteLower.includes('fruta')) {
    meal_type = 'breakfast';
    items = [
      { name: 'Iogurte Grego Natural 0%', weight_g: 150, calories: 87, protein: 15.0, carbs: 5.7, fats: 0.3, confidence: 'high' },
      { name: 'Flocos de Aveia Integral', weight_g: 40, calories: 150, protein: 5.3, carbs: 26.5, fats: 2.7, confidence: 'high' },
      { name: 'Morangos Frescos', weight_g: 100, calories: 32, protein: 0.7, carbs: 7.7, fats: 0.3, confidence: 'high' },
      { name: 'Sementes de Chia', weight_g: 10, calories: 49, protein: 1.7, carbs: 4.2, fats: 3.1, confidence: 'high' }
    ];
  } else if (noteLower.includes('sopa')) {
    items = [
      { name: 'Sopa de Legumes Caseira', weight_g: 250, calories: 115, protein: 3.0, carbs: 18.0, fats: 3.5, confidence: 'medium' }
    ];
  } else {
    // General random healthy plate fallback
    if (meal_type === 'breakfast') {
      items = [
        { name: 'Panquecas de Aveia e Banana', weight_g: 120, calories: 210, protein: 8.0, carbs: 36.0, fats: 4.0, confidence: 'medium' },
        { name: 'Mel Puro (Fio)', weight_g: 15, calories: 46, protein: 0.1, carbs: 12.0, fats: 0.0, confidence: 'medium' }
      ];
    } else if (meal_type === 'snack') {
      items = [
        { name: 'Maçã Vermelha', weight_g: 150, calories: 78, protein: 0.4, carbs: 21.0, fats: 0.3, confidence: 'high' },
        { name: 'Nozes (Miolo)', weight_g: 20, calories: 130, protein: 3.0, carbs: 2.8, fats: 13.0, confidence: 'high' }
      ];
    } else {
      // Lunch / Dinner
      items = [
        { name: 'Bife de Peru Grelhado', weight_g: 140, calories: 165, protein: 34.0, carbs: 0.0, fats: 2.5, confidence: 'high' },
        { name: 'Massa Integral Cozida', weight_g: 150, calories: 186, protein: 7.5, carbs: 38.0, fats: 1.1, confidence: 'high' },
        { name: 'Salada de Tomate e Alface', weight_g: 100, calories: 50, protein: 1.0, carbs: 4.0, fats: 3.5, confidence: 'high' }
      ];
    }
  }

  // Calculate totals
  const total_calories = Math.round(items.reduce((sum, item) => sum + item.calories, 0));
  const total_protein = parseFloat(items.reduce((sum, item) => sum + item.protein, 0).toFixed(1));
  const total_carbs = parseFloat(items.reduce((sum, item) => sum + item.carbs, 0).toFixed(1));
  const total_fats = parseFloat(items.reduce((sum, item) => sum + item.fats, 0).toFixed(1));

  return {
    meal_type,
    items: items.map(item => ({
      ...item,
      confidence: item.confidence || 'medium'
    })),
    total_calories,
    total_protein,
    total_carbs,
    total_fats
  };
};

/**
 * Sends food data (images, text, audio) to Gemini API for visual nutritional analysis
 */
export const analyzeMealWithGemini = async (
  apiKey: string,
  modelName: string,
  photos: string[],
  textNotes: string,
  audioBase64?: string
): Promise<GeminiResponse> => {
  
  // If no API key, return a mock response for user testing
  if (!apiKey || apiKey.trim() === '') {
    console.log('Gemini API key não configurada. A correr no modo Demo/Simulação.');
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(getSimulatedResponse(textNotes, photos.length > 0));
      }, 1500); // Simulate API latency
    });
  }

  let model = modelName || 'gemini-3.5-flash';
  if (model === 'gemini-2.5-pro' || model === 'gemini-1.5-flash' || model === 'gemini-2.5-flash' || model === 'gemini-3.6-flash') {
    model = 'gemini-3.5-flash';
  }
  // URL is constructed dynamically below using the effective API key from .env

  // Assemble system instructions and core prompt — bilingual based on user language setting
  const lang = useAppStore.getState().settings.language || 'pt';
  const isEn = lang === 'en';

  const systemInstruction = isEn
    ? `You are a highly experienced professional nutritionist specializing in estimating the nutritional composition of plates using images, textual descriptions, and audio.
    Analyze the provided data (meal photos, text notes, and context audio) and return the ingredient breakdown.
    Strict rules:
    1. Break down the meal into its individual ingredients (food itemization). Do not just give the complete plate.
    2. Estimate the weight of each ingredient in grams.
    3. Calculate the macronutrients of each ingredient: Calories (kcal), Protein (g), Carbohydrates (g), and Fats (g).
    4. Assign a confidence level ("high", "medium", "low") based on visual clarity and description.
    5. Your output must be strictly in JSON format matching the requested JSON Schema. Do not add explanations, markdown tags, or text outside the JSON.
    6. If the user provides text or voice notes detailing additional ingredients (e.g. "olive oil", "sugar", "butter") that are not easily visible in the image, you must include them in the estimate.`
    : `És um nutricionista profissional altamente experiente e especializado em estimar a composição nutricional de pratos através de imagens, descrições textuais e áudio.
    Analisa os dados fornecidos (fotos da refeição, notas textuais e áudios de contexto) e devolve a decomposição de ingredientes.
    Regras estritas:
    1. Divide a refeição nos seus ingredientes individuais (food itemization). Não dês apenas o prato completo.
    2. Estima o peso de cada ingrediente em gramas.
    3. Calcula os macronutrientes de cada ingrediente: Calorias (kcal), Proteína (g), Hidratos de Carbono (g) e Lípidos/Gorduras (g).
    4. Atribui um nível de confiança ("high", "medium", "low") baseado na clareza visual e descrição.
    5. O teu output deve ser estritamente em formato JSON em conformidade com o JSON Schema solicitado. Não adicione explicações, tags markdown ou texto fora do JSON.
    6. Se o utilizador fornecer notas de voz ou texto que detalham ingredientes adicionais (ex.: "azeite", "açúcar", "manteiga") que não são facilmente visíveis na imagem, deves obrigatoriamente incluí-los na estimativa.`;

  const promptText = isEn
    ? `Analyze this meal and return the macronutrients and ingredient breakdown in JSON.
    User context notes: "${textNotes || 'No text notes provided.'}"
    
    The response must EXCLUSIVELY match the following JSON structure:
    {
      "meal_type": "breakfast" | "lunch" | "dinner" | "snack",
      "items": [
        {
          "name": "Food Item Name in English",
          "weight_g": number,
          "calories": number,
          "protein": number,
          "carbs": number,
          "fats": number,
          "confidence": "high" | "medium" | "low"
        }
      ],
      "total_calories": number,
      "total_protein": number,
      "total_carbs": number,
      "total_fats": number
    }`
    : `Analisa esta refeição e devolve os macronutrientes e a decomposição dos ingredientes em JSON.
    Notas de contexto do utilizador: "${textNotes || 'Nenhuma nota de texto fornecida.'}"
    
    A resposta tem de obedecer EXCLUSIVAMENTE à seguinte estrutura JSON:
    {
      "meal_type": "breakfast" | "lunch" | "dinner" | "snack",
      "items": [
        {
          "name": "Nome do Alimento em Português",
          "weight_g": number,
          "calories": number,
          "protein": number,
          "carbs": number,
          "fats": number,
          "confidence": "high" | "medium" | "low"
        }
      ],
      "total_calories": number,
      "total_protein": number,
      "total_carbs": number,
      "total_fats": number
    }`;

  // Prepare Gemini API content parts
  const parts: any[] = [{ text: promptText }];

  // Add photos
  for (const photo of photos) {
    const { mimeType, data } = getRawBase64(photo);
    parts.push({
      inlineData: {
        mimeType,
        data,
      },
    });
  }

  // Add voice note if present
  if (audioBase64) {
    const { mimeType, data } = getRawBase64(audioBase64);
    parts.push({
      inlineData: {
        mimeType,
        data,
      },
    });
  }

  const requestBody = {
    contents: [
      {
        parts,
      },
    ],
    systemInstruction: {
      parts: [
        {
          text: systemInstruction,
        },
      ],
    },
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  };

  try {
    // Use API key from .env (VITE_GEMINI_API_KEY)
    // The Edge Function approach requires deployment to Supabase CLI first.
    // For now we call Google's API directly — safe for local/dev use.
    const envApiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
    const effectiveKey = envApiKey || apiKey;

    if (!effectiveKey) {
      // No key at all — run demo simulation
      return getSimulatedResponse(textNotes, photos.length > 0);
    }

    const directUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${effectiveKey}`;
    const response = await fetch(directUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('A quota de utilização do Gemini foi excedida. Por favor, aguarde 1 minuto para tentar novamente.');
      }
      const errorText = await response.text();
      throw new Error(`Erro na API (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    
    // Parse response
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResponse) {
      throw new Error('A API Gemini não retornou conteúdo.');
    }

    // Parse JSON safely
    const parsed: GeminiResponse = JSON.parse(textResponse.trim());
    return parsed;
  } catch (error) {
    console.error('Erro ao analisar com Gemini:', error);
    throw error;
  }
};
