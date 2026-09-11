import { afterEach, describe, expect, it, vi } from 'vitest'
import { pushSupport } from './push'

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  Reflect.deleteProperty(navigator, 'serviceWorker')
})

describe('pushSupport', () => {
  it('is unsupported when no server key is configured', () => {
    expect(pushSupport()).toBe('unsupported')
  })

  it('sends iPhone Safari to the home-screen app first', () => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'key')
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE_SAFARI)
    expect(pushSupport()).toBe('needs-install')
  })

  it('is available where the browser has push', () => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'key')
    vi.stubGlobal('PushManager', class {})
    vi.stubGlobal('Notification', class {})
    Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true })
    expect(pushSupport()).toBe('ok')
  })
})
