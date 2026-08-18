import { useState, useEffect } from 'react';
import type { Meal, AppSettings, FoodItem, MealType } from './types';
import { getSettings, getMeals, addMeal, deleteMeal } from './utils/storage';
import { MealLogger } from './components/MealLogger';
import { MealReview } from './components/MealReview';
import { Dashboard } from './components/Dashboard';
import { Settings } from './components/Settings';
import { Settings as SettingsIcon, Cpu, Sparkles } from 'lucide-react';
import './App.css';

function App() {
  const [settings, setSettings] = useState<AppSettings>(getSettings());
  const [meals, setMeals] = useState<Meal[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  
  // Pending review state
  const [pendingAnalysis, setPendingAnalysis] = useState<{
    meal_type: MealType;
    items: FoodItem[];
    photos: string[];
    notes: string;
  } | null>(null);

  // Load meals on mount
  useEffect(() => {
    setMeals(getMeals());
  }, []);

  const handleSettingsSaved = (newSettings: AppSettings) => {
    setSettings(newSettings);
    setShowSettings(false);
  };

  const handleAnalysisComplete = (result: {
    meal_type: MealType;
    items: FoodItem[];
    photos: string[];
    notes: string;
  }) => {
    setPendingAnalysis(result);
  };

  const handleSaveMeal = (newMeal: Meal) => {
    const updatedMeals = addMeal(newMeal);
    setMeals(updatedMeals);
    setPendingAnalysis(null); // Close review panel
  };

  const handleDeleteMeal = (id: string) => {
    if (confirm('Tem a certeza que deseja apagar este registo?')) {
      const updatedMeals = deleteMeal(id);
      setMeals(updatedMeals);
    }
  };

  return (
    <div style={appLayoutContainerStyle}>
      {/* App Header */}
      <header className="glass-panel" style={headerStyle}>
        <div style={logoContainerStyle}>
          <div style={logoIconStyle}>
            <Sparkles size={20} style={{ color: '#fff' }} />
          </div>
          <div>
            <h1 style={logoTextStyle}>AppCal</h1>
            <span style={logoSubStyle}>Nutrição Inteligente por IA</span>
          </div>
        </div>

        <div style={headerRightStyle}>
          {/* API Status Badge */}
          {settings.geminiApiKey ? (
            <div style={apiBadgeActiveStyle}>
              <Cpu size={14} />
              <span>Gemini Activo</span>
            </div>
          ) : (
            <div style={apiBadgeDemoStyle} onClick={() => setShowSettings(true)}>
              <Cpu size={14} />
              <span>Modo Demo (Clíque para ativar)</span>
            </div>
          )}

          <button
            onClick={() => setShowSettings(true)}
            style={settingsIconButtonStyle}
            title="Abrir Definições"
          >
            <SettingsIcon size={20} />
          </button>
        </div>
      </header>

      {/* Main Content Grid */}
      <main style={mainContentGridStyle}>
        {pendingAnalysis ? (
          /* Analysis Review screen (full width overlay look) */
          <div style={{ gridColumn: '1 / -1' }}>
            <MealReview
              initialMealType={pendingAnalysis.meal_type}
              initialItems={pendingAnalysis.items}
              photos={pendingAnalysis.photos}
              notes={pendingAnalysis.notes}
              onSave={handleSaveMeal}
              onCancel={() => setPendingAnalysis(null)}
            />
          </div>
        ) : (
          /* Split Dashboard + Logger view */
          <>
            {/* Left side: AI Registry */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <MealLogger
                apiKey={settings.geminiApiKey}
                model={settings.model}
                onAnalysisComplete={handleAnalysisComplete}
              />
            </section>

            {/* Right side: Dashboard Progress & History */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Dashboard
                meals={meals}
                goals={settings.goals}
                onDeleteMeal={handleDeleteMeal}
              />
            </section>
          </>
        )}
      </main>

      {/* Settings Modal Dialog */}
      {showSettings && (
        <Settings
          onSettingsSaved={handleSettingsSaved}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

// Styles
const appLayoutContainerStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '1200px',
  margin: '0 auto',
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
  minHeight: '100vh',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 24px',
  borderRadius: '20px',
};

const logoContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
};

const logoIconStyle: React.CSSProperties = {
  width: '38px',
  height: '38px',
  borderRadius: '10px',
  background: 'var(--grad-calories)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
};

const logoTextStyle: React.CSSProperties = {
  fontSize: '1.4rem',
  fontWeight: 800,
  lineHeight: 1.1,
  background: 'linear-gradient(90deg, #fff 0%, #cbd5e1 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
};

const logoSubStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--color-text-secondary)',
};

const headerRightStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '14px',
};

const apiBadgeActiveStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 12px',
  borderRadius: '20px',
  fontSize: '0.8rem',
  fontWeight: 600,
  backgroundColor: 'rgba(16, 185, 129, 0.1)',
  color: '#34d399',
  border: '1px solid rgba(16, 185, 129, 0.2)',
};

const apiBadgeDemoStyle: React.CSSProperties = {
  ...apiBadgeActiveStyle,
  backgroundColor: 'rgba(245, 158, 11, 0.1)',
  color: '#fbbf24',
  border: '1px solid rgba(245, 158, 11, 0.2)',
  cursor: 'pointer',
};

const settingsIconButtonStyle: React.CSSProperties = {
  width: '36px',
  height: '36px',
  borderRadius: '10px',
  border: '1px solid var(--border-glass)',
  background: 'rgba(255,255,255,0.02)',
  color: 'var(--color-text-secondary)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'all 0.2s',
};

const mainContentGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: '20px',
  alignItems: 'start',
};

export default App;
