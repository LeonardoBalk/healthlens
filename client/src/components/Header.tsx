import { ChevronRight, Menu, Moon, Sun } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'

const routeLabels: Record<string, string> = {
  '/': 'Painel Epidemiológico',
  '/list': 'Meus Datasets',
  '/new': 'Upload Epidemiológico',
  '/series': 'Séries Temporais',
  '/charts': 'Gráficos',
  '/reports': 'Relatórios Epidemiológicos',
  '/datasets': 'Painel Epidemiológico',
  '/datasets/list': 'Meus Datasets',
  '/datasets/new': 'Upload Epidemiológico',
  '/datasets/series': 'Séries Temporais',
  '/datasets/charts': 'Gráficos',
  '/datasets/reports': 'Relatórios Epidemiológicos',
  '/datasets/settings': 'Configurações',
  '/datasets/profile': 'Perfil',
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
