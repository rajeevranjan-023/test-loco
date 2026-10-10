import mongoose from 'mongoose'
import dns from "node:dns"

export async function connectDB() {
  const uri = process.env.MONGODB_URI

  try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
    await mongoose.connect(uri)
    console.log(`MongoDB connected: ${mongoose.connection.host}`)
  } catch (err) {
    console.error(' MongoDB connection error:', err.message)
    process.exit(1)
  }
}

export default connectDB
