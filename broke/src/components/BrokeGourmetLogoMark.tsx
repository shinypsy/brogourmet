/**
 * 브랜드 마크: 제공 이미지 1(금색 크레스트·다크 배경)을 웹용으로 단순화한 SVG.
 * 히어로 PNG는 public/brand/broke-gourmet-hero.png — 로드 실패 시 이 SVG+워드마크로 대체.
 */
export function BrokeGourmetLogoMark({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 220"
      fill="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="bg-shield" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2a1810" />
          <stop offset="100%" stopColor="#1a0f0c" />
        </linearGradient>
        <linearGradient id="gold" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f0dfa8" />
          <stop offset="50%" stopColor="#c9a227" />
          <stop offset="100%" stopColor="#8a6b1a" />
        </linearGradient>
      </defs>
      <path
        d="M100 8 L168 38 V108 C168 158 140 188 100 208 C60 188 32 158 32 108 V38 Z"
        fill="url(#bg-shield)"
        stroke="url(#gold)"
        strokeWidth="2.5"
      />
      <path
        d="M100 42 L118 88 L168 92 L130 124 L142 172 L100 146 L58 172 L70 124 L32 92 L82 88 Z"
        fill="none"
        stroke="url(#gold)"
        strokeWidth="1.8"
        opacity={0.35}
      />
      <text
        x="100"
        y="118"
        textAnchor="middle"
        fill="url(#gold)"
        fontFamily="Cinzel, Georgia, serif"
        fontSize="52"
        fontWeight="700"
      >
        G
      </text>
      <path
        d="M72 78 L72 132 M128 78 L128 132"
        stroke="url(#gold)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M78 100 L122 100" stroke="url(#gold)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

export function BrokeGourmetWordmark({ className = '' }: { className?: string }) {
  return (
    <div className={className}>
      <p className="broke-wordmark__main">BROKE</p>
      <p className="broke-wordmark__sub">GOURMET</p>
      <p className="broke-wordmark__tag">ELEVATED EATS</p>
    </div>
  )
}
