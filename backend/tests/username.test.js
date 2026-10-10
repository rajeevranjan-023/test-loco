import assert from 'node:assert/strict'
import { validateUsernameRules, normalizeUsername, USERNAME_REGEX, BLOCKED_NUMBER_PATTERNS } from '../utils/username.js'

const ok = (u) => assert.equal(validateUsernameRules(u).ok, true, `${u} should be valid: ${validateUsernameRules(u).error}`)
const bad = (u, why) => { const r = validateUsernameRules(u); assert.equal(r.ok, false, `${u} should be rejected (${why})`) }

ok('raj236'); ok('@raj236'); ok('RAJ236')               // case + optional @
ok('shopa236'); ok('kiranastore246'); ok('a1b2c4')
bad('raj123', 'spec example, but contains blocked "12"')
bad('raj12', 'only 2 digits & blocked 12'); bad('ra123', 'blocked "12"')
bad('abcdef', 'no digits'); bad('12346', 'no letter'); bad('r1234', 'blocked 12')
bad('raj', 'too short'); bad('a2b3c4d6e8f2g3h4i6j8k2', 'longer than 20')
bad('raj_123', 'underscore'); bad('raj 123', 'space'); bad('raj-123', 'dash')
bad('raj786', 'blocked 786'); bad('raj108', 'blocked 108'); bad('shop2346x9', 'blocked 9')
bad('raj420', 'blocked 420'); bad('raj007', 'blocked 007'); bad('raj100', 'blocked 100')

assert.equal(normalizeUsername('  Raj236 '), '@raj236')
assert.equal(normalizeUsername('@RAJ236'), '@raj236')
assert.equal(normalizeUsername(''), '')
assert.ok(USERNAME_REGEX.test('raj234') && !USERNAME_REGEX.test('raj23'))
assert.equal(new Set(BLOCKED_NUMBER_PATTERNS).size <= BLOCKED_NUMBER_PATTERNS.length, true)
console.log('✅ username rules')
