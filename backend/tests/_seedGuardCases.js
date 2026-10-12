import assert from 'node:assert/strict'
import { isProduction, autoSeedEnabled, autoSeedBlockedReason, assertDevSeedAllowed, redactUri } from '../seed/guard.js'
export function guardSelfTest(ok) {
  ok(!autoSeedEnabled({}) && !autoSeedEnabled({ AUTO_SEED: 'false' }) && !autoSeedEnabled({ AUTO_SEED: '' }), 'auto-seed is OFF unless explicitly AUTO_SEED=true')
  ok(autoSeedEnabled({ AUTO_SEED: 'true', NODE_ENV: 'development' }), 'AUTO_SEED=true enables it in development')
  for (const env of [{ NODE_ENV: 'production' }, { RENDER: 'true' }, { VERCEL: '1' }]) {
    ok(isProduction(env) && !autoSeedEnabled({ ...env, AUTO_SEED: 'true' }), `AUTO_SEED=true is ignored in production (${Object.keys(env)[0]})`)
    assert.throws(() => assertDevSeedAllowed('x', env), /production/); 
  }
  ok(autoSeedBlockedReason({ AUTO_SEED: 'true', NODE_ENV: 'production' }) !== '' && autoSeedBlockedReason({}) === '', 'a blocked auto-seed explains itself; the default is silent')
  ok(redactUri('mongodb+srv://user:secret@cluster0.x.mongodb.net/db') === 'mongodb+srv://***@cluster0.x.mongodb.net/db' && !redactUri('mongodb://u:p@h/db').includes('p@'), 'connection strings are redacted before logging')
}
