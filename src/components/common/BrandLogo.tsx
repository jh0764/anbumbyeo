import React from 'react';

interface BrandLogoProps {
  className?: string;
  size?: number;
}

export default function BrandLogo({ className = 'w-8 h-8', size = 32 }: BrandLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* 1. 모서리가 둥근 아스팔트 차콜 사각 주차 표지판 */}
      <rect
        x="1.5"
        y="1.5"
        width="27"
        height="27"
        rx="6.5"
        fill="#1E293B"
        stroke="#334155"
        strokeWidth="1.2"
      />

      {/* 2. 주차 P 볼드 타이포그래피 */}
      <path
        d="M9.5 8H16C18.6 8 20.5 9.6 20.5 12C20.5 14.4 18.6 16 16 16H12.5V22H9.5V8ZM12.5 10.6V13.4H15.6C16.8 13.4 17.5 12.8 17.5 12C17.5 11.2 16.8 10.6 15.6 10.6H12.5Z"
        fill="#FFFFFF"
      />

      {/* 3. 우측 하단 자동차 실루엣 오버레이 (화이트 외곽선 + 다크 차콜 바디) */}
      <g filter="drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.3))">
        {/* 외곽선 컷아웃 (표지판과 자연스러운 분리감) */}
        <path
          d="M19 26.5L20.8 21.2C21.2 20 22.3 19.2 23.6 19.2H30.4C31.7 19.2 32.8 20 33.2 21.2L35 26.5C35.6 26.9 36 27.6 36 28.5V32C36 32.6 35.5 33 35 33H34C33.4 33 33 32.6 33 32V31H21V32C21 32.6 20.6 33 20 33H19C18.4 33 18 32.6 18 32V28.5C18 27.6 18.4 26.9 19 26.5Z"
          fill="#FFFFFF"
        />

        {/* 자동차 본체 (다크 아스팔트 차콜) */}
        <path
          d="M19.8 26.8L21.4 22C21.7 21.1 22.5 20.5 23.5 20.5H30.5C31.5 20.5 32.3 21.1 32.6 22L34.2 26.8C34.7 27.1 35 27.7 35 28.5V31.5C35 31.8 34.8 32 34.5 32H33.8C33.5 32 33.2 31.8 33.2 31.5V30H20.8V31.5C20.8 31.8 20.5 32 20.2 32H19.5C19.2 32 19 31.8 19 31.5V28.5C19 27.7 19.3 27.1 19.8 26.8Z"
          fill="#0F172A"
        />

        {/* 자동차 전면 유리창 (화이트) */}
        <path
          d="M22.2 22.2L21.5 24.8H32.5L31.8 22.2C31.6 21.5 31 21 30.2 21H23.8C23 21 22.4 21.5 22.2 22.2Z"
          fill="#FFFFFF"
        />

        {/* 좌우 헤드라이트 (화이트) */}
        <rect x="20.5" y="27.5" width="2.2" height="1.4" rx="0.7" fill="#FFFFFF" />
        <rect x="31.3" y="27.5" width="2.2" height="1.4" rx="0.7" fill="#FFFFFF" />

        {/* 하단 그릴 바 */}
        <rect x="24.5" y="28.2" width="5" height="0.8" rx="0.4" fill="#64748B" />
      </g>
    </svg>
  );
}
