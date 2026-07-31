import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

function LoginPage() {
  return <main>登录</main>
}

function InventoryPage() {
  return <main>家庭库存</main>
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<InventoryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
