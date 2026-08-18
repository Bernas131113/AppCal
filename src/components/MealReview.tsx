import React, { useState, useEffect } from 'react';
import type { FoodItem, MealType, Meal } from '../types';
import { Trash2, Plus, Check, X, AlertCircle } from 'lucide-react';
import { generateId, formatNumber } from '../utils/helpers';

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
  const [items, setItems] = useState<FoodItem[]>([]);

  // Initialize and ensure all numbers are parsed correctly
  useEffect(() => {
    const formatted = initialItems.map((item) => ({
      name: item.name || 'Alimento',
      weight_g: Number(item.weight_g) || 100,
      calories: Number(item.calories) || 0,
      protein: Number(item.protein) || 0,
      carbs: Number(item.carbs) || 0,
      fats: Number(item.fats) || 0,
      confidence: item.confidence || 'medium',
    }));
    setItems(formatted);
  }, [initialItems]);

  // Edit item handler
  const handleItemChange = (index: number, field: keyof FoodItem, value: string | number) => {
    setItems((prev) => {
      const updated = [...prev];
      if (field === 'name') {
        updated[index] = { ...updated[index], [field]: value as string };
      } else {
        // Handle numeric fields
        const numVal = value === '' ? 0 : Number(value);
        updated[index] = { ...updated[index], [field]: Math.max(0, numVal) };
      }
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
    const newMeal: Meal = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      meal_type: mealType,
      items,
      photos,
      total_calories: totalCalories,
      total_protein: totalProtein,
      total_carbs: totalCarbs,
      total_fats: totalFats,
      notes: notes || undefined,
    };
    onSave(newMeal);
  };

  const getMealTypeLabel = (type: MealType): string => {
    switch (type) {
      case 'breakfast': return 'Pequeno-almoço';
      case 'lunch': return 'Almoço';
      case 'dinner': return 'Jantar';
      case 'snack': return 'Snack';
    }
  };

  return (
    <div className="glass-panel" style={reviewContainerStyle}>
      <div style={reviewHeaderStyle}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Revisão Nutricional da IA</h2>
        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
          Ajuste as porções e detalhes se necessário
        </span>
      </div>

      <div style={reviewContentSplitStyle}>
        
        {/* Photos and Info Sidebar */}
        <div style={sidebarStyle}>
          {photos.length > 0 && (
            <div style={photoGridStyle}>
              {photos.map((photo, i) => (
                <img key={i} src={photo} alt="Refeição analisada" style={photoPreviewStyle} />
              ))}
            </div>
          )}

          <div className="glass-card" style={mealTypeSelectorContainerStyle}>
            <label style={labelStyle}>Tipo de Refeição</label>
            <div style={mealTypeGridStyle}>
              {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setMealType(type)}
                  style={{
                    ...mealTypeButtonStyle,
                    ...(mealType === type ? activeMealTypeButtonStyle : {}),
                  }}
                >
                  {getMealTypeLabel(type)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Ingredients Table */}
        <div style={tableContainerStyle}>
          <div style={tableHeaderRowStyle}>
            <span style={{ ...tableColStyle, flex: 3.5 }}>Ingrediente</span>
            <span style={{ ...tableColStyle, flex: 1.2 }}>Peso (g)</span>
            <span style={{ ...tableColStyle, flex: 1.2 }}>Cal (kcal)</span>
            <span style={{ ...tableColStyle, flex: 1.1 }}>Prot (g)</span>
            <span style={{ ...tableColStyle, flex: 1.1 }}>Carb (g)</span>
            <span style={{ ...tableColStyle, flex: 1.1 }}>Lip (g)</span>
            <span style={{ ...tableColStyle, width: '40px', flex: 'none' }}></span>
          </div>

          <div style={tableBodyStyle}>
            {items.length === 0 ? (
              <div style={emptyStateStyle}>
                <AlertCircle size={20} style={{ color: 'var(--color-text-muted)' }} />
                <span style={{ color: 'var(--color-text-secondary)' }}>Nenhum ingrediente. Adicione abaixo.</span>
              </div>
            ) : (
              items.map((item, index) => (
                <div key={index} style={tableRowStyle} className="glass-card">
                  <div style={{ ...tableColStyle, flex: 3.5, flexDirection: 'column', gap: '4px' }}>
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                      style={tableInputStyle}
                    />
                    {item.confidence && (
                      <span className={`badge-confidence ${item.confidence}`} style={{ alignSelf: 'flex-start' }}>
                        {item.confidence === 'high' ? 'Alta Confiança' : item.confidence === 'medium' ? 'Confiança Média' : 'Baixa Confiança'}
                      </span>
                    )}
                  </div>
                  
                  <div style={{ ...tableColStyle, flex: 1.2 }}>
                    <input
                      type="number"
                      value={item.weight_g || ''}
                      onChange={(e) => handleItemChange(index, 'weight_g', e.target.value)}
                      style={tableInputStyle}
                    />
                  </div>

                  <div style={{ ...tableColStyle, flex: 1.2 }}>
                    <input
                      type="number"
                      value={item.calories || ''}
                      onChange={(e) => handleItemChange(index, 'calories', e.target.value)}
                      style={tableInputStyle}
                    />
                  </div>

                  <div style={{ ...tableColStyle, flex: 1.1 }}>
                    <input
                      type="number"
                      step="0.1"
                      value={item.protein || ''}
                      onChange={(e) => handleItemChange(index, 'protein', e.target.value)}
                      style={tableInputStyle}
                    />
                  </div>

                  <div style={{ ...tableColStyle, flex: 1.1 }}>
                    <input
                      type="number"
                      step="0.1"
                      value={item.carbs || ''}
                      onChange={(e) => handleItemChange(index, 'carbs', e.target.value)}
                      style={tableInputStyle}
                    />
                  </div>

                  <div style={{ ...tableColStyle, flex: 1.1 }}>
                    <input
                      type="number"
                      step="0.1"
                      value={item.fats || ''}
                      onChange={(e) => handleItemChange(index, 'fats', e.target.value)}
                      style={tableInputStyle}
                    />
                  </div>

                  <button
                    onClick={() => handleDeleteItem(index)}
                    style={deleteRowButtonStyle}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Add item and total sum layout */}
          <div style={tableActionsRowStyle}>
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
          <X size={18} /> Cancelar Registo
        </button>
        <button onClick={handleConfirmSave} style={saveButtonStyle}>
          <Check size={18} /> Confirmar e Gravar
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
  flexWrap: 'wrap', // wraps gracefully on mobile
};

const sidebarStyle: React.CSSProperties = {
  flex: '1 1 200px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
};

const photoGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
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
  padding: '12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
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
  padding: '8px 4px',
  borderRadius: '8px',
  border: '1px solid var(--border-glass)',
  background: 'none',
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
  boxShadow: '0 4px 10px rgba(16, 185, 129, 0.2)',
};

const tableContainerStyle: React.CSSProperties = {
  flex: '3 1 450px',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};

const tableHeaderRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '8px 12px',
  color: 'var(--color-text-secondary)',
  fontSize: '0.8rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const tableColStyle: React.CSSProperties = {
  padding: '0 4px',
  display: 'flex',
  alignItems: 'center',
};

const tableBodyStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  maxHeight: '320px',
  overflowY: 'auto',
  paddingRight: '4px',
};

const tableRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '10px 12px',
};

