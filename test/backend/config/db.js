import mongoose from 'mongoose'
import dns from "node:dns"
import { logger, redactText } from '../utils/logger.js'

const posInt = (v, d) => { const n = Number.parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : d }
export const dbConnectOptions = (env = process.env) => ({
  serverSelectionTimeoutMS: posInt(env.MONGO_SERVER_SELECTION_TIMEOUT_MS, 8000),
  connectTimeoutMS: posInt(env.MONGO_CONNECT_TIMEOUT_MS, 10000),
  ...(posInt(env.MONGO_HEARTBEAT_MS, 0) >= 500 ? { heartbeatFrequencyMS: posInt(env.MONGO_HEARTBEAT_MS, 0) } : {}),
})

export const isDbReady = () => mongoose.connection.readyState === 1
export const dbStateName = () => ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown'

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
