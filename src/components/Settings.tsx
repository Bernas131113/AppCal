import React, { useState, useEffect } from 'react';
import type { AppSettings, UserProfile } from '../types';
import { getSettings, saveSettings } from '../utils/storage';
import { resetSupabaseClient } from '../utils/supabase';
import { Settings as SettingsIcon, Target, Save, CheckCircle, User, PieChart, Sparkles, Scale, Info } from 'lucide-react';

interface SettingsProps {
  onSettingsSaved: (settings: AppSettings) => void;
  onClose: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onSettingsSaved, onClose }) => {
  const [settings, setSettings] = useState<AppSettings>(getSettings());
  const [activeTab, setActiveTab] = useState<'profile' | 'macros'>('profile');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Mifflin-St Jeor TDEE & Macro calculator
  const runCalculations = (profile: UserProfile): { calories: number; protein: number; carbs: number; fats: number; tdee: number; bmr: number } => {
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

    // BMR
    let bmr = 0;
    if (gender === 'male') {
      bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
      bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    }

    // TDEE
    const tdee = bmr * activityLevel;

    // Calories goal
    let targetCalories = tdee;
    if (goalType === 'loss') {
      targetCalories = tdee - calorieAdjustment;
    } else if (goalType === 'gain') {
      targetCalories = tdee + calorieAdjustment;
    }

    // Enforce safe minimum calories
    targetCalories = Math.max(1200, Math.round(targetCalories));

    // Macros
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
      // Fixed g/kg (MacroFactor standard)
      protein = Math.round(fixedProteinPerKg * weight);
      fats = Math.round(fixedFatPerKg * weight);

      const proteinCals = protein * 4;
      const fatCals = fats * 9;
      const remainingCals = targetCalories - proteinCals - fatCals;

      // Fill remaining calories with carbs (min 20g carb buffer)
      carbs = Math.max(20, Math.round(remainingCals / 4));
    }

    return {
      calories: targetCalories,
      protein,
      carbs,
      fats,
      tdee: Math.round(tdee),
      bmr: Math.round(bmr),
    };
  };

  // Run calculations in real time whenever profile properties change
  const [calcResults, setCalcResults] = useState(() => runCalculations(settings.profile));

  useEffect(() => {
    const results = runCalculations(settings.profile);
    setCalcResults(results);

    // Automatically sync calculated values to settings.goals if profile is enabled
    if (settings.profile.hasProfile) {
      setSettings((prev) => ({
        ...prev,
        goals: {
          calories: results.calories,
          protein: results.protein,
          carbs: results.carbs,
          fats: results.fats,
        },
      }));
    }
  }, [settings.profile]);

  const handleProfileChange = (field: keyof UserProfile, value: any) => {
    setSettings((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        [field]: value,
      },
    }));
  };

  const handleMacroPercentageChange = (macro: 'protein' | 'carbs' | 'fats', value: number) => {
    setSettings((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        macroPercentages: {
          ...prev.profile.macroPercentages,
          [macro]: Math.max(0, Math.min(100, value)),
        },
      },
    }));
  };

  const handleGoalChange = (macro: 'calories' | 'protein' | 'carbs' | 'fats', value: number) => {
    setSettings((prev) => ({
      ...prev,
      goals: {
        ...prev.goals,
        [macro]: Math.max(0, value),
      },
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate macro percentages sum if using percentage model
    if (settings.profile.hasProfile && settings.profile.macroSplitType === 'percentage') {
      const sum = settings.profile.macroPercentages.protein + 
                  settings.profile.macroPercentages.carbs + 
                  settings.profile.macroPercentages.fats;
      if (sum !== 100) {
        alert(`A soma das percentagens de macros deve ser exatamente 100%. (Atual: ${sum}%)`);
        return;
      }
    }

    saveSettings(settings);
    resetSupabaseClient();
    onSettingsSaved(settings);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  // Activity labels mapping
  const activityLevels = [
    { value: 1.2, label: 'Sedentário (pouco ou nenhum exercício)' },
    { value: 1.375, label: 'Atividade Leve (exercício 1-3 dias/semana)' },
    { value: 1.55, label: 'Atividade Moderada (exercício 3-5 dias/semana)' },
    { value: 1.725, label: 'Atividade Intensa (exercício 6-7 dias/semana)' },
    { value: 1.9, label: 'Extremamente Ativo (trabalho físico pesado ou treino diário)' },
  ];

  return (
    <div style={modalOverlayStyle}>
      <div className="glass-panel" style={modalContentStyle}>
        
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <SettingsIcon size={24} style={{ color: 'var(--macro-calories)' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Definições</h2>
          </div>
          <button onClick={onClose} style={closeButtonStyle}>&times;</button>
        </div>

        {/* Tab Controls */}
        <div style={tabContainerStyle}>
          <button
            onClick={() => setActiveTab('profile')}
            style={{ ...tabButtonStyle, ...(activeTab === 'profile' ? activeTabButtonStyle : {}) }}
          >
            <User size={16} />
            <span>Perfil & Metabolismo</span>
          </button>
          
          <button
            onClick={() => setActiveTab('macros')}
            style={{ ...tabButtonStyle, ...(activeTab === 'macros' ? activeTabButtonStyle : {}) }}
          >
            <PieChart size={16} />
            <span>Metas & Macros</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, minHeight: 0 }}>
          
          <div style={scrollContentStyle} className="hide-scrollbar">
            

            {/* TAB 2: Profile & Metabolism */}
            {activeTab === 'profile' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="glass-card" style={sectionStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={sectionTitleStyle}>
                      <User size={18} style={{ color: 'var(--macro-calories)' }} />
                      <h3>Ativar Algoritmo de TDEE Automático</h3>
                    </div>
                    <label style={toggleSwitchStyle}>
                      <input
                        type="checkbox"
                        checked={settings.profile.hasProfile}
                        onChange={(e) => handleProfileChange('hasProfile', e.target.checked)}
                        style={checkboxInputStyle}
                      />
                      <span style={toggleSliderStyle(settings.profile.hasProfile)}>
                        <div style={toggleKnobStyle(settings.profile.hasProfile)} />
                      </span>
                    </label>
                  </div>
                  <p style={helpTextStyle}>
                    Permite que a app calcule dinamicamente a sua Taxa Metabólica Basal (TMB) e Gasto Energético Total Diário (TDEE) usando a fórmula científica de <strong>Mifflin-St Jeor</strong>.
                  </p>
                </div>

                {settings.profile.hasProfile && (
                  <>
                    {/* Stats Fields */}
                    <div className="glass-card" style={sectionStyle}>
                      <div style={gridStyle}>
                        <div style={inputGroupStyle}>
                          <label style={labelStyle}>Idade (anos)</label>
                          <input
                            type="number"
                            value={settings.profile.age}
                            onChange={(e) => handleProfileChange('age', parseInt(e.target.value) || 18)}
                            style={inputStyle}
                          />
                        </div>

                        <div style={inputGroupStyle}>
                          <label style={labelStyle}>Sexo</label>
                          <select
                            value={settings.profile.gender}
                            onChange={(e) => handleProfileChange('gender', e.target.value as 'male' | 'female')}
                            style={selectStyle}
                          >
                            <option value="male">Masculino</option>
                            <option value="female">Feminino</option>
                          </select>
                        </div>

                        <div style={inputGroupStyle}>
                          <label style={labelStyle}>Altura (cm)</label>
                          <input
                            type="number"
                            value={settings.profile.height}
                            onChange={(e) => handleProfileChange('height', parseInt(e.target.value) || 170)}
                            style={inputStyle}
                          />
                        </div>

                        <div style={inputGroupStyle}>
                          <label style={labelStyle}>Peso Atual (kg)</label>
                          <input
                            type="number"
                            value={settings.profile.weight}
                            onChange={(e) => handleProfileChange('weight', parseFloat(e.target.value) || 70)}
                            style={inputStyle}
                          />
                        </div>
                      </div>

                      <div style={inputGroupStyle}>
                        <label style={labelStyle}>Nível de Atividade Física</label>
                        <select
                          value={settings.profile.activityLevel}
                          onChange={(e) => handleProfileChange('activityLevel', parseFloat(e.target.value))}
                          style={selectStyle}
                        >
                          {activityLevels.map((lvl) => (
                            <option key={lvl.value} value={lvl.value}>
                              {lvl.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Goal Type & Adjustments */}
                    <div className="glass-card" style={sectionStyle}>
                      <div style={sectionTitleStyle}>
                        <Target size={18} style={{ color: 'var(--macro-calories)' }} />
                        <h3>Objetivo Corporal</h3>
                      </div>

                      <div style={gridStyle}>
                        <div style={inputGroupStyle}>
                          <label style={labelStyle}>Objetivo</label>
                          <select
                            value={settings.profile.goalType}
                            onChange={(e) => handleProfileChange('goalType', e.target.value as 'loss' | 'maintenance' | 'gain')}
                            style={selectStyle}
                          >
                            <option value="loss">Perda de Peso (Défice)</option>
                            <option value="maintenance">Manutenção de Peso</option>
                            <option value="gain">Ganho de Massa (Excedente)</option>
                          </select>
                        </div>

                        {settings.profile.goalType !== 'maintenance' && (
                          <div style={inputGroupStyle}>
                            <label style={labelStyle}>
                              {settings.profile.goalType === 'loss' ? 'Ajuste Défice (kcal)' : 'Ajuste Excedente (kcal)'}
                            </label>
                            <input
                              type="number"
                              min="100"
                              max="1000"
                              step="50"
                              value={settings.profile.calorieAdjustment}
                              onChange={(e) => handleProfileChange('calorieAdjustment', parseInt(e.target.value) || 300)}
                              style={inputStyle}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Calculated Metabolism Output Summary */}
                    <div className="glass-card" style={calcSummaryCardStyle}>
                      <div style={sectionTitleStyle}>
                        <Sparkles size={16} style={{ color: 'var(--macro-fats)' }} />
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Resultados Estimados (Mifflin-St Jeor)</h4>
                      </div>

                      <div style={calcGridStyle}>
                        <div style={calcColStyle}>
                          <span style={calcLabelStyle}>Taxa Metabólica Basal (TMB)</span>
                          <span style={calcValStyle}>{calcResults.bmr} <span style={calcUnitStyle}>kcal</span></span>
                        </div>
                        <div style={calcColStyle}>
                          <span style={calcLabelStyle}>Gasto Total (TDEE)</span>
                          <span style={calcValStyle}>{calcResults.tdee} <span style={calcUnitStyle}>kcal</span></span>
                        </div>
                        <div style={{ ...calcColStyle, border: 'none' }}>
                          <span style={calcLabelStyle}>Meta Recomendada</span>
                          <span style={{ ...calcValStyle, color: 'var(--macro-calories)' }}>{calcResults.calories} <span style={calcUnitStyle}>kcal</span></span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* TAB 3: Goals & Macros Setup */}
            {activeTab === 'macros' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* Custom Targets Display */}
                {!settings.profile.hasProfile ? (
                  /* Manual override when profile is off */
                  <div className="glass-card" style={sectionStyle}>
                    <div style={sectionTitleStyle}>
                      <Scale size={18} style={{ color: 'var(--macro-calories)' }} />
                      <h3>Definição Manual de Objetivos</h3>
                    </div>
                    
                    <div style={gridStyle}>
                      <div style={inputGroupStyle}>
                        <label style={{ ...labelStyle, color: 'var(--macro-calories)' }}>Calorias (kcal)</label>
                        <input
                          type="number"
                          value={settings.goals.calories}
                          onChange={(e) => handleGoalChange('calories', parseInt(e.target.value) || 0)}
                          style={inputStyle}
                        />
                      </div>

                      <div style={inputGroupStyle}>
                        <label style={{ ...labelStyle, color: 'var(--macro-protein)' }}>Proteínas (g)</label>
                        <input
                          type="number"
                          value={settings.goals.protein}
                          onChange={(e) => handleGoalChange('protein', parseInt(e.target.value) || 0)}
                          style={inputStyle}
                        />
                      </div>

                      <div style={inputGroupStyle}>
                        <label style={{ ...labelStyle, color: 'var(--macro-carbs)' }}>Carboidratos (g)</label>
                        <input
                          type="number"
                          value={settings.goals.carbs}
                          onChange={(e) => handleGoalChange('carbs', parseInt(e.target.value) || 0)}
                          style={inputStyle}
                        />
                      </div>

                      <div style={inputGroupStyle}>
                        <label style={{ ...labelStyle, color: 'var(--macro-fats)' }}>Gorduras (g)</label>
                        <input
                          type="number"
                          value={settings.goals.fats}
                          onChange={(e) => handleGoalChange('fats', parseInt(e.target.value) || 0)}
                          style={inputStyle}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Algorithmic macro split when profile is active */
                  <>
                    <div className="glass-card" style={sectionStyle}>
                      <div style={sectionTitleStyle}>
                        <PieChart size={18} style={{ color: 'var(--macro-calories)' }} />
                        <h3>Fórmula de Divisão de Macros</h3>
                      </div>

                      <div style={inputGroupStyle}>
                        <label style={labelStyle}>Método de Distribuição</label>
                        <select
                          value={settings.profile.macroSplitType}
                          onChange={(e) => handleProfileChange('macroSplitType', e.target.value as 'percentage' | 'fixed')}
                          style={selectStyle}
                        >
                          <option value="percentage">Percentagem da Ingestão Calórica (ex: 40/30/30)</option>
                          <option value="fixed">Grais Fixos por Peso Corporal (g/kg - Padrão de Atleta)</option>
                        </select>
                      </div>
                    </div>

                    {/* Sub-panels for splits */}
                    {settings.profile.macroSplitType === 'percentage' ? (
                      <div className="glass-card" style={sectionStyle}>
                        <div style={sectionTitleStyle}>
                          <h4>Percentagens (Total tem de ser 100%)</h4>
                        </div>
                        
                        <div style={gridStyle}>
                          <div style={inputGroupStyle}>
                            <label style={{ ...labelStyle, color: 'var(--macro-protein)' }}>Proteínas (%)</label>
                            <input
                              type="number"
                              value={settings.profile.macroPercentages.protein}
                              onChange={(e) => handleMacroPercentageChange('protein', parseInt(e.target.value) || 0)}
                              style={inputStyle}
                            />
                          </div>

                          <div style={inputGroupStyle}>
                            <label style={{ ...labelStyle, color: 'var(--macro-carbs)' }}>Carboidratos (%)</label>
                            <input
                              type="number"
                              value={settings.profile.macroPercentages.carbs}
                              onChange={(e) => handleMacroPercentageChange('carbs', parseInt(e.target.value) || 0)}
                              style={inputStyle}
                            />
                          </div>

                          <div style={inputGroupStyle}>
                            <label style={{ ...labelStyle, color: 'var(--macro-fats)' }}>Lípidos / Gordura (%)</label>
                            <input
                              type="number"
                              value={settings.profile.macroPercentages.fats}
                              onChange={(e) => handleMacroPercentageChange('fats', parseInt(e.target.value) || 0)}
                              style={inputStyle}
                            />
                          </div>

                          <div style={{ ...inputGroupStyle, justifyContent: 'flex-end', paddingBottom: '4px' }}>
                            <div style={{
                              fontSize: '0.85rem',
                              fontWeight: 700,
                              color: (settings.profile.macroPercentages.protein + settings.profile.macroPercentages.carbs + settings.profile.macroPercentages.fats) === 100 ? 'var(--macro-calories)' : 'var(--macro-protein)'
                            }}>
                              Total: {settings.profile.macroPercentages.protein + settings.profile.macroPercentages.carbs + settings.profile.macroPercentages.fats}%
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="glass-card" style={sectionStyle}>
                        <div style={sectionTitleStyle}>
                          <h4>Configuração de Macros g/kg (Baseado no peso de {settings.profile.weight}kg)</h4>
                        </div>

                        <div style={gridStyle}>
                          <div style={inputGroupStyle}>
                            <label style={{ ...labelStyle, color: 'var(--macro-protein)' }}>Proteína (g/kg)</label>
                            <input
                              type="number"
                              step="0.1"
                              value={settings.profile.fixedProteinPerKg}
                              onChange={(e) => handleProfileChange('fixedProteinPerKg', parseFloat(e.target.value) || 0)}
                              style={inputStyle}
                            />
                            <span style={inputSubLabelStyle}>
                              = {Math.round(settings.profile.fixedProteinPerKg * settings.profile.weight)}g total
                            </span>
                          </div>

                          <div style={inputGroupStyle}>
                            <label style={{ ...labelStyle, color: 'var(--macro-fats)' }}>Gordura (g/kg)</label>
                            <input
                              type="number"
                              step="0.1"
                              value={settings.profile.fixedFatPerKg}
                              onChange={(e) => handleProfileChange('fixedFatPerKg', parseFloat(e.target.value) || 0)}
                              style={inputStyle}
                            />
                            <span style={inputSubLabelStyle}>
                              = {Math.round(settings.profile.fixedFatPerKg * settings.profile.weight)}g total
                            </span>
                          </div>
                        </div>
                        
                        <div style={infoRowStyle}>
                          <Info size={16} style={{ color: 'var(--macro-carbs)', flexShrink: 0 }} />
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                            <strong>Nota:</strong> Neste método, as proteínas e gorduras são fixadas de acordo com as necessidades metabólicas de treino e o seu peso corporal. Os carboidratos preenchem as calorias restantes necessárias para atingir a meta calórica diária ({calcResults.calories} kcal).
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Calculated Macro Targets Summary */}
                    <div className="glass-card" style={calcSummaryCardStyle}>
                      <div style={sectionTitleStyle}>
                        <Sparkles size={16} style={{ color: 'var(--macro-calories)' }} />
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Metas Finais Calculadas</h4>
                      </div>

                      <div style={calcGridStyle}>
                        <div style={calcColStyle}>
                          <span style={calcLabelStyle}>Calorias</span>
                          <span style={{ ...calcValStyle, color: 'var(--macro-calories)' }}>{calcResults.calories} <span style={calcUnitStyle}>kcal</span></span>
                        </div>
                        <div style={calcColStyle}>
                          <span style={calcLabelStyle}>Proteína</span>
                          <span style={{ ...calcValStyle, color: 'var(--macro-protein)' }}>{calcResults.protein} <span style={calcUnitStyle}>g</span></span>
                        </div>
                        <div style={calcColStyle}>
                          <span style={calcLabelStyle}>Carbohidratos</span>
                          <span style={{ ...calcValStyle, color: 'var(--macro-carbs)' }}>{calcResults.carbs} <span style={calcUnitStyle}>g</span></span>
                        </div>
                        <div style={{ ...calcColStyle, border: 'none' }}>
                          <span style={calcLabelStyle}>Gorduras</span>
                          <span style={{ ...calcValStyle, color: 'var(--macro-fats)' }}>{calcResults.fats} <span style={calcUnitStyle}>g</span></span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

          </div>

          {/* Footer controls */}
          <div style={footerStyle}>
            <button
              type="button"
              onClick={onClose}
              style={cancelButtonStyle}
            >
              Fechar
            </button>
            <button
              type="submit"
              disabled={savedSuccess}
              style={savedSuccess ? savedButtonStyle : submitButtonStyle}
            >
              {savedSuccess ? (
                <>
                  <CheckCircle size={18} /> Definições Guardadas!
                </>
              ) : (
                <>
                  <Save size={18} /> Guardar Definições
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Styles
const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(5, 7, 13, 0.85)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  backdropFilter: 'blur(8px)',
  padding: '16px',
};

const modalContentStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '600px',
  maxHeight: '90vh',
  padding: '24px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderBottom: '1px solid var(--border-glass)',
  paddingBottom: '12px',
};

const closeButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: '1.8rem',
  color: 'var(--color-text-secondary)',
  cursor: 'pointer',
  padding: '4px',
  lineHeight: 1,
};

const tabContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  borderBottom: '1px solid var(--border-glass)',
  paddingBottom: '8px',
};

const tabButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '10px 8px',
  borderRadius: '10px',
  border: '1px solid transparent',
  background: 'none',
  color: 'var(--color-text-secondary)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  fontSize: '0.85rem',
  fontWeight: 600,
  transition: 'all 0.2s',
};

const activeTabButtonStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid var(--border-glass)',
  color: '#fff',
};

const scrollContentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  overflowY: 'auto',
  flex: 1,
  paddingRight: '4px',
};

const sectionStyle: React.CSSProperties = {
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const sectionTitleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '1.05rem',
  fontWeight: 600,
};

const helpTextStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: 'var(--color-text-secondary)',
  lineHeight: 1.4,
};


const inputGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 500,
  color: 'var(--color-text-secondary)',
};


const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  backgroundColor: 'var(--bg-input)',
  border: '1px solid var(--border-glass)',
  borderRadius: '10px',
  outline: 'none',
  fontSize: '0.95rem',
  transition: 'border-color 0.2s',
};


const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  backgroundColor: 'var(--bg-input)',
  border: '1px solid var(--border-glass)',
  borderRadius: '10px',
  outline: 'none',
  fontSize: '0.95rem',
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 14px center',
  backgroundSize: '16px',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '14px',
};

const toggleSwitchStyle: React.CSSProperties = {
  position: 'relative',
  display: 'inline-block',
  width: '44px',
  height: '24px',
};

const checkboxInputStyle: React.CSSProperties = {
  opacity: 0,
  width: 0,
  height: 0,
};

const toggleSliderStyle = (isActive: boolean): React.CSSProperties => ({
  position: 'absolute',
  cursor: 'pointer',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: isActive ? 'var(--macro-calories)' : '#374151',
  borderRadius: '24px',
  transition: 'background-color 0.2s',
  display: 'flex',
  alignItems: 'center',
  justifyContent: isActive ? 'flex-end' : 'flex-start',
  padding: '3px',
  boxShadow: isActive ? '0 0 8px rgba(16, 185, 129, 0.4)' : 'none',
  before: {
    content: '""',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    backgroundColor: '#fff',
    transition: 'transform 0.2s',
  }
} as any);

// CSS trick for internal knob since we are in inline styles
const toggleKnobStyle = (isActive: boolean): React.CSSProperties => ({
  width: '18px',
  height: '18px',
  borderRadius: '50%',
  backgroundColor: '#fff',
  transform: isActive ? 'translateX(0)' : 'translateX(0)',
  transition: 'transform 0.2s',
});

const calcSummaryCardStyle: React.CSSProperties = {
  padding: '16px',
  backgroundColor: 'rgba(0, 0, 0, 0.2)',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  border: '1px solid rgba(255,255,255,0.03)',
};

const calcGridStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  justifyContent: 'space-between',
};

const calcColStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  borderRight: '1px solid rgba(255, 255, 255, 0.05)',
  paddingRight: '8px',
};

const calcLabelStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: 'var(--color-text-secondary)',
  textAlign: 'center',
  marginBottom: '4px',
};

const calcValStyle: React.CSSProperties = {
  fontSize: '1.1rem',
  fontWeight: 800,
  color: '#fff',
};

const calcUnitStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 500,
  color: 'var(--color-text-secondary)',
};

const inputSubLabelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--color-text-muted)',
  marginTop: '2px',
};

const infoRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '10px',
  backgroundColor: 'rgba(59, 130, 246, 0.05)',
  border: '1px solid rgba(59, 130, 246, 0.1)',
  borderRadius: '10px',
  padding: '10px 12px',
  marginTop: '4px',
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '12px',
  borderTop: '1px solid var(--border-glass)',
  paddingTop: '16px',
  marginTop: '8px',
  flexShrink: 0,
};

const cancelButtonStyle: React.CSSProperties = {
  padding: '10px 18px',
  borderRadius: '10px',
  border: '1px solid var(--border-glass)',
  background: 'none',
  fontSize: '0.95rem',
  fontWeight: 500,
  cursor: 'pointer',
};

const submitButtonStyle: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: '10px',
  border: 'none',
  background: 'var(--grad-calories)',
  color: '#ffffff',
  fontSize: '0.95rem',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
};

const savedButtonStyle: React.CSSProperties = {
  ...submitButtonStyle,
  background: '#047857',
};
