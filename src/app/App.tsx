import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from '../features/auth/LoginPage'
import { restoreSession } from '../features/auth/api'

function InventoryPage() {
  return <main>家庭库存</main>
}

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

  if (isRestoring) {
    return <main aria-live="polite">正在验证登录状态…</main>
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/" replace />
            ) : (
              <LoginPage onSession={() => setIsAuthenticated(true)} />
            )
          }
        />
        <Route
          path="/"
          element={isAuthenticated ? <InventoryPage /> : <Navigate to="/login" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
