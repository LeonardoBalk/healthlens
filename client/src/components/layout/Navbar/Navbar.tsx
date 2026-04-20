import { Link } from 'react-router-dom'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/Button/Button'
import { Logo } from '@/components/ui/Logo/Logo'
import { useTheme } from '@/contexts/ThemeContext'
import styles from './Navbar.module.scss'

export function Navbar() {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className={styles.navbar}>
      <div className={styles.navContainer}>
        <div className={styles.logo}>
          <Logo size={32} />
          <span className={styles.brandText}>
            <span className={styles.brandHealth}>Health</span>
            <span className={styles.brandLens}>Lens</span>
          </span>
        </div>

        <nav className={styles.navLinks} aria-label="Navegação principal"></nav>

        <div className={styles.navActions}>
          <button
            type="button"
            className={styles.themeToggle}
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <Link to="/login" aria-label="Ir para login">
            <Button size="sm" variant="outline">
              Login
            </Button>
          </Link>
          <Link to="/datasets" aria-label="Ir para datasets">
            <Button size="sm">Começar</Button>
          </Link>
        </div>
      </div>
    </header>
  )
}
