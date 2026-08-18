import React, { useState, useEffect } from 'react';
import type { FoodItem, MealType, Meal } from '../types';
import { Trash2, Plus, Check, X, AlertCircle, Minus } from 'lucide-react';
import { generateId, formatNumber } from '../utils/helpers';

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
}

export const MealReview: React.FC<MealReviewProps> = ({
  initialMealType,
  initialItems,
  photos,
  notes,
  onSave,
  onCancel,
}) => {
  const [mealType, setMealType] = useState<MealType>(initialMealType);
  const [items, setItems] = useState<EditableFoodItem[]>([]);

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
            <button onClick={handleAddItem} style={addItemButtonStyle}>
              <Plus size={16} /> Adicionar Ingrediente
            </button>

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
