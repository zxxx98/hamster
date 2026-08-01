import { expect, it } from 'vitest'

it('uses any coarse pointer capability for touch navigation', async () => {
  const { readFileSync } = await import('node:fs' as string)
  const styles = readFileSync('src/styles.css', 'utf8')

  expect(styles).toContain('@media (max-width: 1024px), (any-pointer: coarse)')
})
