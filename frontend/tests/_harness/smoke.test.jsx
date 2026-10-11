import { describe, it, expect } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
describe('harness', () => { it('renders JSX with hooks', () => {
  const C = () => { const [n, set] = React.useState(0); return <button type="button" onClick={() => set(n + 1)}>count {n}</button> }
  render(<C />); fireEvent.click(screen.getByText('count 0')); expect(screen.getByText('count 1').tagName).toBe('BUTTON')
}) })
