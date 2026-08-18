import React, { useState, useEffect, useRef } from 'react';
import type { FoodItem, MealType, Meal } from '../types';
import { Trash2, Plus, Check, X, AlertCircle, Minus, Search, Barcode, ShoppingBag, Loader2 } from 'lucide-react';
import { generateId, formatNumber } from '../utils/helpers';
import { Html5Qrcode } from 'html5-qrcode';

interface EditableFoodItem extends FoodItem {
  base: {
    weight_g: number;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  };
}

interface MealReviewProps {
  initialMealType: MealType;
  initialItems: FoodItem[];
  photos: string[];
  notes: string;
  onSave: (meal: Meal) => void;
  onCancel: () => void;
  apiKey?: string;
}

const getNutriment = (nutriments: any, key: string): number => {
  if (!nutriments) return 0;
  const val = nutriments[`${key}_100g`] ?? nutriments[key] ?? 0;
  return Number(val) || 0;
};

export const MealReview: React.FC<MealReviewProps> = ({
  initialMealType,
  initialItems,
  photos,
  notes,
  onSave,
  onCancel,
  apiKey,
}) => {
  const [mealType, setMealType] = useState<MealType>(initialMealType);
  const [items, setItems] = useState<EditableFoodItem[]>([]);

  // Search & Barcode states
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detail Modal States
  const [selectedSearchProduct, setSelectedSearchProduct] = useState<any | null>(null);
  const [searchWeightGrams, setSearchWeightGrams] = useState(100);

  // Barcode Scanner Modal States
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  // Initialize and double-buffer base values to allow proportional calculations
  useEffect(() => {
    const formatted = initialItems.map((item) => {
      const w = Number(item.weight_g) || 100;
      const cal = Number(item.calories) || 0;
      const prot = Number(item.protein) || 0;
      const carb = Number(item.carbs) || 0;
      const fat = Number(item.fats) || 0;
      return {
        name: item.name || 'Alimento',
        weight_g: w,
        calories: cal,
        protein: prot,
        carbs: carb,
        fats: fat,
        confidence: item.confidence || 'medium',
        base: {
          weight_g: w,
          calories: cal,
          protein: prot,
          carbs: carb,
          fats: fat,
        },
      };
    });
    setItems(formatted);
  }, [initialItems]);

  // Proportional weight change logic
  const handleWeightChange = (index: number, newWeight: number) => {
    const safeWeight = Math.max(10, newWeight);
    setItems((prev) => {
      const updated = [...prev];
      const item = updated[index];
      const base = item.base;

      if (base.weight_g > 0) {
        const ratio = safeWeight / base.weight_g;
        updated[index] = {
          ...item,
          weight_g: safeWeight,
          calories: Math.round(base.calories * ratio),
          protein: Number((base.protein * ratio).toFixed(1)),
          carbs: Number((base.carbs * ratio).toFixed(1)),
          fats: Number((base.fats * ratio).toFixed(1)),
        };
      } else {
        updated[index] = {
          ...item,
          weight_g: safeWeight,
        };
      }
      return updated;
    });
  };

  // Step adjustment (+/- buttons)
  const adjustWeightStep = (index: number, delta: number) => {
    const currentWeight = items[index].weight_g;
    handleWeightChange(index, currentWeight + delta);
  };

  // Direct edit fields (e.g. typing)
  const handleItemChange = (index: number, field: keyof FoodItem, value: string | number) => {
    setItems((prev) => {
      const updated = [...prev];
      const item = updated[index];

      let updatedItem = { ...item };
      if (field === 'name') {
        updatedItem.name = value as string;
      } else {
        const numVal = value === '' ? 0 : Number(value);
        updatedItem = {
          ...updatedItem,
          [field]: Math.max(0, numVal),
        };

        // If manually edited, reset base to allow scaling from this new custom baseline
        updatedItem.base = {
          weight_g: updatedItem.weight_g,
          calories: field === 'calories' ? Math.max(0, numVal) : updatedItem.calories,
          protein: field === 'protein' ? Math.max(0, numVal) : updatedItem.protein,
          carbs: field === 'carbs' ? Math.max(0, numVal) : updatedItem.carbs,
          fats: field === 'fats' ? Math.max(0, numVal) : updatedItem.fats,
        };
      }
      updated[index] = updatedItem;
      return updated;
    });
  };

  // Barcode Scanner Camera Lifecycle
  useEffect(() => {
    if (showBarcodeScanner) {
      const timer = setTimeout(() => {
        const scannerId = "barcode-reader-review";
        const element = document.getElementById(scannerId);
        if (!element) return;
        
        const startCameraScan = async () => {
          try {
            const scanner = new Html5Qrcode(scannerId);
            html5QrCodeRef.current = scanner;
            
            // Try exact environment back camera first
            try {
              await scanner.start(
                { facingMode: { exact: "environment" } },
                {
                  fps: 10,
                  qrbox: (width, height) => {
                    return { width: Math.min(width * 0.8, 280), height: Math.min(height * 0.5, 130) };
                  }
                },
                (decodedText) => {
                  handleBarcodeSubmit(decodedText);
                },
                () => {}
              );
            } catch (firstErr) {
              console.warn("Failing to force exact environment camera in review, trying fallback...", firstErr);
              // Fallback to any environment or default camera
              await scanner.start(
                { facingMode: "environment" },
                {
                  fps: 10,
                  qrbox: (width, height) => {
                    return { width: Math.min(width * 0.8, 280), height: Math.min(height * 0.5, 130) };
                  }
                },
                (decodedText) => {
                  handleBarcodeSubmit(decodedText);
                },
                () => {}
              );
            }

            // Explicitly force playsInline, autoPlay, and muted attributes on the injected video tag
            const video = element.querySelector('video');
            if (video) {
              video.setAttribute('playsinline', 'true');
              video.setAttribute('webkit-playsinline', 'true');
              video.setAttribute('autoplay', 'true');
              video.setAttribute('muted', 'true');
              video.playsInline = true;
              video.muted = true;
              video.play().catch(e => console.warn("Video play promise rejected in review:", e));
            }
            setIsScanning(true);
          } catch (e) {
            console.error("Erro ao iniciar Html5Qrcode em MealReview:", e);
          }
        };

        startCameraScan();
      }, 400);

      return () => {
        clearTimeout(timer);
        stopScanning();
      };
    }
  }, [showBarcodeScanner]);

  const stopScanning = async () => {
    if (html5QrCodeRef.current) {
      if (html5QrCodeRef.current.isScanning) {
        try {
          await html5QrCodeRef.current.stop();
        } catch (e) {
          console.error("Erro ao parar scanner:", e);
        }
      }
      html5QrCodeRef.current = null;
      setIsScanning(false);
    }
  };

  const handleBarcodeSubmit = async (code: string) => {
    if (!code.trim()) return;
    setIsSearching(true);
    setError(null);
    await stopScanning();
    setShowBarcodeScanner(false);
    setBarcodeInput('');
    
    // Tactile feedback on scan success (iOS Safari compatible)
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([200]);
      } catch (err) {
        // Ignorar se bloqueado ou não suportado
      }
    }
    
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code.trim()}.json`, {
        headers: { 'User-Agent': 'AppCalNutritionApp - Web - Version 1.0 - contact@appcal.com' }
      });
      if (!response.ok) throw new Error('Código de barras não encontrado.');
      const data = await response.json();
      
      if (data.status === 1 && data.product) {
        setSelectedSearchProduct(data.product);
        setSearchWeightGrams(100); // Default to 100g
      } else {
        setError('Produto não encontrado com esse código de barras.');
      }
    } catch (err) {
      console.error(err);
      setError('Código de barras não encontrado ou erro de rede.');
    } finally {
      setIsSearching(false);
    }
  };

  // Open Food Facts API Search (with AI Fallback)
  const searchFoodDatabase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setError(null);
    setSelectedSearchProduct(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200); // 1.2s max before IA fallback triggers

    try {
      const response = await fetch(
        `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
          searchQuery
        )}&search_simple=1&action=process&json=1&page_size=10`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error('Falha ao aceder à base de dados.');
      const data = await response.json();
      setSearchResults(data.products || []);
      if ((data.products || []).length === 0) {
        setError('Nenhum alimento encontrado com esse nome.');
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.log('Erro na base de dados externa ou limite de tempo excedido. A tentar alternativa por IA...', err);
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
        const geminiRequestBody = {
          contents: [
            {
              parts: [
                {
                  text: `Estás a atuar como uma base de dados de nutrição. O utilizador pesquisou por "${searchQuery}".
                  Devolve um array JSON com até 8 alimentos relevantes e realistas que correspondam à pesquisa em português de Portugal.
                  Para cada alimento, estima os valores nutricionais por 100g.
                  O teu output deve ser estritamente um JSON que siga exatamente este formato (não dês markdown, explicações ou blocos de código):
                  {
                    "products": [
                      {
                        "product_name": "Nome do alimento (ex: Peito de Frango Cru)",
                        "brands": "Genérico",
                        "nutriments": {
                          "energy-kcal_100g": 120,
                          "proteins_100g": 22.5,
                          "carbohydrates_100g": 0,
                          "fat_100g": 2.5
                        }
                      }
                    ]
                  }`,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        };

        const geminiResponse = await fetch(geminiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(geminiRequestBody),
        });

        if (!geminiResponse.ok) {
          throw new Error('Falha no fallback de IA.');
        }

        const geminiData = await geminiResponse.json();
        const textResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textResponse) {
          throw new Error('Nenhum texto retornado pelo Gemini.');
        }

        const parsed = JSON.parse(textResponse.trim());
        setSearchResults(parsed.products || []);
        if ((parsed.products || []).length === 0) {
          setError('Nenhum alimento encontrado.');
        }
      } catch (geminiErr) {
        console.error('Falha dupla (OFF e Gemini):', geminiErr);
        setError('Ocorreu um erro ao pesquisar alimentos. Base de dados e IA indisponíveis.');
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectProduct = (prod: any) => {
    setSelectedSearchProduct(prod);
    setSearchWeightGrams(100); // Reset to default
  };

  const addSearchedProductToSession = () => {
    if (!selectedSearchProduct) return;
    
    const prod = selectedSearchProduct;
    const name = prod.product_name_pt || prod.product_name || 'Alimento Pesquisado';
    const brand = prod.brands ? ` (${prod.brands})` : '';
    const fullName = name + brand;

    const kcal100 = getNutriment(prod.nutriments, 'energy-kcal');
    const prot100 = getNutriment(prod.nutriments, 'proteins');
    const carb100 = getNutriment(prod.nutriments, 'carbohydrates');
    const fat100 = getNutriment(prod.nutriments, 'fat');

    const ratio = searchWeightGrams / 100;

    const newItem: EditableFoodItem = {
      name: fullName,
      weight_g: searchWeightGrams,
      calories: Math.round(kcal100 * ratio),
      protein: Number((prot100 * ratio).toFixed(1)),
      carbs: Number((carb100 * ratio).toFixed(1)),
      fats: Number((fat100 * ratio).toFixed(1)),
      confidence: 'high',
      base: {
        weight_g: searchWeightGrams,
        calories: Math.round(kcal100 * ratio),
        protein: Number((prot100 * ratio).toFixed(1)),
        carbs: Number((carb100 * ratio).toFixed(1)),
        fats: Number((fat100 * ratio).toFixed(1)),
      }
    };

    setItems((prev) => [...prev, newItem]);
    setSelectedSearchProduct(null);
    setSearchResults([]);
    setSearchQuery('');
    setShowSearchModal(false);
  };

  // Add empty item
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        name: 'Novo Alimento',
        weight_g: 100,
        calories: 0,
        protein: 0,
        carbs: 0,
        fats: 0,
        confidence: 'high',
        base: {
          weight_g: 100,
          calories: 0,
          protein: 0,
          carbs: 0,
          fats: 0,
        },
      },
    ]);
  };

  // Delete item
  const handleDeleteItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculate dynamic totals
  const totalCalories = Math.round(items.reduce((sum, item) => sum + item.calories, 0));
  const totalProtein = Number(items.reduce((sum, item) => sum + item.protein, 0).toFixed(1));
  const totalCarbs = Number(items.reduce((sum, item) => sum + item.carbs, 0).toFixed(1));
  const totalFats = Number(items.reduce((sum, item) => sum + item.fats, 0).toFixed(1));

  // Confirm and save meal
  const handleConfirmSave = () => {
    const cleanItems: FoodItem[] = items.map(({ name, weight_g, calories, protein, carbs, fats, confidence }) => ({
      name,
      weight_g,
      calories,
      protein,
      carbs,
      fats,
      confidence,
    }));

    const newMeal: Meal = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      meal_type: mealType,
      items: cleanItems,
      photos,
      total_calories: totalCalories,
      total_protein: totalProtein,
      total_carbs: totalCarbs,
      total_fats: totalFats,
      notes: notes || undefined,
    };
    onSave(newMeal);
  };

  const mealTypesList: { value: MealType; label: string }[] = [
    { value: 'breakfast', label: 'Pequeno-almoço' },
    { value: 'lunch', label: 'Almoço' },
    { value: 'snack', label: 'Lanche' },
    { value: 'dinner', label: 'Jantar' },
    { value: 'supper', label: 'Ceia' },
    { value: 'extrasnack', label: 'Snacks' },
  ];

  return (
    <div className="glass-panel" style={reviewContainerStyle}>
      <div style={reviewHeaderStyle}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Revisão Nutricional da IA</h2>
        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
          Ajuste as porções proporcionalmente e confirme os ingredientes
        </span>
      </div>

      <div style={reviewContentSplitStyle}>
        {/* Left Side: Photo & Meal Classification */}
        <div style={sidebarStyle}>
          {photos.length > 0 && (
            <div style={photoGridStyle}>
              {photos.map((photo, i) => (
                <img key={i} src={photo} alt="Refeição analisada" style={photoPreviewStyle} />
              ))}
            </div>
          )}

          <div className="glass-card" style={mealTypeSelectorContainerStyle}>
            <label style={labelStyle}>Classificação da Refeição</label>
            <div style={mealTypeGridStyle}>
              {mealTypesList.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setMealType(type.value)}
                  style={{
                    ...mealTypeButtonStyle,
                    ...(mealType === type.value ? activeMealTypeButtonStyle : {}),
                  }}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Visual Ingredient Cards */}
        <div style={cardsContainerStyle}>
          <div style={cardsBodyStyle}>
            {items.length === 0 ? (
              <div style={emptyStateStyle}>
                <AlertCircle size={24} style={{ color: 'var(--color-text-muted)' }} />
                <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                  Nenhum ingrediente detetado. Adicione manualmente.
                </span>
              </div>
            ) : (
              items.map((item, index) => (
                <div key={index} className="glass-card" style={ingredientCardStyle}>
                  
                  {/* Title & Delete line */}
                  <div style={cardHeaderRowStyle}>
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                      placeholder="Nome do ingrediente..."
                      style={cardTitleInputStyle}
                    />
                    
                    <button
                      onClick={() => handleDeleteItem(index)}
                      style={deleteCardButtonStyle}
                      title="Apagar ingrediente"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Confidence Badge */}
                  {item.confidence && (
                    <div style={{ marginBottom: '8px' }}>
                      <span className={`badge-confidence ${item.confidence}`}>
                        {item.confidence === 'high' ? 'Alta Confiança' : item.confidence === 'medium' ? 'Confiança Média' : 'Baixa Confiança'}
                      </span>
                    </div>
                  )}

                  {/* Proportional Portion Slider & Buttons */}
                  <div className="glass-card" style={portionControlContainerStyle}>
                    <span style={portionLabelStyle}>Porção</span>
                    <div style={sliderRowStyle}>
                      <button
                        onClick={() => adjustWeightStep(index, -10)}
                        style={stepButtonStyle}
                        type="button"
                      >
                        <Minus size={14} />
                      </button>
                      
                      <input
                        type="range"
                        min="10"
                        max="600"
                        step="5"
                        value={item.weight_g}
                        onChange={(e) => handleWeightChange(index, parseInt(e.target.value) || 10)}
                        style={sliderStyle}
                      />

                      <button
                        onClick={() => adjustWeightStep(index, 10)}
                        style={stepButtonStyle}
                        type="button"
                      >
                        <Plus size={14} />
                      </button>

                      <div style={weightDisplayContainerStyle}>
                        <input
                          type="number"
                          value={item.weight_g || ''}
                          onChange={(e) => handleWeightChange(index, parseInt(e.target.value) || 0)}
                          style={weightNumberInputStyle}
                        />
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>g</span>
                      </div>
                    </div>
                  </div>

                  {/* Macros Grid */}
                  <div style={cardMacrosGridStyle}>
                    {/* Calories */}
                    <div style={{ ...macroInputWrapperStyle, borderColor: 'var(--macro-calories)' }}>
                      <label style={macroInputLabelStyle}>Calorias (kcal)</label>
                      <input
                        type="number"
                        value={item.calories || ''}
                        onChange={(e) => handleItemChange(index, 'calories', e.target.value)}
                        style={macroNumberInputStyle}
                      />
                    </div>
                    {/* Protein */}
                    <div style={{ ...macroInputWrapperStyle, borderColor: 'var(--macro-protein)' }}>
                      <label style={macroInputLabelStyle}>Proteína (g)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={item.protein || ''}
                        onChange={(e) => handleItemChange(index, 'protein', e.target.value)}
                        style={macroNumberInputStyle}
                      />
                    </div>
                    {/* Carbs */}
                    <div style={{ ...macroInputWrapperStyle, borderColor: 'var(--macro-carbs)' }}>
                      <label style={macroInputLabelStyle}>Hidratos (g)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={item.carbs || ''}
                        onChange={(e) => handleItemChange(index, 'carbs', e.target.value)}
                        style={macroNumberInputStyle}
                      />
                    </div>
                    {/* Fats */}
                    <div style={{ ...macroInputWrapperStyle, borderColor: 'var(--macro-fats)' }}>
                      <label style={macroInputLabelStyle}>Lípidos (g)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={item.fats || ''}
                        onChange={(e) => handleItemChange(index, 'fats', e.target.value)}
                        style={macroNumberInputStyle}
                      />
                    </div>
                  </div>

                </div>
              ))
            )}
          </div>

          {/* Add item and total sum layout */}
          <div style={actionsRowStyle}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowSearchModal(true)} style={searchOverlayTriggerButtonStyle}>
                <Search size={16} /> Pesquisar Alimento
              </button>
              <button onClick={handleAddItem} style={addItemButtonStyle}>
                <Plus size={16} /> Manual
              </button>
            </div>

            {/* Totals Summary */}
            <div className="glass-card" style={totalsCardStyle}>
              <div style={totalLabelStyle}>TOTAIS</div>
              <div style={totalsGridStyle}>
                <div style={totalItemStyle}>
                  <span style={totalNumStyle}>{totalCalories}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--macro-calories)', fontWeight: 600 }}>kcal</span>
                </div>
                <div style={totalItemStyle}>
                  <span style={totalNumStyle}>{formatNumber(totalProtein)}g</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--macro-protein)', fontWeight: 600 }}>P</span>
                </div>
                <div style={totalItemStyle}>
                  <span style={totalNumStyle}>{formatNumber(totalCarbs)}g</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--macro-carbs)', fontWeight: 600 }}>C</span>
                </div>
                <div style={totalItemStyle}>
                  <span style={totalNumStyle}>{formatNumber(totalFats)}g</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--macro-fats)', fontWeight: 600 }}>L</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Primary Confirm and Cancel Buttons */}
      <div style={buttonFooterStyle}>
        <button onClick={onCancel} style={cancelButtonStyle}>
          <X size={18} /> Descartar
        </button>
        <button onClick={handleConfirmSave} style={saveButtonStyle}>
          <Check size={18} /> Gravar Refeição
        </button>
      </div>

      {/* Search Modal Overlay */}
      {showSearchModal && (
        <div style={customSearchModalOverlayStyle}>
          <div className="glass-panel" style={customSearchModalContentStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>Pesquisar Alimento</h3>
              <button onClick={() => { setShowSearchModal(false); setSearchResults([]); setSearchQuery(''); }} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', fontSize: '1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={searchFoodDatabase} style={searchFormStyle}>
              <input
                type="text"
                placeholder="Nome do alimento (ex: Frango, Arroz)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={searchInputStyle}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowBarcodeScanner(true)}
                style={barcodeScannerTriggerButtonStyle}
                title="Ler código de barras"
              >
                <Barcode size={18} />
              </button>
              <button type="submit" disabled={isSearching} style={searchSubmitButtonStyle}>
                {isSearching ? <Loader2 size={16} style={{ animation: 'spin 1.5s linear infinite' }} /> : <Search size={18} />}
              </button>
            </form>

            {/* Results list */}

            {error && (
              <p style={{ fontSize: '0.8rem', color: '#ef4444', textAlign: 'center', padding: '10px 0' }}>{error}</p>
            )}

            <div style={searchResultsListStyle} className="hide-scrollbar">
              {searchResults.map((prod) => (
                <div
                  key={prod._id || generateId()}
                  onClick={() => handleSelectProduct(prod)}
                  className="glass-card"
                  style={searchResultItemStyle}
                >
                  {prod.image_front_thumb_url ? (
                    <img src={prod.image_front_thumb_url} alt="" style={searchThumbStyle} />
                  ) : (
                    <div style={searchThumbPlaceholderStyle}><ShoppingBag size={16} /></div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={searchResultNameStyle}>
                      {prod.product_name_pt || prod.product_name}
                    </h4>
                    <span style={searchResultSubStyle}>
                      {prod.brands || 'Sem Marca'} | {Math.round(Number(prod.nutriments?.['energy-kcal_100g'] || 0))} kcal/100g
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Product Detail Preview Modal */}
      {selectedSearchProduct && (
        <div style={customProductModalOverlayStyle}>
          <div className="glass-panel" style={customProductModalContentStyle}>
            <div style={customProductModalHeaderStyle}>
              <h3 style={customProductModalTitleStyle}>
                {selectedSearchProduct.product_name_pt || selectedSearchProduct.product_name || 'Alimento'}
              </h3>
              <span style={customProductModalBrandStyle}>
                Marca: {selectedSearchProduct.brands || 'Genérico'}
              </span>
            </div>

            <div style={customProductModalBodyStyle}>
              {/* Image Preview (Large!) */}
              <div style={customProductModalImageContainerStyle}>
                {selectedSearchProduct.image_front_url || selectedSearchProduct.image_url ? (
                  <img
                    src={selectedSearchProduct.image_front_url || selectedSearchProduct.image_url}
                    alt=""
                    style={customProductModalImageStyle}
                  />
                ) : (
                  <div style={customProductModalPlaceholderImageStyle}>
                    <ShoppingBag size={48} style={{ color: 'var(--color-text-muted)' }} />
                  </div>
                )}
              </div>

              {/* Nutrition Facts breakdown per portion size */}
              <div className="glass-card" style={customProductModalNutritionStyle}>
                <h4 style={customProductModalSectionTitleStyle}>
                  Valores Estimados ({searchWeightGrams}g)
                </h4>
                
                {/* Visual macros grid */}
                <div style={customProductModalMacrosGridStyle}>
                  <div style={{ ...customProductModalMacroItemStyle, borderColor: 'var(--macro-calories)' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                      {Math.round(getNutriment(selectedSearchProduct.nutriments, 'energy-kcal') * searchWeightGrams / 100)}
                    </span>
                    <span style={{ fontSize: '0.6rem', color: 'var(--macro-calories)', fontWeight: 700 }}>KCAL</span>
                  </div>
                  <div style={{ ...customProductModalMacroItemStyle, borderColor: 'var(--macro-protein)' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                      {((getNutriment(selectedSearchProduct.nutriments, 'proteins') * searchWeightGrams) / 100).toFixed(1)}g
                    </span>
                    <span style={{ fontSize: '0.6rem', color: 'var(--macro-protein)', fontWeight: 700 }}>PROT</span>
                  </div>
                  <div style={{ ...customProductModalMacroItemStyle, borderColor: 'var(--macro-carbs)' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                      {((getNutriment(selectedSearchProduct.nutriments, 'carbohydrates') * searchWeightGrams) / 100).toFixed(1)}g
                    </span>
                    <span style={{ fontSize: '0.6rem', color: 'var(--macro-carbs)', fontWeight: 700 }}>HC</span>
                  </div>
                  <div style={{ ...customProductModalMacroItemStyle, borderColor: 'var(--macro-fats)' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                      {((getNutriment(selectedSearchProduct.nutriments, 'fat') * searchWeightGrams) / 100).toFixed(1)}g
                    </span>
                    <span style={{ fontSize: '0.6rem', color: 'var(--macro-fats)', fontWeight: 700 }}>LIP</span>
                  </div>
                </div>
              </div>

              {/* Portion Control Slider and Input */}
              <div className="glass-card" style={customProductModalPortionStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={portionLabelStyle}>Quantidade</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '4px 8px', width: '90px' }}>
                    <input
                      type="number"
                      value={searchWeightGrams || ''}
                      onChange={(e) => setSearchWeightGrams(parseInt(e.target.value) || 0)}
                      style={{ width: '100%', background: 'none', border: 'none', outline: 'none', textAlign: 'right', fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}
                    />
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>g</span>
                  </div>
                </div>
                
                <input
                  type="range"
                  min="10"
                  max="1000"
                  step="5"
                  value={searchWeightGrams}
                  onChange={(e) => setSearchWeightGrams(parseInt(e.target.value) || 10)}
                  style={{ width: '100%', accentColor: 'var(--macro-calories)', cursor: 'pointer' }}
                />
              </div>
            </div>

            <div style={customProductModalActionsStyle}>
              <button onClick={() => setSelectedSearchProduct(null)} style={customProductModalCancelButtonStyle}>
                Cancelar
              </button>
              <button onClick={addSearchedProductToSession} style={customProductModalConfirmButtonStyle}>
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {showBarcodeScanner && (
        <div className="scanner-overlay-fullscreen">
          {/* Camera Viewfinder Container */}
          <div className="scanner-camera-container">
            <div id="barcode-reader-review" />
          </div>

          {/* Mask / Cutout Overlay */}
          <div className="scanner-mask-overlay">
            <div className="scanner-cutout-window">
              <div className="scanner-corner scanner-corner-tl" />
              <div className="scanner-corner scanner-corner-tr" />
              <div className="scanner-corner scanner-corner-bl" />
              <div className="scanner-corner scanner-corner-br" />
              <div className="scanner-laser-line" />
            </div>
          </div>

          {/* Close Button (Notch safe) */}
          <button
            onClick={() => { stopScanning(); setShowBarcodeScanner(false); }}
            className="scanner-close-btn"
            aria-label="Fechar leitor"
          >
            <span>
              <X size={22} />
            </span>
          </button>

          {/* Bottom Panel (Notch / Home-indicator safe) */}
          <div className="scanner-bottom-panel">
            <p className="scanner-instruction">
              {!isScanning ? 'A aceder à câmara...' : 'Aponte para o código de barras do produto'}
            </p>

            <div className="scanner-divider">
              <div className="scanner-divider-line" />
              <span>ou insira manualmente</span>
              <div className="scanner-divider-line" />
            </div>

            <div className="scanner-manual-input-row">
              <input
                type="number"
                inputMode="numeric"
                placeholder="Ex: 5601234567890"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                className="scanner-manual-input"
                onKeyDown={(e) => { if (e.key === 'Enter') handleBarcodeSubmit(barcodeInput); }}
              />
              <button
                type="button"
                onClick={() => handleBarcodeSubmit(barcodeInput)}
                disabled={!barcodeInput.trim()}
                className="scanner-manual-submit-btn"
              >
                Procurar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Component Styles
const reviewContainerStyle: React.CSSProperties = {
  padding: '20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
};

const reviewHeaderStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  borderBottom: '1px solid var(--border-glass)',
  paddingBottom: '12px',
};

const reviewContentSplitStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  gap: '20px',
  flexWrap: 'wrap',
};

const sidebarStyle: React.CSSProperties = {
  flex: '1 1 240px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
};

const photoGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
  gap: '8px',
};

const photoPreviewStyle: React.CSSProperties = {
  width: '100%',
  aspectRatio: '1',
  objectFit: 'cover',
  borderRadius: '12px',
  border: '1px solid var(--border-glass)',
};

const mealTypeSelectorContainerStyle: React.CSSProperties = {
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const mealTypeGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '8px',
};

const mealTypeButtonStyle: React.CSSProperties = {
  padding: '10px 4px',
  borderRadius: '10px',
  border: '1px solid var(--border-glass)',
  background: 'rgba(255,255,255,0.01)',
  fontSize: '0.8rem',
  fontWeight: 500,
  cursor: 'pointer',
  textAlign: 'center',
  color: 'var(--color-text-secondary)',
  transition: 'all 0.2s',
};

const activeMealTypeButtonStyle: React.CSSProperties = {
  background: 'var(--grad-calories)',
  color: '#fff',
  border: 'none',
  fontWeight: 600,
  boxShadow: '0 4px 10px rgba(16, 185, 129, 0.25)',
};

const cardsContainerStyle: React.CSSProperties = {
  flex: '3 1 500px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
};

const cardsBodyStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
  maxHeight: '480px',
  overflowY: 'auto',
  paddingRight: '6px',
};

const ingredientCardStyle: React.CSSProperties = {
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const cardHeaderRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
};

const cardTitleInputStyle: React.CSSProperties = {
  flex: 1,
  background: 'none',
  border: 'none',
  borderBottom: '1px solid var(--border-glass)',
  fontSize: '1.05rem',
  fontWeight: 600,
  outline: 'none',
  padding: '4px 0',
  color: '#fff',
};

const deleteCardButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--color-text-muted)',
  cursor: 'pointer',
  padding: '6px',
  borderRadius: '8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s',
};

const portionControlContainerStyle: React.CSSProperties = {
  padding: '8px 12px',
  backgroundColor: 'rgba(0, 0, 0, 0.15)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  flexWrap: 'wrap',
};

const portionLabelStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const sliderRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  flex: 1,
  justifyContent: 'flex-end',
  minWidth: '220px',
};

const stepButtonStyle: React.CSSProperties = {
  width: '26px',
  height: '26px',
  borderRadius: '50%',
  border: '1px solid var(--border-glass)',
  background: 'rgba(255,255,255,0.03)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--color-text-secondary)',
  cursor: 'pointer',
  transition: 'all 0.2s',
};

const sliderStyle: React.CSSProperties = {
  flex: 1,
  accentColor: 'var(--macro-calories)',
  cursor: 'pointer',
  height: '6px',
};

const weightDisplayContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  backgroundColor: 'var(--bg-input)',
  border: '1px solid var(--border-glass)',
  borderRadius: '8px',
  padding: '4px 8px',
  width: '75px',
};

const weightNumberInputStyle: React.CSSProperties = {
  width: '100%',
  background: 'none',
  border: 'none',
  outline: 'none',
  textAlign: 'right',
  fontSize: '0.9rem',
  fontWeight: 700,
  color: '#fff',
  appearance: 'none',
};

const cardMacrosGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: '10px',
};

const macroInputWrapperStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  borderLeft: '3px solid transparent',
  paddingLeft: '8px',
};

const macroInputLabelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--color-text-secondary)',
  fontWeight: 500,
};

const macroNumberInputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: 'var(--bg-input)',
  border: '1px solid var(--border-glass)',
  borderRadius: '8px',
  padding: '6px 8px',
  fontSize: '0.85rem',
  fontWeight: 600,
  outline: 'none',
  color: '#fff',
};

const emptyStateStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '50px 20px',
  gap: '12px',
  textAlign: 'center',
};

const actionsRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: '10px',
  flexWrap: 'wrap',
  gap: '16px',
};

const addItemButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '10px 16px',
  borderRadius: '12px',
  border: '1px dashed var(--border-glass)',
  background: 'none',
  color: 'var(--color-text-secondary)',
  fontSize: '0.9rem',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.2s',
};

const totalsCardStyle: React.CSSProperties = {
  padding: '12px 18px',
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
};

const totalLabelStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 700,
  color: 'var(--color-text-secondary)',
  letterSpacing: '0.05em',
};

const totalsGridStyle: React.CSSProperties = {
  display: 'flex',
  gap: '16px',
};

const totalItemStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  minWidth: '40px',
};

const totalNumStyle: React.CSSProperties = {
  fontSize: '1.05rem',
  fontWeight: 700,
};

const buttonFooterStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '12px',
  borderTop: '1px solid var(--border-glass)',
  paddingTop: '16px',
  marginTop: '8px',
};

const cancelButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '10px 20px',
  borderRadius: '12px',
  border: '1px solid var(--border-glass)',
  background: 'none',
  fontWeight: 500,
  fontSize: '0.9rem',
  cursor: 'pointer',
  color: 'var(--color-text-secondary)',
};

const saveButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '10px 24px',
  borderRadius: '12px',
  border: 'none',
  background: 'var(--grad-calories)',
  color: '#fff',
  fontWeight: 600,
  fontSize: '0.9rem',
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
};

const searchOverlayTriggerButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '10px 16px',
  borderRadius: '12px',
  border: 'none',
  background: 'var(--grad-calories)',
  color: '#fff',
  fontSize: '0.9rem',
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'all 0.2s',
  boxShadow: '0 4px 10px rgba(16, 185, 129, 0.2)',
};

// Search modal popup styles
const customSearchModalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  backdropFilter: 'blur(10px)',
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '16px',
};

const customSearchModalContentStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '400px',
  height: '80vh',
  padding: '20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
  boxShadow: '0 15px 45px rgba(0,0,0,0.6)',
  borderRadius: '16px',
};

const searchFormStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  width: '100%',
};

const searchInputStyle: React.CSSProperties = {
  flex: 1,
  padding: '12px 14px',
  backgroundColor: 'var(--bg-input)',
  border: '1px solid var(--border-glass)',
  borderRadius: '12px',
  outline: 'none',
  fontSize: '16px',
  color: '#fff',
};

const barcodeScannerTriggerButtonStyle: React.CSSProperties = {
  width: '46px',
  height: '46px',
  borderRadius: '12px',
  border: '1px solid var(--border-glass)',
  background: 'rgba(255,255,255,0.02)',
  color: 'var(--color-text-secondary)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'all 0.2s',
  WebkitTapHighlightColor: 'transparent',
};

const searchSubmitButtonStyle: React.CSSProperties = {
  width: '46px',
  height: '46px',
  borderRadius: '12px',
  border: 'none',
  background: 'var(--grad-calories)',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'all 0.2s',
  WebkitTapHighlightColor: 'transparent',
  boxShadow: '0 4px 10px rgba(16, 185, 129, 0.2)',
};

const searchResultsListStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  overflowY: 'auto',
};

const searchResultItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '10px 12px',
  cursor: 'pointer',
  transition: 'transform 0.2s, background-color 0.2s',
  WebkitTapHighlightColor: 'transparent',
};

const searchThumbStyle: React.CSSProperties = {
  width: '42px',
  height: '42px',
  borderRadius: '8px',
  objectFit: 'cover',
  backgroundColor: '#fff',
};

const searchThumbPlaceholderStyle: React.CSSProperties = {
  width: '42px',
  height: '42px',
  borderRadius: '8px',
  backgroundColor: 'rgba(255,255,255,0.03)',
  border: '1px solid var(--border-glass)',
  color: 'var(--color-text-muted)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const searchResultNameStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 700,
  color: '#fff',
  margin: 0,
  textOverflow: 'ellipsis',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
};

const searchResultSubStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  color: 'var(--color-text-secondary)',
};

// Product detail preview overlay styles
const customProductModalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  backdropFilter: 'blur(10px)',
  zIndex: 10000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '16px',
};

const customProductModalContentStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '400px',
  padding: '24px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  boxShadow: '0 15px 45px rgba(0,0,0,0.6)',
  borderRadius: '16px',
};

const customProductModalHeaderStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  borderBottom: '1px solid var(--border-glass)',
  paddingBottom: '12px',
};

const customProductModalTitleStyle: React.CSSProperties = {
  fontSize: '1.15rem',
  fontWeight: 800,
  color: '#fff',
  textAlign: 'center',
};

const customProductModalBrandStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: 'var(--color-text-secondary)',
  textAlign: 'center',
};

const customProductModalBodyStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
};

const customProductModalImageContainerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: 'rgba(255,255,255,0.02)',
  border: '1px solid var(--border-glass)',
  borderRadius: '12px',
  height: '150px',
  width: '100%',
  overflow: 'hidden',
};

const customProductModalImageStyle: React.CSSProperties = {
  height: '100%',
  maxWidth: '100%',
  objectFit: 'contain',
};

const customProductModalPlaceholderImageStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  width: '100%',
};

const customProductModalNutritionStyle: React.CSSProperties = {
  padding: '12px 14px',
};

const customProductModalSectionTitleStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 700,
  color: 'var(--color-text-secondary)',
  marginBottom: '8px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const customProductModalMacrosGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: '8px',
};

const customProductModalMacroItemStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '6px 4px',
  borderRadius: '8px',
  borderLeft: '2px solid',
  backgroundColor: 'rgba(255,255,255,0.01)',
};

const customProductModalPortionStyle: React.CSSProperties = {
  padding: '12px 14px',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
};

const customProductModalActionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  marginTop: '4px',
};

const customProductModalCancelButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '12px',
  borderRadius: '10px',
  border: '1px solid var(--border-glass)',
  background: 'rgba(255,255,255,0.02)',
  color: 'var(--color-text-secondary)',
  fontWeight: 600,
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
};

const customProductModalConfirmButtonStyle: React.CSSProperties = {
  flex: 1.5,
  padding: '12px',
  borderRadius: '10px',
  border: 'none',
  background: 'var(--grad-calories)',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
};

// Barcode styles (modal classes are defined in index.css)

