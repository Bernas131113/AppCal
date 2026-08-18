import React from 'react';

interface WaveformProps {
  isRecording: boolean;
}

export const Waveform: React.FC<WaveformProps> = ({ isRecording }) => {
  if (!isRecording) return null;

  return (
    <div className="waveform-container" style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '32px' }}>
      {Array.from({ length: 12 }).map((_, i) => {
        // Generate random durations and delays for a realistic waveform look
        const duration = 0.5 + Math.random() * 0.8;
        const delay = Math.random() * 0.5;
        return (
          <div
            key={i}
            className="waveform-bar"
            style={{
              width: '4px',
              backgroundColor: 'var(--macro-protein)',
              borderRadius: '4px',
              animation: `wave ${duration}s ease-in-out infinite alternate`,
              animationDelay: `${delay}s`,
            }}
          />
        );
      })}
    </div>
  );
};
