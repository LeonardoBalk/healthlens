import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LandingPage } from './pages/LandingPage/LandingPage'
import Layout from './components/Layout'
import OverviewPage from './pages/OverviewPage'
import SeriesPage from './pages/SeriesPage'
import ChartsPage from './pages/ChartsPage'
import ReportsPage from './pages/ReportsPage'
import './App.scss'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/home" element={<LandingPage />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<OverviewPage />} />
          <Route path="series" element={<SeriesPage />} />
          <Route path="charts" element={<ChartsPage />} />
          <Route path="reports" element={<ReportsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
