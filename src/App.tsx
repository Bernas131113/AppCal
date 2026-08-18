import { useState, useEffect } from 'react';
import type { Meal, AppSettings, FoodItem, MealType } from './types';
import { getSettings } from './utils/storage';
import { getLoggedInUser, dbSignOut, fetchMeals, insertMeal, deleteMealDb } from './utils/supabase';
import { MealLogger } from './components/MealLogger';
import { MealReview } from './components/MealReview';
import { Dashboard } from './components/Dashboard';
import { ProgressTracker } from './components/ProgressTracker';
import { Settings } from './components/Settings';
import { Auth } from './components/Auth';
import { Settings as SettingsIcon, Sparkles, LogOut, Calendar, TrendingUp, User, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import './App.css';

function App() {
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string } | null>(null);
  const [settings, setSettings] = useState<AppSettings>(getSettings());
  const [meals, setMeals] = useState<Meal[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'diary' | 'progress'>('diary');
  const [isInitializing, setIsInitializing] = useState(true);

  // Editing meal state
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);

  // Custom alert & confirmation modal states
  const [modalConfig, setModalConfig] = useState<{
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
  } | null>(null);

  // Custom Toast notifications
  const [toastConfig, setToastConfig] = useState<{
    isOpen: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  // Toast notification helper
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastConfig({ isOpen: true, message, type });
    setTimeout(() => {
      setToastConfig(prev => prev ? { ...prev, isOpen: false } : null);
    }, 3000);
  };

  // Custom confirmation helper
  const confirmAction = (title: string, message: string, onConfirm: () => void) => {
    setModalConfig({
      title,
      message,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      onConfirm: () => {
        onConfirm();
        setModalConfig(null);
      }
    });
  };

  // Pending review state
  const [pendingAnalysis, setPendingAnalysis] = useState<{
    meal_type: MealType;
    items: FoodItem[];
    photos: string[];
    notes: string;
  } | null>(null);

  // Check login session on mount
  useEffect(() => {
    const user = getLoggedInUser();
    if (user) {
      setCurrentUser(user);
      loadUserMeals();
    }
    setIsInitializing(false);
  }, []);

  const loadUserMeals = async () => {
    const fetched = await fetchMeals();
    setMeals(fetched);
  };

  const handleAuthSuccess = (user: { id: string; email: string }) => {
    setCurrentUser(user);
    showToast('Sessão iniciada com sucesso!', 'success');
    // Load fresh meals for this user
    setTimeout(() => {
      loadUserMeals();
    }, 100);
  };

  const handleLogout = () => {
    confirmAction('Terminar Sessão', 'Deseja realmente terminar a sua sessão calórica?', async () => {
      await dbSignOut();
      setCurrentUser(null);
      setMeals([]);
      setPendingAnalysis(null);
      setEditingMeal(null);
      showToast('Sessão terminada.', 'info');
    });
  };

  const handleSettingsSaved = (newSettings: AppSettings) => {
    setSettings(newSettings);
    setShowSettings(false);
    showToast('Definições guardadas!', 'success');
    loadUserMeals();
  };

  const handleAnalysisComplete = (result: {
    meal_type: MealType;
    items: FoodItem[];
    photos: string[];
    notes: string;
  }) => {
    setPendingAnalysis(result);
  };

  const handleSaveMeal = async (newMeal: Meal) => {
    await insertMeal(newMeal);
    const updated = await fetchMeals();
    setMeals(updated);
    setPendingAnalysis(null); // Close review panel
    showToast('Refeição registada com sucesso!', 'success');
  };

  const handleEditMeal = (meal: Meal) => {
    setEditingMeal(meal);
  };

  const handleSaveEditedMeal = async (updatedMeal: Meal) => {
    if (!editingMeal) return;
    
    // Preserve the original meal identity and date
    const mealToSave = {
      ...updatedMeal,
      id: editingMeal.id,
      timestamp: editingMeal.timestamp
    };
    
    await insertMeal(mealToSave);
    const updated = await fetchMeals();
    setMeals(updated);
    setEditingMeal(null); // Close edit panel
    showToast('Refeição atualizada com sucesso!', 'success');
  };

  const handleDeleteMeal = (id: string) => {
    confirmAction('Eliminar Registo', 'Tem a certeza que deseja apagar permanentemente este registo?', async () => {
      await deleteMealDb(id);
      const updated = await fetchMeals();
      setMeals(updated);
      showToast('Registo eliminado.', 'success');
    });
  };

  if (isInitializing) {
    return (
      <div style={loadingPageStyle}>
        <Sparkles size={36} className="animate-pulse-slow" style={{ color: 'var(--macro-calories)' }} />
        <span style={{ marginTop: '12px', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>A carregar o AppCal...</span>
      </div>
    );
  }

  // Auth gatekeeper
  if (!currentUser) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div style={appLayoutContainerStyle}>
      {/* Custom Toast Indicator */}
      {toastConfig && toastConfig.isOpen && (
        <div style={customToastStyle(toastConfig.type)}>
          {toastConfig.type === 'success' && <CheckCircle2 size={16} />}
          {toastConfig.type === 'error' && <AlertCircle size={16} />}
          {toastConfig.type === 'info' && <Info size={16} />}
          <span>{toastConfig.message}</span>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {modalConfig && (
        <div style={customModalOverlayStyle}>
          <div className="glass-panel animate-pulse-slow" style={customModalContentStyle}>
            <h3 style={customModalTitleStyle}>{modalConfig.title}</h3>
            <p style={customModalMessageStyle}>{modalConfig.message}</p>
            <div style={customModalActionsStyle}>
              <button onClick={() => setModalConfig(null)} style={customModalCancelButtonStyle}>
                Cancelar
              </button>
              <button onClick={modalConfig.onConfirm} style={customModalConfirmButtonStyle}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

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
          {/* User Email Indicator */}
          <div style={userChipStyle} title={`Sessão iniciada como ${currentUser.email}`}>
            <User size={14} />
            <span style={userEmailStyle}>{currentUser.email}</span>
          </div>

          {/* Settings gear */}
          <button
            onClick={() => setShowSettings(true)}
            style={headerIconButtonStyle}
            title="Definições"
          >
            <SettingsIcon size={18} />
          </button>

          {/* Logout button */}
          <button
            onClick={handleLogout}
            style={{ ...headerIconButtonStyle, color: 'var(--macro-protein)' }}
            title="Terminar Sessão"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Main Content Grid */}
      <main style={mainContentGridStyle}>
        {editingMeal ? (
          /* Edit Mode Review screen */
          <div style={{ gridColumn: '1 / -1' }}>
            <MealReview
              initialMealType={editingMeal.meal_type}
              initialItems={editingMeal.items}
              photos={editingMeal.photos}
              notes={editingMeal.notes || ''}
              onSave={handleSaveEditedMeal}
              onCancel={() => setEditingMeal(null)}
            />
          </div>
        ) : pendingAnalysis ? (
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
        ) : activeTab === 'diary' ? (
          /* TAB 1: DIARY (Split Dashboard + Logger view) */
          <>
            {/* Left side: AI Registry */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <MealLogger
                apiKey={settings.geminiApiKey}
                model={settings.model}
                onAnalysisComplete={handleAnalysisComplete}
                onInstantLog={handleSaveMeal}
              />
            </section>

            {/* Right side: Dashboard Progress & History */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Dashboard
                meals={meals}
                goals={settings.goals}
                onDeleteMeal={handleDeleteMeal}
                onEditMeal={handleEditMeal}
              />
            </section>
          </>
        ) : (
          /* TAB 2: PROGRESS (Weight Log & Adherence Charts) */
          <div style={{ gridColumn: '1 / -1' }}>
            <ProgressTracker
              goals={settings.goals}
              meals={meals}
            />
          </div>
        )}
      </main>

      {/* iOS styled Bottom Navigation Bar (Floating glassmorphic look) */}
      {!pendingAnalysis && !editingMeal && (
        <nav className="glass-panel" style={bottomNavStyle}>
          <button
            onClick={() => setActiveTab('diary')}
            style={{ ...bottomTabButtonStyle, ...(activeTab === 'diary' ? activeBottomTabStyle : {}) }}
          >
            <Calendar size={22} />
            <span>Diário</span>
          </button>
          
          <button
            onClick={() => setActiveTab('progress')}
            style={{ ...bottomTabButtonStyle, ...(activeTab === 'progress' ? activeBottomTabStyle : {}) }}
          >
            <TrendingUp size={22} />
            <span>Progresso</span>
          </button>
        </nav>
      )}

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
const loadingPageStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  backgroundColor: 'var(--bg-app)',
};

const appLayoutContainerStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '1200px',
  margin: '0 auto',
  padding: '16px 16px 90px 16px', // bottom padding for floating iOS nav bar
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  minHeight: '100vh',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 16px',
  borderRadius: '16px',
};

const logoContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
};

const logoIconStyle: React.CSSProperties = {
  width: '34px',
  height: '34px',
  borderRadius: '8px',
  background: 'var(--grad-calories)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)',
};

const logoTextStyle: React.CSSProperties = {
  fontSize: '1.25rem',
  fontWeight: 800,
  lineHeight: 1.1,
  background: 'linear-gradient(90deg, #fff 0%, #cbd5e1 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
};

const logoSubStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: 'var(--color-text-secondary)',
};

const headerRightStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const userChipStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 10px',
  borderRadius: '12px',
  fontSize: '0.75rem',
  fontWeight: 600,
  backgroundColor: 'rgba(255, 255, 255, 0.03)',
  border: '1px solid var(--border-glass)',
  color: 'var(--color-text-secondary)',
  maxWidth: '120px',
  overflow: 'hidden',
};

const userEmailStyle: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const headerIconButtonStyle: React.CSSProperties = {
  width: '32px',
  height: '32px',
  borderRadius: '8px',
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

const mainContentGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: '16px',
  alignItems: 'start',
};

const bottomNavStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: '16px',
  left: '50%',
  transform: 'translateX(-50%)',
  width: 'calc(100% - 32px)',
  maxWidth: '400px',
  display: 'flex',
  justifyContent: 'space-around',
  padding: '6px',
  borderRadius: '30px',
  zIndex: 999,
  boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
};

const bottomTabButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '8px 4px',
  background: 'none',
  border: 'none',
  borderRadius: '24px',
  color: 'var(--color-text-secondary)',
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '4px',
  fontSize: '0.7rem',
  fontWeight: 600,
  transition: 'all 0.2s',
  WebkitTapHighlightColor: 'transparent',
};

const activeBottomTabStyle: React.CSSProperties = {
  color: '#fff',
  background: 'rgba(255,255,255,0.04)',
};

// Custom popup styles
const customModalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.65)',
  backdropFilter: 'blur(10px)',
  zIndex: 10000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
};

const customModalContentStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '380px',
  padding: '24px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  textAlign: 'center',
  boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
  borderRadius: '16px',
};

const customModalTitleStyle: React.CSSProperties = {
  fontSize: '1.2rem',
  fontWeight: 800,
  color: '#fff',
};

const customModalMessageStyle: React.CSSProperties = {
  fontSize: '0.9rem',
  color: 'var(--color-text-secondary)',
  lineHeight: 1.5,
};

const customModalActionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '10px',
  marginTop: '10px',
};

const customModalCancelButtonStyle: React.CSSProperties = {
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

const customModalConfirmButtonStyle: React.CSSProperties = {
  flex: 1,
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

const customToastStyle = (type: 'success' | 'error' | 'info'): React.CSSProperties => {
  let bgColor = 'rgba(16, 185, 129, 0.15)';
  let borderColor = 'rgba(16, 185, 129, 0.3)';
  let color = '#34d399';
  if (type === 'error') {
    bgColor = 'rgba(239, 68, 68, 0.15)';
    borderColor = 'rgba(239, 68, 68, 0.3)';
    color = '#f87171';
  } else if (type === 'info') {
    bgColor = 'rgba(59, 130, 246, 0.15)';
    borderColor = 'rgba(59, 130, 246, 0.3)';
    color = '#60a5fa';
  }

  return {
    position: 'fixed',
    top: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 11000,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 20px',
    borderRadius: '30px',
    backgroundColor: bgColor,
    border: `1px solid ${borderColor}`,
    color: color,
    fontWeight: 600,
    fontSize: '0.85rem',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    animation: 'slideDown 0.3s ease-out',
    maxWidth: '90%',
    textAlign: 'center',
  };
};

export default App;
