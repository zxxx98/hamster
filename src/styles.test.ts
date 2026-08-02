import { expect, it } from 'vitest'

it('uses any coarse pointer capability for touch navigation', async () => {
  const { readFileSync } = await import('node:fs' as string)
  const styles = readFileSync('src/styles.css', 'utf8')

  expect(styles).toContain('@media (max-width: 1024px), (any-pointer: coarse)')
  expect(styles).toMatch(/@media \(max-width: 1024px\), \(any-pointer: coarse\) \{[\s\S]*?\.app-navigation \{[\s\S]*?position: fixed;[\s\S]*?top: auto;[\s\S]*?bottom: 0;/)
})
