/**
 * Minimal WebRTC signaling relay for telechamada video calls.
 *
 * A WebSocket endpoint at `ws://<host>/ws/videochamada?room=<appointmentId>`
 * groups peers into rooms keyed by appointment id and relays the raw signaling
 * payloads (offer / answer / ICE candidates) between the two participants.
 * STUN-only on the client side — for production you'd also need a TURN server
 * for peers behind symmetric NATs.
 */
import type { Server, IncomingMessage } from 'node:http'
import type { Socket } from 'node:net'
import { WebSocketServer, WebSocket } from 'ws'

const rooms = new Map<string, Set<WebSocket>>()

export function attachSignaling(server: Server) {
  const wss = new WebSocketServer({ noServer: true })

  server.on('upgrade', (req: IncomingMessage, socket: Socket, head: Buffer) => {
    let pathname = ''
    try { pathname = new URL(req.url ?? '', 'http://localhost').pathname } catch { /* noop */ }

    if (!pathname.startsWith('/ws/videochamada')) {
      socket.destroy()
      return
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req))
  })

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url  = new URL(req.url ?? '', 'http://localhost')
    const room = url.searchParams.get('room') ?? 'default'

    let peers = rooms.get(room)
    if (!peers) { peers = new Set(); rooms.set(room, peers) }
    peers.add(ws)

    const others = [...peers].filter(p => p !== ws && p.readyState === WebSocket.OPEN)
    // Newcomer learns how many peers are already present (drives who makes the offer).
    ws.send(JSON.stringify({ kind: 'joined', peers: others.length }))
    for (const p of others) p.send(JSON.stringify({ kind: 'peer-joined' }))

    ws.on('message', data => {
      const payload = data.toString()
      for (const p of peers!) {
        if (p !== ws && p.readyState === WebSocket.OPEN) p.send(payload)
      }
    })

    ws.on('close', () => {
      peers!.delete(ws)
      for (const p of peers!) {
        if (p.readyState === WebSocket.OPEN) p.send(JSON.stringify({ kind: 'peer-left' }))
      }
      if (peers!.size === 0) rooms.delete(room)
    })

    ws.on('error', () => { /* ignore — close handler cleans up */ })
  })
}
