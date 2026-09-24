import React from 'react';

/** Tren Dünyası'ndaki Hangar bölümünün simgesi: kapısından gülümseyen tren bakan kemerli hangar. */
export const HangarIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
    {/* çatı ve gövde */}
    <path d="M6 30 C6 14 18 6 32 6 C46 6 58 14 58 30 V56 H6 Z" fill="#f59e0b" />
    <path d="M10 31 C10 17 20 10 32 10 C44 10 54 17 54 31 V56 H10 Z" fill="#fde7b0" />
    {/* çatı çizgileri */}
    <path d="M14 22 H50 M11 28 H53" stroke="#f2c46b" strokeWidth="2" strokeLinecap="round" />
    {/* kapı */}
    <path d="M17 56 V38 C17 33 21 30 26 30 H38 C43 30 47 33 47 38 V56 Z" fill="#0b6e78" />
    {/* tren yüzü */}
    <rect x="21" y="36" width="22" height="18" rx="6" fill="#16a34a" />
    <rect x="24" y="33" width="6" height="5" rx="1.5" fill="#0e7a35" />
    <circle cx="27.5" cy="43" r="2.2" fill="#16323a" />
    <circle cx="36.5" cy="43" r="2.2" fill="#16323a" />
    <circle cx="28.2" cy="42.3" r="0.7" fill="#fff" />
    <circle cx="37.2" cy="42.3" r="0.7" fill="#fff" />
    <path d="M28 48 Q32 51.5 36 48" stroke="#16323a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    <circle cx="24.5" cy="47" r="1.6" fill="#f9a8a8" opacity=".8" />
    <circle cx="39.5" cy="47" r="1.6" fill="#f9a8a8" opacity=".8" />
    {/* bayrak */}
    <path d="M32 6 V0.5" stroke="#16323a" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M32 1 L39 3 L32 5 Z" fill="#7c3aed" />
    {/* zemin */}
    <rect x="4" y="55" width="56" height="4" rx="2" fill="#0e9aa7" />
  </svg>
);
