import { expect, it } from 'vitest'
import { locationPhotoPath } from './api'

it('keeps a location photo inside the household storage prefix', () => {
  expect(locationPhotoPath('household-1', 'location-2', 'photo.jpg'))
    .toBe('household-1/locations/location-2/photo.jpg')
})
