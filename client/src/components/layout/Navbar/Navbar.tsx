import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/Button/Button'
import { Logo } from '@/components/ui/Logo/Logo'
import { useTheme } from '@/contexts/ThemeContext'
import { supabase } from '@/lib/supabase'
import styles from './Navbar.module.scss'

export function Navbar() {
  const { theme, toggleTheme } = useTheme()
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => {
      setAuthenticated(!!data.session)
    })
  }, [])

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
          {authenticated ? (
            <Link to="/datasets" aria-label="Ir para o painel">
              <Button size="sm">Ir para o painel</Button>
            </Link>
          ) : (
            <>
              <Link to="/login" aria-label="Fazer login">
                <Button size="sm" variant="outline">
                  Login
                </Button>
              </Link>
              <Link to="/login" aria-label="Criar conta">
                <Button size="sm">Começar</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
