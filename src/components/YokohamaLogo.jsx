import React from 'react';

export function YokohamaLogo({ className = 'w-7 h-7', rounded = 'rounded-lg' }) {
  return (
    <div
      className={`relative flex items-center justify-center shrink-0 ${rounded} overflow-hidden shadow-2xs ${className}`}
      style={{ backgroundColor: '#E60012' }}
      title="Yokohama CTC"
    >
      <svg
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full p-1"
      >
        {/* Dynamic Stylized Yokohama Lettermark */}
        <path
          d="M7 6L14.5 18V30H21.5V18L29 6H22.5L18 14.2L13.5 6H7Z"
          fill="#FFFFFF"
        />
        {/* Speed accent stripe */}
        <path
          d="M9.5 7.5L15.6 17.5H18.8L12.8 7.5H9.5Z"
          fill="#FFFFFF"
          opacity="0.3"
        />
      </svg>
    </div>
  );
}

export default YokohamaLogo;
