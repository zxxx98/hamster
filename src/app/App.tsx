import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from '../features/auth/LoginPage'
import { restoreSession } from '../features/auth/api'
import { InventoryListPage } from '../features/inventory/InventoryListPage'
import { InventoryEntryPage } from '../features/inventory/InventoryEntryPage'
import { InventoryDetailPage } from '../features/inventory/InventoryDetailPage'
import { MemberManagementPage } from '../features/auth/MemberManagementPage'
import { LocationManagementPage } from '../features/locations/LocationManagementPage'
import { useHouseholdRealtime } from '../features/sync/useHouseholdRealtime'
import { AppNavigation } from './AppNavigation'

export function App() {
  const [isRestoring, setIsRestoring] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    let isActive = true

    restoreSession()
      .then((session) => {
        if (isActive) {
          setIsAuthenticated(session !== null)
        }
      })
      .catch(() => {
        if (isActive) {
          setIsAuthenticated(false)
        }
      })
      .finally(() => {
        if (isActive) {
          setIsRestoring(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [])

  useHouseholdRealtime()

  if (isRestoring) {
    return <main aria-live="polite">正在验证登录状态…</main>
  }

  return (
    <BrowserRouter>
      {isAuthenticated ? <div className="app-shell">
        <AppNavigation />
        <div className="app-content"><Routes>
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/" element={<InventoryListPage />} />
          <Route path="/inventory/new" element={<InventoryEntryPage />} />
          <Route path="/inventory/:id" element={<InventoryDetailPage />} />
          <Route path="/locations" element={<LocationManagementPage />} />
          <Route path="/members" element={<MemberManagementPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes></div>
      </div> : <Routes>
        <Route path="/login" element={<LoginPage onSession={() => setIsAuthenticated(true)} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>}
    </BrowserRouter>
  )
}
