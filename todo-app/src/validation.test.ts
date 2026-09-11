import { describe, expect, it } from 'vitest'
import { isTodo } from './validation'

const todo = { id: 'a', text: 'Loyer', createdAt: 0, difficulty: 'easy', done: false, zone: 'hector' }

describe('isTodo', () => {
  it('accepts a known author or none, and rejects anything else', () => {
    expect(isTodo(todo)).toBe(true)
    expect(isTodo({ ...todo, createdBy: 'nina' })).toBe(true)
    // A whole sync is refused if one task is invalid, so this check matters.
    expect(isTodo({ ...todo, createdBy: 'commun' })).toBe(false)
    expect(isTodo({ ...todo, createdBy: 42 })).toBe(false)
  })
})
