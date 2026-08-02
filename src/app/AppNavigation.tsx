import { Link, NavLink } from 'react-router-dom'
import { NavigationIcon } from './NavigationIcon'

export function AppNavigation() {
  return <nav className="app-navigation" aria-label="家庭库存导航">
    <Link className="app-brand" to="/">家藏</Link>
    <div className="app-nav-links">
      <NavLink end to="/" aria-label="库存"><NavigationIcon name="inventory" /><span>库存</span></NavLink>
      <NavLink to="/locations" aria-label="位置"><NavigationIcon name="locations" /><span>位置</span></NavLink>
      <NavLink to="/settings" aria-label="设置"><NavigationIcon name="settings" /><span>设置</span></NavLink>
    </div>
    <Link className="app-scan-link" to="/inventory/new" aria-label="扫码入库"><NavigationIcon name="scan" /><span>扫码入库</span></Link>
  </nav>
}
