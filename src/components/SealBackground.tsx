import React from 'react';

type SealBackgroundProps = {
  variant?: 'light' | 'dark';
  className?: string;
};

export const SealBackground = ({ variant = 'light', className = '' }: SealBackgroundProps) => {
  const accentClass = variant === 'dark' ? 'seal-ui-dark' : 'seal-ui-light';

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`.trim()}
    >
      <div className={`seal-ui-orbit seal-ui-orbit-primary ${accentClass}`} />
      <div className={`seal-ui-orbit seal-ui-orbit-secondary ${accentClass}`} />
      <div className={`seal-ui-glow ${accentClass}`} />
      <div className={`seal-ui-seal ${accentClass}`} />
    </div>
  );
};
