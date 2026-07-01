import React from 'react';
import logoUrl from '../assets/logo.png';

export const Logo: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <img 
      src={logoUrl} 
      alt="App Logo" 
      className={`object-contain pointer-events-none select-none ${className || ''}`} 
      draggable={false} 
    />
  );
};
