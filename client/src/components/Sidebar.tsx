import { useLocation, useNavigate } from 'react-router-dom'
import { Activity, BarChart3, FileText, LayoutDashboard } from 'lucide-react'
import HealthLensLogo from './HealthLensLogo'

const navItems = [
  { key: 'overview', path: '/', label: 'Overview', icon: LayoutDashboard },
  { key: 'series', path: '/series', label: 'Séries Temporais', icon: Activity },
  { key: 'charts', path: '/charts', label: 'Gráficos', icon: BarChart3 },
  { key: 'reports', path: '/reports', label: 'Relatórios', icon: FileText },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
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
      <aside className={`sidebar ${open ? 'sidebar--open' : ''}`}>
        <div className="sidebar__logo">
          <button
            type="button"
            className="sidebar__logo-btn"
            onClick={handleGoToLanding}
            aria-label="Ir para landing page"
          >
            <HealthLensLogo size={28} />
          </button>
        </div>

        <nav className="sidebar__nav">
          {navItems.map(({ key, path, label, icon: Icon }) => {
            const fullPath = `${navBase}${path === '/' ? '' : path}` || '/'
            const isActive =
              fullPath === '/'
                ? location.pathname === '/'
                : location.pathname === fullPath || location.pathname.startsWith(`${fullPath}/`)

            return (
              <button
                key={key}
                className={`sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}
                onClick={() => handleNav(fullPath)}
                title={label}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                <span className="sidebar__label">{label}</span>
              </button>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
