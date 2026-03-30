interface HealthLensLogoProps {
  size?: number
  className?: string
}

export default function HealthLensLogo({ size = 32, className }: HealthLensLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="HealthLens logo"
    >
      {/* Heart shape */}
      <path
        d="M32 56 C32 56 8 40 8 22 C8 14 14 8 22 8 C26.5 8 30 10.5 32 14 C34 10.5 37.5 8 42 8 C50 8 56 14 56 22 C56 40 32 56 32 56Z"
        fill="url(#heartGrad)"
        opacity="0.9"
      />
      {/* ECG line */}
      <path
        d="M10 32 L22 32 L26 24 L30 40 L34 20 L38 36 L42 32 L54 32"
        stroke="url(#ecgGrad)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <defs>
        <linearGradient id="heartGrad" x1="8" y1="8" x2="56" y2="56">
          <stop offset="0%" stopColor="#4f8ef7" />
          <stop offset="100%" stopColor="#00e5c0" />
        </linearGradient>
        <linearGradient id="ecgGrad" x1="10" y1="32" x2="54" y2="32">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#e8edf5" stopOpacity="0.8" />
        </linearGradient>
      </defs>
    </svg>
  )
}
