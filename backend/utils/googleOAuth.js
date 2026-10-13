import { OAuth2Client } from 'google-auth-library'

const apiPublicUrl = () => (process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, '')
export const redirectUri = () => process.env.GOOGLE_REDIRECT_URI || `${apiPublicUrl()}/api/auth/google/callback`

const client = () => new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, redirectUri())

export const googleOAuth = {
  isConfigured: () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),

  buildAuthUrl({ state, nonce }) {
    return client().generateAuthUrl({
      access_type: 'online',
      scope: ['openid', 'email', 'profile'],
      prompt: 'select_account',          // always show Google's account chooser (and "Use another account")
      response_type: 'code',
      state,
      nonce,
    })
  },

  async exchangeCode(code, expectedNonce) {
    const c = client()
    const { tokens } = await c.getToken(code)
    if (!tokens.id_token) throw new Error('Google did not return an ID token.')
    const ticket = await c.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID })
    const p = ticket.getPayload()
    if (!p || p.nonce !== expectedNonce) throw new Error('Google nonce mismatch.')
    return { sub: p.sub, email: (p.email || '').toLowerCase(), emailVerified: p.email_verified === true, name: p.name || '', picture: p.picture || '' }
  },
}
