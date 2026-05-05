import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="layout">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="layout__main">
        <Header onMenuClick={() => setSidebarOpen((prev) => !prev)} />
        <main className="layout__content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
