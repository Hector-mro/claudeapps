import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'

afterEach(() => {
  // Worker tests run in the `node` environment, which has no localStorage.
  if (typeof localStorage !== 'undefined') localStorage.clear()
})
