import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout() {
  return (
    <div className="layout">
      <Sidebar />
      <div className="layout__main">
        <main className="layout__content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
