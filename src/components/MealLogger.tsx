import React, { useState, useRef, useEffect } from 'react';
import { Camera, Image as ImageIcon, Mic, Square, Trash2, Send, Loader2, Plus, AlertCircle } from 'lucide-react';
import { compressImage } from '../utils/helpers';
import { analyzeMealWithGemini } from '../utils/gemini';
import { Waveform } from './Waveform';
import type { FoodItem, MealType } from '../types';

interface MealLoggerProps {
  apiKey: string;
  model: string;
  onAnalysisComplete: (result: {
    meal_type: MealType;
    items: FoodItem[];
    photos: string[];
    notes: string;
  }) => void;
}

export const MealLogger: React.FC<MealLoggerProps> = ({ apiKey, model, onAnalysisComplete }) => {
  const [photos, setPhotos] = useState<string[]>([]);
  const [textNotes, setTextNotes] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Camera states
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Audio/Voice states
  const [isRecording, setIsRecording] = useState(false);
  const [audioBase64, setAudioBase64] = useState<string | undefined>(undefined);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [cameraStream]);

  // Camera Controls
  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // Default to back camera on mobile
        audio: false,
      });
      setCameraStream(stream);
      setShowCamera(true);
      
      // Delay slightly to ensure video element is rendered
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      console.error('Erro ao aceder à câmara:', err);
      setError('Não foi possível aceder à câmara. Por favor, carregue uma foto da galeria.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const photoData = canvas.toDataURL('image/jpeg', 0.8);
        setPhotos((prev) => [...prev, photoData]);
        stopCamera();
      }
    }
  };

  // File Upload Controls
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const compressedBase64 = await compressImage(file, 1024, 0.85);
        setPhotos((prev) => [...prev, compressedBase64]);
      } catch (err) {
        console.error('Erro ao comprimir imagem:', err);
        setError('Ocorreu um erro ao carregar e comprimir a imagem.');
      }
    }
    // Reset file input
    e.target.value = '';
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Audio Controls
  const startRecording = async () => {
    setError(null);
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Convert to base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          setAudioBase64(base64data);
        };
        
        // Stop audio tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Erro ao aceder ao microfone:', err);
      setError('Não foi possível aceder ao microfone para gravação de voz.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const clearAudio = () => {
    setAudioBase64(undefined);
  };

  // Run Analysis
  const handleAnalyze = async () => {
    setError(null);
    
    // Ensure we have at least a photo or text notes or voice note
    if (photos.length === 0 && textNotes.trim() === '' && !audioBase64) {
      setError('Por favor, tire uma foto, grave um áudio ou escreva uma descrição para que possamos analisar.');
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await analyzeMealWithGemini(
        apiKey,
        model,
        photos,
        textNotes,
        audioBase64
      );

      onAnalysisComplete({
        meal_type: result.meal_type,
        items: result.items as FoodItem[],
        photos: photos,
        notes: textNotes,
      });

      // Clear input fields on success
      setTextNotes('');
      setPhotos([]);
      setAudioBase64(undefined);
    } catch (err: any) {
      console.error('Erro de análise:', err);
      setError(err?.message || 'Falha na análise. Verifique a ligação ou a chave API nas definições.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="glass-panel" style={containerStyle}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '14px', color: 'var(--color-text-primary)' }}>
        Registo Inteligente de Refeição
      </h2>

      {error && (
        <div style={errorContainerStyle}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Main capture interface */}
      <div style={mediaControlContainerStyle}>
        
        {/* Webcam stream view */}
        {showCamera ? (
          <div style={cameraContainerStyle}>
            <video ref={videoRef} autoPlay playsInline style={videoStyle} />
            <div style={cameraOverlayControlsStyle}>
              <button onClick={capturePhoto} style={snapButtonStyle}>
                Tirar Foto
              </button>
              <button onClick={stopCamera} style={cancelCameraButtonStyle}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          /* Thumbnail Gallery and Options */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {photos.length > 0 && (
              <div style={galleryGridStyle}>
                {photos.map((photo, index) => (
                  <div key={index} className="glass-card" style={thumbnailContainerStyle}>
                    <img src={photo} alt={`Comida ${index + 1}`} style={thumbnailStyle} />
                    <button onClick={() => removePhoto(index)} style={deleteThumbnailButtonStyle}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                
                {photos.length < 5 && (
                  <button onClick={startCamera} style={addMorePhotosButtonStyle} className="glass-card">
                    <Plus size={20} />
                    <span style={{ fontSize: '0.75rem' }}>+ Foto</span>
                  </button>
                )}
              </div>
            )}

            {photos.length === 0 && (
              <div style={captureButtonsContainerStyle}>
                <button onClick={startCamera} style={actionButtonStyle} className="glass-card">
                  <Camera size={24} style={{ color: 'var(--macro-calories)' }} />
                  <span style={actionButtonTextStyle}>Tirar Foto</span>
                </button>

                <label style={actionButtonStyle} className="glass-card">
                  <ImageIcon size={24} style={{ color: 'var(--macro-carbs)' }} />
                  <span style={actionButtonTextStyle}>Carregar Imagem</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hybrid input - Text Notes and Voice Recording */}
      <div style={textAudioContainerStyle}>
        <div style={inputWrapperStyle}>
          <textarea
            value={textNotes}
            onChange={(e) => setTextNotes(e.target.value)}
            placeholder="Como foi confecionado? (Ex: peito de frango com 1 colher de sopa de azeite e arroz branco)"
            style={textareaStyle}
            disabled={isAnalyzing}
          />
        </div>

        <div style={voiceControlsRowStyle}>
          {isRecording ? (
            <div style={recordingStateStyle}>
              <Waveform isRecording={isRecording} />
              <button onClick={stopRecording} style={stopRecordingButtonStyle}>
                <Square size={16} /> Parar Gravação
              </button>
            </div>
          ) : (
            <div style={voiceButtonsStyle}>
              {audioBase64 ? (
                <div style={audioReadyStyle}>
                  <span style={audioReadyTextStyle}>Nota de voz adicionada</span>
                  <button onClick={clearAudio} style={deleteAudioButtonStyle}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : (
                <button onClick={startRecording} style={recordButtonStyle} disabled={isAnalyzing}>
                  <Mic size={16} /> Gravar Nota de Voz
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Run analysis action button */}
      <button
        onClick={handleAnalyze}
        disabled={isAnalyzing || (photos.length === 0 && textNotes.trim() === '' && !audioBase64)}
        style={isAnalyzing ? analyzingButtonStyle : submitLogButtonStyle}
      >
        {isAnalyzing ? (
          <>
            <Loader2 size={18} className="animate-pulse-slow" style={{ animation: 'spin 1.5s linear infinite' }} />
            <span>A analisar refeição com IA...</span>
          </>
        ) : (
          <>
            <Send size={18} />
            <span>Analisar com IA</span>
          </>
        )}
      </button>
      
      {!apiKey && (
        <p style={demoWarningStyle}>
          ⚠️ A correr no <strong>Modo Demo</strong>. Introduza uma API Key nas Definições para análise real.
        </p>
      )}
    </div>
  );
};

// CSS Styles inline object
const containerStyle: React.CSSProperties = {
  padding: '20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
};

const errorContainerStyle: React.CSSProperties = {
  backgroundColor: 'rgba(239, 68, 68, 0.1)',
  border: '1px solid rgba(239, 68, 68, 0.2)',
  color: '#f87171',
  borderRadius: '12px',
  padding: '12px',
  fontSize: '0.9rem',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  lineHeight: 1.4,
};

const mediaControlContainerStyle: React.CSSProperties = {
  width: '100%',
};

const cameraContainerStyle: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  borderRadius: '16px',
  overflow: 'hidden',
  aspectRatio: '4/3',
  backgroundColor: '#000',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
};

const videoStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};

const cameraOverlayControlsStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '16px',
  left: 0,
  right: 0,
  display: 'flex',
  justifyContent: 'center',
  gap: '12px',
};

const snapButtonStyle: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: '30px',
  border: 'none',
  background: 'var(--macro-calories)',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
};

const cancelCameraButtonStyle: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: '30px',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  background: 'rgba(0,0,0,0.5)',
  color: '#fff',
  fontWeight: 500,
  cursor: 'pointer',
};

const captureButtonsContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: '16px',
};

const actionButtonStyle: React.CSSProperties = {
  flex: 1,
  height: '90px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '8px',
  cursor: 'pointer',
  border: '1px solid var(--border-glass)',
  borderRadius: '16px',
  background: 'rgba(255, 255, 255, 0.01)',
  transition: 'all 0.2s',
};

const actionButtonTextStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 500,
  color: 'var(--color-text-secondary)',
};

const galleryGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
  gap: '10px',
};

const thumbnailContainerStyle: React.CSSProperties = {
  position: 'relative',
  aspectRatio: '1',
  borderRadius: '12px',
  overflow: 'hidden',
};

const thumbnailStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};

const deleteThumbnailButtonStyle: React.CSSProperties = {
  position: 'absolute',
  top: '4px',
  right: '4px',
  background: 'rgba(239, 68, 68, 0.85)',
  color: '#fff',
  border: 'none',
  borderRadius: '50%',
  width: '22px',
  height: '22px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};

const addMorePhotosButtonStyle: React.CSSProperties = {
  aspectRatio: '1',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '4px',
  cursor: 'pointer',
  border: '1px dashed var(--border-glass)',
  borderRadius: '12px',
  background: 'none',
  color: 'var(--color-text-secondary)',
};

const textAudioContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};

const inputWrapperStyle: React.CSSProperties = {
  width: '100%',
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  height: '75px',
  padding: '12px',
  backgroundColor: 'var(--bg-input)',
  border: '1px solid var(--border-glass)',
  borderRadius: '12px',
  outline: 'none',
  fontSize: '0.9rem',
  resize: 'none',
  transition: 'border-color 0.2s',
  lineHeight: 1.4,
};

const voiceControlsRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
};

const recordButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid var(--border-glass)',
  borderRadius: '20px',
  padding: '6px 14px',
  fontSize: '0.85rem',
  fontWeight: 500,
  cursor: 'pointer',
};

const recordingStateStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
  width: '100%',
  justifyContent: 'space-between',
};

const stopRecordingButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  background: 'rgba(239, 68, 68, 0.15)',
  border: '1px solid rgba(239, 68, 68, 0.3)',
  color: '#f87171',
  borderRadius: '20px',
  padding: '6px 14px',
  fontSize: '0.85rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const audioReadyStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  background: 'rgba(16, 185, 129, 0.1)',
  border: '1px solid rgba(16, 185, 129, 0.2)',
  color: '#34d399',
  borderRadius: '20px',
  padding: '6px 14px',
  fontSize: '0.85rem',
  fontWeight: 500,
};

const audioReadyTextStyle: React.CSSProperties = {
  fontSize: '0.8rem',
};

const deleteAudioButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#f87171',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  padding: '2px',
};

const submitLogButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px',
  borderRadius: '12px',
  border: 'none',
  background: 'var(--grad-calories)',
  color: '#fff',
  fontWeight: 600,
  fontSize: '0.95rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  cursor: 'pointer',
  marginTop: '4px',
};

const analyzingButtonStyle: React.CSSProperties = {
  ...submitLogButtonStyle,
  background: 'var(--bg-input)',
  border: '1px solid var(--border-glass)',
  color: 'var(--color-text-secondary)',
  cursor: 'not-allowed',
};

const demoWarningStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: 'var(--macro-fats)',
  textAlign: 'center',
  marginTop: '4px',
};

const voiceButtonsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
};
