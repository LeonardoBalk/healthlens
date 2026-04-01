import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LandingPage } from './pages/LandingPage/LandingPage'
import Layout from './components/Layout'
import OverviewPage from './pages/OverviewPage'
import SeriesPage from './pages/SeriesPage'
import ChartsPage from './pages/ChartsPage'
import ReportsPage from './pages/ReportsPage'
import LoginPage from './pages/LoginPage/LoginPage'
import DatasetUploadPage from './pages/DatasetUploadPage/DatasetUploadPage'
import DatasetsPage from './pages/DatasetsPage/DatasetsPage'
import './App.scss'

import { ThemeProvider } from './contexts/ThemeContext'

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/datasets" element={<Layout />}>
            <Route index element={<OverviewPage />} />
            <Route path="list" element={<DatasetsPage />} />
            <Route path="new" element={<DatasetUploadPage />} />
            <Route path="series" element={<SeriesPage />} />
            <Route path="charts" element={<ChartsPage />} />
            <Route path="reports" element={<ReportsPage />} />
          </Route>
          <Route path="/overview" element={<Navigate to="/datasets" replace />} />
          <Route path="/list" element={<Navigate to="/datasets/list" replace />} />
          <Route path="/new" element={<Navigate to="/datasets/new" replace />} />
          <Route path="/series" element={<Navigate to="/datasets/series" replace />} />
          <Route path="/charts" element={<Navigate to="/datasets/charts" replace />} />
          <Route path="/reports" element={<Navigate to="/datasets/reports" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
