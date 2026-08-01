import type { ReactNode } from 'react'

type NavigationIconName = 'inventory' | 'locations' | 'members' | 'scan'

export function NavigationIcon({ name }: { name: NavigationIconName }) {
  const paths: Record<NavigationIconName, ReactNode> = {
    inventory: <><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></>,
    locations: <><path d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Z" /><circle cx="12" cy="10" r="2" /></>,
    members: <><circle cx="9" cy="9" r="3" /><circle cx="17" cy="10" r="2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M15 15.5a4 4 0 0 1 5.5 3.7" /></>,
    scan: <><path d="M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3M8 9v6M11 8v8M14 9v6M17 8v8" /></>,
  }

  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}