const tableInputStyle: React.CSSProperties = {
  width: '100%',
  background: 'none',
  border: 'none',
  borderBottom: '1px solid transparent',
  padding: '4px 2px',
  fontSize: '0.9rem',
  outline: 'none',
  transition: 'border-color 0.2s',
  fontWeight: 500,
  color: 'var(--color-text-primary)',
};

const deleteRowButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--color-text-muted)',
  cursor: 'pointer',
  padding: '4px',
  marginLeft: '8px',
  flexShrink: 0,
  transition: 'color 0.2s',
};

const emptyStateStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '30px',
  gap: '8px',
};

const tableActionsRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: '10px',
  flexWrap: 'wrap',
  gap: '12px',
};

const addItemButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 14px',
  borderRadius: '10px',
  border: '1px dashed var(--border-glass)',
  background: 'none',
  color: 'var(--color-text-secondary)',
  fontSize: '0.85rem',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.2s',
};

const totalsCardStyle: React.CSSProperties = {
  padding: '10px 16px',
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
};

const totalLabelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
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
  minWidth: '36px',
};

const totalNumStyle: React.CSSProperties = {
  fontSize: '1rem',
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
  padding: '10px 18px',
  borderRadius: '10px',
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
  padding: '10px 22px',
  borderRadius: '10px',
  border: 'none',
  background: 'var(--grad-calories)',
  color: '#fff',
  fontWeight: 600,
  fontSize: '0.9rem',
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
};
