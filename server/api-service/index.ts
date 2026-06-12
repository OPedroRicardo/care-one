import http from 'node:http'
import { createApp } from '@api-service/app.ts'
import { attachSignaling } from '@api-service/services/SignalingService.ts'

const app = await createApp()

// Wrap in an explicit HTTP server so the WebRTC signaling WebSocket can share the port.
const server = http.createServer(app)
attachSignaling(server)

const PORT = process.env.PORT ?? 3000
server.listen(PORT, () => {
  console.log(`OK! Process running on port ${PORT}`)
})

export default app
