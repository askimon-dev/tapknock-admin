import React from 'react';

interface TapKnockLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
  subtitle?: string;
}

export default function TapKnockLogo({
  size = 36,
  className = '',
  showText = false,
  subtitle,
}: TapKnockLogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        style={{ width: size, height: size }}
        className="relative rounded-xl overflow-hidden shadow-md shadow-brand-600/30 flex-shrink-0 flex items-center justify-center bg-[#1747C9]"
      >
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="100" height="100" rx="22" fill="#1747C9" />
          <path
            d="M28 42C28 29.85 37.85 20 50 20C62.15 20 72 29.85 72 42V80C72 81.1 71.1 82 70 82H30C28.9 82 28 81.1 28 80V42Z"
            fill="#FFFFFF"
          />
          <circle cx="59" cy="50" r="4.5" fill="#1747C9" />
        </svg>
      </div>

      {showText && (
        <div>
          <div className="font-bold text-white tracking-tight text-base flex items-center gap-1.5">
            TapKnock{' '}
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400 border border-brand-500/30">
              Admin
            </span>
          </div>
          {subtitle && <div className="text-[11px] text-slate-400">{subtitle}</div>}
        </div>
      )}
    </div>
  );
}
