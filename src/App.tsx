import { useEffect, useState } from 'react';
import { useAppStore } from './store/useAppStore';
import { getLoggedInUser, dbSignOut, deleteMealDb, insertMeal, getSupabaseClient } from './utils/supabase';
import { MealLogger } from './components/MealLogger';
import { MealReview } from './components/MealReview';
import { Dashboard } from './components/Dashboard';
import { ProgressTracker } from './components/ProgressTracker';
import { Auth } from './components/Auth';
import { ProfileView } from './components/ProfileView';
import { getFavorites, deleteFavorite } from './utils/storage';
import type { FavoriteMeal, MealType } from './types';
import { 
  Sparkles, 
  Calendar, 
  TrendingUp, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  Star, 
  Plus, 
  X, 
  Camera, 
  Search, 
  Trash2, 
  Zap 
} from 'lucide-react';
import './App.css';

function App() {
  const {
    currentUser,
    setCurrentUser,
    settings,
    saveSettingsCloud,
    meals,
    loadMeals,
    activeTab,
    setActiveTab,
    editingMeal,
    setEditingMeal,
    pendingAnalysis,
    setPendingAnalysis,
    toastConfig,
    showToast,
    modalConfig,
    confirmAction,
    isInitializing,
    setIsInitializing,
    syncSettingsFromCloud
  } = useAppStore();

  // New navigation & plus menu states
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [activeLoggerMode, setActiveLoggerMode] = useState<'ai' | 'search' | 'quick' | null>(null);
  const [favoritesList, setFavoritesList] = useState<FavoriteMeal[]>([]);

  useEffect(() => {
    if (activeTab === 'favorites') {
      setFavoritesList(getFavorites());
    }
  }, [activeTab]);

  const handleRemoveFavorite = (id: string) => {
    deleteFavorite(id);
    setFavoritesList(getFavorites());
    showToast('Refeição removida dos favoritos.', 'info');
  };

  const handleLogFavoriteInstantly = async (fav: FavoriteMeal) => {
    const hour = new Date().getHours();
    let meal_type: MealType = 'lunch';
    if (hour >= 6 && hour < 11) meal_type = 'breakfast';
    else if (hour >= 11 && hour < 15) meal_type = 'lunch';
    else if (hour >= 15 && hour < 19) meal_type = 'snack';
    else if (hour >= 19 && hour < 22) meal_type = 'dinner';
    else meal_type = 'supper';

    const total_calories = fav.items.reduce((sum, item) => sum + item.calories, 0);
    const total_protein = fav.items.reduce((sum, item) => sum + item.protein, 0);
    const total_carbs = fav.items.reduce((sum, item) => sum + item.carbs, 0);
    const total_fats = fav.items.reduce((sum, item) => sum + item.fats, 0);

    const newMeal = {
      id: Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(),
      timestamp: new Date().toISOString(),
      meal_type,
      items: fav.items,
      photos: [] as string[],
      total_calories,
      total_protein,
      total_carbs,
      total_fats,
      notes: `Registado instantaneamente dos favoritos: ${fav.name}`
    };
    
    await insertMeal(newMeal);
    await loadMeals();
    showToast('Refeição favorita registada!', 'success');
  };
  useEffect(() => {
    const initSession = async () => {
      try {
        const client = getSupabaseClient();
        if (client) {
          const { data: { session } } = await client.auth.getSession();
          if (session?.user) {
            const sessionUser = { id: session.user.id, email: session.user.email };
            localStorage.setItem('appcal_current_user', JSON.stringify(sessionUser));
          }
        }
      } catch (err) {
        console.warn("Falha ao recuperar sessão ativa do Supabase:", err);
      }

      const user = getLoggedInUser();
      if (user) {
        setCurrentUser(user);
        // Sync profile settings and meals from cloud database
        await Promise.all([
          syncSettingsFromCloud(),
          loadMeals()
        ]);
      }
      setIsInitializing(false);
    };
    initSession();
  }, []);

  const handleAuthSuccess = async (user: { id: string; email: string }) => {
    setCurrentUser(user);
    showToast('Sessão iniciada com sucesso!', 'success');
    setIsInitializing(true);
    // Reload user settings and meals
    await Promise.all([
      syncSettingsFromCloud(),
      loadMeals()
    ]);
    setIsInitializing(false);
  };

  const handleLogout = () => {
    confirmAction('Terminar Sessão', 'Deseja realmente terminar a sua sessão calórica?', async () => {
      await dbSignOut();
      setCurrentUser(null);
      setEditingMeal(null);
      setPendingAnalysis(null);
      showToast('Sessão terminada.', 'info');
    });
  };

  const handleSettingsSaved = async (newSettings: any) => {
    await saveSettingsCloud(newSettings);
    showToast('Metas guardadas e sincronizadas!', 'success');
  };

  const handleSaveMeal = async (newMeal: any) => {
    await insertMeal(newMeal);
    await loadMeals();
    setPendingAnalysis(null);
    showToast('Refeição registada com sucesso!', 'success');
  };

  const handleSaveEditedMeal = async (updatedMeal: any) => {
    if (!editingMeal) return;
    const mealToSave = {
      ...updatedMeal,
      id: editingMeal.id,
      timestamp: editingMeal.timestamp
    };
    await insertMeal(mealToSave);
    await loadMeals();
    setEditingMeal(null);
    showToast('Refeição atualizada com sucesso!', 'success');
  };

  const handleDeleteMeal = (id: string) => {
    confirmAction('Eliminar Registo', 'Tem a certeza que deseja apagar permanentemente este registo?', async () => {
      await deleteMealDb(id);
      await loadMeals();
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
              <button onClick={() => useAppStore.setState({ modalConfig: null })} style={customModalCancelButtonStyle}>
                Cancelar
              </button>
              <button onClick={modalConfig.onConfirm} style={customModalConfirmButtonStyle}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <main style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {editingMeal ? (
          /* Edit Mode Review screen */
          <div style={{ width: '100%' }}>
            <MealReview
              initialMealType={editingMeal.meal_type}
              initialItems={editingMeal.items}
              photos={editingMeal.photos}
              notes={editingMeal.notes || ''}
              onSave={handleSaveEditedMeal}
              onCancel={() => setEditingMeal(null)}
              apiKey={settings.geminiApiKey}
            />
          </div>
        ) : pendingAnalysis ? (
          /* Analysis Review screen (full width overlay look) */
          <div style={{ width: '100%' }}>
            <MealReview
              initialMealType={pendingAnalysis.meal_type}
              initialItems={pendingAnalysis.items}
              photos={pendingAnalysis.photos}
              notes={pendingAnalysis.notes}
              onSave={handleSaveMeal}
              onCancel={() => setPendingAnalysis(null)}
              apiKey={settings.geminiApiKey}
            />
          </div>
        ) : activeTab === 'diary' ? (
          /* TAB 1: DIARY (Dashboard Progress & History only) */
          <div style={{ maxWidth: '650px', margin: '0 auto', width: '100%' }}>
            <Dashboard
              meals={meals}
              goals={settings.goals}
              onDeleteMeal={handleDeleteMeal}
              onEditMeal={setEditingMeal}
              showToast={showToast}
            />
          </div>
        ) : activeTab === 'favorites' ? (
          /* TAB 2: FAVORITES LIST */
          <div style={{ maxWidth: '500px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="glass-panel" style={{ padding: '20px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Star size={20} style={{ color: 'var(--macro-fats)' }} />
                <span>Refeições Favoritas</span>
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', margin: 0, marginTop: '4px' }}>
                Guarde refeições a partir do seu diário para as registar instantaneamente no futuro.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {favoritesList.length === 0 ? (
                <div className="glass-panel" style={{ textAlign: 'center', padding: '36px', color: 'var(--color-text-secondary)' }}>
                  <Star size={24} style={{ color: 'rgba(255,255,255,0.1)', marginBottom: '8px' }} />
                  <p style={{ fontSize: '0.85rem', margin: 0 }}>Nenhuma refeição favorita guardada.</p>
                  <p style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)', margin: 0, marginTop: '4px' }}>
                    Clique na estrela (favorito) nas refeições do Diário para guardá-las aqui.
                  </p>
                </div>
              ) : (
                favoritesList.map((fav) => (
                  <div key={fav.id} className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>{fav.name}</h3>
                      <button 
                        onClick={() => handleRemoveFavorite(fav.id)} 
                        style={{ background: 'rgba(239,68,68,0.1)', border: 'none', color: '#f43f5e', width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        title="Remover"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {fav.items.map((item, idx) => (
                        <div key={idx} style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)' }}>
                          {item.name} ({item.weight_g}g)
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px', marginTop: '4px' }}>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
                        <span style={{ color: 'var(--macro-calories)' }}>{fav.total_calories} kcal</span>
                        <span>P: {fav.total_protein}g</span>
                        <span>H: {fav.total_carbs}g</span>
                        <span>L: {fav.total_fats}g</span>
                      </div>

                      <button
                        onClick={() => handleLogFavoriteInstantly(fav)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'var(--grad-calories)',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Zap size={11} />
                        <span>Registar</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : activeTab === 'progress' ? (
          /* TAB 3: PROGRESS (Weight Log & Adherence Charts) */
          <div style={{ width: '100%' }}>
            <ProgressTracker
              goals={settings.goals}
              meals={meals}
              confirmAction={confirmAction}
              showToast={showToast}
            />
          </div>
        ) : (
          /* TAB 4: PROFILE & CATEGORIZED SETTINGS */
          <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
            <ProfileView
              onSettingsSaved={handleSettingsSaved}
              onLogout={handleLogout}
              meals={meals}
              showToast={showToast}
            />
          </div>
        )}
      </main>

      {/* Floating Add Option Menu (Dim Overlay) */}
      {showAddMenu && (
        <div 
          onClick={() => setShowAddMenu(false)} 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            paddingBottom: '100px',
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="glass-panel animate-pulse-slow"
            style={{
              width: 'calc(100% - 32px)',
              maxWidth: '360px',
              padding: '20px',
              borderRadius: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>Registar Refeição</h4>
              <button 
                onClick={() => setShowAddMenu(false)} 
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={18} />
              </button>
            </div>

            <button
              onClick={() => {
                setActiveLoggerMode('ai');
                setShowAddMenu(false);
              }}
              style={addMenuOptionButtonStyle}
            >
              <div style={{ ...addMenuIconStyle, background: 'rgba(16, 185, 129, 0.1)', color: 'var(--macro-calories)' }}>
                <Camera size={20} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <span style={addMenuTitleStyle}>Análise de Foto por IA</span>
                <p style={addMenuDescStyle}>Tire uma foto ou carregue da galeria para estimar macros.</p>
              </div>
            </button>

            <button
              onClick={() => {
                setActiveLoggerMode('search');
                setShowAddMenu(false);
              }}
              style={addMenuOptionButtonStyle}
            >
              <div style={{ ...addMenuIconStyle, background: 'rgba(59, 130, 246, 0.1)', color: 'var(--macro-carbs)' }}>
                <Search size={20} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <span style={addMenuTitleStyle}>Pesquisa de Alimentos</span>
                <p style={addMenuDescStyle}>Pesquise no Open Food Facts ou código de barras.</p>
              </div>
            </button>

            <button
              onClick={() => {
                setActiveLoggerMode('quick');
                setShowAddMenu(false);
              }}
              style={addMenuOptionButtonStyle}
            >
              <div style={{ ...addMenuIconStyle, background: 'rgba(244, 63, 94, 0.1)', color: 'var(--macro-protein)' }}>
                <Plus size={20} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <span style={addMenuTitleStyle}>Registo Rápido Manual</span>
                <p style={addMenuDescStyle}>Insira calorias e macros manualmente.</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen Modal Logger */}
      {activeLoggerMode && (
        <div 
          style={loggerModalOverlayStyle}
        >
          {/* Glassmorphic header for the logger modal */}
          <header className="glass-panel" style={loggerModalHeaderStyle}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Registar Refeição</h2>
            <button 
              onClick={() => setActiveLoggerMode(null)}
              style={loggerModalCloseButtonStyle}
            >
              <X size={18} />
            </button>
          </header>

          <div style={loggerModalContentStyle} className="hide-scrollbar">
            <div style={{ maxWidth: '500px', margin: '0 auto', width: '100%' }}>
              <MealLogger
                apiKey={settings.geminiApiKey}
                model={settings.model}
                onAnalysisComplete={(result) => {
                  setPendingAnalysis(result);
                  setActiveLoggerMode(null);
                }}
                onInstantLog={(meal) => {
                  handleSaveMeal(meal);
                  setActiveLoggerMode(null);
                }}
                initialMode={activeLoggerMode}
              />
            </div>
          </div>
        </div>
      )}

      {/* iOS styled Bottom Navigation Bar (Floating glassmorphic look) */}
      {!pendingAnalysis && !editingMeal && (
        <nav className="glass-panel" style={bottomNavStyle}>
          <button
            onClick={() => setActiveTab('diary')}
            style={{ ...bottomTabButtonStyle, ...(activeTab === 'diary' ? activeBottomTabStyle : {}) }}
          >
            <Calendar size={20} />
            <span>Diário</span>
          </button>

          <button
            onClick={() => setActiveTab('favorites')}
            style={{ ...bottomTabButtonStyle, ...(activeTab === 'favorites' ? activeBottomTabStyle : {}) }}
          >
            <Star size={20} />
            <span>Favoritos</span>
          </button>

          {/* Center glowing Plus Button */}
          <button
            onClick={() => setShowAddMenu(true)}
            style={plusButtonStyle}
            aria-label="Adicionar Refeição"
          >
            <Plus size={28} />
          </button>
          
          <button
            onClick={() => setActiveTab('progress')}
            style={{ ...bottomTabButtonStyle, ...(activeTab === 'progress' ? activeBottomTabStyle : {}) }}
          >
            <TrendingUp size={20} />
            <span>Progresso</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            style={{ ...bottomTabButtonStyle, ...(activeTab === 'profile' ? activeBottomTabStyle : {}) }}
          >
            <User size={20} />
            <span>Perfil</span>
          </button>
        </nav>
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
  minHeight: '100dvh',
  backgroundColor: 'var(--bg-app)',
};

const appLayoutContainerStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '1200px',
  margin: '0 auto',
  padding: 'calc(16px + env(safe-area-inset-top)) 16px calc(110px + env(safe-area-inset-bottom)) 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  height: '100dvh',
  overflowY: 'auto',
  WebkitOverflowScrolling: 'touch',
};

// Old header and layout styles removed (Navigation moved to bottom and pages layout restructured)

const bottomNavStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
  left: '50%',
  transform: 'translateX(-50%)',
  width: 'calc(100% - 32px)',
  maxWidth: '460px',
  display: 'flex',
  justifyContent: 'space-around',
  alignItems: 'center',
  padding: '6px 12px',
  borderRadius: '30px',
  zIndex: 999,
  boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
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
};

const plusButtonStyle: React.CSSProperties = {
  width: '52px',
  height: '52px',
  borderRadius: '50%',
  background: 'var(--grad-calories)',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  cursor: 'pointer',
  boxShadow: '0 8px 20px rgba(16, 185, 129, 0.35)',
  transform: 'translateY(-14px)',
  flexShrink: 0,
  WebkitTapHighlightColor: 'transparent',
  transition: 'all 0.2s',
};

const addMenuOptionButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '12px',
  borderRadius: '16px',
  border: '1px solid var(--border-glass)',
  background: 'rgba(255, 255, 255, 0.02)',
  color: '#fff',
  cursor: 'pointer',
  transition: 'all 0.2s',
  textAlign: 'left',
  width: '100%',
  WebkitTapHighlightColor: 'transparent',
};

const addMenuIconStyle: React.CSSProperties = {
  width: '40px',
  height: '40px',
  borderRadius: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const addMenuTitleStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 700,
  display: 'block',
};

const addMenuDescStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: 'var(--color-text-secondary)',
  margin: 0,
  marginTop: '2px',
  lineHeight: 1.3,
};

const loggerModalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'var(--bg-app)',
  zIndex: 10000,
  display: 'flex',
  flexDirection: 'column',
};

const loggerModalHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'calc(env(safe-area-inset-top, 16px) + 8px) 16px 12px 16px',
  borderBottom: '1px solid var(--border-glass)',
};

const loggerModalCloseButtonStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid var(--border-glass)',
  borderRadius: '50%',
  width: '36px',
  height: '36px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#fff',
  cursor: 'pointer',
};

const loggerModalContentStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '16px 16px calc(16px + env(safe-area-inset-bottom, 0px)) 16px',
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
