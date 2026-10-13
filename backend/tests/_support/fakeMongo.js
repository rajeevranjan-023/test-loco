import net from 'node:net'
import { BSON } from 'mongodb'

const HELLO = () => ({
  ismaster: true, isWritablePrimary: true, helloOk: true, maxBsonObjectSize: 16777216, maxMessageSizeBytes: 48000000, maxWriteBatchSize: 100000,
  localTime: new Date(), logicalSessionTimeoutMinutes: 30, connectionId: 1, minWireVersion: 0, maxWireVersion: 21, readOnly: false, ok: 1,
})

function opMsgReply(responseTo, doc) {
  const body = Buffer.concat([Buffer.alloc(4), Buffer.from([0]), BSON.serialize(doc)])
  const head = Buffer.alloc(16); head.writeInt32LE(16 + body.length, 0); head.writeInt32LE(1, 4); head.writeInt32LE(responseTo, 8); head.writeInt32LE(2013, 12)
  return Buffer.concat([head, body])
}
function opReply(responseTo, doc) {
  const d = BSON.serialize(doc), pre = Buffer.alloc(20); pre.writeInt32LE(8, 0) /* AwaitCapable */; pre.writeInt32LE(1, 16) /* numberReturned */
  const head = Buffer.alloc(16); head.writeInt32LE(16 + 20 + d.length, 0); head.writeInt32LE(1, 4); head.writeInt32LE(responseTo, 8); head.writeInt32LE(1, 12)
  return Buffer.concat([head, pre, d])
}

export function startFakeMongo(port = 0) {
  const sockets = new Set()
  const server = net.createServer((sock) => {
    sockets.add(sock); sock.on('close', () => sockets.delete(sock)); sock.on('error', () => {})
    let buf = Buffer.alloc(0)
    sock.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk])
      while (buf.length >= 16 && buf.length >= buf.readInt32LE(0)) {
        const len = buf.readInt32LE(0), id = buf.readInt32LE(4), op = buf.readInt32LE(12), msg = buf.subarray(0, len); buf = buf.subarray(len)
        try {
          if (op === 2004) { // legacy OP_QUERY (used for the first handshake)
            let o = 16 + 4; while (msg[o] !== 0) o++; o += 1 + 8
            BSON.deserialize(msg.subarray(o)); sock.write(opReply(id, HELLO()))
          } else if (op === 2013) { // OP_MSG
            const cmd = BSON.deserialize(msg.subarray(16 + 4 + 1)), name = Object.keys(cmd)[0].toLowerCase()
            sock.write(opMsgReply(id, name === 'hello' || name === 'ismaster' ? HELLO() : { ok: 1 }))
          }
        } catch { sock.destroy() }
      }
    })
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => resolve({
      port: server.address().port,
      uri: (db = 'loco_test') => `mongodb://127.0.0.1:${server.address().port}/${db}`,
      stop: () => new Promise((r) => { for (const s of sockets) s.destroy(); server.close(() => r()) }), // "the database went away"
    }))
  })
}
