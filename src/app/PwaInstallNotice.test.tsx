import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { PwaInstallNotice } from './PwaInstallNotice'

it('starts installation only after the user taps the notice action', () => {
  const onInstall = vi.fn()
  render(<PwaInstallNotice onInstall={onInstall} />)

  expect(onInstall).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '安装到桌面' }))
  expect(onInstall).toHaveBeenCalledOnce()
})
