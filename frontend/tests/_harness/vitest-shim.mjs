// Minimal vitest-compatible API (describe / it / expect / vi.fn / hooks) for the sandbox runner.
import assert from 'node:assert/strict'
export const suites = []
let cur = { name: '', tests: [], before: [], after: [] }
const root = cur
export function describe(name, fn) { const prev = cur; cur = { name: `${prev.name ? prev.name + ' › ' : ''}${name}`, tests: [], before: [...prev.before], after: [...prev.after] }; suites.push(cur); fn(); cur = prev }
export const it = (name, fn) => cur.tests.push({ name, fn })
export const test = it
it.each = (rows) => (name, fn) => rows.forEach((r) => it(name.replace('%s', String(r[0])), () => fn(...(Array.isArray(r) ? r : [r]))))
export const beforeEach = (fn) => cur.before.push(fn)
export const afterEach = (fn) => cur.after.push(fn)
suites.push(root)
const eq = (a, b) => { try { assert.deepStrictEqual(a, b); return true } catch { return false } }
const build = (actual, neg) => {
  const chk = (ok, msg) => { if (neg ? ok : !ok) throw new assert.AssertionError({ message: `${neg ? 'NOT ' : ''}${typeof msg === 'function' ? msg() : msg}` }) }
  return {
    toBe: (e) => chk(Object.is(actual, e), () => `expected ${show(actual)} to be ${show(e)}`),
    toEqual: (e) => chk(eq(actual, e), () => `expected ${show(actual)} to equal ${show(e)}`),
    toBeTruthy: () => chk(!!actual, () => `expected ${show(actual)} to be truthy`),
    toBeFalsy: () => chk(!actual, () => `expected ${show(actual)} to be falsy`),
    toBeNull: () => chk(actual === null, () => `expected ${show(actual)} to be null`),
    toBeUndefined: () => chk(actual === undefined, () => `expected ${show(actual)} to be undefined`),
    toContain: (e) => chk(actual?.includes?.(e), () => `expected ${show(actual)} to contain ${show(e)}`),
    toMatch: (re) => chk(re.test(actual), () => `expected ${show(actual)} to match ${re}`),
    toHaveLength: (n) => chk(actual?.length === n, () => `expected length ${actual?.length} to be ${n}`),
    toBeGreaterThan: (n) => chk(actual > n, () => `expected ${actual} > ${n}`),
  }
}
const show = (v) => { try { return JSON.stringify(v) } catch { return String(v) } }
export const expect = (actual) => ({ ...build(actual, false), not: build(actual, true) })
export const vi = { fn: (impl = () => undefined) => { const f = (...a) => { f.mock.calls.push(a); return impl(...a) }; f.mock = { calls: [] }; return f } }
