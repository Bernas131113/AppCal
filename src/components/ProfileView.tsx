import React, { useState, useEffect } from 'react';
import type { AppSettings, UserProfile, Meal } from '../types';
import { getSettings, saveSettings } from '../utils/storage';
import { getSupabaseClient, dbUpdatePassword } from '../utils/supabase';
import { 
  User, 
  PieChart, 
  Sparkles, 
  Database, 
  Lock, 
  LogOut, 
  Image as ImageIcon, 
  Save, 
  Loader2, 
  Eye, 
  EyeOff
} from 'lucide-react';

interface ProfileViewProps {
  onSettingsSaved: (settings: AppSettings) => void;
  onLogout: () => void;
  meals: Meal[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ 
  onSettingsSaved, 
  onLogout, 
  meals,
  showToast 
}) => {
  const [settings, setSettings] = useState<AppSettings>(getSettings());
  const [testingConnection, setTestingConnection] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all'); // 'all' or 'personal' | 'macros' | 'ai' | 'cloud' | 'security' | 'gallery'

  // Password state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

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
      tdee: Math.round(tdee),
      bmr: Math.round(bmr),
    };
  };

  const [calcResults, setCalcResults] = useState(() => runCalculations(settings.profile));

  useEffect(() => {
    const results = runCalculations(settings.profile);
    setCalcResults(results);

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

  const handleMacroPercentageChange = (field: 'protein' | 'carbs' | 'fats', value: number) => {
    setSettings((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        macroPercentages: {
          ...prev.profile.macroPercentages,
          [field]: value,
        },
      },
    }));
  };

  const handleGeneralChange = (field: keyof AppSettings, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleGoalsChange = (field: keyof typeof settings.goals, value: number) => {
    setSettings((prev) => ({
      ...prev,
      goals: {
        ...prev.goals,
        [field]: value,
      },
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate macro percentages sum if selected
    if (settings.profile.hasProfile && settings.profile.macroSplitType === 'percentage') {
      const sum = 
        settings.profile.macroPercentages.protein + 
        settings.profile.macroPercentages.carbs + 
        settings.profile.macroPercentages.fats;
      if (sum !== 100) {
        showToast('A soma das percentagens dos macros deve ser exatamente 100% (atual: ' + sum + '%)', 'error');
        return;
      }
    }

    saveSettings(settings);
    onSettingsSaved(settings);
    showToast('Perfil e definições gravados com sucesso!', 'success');
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error("Supabase não configurado. Verifique os campos de URL e Chave Anon.");
      }
      const { error: authError } = await client.auth.getSession();
      if (authError) throw new Error(authError.message);
      
      const { error: tableError } = await client.from('meals').select('id').limit(1);
      if (tableError) {
        if (tableError.code === 'PGRST205' || tableError.message?.includes('does not exist')) {
          throw new Error("Tabelas não encontradas! Execute o SQL de inicialização no Supabase.");
        }
        if (tableError.code === '42501' || tableError.message?.includes('permission denied')) {
          showToast("✅ Supabase ligado! As tabelas estão criadas e protegidas por RLS.", "success");
          return;
        }
        throw new Error(tableError.message);
      }
      showToast("✅ Supabase ligado! Tabelas prontas para sincronização.", "success");
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Erro de ligação ao Supabase.", "error");
    } finally {
      setTestingConnection(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim()) {
      showToast('A palavra-passe não pode estar vazia.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('As palavras-passe não correspondem.', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showToast('A palavra-passe deve ter pelo menos 6 caracteres.', 'error');
      return;
    }

    setIsUpdatingPassword(true);
    const { success, error } = await dbUpdatePassword(newPassword);
    setIsUpdatingPassword(false);

    if (success) {
      showToast('Palavra-passe atualizada com sucesso!', 'success');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
    } else {
      showToast(error || 'Erro ao atualizar palavra-passe.', 'error');
    }
  };

  // Collect all photos from logged meals
  const allPhotos = meals
    .flatMap(m => (m.photos || []).map(p => ({ photo: p, timestamp: m.timestamp, mealType: m.meal_type })))
    .filter(item => !!item.photo);

  const getMealTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      breakfast: 'Pequeno-almoço',
      lunch: 'Almoço',
      dinner: 'Jantar',
      snack: 'Lanche',
      supper: 'Ceia',
      extrasnack: 'Extra'
    };
    return labels[type] || 'Refeição';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '32px' }}>
      
      {/* Category Tabs */}
      <div style={categoryTabsContainerStyle} className="hide-scrollbar">
        {[
          { id: 'all', label: 'Tudo' },
          { id: 'personal', label: 'Metabolismo' },
          { id: 'macros', label: 'Metas' },
          { id: 'ai', label: 'IA' },
          { id: 'cloud', label: 'Sincronização' },
          { id: 'gallery', label: 'Galeria (' + allPhotos.length + ')' },
          { id: 'security', label: 'Conta' }
        ].map(cat => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategory(cat.id)}
            style={{
              ...categoryTabStyle,
              ...(activeCategory === cat.id ? categoryTabActiveStyle : {})
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* CATEGORY 1: PERSONAL & METABOLISM */}
        {(activeCategory === 'all' || activeCategory === 'personal') && (
          <div className="glass-card" style={sectionCardStyle}>
            <div style={sectionHeaderStyle}>
              <User size={20} style={{ color: 'var(--macro-calories)' }} />
              <h3 style={sectionTitleStyle}>Dados e Metabolismo</h3>
            </div>
            
            <div style={formGroupStyle}>
              <div style={toggleRowStyle}>
                <div>
                  <span style={labelStyle}>TDEE Automático (Mifflin-St Jeor)</span>
                  <p style={helpTextStyle}>Calcula as metas com base no metabolismo.</p>
                </div>
                <label style={toggleSwitchStyle}>
                  <input
                    type="checkbox"
                    checked={settings.profile.hasProfile}
                    onChange={(e) => handleProfileChange('hasProfile', e.target.checked)}
                    style={{ display: 'none' }}
                  />
                  <span style={toggleSliderStyle(settings.profile.hasProfile)}>
                    <div style={toggleKnobStyle(settings.profile.hasProfile)} />
                  </span>
                </label>
              </div>
            </div>

            {settings.profile.hasProfile && (
              <div style={gridFieldsStyle}>
                <div style={inputGroupStyle}>
                  <label style={inputLabelStyle}>Idade (anos)</label>
                  <input
                    type="number"
                    value={settings.profile.age || ''}
                    onChange={(e) => handleProfileChange('age', parseInt(e.target.value) || 0)}
                    style={inputFieldStyle}
                  />
                </div>
                
                <div style={inputGroupStyle}>
                  <label style={inputLabelStyle}>Sexo</label>
                  <select
                    value={settings.profile.gender}
                    onChange={(e) => handleProfileChange('gender', e.target.value as 'male' | 'female')}
                    style={inputFieldStyle}
                  >
                    <option value="male">Masculino</option>
                    <option value="female">Feminino</option>
                  </select>
                </div>

                <div style={inputGroupStyle}>
                  <label style={inputLabelStyle}>Peso (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={settings.profile.weight || ''}
                    onChange={(e) => handleProfileChange('weight', parseFloat(e.target.value) || 0)}
                    style={inputFieldStyle}
                  />
                </div>

                <div style={inputGroupStyle}>
                  <label style={inputLabelStyle}>Altura (cm)</label>
                  <input
                    type="number"
                    value={settings.profile.height || ''}
                    onChange={(e) => handleProfileChange('height', parseInt(e.target.value) || 0)}
                    style={inputFieldStyle}
                  />
                </div>

                <div style={{ ...inputGroupStyle, gridColumn: '1 / -1' }}>
                  <label style={inputLabelStyle}>Nível de Atividade</label>
                  <select
                    value={settings.profile.activityLevel}
                    onChange={(e) => handleProfileChange('activityLevel', parseFloat(e.target.value) || 1.2)}
                    style={inputFieldStyle}
                  >
                    <option value="1.2">Sedentário (Sem exercício)</option>
                    <option value="1.375">Leve (Exercício 1-3 dias/semana)</option>
                    <option value="1.55">Moderado (Exercício 3-5 dias/semana)</option>
                    <option value="1.725">Intenso (Exercício 6-7 dias/semana)</option>
                    <option value="1.9">Extremo (Treino diário pesado)</option>
                  </select>
                </div>

                <div style={{ ...inputGroupStyle, gridColumn: '1 / -1' }}>
                  <label style={inputLabelStyle}>Objetivo</label>
                  <select
                    value={settings.profile.goalType}
                    onChange={(e) => handleProfileChange('goalType', e.target.value as 'loss' | 'maintenance' | 'gain')}
                    style={inputFieldStyle}
                  >
                    <option value="loss">Perda de Peso (Défice)</option>
                    <option value="maintenance">Manutenção de Peso</option>
                    <option value="gain">Ganho de Peso (Superavit)</option>
                  </select>
                </div>

                {settings.profile.goalType !== 'maintenance' && (
                  <div style={{ ...inputGroupStyle, gridColumn: '1 / -1' }}>
                    <label style={inputLabelStyle}>Ajuste Calórico (kcal): {settings.profile.calorieAdjustment} kcal</label>
                    <input
                      type="range"
                      min="100"
                      max="1000"
                      step="50"
                      value={settings.profile.calorieAdjustment}
                      onChange={(e) => handleProfileChange('calorieAdjustment', parseInt(e.target.value) || 300)}
                      style={{ width: '100%', accentColor: 'var(--macro-calories)', cursor: 'pointer', marginTop: '6px' }}
                    />
                  </div>
                )}

                <div style={calcSummaryCardStyle}>
                  <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--macro-calories)', fontWeight: 700 }}>Estimativa Científica:</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                    <span>Metabolismo Basal (BMR): <strong>{calcResults.bmr} kcal</strong></span>
                    <span>Gasto Energético (TDEE): <strong>{calcResults.tdee} kcal</strong></span>
                    <span style={{ gridColumn: '1 / -1', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px', fontSize: '0.8rem', color: '#fff' }}>
                      Meta Recomendada: <strong>{calcResults.calories} kcal/dia</strong>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CATEGORY 2: GOALS & MACROS */}
        {(activeCategory === 'all' || activeCategory === 'macros') && (
          <div className="glass-card" style={sectionCardStyle}>
            <div style={sectionHeaderStyle}>
              <PieChart size={20} style={{ color: 'var(--macro-carbs)' }} />
              <h3 style={sectionTitleStyle}>Metas e Macronutrientes</h3>
            </div>

            {settings.profile.hasProfile ? (
              <>
                <div style={inputGroupStyle}>
                  <label style={inputLabelStyle}>Distribuição dos Macronutrientes</label>
                  <select
                    value={settings.profile.macroSplitType}
                    onChange={(e) => handleProfileChange('macroSplitType', e.target.value as 'percentage' | 'fixed')}
                    style={inputFieldStyle}
                  >
                    <option value="percentage">Percentagem (%)</option>
                    <option value="fixed">Gramos fixos por kg de peso (Recomendado)</option>
                  </select>
                </div>

                {settings.profile.macroSplitType === 'percentage' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span>Proteína: {settings.profile.macroPercentages.protein}%</span>
                        <span>{calcResults.protein}g</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="60"
                        step="5"
                        value={settings.profile.macroPercentages.protein}
                        onChange={(e) => handleMacroPercentageChange('protein', parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--macro-protein)' }}
                      />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span>Hidratos: {settings.profile.macroPercentages.carbs}%</span>
                        <span>{calcResults.carbs}g</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="70"
                        step="5"
                        value={settings.profile.macroPercentages.carbs}
                        onChange={(e) => handleMacroPercentageChange('carbs', parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--macro-carbs)' }}
                      />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span>Lípidos: {settings.profile.macroPercentages.fats}%</span>
                        <span>{calcResults.fats}g</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="50"
                        step="5"
                        value={settings.profile.macroPercentages.fats}
                        onChange={(e) => handleMacroPercentageChange('fats', parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--macro-fats)' }}
                      />
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'right' }}>
                      Soma Total: {settings.profile.macroPercentages.protein + settings.profile.macroPercentages.carbs + settings.profile.macroPercentages.fats}% (Deve somar 100%)
                    </span>
                  </div>
                ) : (
                  <div style={gridFieldsStyle}>
                    <div style={inputGroupStyle}>
                      <label style={inputLabelStyle}>Proteína (g/kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={settings.profile.fixedProteinPerKg}
                        onChange={(e) => handleProfileChange('fixedProteinPerKg', parseFloat(e.target.value) || 2.0)}
                        style={inputFieldStyle}
                      />
                    </div>
                    <div style={inputGroupStyle}>
                      <label style={inputLabelStyle}>Lípidos (g/kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={settings.profile.fixedFatPerKg}
                        onChange={(e) => handleProfileChange('fixedFatPerKg', parseFloat(e.target.value) || 0.8)}
                        style={inputFieldStyle}
                      />
                    </div>
                    <p style={{ ...helpTextStyle, gridColumn: '1 / -1' }}>
                      Os hidratos de carbono preenchem automaticamente as calorias restantes do objetivo.
                    </p>
                  </div>
                )}
              </>
            ) : (
              // Manual Mode (Fixed input fields)
              <div style={gridFieldsStyle}>
                <div style={{ ...inputGroupStyle, gridColumn: '1 / -1' }}>
                  <label style={inputLabelStyle}>Calorias Objetivo (kcal)</label>
                  <input
                    type="number"
                    value={settings.goals.calories || ''}
                    onChange={(e) => handleGoalsChange('calories', parseInt(e.target.value) || 2000)}
                    style={inputFieldStyle}
                  />
                </div>
                <div style={inputGroupStyle}>
                  <label style={inputLabelStyle}>Proteínas (g)</label>
                  <input
                    type="number"
                    value={settings.goals.protein || ''}
                    onChange={(e) => handleGoalsChange('protein', parseInt(e.target.value) || 130)}
                    style={inputFieldStyle}
                  />
                </div>
                <div style={inputGroupStyle}>
                  <label style={inputLabelStyle}>Carbohidratos (g)</label>
                  <input
                    type="number"
                    value={settings.goals.carbs || ''}
                    onChange={(e) => handleGoalsChange('carbs', parseInt(e.target.value) || 220)}
                    style={inputFieldStyle}
                  />
                </div>
                <div style={{ ...inputGroupStyle, gridColumn: '1 / -1' }}>
                  <label style={inputLabelStyle}>Lípidos (g)</label>
                  <input
                    type="number"
                    value={settings.goals.fats || ''}
                    onChange={(e) => handleGoalsChange('fats', parseInt(e.target.value) || 65)}
                    style={inputFieldStyle}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* CATEGORY 3: AI INTELLIGENCE */}
        {(activeCategory === 'all' || activeCategory === 'ai') && (
          <div className="glass-card" style={sectionCardStyle}>
            <div style={sectionHeaderStyle}>
              <Sparkles size={20} style={{ color: 'var(--macro-protein)' }} />
              <h3 style={sectionTitleStyle}>Inteligência Artificial (Gemini)</h3>
            </div>
            
            <div style={inputGroupStyle}>
              <label style={inputLabelStyle}>Gemini API Key</label>
              <input
                type="password"
                placeholder="Insira a sua chave API do Google AI Studio..."
                value={settings.geminiApiKey}
                onChange={(e) => handleGeneralChange('geminiApiKey', e.target.value)}
                style={inputFieldStyle}
              />
              <p style={helpTextStyle}>
                Insira a sua chave API Gemini gratuita obtida no AI Studio para realizar análise real de fotos e voz.
              </p>
            </div>

            <div style={inputGroupStyle}>
              <label style={inputLabelStyle}>Modelo de Linguagem</label>
              <select
                value={settings.model}
                onChange={(e) => handleGeneralChange('model', e.target.value)}
                style={inputFieldStyle}
              >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recomendado, Rápido)</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro (Mais Inteligente, Lento)</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
              </select>
            </div>
          </div>
        )}

        {/* CATEGORY 4: SYNC & CLOUD */}
        {(activeCategory === 'all' || activeCategory === 'cloud') && (
          <div className="glass-card" style={sectionCardStyle}>
            <div style={sectionHeaderStyle}>
              <Database size={20} style={{ color: 'var(--macro-fats)' }} />
              <h3 style={sectionTitleStyle}>Sincronização Supabase Cloud</h3>
            </div>

            <div style={formGroupStyle}>
              <div style={toggleRowStyle}>
                <div>
                  <span style={labelStyle}>Ativar Base de Dados na Nuvem</span>
                  <p style={helpTextStyle}>Guarda os dados remotamente e sincroniza entre dispositivos.</p>
                </div>
                <label style={toggleSwitchStyle}>
                  <input
                    type="checkbox"
                    checked={settings.useSupabase}
                    onChange={(e) => handleGeneralChange('useSupabase', e.target.checked)}
                    style={{ display: 'none' }}
                  />
                  <span style={toggleSliderStyle(settings.useSupabase)}>
                    <div style={toggleKnobStyle(settings.useSupabase)} />
                  </span>
                </label>
              </div>
            </div>

            {settings.useSupabase && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
                <div style={inputGroupStyle}>
                  <label style={inputLabelStyle}>Supabase URL</label>
                  <input
                    type="text"
                    placeholder="https://suaconta.supabase.co"
                    value={settings.supabaseUrl}
                    onChange={(e) => handleGeneralChange('supabaseUrl', e.target.value)}
                    style={inputFieldStyle}
                  />
                </div>
                <div style={inputGroupStyle}>
                  <label style={inputLabelStyle}>Supabase Anon Key</label>
                  <input
                    type="password"
                    placeholder="eyJhbGciOi..."
                    value={settings.supabaseAnonKey}
                    onChange={(e) => handleGeneralChange('supabaseAnonKey', e.target.value)}
                    style={inputFieldStyle}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection}
                  style={testConnectionButtonStyle}
                >
                  {testingConnection ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>A ligar...</span>
                    </>
                  ) : (
                    <span>Testar Ligação ao Supabase</span>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Action button for settings save (Only visible if showing settings fields) */}
        {activeCategory !== 'gallery' && activeCategory !== 'security' && (
          <button type="submit" style={submitButtonStyle}>
            <Save size={16} />
            <span>Guardar Definições</span>
          </button>
        )}
      </form>

      {/* CATEGORY 5: GALLERY */}
      {(activeCategory === 'all' || activeCategory === 'gallery') && (
        <div className="glass-card" style={sectionCardStyle}>
          <div style={sectionHeaderStyle}>
            <ImageIcon size={20} style={{ color: 'var(--macro-calories)' }} />
            <h3 style={sectionTitleStyle}>Galeria de Refeições</h3>
          </div>
          <p style={helpTextStyle}>
            Todas as fotografias de alimentos que registou nas suas refeições diárias.
          </p>

          {allPhotos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
              Nenhuma fotografia guardada ainda.
              <br />
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', display: 'inline-block' }}>
                Registe refeições utilizando o analisador de fotos por IA para popular esta galeria.
              </span>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '8px', marginTop: '12px' }}>
              {allPhotos.map((item, idx) => (
                <div 
                  key={idx} 
                  className="glass-card" 
                  style={photoThumbnailContainerStyle}
                  title={`${getMealTypeLabel(item.mealType)} - ${new Date(item.timestamp).toLocaleDateString()}`}
                >
                  <img src={item.photo} alt="Refeição" style={photoThumbnailStyle} />
                  <div style={photoTagStyle}>
                    {getMealTypeLabel(item.mealType).substring(0, 4)}.
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CATEGORY 6: SECURITY & SESSION */}
      {(activeCategory === 'all' || activeCategory === 'security') && (
        <div className="glass-card" style={sectionCardStyle}>
          <div style={sectionHeaderStyle}>
            <Lock size={20} style={{ color: 'var(--macro-protein)' }} />
            <h3 style={sectionTitleStyle}>Segurança e Sessão</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {!showPasswordForm ? (
              <button 
                type="button" 
                onClick={() => setShowPasswordForm(true)} 
                style={secondaryButtonStyle}
              >
                Alterar Palavra-passe
              </button>
            ) : (
              <form onSubmit={handlePasswordUpdate} style={passwordFormStyle}>
                <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>Nova Palavra-passe</h4>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPwd ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={inputFieldStyle}
                    required
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPwd(!showPwd)} 
                    style={togglePwdVisibilityButtonStyle}
                  >
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, marginTop: '8px' }}>Confirmar Palavra-passe</h4>
                <input
                  type={showPwd ? "text" : "password"}
                  placeholder="Confirme a nova palavra-passe"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={inputFieldStyle}
                  required
                />

                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button 
                    type="button" 
                    onClick={() => { setShowPasswordForm(false); setNewPassword(''); setConfirmPassword(''); }} 
                    style={{ ...secondaryButtonStyle, flex: 1 }}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={isUpdatingPassword} 
                    style={{ ...submitButtonStyle, flex: 1, margin: 0 }}
                  >
                    {isUpdatingPassword ? <Loader2 size={14} className="animate-spin" /> : <span>Guardar</span>}
                  </button>
                </div>
              </form>
            )}

            <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />

            <button 
              type="button" 
              onClick={onLogout} 
              style={logoutButtonStyle}
            >
              <LogOut size={16} />
              <span>Terminar Sessão</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Inline Styles for ProfileView
const categoryTabsContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  overflowX: 'auto',
  padding: '4px 0',
  scrollbarWidth: 'none',
  WebkitOverflowScrolling: 'touch',
};

const categoryTabStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: '20px',
  border: '1px solid var(--border-glass)',
  background: 'rgba(255, 255, 255, 0.02)',
  color: 'var(--color-text-secondary)',
  fontSize: '0.8rem',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'all 0.2s',
  WebkitTapHighlightColor: 'transparent',
};

const categoryTabActiveStyle: React.CSSProperties = {
  background: 'var(--grad-calories)',
  color: '#fff',
  borderColor: 'rgba(16, 185, 129, 0.2)',
  boxShadow: '0 4px 10px rgba(16, 185, 129, 0.2)',
};

const sectionCardStyle: React.CSSProperties = {
  padding: '20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
};

const sectionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  paddingBottom: '10px',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '1rem',
  fontWeight: 700,
  color: '#fff',
  margin: 0,
};

const formGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
};

const toggleRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '16px',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.9rem',
  fontWeight: 600,
  color: '#fff',
};

const helpTextStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  color: 'var(--color-text-secondary)',
  margin: 0,
  lineHeight: 1.4,
};

const toggleSwitchStyle: React.CSSProperties = {
  position: 'relative',
  display: 'inline-block',
  width: '46px',
  height: '24px',
  cursor: 'pointer',
};

const toggleSliderStyle = (checked: boolean): React.CSSProperties => ({
  position: 'absolute',
  inset: 0,
  borderRadius: '34px',
  backgroundColor: checked ? 'var(--macro-calories)' : 'rgba(255,255,255,0.1)',
  transition: 'all 0.2s ease-in-out',
});

const toggleKnobStyle = (checked: boolean): React.CSSProperties => ({
  position: 'absolute',
  height: '18px',
  width: '18px',
  left: checked ? '24px' : '4px',
  bottom: '3px',
  backgroundColor: '#white',
  background: '#ffffff',
  borderRadius: '50%',
  transition: 'all 0.2s ease-in-out',
  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
});

const gridFieldsStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '12px',
  marginTop: '4px',
};

const inputGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
};

const inputLabelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
};

const inputFieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  backgroundColor: 'var(--bg-input)',
  border: '1px solid var(--border-glass)',
  borderRadius: '10px',
  fontSize: '15px',
  color: '#fff',
  outline: 'none',
  transition: 'all 0.2s',
};

const calcSummaryCardStyle: React.CSSProperties = {
  gridColumn: '1 / -1',
  padding: '12px 14px',
  borderRadius: '10px',
  backgroundColor: 'rgba(16, 185, 129, 0.05)',
  border: '1px solid rgba(16, 185, 129, 0.12)',
};

const testConnectionButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px',
  borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.02)',
  color: '#fff',
  fontSize: '0.8rem',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  transition: 'all 0.2s',
};

const submitButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px',
  borderRadius: '12px',
  border: 'none',
  background: 'var(--grad-calories)',
  color: '#fff',
  fontSize: '0.9rem',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
  WebkitTapHighlightColor: 'transparent',
  transition: 'all 0.2s',
};

const secondaryButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.03)',
  color: '#fff',
  fontSize: '0.85rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s',
};

const logoutButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px',
  borderRadius: '12px',
  border: '1px solid rgba(239, 68, 68, 0.2)',
  background: 'rgba(239, 68, 68, 0.05)',
  color: '#f43f5e',
  fontSize: '0.85rem',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  transition: 'all 0.2s',
};

const photoThumbnailContainerStyle: React.CSSProperties = {
  position: 'relative',
  aspectRatio: '1',
  borderRadius: '10px',
  overflow: 'hidden',
  border: '1px solid var(--border-glass)',
};

const photoThumbnailStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};

const photoTagStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '4px',
  left: '4px',
  backgroundColor: 'rgba(0,0,0,0.65)',
  backdropFilter: 'blur(4px)',
  padding: '2px 5px',
  borderRadius: '4px',
  fontSize: '0.6rem',
  fontWeight: 600,
  color: '#fff',
};

const passwordFormStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  padding: '14px',
  borderRadius: '12px',
  backgroundColor: 'rgba(255,255,255,0.02)',
  border: '1px solid var(--border-glass)',
};

const togglePwdVisibilityButtonStyle: React.CSSProperties = {
  position: 'absolute',
  right: '12px',
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'none',
  border: 'none',
  color: 'var(--color-text-secondary)',
  cursor: 'pointer',
};
