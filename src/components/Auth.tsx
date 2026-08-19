import React, { useState, useEffect } from 'react';
import { dbSignIn, dbSignUp } from '../utils/supabase';
import { Sparkles, Mail, Lock, LogIn, UserPlus, AlertCircle, ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useTranslation } from '../utils/i18n';

interface AuthProps {
  onAuthSuccess: (user: { id: string; email: string }) => void;
}

export const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  const { t } = useTranslation();
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(true);

  useEffect(() => {
    const isRemembered = localStorage.getItem('appcal_remember_me') === 'true';
    if (isRemembered) {
      const savedEmail = localStorage.getItem('appcal_saved_email') || '';
      const savedPassword = localStorage.getItem('appcal_saved_password') || '';
      if (savedEmail && savedPassword) {
        setEmail(savedEmail);
        setPassword(savedPassword);
        setRememberMe(true);
        setIsLoading(true);
        const autoLogin = async () => {
          try {
            const { user, error: signInError } = await dbSignIn(savedEmail, savedPassword);
            if (!signInError && user) {
              onAuthSuccess(user);
            } else {
              setIsLoading(false);
            }
          } catch (err) {
            setIsLoading(false);
          }
        };
        autoLogin();
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) { setError(t('auth_error_fields')); return; }
    if (password.length < 6) { setError(t('auth_error_password_len')); return; }
    if (!isLoginMode && password !== confirmPassword) { setError(t('auth_error_password_match')); return; }

    setIsLoading(true);
    try {
      if (isLoginMode) {
        const { user, error: signInError } = await dbSignIn(email, password);
        if (signInError) {
          setError(signInError);
        } else if (user) {
          if (rememberMe) {
            localStorage.setItem('appcal_remember_me', 'true');
            localStorage.setItem('appcal_saved_email', email);
            localStorage.setItem('appcal_saved_password', password);
          } else {
            localStorage.removeItem('appcal_remember_me');
            localStorage.removeItem('appcal_saved_email');
            localStorage.removeItem('appcal_saved_password');
          }
          onAuthSuccess(user);
        }
      } else {
        const { user, error: signUpError } = await dbSignUp(email, password);
        if (signUpError) {
          setError(signUpError);
        } else if (user) {
          if (rememberMe) {
            localStorage.setItem('appcal_remember_me', 'true');
            localStorage.setItem('appcal_saved_email', email);
            localStorage.setItem('appcal_saved_password', password);
          }
          onAuthSuccess(user);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(t('auth_error_fields'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={authPageContainerStyle}>
      <div className="glass-panel" style={authCardStyle}>

        {/* Logo and Brand */}
        <div style={brandHeaderStyle}>
          <div style={logoIconStyle}><Sparkles size={24} style={{ color: '#fff' }} /></div>
          <h1 style={logoTextStyle}>AppCal</h1>
          <p style={logoSubStyle}>AI-powered nutrition tracker</p>
        </div>

        <h2 style={modeTitleStyle}>
          {isLoginMode ? t('auth_title_login') : t('auth_title_signup')}
        </h2>

        {error && (
          <div style={errorContainerStyle}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={formStyle}>
          {/* Email */}
          <div style={inputGroupStyle}>
            <label style={labelStyle}>{t('auth_label_email')}</label>
            <div style={inputIconContainerStyle}>
              <Mail size={18} style={iconStyle} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                style={inputStyle}
                disabled={isLoading}
                required
              />
            </div>
          </div>

          {/* Password */}
          <div style={inputGroupStyle}>
            <label style={labelStyle}>{t('auth_label_password')}</label>
            <div style={inputIconContainerStyle}>
              <Lock size={18} style={iconStyle} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                style={inputStyle}
                disabled={isLoading}
                required
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={eyeButtonStyle}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirm Password (sign up only) */}
          {!isLoginMode && (
            <div style={inputGroupStyle}>
              <label style={labelStyle}>{t('auth_label_confirm')}</label>
              <div style={inputIconContainerStyle}>
                <Lock size={18} style={iconStyle} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••"
                  style={inputStyle}
                  disabled={isLoading}
                  required
                />
              </div>
            </div>
          )}

          {/* Remember Me (login only) */}
          {isLoginMode && (
            <div style={rememberMeContainerStyle}>
              <label style={rememberMeLabelStyle}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={checkboxStyle}
                  disabled={isLoading}
                />
                <span>{t('auth_remember_me')}</span>
              </label>
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={isLoading} style={submitButtonStyle}>
            {isLoading ? (
              <Loader2 size={20} style={{ animation: 'spin 1.5s linear infinite' }} />
            ) : isLoginMode ? (
              <><span>{t('auth_btn_login')}</span><LogIn size={18} /></>
            ) : (
              <><span>{t('auth_btn_signup')}</span><UserPlus size={18} /></>
            )}
          </button>
        </form>

        {/* Switch mode footer */}
        <div style={footerRowStyle}>
          <span style={footerTextStyle}>
            {isLoginMode ? t('auth_switch_signup') : t('auth_switch_login')}
          </span>
          <button
            onClick={() => { setIsLoginMode(!isLoginMode); setError(null); }}
            style={switchModeButtonStyle}
          >
            {isLoginMode ? t('auth_link_signup') : t('auth_link_login')}
            <ArrowRight size={14} />
          </button>
        </div>

      </div>
    </div>
  );
};

// Styles
const authPageContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '85vh',
  width: '100%',
  padding: '16px',
};

const authCardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '420px',
  padding: '30px 24px',
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
};

const brandHeaderStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  gap: '8px',
};

const logoIconStyle: React.CSSProperties = {
  width: '46px',
  height: '46px',
  borderRadius: '12px',
  background: 'var(--grad-calories)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
};

const logoTextStyle: React.CSSProperties = {
  fontSize: '1.8rem',
  fontWeight: 800,
  lineHeight: 1,
  background: 'linear-gradient(90deg, #fff 0%, #94a3b8 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
};

const logoSubStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: 'var(--color-text-secondary)',
  lineHeight: 1.3,
};

const modeTitleStyle: React.CSSProperties = {
  fontSize: '1.2rem',
  fontWeight: 700,
  textAlign: 'center',
  marginTop: '4px',
};

const errorContainerStyle: React.CSSProperties = {
  backgroundColor: 'rgba(239, 68, 68, 0.1)',
  border: '1px solid rgba(239, 68, 68, 0.2)',
  color: '#f87171',
  borderRadius: '10px',
  padding: '10px 12px',
  fontSize: '0.85rem',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const formStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
};

const inputGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
};

const inputIconContainerStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
};

const iconStyle: React.CSSProperties = {
  position: 'absolute',
  left: '12px',
  color: 'var(--color-text-muted)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px 12px 38px',
  backgroundColor: 'var(--bg-input)',
  border: '1px solid var(--border-glass)',
  borderRadius: '10px',
  outline: 'none',
  fontSize: '16px',
  color: '#fff',
  transition: 'border-color 0.2s',
};

const eyeButtonStyle: React.CSSProperties = {
  position: 'absolute',
  right: '12px',
  background: 'none',
  border: 'none',
  color: 'var(--color-text-muted)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  padding: '4px',
};

const submitButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px',
  borderRadius: '10px',
  border: 'none',
  background: 'var(--grad-calories)',
  color: '#fff',
  fontWeight: 700,
  fontSize: '0.95rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  cursor: 'pointer',
  marginTop: '10px',
  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)',
};

const footerRowStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '6px',
  marginTop: '8px',
  borderTop: '1px solid var(--border-glass)',
  paddingTop: '16px',
};

const footerTextStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: 'var(--color-text-muted)',
};

const switchModeButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--macro-calories)',
  fontWeight: 600,
  fontSize: '0.85rem',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
};

const rememberMeContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '2px 0',
};

const rememberMeLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '0.85rem',
  color: 'var(--color-text-secondary)',
  cursor: 'pointer',
  userSelect: 'none',
};

const checkboxStyle: React.CSSProperties = {
  width: '16px',
  height: '16px',
  accentColor: 'var(--macro-calories)',
  cursor: 'pointer',
};
