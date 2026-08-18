import React, { useState } from 'react';
import type { Meal, UserGoals } from '../types';
import { formatDateLabel, formatNumber, isSameDay } from '../utils/helpers';
import { addFavorite } from '../utils/storage';
import { ChevronLeft, ChevronRight, Trash2, Calendar, Coffee, Utensils, Moon, Carrot, Sparkles, Star, Edit2 } from 'lucide-react';

interface DashboardProps {
  meals: Meal[];
  goals: UserGoals;
  onDeleteMeal: (id: string) => void;
  onEditMeal: (meal: Meal) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ meals, goals, onDeleteMeal, onEditMeal }) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Filter meals for the selected day
  const filteredMeals = meals.filter((meal) =>
    isSameDay(new Date(meal.timestamp), selectedDate)
  );

  // Calculate totals for the selected day
  const dailyCalories = filteredMeals.reduce((sum, meal) => sum + meal.total_calories, 0);
  const dailyProtein = filteredMeals.reduce((sum, meal) => sum + meal.total_protein, 0);
  const dailyCarbs = filteredMeals.reduce((sum, meal) => sum + meal.total_carbs, 0);
  const dailyFats = filteredMeals.reduce((sum, meal) => sum + meal.total_fats, 0);

  // Remaining Calories Calculation
  const caloriesRemaining = goals.calories - dailyCalories;

  // Goal percentage calculations
  const calPercent = Math.min(100, Math.round((dailyCalories / goals.calories) * 100)) || 0;
  const protPercent = Math.min(100, Math.round((dailyProtein / goals.protein) * 100)) || 0;
  const carbsPercent = Math.min(100, Math.round((dailyCarbs / goals.carbs) * 100)) || 0;
  const fatsPercent = Math.min(100, Math.round((dailyFats / goals.fats) * 100)) || 0;

  // Change active date day-by-day
  const shiftDate = (amount: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + amount);
    setSelectedDate(newDate);
  };

  const handleDatePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      setSelectedDate(new Date(e.target.value));
    }
  };

  const getMealIcon = (type: string) => {
    switch (type) {
      case 'breakfast': return <Coffee size={18} style={{ color: '#60a5fa' }} />;
      case 'lunch': return <Utensils size={18} style={{ color: '#34d399' }} />;
      case 'dinner': return <Moon size={18} style={{ color: '#a78bfa' }} />;
      case 'snack': return <Carrot size={18} style={{ color: '#f59e0b' }} />;
      case 'supper': return <Moon size={18} style={{ color: '#ec4899' }} />;
      case 'extrasnack': return <Sparkles size={18} style={{ color: '#10b981' }} />;
      default: return <Utensils size={18} />;
    }
  };

  const getMealTypeLabel = (type: string) => {
    switch (type) {
      case 'breakfast': return 'Pequeno-almoço';
      case 'lunch': return 'Almoço';
      case 'dinner': return 'Jantar';
      case 'snack': return 'Lanche';
      case 'supper': return 'Ceia';
      case 'extrasnack': return 'Snacks';
      default: return 'Refeição';
    }
  };

  // Add meal to favorites
  const handleSaveAsFavorite = (meal: Meal) => {
    const defaultName = `Meu ${getMealTypeLabel(meal.meal_type)} habitual`;
    const name = prompt('Como quer chamar este favorito?', defaultName);
    if (name && name.trim()) {
      addFavorite({
        id: Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36),
        name: name.trim(),
        items: meal.items,
        total_calories: meal.total_calories,
        total_protein: meal.total_protein,
        total_carbs: meal.total_carbs,
        total_fats: meal.total_fats,
      });
      alert('Refeição guardada nos Favoritos com sucesso!');
    }
  };

  return (
    <div style={dashboardContainerStyle}>
      
      {/* Date Switcher & Native iOS Styled DatePicker */}
      <div className="glass-card" style={dateSwitcherStyle}>
        <button onClick={() => shiftDate(-1)} style={dateArrowStyle}>
          <ChevronLeft size={22} />
        </button>
        
        <div style={dateLabelContainerStyle}>
          <Calendar size={18} style={{ color: 'var(--macro-calories)' }} />
          <span style={dateLabelStyle}>{formatDateLabel(selectedDate.toISOString())}</span>
          {/* Invisible date picker over label for nice touch interaction */}
          <input
            type="date"
            onChange={handleDatePickerChange}
            value={selectedDate.toISOString().split('T')[0]}
            style={invisibleDatePickerStyle}
          />
        </div>

        <button onClick={() => shiftDate(1)} style={dateArrowStyle} disabled={isSameDay(selectedDate, new Date())}>
          <ChevronRight size={22} style={{ opacity: isSameDay(selectedDate, new Date()) ? 0.3 : 1 }} />
        </button>
      </div>

      {/* iPhone Premium Calorie Tracker Banner */}
      <div className="glass-panel" style={caloriesBannerStyle}>
        <div style={calDetailsStyle}>
          <span style={calHeaderTitleStyle}>
            Balanço Calórico Diário
          </span>
          
          {/* Meta - Consumidas = Restantes Equation display */}
          <div style={calEquationRowStyle}>
            <div style={eqItemStyle}>
              <span style={eqValStyle}>{goals.calories}</span>
              <span style={eqLabelStyle}>Meta</span>
            </div>
            <span style={eqOperatorStyle}>-</span>
            <div style={eqItemStyle}>
              <span style={eqValStyle}>{dailyCalories}</span>
              <span style={eqLabelStyle}>Comido</span>
            </div>
            <span style={eqOperatorStyle}>=</span>
            <div style={eqItemStyle}>
              <span style={{ 
                ...eqValStyle, 
                color: caloriesRemaining >= 0 ? 'var(--macro-calories)' : 'var(--macro-protein)',
                textShadow: caloriesRemaining >= 0 ? '0 0 10px rgba(16,185,129,0.3)' : '0 0 10px rgba(244,63,94,0.3)'
              }}>
                {caloriesRemaining}
              </span>
              <span style={eqLabelStyle}>{caloriesRemaining >= 0 ? 'Restam' : 'Excesso'}</span>
            </div>
          </div>

          <div style={progressBarBgStyle}>
            <div style={{ 
              ...progressBarFillStyle, 
              width: `${calPercent}%`, 
              background: caloriesRemaining >= 0 ? 'var(--grad-calories)' : 'var(--grad-protein)'
            }} />
          </div>
          
          <span style={percentageTextStyle}>
            {calPercent}% do teu orçamento consumido
          </span>
        </div>

        {/* Dynamic circular ring */}
        <div style={calCircleContainerStyle}>
          <svg width="85" height="85" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="8" />
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke={caloriesRemaining >= 0 ? 'var(--macro-calories)' : 'var(--macro-protein)'}
              strokeWidth="8"
              strokeDasharray="251.2"
              strokeDashoffset={251.2 - (251.2 * calPercent) / 100}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
              style={{ transition: 'stroke-dashoffset 0.4s ease-out' }}
            />
            <text x="50" y="55" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="800">
              {calPercent}%
            </text>
          </svg>
        </div>
      </div>

      {/* Macros Tracker Progress Bars */}
      <div style={macrosGridStyle}>
        {/* Protein */}
        <div className="glass-card" style={macroCardStyle}>
          <div style={macroHeaderStyle}>
            <span style={{ color: 'var(--macro-protein)', fontWeight: 700 }}>Proteínas</span>
            <span style={macroValueStyle}>{formatNumber(dailyProtein)}g / {goals.protein}g</span>
          </div>
          <div style={macroBarBgStyle}>
            <div style={{ ...macroBarFillStyle, width: `${protPercent}%`, backgroundColor: 'var(--macro-protein)' }} />
          </div>
          <span style={macroSubStyle}>{protPercent}% concluído</span>
        </div>

        {/* Carbs */}
        <div className="glass-card" style={macroCardStyle}>
          <div style={macroHeaderStyle}>
            <span style={{ color: 'var(--macro-carbs)', fontWeight: 700 }}>Hidratos</span>
            <span style={macroValueStyle}>{formatNumber(dailyCarbs)}g / {goals.carbs}g</span>
          </div>
          <div style={macroBarBgStyle}>
            <div style={{ ...macroBarFillStyle, width: `${carbsPercent}%`, backgroundColor: 'var(--macro-carbs)' }} />
          </div>
          <span style={macroSubStyle}>{carbsPercent}% concluído</span>
        </div>

        {/* Fats */}
        <div className="glass-card" style={macroCardStyle}>
          <div style={macroHeaderStyle}>
            <span style={{ color: 'var(--macro-fats)', fontWeight: 700 }}>Lípidos</span>
            <span style={macroValueStyle}>{formatNumber(dailyFats)}g / {goals.fats}g</span>
          </div>
          <div style={macroBarBgStyle}>
            <div style={{ ...macroBarFillStyle, width: `${fatsPercent}%`, backgroundColor: 'var(--macro-fats)' }} />
          </div>
          <span style={macroSubStyle}>{fatsPercent}% concluído</span>
        </div>
      </div>

      {/* History Log Timeline */}
      <div style={{ marginTop: '8px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} style={{ color: 'var(--macro-calories)' }} />
          <span>Diário Alimentar ({filteredMeals.length})</span>
        </h3>

        {filteredMeals.length === 0 ? (
          <div className="glass-card" style={emptyStateStyle}>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>
              Sem refeições registadas para esta data.
            </p>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginTop: '4px' }}>
              Tira uma foto ao teu prato ou pesquisa um alimento acima para registar!
            </span>
          </div>
        ) : (
          <div style={mealsListStyle}>
            {filteredMeals.map((meal) => (
              <div key={meal.id} className="glass-card" style={mealCardStyle}>
                
                {/* Header row */}
                <div style={mealHeaderRowStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={mealIconBgStyle}>
                      {getMealIcon(meal.meal_type)}
                    </div>
                    <div>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>{getMealTypeLabel(meal.meal_type)}</h4>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                        {new Date(meal.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '1rem', fontWeight: 800 }}>{meal.total_calories}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginLeft: '1px' }}>kcal</span>
                    </div>
                    
                    {/* Save to Favorites Star Button */}
                    <button
                      onClick={() => handleSaveAsFavorite(meal)}
                      style={starButtonStyle}
                      title="Guardar como Favorito"
                    >
                      <Star size={16} />
                    </button>

                    {/* Edit button */}
                    <button
                      onClick={() => onEditMeal(meal)}
                      style={editMealButtonStyle}
                      title="Editar Refeição"
                    >
                      <Edit2 size={16} />
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={() => onDeleteMeal(meal.id)}
                      style={deleteMealButtonStyle}
                      title="Eliminar Refeição"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Sub details block */}
                <div style={mealDetailSplitStyle}>
                  {/* Photo thumbnails */}
                  {meal.photos && meal.photos.length > 0 && (
                    <div style={mealPhotoGridStyle}>
                      {meal.photos.map((photo, index) => (
                        <img key={index} src={photo} alt="" style={mealPhotoThumbStyle} />
                      ))}
                    </div>
                  )}

                  {/* Food items tag list */}
                  <div style={mealItemsContainerStyle}>
                    <div style={foodItemsTagsContainerStyle}>
                      {meal.items.map((item, i) => (
                        <div key={i} style={foodItemTagStyle} className="glass-card">
                          <span style={{ fontWeight: 600 }}>{item.name}</span>
                          <span style={{ color: 'var(--color-text-secondary)' }}>{item.weight_g}g</span>
                          <span style={{ color: 'var(--macro-calories)', fontWeight: 700 }}>{item.calories} kcal</span>
                        </div>
                      ))}
                    </div>
                    
                    {meal.notes && (
                      <p style={mealNotesStyle}>
                        "{meal.notes}"
                      </p>
                    )}

                    {/* Macro sub totals */}
                    <div style={mealMacroSummaryLineStyle}>
                      <span>P: <strong style={{ color: 'var(--macro-protein)' }}>{formatNumber(meal.total_protein)}g</strong></span>
                      <span>C: <strong style={{ color: 'var(--macro-carbs)' }}>{formatNumber(meal.total_carbs)}g</strong></span>
                      <span>L: <strong style={{ color: 'var(--macro-fats)' }}>{formatNumber(meal.total_fats)}g</strong></span>
                    </div>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

// CSS styles
const dashboardContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
  width: '100%',
};

const dateSwitcherStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 14px',
  borderRadius: '14px',
  position: 'relative',
};

const dateArrowStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--color-text-secondary)',
  display: 'flex',
  alignItems: 'center',
  padding: '8px', // large iOS touch zone
  WebkitTapHighlightColor: 'transparent',
};

const dateLabelContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  position: 'relative',
  cursor: 'pointer',
};

const dateLabelStyle: React.CSSProperties = {
  fontSize: '0.95rem',
  fontWeight: 700,
};

const invisibleDatePickerStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  opacity: 0,
  cursor: 'pointer',
};

const caloriesBannerStyle: React.CSSProperties = {
  padding: '16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '14px',
};

const calDetailsStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  flex: 1,
};

const calHeaderTitleStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--color-text-secondary)',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const calEquationRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  marginTop: '2px',
};

const eqItemStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
};

const eqValStyle: React.CSSProperties = {
  fontSize: '1.25rem',
  fontWeight: 800,
  color: '#fff',
  lineHeight: 1.1,
};

const eqLabelStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: 'var(--color-text-secondary)',
  fontWeight: 500,
};

const eqOperatorStyle: React.CSSProperties = {
  fontSize: '1rem',
  color: 'var(--color-text-muted)',
  fontWeight: 500,
};

const progressBarBgStyle: React.CSSProperties = {
  height: '6px',
  width: '100%',
  backgroundColor: 'rgba(255,255,255,0.05)',
  borderRadius: '3px',
  overflow: 'hidden',
  marginTop: '4px',
};

const progressBarFillStyle: React.CSSProperties = {
  height: '100%',
  borderRadius: '3px',
  transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
};

const percentageTextStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--color-text-secondary)',
};

const calCircleContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const macrosGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '10px',
};

const macroCardStyle: React.CSSProperties = {
  padding: '12px 10px',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
};

const macroHeaderStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  fontSize: '0.75rem',
};

const macroValueStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 800,
  color: '#fff',
  marginTop: '1px',
};

const macroBarBgStyle: React.CSSProperties = {
  height: '4px',
  width: '100%',
  backgroundColor: 'rgba(255,255,255,0.05)',
  borderRadius: '2px',
  overflow: 'hidden',
};

const macroBarFillStyle: React.CSSProperties = {
  height: '100%',
  borderRadius: '2px',
  transition: 'width 0.4s ease-out',
};

const macroSubStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: 'var(--color-text-muted)',
};

const emptyStateStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '30px 16px',
  textAlign: 'center',
  borderStyle: 'dashed',
};

const mealsListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};

const mealCardStyle: React.CSSProperties = {
  padding: '12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};

const mealHeaderRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderBottom: '1px solid rgba(255,255,255,0.03)',
  paddingBottom: '8px',
};

const mealIconBgStyle: React.CSSProperties = {
  width: '32px',
  height: '32px',
  borderRadius: '8px',
  backgroundColor: 'rgba(255,255,255,0.03)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const starButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--macro-fats)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  padding: '6px',
  borderRadius: '6px',
  transition: 'transform 0.2s',
  WebkitTapHighlightColor: 'transparent',
};

const deleteMealButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--color-text-muted)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  padding: '6px',
  borderRadius: '6px',
  transition: 'color 0.2s',
  WebkitTapHighlightColor: 'transparent',
};

const editMealButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--color-text-secondary)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  padding: '6px',
  borderRadius: '6px',
  transition: 'color 0.2s',
  WebkitTapHighlightColor: 'transparent',
};

const mealDetailSplitStyle: React.CSSProperties = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
};

const mealPhotoGridStyle: React.CSSProperties = {
  display: 'flex',
  gap: '6px',
  flexShrink: 0,
};

const mealPhotoThumbStyle: React.CSSProperties = {
  width: '50px',
  height: '50px',
  objectFit: 'cover',
  borderRadius: '8px',
  border: '1px solid var(--border-glass)',
};

const mealItemsContainerStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  minWidth: '200px',
};

const foodItemsTagsContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '5px',
};

const foodItemTagStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  padding: '3px 6px',
  borderRadius: '6px',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  background: 'rgba(255,255,255,0.01)',
  border: '1px solid rgba(255,255,255,0.04)',
};

const mealNotesStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  color: 'var(--color-text-secondary)',
  fontStyle: 'italic',
};

const mealMacroSummaryLineStyle: React.CSSProperties = {
  display: 'flex',
  gap: '10px',
  fontSize: '0.72rem',
  color: 'var(--color-text-secondary)',
};
