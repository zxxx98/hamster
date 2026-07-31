import { BrowserRouter, Redirect, Route, Switch } from 'react-router-dom'

function LoginPage() {
  return <main>登录</main>
}

function InventoryPage() {
  return <main>家庭库存</main>
}

export function App() {
  return (
    <BrowserRouter>
      <Switch>
        <Route exact path="/login" component={LoginPage} />
        <Route exact path="/" component={InventoryPage} />
        <Redirect to="/" />
      </Switch>
    </BrowserRouter>
  )
}
