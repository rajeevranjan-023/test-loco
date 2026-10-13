import { logger, redactText } from './logger.js'

export function installProcessHandlers(proc = process, { exit = (code) => proc.exit(code) } = {}) {
  const describe = (e) => ({ name: e?.name, stack: redactText(e?.stack) })
  proc.on('unhandledRejection', (reason) => logger.error('process', `Unhandled promise rejection: ${redactText(reason?.message ?? reason)}`, describe(reason)))
  proc.on('uncaughtException', (err) => {
    logger.error('process', `Uncaught exception, shutting down: ${redactText(err?.message ?? err)}`, describe(err))
    exit(1)
  })
}
