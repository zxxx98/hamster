import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const supabaseMock = vi.hoisted(() => ({
  auth: { getUser: vi.fn() },
  from: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({ supabase: supabaseMock }))

import { LocationManagementPage } from './LocationManagementPage'

type SetupOptions = {
  roomWriteError?: Error
  failRoomRefresh?: boolean
  locationWriteError?: Error
  failLocationRefresh?: boolean
  initialRooms?: { id: string; name: string }[]
}

function setupSupabase({
  roomWriteError,
  failRoomRefresh,
  locationWriteError,
  failLocationRefresh,
  initialRooms = [],
}: SetupOptions = {}) {
  let roomReadCount = 0
  let locationReadCount = 0
  const createdRoom = { id: 'room-kitchen', name: '厨房' }
  const createdLocation = { id: 'location-cabinet', name: '橱柜', room_id: 'room-kitchen', photo_path: null, rooms: [{ name: '厨房' }] }
  const roomWrite = {
    data: roomWriteError ? null : createdRoom,
    error: roomWriteError ?? null,
    select: () => ({ single: vi.fn().mockResolvedValue({ data: roomWriteError ? null : createdRoom, error: roomWriteError ?? null }) }),
  }
  const locationWrite = {
    data: locationWriteError ? null : createdLocation,
    error: locationWriteError ?? null,
    select: () => ({ single: vi.fn().mockResolvedValue({ data: locationWriteError ? null : createdLocation, error: locationWriteError ?? null }) }),
  }

  supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'member-1' } }, error: null })
  supabaseMock.from.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return { select: () => ({ eq: () => ({ single: vi.fn().mockResolvedValue({ data: { household_id: 'household-1' }, error: null }) }) }) }
    }
    if (table === 'rooms') {
      return {
        select: () => ({ order: vi.fn().mockImplementation(() => {
          roomReadCount += 1
          return Promise.resolve(failRoomRefresh && roomReadCount > 1
            ? { data: null, error: new Error('room reload failed') }
            : { data: initialRooms, error: null })
        }) }),
        upsert: vi.fn().mockReturnValue(roomWrite),
      }
    }
    if (table === 'storage_locations') {
      return {
        select: () => ({ order: vi.fn().mockImplementation(() => {
          locationReadCount += 1
          return Promise.resolve(failLocationRefresh && locationReadCount > 1
            ? { data: null, error: new Error('location reload failed') }
            : { data: [], error: null })
        }) }),
        insert: vi.fn().mockReturnValue(locationWrite),
      }
    }
    throw new Error(`Unexpected table: ${table}`)
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  setupSupabase()
})

afterEach(cleanup)

it('does not render a return-to-inventory link', () => {
  render(<MemoryRouter><LocationManagementPage /></MemoryRouter>)

  expect(screen.getByRole('heading', { name: '位置' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: '返回库存' })).not.toBeInTheDocument()
})

it('keeps a successfully saved room visible when the following refresh fails', async () => {
  setupSupabase({ failRoomRefresh: true })
  render(<MemoryRouter><LocationManagementPage /></MemoryRouter>)
  const roomInput = await screen.findByLabelText('新房间')
  await waitFor(() => expect(screen.getByRole('button', { name: '添加房间' })).toBeEnabled())
  fireEvent.change(roomInput, { target: { value: '厨房' } })
  fireEvent.submit(roomInput.closest('form')!)

  const roomsSection = screen.getByRole('heading', { name: '房间' }).closest('section')!
  expect(await within(roomsSection).findByText('厨房')).toBeInTheDocument()
  expect(screen.queryByText('无法保存房间，请重试。')).not.toBeInTheDocument()
  expect(roomInput).toHaveValue('')
})

it('keeps the room form and reports an error when the room write fails', async () => {
  setupSupabase({ roomWriteError: new Error('write failed') })
  render(<MemoryRouter><LocationManagementPage /></MemoryRouter>)
  const roomInput = await screen.findByLabelText('新房间')
  await waitFor(() => expect(screen.getByRole('button', { name: '添加房间' })).toBeEnabled())
  fireEvent.change(roomInput, { target: { value: '厨房' } })
  fireEvent.submit(roomInput.closest('form')!)

  expect(await screen.findByRole('alert')).toHaveTextContent('无法保存房间，请重试。')
  expect(roomInput).toHaveValue('厨房')
})

it('keeps a successfully saved location visible when the following refresh fails', async () => {
  setupSupabase({ failLocationRefresh: true, initialRooms: [{ id: 'room-kitchen', name: '厨房' }] })
  render(<MemoryRouter><LocationManagementPage /></MemoryRouter>)
  const locationInput = await screen.findByLabelText('存放点')
  const locationForm = locationInput.closest('form')!
  const roomSelect = locationForm.querySelector<HTMLSelectElement>('select')!
  await waitFor(() => expect(screen.getByRole('button', { name: '添加存放点' })).toBeEnabled())
  fireEvent.change(roomSelect, { target: { value: 'room-kitchen' } })
  fireEvent.change(locationInput, { target: { value: '橱柜' } })
  fireEvent.submit(locationForm)

  expect(await screen.findByText('厨房 / 橱柜')).toBeInTheDocument()
  expect(screen.queryByText('无法保存存放点；同一房间内请使用不同名称。')).not.toBeInTheDocument()
  expect(locationInput).toHaveValue('')
})

it('keeps the location form and reports an error when the location write fails', async () => {
  setupSupabase({ locationWriteError: new Error('write failed'), initialRooms: [{ id: 'room-kitchen', name: '厨房' }] })
  render(<MemoryRouter><LocationManagementPage /></MemoryRouter>)
  const locationInput = await screen.findByLabelText('存放点')
  const locationForm = locationInput.closest('form')!
  const roomSelect = locationForm.querySelector<HTMLSelectElement>('select')!
  await waitFor(() => expect(screen.getByRole('button', { name: '添加存放点' })).toBeEnabled())
  fireEvent.change(roomSelect, { target: { value: 'room-kitchen' } })
  fireEvent.change(locationInput, { target: { value: '橱柜' } })
  fireEvent.submit(locationForm)

  expect(await screen.findByRole('alert')).toHaveTextContent('无法保存存放点；同一房间内请使用不同名称。')
  expect(locationInput).toHaveValue('橱柜')
})

it('uses text action styling for both location creation buttons', async () => {
  render(<MemoryRouter><LocationManagementPage /></MemoryRouter>)

  expect(await screen.findByRole('button', { name: '添加房间' })).toHaveClass('location-create-action')
  expect(screen.getByRole('button', { name: '添加存放点' })).toHaveClass('location-create-action')
})
