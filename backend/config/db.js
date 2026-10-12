import mongoose from 'mongoose'
import dns from "node:dns"
import { logger, redactText } from '../utils/logger.js'

// Bounded waits. The driver defaults are 30 s (server selection) / 30 s (connect), which is what made requests and the boot
// itself look "hung" when MongoDB was unreachable. Override with MONGO_SERVER_SELECTION_TIMEOUT_MS / MONGO_CONNECT_TIMEOUT_MS.
const posInt = (v, d) => { const n = Number.parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : d }
// MONGO_HEARTBEAT_MS (optional, ≥ 500): how often the driver checks the server; lower = a lost database is noticed sooner.
export const dbConnectOptions = (env = process.env) => ({
  serverSelectionTimeoutMS: posInt(env.MONGO_SERVER_SELECTION_TIMEOUT_MS, 8000),
  connectTimeoutMS: posInt(env.MONGO_CONNECT_TIMEOUT_MS, 10000),
  ...(posInt(env.MONGO_HEARTBEAT_MS, 0) >= 500 ? { heartbeatFrequencyMS: posInt(env.MONGO_HEARTBEAT_MS, 0) } : {}),
})

// Mongoose readyState: 0 disconnected · 1 connected · 2 connecting · 3 disconnecting
export const isDbReady = () => mongoose.connection.readyState === 1
export const dbStateName = () => ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown'

// Log connection-state transitions once per process. Without an 'error' listener a connection-level error event can
// terminate the process; the driver itself reconnects on its own, so the job here is visibility, not retry logic.
let watching = false
export function watchDbConnection(conn = mongoose.connection) {
  if (watching) return
  watching = true
  let everConnected = false
  conn.on('connected', () => {
    logger.info('db', everConnected ? 'MongoDB connection restored; serving requests again.' : 'MongoDB connected.')
    everConnected = true
  })
  conn.on('disconnected', () => logger.warn('db', 'MongoDB connection lost. Requests get 503 until it recovers (the driver reconnects automatically).'))
  conn.on('reconnected', () => logger.info('db', 'MongoDB reconnected.'))
  conn.on('error', (err) => logger.error('db', `MongoDB connection error: ${redactText(err?.message)}`, { name: err?.name }))
}

// Startup behaviour is unchanged: if the first connection fails the process exits with code 1 (a supervisor such as Render
// restarts it). What changed: the wait is bounded, the log line is redacted, and `exitOnFail:false` lets callers/tests handle it.
export async function connectDB({ exitOnFail = true } = {}) {
  const uri = process.env.MONGODB_URI

  watchDbConnection()
  try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
    await mongoose.connect(uri, dbConnectOptions())
    logger.info('db', `MongoDB connected: ${mongoose.connection.host}`)
  } catch (err) {
    logger.error('db', `MongoDB connection error at startup: ${redactText(err?.message)}`, { name: err?.name })
    if (exitOnFail) process.exit(1)
    throw err
  }
}

export default connectDB
