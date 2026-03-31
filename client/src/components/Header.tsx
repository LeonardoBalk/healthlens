import { useLocation } from 'react-router-dom'
import { Sun, Moon, Menu, ChevronRight } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

const routeLabels: Record<string, string> = {
  '/app': 'Overview',
  '/app/series': 'Séries Temporais',
  '/app/charts': 'Gráficos',
  '/app/reports': 'Relatórios',
}

interface HeaderProps {
  onMenuClick: () => void
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()

  const fallbackLabel =
    location.pathname
      .split('/')
      .filter(Boolean)
      .pop()
      ?.replace(/^./, (str) => str.toUpperCase()) || 'Página'

  const currentLabel = routeLabels[location.pathname] ?? fallbackLabel

  return (
    <header className="header">
      <div className="header__left">
        <button className="header__menu-btn" onClick={onMenuClick} aria-label="Abrir menu">
          <Menu size={20} />
        </button>

        <nav className="header__breadcrumb" aria-label="Breadcrumb">
          <span className="header__breadcrumb-root">HealthLens</span>
          <ChevronRight size={14} className="header__breadcrumb-sep" />
          <span className="header__breadcrumb-current">{currentLabel}</span>
        </nav>
      </div>

      <div className="header__right">
        <button
          className="header__theme-btn"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  )
}
