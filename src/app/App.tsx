import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from '../features/auth/LoginPage'
import { InitialSetupPage } from '../features/auth/InitialSetupPage'
import { restoreSession } from '../features/auth/api'
import { getInitialSetupStatus } from '../features/auth/setupStatus'
import { InventoryListPage } from '../features/inventory/InventoryListPage'
import { InventoryEntryPage } from '../features/inventory/InventoryEntryPage'
import { InventoryDetailPage } from '../features/inventory/InventoryDetailPage'
import { SettingsPage } from '../features/auth/SettingsPage'
import { LocationManagementPage } from '../features/locations/LocationManagementPage'
import { useHouseholdRealtime } from '../features/sync/useHouseholdRealtime'
import { AppNavigation } from './AppNavigation'
import { usePwaInstall } from './usePwaInstall'

export function App() {
  const { canInstall, install } = usePwaInstall()
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [isRestoring, setIsRestoring] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null)
  const [initializationError, setInitializationError] = useState(false)

  useEffect(() => {
    let isActive = true

    async function restoreApplicationState() {
      setIsRestoring(true)
      setInitializationError(false)
      setSetupRequired(null)

      try {
        const session = await restoreSession()
        if (!isActive) return

        setIsAuthenticated(session !== null)
        if (session) return

        const isSetupRequired = await getInitialSetupStatus()
        if (isActive) {
          setSetupRequired(isSetupRequired)
        }
      } catch {
        if (isActive) {
          setInitializationError(true)
        }
      } finally {
        if (isActive) {
          setIsRestoring(false)
        }
      }
    }

    void restoreApplicationState()

    return () => {
      isActive = false
    }
  }, [loadAttempt])

  useHouseholdRealtime(isAuthenticated)

  if (isRestoring) {
    return <main aria-live="polite">正在验证登录状态…</main>
  }

  if (initializationError) {
    return (
      <main aria-live="polite">
        <p role="alert">暂时无法确认初始化状态。</p>
        <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>重试</button>
      </main>
    )
  }

  return (
    <BrowserRouter>
      {isAuthenticated ? <div className="app-shell">
        <AppNavigation />
        <div className="app-content"><Routes>
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/setup" element={<Navigate to="/" replace />} />
          <Route path="/" element={<InventoryListPage canInstall={canInstall} onInstall={install} />} />
          <Route path="/inventory/new" element={<InventoryEntryPage />} />
          <Route path="/inventory/:id" element={<InventoryDetailPage />} />
          <Route path="/locations" element={<LocationManagementPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/members" element={<Navigate to="/settings" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes></div>
      </div> : <Routes>
        <Route path="/login" element={setupRequired
          ? <Navigate to="/setup" replace />
          : <LoginPage onSession={() => setIsAuthenticated(true)} />} />
        <Route path="/setup" element={setupRequired
          ? <InitialSetupPage onSession={() => setIsAuthenticated(true)} />
          : <Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to={setupRequired ? '/setup' : '/login'} replace />} />
      </Routes>}
    </BrowserRouter>
  )
}
