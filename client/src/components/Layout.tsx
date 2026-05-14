import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import ChatWidget from './chat/ChatWidget'
import { DatasetProvider } from '../contexts/DatasetContext'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <DatasetProvider>
      <div className="layout">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="layout__main">
          <Header onMenuClick={() => setSidebarOpen((prev) => !prev)} />
          <main className="layout__content">
            <Outlet />
          </main>
          <ChatWidget />
        </div>
      </div>
    </DatasetProvider>
  )
}
