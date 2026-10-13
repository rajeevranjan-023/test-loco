// @vitest-environment jsdom
// Billing options (Shop Settings) — the default discount: configurable, switchable, validated, saved through the existing billing-config API.
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import './_support/adapterSwitch.js'
import { setOverride } from './_support/adapterSwitch.js'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'

const { default: BillingOptions } = await import('../src/features/analytics/BillingOptions.jsx')
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms))
let puts
beforeEach(() => { puts = []; setOverride((config) => { if (config.method === 'put') puts.push({ url: String(config.url), body: JSON.parse(config.data) }); return Promise.resolve({ data: { capabilities: JSON.parse(config.data) }, status: 200, statusText: 'OK', headers: {}, config }) }) })
afterEach(() => { cleanup(); setOverride(null) })
const open = (caps = {}) => { const onSaved = vi.fn(); render(<BillingOptions cfg={{ capabilities: { products: true, discount: true, context: [], ...caps } }} onClose={() => {}} onSaved={onSaved} />); return onSaved }
const save = async () => { fireEvent.click(screen.getByText('Save')); await act(async () => { await tick(30) }) }

describe('Default discount setting', () => {
  it('is only offered when Discount itself is on', () => {
    open({ discount: false }); expect(screen.queryByLabelText('Default discount')).toBeNull(); cleanup()
    open({ discount: true }); expect(screen.getByLabelText('Default discount').getAttribute('aria-checked')).toBe('false')
  })
  it('enable → choose % or ₹ → value; saved through PUT /api/seller/billing/config', async () => {
    const onSaved = open()
    fireEvent.click(screen.getByLabelText('Default discount'))
    fireEvent.change(screen.getByLabelText('Default discount value'), { target: { value: '12.5' } })
    await save()
    expect(puts.length).toBe(1); expect(puts[0].url).toContain('/api/seller/billing/config')
    expect(puts[0].body.defaultDiscountEnabled).toBe(true); expect(puts[0].body.defaultDiscountType).toBe('percent'); expect(puts[0].body.defaultDiscountValue).toBe(12.5)
    expect(onSaved.mock.calls.length).toBe(1)
    cleanup(); puts.length = 0
    open({ defaultDiscountEnabled: true, defaultDiscountType: 'percent', defaultDiscountValue: 12.5 }) // re-opening shows what was saved
    expect(screen.getByLabelText('Default discount value').value).toBe('12.5')
    fireEvent.change(screen.getByLabelText('Default discount type'), { target: { value: 'fixed' } }); await save()
    expect(puts[0].body.defaultDiscountType).toBe('fixed')
  })
  it('turning it off keeps the saved amount but disables it', async () => {
    open({ defaultDiscountEnabled: true, defaultDiscountType: 'fixed', defaultDiscountValue: 50 })
    fireEvent.click(screen.getByLabelText('Default discount')); await save()
    expect(puts[0].body.defaultDiscountEnabled).toBe(false)
  })
  it('refuses an empty amount while enabled, and a percentage above 100 — nothing is sent', async () => {
    open({ defaultDiscountEnabled: true, defaultDiscountType: 'percent', defaultDiscountValue: 0 })
    await save(); expect(screen.getByText(/Enter the default discount amount/)).toBeTruthy(); expect(puts.length).toBe(0)
    fireEvent.change(screen.getByLabelText('Default discount value'), { target: { value: '150' } }); await save()
    expect(screen.getByText(/cannot be more than 100%/)).toBeTruthy(); expect(puts.length).toBe(0)
  })
})
