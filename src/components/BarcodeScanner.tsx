import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X } from 'lucide-react';

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScanSuccess, onClose }) => {
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const scannerId = "barcode-scanner-viewport";

  useEffect(() => {
    let active = true;
    let scannerInstance: Html5Qrcode | null = null;

    const startCameraScan = async () => {
      try {
        const element = document.getElementById(scannerId);
        if (!element) return;

        scannerInstance = new Html5Qrcode(scannerId);
        html5QrCodeRef.current = scannerInstance;

        const config = {
          fps: 15, // Faster frame acquisition rate
          qrbox: { width: 220, height: 100 }, // Bounding box matching the card aspect ratio
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
        };

        const onDecoded = (decodedText: string) => {
          if (navigator.vibrate) {
            try {
              navigator.vibrate([200]);
            } catch (vibrateErr) {
              console.warn("Vibration failed:", vibrateErr);
            }
          }
          onScanSuccess(decodedText);
        };

        const onScanError = () => {};

        try {
          await scannerInstance.start(
            { facingMode: { exact: "environment" } },
            config,
            onDecoded,
            onScanError
          );
          if (active) setIsScanning(true);
        } catch (firstErr) {
          console.warn("Failed to force exact environment camera, fallback...", firstErr);
          if (!active) return;
          try {
            await scannerInstance.start(
              { facingMode: "environment" },
              config,
              onDecoded,
              onScanError
            );
            if (active) setIsScanning(true);
          } catch (secondErr) {
            console.error("Failed to start fallback camera scanner:", secondErr);
          }
        }

        // Apply playsinline and ensure object-fit: cover for the video feed inside the card container
        let attempts = 0;
        const interval = setInterval(() => {
          attempts++;
          const container = document.getElementById(scannerId);
          const video = container?.querySelector('video');
          if (video) {
            video.setAttribute('playsinline', 'true');
            video.setAttribute('webkit-playsinline', 'true');
            video.setAttribute('autoplay', 'true');
            video.setAttribute('muted', 'true');
            video.setAttribute('controls', 'false');
            video.style.objectFit = 'cover';
            video.style.width = '100%';
            video.style.height = '100%';
            video.play().catch(e => console.warn("Video auto-play failed/blocked on iOS:", e));
            clearInterval(interval);
          }
          if (attempts > 60) {
            clearInterval(interval);
          }
        }, 50);

      } catch (err) {
        console.error("Erro ao inicializar scanner:", err);
      }
    };

    const timeout = setTimeout(() => {
      if (active) {
        startCameraScan();
      }
    }, 150);

    return () => {
      active = false;
      clearTimeout(timeout);
      
      if (scannerInstance) {
        if (scannerInstance.isScanning) {
          scannerInstance.stop()
            .then(() => {
              console.log("Scanner parado e stream de camera libertado.");
            })
            .catch(err => {
              console.error("Erro ao fechar scanner e libertar camera:", err);
            });
        }
      }
    };
  }, [onScanSuccess]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (barcodeInput.trim()) {
      onScanSuccess(barcodeInput.trim());
    }
  };

  return (
    <div style={overlayStyle}>
      <div className="glass-panel animate-pulse-slow" style={containerStyle}>
        
        {/* Header Title & Close Button */}
        <div style={headerStyle}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', margin: 0 }}>
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

        {/* Centered Small Viewfinder Card */}
        <div style={viewfinderWrapperStyle}>
          <div id={scannerId} style={cameraViewportStyle} />
          
          {/* Glowing laser line animation */}
          <div className="scanner-laser-line" style={{ top: '50%' }} />

          {/* Bounding box brackets */}
          <div className="scanner-corner scanner-corner-tl" />
          <div className="scanner-corner scanner-corner-tr" />
          <div className="scanner-corner scanner-corner-bl" />
          <div className="scanner-corner scanner-corner-br" />
        </div>

        <p style={instructionsStyle}>
          {!isScanning ? 'A ligar a câmara...' : 'Aponte para o código de barras do produto'}
        </p>

        {/* Horizontal Divider */}
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
            placeholder="Código de barras"
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={!barcodeInput.trim()}
            style={submitButtonStyle}
          >
            Procurar
          </button>
        </form>

      </div>
    </div>
  );
};

// CSS Styles for Popover layout
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

const viewfinderWrapperStyle: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '140px',
  borderRadius: '12px',
  overflow: 'hidden',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  backgroundColor: '#000',
};

const cameraViewportStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
};

const instructionsStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--color-text-secondary)',
  textAlign: 'center',
  margin: 0,
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
