import React from 'react'
import styles from './Button.module.scss'

const clx = (...classes: (string | undefined | false)[]) => classes.filter(Boolean).join(' ')

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    const baseClass = clx(styles.button, styles[variant], styles[size], className)

    return (
      <button ref={ref} className={baseClass} {...props}>
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
