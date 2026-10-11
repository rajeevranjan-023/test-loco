// jsdom globals for React Testing Library (loaded with node --import before the tests).
import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true })
const w = dom.window
for (const k of ['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'location', 'history', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'StorageEvent', 'PageTransitionEvent', 'CustomEvent', 'MutationObserver', 'getComputedStyle', 'DocumentFragment', 'HTMLInputElement', 'HTMLButtonElement'])
  Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true })
globalThis.IS_REACT_ACT_ENVIRONMENT = true
globalThis.requestAnimationFrame = (f) => setTimeout(f, 0)
globalThis.cancelAnimationFrame = clearTimeout
