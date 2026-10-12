import { logger, redactText } from './logger.js'

// Nothing that escapes every try/catch may vanish silently.
//  • unhandledRejection  → logged at error level with the (redacted) stack; the process keeps serving. A forgotten promise in
//                          one request (e.g. a fire-and-forget e-mail) must not take every other user's session down with it.
//  • uncaughtException   → logged, then exit(1): after a synchronous throw nobody knows what state the process is in, so the
//                          supervisor (Render / pm2 / nodemon) restarts it cleanly.
export function installProcessHandlers(proc = process, { exit = (code) => proc.exit(code) } = {}) {
  const describe = (e) => ({ name: e?.name, stack: redactText(e?.stack) })
  proc.on('unhandledRejection', (reason) => logger.error('process', `Unhandled promise rejection: ${redactText(reason?.message ?? reason)}`, describe(reason)))
  proc.on('uncaughtException', (err) => {
    logger.error('process', `Uncaught exception, shutting down: ${redactText(err?.message ?? err)}`, describe(err))
    exit(1)
  })
}
