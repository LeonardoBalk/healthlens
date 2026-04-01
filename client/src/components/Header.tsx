import { ChevronRight, Menu, Moon, Sun } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'

const routeLabels: Record<string, string> = {
  '/': 'Overview',
  '/new': 'Upload',
  '/series': 'Series Temporais',
  '/charts': 'Graficos',
  '/reports': 'Relatorios',
  '/datasets': 'Overview',
  '/datasets/new': 'Upload',
  '/datasets/series': 'Series Temporais',
  '/datasets/charts': 'Graficos',
  '/datasets/reports': 'Relatorios',
}

interface HeaderProps {
  onMenuClick: () => void
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()

  const currentLabel = routeLabels[location.pathname] ?? 'Pagina'

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
