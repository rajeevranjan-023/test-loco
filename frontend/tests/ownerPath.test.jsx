import { describe, it, expect } from 'vitest'
import { toOwnerPath, sectionOf } from '../src/utils/username.js'

describe('toOwnerPath', () => {
  const u = '@raj236'
  it.each([
    ['/analytics', '/raj236/analytics'],
    ['/analytics/orders', '/raj236/dashboard'],
    ['/analytics/customers', '/raj236/customer'],
    ['/analytics/billing?draft=9', '/raj236/billing?draft=9'],
    ['/analytics/billing?new=1', '/raj236/add'],
    ['/analytics/profile', '/raj236/shop'],
    ['/customer/42#transactions', '/raj236/customer/42#transactions'],
    ['/bill/7?print=1', '/raj236/bill/7?print=1'],
    ['/raj236/billing', '/raj236/billing'],
    ['/settings', '/settings'],
  ])('%s -> %s', (from, to) => expect(toOwnerPath(u, from)).toBe(to))

  it('sectionOf', () => {
    expect(sectionOf('/raj236')).toBe('')
    expect(sectionOf('/raj236/udhar')).toBe('udhar')
  })
})
