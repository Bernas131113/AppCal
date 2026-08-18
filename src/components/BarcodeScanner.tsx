import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
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
          fps: 10,
          qrbox: (width: number, height: number) => {
            return { 
              width: Math.min(width * 0.85, 240), 
              height: Math.min(height * 0.4, 100) 
            };
          }
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
          console.warn("Failed to force exact environment back camera, trying fallback...", firstErr);
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
    <div className="scanner-overlay-fullscreen">
      <div id={scannerId} className="scanner-camera-container" />
      
      <div className="scanner-mask-overlay">
        <div className="scanner-cutout-window">
          <div className="scanner-laser-line" />
          <div className="scanner-corner scanner-corner-tl" />
          <div className="scanner-corner scanner-corner-tr" />
          <div className="scanner-corner scanner-corner-bl" />
          <div className="scanner-corner scanner-corner-br" />
        </div>
      </div>
      
      <button 
        type="button" 
        onClick={onClose} 
        className="scanner-close-btn"
        title="Cancelar Leitura"
      >
        <span>
          <X size={20} />
        </span>
      </button>
      
      <div className="scanner-bottom-panel">
        <p className="scanner-instruction" style={{ color: '#fff', textAlign: 'center', fontSize: '0.85rem', margin: '0 0 12px 0' }}>
          {!isScanning ? 'A aceder à câmara...' : 'Aponte para o código de barras do produto'}
        </p>

        <div className="scanner-divider" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', marginBottom: '12px' }}>
          <div className="scanner-divider-line" style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.15)' }} />
          <span>ou insira manualmente</span>
          <div className="scanner-divider-line" style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.15)' }} />
        </div>

        <form onSubmit={handleManualSubmit} className="scanner-manual-input-row">
          <input
            type="number"
            pattern="[0-9]*"
            inputMode="numeric"
            placeholder="Ex: 5601234567890"
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            className="scanner-manual-input"
          />
          <button
            type="submit"
            disabled={!barcodeInput.trim()}
            className="scanner-manual-submit-btn"
          >
            Procurar
          </button>
        </form>
      </div>
    </div>
  );
};
