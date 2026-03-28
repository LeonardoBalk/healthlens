import React from 'react'

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string
}

export function Logo({ size = 32, className, ...props }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 170"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id="heartGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FF2D55" />
          <stop offset="100%" stopColor="#FF6482" />
        </linearGradient>
        <mask id="pulseMask">
          <rect width="200" height="170" fill="white" />
          <polyline
            points="0,86 36,86 52,58 72,114 86,70 96,94 108,82 126,86 200,86"
            fill="none"
            stroke="black"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </mask>
      </defs>
      <path
        d="M100,160 C100,160 4,96 4,42 C4,18 22,0 46,0 C66,0 84,12 100,32 C116,12 134,0 154,0 C178,0 196,18 196,42 C196,96 100,160 100,160Z"
        fill="url(#heartGrad)"
        mask="url(#pulseMask)"
      />
    </svg>
  )
}
