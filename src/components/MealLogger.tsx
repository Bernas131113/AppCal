import React, { useState, useRef, useEffect } from 'react';
import { Camera, Image as ImageIcon, Mic, Square, Trash2, Send, Loader2, Plus, AlertCircle, Search, Star, Zap, ShoppingBag, Barcode } from 'lucide-react';
import { BarcodeScanner } from './BarcodeScanner';
import { compressImage } from '../utils/helpers';
import { analyzeMealWithGemini } from '../utils/gemini';
import { Waveform } from './Waveform';
import { getFavorites, deleteFavorite } from '../utils/storage';
import type { FoodItem, MealType, FavoriteMeal, Meal } from '../types';
import { generateId } from '../utils/helpers';
import { useTranslation } from '../utils/i18n';

interface MealLoggerProps {
  apiKey: string;
  model: string;
  onAnalysisComplete: (result: {
    meal_type: MealType;
    items: FoodItem[];
    photos: string[];
    notes: string;
  }) => void;
  onInstantLog: (meal: Meal) => void;
  initialMode?: 'ai' | 'search' | 'quick' | 'fav';
}

const getNutriment = (nutriments: any, key: string): number => {
  if (!nutriments) return 0;
  const val = nutriments[`${key}_100g`] ?? nutriments[key] ?? 0;
  return Number(val) || 0;
};

