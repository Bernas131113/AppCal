import React, { useState } from 'react';
import type { Meal, UserGoals } from '../types';
import { formatDateLabel, formatNumber, isSameDay } from '../utils/helpers';
import { ChevronLeft, ChevronRight, Trash2, Calendar, Coffee, Utensils, Moon, Carrot, Sparkles } from 'lucide-react';

interface DashboardProps {
  meals: Meal[];
  goals: UserGoals;
  onDeleteMeal: (id: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ meals, goals, onDeleteMeal }) => {
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

  const getMealIcon = (type: string) => {
    switch (type) {
      case 'breakfast': return <Coffee size={18} style={{ color: '#60a5fa' }} />;
      case 'lunch': return <Utensils size={18} style={{ color: '#34d399' }} />;
      case 'dinner': return <Moon size={18} style={{ color: '#a78bfa' }} />;
      case 'snack': return <Carrot size={18} style={{ color: '#f59e0b' }} />;
      default: return <Utensils size={18} />;
    }
  };

  const getMealTypeLabel = (type: string) => {
    switch (type) {
      case 'breakfast': return 'Pequeno-almoço';
      case 'lunch': return 'Almoço';
      case 'dinner': return 'Jantar';
      case 'snack': return 'Snack';
      default: return 'Refeição';
    }
  };

  return (
    <div style={dashboardContainerStyle}>
      
      {/* Date Switcher */}
      <div className="glass-card" style={dateSwitcherStyle}>
        <button onClick={() => shiftDate(-1)} style={dateArrowStyle}>
          <ChevronLeft size={20} />
        </button>
        
        <div style={dateLabelContainerStyle}>
          <Calendar size={18} style={{ color: 'var(--macro-calories)' }} />
          <span style={dateLabelStyle}>{formatDateLabel(selectedDate.toISOString())}</span>
        </div>

        <button onClick={() => shiftDate(1)} style={dateArrowStyle} disabled={isSameDay(selectedDate, new Date())}>
          <ChevronRight size={20} style={{ opacity: isSameDay(selectedDate, new Date()) ? 0.3 : 1 }} />
        </button>
      </div>

      {/* Calories Overview Banner */}
      <div className="glass-panel animate-pulse-slow" style={caloriesBannerStyle}>
        <div style={calDetailsStyle}>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Consumo Calórico
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={calNumStyle}>{dailyCalories}</span>
            <span style={{ fontSize: '1.2rem', color: 'var(--color-text-secondary)' }}>/ {goals.calories} kcal</span>
          </div>
          
          <div style={progressBarBgStyle}>
            <div style={{ ...progressBarFillStyle, width: `${calPercent}%`, background: 'var(--grad-calories)' }} />
          </div>
          <span style={percentageTextStyle}>{calPercent}% da meta diária concluída</span>
        </div>

        <div style={calCircleContainerStyle}>
          <svg width="90" height="90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="8" />
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="var(--macro-calories)"
              strokeWidth="8"
              strokeDasharray="251.2"
              strokeDashoffset={251.2 - (251.2 * calPercent) / 100}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
              style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
            />
            <text x="50" y="55" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="bold">
              {calPercent}%
            </text>
          </svg>
        </div>
      </div>

      {/* Macros Tracker */}
      <div style={macrosGridStyle}>
        {/* Protein */}
        <div className="glass-card" style={macroCardStyle}>
          <div style={macroHeaderStyle}>
            <span style={{ color: 'var(--macro-protein)', fontWeight: 600 }}>Proteínas</span>
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
            <span style={{ color: 'var(--macro-carbs)', fontWeight: 600 }}>Hidratos</span>
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
            <span style={{ color: 'var(--macro-fats)', fontWeight: 600 }}>Lípidos</span>
            <span style={macroValueStyle}>{formatNumber(dailyFats)}g / {goals.fats}g</span>
          </div>
          <div style={macroBarBgStyle}>
            <div style={{ ...macroBarFillStyle, width: `${fatsPercent}%`, backgroundColor: 'var(--macro-fats)' }} />
          </div>
          <span style={macroSubStyle}>{fatsPercent}% concluído</span>
        </div>
      </div>

      {/* History Log section */}
      <div style={{ marginTop: '10px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} style={{ color: 'var(--macro-calories)' }} />
          <span>Refeições Registadas ({filteredMeals.length})</span>
        </h3>

        {filteredMeals.length === 0 ? (
          <div className="glass-card" style={emptyStateStyle}>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>
              Ainda não registou refeições para esta data.
            </p>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>
              Tire uma foto ou escreva o que comeu acima para começar!
            </span>
          </div>
        ) : (
          <div style={mealsListStyle}>
            {filteredMeals.map((meal) => (
              <div key={meal.id} className="glass-card" style={mealCardStyle}>
                <div style={mealHeaderRowStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={mealIconBgStyle}>
                      {getMealIcon(meal.meal_type)}
                    </div>
                    <div>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{getMealTypeLabel(meal.meal_type)}</h4>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {new Date(meal.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '1.05rem', fontWeight: 700 }}>{meal.total_calories}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginLeft: '2px' }}>kcal</span>
                    </div>
                    <button onClick={() => onDeleteMeal(meal.id)} style={deleteMealButtonStyle} title="Apagar refeição">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div style={mealDetailSplitStyle}>
                  {/* Photo thumbnails */}
                  {meal.photos && meal.photos.length > 0 && (
                    <div style={mealPhotoGridStyle}>
                      {meal.photos.map((photo, index) => (
                        <img key={index} src={photo} alt="Comida registada" style={mealPhotoThumbStyle} />
                      ))}
                    </div>
                  )}

                  {/* Food items breakdown */}
                  <div style={mealItemsContainerStyle}>
                    <div style={foodItemsTagsContainerStyle}>
                      {meal.items.map((item, i) => (
                        <div key={i} style={foodItemTagStyle} className="glass-card">
                          <span style={{ fontWeight: 500 }}>{item.name}</span>
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>({item.weight_g}g)</span>
                          <span style={{ color: 'var(--macro-calories)', fontWeight: 600, fontSize: '0.8rem' }}>{item.calories} kcal</span>
                        </div>
                      ))}
                    </div>
                    
                    {meal.notes && (
                      <p style={mealNotesStyle}>
                        <strong>Nota:</strong> {meal.notes}
                      </p>
                    )}

                    {/* Macro totals summary line */}
                    <div style={mealMacroSummaryLineStyle}>
                      <span style={mealMacroLabelStyle}>P: <strong style={{ color: 'var(--macro-protein)' }}>{formatNumber(meal.total_protein)}g</strong></span>
                      <span style={mealMacroLabelStyle}>C: <strong style={{ color: 'var(--macro-carbs)' }}>{formatNumber(meal.total_carbs)}g</strong></span>
                      <span style={mealMacroLabelStyle}>L: <strong style={{ color: 'var(--macro-fats)' }}>{formatNumber(meal.total_fats)}g</strong></span>
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

// Styles
const dashboardContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  width: '100%',
};

const dateSwitcherStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 14px',
  borderRadius: '14px',
};

const dateArrowStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--color-text-secondary)',
  display: 'flex',
  alignItems: 'center',
  padding: '4px',
};

const dateLabelContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const dateLabelStyle: React.CSSProperties = {
  fontSize: '0.95rem',
  fontWeight: 600,
};

const caloriesBannerStyle: React.CSSProperties = {
  padding: '20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '16px',
};

const calDetailsStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  flex: 1,
};

const calNumStyle: React.CSSProperties = {
  fontSize: '2rem',
  fontWeight: 800,
  lineHeight: 1,
  color: '#fff',
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
  transition: 'width 0.4s ease-in-out',
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
  gap: '12px',
};

const macroCardStyle: React.CSSProperties = {
  padding: '12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
};

const macroHeaderStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  fontSize: '0.8rem',
};

const macroValueStyle: React.CSSProperties = {
  fontSize: '0.9rem',
  fontWeight: 700,
  color: '#fff',
  marginTop: '2px',
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
  padding: '24px',
  textAlign: 'center',
  borderStyle: 'dashed',
};

const mealsListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const mealCardStyle: React.CSSProperties = {
  padding: '14px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const mealHeaderRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderBottom: '1px solid rgba(255,255,255,0.03)',
  paddingBottom: '10px',
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

const deleteMealButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--color-text-muted)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  padding: '4px',
  transition: 'color 0.2s',
};

const mealDetailSplitStyle: React.CSSProperties = {
  display: 'flex',
  gap: '14px',
  flexWrap: 'wrap',
};

const mealPhotoGridStyle: React.CSSProperties = {
  display: 'flex',
  gap: '6px',
  flexShrink: 0,
};

const mealPhotoThumbStyle: React.CSSProperties = {
  width: '54px',
  height: '54px',
  objectFit: 'cover',
  borderRadius: '8px',
  border: '1px solid var(--border-glass)',
};

const mealItemsContainerStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  minWidth: '200px',
};

const foodItemsTagsContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
};

const foodItemTagStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  padding: '4px 8px',
  borderRadius: '6px',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  background: 'rgba(255,255,255,0.01)',
  border: '1px solid rgba(255,255,255,0.04)',
};

const mealNotesStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--color-text-secondary)',
  fontStyle: 'italic',
};

const mealMacroSummaryLineStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  fontSize: '0.75rem',
  color: 'var(--color-text-secondary)',
  marginTop: '2px',
};

const mealMacroLabelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
};
