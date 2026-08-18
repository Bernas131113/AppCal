import React, { useState } from 'react';
import type { AppSettings } from '../types';
import { getSettings, saveSettings } from '../utils/storage';
import { Settings as SettingsIcon, Key, Target, Eye, EyeOff, Save, CheckCircle } from 'lucide-react';

interface SettingsProps {
  onSettingsSaved: (settings: AppSettings) => void;
  onClose: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onSettingsSaved, onClose }) => {
  const [settings, setSettings] = useState<AppSettings>(getSettings());
  const [showApiKey, setShowApiKey] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

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
    saveSettings(settings);
    onSettingsSaved(settings);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1500);
  };

  return (
    <div style={modalOverlayStyle}>
      <div className="glass-panel" style={modalContentStyle}>
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <SettingsIcon size={24} style={{ color: 'var(--macro-calories)' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Definições da Aplicação</h2>
          </div>
          <button onClick={onClose} style={closeButtonStyle}>&times;</button>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* API Key section */}
          <div className="glass-card" style={sectionStyle}>
            <div style={sectionTitleStyle}>
              <Key size={18} style={{ color: 'var(--macro-calories)' }} />
              <h3>Configuração da IA (Gemini API)</h3>
            </div>
            
            <p style={helpTextStyle}>
              Obtenha uma chave API gratuita no{' '}
              <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" style={linkStyle}>
                Google AI Studio
              </a>. Caso contrário, a app funcionará em <strong>Modo Demo</strong> com dados simulados.
            </p>

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Gemini API Key</label>
              <div style={passwordInputContainerStyle}>
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={settings.geminiApiKey}
                  onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
                  placeholder="Cole a sua API Key AI Studio..."
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  style={eyeButtonStyle}
                >
                  {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Modelo de Inteligência Artificial</label>
              <select
                value={settings.model}
                onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                style={selectStyle}
              >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recomendado - Ultra rápido)</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash (Rápido)</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro (Mais preciso e detalhado)</option>
              </select>
            </div>
          </div>

          {/* Goals section */}
          <div className="glass-card" style={sectionStyle}>
            <div style={sectionTitleStyle}>
              <Target size={18} style={{ color: 'var(--macro-calories)' }} />
              <h3>Metas Nutricionais Diárias</h3>
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

          <div style={footerStyle}>
            <button
              type="button"
              onClick={onClose}
              style={cancelButtonStyle}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savedSuccess}
              style={savedSuccess ? savedButtonStyle : submitButtonStyle}
            >
              {savedSuccess ? (
                <>
                  <CheckCircle size={18} /> Guardado!
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
  overflowY: 'auto',
};

const modalContentStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '550px',
  padding: '24px',
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
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

const linkStyle: React.CSSProperties = {
  color: 'var(--macro-calories)',
  textDecoration: 'underline',
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

const passwordInputContainerStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
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

const eyeButtonStyle: React.CSSProperties = {
  position: 'absolute',
  right: '12px',
  background: 'none',
  border: 'none',
  color: 'var(--color-text-secondary)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
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

const footerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '12px',
  borderTop: '1px solid var(--border-glass)',
  paddingTop: '16px',
  marginTop: '8px',
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
};

const savedButtonStyle: React.CSSProperties = {
  ...submitButtonStyle,
  background: '#047857',
};
