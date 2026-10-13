// @vitest-environment jsdom
// Orders list — React warning "Encountered two children with the same key, '2'" (OrdersPage pagination).
// Root cause: the page buttons were keyed by page number, the "…" gaps by their array INDEX — the gap in [1, 2, '…', 4] sits at index 2, the same key as page 2.
// Runs under real vitest and under the sandbox runner:  node --import ./tests/_harness/register.mjs tests/_harness/run.mjs tests/ordersPagination.test.jsx
import React from 'react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import './_support/adapterSwitch.js'
import { setOverride } from './_support/adapterSwitch.js'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { render, screen, cleanup, act } from '@testing-library/react'

const { default: OrdersPage } = await import('../src/features/analytics/pages/OrdersPage.jsx')
const { pageList, pageKey } = await import('../src/features/analytics/orders/shared.jsx')
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms))

const card = { count: 0, pct: 0 }
const orders = (pages, page) => (config) => Promise.resolve({ status: 200, statusText: 'OK', headers: {}, config, data: String(config.url).includes('/api/seller/orders') ? { orders: [], counts: {}, summary: { total: card, new: card, preparing: card, out: card, delivered: card }, total: pages * 10, page, pages, limit: 10 } : [] })
let errors, orig
beforeEach(() => { errors = []; orig = console.error; console.error = (...a) => { errors.push(a.map(String).join(' ')); } })
afterEach(() => { console.error = orig; cleanup(); setOverride(null) })

describe('pagination keys', () => {
  it('every page button and every "…" gap gets its own key, for every page count / current page', () => {
    for (let n = 1; n <= 40; n++) for (let c = 1; c <= n; c++) {
      const keys = pageList(n, c).map(pageKey)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })
  it('the failing case: [1, 2, "…", 4] — the gap used to share key "2" with page 2', () => {
    const list = pageList(4, 1); expect(list).toEqual([1, 2, '…', 4])
    expect(list.map((p, i) => (p === '…' ? i : p))).toEqual([1, 2, 2, 4]) // the OLD scheme: duplicate "2"
    expect(list.map(pageKey)).toEqual(['page-1', 'page-2', 'gap-2', 'page-4'])
  })
  it('still lists the same pages as before (only the keys changed)', () => {
    expect(pageList(1, 1)).toEqual([1]); expect(pageList(3, 2)).toEqual([1, 2, 3]); expect(pageList(12, 6)).toEqual([1, '…', 5, 6, 7, '…', 12])
  })
})

describe('OrdersPage', () => {
  for (const [pages, page] of [[4, 1], [5, 2], [12, 6], [9, 9]]) {
    it(`renders ${pages} pages (on page ${page}) with no duplicate-key warning`, async () => {
      setOverride(orders(pages, page))
      render(<MemoryRouter initialEntries={['/raj236/orders']}><Routes><Route path="/:username/orders" element={<OrdersPage />} /></Routes></MemoryRouter>)
      await act(async () => { await tick(60) })
      expect(screen.getByLabelText('Next page')).toBeTruthy()
      expect(errors.filter((e) => /same key|unique "key"/i.test(e))).toEqual([])
    })
  }
})
