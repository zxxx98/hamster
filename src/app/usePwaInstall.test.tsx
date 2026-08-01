import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { usePwaInstall } from './usePwaInstall'

type InstallEvent = Event & {
  prompt: ReturnType<typeof vi.fn>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function installEvent() {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as InstallEvent
  event.prompt = vi.fn().mockResolvedValue(undefined)
  event.userChoice = Promise.resolve({ outcome: 'accepted' })
  return event
}

afterEach(() => window.dispatchEvent(new Event('appinstalled')))

it('retains a deferred browser prompt and clears it after installing', async () => {
  const { result } = renderHook(() => usePwaInstall())
  const event = installEvent()
  act(() => window.dispatchEvent(event))

  expect(event.defaultPrevented).toBe(true)
  expect(result.current.canInstall).toBe(true)

  await act(async () => result.current.install())
  expect(event.prompt).toHaveBeenCalledOnce()
  expect(result.current.canInstall).toBe(false)
})

it('clears a deferred prompt after the browser reports installation', () => {
  const { result } = renderHook(() => usePwaInstall())
  act(() => window.dispatchEvent(installEvent()))
  act(() => window.dispatchEvent(new Event('appinstalled')))
  expect(result.current.canInstall).toBe(false)
})
