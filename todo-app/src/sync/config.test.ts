import { beforeEach, describe, expect, it } from 'vitest'
import { loadAccessKey } from '../storage'
import { adoptAccessKeyFromLocation } from './config'

describe('adoptAccessKeyFromLocation', () => {
  beforeEach(() => {
    localStorage.clear()
    history.replaceState(null, '', '/')
  })

  it('stores the code from a share link and strips it from the address bar', () => {
    history.replaceState(null, '', '/#cle=abc%2D1')

    expect(adoptAccessKeyFromLocation()).toBe(true)
    expect(loadAccessKey()).toBe('abc-1')
    expect(location.hash).toBe('')
  })

  it('leaves the address and storage alone without a share link', () => {
    history.replaceState(null, '', '/#autre')

    expect(adoptAccessKeyFromLocation()).toBe(false)
    expect(loadAccessKey()).toBeNull()
    expect(location.hash).toBe('#autre')
  })

  it('adopts nothing from an empty code', () => {
    history.replaceState(null, '', '/#cle=')

    expect(adoptAccessKeyFromLocation()).toBe(false)
    expect(loadAccessKey()).toBeNull()
  })
})
