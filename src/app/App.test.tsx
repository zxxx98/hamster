import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from './App'

afterEach(() => {
  cleanup()
})

describe('App routes', () => {
  it('renders the login page at /login', () => {
    window.history.pushState({}, '', '/login')

    render(<App />)

    expect(screen.getByRole('main')).toHaveTextContent('登录')
  })

  it('redirects unknown routes to the household inventory page', async () => {
    window.history.pushState({}, '', '/unavailable')

    render(<App />)

    expect(await screen.findByRole('main')).toHaveTextContent('家庭库存')
  })
})
