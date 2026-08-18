import React, { useState, useEffect } from 'react';
import type { WeightLog, UserGoals, Meal } from '../types';
import { fetchWeightLogs, insertWeightLog, deleteWeightLogDb } from '../utils/supabase';
import { Scale, Plus, Trash2, Calendar, TrendingUp, Award, Activity } from 'lucide-react';
import { formatDateLabel, isSameDay } from '../utils/helpers';

interface ProgressTrackerProps {
  goals: UserGoals;
  meals: Meal[];
  confirmAction?: (title: string, message: string, onConfirm: () => void) => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const ProgressTracker: React.FC<ProgressTrackerProps> = ({ goals, meals, confirmAction, showToast }) => {
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [weightInput, setWeightInput] = useState('');
  const [dateInput, setDateInput] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);

  // Load weight logs on mount
  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setIsLoading(true);
    const logs = await fetchWeightLogs();
    setWeightLogs(logs);
    setIsLoading(false);
  };

  const handleAddWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    const weightNum = parseFloat(weightInput);
    if (isNaN(weightNum) || weightNum <= 0) return;

    setIsLoading(true);
    const updated = await insertWeightLog(dateInput, weightNum);
    setWeightLogs(updated);
    setWeightInput('');
    setIsLoading(false);
    if (showToast) showToast('Peso registado com sucesso!', 'success');
  };

  const handleDeleteLog = async (id: string) => {
    const deleteOp = async () => {
      setIsLoading(true);
      const updated = await deleteWeightLogDb(id);
      setWeightLogs(updated);
      setIsLoading(false);
      if (showToast) showToast('Registo de peso eliminado.', 'success');
    };

    if (confirmAction) {
      confirmAction('Eliminar Peso', 'Deseja apagar este registo de peso?', deleteOp);
    } else if (confirm('Deseja apagar este registo de peso?')) {
      deleteOp();
    }
  };

  // 7-day moving average calculator
  const getMovingAverage = (index: number, logs: WeightLog[]): number | null => {
    // Need at least some data points
    if (logs.length === 0) return null;
    
    const targetDate = new Date(logs[index].date);
    const sevenDaysAgo = new Date(targetDate);
    sevenDaysAgo.setDate(targetDate.getDate() - 6);

    const logsInWindow = logs.slice(0, index + 1).filter((l) => {
      const d = new Date(l.date);
      return d >= sevenDaysAgo && d <= targetDate;
    });

    if (logsInWindow.length === 0) return null;
    const sum = logsInWindow.reduce((s, l) => s + l.weight_kg, 0);
    return Number((sum / logsInWindow.length).toFixed(1));
  };

  // Get last 7 days calorie and protein logs
  const getLast7DaysIntake = () => {
    const intake = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      // Filter meals for this day
      const daysMeals = meals.filter((m) =>
        isSameDay(new Date(m.timestamp), d)
      );

      const calories = daysMeals.reduce((sum, m) => sum + m.total_calories, 0);
      const protein = daysMeals.reduce((sum, m) => sum + m.total_protein, 0);

      intake.push({
        dateLabel: d.toLocaleDateString([], { weekday: 'short' }),
        dateStr,
        calories,
        protein,
      });
    }
    return intake;
  };

  const dailyIntakeLogs = getLast7DaysIntake();

  // SVG Helper: Generate line coordinates for Weight logs
  const getWeightSvgPath = (width: number, height: number) => {
    if (weightLogs.length < 2) return { weightPath: '', avgPath: '', points: [] };

    // Limit to last 15 logs for chart readability
    const chartLogs = weightLogs.slice(-15);
    const weights = chartLogs.map(l => l.weight_kg);
    
    // Calculate moving averages for these logs
    const avgs = chartLogs.map((_, idx) => getMovingAverage(weightLogs.length - chartLogs.length + idx, weightLogs));
    
    const validAvgs = avgs.filter((a): a is number => a !== null);
    
    const minWeight = Math.min(...weights, ...validAvgs) - 1;
    const maxWeight = Math.max(...weights, ...validAvgs) + 1;
    const weightRange = maxWeight - minWeight || 1;

    const xStep = width / (chartLogs.length - 1);
    
    const points = chartLogs.map((log, idx) => {
      const x = idx * xStep;
      const y = height - ((log.weight_kg - minWeight) / weightRange) * (height - 20) - 10;
      
      const avgVal = avgs[idx];
      const avgY = avgVal !== null 
        ? height - ((avgVal - minWeight) / weightRange) * (height - 20) - 10 
        : null;

      return { x, y, avgY, date: log.date, weight: log.weight_kg, avg: avgVal };
    });

    // Daily weight dashed line
    const weightPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    
    // Moving average smooth line
    const avgPoints = points.filter(p => p.avgY !== null);
    const avgPath = avgPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.avgY}`).join(' ');

    return { weightPath, avgPath, points };
  };

  const svgWidth = 420;
  const svgHeight = 180;
  const { weightPath, avgPath, points: chartPoints } = getWeightSvgPath(svgWidth, svgHeight);

  // SVG Helper: Render calorie adherence bars
  const maxCaloriesLogged = Math.max(...dailyIntakeLogs.map(d => d.calories), goals.calories, 1);
  const maxProteinLogged = Math.max(...dailyIntakeLogs.map(d => d.protein), goals.protein, 1);

  return (
    <div style={trackerContainerStyle}>
      
      {/* Upper weight logger form */}
      <div className="glass-panel" style={sectionStyle}>
        <div style={titleRowStyle}>
          <Scale size={20} style={{ color: 'var(--macro-calories)' }} />
          <h2 style={sectionTitleStyle}>Registo de Peso Corporal</h2>
        </div>

        <form onSubmit={handleAddWeight} style={weightFormStyle}>
          <div style={inputGroupStyle}>
            <label style={labelStyle}>Peso Matinal (kg)</label>
            <input
              type="number"
              step="0.1"
              placeholder="Ex: 72.4"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              required
              style={inputStyle}
            />
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>Data de Medição</label>
            <input
              type="date"
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              required
              style={inputStyle}
            />
          </div>

          <button type="submit" disabled={isLoading} style={{ ...addWeightButtonStyle, width: '100%', marginTop: '6px' }}>
            <Plus size={18} />
            <span>Registar</span>
          </button>
        </form>
      </div>

      {/* Main progress chart display */}
      <div className="glass-panel" style={sectionStyle}>
        <div style={titleRowStyle}>
          <TrendingUp size={20} style={{ color: 'var(--macro-calories)' }} />
          <h3 style={sectionTitleStyle}>Evolução de Peso e Média Móvel (7 Dias)</h3>
        </div>
        
        {weightLogs.length < 2 ? (
          <div style={emptyChartStyle}>
            <Activity size={24} className="animate-pulse-slow" style={{ color: 'var(--color-text-muted)' }} />
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginTop: '6px' }}>
              Introduza pelo menos 2 registos de peso para gerar os gráficos.
            </span>
          </div>
        ) : (
          <div style={chartCardStyle}>
            {/* SVG Graph */}
            <div style={svgContainerStyle}>
              <svg width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ overflow: 'visible' }}>
                {/* Horizontal Guide Grid Lines */}
                <line x1="0" y1={svgHeight * 0.25} x2={svgWidth} y2={svgHeight * 0.25} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                <line x1="0" y1={svgHeight * 0.5} x2={svgWidth} y2={svgHeight * 0.5} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                <line x1="0" y1={svgHeight * 0.75} x2={svgWidth} y2={svgHeight * 0.75} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />

                {/* Daily weights line */}
                <path d={weightPath} fill="none" stroke="rgba(59, 130, 246, 0.35)" strokeWidth="2" strokeDasharray="4 4" />
                
                {/* 7-day moving average glowing line */}
                <path d={avgPath} fill="none" stroke="var(--macro-calories)" strokeWidth="4" strokeLinecap="round" style={{ filter: 'drop-shadow(0px 0px 4px rgba(16, 185, 129, 0.4))' }} />

                {/* Draw dot nodes */}
                {chartPoints.map((p, i) => (
                  <g key={i}>
                    {/* Weight dot */}
                    <circle cx={p.x} cy={p.y} r="3" fill="#3b82f6" />
                    
                    {/* Moving average dot */}
                    {p.avgY !== null && (
                      <circle cx={p.x} cy={p.avgY} r="4" fill="#10b981" />
                    )}
                  </g>
                ))}
              </svg>
            </div>
            
            {/* Legend indicators */}
            <div style={legendRowStyle}>
              <div style={legendItemStyle}>
                <span style={{ ...legendDotStyle, backgroundColor: '#3b82f6', borderRadius: '0' }} />
                <span style={legendTextStyle}>Peso Diário</span>
              </div>
              <div style={legendItemStyle}>
                <span style={{ ...legendDotStyle, backgroundColor: '#10b981' }} />
                <span style={legendTextStyle}>Média Móvel (7 dias)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Adherence and Protein Intake Graphs Grid */}
      <div style={gridStyle}>
        
        {/* Calorie Adherence */}
        <div className="glass-panel" style={sectionStyle}>
          <div style={titleRowStyle}>
            <Award size={18} style={{ color: 'var(--macro-calories)' }} />
            <h3 style={smallChartTitleStyle}>Aderência Calórica (7d)</h3>
          </div>

          <div style={barChartContainerStyle}>
            {dailyIntakeLogs.map((day, idx) => {
              const heightPct = (day.calories / maxCaloriesLogged) * 100;
              const isOverLimit = day.calories > goals.calories;
              const targetHeightPct = (goals.calories / maxCaloriesLogged) * 100;

              return (
                <div key={idx} style={barColStyle}>
                  <div style={barTrackStyle}>
                    {/* Calorie consumption bar */}
                    <div
                      style={{
                        ...barFillStyle,
                        height: `${heightPct}%`,
                        backgroundColor: isOverLimit ? 'var(--macro-protein)' : 'var(--macro-calories)',
                        boxShadow: isOverLimit ? '0 0 6px rgba(244,63,94,0.3)' : 'none',
                      }}
                      title={`${day.calories} kcal`}
                    />
                    {/* Dashed Target line */}
                    <div style={{ ...targetLineStyle, bottom: `${targetHeightPct}%` }} />
                  </div>
                  <span style={xLabelStyle}>{day.dateLabel}</span>
                  <span style={barValueStyle}>{day.calories}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Protein intake tracker */}
        <div className="glass-panel" style={sectionStyle}>
          <div style={titleRowStyle}>
            <Award size={18} style={{ color: 'var(--macro-protein)' }} />
            <h3 style={smallChartTitleStyle}>Consumo de Proteínas (7d)</h3>
          </div>

          <div style={barChartContainerStyle}>
            {dailyIntakeLogs.map((day, idx) => {
              const heightPct = (day.protein / maxProteinLogged) * 100;
              const hitsTarget = day.protein >= goals.protein;
              const targetHeightPct = (goals.protein / maxProteinLogged) * 100;

              return (
                <div key={idx} style={barColStyle}>
                  <div style={barTrackStyle}>
                    {/* Protein bar */}
                    <div
                      style={{
                        ...barFillStyle,
                        height: `${heightPct}%`,
                        backgroundColor: hitsTarget ? 'var(--macro-protein)' : 'var(--color-text-muted)',
                      }}
                      title={`${day.protein}g`}
                    />
                    {/* Target line */}
                    <div style={{ ...targetLineStyle, bottom: `${targetHeightPct}%` }} />
                  </div>
                  <span style={xLabelStyle}>{day.dateLabel}</span>
                  <span style={barValueStyle}>{Math.round(day.protein)}g</span>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* History Weight Log Table */}
      <div className="glass-panel" style={sectionStyle}>
        <div style={titleRowStyle}>
          <Calendar size={18} style={{ color: 'var(--macro-calories)' }} />
          <h3 style={sectionTitleStyle}>Histórico de Pesagens</h3>
        </div>

        {weightLogs.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '10px' }}>
            Nenhum registo de peso disponível.
          </p>
        ) : (
          <div style={tableContainerStyle} className="hide-scrollbar">
            <div style={tableHeaderStyle}>
              <span style={{ ...tableColStyle, flex: 2 }}>Data</span>
              <span style={{ ...tableColStyle, flex: 1.5 }}>Peso</span>
              <span style={{ ...tableColStyle, flex: 1.8 }}>Média Móvel (7d)</span>
              <span style={{ width: '40px', flexShrink: 0 }}></span>
            </div>

            <div style={tableBodyStyle}>
              {weightLogs.slice().reverse().map((log, index) => {
                const actualIndex = weightLogs.length - 1 - index;
                const movingAvg = getMovingAverage(actualIndex, weightLogs);
                
                return (
                  <div key={log.id} style={tableRowStyle} className="glass-card">
                    <span style={{ ...tableColStyle, flex: 2, fontSize: '0.85rem', fontWeight: 500 }}>
                      {formatDateLabel(log.date)}
                    </span>
                    <span style={{ ...tableColStyle, flex: 1.5, fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>
                      {log.weight_kg} kg
                    </span>
                    <span style={{ ...tableColStyle, flex: 1.8, fontSize: '0.85rem', fontWeight: 600, color: 'var(--macro-calories)' }}>
                      {movingAvg ? `${movingAvg} kg` : '—'}
                    </span>
                    <button
                      onClick={() => handleDeleteLog(log.id)}
                      style={deleteLogButtonStyle}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

// Styles
const trackerContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  width: '100%',
};

const sectionStyle: React.CSSProperties = {
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
};

const titleRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '1rem',
  fontWeight: 700,
  color: '#fff',
};

const weightFormStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  width: '100%',
};

const inputGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  width: '100%',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  backgroundColor: 'var(--bg-input)',
  border: '1px solid var(--border-glass)',
  borderRadius: '10px',
  outline: 'none',
  fontSize: '16px', // iOS scale
  color: '#fff',
  boxSizing: 'border-box',
};

const addWeightButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '11px',
  borderRadius: '10px',
  border: 'none',
  background: 'var(--grad-calories)',
  color: '#fff',
  fontWeight: 700,
  fontSize: '0.9rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  cursor: 'pointer',
  minWidth: '100px',
};

const emptyChartStyle: React.CSSProperties = {
  height: '140px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(0,0,0,0.15)',
  borderRadius: '14px',
  border: '1px dashed var(--border-glass)',
};

const chartCardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  backgroundColor: 'rgba(0,0,0,0.15)',
  borderRadius: '14px',
  padding: '14px',
  border: '1px solid var(--border-glass)',
};

const svgContainerStyle: React.CSSProperties = {
  width: '100%',
  height: '160px',
};

const legendRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  gap: '20px',
  borderTop: '1px solid rgba(255,255,255,0.03)',
  paddingTop: '10px',
};

const legendItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

const legendDotStyle: React.CSSProperties = {
  width: '12px',
  height: '4px',
  borderRadius: '2px',
};

const legendTextStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--color-text-secondary)',
  fontWeight: 500,
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: '16px',
};

const smallChartTitleStyle: React.CSSProperties = {
  fontSize: '0.9rem',
  fontWeight: 700,
  color: '#fff',
};

const barChartContainerStyle: React.CSSProperties = {
  display: 'flex',
  height: '140px',
  justifyContent: 'space-between',
  alignItems: 'flex-end',
  padding: '10px 4px 4px 4px',
  backgroundColor: 'rgba(0,0,0,0.15)',
  borderRadius: '12px',
  border: '1px solid var(--border-glass)',
};

const barColStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  height: '100%',
  gap: '4px',
};

const barTrackStyle: React.CSSProperties = {
  flex: 1,
  width: '16px',
  backgroundColor: 'rgba(255,255,255,0.02)',
  borderRadius: '8px',
  position: 'relative',
  display: 'flex',
  alignItems: 'flex-end',
  overflow: 'hidden',
};

const barFillStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: '8px',
  transition: 'height 0.4s ease-out',
};

const targetLineStyle: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  height: '1px',
  borderTop: '2px dashed rgba(255,255,255,0.25)',
  zIndex: 2,
};

const xLabelStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  color: 'var(--color-text-secondary)',
  fontWeight: 600,
  textTransform: 'capitalize',
};

const barValueStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  color: '#fff',
  fontWeight: 700,
};

const tableContainerStyle: React.CSSProperties = {
  maxHeight: '220px',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const tableHeaderStyle: React.CSSProperties = {
  display: 'flex',
  padding: '6px 12px',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const tableColStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
};

const tableBodyStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
};

const tableRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '10px 12px',
};

const deleteLogButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--color-text-muted)',
  cursor: 'pointer',
  padding: '6px',
  borderRadius: '8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  WebkitTapHighlightColor: 'transparent',
};
