// node --import ./tests/_harness/register.mjs tests/_harness/run.mjs tests/foo.test.jsx …   (sandbox runner, see loader.mjs)
import { pathToFileURL } from 'node:url'
import { resolve as res } from 'node:path'
const { suites } = await import('./vitest-shim.mjs')
let pass = 0, fail = 0
for (const f of process.argv.slice(2)) {
  suites.length = 1; suites[0].tests.length = 0
  await import(pathToFileURL(res(f)).href)
  console.log(`\n${f}`)
  for (const s of suites) for (const t of s.tests) {
    try { for (const b of s.before) await b(); await t.fn(); pass++; console.log(`  ✅ ${s.name ? s.name + ' › ' : ''}${t.name}`) }
    catch (e) { fail++; console.log(`  ❌ ${s.name ? s.name + ' › ' : ''}${t.name}\n     ${String(e.message).split('\n')[0]}`) }
    finally { for (const a of s.after) { try { await a() } catch { /* cleanup */ } } }
  }
}
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0)
