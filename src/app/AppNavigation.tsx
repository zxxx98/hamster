import { Link, NavLink } from 'react-router-dom'

export function AppNavigation() {
  return <nav className="app-navigation" aria-label="家庭库存导航">
    <Link className="app-brand" to="/">家藏</Link>
    <div className="app-nav-links">
      <NavLink end to="/">库存</NavLink>
      <NavLink to="/locations">位置</NavLink>
      <NavLink to="/members">成员</NavLink>
    </div>
    <Link className="app-scan-link" to="/inventory/new">扫码入库</Link>
  </nav>
}
