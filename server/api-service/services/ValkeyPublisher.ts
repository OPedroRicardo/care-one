import Redis from 'ioredis'

export const VALKEY_MEASURE_CHANNEL = 'measure:start'

let _client: Redis | null = null

export function getValkeyPublisher(): Redis {
  if (!_client) {
    _client = new Redis({
      host: process.env.VALKEY_HOST ?? '127.0.0.1',
      port: parseInt(process.env.VALKEY_PORT ?? '6379', 10),
      lazyConnect: false,
    })

    _client.on('error', (err) => {
      console.error('[Valkey] Erro de conexão:', err)
      _client = null
    })
  }
  return _client
}
