// App-wide "can we reach the server?" state. One shared flag, so many failed requests produce ONE notice (no duplicates),
// and the notice clears itself as soon as any request succeeds or the browser reports it is back online.
let state = { down: false, kind: null }
const subs = new Set()
const emit = () => subs.forEach((fn) => { try { fn(state) } catch { /* a subscriber must never break a request */ } })

export const getConnectivity = () => state
export const subscribeConnectivity = (fn) => { subs.add(fn); return () => subs.delete(fn) }
export function reportUnreachable(kind) {
  if (state.down && state.kind === kind) return
  state = { down: true, kind }; emit()
}
export function reportReachable() {
  if (!state.down) return
  state = { down: false, kind: null }; emit()
}
// Is this failure "we cannot reach / use the server at all" (→ global notice) rather than a specific request being refused?
export const isOutage = (e) =>
  (e.status === 0 && ['offline', 'network', 'timeout'].includes(e.kind)) ||                       // no answer at all
  (e.kind === 'unavailable' && (!e.data || /UNAVAILABLE$/.test(String(e.data.code || ''))))        // proxy 502/503 page, or our own SERVICE/DATABASE_UNAVAILABLE
