import React from "react";

type SiagaKitaLogoProps = {
  size?: number;
  showWordmark?: boolean;
  className?: string;
  animated?: boolean;
};

export default function SiagaKitaLogo({
  size = 40,
  showWordmark = false,
  className = "",
  animated = false,
}: SiagaKitaLogoProps) {
  return (
    <span className={`siagakita-logo ${className}`}>
      <svg
        aria-hidden="true"
        className={animated ? "siagakita-logo-svg siagakita-logo-svg-animated" : "siagakita-logo-svg"}
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M24 3.5 40 9v12.2c0 10.4-6.3 18.9-16 23.3-9.7-4.4-16-12.9-16-23.3V9L24 3.5Z"
          fill="#188B68"
        />
        <path
          d="M24 8.2 35.5 12v9.1c0 7.7-4.2 14.1-11.5 18-7.3-3.9-11.5-10.3-11.5-18V12L24 8.2Z"
          fill="#102A43"
        />
        <path
          d="M24 14.2c-5.3 0-9.5 4.1-9.5 9.2 0 6.3 9.5 13.2 9.5 13.2s9.5-6.9 9.5-13.2c0-5.1-4.2-9.2-9.5-9.2Z"
          fill="white"
        />
        <circle cx="24" cy="23.4" r="3.3" fill="#188B68" />
        <path
          d="M17.2 12.8 20 15.6l-2.8 2.8 2.8 2.8-2.8 2.8 2.8 2.8M30.8 12.8 28 15.6l2.8 2.8-2.8 2.8 2.8 2.8-2.8 2.8"
          stroke="#8EE5C2"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showWordmark && (
        <span className="siagakita-wordmark">
          siaga<span>kita</span>
        </span>
      )}
    </span>
  );
}
