import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Activity,
  BarChart3,
  FileText,
  Settings,
  User,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react'
import { Logo } from '@/components/ui/Logo/Logo'

const navItems = [
  { path: '/app', label: 'Overview', icon: LayoutDashboard },
  { path: '/app/series', label: 'Séries Temporais', icon: Activity },
  { path: '/app/charts', label: 'Gráficos', icon: BarChart3 },
  { path: '/app/reports', label: 'Relatórios', icon: FileText },
]

export default function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <aside className={`sidebar ${isExpanded ? 'sidebar--expanded' : ''}`}>
      <button
        className="sidebar__toggle"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-label={isExpanded ? 'Recolher menu' : 'Expandir menu'}
      >
        {isExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      <div className="sidebar__logo">
        <Logo size={28} />
        <span className="sidebar__logo-text">
          <span className="font-bold text-xl text-primary">Health</span>
          <span className="font-bold text-xl text-accent">Lens</span>
        </span>
      </div>

      <nav className="sidebar__nav">
        {navItems.map(({ path, label, icon: Icon }) => {
          const isActive =
            path === '/app' ? location.pathname === '/app' : location.pathname.startsWith(path)

          return (
            <button
              key={path}
              className={`sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}
              onClick={() => void navigate(path)}
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
  )
}
