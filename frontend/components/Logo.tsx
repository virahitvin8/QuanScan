import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md' }) => {
  const iconSize = size === 'lg' ? 56 : size === 'md' ? 40 : 32;
  const textClass = size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-xl' : 'text-base';

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* SVG Icon */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 56 56"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        style={{ filter: 'drop-shadow(0 4px 12px rgba(0,194,168,0.35))' }}
      >
        <defs>
          <linearGradient id="logoGrad1" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00C2A8" />
            <stop offset="100%" stopColor="#8C7CFF" />
          </linearGradient>
          <linearGradient id="logoGrad2" x1="56" y1="0" x2="0" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF7A59" />
            <stop offset="100%" stopColor="#00C2A8" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background rounded rect */}
        <rect width="56" height="56" rx="14" fill="url(#logoGrad1)" />

        {/* Scanner frame corners */}
        <path d="M10 10 L10 18 M10 10 L18 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
        <path d="M46 10 L38 10 M46 10 L46 18" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
        <path d="M10 46 L10 38 M10 46 L18 46" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
        <path d="M46 46 L38 46 M46 46 L46 38" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />

        {/* Center QS monogram */}
        <text x="28" y="32" textAnchor="middle" fontFamily="Arial Black, sans-serif" fontWeight="900" fontSize="17" fill="white" letterSpacing="-1">QS</text>

        {/* Horizontal laser scan line */}
        <rect x="10" y="27" width="36" height="2.5" rx="1.25" fill="url(#logoGrad2)" filter="url(#glow)" opacity="0.85" />

        {/* Count badge circle */}
        <circle cx="44" cy="12" r="7" fill="#FF7A59" stroke="white" strokeWidth="1.5" />
        <text x="44" y="15.5" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="8" fill="white">AI</text>
      </svg>

      {/* Text */}
      <div>
        <h1 className={`font-black tracking-tight leading-none ${textClass}`}>
          <span className="text-[#123A34]">QUAN</span>
          <span className="text-[#00C2A8]"> SCAN</span>
        </h1>
        {size !== 'sm' && (
          <p className="text-[9px] font-bold tracking-widest uppercase mt-0.5 text-[#00A389]">
            AI Quantity Counter
          </p>
        )}
      </div>
    </div>
  );
};
