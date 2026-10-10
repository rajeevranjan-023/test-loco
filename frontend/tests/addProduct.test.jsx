import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const post = vi.fn()
vi.mock('../src/services/api.js', () => ({ api: { post: (...a) => post(...a), get: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }, BASE_URL: 'x' }))
const { default: AddProductModal } = await import('../src/features/analytics/AddProductModal.jsx')

const existing = [{ _id: 'p1', name: 'Sugar', productCode: 'A003', stock: 117, priceUnit: 'kg' }]
let saved, closed
const setup = () => { saved = vi.fn(); closed = vi.fn(); post.mockReset(); return render(<AddProductModal products={existing} onClose={closed} onSaved={saved} />) }
beforeEach(cleanup)
const resp = (code, name, created = true) => ({ created, message: `${name} added as ${code}`, product: { _id: code, productCode: code, name, stock: 5, priceUnit: 'kg' } })

describe('Add Product form', () => {
  it('blocks empty / invalid submits with inline errors and makes no API call', async () => {
    const u = userEvent.setup(); setup()
    await u.click(screen.getByRole('button', { name: 'Add Product' }))
    expect(screen.getByText('Product name is required.')).toBeTruthy()
    expect(screen.getByText('Enter the total stock.')).toBeTruthy()
    expect(screen.getByText('Enter the cost price.')).toBeTruthy()
    expect(screen.getByText('Enter the selling price.')).toBeTruthy()
    expect(post).not.toHaveBeenCalled()
  })
  it('cannot type a negative or letter into number fields; zero stock is rejected', async () => {
    const u = userEvent.setup(); setup()
    const stock = screen.getByLabelText(/Total stock/)
    await u.type(stock, '-5abc')
    expect(stock.value).toBe('5')
    await u.clear(stock); await u.type(stock, '0')
    await u.type(screen.getByLabelText('Product name'), 'Rice'); await u.type(screen.getByLabelText(/Cost price/), '70'); await u.type(screen.getByLabelText(/Selling price/), '90')
    await u.click(screen.getByRole('button', { name: 'Add Product' }))
    expect(screen.getByText('Stock must be greater than 0.')).toBeTruthy(); expect(post).not.toHaveBeenCalled()
  })
  it('adds product 1, 2, 3 without closing: clears fields, keeps unit, refocuses name, shows toast + recent list', async () => {
    const u = userEvent.setup(); setup()
    post.mockResolvedValueOnce(resp('A010', 'Rice')).mockResolvedValueOnce(resp('A011', 'Oil')).mockResolvedValueOnce(resp('A012', 'Dal'))
    await u.selectOptions(screen.getByLabelText('Unit type'), 'liter')
    for (const [n, st, c, s] of [['Rice', '50', '70', '85'], ['Oil', '20', '110', '130'], ['Dal', '30', '90', '99']]) {
      await u.type(screen.getByLabelText('Product name'), n); await u.type(screen.getByLabelText(/Total stock/), st)
      await u.type(screen.getByLabelText(/Cost price/), c); await u.type(screen.getByLabelText(/Selling price/), s)
      await u.keyboard('{Enter}')                       // Enter submits too
      await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(new RegExp(`${n} added`)))
      expect(screen.getByLabelText('Product name').value).toBe('')
      expect(screen.getByLabelText(/Total stock/).value).toBe('')
      expect(document.activeElement).toBe(screen.getByLabelText('Product name'))   // cursor back on Product Name
      expect(screen.getByLabelText('Unit type').value).toBe('liter')                // unit kept
    }
    expect(post).toHaveBeenCalledTimes(3); expect(saved).toHaveBeenCalledTimes(3); expect(closed).not.toHaveBeenCalled()
    expect(post.mock.calls[0][1]).toMatchObject({ name: 'Rice', stock: 50, unit: 'liter', costPrice: 70, sellingPrice: 85 })
    expect(screen.getByText(/Added in this session \(3\)/)).toBeTruthy()
  })
  it('duplicate name: shows batch notice, locks the unit to the existing one, sends that unit', async () => {
    const u = userEvent.setup(); setup(); post.mockResolvedValueOnce(resp('A003', 'Sugar', false))
    await u.type(screen.getByLabelText('Product name'), '  sugar ')
    expect(screen.getByText(/new batch/i)).toBeTruthy(); expect(screen.getByLabelText('Unit type').disabled).toBe(true); expect(screen.getByLabelText('Unit type').value).toBe('kg')
    await u.type(screen.getByLabelText(/Total stock/), '10'); await u.type(screen.getByLabelText(/Cost price/), '60'); await u.type(screen.getByLabelText(/Selling price/), '80')
    await u.click(screen.getByRole('button', { name: 'Add Product' }))
    await waitFor(() => expect(post).toHaveBeenCalled()); expect(post.mock.calls[0][1].unit).toBe('kg')
  })
  it('Reset Fields clears everything; Close Form is the only way to close', async () => {
    const u = userEvent.setup(); setup()
    await u.type(screen.getByLabelText('Product name'), 'Tea'); await u.type(screen.getByLabelText(/Total stock/), '4')
    await u.click(screen.getByRole('button', { name: 'Reset Fields' }))
    expect(screen.getByLabelText('Product name').value).toBe(''); expect(screen.getByLabelText(/Total stock/).value).toBe('')
    await u.keyboard('{Escape}'); expect(closed).not.toHaveBeenCalled()
    await u.click(screen.getByRole('button', { name: 'Close Form' })); expect(closed).toHaveBeenCalledTimes(1)
  })
  it('server error keeps what was typed and shows it; button re-enables', async () => {
    const u = userEvent.setup(); setup(); post.mockRejectedValueOnce(new Error('Network down'))
    await u.type(screen.getByLabelText('Product name'), 'Rice'); await u.type(screen.getByLabelText(/Total stock/), '5'); await u.type(screen.getByLabelText(/Cost price/), '7'); await u.type(screen.getByLabelText(/Selling price/), '9')
    await u.click(screen.getByRole('button', { name: 'Add Product' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/Network down/))
    expect(screen.getByLabelText('Product name').value).toBe('Rice'); expect(screen.getByRole('button', { name: 'Add Product' }).disabled).toBe(false)
  })
})