export const MealLogger: React.FC<MealLoggerProps> = ({ apiKey, model, onAnalysisComplete, onInstantLog, initialMode }) => {
  const { t } = useTranslation();
  const [activeMode, setActiveMode] = useState<'ai' | 'search' | 'quick' | 'fav'>(initialMode || 'ai');
  const [sessionItems, setSessionItems] = useState<FoodItem[]>([]);
  const [selectedMealType, setSelectedMealType] = useState<MealType>('lunch');
  const [error, setError] = useState<string | null>(null);

  // IA visual states
  const [photos, setPhotos] = useState<string[]>([]);
  const [textNotes, setTextNotes] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  // Custom camera states removed in favor of native system camera options in the file picker

  // Mic/Voice states
  const [isRecording, setIsRecording] = useState(false);
  const [audioBase64, setAudioBase64] = useState<string | undefined>(undefined);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Search states (Open Food Facts)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedSearchProduct, setSelectedSearchProduct] = useState<any | null>(null);
  const [searchWeightGrams, setSearchWeightGrams] = useState(100);

  // Barcode scanner states
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

  // Quick Add states
  const [quickName, setQuickName] = useState('');
  const [quickCalories, setQuickCalories] = useState(0);
  const [quickProtein, setQuickProtein] = useState(0);
  const [quickCarbs, setQuickCarbs] = useState(0);
  const [quickFats, setQuickFats] = useState(0);
  const [quickWeight, setQuickWeight] = useState(100);

  // Favorites state
  const [favoritesList, setFavoritesList] = useState<FavoriteMeal[]>([]);

  // Load favorites when tab becomes active
  useEffect(() => {
    if (activeMode === 'fav') {
      setFavoritesList(getFavorites());
    }
  }, [activeMode]);

  // Suggest meal type by hour on mount
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 11) setSelectedMealType('breakfast');
    else if (hour >= 11 && hour < 15) setSelectedMealType('lunch');
    else if (hour >= 15 && hour < 19) setSelectedMealType('snack');
    else if (hour >= 19 && hour < 22) setSelectedMealType('dinner');
    else setSelectedMealType('supper');
  }, []);

  // Custom camera methods removed in favor of native file input câmara option

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      try {
        const compressedBase64 = await compressImage(files[i], 1024, 0.8);
        setPhotos((prev) => [...prev, compressedBase64]);
      } catch (err) {
        console.error('Erro ao comprimir ficheiro:', err);
        setError(t('logger_err_upload'));
      }
    }
    e.target.value = '';
  };

  // Mic/Voice recording methods
  const startRecording = async () => {
    setError(null);
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          setAudioBase64(reader.result as string);
        };
        stream.getTracks().forEach((track) => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error(err);
      setError(t('logger_err_mic'));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleBarcodeSubmit = async (code: string) => {
    if (!code.trim()) return;
    setIsSearching(true);
    setError(null);
    setShowBarcodeScanner(false);
    
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code.trim()}.json`, {
        headers: { 'User-Agent': 'AppCalNutritionApp - Web - Version 1.0 - contact@appcal.com' }
      });
      if (!response.ok) throw new Error(t('logger_err_barcode'));
      const data = await response.json();
      
      if (data.status === 1 && data.product) {
        setSelectedSearchProduct(data.product);
        setSearchWeightGrams(100); // Default to 100g
      } else {
        setError(t('logger_err_product_not_found'));
      }
    } catch (err) {
      console.error(err);
      setError(t('logger_err_network'));
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
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s max before IA fallback triggers

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
        setError(t('logger_err_no_food'));
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.log('Erro na base de dados externa ou limite excedido. A tentar alternativa por IA...', err);
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
          if (geminiResponse.status === 429) {
            throw new Error('A quota de utilização do Gemini foi excedida. Por favor, aguarde 1 minuto para tentar novamente.');
          }
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
          setError(t('logger_err_none'));
        }
      } catch (geminiErr) {
        console.error('Falha dupla (OFF e Gemini):', geminiErr);
        setError(t('logger_err_fallback'));
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

    const kcal100 = Number(prod.nutriments?.['energy-kcal_100g'] || prod.nutriments?.['energy-kcal'] || 0);
    const prot100 = Number(prod.nutriments?.['proteins_100g'] || prod.nutriments?.['proteins'] || 0);
    const carb100 = Number(prod.nutriments?.['carbohydrates_100g'] || prod.nutriments?.['carbohydrates'] || 0);
    const fat100 = Number(prod.nutriments?.['fat_100g'] || prod.nutriments?.['fat'] || 0);

    const ratio = searchWeightGrams / 100;

    const newItem: FoodItem = {
      name: fullName,
      weight_g: searchWeightGrams,
      calories: Math.round(kcal100 * ratio),
      protein: Number((prot100 * ratio).toFixed(1)),
      carbs: Number((carb100 * ratio).toFixed(1)),
      fats: Number((fat100 * ratio).toFixed(1)),
      confidence: 'high',
    };

    setSessionItems((prev) => [...prev, newItem]);
    setSelectedSearchProduct(null);
    setSearchResults([]);
    setSearchQuery('');
  };

  // Add Manual Quick Item
  const handleAddQuickItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickName.trim()) return;

    const newItem: FoodItem = {
      name: quickName,
      weight_g: quickWeight,
      calories: quickCalories,
      protein: quickProtein,
      carbs: quickCarbs,
      fats: quickFats,
      confidence: 'high',
    };

    setSessionItems((prev) => [...prev, newItem]);
    setQuickName('');
    setQuickCalories(0);
    setQuickProtein(0);
    setQuickCarbs(0);
    setQuickFats(0);
  };

  // Favorites Methods
  const logFavoriteInstantly = (fav: FavoriteMeal) => {
    const newMeal: Meal = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      meal_type: selectedMealType,
      items: fav.items,
      photos: [],
      total_calories: fav.total_calories,
      total_protein: fav.total_protein,
      total_carbs: fav.total_carbs,
      total_fats: fav.total_fats,
      notes: `Registado a partir de favorito: ${fav.name}`,
    };
    onInstantLog(newMeal);
  };

  const loadFavoriteToSession = (fav: FavoriteMeal) => {
    setSessionItems(fav.items);
    setError(null);
    // Go to search tab for visual clarity of manual items
    setActiveMode('search');
  };

  const removeFavorite = (id: string) => {
    const updated = deleteFavorite(id);
    setFavoritesList(updated);
  };

  // Proceed to review items compiled manually (Search / Quick add / Favorites)
  const handleReviewSession = () => {
    if (sessionItems.length === 0) return;
    onAnalysisComplete({
      meal_type: selectedMealType,
      items: sessionItems,
      photos: [],
      notes: 'Adicionado manualmente.',
    });
    setSessionItems([]); // Clear session
  };

  // Run Visual AI Analysis
  const handleAnalyzeAI = async () => {
    setError(null);
    if (photos.length === 0 && textNotes.trim() === '' && !audioBase64) {
      setError('Tire uma foto ou grave notas de voz para analisar com IA.');
      return;
    }
    setIsAnalyzing(true);
    try {
      const result = await analyzeMealWithGemini(apiKey, model, photos, textNotes, audioBase64);
      onAnalysisComplete({
        meal_type: result.meal_type,
        items: result.items as FoodItem[],
        photos: photos,
        notes: textNotes,
      });
      setPhotos([]);
      setTextNotes('');
      setAudioBase64(undefined);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Erro na ligação ao Gemini. Configure a API Key.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="glass-panel" style={{ ...containerStyle, position: 'relative' }}>
      {isAnalyzing && (
        <div style={scannerOverlayStyle}>
          <div style={scannerLaserStyle} />
          <div style={scannerContentStyle}>
            <Loader2 size={36} style={{ animation: 'spin 1.5s linear infinite', color: 'var(--macro-calories)' }} />
            <h3 style={scannerTitleStyle}>Motor de IA Activo</h3>
            <p style={scannerSubStyle}>A analisar texturas, volumes e ingredientes...</p>
          </div>
        </div>
      )}
      {/* iOS optimized tab bar */}
      <div style={modeTabContainerStyle}>
        <button
          onClick={() => { setActiveMode('ai'); setError(null); }}
          style={{ ...modeTabButtonStyle, ...(activeMode === 'ai' ? modeTabActiveStyle : {}) }}
        >
          <Camera size={18} />
          <span>{t('logger_tab_ai')}</span>
        </button>

        <button
          onClick={() => { setActiveMode('search'); setError(null); }}
          style={{ ...modeTabButtonStyle, ...(activeMode === 'search' ? modeTabActiveStyle : {}) }}
        >
          <Search size={18} />
          <span>{t('logger_tab_search')}</span>
        </button>

        <button
          onClick={() => { setActiveMode('quick'); setError(null); }}
          style={{ ...modeTabButtonStyle, ...(activeMode === 'quick' ? modeTabActiveStyle : {}) }}
        >
          <Plus size={18} />
          <span>{t('logger_tab_quick')}</span>
        </button>

        <button
          onClick={() => { setActiveMode('fav'); setError(null); }}
          style={{ ...modeTabButtonStyle, ...(activeMode === 'fav' ? modeTabActiveStyle : {}) }}
        >
          <Star size={18} />
          <span>{t('favorites')}</span>
        </button>
      </div>

      {error && (
        <div style={errorContainerStyle}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* MODE 1: VISUAL AI */}
      {activeMode === 'ai' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {photos.length > 0 ? (
              <div style={galleryGridStyle}>
                {photos.map((photo, index) => (
                  <div key={index} className="glass-card" style={thumbnailContainerStyle}>
                    <img src={photo} alt={`Comida ${index + 1}`} style={thumbnailStyle} />
                    <button onClick={() => setPhotos(photos.filter((_, i) => i !== index))} style={deleteThumbnailButtonStyle}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                {photos.length < 5 && (
                  <label style={{ ...addMorePhotosButtonStyle, cursor: 'pointer' }} className="glass-card">
                    <Plus size={20} />
                    <span style={{ fontSize: '0.75rem' }}>+ Foto</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                    />
                  </label>
                )}
              </div>
            ) : (
              <div style={captureButtonsContainerStyle}>
                <label style={{ ...actionButtonStyle, cursor: 'pointer' }} className="glass-card">
                  <ImageIcon size={26} style={{ color: 'var(--macro-calories)' }} />
                  <span style={actionButtonTextStyle}>Tirar Foto / Galeria</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            )}
          </div>

          <div style={textAudioContainerStyle}>
            <textarea
              value={textNotes}
              onChange={(e) => setTextNotes(e.target.value)}
              placeholder="Opcional: Detalhes sobre os ingredientes ou cozedura..."
              style={textareaStyle}
              disabled={isAnalyzing}
            />

            <div style={voiceControlsRowStyle}>
              {isRecording ? (
                <div style={recordingStateStyle}>
                  <Waveform isRecording={isRecording} />
                  <button onClick={stopRecording} style={stopRecordingButtonStyle}>
                    <Square size={14} /> Parar Nota de Voz
                  </button>
                </div>
              ) : audioBase64 ? (
                <div style={audioReadyStyle}>
                  <span>Nota de voz gravada</span>
                  <button onClick={() => setAudioBase64(undefined)} style={deleteAudioButtonStyle}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : (
                <button onClick={startRecording} style={recordButtonStyle} disabled={isAnalyzing}>
                  <Mic size={14} /> Gravar Nota de Voz
                </button>
              )}
            </div>
          </div>

          <button
            onClick={handleAnalyzeAI}
            disabled={isAnalyzing || (photos.length === 0 && textNotes.trim() === '' && !audioBase64)}
            style={isAnalyzing ? analyzingButtonStyle : submitLogButtonStyle}
          >
            {isAnalyzing ? (
              <>
                <Loader2 size={18} className="animate-pulse-slow" style={{ animation: 'spin 1.5s linear infinite' }} />
                <span>Análise Inteligente a Decorrer...</span>
              </>
            ) : (
              <>
                <Send size={18} />
                <span>Analisar Foto com IA</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* MODE 2: DATABASE SEARCH (Open Food Facts) */}
      {activeMode === 'search' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <form onSubmit={searchFoodDatabase} style={searchFormStyle}>
            <input
              type="text"
              placeholder="Pesquisar alimento (ex: Iogurte, Granola)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={searchInputStyle}
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
      )}

      {/* MODE 3: QUICK ADD FORM */}
      {activeMode === 'quick' && (
        <form onSubmit={handleAddQuickItem} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={inputGroupStyle}>
            <label style={labelStyle}>{t('logger_label_name')}</label>
            <input
              type="text"
              placeholder={t('logger_placeholder_name')}
              value={quickName}
              onChange={(e) => setQuickName(e.target.value)}
              required
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            <div style={inputGroupStyle}>
              <label style={{ ...labelStyle, color: 'var(--macro-calories)' }}>{t('review_product_estimated').split(' ')[0]} (kcal)</label>
              <input
                type="number"
                value={quickCalories || ''}
                onChange={(e) => setQuickCalories(parseInt(e.target.value) || 0)}
                style={inputStyle}
              />
            </div>
            
            <div style={inputGroupStyle}>
              <label style={labelStyle}>{t('logger_label_weight_total')}</label>
              <input
                type="number"
                value={quickWeight || ''}
                onChange={(e) => setQuickWeight(parseInt(e.target.value) || 0)}
                style={inputStyle}
              />
            </div>

            <div style={inputGroupStyle}>
              <label style={{ ...labelStyle, color: 'var(--macro-protein)' }}>{t('profile_label_protein')} (g)</label>
              <input
                type="number"
                step="0.1"
                value={quickProtein || ''}
                onChange={(e) => setQuickProtein(parseFloat(e.target.value) || 0)}
                style={inputStyle}
              />
            </div>

            <div style={inputGroupStyle}>
              <label style={{ ...labelStyle, color: 'var(--macro-carbs)' }}>{t('profile_label_carbs')} (g)</label>
              <input
                type="number"
                step="0.1"
                value={quickCarbs || ''}
                onChange={(e) => setQuickCarbs(parseFloat(e.target.value) || 0)}
                style={inputStyle}
              />
            </div>

            <div style={{ ...inputGroupStyle, gridColumn: 'span 2' }}>
              <label style={{ ...labelStyle, color: 'var(--macro-fats)' }}>{t('profile_label_fats')} (g)</label>
              <input
                type="number"
                step="0.1"
                value={quickFats || ''}
                onChange={(e) => setQuickFats(parseFloat(e.target.value) || 0)}
                style={inputStyle}
              />
            </div>
          </div>

          <button type="submit" disabled={!quickName.trim()} style={quickAddSubmitButtonStyle}>
            <Plus size={16} /> {t('logger_btn_add_manual')}
          </button>
        </form>
      )}

      {activeMode === 'fav' && (
        <div style={favoritesListContainerStyle} className="hide-scrollbar">
          {favoritesList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
              {t('logger_fav_empty')}
              <br />
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', display: 'inline-block' }}>
                {t('logger_fav_empty_hint')}
              </span>
            </div>
          ) : (
            favoritesList.map((fav) => (
              <div key={fav.id} className="glass-card" style={favItemCardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>{fav.name}</h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--macro-calories)', fontWeight: 600 }}>
                      {fav.total_calories} kcal
                    </span>
                  </div>
                  <button onClick={() => removeFavorite(fav.id)} style={deleteFavButtonStyle} title={t('logger_fav_delete_title')}>
                    <Trash2 size={14} />
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '8px', fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                  <span>P: {fav.total_protein}g</span>
                  <span>C: {fav.total_carbs}g</span>
                  <span>L: {fav.total_fats}g</span>
                </div>

                <div style={favActionsRowStyle}>
                  <button onClick={() => loadFavoriteToSession(fav)} style={favLoadButtonStyle}>
                    {t('logger_fav_load')}
                  </button>
                  <button onClick={() => logFavoriteInstantly(fav)} style={favInstantLogButtonStyle}>
                    <Zap size={12} /> {t('logger_fav_log_now')}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* BOTTOM MANUALLY ADDED ITEMS DOCK (Visible for Search/Quick Add modes when items exist) */}
      {activeMode !== 'ai' && sessionItems.length > 0 && (
        <div className="glass-card" style={sessionDockContainerStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={sessionDockTitleStyle}>{t('logger_dock_title')} ({sessionItems.length} {t('logger_dock_items')})</span>
            <button onClick={() => setSessionItems([])} style={clearSessionButtonStyle}>{t('logger_dock_clear')}</button>
          </div>
          
          <div style={sessionItemsListStyle}>
            {sessionItems.map((item, index) => (
              <div key={index} style={sessionItemLineStyle}>
                <span style={sessionItemNameStyle}>{item.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={sessionItemCalStyle}>{item.calories} kcal ({item.weight_g}g)</span>
                  <button onClick={() => setSessionItems(sessionItems.filter((_, i) => i !== index))} style={deleteLineItemButtonStyle}>
                    &times;
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={sessionDockControlsRowStyle}>
            <select
              value={selectedMealType}
              onChange={(e) => setSelectedMealType(e.target.value as MealType)}
              style={sessionSelectStyle}
            >
              {mealTypesList.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>

            <button onClick={handleReviewSession} style={sessionReviewButtonStyle}>
              {t('logger_dock_continue')}
            </button>
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
                {t('logger_product_brand')}: {selectedSearchProduct.brands || 'Genérico'}
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
                  {t('logger_product_estimated')} ({searchWeightGrams}g)
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
                  <span style={labelStyle}>{t('logger_product_qty')}</span>
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
                {t('review_btn_cancel')}
              </button>
              <button onClick={addSearchedProductToSession} style={customProductModalConfirmButtonStyle}>
                {t('review_btn_add_item').split(' ')[0]}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {showBarcodeScanner && (
        <BarcodeScanner
          onScanSuccess={handleBarcodeSubmit}
          onClose={() => setShowBarcodeScanner(false)}
        />
      )}

      {!apiKey && activeMode === 'ai' && (
        <p style={demoWarningStyle}>
          ⚠️ A correr no <strong>Modo Demo</strong>. Configure a API Key para análise real de fotos.
        </p>
      )}
    </div>
  );
};

const mealTypesList: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Pequeno-almoço' },
  { value: 'lunch', label: 'Almoço' },
  { value: 'snack', label: 'Lanche' },
  { value: 'dinner', label: 'Jantar' },
  { value: 'supper', label: 'Ceia' },
  { value: 'extrasnack', label: 'Snacks' },
];

// iPhone compatible responsive layouts
const containerStyle: React.CSSProperties = {
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
};

const modeTabContainerStyle: React.CSSProperties = {
  display: 'flex',
  background: 'rgba(0, 0, 0, 0.2)',
  border: '1px solid var(--border-glass)',
  borderRadius: '12px',
  padding: '3px',
  gap: '4px',
};

const modeTabButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '12px 6px', // large iOS touch targets
  border: 'none',
  background: 'none',
  borderRadius: '8px',
  color: 'var(--color-text-secondary)',
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '4px',
  fontSize: '0.75rem',
  fontWeight: 600,
  transition: 'all 0.2s',
  WebkitTapHighlightColor: 'transparent',
};

const modeTabActiveStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.05)',
  color: '#fff',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
};

const errorContainerStyle: React.CSSProperties = {
  backgroundColor: 'rgba(239, 68, 68, 0.1)',
  border: '1px solid rgba(239, 68, 68, 0.2)',
  color: '#f87171',
  borderRadius: '12px',
  padding: '10px 14px',
  fontSize: '0.85rem',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  lineHeight: 1.4,
};

// Unused local camera styles removed (Visual AI uses native system sheet instead)

const captureButtonsContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
};

const actionButtonStyle: React.CSSProperties = {
  flex: 1,
  height: '100px', // large iOS touch targets
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '8px',
  cursor: 'pointer',
  border: '1px solid var(--border-glass)',
  borderRadius: '16px',
  background: 'rgba(255, 255, 255, 0.01)',
  transition: 'all 0.2s',
  WebkitTapHighlightColor: 'transparent',
};

const actionButtonTextStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 500,
  color: 'var(--color-text-secondary)',
};

const galleryGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
  gap: '8px',
};

const thumbnailContainerStyle: React.CSSProperties = {
  position: 'relative',
  aspectRatio: '1',
  borderRadius: '12px',
  overflow: 'hidden',
};

const thumbnailStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};

const deleteThumbnailButtonStyle: React.CSSProperties = {
  position: 'absolute',
  top: '4px',
  right: '4px',
  background: 'rgba(239, 68, 68, 0.85)',
  color: '#fff',
  border: 'none',
  borderRadius: '50%',
  width: '24px',
  height: '24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};

const addMorePhotosButtonStyle: React.CSSProperties = {
  aspectRatio: '1',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '4px',
  cursor: 'pointer',
  border: '1px dashed var(--border-glass)',
  borderRadius: '12px',
  background: 'none',
  color: 'var(--color-text-secondary)',
};

const textAudioContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  height: '75px',
  padding: '12px',
  backgroundColor: 'var(--bg-input)',
  border: '1px solid var(--border-glass)',
  borderRadius: '12px',
  outline: 'none',
  fontSize: '16px', // iOS zoom prevention
  resize: 'none',
  transition: 'border-color 0.2s',
  lineHeight: 1.4,
};

const voiceControlsRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
};

const recordButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid var(--border-glass)',
  borderRadius: '20px',
  padding: '8px 16px', // large hit box
  fontSize: '0.85rem',
  fontWeight: 500,
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
};

const recordingStateStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
  width: '100%',
  justifyContent: 'space-between',
};

const stopRecordingButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  background: 'rgba(239, 68, 68, 0.15)',
  border: '1px solid rgba(239, 68, 68, 0.3)',
  color: '#f87171',
  borderRadius: '20px',
  padding: '8px 16px',
  fontSize: '0.85rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const audioReadyStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  background: 'rgba(16, 185, 129, 0.1)',
  border: '1px solid rgba(16, 185, 129, 0.2)',
  color: '#34d399',
  borderRadius: '20px',
  padding: '8px 16px',
  fontSize: '0.85rem',
  fontWeight: 500,
};

const deleteAudioButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#f87171',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  padding: '2px',
};

const submitLogButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px', // iPhone hit size
  borderRadius: '12px',
  border: 'none',
  background: 'var(--grad-calories)',
  color: '#fff',
  fontWeight: 600,
  fontSize: '0.95rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
};

const analyzingButtonStyle: React.CSSProperties = {
  ...submitLogButtonStyle,
  background: 'var(--bg-input)',
  border: '1px solid var(--border-glass)',
  color: 'var(--color-text-secondary)',
  cursor: 'not-allowed',
};

const demoWarningStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: 'var(--macro-fats)',
  textAlign: 'center',
  marginTop: '4px',
};

// Search Styles
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
  fontSize: '16px', // iOS input size
  color: '#fff',
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
};

const searchResultsListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  maxHeight: '260px',
  overflowY: 'auto',
  paddingRight: '2px',
};

const searchResultItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '10px 12px',
  cursor: 'pointer',
};

const searchThumbStyle: React.CSSProperties = {
  width: '40px',
  height: '40px',
  objectFit: 'cover',
  borderRadius: '6px',
  border: '1px solid var(--border-glass)',
};

const searchThumbPlaceholderStyle: React.CSSProperties = {
  width: '40px',
  height: '40px',
  borderRadius: '6px',
  border: '1px solid var(--border-glass)',
  backgroundColor: 'rgba(255,255,255,0.02)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--color-text-muted)',
};

const searchResultNameStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 600,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const searchResultSubStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--color-text-secondary)',
};

// Input base styles
const inputGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  backgroundColor: 'var(--bg-input)',
  border: '1px solid var(--border-glass)',
  borderRadius: '10px',
  outline: 'none',
  fontSize: '16px', // iOS size
  color: '#fff',
};

const quickAddSubmitButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px',
  borderRadius: '10px',
  border: 'none',
  background: 'var(--grad-calories)',
  color: '#fff',
  fontWeight: 600,
  fontSize: '0.9rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  cursor: 'pointer',
  marginTop: '8px',
};

// Favorites styling
const favoritesListContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  maxHeight: '340px',
  overflowY: 'auto',
  paddingRight: '2px',
};

const favItemCardStyle: React.CSSProperties = {
  padding: '12px 14px',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
};

const deleteFavButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--color-text-muted)',
  cursor: 'pointer',
  padding: '2px',
};

const favActionsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  marginTop: '8px',
};

const favLoadButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '8px',
  borderRadius: '8px',
  border: '1px solid var(--border-glass)',
  background: 'none',
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  cursor: 'pointer',
};

const favInstantLogButtonStyle: React.CSSProperties = {
  flex: 1.2,
  padding: '8px',
  borderRadius: '8px',
  border: 'none',
  background: 'var(--grad-calories)',
  color: '#fff',
  fontSize: '0.8rem',
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  cursor: 'pointer',
};

// Session Items Dock
const sessionDockContainerStyle: React.CSSProperties = {
  padding: '12px 14px',
  backgroundColor: 'rgba(16, 185, 129, 0.04)',
  border: '1px solid rgba(16, 185, 129, 0.15)',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  marginTop: '12px',
};

const sessionDockTitleStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 700,
  color: '#fff',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const clearSessionButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--color-text-muted)',
  fontSize: '0.75rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const sessionItemsListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  maxHeight: '120px',
  overflowY: 'auto',
};

const sessionItemLineStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '6px 8px',
  backgroundColor: 'rgba(0,0,0,0.15)',
  borderRadius: '6px',
};

const sessionItemNameStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 500,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: '150px',
};

const sessionItemCalStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--color-text-secondary)',
};

const deleteLineItemButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--macro-protein)',
  fontSize: '1rem',
  fontWeight: 700,
  cursor: 'pointer',
  lineHeight: 1,
  padding: '0 4px',
};

const sessionDockControlsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '10px',
};

const sessionSelectStyle: React.CSSProperties = {
  flex: 1,
  padding: '10px',
  backgroundColor: 'var(--bg-input)',
  border: '1px solid var(--border-glass)',
  borderRadius: '10px',
  fontSize: '16px', // iOS size
  color: '#fff',
};

const sessionReviewButtonStyle: React.CSSProperties = {
  flex: 1.5,
  padding: '10px',
  borderRadius: '10px',
  border: 'none',
  background: 'var(--grad-calories)',
  color: '#fff',
  fontSize: '0.85rem',
  fontWeight: 700,
  cursor: 'pointer',
};

const scannerOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(8, 12, 20, 0.88)',
  backdropFilter: 'blur(8px)',
  zIndex: 10,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '16px',
  overflow: 'hidden',
};

const scannerLaserStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: '3px',
  background: 'linear-gradient(90deg, transparent, var(--macro-calories), transparent)',
  animation: 'scan 2s linear infinite',
  boxShadow: '0 0 12px var(--macro-calories)',
};

const scannerContentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '12px',
  textAlign: 'center',
  padding: '24px',
};

const scannerTitleStyle: React.CSSProperties = {
  fontSize: '1.2rem',
  fontWeight: 800,
  color: '#fff',
  marginTop: '8px',
};

const scannerSubStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: 'var(--color-text-secondary)',
  maxWidth: '260px',
  lineHeight: 1.4,
};

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

// Barcode styles
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

// Barcode styles (modal classes are defined in index.css)
