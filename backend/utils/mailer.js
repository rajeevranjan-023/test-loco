import nodemailer from 'nodemailer'
import { isProduction } from './authHelpers.js'

const real = (v) => !!v && !/^your_|^changeme|^$/i.test(v)
export const isMailConfigured = () => real(process.env.MAIL_HOST) && real(process.env.MAIL_USER) && real(process.env.MAIL_PASS)

// Returns true when an email was handed to the SMTP server. When SMTP is not configured: in development the message is
// printed to the server console (so Forgot Password can be exercised locally); in production nothing sensitive is logged.
export async function sendMail({ to, subject, text }) {
  if (!isMailConfigured()) {
    if (!isProduction()) console.log(`[mail:dev] To: ${to}\nSubject: ${subject}\n${text}\n`)
    else console.error('[mail] SMTP is not configured (MAIL_HOST / MAIL_USER / MAIL_PASS); email not sent.')
    return false
  }
  const transport = nodemailer.createTransport({ host: process.env.MAIL_HOST, port: Number(process.env.MAIL_PORT) || 587, auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS } })
  await transport.sendMail({ from: process.env.MAIL_FROM || 'Loco <no-reply@loco.app>', to, subject, text })
  return true
}
