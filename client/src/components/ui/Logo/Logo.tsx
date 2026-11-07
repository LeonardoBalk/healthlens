import React from 'react'

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string
}

export function Logo({ size = 32, className, ...props }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="HealthLens logo"
      {...props}
    >
      <path
        d="M 43 4.53 A 46 46 0 0 0 43 95.47 L 43 74 L 33.5 74 L 33.5 79.73 A 34 34 0 0 1 33.5 20.27 L 33.5 26 L 43 26 Z"
        fill="#FF1E42"
      />
      <path
        d="M 57 4.53 A 46 46 0 0 1 57 95.47 L 57 74 L 66.5 74 L 66.5 79.73 A 34 34 0 0 0 66.5 20.27 L 66.5 26 L 57 26 Z"
        fill="#FF1E42"
      />
      <path
        d="M 18.5 66.5 C 24 62.5, 38 53, 50 50 C 62 47, 68 42.5, 76.5 37"
        fill="none"
        stroke="#FF1E42"
        strokeWidth="5.2"
        strokeLinecap="round"
      />
      <circle cx="27" cy="61" r="6.5" fill="#FF1E42" />
      <circle cx="50" cy="50" r="6.8" fill="#FF1E42" />
      <circle cx="73" cy="39" r="6.5" fill="#FF1E42" />
    </svg>
  )
}
