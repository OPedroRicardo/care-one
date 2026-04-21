import { GlideClient } from '@valkey/valkey-glide'

// Canal Valkey que o MQTT service escuta para iniciar medições
export const VALKEY_MEASURE_CHANNEL = 'measure:start'

let _client: Promise<GlideClient> | null = null

/**
 * Retorna (ou inicializa) o cliente Valkey compartilhado para publicação.
 * A conexão é criada uma única vez (lazy singleton).
 */
export function getValkeyPublisher(): Promise<GlideClient> {
  if (!_client) {
    _client = GlideClient.createClient({
      addresses: [
        {
          host: process.env.VALKEY_HOST ?? '127.0.0.1',
          port: parseInt(process.env.VALKEY_PORT ?? '6379', 10),
        },
      ],
    }).catch((err) => {
      // Limpa para permitir retry na próxima chamada
      _client = null
      throw err
    })
  }
  return _client
}
