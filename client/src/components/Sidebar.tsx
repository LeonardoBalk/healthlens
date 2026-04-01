import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Activity,
  BarChart3,
  FileText,
  Database,
  Settings,
  User,
  ChevronRight,
  ChevronLeft,
  Moon,
  Sun,
} from 'lucide-react'
import { Logo } from '@/components/ui/Logo/Logo'
import { useTheme } from '@/contexts/ThemeContext'

const navItems = [
  { key: 'overview', path: '/', label: 'Overview', icon: LayoutDashboard },
  { key: 'datasets', path: '/list', label: 'Meus Datasets', icon: Database },
  { key: 'series', path: '/series', label: 'Series Temporais', icon: Activity },
  { key: 'charts', path: '/charts', label: 'Graficos', icon: BarChart3 },
  { key: 'reports', path: '/reports', label: 'Relatorios', icon: FileText },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()

  const navBase = location.pathname.startsWith('/datasets') ? '/datasets' : ''

  const handleNav = (path: string) => {
    void navigate(path)
    onClose()
  }

  const handleGoToLanding = () => {
    void navigate('/')
    onClose()
  }

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside
        className={`sidebar ${open ? 'sidebar--open' : ''} ${isExpanded ? 'sidebar--expanded' : ''}`}
      >
        <button
          className="sidebar__toggle"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-label={isExpanded ? 'Recolher menu' : 'Expandir menu'}
        >
          {isExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>

        <div className="sidebar__logo">
          <button
            type="button"
            className="sidebar__logo-btn"
            onClick={handleGoToLanding}
            aria-label="Ir para landing page"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Logo size={28} />
            <span className="sidebar__logo-text">
              <span className="font-bold text-xl" style={{ color: 'var(--color-text-primary)' }}>
                Health
              </span>
              <span className="font-bold text-xl" style={{ color: 'var(--color-primary)' }}>
                Lens
              </span>
            </span>
          </button>
        </div>

        <nav className="sidebar__nav">
          {navItems.map(({ key, path, label, icon: Icon }) => {
            const fullPath = `${navBase}${path === '/' ? '' : path}` || '/'
            const isActive =
              fullPath === '/' || fullPath === '/datasets'
                ? location.pathname === fullPath || location.pathname === `${fullPath}/`
                : location.pathname === fullPath || location.pathname.startsWith(`${fullPath}/`)

            return (
              <button
                key={key}
                className={`sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}
                onClick={() => handleNav(fullPath)}
                title={!isExpanded ? label : undefined}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} className="sidebar__icon" />
                <span className="sidebar__label">{label}</span>
              </button>
            )
          })}
        </nav>

        <div className="sidebar__bottom">
          <button
            className="sidebar__item"
            onClick={toggleTheme}
            title={!isExpanded ? (theme === 'dark' ? 'Modo Claro' : 'Modo Escuro') : undefined}
          >
            {theme === 'dark' ? (
              <Sun size={22} strokeWidth={1.8} className="sidebar__icon" />
            ) : (
              <Moon size={22} strokeWidth={1.8} className="sidebar__icon" />
            )}
            <span className="sidebar__label">
              {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
            </span>
          </button>
          <button className="sidebar__item" title={!isExpanded ? 'Configurações' : undefined}>
            <Settings size={22} strokeWidth={1.8} className="sidebar__icon" />
            <span className="sidebar__label">Configurações</span>
          </button>
          <button className="sidebar__item" title={!isExpanded ? 'Perfil' : undefined}>
            <User size={22} strokeWidth={1.8} className="sidebar__icon" />
            <span className="sidebar__label">Perfil</span>
          </button>
        </div>
      </aside>
    </>
  )
}
