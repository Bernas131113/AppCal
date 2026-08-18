import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, AlertCircle, Loader2 } from 'lucide-react';

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScanSuccess, onClose }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'processing' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const hiddenReaderId = "hidden-file-barcode-reader";

  // Automatically trigger the device camera file picker on mount
  useEffect(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus('processing');
    setErrorMessage('');

    try {
      // Create a static reader instance
      const html5QrCode = new Html5Qrcode(hiddenReaderId, {
        verbose: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.QR_CODE
        ]
      });

      // Statically scan the photo captured by the native high-quality camera
      const decodedText = await html5QrCode.scanFile(file, false);
      
      // Haptic/tactile vibration feedback on success
      if (navigator.vibrate) {
        try { navigator.vibrate([200]); } catch (vErr) {}
      }
      
      onScanSuccess(decodedText);
    } catch (err: any) {
      console.warn("Falha ao descodificar imagem do código de barras:", err);
      setStatus('error');
      setErrorMessage(
        'Não foi possível detetar o código de barras nesta foto. Certifique-se de que a imagem está focada, bem iluminada e repita o processo, ou digite o código de barras manualmente abaixo.'
      );
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (barcodeInput.trim()) {
      onScanSuccess(barcodeInput.trim());
    }
  };

  const triggerCamera = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div style={overlayStyle}>
      {/* Hidden element bound by Html5Qrcode */}
      <div id={hiddenReaderId} style={{ display: 'none' }} />

      {/* Hidden native camera trigger file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <div className="glass-panel animate-pulse-slow" style={containerStyle}>
        
        {/* Header */}
        <div style={headerStyle}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', margin: 0 }}>
            Leitor de Código de Barras
          </h3>
          <button 
            type="button" 
            onClick={onClose} 
            style={closeButtonStyle}
            title="Fechar leitor"
          >
            <X size={16} />
          </button>
        </div>

        {/* View States */}
        {status === 'idle' && (
          <div style={centerBoxStyle} onClick={triggerCamera}>
            <Camera size={36} style={{ color: 'var(--macro-calories)', marginBottom: '8px' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>
              Tirar Foto ao Código de Barras
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: '4px', textAlign: 'center' }}>
              Toque aqui para abrir a câmara do iPhone e tirar uma foto focada ao código de barras.
            </span>
          </div>
        )}

        {status === 'processing' && (
          <div style={centerBoxStyle}>
            <Loader2 size={36} className="animate-spin" style={{ color: 'var(--macro-calories)', marginBottom: '8px' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>
              A processar imagem...
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              A ler dados do código de barras da fotografia.
            </span>
          </div>
        )}

        {status === 'error' && (
          <div style={errorBoxStyle}>
            <AlertCircle size={24} style={{ color: '#f87171', marginBottom: '6px', flexShrink: 0 }} />
            <p style={{ fontSize: '0.75rem', color: '#f87171', margin: 0, textAlign: 'center', lineHeight: 1.3 }}>
              {errorMessage}
            </p>
            <button 
              type="button" 
              onClick={triggerCamera} 
              style={retryButtonStyle}
            >
              <Camera size={14} />
              <span>Tirar outra foto</span>
            </button>
          </div>
        )}

        {/* Divider */}
        <div style={dividerStyle}>
          <div style={lineStyle} />
          <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', fontWeight: 600 }}>ou manual</span>
          <div style={lineStyle} />
        </div>

        {/* Manual Barcode Input Fallback */}
        <form onSubmit={handleManualSubmit} style={formStyle}>
          <input
            type="number"
            pattern="[0-9]*"
            inputMode="numeric"
            placeholder="Introduza o código manualmente"
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            style={inputStyle}
            disabled={status === 'processing'}
          />
          <button
            type="submit"
            disabled={!barcodeInput.trim() || status === 'processing'}
            style={submitButtonStyle}
          >
            Procurar
          </button>
        </form>

      </div>
    </div>
  );
};

// CSS popover styles
const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.75)',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10005,
  padding: '20px',
};

const containerStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '320px',
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  borderRadius: '20px',
  boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
  border: '1px solid var(--border-glass)',
  background: 'rgba(15, 23, 42, 0.98)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingBottom: '2px',
};

const closeButtonStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.08)',
  border: 'none',
  borderRadius: '50%',
  width: '28px',
  height: '28px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#fff',
  cursor: 'pointer',
  transition: 'all 0.2s',
};

const centerBoxStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px 16px',
  borderRadius: '12px',
  border: '1px dashed rgba(255, 255, 255, 0.15)',
  backgroundColor: 'rgba(255, 255, 255, 0.02)',
  cursor: 'pointer',
};

const errorBoxStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '14px',
  borderRadius: '12px',
  border: '1px solid rgba(239, 68, 68, 0.2)',
  backgroundColor: 'rgba(239, 68, 68, 0.05)',
};

const retryButtonStyle: React.CSSProperties = {
  marginTop: '10px',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 12px',
  borderRadius: '8px',
  border: 'none',
  background: 'rgba(255,255,255,0.08)',
  color: '#fff',
  fontSize: '0.75rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const dividerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const lineStyle: React.CSSProperties = {
  flex: 1,
  height: '1px',
  background: 'rgba(255, 255, 255, 0.1)',
};

const formStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '10px 14px',
  backgroundColor: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '10px',
  fontSize: '16px',
  color: '#fff',
  outline: 'none',
};

const submitButtonStyle: React.CSSProperties = {
  padding: '0 16px',
  borderRadius: '10px',
  border: 'none',
  background: 'var(--macro-calories)',
  color: '#fff',
  fontSize: '0.85rem',
  fontWeight: 700,
  cursor: 'pointer',
};
