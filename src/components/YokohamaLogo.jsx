import React from 'react';
import logoImg from '../assets/yokohama-logo.png';

export function YokohamaLogo({ className = 'h-6 w-auto', alt = 'Yokohama' }) {
  return (
    <img
      src={logoImg}
      alt={alt}
      className={`object-contain shrink-0 select-none ${className}`}
      title="Yokohama"
    />
  );
}

export default YokohamaLogo;
