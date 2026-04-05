import { describe, it, expect } from 'vitest'
import { formatTokenCount } from '../tokenCounter'

describe('formatTokenCount()', () => {
  it('formats small counts as plain number', () => {
    expect(formatTokenCount(42)).toBe('42 tokens')
  })

  it('formats counts >= 1000 with k suffix', () => {
    expect(formatTokenCount(1500)).toBe('1.5k tokens')
  })

  it('formats exactly 1000', () => {
    expect(formatTokenCount(1000)).toBe('1.0k tokens')
  })

  it('formats zero', () => {
    expect(formatTokenCount(0)).toBe('0 tokens')
  })

  it('formats large counts', () => {
    expect(formatTokenCount(128000)).toBe('128.0k tokens')
  })

  it('formats 999 without k suffix', () => {
    expect(formatTokenCount(999)).toBe('999 tokens')
  })

  it('formats fractional k values', () => {
    expect(formatTokenCount(2345)).toBe('2.3k tokens')
  })
})
