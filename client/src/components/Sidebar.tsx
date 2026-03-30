import { useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Activity, BarChart3, FileText } from 'lucide-react'
import HealthLensLogo from './HealthLensLogo'

const navItems = [
  { path: '/', label: 'Overview', icon: LayoutDashboard },
  { path: '/series', label: 'Séries Temporais', icon: Activity },
  { path: '/charts', label: 'Gráficos', icon: BarChart3 },
  { path: '/reports', label: 'Relatórios', icon: FileText },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()

  const handleNav = (path: string) => {
    navigate(path)
    onClose()
  }

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'sidebar--open' : ''}`}>
        <div className="sidebar__logo">
          <HealthLensLogo size={28} />
        </div>

        <nav className="sidebar__nav">
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive = path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(path)

            return (
              <button
                key={path}
                className={`sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}
                onClick={() => handleNav(path)}
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
