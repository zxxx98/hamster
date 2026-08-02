import { expect, it } from 'vitest'
import { parseMemberAction } from './memberManagement'

it('parses valid member actions and rejects malformed updates', () => {
  expect(parseMemberAction({ action: 'list' })).toEqual({ action: 'list' })
  expect(parseMemberAction({ action: 'delete', id: 'member-2' })).toEqual({ action: 'delete', id: 'member-2' })
  expect(parseMemberAction({ action: 'update', id: 'member-2', username: 'Lin' })).toBeNull()
  expect(parseMemberAction({ action: 'delete', id: '' })).toBeNull()
})
